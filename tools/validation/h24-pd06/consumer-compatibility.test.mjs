import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { v4 } from 'uuid';

const require = createRequire(import.meta.url);
const from = name => createRequire(require.resolve(name));
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test('UUID consumers keep ESM and CommonJS v4; ExcelJS writes readable workbooks', async () => {
  assert.match(v4(), uuidV4);
  for (const name of ['exceljs', '@google-cloud/storage', 'gaxios', 'google-gax', 'teeny-request']) {
    assert.match(from(name)('uuid').v4(), uuidV4, name);
  }
  const { Workbook } = require('exceljs');
  const original = new Workbook();
  original.addWorksheet('Nómina').addRow(['Docente sintético', 12.5]);
  const read = new Workbook();
  await read.xlsx.load(await original.xlsx.writeBuffer());
  assert.deepEqual(read.getWorksheet('Nómina').getRow(1).values.slice(1), ['Docente sintético', 12.5]);
});

test('Vue and editor tooling retain named matching APIs; archiver keeps callback glob', () => {
  const vue = from('@vue/language-core')('minimatch');
  assert.equal(vue.minimatch('data-example', 'data-*'), true);
  assert.equal(vue.minimatch('aria-label', 'data-*'), false);
  const editor = from('editorconfig')('minimatch');
  assert.equal(new editor.Minimatch('**/*.vue', { dot: true }).match('views/CalendarView.vue'), true);
  const glob = from('js-beautify')('glob');
  assert.equal(glob.hasMagic('apps/*/package.json'), true);
  assert.deepEqual(glob.globSync('apps/*/package.json', { posix: true }).sort(), ['apps/api/package.json', 'apps/web/package.json']);
  assert.equal(typeof from('archiver-utils')('glob'), 'function');
});

test('Firebase Auth lookup and Cloud Storage multipart upload use only loopback', async () => {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({ url: req.url, body: Buffer.concat(chunks).toString(), mime: req.headers['content-type'] });
    res.setHeader('content-type', 'application/json');
    if (req.url.includes('accounts:lookup')) res.end(JSON.stringify({ users: [{ localId: 'synthetic', emailVerified: true }] }));
    else if (req.url.includes('/upload/')) res.end(JSON.stringify({ name: 'probe.txt', generation: '1', size: '14' }));
    else { res.statusCode = 404; res.end('{}'); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const host = '127.0.0.1:' + server.address().port;
  const old = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = host;
  const projectId = 'demo-pd06';
  const app = initializeApp({ projectId, credential: { getAccessToken: async () => ({ access_token: 'synthetic', expires_in: 300 }) } }, 'pd06-local');
  try {
    assert.equal((await getAuth(app).getUser('synthetic')).uid, 'synthetic');
    const { Storage } = from('firebase-admin/storage')('@google-cloud/storage');
    const storage = new Storage({ projectId, apiEndpoint: 'http://' + host, useAuthWithCustomEndpoint: false, retryOptions: { autoRetry: false } });
    await storage.bucket('pd06-synthetic').file('probe.txt').save('synthetic-only', { resumable: false, validation: false });
    assert.equal(requests.length, 2);
    assert.deepEqual(JSON.parse(requests[0].body).localId, ['synthetic']);
    assert.match(requests[1].mime, /multipart\/related.*boundary=/);
    assert.match(requests[1].body, /synthetic-only/);
  } finally {
    if (old === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = old;
    await deleteApp(app);
    await new Promise(resolve => server.close(resolve));
  }
});
