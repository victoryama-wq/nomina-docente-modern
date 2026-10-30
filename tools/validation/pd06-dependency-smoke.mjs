import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as grpc from '@grpc/grpc-js';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const require = createRequire(import.meta.url);

test('PD-06 every locked gRPC copy and both Firebase consumer paths use the fixed resolution', async () => {
  const lock = JSON.parse(await readFile(new URL('../../package-lock.json', import.meta.url), 'utf8'));
  const copies = Object.entries(lock.packages).filter(([key]) => key.endsWith('/@grpc/grpc-js'));
  assert.ok(copies.length > 0);
  for (const [, info] of copies) assert.equal(info.version, '1.14.7');
  const webRequire = createRequire(require.resolve('@firebase/firestore'));
  const adminRequire = createRequire(require.resolve('@google-cloud/firestore'));
  const gaxRequire = createRequire(adminRequire.resolve('google-gax'));
  for (const consumer of [webRequire, gaxRequire]) {
    assert.equal(consumer('@grpc/grpc-js/package.json').version, '1.14.7');
  }
  assert.equal(require('zod/package.json').version, '4.6.7');
});

test('PD-06 Firebase Auth SDK initialization works without credentials or remote calls', async () => {
  const web = initializeApp({ projectId: 'demo-pd06', apiKey: 'synthetic-offline', appId: 'synthetic-pd06' }, 'pd06-web');
  const admin = initializeAdmin({ projectId: 'demo-pd06' }, 'pd06-admin');
  try {
    assert.equal(getAuth(web).app.name, 'pd06-web');
    assert.equal(getAdminAuth(admin).app.name, 'pd06-admin');
  } finally { await deleteApp(web); await deleteAdmin(admin); }
});

test('PD-06 overridden gRPC completes unary and streaming calls on ephemeral loopback only', async () => {
  const serialize = value => Buffer.from(JSON.stringify(value));
  const deserialize = bytes => JSON.parse(bytes.toString('utf8'));
  const definition = streaming => ({ path: streaming ? '/pd06/stream' : '/pd06/echo',
    requestStream: false, responseStream: streaming,
    requestSerialize: serialize, requestDeserialize: deserialize,
    responseSerialize: serialize, responseDeserialize: deserialize });
  const server = new grpc.Server();
  server.addService({ echo: definition(false), stream: definition(true) }, {
    echo: (call, callback) => callback(null, { received: call.request.value }),
    stream: call => { call.write({ received: call.request.value }); call.write({ done: true }); call.end(); }
  });
  let client;
  try {
    const port = await new Promise((resolve, reject) => server.bindAsync('127.0.0.1:0',
      grpc.ServerCredentials.createInsecure(), (error, value) => error ? reject(error) : resolve(value)));
    client = new grpc.Client(`127.0.0.1:${port}`, grpc.credentials.createInsecure());
    const response = await new Promise((resolve, reject) => client.makeUnaryRequest('/pd06/echo', serialize,
      deserialize, { value: 'synthetic' }, { deadline: Date.now() + 5000 },
      (error, value) => error ? reject(error) : resolve(value)));
    assert.deepEqual(response, { received: 'synthetic' });
    const values = [];
    const stream = client.makeServerStreamRequest('/pd06/stream', serialize, deserialize,
      { value: 'synthetic' }, { deadline: Date.now() + 5000 });
    stream.on('data', value => values.push(value));
    await once(stream, 'end');
    assert.deepEqual(values, [{ received: 'synthetic' }, { done: true }]);
  } finally {
    client?.close();
    await new Promise(resolve => server.tryShutdown(resolve));
  }
});
