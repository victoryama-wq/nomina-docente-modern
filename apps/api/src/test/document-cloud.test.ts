import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { cloudDocumentSecuritySettings, createCloudDocumentRunner, documentIdentityToken } from '../lib/document-cloud.js';
import { createDocumentValidator } from '../lib/document-security.js';

const parser = 'https://h24-inspector-234692275301.us-central1.run.app';
const scanner = 'https://h24-scanner-234692275301.us-central1.run.app';
const env = { DOCUMENT_SECURITY_MODE: 'cloud-run', K_SERVICE: 'h24-test',
  DOCUMENT_SECURITY_PARSER_URL: parser, DOCUMENT_SECURITY_SCANNER_URL: scanner };
const bytes = Buffer.from('%PDF-1.7\nsynthetic\n%%EOF\n');
const hash = createHash('sha256').update(bytes).digest('hex');
describe('H24 private Cloud Run transport', () => {
  it('accepts explicit runtime origins', () => {
    expect(cloudDocumentSecuritySettings(env)).toEqual({ parser, scanner });
    expect(cloudDocumentSecuritySettings({ ...env, K_SERVICE: '', CLOUD_RUN_JOB: 'worker' })).toEqual({ parser, scanner });
  });
  it('transports code 40 without losing request binding and the PDF-specific error', async () => {
    const http = vi.fn(async (url: unknown, options?: RequestInit) => Response.json({
      requestId: (options!.headers as Record<string, string>)['X-H24-Request-Id'],
      code: String(url).endsWith('/av') ? 40 : 0,
      stdout: String(url).endsWith('/av') ? `H24_SCAN_LIMIT ${hash}` : `H24_POLICY_V1_PDF_OK ${hash}`, stderr: ''
    }));
    await expect(createDocumentValidator(createCloudDocumentRunner({ parser, scanner }, async () => 'test', http))(bytes, 'application/pdf'))
      .rejects.toMatchObject({ code: 'DOCUMENT_SCAN_LIMIT_EXCEEDED', statusCode: 422 });
  });
  it.each(['http://localhost', 'https://example.com', parser + '/x', parser + '?secret=x',
    parser + ':443', 'https://user@h24.run.app', 'https://h24.run.app.evil.test'])('rejects endpoint %s', url => {
    expect(() => cloudDocumentSecuritySettings({ ...env, DOCUMENT_SECURITY_PARSER_URL: url })).toThrow();
  });
  it('refuses implicit mode or local fallback', () => {
    expect(() => cloudDocumentSecuritySettings({ ...env, K_SERVICE: '' })).toThrow();
    expect(() => cloudDocumentSecuritySettings({ ...env, DOCUMENT_SECURITY_MODE: '' })).toThrow();
  });
  it('requests distinct ID token audiences, binds request IDs and validates both content hashes', async () => {
    const token = vi.fn(async () => 'synthetic.token.signature');
    const http = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      const headers = options!.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer synthetic.token.signature');
      expect(options!.redirect).toBe('error');
      expect(Buffer.from(options!.body as Uint8Array)).toEqual(bytes);
      const kind = String(url).endsWith('/av') ? 'H24_AV' : 'H24_POLICY_V1_PDF';
      return Response.json({ requestId: headers['X-H24-Request-Id'], code: 0, stdout: `${kind}_OK ${hash}`, stderr: '' });
    });
    await createDocumentValidator(createCloudDocumentRunner({ parser, scanner }, token, http))(bytes, 'application/pdf');
    expect(token.mock.calls).toEqual([[parser], [scanner]]);
    expect(http).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403, 429, 500, 503, 302])('fails closed for HTTP %s', async status => {
    const http = vi.fn(async () => new Response('', { status }));
    await expect(createCloudDocumentRunner({ parser, scanner }, async () => 'token', http)('pdf', bytes)).rejects.toThrow();
  });
  it.each(['id', 'size', 'type', 'diagnostic', 'malformed'])('rejects bad response %s', async mode => {
    const http = vi.fn(async (_: unknown, options?: RequestInit) => {
      const id = (options!.headers as Record<string, string>)['X-H24-Request-Id'];
      if (mode === 'size') return new Response('x'.repeat(1025), { headers: { 'content-type': 'application/json' } });
      if (mode === 'type') return new Response('<html>');
      if (mode === 'malformed') return new Response('{', { headers: { 'content-type': 'application/json' } });
      return Response.json({ requestId: mode === 'id' ? 'wrong' : id, code: 0,
        stdout: `H24_POLICY_V1_PDF_OK ${hash}`, stderr: mode === 'diagnostic' ? 'private' : '' });
    });
    await expect(createCloudDocumentRunner({ parser, scanner }, async () => 'token', http)('pdf', bytes)).rejects.toThrow();
  });
  it('fails closed on identity service failure without calling scanner', async () => {
    const http = vi.fn();
    await expect(createCloudDocumentRunner({ parser, scanner }, async () => { throw Error('identity'); }, http)('av', bytes)).rejects.toThrow();
    expect(http).not.toHaveBeenCalled();
  });
  it('obtains runtime identity from fixed metadata endpoint, without redirects', async () => {
    const http = vi.fn(async () => new Response('a.b.c', { headers: { 'metadata-flavor': 'Google' } }));
    vi.stubGlobal('fetch', http);
    try {
      expect(await documentIdentityToken(parser)).toBe('a.b.c');
      const [url, options] = http.mock.calls[0] as unknown as [URL, RequestInit];
      expect(url.hostname).toBe('metadata.google.internal');
      expect(url.searchParams.get('audience')).toBe(parser);
      expect(options.redirect).toBe('error');
    } finally { vi.unstubAllGlobals(); }
  });
});
