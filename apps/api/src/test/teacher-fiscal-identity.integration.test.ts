import { readFile } from 'node:fs/promises';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestDbConfig, isTestDbExplicitlyConfigured } from './db/test-db-utils.js';
import { clearTestActors, injectAs } from './auth-test-utils.js';
import { createSessionUser } from './fixtures/index.js';

// Real SQL on one connection; only pg_temp is writable, never reset the QA dataset.
const mocks = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('../firebase.js', () => ({ firebaseAdmin: {} }));
vi.mock('../db.js', () => ({
  query: async (sql: string, values: unknown[]) => (await mocks.sql(sql, values)).rows,
  withTransaction: async (work: (client: unknown) => unknown) => work({ query: mocks.sql }),
  closeDatabase: async () => {}
}));
import { registerTeacherRoutes } from '../routes/teachers.js';

const local = isTestDbExplicitlyConfigured() ? describe : describe.skip;
const id = '00000000-0000-4000-8000-000000000001';
const url = `/teachers/${id}/fiscal`;
const actor = (role: ReturnType<typeof createSessionUser>['role']) => createSessionUser({ role, isProtectedSuperAdmin: false, permissions: ['fiscal.view', 'fiscal.manage'] });

local('H24 fiscal identity: migration and real route SQL without resetting public', () => {
  let client: pg.Client;
  let app: FastifyInstance;
  let before: unknown;
  const fingerprint = async () => (await client.query(`SELECT md5(COALESCE(string_agg(to_jsonb(t)::text, '' ORDER BY id), '')) AS hash FROM public.teachers t`)).rows;
  beforeEach(async () => {
    const config = getTestDbConfig();
    expect(config.database).toBe('nomina_docente_test');
    expect(['127.0.0.1', 'localhost', '::1']).toContain(config.host);
    client = new pg.Client(config); await client.connect();
    expect((await client.query('SELECT current_database() AS name')).rows[0].name).toBe('nomina_docente_test');
    before = await fingerprint();
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path = pg_temp, public');
    for (const table of ['teachers', 'app_users', 'coordinations', 'user_coordinations', 'teacher_documents', 'audit_log']) {
      await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP`);
    }
    await client.query('ALTER TABLE pg_temp.teachers DROP COLUMN IF EXISTS curp, DROP COLUMN IF EXISTS fiscal_postal_code');
    await client.query(`INSERT INTO pg_temp.teachers (id,full_name,normalized_name,payment_type) VALUES ($1,'H24 Synthetic','h24 synthetic','E')`, [id]);
    const original = (await client.query('SELECT to_jsonb(t) AS row FROM pg_temp.teachers t')).rows[0].row;
    const migration = await readFile(new URL('../../../../database/017_h24_teacher_fiscal_identity.sql', import.meta.url), 'utf8');
    // Preserve the outer rollback; execute the exact migration DDL on the temp shadow table.
    await client.query(migration.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, ''));
    expect((await client.query("SELECT to_jsonb(t)-'curp'-'fiscal_postal_code' AS row FROM pg_temp.teachers t")).rows[0].row).toEqual(original);
    mocks.sql.mockImplementation((sql: string, params: unknown[]) => client.query(sql, params));
    app = Fastify(); await registerTeacherRoutes(app);
  });
  afterEach(async () => {
    try { await app?.close(); await client?.query('ROLLBACK'); expect(await fingerprint()).toEqual(before); }
    finally { clearTestActors(); await client?.end(); }
  });
  it('persists and rereads both fields, preserves unrelated columns, omits safely and clears explicitly', async () => {
    const beforeRow = (await client.query('SELECT to_jsonb(t) AS row FROM pg_temp.teachers t')).rows[0].row;
    for (const role of ['admin', 'finanzas', 'rh'] as const) {
      const result = await injectAs(app, actor(role), { method: 'PATCH', url, payload: { paymentType: 'E', fiscalPostalCode: ' 00123 ', curp: 'test010101hqrxxx09' } });
      expect(result.statusCode, result.body).toBe(200);
      expect(result.json().teacher).toMatchObject({ fiscalPostalCode: '00123', curp: 'TEST010101HQRXXX09' });
    }
    const afterRow = (await client.query('SELECT to_jsonb(t) AS row FROM pg_temp.teachers t')).rows[0].row;
    for (const key of ['curp', 'fiscal_postal_code', 'updated_by', 'updated_at']) delete beforeRow[key], delete afterRow[key];
    expect(afterRow).toEqual(beforeRow);
    const legacy = await injectAs(app, actor('admin'), { method: 'PATCH', url, payload: { paymentType: 'E' } });
    expect(legacy.json().teacher.curp).toBe('TEST010101HQRXXX09');
    for (const role of ['coordinador', 'direccion', 'contador', 'contabilidad'] as const) {
      const denied = await injectAs(app, actor(role), { method: 'PATCH', url, payload: { paymentType: 'E', curp: '' } });
      expect(denied.statusCode).toBe(403);
      const list = await injectAs(app, actor(role), { method: 'GET', url: '/teachers' });
      expect(list.statusCode, list.body).toBe(200);
      expect(list.json().teachers[0]).toMatchObject({ fiscalPostalCode: '', curp: '' });
    }
    const audits = JSON.stringify((await client.query('SELECT before_data,after_data FROM pg_temp.audit_log')).rows);
    expect(audits).not.toMatch(/TEST010101HQRXXX09|00123/);
    const clear = await injectAs(app, actor('admin'), { method: 'PATCH', url, payload: { paymentType: 'E', fiscalPostalCode: '', curp: '' } });
    expect(clear.json().teacher).toMatchObject({ fiscalPostalCode: '', curp: '' });
  });
  it('database constraints reject malformed values and retain empty legacy values', async () => {
    expect((await client.query('SELECT fiscal_postal_code,curp FROM pg_temp.teachers')).rows).toEqual([{ fiscal_postal_code: '', curp: '' }]);
    for (const [column, value] of [['curp', 'bad'], ['fiscal_postal_code', '1234'], ['fiscal_postal_code', '12a45']]) {
      await client.query('SAVEPOINT invalid_identity');
      await expect(client.query(`UPDATE pg_temp.teachers SET ${column}=$1`, [value])).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT invalid_identity');
    }
    expect((await client.query('SELECT fiscal_postal_code,curp FROM pg_temp.teachers')).rows).toEqual([{ fiscal_postal_code: '', curp: '' }]);
  });
});
