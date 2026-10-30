import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const image = process.env.H24_SCANNER_LIFECYCLE_IMAGE;
const enabled = process.env.RUN_H24_SCANNER_LIFECYCLE === 'true';
const fixture = fileURLToPath(new URL('./process-lifecycle-probe.mjs', import.meta.url));
function docker(args) {
  return execFileSync('docker', ['--context', 'desktop-linux', ...args], { encoding: 'utf8', timeout: 45_000, maxBuffer: 1024 * 1024, windowsHide: true });
}
function probe(entrypoint, args) {
  assert.match(image || '', /^sha256:[a-f0-9]{64}$/);
  return JSON.parse(docker(['run', '--rm', '--pull', 'never', '--network', 'none',
    '--label', 'purpose=h24-pd07-b02-lifecycle', '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--memory', '128m', '--cpus', '1', '--pids-limit', '64',
    '--mount', `type=bind,source=${fixture},target=/probe.mjs,readonly`,
    '--entrypoint', entrypoint, image, ...args]));
}

test('negative control reproduces orphan timeout zombies with Node as PID 1', { skip: !enabled }, () => {
  const result = probe('/usr/bin/node', ['/probe.mjs', '20']);
  assert.equal(result.deadlines, 2);
  assert.ok(result.after.processes.filter(p => p.name === 'timeout' && p.state === 'Z' && p.ppid === 1).length >= 20);
  assert.ok(result.after.pids >= result.before.pids + 20);
});

test('shipped scanner entrypoint reaps 100 successes and timeout exits below 64 PIDs', { skip: !enabled }, () => {
  assert.match(image || '', /^sha256:[a-f0-9]{64}$/);
  const info = JSON.parse(docker(['image', 'inspect', image]))[0];
  assert.deepEqual(info.Config.Entrypoint, ['/sbin/tini', '--', '/usr/bin/node', '/opt/h24/server.mjs']);
  const result = probe('/sbin/tini', ['--', '/usr/bin/node', '/probe.mjs', '100']);
  assert.equal(result.deadlines, 2);
  assert.equal(result.after.processes[0].name, 'tini');
  assert.equal(result.after.processes.filter(p => p.state === 'Z').length, 0);
  assert.equal(result.after.pids, result.before.pids);
  assert.ok(result.after.pids < 64);
});

test('shipped entrypoint serves health and forwards SIGTERM for clean shutdown', { skip: !enabled }, () => {
  assert.match(image || '', /^sha256:[a-f0-9]{64}$/);
  const name = `h24-pd07-b02-shutdown-${randomUUID()}`;
  docker(['run', '-d', '--pull', 'never', '--name', name, '--network', 'none',
    '--label', 'purpose=h24-pd07-b02-lifecycle', '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--memory', '128m', '--cpus', '1', '--pids-limit', '64', image]);
  try {
    const health = docker(['exec', name, '/usr/bin/node', '--input-type=module', '-e',
      `let ok=false;for(let n=0;n<20&&!ok;n++){try{const r=await fetch('http://127.0.0.1:8080/health',{signal:AbortSignal.timeout(500)});ok=r.status===200&&(await r.json()).ok===true;}catch{}if(!ok)await new Promise(r=>setTimeout(r,100));}if(!ok)process.exit(1);console.log('HEALTH_OK');`]);
    assert.equal(health.trim(), 'HEALTH_OK');
    docker(['stop', '--time', '12', name]);
    const state = JSON.parse(docker(['inspect', name]))[0].State;
    assert.equal(state.Running, false);
    assert.equal(state.ExitCode, 0);
    assert.equal(state.OOMKilled, false);
  } finally { docker(['rm', '-f', name]); }
});
