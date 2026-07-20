import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import { cleanupTestApp, describeIntegration, freshTestApp } from './api-integration-helpers.js';
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

function csvBase64(rows: string[]): string {
  return Buffer.from(['id,clave,nombre,estatus', ...rows].join('\r\n'), 'utf8').toString('base64');
}

async function seedAccentedSubject(): Promise<void> {
  const client = await connectTestDb();
  try {
    await client.query(`
      INSERT INTO subjects (id, official_code, name, status)
      VALUES ('30000000-0000-4000-8000-000000000091', 'ADM-TUR', 'Administracion Turistica', 'ACTIVO')
      ON CONFLICT (id) DO UPDATE
      SET official_code = EXCLUDED.official_code,
          name = EXCLUDED.name,
          status = EXCLUDED.status
    `);
  } finally {
    await client.end();
  }
}

async function seedHistoricalNormalizedDuplicate(): Promise<void> {
  const client = await connectTestDb();
  try {
    await client.query(`
      INSERT INTO subjects (id, official_code, name, status) VALUES
        ('30000000-0000-4000-8000-000000000092', NULL, 'Planeacion y Control de Presupuestos', 'ACTIVO'),
        ('30000000-0000-4000-8000-000000000093', NULL, 'PLANEACION Y CONTROL DE PRESUPUESTOS', 'INACTIVO')
      ON CONFLICT (id) DO UPDATE
      SET official_code = EXCLUDED.official_code,
          name = EXCLUDED.name,
          status = EXCLUDED.status
    `);
  } finally {
    await client.end();
  }
}

describeIfDb('H21 subject CSV import and normalized search', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('offers H11 CSV template only to administrators', async () => {
    await seedHistoricalNormalizedDuplicate();
    const response = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: '/api/catalogs/subjects/import/template'
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toContain('plantilla-importacion-asignaturas-blank.csv');
    expect(response.body.charCodeAt(0)).toBe(0xfeff);
    expect(response.body).toContain('\r\n');

    const catalog = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: '/api/catalogs/subjects/import/template?scope=catalog'
    });
    expect(catalog.statusCode).toBe(200);
    expect(catalog.body).toContain('H04 QA Materia Base');
    expect(catalog.body).toContain('Planeacion y Control de Presupuestos');
    expect(catalog.body).not.toContain('PLANEACION Y CONTROL DE PRESUPUESTOS');

    const catalogWithInactive = await injectAs(app!, adminActor(), {
      method: 'GET',
      url: '/api/catalogs/subjects/import/template?scope=catalog&includeInactive=true'
    });
    expect(catalogWithInactive.statusCode).toBe(200);
    expect(catalogWithInactive.body).toContain('Planeacion y Control de Presupuestos');
    expect(catalogWithInactive.body).toContain('PLANEACION Y CONTROL DE PRESUPUESTOS');

    for (const actor of [coordinatorActor(), directionActor(), rhActor(), financeActor(), accountantActor(), accountingActor()]) {
      const denied = await injectAs(app!, actor, {
        method: 'GET',
        url: '/api/catalogs/subjects/import/template'
      });
      expect(denied.statusCode).toBe(403);
    }
  });

  it('allows canonical updates by ID when only an inactive historical duplicate shares the normalized name', async () => {
    await seedHistoricalNormalizedDuplicate();
    const base64Data = csvBase64([
      '30000000-0000-4000-8000-000000000092,H21-PLAN,Planeacion y Control de Presupuestos,ACTIVO'
    ]);
    const previewResponse = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: { fileName: 'canonica.csv', base64Data }
    });
    expect(previewResponse.statusCode).toBe(200);
    const preview = previewResponse.json().preview;
    expect(preview.hasBlockingErrors).toBe(false);
    expect(preview.summary.ACTUALIZAR_CLAVE).toBe(1);

    const applyResponse = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/apply',
      payload: {
        fileName: 'canonica.csv',
        base64Data,
        fileSha256: preview.fileSha256,
        catalogFingerprint: preview.catalogFingerprint,
        confirmed: true
      }
    });
    expect(applyResponse.statusCode).toBe(200);

    const db = await connectTestDb();
    try {
      const subjects = await db.query<{ id: string; official_code: string | null; status: string }>(`
        SELECT id, official_code, status::text
        FROM subjects
        WHERE id IN (
          '30000000-0000-4000-8000-000000000092',
          '30000000-0000-4000-8000-000000000093'
        )
        ORDER BY id
      `);
      expect(subjects.rows).toEqual([
        { id: '30000000-0000-4000-8000-000000000092', official_code: 'H21-PLAN', status: 'ACTIVO' },
        { id: '30000000-0000-4000-8000-000000000093', official_code: null, status: 'INACTIVO' }
      ]);
    } finally {
      await db.end();
    }
  });

  it('keeps new normalized collisions and two active CSV variants blocked', async () => {
    await seedHistoricalNormalizedDuplicate();
    const newCollision = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: {
        fileName: 'nueva-colision.csv',
        base64Data: csvBase64([',H21-OTRA,PLANEACION Y CONTROL DE PRESUPUESTOS,ACTIVO'])
      }
    });
    expect(newCollision.statusCode).toBe(200);
    expect(newCollision.json().preview.summary.POSIBLE_DUPLICADO_NOMBRE).toBe(1);

    const activeVariants = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: {
        fileName: 'dos-activas.csv',
        base64Data: csvBase64([
          '30000000-0000-4000-8000-000000000092,,Planeacion y Control de Presupuestos,ACTIVO',
          '30000000-0000-4000-8000-000000000093,,PLANEACION Y CONTROL DE PRESUPUESTOS,ACTIVO'
        ])
      }
    });
    expect(activeVariants.statusCode).toBe(200);
    expect(activeVariants.json().preview.summary.DUPLICADO_NOMBRE_CSV).toBe(2);
  });

  it('previews and atomically applies one code assignment and one new subject', async () => {
    const client = await connectTestDb();
    const existing = await client.query<{ id: string }>("SELECT id FROM subjects WHERE name = 'H04 QA Materia Base'");
    await client.end();

    const base64Data = csvBase64([
      `${existing.rows[0].id},H04-BASE,H04 QA Materia Base,ACTIVO`,
      ',H21-NUEVA,Ética Profesional,ACTIVO'
    ]);
    const previewResponse = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: { fileName: 'asignaturas.csv', base64Data }
    });
    expect(previewResponse.statusCode).toBe(200);
    const preview = previewResponse.json().preview;
    expect(preview.hasBlockingErrors).toBe(false);
    expect(preview.summary).toMatchObject({ ACTUALIZAR_CLAVE: 1, NUEVA: 1 });

    const applyResponse = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/apply',
      payload: {
        fileName: 'asignaturas.csv',
        base64Data,
        fileSha256: preview.fileSha256,
        catalogFingerprint: preview.catalogFingerprint,
        confirmed: true
      }
    });
    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.json().result).toEqual({ inserted: 1, updated: 1, unchanged: 0, total: 2 });

    const verify = await connectTestDb();
    try {
      const rows = await verify.query<{ official_code: string; name: string }>(
        "SELECT official_code, name FROM subjects WHERE official_code IN ('H04-BASE', 'H21-NUEVA') ORDER BY official_code"
      );
      expect(rows.rows).toEqual([
        { official_code: 'H04-BASE', name: 'H04 QA Materia Base' },
        { official_code: 'H21-NUEVA', name: 'Ética Profesional' }
      ]);
      const audit = await verify.query<{ action: string; total: number }>(
        `SELECT action, count(*)::int AS total FROM audit_log WHERE action IN ('SUBJECT_CREATED', 'SUBJECT_UPDATED', 'SUBJECT_IMPORT_APPLIED') GROUP BY action`
      );
      expect(audit.rows).toEqual(
        expect.arrayContaining([
          { action: 'SUBJECT_CREATED', total: 1 },
          { action: 'SUBJECT_UPDATED', total: 1 },
          { action: 'SUBJECT_IMPORT_APPLIED', total: 1 }
        ])
      );
    } finally {
      await verify.end();
    }
  });

  it('blocks duplicates, incompatible normalized names and inactivation with active schedules', async () => {
    const client = await connectTestDb();
    const existing = await client.query<{ id: string }>("SELECT id FROM subjects WHERE name = 'H04 QA Materia Base'");
    await client.end();

    const duplicateResponse = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: {
        fileName: 'duplicados.csv',
        base64Data: csvBase64([',REP-01,Programacion,ACTIVO', ',REP-01,Base de Datos,ACTIVO'])
      }
    });
    expect(duplicateResponse.statusCode).toBe(200);
    expect(duplicateResponse.json().preview.hasBlockingErrors).toBe(true);
    expect(duplicateResponse.json().preview.summary.DUPLICADO_CLAVE_CSV).toBe(2);

    const inactiveResponse = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: {
        fileName: 'inactivar.csv',
        base64Data: csvBase64([`${existing.rows[0].id},H04-BASE,H04 QA Materia Base,INACTIVO`])
      }
    });
    expect(inactiveResponse.statusCode).toBe(200);
    expect(inactiveResponse.json().preview.summary.INACTIVACION_CON_USO_OPERATIVO).toBe(1);

    const incompatible = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: {
        fileName: 'incompatible.csv',
        base64Data: csvBase64([`${existing.rows[0].id},H04-BASE,Nombre completamente distinto,ACTIVO`])
      }
    });
    expect(incompatible.statusCode).toBe(200);
    expect(incompatible.json().preview.summary.CLAVE_EXISTENTE_NOMBRE_INCOMPATIBLE).toBe(1);
  });

  it('updates by official code and accepts accent-only corrections without changing identity', async () => {
    await seedAccentedSubject();
    const base64Data = csvBase64([',ADM-TUR,Administración Turística,ACTIVO']);
    const previewResponse = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: { fileName: 'correccion.csv', base64Data }
    });
    const preview = previewResponse.json().preview;
    expect(preview.summary.ACTUALIZAR_NOMBRE).toBe(1);

    const applied = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/apply',
      payload: {
        fileName: 'correccion.csv',
        base64Data,
        fileSha256: preview.fileSha256,
        catalogFingerprint: preview.catalogFingerprint,
        confirmed: true
      }
    });
    expect(applied.statusCode).toBe(200);
    const db = await connectTestDb();
    const subject = await db.query<{ id: string; name: string }>("SELECT id, name FROM subjects WHERE official_code = 'ADM-TUR'");
    await db.end();
    expect(subject.rows).toEqual([
      { id: '30000000-0000-4000-8000-000000000091', name: 'Administración Turística' }
    ]);
  });

  it('parses BOM, LF, quoted commas and embedded newlines without writing during preview', async () => {
    const csv = '\uFEFFid,clave,nombre,estatus\n,H21-CSV,"Seminario, Ética\ny Sociedad",ACTIVO';
    const beforeDb = await connectTestDb();
    const before = await beforeDb.query<{ total: number }>('SELECT count(*)::int AS total FROM subjects');
    await beforeDb.end();

    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: { fileName: 'utf8.csv', base64Data: Buffer.from(csv, 'utf8').toString('base64') }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().preview.rows[0].name).toBe('Seminario, Ética y Sociedad');

    const afterDb = await connectTestDb();
    const after = await afterDb.query<{ total: number }>('SELECT count(*)::int AS total FROM subjects');
    await afterDb.end();
    expect(after.rows[0].total).toBe(before.rows[0].total);
  });

  it('rejects oversized files, more than 5000 rows and unknown headers', async () => {
    const oversized = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: {
        fileName: 'grande.csv',
        base64Data: Buffer.alloc(512 * 1024 + 1, 65).toString('base64')
      }
    });
    expect(oversized.statusCode).toBe(400);

    const manyRows = Array.from({ length: 5001 }, (_, index) => `,H21-${index},Asignatura ${index},ACTIVO`);
    const tooMany = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: { fileName: 'filas.csv', base64Data: csvBase64(manyRows) }
    });
    expect(tooMany.statusCode).toBe(400);

    const unknownHeaders = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: {
        fileName: 'columnas.csv',
        base64Data: Buffer.from('id,clave,nombre,estatus,extra\n,H21-X,Nombre,ACTIVO,no', 'utf8').toString('base64')
      }
    });
    expect(unknownHeaders.statusCode).toBe(400);
  });

  it('rolls back the complete apply when any row is blocking', async () => {
    const base64Data = csvBase64([
      ',H21-VALIDA,Asignatura valida,ACTIVO',
      ',H21-VALIDA,Asignatura duplicada,ACTIVO'
    ]);
    const previewResponse = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: { fileName: 'atomico.csv', base64Data }
    });
    const preview = previewResponse.json().preview;
    expect(preview.hasBlockingErrors).toBe(true);

    const applyResponse = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/apply',
      payload: {
        fileName: 'atomico.csv',
        base64Data,
        fileSha256: preview.fileSha256,
        catalogFingerprint: preview.catalogFingerprint,
        confirmed: true
      }
    });
    expect(applyResponse.statusCode).toBe(409);
    const db = await connectTestDb();
    const count = await db.query<{ total: number }>("SELECT count(*)::int AS total FROM subjects WHERE official_code = 'H21-VALIDA'");
    await db.end();
    expect(count.rows[0].total).toBe(0);
  });

  it('rejects changed files or catalog fingerprints before writing', async () => {
    const base64Data = csvBase64([',H21-STABLE,Asignatura Estable,ACTIVO']);
    const previewResponse = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: { fileName: 'estable.csv', base64Data }
    });
    const preview = previewResponse.json().preview;

    const staleFile = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/apply',
      payload: {
        fileName: 'estable.csv',
        base64Data: csvBase64([',H21-OTRA,Otra asignatura,ACTIVO']),
        fileSha256: preview.fileSha256,
        catalogFingerprint: preview.catalogFingerprint,
        confirmed: true
      }
    });
    expect(staleFile.statusCode).toBe(409);

    const db = await connectTestDb();
    await db.query("INSERT INTO subjects (official_code, name, status) VALUES ('H21-CAMBIO', 'Cambio concurrente', 'ACTIVO')");
    await db.end();
    const staleCatalog = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/apply',
      payload: {
        fileName: 'estable.csv',
        base64Data,
        fileSha256: preview.fileSha256,
        catalogFingerprint: preview.catalogFingerprint,
        confirmed: true
      }
    });
    expect(staleCatalog.statusCode).toBe(409);
  });

  it('searches active subjects accent-insensitively with all tokens', async () => {
    await seedAccentedSubject();
    const response = await injectAs(app!, coordinatorActor(), {
      method: 'GET',
      url: '/api/catalogs/subjects?q=turistica%20administracion&status=ACTIVO'
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().subjects).toEqual([
      expect.objectContaining({ officialCode: 'ADM-TUR', name: 'Administracion Turistica', status: 'ACTIVO' })
    ]);
  });

  it('rejects invalid UTF-8 and does not expose import routes to coordinators', async () => {
    const invalidUtf8 = Buffer.from([0xff, 0xfe, 0xfd]).toString('base64');
    const response = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: { fileName: 'invalido.csv', base64Data: invalidUtf8 }
    });
    expect(response.statusCode).toBe(400);

    const denied = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/catalogs/subjects/import/preview',
      payload: { fileName: 'asignaturas.csv', base64Data: csvBase64([]) }
    });
    expect(denied.statusCode).toBe(403);
  });
});
