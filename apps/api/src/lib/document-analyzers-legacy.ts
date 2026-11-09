// Historical analyzer protocol for explicit laboratory replay only. Not used by H24 runtime.
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { DocumentAnalyzerBusyError } from './document-cloud.js';
import { DocumentSecurityError, validateDocumentEnvelope } from './document-security.js';
const unavailable = () => new DocumentSecurityError('DOCUMENT_SECURITY_UNAVAILABLE');

type LocalSettings = { parser: string; scanner: string; signatures: string };
export function localDocumentSecuritySettings(env: NodeJS.ProcessEnv = process.env): LocalSettings {
  if (env.DOCUMENT_SECURITY_MODE !== 'docker-local' || env.NODE_ENV === 'production' ||
      env.DB_NAME !== 'nomina_docente_test' || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST || '') ||
      env.FIREBASE_PROJECT_ID !== 'nomina-h24-test-20261027') throw unavailable();
  const parser = env.DOCUMENT_SECURITY_PARSER_IMAGE || '';
  const scanner = env.DOCUMENT_SECURITY_SCANNER_IMAGE || '';
  const signatures = env.DOCUMENT_SECURITY_SIGNATURE_VOLUME || '';
  if (![parser, scanner].every(v => /^sha256:[a-f0-9]{64}$/.test(v)) ||
      !/^h24-pd03-signatures-[a-z0-9-]{1,40}$/.test(signatures)) throw unavailable();
  return { parser, scanner, signatures };
}

type Result = { code: number; stdout: string; stderr: string };
export type DocumentCheck = 'pdf' | 'png' | 'jpeg' | 'av';
export type DocumentRunner = (kind: DocumentCheck, bytes: Buffer) => Promise<Result>;
function docker(args: string[], input?: Buffer, timeout = 125_000): Promise<Result> {
  return new Promise((resolve, reject) => {
    const child = execFile(process.platform === 'win32' ? 'docker.exe' : 'docker', ['--context', 'desktop-linux', ...args], {
      shell: false, windowsHide: true, timeout, killSignal: 'SIGKILL', maxBuffer: 16 * 1024,
      encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE }
    }, (error, stdout, stderr) => {
      if (error && (error.killed || error.signal || typeof error.code !== 'number')) reject(unavailable());
      else resolve({ code: typeof error?.code === 'number' ? error.code : 0, stdout, stderr });
    });
    child.stdin?.on('error', () => { /* The exit callback handles failed/closed input. */ });
    child.stdin?.end(input);
  });
}

export function createLocalDocumentRunner(settings: LocalSettings): DocumentRunner {
  return async (kind, bytes) => {
    const name = `h24-security-${randomUUID()}`;
    const memory = kind === 'av' ? '4g' : '512m';
    const args = ['run', '--pull', 'never', '--name', name, '--rm', '-i', '--network', 'none', '--read-only',
      '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', memory, '--memory-swap', memory,
      '--cpus', '2', '--pids-limit', '64', '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777'];
    if (kind === 'av') args.push('--mount', `type=volume,source=${settings.signatures},target=/var/lib/clamav,readonly`);
    args.push('--user', kind === 'av' ? '100:101' : '1000:1000', kind === 'av' ? settings.scanner : settings.parser);
    if (kind !== 'av') args.push(kind);
    try { return await docker(args, bytes, kind === 'av' ? 125_000 : 35_000); }
    finally {
      // Killing the CLI alone does not guarantee the container stopped. Names are generated here.
      const cleanup = await docker(['rm', '-f', '-v', name], undefined, 15_000);
      if (cleanup.code !== 0 && !cleanup.stderr.includes('No such container')) throw unavailable();
    }
  };
}

export function createDocumentValidator(run: DocumentRunner) {
  return async (input: Buffer, mime: string): Promise<void> => {
    const bytes = Buffer.from(input);
    validateDocumentEnvelope(bytes, mime);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const parser: DocumentCheck = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpeg';
    for (const kind of [parser, 'av'] as DocumentCheck[]) {
      let result: Result;
      try { result = await run(kind, bytes); }
      catch (error) {
        if (error instanceof DocumentAnalyzerBusyError) throw new DocumentSecurityError('DOCUMENT_SECURITY_BUSY');
        throw unavailable();
      }
      if (result.code === 40) {
        if (kind === 'av' && mime === 'application/pdf' && !result.stderr.trim() && result.stdout.trim() === `H24_SCAN_LIMIT ${hash}`) {
          throw new DocumentSecurityError('DOCUMENT_SCAN_LIMIT_EXCEEDED');
        }
        throw unavailable();
      }
      if (result.code === 10 && result.stdout.trim() === 'H24_INVALID') throw new DocumentSecurityError('DOCUMENT_INVALID');
      if (result.code === 20 && result.stdout.trim() === 'H24_REJECTED') throw new DocumentSecurityError('DOCUMENT_REJECTED');
      const protocol = kind === 'av' ? 'H24_AV' : `H24_POLICY_V1_${kind.toUpperCase()}`;
      if (result.code !== 0 || result.stderr.trim() || result.stdout.trim() !== `${protocol}_OK ${hash}`) throw unavailable();
    }
  };
}
