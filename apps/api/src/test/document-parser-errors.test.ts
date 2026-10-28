import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const child = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile: child.exec }));
import { validateDossierPdf } from '../lib/dossier-storage.js';

beforeEach(() => {
  vi.resetAllMocks();
  // Never executed: the parser is mocked, while temporary file cleanup remains real.
  vi.stubEnv('DOSSIER_PDFINFO_PATH', path.resolve('synthetic-pdfinfo'));
});
afterEach(() => vi.unstubAllEnvs());
describe('PDF parser infrastructure failures are not destructive rejection verdicts', () => {
  it.each([{ killed: true }, { signal: 'SIGKILL' }, { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }, { code: 'ENOENT' }])(
    'reports unavailable for %j', async failure => {
      child.exec.mockImplementation((_exe, _args, _opts, callback) => callback(failure, '', 'private diagnostic'));
      await expect(validateDossierPdf(Buffer.from('%PDF-1.7\n%%EOF\n'))).rejects.toMatchObject({ code: 'DOSSIER_PDF_VALIDATOR_UNAVAILABLE' });
    });
  it('still rejects a parser-confirmed malformed document', async () => {
    child.exec.mockImplementation((_exe, _args, _opts, callback) => callback({ code: 1 }, '', 'Syntax error'));
    await expect(validateDossierPdf(Buffer.from('%PDF-1.7\n%%EOF\n'))).rejects.toMatchObject({ code: 'DOSSIER_PDF_INVALID' });
  });
});
