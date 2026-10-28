import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { getTestDbConfig, isTestDbExplicitlyConfigured } from './db/test-db-utils.js';
import { replaceConstancia, reconcileConstancias, type ConstanciaStorage, type ConstanciaTransaction } from '../lib/constancia-replacement.js';

const local = isTestDbExplicitlyConfigured() ? describe : describe.skip;
local('constancia replacement SQL on temporary tables only', () => {
  it('preserves the real schema, publishes once, retries cleanup and rolls everything back', async () => {
    const config = getTestDbConfig();
    expect(config.database).toBe('nomina_docente_test');
    expect(['127.0.0.1', 'localhost', '::1']).toContain(config.host);
    const pool = new pg.Pool(config);
    const client = await pool.connect();
    try {
      expect((await client.query('SELECT current_database() AS name')).rows[0].name).toBe('nomina_docente_test');
      await client.query('BEGIN');
      await client.query('CREATE TEMP TABLE teachers (id uuid PRIMARY KEY) ON COMMIT DROP');
      await client.query('CREATE TEMP TABLE teacher_documents (LIKE public.teacher_documents INCLUDING ALL) ON COMMIT DROP');
      const teacherId = randomUUID(), actorId = randomUUID(), oldId = randomUUID();
      await client.query('INSERT INTO pg_temp.teachers (id) VALUES ($1)', [teacherId]);
      await client.query(`INSERT INTO pg_temp.teacher_documents (id,teacher_id,storage_bucket,storage_object)
        VALUES ($1,$2,'synthetic-test','old')`, [oldId, teacherId]);
      const objects = new Set(['old']);
      let failDelete = true;
      const storage: ConstanciaStorage = {
        assertSafe: async () => {}, put: async object => { objects.add(object.key); },
        remove: async object => { if (failDelete) throw new Error('synthetic outage'); objects.delete(object.key); }
      };
      // Savepoints exercise real SQL/constraints without committing any persistent data.
      const transaction: ConstanciaTransaction = async work => {
        await client.query('SAVEPOINT constancia_test');
        try { const result = await work(client); await client.query('RELEASE SAVEPOINT constancia_test'); return result; }
        catch (error) { await client.query('ROLLBACK TO SAVEPOINT constancia_test'); await client.query('RELEASE SAVEPOINT constancia_test'); throw error; }
      };
      const options = { transaction, storage, bucket: 'synthetic-test', teacherId, actorId,
        fileName: 'synthetic.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF synthetic'),
        authorize: async () => {}, afterSwitch: async () => ({ id: teacherId }) };
      const first = await replaceConstancia(options);
      expect(first.cleanupPending).toBe(true);
      expect((await client.query('SELECT id FROM pg_temp.teacher_documents WHERE is_current')).rows.map(r => r.id)).toEqual([first.documentId]);
      failDelete = false;
      expect(await reconcileConstancias(transaction, storage)).toEqual({ deleted: 1, pending: false });
      expect(objects.has('old')).toBe(false);
      expect((await replaceConstancia(options)).cleanupPending).toBe(false);
      expect(objects.size).toBe(1);
      expect((await client.query('SELECT count(*)::int AS n FROM pg_temp.teacher_documents WHERE is_current')).rows[0].n).toBe(1);
    } finally {
      await client.query('ROLLBACK'); client.release(); await pool.end();
    }
  });
});
