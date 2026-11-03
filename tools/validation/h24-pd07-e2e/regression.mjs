import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export async function runRegression(manifestPath) {
  assert.equal(process.env.H24_PD07_APPROVED, 'true');
  const resolved = path.resolve(manifestPath);
  const relative = path.relative(path.join(repo, '.cache/pd07-e2e'), resolved);
  assert.match(relative.replaceAll('\\', '/'), /^[0-9a-f-]{36}\/manifest\.json$/);
  const source = JSON.parse(readFileSync(resolved, 'utf8'));
  assert.equal(source.testExit, 0, 'Requires completed capacity evidence');
  assert.equal(JSON.parse(readFileSync(path.join(path.dirname(resolved), 'results.json'), 'utf8')).passed, true);
  for (const [file, expected] of Object.entries(source.hashes)) {
    assert(!path.isAbsolute(file) && !file.split(/[\\/]/).includes('..'));
    assert.equal(createHash('sha256').update(readFileSync(path.join(repo, file))).digest('hex'), expected, file);
  }
  const id = randomUUID(); const prefix = `h24-pd07-regression-${id.slice(0, 8)}`;
  const evidence = path.join(path.dirname(resolved), `regression-${id}`); mkdirSync(evidence);
  const save = (file, value) => writeFileSync(path.join(evidence, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  const docker = args => execFileSync('docker', ['--context', 'desktop-linux', ...args],
    { cwd: repo, encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  const own = []; const cleanup = []; let exit = 1;
  const run = (name, args, image) => {
    assert.equal(docker(['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.ID}}']).trim(), '');
    own.push(name); docker(['run', '-d', '--pull', 'never', '--name', name, '--label', 'purpose=h24-pd07-regression', ...args, image]);
  };
  try {
    assert.match(source.images.api, /^sha256:[0-9a-f]{64}$/);
    docker(['image', 'inspect', source.images.api]);
    const pg = `${prefix}-db`, api = `${prefix}-api`;
    run(pg, ['--memory', '3g', '--memory-swap', '3g', '--cpus', '2', '--pids-limit', '128',
      '--tmpfs', '/var/lib/postgresql:rw,nosuid,size=2147483648', '-e', 'POSTGRES_DB=nomina_docente_test',
      '-e', 'POSTGRES_USER=app_nomina', '-e', 'POSTGRES_PASSWORD=pd07_synthetic_only'], 'postgres:18');
    for (let n = 0; n < 30; n++) {
      try { docker(['exec', pg, 'pg_isready', '-U', 'app_nomina', '-d', 'nomina_docente_test']); break; }
      catch { await new Promise(r => setTimeout(r, 1000)); }
    }
    const guard = JSON.parse(docker(['inspect', pg]))[0];
    assert.equal(guard.Config.Labels.purpose, 'h24-pd07-regression');
    assert(!guard.Mounts.some(m => ['bind', 'volume'].includes(m.Type)));
    assert.equal(Object.keys(guard.HostConfig.PortBindings || {}).length, 0);
    save('database-guard.json', { id: guard.Id, image: guard.Image, mounts: guard.Mounts, portBindings: guard.HostConfig.PortBindings });
    const env = ['NODE_ENV=test', 'H24_PD07_E2E=approved-local', 'DB_NAME=nomina_docente_test', 'DB_HOST=127.0.0.1',
      'DB_PORT=5432', 'DB_USER=app_nomina', 'DB_PASSWORD=pd07_synthetic_only', 'MIGRATION_ENV=test',
      'TEST_DB_NAME=nomina_docente_test', 'TEST_DB_HOST=127.0.0.1', 'TEST_DB_PORT=5432', 'TEST_DB_USER=app_nomina',
      'TEST_DB_PASSWORD=pd07_synthetic_only', 'FIREBASE_PROJECT_ID=demo-h24-pd07', 'GCP_PROJECT_ID=demo-h24-pd07',
      'CONSTANCIAS_BUCKET=synthetic-pd07-only', 'DOSSIER_STORAGE_MODE=local', 'DOSSIER_PDFINFO_PATH=/usr/bin/pdfinfo'];
    run(api, ['--network', `container:${pg}`, '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--memory', '1g', '--cpus', '2', '--pids-limit', '128', '--tmpfs', '/tmp:rw,nosuid,noexec,size=1g,mode=1777',
      '--mount', `type=bind,source=${evidence},target=/evidence`, ...env.flatMap(v => ['-e', v])], source.images.api);
    save('bootstrap.log', docker(['exec', api, 'node', 'tools/validation/h24-pd07-e2e/bootstrap.mjs']));
    exit = await new Promise((resolve, reject) => {
      let output = '';
      const child = spawn('docker', ['--context', 'desktop-linux', 'exec', api, 'node', 'node_modules/vitest/vitest.mjs',
        'run', '--configLoader', 'native', '--config', 'tools/validation/h24-pd07-e2e/integration.config.mjs'], { windowsHide: true });
      child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
      const timer = setTimeout(() => child.kill(), 900000);
      child.on('error', reject); child.on('close', code => { clearTimeout(timer); save('integration.log', output); resolve(code ?? 1); });
    });
    save('result.json', { exit, sourceManifest: resolved, image: source.images.api });
    save('disk-after.log', docker(['exec', pg, 'df', '-h', '/var/lib/postgresql']));
  } finally {
    for (const name of own.reverse()) {
      try {
        const state = JSON.parse(docker(['inspect', name]))[0];
        assert.equal(state.Config.Labels.purpose, 'h24-pd07-regression');
        save(`${name}-state.json`, state.State);
        save(`${name}.log`, docker(['logs', '--tail', '200', name]));
        docker(['stop', '--time', '10', name]); docker(['rm', name]); cleanup.push({ name, removed: true });
      } catch (e) { cleanup.push({ name, error: String(e) }); exit = 1; }
    }
    save('cleanup.json', cleanup);
  }
  console.log(`Regression exit=${exit}; evidence=${evidence}`);
  return exit;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runRegression(process.argv[2]);
}
