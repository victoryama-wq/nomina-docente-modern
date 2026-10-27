import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerDossierRoutes } from '../routes/teacher-dossier.js';
import type { TeacherDossierService } from '../lib/teacher-dossier.js';
import { adminActor } from './fixtures/index.js';

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), runtime: vi.fn(), upload: vi.fn(), replace: vi.fn() }));
vi.mock('../auth.js', () => ({ authenticate: mocks.authenticate }));
vi.mock('../lib/dossier-runtime.js', () => ({ createDossierService: mocks.runtime }));

const teacherId = '33333333-3333-4333-8333-333333333333';
const documentId = '44444444-4444-4444-8444-444444444444';
const operationId = '11111111-1111-4111-8111-111111111111';
const base = `/teachers/${teacherId}/dossier/documents`;
const headers = { authorization: 'Bearer synthetic-admin', 'content-type': 'application/json' };
const file = { operationId, fileName: 'synthetic.pdf', mimeType: 'application/pdf', base64Data: 'dGVzdA==' };
const upload = { ...file, documentType: 'OTRO', title: 'Synthetic document' };
const replacement = { ...file, expectedRevision: 1 };
const complete = { operationId, state: 'COMPLETE' };
let app: FastifyInstance;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(async () => {
  vi.resetAllMocks();
  mocks.authenticate.mockImplementation(async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.authorization !== headers.authorization) {
      await reply.code(401).send({ error: 'AUTH_REQUIRED' });
      return;
    }
    request.user = adminActor();
  });
  mocks.runtime.mockImplementation(() => { throw new Error('Unexpected real service configuration'); });
  mocks.upload.mockResolvedValue(complete);
  mocks.replace.mockResolvedValue(complete);
  const service = { upload: mocks.upload, replace: mocks.replace } as unknown as TeacherDossierService;
  app = Fastify({ logger: false });
  await registerDossierRoutes(app, service);
  await app.register(async (api) => { await registerDossierRoutes(api, service); }, { prefix: '/api' });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  expect(mocks.runtime).not.toHaveBeenCalled();
});

describe('H24 dossier upload admission without listening or external services', () => {
  it.each([
    { method: 'POST' as const, url: base },
    { method: 'PUT' as const, url: `/api${base}/${documentId}/content` }
  ])('rejects unauthenticated $method before parsing invalid JSON', async ({ method, url }) => {
    const response = await app.inject({ method, url, headers: { 'content-type': 'application/json' }, payload: '{' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'AUTH_REQUIRED' });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('shares two slots across upload/replacement and both prefixes, then releases both', async () => {
    // Repeat the wave to prove both slots are reusable, not merely one free slot.
    for (let wave = 0; wave < 2; wave++) {
      const finish = deferred();
      let active = 0;
      const hold = async () => {
        active++;
        await finish.promise;
        return complete;
      };
      mocks.upload.mockImplementation(hold);
      mocks.replace.mockImplementation(hold);
      const requests = [
        app.inject({ method: 'POST', url: base, headers, payload: upload }).then((response) => response),
        app.inject({ method: 'PUT', url: `/api${base}/${documentId}/content`, headers, payload: replacement }).then((response) => response)
      ];
      try {
        await vi.waitFor(() => expect(active).toBe(2), { timeout: 1_000, interval: 5 });
        const third = await app.inject({ method: 'POST', url: `/api${base}`, headers, payload: upload });
        expect(third.statusCode).toBe(429);
        expect(third.headers['retry-after']).toBe('2');
        expect(third.json().error).toBe('DOSSIER_BUSY');
        expect(active).toBe(2);
      } finally {
        finish.resolve();
        const responses = await Promise.all(requests);
        expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
      }
    }
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.replace).toHaveBeenCalledTimes(2);
  });

  it('releases admission after malformed authenticated bodies', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const invalid = await app.inject({ method: 'POST', url: base, headers, payload: '{' });
      expect(invalid.statusCode).toBe(400);
    }
    const valid = await app.inject({ method: 'POST', url: base, headers, payload: upload });
    expect(valid.statusCode).toBe(200);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });

  it('releases admission after service failures and returns only generic diagnostics', async () => {
    const privateDiagnostic = 'synthetic-private-bucket/object.pdf token=synthetic-secret';
    for (let attempt = 0; attempt < 3; attempt++) {
      mocks.upload.mockRejectedValueOnce(new Error(privateDiagnostic));
      const failed = await app.inject({ method: 'POST', url: base, headers, payload: upload });
      expect(failed.statusCode).toBe(503);
      expect(failed.json().error).toBe('DOSSIER_UNAVAILABLE');
      expect(failed.body).not.toContain(privateDiagnostic);
    }
    const valid = await app.inject({ method: 'POST', url: base, headers, payload: upload });
    expect(valid.statusCode).toBe(200);
    expect(mocks.upload).toHaveBeenCalledTimes(4);
  });
});
