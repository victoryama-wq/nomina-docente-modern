import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate, requireAnyPermission, requirePermission, requirePermissionOrProtectedSuperAdmin } from '../auth.js';

const mocks = vi.hoisted(() => ({ verifyIdToken: vi.fn(), query: vi.fn() }));
vi.mock('../firebase.js', () => ({ firebaseAdmin: { auth: () => ({ verifyIdToken: mocks.verifyIdToken }) } }));
vi.mock('../db.js', () => ({ query: mocks.query }));
vi.mock('../config.js', () => ({ config: { NODE_ENV: 'development', ALLOWED_EMAIL_DOMAIN: 'example.test' } }));

const token = 'synthetic-id-token';
const headers = { authorization: `Bearer ${token}` };
const decoded = { uid: 'firebase-qa', email: 'qa@example.test', email_verified: true };
const user = {
  id: 'local-qa', firebase_uid: decoded.uid, email: decoded.email, display_name: 'QA',
  status: 'ACTIVO', is_protected_super_admin: false, role_code: 'admin', permissions: ['fiscal.view']
};
const paths = ['/session', '/permission', '/any', '/protected'];
let app: FastifyInstance;
let logs: string[];

beforeEach(() => {
  vi.resetAllMocks();
  logs = [];
  app = Fastify({ logger: { level: 'warn', stream: { write: (line: string) => { logs.push(line); } } } });
  app.get('/session', { onRequest: authenticate }, async (request) => request.user);
  app.get('/permission', { onRequest: requirePermission('fiscal.view') }, async () => ({ allowed: true }));
  app.get('/any', { onRequest: requireAnyPermission(['fiscal.view', 'fiscal.manage']) }, async () => ({ allowed: true }));
  app.get('/protected', { onRequest: requirePermissionOrProtectedSuperAdmin('fiscal.view') }, async () => ({ allowed: true }));
  mocks.verifyIdToken.mockResolvedValue(decoded);
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM app_users')) return [{ ...user }];
    if (sql.includes('FROM user_coordinations')) return [{ id: 'qa-coordination', name: 'QA', isPrimary: true }];
    return [];
  });
});
afterEach(async () => { await app.close(); });

describe('AUTH-01 Firebase revocation enforcement', () => {
  it.each(paths)('checks revocation on %s and preserves authorized access', async (url) => {
    const result = await app.inject({ url, headers });
    expect(result.statusCode).toBe(200);
    expect(mocks.verifyIdToken).toHaveBeenCalledExactlyOnceWith(token, true);
    expect(mocks.verifyIdToken.mock.invocationCallOrder[0]).toBeLessThan(mocks.query.mock.invocationCallOrder[0]);
  });

  it.each(['auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found', 'auth/id-token-expired',
    'auth/invalid-id-token', 'auth/insufficient-permission', 'auth/internal-error', 'network-failure'])
  ('fails closed for %s on all guards without DB access or sensitive logging', async (code) => {
    const error = Object.assign(new Error(`private-credential ${token}`), { code });
    mocks.verifyIdToken.mockRejectedValue(error);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const url of paths) {
      const result = await app.inject({ url, headers });
      expect(result.statusCode).toBe(401);
      expect(result.json()).toEqual({ error: 'INVALID_TOKEN', message: 'La sesión no es válida o expiró.' });
    }
    expect(mocks.query).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(logs.join('')).not.toContain(token);
    expect(logs.join('')).not.toContain('private-credential');
    expect(logs.map((line) => JSON.parse(line).authCode)).toEqual(Array(4).fill(
      code.startsWith('auth/') ? code : 'AUTH_VERIFICATION_FAILED'
    ));
  });

  it('rechecks the same token on the next request instead of caching acceptance', async () => {
    expect((await app.inject({ url: '/session', headers })).statusCode).toBe(200);
    mocks.query.mockClear();
    mocks.verifyIdToken.mockRejectedValueOnce({ code: 'auth/id-token-revoked' });
    expect((await app.inject({ url: '/session', headers })).statusCode).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
    expect((await app.inject({ url: '/session', headers: { authorization: 'Bearer new-session' } })).statusCode).toBe(200);
    expect(mocks.verifyIdToken).toHaveBeenLastCalledWith('new-session', true);
  });

  it('requires a bearer token before contacting Firebase or DB', async () => {
    const result = await app.inject({ url: '/session' });
    expect(result.statusCode).toBe(401);
    expect(result.json().error).toBe('AUTH_REQUIRED');
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...decoded, email_verified: false }, 'EMAIL_NOT_VERIFIED'],
    [{ ...decoded, email: '' }, 'EMAIL_NOT_VERIFIED'],
    [{ ...decoded, email: 'qa@other.test' }, 'DOMAIN_NOT_ALLOWED']
  ])('preserves email restrictions', async (claims, expectedError) => {
    mocks.verifyIdToken.mockResolvedValue(claims);
    const result = await app.inject({ url: '/session', headers });
    expect(result.statusCode).toBe(403);
    expect(result.json().error).toBe(expectedError);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each([[], [{ ...user, status: 'INACTIVO' }], [{ ...user, firebase_uid: 'other-uid' }]])
  ('preserves local active-user and UID checks', async (...rows) => {
    mocks.query.mockResolvedValueOnce(rows);
    const result = await app.inject({ url: '/session', headers });
    expect(result.statusCode).toBe(403);
    expect(result.json().error).toBe('USER_NOT_ALLOWED');
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it('preserves role, permissions and coordination scope of the verified user', async () => {
    const result = await app.inject({ url: '/session', headers });
    expect(result.json()).toMatchObject({ role: 'admin', permissions: ['fiscal.view'],
      actorCoordinations: [{ id: 'qa-coordination', name: 'QA', isPrimary: true }] });
  });

  it.each(paths.slice(1))('does not grant permissions on %s merely because Firebase accepts the token', async (url) => {
    mocks.query.mockResolvedValueOnce([{ ...user, permissions: [] }]);
    expect((await app.inject({ url, headers })).statusCode).toBe(403);
  });

  it('does not use the test-actor bypass outside test mode', async () => {
    mocks.verifyIdToken.mockRejectedValue({ code: 'auth/invalid-id-token' });
    expect((await app.inject({ url: '/session', headers: { authorization: 'Bearer test-actor:qa' } })).statusCode).toBe(401);
    expect(mocks.verifyIdToken).toHaveBeenCalledExactlyOnceWith('test-actor:qa', true);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
