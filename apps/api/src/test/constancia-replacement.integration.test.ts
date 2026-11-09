import { createHash, randomUUID } from 'node:crypto';
import Fastify, { type FastifyRequest } from 'fastify';
import PDFDocument from 'pdfkit';
import pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { adminActor } from './fixtures/index.js';
import { registerTeacherRoutes } from '../routes/teachers.js';
import { getTestDbConfig, isTestDbExplicitlyConfigured } from './db/test-db-utils.js';
import { replaceConstancia, reconcileConstancias, type ConstanciaStorage, type ConstanciaTransaction } from '../lib/constancia-replacement.js';
import { validateDocumentContent } from '../lib/document-security.js';

const local = isTestDbExplicitlyConfigured() ? describe : describe.skip;
const io = vi.hoisted(() => ({ query: vi.fn(), download: vi.fn() }));
vi.mock('../db.js', () => ({ query: io.query, withTransaction: vi.fn() }));
vi.mock('../firebase.js', () => ({ firebaseAdmin: { storage: () => ({
  bucket: () => ({ file: (key: string) => ({ download: () => io.download(key) }) })
}) } }));
vi.mock('../auth.js', () => ({
  authenticate: async (request: FastifyRequest) => { request.user = adminActor(); },
  requirePermission: () => async () => {}, requireAnyPermission: () => async () => {}
}));
async function pdf(label: string) {
  const document = new PDFDocument({ info: { CreationDate: new Date(0) } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    document.on('data', chunk => chunks.push(chunk)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject);
  });
  document.text(label).end();
  return result;
}
local('constancia replacement SQL on temporary tables only', () => {
  it('preserves the real schema, publishes once, retries cleanup and rolls everything back', async () => {
    const config = getTestDbConfig();
    expect(config.database).toBe('nomina_docente_test');
    expect(['127.0.0.1', 'localhost', '::1']).toContain(config.host);
    const pool = new pg.Pool(config);
    const client = await pool.connect();
    const app = Fastify();
    try {
      expect((await client.query('SELECT current_database() AS name')).rows[0].name).toBe('nomina_docente_test');
      await client.query('BEGIN');
      await client.query('CREATE TEMP TABLE teachers (id uuid PRIMARY KEY) ON COMMIT DROP');
      await client.query('CREATE TEMP TABLE teacher_documents (LIKE public.teacher_documents INCLUDING ALL) ON COMMIT DROP');
      const teacherId = randomUUID(), actorId = randomUUID();
      await client.query('INSERT INTO pg_temp.teachers (id) VALUES ($1)', [teacherId]);
      const objects = new Map<string, Buffer>();
      io.query.mockImplementation(async (sql, args) => (await client.query(sql, args)).rows);
      io.download.mockImplementation(async key => {
        if (!objects.has(key)) throw new Error('Not a live object');
        return [objects.get(key)];
      });
      await registerTeacherRoutes(app);
      let failDelete = false, failUpload = false;
      const storage: ConstanciaStorage = {
        assertSafe: async () => {}, put: async (object, bytes) => {
          if (failUpload) throw new Error('synthetic upload outage');
          objects.set(object.key, bytes);
        },
        remove: async object => { if (failDelete) throw new Error('synthetic outage'); objects.delete(object.key); }
      };
      // Savepoints exercise real SQL/constraints without committing any persistent data.
      const transaction: ConstanciaTransaction = async work => {
        await client.query('SAVEPOINT constancia_test');
        try { const result = await work(client); await client.query('RELEASE SAVEPOINT constancia_test'); return result; }
        catch (error) { await client.query('ROLLBACK TO SAVEPOINT constancia_test'); await client.query('RELEASE SAVEPOINT constancia_test'); throw error; }
      };
      const options = { transaction, storage, bucket: 'synthetic-test', teacherId, actorId,
        fileName: 'A.pdf', mimeType: 'application/pdf', bytes: await pdf('H24 synthetic A'),
        validateContent: validateDocumentContent,
        authorize: async () => {}, afterSwitch: async () => ({ id: teacherId }) };
      const first = await replaceConstancia(options);
      expect(first.cleanupPending).toBe(false);
      const secondOptions = { ...options, fileName: 'B.pdf', bytes: await pdf('H24 synthetic B') };
      const checkDownload = async (expected: typeof options) => {
        const response = await app.inject({ method: 'GET', url: `/teachers/${teacherId}/documents/current` });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-disposition']).toMatch(/^attachment;/);
        expect(response.headers['x-document-analysis']).toBe('NOT_SCANNED');
        expect(response.headers['content-disposition']).toContain(expected.fileName);
        const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
        expect(hash(response.rawPayload)).toBe(hash(expected.bytes));
      };
      failUpload = true;
      await expect(replaceConstancia(secondOptions)).rejects.toThrow('synthetic upload outage');
      await checkDownload(options);
      failUpload = false;
      failDelete = true;
      const second = await replaceConstancia(secondOptions);
      expect(second.cleanupPending).toBe(true);
      expect((await client.query('SELECT id FROM pg_temp.teacher_documents WHERE is_current')).rows.map(r => r.id)).toEqual([second.documentId]);
      await checkDownload(secondOptions);
      failDelete = false;
      expect(await reconcileConstancias(transaction, storage)).toEqual({ deleted: 1, pending: false });
      expect(objects.has(`constancias/${teacherId}/${first.documentId}`)).toBe(false);
      expect(await reconcileConstancias(transaction, storage)).toEqual({ deleted: 0, pending: false });
      expect([...objects.keys()]).toEqual([`constancias/${teacherId}/${second.documentId}`]);
      await checkDownload(secondOptions);
      expect((await client.query('SELECT count(*)::int AS n FROM pg_temp.teacher_documents WHERE is_current')).rows[0].n).toBe(1);
    } finally {
      await client.query('ROLLBACK'); client.release(); await pool.end(); await app.close();
    }
  });
});
