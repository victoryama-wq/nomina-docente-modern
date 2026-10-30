import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeacherDossierService } from '../lib/teacher-dossier.js';
import { registerDossierRoutes } from '../routes/teacher-dossier.js';
import { DocumentSecurityError } from '../lib/document-security.js';
import { adminActor } from './fixtures/index.js';

const db = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock('../db.js', () => ({ query: db.query, withTransaction: db.transaction, pool: {} }));
vi.mock('../auth.js', () => ({ authenticate: async (request: FastifyRequest) => { request.user = adminActor(); } }));
vi.mock('../lib/dossier-runtime.js', () => ({ createDossierService: () => { throw new Error('No real storage permitted'); } }));

const teacherId = '33333333-3333-4333-8333-333333333333';
const documentId = '44444444-4444-4444-8444-444444444444';
const operationId = '11111111-1111-4111-8111-111111111111';
const paths = [
  { method: 'POST' as const, url: `/teachers/${teacherId}/dossier/documents`, extra: { documentType: 'OTRO', title: 'Synthetic' } },
  { method: 'PUT' as const, url: `/teachers/${teacherId}/dossier/documents/${documentId}/content`, extra: { expectedRevision: 1 } }
];
const storage = { assertSafe: vi.fn(), put: vi.fn(), read: vi.fn(), stat: vi.fn(), remove: vi.fn() };
const validate = vi.fn<(bytes: Buffer) => Promise<void>>();
let app: FastifyInstance;

beforeEach(async () => {
  vi.resetAllMocks();
  db.query.mockResolvedValue([]);
  // Real route/schema/service/decoder; stop at the persistence boundary. No database or files are written.
  db.transaction.mockResolvedValue({ id: operationId, document_id: documentId, state: 'COMPLETE', result: {} });
  app = Fastify({ bodyLimit: 12 * 1024 * 1024 });
  await registerDossierRoutes(app, new TeacherDossierService(storage, 'synthetic', validate));
});
afterEach(async () => { await app.close(); });

function payload(extra: object, base64Data: string) {
  return { operationId, fileName: 'synthetic.pdf', mimeType: 'application/pdf', base64Data, ...extra };
}

describe('PD07-B01 additional document upload and replacement encoding', () => {
  it.each(paths.flatMap(path => [1, 2, 4, 7.5].map(mib => ({ ...path, mib }))))(
    '$method accepts $mib MiB and preserves the security gate and bytes', async ({ method, url, extra, mib }) => {
      const bytes = Buffer.alloc(mib * 1024 * 1024, 0xfb);
      const response = await app.inject({ method, url, payload: payload(extra, bytes.toString('base64')) });
      expect(response.statusCode).toBe(200);
      expect(response.json().state).toBe('COMPLETE');
      expect(storage.assertSafe).toHaveBeenCalledOnce();
      expect(validate).toHaveBeenCalledOnce();
      expect(validate.mock.calls[0][0].equals(bytes)).toBe(true);
      expect(db.transaction).toHaveBeenCalledOnce();
      expect(validate.mock.invocationCallOrder[0]).toBeLessThan(db.transaction.mock.invocationCallOrder[0]);
    });

  it.each(paths)('$method rejects malformed and oversized input before validation/persistence', async ({ method, url, extra }) => {
    const encoded = Buffer.alloc(7.5 * 1024 * 1024).toString('base64');
    for (const [input, status, error] of [
      [`${encoded.slice(0, -1)}!`, 422, 'INVALID_PDF'],
      [Buffer.alloc(7.5 * 1024 * 1024 + 1).toString('base64'), 413, 'FILE_TOO_LARGE']
    ] as const) {
      const response = await app.inject({ method, url, payload: payload(extra, input) });
      expect(response.statusCode).toBe(status);
      expect(response.json().error).toBe(error);
    }
    expect(validate).not.toHaveBeenCalled();
    expect(storage.assertSafe).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each(paths.flatMap(path => ['DOCUMENT_REJECTED', 'DOCUMENT_SECURITY_UNAVAILABLE'].map(code => ({ ...path, code }))))(
    '$method does not bypass $code for a valid large encoding', async ({ method, url, extra, code }) => {
      validate.mockRejectedValue(new DocumentSecurityError(code as 'DOCUMENT_REJECTED' | 'DOCUMENT_SECURITY_UNAVAILABLE'));
      const response = await app.inject({ method, url, payload: payload(extra, Buffer.alloc(7.5 * 1024 * 1024).toString('base64')) });
      expect(response.statusCode).toBe(code === 'DOCUMENT_REJECTED' ? 422 : 503);
      expect(response.json().error).toBe(code);
      expect(validate).toHaveBeenCalledOnce();
      expect(db.transaction).not.toHaveBeenCalled();
      expect(storage.put).not.toHaveBeenCalled();
      expect(storage.remove).not.toHaveBeenCalled();
    });
});
