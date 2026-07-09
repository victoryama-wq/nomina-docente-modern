import ExcelJS from 'exceljs';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import { TEST_IDS, cleanupTestApp, describeIntegration, freshTestApp } from './api-integration-helpers.js';
import { connectTestDb } from './db/test-db-utils.js';
import {
  TEST_COORDINATIONS,
  TEST_USER_IDS,
  accountantActor,
  accountingActor,
  adminActor,
  coordinatorActor,
  directionActor,
  financeActor,
  rhActor
} from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

function withoutBom(csv: string): string {
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  return csv.slice(1);
}

function rawBuffer(response: LightMyRequestResponse): Buffer {
  return (response as unknown as { rawPayload: Buffer }).rawPayload;
}

async function seedCategoryHourScenarios(): Promise<void> {
  const client = await connectTestDb();
  try {
    await client.query(`
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
      ) VALUES
        (
          '40000000-0000-4000-8000-000000000181',
          'Docente H18 VIP Completo',
          'docente h18 vip completo',
          'Docente H18',
          'VIP',
          'Completo',
          'Licenciatura',
          '',
          'V',
          'Local',
          '${TEST_COORDINATIONS.idiomas.id}',
          'ACTIVO',
          '${TEST_USER_IDS.admin}',
          '${TEST_USER_IDS.admin}'
        ),
        (
          '40000000-0000-4000-8000-000000000182',
          'Docente H18 Medio Excedido',
          'docente h18 medio excedido',
          'Docente H18',
          'Medio',
          'Excedido',
          'Licenciatura',
          '',
          'M',
          'Local',
          '${TEST_COORDINATIONS.idiomas.id}',
          'ACTIVO',
          '${TEST_USER_IDS.admin}',
          '${TEST_USER_IDS.admin}'
        ),
        (
          '40000000-0000-4000-8000-000000000183',
          'Docente H18 Modulo Mayor',
          'docente h18 modulo mayor',
          'Docente H18',
          'Modulo',
          'Mayor',
          'Licenciatura',
          '',
          'N',
          'Local',
          '${TEST_COORDINATIONS.idiomas.id}',
          'ACTIVO',
          '${TEST_USER_IDS.admin}',
          '${TEST_USER_IDS.admin}'
        )
      ON CONFLICT (id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          category = EXCLUDED.category,
          updated_at = now();

      INSERT INTO schedules (
        id,
        cycle_id,
        coordination_id,
        teacher_id,
        subject_name,
        group_code,
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
          '50000000-0000-4000-8000-000000000181',
          '${TEST_IDS.cycle}',
          '${TEST_COORDINATIONS.idiomas.id}',
          '40000000-0000-4000-8000-000000000181',
          'H18 QA Reporte',
          'H18-V-COMPLETO',
          'H04 QA Tabulador 100',
          100.00,
          7, 7, 7, 7, 7, 0, 0,
          '${TEST_USER_IDS.admin}',
          '${TEST_USER_IDS.admin}'
        ),
        (
          '50000000-0000-4000-8000-000000000182',
          '${TEST_IDS.cycle}',
          '${TEST_COORDINATIONS.idiomas.id}',
          '40000000-0000-4000-8000-000000000182',
          'H18 QA Reporte',
          'H18-M-EXCEDIDO',
          'H04 QA Tabulador 100',
          100.00,
          10, 10, 10, 0, 0, 0, 0,
          '${TEST_USER_IDS.admin}',
          '${TEST_USER_IDS.admin}'
        ),
        (
          '50000000-0000-4000-8000-000000000183',
          '${TEST_IDS.cycle}',
          '${TEST_COORDINATIONS.idiomas.id}',
          '40000000-0000-4000-8000-000000000183',
          'H18 QA Reporte',
          'H18-N-GREATEST',
          'H04 QA Tabulador 100',
          100.00,
          2, 2, 2, 2, 2, 7, 0,
          '${TEST_USER_IDS.admin}',
          '${TEST_USER_IDS.admin}'
        )
      ON CONFLICT (id) DO UPDATE
      SET hours_l = EXCLUDED.hours_l,
          hours_m = EXCLUDED.hours_m,
          hours_x = EXCLUDED.hours_x,
          hours_j = EXCLUDED.hours_j,
          hours_v = EXCLUDED.hours_v,
          hours_s1 = EXCLUDED.hours_s1,
          hours_s2 = EXCLUDED.hours_s2,
          updated_at = now();
    `);
  } finally {
    await client.end();
  }
}

describeIfDb('H18 operational reports backend integration coverage', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
    await seedCategoryHourScenarios();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('enforces base-extra report access only for admin and direccion', async () => {
    for (const actor of [adminActor(), directionActor()]) {
      const response = await injectAs(app!, actor, {
        method: 'GET',
        url: `/api/reports/operational/base-extra?cycleId=${TEST_IDS.cycle}&calendarConfigId=${TEST_IDS.calendarConfig}&source=live`
      });
      expect(response.statusCode).toBe(200);
    }

    for (const actor of [coordinatorActor(), rhActor(), financeActor(), accountantActor(), accountingActor()]) {
      const response = await injectAs(app!, actor, {
        method: 'GET',
        url: `/api/reports/operational/base-extra?cycleId=${TEST_IDS.cycle}&calendarConfigId=${TEST_IDS.calendarConfig}&source=live`
      });
      expect(response.statusCode).toBe(403);
    }
  });

  it('exposes friendly filter catalogs only to approved H18 roles', async () => {
    const cycles = await injectAs(app!, coordinatorActor(), {
      method: 'GET',
      url: '/api/reports/operational/filters/cycles'
    });
    expect(cycles.statusCode).toBe(200);
    expect(cycles.json().cycles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: TEST_IDS.cycle,
          label: expect.stringContaining('H04 QA Local 2026'),
          status: expect.any(String)
        })
      ])
    );

    const deniedCycles = await injectAs(app!, financeActor(), {
      method: 'GET',
      url: '/api/reports/operational/filters/cycles'
    });
    expect(deniedCycles.statusCode).toBe(403);

    const periods = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/reports/operational/filters/payroll-periods?cycleId=${TEST_IDS.cycle}`
    });
    expect(periods.statusCode).toBe(200);
    expect(periods.json().periods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          calendarConfigId: TEST_IDS.calendarConfig,
          label: expect.stringContaining('H04 QA Mayo 15-28 2026')
        })
      ])
    );

    const deniedPeriods = await injectAs(app!, coordinatorActor(), {
      method: 'GET',
      url: `/api/reports/operational/filters/payroll-periods?cycleId=${TEST_IDS.cycle}`
    });
    expect(deniedPeriods.statusCode).toBe(403);
  });

  it('enforces category-hours report access and coordinator operational scope', async () => {
    for (const actor of [adminActor(), directionActor(), coordinatorActor(), rhActor()]) {
      const response = await injectAs(app!, actor, {
        method: 'GET',
        url: `/api/reports/operational/category-hours?cycleId=${TEST_IDS.cycle}`
      });
      expect(response.statusCode).toBe(200);
    }

    for (const actor of [financeActor(), accountantActor(), accountingActor()]) {
      const response = await injectAs(app!, actor, {
        method: 'GET',
        url: `/api/reports/operational/category-hours?cycleId=${TEST_IDS.cycle}`
      });
      expect(response.statusCode).toBe(403);
    }

    const outOfScope = await injectAs(app!, coordinatorActor(), {
      method: 'GET',
      url: `/api/reports/operational/category-hours?cycleId=${TEST_IDS.cycle}&coordinationId=${TEST_COORDINATIONS.adetur.id}`
    });
    expect(outOfScope.statusCode).toBe(403);
  });

  it('calculates category hours with official V/M/N thresholds and GREATEST assignment', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/reports/operational/category-hours?cycleId=${TEST_IDS.cycle}`
    });
    expect(response.statusCode).toBe(200);

    const rows = response.json().rows as Array<Record<string, string>>;
    const byTeacher = new Map(rows.map((row) => [row.teacherName, row]));

    expect(byTeacher.get('Docente H18 VIP Completo')).toMatchObject({
      expectedHours: '35.00',
      assignedHours: '35.00',
      remainingHours: '0.00',
      status: 'completo'
    });
    expect(byTeacher.get('Docente H18 Medio Excedido')).toMatchObject({
      expectedHours: '25.00',
      assignedHours: '30.00',
      remainingHours: '-5.00',
      status: 'excedido'
    });
    expect(byTeacher.get('Docente QA Idiomas Uno')).toMatchObject({
      expectedHours: '15.00',
      assignedHours: '10.00',
      remainingHours: '5.00',
      status: 'faltante'
    });
    expect(byTeacher.get('Docente H18 Modulo Mayor')).toMatchObject({
      expectedHours: '15.00',
      assignedHours: '17.00',
      hoursLv: '10.00',
      hoursModule1: '17.00',
      status: 'excedido'
    });
  });

  it('filters category-hours by friendly search q and applies it to exports', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/reports/operational/category-hours?cycleId=${TEST_IDS.cycle}&q=Modulo`
    });
    expect(response.statusCode).toBe(200);
    const rows = response.json().rows as Array<Record<string, string>>;
    expect(rows.map((row) => row.teacherName)).toEqual(['Docente H18 Modulo Mayor']);

    const exportResponse = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/reports/operational/category-hours/export?cycleId=${TEST_IDS.cycle}&q=Modulo&format=csv`
    });
    expect(exportResponse.statusCode).toBe(200);
    const csv = withoutBom(exportResponse.body);
    expect(csv).toContain('Docente H18 Modulo Mayor');
    expect(csv).not.toContain('Docente H18 VIP Completo');
  });

  it('requires cycleId for category-hours', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: '/api/reports/operational/category-hours'
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns base-extra live rows without fiscal fields and with approved capturers', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/reports/operational/base-extra?cycleId=${TEST_IDS.cycle}&calendarConfigId=${TEST_IDS.calendarConfig}&source=live&type=withExtras`
    });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.meta.source).toBe('live');
    const rows = body.rows as Array<Record<string, string>>;
    const idiomas = rows.find((row) => row.teacherName === 'Docente QA Idiomas Uno');
    expect(idiomas).toMatchObject({
      source: 'live',
      incidenceExtraHours: '1.00',
      externalExtraHours: '3.00',
      totalExtraHours: '4.00'
    });
    expect(idiomas?.externalExtraCapturedByEmail).toContain('qa.coordinador');
    expect(idiomas?.incidenceUpdatedByEmail).toContain('qa.coordinador.idiomas@tecplayacar.edu.mx');

    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/rfc|bank|paymentType|constancia/i);
  });

  it('filters base-extra by friendly search q across teacher, coordination and capturer text', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/reports/operational/base-extra?cycleId=${TEST_IDS.cycle}&calendarConfigId=${TEST_IDS.calendarConfig}&source=live&type=withExtras&q=multi`
    });
    expect(response.statusCode).toBe(200);
    const rows = response.json().rows as Array<Record<string, string>>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.externalExtraCapturedByEmail?.includes('qa.coordinador.multi'))).toBe(true);

    const exportResponse = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/reports/operational/base-extra/export?cycleId=${TEST_IDS.cycle}&calendarConfigId=${TEST_IDS.calendarConfig}&source=live&type=withExtras&q=multi&format=csv`
    });
    expect(exportResponse.statusCode).toBe(200);
    const csv = withoutBom(exportResponse.body);
    expect(csv).toContain('QA Coordinador Multi');
    expect(csv).not.toMatch(/RFC|Banco|paymentType|Constancia/i);
  });

  it('exports operational reports as CSV with H11 encoding guarantees', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/reports/operational/category-hours/export?cycleId=${TEST_IDS.cycle}&format=csv`
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toContain('reporte-horas-base-categoria');

    const csv = withoutBom(response.body);
    expect(csv).toContain('\r\n');
    expect(csv.split('\r\n')[0]).toContain('"Horas esperadas"');
    expect(csv).toContain('"Docente H18 VIP Completo"');
    expect(csv).not.toMatch(/RFC|Banco|paymentType|Constancia/i);
  });

  it('exports operational reports as readable XLSX without fiscal headers', async () => {
    const response = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: `/api/reports/operational/base-extra/export?cycleId=${TEST_IDS.cycle}&calendarConfigId=${TEST_IDS.calendarConfig}&source=live&format=xlsx`
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(response.headers['content-disposition']).toContain('reporte-horas-base-extras');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(rawBuffer(response) as unknown as ArrayBuffer);
    const worksheet = workbook.getWorksheet('Horas base y extras');
    expect(worksheet).toBeDefined();
    const headerValues = worksheet!.getRow(1).values;
    expect(headerValues).toContain('Docente');
    expect(headerValues).toContain('Extras externos');
    expect(headerValues).not.toContain('RFC');
    expect(headerValues).not.toContain('Banco');
    expect(worksheet!.rowCount).toBeGreaterThan(1);
  });
});
