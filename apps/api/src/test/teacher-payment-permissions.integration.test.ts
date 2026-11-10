import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import { cleanupTestApp, describeIntegration, freshTestApp, TEST_IDS } from './api-integration-helpers.js';
import { adminActor, coordinatorActor, financeActor, rhActor } from './fixtures/index.js';
import { connectTestDb } from './db/test-db-utils.js';

const suite = describeIntegration ? describe : describe.skip;
const body = { firstNames: 'Docente', paternalLastName: 'Sintetico', category: 'N', phone: '9981112233' };
suite('Coordinator payment prohibition with real PostgreSQL persistence', () => {
  let app: FastifyInstance | null = null;
  beforeEach(async () => { app = await freshTestApp(); });
  afterEach(async () => { await cleanupTestApp(app); app = null; });
  async function stored(id: string) {
    const client = await connectTestDb();
    try { return (await client.query('SELECT payment_type, phone, category, created_by FROM teachers WHERE id=$1', [id])).rows[0]; }
    finally { await client.end(); }
  }
  it.each([false, true])('creates undefined payment and preserves the persisted payment on operational edits (fiscal.manage=%s)', async accidental => {
    const actor = coordinatorActor();
    if (accidental) actor.permissions.push('fiscal.manage');
    const created = await injectAs(app!, actor, { method: 'POST', url: '/api/teachers', payload: body });
    expect(created.statusCode, created.body).toBe(201);
    const id = created.json().teacher.id;
    expect(await stored(id)).toMatchObject({ payment_type: '', category: 'N', created_by: actor.id });
    const authorized = await injectAs(app!, adminActor(), { method: 'PATCH', url: `/api/teachers/${id}/fiscal`, payload: { paymentType: '2' } });
    expect(authorized.statusCode, authorized.body).toBe(200);
    const edited = await injectAs(app!, actor, { method: 'PATCH', url: `/api/teachers/${id}`, payload: { ...body, phone: '9982223344' } });
    expect(edited.statusCode, edited.body).toBe(200);
    expect(await stored(id)).toMatchObject({ payment_type: '2', phone: '9982223344', category: 'N' });
    for (const paymentType of ['2', 'E', '', null, 'invalid']) {
      for (const method of ['POST', 'PATCH'] as const) {
        const denied = await injectAs(app!, actor, { method, url: method === 'POST' ? '/api/teachers' : `/api/teachers/${id}`, payload: { ...body, paymentType } });
        expect(denied.statusCode, denied.body).toBe(403);
        expect(denied.json().code).toBe('COORDINATOR_PAYMENT_FORBIDDEN');
      }
      expect(await stored(id)).toMatchObject({ payment_type: '2', phone: '9982223344' });
    }
    const outsideBefore = await stored(TEST_IDS.teacherMulti);
    const outside = await injectAs(app!, actor, { method: 'PATCH', url: `/api/teachers/${TEST_IDS.teacherMulti}`, payload: body });
    // Existing ownership contract uses REQUEST_ERROR/400; this candidate preserves it.
    expect(outside.statusCode, outside.body).toBe(400);
    expect(outside.json().message).toContain('capturados por tu usuario');
    expect(await stored(TEST_IDS.teacherMulti)).toEqual(outsideBefore);
  });
  it('denies alternative fiscal and import routes despite accidental fiscal permission', async () => {
    const actor = coordinatorActor(); actor.permissions.push('fiscal.manage', 'fiscal.view');
    const before = await stored(TEST_IDS.teacherIdiomas);
    expect((await injectAs(app!, actor, { method: 'PATCH', url: `/api/teachers/${TEST_IDS.teacherIdiomas}/fiscal`, payload: { paymentType: 'E' } })).statusCode).toBe(403);
    for (const route of ['preview', 'apply']) {
      expect((await injectAs(app!, actor, { method: 'POST', url: `/api/teachers/import/${route}`, payload: { paymentType: 'E' } })).statusCode).toBe(403);
    }
    expect(await stored(TEST_IDS.teacherIdiomas)).toEqual(before);
  });
  it('keeps authorized fiscal payment management and rejects validation without writes', async () => {
    for (const actor of [adminActor(), financeActor(), rhActor()]) {
      const before = await stored(TEST_IDS.teacherIdiomas);
      const invalid = await injectAs(app!, actor, { method: 'PATCH', url: `/api/teachers/${TEST_IDS.teacherIdiomas}/fiscal`, payload: { paymentType: 'E', email: 'invalid', rfc: 'bad' } });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().fieldErrors).toEqual({ rfc: 'INVALID_FORMAT', email: 'INVALID_FORMAT' });
      expect(await stored(TEST_IDS.teacherIdiomas)).toEqual(before);
      const valid = await injectAs(app!, actor, { method: 'PATCH', url: `/api/teachers/${TEST_IDS.teacherIdiomas}/fiscal`, payload: { paymentType: 'E', fiscalPostalCode: '00123' } });
      expect(valid.statusCode, valid.body).toBe(200);
      expect(valid.json().teacher.fiscalPostalCode).toBe('00123');
      expect((await stored(TEST_IDS.teacherIdiomas)).payment_type).toBe('E');
    }
  });
});
