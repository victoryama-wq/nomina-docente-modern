import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

export const REQUIRED_TEST_DB_NAME = 'nomina_docente_test';

export interface TestDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}

const currentFile = fileURLToPath(import.meta.url);
const apiRoot = path.resolve(path.dirname(currentFile), '../../..');
const repoRoot = path.resolve(apiRoot, '../..');

export function getTestDbConfig(): TestDbConfig {
  return {
    host: process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.TEST_DB_PORT || process.env.DB_PORT || 5432),
    database: process.env.TEST_DB_NAME || REQUIRED_TEST_DB_NAME,
    user: process.env.TEST_DB_USER || process.env.DB_USER || 'app_nomina',
    password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD
  };
}

export function isTestDbExplicitlyConfigured(): boolean {
  return process.env.TEST_DB_NAME === REQUIRED_TEST_DB_NAME;
}

export function assertTestDbConfig(config = getTestDbConfig()): void {
  if (config.database !== REQUIRED_TEST_DB_NAME) {
    throw new Error(
      `DB de test invalida: ${config.database}. Usa TEST_DB_NAME=${REQUIRED_TEST_DB_NAME}; no se ejecutara contra otra base.`
    );
  }
}

export function applyTestDbEnvironment(): TestDbConfig {
  const config = getTestDbConfig();
  assertTestDbConfig(config);

  process.env.NODE_ENV = 'test';
  process.env.DB_HOST = config.host;
  process.env.DB_PORT = String(config.port);
  process.env.DB_NAME = config.database;
  process.env.DB_USER = config.user;
  if (config.password !== undefined) process.env.DB_PASSWORD = config.password;

  return config;
}

export async function connectTestDb(): Promise<Client> {
  const config = getTestDbConfig();
  assertTestDbConfig(config);
  const client = new Client(config);
  await client.connect();
  await assertConnectedDatabase(client);
  return client;
}

export async function assertConnectedDatabase(client: Client): Promise<void> {
  const result = await client.query<{ current_database: string }>('SELECT current_database()');
  const database = result.rows[0]?.current_database;
  if (database !== REQUIRED_TEST_DB_NAME) {
    throw new Error(`Conexion rechazada: base actual ${database || '(desconocida)'}; se requiere ${REQUIRED_TEST_DB_NAME}.`);
  }
}

export async function resetTestDbSchema(client: Client): Promise<void> {
  await assertConnectedDatabase(client);
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO public');
}

export async function applySqlFile(client: Client, filePath: string): Promise<void> {
  const sql = await readFile(filePath, 'utf8');
  await client.query(sql);
}

export async function migrationFiles(): Promise<string[]> {
  const databaseDir = path.join(repoRoot, 'database');
  const entries = await readdir(databaseDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => path.join(databaseDir, entry.name))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right), 'en'));
}

export function minimalSeedPath(): string {
  return path.join(apiRoot, 'src/test/db/seed-h04-minimal.sql');
}

export async function prepareTestDatabase(): Promise<void> {
  const client = await connectTestDb();
  try {
    await resetTestDbSchema(client);
    for (const file of await migrationFiles()) {
      await applySqlFile(client, file);
    }
    await applySqlFile(client, minimalSeedPath());
  } finally {
    await client.end();
  }
}
