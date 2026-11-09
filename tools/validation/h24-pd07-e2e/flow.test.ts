import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import PDFDocument from 'pdfkit';
import { beforeAll, afterAll, it, vi } from 'vitest';
import { buildApp } from '../../../apps/api/src/app.js';
import { query, pool, withTransaction } from '../../../apps/api/src/db.js';
import { createDocumentValidator } from '../../../apps/api/src/lib/document-analyzers-legacy.js';
import { createCloudDocumentRunner } from '../../../apps/api/src/lib/document-cloud.js';
import { TeacherDossierService } from '../../../apps/api/src/lib/teacher-dossier.js';
import { LocalDossierStorage } from '../../../apps/api/src/lib/dossier-storage.js';
import { reconcileConstancias } from '../../../apps/api/src/lib/constancia-replacement.js';
import { adminActor, financeActor, rhActor, coordinatorActor, directionActor } from '../../../apps/api/src/test/fixtures/actors.js';
import { authHeaderForTestActor } from '../../../apps/api/src/test/auth-test-utils.js';

// Test-only boundaries: real SQL/HTTP/files, no Firebase/IAM/GCS credentials.
const boundary = vi.hoisted(() => ({ validate: null as any, constancia: null as any, read: null as any, service: null as any }));
vi.mock('../../../apps/api/src/lib/document-security.js', async original => ({ ...await original<object>(), validateDocumentContent: (...args: any[]) => boundary.validate(...args) }));
vi.mock('../../../apps/api/src/lib/constancia-storage.js', async original => ({ ...await original<object>(), constanciaStorage: () => boundary.constancia }));
vi.mock('../../../apps/api/src/lib/dossier-runtime.js', () => ({ createDossierService: () => boundary.service }));
vi.mock('../../../apps/api/src/firebase.js', () => ({
  firebaseAdmin: { storage: () => ({ bucket: () => ({
    file: (key: string) => ({ download: async () => [await boundary.read(key)] })
  }) }) }
}));

const report: any = { cases: [], requests: [], scans: [], analyzerRequests: [], corpus: [], boundaries: ['synthetic test actors', 'local files not GCS', 'synthetic identity to loopback analyzers', 'local proxy not Hosting'], passed: false };
const hash = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
let root: string, additional: LocalDossierStorage, app: Awaited<ReturnType<typeof buildApp>>, service: TeacherDossierService;
let teachers: string[], tokens: string[], before: any, proxy: http.Server;
let failDelete = false, failPut = false, delay = 0, unavailable = false;
let requestCount = 0, sends = 0, scans = 0, peak = 0;
let monitor: ReturnType<typeof setInterval>;
const files = new Map<string, Buffer>();
const base = (actor = 0) => `/api/teachers/${teachers[actor % 2]}`;
const wait = (n: number) => new Promise(r => setTimeout(r, n));
const start = Date.now();
const followup = process.env.H24_PD07_FOLLOWUP === 'true';
// Reserve two POSTs for the incomplete-body probes outside request().
const sendBudget = followup ? 43 : 58;
async function fingerprint() {
  const tables = (await query<{ tablename: string }>("select tablename from pg_tables where schemaname='public' order by tablename"))
    .map(t => t.tablename).filter(t => !['teacher_documents', 'teacher_dossier_documents', 'teacher_dossier_operations', 'audit_log'].includes(t));
  const result: any = {};
  for (const t of tables) {
    assert.match(t, /^[a-z_]+$/);
    const rows = await query(`select to_jsonb(t) j from "${t}" t order by to_jsonb(t)::text`);
    result[t] = { count: rows.length, sha256: hash(JSON.stringify(rows)) };
  }
  return result;
}
async function makePdf(pages = 1, padding = 0): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ compress: false, autoFirstPage: false }); const parts: Buffer[] = [];
    doc.on('data', b => parts.push(b)); doc.on('error', reject); doc.on('end', () => resolve(Buffer.concat(parts)));
    for (let n = 0; n < pages; n++) doc.addPage().text(`H24 PD07 SYNTHETIC ${n}`);
    if (padding) { const r = doc.ref({}); r.end(Buffer.alloc(padding, 32)); }
    doc.end();
  });
}
async function sized(size: number) {
  let padding = size - 1400;
  for (let n = 0; n < 5; n++) { const b = await makePdf(1, padding); if (b.length === size) return b; padding += size - b.length; }
  throw Error('Cannot generate exact size');
}
async function request(method: string, url: string, payload?: any, actor = 0, port = 58083) {
  assert(++requestCount <= 1500); if (['POST', 'PUT'].includes(method)) assert(++sends <= sendBudget);
  assert(Date.now() - start < 120 * 60_000);
  await writeFile('/evidence/counters.json', JSON.stringify({ requestCount, sends, scans, sendBudget }));
  const t = Date.now();
  const response = await fetch(`http://127.0.0.1:${port}${url}`, { method,
    headers: { ...(actor < 0 ? {} : { authorization: tokens[actor] }), 'content-type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(290000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  const result = { status: response.status, bytes, ms: Date.now() - t, json: () => JSON.parse(bytes.toString()) };
  report.requests.push({ method, path: url, actor, status: result.status, ms: result.ms, code: response.headers.get('content-type')?.includes('json') ? result.json().error : undefined });
  return result;
}
const payload = (bytes: Buffer, extra = true, mime = 'application/pdf') => ({ ...(extra ? { operationId: randomUUID(), documentType: 'OTRO', title: 'Synthetic' } : {}),
  fileName: mime === 'image/png' ? 'synthetic.png' : mime === 'image/jpeg' ? 'synthetic.jpg' : 'synthetic.pdf', mimeType: mime, base64Data: bytes.toString('base64') });
const replacement = (bytes: Buffer, revision: number) => ({ ...payload(bytes, false), operationId: randomUUID(), expectedRevision: revision });
async function upload(bytes: Buffer, actor = 0) {
  const p = payload(bytes); const r = await request('POST', `${base(actor)}/dossier/documents`, p, actor);
  assert.equal(r.status, 200, r.bytes.toString().slice(0, 200)); assert.equal(r.json().state, 'COMPLETE'); return r.json();
}
async function remove(op: any, actor = 0) {
  const r = await request('DELETE', `${base(actor)}/dossier/documents/${op.documentId}`, { operationId: randomUUID(), expectedRevision: op.result.revision }, actor);
  assert.equal(r.status, 200); assert.equal(r.json().state, 'COMPLETE');
}
async function record(name: string, action: () => Promise<any>) {
  const t = Date.now();
  try { const details = await action(); report.cases.push({ name, passed: true, ms: Date.now() - t, details }); }
  catch (e) { report.cases.push({ name, passed: false, ms: Date.now() - t, error: String(e) }); throw e; }
  finally { await writeFile('/evidence/flow-progress.json', JSON.stringify(report, null, 2)); }
}

beforeAll(async () => {
  assert.equal(process.env.H24_PD07_E2E, 'approved-local'); assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.DB_NAME, 'nomina_docente_test'); assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.FIREBASE_PROJECT_ID, 'demo-h24-pd07');
  assert(!process.env.INSTANCE_CONNECTION_NAME && !process.env.GOOGLE_APPLICATION_CREDENTIALS);
  assert.equal((await query<{ n: string }>('select current_database() n'))[0].n, 'nomina_docente_test');
  root = await mkdtemp('/tmp/pd07-e2e-'); await mkdir(path.join(root, 'additional'), { mode: 0o700 }); await mkdir(path.join(root, 'constancia'), { mode: 0o700 });
  additional = new LocalDossierStorage(path.join(root, 'additional'));
  const measuredFetch: typeof fetch = async (url, options) => {
    const address = new URL(String(url));
    assert.equal(address.hostname, '127.0.0.1'); assert(['58081', '58082'].includes(address.port));
    const entry = { service: address.port === '58081' ? 'inspector' : 'scanner', kind: address.pathname.split('/').at(-1), status: 0, ms: 0 };
    report.analyzerRequests.push(entry); const began = Date.now();
    try { const response = await fetch(url, options); entry.status = response.status; return response; }
    finally { entry.ms = Date.now() - began; }
  };
  const raw = createCloudDocumentRunner({ parser: 'http://127.0.0.1:58081', scanner: 'http://127.0.0.1:58082' }, async () => 'synthetic-no-cloud-token', measuredFetch);
  const real = createDocumentValidator(async (kind, bytes) => {
    if (kind === 'av') assert(++scans <= 300);
    const t = Date.now(); const r = await raw(kind, bytes); report.scans.push({ kind, code: r.code, ms: Date.now() - t, bytes: bytes.length }); return r;
  });
  boundary.validate = async (b: Buffer, mime: string) => {
    if (unavailable) throw new (await import('../../../apps/api/src/lib/document-security.js')).DocumentSecurityError('DOCUMENT_SECURITY_UNAVAILABLE');
    if (delay) await wait(delay); return real(b, mime);
  };
  const storage = { assertSafe: () => additional.assertSafe(), stat: (k: string) => additional.stat(k), read: (o: any) => additional.read(o),
    put: (k: string, b: Buffer) => { if (failPut) throw Error('synthetic put failure'); return additional.put(k, b); },
    remove: (o: any) => { if (failDelete) throw Error('synthetic delete failure'); return additional.remove(o); } };
  service = new TeacherDossierService(storage, 'pd07-e2e-local', b => boundary.validate(b, 'application/pdf')); boundary.service = service;
  const filename = (key: string) => { assert.match(key, /^constancias\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/); return path.join(root, 'constancia', hash(key)); };
  boundary.constancia = { assertSafe: async () => {}, put: async (o: any, bytes: Buffer) => { if (failPut) throw Error('synthetic put failure'); await writeFile(filename(o.key), bytes, { flag: 'wx', mode: 0o600 }); },
    remove: async (o: any) => { if (failDelete) throw Error('synthetic delete failure'); await rm(filename(o.key), { force: true }); } };
  boundary.read = (key: string) => readFile(filename(key));
  teachers = (await query<{ id: string }>('select id from teachers order by id limit 2')).map(r => r.id); assert.equal(teachers.length, 2);
  tokens = [adminActor(), financeActor(), rhActor(), coordinatorActor(), directionActor()].map(authHeaderForTestActor);
  before = await fingerprint();
  app = await buildApp(); app.log.level = 'silent'; await app.listen({ host: '127.0.0.1', port: 58083 });
  for (const [name, bytes] of [['small', await makePdf()], ['1MiB', await sized(1048576)], ['4MiB', await sized(4194304)], ['7.5MiB', await sized(7864320)], ['500pages', await makePdf(500)]] as const) {
    files.set(name, bytes); report.corpus.push({ name, bytes: bytes.length, sha256: hash(bytes) });
  }
  monitor = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 250);
  await writeFile('/evidence/fingerprints-before.json', JSON.stringify(before, null, 2));
  if (followup) assert.equal((await request('POST', `${base()}/documents/constancia`, payload(files.get('small')!, false))).status, 200);
});

it.skipIf(followup)('role gates and serial PDF sizes through both real SQL flows', async () => record('serial-and-roles', async () => {
  for (const actor of [-1, 3, 4]) {
    const r = await request('POST', `${base()}/dossier/documents`, payload(files.get('small')!), actor); assert.equal(r.status, actor < 0 ? 401 : 403);
  }
  for (const actor of [0, 1, 2]) assert.equal((await request('GET', `${base()}/dossier`, undefined, actor)).status, 200);
  for (const name of ['small', '1MiB', '4MiB', '7.5MiB']) {
    const bytes = files.get(name)!; const op = await upload(bytes);
    const read = await request('GET', `${base()}/dossier/documents/${op.documentId}/content`); assert.equal(read.status, 200); assert.equal(hash(read.bytes), hash(bytes)); await remove(op);
    const cr = await request('POST', `${base()}/documents/constancia`, payload(bytes, false)); assert.equal(cr.status, 200, cr.bytes.toString());
    const current = await request('GET', `${base()}/documents/current`); assert.equal(current.status, 200); assert.equal(hash(current.bytes), hash(bytes));
  }
  const tooBig = Buffer.concat([files.get('7.5MiB')!, Buffer.from('x')]);
  for (const [url, extra] of [[`${base()}/documents/constancia`, false], [`${base()}/dossier/documents`, true]] as const) {
    const r = await request('POST', url, payload(tooBig, extra)); assert.equal(r.status, extra ? 413 : 400, r.bytes.toString());
  }
}));

it('B03 rejected replacements preserve files and database publication', async () => record('b03-preservation', async () => {
  const op = await upload(files.get('small')!); const prior = await query('select * from teacher_documents order by id');
  const rejected = await request('PUT', `${base()}/dossier/documents/${op.documentId}/content`, replacement(files.get('500pages')!, op.result.revision));
  assert.equal(rejected.status, 422); assert.equal(rejected.json().error, 'DOCUMENT_SCAN_LIMIT_EXCEEDED');
  const cr = await request('POST', `${base()}/documents/constancia`, payload(files.get('500pages')!, false));
  assert.equal(cr.status, 422); assert.equal(cr.json().error, 'DOCUMENT_SCAN_LIMIT_EXCEEDED');
  assert.deepEqual(await query('select * from teacher_documents order by id'), prior);
  assert.equal(hash((await request('GET', `${base()}/dossier/documents/${op.documentId}/content`)).bytes), hash(files.get('small')!));
  await remove(op);
}));

async function runBatch() { return record('bounded-batches', async () => {
  const outcomes: any[] = [];
  // B04: one in-flight file per panel; independent clients refill their own slot.
  // Mixed sizes exercise overlap, without retrying or masking first-pass failures.
  for (const sessions of [1, 2]) {
    await Promise.all(Array.from({ length: sessions }, async (_, actor) => {
      for (let n = 0; n < 10; n++) {
        const fixture = ['small', '1MiB', '4MiB', '7.5MiB'][n % 4];
        const r = await request('POST', `${base(actor)}/dossier/documents`, payload(files.get(fixture)!), actor);
        const outcome = { sessions, actor, fixture, ms: r.ms, statuses: [r.status], complete: r.status === 200 && r.json().state === 'COMPLETE' };
        outcomes.push(outcome);
        if (outcome.complete) await remove(r.json(), actor);
        await writeFile(`/evidence/batch-progress-${sessions}-${actor}.json`, JSON.stringify(outcomes.filter(o => o.sessions === sessions && o.actor === actor), null, 2));
        if (!outcome.complete) break; // Strict first-pass gate, including pending 202; no assisted retry.
      }
    }));
  }
  report.batch = outcomes;
  report.unassistedBatchPassed = outcomes.length === 30 && outcomes.every(o => o.complete);
  assert(report.unassistedBatchPassed, 'Expected 30 complete files without assisted retries');
  assert(outcomes.every(o => o.ms < 55000), 'Normal batch exceeds the local 55s latency budget');
  return { completed: outcomes.length, initialFailures: 0, retries: 0, maxMs: Math.max(...outcomes.map(o => o.ms)) };
}); }

it.skipIf(followup)('local proxy 60s and operation replay preserve one additional document', async () => record('proxy60-additional', async () => {
  proxy = http.createServer((req, res) => {
    const upstream = http.request({ host: '127.0.0.1', port: 58083, path: req.url, method: req.method, headers: req.headers }, u => {
      if (res.writableEnded) return u.resume(); res.writeHead(u.statusCode!, u.headers); u.pipe(res);
    });
    const timer = setTimeout(() => { if (!res.writableEnded) { res.writeHead(504); res.end('synthetic timeout'); } }, 60000);
    upstream.on('error', () => { if (!res.writableEnded) { res.writeHead(502); res.end(); } });
    upstream.on('close', () => clearTimeout(timer)); req.pipe(upstream);
  });
  await new Promise<void>(r => proxy.listen(58084, '127.0.0.1', r));
  const p = payload(files.get('small')!); delay = 61000;
  try {
    const timed = await request('POST', `${base()}/dossier/documents`, p, 0, 58084); assert.equal(timed.status, 504);
    let op: any;
    for (let n = 0; n < 100; n++) { const s = await request('GET', `${base()}/dossier/operations/${p.operationId}`); if (s.status === 200 && s.json().state === 'COMPLETE') { op = s.json(); break; } await wait(2000); }
    assert(op, 'Original request must settle'); delay = 0;
    const replay = await request('POST', `${base()}/dossier/documents`, p); assert.equal(replay.json().documentId, op.documentId);
    assert.equal((await query<{ n: number }>('select count(*)::int n from teacher_dossier_documents where id=$1', [op.documentId]))[0].n, 1);
    await remove(op); return { timedMs: timed.ms, final: op.state, sameDocument: true };
  } finally { delay = 0; await new Promise<void>(r => proxy.close(() => r())); }
}));

it('recovery cleans only retired files in both flows', async () => record('recovery', async () => {
  const op = await upload(files.get('small')!);
  try {
    failDelete = true;
    const r = await request('PUT', `${base()}/dossier/documents/${op.documentId}/content`, replacement(files.get('1MiB')!, op.result.revision));
    assert.equal(r.status, 202); assert.equal(r.json().state, 'CLEANUP'); failDelete = false;
    const recovered = await service.process(r.json().operationId); assert.equal(recovered.state, 'COMPLETE'); await remove(recovered);
    failDelete = true;
    const cr = await request('POST', `${base()}/documents/constancia`, payload(files.get('small')!, false));
    assert.equal(cr.status, 200); assert.equal(cr.json().cleanupPending, true); failDelete = false;
    assert.equal((await reconcileConstancias(withTransaction, boundary.constancia)).pending, false);
  } finally { failDelete = false; }
}));

it('JPG/PNG constancia HTTP and readback', async () => record('constancia-images', async () => {
  for (const name of ['small.png', 'large.png', 'large.jpg', '25mp.png']) {
    const bytes = await readFile(`/evidence/${name}`), mime = name.endsWith('jpg') ? 'image/jpeg' : 'image/png';
    report.corpus.push({ name, bytes: bytes.length, sha256: hash(bytes) });
    const r = await request('POST', `${base()}/documents/constancia`, payload(bytes, false, mime)); assert.equal(r.status, 200, r.bytes.toString());
    const read = await request('GET', `${base()}/documents/current`); assert.equal(read.status, 200); assert.equal(hash(read.bytes), hash(bytes));
  }
}));

it('slow bodies release admission and leave no document writes', async () => record('slow-bodies', async () => {
  const beforeDocs = await query('select id,state from teacher_dossier_documents order by id');
  const pending: Promise<number>[] = []; const sockets: http.ClientRequest[] = [];
  for (let n = 0; n < 2; n++) pending.push(new Promise(resolve => {
    const t = Date.now(); const r = http.request({ host: '127.0.0.1', port: 58083, path: `${base()}/dossier/documents`, method: 'POST',
      headers: { authorization: tokens[0], 'content-type': 'application/json', 'content-length': 10000 } });
    sockets.push(r); r.on('error', () => resolve(Date.now() - t)); r.write('{');
  }));
  try {
    await wait(1000); const busy = await request('POST', `${base()}/dossier/documents`, payload(files.get('small')!)); assert.equal(busy.status, 429);
    const times = await Promise.all(pending); assert(times.every(t => t >= 29000 && t < 45000));
    assert.deepEqual(await query('select id,state from teacher_dossier_documents order by id'), beforeDocs); return { milliseconds: times };
  } finally { sockets.forEach(s => s.destroy()); }
}));

it('one session ten files then two sessions ten each, initial failures visible', runBatch);

afterAll(async () => {
  failDelete = false; failPut = false; delay = 0; unavailable = false; clearInterval(monitor);
  try {
    if (before) { report.after = await fingerprint(); report.before = before; assert.deepEqual(report.after, before); }
    report.documents = await query('select id,state from teacher_dossier_documents order by id');
    report.pending = await query("select id,state from teacher_dossier_operations where state not in ('COMPLETE','FAILED')");
    report.constancias = await query('select id,is_current,document_type from teacher_documents order by id');
    report.additionalFiles = await readdir(path.join(root, 'additional'));
    report.constanciaFiles = await readdir(path.join(root, 'constancia'));
    assert.equal(report.documents.length, 0); assert.equal(report.pending.length, 0); assert.equal(report.additionalFiles.length, 0);
    assert.equal(report.constancias.filter((r: any) => r.is_current).length, 1);
    assert.equal(report.constanciaFiles.length, 1);
    report.integrityPassed = true;
  } catch (e) { report.integrityError = String(e); throw e; }
  finally {
    report.elapsedMs = Date.now() - start; report.rssPeak = peak; report.requestCount = requestCount; report.sends = sends; report.avChecks = scans;
    report.passed = report.integrityPassed && report.cases.every((c: any) => c.passed) && report.unassistedBatchPassed;
    await writeFile('/evidence/results.json', JSON.stringify(report, null, 2));
    if (app) await app.close(); await pool.end(); if (root) await rm(root, { recursive: true, force: true });
  }
  assert.equal(report.passed, true, 'Overall capacity/integrity gate failed; inspect results.json');
});
