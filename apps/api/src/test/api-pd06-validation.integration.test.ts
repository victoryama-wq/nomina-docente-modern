import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import { TEST_IDS, cleanupTestApp, describeIntegration, freshTestApp, payrollInput, scheduleBody } from './api-integration-helpers.js';
import { adminActor } from './fixtures/index.js';
import { connectTestDb } from './db/test-db-utils.js';

const describeIfDb = describeIntegration ? describe : describe.skip;
describeIfDb('PD-06 real route validation contracts', () => {
  let app: FastifyInstance | null = null;
  beforeEach(async () => { app = await freshTestApp(); });
  afterEach(async () => { await cleanupTestApp(app); app = null; });

  it('preserves zero defaults and decimal transformation for omitted schedule hours', async () => {
    const payload = scheduleBody();
    for (const key of ['hoursM', 'hoursX', 'hoursJ', 'hoursV', 'hoursS1', 'hoursS2']) {
      delete (payload as Record<string, unknown>)[key];
    }
    const result = await injectAs(app!, adminActor(), { method: 'POST', url: '/api/schedules', payload });
    expect(result.statusCode, result.body).toBe(201);
    expect(result.json().schedule.hoursL).toBe('3');
    for (const key of ['hoursM', 'hoursX', 'hoursJ', 'hoursV', 'hoursS1', 'hoursS2']) {
      expect(result.json().schedule[key]).toBe('0');
    }
  });

  it('preserves omitted incidence defaults as zero and explicit decimals without monetary changes', async () => {
    const result = await injectAs(app!, adminActor(), { method: 'PATCH',
      url: `/api/incidences/${TEST_IDS.scheduleIdiomas}`,
      payload: { calendarConfigId: TEST_IDS.calendarConfig } });
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().schedule).toMatchObject({ absences: '0', delays: '0', extraHoursInSchedule: '0' });
    const explicit = await injectAs(app!, adminActor(), { method: 'PATCH',
      url: `/api/incidences/${TEST_IDS.scheduleIdiomas}`,
      payload: { calendarConfigId: TEST_IDS.calendarConfig, absences: '0.5', delays: 2, extraHoursInSchedule: '1.25' } });
    expect(explicit.statusCode, explicit.body).toBe(200);
    expect(explicit.json().schedule).toMatchObject({ absences: '0.5', delays: '2', extraHoursInSchedule: '1.25' });
  });

  it('rejects more than 500 incidence rows without changing the persisted incidences', async () => {
    const client = await connectTestDb();
    try {
      const before = (await client.query('SELECT * FROM schedule_incidences ORDER BY schedule_id, calendar_config_id')).rows;
      const response = await injectAs(app!, adminActor(), { method: 'PATCH', url: '/api/incidences', payload: {
        rows: Array.from({ length: 501 }, () => ({ scheduleId: TEST_IDS.scheduleIdiomas,
          calendarConfigId: TEST_IDS.calendarConfig, absences: '1' }))
      } });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
      expect((await client.query('SELECT * FROM schedule_incidences ORDER BY schedule_id, calendar_config_id')).rows).toEqual(before);
    } finally { await client.end(); }
  });

  it('preserves the payroll preprocessing contract and the complete monetary summary', async () => {
    const canonical = await injectAs(app!, adminActor(), { method: 'POST', url: '/api/payroll/preview', payload: payrollInput() });
    const padded = await injectAs(app!, adminActor(), { method: 'POST', url: '/api/payroll/preview',
      payload: { ...payrollInput(), calendarConfigId: ` ${TEST_IDS.calendarConfig} `, cycleId: ' ', periodLabel: undefined } });
    expect(canonical.statusCode, canonical.body).toBe(200);
    expect(padded.statusCode, padded.body).toBe(200);
    expect(padded.json().summary).toEqual(canonical.json().summary);
    expect(padded.json().lines).toEqual(canonical.json().lines);
  });

  it('keeps the reports validation envelope and legacy identifier rejection message', async () => {
    const response = await injectAs(app!, adminActor(), { method: 'GET',
      url: '/api/reports/operational/base-extra?cycleId=not-a-uuid&calendarConfigId=not-a-uuid' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'BAD_REQUEST', details: {
      formErrors: [], fieldErrors: { cycleId: ['Invalid uuid'], calendarConfigId: ['Invalid uuid'] }
    } });
  });
});
