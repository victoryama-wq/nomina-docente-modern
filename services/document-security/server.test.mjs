import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { createCheckServer } from './server.mjs';

const headers = () => ({ 'content-type': 'application/octet-stream', 'x-h24-request-id': randomUUID() });
async function harness(run, action, mode = 'inspector') {
  const logs = [];
  const server = createCheckServer({ mode, run, log: e => logs.push(e) });
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
test('bounded concurrency, failure sanitized and capacity restored', async () => {
  let release; let enter;
  const started = new Promise(r => { enter = r; });
  await harness(async () => { enter(); await new Promise(r => { release = r; }); throw Error('private data'); }, async url => {
    const first = fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: 'x' });
    await started;
    assert.equal((await fetch(url + '/v1/check/pdf', { method: 'POST', headers: headers(), body: 'x' })).status, 429);
    release();
    const result = await first;
    assert.equal(result.status, 503); assert.equal((await result.text()).includes('private'), false);
  });
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
