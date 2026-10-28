import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { readDossierBacklog } from '../lib/dossier-worker.js';
import { getTestDbConfig, isTestDbExplicitlyConfigured } from './db/test-db-utils.js';

const local = isTestDbExplicitlyConfigured() ? describe : describe.skip;
local('worker metrics on temporary tables without resetting the test database', () => {
  it('isolates namespaces, measures age since creation and distinguishes fresh staging', async () => {
    const config = getTestDbConfig();
    expect(config.database).toBe('nomina_docente_test');
    expect(['localhost', '127.0.0.1', '::1']).toContain(config.host);
    const pool = new pg.Pool(config), client = await pool.connect();
    try {
      expect((await client.query('SELECT current_database() AS name')).rows[0].name).toBe('nomina_docente_test');
      await client.query('BEGIN');
      await client.query(`CREATE TEMP TABLE teacher_dossier_operations (
        state text, storage_namespace text, created_at timestamptz, updated_at timestamptz) ON COMMIT DROP`);
      await client.query(`CREATE TEMP TABLE teacher_documents (
        document_type text, is_current boolean, uploaded_at timestamptz) ON COMMIT DROP`);
      await client.query(`INSERT INTO pg_temp.teacher_dossier_operations VALUES
        ('CLEANUP','test',now()-interval '1 hour',now()),
        ('PREPARED','test',now()-interval '10 minutes',now()-interval '6 minutes'),
        ('FAILED','test',now()-interval '1 hour',now()),
        ('FAILED','test',now()-interval '2 days',now()-interval '2 days'),
        ('CLEANUP','other',now()-interval '2 days',now()-interval '2 days'),
        ('COMPLETE','test',now()-interval '2 days',now())`);
      await client.query(`INSERT INTO pg_temp.teacher_documents VALUES
        ('CONSTANCIA_FISCAL_STAGING',false,now()),
        ('CONSTANCIA_FISCAL_STAGING',false,now()-interval '25 hours'),
        ('CONSTANCIA_FISCAL_DELETE_PENDING',false,now()-interval '2 hours'),
        ('CONSTANCIA_FISCAL_DELETE_PENDING',true,now()-interval '2 days'),
        ('CONSTANCIA_FISCAL_DELETED',false,now()-interval '2 days'),
        ('CONSTANCIA_FISCAL',true,now()-interval '2 days')`);
      const query = async <T>(sql: string, params?: unknown[]) => (await client.query(sql, params)).rows as T[];
      expect(await readDossierBacklog(query, 'test')).toEqual({ pending: 2, eligible: 1,
        oldestPendingSeconds: 3600, failedLast24Hours: 1, constanciasPending: 2,
        constanciasStaging: 2, constanciasOldestPendingSeconds: 7200 });
    } finally { await client.query('ROLLBACK'); client.release(); await pool.end(); }
  });
});
