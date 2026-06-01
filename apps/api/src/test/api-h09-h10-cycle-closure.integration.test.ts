import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import {
  TEST_IDS,
  cleanupTestApp,
  describeIntegration,
  extraBody,
  freshTestApp,
  incidenceBody,
  payrollInput,
  scheduleBody
} from './api-integration-helpers.js';
import { connectTestDb } from './db/test-db-utils.js';
import {
  TEST_COORDINATIONS,
  TEST_USER_IDS,
  adminActor,
  createSessionUser,
  coordinatorActor
} from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

type PendingStatus = 'CALCULADA' | 'EN_REVISION' | 'APROBADA';

async function setCycleStatus(cycleId: string, status: 'ACTIVO' | 'PLANEACION' | 'CERRADO'): Promise<void> {
  const client = await connectTestDb();
  try {
    await client.query(
      `
        UPDATE academic_cycles
        SET status = $1::cycle_status,
            closed_at = CASE WHEN $1::cycle_status = 'CERRADO' THEN now() ELSE NULL END,
            closed_by = CASE WHEN $1::cycle_status = 'CERRADO' THEN $2::uuid ELSE NULL END
        WHERE id = $3
      `,
      [status, TEST_USER_IDS.admin, cycleId]
    );
  } finally {
    await client.end();
  }
}

async function setPendingRunStatus(status: PendingStatus): Promise<void> {
  const client = await connectTestDb();
  try {
    await client.query(
      `
        UPDATE payroll_runs
        SET status = $1::payroll_run_status,
            status_updated_at = now(),
            status_updated_by = $2
        WHERE id = $3
      `,
      [status, TEST_USER_IDS.admin, TEST_IDS.pendingPayrollRun]
    );
  } finally {
    await client.end();
  }
}

describeIfDb('H09/H10 controlled cycle closure integration coverage', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('lets admin close an active paid cycle and activate the planning cycle with audit evidence', async () => {
    await setCycleStatus(TEST_IDS.closableCycle, 'ACTIVO');

    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: `/api/calendar/cycles/${TEST_IDS.closableCycle}/close`,
      payload: {
        nextCycleId: TEST_IDS.closableNextCycle,
        observation: 'Cierre QA H09/H10'
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.closedCycle.status).toBe('CERRADO');
    expect(body.activeCycle.status).toBe('ACTIVO');
    expect(body.validation.periodCount).toBe(2);
    expect(body.validation.pendingRuns).toBe(0);
    expect(body.validation.missingPaidPeriods).toBe(0);
    expect(body.validation.payrollRunIds).toEqual(
      expect.arrayContaining([TEST_IDS.closablePayrollRunA, TEST_IDS.closablePayrollRunB])
    );

    const client = await connectTestDb();
    try {
      const closure = await client.query<{
        total: number;
        action: string;
        schedulesArchived: number;
        extrasArchived: number;
        affectedTeachers: number;
        affectedCoordinations: number;
      }>(
        `
          SELECT
            count(*)::int AS total,
            max(action) AS action,
            max(schedules_archived)::int AS "schedulesArchived",
            max(extras_archived)::int AS "extrasArchived",
            max(affected_teachers)::int AS "affectedTeachers",
            max(affected_coordinations)::int AS "affectedCoordinations"
          FROM quarter_closures
          WHERE cycle_id = $1
        `,
        [TEST_IDS.closableCycle]
      );
      expect(closure.rows[0].total).toBe(1);
      expect(closure.rows[0].action).toBe('CYCLE_CLOSED_AND_NEXT_ACTIVATED');
      expect(closure.rows[0].schedulesArchived).toBe(1);
      expect(closure.rows[0].extrasArchived).toBe(1);
      expect(closure.rows[0].affectedTeachers).toBe(1);
      expect(closure.rows[0].affectedCoordinations).toBe(1);

      const audit = await client.query<{
        afterData: {
          closedCycleId: string;
          activatedCycleId: string;
          irreversible: boolean;
          payrollRunIds: string[];
        };
      }>(
        `
          SELECT after_data AS "afterData"
          FROM audit_log
          WHERE action = 'CYCLE_CLOSED_AND_NEXT_ACTIVATED'
            AND entity_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [TEST_IDS.closableCycle]
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0].afterData.closedCycleId).toBe(TEST_IDS.closableCycle);
      expect(audit.rows[0].afterData.activatedCycleId).toBe(TEST_IDS.closableNextCycle);
      expect(audit.rows[0].afterData.irreversible).toBe(true);
      expect(audit.rows[0].afterData.payrollRunIds).toEqual(
        expect.arrayContaining([TEST_IDS.closablePayrollRunA, TEST_IDS.closablePayrollRunB])
      );
    } finally {
      await client.end();
    }
  });

  it('blocks non-admin users even if they have calendar.manage', async () => {
    const nonAdminCalendarManager = createSessionUser({
      id: TEST_USER_IDS.direction,
      firebaseUid: 'qa-fixture-direccion',
      email: 'qa.direccion@tecplayacar.edu.mx',
      displayName: 'QA Direccion',
      role: 'direccion',
      permissions: ['calendar.manage'],
      actorCoordinations: []
    });

    const response = await injectAs(app!, nonAdminCalendarManager, {
      method: 'POST',
      url: `/api/calendar/cycles/${TEST_IDS.closableCycle}/close`,
      payload: { nextCycleId: TEST_IDS.closableNextCycle }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain('Solo Admin');
  });

  it('blocks closure when the current cycle is not active', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: `/api/calendar/cycles/${TEST_IDS.closedCycle}/close`,
      payload: { nextCycleId: TEST_IDS.closableNextCycle }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('ACTIVO');
  });

  it('blocks closure when the next cycle is not in planning', async () => {
    await setCycleStatus(TEST_IDS.closableCycle, 'ACTIVO');

    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: `/api/calendar/cycles/${TEST_IDS.closableCycle}/close`,
      payload: { nextCycleId: TEST_IDS.cycle }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('PLANEACION');
  });

  it('blocks closure when the next planning cycle has no schedules', async () => {
    await setCycleStatus(TEST_IDS.closableCycle, 'ACTIVO');

    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: `/api/calendar/cycles/${TEST_IDS.closableCycle}/close`,
      payload: { nextCycleId: TEST_IDS.noScheduleNextCycle }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('horarios');
  });

  it('blocks closure when a calendar period is not paid', async () => {
    await setCycleStatus(TEST_IDS.unpaidCycle, 'ACTIVO');

    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: `/api/calendar/cycles/${TEST_IDS.unpaidCycle}/close`,
      payload: { nextCycleId: TEST_IDS.closableNextCycle }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('Faltan quincenas PAGADA');
  });

  for (const status of ['CALCULADA', 'EN_REVISION', 'APROBADA'] as const) {
    it(`blocks closure when a ${status} payroll run remains pending`, async () => {
      await setCycleStatus(TEST_IDS.pendingCycle, 'ACTIVO');
      await setPendingRunStatus(status);

      const response = await injectAs(app!, adminActor(), {
        method: 'POST',
        url: `/api/calendar/cycles/${TEST_IDS.pendingCycle}/close`,
        payload: { nextCycleId: TEST_IDS.closableNextCycle }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('corridas pendientes');
      expect(response.json().message).toContain(status);
    });
  }

  it('does not count cancelled runs as paid', async () => {
    await setCycleStatus(TEST_IDS.cancelledOnlyCycle, 'ACTIVO');

    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: `/api/calendar/cycles/${TEST_IDS.cancelledOnlyCycle}/close`,
      payload: { nextCycleId: TEST_IDS.closableNextCycle }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('Faltan quincenas PAGADA');
  });

  it('keeps the closed cycle immutable through ordinary operational and payroll routes', async () => {
    await setCycleStatus(TEST_IDS.closableCycle, 'ACTIVO');

    const close = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: `/api/calendar/cycles/${TEST_IDS.closableCycle}/close`,
      payload: { nextCycleId: TEST_IDS.closableNextCycle }
    });
    expect(close.statusCode).toBe(200);

    const schedule = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/schedules',
      payload: scheduleBody({
        cycleId: TEST_IDS.closableCycle,
        groupCode: 'QA-CLOSED-AFTER-CLOSE',
        hoursL: '1',
        hoursM: '0',
        hoursX: '0',
        hoursJ: '0',
        hoursV: '0'
      })
    });
    expect(schedule.statusCode).toBe(400);
    expect(schedule.json().message).toContain('ciclo cerrado');

    const incidence = await injectAs(app!, adminActor(), {
      method: 'PATCH',
      url: `/api/incidences/${TEST_IDS.closableScheduleIdiomas}`,
      payload: incidenceBody({
        calendarConfigId: TEST_IDS.closableCalendarConfigA,
        absences: '1',
        delays: '0',
        extraHoursInSchedule: '0'
      })
    });
    expect(incidence.statusCode).toBe(400);
    expect(incidence.json().message).toContain('ciclo cerrado');

    const extra = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/extras',
      payload: extraBody({
        cycleId: TEST_IDS.closableCycle,
        coordinationId: TEST_COORDINATIONS.idiomas.id,
        activityDate: '2026-05-10',
        reference: 'H10-CLOSED-BLOCK'
      })
    });
    expect(extra.statusCode).toBe(400);
    expect(extra.json().message).toContain('ciclo cerrado');

    const preview = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: payrollInput({
        calendarConfigId: TEST_IDS.closableCalendarConfigA,
        cycleId: TEST_IDS.closableCycle,
        periodLabel: 'H10 QA Cierre Mayo 1-15 2026',
        payrollStart: '2026-05-01',
        payrollEnd: '2026-05-15',
        module1Start: '2026-05-01',
        module1End: '2026-06-30',
        module2Start: '2026-07-01',
        module2End: '2026-08-31'
      })
    });
    expect(preview.statusCode).toBe(400);
    expect(preview.json().message).toContain('nomina solo puede calcularse');
  });
});
