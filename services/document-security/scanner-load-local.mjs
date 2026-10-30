// Explicit local scanner load only. No API, database, GCS or real documents.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';

assert.equal(process.env.RUN_H24_SCANNER_LOAD, 'true');
const container = 'h24-pd07-b02-scanner';
const origin = 'http://127.0.0.1:5262';
const evidence = path.resolve('.cache/pd07-b02-20261030');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function docker(args) {
  return execFileSync('docker', ['--context', 'desktop-linux', ...args], { encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true });
}
const info = JSON.parse(docker(['inspect', container]))[0];
assert.equal(info.Config.Labels.purpose, 'h24-pd07-b02');
assert.equal(info.HostConfig.PidsLimit, 64);
assert.equal(info.HostConfig.Memory, 4 * 1024 ** 3);
assert.equal(info.HostConfig.PortBindings['8080/tcp'][0].HostIp, '127.0.0.1');
assert.deepEqual(info.Config.Entrypoint, ['/sbin/tini', '--', '/usr/bin/node', '/opt/h24/server.mjs']);

async function pdf(index) {
  const doc = new PDFDocument();
  const chunks = [];
  const result = new Promise((resolve, reject) => {
    doc.on('data', b => chunks.push(b)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
  });
  doc.text(`H24 PD07-B02 synthetic document ${index}. No personal data.`); doc.end();
  return result;
}
const metricsCode = `const fs=require('fs');const rows=[];
for(const id of fs.readdirSync('/proc'))if(/^\\d+$/.test(id)){try{
const s=fs.readFileSync('/proc/'+id+'/stat','utf8'),e=s.lastIndexOf(')'),f=s.slice(e+2).split(' ');
rows.push({pid:Number(id),name:s.slice(s.indexOf('(')+1,e),state:f[0],ppid:Number(f[1])});}catch{}}
console.log(JSON.stringify({pids:Number(fs.readFileSync('/sys/fs/cgroup/pids.current','utf8')),
memory:Number(fs.readFileSync('/sys/fs/cgroup/memory.current','utf8')),processes:rows,
requestDirectories:fs.readdirSync('/tmp').filter(x=>x.startsWith('h24-request-'))}));`;
const snapshot = () => JSON.parse(docker(['exec', container, '/usr/bin/node', '-e', metricsCode]));
const report = { image: info.Image, startedAt: new Date().toISOString(), files: [], checks: 0, busy: 0,
  snapshots: [], limitations: ['Scanner HTTP only, not API/DB/GCS/Hosting or Firebase sessions',
    'Two bounded synthetic clients with explicit 429 retry; not an application queue'], passed: false };
const started = Date.now();
const deadline = started + 15 * 60_000;
async function check(bytes) {
  const requestId = randomUUID();
  const digest = createHash('sha256').update(bytes).digest('hex');
  while (Date.now() < deadline) {
    const r = await fetch(`${origin}/v1/check/av`, { method: 'POST', headers: {
      'content-type': 'application/octet-stream', 'x-h24-request-id': requestId
    }, body: bytes, signal: AbortSignal.timeout(230_000) });
    if (r.status === 429) { report.busy++; await r.arrayBuffer(); await pause(350); continue; }
    assert.equal(r.status, 200);
    const verdict = await r.json();
    assert.equal(verdict.requestId, requestId);
    assert.equal(verdict.code, 0, JSON.stringify(verdict));
    assert.equal(verdict.stdout, `H24_AV_OK ${digest}`);
    assert.equal(verdict.stderr, '');
    report.checks++;
    return;
  }
  throw Error('Bounded load deadline exceeded');
}

try {
  assert.equal((await fetch(`${origin}/health`)).status, 200);
  report.cold = snapshot();
  // Real runner includes freshclam on the first request; subsequent requests use its normal six-hour cache.
  const warm = Date.now(); await check(await pdf('warmup'));
  report.warmupMs = Date.now() - warm;
  // mkdtemp/freshclam initialize Node's libuv pool. Compare warm idle with warm idle,
  // not a cold process against an initialized pool, and allow watchdog exit/reaping.
  await pause(1500);
  report.before = snapshot();
  await Promise.all([0, 1].map(async client => {
    for (let n = 0; n < 10; n++) {
      const bytes = await pdf(`${client}-${n}`); const start = Date.now();
      // Same AV volume as initial upload + publication validation + later read.
      for (let phase = 0; phase < 3; phase++) await check(bytes);
      report.files.push({ client, index: n, bytes: bytes.length, ms: Date.now() - start });
      report.snapshots.push(snapshot());
      console.log(JSON.stringify({ completedFiles: report.files.length, checks: report.checks, busy: report.busy }));
    }
  }));
  await pause(1500);
  report.after = snapshot();
  assert.equal(report.files.length, 20);
  assert.equal(report.checks, 61);
  assert.equal(report.after.processes.filter(p => p.state === 'Z').length, 0);
  assert.equal(report.after.requestDirectories.length, 0);
  assert.equal(report.after.pids, report.before.pids, 'No cumulative process growth after warmup');
  assert.equal((await fetch(`${origin}/health`)).status, 200);
  report.passed = true;
} catch (error) {
  report.error = String(error); process.exitCode = 1;
} finally {
  report.elapsedMs = Date.now() - started;
  report.finalContainerState = JSON.parse(docker(['inspect', container]))[0].State;
  await mkdir(evidence, { recursive: true });
  await writeFile(path.join(evidence, 'scanner-load-results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, files: report.files.length, checks: report.checks,
    busy: report.busy, elapsedMs: report.elapsedMs, error: report.error }));
}
