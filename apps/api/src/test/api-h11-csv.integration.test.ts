import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import {
  TEST_IDS,
  cleanupTestApp,
  describeIntegration,
  freshTestApp,
  payrollInput
} from './api-integration-helpers.js';
import { connectTestDb } from './db/test-db-utils.js';
import { accountantActor, adminActor, createSessionUser, financeActor } from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

const PAYMENT_HEADERS = ['Nombre del docente', 'RFC', 'Tipo de pago', 'Horas pagadas', 'Total a pagar'];
const FISCAL_HEADERS = [
  'Docente',
  'Coordinación',
  'RFC',
  'Correo',
  'Datos bancarios',
  'Tipo pago',
  'Categoría',
  'Horas base',
  'Bruto base',
  'Descuentos',
  'Extras h',
  'Extras monto',
  'Total neto',
  'Estatus',
  'Pendientes',
  'Alertas'
];
const COORDINATION_HEADERS = [
  'Coordinación',
  'Docentes',
  'Líneas',
  'Horas base',
  'Extras h',
  'Descuentos',
  'Total',
  'Pendientes fiscales',
  'Alertas'
];
const PAYROLL_SUMMARY_HEADERS = [
  'Ciclo',
  'Quincena',
  'Estatus',
  'Docente',
  'Coordinación',
  'Categoría',
  'Tipo pago',
  'Horas base',
  'Bruto base',
  'Faltas h',
  'Retardos',
  'Retardos h',
  'Descuento faltas',
  'Descuento retardos',
  'Neto base',
  'Extras incidencias h',
  'Extras incidencias monto',
  'Extras externos h',
  'Extras externos monto',
  'Total extras h',
  'Total extras monto',
  'Total',
  'Alertas'
];
const PAYROLL_SCHEDULE_HEADERS = [
  'Ciclo',
  'Quincena',
  'Estatus',
  'Docente',
  'Coordinación',
  'Asignatura',
  'Grupo',
  'Tabulador',
  'Monto tabulador',
  'Horas L-V',
  'Horas módulo 1',
  'Horas módulo 2',
  'Horas base',
  'Bruto base',
  'Faltas h',
  'Retardos',
  'Retardos h',
  'Descuento faltas',
  'Descuento retardos',
  'Extras incidencias h',
  'Extras incidencias monto',
  'Neto base'
];
const PAYROLL_EXTRA_HEADERS = ['Ciclo', 'Quincena', 'Estatus', 'Docente', 'Coordinación', 'Fecha actividad', 'Motivo', 'Horas', 'Monto tabulador', 'Total'];

function quotedHeader(headers: string[]): string {
  return headers.map((header) => `"${header}"`).join(',');
}

function withoutBom(csv: string): string {
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  return csv.slice(1);
}

function expectCsvHeaders(response: LightMyRequestResponse, headers: string[]): string {
  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('text/csv; charset=utf-8');
  const csv = withoutBom(response.body);
  expect(csv.split('\r\n')[0]).toBe(quotedHeader(headers));
  return csv;
}

async function seedCsvEdgeText(): Promise<void> {
  const client = await connectTestDb();
  try {
    await client.query(
      `
        UPDATE teachers
        SET full_name = 'Docente QA García, "Especial"',
            normalized_name = 'docente qa garcia especial'
        WHERE id = $1
      `,
      [TEST_IDS.teacherIdiomas]
    );
    await client.query(
      `
        UPDATE schedules
        SET subject_name = 'Materia QA con acento, "Comillas"'
        WHERE id = $1
      `,
      [TEST_IDS.scheduleIdiomas]
    );
    await client.query(
      `
        UPDATE extra_hours
        SET reason = 'Actividad, observación "especial"'
        WHERE id = $1
      `,
      [TEST_IDS.extraOwn]
    );
  } finally {
    await client.end();
  }
}

async function createPayrollRun(app: FastifyInstance): Promise<string> {
  const response = await injectAs(app, adminActor(), {
    method: 'POST',
    url: '/api/payroll/runs',
    payload: payrollInput({ periodLabel: 'H11 QA CSV Mayo 15-28 2026' })
  });

  expect(response.statusCode).toBe(201);
  const body = response.json();
  expect(typeof body.run.id).toBe('string');
  return body.run.id;
}

describeIfDb('H11 CSV encoding integration coverage', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
    await seedCsvEdgeText();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('exports finance CSV files with UTF-8 BOM, stable headers, escaping and existing permissions', async () => {
    const runId = await createPayrollRun(app!);

    const blockedWithoutExport = await injectAs(app!, createSessionUser({ permissions: ['finance.view'] }), {
      method: 'GET',
      url: `/api/reports/finance/export/payments?runId=${runId}`
    });
    expect(blockedWithoutExport.statusCode).toBe(403);

    const payments = await injectAs(app!, accountantActor(), {
      method: 'GET',
      url: `/api/reports/finance/export/payments?runId=${runId}`
    });
    const paymentsCsv = expectCsvHeaders(payments, PAYMENT_HEADERS);
    expect(payments.headers['content-disposition']).toBe('attachment; filename="finanzas-h04-qa-mayo-15-28-2026-pagos.csv"');
    expect(paymentsCsv).toContain('"Docente QA García, ""Especial"""');
    expect(paymentsCsv).toContain('"2200.00"');

    const fiscalBlocked = await injectAs(app!, accountantActor(), {
      method: 'GET',
      url: `/api/reports/finance/export/fiscal?runId=${runId}`
    });
    expect(fiscalBlocked.statusCode).toBe(403);

    const fiscal = await injectAs(app!, financeActor(), {
      method: 'GET',
      url: `/api/reports/finance/export/fiscal?runId=${runId}`
    });
    const fiscalCsv = expectCsvHeaders(fiscal, FISCAL_HEADERS);
    expect(fiscal.headers['content-disposition']).toBe('attachment; filename="finanzas-h04-qa-mayo-15-28-2026-pendientes-fiscales.csv"');
    expect(fiscalCsv).toContain('"Docente QA García, ""Especial"""');

    const coordinations = await injectAs(app!, accountantActor(), {
      method: 'GET',
      url: `/api/reports/finance/export/coordinations?runId=${runId}`
    });
    const coordinationCsv = expectCsvHeaders(coordinations, COORDINATION_HEADERS);
    expect(coordinations.headers['content-disposition']).toBe('attachment; filename="finanzas-h04-qa-mayo-15-28-2026-coordinaciones.csv"');
    expect(coordinationCsv).toContain('"2200.00"');
    expect(coordinationCsv).toContain('"1650.00"');
  });

  it('exports payroll CSV files with UTF-8 BOM, stable headers and unchanged money strings', async () => {
    const runId = await createPayrollRun(app!);

    const summary = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/payroll/runs/${runId}/export/summary`
    });
    const summaryCsv = expectCsvHeaders(summary, PAYROLL_SUMMARY_HEADERS);
    expect(summary.headers['content-disposition']).toBe('attachment; filename="nomina-h04-qa-mayo-15-28-2026-resumen.csv"');
    expect(summaryCsv).toContain('"Docente QA García, ""Especial"""');
    expect(summaryCsv).toContain('"2200.00"');

    const schedules = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/payroll/runs/${runId}/export/schedules`
    });
    const schedulesCsv = expectCsvHeaders(schedules, PAYROLL_SCHEDULE_HEADERS);
    expect(schedules.headers['content-disposition']).toBe('attachment; filename="nomina-h04-qa-mayo-15-28-2026-horarios.csv"');
    expect(schedulesCsv).toContain('"Materia QA con acento, ""Comillas"""');
    expect(schedulesCsv).toContain('"100.00"');

    const extras = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/payroll/runs/${runId}/export/extras`
    });
    const extrasCsv = expectCsvHeaders(extras, PAYROLL_EXTRA_HEADERS);
    expect(extras.headers['content-disposition']).toBe('attachment; filename="nomina-h04-qa-mayo-15-28-2026-extras.csv"');
    expect(extrasCsv).toContain('"Actividad, observación ""especial"""');
    expect(extrasCsv).toContain('"100.00"');

    const blockedFinalizeOnly = await injectAs(app!, createSessionUser({ permissions: ['payroll.view', 'payroll.preview'] }), {
      method: 'GET',
      url: `/api/payroll/runs/${runId}/export/summary`
    });
    expect(blockedFinalizeOnly.statusCode).toBe(403);
  });
});
