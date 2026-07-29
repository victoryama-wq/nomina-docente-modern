import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import { cleanupTestApp, describeIntegration, freshTestApp, TEST_IDS } from './api-integration-helpers.js';
import { connectTestDb } from './db/test-db-utils.js';
import {
  accountantActor,
  accountingActor,
  adminActor,
  coordinatorActor,
  directionActor,
  financeActor,
  rhActor
} from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;
const headers =
  'id,identificador,nombres,apellido_paterno,apellido_materno,responsable_operativo_email,categoria,telefono,ubicacion,estatus';

function csvBase64(rows: string[], lineEnding = '\r\n', bom = false): string {
  return Buffer.from(`${bom ? '\uFEFF' : ''}${[headers, ...rows].join(lineEnding)}`, 'utf8').toString('base64');
}

async function seedTeacher(options: {
  id: string;
  identifier: string;
  firstNames: string;
  paternalLastName: string;
  maternalLastName?: string;
  fullName?: string;
  category?: string;
  status?: 'ACTIVO' | 'INACTIVO';
  responsibleEmail?: string | null;
}): Promise<void> {
  const db = await connectTestDb();
  try {
    const maternal = options.maternalLastName || '';
    const fullName = options.fullName || [options.firstNames, options.paternalLastName, maternal].filter(Boolean).join(' ');
    const normalized = fullName
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    await db.query(
      `
        INSERT INTO teachers (
          id, external_identifier, first_names, paternal_last_name, maternal_last_name,
          full_name, normalized_name, category, phone, location, status, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, '', 'Local', $9,
          (SELECT id FROM app_users WHERE email = $10),
          (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
        )
      `,
      [
        options.id,
        options.identifier,
        options.firstNames,
        options.paternalLastName,
        maternal,
        fullName,
        normalized,
        options.category || 'N',
        options.status || 'ACTIVO',
        options.responsibleEmail ?? null
      ]
    );
  } finally {
    await db.end();
  }
}

const protectedTables = [
  'teacher_documents',
  'schedules',
  'schedule_incidences',
  'extra_hours',
  'payroll_lines',
  'payroll_schedule_details',
  'payroll_extra_details',
  'payroll_runs'
] as const;

async function protectedDataFingerprints(): Promise<Record<string, string>> {
  const db = await connectTestDb();
  try {
    const fingerprints: Record<string, string> = {};
    for (const table of protectedTables) {
      const result = await db.query<{ fingerprint: string }>(
        `SELECT md5(COALESCE(string_agg(row_to_json(source)::text, '' ORDER BY row_to_json(source)::text), '')) AS fingerprint FROM ${table} source`
      );
      fingerprints[table] = result.rows[0].fingerprint;
    }
    return fingerprints;
  } finally {
    await db.end();
  }
}

async function preview(app: FastifyInstance, rows: string[], overrides: Record<string, unknown> = {}) {
  return injectAs(app, adminActor(), {
    method: 'POST',
    url: '/api/teachers/import/preview',
    payload: {
      fileName: 'docentes.csv',
      base64Data: csvBase64(rows),
      ...overrides
    }
  });
}

async function applyPreview(
  app: FastifyInstance,
  rows: string[],
  previewData: Record<string, unknown>,
  confirmedRiskActions: string[] = []
) {
  return injectAs(app, adminActor(), {
    method: 'POST',
    url: '/api/teachers/import/apply',
    payload: {
      fileName: 'docentes.csv',
      base64Data: csvBase64(rows),
      fileSha256: previewData.fileSha256,
      teachersFingerprint: previewData.teachersFingerprint,
      responsibleUsersFingerprint: previewData.responsibleUsersFingerprint,
      confirmedRiskActions
    }
  });
}

describeIfDb('H22 teacher CSV import backend', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('restricts all import endpoints explicitly to Admin', async () => {
    const actors = [
      coordinatorActor(),
      directionActor(),
      rhActor(),
      financeActor(),
      accountantActor(),
      accountingActor()
    ];
    for (const actor of actors) {
      const template = await injectAs(app!, actor, { method: 'GET', url: '/api/teachers/import/template' });
      const check = await injectAs(app!, actor, {
        method: 'POST',
        url: '/api/teachers/import/preview',
        payload: { fileName: 'docentes.csv', base64Data: csvBase64([]) }
      });
      const apply = await injectAs(app!, actor, {
        method: 'POST',
        url: '/api/teachers/import/apply',
        payload: {}
      });
      expect([template.statusCode, check.statusCode, apply.statusCode]).toEqual([403, 403, 403]);
    }
  });

  it('downloads blank, active and all templates with exact safe columns', async () => {
    await seedTeacher({
      id: '41000000-0000-4000-8000-000000000001',
      identifier: 'H22-ACT-01',
      firstNames: 'ÁLVARO',
      paternalLastName: 'MUÑOZ',
      responsibleEmail: 'qa.coordinador.idiomas@tecplayacar.edu.mx'
    });
    await seedTeacher({
      id: '41000000-0000-4000-8000-000000000002',
      identifier: 'H22-INACT-01',
      firstNames: 'INACTIVO',
      paternalLastName: 'PRUEBA',
      status: 'INACTIVO',
      responsibleEmail: null
    });

    const blank = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: '/api/teachers/import/template?scope=blank'
    });
    expect(blank.statusCode).toBe(200);
    expect(blank.headers['content-disposition']).toContain('plantilla-importacion-docentes.csv');
    expect(blank.body.charCodeAt(0)).toBe(0xfeff);
    expect(blank.body).toBe(`\uFEFF${headers}\r\n`);

    const active = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: '/api/teachers/import/template?scope=active'
    });
    expect(active.statusCode).toBe(200);
    expect(active.headers['content-disposition']).toContain('docentes-activos-para-edicion.csv');
    expect(active.body).toContain('H22-ACT-01');
    expect(active.body).not.toContain('H22-INACT-01');
    expect(active.body).toContain('qa.coordinador.idiomas@tecplayacar.edu.mx');
    expect(active.body).not.toMatch(/rfc|payment_type|bank_detail|clabe/i);

    const all = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: '/api/teachers/import/template?scope=all'
    });
    expect(all.headers['content-disposition']).toContain('todos-los-docentes-para-edicion.csv');
    expect(all.body).toContain('H22-ACT-01');
    expect(all.body).toContain('H22-INACT-01');
    expect(all.body).toContain('H22-INACT-01,INACTIVO,PRUEBA,,,N,,Local,INACTIVO');
  });

  it('round-trips an existing legacy teacher whose name components are empty', async () => {
    const legacyTeacherId = '41000000-0000-4000-8000-000000000022';
    await seedTeacher({
      id: legacyTeacherId,
      identifier: 'H22-LEGACY-NAME',
      firstNames: '',
      paternalLastName: '',
      fullName: 'DOCENTE LEGACY SIN COMPONENTES',
      responsibleEmail: 'qa.coordinador.idiomas@tecplayacar.edu.mx'
    });

    const template = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: '/api/teachers/import/template?scope=active'
    });
    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/teachers/import/preview',
      payload: {
        fileName: 'docentes-activos-para-edicion.csv',
        base64Data: Buffer.from(template.body, 'utf8').toString('base64')
      }
    });

    expect(response.statusCode).toBe(200);
    const previewData = response.json().preview;
    const legacyRow = previewData.rows.find((row: { teacherId: string | null }) => row.teacherId === legacyTeacherId);
    expect(legacyRow).toMatchObject({
      action: 'SIN_CAMBIOS',
      blocking: false,
      teacherName: 'DOCENTE LEGACY SIN COMPONENTES'
    });
    expect(previewData.hasBlockingErrors).toBe(false);
  });

  it('parses BOM, LF, quoted commas and embedded newlines without writing or auditing', async () => {
    const protectedBefore = await protectedDataFingerprints();
    const beforeDb = await connectTestDb();
    const before = await beforeDb.query<{ teachers: number; audit: number }>(
      'SELECT (SELECT count(*)::int FROM teachers) AS teachers, (SELECT count(*)::int FROM audit_log) AS audit'
    );
    await beforeDb.end();
    const csv = `\uFEFF${headers}\n,H22-CSV-01,"José,\nÁngel",Muñoz,,qa.admin@tecplayacar.edu.mx,N,+529841234567,"Aula, Centro",ACTIVO`;
    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/teachers/import/preview',
      payload: { fileName: '../docentes.csv', base64Data: Buffer.from(csv, 'utf8').toString('base64') }
    });
    expect(response.statusCode).toBe(200);
    const data = response.json().preview;
    expect(data.fileName).toBe('docentes.csv');
    expect(data.rows[0]).toMatchObject({
      action: 'NUEVO',
      teacherName: 'JOSÉ, ÁNGEL MUÑOZ',
      blocking: false
    });
    expect(data.rows[0]).not.toHaveProperty('responsibleUserId');
    const afterDb = await connectTestDb();
    const after = await afterDb.query<{ teachers: number; audit: number }>(
      'SELECT (SELECT count(*)::int FROM teachers) AS teachers, (SELECT count(*)::int FROM audit_log) AS audit'
    );
    await afterDb.end();
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(await protectedDataFingerprints()).toEqual(protectedBefore);
  });

  it('rejects invalid Base64, exact-header violations, oversized files and more than 5000 rows', async () => {
    const invalidBase64 = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/teachers/import/preview',
      payload: { fileName: 'docentes.csv', base64Data: '%%%=' }
    });
    expect(invalidBase64.statusCode).toBe(400);
    expect(invalidBase64.json().code).toBe('ARCHIVO_INVALIDO');

    const invalidHeader = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/teachers/import/preview',
      payload: {
        fileName: 'docentes.csv',
        base64Data: Buffer.from(`${headers},rfc\n`, 'utf8').toString('base64')
      }
    });
    expect(invalidHeader.statusCode).toBe(400);
    expect(invalidHeader.json().code).toBe('ENCABEZADO_INVALIDO');

    const oversized = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/teachers/import/preview',
      payload: { fileName: 'docentes.csv', base64Data: Buffer.alloc(1024 * 1024 + 1, 65).toString('base64') }
    });
    expect(oversized.json().code).toBe('ARCHIVO_EXCEDE_LIMITE');

    const rows = Array.from(
      { length: 5001 },
      (_, index) => `,H22-${index},DOCENTE ${index},PRUEBA,,qa.admin@tecplayacar.edu.mx,N,,,ACTIVO`
    );
    const tooMany = await preview(app!, rows);
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json().code).toBe('ARCHIVO_EXCEDE_LIMITE');
  });

  it('matches by UUID or identifier and rejects incompatible identities', async () => {
    await seedTeacher({
      id: '41000000-0000-4000-8000-000000000010',
      identifier: 'H22-MATCH-A',
      firstNames: 'MATCH',
      paternalLastName: 'ALFA',
      responsibleEmail: 'qa.admin@tecplayacar.edu.mx'
    });
    await seedTeacher({
      id: '41000000-0000-4000-8000-000000000011',
      identifier: 'H22-MATCH-B',
      firstNames: 'MATCH',
      paternalLastName: 'BETA',
      responsibleEmail: 'qa.admin@tecplayacar.edu.mx'
    });
    const byIdentifier = await preview(app!, [
      ',h22-match-a,MATCH,ALFA,,qa.admin@tecplayacar.edu.mx,N,,,ACTIVO'
    ]);
    expect(byIdentifier.json().preview.rows[0]).toMatchObject({ matchedBy: 'identificador', action: 'SIN_CAMBIOS' });

    const byId = await preview(app!, [
      '41000000-0000-4000-8000-000000000010,H22-MATCH-NEW,MATCH,ALFA,,qa.admin@tecplayacar.edu.mx,N,,,ACTIVO'
    ]);
    expect(byId.json().preview.rows[0]).toMatchObject({ matchedBy: 'id', action: 'ACTUALIZAR_IDENTIFICADOR' });

    const incompatible = await preview(app!, [
      '41000000-0000-4000-8000-000000000010,H22-MATCH-B,MATCH,ALFA,,qa.admin@tecplayacar.edu.mx,N,,,ACTIVO'
    ]);
    expect(incompatible.json().preview.rows[0].action).toBe('ID_IDENTIFICADOR_INCOMPATIBLE');
  });

  it('blocks duplicate identifiers and normalized names in CSV or database', async () => {
    await seedTeacher({
      id: '41000000-0000-4000-8000-000000000020',
      identifier: 'H22-USED',
      firstNames: 'NOMBRE',
      paternalLastName: 'EXISTENTE',
      responsibleEmail: 'qa.admin@tecplayacar.edu.mx'
    });
    const duplicateCsv = await preview(app!, [
      ',H22-DUP,NUEVO,UNO,,qa.admin@tecplayacar.edu.mx,N,,,ACTIVO',
      ',h22-dup,NUEVO,DOS,,qa.admin@tecplayacar.edu.mx,N,,,ACTIVO'
    ]);
    expect(duplicateCsv.json().preview.summary.IDENTIFICADOR_DUPLICADO_CSV).toBe(2);

    const duplicateName = await preview(app!, [
      ',H22-NAME-1,NOMBRE,EXISTENTE,,qa.admin@tecplayacar.edu.mx,N,,,ACTIVO'
    ]);
    expect(duplicateName.json().preview.rows[0].action).toBe('POSIBLE_DUPLICADO_NOMBRE');

    const duplicateCsvName = await preview(app!, [
      ',H22-NAME-2,JOSÉ,MUÑOZ,,qa.admin@tecplayacar.edu.mx,N,,,ACTIVO',
      ',H22-NAME-3,Jose,Munoz,,qa.admin@tecplayacar.edu.mx,N,,,ACTIVO'
    ]);
    expect(duplicateCsvName.json().preview.summary.DUPLICADO_NOMBRE_CSV).toBe(2);
  });

  it('validates responsible existence, active status and allowed roles', async () => {
    const missing = await preview(app!, [
      ',H22-RESP-1,NUEVO,RESPONSABLE,,nadie@tecplayacar.edu.mx,N,,,ACTIVO'
    ]);
    expect(missing.json().preview.rows[0].action).toBe('RESPONSABLE_NO_ENCONTRADO');

    const unauthorized = await preview(app!, [
      ',H22-RESP-2,NUEVO,RESPONSABLE,,qa.rh@tecplayacar.edu.mx,N,,,ACTIVO'
    ]);
    expect(unauthorized.json().preview.rows[0].action).toBe('RESPONSABLE_NO_AUTORIZADO');

    const db = await connectTestDb();
    await db.query("UPDATE app_users SET status = 'INACTIVO' WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx'");
    await db.end();
    const inactive = await preview(app!, [
      ',H22-RESP-3,NUEVO,RESPONSABLE,,qa.coordinador.idiomas@tecplayacar.edu.mx,N,,,ACTIVO'
    ]);
    expect(inactive.json().preview.rows[0].action).toBe('RESPONSABLE_INACTIVO');

    const direction = await preview(app!, [
      ',H22-RESP-4,NUEVO,DIRECCION,,qa.direccion@tecplayacar.edu.mx,N,,,ACTIVO'
    ]);
    expect(direction.json().preview.rows[0]).toMatchObject({ action: 'NUEVO', blocking: false });
  });

  it('handles legacy teachers without a responsible according to the approved rule', async () => {
    await seedTeacher({
      id: '41000000-0000-4000-8000-000000000030',
      identifier: 'H22-LEGACY',
      firstNames: 'LEGACY',
      paternalLastName: 'SIN RESPONSABLE',
      responsibleEmail: null
    });
    const unchanged = await preview(app!, [
      '41000000-0000-4000-8000-000000000030,H22-LEGACY,LEGACY,SIN RESPONSABLE,,,N,,Local,ACTIVO'
    ]);
    expect(unchanged.json().preview.rows[0]).toMatchObject({
      action: 'SIN_CAMBIOS',
      blocking: false,
      warnings: ['RESPONSABLE_OPERATIVO_AUSENTE']
    });

    const changedWithoutResponsible = await preview(app!, [
      '41000000-0000-4000-8000-000000000030,H22-LEGACY,LEGACY,SIN RESPONSABLE,,,M,,Local,ACTIVO'
    ]);
    expect(changedWithoutResponsible.json().preview.rows[0].action).toBe('RESPONSABLE_OPERATIVO_REQUERIDO');

    const initialAssignment = await preview(app!, [
      '41000000-0000-4000-8000-000000000030,H22-LEGACY,LEGACY,SIN RESPONSABLE,,qa.admin@tecplayacar.edu.mx,N,,Local,ACTIVO'
    ]);
    expect(initialAssignment.json().preview.rows[0].action).toBe('ACTUALIZAR_RESPONSABLE_OPERATIVO');
  });

  it('blocks inactivation with active/planning dependencies but ignores closed-only schedules', async () => {
    const blocked = await preview(app!, [
      `${TEST_IDS.teacherIdiomas},,Docente QA,Idiomas,Uno,qa.coordinador.idiomas@tecplayacar.edu.mx,N,,Local,INACTIVO`
    ]);
    expect(blocked.json().preview.rows[0]).toMatchObject({
      action: 'INACTIVACION_CON_DEPENDENCIAS',
      blocking: true
    });
    expect(blocked.json().preview.rows[0].dependencies.schedules).toBeGreaterThan(0);
    expect(blocked.json().preview.rows[0].dependencies.extras).toBeGreaterThan(0);

    await seedTeacher({
      id: '41000000-0000-4000-8000-000000000040',
      identifier: 'H22-HIST',
      firstNames: 'SOLO',
      paternalLastName: 'HISTORICO',
      responsibleEmail: 'qa.admin@tecplayacar.edu.mx'
    });
    const db = await connectTestDb();
    await db.query(
      `
        INSERT INTO schedules (
          id, cycle_id, coordination_id, teacher_id, subject_id, subject_name, group_code,
          tabulator_id, tabulator_name, tabulator_amount, created_by, updated_by
        )
        VALUES (
          '51000000-0000-4000-8000-000000000040', $1,
          '10000000-0000-4000-8000-000000000001',
          '41000000-0000-4000-8000-000000000040', $2, 'H04 QA Materia Base', 'H22-HIST',
          $3, 'H04 QA Tabulador 100', 100,
          '20000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001'
        )
      `,
      [TEST_IDS.closedCycle, TEST_IDS.subject, TEST_IDS.tabulator]
    );
    await db.end();
    const allowed = await preview(app!, [
      '41000000-0000-4000-8000-000000000040,H22-HIST,SOLO,HISTORICO,,qa.admin@tecplayacar.edu.mx,N,,Local,INACTIVO'
    ]);
    expect(allowed.json().preview.rows[0]).toMatchObject({ action: 'INACTIVAR', blocking: false });
  });

  it('requires explicit confirmation for risky categories and never trusts row actions', async () => {
    await seedTeacher({
      id: '41000000-0000-4000-8000-000000000050',
      identifier: 'H22-RISK',
      firstNames: 'RIESGO',
      paternalLastName: 'CONTROLADO',
      responsibleEmail: 'qa.admin@tecplayacar.edu.mx'
    });
    const rows = [
      '41000000-0000-4000-8000-000000000050,H22-RISK,RIESGO,CAMBIADO,,qa.admin@tecplayacar.edu.mx,M,,Local,ACTIVO'
    ];
    const checked = await preview(app!, rows);
    const data = checked.json().preview;
    expect(data.rows[0].action).toBe('ACTUALIZAR_MULTIPLE');
    expect(data.requiresSecondConfirmation).toEqual(['ACTUALIZAR_MULTIPLE']);

    const denied = await applyPreview(app!, rows, data);
    expect(denied.statusCode).toBe(409);
    expect(denied.json().code).toBe('CONFIRMACION_INSUFICIENTE');

    const applied = await applyPreview(app!, rows, data, ['ACTUALIZAR_MULTIPLE']);
    expect(applied.statusCode).toBe(200);
    expect(applied.json().result.updated).toBe(1);
  });

  it('creates and updates atomically, audits safe operational fields and leaves fiscal data untouched', async () => {
    await seedTeacher({
      id: '41000000-0000-4000-8000-000000000060',
      identifier: 'H22-UPD',
      firstNames: 'DOCENTE',
      paternalLastName: 'ACTUALIZABLE',
      responsibleEmail: 'qa.admin@tecplayacar.edu.mx'
    });
    const db = await connectTestDb();
    await db.query(
      `
        UPDATE teachers
        SET rfc = 'AAA010101AAA', email = 'fiscal@ejemplo.test', payment_type = 'E', bank_detail = 'BANCO PROTEGIDO'
        WHERE id = '41000000-0000-4000-8000-000000000060'
      `
    );
    await db.end();
    const protectedBefore = await protectedDataFingerprints();
    const rows = [
      ',H22-NEW,JOSÉ,ÁLVAREZ,ÑERI,qa.coordinador.idiomas@tecplayacar.edu.mx,V,+529841234567,Centro,ACTIVO',
      '41000000-0000-4000-8000-000000000060,H22-UPD,DOCENTE,ACTUALIZABLE,,qa.direccion@tecplayacar.edu.mx,N,+529849876543,Norte,ACTIVO'
    ];
    const checked = await preview(app!, rows);
    const data = checked.json().preview;
    expect(data.hasBlockingErrors).toBe(false);
    expect(data.summary).toMatchObject({ NUEVO: 1, ACTUALIZAR_MULTIPLE: 1 });
    const applied = await applyPreview(app!, rows, data, ['ACTUALIZAR_MULTIPLE']);
    expect(applied.statusCode).toBe(200);
    expect(applied.json().result).toMatchObject({ created: 1, updated: 1 });

    const verify = await connectTestDb();
    try {
      const updated = await verify.query<{
        rfc: string;
        email: string;
        payment_type: string;
        bank_detail: string;
        created_by_email: string;
      }>(
        `
          SELECT t.rfc, t.email, t.payment_type, t.bank_detail, u.email AS created_by_email
          FROM teachers t
          LEFT JOIN app_users u ON u.id = t.created_by
          WHERE t.id = '41000000-0000-4000-8000-000000000060'
        `
      );
      expect(updated.rows[0]).toEqual({
        rfc: 'AAA010101AAA',
        email: 'fiscal@ejemplo.test',
        payment_type: 'E',
        bank_detail: 'BANCO PROTEGIDO',
        created_by_email: 'qa.direccion@tecplayacar.edu.mx'
      });
      const audit = await verify.query<{ action: string; payload: string }>(
        `
          SELECT action, COALESCE(before_data::text, '') || COALESCE(after_data::text, '') AS payload
          FROM audit_log
          WHERE action LIKE 'TEACHER_%'
          ORDER BY created_at
        `
      );
      expect(audit.rows.map((row) => row.action)).toEqual(
        expect.arrayContaining(['TEACHER_CREATED', 'TEACHER_UPDATED', 'TEACHER_RESPONSIBLE_REASSIGNED', 'TEACHER_IMPORT_APPLIED'])
      );
      expect(audit.rows.map((row) => row.payload).join(' ')).not.toMatch(/AAA010101AAA|BANCO PROTEGIDO|paymentType|bankDetail/i);
    } finally {
      await verify.end();
    }
    expect(await protectedDataFingerprints()).toEqual(protectedBefore);
  });

  it('rejects stale files, teachers and responsible users before any write', async () => {
    const rows = [',H22-STALE,NUEVO,OBSOLETO,,qa.admin@tecplayacar.edu.mx,N,,,ACTIVO'];
    const checked = await preview(app!, rows);
    const data = checked.json().preview;
    const staleFile = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/teachers/import/apply',
      payload: {
        fileName: 'docentes.csv',
        base64Data: csvBase64([',H22-OTHER,OTRO,ARCHIVO,,qa.admin@tecplayacar.edu.mx,N,,,ACTIVO']),
        fileSha256: data.fileSha256,
        teachersFingerprint: data.teachersFingerprint,
        responsibleUsersFingerprint: data.responsibleUsersFingerprint,
        confirmedRiskActions: []
      }
    });
    expect(staleFile.json().code).toBe('PREVIEW_OBSOLETO');

    const db = await connectTestDb();
    await db.query("UPDATE teachers SET updated_at = now() + interval '1 second' WHERE id = $1", [TEST_IDS.teacherMulti]);
    await db.end();
    const staleTeacher = await applyPreview(app!, rows, data);
    expect(staleTeacher.json().code).toBe('PREVIEW_OBSOLETO');

    const responsibleRows = [
      ',H22-STALE-RESP,NUEVO,RESPONSABLE,,qa.coordinador.idiomas@tecplayacar.edu.mx,N,,,ACTIVO'
    ];
    const responsiblePreview = await preview(app!, responsibleRows);
    const responsibleData = responsiblePreview.json().preview;
    const responsibleDb = await connectTestDb();
    await responsibleDb.query(
      "UPDATE app_users SET updated_at = now() + interval '1 second' WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx'"
    );
    await responsibleDb.end();
    const staleResponsible = await applyPreview(app!, responsibleRows, responsibleData);
    expect(staleResponsible.json().code).toBe('PREVIEW_OBSOLETO');
  });

  it('rejects a newly introduced dependency during Apply and rolls back every row', async () => {
    await seedTeacher({
      id: '41000000-0000-4000-8000-000000000070',
      identifier: 'H22-INACT-SAFE',
      firstNames: 'INACTIVAR',
      paternalLastName: 'SEGURO',
      responsibleEmail: 'qa.admin@tecplayacar.edu.mx'
    });
    const rows = [
      '41000000-0000-4000-8000-000000000070,H22-INACT-SAFE,INACTIVAR,SEGURO,,qa.admin@tecplayacar.edu.mx,N,,Local,INACTIVO'
    ];
    const checked = await preview(app!, rows);
    const data = checked.json().preview;
    expect(data.rows[0].action).toBe('INACTIVAR');

    const db = await connectTestDb();
    await db.query(
      `
        INSERT INTO extra_hours (
          cycle_id, coordination_id, teacher_id, hours, tabulator_amount, reason, captured_by, updated_by
        )
        VALUES (
          $1, '10000000-0000-4000-8000-000000000001',
          '41000000-0000-4000-8000-000000000070', 1, 100, 'Dependencia concurrente',
          '20000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001'
        )
      `,
      [TEST_IDS.cycle]
    );
    await db.end();
    const applied = await applyPreview(app!, rows, data, ['INACTIVAR']);
    expect(applied.statusCode).toBe(409);
    expect(applied.json().code).toBe('PREVIEW_OBSOLETO');
    const verify = await connectTestDb();
    const teacher = await verify.query<{ status: string }>(
      "SELECT status::text FROM teachers WHERE id = '41000000-0000-4000-8000-000000000070'"
    );
    await verify.end();
    expect(teacher.rows[0].status).toBe('ACTIVO');
  });

  it('does not update timestamps or create per-teacher audit entries for SIN_CAMBIOS', async () => {
    await seedTeacher({
      id: '41000000-0000-4000-8000-000000000080',
      identifier: 'H22-SAME',
      firstNames: 'SIN',
      paternalLastName: 'CAMBIOS',
      responsibleEmail: 'qa.admin@tecplayacar.edu.mx'
    });
    const rows = [
      '41000000-0000-4000-8000-000000000080,H22-SAME,SIN,CAMBIOS,,qa.admin@tecplayacar.edu.mx,N,,Local,ACTIVO'
    ];
    const beforeDb = await connectTestDb();
    const before = await beforeDb.query<{ updated_at: string }>(
      "SELECT updated_at::text FROM teachers WHERE id = '41000000-0000-4000-8000-000000000080'"
    );
    await beforeDb.end();
    const checked = await preview(app!, rows);
    const applied = await applyPreview(app!, rows, checked.json().preview);
    expect(applied.statusCode).toBe(200);
    expect(applied.json().result.unchanged).toBe(1);
    const afterDb = await connectTestDb();
    const after = await afterDb.query<{ updated_at: string }>(
      "SELECT updated_at::text FROM teachers WHERE id = '41000000-0000-4000-8000-000000000080'"
    );
    const perTeacherAudit = await afterDb.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM audit_log WHERE entity_id = '41000000-0000-4000-8000-000000000080'"
    );
    await afterDb.end();
    expect(after.rows[0].updated_at).toBe(before.rows[0].updated_at);
    expect(perTeacherAudit.rows[0].total).toBe(0);
  });
});
