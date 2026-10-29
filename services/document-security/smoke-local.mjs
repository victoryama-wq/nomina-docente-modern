import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { execFileSync } from 'node:child_process';

const inspector = 'http://127.0.0.1:5261';
const scanner = 'http://127.0.0.1:5262';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function pdf(active = false) {
  return new Promise(resolve => {
    const d = new PDFDocument(); const chunks = [];
    d.on('data', b => chunks.push(b)); d.on('end', () => resolve(Buffer.concat(chunks)));
    d.text('H24 synthetic cloud transport test. No personal data.');
    if (active) d.addNamedJavaScript('inert', 'void 0;');
    d.end();
  });
}
async function check(origin, kind, bytes, code, output) {
  const requestId = randomUUID(); const start = Date.now();
  const response = await fetch(`${origin}/v1/check/${kind}`, { method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'x-h24-request-id': requestId },
    body: bytes, signal: AbortSignal.timeout(230000) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.requestId, requestId); assert.equal(result.code, code);
  assert.equal(result.stdout, output); assert.equal(result.stderr, '');
  console.log(JSON.stringify({ kind, code, durationMs: Date.now() - start }));
}
const clean = await pdf();
await check(inspector, 'pdf', clean, 0, `H24_POLICY_V1_PDF_OK ${digest(clean)}`);
await check(inspector, 'pdf', await pdf(true), 10, 'H24_INVALID');
await check(inspector, 'pdf', Buffer.from('%PDF-1.7\ntruncated'), 10, 'H24_INVALID');
for (const format of ['png', 'jpeg']) {
  const bytes = execFileSync('docker', ['--context', 'desktop-linux', 'exec', 'h24-cloud-inspector-test',
    'node', '--input-type=module', '-e',
    `import sharp from 'sharp';process.stdout.write(await sharp({create:{width:32,height:32,channels:3,background:'#abcdef'}}).${format}().toBuffer())`], { windowsHide: true });
  await check(inspector, format, bytes, 0, `H24_POLICY_V1_${format.toUpperCase()}_OK ${digest(bytes)}`);
  await check(scanner, 'av', bytes, 0, `H24_AV_OK ${digest(bytes)}`);
}
await check(scanner, 'av', clean, 0, `H24_AV_OK ${digest(clean)}`);
