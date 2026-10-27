// H24-F3: opt-in local HTTP + PostgreSQL + filesystem + browser validation.
// Run with node --import tsx. Never imported by the production application.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import PDFDocument from 'pdfkit';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
assert.equal(process.env.H24_LOCAL_RESET_APPROVED, 'true', 'Explicit local schema reset approval required');
assert.equal(process.env.TEST_DB_NAME, 'nomina_docente_test');
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(process.env.TEST_DB_HOST));
assert.notEqual(process.env.NODE_ENV, 'production');
assert.ok(!process.env.INSTANCE_CONNECTION_NAME, 'Cloud SQL connections forbidden');
assert.ok(path.isAbsolute(process.env.H24_PLAYWRIGHT_MODULE || ''), 'Supply an installed Playwright module path');
assert.ok(path.isAbsolute(process.env.H24_BROWSER_PATH || ''), 'Supply local browser executable');
assert.ok(path.isAbsolute(process.env.DOSSIER_PDFINFO_PATH || ''), 'Supply local pdfinfo executable');
const { chromium } = createRequire(import.meta.url)(process.env.H24_PLAYWRIGHT_MODULE);
Object.assign(process.env, {
  NODE_ENV: 'test', DB_HOST: process.env.TEST_DB_HOST, DB_PORT: process.env.TEST_DB_PORT || '5432',
  DB_NAME: 'nomina_docente_test', DB_USER: process.env.TEST_DB_USER || 'app_nomina', DB_PASSWORD: process.env.TEST_DB_PASSWORD,
  FIREBASE_PROJECT_ID: 'demo-nomina-h24-test', GCP_PROJECT_ID: 'demo-nomina-h24-test',
  CONSTANCIAS_BUCKET: 'demo-nomina-h24-test-unused', DOSSIER_STORAGE_MODE: 'local',
  CORS_ORIGINS: 'http://127.0.0.1:5178'
});
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.DOSSIER_BUCKET;
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
await client.connect();
assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'nomina_docente_test');

const evidence = path.join(repo, '.cache/h24-f3-ui');
await mkdir(evidence, { recursive: true });
const root = await mkdtemp(path.join(tmpdir(), 'nomina-h24-f3-'));
await chmod(root, 0o700);
process.env.DOSSIER_LOCAL_ROOT = root;
const report = { database: 'nomina_docente_test', host: process.env.DB_HOST, storage: 'isolated OS temporary directory', firebase: 'synthetic test actors; no Firebase session', results: [], externalRequestsBlocked: [], screenshots: [], passed: false };
const check = (name, detail = 'OK') => { report.results.push({ name, detail }); console.log(name, detail); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let app, vite, browser;
let cleanedByApi = false;
const makePdf = text => new Promise((resolve, reject) => {
  const doc = new PDFDocument(); const chunks = [];
  doc.on('data', chunk => chunks.push(chunk)); doc.on('error', reject);
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.fontSize(24).text('H24 - DOCUMENTO SINTETICO').fontSize(14).text(text); doc.end();
});
const teacherId = '40000000-0000-4000-8000-000000000001';
const dossierPath = `/api/teachers/${teacherId}/dossier`;
const protectedTables = ['teacher_documents','schedules','schedule_incidences','extra_hours','payroll_runs','payroll_lines','payroll_schedule_details','payroll_extra_details','roles','permissions','role_permissions','academic_cycles','payroll_calendar_config'];
async function fingerprints() {
  const values = {};
  for (const table of protectedTables) {
    const rows = (await client.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    values[table] = { count: rows.length, sha256: sha(JSON.stringify(rows)) };
  }
  const rows = (await client.query("SELECT to_jsonb(t) - 'phone' - 'updated_at' - 'updated_by' AS row FROM teachers t ORDER BY id")).rows;
  values.teachersExceptContact = { count: rows.length, sha256: sha(JSON.stringify(rows)) };
  return values;
}

try {
  const { prepareTestDatabase } = await import('../../apps/api/src/test/db/test-db-utils.ts');
  await prepareTestDatabase();
  report.before = await fingerprints();
  const teacherName = (await client.query('SELECT full_name FROM teachers WHERE id=$1',[teacherId])).rows[0].full_name;
  const beforeOtherTeacher = (await client.query('SELECT to_jsonb(t) AS row FROM teachers t WHERE id<>$1 ORDER BY id',[teacherId])).rows;
  const { buildApp } = await import('../../apps/api/src/app.ts');
  const fixtures = await import('../../apps/api/src/test/fixtures/index.ts');
  const { authHeaderForTestActor } = await import('../../apps/api/src/test/auth-test-utils.ts');
  const actors = { admin: fixtures.adminActor(), finanzas: fixtures.financeActor(), rh: fixtures.rhActor(), coordinador: fixtures.coordinatorActor(), direccion: fixtures.directionActor(), contador: fixtures.accountantActor(), contabilidad: fixtures.accountingActor() };
  const headers = Object.fromEntries(Object.entries(actors).map(([role, actor]) => [role, authHeaderForTestActor(actor)]));
  app = await buildApp();
  app.log.level = 'silent';
  // Unknown credentials cannot fall through to external Firebase verification in this harness.
  app.addHook('onRequest', async (req, reply) => {
    if (req.headers.authorization && !Object.values(headers).includes(req.headers.authorization)) return reply.code(401).send({ error:'LOCAL_TEST_TOKEN_REQUIRED' });
  });
  const apiUrl = await app.listen({ host:'127.0.0.1', port:0 });
  const testPlugin = {
    name: 'h24-local-auth-only',
    resolveId(id) { if(id === 'virtual:h24-entry') return '\0h24-entry'; },
    load(id) {
      if (id !== '\0h24-entry') return;
      return `import {createApp,h} from 'vue'; import {createPinia} from 'pinia'; import {createRouter,createMemoryHistory,RouterView} from 'vue-router';
      import {useAuthStore} from '/src/stores/auth.ts'; import Fiscal from '/src/views/FiscalRecordsView.vue'; import Teachers from '/src/views/TeachersView.vue'; import '/src/styles.css';
      const pinia=createPinia();const auth=useAuthStore(pinia);auth.session=window.__H24_ACTOR__;auth.firebaseUser={uid:auth.session.firebaseUid};auth.loading=false;
      const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:Fiscal},{path:'/docentes',component:Teachers}]});
      window.__H24_ROUTER__=router;createApp({render:()=>h(RouterView)}).use(pinia).use(router).mount('#app');`;
    },
    transform(_code, id) {
      const file=id.split('?')[0].replaceAll('\\','/');
      if (file.endsWith('/src/firebase.ts')) return {code:`export const auth={currentUser:{getIdToken:async()=>window.__H24_TOKEN__}};export const authPersistenceReady=Promise.resolve();export const googleProvider={};`,map:null};
      if (file.endsWith('/src/config.ts')) return {code:`export const apiBaseUrl=${JSON.stringify(apiUrl+'/api')};export const firebaseConfig={projectId:'demo-nomina-h24-test'};`,map:null};
    },
    configureServer(server) {
      server.middlewares.use(async (req,res,next) => {
        if(req.url !== '/__h24_test') return next();
        const html=await server.transformIndexHtml('/__h24_test','<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>H24 F3 local</title></head><body><div id="app"></div><script type="module" src="/@id/virtual:h24-entry"></script></body></html>');
        res.setHeader('Content-Type','text/html');res.end(html);
      });
    }
  };
  vite=await createServer({ configFile:false, root:path.join(repo,'apps/web'),plugins:[vue(),testPlugin],server:{host:'127.0.0.1',port:5178,strictPort:true},logLevel:'error' });
  await vite.listen();
  browser=await chromium.launch({executablePath:process.env.H24_BROWSER_PATH,headless:true});
  async function newPage(role) {
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.addInitScript(({actor,token})=>{window.__H24_ACTOR__=actor;window.__H24_TOKEN__=token;},{actor:actors[role],token:headers[role].slice(7)});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(['blob:','data:','chrome:','chrome-extension:','chrome-untrusted:'].includes(url.protocol)) return route.continue();
      if(url.hostname==='127.0.0.1' && ['5178',new URL(apiUrl).port].includes(url.port)) return route.continue();
      report.externalRequestsBlocked.push(url.origin);return route.abort();
    });
    const page=await context.newPage();
    page.setDefaultTimeout(15_000);
    await page.goto('http://127.0.0.1:5178/__h24_test');
    return {page,context};
  }
  async function api(method,url,body,role='admin') {
    const res=await fetch(apiUrl+url,{method,headers:{Authorization:headers[role],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return res;
  }
  const dossier = async () => {const res=await api('GET',dossierPath);assert.equal(res.status,200);return res.json();};
  const {page,context}=await newPage('admin');
  await page.getByRole('button',{name:`Abrir expediente de ${teacherName}`,exact:true}).click();
  await page.getByLabel('Teléfono operativo').waitFor();
  check('real API initial dossier', (await dossier()).documents.length);
  const original=await makePdf('Original. Ninguna informacion personal real.');
  const replacement=await makePdf('Reemplazo. Ninguna informacion personal real.');
  let uploadInFlight=0,maxUploads=0;
  const uploadRequests=new Set();
  page.on('request', req=>{if(req.method()==='POST' && req.url()===apiUrl+dossierPath+'/documents'){uploadRequests.add(req);maxUploads=Math.max(maxUploads,++uploadInFlight);}});
  const endRequest=req=>{if(uploadRequests.delete(req))uploadInFlight--;};
  page.on('requestfinished',endRequest);page.on('requestfailed',endRequest);
  await page.locator('input[multiple]').setInputFiles([
    {name:'Identidad sintética.pdf',mimeType:'application/pdf',buffer:original},
    {name:'Identidad sintética.pdf',mimeType:'application/pdf',buffer:original},
    {name:'Titulo.pdf',mimeType:'application/pdf',buffer:original},
    {name:'invalido.txt',mimeType:'text/plain',buffer:Buffer.from('not PDF')}
  ]);
  await page.getByText('Solo se admiten archivos PDF.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Cargar archivos válidos'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.dossier-documents li').length===3);
  await page.getByText('Completado',{exact:true}).nth(2).waitFor();
  assert.ok(maxUploads<=2);assert.equal((await readdir(root)).length,3);
  check('multiple PDF / repeated type and name / partial invalid / concurrency', {documents:3,files:3,maxUploads});
  await page.getByRole('button',{name:'Retirar invalido.txt de la selección',exact:true}).click();
  for(const [width,height] of [[1440,900],[768,1024],[390,844]]) {
    await page.setViewportSize({width,height});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('.dossier-panel').evaluate(el=>el.scrollWidth>el.clientWidth),false);
    const file=`panel-${width}.png`;await page.screenshot({path:path.join(evidence,file)});report.screenshots.push(file);
  }
  await page.setViewportSize({width:1440,height:900});
  const doc=(await dossier()).documents.find(d=>d.fileName==='Identidad sintética.pdf');
  const row=page.locator('.dossier-documents li').filter({hasText:doc.title}).first();
  await row.getByRole('button',{name:`Ver ${doc.title}`,exact:true}).click();
  await page.locator('.dossier-preview iframe').waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(evidence,'preview.png')});report.screenshots.push('preview.png');
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar',exact:true}).click();
  const download=await downloaded;
  const downloadPath=path.join(evidence,'download-synthetic.pdf');await download.saveAs(downloadPath);
  assert.equal(sha(await readFile(downloadPath)),sha(original));
  assert.equal(download.suggestedFilename(),doc.fileName,'Authenticated CORS download must preserve UTF8 filename');
  check('PDF preview/download bytes and UTF8 filename');
  await page.getByRole('button',{name:'Cerrar vista previa',exact:true}).click();
  await row.getByRole('button',{name:`Clasificar ${doc.title}`,exact:true}).click();
  await page.locator('form.dossier-edit input').fill('Titulo actualizado F3');
  await page.locator('form.dossier-edit select').selectOption('TITULO');
  await page.getByRole('button',{name:'Guardar clasificación'}).click();
  await page.locator('.dossier-documents strong').filter({hasText:'Titulo actualizado F3'}).waitFor();
  const changed=(await dossier()).documents.find(d=>d.title==='Titulo actualizado F3');
  assert.equal(changed.documentType,'TITULO');
  await page.getByRole('button',{name:'Reemplazar Titulo actualizado F3',exact:true}).click();
  await page.getByLabel('PDF de reemplazo').setInputFiles({name:'Reemplazo.pdf',mimeType:'application/pdf',buffer:replacement});
  await page.locator('.dossier-documents').getByText('Reemplazo.pdf',{exact:true}).waitFor();
  const replaced=(await dossier()).documents.find(d=>d.id===changed.id);
  assert.equal(replaced.fileName,'Reemplazo.pdf');assert.ok(replaced.revision>changed.revision);
  const stored=(await client.query('SELECT storage_key FROM teacher_dossier_documents WHERE id=$1',[changed.id])).rows[0];
  assert.equal(sha(await readFile(path.join(root,sha(stored.storage_key)+'.pdf'))),sha(replacement));
  assert.equal((await readdir(root)).length,3);
  check('metadata and replacement preserve ID; old object removed');
  await page.getByLabel('Teléfono operativo').fill('+52 998 555 0101');
  await page.getByRole('button',{name:'Guardar teléfono',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('input[type=tel]')?.value==='+529985550101');
  assert.equal((await client.query('SELECT phone FROM teachers WHERE id=$1',[teacherId])).rows[0].phone,'+529985550101');
  await page.getByRole('button',{name:'Cerrar expediente',exact:true}).click();
  await page.evaluate(()=>window.__H24_ROUTER__.push('/docentes'));
  await page.locator('tr').filter({hasText:teacherName}).getByTitle('Ver información',{exact:true}).click();
  await page.getByText('+529985550101',{exact:false}).first().waitFor();
  check('phone persisted and Directory reread shows same number');
  await page.evaluate(()=>window.__H24_ROUTER__.push('/'));
  await page.getByRole('button',{name:`Abrir expediente de ${teacherName}`,exact:true}).click();
  await page.getByLabel('Teléfono operativo').waitFor();

  // Lost response after a real accepted write: UI retry must reuse the operation.
  let lost=true;
  await page.route(apiUrl+dossierPath+'/documents',async route=>{
    if(route.request().method()==='POST' && lost){lost=false;await route.fetch();return route.abort('failed');}
    return route.continue();
  });
  await page.locator('input[multiple]').setInputFiles({name:'Recuperacion.pdf',mimeType:'application/pdf',buffer:original});
  await page.getByRole('button',{name:'Cargar archivos válidos'}).click();
  await page.getByRole('button',{name:'Reintentar misma operación'}).waitFor();
  assert.equal((await dossier()).documents.length,4);
  await page.getByRole('button',{name:'Reintentar misma operación'}).click();
  await page.getByText('Completado',{exact:true}).waitFor();
  assert.equal((await dossier()).documents.length,4);
  await page.reload();
  await page.getByRole('button',{name:`Abrir expediente de ${teacherName}`,exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.dossier-documents li').length===4);
  check('lost accepted response, idempotent retry and page reload', {documents:4});

  const activeDoc=(await dossier()).documents[0];
  for(const role of ['finanzas','rh','coordinador','direccion','contador','contabilidad']) {
    const other=await newPage(role);
    if(['finanzas','rh'].includes(role)) {
      await other.page.getByRole('button',{name:`Abrir expediente de ${teacherName}`,exact:true}).click();
      await other.page.getByLabel('Teléfono operativo').waitFor();
      assert.equal(await other.page.locator('input[multiple]').count(),1);
      assert.equal((await api('GET',dossierPath,undefined,role)).status,200);
      assert.equal((await api('GET',dossierPath+`/documents/${activeDoc.id}/content`,undefined,role)).status,200);
      check(`role ${role}`,'UI + real API read/manage capabilities OK');
    } else {
      await other.page.getByText('No tienes acceso a Expediente Fiscal.').waitFor();
      assert.equal((await api('GET',dossierPath,undefined,role)).status,403);
      assert.equal((await api('GET',dossierPath+`/documents/${activeDoc.id}/content`,undefined,role)).status,403);
      check(`role ${role}`,'UI denied; metadata and bytes HTTP 403');
    }
    await other.context.close();
  }
  assert.equal((await fetch(apiUrl+dossierPath)).status,401);
  check('anonymous','HTTP 401');
  for (const document of (await dossier()).documents) {
    await page.getByRole('button',{name:`Eliminar ${document.title}`,exact:true}).first().click();
    await page.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();
    await page.waitForFunction(title=>!Array.from(document.querySelectorAll('.dossier-operations li')).some(el=>el.textContent.includes(title) && !el.textContent.includes('Completado')),`Eliminar: ${document.fileName}`);
    await page.getByRole('button',{name:'Actualizar expediente',exact:true}).click();
    assert.equal((await api('GET',dossierPath+`/documents/${document.id}/content`)).status,404);
  }
  assert.equal((await dossier()).documents.length,0);
  assert.deepEqual(await readdir(root),[]);cleanedByApi=true;
  check('permanent delete','all metadata/bytes absent via real API, storage empty');
  report.after=await fingerprints();assert.deepEqual(report.after,report.before);
  assert.deepEqual((await client.query('SELECT to_jsonb(t) AS row FROM teachers t WHERE id<>$1 ORDER BY id',[teacherId])).rows,beforeOtherTeacher);
  check('fiscal, payroll, snapshots, schedules, permissions and other teachers fingerprints','identical');
  await context.close();
  report.passed=true;
} catch(error) {
  report.failure=String(error.message || error);
  console.error('H24-F3 failed:',report.failure);
  process.exitCode=1;
} finally {
  await browser?.close();await vite?.close();await app?.close();
  await client.end();
  const {closeDatabase}=await import('../../apps/api/src/db.ts');await closeDatabase();
  report.filesRemaining=await readdir(root);
  report.physicalDeletionProven=cleanedByApi;
  report.externalRequestsBlocked=[...new Set(report.externalRequestsBlocked)];
  await writeFile(path.join(evidence,'result.json'),JSON.stringify(report,null,2));
  // Do not confuse fixture cleanup with deletion proven through the application.
  const resolved=path.resolve(root);const relative=path.relative(path.resolve(tmpdir()),resolved);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(resolved).startsWith('nomina-h24-f3-'));
  await rm(resolved,{recursive:true,force:true});
}
