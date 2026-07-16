import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import {
  TEST_IDS,
  cleanupTestApp,
  describeIntegration,
  expectDecimalString,
  freshTestApp,
  payrollInput
} from './api-integration-helpers.js';
import { connectTestDb } from './db/test-db-utils.js';
import { adminActor, coordinatorActor, TEST_COORDINATIONS, TEST_USER_IDS } from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

async function seedSharedCoordinatorPayrollScope(): Promise<void> {
  const client = await connectTestDb();
  try {
    await client.query(
      `
        INSERT INTO teachers (
          id,
          full_name,
          normalized_name,
          first_names,
          paternal_last_name,
          maternal_last_name,
          degree,
          payment_type,
          category,
          location,
          coordination_id,
          status,
          created_by,
          updated_by
        ) VALUES (
          '40000000-0000-4000-8000-000000000041',
          'Docente QA Fuera Alcance',
          'docente qa fuera alcance',
          'Docente QA',
          'Fuera',
          'Alcance',
          'Licenciatura',
          '',
          'N',
          'Local',
          $1,
          'ACTIVO',
          $2,
          $2
        )
      `,
      [TEST_COORDINATIONS.arq.id, TEST_USER_IDS.multiCoordinator]
    );

    await client.query(
      `
        INSERT INTO schedules (
          id,
          cycle_id,
          coordination_id,
          teacher_id,
          subject_id,
          subject_name,
          group_code,
          tabulator_id,
          tabulator_name,
          tabulator_amount,
          hours_l,
          hours_m,
          hours_x,
          hours_j,
          hours_v,
          hours_s1,
          hours_s2,
          created_by,
          updated_by
        ) VALUES
          (
            '50000000-0000-4000-8000-000000000041', $1, $2, $3, $4,
            'H04 QA Materia Base', 'QA-SHARED-OWNED', $5, 'H04 QA Tabulador 100', 100.00,
            1, 0, 0, 0, 0, 0, 0, $6, $6
          ),
          (
            '50000000-0000-4000-8000-000000000042', $1, $7, $8, $4,
            'H04 QA Materia Base', 'QA-SHARED-ASSIGNED', $5, 'H04 QA Tabulador 100', 100.00,
            1, 0, 0, 0, 0, 0, 0, $9, $9
          ),
          (
            '50000000-0000-4000-8000-000000000043', $1, $2,
            '40000000-0000-4000-8000-000000000041', $4,
            'H04 QA Materia Base', 'QA-OUTSIDE', $5, 'H04 QA Tabulador 100', 100.00,
            1, 0, 0, 0, 0, 0, 0, $6, $6
          )
      `,
      [
        TEST_IDS.cycle,
        TEST_COORDINATIONS.arq.id,
        TEST_IDS.teacherIdiomas,
        '30000000-0000-4000-8000-000000000001',
        TEST_IDS.tabulator,
        TEST_USER_IDS.multiCoordinator,
        TEST_COORDINATIONS.idiomas.id,
        TEST_IDS.teacherMulti,
        TEST_USER_IDS.coordinator
      ]
    );

    await client.query(
      `
        INSERT INTO schedule_incidences (
          schedule_id,
          calendar_config_id,
          absences,
          delays,
          extra_hours_in_schedule,
          updated_by
        ) VALUES (
          '50000000-0000-4000-8000-000000000041',
          $1,
          0,
          1,
          1,
          $2
        )
      `,
      [TEST_IDS.calendarConfig, TEST_USER_IDS.multiCoordinator]
    );

    await client.query(
      `
        INSERT INTO extra_hours (
          id,
          cycle_id,
          coordination_id,
          teacher_id,
          hours,
          tabulator_amount,
          reason,
          activity_date,
          reference,
          observations,
          captured_by,
          updated_by
        ) VALUES (
          '60000000-0000-4000-8000-000000000041',
          $1,
          $2,
          $3,
          1,
          100.00,
          'Extra compartido QA',
          '2026-05-23',
          'H20-SHARED',
          'Extra sintetico H20',
          $4,
          $4
        )
      `,
      [TEST_IDS.cycle, TEST_COORDINATIONS.arq.id, TEST_IDS.teacherIdiomas, TEST_USER_IDS.multiCoordinator]
    );
  } finally {
    await client.end();
  }
}

function moneyCents(value: string): bigint {
  const [integer, decimal = ''] = value.split('.');
  return BigInt(integer) * 100n + BigInt(decimal.padEnd(2, '0').slice(0, 2));
}

describeIfDb('H01 payroll business integration coverage', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('calculates payroll preview with decimal strings and expected schedule/incidence/extra totals', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: payrollInput()
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const summary = body.summary;
    expect(summary.lines).toBe(2);
    expect(summary.teachers).toBe(2);
    expect(summary.coordinations).toBe(2);
    expectDecimalString(summary.baseHours, '32');
    expectDecimalString(summary.grossBaseAmount, '3200.00');
    expectDecimalString(summary.absenceDiscountAmount, '100.00');
    expectDecimalString(summary.delayDiscountAmount, '150.00');
    expectDecimalString(summary.discountAmount, '250.00');
    expectDecimalString(summary.scheduleExtraHours, '3');
    expectDecimalString(summary.scheduleExtraAmount, '300.00');
    expectDecimalString(summary.loggedExtraHours, '6');
    expectDecimalString(summary.loggedExtraAmount, '600.00');
    expectDecimalString(summary.totalExtraHours, '9');
    expectDecimalString(summary.totalExtraAmount, '900.00');
    expectDecimalString(summary.totalAmount, '3850.00');

    const idiomasLine = body.lines.find((line: { teacherName: string }) => line.teacherName === 'Docente QA Idiomas Uno');
    expect(idiomasLine).toBeDefined();
    expectDecimalString(idiomasLine.baseHours, '20');
    expectDecimalString(idiomasLine.grossBaseAmount, '2000.00');
    expectDecimalString(idiomasLine.absences, '1');
    expectDecimalString(idiomasLine.delays, '2');
    expectDecimalString(idiomasLine.delayDiscountHours, '1');
    expectDecimalString(idiomasLine.absenceDiscountAmount, '100.00');
    expectDecimalString(idiomasLine.delayDiscountAmount, '100.00');
    expectDecimalString(idiomasLine.baseNetAmount, '1800.00');
    expectDecimalString(idiomasLine.scheduleExtraHours, '1');
    expectDecimalString(idiomasLine.scheduleExtraAmount, '100.00');
    expectDecimalString(idiomasLine.loggedExtraHours, '3');
    expectDecimalString(idiomasLine.loggedExtraAmount, '300.00');
    expectDecimalString(idiomasLine.totalExtraHours, '4');
    expectDecimalString(idiomasLine.totalExtraAmount, '400.00');
    expectDecimalString(idiomasLine.totalAmount, '2200.00');

    for (const detail of body.details) {
      expectDecimalString(detail.tabulatorAmount);
      expectDecimalString(detail.grossBaseAmount);
      expectDecimalString(detail.baseNetAmount);
      expectDecimalString(detail.scheduleExtraAmount);
    }
    for (const extra of body.extraDetails) {
      expectDecimalString(extra.tabulatorAmount);
      expectDecimalString(extra.totalAmount);
    }
  });

  it('filters payroll preview for coordinator scope and keeps finalize protected', async () => {
    const preview = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: payrollInput()
    });

    expect(preview.statusCode).toBe(200);
    const body = preview.json();
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].coordinationName).toBe('Idiomas');
    expectDecimalString(body.summary.totalAmount, '2200.00');

    const finalize = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/payroll/runs',
      payload: payrollInput()
    });
    expect(finalize.statusCode).toBe(403);
  });

  it('expands coordinator preview to complete shared-teacher calculations without fiscal data or duplicates', async () => {
    await seedSharedCoordinatorPayrollScope();

    const preview = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: payrollInput()
    });

    expect(preview.statusCode).toBe(200);
    const body = preview.json();
    expect(body.teacherSummaries).toHaveLength(2);
    expect(new Set(body.teacherSummaries.map((line: { teacherId: string }) => line.teacherId)).size).toBe(2);
    expect(body.lines).toHaveLength(4);
    expect(body.lines.some((line: { teacherName: string }) => line.teacherName === 'Docente QA Fuera Alcance')).toBe(false);

    const owned = body.teacherSummaries.find(
      (line: { teacherId: string }) => line.teacherId === TEST_IDS.teacherIdiomas
    );
    expect(owned.coordinationNames).toEqual(['ARQ', 'Idiomas']);
    expect(owned.scope).toEqual({
      ownedByActor: true,
      inActorCoordination: true,
      hasOtherCoordinations: true
    });

    const assigned = body.teacherSummaries.find(
      (line: { teacherId: string }) => line.teacherId === TEST_IDS.teacherMulti
    );
    expect(assigned.coordinationNames).toEqual(['ADETUR', 'Idiomas']);
    expect(assigned.scope).toEqual({
      ownedByActor: false,
      inActorCoordination: true,
      hasOtherCoordinations: true
    });

    expect(
      new Set(
        body.details
          .filter((detail: { teacherId: string }) => detail.teacherId === TEST_IDS.teacherIdiomas)
          .map((detail: { coordinationName: string }) => detail.coordinationName)
      )
    ).toEqual(new Set(['ARQ', 'Idiomas']));
    expect(
      body.extraDetails.some(
        (detail: { teacherId: string; coordinationName: string }) =>
          detail.teacherId === TEST_IDS.teacherIdiomas && detail.coordinationName === 'ARQ'
      )
    ).toBe(true);

    const aggregateTotal = body.teacherSummaries.reduce(
      (sum: bigint, line: { totalAmount: string }) => sum + moneyCents(line.totalAmount),
      0n
    );
    expect(aggregateTotal).toBe(moneyCents(body.summary.totalAmount));
    expect(JSON.stringify(body)).not.toMatch(/paymentType|teacherRfc|bankDetail|constancia/i);
    expect(JSON.stringify(body)).not.toMatch(
      /RFC pendiente|Datos bancarios pendientes|Correo pendiente|Constancia fiscal pendiente/i
    );

    const adminPreview = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: payrollInput()
    });
    expect(adminPreview.statusCode).toBe(200);
    expect(
      adminPreview.json().lines.some((line: { teacherName: string }) => line.teacherName === 'Docente QA Fuera Alcance')
    ).toBe(true);
  });

  it('blocks payroll preview and finalize while a cycle is in planning', async () => {
    const planningInput = payrollInput({
      calendarConfigId: TEST_IDS.planningCalendarConfig,
      cycleId: TEST_IDS.planningCycle,
      periodLabel: 'H09 QA Planeacion Sep 1-15 2026',
      payrollStart: '2026-09-01',
      payrollEnd: '2026-09-15',
      module1Start: '2026-09-01',
      module1End: '2026-10-31',
      module2Start: '2026-11-01',
      module2End: '2026-12-31'
    });

    const preview = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: planningInput
    });
    expect(preview.statusCode).toBe(400);
    expect(preview.json().message).toContain('nomina solo puede calcularse');

    const finalize = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/payroll/runs',
      payload: planningInput
    });
    expect(finalize.statusCode).toBe(400);
    expect(finalize.json().message).toContain('nomina solo puede calcularse');
  });

  it('allows admin to finalize payroll without changing the preview calculation', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/payroll/runs',
      payload: payrollInput()
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.run.status).toBe('CALCULADA');
    expectDecimalString(body.summary.totalAmount, '3850.00');
  });
});
