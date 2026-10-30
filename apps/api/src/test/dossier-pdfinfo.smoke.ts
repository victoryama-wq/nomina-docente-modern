import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { DossierStorageError, validateDossierPdf } from '../lib/dossier-storage.js';

// Standalone image gate: synthetic bytes only, no server, database or Firebase initialization.
const executable = process.env.DOSSIER_PDFINFO_PATH;
assert.ok(executable && path.isAbsolute(executable), 'Absolute DOSSIER_PDFINFO_PATH required');
const version = execFileSync(executable, ['-v'], {
  encoding: 'utf8', timeout: 10_000, maxBuffer: 256 * 1024, shell: false, windowsHide: true,
  stdio: ['ignore', 'pipe', 'inherit']
});
if (version.trim()) console.log(version.trim());

async function pdf(options: PDFKit.PDFDocumentOptions = {}, javascript = false, pages = 1): Promise<Buffer> {
  const document = new PDFDocument(options);
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
  });
  document.text('Synthetic H24 parser check. No personal data.');
  for (let page = 1; page < pages; page++) document.addPage().text('Synthetic page.');
  if (javascript) document.addNamedJavaScript('synthetic', 'app.alert("synthetic");');
  document.end();
  return result;
}

async function rejects(bytes: Buffer, code = 'DOSSIER_PDF_INVALID'): Promise<void> {
  await assert.rejects(validateDossierPdf(bytes), (error: unknown) =>
    error instanceof DossierStorageError && error.code === code);
}

const root = await mkdtemp(path.join(tmpdir(), 'h24-image-smoke-'));
await chmod(root, 0o700);
const saved = { TMPDIR: process.env.TMPDIR, TMP: process.env.TMP, TEMP: process.env.TEMP };
for (const key of Object.keys(saved)) process.env[key] = root;
let passed = 0;
async function check(label: string, run: () => Promise<void>): Promise<void> {
  await run();
  assert.deepEqual(await readdir(root), [], 'Validator must remove temporary PDF files');
  passed++;
  console.log(`OK ${label}`);
}

try {
  const valid = await pdf();
  await check('valid PDF and JavaScript inspection', () => validateDossierPdf(valid));
  await check('fake PDF with magic and EOF', () => rejects(Buffer.from('%PDF-1.7\ninvalid\n%%EOF\n')));
  await check('truncated PDF', () => rejects(Buffer.concat([valid.subarray(0, 200), Buffer.from('\n%%EOF\n')])));
  await check('encrypted user password', async () => rejects(await pdf({ userPassword: 'synthetic' })));
  await check('encrypted empty user password', async () => rejects(await pdf({ ownerPassword: 'synthetic' })));
  await check('embedded JavaScript', async () => rejects(await pdf({}, true)));
  await check('500 pages accepted', async () => validateDossierPdf(await pdf({}, false, 500)));
  await check('501 pages rejected', async () => rejects(await pdf({}, false, 501)));
  await check('output limit fails closed', async () => rejects(await pdf({ info: { Title: 'x'.repeat(300 * 1024) } }), 'DOSSIER_PDF_VALIDATOR_UNAVAILABLE'));
  await check('byte limit', () => rejects(Buffer.alloc(7.5 * 1024 * 1024 + 1), 'DOSSIER_PDF_TOO_LARGE'));
  await check('missing executable fails closed', async () => {
    process.env.DOSSIER_PDFINFO_PATH = path.join(root, 'missing-pdfinfo');
    try { await rejects(valid, 'DOSSIER_PDF_VALIDATOR_UNAVAILABLE'); }
    finally { process.env.DOSSIER_PDFINFO_PATH = executable; }
  });
  if (process.platform === 'linux') {
    await check('real subprocess timeout and cleanup', async () => {
      const stalledParser = path.join(root, 'stalled-parser');
      await writeFile(stalledParser, `#!${process.execPath}\nsetTimeout(() => {}, 60000);\n`, { mode: 0o700, flag: 'wx' });
      process.env.DOSSIER_PDFINFO_PATH = stalledParser;
      const start = Date.now();
      try {
        await rejects(valid, 'DOSSIER_PDF_VALIDATOR_UNAVAILABLE');
        assert.ok(Date.now() - start >= 9_000, 'Must exercise the real parser timeout');
        assert.ok(Date.now() - start < 30_000, 'Timeout must terminate the stalled child');
      } finally {
        process.env.DOSSIER_PDFINFO_PATH = executable;
        await rm(stalledParser);
      }
    });
  } else {
    console.log('PENDING Linux-only real subprocess timeout; not an image validation');
  }
  console.log(`H24 parser smoke: ${passed} checks passed on ${process.platform}`);
} finally {
  process.env.DOSSIER_PDFINFO_PATH = executable;
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(root, { recursive: true, force: true });
}
