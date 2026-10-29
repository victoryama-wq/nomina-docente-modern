// Synthetic UI harness: no API server, DB, Firebase session or cloud storage.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { validateDocumentContent } from '../../../apps/api/src/lib/document-security.ts';

assert.equal(process.env.H24_PD03_PREVIEW_APPROVED, 'true');
assert.ok(path.isAbsolute(process.env.H24_PLAYWRIGHT_MODULE || ''));
assert.ok(path.isAbsolute(process.env.H24_BROWSER_PATH || ''));
const { chromium } = createRequire(import.meta.url)(process.env.H24_PLAYWRIGHT_MODULE);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = path.join(repo, '.cache/h24-pd03-policy-preview');
await mkdir(evidence, { recursive: true });
const envDir = await mkdtemp(path.join(tmpdir(), 'h24-policy-ui-'));
const bytes = await new Promise(resolve => {
  const document = new PDFDocument(); const chunks = [];
  document.on('data', chunk => chunks.push(chunk)); document.on('end', () => resolve(Buffer.concat(chunks)));
  document.fontSize(22).text('H24 - Synthetic PDF preview').fontSize(14).text('No personal data. Original bytes preserved.');
  document.text('Synthetic HTTPS link', { link: 'https://example.invalid/h24' }); document.end();
});
await validateDocumentContent(bytes, 'application/pdf');
const report = { synthetic: true, db: false, firebase: false, cloud: false, pipelineApproved: true,
  externalAttempts: [], errors: [], checks: [], screenshots: [], passed: false };
const teacher = { id: 'synthetic-teacher', fullName: 'Docente QA Sintetico', status: 'ACTIVO', phone: '',
  rfc: '', email: '', bankDetail: '', paymentType: 'E', documentId: 'synthetic-document', documentName: 'synthetic.pdf' };
const doc = { id: 'synthetic-document', title: 'PDF sintetico', fileName: 'synthetic.pdf', mimeType: 'application/pdf',
  sizeBytes: bytes.length, state: 'AVAILABLE', revision: 1, documentType: 'OTRO', createdAt: '2026-10-28T00:00:00Z', updatedAt: '2026-10-28T00:00:00Z' };
let vite, browser;
try {
  const plugin = {
    name: 'h24-pd03-synthetic-only',
    resolveId(id) { if (id === 'virtual:h24-policy-ui') return '\0h24-policy-ui'; },
    load(id) {
      if (id !== '\0h24-policy-ui') return;
      return `import {createApp,h} from 'vue'; import {createPinia} from 'pinia'; import {createRouter,createMemoryHistory,RouterView} from 'vue-router';
        import Fiscal from '/src/views/FiscalRecordsView.vue'; import {useAuthStore} from '/src/stores/auth.ts'; import '/src/styles.css';
        const pinia=createPinia(); const auth=useAuthStore(pinia);
        auth.session={id:'synthetic-admin',firebaseUid:'synthetic-admin',email:'qa@example.invalid',role:'admin',status:'ACTIVO',permissions:[],actorCoordinations:[]};
        auth.loading=false; window.__h24Auth=auth; window.__h24Parent='unchanged';
        const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:Fiscal}]});
        createApp({render:()=>h(RouterView)}).use(pinia).use(router).mount('#app');`;
    },
    transform(_code, id) {
      const file = id.split('?')[0].replaceAll('\\', '/');
      if (file.endsWith('/src/firebase.ts')) return { code: `export const auth={currentUser:{getIdToken:async()=> 'synthetic-not-a-firebase-token'}};export const authPersistenceReady=Promise.resolve();export const googleProvider={};`, map: null };
      if (file.endsWith('/src/config.ts')) return { code: `export const apiBaseUrl='/api';export const firebaseConfig={projectId:'demo-h24-policy'};`, map: null };
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url !== '/__h24_policy') return next();
        const html = await server.transformIndexHtml('/__h24_policy', '<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>H24 synthetic preview</title></head><body><div id="app"></div><script type="module" src="/@id/virtual:h24-policy-ui"></script></body></html>');
        response.setHeader('Content-Type', 'text/html'); response.end(html);
      });
    }
  };
  vite = await createServer({ configFile: false, envDir, root: path.join(repo, 'apps/web'),
    plugins: [vue(), plugin], server: { host: '127.0.0.1', port: 5196, strictPort: true }, logLevel: 'error' });
  await vite.listen();
  browser = await chromium.launch({ executablePath: process.env.H24_BROWSER_PATH, headless: true,
    args: ['--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await context.addInitScript(() => {
    window.__h24Urls = new Set();
    const create = URL.createObjectURL.bind(URL); const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); window.__h24Urls.add(url); return url; };
    URL.revokeObjectURL = url => { window.__h24Urls.delete(url); revoke(url); };
  });
  await context.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (['blob:', 'data:', 'chrome-extension:', 'chrome-untrusted:'].includes(url.protocol)) return route.continue();
    if (url.protocol === 'chrome:' && ['resources', 'theme'].includes(url.hostname)) return route.continue();
    if (url.hostname !== '127.0.0.1' || url.port !== '5196') { report.externalAttempts.push(url.href); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    assert.equal(request.method(), 'GET', 'No writes permitted even to synthetic API');
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/api/teachers') return json({ teachers: [teacher], summary: { total: 1, active: 1, inactive: 0, withRfc: 0, withBank: 0, withConstancia: 1, fiscalReady: 0 } });
    if (url.pathname.endsWith('/dossier')) return json({ teacher: { ...teacher, version: 'synthetic' }, documents: [doc], capabilities: { readDocuments: true, manageDocuments: true, editPhone: true } });
    if (url.pathname.endsWith('/documents/current') || url.pathname.endsWith('/content')) return route.fulfill({ status: 200, body: bytes,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="synthetic.pdf"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    throw new Error(`Unexpected synthetic request: ${url.pathname}`);
  });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('http://127.0.0.1:5196/__h24_policy');
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  await page.locator('.fiscal-preview-modal iframe').waitFor();
  await page.waitForTimeout(1000);
  for (const [width, height] of [[1440,900],[768,1024],[390,844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const screenshot = `constancia-${width}.png`; await page.screenshot({ path: path.join(evidence, screenshot) }); report.screenshots.push(screenshot);
  }
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar constancia', exact: true }).click();
  const download = await downloadEvent; const downloadedPath = path.join(evidence, 'synthetic-download.pdf'); await download.saveAs(downloadedPath);
  assert.equal(createHash('sha256').update(await readFile(downloadedPath)).digest('hex'), createHash('sha256').update(bytes).digest('hex'));
  report.checks.push('constancia preview/download bytes and responsive');
  await page.locator('.fiscal-preview-modal button[title="Cerrar"]').click();
  await page.waitForFunction(() => window.__h24Urls.size === 0, undefined, { timeout: 40_000 });
  await page.getByRole('button', { name: 'Abrir expediente de Docente QA Sintetico' }).click();
  await page.getByRole('button', { name: 'Ver PDF sintetico', exact: true }).click();
  await page.locator('.dossier-preview iframe').waitFor();
  await page.waitForTimeout(1000);
  for (const [width, height] of [[1440,900],[768,1024],[390,844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('.dossier-panel').evaluate(el => el.scrollWidth > el.clientWidth), false);
    const screenshot = `dossier-${width}.png`; await page.screenshot({ path: path.join(evidence, screenshot) }); report.screenshots.push(screenshot);
    if (width === 390) {
      await page.locator('.dossier-preview').evaluate(el => el.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(1000);
      const scrolled = 'dossier-390-scrolled.png';
      await page.screenshot({ path: path.join(evidence, scrolled) }); report.screenshots.push(scrolled);
    }
  }
  await page.getByRole('button', { name: 'Cerrar vista previa', exact: true }).click();
  await page.waitForFunction(() => window.__h24Urls.size === 0);
  await page.getByRole('button', { name: 'Cerrar expediente', exact: true }).click();
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  await page.locator('.fiscal-preview-modal iframe').waitFor();
  await page.evaluate(() => { window.__h24Auth.session = null; });
  await page.waitForFunction(() => window.__h24Urls.size === 0 && document.querySelectorAll('iframe').length === 0);
  assert.equal(await page.evaluate(() => window.__h24Parent), 'unchanged');
  assert.equal(page.url(), 'http://127.0.0.1:5196/__h24_policy');
  assert.deepEqual(report.externalAttempts, []); assert.deepEqual(report.errors, []);
  report.checks.push('additional preview responsive; close/logout release URLs; no observed external requests or navigation');
  report.passed = true;
} finally {
  await browser?.close(); await vite?.close();
  await rm(envDir, { recursive: true });
  await writeFile(path.join(evidence, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
