import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DocumentSecurityError, createDocumentValidator, localDocumentSecuritySettings, validateDocumentEnvelope, validateDocumentName } from '../lib/document-security.js';

const pdf = Buffer.from('%PDF-1.7\nsynthetic\n%%EOF\n');
const digest = createHash('sha256').update(pdf).digest('hex');
const env = { NODE_ENV: 'test', DB_NAME: 'nomina_docente_test', DB_HOST: '127.0.0.1',
  FIREBASE_PROJECT_ID: 'nomina-h24-test-20261027', DOCUMENT_SECURITY_MODE: 'docker-local',
  DOCUMENT_SECURITY_PARSER_IMAGE: `sha256:${'a'.repeat(64)}`, DOCUMENT_SECURITY_SCANNER_IMAGE: `sha256:${'b'.repeat(64)}`,
  DOCUMENT_SECURITY_SIGNATURE_VOLUME: 'h24-pd03-signatures-test' };
describe('H24 document security contract without external services', () => {
  it('reports a hash-bound scanner limit for PDF without claiming malware or success', async () => {
    const run = vi.fn().mockResolvedValueOnce({ code: 0, stdout: `H24_POLICY_V1_PDF_OK ${digest}`, stderr: '' })
      .mockResolvedValueOnce({ code: 40, stdout: `H24_SCAN_LIMIT ${digest}`, stderr: '' });
    await expect(createDocumentValidator(run)(pdf, 'application/pdf')).rejects.toMatchObject({ code: 'DOCUMENT_SCAN_LIMIT_EXCEEDED', statusCode: 422 });
    expect(new DocumentSecurityError('DOCUMENT_SCAN_LIMIT_EXCEEDED').publicMessage).toContain('limites de analisis');
    expect(run).toHaveBeenCalledTimes(2);
  });
  it.each(['hash', 'stderr', 'parser', 'malformed', 'old-protocol', 'timeout'])('keeps %s unavailable instead of inventing a complexity verdict', async mode => {
    const result = { code: mode === 'timeout' ? 30 : mode === 'old-protocol' ? 0 : 40,
      stdout: mode === 'timeout' ? 'H24_UNAVAILABLE' : mode === 'malformed' ? 'H24_SCAN_LIMIT' : `H24_SCAN_LIMIT ${mode === 'hash' ? '0'.repeat(64) : digest}`,
      stderr: mode === 'stderr' ? 'private diagnostic' : '' };
    const run = mode === 'parser' ? vi.fn().mockResolvedValue(result)
      : vi.fn().mockResolvedValueOnce({ code: 0, stdout: `H24_POLICY_V1_PDF_OK ${digest}`, stderr: '' }).mockResolvedValueOnce(result);
    await expect(createDocumentValidator(run)(pdf, 'application/pdf')).rejects.toMatchObject({ code: 'DOCUMENT_SECURITY_UNAVAILABLE', statusCode: 503 });
  });
  it.each(['png', 'jpeg'] as const)('does not report a PDF-specific limit for %s', async kind => {
    const bytes = kind === 'png' ? Buffer.from([137,80,78,71,13,10,26,10]) : Buffer.from([255,216,255,0,255,217]);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const run = vi.fn().mockResolvedValueOnce({ code: 0, stdout: `H24_POLICY_V1_${kind.toUpperCase()}_OK ${hash}`, stderr: '' })
      .mockResolvedValueOnce({ code: 40, stdout: `H24_SCAN_LIMIT ${hash}`, stderr: '' });
    await expect(createDocumentValidator(run)(bytes, `image/${kind}`)).rejects.toMatchObject({ code: 'DOCUMENT_SECURITY_UNAVAILABLE' });
  });
  it('requires both isolated checks on identical content', async () => {
    const run = vi.fn(async (kind: string) => ({ code: 0, stdout: `${kind === 'av' ? 'H24_AV' : 'H24_POLICY_V1_PDF'}_OK ${digest}\n`, stderr: '' }));
    await createDocumentValidator(run)(pdf, 'application/pdf');
    expect(run.mock.calls.map(c => c[0])).toEqual(['pdf', 'av']);
  });
  it.each([
    [10, 'H24_INVALID', 'DOCUMENT_INVALID'], [20, 'H24_REJECTED', 'DOCUMENT_REJECTED'],
    [2, 'ERROR', 'DOCUMENT_SECURITY_UNAVAILABLE'], [137, '', 'DOCUMENT_SECURITY_UNAVAILABLE'],
    [0, `H24_AV_OK ${'0'.repeat(64)}`, 'DOCUMENT_SECURITY_UNAVAILABLE'],
    [0, 'H24_AV_OK', 'DOCUMENT_SECURITY_UNAVAILABLE']
  ])('does not treat exit %s / %s as clean', async (code, stdout, expected) => {
    const run = vi.fn().mockResolvedValueOnce({ code: 0, stdout: `H24_POLICY_V1_PDF_OK ${digest}`, stderr: '' })
      .mockResolvedValueOnce({ code, stdout, stderr: '' });
    await expect(createDocumentValidator(run)(pdf, 'application/pdf')).rejects.toMatchObject({ code: expected });
  });
  it('rejects warnings even with matching clean verdict', async () => {
    const run = vi.fn().mockResolvedValue({ code: 0, stdout: `H24_POLICY_V1_PDF_OK ${digest}`, stderr: 'private diagnostic' });
    await expect(createDocumentValidator(run)(pdf, 'application/pdf')).rejects.toMatchObject({ code: 'DOCUMENT_SECURITY_UNAVAILABLE' });
    expect(run).toHaveBeenCalledOnce();
  });
  it('does not expose transport diagnostics', async () => {
    const run = vi.fn().mockRejectedValue(new Error('secret /private-path'));
    await expect(createDocumentValidator(run)(pdf, 'application/pdf')).rejects.toThrow(/^DOCUMENT_SECURITY_UNAVAILABLE$/);
  });
  it('rejects a legacy parser verdict even with the correct hash', async () => {
    const run = vi.fn().mockResolvedValue({ code: 0, stdout: `H24_PDF_OK ${digest}`, stderr: '' });
    await expect(createDocumentValidator(run)(pdf, 'application/pdf')).rejects.toMatchObject({ code: 'DOCUMENT_SECURITY_UNAVAILABLE' });
    expect(run).toHaveBeenCalledOnce();
  });
  it.each([
    ['png', 'image/png', Buffer.from([137,80,78,71,13,10,26,10])],
    ['jpeg', 'image/jpeg', Buffer.from([255,216,255,0,255,217])]
  ] as const)('requires %s decoding and AV over identical bytes', async (kind, mime, bytes) => {
    const hash = createHash('sha256').update(bytes).digest('hex');
    const run = vi.fn(async (check: string) => ({ code: 0, stdout: `${check === 'av' ? 'H24_AV' : `H24_POLICY_V1_${kind.toUpperCase()}`}_OK ${hash}`, stderr: '' }));
    await expect(createDocumentValidator(run)(bytes, mime)).resolves.toBeUndefined();
    expect(run.mock.calls.map(c => c[0])).toEqual([kind, 'av']);
  });
  it('allows only explicit local settings and immutable image IDs', () => {
    expect(localDocumentSecuritySettings(env).signatures).toBe(env.DOCUMENT_SECURITY_SIGNATURE_VOLUME);
  });
  it.each([
    { NODE_ENV: 'production' }, { DB_NAME: 'nomina_docente' }, { DB_HOST: 'remote' },
    { FIREBASE_PROJECT_ID: 'nomina-docente-prod' }, { DOCUMENT_SECURITY_MODE: '' },
    { DOCUMENT_SECURITY_SCANNER_IMAGE: 'clamav:latest' }, { DOCUMENT_SECURITY_SIGNATURE_VOLUME: 'other-volume' }
  ])('denies unsafe settings %j', patch => {
    expect(() => localDocumentSecuritySettings({ ...env, ...patch })).toThrow('DOCUMENT_SECURITY_UNAVAILABLE');
  });
  it.each(['../a.pdf', 'a\n.pdf', 'a.png', 'a\\b.pdf'])('rejects unsafe filename %s', name => {
    expect(() => validateDocumentName(name, 'application/pdf')).toThrow('DOCUMENT_INVALID');
  });
  it.each(['text/html', 'image/svg+xml', 'application/octet-stream'])('rejects %s', mime => {
    expect(() => validateDocumentEnvelope(pdf, mime)).toThrow('DOCUMENT_INVALID');
  });
  it('rejects empty, oversized and misdeclared bytes', () => {
    for (const bytes of [Buffer.alloc(0), Buffer.alloc(7864321), Buffer.from('<html>')]) {
      expect(() => validateDocumentEnvelope(bytes, 'application/pdf')).toThrow('DOCUMENT_INVALID');
    }
  });
});
