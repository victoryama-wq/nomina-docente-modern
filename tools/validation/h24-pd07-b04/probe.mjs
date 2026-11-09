import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { createCloudDocumentRunner } from '../../../apps/api/src/lib/document-cloud.ts';
import { createDocumentValidator } from '../../../apps/api/src/lib/document-analyzers-legacy.ts';

throw new Error('Archived analyzer probe: replay the historical candidate only in a separately authorized isolated laboratory.');

assert.equal(process.env.H24_PD07_B04_APPROVED, 'true');
const phase = process.argv[2]; assert(['baseline', 'candidate'].includes(phase));
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const id = randomUUID(), prefix = `h24-pd07-b04-${id.slice(0, 8)}`;
const output = path.join(repo, '.cache/pd07-b04', `${phase}-${id}`);
mkdirSync(output, { recursive: true });
const own = [], volumes = [];
const docker = args => execFileSync('docker', ['--context', 'desktop-linux', ...args], {
  cwd: repo, encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 8 * 1024 * 1024
});
const save = (name, value) => writeFileSync(path.join(output, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
const results = { phase, id, base: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  started: new Date().toISOString(), requests: [], cases: [], noDatabase: true };
const settings = { parser: 'http://127.0.0.1:58581', scanner: 'http://127.0.0.1:58582' };
const started = Date.now();
const instrumented = async (url, options) => {
  assert([settings.parser, settings.scanner].some(o => String(url).startsWith(`${o}/v1/check/`)));
  assert(results.requests.length < 32 && Date.now() - started < 15 * 60_000);
  const entry = { service: String(url).startsWith(settings.parser) ? 'inspector' : 'scanner',
    kind: String(url).split('/').at(-1), status: null, ms: 0 };
  results.requests.push(entry); const begin = Date.now();
  try { const response = await fetch(url, options); entry.status = response.status; return response; }
  finally { entry.ms = Date.now() - begin; save('progress.json', results); }
};
const pdf = await new Promise((resolve, reject) => {
  const doc = new PDFDocument(); const parts = [];
  doc.on('data', b => parts.push(b)); doc.on('error', reject); doc.on('end', () => resolve(Buffer.concat(parts)));
  doc.text('H24 PD07 B04 synthetic concurrency probe'); doc.end();
});
const raw = (kind) => instrumented(`${kind === 'av' ? settings.scanner : settings.parser}/v1/check/${kind}`, {
  method: 'POST', signal: AbortSignal.timeout(240000),
  headers: { 'Content-Type': 'application/octet-stream', 'X-H24-Request-Id': randomUUID() }, body: pdf
}).then(async r => ({ status: r.status, verdict: (await r.json()).code ?? null }));

console.log(`Evidence: ${output}`);
try {
  const info = JSON.parse(docker(['info', '--format', '{{json .}}'])); assert(info.MemTotal > 6 * 1024 ** 3);
  save('inventory-before.json', { containers: docker(['ps', '-a', '--format', '{{json .}}']), volumes: docker(['volume', 'ls', '--format', '{{json .}}']) });
  results.images = {};
  for (const mode of ['scanner', 'inspector']) {
    const tag = phase === 'baseline' ? `h24-pd07-e2e-efa3a0e9-${mode}` : `${prefix}-${mode}`;
    if (phase === 'candidate') save(`build-${mode}.log`, docker(['build', '--pull=false', '-f', `services/document-security/Dockerfile.${mode}`, '-t', tag, '.']));
    results.images[mode] = docker(['image', 'inspect', tag, '--format', '{{.Id}}']).trim();
  }
  const volume = `${prefix}-signatures`; volumes.push(volume); docker(['volume', 'create', '--label', 'purpose=h24-pd07-b04', volume]);
  docker(['run', '--rm', '--network', 'none', '--user', '0:0', '--entrypoint', '/bin/sh',
    '--mount', 'type=volume,source=h24-pd03-signatures-20261028,target=/source,readonly',
    '--mount', `type=volume,source=${volume},target=/var/lib/clamav,volume-nocopy`, results.images.scanner,
    '-c', 'cp -R /source/. /var/lib/clamav/ && chown -R 100:101 /var/lib/clamav']);
  for (const mode of ['scanner', 'inspector']) {
    const name = `${prefix}-${mode}`; own.push(name);
    docker(['run', '-d', '--pull', 'never', '--name', name, '--label', 'purpose=h24-pd07-b04', '--read-only', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges', '--memory', mode === 'scanner' ? '4g' : '512m', '--cpus', mode === 'scanner' ? '2' : '1',
      '--pids-limit', '64', '--tmpfs', '/tmp:rw,nosuid,noexec,size=128m,mode=1777', '-p', `127.0.0.1:${mode === 'scanner' ? 58582 : 58581}:8080`,
      ...(mode === 'scanner' ? ['--mount', `type=volume,source=${volume},target=/var/lib/clamav`] : []), results.images[mode]]);
  }
  for (const origin of Object.values(settings)) {
    let ready = false;
    for (let n = 0; n < 20 && !ready; n++) { try { ready = (await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) })).ok; } catch {} if (!ready) await new Promise(r => setTimeout(r, 500)); }
    assert(ready);
  }
  // The first pair includes a cold scanner/signature update; subsequent pairs are warm.
  for (const kind of ['pdf', 'av']) {
    const entries = await Promise.all([raw(kind), raw(kind)]);
    results.cases.push({ name: `${kind}-overlap`, entries });
    if (phase === 'candidate') assert(entries.every(r => r.status === 200 && r.verdict === 0));
  }
  const validate = createDocumentValidator(createCloudDocumentRunner(settings, async () => 'synthetic-local-only', instrumented));
  const clients = await Promise.allSettled([0, 1].map(async () => {
    const time = Date.now();
    await validate(pdf, 'application/pdf'); await validate(pdf, 'application/pdf');
    return { ms: Date.now() - time };
  }));
  results.cases.push({ name: 'two-clients-two-validations', entries: clients.map(r => r.status === 'fulfilled' ? r : { status: r.status, error: r.reason.code || r.reason.message }) });
  if (phase === 'candidate') assert(clients.every(r => r.status === 'fulfilled' && r.value.ms < 55000));
  results.expectedOutcome = phase === 'baseline' ? results.requests.some(r => r.status === 429) : true;
  assert(results.expectedOutcome);
} catch (error) { results.error = String(error); process.exitCode = 1; }
finally {
  results.elapsedMs = Date.now() - started; save('results.json', results);
  const cleanup = [];
  for (const name of own.reverse()) {
    try {
      const state = JSON.parse(docker(['inspect', name]))[0]; assert.equal(state.Config.Labels.purpose, 'h24-pd07-b04');
      save(`${name}-state.json`, { state: state.State, image: state.Image }); save(`${name}.log`, docker(['logs', name]));
      try { save(`${name}-resources.log`, docker(['exec', name, 'sh', '-c', 'cat /sys/fs/cgroup/memory.peak /sys/fs/cgroup/memory.events /sys/fs/cgroup/pids.current; if command -v ps >/dev/null; then ps -eo pid,ppid,stat,comm; fi'])); }
      catch (error) { save(`${name}-resource-error.json`, { error: String(error) }); }
      docker(['stop', '--time', '10', name]); docker(['rm', name]); cleanup.push({ name, removed: true });
    } catch (error) { cleanup.push({ name, error: String(error) }); process.exitCode = 1; }
  }
  for (const volume of volumes) {
    try { assert.equal(JSON.parse(docker(['volume', 'inspect', volume]))[0].Labels.purpose, 'h24-pd07-b04'); docker(['volume', 'rm', volume]); cleanup.push({ volume, removed: true }); }
    catch (error) { cleanup.push({ volume, error: String(error) }); process.exitCode = 1; }
  }
  save('cleanup.json', cleanup);
  console.log(JSON.stringify({ phase, cases: results.cases, error: results.error, evidence: output }));
}
