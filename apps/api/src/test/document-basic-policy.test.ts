import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_ANALYSIS_STATUS, DOCUMENT_MAX_BYTES, validateDocumentContent, validateDocumentName } from '../lib/document-security.js';

afterEach(() => vi.unstubAllEnvs());
describe('H24 basic admission without analyzers', () => {
  it.each(['', 'cloud-run', 'docker-local', 'invalid'])('has no analyzer configuration dependency (%s)', async mode => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DOCUMENT_SECURITY_MODE', mode);
    vi.stubEnv('DOCUMENT_SECURITY_PARSER_URL', 'https://unreachable.invalid');
    vi.stubEnv('DOCUMENT_SECURITY_SCANNER_URL', 'https://unreachable.invalid');
    await expect(validateDocumentContent(Buffer.from('%PDF-1.7\nsynthetic'), 'application/pdf')).resolves.toBeUndefined();
    expect(DOCUMENT_ANALYSIS_STATUS).toBe('NOT_SCANNED');
  });
  it('does not claim structural, encryption, active content or antivirus inspection', async () => {
    for (const suffix of ['truncated', '/JavaScript (synthetic inert)', '/Encrypt', 'synthetic antivirus marker']) {
      await expect(validateDocumentContent(Buffer.from(`%PDF-1.7\n${suffix}`), 'application/pdf')).resolves.toBeUndefined();
    }
  });
  it.each(['application/pdf', 'image/png', 'image/jpeg'])('rejects false signatures for %s', async mime => {
    await expect(validateDocumentContent(Buffer.from('<html>synthetic</html>'), mime)).rejects.toMatchObject({ code: 'DOCUMENT_INVALID' });
  });
  it.each(['text/html', 'image/svg+xml', 'application/zip', 'application/octet-stream'])('rejects %s even with a PDF signature', async mime => {
    await expect(validateDocumentContent(Buffer.from('%PDF-1.7\n'), mime)).rejects.toMatchObject({ code: 'DOCUMENT_INVALID' });
  });
  it('checks supported image signatures without promising safe decoding', async () => {
    await expect(validateDocumentContent(Buffer.from([137,80,78,71,13,10,26,10]), 'image/png')).resolves.toBeUndefined();
    await expect(validateDocumentContent(Buffer.from([255,216,255,0,255,217]), 'image/jpeg')).resolves.toBeUndefined();
    await expect(validateDocumentContent(Buffer.from([255,216,255,0]), 'image/jpeg')).rejects.toThrow();
  });
  it('keeps size and server filename boundaries', async () => {
    const bytes = Buffer.alloc(DOCUMENT_MAX_BYTES); bytes.write('%PDF-1.7\n');
    await expect(validateDocumentContent(bytes, 'application/pdf')).resolves.toBeUndefined();
    for (const invalid of [Buffer.alloc(0), Buffer.alloc(DOCUMENT_MAX_BYTES + 1)]) {
      await expect(validateDocumentContent(invalid, 'application/pdf')).rejects.toThrow();
    }
    for (const name of ['../a.pdf', 'a\\b.pdf', 'a\n.pdf', 'a.html']) {
      expect(() => validateDocumentName(name, 'application/pdf')).toThrow();
    }
  });
  it('keeps the runtime validator free of process, network and legacy analyzer imports', () => {
    const source = readFileSync(new URL('../lib/document-security.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"]|import\(|fetch\(|execFile|createDocumentValidator|DOCUMENT_SECURITY_MODE/);
  });
});
