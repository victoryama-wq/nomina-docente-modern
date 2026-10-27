import { randomUUID } from 'node:crypto';
import { chmod, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance, type InjectOptions, type LightMyRequestResponse } from 'fastify';
import PDFDocument from 'pdfkit';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DossierStorage, StoredObject } from '../lib/dossier-storage.js';
import type { TeacherDossierService } from '../lib/teacher-dossier.js';
import type { SessionUser } from '../types.js';
import { TEST_IDS } from './api-integration-helpers.js';
import { buildTestApp } from './app-test-utils.js';
import { clearTestActors, injectAs } from './auth-test-utils.js';
import { applyTestDbEnvironment, getTestDbConfig, isTestDbExplicitlyConfigured, prepareTestDatabase } from './db/test-db-utils.js';
import { accountingActor, accountantActor, adminActor, coordinatorActor, directionActor, financeActor, rhActor } from './fixtures/index.js';

const describeIfDb = isTestDbExplicitlyConfigured() ? describe : describe.skip;
const teacherId = TEST_IDS.teacherIdiomas;
const otherTeacherId = TEST_IDS.teacherMulti;
const base = (id: string = teacherId) => `/teachers/${id}/dossier`;
const admin = (): SessionUser => ({ ...adminActor(), isProtectedSuperAdmin: false, permissions: [] });

interface OperationResult {
  operationId: string;
  documentId: string | null;
  state: string;
  errorCode: string | null;
  result: { revision?: number; version?: string };
}

interface DocumentDto {
  id: string;
  documentType: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  state: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

interface DossierDto {
  teacher: { id: string; fullName: string; phone: string; version: string };
  documents: DocumentDto[];
  capabilities: { readDocuments: boolean; manageDocuments: boolean; editPhone: boolean };
}

interface DocumentRow {
  id: string;
  teacher_id: string;
  storage_key: string;
  storage_generation: string;
  state: string;
  revision: number;
}

interface OperationRow {
  id: string;
  actor_id: string;
  teacher_id: string | null;
  document_id: string | null;
  state: string;
  error_code: string | null;
  new_key: string | null;
  new_generation: string | null;
  old_key: string | null;
  old_generation: string | null;
  payload: Record<string, unknown>;
  attempts: number;
}

// Faults surround the real adapter: bytes always live in a private temporary directory.
class FaultStorage implements DossierStorage {
  failRemove = false;
  failPut: 'before' | 'after' | null = null;
  afterPut?: () => Promise<void>;

  constructor(readonly local: DossierStorage) {}

  assertSafe() { return this.local.assertSafe(); }
  stat(key: string) { return this.local.stat(key); }
  read(object: StoredObject) { return this.local.read(object); }

  async put(key: string, bytes: Buffer): Promise<StoredObject> {
    if (this.failPut === 'before') throw new Error('H24 private storage diagnostic before write');
    const object = await this.local.put(key, bytes);
    await this.afterPut?.();
    if (this.failPut === 'after') throw new Error('H24 private storage diagnostic after write');
    return object;
  }

  async remove(object: StoredObject): Promise<void> {
    if (this.failRemove) throw new Error(`H24 private storage diagnostic: ${object.key}`);
    await this.local.remove(object);
  }
}

function makePdf(text: string, options: PDFKit.PDFDocumentOptions = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ compress: false, ...options });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.text(text);
    doc.end();
  });
}

function expectError(response: LightMyRequestResponse, status: number, code?: string) {
  expect(response.statusCode, response.body).toBe(status);
  if (code) expect(response.json().error).toBe(code);
  expect(response.body).not.toMatch(/H24 private storage diagnostic|INSERT INTO|UPDATE teachers|23503|stack|base64Data/i);
}

describeIfDb('H24 dossier: PostgreSQL, authenticated routes and local PDF storage', () => {
  let app: FastifyInstance | null = null;
  let root: string | undefined;
  let storage: FaultStorage;
  let service: TeacherDossierService;
  let query: typeof import('../db.js').query;
  let Service: typeof import('../lib/teacher-dossier.js').TeacherDossierService;
  let LocalStorage: typeof import('../lib/dossier-storage.js').LocalDossierStorage;
  let validatePdf: typeof import('../lib/dossier-storage.js').validateDossierPdf;
  let pdf: Buffer;
  let replacementPdf: Buffer;

  beforeAll(async () => {
    pdf = await makePdf('H24 synthetic teacher document');
    replacementPdf = await makePdf('H24 synthetic replacement document');
  });

  beforeEach(async () => {
    // Check the host before the existing helper performs its destructive test-schema reset.
    expect(['localhost', '127.0.0.1', '::1']).toContain(getTestDbConfig().host);
    expect(getTestDbConfig().database).toBe('nomina_docente_test');
    expect(path.isAbsolute(process.env.DOSSIER_PDFINFO_PATH ?? ''), 'Parent must supply an absolute DOSSIER_PDFINFO_PATH').toBe(true);
    applyTestDbEnvironment();
    vi.stubEnv('DOSSIER_STORAGE_MODE', 'disabled');
    vi.stubEnv('FIREBASE_PROJECT_ID', 'demo-nomina-h24-test');
    vi.stubEnv('GCP_PROJECT_ID', 'demo-nomina-h24-test');
    await prepareTestDatabase();
    // No runtime db/auth/config imports may precede applyTestDbEnvironment.
    ({ query } = await import('../db.js'));
    ({ TeacherDossierService: Service } = await import('../lib/teacher-dossier.js'));
    ({ LocalDossierStorage: LocalStorage, validateDossierPdf: validatePdf } = await import('../lib/dossier-storage.js'));
    const { registerDossierRoutes } = await import('../routes/teacher-dossier.js');
    expect(await query('SELECT current_database() AS name')).toEqual([{ name: 'nomina_docente_test' }]);
    root = await mkdtemp(path.join(tmpdir(), 'nomina-h24-integration-'));
    await chmod(root, 0o700);
    storage = new FaultStorage(new LocalStorage(root));
    service = new Service(storage, `local:${root}`, validatePdf);
    app = Fastify({ logger: false, bodyLimit: 12 * 1024 * 1024 });
    await registerDossierRoutes(app, service);
    await app.ready();
  }, 30_000);

  afterEach(async () => {
    try {
      await app?.close();
    } finally {
      app = null;
      clearTestActors();
      vi.unstubAllEnvs();
      if (root) {
        const target = path.resolve(root);
        const relative = path.relative(path.resolve(tmpdir()), target);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(target).startsWith('nomina-h24-integration-')) {
          throw new Error('Refusing to remove a non-test storage directory');
        }
        await rm(target, { recursive: true, force: true });
        root = undefined;
      }
    }
  });

  function request(options: InjectOptions, actor = admin()) {
    return injectAs(app!, actor, options);
  }

  function uploadBody(overrides: Record<string, unknown> = {}) {
    return { operationId: randomUUID(), documentType: 'CURP', title: 'Synthetic H24 document',
      fileName: 'document.pdf', mimeType: 'application/pdf', base64Data: pdf.toString('base64'), ...overrides };
  }

  function replaceBody(revision: number, overrides: Record<string, unknown> = {}) {
    return { operationId: randomUUID(), expectedRevision: revision, fileName: 'replacement.pdf',
      mimeType: 'application/pdf', base64Data: replacementPdf.toString('base64'), ...overrides };
  }

  async function dossier(actor = admin(), id: string = teacherId): Promise<DossierDto> {
    const response = await request({ method: 'GET', url: base(id) }, actor);
    expect(response.statusCode, response.body).toBe(200);
    return response.json<DossierDto>();
  }

  async function upload(actor = admin(), id: string = teacherId, payload = uploadBody()) {
    const response = await request({ method: 'POST', url: `${base(id)}/documents`, payload }, actor);
    expect(response.statusCode, response.body).toBe(200);
    const operation = response.json<OperationResult>();
    expect(operation).toMatchObject({ operationId: payload.operationId, state: 'COMPLETE', errorCode: null });
    expect(operation.documentId).toEqual(expect.any(String));
    const doc = (await dossier(actor, id)).documents.find((item) => item.id === operation.documentId)!;
    expect(doc).toBeDefined();
    expect(doc.state).toBe('AVAILABLE');
    return { doc, operation, payload };
  }

  async function row(id: string): Promise<DocumentRow> {
    const rows = await query<DocumentRow>('SELECT * FROM teacher_dossier_documents WHERE id=$1', [id]);
    expect(rows).toHaveLength(1);
    return rows[0];
  }

  async function operationRow(id: string): Promise<OperationRow> {
    const rows = await query<OperationRow>('SELECT * FROM teacher_dossier_operations WHERE id=$1', [id]);
    expect(rows).toHaveLength(1);
    return rows[0];
  }

  async function expectPurgedOperation(id: string, state = 'COMPLETE') {
    expect(await operationRow(id)).toMatchObject({ state, new_key: null, new_generation: null,
      old_key: null, old_generation: null, payload: {} });
  }

  async function snapshot() {
    const result: Record<string, unknown> = {};
    // Fixed identifiers only; include real rows, not counts or just selected fiscal columns.
    for (const table of ['teachers', 'teacher_documents', 'schedules', 'schedule_incidences', 'extra_hours',
      'payroll_runs', 'payroll_lines', 'payroll_schedule_details', 'payroll_extra_details', 'roles', 'permissions', 'role_permissions']) {
      result[table] = await query(`SELECT to_jsonb(t) AS data FROM ${table} t ORDER BY to_jsonb(t)::text`);
    }
    return result;
  }

  async function auditRows() {
    return query('SELECT * FROM audit_log ORDER BY id');
  }

  function allEndpoints(docId: string, operationId: string, version: string, revision: number): InjectOptions[] {
    return [
      { method: 'GET', url: base() },
      { method: 'GET', url: `${base()}/documents/${docId}/content` },
      { method: 'GET', url: `${base()}/documents/${docId}/content?download=true` },
      { method: 'GET', url: `${base()}/operations/${operationId}` },
      { method: 'POST', url: `${base()}/documents`, payload: uploadBody() },
      { method: 'PATCH', url: `${base()}/documents/${docId}`, payload: { operationId: randomUUID(), expectedRevision: revision, documentType: 'OTRO', title: 'Denied edit' } },
      { method: 'PUT', url: `${base()}/documents/${docId}/content`, payload: replaceBody(revision) },
      { method: 'DELETE', url: `${base()}/documents/${docId}`, payload: { operationId: randomUUID(), expectedRevision: revision } },
      { method: 'PATCH', url: `${base()}/contact`, payload: { operationId: randomUUID(), expectedVersion: version, phone: '9981234567' } }
    ];
  }

  it('requires authentication on every endpoint and denies excluded/inactive roles despite broad permissions', async () => {
    const { doc, operation } = await upload();
    const endpoints = allEndpoints(doc.id, operation.operationId, (await dossier()).teacher.version, doc.revision);
    const before = await snapshot();
    const auditBefore = await auditRows();
    const documentBefore = await row(doc.id);
    const operationsBefore = await query('SELECT * FROM teacher_dossier_operations ORDER BY id');
    const broad = adminActor().permissions;
    const denied = [coordinatorActor(), directionActor(), accountantActor(), accountingActor()]
      .map((actor) => ({ ...actor, permissions: broad, isProtectedSuperAdmin: false }));
    denied.push({ ...adminActor(), status: 'INACTIVO' }, { ...financeActor(), status: 'INACTIVO' }, { ...rhActor(), status: 'INACTIVO' });
    for (const endpoint of endpoints) {
      expectError(await app!.inject(endpoint), 401, 'AUTH_REQUIRED');
      for (const actor of denied) expectError(await request(endpoint, actor), 403, 'FORBIDDEN');
    }
    expect(await snapshot()).toEqual(before);
    expect(await row(doc.id)).toEqual(documentBefore);
    expect(await query('SELECT * FROM teacher_dossier_operations ORDER BY id')).toEqual(operationsBefore);
    expect(await auditRows()).toEqual(auditBefore);
    expect(await readdir(root!)).toHaveLength(1);
  });

  it('allows a non-protected admin with no persisted permissions through the complete document lifecycle', async () => {
    await query("DELETE FROM role_permissions WHERE role_id=(SELECT id FROM roles WHERE code='admin')");
    expect((await dossier()).capabilities).toEqual({ readDocuments: true, manageDocuments: true, editPhone: true });
    const { doc } = await upload();
    const metadata = await request({ method: 'PATCH', url: `${base()}/documents/${doc.id}`, payload: {
      operationId: randomUUID(), expectedRevision: doc.revision, documentType: 'TITULO', title: 'Reclassified'
    } });
    expect(metadata.statusCode, metadata.body).toBe(200);
    expect(metadata.json().state).toBe('COMPLETE');
    const replaced = await request({ method: 'PUT', url: `${base()}/documents/${doc.id}/content`,
      payload: replaceBody(metadata.json<OperationResult>().result.revision!) });
    expect(replaced.statusCode, replaced.body).toBe(200);
    expect(replaced.json().state).toBe('COMPLETE');
    const current = (await dossier()).documents[0];
    expect(current).toMatchObject({ id: doc.id, documentType: 'TITULO', title: 'Reclassified' });
    expect((await request({ method: 'GET', url: `${base()}/documents/${doc.id}/content` })).rawPayload).toEqual(replacementPdf);
    const contact = await request({ method: 'PATCH', url: `${base()}/contact`, payload: {
      operationId: randomUUID(), expectedVersion: (await dossier()).teacher.version, phone: '9981234567'
    } });
    expect(contact.statusCode, contact.body).toBe(200);
    expect((await dossier()).teacher.phone).toBe('9981234567');
    const removed = await request({ method: 'DELETE', url: `${base()}/documents/${doc.id}`, payload: {
      operationId: randomUUID(), expectedRevision: current.revision
    } });
    expect(removed.statusCode, removed.body).toBe(200);
    expect(removed.json().state).toBe('COMPLETE');
    expect((await dossier()).documents).toEqual([]);
    expect(await readdir(root!)).toEqual([]);
  });

  it.each([['Finance', financeActor], ['RH', rhActor]] as const)('enforces separate view/read/manage/contact permissions for %s', async (_name, factory) => {
    const { doc, operation } = await upload();
    const profiles = [
      { permissions: [], view: false, read: false, manage: false, contact: false },
      { permissions: ['fiscal.document.view', 'fiscal.document.manage'], view: false, read: false, manage: false, contact: false },
      { permissions: ['fiscal.view'], view: true, read: false, manage: false, contact: false },
      { permissions: ['fiscal.manage'], view: true, read: false, manage: false, contact: true },
      { permissions: ['fiscal.view', 'fiscal.document.view'], view: true, read: true, manage: false, contact: false },
      { permissions: ['fiscal.view', 'fiscal.document.manage'], view: true, read: true, manage: true, contact: false },
      { permissions: ['fiscal.manage', 'fiscal.document.manage'], view: true, read: true, manage: true, contact: true }
    ];
    for (const profile of profiles) {
      const actor = { ...factory(), permissions: profile.permissions };
      await query('DELETE FROM role_permissions WHERE role_id=(SELECT role_id FROM app_users WHERE id=$1)', [actor.id]);
      await query(`INSERT INTO role_permissions (role_id,permission_id)
        SELECT u.role_id,p.id FROM app_users u CROSS JOIN permissions p WHERE u.id=$1 AND p.code=ANY($2::text[])`, [actor.id, profile.permissions]);
      const listed = await request({ method: 'GET', url: base() }, actor);
      if (!profile.view) expectError(listed, 403, 'FORBIDDEN');
      else {
        expect(listed.statusCode, listed.body).toBe(200);
        expect(listed.json<DossierDto>().capabilities).toEqual({ readDocuments: profile.read, manageDocuments: profile.manage, editPhone: profile.contact });
        expect(listed.json<DossierDto>().documents.map((item) => item.id)).toEqual(profile.read ? [doc.id] : []);
      }
      for (const url of [`${base()}/documents/${doc.id}/content`, `${base()}/documents/${doc.id}/content?download=true`, `${base()}/operations/${operation.operationId}`]) {
        const response = await request({ method: 'GET', url }, actor);
        if (profile.read) expect(response.statusCode, response.body).toBe(200);
        else expectError(response, 403, 'FORBIDDEN');
      }
      const contact = await request({ method: 'PATCH', url: `${base()}/contact`, payload: {
        operationId: randomUUID(), expectedVersion: (await dossier()).teacher.version, phone: '9981234567'
      } }, actor);
      if (profile.contact) {
        expect(contact.statusCode, contact.body).toBe(200);
        expect((await request({ method: 'GET', url: `${base()}/operations/${contact.json().operationId}` }, actor)).statusCode).toBe(200);
      } else expectError(contact, 403, 'FORBIDDEN');
      if (!profile.manage) {
        for (const endpoint of allEndpoints(doc.id, operation.operationId, (await dossier()).teacher.version, doc.revision)
          .filter((endpoint) => ['POST', 'PUT', 'DELETE'].includes(String(endpoint.method)) || (endpoint.method === 'PATCH' && !String(endpoint.url).endsWith('/contact')))) {
          expectError(await request(endpoint, actor), 403, 'FORBIDDEN');
        }
      } else {
        const created = await upload(actor);
        const metadata = await request({ method: 'PATCH', url: `${base()}/documents/${created.doc.id}`, payload: {
          operationId: randomUUID(), expectedRevision: created.doc.revision, documentType: 'OTRO', title: 'Managed'
        } }, actor);
        expect(metadata.statusCode, metadata.body).toBe(200);
        const replaced = await request({ method: 'PUT', url: `${base()}/documents/${created.doc.id}/content`,
          payload: replaceBody(metadata.json<OperationResult>().result.revision!) }, actor);
        expect(replaced.statusCode, replaced.body).toBe(200);
        expect(replaced.json().state).toBe('COMPLETE');
        const removed = await request({ method: 'DELETE', url: `${base()}/documents/${created.doc.id}`, payload: {
          operationId: randomUUID(), expectedRevision: replaced.json<OperationResult>().result.revision
        } }, actor);
        expect(removed.statusCode, removed.body).toBe(200);
        expect(removed.json().state).toBe('COMPLETE');
      }
    }
  });

  it('lists only public DTO fields, allows repeated type/name, and replays exactly once without duplicate audits or bytes', async () => {
    const first = await upload();
    const beforeReplay = await auditRows();
    const replay = await request({ method: 'POST', url: `${base()}/documents`, payload: first.payload });
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(first.operation);
    expect(await auditRows()).toEqual(beforeReplay);
    expect(await query('SELECT id FROM teacher_dossier_operations')).toHaveLength(1);
    expect(await readdir(root!)).toHaveLength(1);
    const second = await upload();
    expect(second.doc.id).not.toBe(first.doc.id);
    const listed = await dossier();
    expect(Object.keys(listed).sort()).toEqual(['capabilities', 'documents', 'teacher']);
    expect(Object.keys(listed.teacher).sort()).toEqual(['fullName', 'id', 'phone', 'version']);
    expect(listed.documents).toHaveLength(2);
    for (const doc of listed.documents) {
      expect(Object.keys(doc).sort()).toEqual(['createdAt', 'documentType', 'fileName', 'id', 'mimeType', 'revision', 'sizeBytes', 'state', 'title', 'updatedAt']);
      expect(doc).toMatchObject({ documentType: 'CURP', fileName: 'document.pdf', mimeType: 'application/pdf', sizeBytes: pdf.length });
    }
    const status = await request({ method: 'GET', url: `${base()}/operations/${first.operation.operationId}` });
    expect(status.statusCode).toBe(200);
    expect(Object.keys(status.json()).sort()).toEqual(['documentId', 'errorCode', 'operationId', 'result', 'state']);
    expect(JSON.stringify(listed)).not.toMatch(/storage|generation|namespace|base64|bucket|request_hash/i);
    await expectPurgedOperation(first.operation.operationId);
    expect(await readdir(root!)).toHaveLength(2);
  });

  it('serves exact PDF bytes with safe preview/download headers, including a Unicode filename', async () => {
    const fileName = "T\u00edtulo O'Brien (QA).pdf";
    const { doc } = await upload(admin(), teacherId, uploadBody({ fileName }));
    for (const [queryString, disposition] of [['', 'inline'], ['?download=false', 'inline'], ['?download=true', 'attachment']]) {
      const response = await request({ method: 'GET', url: `${base()}/documents/${doc.id}/content${queryString}` });
      expect(response.statusCode).toBe(200);
      expect(response.rawPayload).toEqual(pdf);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
      expect(response.headers['content-disposition']).toBe(`${disposition}; filename="T_tulo_O_Brien__QA_.pdf"; filename*=UTF-8''T%C3%ADtulo%20O%27Brien%20%28QA%29.pdf`);
    }
    expectError(await request({ method: 'GET', url: `${base()}/documents/${doc.id}/content?download=true&storageKey=secret` }), 400, 'VALIDATION_ERROR');
  });

  it('replaces bytes under a stable document ID, removes the old file, and deletes idempotently', async () => {
    const { doc } = await upload();
    const old = await row(doc.id);
    const replacement = replaceBody(doc.revision);
    const response = await request({ method: 'PUT', url: `${base()}/documents/${doc.id}/content`, payload: replacement });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({ documentId: doc.id, state: 'COMPLETE' });
    const current = await row(doc.id);
    expect(current.revision).toBe(doc.revision + 1);
    expect(current.storage_key).not.toBe(old.storage_key);
    expect(await storage.local.stat(old.storage_key)).toBeNull();
    expect(await storage.local.read({ key: current.storage_key, generation: current.storage_generation })).toEqual(replacementPdf);
    const auditBeforeReplay = await auditRows();
    expect((await request({ method: 'PUT', url: `${base()}/documents/${doc.id}/content`, payload: replacement })).json()).toEqual(response.json());
    expect(await auditRows()).toEqual(auditBeforeReplay);
    await expectPurgedOperation(replacement.operationId);
    expect(await readdir(root!)).toHaveLength(1);
    const deletion = { operationId: randomUUID(), expectedRevision: current.revision };
    const deleted = await request({ method: 'DELETE', url: `${base()}/documents/${doc.id}`, payload: deletion });
    expect(deleted.statusCode, deleted.body).toBe(200);
    expect(deleted.json()).toMatchObject({ state: 'COMPLETE', documentId: doc.id });
    const auditAfterDelete = await auditRows();
    const repeated = await request({ method: 'DELETE', url: `${base()}/documents/${doc.id}`, payload: deletion });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json()).toEqual(deleted.json());
    expect(await auditRows()).toEqual(auditAfterDelete);
    expect(await storage.local.stat(current.storage_key)).toBeNull();
    expect(await query('SELECT id FROM teacher_dossier_documents')).toEqual([]);
    expect(await readdir(root!)).toEqual([]);
    expectError(await request({ method: 'GET', url: `${base()}/documents/${doc.id}/content` }), 404, 'NOT_FOUND');
    await expectPurgedOperation(deletion.operationId);
  });

  it('rejects cross-teacher IDs, missing resources and operation-key reuse for another actor/payload/teacher', async () => {
    const { doc, operation, payload } = await upload();
    const before = await row(doc.id);
    const audits = await auditRows();
    for (const endpoint of [
      { method: 'GET', url: `${base(otherTeacherId)}/documents/${doc.id}/content` },
      { method: 'GET', url: `${base(otherTeacherId)}/operations/${operation.operationId}` },
      { method: 'PATCH', url: `${base(otherTeacherId)}/documents/${doc.id}`, payload: { operationId: randomUUID(), expectedRevision: doc.revision, documentType: 'OTRO', title: 'Crossed' } },
      { method: 'PUT', url: `${base(otherTeacherId)}/documents/${doc.id}/content`, payload: replaceBody(doc.revision) },
      { method: 'DELETE', url: `${base(otherTeacherId)}/documents/${doc.id}`, payload: { operationId: randomUUID(), expectedRevision: doc.revision } },
      { method: 'GET', url: base(randomUUID()) },
      { method: 'GET', url: `${base()}/operations/${randomUUID()}` },
      { method: 'GET', url: `${base()}/documents/${randomUUID()}/content` },
      { method: 'POST', url: `${base(randomUUID())}/documents`, payload: uploadBody() }
    ] satisfies InjectOptions[]) expectError(await request(endpoint), 404, 'NOT_FOUND');
    for (const changed of [{ ...payload, title: 'Changed' }, { ...payload, base64Data: replacementPdf.toString('base64') }]) {
      expectError(await request({ method: 'POST', url: `${base()}/documents`, payload: changed }), 409, 'DOSSIER_CONFLICT');
    }
    expectError(await request({ method: 'POST', url: `${base(otherTeacherId)}/documents`, payload }), 409, 'DOSSIER_CONFLICT');
    expectError(await request({ method: 'POST', url: `${base()}/documents`, payload }, financeActor()), 409, 'DOSSIER_CONFLICT');
    expect(await row(doc.id)).toEqual(before);
    expect(await query('SELECT id FROM teacher_dossier_operations')).toHaveLength(1);
    expect(await auditRows()).toEqual(audits);
    expect(await readdir(root!)).toHaveLength(1);
  });

  it('rejects stale metadata/replace/delete revisions without changing rows, files or audit', async () => {
    const { doc } = await upload();
    const payload = { operationId: randomUUID(), expectedRevision: doc.revision, documentType: 'OTRO', title: 'New title' };
    const changed = await request({ method: 'PATCH', url: `${base()}/documents/${doc.id}`, payload });
    expect(changed.statusCode).toBe(200);
    const current = await row(doc.id);
    expect(current.revision).toBe(doc.revision + 1);
    const audits = await auditRows();
    expect((await request({ method: 'PATCH', url: `${base()}/documents/${doc.id}`, payload })).json()).toEqual(changed.json());
    for (const endpoint of [
      { method: 'PATCH', url: `${base()}/documents/${doc.id}`, payload: { ...payload, operationId: randomUUID() } },
      { method: 'PUT', url: `${base()}/documents/${doc.id}/content`, payload: replaceBody(doc.revision) },
      { method: 'DELETE', url: `${base()}/documents/${doc.id}`, payload: { operationId: randomUUID(), expectedRevision: doc.revision } }
    ] satisfies InjectOptions[]) expectError(await request(endpoint), 409, 'DOSSIER_CONFLICT');
    expect(await row(doc.id)).toEqual(current);
    expect(await auditRows()).toEqual(audits);
    expect(await readdir(root!)).toHaveLength(1);
  });

  it('keeps fiscal, constancia, operational and payroll rows unchanged; phone only changes its own audit fields', async () => {
    await query(`UPDATE teachers SET phone='9981112233',rfc='XAXX010101000',email='synthetic@example.invalid',
      bank_detail='H24 synthetic bank',payment_type='1' WHERE id=$1`, [teacherId]);
    await query(`INSERT INTO teacher_documents (teacher_id,storage_bucket,storage_object,original_file_name,mime_type,uploaded_by,is_current)
      VALUES ($1,'h24-never-contact-this-bucket','synthetic-current','constancia.pdf','application/pdf',$2,true),
      ($1,'h24-never-contact-this-bucket','synthetic-history','previous.pdf','application/pdf',$2,false)`, [teacherId, admin().id]);
    const before = await snapshot();
    const { doc } = await upload();
    const changed = await request({ method: 'PATCH', url: `${base()}/documents/${doc.id}`, payload: {
      operationId: randomUUID(), expectedRevision: doc.revision, documentType: 'ACTA_NACIMIENTO', title: 'Birth certificate'
    } });
    expect(changed.statusCode).toBe(200);
    const replaced = await request({ method: 'PUT', url: `${base()}/documents/${doc.id}/content`, payload: replaceBody(changed.json().result.revision) });
    expect(replaced.json().state).toBe('COMPLETE');
    const deleted = await request({ method: 'DELETE', url: `${base()}/documents/${doc.id}`, payload: {
      operationId: randomUUID(), expectedRevision: replaced.json().result.revision
    } });
    expect(deleted.json().state).toBe('COMPLETE');
    expect(await snapshot()).toEqual(before);
    const payload = { operationId: randomUUID(), expectedVersion: (await dossier()).teacher.version, phone: '9987654321' };
    const contact = await request({ method: 'PATCH', url: `${base()}/contact`, payload }, rhActor());
    expect(contact.statusCode, contact.body).toBe(200);
    expect(contact.json().state).toBe('COMPLETE');
    const after = await snapshot();
    const beforeTeachers = before.teachers as { data: Record<string, unknown> }[];
    const afterTeachers = after.teachers as { data: Record<string, unknown> }[];
    const original = beforeTeachers.find((item) => item.data.id === teacherId)!.data;
    const updated = afterTeachers.find((item) => item.data.id === teacherId)!.data;
    expect(updated.phone).toBe(payload.phone);
    expect(updated.updated_by).toBe(rhActor().id);
    expect(updated.updated_at).not.toEqual(original.updated_at);
    expect({ ...updated, phone: original.phone, updated_at: original.updated_at, updated_by: original.updated_by }).toEqual(original);
    expect(afterTeachers.filter((item) => item.data.id !== teacherId)).toEqual(beforeTeachers.filter((item) => item.data.id !== teacherId));
    expect({ ...after, teachers: before.teachers }).toEqual(before);
    const audits = await auditRows();
    expect((await request({ method: 'PATCH', url: `${base()}/contact`, payload }, rhActor())).json()).toEqual(contact.json());
    expect(await auditRows()).toEqual(audits);
    expectError(await request({ method: 'PATCH', url: `${base()}/contact`, payload: { ...payload, operationId: randomUUID(), phone: '9980001122' } }, rhActor()), 409, 'DOSSIER_CONFLICT');
    expect(await snapshot()).toEqual(after);
    const phoneAudit = await query<{ actor_user_id: string; metadata: unknown }>(
      "SELECT actor_user_id,metadata FROM audit_log WHERE action='TEACHER_DOSSIER_PHONE_UPDATED'");
    expect(phoneAudit).toEqual([{ actor_user_id: rhActor().id, metadata: { operationId: payload.operationId, fields: ['phone'] } }]);
    expect(JSON.stringify(audits)).not.toContain(pdf.toString('base64'));
    expect(JSON.stringify(phoneAudit)).not.toContain(payload.phone);
  });

  it('rejects extra fields and invalid metadata/contact schemas without any durable mutation', async () => {
    const { doc } = await upload();
    const version = (await dossier()).teacher.version;
    const before = await snapshot();
    const audits = await auditRows();
    const document = await row(doc.id);
    const operations = await query('SELECT * FROM teacher_dossier_operations ORDER BY id');
    for (const extra of [
      { rfc: 'XEXX010101000' }, { email: 'changed@example.invalid' }, { bankDetail: 'changed' },
      { paymentType: 'E' }, { category: 'V' }, { coordinationId: randomUUID() }, { createdBy: admin().id },
      { teacherId: otherTeacherId }, { documentId: doc.id }
    ]) {
      expectError(await request({ method: 'PATCH', url: `${base()}/contact`, payload: {
        operationId: randomUUID(), expectedVersion: version, phone: '9981234567', ...extra
      } }), 400, 'VALIDATION_ERROR');
    }
    for (const phone of ['123', '+1234567890123456', '9'.repeat(21)]) {
      expectError(await request({ method: 'PATCH', url: `${base()}/contact`, payload: {
        operationId: randomUUID(), expectedVersion: version, phone
      } }), 400, 'VALIDATION_ERROR');
    }
    for (const overrides of [{ teacherId: otherTeacherId }, { files: [] }, { documentType: 'CONSTANCIA_FISCAL' },
      { fileName: '../document.pdf' }, { fileName: 'C:\\document.pdf' }, { fileName: 'document.pdf\r\nInjected: yes' },
      { fileName: 'fake.exe' }, { title: '' }, { title: 'a'.repeat(181) }, { operationId: 'invalid' }]) {
      expectError(await request({ method: 'POST', url: `${base()}/documents`, payload: uploadBody(overrides) }), 400, 'VALIDATION_ERROR');
    }
    for (const endpoint of [
      { method: 'PATCH', url: `${base()}/documents/${doc.id}`, payload: { operationId: randomUUID(), expectedRevision: doc.revision, title: 'Title', documentType: 'OTRO', teacherId: otherTeacherId } },
      { method: 'PUT', url: `${base()}/documents/${doc.id}/content`, payload: replaceBody(doc.revision, { storageKey: 'forged' }) },
      { method: 'DELETE', url: `${base()}/documents/${doc.id}`, payload: { operationId: randomUUID(), expectedRevision: doc.revision, force: true } },
      { method: 'DELETE', url: `${base()}/documents/${doc.id}`, payload: { operationId: randomUUID(), expectedRevision: 0 } },
      { method: 'GET', url: '/teachers/not-a-uuid/dossier' }
    ] satisfies InjectOptions[]) expectError(await request(endpoint), 400, 'VALIDATION_ERROR');
    expect(await snapshot()).toEqual(before);
    expect(await row(doc.id)).toEqual(document);
    expect(await query('SELECT * FROM teacher_dossier_operations ORDER BY id')).toEqual(operations);
    expect(await auditRows()).toEqual(audits);
    expect(await readdir(root!)).toHaveLength(1);
  });

  it('rejects malformed base64, spoofed/truncated/encrypted PDFs and oversized payloads before persistence', async () => {
    const before = await snapshot();
    const audits = await auditRows();
    const encrypted = await makePdf('H24 encrypted synthetic document', { userPassword: 'synthetic-password' });
    const invalidInputs = [
      '!!!!', Buffer.from('Not a PDF').toString('base64'),
      Buffer.from('%PDF-1.7\nnot a valid document\n%%EOF\n').toString('base64'),
      pdf.subarray(0, Math.floor(pdf.length / 2)).toString('base64'), encrypted.toString('base64')
    ];
    for (const base64Data of invalidInputs) {
      expectError(await request({ method: 'POST', url: `${base()}/documents`, payload: uploadBody({ base64Data }) }), 422);
    }
    expectError(await request({ method: 'POST', url: `${base()}/documents`, payload: uploadBody({ mimeType: 'text/html' }) }), 415, 'UNSUPPORTED_MEDIA_TYPE');
    const oversize = Buffer.alloc(7.5 * 1024 * 1024 + 1, 65).toString('base64');
    expectError(await request({ method: 'POST', url: `${base()}/documents`, payload: uploadBody({ base64Data: oversize }) }), 413);
    expect(await query('SELECT id FROM teacher_dossier_documents')).toEqual([]);
    expect(await query('SELECT id FROM teacher_dossier_operations')).toEqual([]);
    expect(await snapshot()).toEqual(before);
    expect(await auditRows()).toEqual(audits);
    expect(await readdir(root!)).toEqual([]);
  });

  it.each(['process', 'reconcile'] as const)('returns 202 for failed delete, blocks bytes/writes, then recovers using %s', async (recovery) => {
    const { doc } = await upload();
    const original = await row(doc.id);
    const payload = { operationId: randomUUID(), expectedRevision: doc.revision };
    storage.failRemove = true;
    const pending = await request({ method: 'DELETE', url: `${base()}/documents/${doc.id}`, payload });
    expect(pending.statusCode, pending.body).toBe(202);
    expect(pending.json()).toMatchObject({ operationId: payload.operationId, documentId: doc.id, state: 'CLEANUP', errorCode: 'DOSSIER_RETRY_REQUIRED' });
    expect(pending.body).not.toContain(original.storage_key);
    expect(pending.body).not.toContain('H24 private storage diagnostic');
    expect(await operationRow(payload.operationId)).toMatchObject({ state: 'CLEANUP', old_key: original.storage_key, old_generation: original.storage_generation, attempts: 1 });
    expect((await row(doc.id)).state).toBe('DELETING');
    expect(await storage.local.stat(original.storage_key)).not.toBeNull();
    expectError(await request({ method: 'GET', url: `${base()}/documents/${doc.id}/content` }), 404, 'NOT_FOUND');
    expectError(await request({ method: 'PUT', url: `${base()}/documents/${doc.id}/content`, payload: replaceBody(doc.revision) }), 409, 'DOSSIER_CONFLICT');
    expectError(await request({ method: 'DELETE', url: `${base()}/documents/${doc.id}`, payload: { ...payload, operationId: randomUUID() } }), 409, 'DOSSIER_CONFLICT');
    const status = await request({ method: 'GET', url: `${base()}/operations/${payload.operationId}` });
    expect(status.statusCode).toBe(200);
    expect(status.json().state).toBe('CLEANUP');
    // Recreate both adapter and service: recovery cannot depend on in-memory operation state.
    const restarted = new Service(new LocalStorage(root!), `local:${root}`, validatePdf);
    if (recovery === 'process') expect(await restarted.process(payload.operationId)).toMatchObject({ state: 'COMPLETE' });
    else {
      expect(await restarted.reconcile()).toEqual([]);
      await query("UPDATE teacher_dossier_operations SET updated_at=now()-interval '10 minutes' WHERE id=$1", [payload.operationId]);
      expect(await restarted.reconcile()).toEqual([expect.objectContaining({ operationId: payload.operationId, state: 'COMPLETE' })]);
    }
    await expectPurgedOperation(payload.operationId);
    expect((await operationRow(payload.operationId)).attempts).toBe(2);
    expect(await query('SELECT id FROM teacher_dossier_documents WHERE id=$1', [doc.id])).toEqual([]);
    expect(await storage.local.stat(original.storage_key)).toBeNull();
    expect(await readdir(root!)).toEqual([]);
    const audits = await auditRows();
    const replay = await request({ method: 'DELETE', url: `${base()}/documents/${doc.id}`, payload });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().state).toBe('COMPLETE');
    expect(await auditRows()).toEqual(audits);
  });

  it('keeps a replacement pending until its previous object is physically removed', async () => {
    const { doc } = await upload();
    const original = await row(doc.id);
    storage.failRemove = true;
    const payload = replaceBody(doc.revision);
    const pending = await request({ method: 'PUT', url: `${base()}/documents/${doc.id}/content`, payload });
    expect(pending.statusCode, pending.body).toBe(202);
    expect(pending.json().state).toBe('CLEANUP');
    const current = await row(doc.id);
    expect(current).toMatchObject({ state: 'AVAILABLE', revision: doc.revision + 1 });
    expect(current.storage_key).not.toBe(original.storage_key);
    expect(await operationRow(payload.operationId)).toMatchObject({ state: 'CLEANUP', old_key: original.storage_key, new_key: current.storage_key });
    expect(await readdir(root!)).toHaveLength(2);
    expect((await request({ method: 'GET', url: `${base()}/documents/${doc.id}/content` })).rawPayload).toEqual(replacementPdf);
    expectError(await request({ method: 'DELETE', url: `${base()}/documents/${doc.id}`, payload: { operationId: randomUUID(), expectedRevision: current.revision } }), 409, 'DOSSIER_CONFLICT');
    storage.failRemove = false;
    expect(await service.process(payload.operationId)).toMatchObject({ state: 'COMPLETE' });
    expect(await storage.local.stat(original.storage_key)).toBeNull();
    expect(await storage.local.stat(current.storage_key)).not.toBeNull();
    expect(await readdir(root!)).toHaveLength(1);
    await expectPurgedOperation(payload.operationId);
  });

  it.each(['before', 'after'] as const)('reconciles an upload interrupted %s the real object write', async (failure) => {
    storage.failPut = failure;
    const payload = uploadBody();
    const response = await request({ method: 'POST', url: `${base()}/documents`, payload });
    expect(response.statusCode, response.body).toBe(202);
    expect(response.json().state).toBe('PREPARED');
    const pending = await operationRow(payload.operationId);
    expect(pending).toMatchObject({ state: 'PREPARED', error_code: 'DOSSIER_RETRY_REQUIRED', attempts: 1 });
    expect((await row(pending.document_id!)).state).toBe('UPLOADING');
    expectError(await request({ method: 'GET', url: `${base()}/documents/${pending.document_id}/content` }), 404, 'NOT_FOUND');
    expect(await storage.local.stat(pending.new_key!)).toEqual(failure === 'before' ? null : expect.objectContaining({ key: pending.new_key }));
    await query("UPDATE teacher_dossier_operations SET updated_at=now()-interval '10 minutes' WHERE id=$1", [payload.operationId]);
    const restarted = new Service(new LocalStorage(root!), `local:${root}`, validatePdf);
    const state = failure === 'before' ? 'FAILED' : 'COMPLETE';
    expect(await restarted.reconcile()).toEqual([expect.objectContaining({ operationId: payload.operationId, state })]);
    await expectPurgedOperation(payload.operationId, state);
    if (failure === 'before') {
      expect((await operationRow(payload.operationId)).error_code).toBe('UPLOAD_INTERRUPTED');
      expect((await dossier()).documents).toEqual([]);
      expect(await readdir(root!)).toEqual([]);
    } else {
      expect((await row(pending.document_id!)).state).toBe('AVAILABLE');
      expect((await request({ method: 'GET', url: `${base()}/documents/${pending.document_id}/content` })).rawPayload).toEqual(pdf);
      expect(await readdir(root!)).toHaveLength(1);
    }
  });

  it.each(['inactive', 'role', 'permission'] as const)('rechecks persisted actor %s revocation after storage write and before publication', async (revocation) => {
    const actor = financeActor();
    storage.afterPut = async () => {
      if (revocation === 'inactive') await query("UPDATE app_users SET status='INACTIVO' WHERE id=$1", [actor.id]);
      if (revocation === 'role') await query("UPDATE app_users SET role_id=(SELECT id FROM roles WHERE code='coordinador') WHERE id=$1", [actor.id]);
      if (revocation === 'permission') await query(`DELETE FROM role_permissions WHERE role_id=(SELECT role_id FROM app_users WHERE id=$1)
        AND permission_id=(SELECT id FROM permissions WHERE code='fiscal.document.manage')`, [actor.id]);
    };
    const payload = uploadBody();
    const response = await request({ method: 'POST', url: `${base()}/documents`, payload }, actor);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({ state: 'FAILED', errorCode: 'AUTHORIZATION_REVOKED' });
    await expectPurgedOperation(payload.operationId, 'FAILED');
    expect(await operationRow(payload.operationId)).toMatchObject({ actor_id: actor.id, error_code: 'AUTHORIZATION_REVOKED' });
    expect(await query('SELECT id FROM teacher_dossier_documents')).toEqual([]);
    expect(await readdir(root!)).toEqual([]);
    expect((await dossier()).documents).toEqual([]);
    expect(await query("SELECT id FROM audit_log WHERE action='TEACHER_DOSSIER_UPLOADED'")).toEqual([]);
  });

  it('recovers ABORTING cleanup after revocation during replacement, preserving the original PDF', async () => {
    const { doc } = await upload();
    const original = await row(doc.id);
    storage.failRemove = true;
    storage.afterPut = async () => { await query("UPDATE app_users SET status='INACTIVO' WHERE id=$1", [financeActor().id]); };
    const payload = replaceBody(doc.revision);
    const response = await request({ method: 'PUT', url: `${base()}/documents/${doc.id}/content`, payload }, financeActor());
    expect(response.statusCode, response.body).toBe(202);
    expect(response.json().state).toBe('ABORTING');
    const pending = await operationRow(payload.operationId);
    expect(pending.state).toBe('ABORTING');
    expect(pending.new_key).not.toBe(original.storage_key);
    expect((await row(doc.id)).state).toBe('REPLACING');
    expect((await request({ method: 'GET', url: `${base()}/documents/${doc.id}/content` })).rawPayload).toEqual(pdf);
    expect(await readdir(root!)).toHaveLength(2);
    await query("UPDATE teacher_dossier_operations SET updated_at=now()-interval '10 minutes' WHERE id=$1", [payload.operationId]);
    const restarted = new Service(new LocalStorage(root!), `local:${root}`, validatePdf);
    expect(await restarted.reconcile()).toEqual([expect.objectContaining({ operationId: payload.operationId, state: 'FAILED' })]);
    await expectPurgedOperation(payload.operationId, 'FAILED');
    expect(await storage.local.stat(pending.new_key!)).toBeNull();
    expect(await row(doc.id)).toEqual(original);
    expect(await readdir(root!)).toHaveLength(1);
  });

  it('enforces the teacher FK and full-app deletion guard until document cleanup completes', async () => {
    const isolatedTeacherId = randomUUID();
    await query(`INSERT INTO teachers (id,full_name,normalized_name,created_by,updated_by)
      VALUES ($1,'H24 Synthetic Isolated Teacher',$2,$3,$3)`, [isolatedTeacherId, `h24-${isolatedTeacherId}`, admin().id]);
    const { doc } = await upload(admin(), isolatedTeacherId);
    await expect(query('DELETE FROM teachers WHERE id=$1', [isolatedTeacherId])).rejects.toMatchObject({
      code: expect.stringMatching(/^(23001|23503)$/),
      constraint: 'teacher_dossier_documents_teacher_id_fkey'
    });
    // This second app is for the existing teacher deletion guard only; no second DB reset.
    const fullApp = await buildTestApp();
    try {
      const endpoint = { method: 'DELETE', url: `/api/teachers/${isolatedTeacherId}` } as const;
      expectError(await injectAs(fullApp, adminActor(), endpoint), 409, 'DOSSIER_NOT_EMPTY');
      storage.failRemove = true;
      const deletion = { operationId: randomUUID(), expectedRevision: doc.revision };
      expect((await request({ method: 'DELETE', url: `${base(isolatedTeacherId)}/documents/${doc.id}`, payload: deletion })).statusCode).toBe(202);
      expectError(await injectAs(fullApp, adminActor(), endpoint), 409, 'DOSSIER_NOT_EMPTY');
      expect(await query('SELECT id FROM teachers WHERE id=$1', [isolatedTeacherId])).toHaveLength(1);
      storage.failRemove = false;
      expect(await service.process(deletion.operationId)).toMatchObject({ state: 'COMPLETE' });
      const deleted = await injectAs(fullApp, adminActor(), endpoint);
      expect(deleted.statusCode, deleted.body).toBe(200);
      expect(await query('SELECT id FROM teachers WHERE id=$1', [isolatedTeacherId])).toEqual([]);
      expect((await operationRow(deletion.operationId)).teacher_id).toBeNull();
      expect(await readdir(root!)).toEqual([]);
    } finally {
      await fullApp.close();
    }
  });

  it('normalizes uppercase UUID parameters and operation IDs before persistence and retry hashing', async () => {
    const payload = uploadBody({ operationId: randomUUID().toUpperCase() });
    const created = await request({ method: 'POST', url: `${base(teacherId.toUpperCase())}/documents`, payload });
    expect(created.statusCode, created.body).toBe(200);
    const uploaded = created.json<OperationResult>();
    expect(uploaded).toMatchObject({ operationId: payload.operationId.toLowerCase(), state: 'COMPLETE', errorCode: null });
    const doc = await row(uploaded.documentId!);
    expect(doc.storage_key).toBe(`${teacherId}/${doc.id}/${payload.operationId.toLowerCase()}`);
    const auditsBeforeUploadRetry = await auditRows();
    const uploadRetry = await request({ method: 'POST', url: `${base()}/documents`, payload: {
      ...payload, operationId: payload.operationId.toLowerCase()
    } });
    expect(uploadRetry.statusCode, uploadRetry.body).toBe(200);
    expect(uploadRetry.json()).toEqual(uploaded);
    expect(await auditRows()).toEqual(auditsBeforeUploadRetry);

    const replacement = replaceBody(doc.revision, { operationId: randomUUID().toUpperCase() });
    const replaced = await request({ method: 'PUT', url: `${base()}/documents/${doc.id.toUpperCase()}/content`, payload: replacement });
    expect(replaced.statusCode, replaced.body).toBe(200);
    expect(replaced.json()).toMatchObject({ operationId: replacement.operationId.toLowerCase(), documentId: doc.id, state: 'COMPLETE' });
    const current = await row(doc.id);
    expect(current.storage_key).toBe(`${teacherId}/${doc.id}/${replacement.operationId.toLowerCase()}`);
    expect(current.revision).toBe(doc.revision + 1);
    expect(await storage.local.stat(doc.storage_key)).toBeNull();
    const auditsBeforeReplacementRetry = await auditRows();
    const replacementRetry = await request({ method: 'PUT', url: `${base()}/documents/${doc.id}/content`, payload: {
      ...replacement, operationId: replacement.operationId.toLowerCase()
    } });
    expect(replacementRetry.statusCode, replacementRetry.body).toBe(200);
    expect(replacementRetry.json()).toEqual(replaced.json());
    expect(await row(doc.id)).toEqual(current);
    expect(await auditRows()).toEqual(auditsBeforeReplacementRetry);
    const status = await request({ method: 'GET', url: `${base()}/operations/${replacement.operationId}` });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual(replaced.json());
    const content = await request({ method: 'GET', url: `${base()}/documents/${doc.id.toUpperCase()}/content` });
    expect(content.statusCode).toBe(200);
    expect(content.rawPayload).toEqual(replacementPdf);
    expect(await query('SELECT id FROM teacher_dossier_operations')).toHaveLength(2);
    expect(await query('SELECT id FROM teacher_dossier_documents')).toHaveLength(1);
    expect(await readdir(root!)).toHaveLength(1);
  });

  it.each(['storage', 'validator'] as const)('returns stored completed upload/replace/delete results when %s is unavailable', async (unavailable) => {
    const uploaded = await upload();
    const replacement = replaceBody(uploaded.doc.revision);
    const replaced = await request({ method: 'PUT', url: `${base()}/documents/${uploaded.doc.id}/content`, payload: replacement });
    expect(replaced.statusCode, replaced.body).toBe(200);
    expect(replaced.json().state).toBe('COMPLETE');
    const deletion = { operationId: randomUUID(), expectedRevision: replaced.json<OperationResult>().result.revision! };
    const removed = await request({ method: 'DELETE', url: `${base()}/documents/${uploaded.doc.id}`, payload: deletion });
    expect(removed.statusCode, removed.body).toBe(200);
    expect(removed.json().state).toBe('COMPLETE');
    const before = await snapshot();
    const audits = await auditRows();
    const operations = await query('SELECT * FROM teacher_dossier_operations ORDER BY id');
    expect(await readdir(root!)).toEqual([]);

    const { DossierStorageError } = await import('../lib/dossier-storage.js');
    const retryStorage = new FaultStorage(new LocalStorage(root!));
    const safetyCheck = vi.spyOn(retryStorage, 'assertSafe');
    if (unavailable === 'storage') safetyCheck.mockRejectedValue(new DossierStorageError('DOSSIER_STORAGE_UNAVAILABLE'));
    const retryValidator = vi.fn(async (bytes: Buffer) => {
      if (unavailable === 'validator') throw new DossierStorageError('DOSSIER_PDF_VALIDATOR_UNAVAILABLE');
      await validatePdf(bytes);
    });
    const retryService = new Service(retryStorage, `local:${root}`, retryValidator);
    const retryApp = Fastify({ logger: false, bodyLimit: 12 * 1024 * 1024 });
    try {
      const { registerDossierRoutes } = await import('../routes/teacher-dossier.js');
      await registerDossierRoutes(retryApp, retryService);
      const retries: { options: InjectOptions; expected: OperationResult }[] = [
        { options: { method: 'POST', url: `${base()}/documents`, payload: uploaded.payload }, expected: uploaded.operation },
        { options: { method: 'PUT', url: `${base()}/documents/${uploaded.doc.id}/content`, payload: replacement }, expected: replaced.json<OperationResult>() },
        { options: { method: 'DELETE', url: `${base()}/documents/${uploaded.doc.id}`, payload: deletion }, expected: removed.json<OperationResult>() }
      ];
      for (const { options, expected } of retries) {
        const response = await injectAs(retryApp, admin(), options);
        expect(response.statusCode, response.body).toBe(200);
        expect(response.json()).toEqual(expected);
      }
      expect(safetyCheck).not.toHaveBeenCalled();
      expect(retryValidator).not.toHaveBeenCalled();
      expect(await query('SELECT * FROM teacher_dossier_operations ORDER BY id')).toEqual(operations);
      expect(await query('SELECT id FROM teacher_dossier_documents')).toEqual([]);
      expect(await snapshot()).toEqual(before);
      expect(await auditRows()).toEqual(audits);
      expect(await readdir(root!)).toEqual([]);
    } finally {
      await retryApp.close();
      safetyCheck.mockRestore();
    }
  });

  it('serializes concurrent identical uploads and conflicting document revisions', async () => {
    const payload = uploadBody();
    const replies = await Promise.all([1, 2].map(() => request({ method: 'POST', url: `${base()}/documents`, payload })));
    for (const reply of replies) expect([200, 202], reply.body).toContain(reply.statusCode);
    const replay = await request({ method: 'POST', url: `${base()}/documents`, payload });
    expect(replay.json().state).toBe('COMPLETE');
    const documents = (await dossier()).documents;
    expect(documents).toHaveLength(1);
    expect((await readdir(root!)).filter((name) => name.endsWith('.pdf'))).toHaveLength(1);
    expect(await query('SELECT id FROM teacher_dossier_operations')).toHaveLength(1);

    const doc = documents[0];
    const replacements = await Promise.all([1, 2].map(() => request({ method: 'PUT',
      url: `${base()}/documents/${doc.id}/content`, payload: replaceBody(doc.revision) })));
    expect(replacements.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await dossier()).documents[0].revision).toBe(doc.revision + 1);
    expect((await readdir(root!)).filter((name) => name.endsWith('.pdf'))).toHaveLength(1);
  });

  it('stores formatted phone numbers canonically and rejects letters without changing rows or audit', async () => {
    for (const [formatted, canonical] of [
      ['+52 (998) 123-4567', '+529981234567'],
      ['(998) 765-4321', '9987654321'],
      ['998.123.4567', '9981234567']
    ]) {
      const payload = { operationId: randomUUID(), expectedVersion: (await dossier()).teacher.version, phone: formatted };
      const response = await request({ method: 'PATCH', url: `${base()}/contact`, payload }, rhActor());
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().state).toBe('COMPLETE');
      expect((await dossier()).teacher.phone).toBe(canonical);
      expect(await query('SELECT phone FROM teachers WHERE id=$1', [teacherId])).toEqual([{ phone: canonical }]);
      const audits = await auditRows();
      const state = await snapshot();
      const retry = await request({ method: 'PATCH', url: `${base()}/contact`, payload: { ...payload, phone: canonical } }, rhActor());
      expect(retry.statusCode, retry.body).toBe(200);
      expect(retry.json()).toEqual(response.json());
      expect(await auditRows()).toEqual(audits);
      expect(await snapshot()).toEqual(state);
    }
    const before = await snapshot();
    const audits = await auditRows();
    const operations = await query('SELECT * FROM teacher_dossier_operations ORDER BY id');
    const expectedVersion = (await dossier()).teacher.version;
    for (const phone of ['abc', '998abc1234567', '+52 (998) ABC-4567', '9981234567 ext 12']) {
      expectError(await request({ method: 'PATCH', url: `${base()}/contact`, payload: {
        operationId: randomUUID(), expectedVersion, phone
      } }, rhActor()), 400, 'VALIDATION_ERROR');
    }
    expect(await snapshot()).toEqual(before);
    expect(await auditRows()).toEqual(audits);
    expect(await query('SELECT * FROM teacher_dossier_operations ORDER BY id')).toEqual(operations);
  });
});
