import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { BucketMetadata } from '@google-cloud/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DossierStorageError, GoogleDossierStorage, LocalDossierStorage, validateDossierPdf } from '../lib/dossier-storage.js';
import type { DossierStorage } from '../lib/dossier-storage.js';

const cloud = vi.hoisted(() => ({
  storage: vi.fn(), bucket: vi.fn(), file: vi.fn(), bucketMetadata: vi.fn(),
  fileMetadata: vi.fn(), save: vi.fn(), download: vi.fn(), delete: vi.fn(),
  metadata: { generation: '1770000000000001' }
}));

// No Firebase initialization, credentials, database or network is permitted by these tests.
vi.mock('../firebase.js', () => ({ firebaseAdmin: { storage: cloud.storage } }));
vi.mock('../config.js', () => ({ config: { CONSTANCIAS_BUCKET: 'synthetic-constancias' } }));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFile: vi.fn(actual.execFile) };
});

const configuredPdfinfo = process.env.DOSSIER_PDFINFO_PATH;
const newKey = () => `${randomUUID()}/${randomUUID()}/${randomUUID()}`;
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
let directories: string[] = [];

async function privateDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'nomina-dossier-test-'));
  directories.push(directory);
  await chmod(directory, 0o700);
  return directory;
}

async function pdf(options: PDFKit.PDFDocumentOptions = {}, javascript = false, pages = 1): Promise<Buffer> {
  const document = new PDFDocument(options);
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
  });
  document.text('Synthetic H24 fixture. No personal data.');
  for (let page = 1; page < pages; page++) document.addPage().text('Synthetic page.');
  if (javascript) document.addNamedJavaScript('synthetic', 'app.alert("synthetic");');
  document.end();
  return result;
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DB_NAME', 'nomina_docente_test');
  vi.stubEnv('DB_HOST', '127.0.0.1');
  vi.mocked(execFile).mockReset();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const directory of directories) await rm(directory, { recursive: true, force: true });
  directories = [];
});

describe('LocalDossierStorage', () => {
  it('persists real private files and stable SHA256 generations across instances', async () => {
    const root = await privateDirectory();
    const storage: DossierStorage = new LocalDossierStorage(root);
    const bytes = await pdf();
    const key = newKey();
    expect(await storage.stat(key)).toBeNull();
    const stored = await storage.put(key, bytes);
    expect(stored).toEqual({ key, generation: sha256(bytes) });
    const reopened = new LocalDossierStorage(root);
    expect(await reopened.stat(key)).toEqual(stored);
    expect(await reopened.read(stored)).toEqual(bytes);
    const files = await readdir(root);
    expect(files).toEqual([`${sha256(key)}.pdf`]);
    expect(await readFile(path.join(root, files[0]))).toEqual(bytes);
    if (process.platform !== 'win32') expect((await lstat(path.join(root, files[0]))).mode & 0o077).toBe(0);
    await reopened.remove(stored);
    await reopened.remove(stored);
    expect(await reopened.stat(key)).toBeNull();
    expect(await readdir(root)).toEqual([]);
    await expect(reopened.read(stored)).rejects.toThrow('DOSSIER_STORAGE_NOT_FOUND');
  });

  it('allows exactly one concurrent create and never publishes partial or losing bytes', async () => {
    const root = await privateDirectory();
    const storage = new LocalDossierStorage(root);
    const key = newKey();
    const values = Array.from({ length: 12 }, (_, i) => Buffer.alloc(64 * 1024, i));
    const results = await Promise.allSettled(values.map((bytes) => new LocalDossierStorage(root).put(key, bytes)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const winner = results.findIndex((result) => result.status === 'fulfilled');
    for (const result of results) {
      if (result.status === 'rejected') expect(result.reason.message).toBe('DOSSIER_STORAGE_CONFLICT');
    }
    const stored = await storage.stat(key);
    expect(await storage.read(stored!)).toEqual(values[winner]);
    await expect(storage.put(key, values[winner])).rejects.toThrow('DOSSIER_STORAGE_CONFLICT');
    expect(await readdir(root)).toHaveLength(1);
  });

  it('snapshots mutable buffers before asynchronous work', async () => {
    const storage = new LocalDossierStorage(await privateDirectory());
    const bytes = Buffer.from('original');
    const pending = storage.put(newKey(), bytes);
    bytes.fill(0);
    expect(await storage.read(await pending)).toEqual(Buffer.from('original'));
  });

  it('rejects stale generations without deleting bytes and detects on-disk tampering', async () => {
    const root = await privateDirectory();
    const storage = new LocalDossierStorage(root);
    const stored = await storage.put(newKey(), Buffer.from('first'));
    const stale = { ...stored, generation: '0'.repeat(64) };
    await expect(storage.read(stale)).rejects.toThrow('DOSSIER_STORAGE_CONFLICT');
    await expect(storage.remove(stale)).rejects.toThrow('DOSSIER_STORAGE_CONFLICT');
    expect(await storage.read(stored)).toEqual(Buffer.from('first'));
    await writeFile(path.join(root, `${sha256(stored.key)}.pdf`), 'changed');
    await expect(storage.read(stored)).rejects.toThrow('DOSSIER_STORAGE_CONFLICT');
    await expect(storage.remove(stored)).rejects.toThrow('DOSSIER_STORAGE_CONFLICT');
    expect(await storage.stat(stored.key)).toEqual({ key: stored.key, generation: sha256('changed') });
  });

  it.each(['', '../private', '/absolute', 'C:\\private', 'a/b', 'x.pdf',
    `${randomUUID()}/../${randomUUID()}`, `${randomUUID()}\\${randomUUID()}`,
    `${randomUUID()}%2f${randomUUID()}`, `${randomUUID()}\n`, `${randomUUID()}\0`,
    `${randomUUID()}/`, Array.from({ length: 9 }, randomUUID).join('/')])('rejects unsafe key %j before I/O', async (key) => {
    const storage = new LocalDossierStorage('nonexistent');
    await expect(storage.put(key, Buffer.from('x'))).rejects.toThrow('DOSSIER_STORAGE_INVALID_KEY');
    await expect(storage.stat(key)).rejects.toThrow('DOSSIER_STORAGE_INVALID_KEY');
    await expect(storage.read({ key, generation: '0'.repeat(64) })).rejects.toThrow('DOSSIER_STORAGE_INVALID_KEY');
    await expect(storage.remove({ key, generation: '0'.repeat(64) })).rejects.toThrow('DOSSIER_STORAGE_INVALID_KEY');
  });

  it.each([
    ['DB_NAME', 'nomina_docente'], ['DB_NAME', ''], ['NODE_ENV', 'production'],
    ['DB_HOST', 'remote.example'], ['DB_HOST', '127.0.0.1.example'], ['DB_HOST', ''],
    ['DB_HOST', '/cloudsql/instance']
  ])('guards every operation when %s=%s, including environment changes', async (name, value) => {
    const root = await privateDirectory();
    const storage = new LocalDossierStorage(root);
    const stored = await storage.put(newKey(), Buffer.from('synthetic'));
    vi.stubEnv(name, value);
    await expect(storage.assertSafe()).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    await expect(storage.put(newKey(), Buffer.from('x'))).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    await expect(storage.stat(stored.key)).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    await expect(storage.read(stored)).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    await expect(storage.remove(stored)).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    expect(await readdir(root)).toHaveLength(1);
  });

  it.each(['localhost', '127.0.0.1', '::1'])('permits explicit loopback %s without DB connections', async (host) => {
    vi.stubEnv('DB_HOST', host);
    await expect(new LocalDossierStorage(await privateDirectory()).assertSafe()).resolves.toBeUndefined();
  });

  it('rejects workspace/shared temp roots, relative roots, and directory junctions', async () => {
    for (const root of [process.cwd(), tmpdir(), '.']) {
      await expect(new LocalDossierStorage(root).assertSafe()).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    }
    const parent = await privateDirectory();
    const target = await privateDirectory();
    const junction = path.join(parent, 'alias');
    await symlink(target, junction, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(new LocalDossierStorage(junction).assertSafe()).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    await expect(new LocalDossierStorage(path.join(junction, '..', 'alias')).assertSafe()).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
  });

  it('rejects directory objects and malformed generations, sanitizing filesystem errors', async () => {
    const root = await privateDirectory();
    const storage = new LocalDossierStorage(root);
    const key = newKey();
    const target = await privateDirectory();
    await symlink(target, path.join(root, `${sha256(key)}.pdf`), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(storage.stat(key)).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    await expect(storage.remove({ key, generation: '../secret' })).rejects.toThrow('DOSSIER_STORAGE_INVALID_GENERATION');
    const missing = new LocalDossierStorage(path.join(root, 'private-secret'));
    await expect(missing.assertSafe()).rejects.toThrow(/^DOSSIER_STORAGE_NOT_FOUND$/);
  });
});

function safeMetadata(): BucketMetadata {
  return {
    name: 'synthetic-dossier', versioning: { enabled: false },
    softDeletePolicy: { retentionDurationSeconds: '0' },
    iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'enforced' }
  };
}

describe('GoogleDossierStorage (SDK mocks only)', () => {
  beforeEach(() => {
    vi.stubEnv('CONSTANCIAS_BUCKET', undefined);
    vi.stubEnv('FIREBASE_PROJECT_ID', 'demo-nomina-h24');
    cloud.storage.mockReturnValue({ bucket: cloud.bucket });
    cloud.bucket.mockReturnValue({ getMetadata: cloud.bucketMetadata, file: cloud.file });
    cloud.bucketMetadata.mockReset().mockResolvedValue([safeMetadata()]);
    cloud.file.mockReturnValue({
      metadata: cloud.metadata, getMetadata: cloud.fileMetadata,
      save: cloud.save, download: cloud.download, delete: cloud.delete
    });
    cloud.metadata.generation = '1770000000000001';
    cloud.fileMetadata.mockReset().mockResolvedValue([{ generation: cloud.metadata.generation }]);
    cloud.save.mockReset().mockResolvedValue(undefined);
    cloud.download.mockReset().mockResolvedValue([Buffer.from('synthetic')]);
    cloud.delete.mockReset().mockResolvedValue([]);
  });

  it('has no constructor side effects and refuses implicit or fiscal buckets', async () => {
    vi.stubEnv('CONSTANCIAS_BUCKET', undefined);
    new GoogleDossierStorage('synthetic-dossier');
    expect(cloud.storage).not.toHaveBeenCalled();
    for (const name of ['', 'gs://synthetic-dossier', 'synthetic-dossier/path', 'nomina-docente-prod-constancias']) {
      expect(() => new GoogleDossierStorage(name)).toThrow('DOSSIER_STORAGE_UNSAFE');
    }
    vi.stubEnv('CONSTANCIAS_BUCKET', 'other-fiscal');
    expect(() => new GoogleDossierStorage('other-fiscal')).toThrow('DOSSIER_STORAGE_UNSAFE');
    await expect(new GoogleDossierStorage('synthetic-constancias').assertSafe()).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    expect(cloud.storage).not.toHaveBeenCalled();
  });

  it.each([
    { versioning: { enabled: true } }, { versioning: undefined },
    { softDeletePolicy: { retentionDurationSeconds: 604800 } }, { softDeletePolicy: undefined },
    { softDeletePolicy: { retentionDurationSeconds: '' } },
    { retentionPolicy: { retentionPeriod: '1' } }, { retentionPolicy: {} },
    { defaultEventBasedHold: true }, { objectRetention: { mode: 'Enabled' } },
    { iamConfiguration: { uniformBucketLevelAccess: { enabled: false }, publicAccessPrevention: 'enforced' } },
    { iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'inherited' } },
    { iamConfiguration: undefined }, { name: 'other-bucket' }
  ] satisfies Partial<BucketMetadata>[])('fails closed on incompatible/unknown bucket policy %j', async (change) => {
    cloud.bucketMetadata.mockResolvedValue([{ ...safeMetadata(), ...change }]);
    const storage = new GoogleDossierStorage('synthetic-dossier');
    const object = { key: newKey(), generation: cloud.metadata.generation };
    await expect(storage.assertSafe()).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    await expect(storage.put(object.key, Buffer.from('x'))).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    await expect(storage.stat(object.key)).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    await expect(storage.read(object)).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    await expect(storage.remove(object)).rejects.toThrow('DOSSIER_STORAGE_UNSAFE');
    expect(cloud.file).not.toHaveBeenCalled();
  });

  it('uses create-only upload, exact generation reads/deletes, and no public ACLs', async () => {
    const storage: DossierStorage = new GoogleDossierStorage('synthetic-dossier');
    const key = newKey();
    const bytes = Buffer.from('synthetic');
    const stored = await storage.put(key, bytes);
    expect(stored).toEqual({ key, generation: cloud.metadata.generation });
    expect(cloud.fileMetadata).not.toHaveBeenCalled();
    expect(cloud.save).toHaveBeenCalledWith(bytes, {
      resumable: false, validation: 'crc32c', timeout: 30_000,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' }
    });
    expect(await storage.stat(key)).toEqual(stored);
    expect(await storage.read(stored)).toEqual(bytes);
    expect(cloud.file).toHaveBeenLastCalledWith(key, {
      generation: stored.generation, preconditionOpts: { ifGenerationMatch: stored.generation }
    });
    expect(cloud.download).toHaveBeenCalledWith({ validation: 'crc32c', decompress: false });
    await storage.remove(stored);
    expect(cloud.file).toHaveBeenLastCalledWith(key, { preconditionOpts: { ifGenerationMatch: stored.generation } });
    expect(cloud.delete).toHaveBeenCalledWith();
    expect(cloud.bucketMetadata).toHaveBeenCalledTimes(4);
    expect(cloud.bucket).toHaveBeenCalledWith('synthetic-dossier');
  });

  it('only treats object 404 as absent, preserving conflicts, permissions and bucket failures', async () => {
    const storage = new GoogleDossierStorage('synthetic-dossier');
    const object = { key: newKey(), generation: cloud.metadata.generation };
    cloud.fileMetadata.mockRejectedValue({ code: 404, message: 'private URL' });
    expect(await storage.stat(object.key)).toBeNull();
    cloud.delete.mockRejectedValue({ code: 404, message: 'private URL' });
    await expect(storage.remove(object)).resolves.toBeUndefined();
    cloud.delete.mockRejectedValue({ code: 412, message: 'private content' });
    await expect(storage.remove(object)).rejects.toThrow(/^DOSSIER_STORAGE_CONFLICT$/);
    cloud.save.mockRejectedValue({ code: 412 });
    await expect(storage.put(object.key, Buffer.from('x'))).rejects.toThrow('DOSSIER_STORAGE_CONFLICT');
    cloud.fileMetadata.mockRejectedValue({ code: 403, message: 'private content' });
    cloud.delete.mockRejectedValue({ code: 403, message: 'private content' });
    cloud.download.mockRejectedValue({ code: 403, message: 'private content' });
    await expect(storage.stat(object.key)).rejects.toThrow(/^DOSSIER_STORAGE_UNAVAILABLE$/);
    await expect(storage.read(object)).rejects.toThrow(/^DOSSIER_STORAGE_UNAVAILABLE$/);
    await expect(storage.remove(object)).rejects.toThrow(/^DOSSIER_STORAGE_UNAVAILABLE$/);
    cloud.bucketMetadata.mockRejectedValue({ code: 404 });
    await expect(storage.remove(object)).rejects.toThrow('DOSSIER_STORAGE_NOT_FOUND');
  });

  it.each(['', '0', '-1', '1.5', '9007199254740993', '123\n'])('rejects unsafe generation %j before SDK access', async (generation) => {
    const storage = new GoogleDossierStorage('synthetic-dossier');
    const object = { key: newKey(), generation };
    await expect(storage.read(object)).rejects.toThrow('DOSSIER_STORAGE_INVALID_GENERATION');
    await expect(storage.remove(object)).rejects.toThrow('DOSSIER_STORAGE_INVALID_GENERATION');
    expect(cloud.storage).not.toHaveBeenCalled();
  });

  it('rejects invalid keys without consulting cloud APIs', async () => {
    const storage = new GoogleDossierStorage('synthetic-dossier');
    await expect(storage.stat('../private')).rejects.toThrow('DOSSIER_STORAGE_INVALID_KEY');
    await expect(storage.put('name.pdf', Buffer.from('x'))).rejects.toThrow('DOSSIER_STORAGE_INVALID_KEY');
    expect(cloud.storage).not.toHaveBeenCalled();
  });
});

describe('DossierStorageError contract', () => {
  it('exports a stable code, name and message without nested provider diagnostics', () => {
    const error = new DossierStorageError('DOSSIER_STORAGE_CONFLICT');
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'DossierStorageError', code: 'DOSSIER_STORAGE_CONFLICT', message: 'DOSSIER_STORAGE_CONFLICT'
    });
    expect(error.cause).toBeUndefined();
  });

  it('exposes PDF invalid/unavailable and local conflict as typed, sanitized codes', async () => {
    await expect(validateDossierPdf(Buffer.from('private invalid content'))).rejects.toMatchObject({
      name: 'DossierStorageError', code: 'DOSSIER_PDF_INVALID', message: 'DOSSIER_PDF_INVALID'
    });
    vi.stubEnv('DOSSIER_PDFINFO_PATH', undefined);
    await expect(validateDossierPdf(await pdf())).rejects.toMatchObject({ code: 'DOSSIER_PDF_VALIDATOR_UNAVAILABLE' });
    const storage = new LocalDossierStorage(await privateDirectory());
    const key = newKey();
    await storage.put(key, Buffer.from('synthetic'));
    await expect(storage.put(key, Buffer.from('synthetic'))).rejects.toBeInstanceOf(DossierStorageError);
    await expect(storage.put(key, Buffer.from('synthetic'))).rejects.toMatchObject({ code: 'DOSSIER_STORAGE_CONFLICT' });
  });
});

describe('validateDossierPdf', () => {
  it.each([Buffer.alloc(0), Buffer.from('text/plain'), Buffer.from('<html>not PDF</html>'),
    Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('%PDF-1.7\nnot a PDF'),
    Buffer.from('%PDF-1.7\n%%EOF\n<html>payload</html>')])('rejects malformed or wrong-format bytes without executing a parser', async (bytes) => {
    await expect(validateDossierPdf(bytes)).rejects.toThrow('DOSSIER_PDF_INVALID');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('enforces the defensive 7.5 MiB cap before creating a process', async () => {
    await expect(validateDossierPdf(Buffer.alloc(7.5 * 1024 * 1024 + 1))).rejects.toThrow('DOSSIER_PDF_TOO_LARGE');
    expect(execFile).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'pdfinfo.exe'])('fails closed without an absolute configured parser (%j)', async (executable) => {
    vi.stubEnv('DOSSIER_PDFINFO_PATH', executable);
    await expect(validateDossierPdf(await pdf())).rejects.toThrow('DOSSIER_PDF_VALIDATOR_UNAVAILABLE');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('sanitizes executable-not-found errors and cleans temporary PDF bytes', async () => {
    vi.stubEnv('DOSSIER_PDFINFO_PATH', path.join(await privateDirectory(), 'missing-pdfinfo.exe'));
    await expect(validateDossierPdf(await pdf())).rejects.toThrow(/^DOSSIER_PDF_VALIDATOR_UNAVAILABLE$/);
    const args = vi.mocked(execFile).mock.calls[0][1] as string[];
    await expect(lstat(path.dirname(args[0]))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([
    [{ code: 'ETIMEDOUT', killed: true }, '', ''],
    [{ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }, '', ''],
    [null, 'Pages: 1\nEncrypted: no\nJavaScript: no\n', 'Syntax Error: private content'],
    [null, 'Pages: 0\nEncrypted: no\nJavaScript: no\n', ''],
    [null, 'Pages: 501\nEncrypted: no\nJavaScript: no\n', ''],
    [null, 'Pages: 1\nEncrypted: no\nEncrypted: yes\nJavaScript: no\n', ''],
    [null, 'Pages: 1\nEncrypted: no\n', '']
  ])('fails closed on parser failures or ambiguous output and cleans up (%j)', async (error, stdout, stderr) => {
    vi.stubEnv('DOSSIER_PDFINFO_PATH', path.join(tmpdir(), 'synthetic-pdfinfo.exe'));
    vi.mocked(execFile).mockImplementationOnce(((...args: unknown[]) => {
      const callback = args[3] as (error: unknown, stdout: string, stderr: string) => void;
      callback(error, stdout, stderr);
      return {};
    }) as typeof execFile);
    await expect(validateDossierPdf(await pdf())).rejects.toThrow(error
      ? /^DOSSIER_PDF_VALIDATOR_UNAVAILABLE$/ : /^DOSSIER_PDF_INVALID$/);
    const call = vi.mocked(execFile).mock.calls[0];
    expect(call[2]).toMatchObject({ shell: false, windowsHide: true, timeout: 10_000, maxBuffer: 256 * 1024 });
    await expect(lstat(path.dirname((call[1] as string[])[0]))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects JavaScript reported by -js even when the summary reports none', async () => {
    vi.stubEnv('DOSSIER_PDFINFO_PATH', path.join(tmpdir(), 'synthetic-pdfinfo.exe'));
    for (const output of ['Pages: 1\nEncrypted: no\nJavaScript: no\n', 'app.alert("synthetic")']) {
      vi.mocked(execFile).mockImplementationOnce(((...args: unknown[]) => {
        (args[3] as (error: null, stdout: string, stderr: string) => void)(null, output, '');
        return {};
      }) as typeof execFile);
    }
    await expect(validateDossierPdf(await pdf())).rejects.toMatchObject({ code: 'DOSSIER_PDF_INVALID' });
    const calls = vi.mocked(execFile).mock.calls;
    const filename = (calls[0][1] as string[])[0];
    expect(calls[1][1]).toEqual(['-js', filename]);
    await expect(lstat(path.dirname(filename))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  describe.skipIf(!configuredPdfinfo)('installed pdfinfo with synthetic PDFKit documents', () => {
    beforeEach(() => vi.stubEnv('DOSSIER_PDFINFO_PATH', configuredPdfinfo));

    it('accepts a structurally valid PDF, invokes -js without a shell and removes temporary bytes', async () => {
      await expect(validateDossierPdf(await pdf())).resolves.toBeUndefined();
      expect(execFile).toHaveBeenCalledTimes(2);
      const calls = vi.mocked(execFile).mock.calls;
      const filename = (calls[0][1] as string[])[0];
      expect(calls[1][1]).toEqual(['-js', filename]);
      expect(calls[0][2]).toMatchObject({ shell: false, windowsHide: true, timeout: 10_000, maxBuffer: 256 * 1024 });
      await expect(lstat(path.dirname(filename))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('rejects a fake PDF with valid magic and EOF markers', async () => {
      await expect(validateDossierPdf(Buffer.from('%PDF-1.7\nsynthetic junk\n%%EOF\n'))).rejects.toThrow('DOSSIER_PDF_INVALID');
    });

    it('rejects truncated structural data despite retained magic and EOF', async () => {
      const valid = await pdf();
      await expect(validateDossierPdf(Buffer.concat([valid.subarray(0, 200), Buffer.from('\n%%EOF\n')]))).rejects.toThrow('DOSSIER_PDF_INVALID');
    });

    it.each([{ userPassword: 'synthetic-secret' }, { ownerPassword: 'synthetic-owner' }])('rejects encrypted PDFKit documents including empty user passwords (%j)', async (options) => {
      await expect(validateDossierPdf(await pdf(options))).rejects.toThrow('DOSSIER_PDF_INVALID');
    });

    it('rejects PDFKit embedded JavaScript', async () => {
      await expect(validateDossierPdf(await pdf({}, true))).rejects.toThrow('DOSSIER_PDF_INVALID');
    });

    it('accepts 500 pages but rejects 501 before the JavaScript traversal', async () => {
      await expect(validateDossierPdf(await pdf({}, false, 500))).resolves.toBeUndefined();
      vi.mocked(execFile).mockClear();
      await expect(validateDossierPdf(await pdf({}, false, 501))).rejects.toMatchObject({ code: 'DOSSIER_PDF_INVALID' });
      expect(execFile).toHaveBeenCalledTimes(1);
    });

    it('caps real parser output and cleans files after oversized metadata', async () => {
      await expect(validateDossierPdf(await pdf({ info: { Title: 'x'.repeat(300 * 1024) } }))).rejects.toThrow('DOSSIER_PDF_VALIDATOR_UNAVAILABLE');
      const filename = (vi.mocked(execFile).mock.calls[0][1] as string[])[0];
      await expect(lstat(path.dirname(filename))).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });
});
