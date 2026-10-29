// Test job only. Never an entrypoint for the production recovery worker.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
const exec = promisify(execFile);
const project = 'nomina-h24-test-20261027';
const bucket = 'nomina-h24-test-234692275301-dossier';
const certificates = 'nomina-h24-test-234692275301-constancias';
const pg = '/usr/lib/postgresql/15/bin';
const event = (name, data = {}) => console.log(JSON.stringify({ event: name, severity: 'INFO', ...data }));
let directory, database, storage, certificateStorage, started = false;
const keys = new Set(), certificateKeys = new Set();
let failure, phase = 'guard';
try {
  assert.equal(process.env.CLOUD_RUN_JOB, 'h24-recovery-rehearsal');
  assert.equal(process.env.H24_ALLOW_EPHEMERAL_REHEARSAL, 'true');
  const response = await fetch('http://metadata.google.internal/computeMetadata/v1/project/project-id', {
    headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000), redirect: 'error' });
  assert.equal(response.status, 200); assert.equal(await response.text(), project);
  Object.assign(process.env, { NODE_ENV: 'test', GCP_PROJECT_ID: project, FIREBASE_PROJECT_ID: project,
    DB_HOST: '127.0.0.1', DB_PORT: '55441', DB_NAME: 'nomina_docente_test', DB_USER: 'postgres',
    DOSSIER_STORAGE_MODE: 'gcs', DOSSIER_BUCKET: bucket, CONSTANCIAS_BUCKET: certificates,
    DOCUMENT_SECURITY_MODE: 'cloud-run',
    DOCUMENT_SECURITY_PARSER_URL: 'https://h24-document-inspector-234692275301.us-central1.run.app',
    DOCUMENT_SECURITY_SCANNER_URL: 'https://h24-document-scanner-234692275301.us-central1.run.app' });
  delete process.env.DB_PASSWORD; delete process.env.INSTANCE_CONNECTION_NAME; delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  phase = 'postgres_start';
  directory = await mkdtemp('/tmp/h24-ephemeral-');
  await exec(`${pg}/initdb`, ['-D', `${directory}/pg`, '-A', 'trust', '--no-locale', '-E', 'UTF8'], { timeout: 30000 });
  await exec(`${pg}/pg_ctl`, ['-D', `${directory}/pg`, '-l', `${directory}/pg.log`, '-o',
    `-p 55441 -h 127.0.0.1 -k ${directory} -c shared_buffers=32MB -c max_connections=30`, '-w', 'start'], { timeout: 30000 });
  started = true;
  await exec(`${pg}/createdb`, ['-h', '127.0.0.1', '-p', '55441', '-U', 'postgres', 'nomina_docente_test'], { timeout: 10000 });
  phase = 'fixture_schema';
  database = await import('../../apps/api/dist/db.js');
  const { query, withTransaction } = database;
  assert.equal((await query('SELECT current_database() AS name'))[0].name, 'nomina_docente_test');
  // Minimal synthetic prerequisite schema; not a reset, copy or H05 migration of any existing database.
  await query(`CREATE TABLE roles(id uuid PRIMARY KEY,code text);
    CREATE TABLE app_users(id uuid PRIMARY KEY,role_id uuid REFERENCES roles(id),status text,is_protected_super_admin boolean DEFAULT false);
    CREATE TABLE permissions(id uuid PRIMARY KEY,code text);
    CREATE TABLE role_permissions(role_id uuid,permission_id uuid);
    CREATE TABLE teachers(id uuid PRIMARY KEY,full_name text,phone text,updated_at timestamptz DEFAULT now());
    CREATE TABLE audit_log(id uuid DEFAULT gen_random_uuid(),actor_user_id uuid,action text,entity_type text,entity_id uuid,metadata jsonb);
    CREATE TABLE teacher_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),teacher_id uuid REFERENCES teachers(id),
      document_type text NOT NULL DEFAULT 'CONSTANCIA_FISCAL',storage_bucket text NOT NULL,storage_object text NOT NULL,
      original_file_name text DEFAULT '',mime_type text DEFAULT '',uploaded_at timestamptz DEFAULT now(),uploaded_by uuid,is_current boolean DEFAULT true);
    CREATE UNIQUE INDEX only_current ON teacher_documents(teacher_id,document_type) WHERE is_current;`);
  await query(await readFile('/app/database/016_h24_teacher_dossier.sql', 'utf8'));
  const roleId = randomUUID(), actorId = randomUUID(), teacherId = randomUUID();
  await query("INSERT INTO roles VALUES($1,'admin')", [roleId]);
  await query("INSERT INTO app_users VALUES($1,$2,'ACTIVO',false)", [actorId, roleId]);
  await query("INSERT INTO teachers(id,full_name) VALUES($1,'Synthetic H24 ephemeral')", [teacherId]);
  const actor = { id: actorId, role: 'admin', status: 'ACTIVO', permissions: [] };
  const { GoogleDossierStorage } = await import('../../apps/api/dist/lib/dossier-storage.js');
  const { TeacherDossierService } = await import('../../apps/api/dist/lib/teacher-dossier.js');
  const { validateDocumentContent } = await import('../../apps/api/dist/lib/document-security.js');
  const { constanciaStorage } = await import('../../apps/api/dist/lib/constancia-storage.js');
  const { replaceConstancia } = await import('../../apps/api/dist/lib/constancia-replacement.js');
  storage = new GoogleDossierStorage(bucket); certificateStorage = constanciaStorage(certificates);
  await storage.assertSafe(); await certificateStorage.assertSafe();
  const bytes = await new Promise(resolve => { const d = new PDFDocument(); const chunks = [];
    d.on('data', b => chunks.push(b)); d.on('end', () => resolve(Buffer.concat(chunks)));
    d.text('Synthetic H24 recovery. No personal data.'); d.end(); });
  const validate = b => validateDocumentContent(b, 'application/pdf');
  let cutPut = true, cutDelete = false;
  const wrapped = { assertSafe: () => storage.assertSafe(), stat: key => storage.stat(key), read: o => storage.read(o),
    put: async (key, content) => { keys.add(key); event('h24_synthetic_object_manifest', { bucket, key, synthetic: true });
      const value = await storage.put(key, content); if (cutPut) throw Error('SYNTHETIC_INTERRUPTION'); return value; },
    remove: async o => { if (cutDelete) throw Error('SYNTHETIC_DELETE_INTERRUPTION'); return storage.remove(o); } };
  const service = new TeacherDossierService(wrapped, `gcs:${bucket}`, validate);
  phase = 'upload';
  const operation = await service.upload(actor, teacherId, { operationId: randomUUID(), documentType: 'OTRO',
    title: 'Synthetic', fileName: 'synthetic.pdf', mimeType: 'application/pdf', base64Data: bytes.toString('base64') });
  assert.equal(operation.state, 'PREPARED');
  event('h24_recovery_interruption_prepared'); cutPut = false;
  async function worker() {
    const result = await exec(process.execPath, ['/app/apps/api/dist/dossier-reconcile.js'], { env: process.env, timeout: 300000, maxBuffer: 16384 });
    assert.equal(result.stderr, '');
    const summary = JSON.parse(result.stdout.trim()); assert.equal(summary.exitCode, 0);
    event('h24_recovery_worker', summary); return summary;
  }
  await query("UPDATE teacher_dossier_operations SET updated_at=now()-interval '6 minutes' WHERE id=$1", [operation.operationId]);
  phase = 'worker_upload';
  assert.equal((await worker()).complete, 1);
  assert.equal((await service.operation(actor, teacherId, operation.operationId)).state, 'COMPLETE');
  assert.deepEqual((await service.content(actor, teacherId, operation.documentId)).bytes, bytes);
  assert.equal((await worker()).processed, 0);
  event('h24_recovery_upload_read_idempotence_ok');
  phase = 'worker_delete';
  const document = (await service.get(actor, teacherId)).documents[0]; cutDelete = true;
  const deletion = await service.remove(actor, teacherId, document.id, { operationId: randomUUID(), expectedRevision: document.revision });
  assert.equal(deletion.state, 'CLEANUP'); cutDelete = false;
  await query("UPDATE teacher_dossier_operations SET updated_at=now()-interval '6 minutes' WHERE id=$1", [deletion.operationId]);
  assert.equal((await worker()).complete, 1);
  assert.equal((await service.get(actor, teacherId)).documents.length, 0);
  event('h24_recovery_delete_ok');
  let cutCertificateDelete = false;
  const certWrapper = { assertSafe: () => certificateStorage.assertSafe(),
    put: async (object, content, mime) => { certificateKeys.add(object.key);
      event('h24_synthetic_object_manifest', { bucket: certificates, key: object.key, synthetic: true });
      return certificateStorage.put(object, content, mime); },
    remove: async object => { if (cutCertificateDelete) throw Error('SYNTHETIC_DELETE_INTERRUPTION'); return certificateStorage.remove(object); } };
  const certOptions = { transaction: withTransaction, storage: certWrapper, bucket: certificates, teacherId, actorId,
    fileName: 'synthetic.pdf', mimeType: 'application/pdf', bytes, authorize: async () => {}, afterSwitch: async () => ({}) };
  phase = 'worker_certificates';
  await replaceConstancia(certOptions); cutCertificateDelete = true;
  assert.equal((await replaceConstancia(certOptions)).cleanupPending, true); cutCertificateDelete = false;
  assert.equal((await worker()).constancias.deleted, 1);
  assert.equal((await query('SELECT count(*)::int AS n FROM teacher_documents WHERE is_current'))[0].n, 1);
  event('h24_recovery_certificate_replace_ok');
  if (process.env.H24_TEST_ALERT === 'true') {
    console.error(JSON.stringify({ event: 'h24_recovery_test_alert', severity: 'ERROR', synthetic: true }));
  }
} catch (error) {
  failure = true;
  console.error(JSON.stringify({ event: 'h24_recovery_rehearsal_failed', severity: 'ERROR',
    reason: error?.code === 'ERR_ASSERTION' ? 'ASSERTION' : 'DEPENDENCY', phase, synthetic: true }));
} finally {
  try {
    for (const key of keys) { const object = await storage.stat(key); if (object) await storage.remove(object); assert.equal(await storage.stat(key), null); }
    for (const key of certificateKeys) await certificateStorage.remove({ bucket: certificates, key });
    event('h24_recovery_objects_cleanup_ok', { objects: keys.size + certificateKeys.size });
  } catch { failure = true; console.error(JSON.stringify({ event: 'h24_recovery_cleanup_failed', severity: 'ERROR', synthetic: true })); }
  try {
    if (database) await database.closeDatabase();
    if (started) await exec(`${pg}/pg_ctl`, ['-D', `${directory}/pg`, '-m', 'fast', '-w', 'stop'], { timeout: 15000 });
    if (directory) await rm(directory, { recursive: true, force: true });
    event('h24_recovery_database_cleanup_ok', { ephemeralDatabaseRemoved: true });
  } catch { failure = true; console.error(JSON.stringify({ event: 'h24_recovery_database_cleanup_failed', severity: 'ERROR', synthetic: true })); }
  process.exitCode = failure ? 1 : 0;
}
