import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import sharp from 'sharp';

// Synthetic fixtures only; no documents, tokens, storage or database modules.
function pdf(catalog = '', extra = [], page = '') {
  const content = 'BT /F1 16 Tf 40 740 Td (Synthetic H24 document - no personal data) Tj ET\n';
  const objects = [`<< /Type /Catalog /Pages 2 0 R ${catalog} >>`, '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R ${page} >>`,
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', ...extra];
  let data = '%PDF-1.7\n'; const offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(data)); data += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(data);
  data += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  data += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(data);
}
function inspect(bytes, kind, valid) {
  const hash = createHash('sha256').update(bytes).digest('hex');
  const result = spawnSync(process.execPath, ['/opt/h24/inspect-stdin.mjs', kind], {
    input: bytes, encoding: 'utf8', timeout: 35_000, maxBuffer: 16_384, env: { PATH: '/usr/bin:/bin', DOSSIER_PDFINFO_PATH: '/usr/bin/pdfinfo' }
  });
  assert.equal(result.error, undefined);
  assert.equal(result.stderr, '');
  assert.equal(result.status, valid ? 0 : 10, `${kind}: ${result.stdout}`);
  assert.equal(result.stdout.trim(), valid ? `H24_POLICY_V1_${kind.toUpperCase()}_OK ${hash}` : 'H24_INVALID');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
}
test('static PDF, internal navigation and HTTPS user link', () => {
  inspect(pdf(), 'pdf', true);
  inspect(pdf('/OpenAction [3 0 R /Fit]'), 'pdf', true);
  inspect(pdf('', ['<< /Type /Annot /Subtype /Link /Rect [0 0 10 10] /A << /S /URI /URI (https://example.invalid/h24) >> >>'], '/Annots [6 0 R]'), 'pdf', true);
});
test('inert AcroForm and signature field preserve original bytes without certifying signature', () => {
  inspect(pdf('/AcroForm << /Fields [6 0 R] >>', ['<< /FT /Tx /T (Synthetic) /V (Example) >>']), 'pdf', true);
  inspect(pdf('/AcroForm << /Fields [6 0 R] >>', ['<< /FT /Sig /T (SyntheticSignature) /V 7 0 R >>',
    '<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /Contents <0000> /ByteRange [0 1 2 3] >>']), 'pdf', true);
});
test('PDF functions blocked by actual parser including escaped names', () => {
  for (const action of ['/Launch', '/SubmitForm', '/ImportData', '/GoToR', '/GoToE', '/Rendition', '/FutureAction']) {
    inspect(pdf(`/OpenAction << /Type /Action /S ${action} >>`), 'pdf', false);
  }
  inspect(pdf('/OpenAction << /S /L#61unch >>'), 'pdf', false);
  inspect(pdf('/OpenAction << /S /URI /URI (https://example.invalid/) >>'), 'pdf', false);
  inspect(pdf('/OpenAction << /S /JavaScript /JS (void 0;) >>'), 'pdf', false);
});
test('attachments, XFA, automatic actions, multimedia and external resources blocked', () => {
  for (const catalog of ['/Collection << >>', '/Names << /EmbeddedFiles << /Names [] >> >>', '/AcroForm << /Fields [] /XFA (inert) >>', '/AA << >>']) inspect(pdf(catalog), 'pdf', false);
  for (const subtype of ['/FileAttachment', '/Screen', '/RichMedia', '/3D']) inspect(pdf('', [`<< /Type /Annot /Subtype ${subtype} /Rect [0 0 10 10] >>`], '/Annots [6 0 R]'), 'pdf', false);
  inspect(pdf('', ['<< /Type /Filespec /F (synthetic.txt) >>']), 'pdf', false);
});
test('compressed objects and incremental updates cannot hide forbidden action', () => {
  const directory = mkdtempSync('/tmp/h24-corpus-');
  try {
    const original = pdf('/OpenAction << /S /Launch >>');
    writeFileSync(`${directory}/a.pdf`, original);
    execFileSync('/usr/bin/qpdf', ['--object-streams=generate', `${directory}/a.pdf`, `${directory}/b.pdf`]);
    inspect(readFileSync(`${directory}/b.pdf`), 'pdf', false);
    const clean = pdf(); const prev = /startxref\n(\d+)/.exec(clean.toString())[1];
    const update = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /Launch >> >>\nendobj\n';
    const offset = clean.length + Buffer.byteLength(update);
    const tail = `xref\n1 1\n${String(clean.length).padStart(10, '0')} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R /Prev ${prev} >>\nstartxref\n${offset}\n%%EOF\n`;
    inspect(Buffer.concat([clean, Buffer.from(update + tail)]), 'pdf', false);
  } finally { rmSync(directory, { recursive: true }); }
});
test('JPEG/PNG decode complete RGB, gray, CMYK/ICC, EXIF and alpha', async () => {
  const create = () => sharp({ create: { width: 64, height: 48, channels: 4, background: '#7fa1b980' } });
  const images = [
    ['png', await create().png().toBuffer()], ['jpeg', await create().jpeg().toBuffer()],
    ['jpeg', await create().greyscale().jpeg().toBuffer()], ['png', await create().greyscale().png().toBuffer()],
    ['jpeg', await create().toColourspace('cmyk').withIccProfile('cmyk').jpeg().toBuffer()],
    ['jpeg', await create().withMetadata({ orientation: 6 }).jpeg().toBuffer()],
    ['jpeg', await create().jpeg({ progressive: true }).toBuffer()]
  ];
  for (const [kind, bytes] of images) inspect(bytes, kind, true);
});
test('image boundaries: exact dimensions/pixels, excess, false format and truncation', async () => {
  const create = (width, height) => sharp({ create: { width, height, channels: 3, background: '#abcdef' } }).png().toBuffer();
  inspect(await create(10_000, 1), 'png', true);
  inspect(await create(10_001, 1), 'png', false);
  inspect(await create(5000, 5000), 'png', true);
  inspect(await create(5001, 5000), 'png', false);
  const valid = await create(128, 128);
  inspect(valid, 'jpeg', false);
  inspect(valid.subarray(0, valid.length - 15), 'png', false);
  inspect(Buffer.concat([valid, Buffer.from('trailing')]), 'png', false);
  const jpeg = await sharp(valid).jpeg().toBuffer();
  inspect(Buffer.concat([jpeg, jpeg]), 'jpeg', false);
  inspect(Buffer.concat([jpeg.subarray(0,2), Buffer.from([255,226,0,6,77,80,70,0]), jpeg.subarray(2)]), 'jpeg', false);
  inspect(Buffer.concat([jpeg.subarray(0, 100), Buffer.from([255,217])]), 'jpeg', false);
  const animation = Buffer.concat([valid.subarray(0,33), Buffer.from([0,0,0,8,97,99,84,76,0,0,0,2,0,0,0,0,0,0,0,0]), valid.subarray(33)]);
  inspect(animation, 'png', false);
});
test('empty input and unsupported mode never produce a success verdict', () => {
  inspect(Buffer.alloc(0), 'png', false);
  const result = spawnSync(process.execPath, ['/opt/h24/inspect-stdin.mjs', 'svg'], { input: Buffer.from('<svg/>'), encoding: 'utf8' });
  assert.equal(result.status, 30); assert.equal(result.stdout.trim(), 'H24_UNAVAILABLE');
});
