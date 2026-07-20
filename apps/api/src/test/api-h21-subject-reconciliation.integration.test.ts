import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { describeIntegration } from './api-integration-helpers.js';
import { connectTestDb, prepareTestDatabase } from './db/test-db-utils.js';

const describeIfDb = describeIntegration ? describe : describe.skip;
const reconciliationSqlPath = fileURLToPath(
  new URL('../../../../database/validation/h21_reconcile_duplicate_subjects_APPROVAL_REQUIRED.sql', import.meta.url)
);

const mappings = [
  {
    duplicateId: 'dc73b77d-ff7d-4ff2-a122-f9593b401220',
    duplicateName: 'DERECHOS HUMANOS Y GARANTIAS',
    canonicalId: 'adac657f-5ebd-41f7-b925-a442fee2c9ef',
    canonicalName: 'DERECHOS HUMANOS Y GARANT\u00cdAS',
    canonicalStatus: 'ACTIVO',
    schedules: 1
  },
  {
    duplicateId: '984f875a-4739-4ded-870f-cd73ed2a939d',
    duplicateName: 'ENFERMERIA COMUNITARIA I',
    canonicalId: '1aca811f-b8d6-45e1-b0df-f65687711824',
    canonicalName: 'ENFERMER\u00cdA COMUNITARIA I',
    canonicalStatus: 'ACTIVO',
    schedules: 1
  },
  {
    duplicateId: '66102312-ae9b-4fd1-bc8e-eb55aae814b2',
    duplicateName: 'ESTUDIO DE MERCADO E INVERSION',
    canonicalId: '670cc3e4-a4bb-420e-a4b5-706951450da6',
    canonicalName: 'ESTUDIO DE MERCADO E INVERSI\u00d3N',
    canonicalStatus: 'INACTIVO',
    schedules: 1
  },
  {
    duplicateId: '8517e7b4-de56-4314-8ede-748b5f0827d8',
    duplicateName: 'EVALUACION DEL DESEMPE\u00d1O LABORAL',
    canonicalId: '51d2e1cb-634e-4c88-ade3-08bd1f91bd5e',
    canonicalName: 'EVALUACI\u00d3N DEL DESEMPE\u00d1O LABORAL',
    canonicalStatus: 'ACTIVO',
    schedules: 1
  },
  {
    duplicateId: 'e16b3ec3-8e55-40b2-956a-1827e6f3b00e',
    duplicateName: 'PLANEACION Y CONTROL DE PRESUPUESTOS',
    canonicalId: '968b2a44-f431-4f8e-946d-de0472c094c9',
    canonicalName: 'PLANEACI\u00d3N Y CONTROL DE PRESUPUESTOS',
    canonicalStatus: 'ACTIVO',
    schedules: 4
  }
] as const;

async function seedReconciliationFixture(): Promise<void> {
  const db = await connectTestDb();
  try {
    for (const mapping of mappings) {
      await db.query(
        `INSERT INTO subjects (id, name, status) VALUES ($1, $2, 'ACTIVO'), ($3, $4, $5)`,
        [
          mapping.duplicateId,
          mapping.duplicateName,
          mapping.canonicalId,
          mapping.canonicalName,
          mapping.canonicalStatus
        ]
      );
    }

    const context = await db.query<{ cycle_id: string; coordination_id: string; teacher_id: string }>(`
      SELECT
        '30000000-0000-4000-8000-000000000003'::uuid AS cycle_id,
        (SELECT id FROM coordinations ORDER BY id LIMIT 1) AS coordination_id,
        (SELECT id FROM teachers ORDER BY id LIMIT 1) AS teacher_id
    `);
    let sequence = 1;
    for (const mapping of mappings) {
      for (let index = 0; index < mapping.schedules; index += 1) {
        await db.query(
          `
            INSERT INTO schedules (
              id, cycle_id, coordination_id, teacher_id, subject_id, subject_name, group_code
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            `40000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
            context.rows[0].cycle_id,
            context.rows[0].coordination_id,
            context.rows[0].teacher_id,
            mapping.duplicateId,
            mapping.duplicateName,
            `H21-REC-${String(sequence).padStart(2, '0')}`
          ]
        );
        sequence += 1;
      }
    }
  } finally {
    await db.end();
  }
}

function sqlForTest(commit: boolean): string {
  const versioned = readFileSync(reconciliationSqlPath, 'utf8');
  const guardedForTest = versioned.replace(
    "current_database() <> 'nomina_docente'",
    "current_database() <> 'nomina_docente_test'"
  );
  return commit ? guardedForTest.replace(/ROLLBACK;\s*$/, 'COMMIT;') : guardedForTest;
}

describeIfDb('H21 approved legacy subject reconciliation', () => {
  it('keeps the versioned SQL guarded, non-destructive and rollback-only', () => {
    const sql = readFileSync(reconciliationSqlPath, 'utf8');
    expect(sql).toContain("current_database() <> 'nomina_docente'");
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/^\s*COMMIT;\s*$/im);
    expect(sql.trimEnd().endsWith('ROLLBACK;')).toBe(true);
    expect(sql.match(/duplicate_subject_id/g)?.length).toBeGreaterThan(5);
    expect(sql).toContain("'groups', 5");
    expect(sql).toContain("'movedSchedules', 8");
  });

  it('rehearses rollback and then reconciles exactly eight schedules without changing protected history', async () => {
    await prepareTestDatabase();
    await seedReconciliationFixture();
    const db = await connectTestDb();
    try {
      const before = await db.query<{
        subjects_count: number;
        schedules_count: number;
        schedule_snapshots_count: number;
        schedule_snapshots_fingerprint: string;
        extra_snapshots_count: number;
        extra_snapshots_fingerprint: string;
        payroll_runs_count: number;
        payroll_runs_fingerprint: string;
      }>(`
        SELECT
          (SELECT count(*)::int FROM subjects) AS subjects_count,
          (SELECT count(*)::int FROM schedules) AS schedules_count,
          (SELECT count(*)::int FROM payroll_schedule_details) AS schedule_snapshots_count,
          (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\\n' ORDER BY row_data.id), '')) FROM payroll_schedule_details row_data) AS schedule_snapshots_fingerprint,
          (SELECT count(*)::int FROM payroll_extra_details) AS extra_snapshots_count,
          (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\\n' ORDER BY row_data.id), '')) FROM payroll_extra_details row_data) AS extra_snapshots_fingerprint,
          (SELECT count(*)::int FROM payroll_runs) AS payroll_runs_count,
          (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\\n' ORDER BY row_data.id), '')) FROM payroll_runs row_data) AS payroll_runs_fingerprint
      `);
      const scheduleBefore = await db.query<{ id: string; subject_id: string; subject_name: string; invariant_data: unknown }>(`
        SELECT id, subject_id, subject_name, to_jsonb(s) - 'subject_id' - 'subject_name' AS invariant_data
        FROM schedules s
        WHERE subject_id = ANY($1::uuid[])
        ORDER BY id
      `, [mappings.map((mapping) => mapping.duplicateId)]);
      expect(scheduleBefore.rowCount).toBe(8);

      await db.query(sqlForTest(false));
      const afterRollback = await db.query<{ duplicate_schedules: number; inactive_duplicates: number }>(`
        SELECT
          (SELECT count(*)::int FROM schedules WHERE subject_id = ANY($1::uuid[])) AS duplicate_schedules,
          (SELECT count(*)::int FROM subjects WHERE id = ANY($1::uuid[]) AND status = 'INACTIVO') AS inactive_duplicates
      `, [mappings.map((mapping) => mapping.duplicateId)]);
      expect(afterRollback.rows[0]).toEqual({ duplicate_schedules: 8, inactive_duplicates: 0 });

      await db.query(sqlForTest(true));

      const finalSubjects = await db.query<{ canonical_active: number; duplicate_inactive: number }>(`
        SELECT
          (SELECT count(*)::int FROM subjects WHERE id = ANY($1::uuid[]) AND status = 'ACTIVO') AS canonical_active,
          (SELECT count(*)::int FROM subjects WHERE id = ANY($2::uuid[]) AND status = 'INACTIVO') AS duplicate_inactive
      `, [
        mappings.map((mapping) => mapping.canonicalId),
        mappings.map((mapping) => mapping.duplicateId)
      ]);
      expect(finalSubjects.rows[0]).toEqual({ canonical_active: 5, duplicate_inactive: 5 });

      const scheduleAfter = await db.query<{ id: string; subject_id: string; subject_name: string; invariant_data: unknown }>(`
        SELECT id, subject_id, subject_name, to_jsonb(s) - 'subject_id' - 'subject_name' AS invariant_data
        FROM schedules s
        WHERE id = ANY($1::uuid[])
        ORDER BY id
      `, [scheduleBefore.rows.map((row) => row.id)]);
      expect(scheduleAfter.rowCount).toBe(8);
      expect(scheduleAfter.rows.map((row) => ({ id: row.id, invariant_data: row.invariant_data }))).toEqual(
        scheduleBefore.rows.map((row) => ({ id: row.id, invariant_data: row.invariant_data }))
      );
      for (const row of scheduleAfter.rows) {
        const mapping = mappings.find((candidate) => candidate.canonicalId === row.subject_id);
        expect(mapping).toBeDefined();
        expect(row.subject_name).toBe(mapping?.canonicalName);
      }

      const after = await db.query<typeof before.rows[0]>(`
        SELECT
          (SELECT count(*)::int FROM subjects) AS subjects_count,
          (SELECT count(*)::int FROM schedules) AS schedules_count,
          (SELECT count(*)::int FROM payroll_schedule_details) AS schedule_snapshots_count,
          (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\\n' ORDER BY row_data.id), '')) FROM payroll_schedule_details row_data) AS schedule_snapshots_fingerprint,
          (SELECT count(*)::int FROM payroll_extra_details) AS extra_snapshots_count,
          (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\\n' ORDER BY row_data.id), '')) FROM payroll_extra_details row_data) AS extra_snapshots_fingerprint,
          (SELECT count(*)::int FROM payroll_runs) AS payroll_runs_count,
          (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\\n' ORDER BY row_data.id), '')) FROM payroll_runs row_data) AS payroll_runs_fingerprint
      `);
      expect(after.rows[0]).toEqual(before.rows[0]);

      const audit = await db.query<{ total: number }>(`
        SELECT count(*)::int AS total
        FROM audit_log
        WHERE action IN (
          'SUBJECT_RECONCILIATION_CANONICAL',
          'SUBJECT_RECONCILIATION_DUPLICATE',
          'SUBJECT_DUPLICATES_RECONCILED'
        )
      `);
      expect(audit.rows[0].total).toBe(11);
    } finally {
      await db.end();
    }
  });
});
