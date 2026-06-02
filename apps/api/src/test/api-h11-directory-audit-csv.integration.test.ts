import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import { TEST_IDS, cleanupTestApp, describeIntegration, freshTestApp } from './api-integration-helpers.js';
import { connectTestDb } from './db/test-db-utils.js';
import { adminActor, coordinatorActor, rhActor } from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

const TEACHER_EXPORT_HEADERS = [
  'Fila legacy',
  'ID docente legacy',
  'Docente',
  'Nombres',
  'Apellido paterno',
  'Apellido materno',
  'Grado',
  'Tipo de pago',
  'Categoría',
  'Ubicacion',
  'Comentario',
  'Observacion',
  'Coordinación',
  'Telefono',
  'Correo',
  'RFC',
  'Identificador',
  'Banco detalle',
  'Estatus',
  'Constancia',
  'Fecha creacion',
  'Fecha actualizacion',
  'Creado por',
  'Actualizado por'
];

const TEACHER_HISTORY_HEADERS = [
  ...TEACHER_EXPORT_HEADERS.slice(0, 22),
  'Acción historial',
  'Usuario historial',
  'Fecha historial',
  'Datos antes',
  'Datos despues'
];

const AUDIT_EXPORT_HEADERS = [
  'Fecha',
  'Usuario',
  'Acción',
  'Módulo',
  'Registro',
  'ID entidad',
  'Antes',
  'Despues',
  'Metadatos'
];

function quotedHeader(headers: string[]): string {
  return headers.map((header) => `"${header}"`).join(',');
}

function withoutBom(csv: string): string {
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  return csv.slice(1);
}

function expectCsvResponse(response: LightMyRequestResponse, headers: string[], filename: string): string {
  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('text/csv; charset=utf-8');
  expect(response.headers['content-disposition']).toBe(`attachment; filename="${filename}"`);

  const csv = withoutBom(response.body);
  expect(csv.split('\r\n')[0]).toBe(quotedHeader(headers));
  return csv;
}

async function seedDirectoryAndAuditCsvEdgeText(): Promise<void> {
  const client = await connectTestDb();
  try {
    await client.query(
      `
        UPDATE teachers
        SET full_name = 'Docente QA Álvarez, "Especial"',
            normalized_name = 'docente qa alvarez especial',
            first_names = 'María José',
            paternal_last_name = 'Álvarez',
            maternal_last_name = 'Muñoz',
            payment_type = '1',
            comment = 'Comentario con coma, y "comillas"',
            observation = 'Línea uno' || chr(10) || 'Línea dos',
            email = 'qa.docente.acento@tecplayacar.edu.mx',
            rfc = 'TEST010101AAA',
            bank_detail = 'Banco, cuenta "QA"',
            updated_at = now()
        WHERE id = $1
      `,
      [TEST_IDS.teacherIdiomas]
    );

    await client.query(
      `
        INSERT INTO audit_log (
          actor_user_id,
          actor_email,
          action,
          entity_type,
          entity_id,
          before_data,
          after_data,
          metadata,
          created_at
        )
        VALUES (
          (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx'),
          'qa.admin@tecplayacar.edu.mx',
          'H11_CSV_EXPORT_TEST',
          'teacher',
          $1,
          $2::jsonb,
          $3::jsonb,
          $4::jsonb,
          now()
        )
      `,
      [
        TEST_IDS.teacherIdiomas,
        JSON.stringify({
          fullName: 'Docente QA Anterior',
          comentario: 'Antes, con "comillas"',
          nota: 'Línea uno\nLínea dos'
        }),
        JSON.stringify({
          fullName: 'Docente QA Álvarez, "Especial"',
          comentario: 'Después, con "comillas"'
        }),
        JSON.stringify({
          modulo: 'Auditoría, CSV',
          detalle: 'Metadata "QA"'
        })
      ]
    );
  } finally {
    await client.end();
  }
}

describeIfDb('H11 Directory and Audit CSV exports', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
    await seedDirectoryAndAuditCsvEdgeText();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('exports active and historical teachers CSV with UTF-8 BOM, stable headers, escaping and existing permissions', async () => {
    const activeBlocked = await injectAs(app!, coordinatorActor(), {
      method: 'GET',
      url: '/api/teachers/export/active'
    });
    expect(activeBlocked.statusCode).toBe(403);

    const active = await injectAs(app!, rhActor(), {
      method: 'GET',
      url: '/api/teachers/export/active'
    });
    const activeCsv = expectCsvResponse(active, TEACHER_EXPORT_HEADERS, 'docentes-activos.csv');
    expect(activeCsv).toContain('"Docente QA Álvarez, ""Especial"""');
    expect(activeCsv).toContain('"Comentario con coma, y ""comillas"""');
    expect(activeCsv).toContain('"Línea uno\nLínea dos"');
    expect(activeCsv).toContain('"TEST010101AAA"');
    expect(activeCsv).toContain('"Banco, cuenta ""QA"""');

    const historyBlocked = await injectAs(app!, rhActor(), {
      method: 'GET',
      url: '/api/teachers/export/history'
    });
    expect(historyBlocked.statusCode).toBe(403);

    const history = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: '/api/teachers/export/history'
    });
    const historyCsv = expectCsvResponse(history, TEACHER_HISTORY_HEADERS, 'docentes-completo-historial.csv');
    expect(historyCsv).toContain('"H11_CSV_EXPORT_TEST"');
    expect(historyCsv).toContain('Docente QA Álvarez');
    expect(historyCsv).toContain('""Especial""');
    expect(historyCsv).toContain('Antes, con');
    expect(historyCsv).toContain('Después, con');
  });

  it('exports audit CSV with UTF-8 BOM, stable headers, JSON escaping and existing permissions', async () => {
    const blocked = await injectAs(app!, coordinatorActor(), {
      method: 'GET',
      url: '/api/audit/export'
    });
    expect(blocked.statusCode).toBe(403);

    const audit = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: '/api/audit/export?search=H11_CSV_EXPORT_TEST'
    });
    const auditCsv = expectCsvResponse(audit, AUDIT_EXPORT_HEADERS, 'auditoria-bitacora.csv');
    expect(auditCsv).toContain('"H11_CSV_EXPORT_TEST"');
    expect(auditCsv).toContain('"teacher"');
    expect(auditCsv).toContain('"Docente QA Álvarez, ""Especial"""');
    expect(auditCsv).toContain('Auditoría, CSV');
    expect(auditCsv).toContain('Metadata');
    expect(auditCsv).toContain('QA');
  });
});
