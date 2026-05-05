import pg, { type PoolClient } from 'pg';
import { config, getDatabaseHost } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  host: getDatabaseHost(),
  port: config.DB_HOST ? config.DB_PORT : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
