import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connectTestDb } from './db/test-db-utils.js';

describe('H21 subject search schema', () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectTestDb();
  });

  afterAll(async () => {
    await client.end();
  });

  it('installs additive columns, extensions, trigger and indexes', async () => {
    const extensions = await client.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname IN ('unaccent', 'pg_trgm') ORDER BY extname"
    );
    expect(extensions.rows.map((row) => row.extname)).toEqual(['pg_trgm', 'unaccent']);

    const columns = await client.query<{ column_name: string; is_nullable: string }>(
      `
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subjects'
          AND column_name IN ('official_code', 'normalized_name')
        ORDER BY column_name
      `
    );
    expect(columns.rows).toEqual([
      { column_name: 'normalized_name', is_nullable: 'NO' },
      { column_name: 'official_code', is_nullable: 'YES' }
    ]);

    const trigger = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM pg_trigger WHERE tgrelid = 'subjects'::regclass AND tgname = 'subjects_normalized_name_trg' AND NOT tgisinternal"
    );
    expect(trigger.rows[0]?.count).toBe('1');

    const indexes = await client.query<{ indexname: string }>(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'subjects'
          AND indexname IN ('subjects_official_code_unique_idx', 'subjects_normalized_name_trgm_idx')
        ORDER BY indexname
      `
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      'subjects_normalized_name_trgm_idx',
      'subjects_official_code_unique_idx'
    ]);
  });

  it('normalizes accents, case, punctuation and repeated spaces without changing the official name', async () => {
    await client.query('BEGIN');
    try {
      const inserted = await client.query<{ name: string; normalized_name: string }>(
        `
          INSERT INTO subjects (name, status)
          VALUES ('  Introducción,   a la Programación  ', 'ACTIVO')
          RETURNING name, normalized_name
        `
      );
      expect(inserted.rows[0]).toEqual({
        name: '  Introducción,   a la Programación  ',
        normalized_name: 'introduccion a la programacion'
      });
    } finally {
      await client.query('ROLLBACK');
    }
  });

  it('keeps normalized-name collisions and enforces case-insensitive official codes', async () => {
    await client.query('BEGIN');
    try {
      await client.query(
        `
          INSERT INTO subjects (name, status, official_code)
          VALUES
            ('H21 QA Diseño Gráfico', 'ACTIVO', 'H21-DG-01'),
            ('H21 QA Diseno Grafico', 'ACTIVO', 'H21-DG-02')
        `
      );

      const collisions = await client.query<{ count: string }>(
        `
          SELECT count(*)::text AS count
          FROM subjects
          WHERE normalized_name = normalize_subject_search('H21 QA Diseno Grafico')
        `
      );
      expect(collisions.rows[0]?.count).toBe('2');

      await expect(
        client.query(
          "INSERT INTO subjects (name, status, official_code) VALUES ('H21 QA Otra', 'ACTIVO', 'H21-DG-01')"
        )
      ).rejects.toMatchObject({ code: '23505' });
    } finally {
      await client.query('ROLLBACK');
    }
  });

  it('preserves schedule references and legacy null codes', async () => {
    const integrity = await client.query<{
      schedules_without_subject: string;
      legacy_null_codes: string;
    }>(
      `
        SELECT
          (SELECT count(*)::text FROM schedules WHERE subject_id IS NULL) AS schedules_without_subject,
          (SELECT count(*)::text FROM subjects WHERE official_code IS NULL) AS legacy_null_codes
      `
    );
    expect(integrity.rows[0]?.schedules_without_subject).toBe('0');
    expect(Number(integrity.rows[0]?.legacy_null_codes || 0)).toBeGreaterThan(0);
  });
});
