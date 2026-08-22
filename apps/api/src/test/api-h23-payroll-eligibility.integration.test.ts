import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import {
  TEST_IDS,
  cleanupTestApp,
  describeIntegration,
  expectDecimalString,
  freshTestApp
} from './api-integration-helpers.js';
import { connectTestDb } from './db/test-db-utils.js';
import { adminActor, coordinatorActor, financeActor } from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

async function activateH23Cycle(): Promise<void> {
  const client = await connectTestDb();
  try {
    await client.query("UPDATE academic_cycles SET status = 'PLANEACION' WHERE status = 'ACTIVO'");
    await client.query("UPDATE academic_cycles SET status = 'ACTIVO' WHERE id = $1", [TEST_IDS.h23Cycle]);
  } finally {
    await client.end();
  }
}

function payrollPayload(calendarConfigId: string) {
  return {
    cycleId: TEST_IDS.h23Cycle,
    calendarConfigId,
    periodLabel: 'ignored because calendar is authoritative'
  };
}

interface H23PayrollLine {
  teacherId: string;
  baseHours: string;
  absences: string;
  delays: string;
  scheduleExtraHours: string;
  loggedExtraHours: string;
  totalAmount: string;
}

function lineForH23(body: { lines: H23PayrollLine[] }): H23PayrollLine {
  const line = body.lines.find((candidate) => candidate.teacherId === TEST_IDS.teacherIdiomas);
  if (!line) throw new Error('No se encontró la línea sintética H23 esperada.');
  return line;
}

describeIfDb('H23 payroll temporal eligibility integration coverage', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
    await activateH23Cycle();
  }, 30_000);

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('returns zero base/incidence values before the base period while keeping independent extras', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: payrollPayload(TEST_IDS.h23CalendarBefore)
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const line = lineForH23(body);
    expectDecimalString(line.baseHours, '0');
    expectDecimalString(line.absences, '0');
    expectDecimalString(line.delays, '0');
    expectDecimalString(line.scheduleExtraHours, '0');
    expectDecimalString(line.loggedExtraHours, '2');
    expectDecimalString(line.totalAmount, '200.00');
    expect(body.calendar.dayCounts).toEqual({ L: 0, M: 0, X: 0, J: 0, V: 0 });
    expect(body.calendar.module1Saturdays).toBe(0);
    expect(body.calendar.module2Saturdays).toBe(0);
  });

  it.each([
    [TEST_IDS.h23CalendarPartial, '3', { L: 1, M: 1, X: 1, J: 1, V: 1 }, 0, 0],
    [TEST_IDS.h23CalendarInside, '7', { L: 1, M: 2, X: 2, J: 2, V: 2 }, 1, 0],
    [TEST_IDS.h23CalendarCrossModules, '34', { L: 8, M: 7, X: 7, J: 8, V: 8 }, 1, 2]
  ])(
    'intersects payroll, base period, modules and blackouts for %s',
    async (calendarConfigId, expectedBaseHours, dayCounts, module1Saturdays, module2Saturdays) => {
      const response = await injectAs(app!, adminActor(), {
        method: 'POST',
        url: '/api/payroll/preview',
        payload: payrollPayload(calendarConfigId)
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expectDecimalString(lineForH23(body).baseHours, expectedBaseHours);
      expect(body.calendar).toMatchObject({ dayCounts, module1Saturdays, module2Saturdays });
    }
  );

  it('blocks incidence capture for a schedule with zero eligible occurrences and keeps it visible read-only', async () => {
    const context = await injectAs(app!, coordinatorActor(), {
      method: 'GET',
      url: `/api/incidences/context?cycleId=${TEST_IDS.h23Cycle}&calendarConfigId=${TEST_IDS.h23CalendarBefore}`
    });

    expect(context.statusCode).toBe(200);
    const schedule = context.json().schedules.find((row: { id: string }) => row.id === TEST_IDS.h23Schedule);
    expect(schedule).toMatchObject({
      hasEligibleOccurrences: false,
      canEdit: false,
      eligibilityMessage: 'Este horario no tiene clases pagables dentro de la quincena seleccionada.'
    });

    const blocked = await injectAs(app!, coordinatorActor(), {
      method: 'PATCH',
      url: `/api/incidences/${TEST_IDS.h23Schedule}`,
      payload: {
        calendarConfigId: TEST_IDS.h23CalendarBefore,
        absences: '1',
        delays: '1',
        extraHoursInSchedule: '1'
      }
    });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json().error).toBe('SCHEDULE_OUTSIDE_BASE_HOURS_PERIOD');
  });

  it('keeps H20 coordinator preview equal to Admin for the shared teacher calculation', async () => {
    const [admin, coordinator] = await Promise.all([
      injectAs(app!, adminActor(), {
        method: 'POST',
        url: '/api/payroll/preview',
        payload: payrollPayload(TEST_IDS.h23CalendarPartial)
      }),
      injectAs(app!, coordinatorActor(), {
        method: 'POST',
        url: '/api/payroll/preview',
        payload: payrollPayload(TEST_IDS.h23CalendarPartial)
      })
    ]);

    expect([admin.statusCode, coordinator.statusCode]).toEqual([200, 200]);
    expect(lineForH23(coordinator.json())).toMatchObject({
      baseHours: lineForH23(admin.json()).baseHours,
      totalAmount: lineForH23(admin.json()).totalAmount
    });
  });

  it('keeps the live operational report aligned with payroll preview', async () => {
    const preview = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: payrollPayload(TEST_IDS.h23CalendarPartial)
    });
    const report = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/reports/operational/base-extra?cycleId=${TEST_IDS.h23Cycle}&calendarConfigId=${TEST_IDS.h23CalendarPartial}&source=live`
    });

    expect([preview.statusCode, report.statusCode]).toEqual([200, 200]);
    const reportRow = report.json().rows.find((row: { teacherId: string }) => row.teacherId === TEST_IDS.teacherIdiomas);
    expect(Number(reportRow.baseHours)).toBe(Number(lineForH23(preview.json()).baseHours));
    expectDecimalString(reportRow.incidenceExtraHours, '0.00');
  });

  it('saves the same calculation, preserves prior snapshots, and recalculates after cancellation', async () => {
    const client = await connectTestDb();
    let beforeFingerprint = '';
    try {
      const before = await client.query<{ fingerprint: string }>(
        `SELECT md5(COALESCE(string_agg(row_to_json(pr)::text, '|' ORDER BY pr.id), '')) AS fingerprint FROM payroll_runs pr`
      );
      beforeFingerprint = before.rows[0].fingerprint;
    } finally {
      await client.end();
    }

    const preview = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: payrollPayload(TEST_IDS.h23CalendarBefore)
    });
    const saved = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/payroll/runs',
      payload: payrollPayload(TEST_IDS.h23CalendarBefore)
    });

    expect([preview.statusCode, saved.statusCode]).toEqual([200, 201]);
    expect(saved.json().summary).toEqual(preview.json().summary);

    const cancelled = await injectAs(app!, financeActor(), {
      method: 'PATCH',
      url: `/api/reports/finance/runs/${saved.json().run.id}/status`,
      payload: { status: 'CANCELADA' }
    });
    expect(cancelled.statusCode).toBe(200);

    const recalculated = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: payrollPayload(TEST_IDS.h23CalendarBefore)
    });
    expect(recalculated.statusCode).toBe(200);
    expect(recalculated.json().summary).toEqual(preview.json().summary);

    const afterClient = await connectTestDb();
    try {
      const priorRuns = await afterClient.query<{ fingerprint: string }>(
        `SELECT md5(COALESCE(string_agg(row_to_json(pr)::text, '|' ORDER BY pr.id), '')) AS fingerprint FROM payroll_runs pr WHERE pr.id <> $1`,
        [saved.json().run.id]
      );
      expect(priorRuns.rows[0].fingerprint).toBe(beforeFingerprint);
    } finally {
      await afterClient.end();
    }
  });

  it('rejects payroll calculation for an active legacy cycle without base-hours dates', async () => {
    const client = await connectTestDb();
    try {
      await client.query("UPDATE academic_cycles SET status = 'PLANEACION' WHERE status = 'ACTIVO'");
      await client.query("UPDATE academic_cycles SET status = 'ACTIVO' WHERE id = $1", [TEST_IDS.h23LegacyPlanningCycle]);
    } finally {
      await client.end();
    }

    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: {
        cycleId: TEST_IDS.h23LegacyPlanningCycle,
        periodLabel: 'Legacy active without base dates',
        payrollStart: '2027-01-01',
        payrollEnd: '2027-01-15',
        module1Start: '2027-01-01',
        module1End: '2027-02-28',
        module2Start: '2027-03-01',
        module2End: '2027-04-30'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('BASE_HOURS_DATES_INCOMPLETE');
  });
});
