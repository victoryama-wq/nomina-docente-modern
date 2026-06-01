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
import { adminActor, coordinatorActor } from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

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
