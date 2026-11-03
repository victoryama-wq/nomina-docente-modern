import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { createCheckServer } from './server.mjs';

const headers = () => ({ 'content-type': 'application/octet-stream', 'x-h24-request-id': randomUUID() });
async function harness(run, action, mode = 'inspector', options = {}) {
  const logs = [];
  const server = createCheckServer({ mode, run, log: e => logs.push(e), ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await action(`http://127.0.0.1:${server.address().port}`, logs); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('fixed routes, wrong modes, headers and size cannot reach parsers', async () => {
  await harness(async () => assert.fail('must not parse'), async url => {
    assert.equal((await fetch(url + '/health')).status, 200);
    assert.equal((await fetch(url + '/v1/check/av', { method: 'POST' })).status, 404);
    assert.equal((await fetch(url + '/v1/check/pdf', { method: 'POST', body: 'x' })).status, 400);
    assert.equal((await fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: '' })).status, 413);
    const status = await new Promise((resolve, reject) => {
      const request = http.request(url + '/v1/check/pdf', { method: 'POST', headers: { ...headers(), 'content-length': '7864321' } }, response => {
        response.resume(); resolve(response.statusCode);
      });
      request.on('error', reject); request.end('x');
    });
    assert.equal(status, 413);
  });
});
test('binds verdict to request and logs no bytes or token', async () => {
  await harness(async (kind, bytes) => {
    assert.equal(kind, 'png'); assert.equal(bytes.toString(), 'synthetic');
    return { code: 10, stdout: 'H24_INVALID', stderr: '' };
  }, async (url, logs) => {
    const h = headers();
    const r = await fetch(url + '/v1/check/png', { method: 'POST', headers: h, body: 'synthetic' });
    assert.deepEqual(await r.json(), { requestId: h['x-h24-request-id'], code: 10, stdout: 'H24_INVALID', stderr: '' });
    assert.deepEqual(Object.keys(logs[0]).sort(), ['event', 'severity', 'kind', 'code', 'durationMs'].sort());
  });
});
const until = async predicate => {
  for (let n = 0; n < 200 && !predicate(); n++) await new Promise(r => setTimeout(r, 5));
  assert(predicate(), 'Expected state was not reached');
};
test('one active plus one waiter, overflow is bound and failure releases the slot', async () => {
  let release; let enter;
  let calls = 0, active = 0, peak = 0;
  const started = new Promise(r => { enter = r; });
  await harness(async () => {
    calls++; active++; peak = Math.max(peak, active);
    try {
      if (calls === 1) { enter(); await new Promise(r => { release = r; }); throw Error('private data'); }
      return { code: 10, stdout: 'H24_INVALID', stderr: '' };
    } finally { active--; }
  }, async (url, logs) => {
    const first = fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: 'x' });
    await started;
    const second = fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: 'x' });
    await until(() => logs.some(e => e.outcome === 'queued'));
    const h = headers();
    const overflow = await fetch(url + '/v1/check/pdf', { method: 'POST', headers: h, body: 'x' });
    assert.equal(overflow.status, 429); assert.equal(overflow.headers.get('retry-after'), '2');
    assert.deepEqual(await overflow.json(), { requestId: h['x-h24-request-id'], error: 'BUSY' });
    release();
    const result = await first;
    assert.equal(result.status, 503); assert.equal((await result.text()).includes('private'), false);
    assert.equal((await second).status, 200);
    assert.equal((await fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: 'x' })).status, 200);
    assert.equal(peak, 1); assert.equal(calls, 3);
    assert(logs.some(e => e.outcome === 'granted'));
  });
});

test('queued request expires without analysis and the slot is reusable', async () => {
  let release, calls = 0;
  await harness(async () => {
    calls++; if (calls === 1) await new Promise(r => { release = r; });
    return { code: 10, stdout: 'H24_INVALID', stderr: '' };
  }, async (url, logs) => {
    const first = fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: 'x' });
    await until(() => calls === 1);
    const expired = await fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: 'x' });
    assert.equal(expired.status, 429); assert.equal(calls, 1);
    assert(logs.some(e => e.reason === 'queue_timeout'));
    release(); assert.equal((await first).status, 200);
    assert.equal((await fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: 'x' })).status, 200);
    assert.equal(calls, 2);
  }, 'inspector', { queueWaitMs: 40 });
});

test('disconnect removes a waiter without running it or blocking later requests', async () => {
  let release, calls = 0;
  await harness(async () => {
    calls++; if (calls === 1) await new Promise(r => { release = r; });
    return { code: 10, stdout: 'H24_INVALID', stderr: '' };
  }, async (url, logs) => {
    const first = fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: 'x' });
    await until(() => calls === 1);
    const abort = new AbortController();
    const second = fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: 'x', signal: abort.signal }).catch(() => null);
    await until(() => logs.some(e => e.outcome === 'queued')); abort.abort(); await second;
    await until(() => logs.some(e => e.outcome === 'cancelled'));
    release(); await first;
    assert.equal((await fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: 'x' })).status, 200);
    assert.equal(calls, 2);
  });
});

test('queue wait cannot be configured beyond its hard limit', () => {
  for (const queueWaitMs of [0, -1, 30001, Infinity, 1.5]) {
    assert.throws(() => createCheckServer({ mode: 'scanner', run: () => {}, queueWaitMs }), /QUEUE_WAIT_INVALID/);
  }
  const server = createCheckServer({ mode: 'scanner', run: () => {}, queueWaitMs: 30000 });
  server.close();
});

test('scanner transports a bounded limit verdict without logging document identity', async () => {
  const verdict = { code: 40, stdout: `H24_SCAN_LIMIT ${'a'.repeat(64)}`, stderr: '' };
  await harness(async kind => { assert.equal(kind, 'av'); return verdict; }, async (url, logs) => {
    const h = headers();
    const response = await fetch(url + '/v1/check/av', { method: 'POST', headers: h, body: 'synthetic' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { requestId: h['x-h24-request-id'], ...verdict });
    assert.equal(logs[0].code, 40);
    assert.equal(JSON.stringify(logs).includes(verdict.stdout), false);
    assert.equal(JSON.stringify(logs).includes(h['x-h24-request-id']), false);
  }, 'scanner');
});
