import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '../types.js';
const mocks = vi.hoisted(() => ({ replace: vi.fn(), actor: null as SessionUser | null }));
vi.mock('../auth.js', () => ({
  authenticate: async (request: FastifyRequest, reply: FastifyReply) => {
    if (!mocks.actor) { await reply.code(401).send({ error: 'UNAUTHORIZED' }); return; }
    request.user = mocks.actor;
  },
  requirePermission: () => async () => {}, requireAnyPermission: () => async () => {}
}));
vi.mock('../firebase.js', () => ({ firebaseAdmin: {} }));
vi.mock('../db.js', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('../lib/constancia-replacement.js', () => ({ replaceConstancia: mocks.replace }));
import { registerTeacherRoutes } from '../routes/teachers.js';
import { ConstanciaStorageError } from '../lib/constancia-storage.js';
import { adminActor, createSessionUser } from './fixtures/index.js';
let app: FastifyInstance;
const url = '/teachers/00000000-0000-4000-8000-000000000001/documents/constancia';
const payload = { fileName: 'synthetic.pdf', mimeType: 'application/pdf', base64Data: Buffer.from('%PDF synthetic').toString('base64') };
beforeEach(async () => {
  vi.resetAllMocks();
  mocks.actor = { ...adminActor(), isProtectedSuperAdmin: false };
  mocks.replace.mockResolvedValue({ documentId: 'new', teacher: { id: 'test' }, cleanupPending: false });
  app = Fastify(); await registerTeacherRoutes(app);
});
afterEach(async () => { await app.close(); });
describe('constancia replacement API guards and response', () => {
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
