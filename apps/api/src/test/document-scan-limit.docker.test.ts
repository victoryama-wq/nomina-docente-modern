import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import PDFDocument from 'pdfkit';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocumentValidator, createLocalDocumentRunner, localDocumentSecuritySettings } from '../lib/document-security.js';
import { registerTeacherRoutes } from '../routes/teachers.js';
import { registerDossierRoutes } from '../routes/teacher-dossier.js';
import { TeacherDossierService } from '../lib/teacher-dossier.js';
import { adminActor } from './fixtures/index.js';

const mocks = vi.hoisted(() => ({ query: vi.fn(), clientQuery: vi.fn(), transaction: vi.fn(), download: vi.fn(),
  validate: vi.fn(), put: vi.fn(), remove: vi.fn(), read: vi.fn(), assertSafe: vi.fn(), stat: vi.fn() }));
vi.mock('../db.js', () => ({ query: mocks.query, withTransaction: mocks.transaction, pool: { connect: vi.fn(() => { throw Error('No database permitted'); }) } }));
vi.mock('../auth.js', () => ({ authenticate: async (request: FastifyRequest) => { request.user = adminActor(); }, requirePermission: () => async () => {}, requireAnyPermission: () => async () => {} }));
vi.mock('../firebase.js', () => ({ firebaseAdmin: { storage: () => ({ bucket: () => ({ file: () => ({ download: mocks.download }) }) }) } }));
vi.mock('../lib/document-security.js', async original => ({ ...await original<object>(), validateDocumentContent: mocks.validate }));
vi.mock('../lib/constancia-storage.js', async original => ({ ...await original<object>(), constanciaStorage: () => ({ assertSafe: mocks.assertSafe, put: mocks.put, remove: mocks.remove }) }));
vi.mock('../lib/dossier-runtime.js', () => ({ createDossierService: () => { throw Error('No cloud storage permitted'); } }));

const teacherId = '33333333-3333-4333-8333-333333333333';
const documentId = '44444444-4444-4444-8444-444444444444';
const namespace = 'synthetic-b03';
const constancia = `/teachers/${teacherId}/documents/constancia`;
const dossier = `/teachers/${teacherId}/dossier/documents`;
let app: FastifyInstance;
let bytes: Buffer;
let validate: ReturnType<typeof createDocumentValidator>;

async function pdf(pages: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []; const doc = new PDFDocument({ autoFirstPage: false, compress: false });
    doc.on('data', chunk => chunks.push(chunk)); doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    for (let n = 0; n < pages; n++) doc.addPage().text(`H24 B03 SYNTHETIC PAGE ${n}`);
    doc.end();
  });
}
describe.skipIf(process.env.RUN_H24_SCAN_LIMIT_FLOWS !== 'true')('PD07-B03 real parser/ClamAV with routes/services and simulated persistence', () => {
  beforeAll(async () => {
    const settings = localDocumentSecuritySettings({ NODE_ENV: 'test', DB_NAME: 'nomina_docente_test', DB_HOST: '127.0.0.1',
      FIREBASE_PROJECT_ID: 'nomina-h24-test-20261027', DOCUMENT_SECURITY_MODE: 'docker-local',
      DOCUMENT_SECURITY_PARSER_IMAGE: process.env.H24_LIMIT_PARSER_IMAGE,
      DOCUMENT_SECURITY_SCANNER_IMAGE: process.env.H24_LIMIT_AV_IMAGE,
      DOCUMENT_SECURITY_SIGNATURE_VOLUME: process.env.H24_LIMIT_SIGNATURE_VOLUME });
    validate = createDocumentValidator(createLocalDocumentRunner(settings));
    bytes = await pdf(500);
  });
  beforeEach(async () => {
    vi.resetAllMocks();
    // No SQL connection: only SELECTs may cross the in-memory persistence boundary.
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      expect(sql.trim()).toMatch(/^SELECT\b/i);
      return { rows: [{ id: teacherId, status: 'ACTIVO', fullName: 'Synthetic', createdBy: null, coordinationId: null }] };
    });
    mocks.transaction.mockImplementation(work => work({ query: mocks.clientQuery }));
    mocks.query.mockImplementation(async (sql: string) => {
      expect(sql.trim()).toMatch(/^SELECT\b/i);
      if (sql.includes('teacher_dossier_operations')) return [];
      if (sql.includes('teacher_dossier_documents')) return [{ storage_namespace: namespace, storage_key: 'old', storage_generation: '1' }];
      return [{ id: documentId, storageBucket: 'test-only', storageObject: 'old', originalFileName: 'synthetic.pdf', mimeType: 'application/pdf' }];
    });
    mocks.download.mockResolvedValue([bytes]); mocks.read.mockResolvedValue(bytes);
    mocks.validate.mockImplementation(validate);
    app = Fastify({ bodyLimit: 12 * 1024 * 1024 });
    await registerTeacherRoutes(app);
    await registerDossierRoutes(app, new TeacherDossierService({ assertSafe: mocks.assertSafe, put: mocks.put, remove: mocks.remove, read: mocks.read, stat: mocks.stat }, namespace, b => validate(b, 'application/pdf')));
  });
  afterEach(async () => { await app.close(); });
  it('positive control: a small synthetic PDF remains valid', async () => {
    await expect(validate(await pdf(1), 'application/pdf')).resolves.toBeUndefined();
  }, 180_000);
  it.each([
    { name: 'constancia upload/replacement', method: 'POST' as const, url: constancia },
    { name: 'additional upload', method: 'POST' as const, url: dossier, extra: { documentType: 'OTRO', title: 'Synthetic' } },
    { name: 'additional replacement', method: 'PUT' as const, url: `${dossier}/${documentId}/content`, extra: { expectedRevision: 1 } },
    { name: 'constancia preview', method: 'GET' as const, url: constancia.replace('/constancia', '/current') },
    { name: 'additional preview', method: 'GET' as const, url: `${dossier}/${documentId}/content` }
  ])('$name returns a safe 422 with no write, replacement, deletion or content response', async ({ method, url, extra }) => {
    const payload = method === 'GET' ? undefined : { fileName: 'synthetic.pdf', mimeType: 'application/pdf', base64Data: bytes.toString('base64'),
      ...(extra ? { operationId: '11111111-1111-4111-8111-111111111111', ...extra } : {}) };
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ error: 'DOCUMENT_SCAN_LIMIT_EXCEEDED',
      message: 'El PDF excede los limites de analisis de seguridad. Usa un archivo menos complejo o divide el PDF en documentos mas pequenos. No se pudo completar su validacion.' });
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).not.toMatch(/H24_SCAN_LIMIT|Heuristics|storage|bucket|base64|%PDF|stack|\/tmp\//);
    expect(mocks.put).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  }, 180_000);
});
