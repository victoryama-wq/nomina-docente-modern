import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, link, lstat, mkdtemp, open, realpath, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { firebaseAdmin } from '../firebase.js';

type DossierBucket = ReturnType<ReturnType<typeof firebaseAdmin.storage>['bucket']>;

export interface StoredObject {
  key: string;
  generation: string;
}

export interface DossierStorage {
  assertSafe(): Promise<void>;
  put(key: string, bytes: Buffer): Promise<StoredObject>;
  stat(key: string): Promise<StoredObject | null>;
  read(object: StoredObject): Promise<Buffer>;
  remove(object: StoredObject): Promise<void>;
}

// Keys identify operations, not filenames. The caller must never reuse a retired key.
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY = new RegExp(`^${UUID}(?:/${UUID}){0,7}(?![\\s\\S])`);
const PDF_MAX_BYTES = 7.5 * 1024 * 1024;
// Conservative adapter ceilings, not configurable here. The parent may impose stricter limits.
const PDF_MAX_PAGES = 500;

export class DossierStorageError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'DossierStorageError';
  }
}

function fail(code: string): never {
  throw new DossierStorageError(code);
}

function errorCode(error: unknown): unknown {
  return error && typeof error === 'object' && 'code' in error ? error.code : undefined;
}

async function storageCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DossierStorageError) throw error;
    const code = errorCode(error);
    if (code === 'EEXIST' || code === 412 || code === '412') fail('DOSSIER_STORAGE_CONFLICT');
    if (code === 'ENOENT' || code === 404 || code === '404') fail('DOSSIER_STORAGE_NOT_FOUND');
    fail('DOSSIER_STORAGE_UNAVAILABLE');
  }
}

function validateKey(key: string): void {
  if (typeof key !== 'string' || key.length > 295 || !KEY.test(key)) fail('DOSSIER_STORAGE_INVALID_KEY');
}

function digest(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function localEnvironment(): void {
  if (process.env.DB_NAME !== 'nomina_docente_test' || process.env.NODE_ENV === 'production' ||
      !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? '')) {
    fail('DOSSIER_STORAGE_UNSAFE');
  }
}

function localObject(object: StoredObject): void {
  validateKey(object?.key);
  if (typeof object.generation !== 'string' || object.generation.length !== 64 || !/^[0-9a-f]{64}$/.test(object.generation)) {
    fail('DOSSIER_STORAGE_INVALID_GENERATION');
  }
}

/** Test-only storage in a caller-created private mkdtemp directory, never a workspace path. */
export class LocalDossierStorage implements DossierStorage {
  constructor(private readonly root: string) {}

  async assertSafe(): Promise<void> {
    await storageCall(async () => {
      localEnvironment();
      if (!path.isAbsolute(this.root)) fail('DOSSIER_STORAGE_UNSAFE');
      const temporaryRoot = await realpath(tmpdir());
      const root = await realpath(this.root);
      const relative = path.relative(temporaryRoot, root);
      const info = await lstat(this.root);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative) || path.relative(path.resolve(this.root), root) !== '' ||
          !info.isDirectory() || info.isSymbolicLink() ||
          (process.platform !== 'win32' && (info.mode & 0o077) !== 0)) {
        fail('DOSSIER_STORAGE_UNSAFE');
      }
    });
  }

  private filename(key: string): string {
    validateKey(key);
    // Flatten keys to avoid traversing any caller-supplied directory components.
    return path.join(this.root, `${digest(key)}.pdf`);
  }

  private async bytes(key: string): Promise<Buffer> {
    const filename = this.filename(key);
    const info = await lstat(filename);
    if (!info.isFile() || info.isSymbolicLink()) fail('DOSSIER_STORAGE_UNSAFE');
    const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.ino !== info.ino || opened.dev !== info.dev) {
        fail('DOSSIER_STORAGE_UNSAFE');
      }
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  }

  async put(key: string, bytes: Buffer): Promise<StoredObject> {
    const filename = this.filename(key);
    if (!Buffer.isBuffer(bytes)) fail('DOSSIER_STORAGE_INVALID_BYTES');
    const snapshot = Buffer.from(bytes);
    return storageCall(async () => {
      await this.assertSafe();
      const temporary = path.join(this.root, `.${randomUUID()}.tmp`);
      const handle = await open(temporary, 'wx', 0o600);
      try {
        try {
          await handle.writeFile(snapshot);
          await handle.sync();
        } finally {
          await handle.close();
        }
        // Hard-link publication is atomic AND create-only; rename can overwrite a winner.
        await link(temporary, filename);
        return { key, generation: digest(snapshot) };
      } finally {
        await unlink(temporary);
      }
    });
  }

  async stat(key: string): Promise<StoredObject | null> {
    validateKey(key);
    return storageCall(async () => {
      await this.assertSafe();
      try {
        return { key, generation: digest(await this.bytes(key)) };
      } catch (error) {
        if (errorCode(error) === 'ENOENT') return null;
        throw error;
      }
    });
  }

  async read(object: StoredObject): Promise<Buffer> {
    localObject(object);
    return storageCall(async () => {
      await this.assertSafe();
      const bytes = await this.bytes(object.key);
      if (digest(bytes) !== object.generation) fail('DOSSIER_STORAGE_CONFLICT');
      return bytes;
    });
  }

  async remove(object: StoredObject): Promise<void> {
    localObject(object);
    await storageCall(async () => {
      await this.assertSafe();
      try {
        const bytes = await this.bytes(object.key);
        if (digest(bytes) !== object.generation) fail('DOSSIER_STORAGE_CONFLICT');
        // Immutable, never-reused operation keys make compare/unlink safe across adapters.
        await unlink(this.filename(object.key));
      } catch (error) {
        if (errorCode(error) !== 'ENOENT') throw error;
      }
    });
  }
}

function bucketName(name: string, constancias: string): void {
  if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9](?![\s\S])/.test(name) ||
      name === constancias || name === process.env.CONSTANCIAS_BUCKET) {
    fail('DOSSIER_STORAGE_UNSAFE');
  }
}

function googleGeneration(value: unknown): string {
  // This installed SDK converts FileOptions.generation to Number internally.
  const generation = typeof value === 'number' ? String(value) : value;
  if (typeof generation !== 'string' || !/^[1-9][0-9]{0,15}(?![\s\S])/.test(generation) ||
      !Number.isSafeInteger(Number(generation))) fail('DOSSIER_STORAGE_INVALID_GENERATION');
  return generation;
}

/** No constructor I/O. Actual use requires explicit, separately authorized bucket configuration. */
export class GoogleDossierStorage implements DossierStorage {
  constructor(private readonly bucket: string) {
    bucketName(bucket, process.env.CONSTANCIAS_BUCKET ?? 'nomina-docente-prod-constancias');
  }

  private async safeBucket(): Promise<DossierBucket> {
    return storageCall(async () => {
      const { config } = await import('../config.js');
      bucketName(this.bucket, config.CONSTANCIAS_BUCKET);
      const { firebaseAdmin } = await import('../firebase.js');
      const bucket = firebaseAdmin.storage().bucket(this.bucket);
      const [metadata] = await bucket.getMetadata();
      const softDelete = metadata.softDeletePolicy?.retentionDurationSeconds;
      if (metadata.name !== this.bucket || metadata.versioning?.enabled !== false ||
          (softDelete !== 0 && softDelete !== '0') || metadata.retentionPolicy != null ||
          metadata.defaultEventBasedHold === true || metadata.objectRetention != null ||
          metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled !== true ||
          metadata.iamConfiguration?.publicAccessPrevention !== 'enforced') {
        fail('DOSSIER_STORAGE_UNSAFE');
      }
      return bucket;
    });
  }

  async assertSafe(): Promise<void> {
    await this.safeBucket();
  }

  async put(key: string, bytes: Buffer): Promise<StoredObject> {
    validateKey(key);
    if (!Buffer.isBuffer(bytes)) fail('DOSSIER_STORAGE_INVALID_BYTES');
    const snapshot = Buffer.from(bytes);
    return storageCall(async () => {
      const bucket = await this.safeBucket();
      const file = bucket.file(key, { preconditionOpts: { ifGenerationMatch: 0 } });
      await file.save(snapshot, {
        resumable: false,
        validation: 'crc32c',
        timeout: 30_000,
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' }
      });
      // Use the upload response, never a racy lookup of whichever generation is now live.
      return { key, generation: googleGeneration(file.metadata.generation) };
    });
  }

  async stat(key: string): Promise<StoredObject | null> {
    validateKey(key);
    return storageCall(async () => {
      const bucket = await this.safeBucket();
      try {
        const [metadata] = await bucket.file(key).getMetadata();
        return { key, generation: googleGeneration(metadata.generation) };
      } catch (error) {
        if (errorCode(error) === 404 || errorCode(error) === '404') return null;
        throw error;
      }
    });
  }

  async read(object: StoredObject): Promise<Buffer> {
    validateKey(object?.key);
    const generation = googleGeneration(object.generation);
    return storageCall(async () => {
      const bucket = await this.safeBucket();
      const [bytes] = await bucket.file(object.key, {
        generation,
        preconditionOpts: { ifGenerationMatch: generation }
      }).download({ validation: 'crc32c', decompress: false });
      return bytes;
    });
  }

  async remove(object: StoredObject): Promise<void> {
    validateKey(object?.key);
    const generation = googleGeneration(object.generation);
    await storageCall(async () => {
      const bucket = await this.safeBucket();
      try {
        // Condition the live object: a newer generation must give 412, not an old-version 404.
        await bucket.file(object.key, { preconditionOpts: { ifGenerationMatch: generation } }).delete();
      } catch (error) {
        if (errorCode(error) !== 404 && errorCode(error) !== '404') throw error;
      }
    });
  }
}

function pdfinfo(executable: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(executable, args, {
      shell: false,
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 256 * 1024,
      encoding: 'utf8',
      // The PDF parser does not need DB credentials, service tokens or app configuration.
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
        TMP: process.env.TMP, TEMP: process.env.TEMP, TMPDIR: process.env.TMPDIR, LC_ALL: 'C', LANG: 'C' }
    }, (error, stdout, stderr) => {
      if (error || stderr.trim()) {
        const unavailable = ['ENOENT', 'EACCES', 'ENOEXEC'].includes(String(errorCode(error)));
        reject(new DossierStorageError(unavailable ? 'DOSSIER_PDF_VALIDATOR_UNAVAILABLE' : 'DOSSIER_PDF_INVALID'));
      } else {
        resolve(stdout);
      }
    });
  });
}

/** Structural/active-content checks only, NOT a malware scan. MIME/batch policy belongs to the caller. */
export async function validateDossierPdf(bytes: Buffer): Promise<void> {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) fail('DOSSIER_PDF_INVALID');
  if (bytes.length > PDF_MAX_BYTES) fail('DOSSIER_PDF_TOO_LARGE');
  bytes = Buffer.from(bytes);
  if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(bytes.subarray(0, 16).toString('ascii')) ||
      !/%%EOF[\t\r\n ]*$/.test(bytes.subarray(-1024).toString('ascii'))) fail('DOSSIER_PDF_INVALID');
  const executable = process.env.DOSSIER_PDFINFO_PATH;
  if (!executable || !path.isAbsolute(executable)) fail('DOSSIER_PDF_VALIDATOR_UNAVAILABLE');
  let directory: string | undefined;
  try {
    directory = await mkdtemp(path.join(tmpdir(), 'nomina-dossier-pdf-'));
    await chmod(directory, 0o700);
    const filename = path.join(directory, 'document.pdf');
    await writeFile(filename, bytes, { flag: 'wx', mode: 0o600 });
    const info = await pdfinfo(executable, [filename]);
    // Reject ambiguous fields too: PDF metadata can contain attacker-controlled newlines.
    const field = (name: string) => {
      const matches = [...info.matchAll(new RegExp(`^${name}:[ \\t]*(.*)$`, 'gm'))];
      return matches.length === 1 ? matches[0][1].trim() : undefined;
    };
    const pages = field('Pages');
    if (!pages || !/^[1-9][0-9]*$/.test(pages) || Number(pages) > PDF_MAX_PAGES || field('Encrypted') !== 'no' ||
        field('JavaScript') !== 'no') fail('DOSSIER_PDF_INVALID');
    if ((await pdfinfo(executable, ['-js', filename])).trim()) fail('DOSSIER_PDF_INVALID');
  } catch (error) {
    if (error instanceof DossierStorageError) throw error;
    fail('DOSSIER_PDF_VALIDATOR_UNAVAILABLE');
  } finally {
    if (directory) {
      try {
        const resolved = await realpath(directory);
        const relative = path.relative(await realpath(tmpdir()), resolved);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)
          || !path.basename(resolved).startsWith('nomina-dossier-pdf-')) fail('DOSSIER_PDF_CLEANUP_FAILED');
        await rm(resolved, { recursive: true, force: true });
      } catch {
        fail('DOSSIER_PDF_CLEANUP_FAILED');
      }
    }
  }
}
