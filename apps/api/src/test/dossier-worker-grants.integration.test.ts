import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { getTestDbConfig, isTestDbExplicitlyConfigured } from './db/test-db-utils.js';

const local = isTestDbExplicitlyConfigured() ? describe : describe.skip;
local('H24 proposed SQL grants in a disposable test transaction', () => {
  it('permits worker queries but denies teachers, payroll and document creation', async () => {
    const config = getTestDbConfig();
    expect(config.database).toBe('nomina_docente_test');
    expect(['localhost', '127.0.0.1', '::1']).toContain(config.host);
    const client = new pg.Client(config);
    const role = `h24_worker_${randomUUID().replaceAll('-', '')}`;
    const runbook = await readFile(new URL('../../../../ops/h24/README.md', import.meta.url), 'utf8');
    const sql = runbook.match(/```sql\r?\n([\s\S]*?)```/)?.[1];
    expect(sql).toBeTruthy();
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
      await client.query(sql!.replaceAll('h24_dossier_worker', role)
        .replace('DATABASE nomina_docente ', 'DATABASE nomina_docente_test '));
      await client.query(`SET LOCAL ROLE ${role}`);
      await client.query(`SELECT u.id,u.status,u.is_protected_super_admin,r.code,
        array_agg(p.code) FROM app_users u JOIN roles r ON r.id=u.role_id
        LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id
        GROUP BY u.id,r.code LIMIT 1`);
      await client.query('SELECT * FROM teacher_dossier_operations LIMIT 0');
      await client.query('UPDATE teacher_dossier_operations SET attempts=attempts+1 WHERE false');
      await client.query('UPDATE teacher_dossier_documents SET state=state WHERE false RETURNING revision');
      await client.query('DELETE FROM teacher_dossier_documents WHERE false');
      await client.query('SELECT * FROM teacher_documents LIMIT 1 FOR UPDATE');
      await client.query('UPDATE teacher_documents SET document_type=document_type WHERE false');
      await client.query(`INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,metadata)
        SELECT NULL,'SYNTHETIC','teacher_dossier',NULL,'{}'::jsonb WHERE false`);
      for (const denied of [
        'SELECT * FROM teachers LIMIT 0', 'SELECT * FROM payroll_lines LIMIT 0',
        'SELECT email FROM app_users LIMIT 0',
        'UPDATE teacher_documents SET is_current=true WHERE false',
        'INSERT INTO teacher_dossier_operations(id) SELECT gen_random_uuid() WHERE false'
      ]) {
        await client.query('SAVEPOINT denied');
        await expect(client.query(denied)).rejects.toMatchObject({ code: '42501' });
        await client.query('ROLLBACK TO SAVEPOINT denied');
      }
    } finally { await client.query('ROLLBACK'); await client.end(); }
  });
});
