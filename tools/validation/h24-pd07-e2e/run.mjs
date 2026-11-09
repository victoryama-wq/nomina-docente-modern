import assert from 'node:assert/strict';
throw new Error('Archived analyzer capacity harness: not valid for H24 BASIC_ENVELOPE_V1. Use the historical candidate for separately authorized replay.');
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
assert.equal(process.env.H24_PD07_APPROVED, 'true', 'Explicit disposable local laboratory approval required');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const id = randomUUID(); const prefix = `h24-pd07-e2e-${id.slice(0, 8)}`;
const evidence = path.join(repo, '.cache', 'pd07-e2e', id); mkdirSync(evidence, { recursive: true });
const label = 'purpose=h24-pd07-e2e'; const own = [], volumes = [];
const docker = args => execFileSync('docker', ['--context', 'desktop-linux', ...args], { cwd: repo, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
const save = (n, v) => writeFileSync(path.join(evidence, n), typeof v === 'string' ? v : JSON.stringify(v, null, 2));
const sha = f => createHash('sha256').update(readFileSync(path.join(repo, f))).digest('hex');
const manifest = { id, started: new Date().toISOString(), base: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  hashes: Object.fromEntries(['package-lock.json', 'apps/api/src/lib/dossier-contract.ts', 'apps/api/src/lib/teacher-dossier.ts',
    'apps/web/src/composables/useDossierOperations.ts', 'services/document-security/server.mjs',
    'tools/validation/h24-pd03/scan-stdin.sh', 'tools/validation/h24-pd07-e2e/flow.test.ts'].map(f => [f, sha(f)])), evidence };
console.log(`Evidence: ${evidence}`); save('manifest.json', manifest);
async function command(args, file, timeout = 1800000) {
  return new Promise((resolve, reject) => {
    let output = ''; const child = spawn('docker', ['--context', 'desktop-linux', ...args], { cwd: repo, windowsHide: true });
    child.stdout.on('data', b => { output += b; process.stdout.write(b); }); child.stderr.on('data', b => { output += b; process.stdout.write(b); });
    const timer = setTimeout(() => child.kill(), timeout);
    child.on('error', reject); child.on('close', code => { clearTimeout(timer); save(file, output); resolve(code); });
  });
}
function run(name, args, image, cmd = []) {
  assert.equal(docker(['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.ID}}']).trim(), '');
  own.push(name);
  return docker(['run', '-d', '--pull', 'never', '--name', name, '--label', label, ...args, image, ...cmd]).trim();
}
const hardened = ['--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges'];
const env = ['NODE_ENV=test', 'H24_PD07_E2E=approved-local', 'DB_NAME=nomina_docente_test', 'DB_HOST=127.0.0.1', 'DB_PORT=5432',
  'DB_USER=app_nomina', 'DB_PASSWORD=pd07_synthetic_only', 'FIREBASE_PROJECT_ID=demo-h24-pd07', 'GCP_PROJECT_ID=demo-h24-pd07',
  'CONSTANCIAS_BUCKET=synthetic-pd07-only', 'DOSSIER_STORAGE_MODE=local', 'DOSSIER_PDFINFO_PATH=/usr/bin/pdfinfo', 'MIGRATION_ENV=test'];
if (process.env.H24_PD07_FOLLOWUP === 'true') env.push('H24_PD07_FOLLOWUP=true');
let timer;
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tools/validation/h24-pd07-e2e/tsconfig.json'], { cwd: repo, encoding: 'utf8', timeout: 120000 });
  const info = JSON.parse(docker(['info', '--format', '{{json .}}'])); assert(info.MemTotal >= 7.5 * 1024 ** 3 && info.NCPU >= 4);
  save('inventory-before.json', { containers: docker(['ps', '-a', '--format', '{{json .}}']), volumes: docker(['volume', 'ls', '--format', '{{json .}}']) });
  const base = docker(['image', 'inspect', 'nomina-regression:h24-pd06-local-20261029', '--format', '{{.Id}}']).trim();
  const baseLock = docker(['run', '--rm', '--network', 'none', '--entrypoint', 'sha256sum', base, '/app/package-lock.json']).split(' ')[0];
  assert.equal(baseLock, sha('package-lock.json'), 'Regression dependencies must match current lockfile');
  for (const [tag, file, extra] of [
    [`${prefix}-api`, 'tools/validation/h24-pd07-e2e/Dockerfile', ['--build-arg', 'BASE=nomina-regression:h24-pd06-local-20261029']],
    [`${prefix}-runtime`, 'apps/api/Dockerfile', []],
    [`${prefix}-scanner`, 'services/document-security/Dockerfile.scanner', []],
    [`${prefix}-inspector`, 'services/document-security/Dockerfile.inspector', []]
  ]) assert.equal(await command(['build', '--pull=false', '-f', file, '-t', tag, ...extra, '.'], `build-${tag}.log`), 0);
  manifest.images = Object.fromEntries(['api', 'runtime', 'scanner', 'inspector'].map(k => [k, docker(['image', 'inspect', `${prefix}-${k}`, '--format', '{{.Id}}']).trim()])); save('manifest.json', manifest);
  assert.equal(await command(['run', '--rm', '--network', 'none', ...hardened, '--memory', '512m', '--cpus', '1', '--pids-limit', '64',
    '--mount', `type=bind,source=${evidence},target=/evidence`, '--mount', `type=bind,source=${path.join(repo, 'tools/validation/h24-pd07-e2e/images.mjs')},target=/probe.mjs,readonly`,
    '--entrypoint', 'node', manifest.images.inspector, '/probe.mjs'], 'images.log'), 0);
  const volume = `${prefix}-signatures`; volumes.push(volume); docker(['volume', 'create', '--label', label, volume]);
  assert.equal(await command(['run', '--rm', '--network', 'none', '--user', '0:0', ...hardened, '--cap-add', 'CHOWN', '--cap-add', 'DAC_OVERRIDE', '--memory', '256m', '--pids-limit', '32',
    '--mount', 'type=volume,source=h24-pd03-signatures-20261028,target=/source,readonly', '--mount', `type=volume,source=${volume},target=/var/lib/clamav,volume-nocopy`,
    '--entrypoint', '/bin/sh', manifest.images.scanner, '-c', 'cp -R /source/. /var/lib/clamav/ && chown -R 100:101 /var/lib/clamav'], 'signature-copy.log'), 0);
  const pgImage = docker(['image', 'inspect', 'postgres:18', '--format', '{{.Id}}']).trim();
  const pg = `${prefix}-db`;
  // The only published PostgreSQL port is a new loopback test port; no shared mounts.
  run(pg, ['--memory', '512m', '--cpus', '1', '--pids-limit', '128', '--tmpfs', '/var/lib/postgresql:rw,nosuid,size=268435456',
    '-p', '127.0.0.1:58328:5432', '-e', 'POSTGRES_DB=nomina_docente_test', '-e', 'POSTGRES_USER=app_nomina', '-e', 'POSTGRES_PASSWORD=pd07_synthetic_only'], pgImage);
  const network = ['--network', `container:${pg}`];
  for (let n = 0; n < 30; n++) { try { docker(['exec', pg, 'pg_isready', '-U', 'app_nomina', '-d', 'nomina_docente_test']); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const dbInspect = JSON.parse(docker(['inspect', pg]))[0]; assert.equal(dbInspect.Config.Labels.purpose, 'h24-pd07-e2e');
  assert(!dbInspect.Mounts.some(m => ['bind', 'volume'].includes(m.Type))); save('database-guard.json', { name: pg, image: pgImage, ports: dbInspect.NetworkSettings.Ports, mounts: dbInspect.Mounts });
  run(`${prefix}-scanner`, [...network, ...hardened, '--memory', '4g', '--memory-swap', '4g', '--cpus', '2', '--pids-limit', '64', '--tmpfs', '/tmp:rw,nosuid,noexec,size=128m,mode=1777',
    '--mount', `type=volume,source=${volume},target=/var/lib/clamav`, '-e', 'PORT=58082'], manifest.images.scanner);
  run(`${prefix}-inspector`, [...network, ...hardened, '--memory', '512m', '--cpus', '1', '--pids-limit', '64', '--tmpfs', '/tmp:rw,nosuid,noexec,size=128m,mode=1777', '-e', 'PORT=58081'], manifest.images.inspector);
  const api = `${prefix}-api`;
  run(api, [...network, ...hardened, '--memory', '1g', '--cpus', '2', '--pids-limit', '128', '--tmpfs', '/tmp:rw,nosuid,noexec,size=1g,mode=1777',
    '--mount', `type=bind,source=${evidence},target=/evidence`, ...env.flatMap(v => ['-e', v])], manifest.images.api);
  save('versions.log', docker(['exec', api, 'sh', '-c', 'node --version && npm --version']));
  assert.equal(await command(['exec', api, 'node', 'tools/validation/h24-pd07-e2e/bootstrap.mjs'], 'bootstrap.log', 300000), 0);
  docker(['exec', pg, 'pg_dump', '-U', 'app_nomina', '-d', 'nomina_docente_test', '-Fc', '-f', '/tmp/synthetic-before.dump']);
  docker(['cp', `${pg}:/tmp/synthetic-before.dump`, path.join(evidence, 'synthetic-before.dump')]);
  const metrics = []; timer = setInterval(() => { try { metrics.push({ time: new Date().toISOString(), stats: docker(['stats', '--no-stream', '--format', '{{json .}}', api, `${prefix}-scanner`, `${prefix}-inspector`, pg]) }); save('metrics.json', metrics); } catch {} }, 5000);
  const result = await command(['exec', api, 'node', 'node_modules/vitest/vitest.mjs', 'run', '--configLoader', 'native', '--config', 'tools/validation/h24-pd07-e2e/vitest.config.mjs'], 'flow.log', 2 * 60 * 60_000);
  manifest.testExit = result; save('manifest.json', manifest); if (result !== 0) process.exitCode = 1;
  if (result === 0 && process.env.H24_PD07_REGRESSION === 'true') {
    // General regression repeatedly rebuilds schemas/WAL. Give it a separate
    // disposable database; capacity's 256 MiB data limit remains unchanged.
    const { runRegression } = await import('./regression.mjs');
    const regression = await runRegression(path.join(evidence, 'manifest.json'));
    manifest.integrationExit = regression; save('manifest.json', manifest); if (regression !== 0) process.exitCode = 1;
  }
} catch (e) { save('failure.json', { error: String(e) }); console.error(e); process.exitCode = 1; }
finally {
  clearInterval(timer);
  const cleanup = [];
  for (const name of own.reverse()) {
    try {
      const state = JSON.parse(docker(['inspect', name]))[0]; assert.equal(state.Config.Labels.purpose, 'h24-pd07-e2e');
      save(`${name}-state.json`, { state: state.State, image: state.Image }); save(`${name}.log`, docker(['logs', name]));
      try { save(`${name}-processes.log`, docker(['exec', name, 'sh', '-c', 'if command -v ps >/dev/null; then ps -eo pid,ppid,stat,comm; fi; cat /sys/fs/cgroup/memory.peak /sys/fs/cgroup/memory.events /sys/fs/cgroup/pids.current'])); } catch {}
      docker(['stop', '--time', '10', name]); docker(['rm', name]); cleanup.push({ name, removed: true });
    } catch (e) { cleanup.push({ name, error: String(e) }); process.exitCode = 1; }
  }
  for (const v of volumes) { try { assert.equal(JSON.parse(docker(['volume', 'inspect', v]))[0].Labels.purpose, 'h24-pd07-e2e'); docker(['volume', 'rm', v]); cleanup.push({ volume: v, removed: true }); } catch (e) { cleanup.push({ volume: v, error: String(e) }); process.exitCode = 1; } }
  save('cleanup.json', cleanup); save('inventory-after.json', { containers: docker(['ps', '-a', '--format', '{{json .}}']), volumes: docker(['volume', 'ls', '--format', '{{json .}}']) });
  console.log(`Evidence retained locally: ${evidence}`);
}
