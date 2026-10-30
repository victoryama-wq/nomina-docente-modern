import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '../types.js';
const mocks = vi.hoisted(() => ({ replace: vi.fn(), query: vi.fn(), transaction: vi.fn(), download: vi.fn(), validate: vi.fn(), actor: null as SessionUser | null }));
vi.mock('../auth.js', () => ({
  authenticate: async (request: FastifyRequest, reply: FastifyReply) => {
    if (!mocks.actor) { await reply.code(401).send({ error: 'UNAUTHORIZED' }); return; }
    request.user = mocks.actor;
  },
  requirePermission: () => async () => {}, requireAnyPermission: () => async () => {}
}));
vi.mock('../firebase.js', () => ({ firebaseAdmin: { storage: () => ({ bucket: () => ({ file: () => ({ download: mocks.download }) }) }) } }));
vi.mock('../db.js', () => ({ query: mocks.query, withTransaction: mocks.transaction }));
vi.mock('../lib/document-security.js', async importOriginal => ({ ...await importOriginal<object>(), validateDocumentContent: mocks.validate }));
vi.mock('../lib/constancia-replacement.js', () => ({ replaceConstancia: mocks.replace }));
import { registerTeacherRoutes } from '../routes/teachers.js';
import { ConstanciaStorageError } from '../lib/constancia-storage.js';
import { DocumentSecurityError } from '../lib/document-security.js';
import { adminActor, createSessionUser } from './fixtures/index.js';
let app: FastifyInstance;
const url = '/teachers/00000000-0000-4000-8000-000000000001/documents/constancia';
const payload = { fileName: 'synthetic.pdf', mimeType: 'application/pdf', base64Data: Buffer.from('%PDF synthetic').toString('base64') };
beforeEach(async () => {
  vi.resetAllMocks();
  mocks.actor = { ...adminActor(), isProtectedSuperAdmin: false };
  mocks.replace.mockResolvedValue({ documentId: 'new', teacher: { id: 'test' }, cleanupPending: false });
  app = Fastify({ bodyLimit: 12 * 1024 * 1024 }); await registerTeacherRoutes(app);
});
afterEach(async () => { await app.close(); });
describe('constancia replacement API guards and response', () => {
  it.each([1, 2, 4, 7.5].flatMap(mib => [
    { mib, mimeType: 'application/pdf', extension: 'pdf' },
    { mib, mimeType: 'image/jpeg', extension: 'jpg' },
    { mib, mimeType: 'image/png', extension: 'png' }
  ]))('passes exact $mib MiB $mimeType bytes to the replacement/security boundary', async ({ mib, mimeType, extension }) => {
    // Encoding fixtures only: the replacement/security boundary is mocked, not a parser verdict.
    const bytes = Buffer.alloc(mib * 1024 * 1024, 0xfb);
    const response = await app.inject({ method: 'POST', url, payload: {
      fileName: `synthetic.${extension}`, mimeType, base64Data: bytes.toString('base64')
    } });
    expect(response.statusCode).toBe(200);
    expect(mocks.replace).toHaveBeenCalledOnce();
    const received = mocks.replace.mock.calls[0][0];
    expect(received.mimeType).toBe(mimeType);
    expect(received.bytes.length).toBe(bytes.length);
    expect(received.bytes.equals(bytes)).toBe(true);
  });

  it('rejects malformed large Base64 before replacing the existing constancia', async () => {
    const encoded = Buffer.alloc(7.5 * 1024 * 1024).toString('base64');
    const response = await app.inject({ method: 'POST', url, payload: { ...payload, base64Data: `${encoded.slice(0, -1)}!` } });
    expect(response.statusCode).toBe(422);
    expect(response.json().error).toBe('INVALID_PDF');
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('retains the constancia schema size limit without invoking replacement', async () => {
    const response = await app.inject({ method: 'POST', url, payload: {
      ...payload, base64Data: Buffer.alloc(7.5 * 1024 * 1024 + 1).toString('base64')
    } });
    expect(response.statusCode).toBe(400);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('serves only approved current bytes with private headers and an escaped filename', async () => {
    const bytes = Buffer.from('%PDF-1.7\nsynthetic');
    mocks.query.mockResolvedValueOnce([{ id: 'file', storageBucket: 'synthetic', storageObject: 'key', originalFileName: 'Constancia Á.pdf', mimeType: 'application/pdf' }])
      .mockResolvedValueOnce([{ id: 'file' }]);
    mocks.download.mockResolvedValue([bytes]);
    const response = await app.inject({ method: 'GET', url: url.replace('/constancia', '/current') });
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload).toEqual(bytes);
    expect(mocks.validate).toHaveBeenCalledExactlyOnceWith(bytes, 'application/pdf');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
    expect(response.headers['content-disposition']).toContain("filename*=UTF-8''Constancia%20%C3%81.pdf");
  });
  it.each(['DOCUMENT_REJECTED', 'DOCUMENT_SECURITY_UNAVAILABLE'] as const)('does not deliver historical content on %s', async code => {
    mocks.query.mockResolvedValue([{ id: 'file', mimeType: 'application/pdf' }]);
    mocks.download.mockResolvedValue([Buffer.from('synthetic blocked')]);
    mocks.validate.mockRejectedValue(new DocumentSecurityError(code));
    const response = await app.inject({ method: 'GET', url: url.replace('/constancia', '/current') });
    expect(response.statusCode).toBe(code === 'DOCUMENT_REJECTED' ? 422 : 503);
    expect(response.body).not.toContain('synthetic blocked');
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('refuses a constancia retired while scanning', async () => {
    mocks.query.mockResolvedValueOnce([{ id: 'file', mimeType: 'application/pdf' }]).mockResolvedValueOnce([]);
    mocks.download.mockResolvedValue([Buffer.from('synthetic retired')]);
    const response = await app.inject({ method: 'GET', url: url.replace('/constancia', '/current') });
    expect(response.statusCode).toBe(409);
    expect(response.body).not.toContain('synthetic retired');
  });
  it.each([['DOCUMENT_REJECTED', 422], ['DOCUMENT_SECURITY_UNAVAILABLE', 503], ['DOCUMENT_SECURITY_BUSY', 429]] as const)(
    'returns a safe %s verdict', async (code, status) => {
      mocks.replace.mockRejectedValue(new DocumentSecurityError(code));
      const response = await app.inject({ method: 'POST', url, payload });
      expect(response.statusCode).toBe(status);
      expect(response.json().error).toBe(code);
      expect(response.body).not.toMatch(/bucket|stack|token|base64Data/);
    });
  it('rejects unauthorized malformed bodies before parsing', async () => {
    mocks.actor = null;
    expect((await app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload: '{' })).statusCode).toBe(401);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it.each([{ fileName: '../synthetic.pdf' }, { fileName: 'synthetic.html' }, { base64Data: '%%%%' }])('rejects invalid filename or encoding without replacement', async change => {
    expect((await app.inject({ method: 'POST', url, payload: { ...payload, ...change } })).statusCode).toBe(422);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it.each(['admin','finanzas','rh'] as const)('allows existing document permissions for %s', async role => {
    mocks.actor = createSessionUser({ role, isProtectedSuperAdmin: false, permissions: ['fiscal.view','fiscal.document.manage'] });
    const response = await app.inject({ method: 'POST', url, payload });
    expect(response.statusCode).toBe(200);
    expect(response.json().cleanupPending).toBe(false);
    expect(mocks.replace).toHaveBeenCalledOnce();
  });
  it.each(['coordinador','direccion','contador','contabilidad'] as const)('denies %s before replacement despite broad permissions', async role => {
    mocks.actor = createSessionUser({ role, isProtectedSuperAdmin: false, permissions: ['fiscal.view','fiscal.manage','fiscal.document.manage'] });
    expect((await app.inject({ method: 'POST', url, payload })).statusCode).toBe(403);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('does not derive file write access from fiscal edit alone', async () => {
    mocks.actor = createSessionUser({ role: 'rh', permissions: ['fiscal.view','fiscal.manage'] });
    expect((await app.inject({ method: 'POST', url, payload })).statusCode).toBe(403);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('rejects no session with 401', async () => {
    mocks.actor = null;
    expect((await app.inject({ method: 'POST', url, payload })).statusCode).toBe(401);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('reports a committed replacement with pending cleanup instead of inviting a repeat upload', async () => {
    mocks.replace.mockResolvedValue({ documentId: 'new', teacher: {}, cleanupPending: true });
    const response = await app.inject({ method:'POST',url,payload });
    expect(response.statusCode).toBe(200);
    expect(response.json().cleanupPending).toBe(true);
    expect(response.json().message).toContain('no vuelvas a cargarla');
  });
  it('returns a controlled 503 for unavailable or unsafe storage', async () => {
    mocks.replace.mockRejectedValue(new ConstanciaStorageError());
    const response = await app.inject({ method:'POST',url,payload });
    expect(response.statusCode).toBe(503);
    expect(response.json().error).toBe('CONSTANCIA_STORAGE_UNAVAILABLE');
    expect(response.body).not.toMatch(/bucket|stack|token|base64Data/);
  });
});
