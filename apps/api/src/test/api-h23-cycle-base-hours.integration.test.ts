import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import { TEST_IDS, cleanupTestApp, describeIntegration, freshTestApp } from './api-integration-helpers.js';
import { connectTestDb } from './db/test-db-utils.js';
import { adminActor, directionActor } from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

function validCyclePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    periodLabel: 'H23 QA Nuevo 27-1',
    quarterCode: 'H23NEW',
    baseHoursStartDate: '2026-08-31',
    baseHoursEndDate: '2026-12-12',
    module1Start: '2026-08-31',
    module1End: '2026-09-17',
    module2Start: '2026-10-24',
    module2End: '2026-12-05',
    ...overrides
  };
}

describeIfDb('H23 cycle base hours dates integration coverage', () => {
  let app: FastifyInstance | null = null;

  beforeAll(async () => {
    app = await freshTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('returns the approved 27-1 base-hours configuration in the calendar contract', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/calendar/context?cycleId=${TEST_IDS.h23Cycle}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().activeCycle).toMatchObject({
      id: TEST_IDS.h23Cycle,
      quarterCode: '27-1',
      baseHoursStartDate: '2026-08-31',
      baseHoursEndDate: '2026-12-12',
      module1Start: '2026-08-31',
      module1End: '2026-09-17',
      module2Start: '2026-10-24',
      module2End: '2026-12-05',
      status: 'PLANEACION'
    });
  });

  it('creates and edits cycles with valid base-hours dates, including start=end', async () => {
    const created = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/calendar/cycles',
      payload: validCyclePayload()
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().cycle).toMatchObject({
      baseHoursStartDate: '2026-08-31',
      baseHoursEndDate: '2026-12-12'
    });

    const edited = await injectAs(app!, adminActor(), {
      method: 'PATCH',
      url: `/api/calendar/cycles/${created.json().cycle.id}`,
      payload: validCyclePayload({
        periodLabel: 'H23 QA Un Dia',
        quarterCode: 'H23DAY',
        baseHoursStartDate: '2026-09-01',
        baseHoursEndDate: '2026-09-01',
        module1Start: '2026-09-01',
        module1End: '2026-09-01',
        module2Start: '2026-09-01',
        module2End: '2026-09-01'
      })
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().cycle).toMatchObject({
      baseHoursStartDate: '2026-09-01',
      baseHoursEndDate: '2026-09-01'
    });
  });

  it.each([
    ['BASE_HOURS_DATES_INVALID', { baseHoursStartDate: '2026-12-13', baseHoursEndDate: '2026-12-12' }],
    ['BASE_HOURS_DATES_INCOMPLETE', { baseHoursEndDate: undefined }],
    ['BASE_HOURS_DATES_INCOMPLETE', { baseHoursStartDate: undefined }],
    ['MODULE1_OUTSIDE_BASE_HOURS_PERIOD', { module1Start: '2026-08-30' }],
    ['MODULE1_OUTSIDE_BASE_HOURS_PERIOD', { module1End: '2026-12-13', module2End: '2026-12-13' }],
    ['MODULE2_OUTSIDE_BASE_HOURS_PERIOD', { module2Start: '2026-08-30' }],
    ['MODULE2_OUTSIDE_BASE_HOURS_PERIOD', { module2End: '2026-12-13' }]
  ])('rejects invalid cycle configuration with %s', async (errorCode, overrides) => {
    const payload = validCyclePayload(overrides);
    if ('baseHoursStartDate' in overrides && overrides.baseHoursStartDate === undefined) {
      delete payload.baseHoursStartDate;
    }
    if ('baseHoursEndDate' in overrides && overrides.baseHoursEndDate === undefined) {
      delete payload.baseHoursEndDate;
    }

    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/calendar/cycles',
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe(errorCode);
  });

  it('updates the base-hours period together with modular dates', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'PATCH',
      url: `/api/calendar/cycles/${TEST_IDS.h23Cycle}/modules`,
      payload: {
        baseHoursStartDate: '2026-08-30',
        baseHoursEndDate: '2026-12-13',
        module1Start: '2026-08-31',
        module1End: '2026-09-17',
        module2Start: '2026-10-24',
        module2End: '2026-12-05'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().activeCycle).toMatchObject({
      baseHoursStartDate: '2026-08-30',
      baseHoursEndDate: '2026-12-13'
    });
  });

  it('blocks activation without a configured base-hours period and allows it when configured', async () => {
    const blocked = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: `/api/calendar/cycles/${TEST_IDS.h23LegacyPlanningCycle}/activate`
    });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json().error).toBe('BASE_HOURS_DATES_INCOMPLETE');

    const activated = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: `/api/calendar/cycles/${TEST_IDS.h23Cycle}/activate`
    });
    expect(activated.statusCode).toBe(200);
    expect(activated.json().activeCycle).toMatchObject({ id: TEST_IDS.h23Cycle, status: 'ACTIVO' });
  });

  it('keeps a legacy cycle with NULL dates unchanged and installs only the H23 constraints', async () => {
    const client = await connectTestDb();
    try {
      const cycle = await client.query<{
        baseHoursStartDate: string | null;
        baseHoursEndDate: string | null;
        module1Start: string;
        module2End: string;
        status: string;
      }>(
        `
          SELECT
            base_hours_start_date::text AS "baseHoursStartDate",
            base_hours_end_date::text AS "baseHoursEndDate",
            module1_start::text AS "module1Start",
            module2_end::text AS "module2End",
            status::text AS status
          FROM academic_cycles
          WHERE id = $1
        `,
        [TEST_IDS.closedCycle]
      );
      expect(cycle.rows[0]).toEqual({
        baseHoursStartDate: null,
        baseHoursEndDate: null,
        module1Start: '2026-01-01',
        module2End: '2026-04-30',
        status: 'CERRADO'
      });

      const constraints = await client.query<{ name: string }>(
        `
          SELECT conname AS name
          FROM pg_constraint
          WHERE conrelid = 'academic_cycles'::regclass
            AND conname LIKE 'academic_cycles_%base_hours%'
          ORDER BY conname
        `
      );
      expect(constraints.rows.map((row) => row.name)).toEqual([
        'academic_cycles_base_hours_dates_pair_chk',
        'academic_cycles_modules_within_base_hours_chk'
      ]);
    } finally {
      await client.end();
    }
  });

  it('does not grant Calendar management to non-Admin roles', async () => {
    const response = await injectAs(app!, directionActor(), {
      method: 'PATCH',
      url: `/api/calendar/cycles/${TEST_IDS.h23Cycle}`,
      payload: validCyclePayload()
    });

    expect(response.statusCode).toBe(403);
  });
});
