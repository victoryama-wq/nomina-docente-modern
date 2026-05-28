import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

type Command = 'status' | 'dry-run' | 'baseline' | 'apply';
type MigrationState = 'applied' | 'baseline' | 'pending' | 'checksum_mismatch';

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}

interface MigrationFile {
  version: string;
  prefix: string | null;
  filename: string;
  filePath: string;
  checksumSha256: string;
  isValidName: boolean;
}

interface RegisteredMigration {
  version: string;
  filename: string;
  checksum_sha256: string;
  status: 'applied' | 'baseline' | 'rolled_back_manual';
}

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), '..');
const databaseDir = path.join(repoRoot, 'database');
const advisoryLockName = 'nomina_docente_schema_migrations';

function commandFromArg(raw: string | undefined): Command {
  if (raw === 'status' || raw === 'dry-run' || raw === 'baseline' || raw === 'apply') return raw;
  throw new Error('Uso: npm run db:migrate:<status|dry-run|baseline|apply>');
}

function dbConfig(): DbConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || '',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD
  };
}

function migrationEnvironment() {
  return process.env.MIGRATION_ENV || 'local';
}

function migrationActor() {
  return process.env.MIGRATION_ACTOR || process.env.USERNAME || process.env.USER || 'unknown';
}

function gitCommit() {
  return process.env.GIT_COMMIT || null;
}

function isProductionTarget(config: DbConfig) {
  return config.database === 'nomina_docente' || migrationEnvironment() === 'production';
}

function assertSafetyGuards(command: Command, config: DbConfig) {
  if (!config.database) throw new Error('DB_NAME es obligatorio.');
  if (!config.user) throw new Error('DB_USER es obligatorio.');

  if (!isProductionTarget(config)) return;

  if (process.env.ALLOW_PRODUCTION_MIGRATIONS !== 'true') {
    throw new Error(
      'Destino productivo bloqueado. Define ALLOW_PRODUCTION_MIGRATIONS=true solo con ventana aprobada y backup.'
    );
  }

  if (command === 'baseline' && process.env.CONFIRM_PRODUCTION_BASELINE !== 'true') {
    throw new Error('Baseline productivo bloqueado. Define CONFIRM_PRODUCTION_BASELINE=true con aprobacion manual.');
  }

  if (command === 'apply' && process.env.CONFIRM_PRODUCTION_APPLY !== 'true') {
    throw new Error('Apply productivo bloqueado. Define CONFIRM_PRODUCTION_APPLY=true con aprobacion manual.');
  }
}

async function listMigrationFiles(): Promise<MigrationFile[]> {
  const entries = await readdir(databaseDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));

  const migrations: MigrationFile[] = [];
  for (const filename of files) {
    const filePath = path.join(databaseDir, filename);
    const content = await readFile(filePath);
    const match = /^(\d{3})_.+\.sql$/.exec(filename);
    migrations.push({
      version: filename.replace(/\.sql$/i, ''),
      prefix: match?.[1] || null,
      filename,
      filePath,
      checksumSha256: createHash('sha256').update(content).digest('hex'),
      isValidName: Boolean(match)
    });
  }

  return migrations;
}

function migrationWarnings(migrations: MigrationFile[]): string[] {
  const warnings: string[] = [];
  const byPrefix = new Map<string, string[]>();

  for (const migration of migrations) {
    if (!migration.isValidName) warnings.push(`Nombre fuera de patron NNN_nombre.sql: ${migration.filename}`);
    if (!migration.prefix) continue;
    const existing = byPrefix.get(migration.prefix) || [];
    existing.push(migration.filename);
    byPrefix.set(migration.prefix, existing);
  }

  for (const [prefix, filenames] of byPrefix) {
    if (filenames.length > 1) warnings.push(`Prefijo duplicado ${prefix}: ${filenames.join(', ')}`);
  }

  return warnings;
}

async function connect(config: DbConfig): Promise<Client> {
  const client = new Client(config);
  await client.connect();
  const result = await client.query<{ current_database: string }>('SELECT current_database()');
  const currentDatabase = result.rows[0]?.current_database;
  if (currentDatabase !== config.database) {
    await client.end();
    throw new Error(`Conexion rechazada: conectado a ${currentDatabase}; se esperaba ${config.database}.`);
  }
  return client;
}

async function controlTablesExist(client: Client) {
  const result = await client.query<{ total: string }>(
    `
      SELECT count(*)::text AS total
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('schema_migrations', 'schema_migration_runs')
    `
  );
  return Number(result.rows[0]?.total || 0) === 2;
}

async function readRegisteredMigrations(client: Client): Promise<Map<string, RegisteredMigration>> {
  const exists = await controlTablesExist(client);
  if (!exists) return new Map();

  const result = await client.query<RegisteredMigration>(
    'SELECT version, filename, checksum_sha256, status FROM schema_migrations ORDER BY version'
  );
  return new Map(result.rows.map((row) => [row.version, row]));
}

function stateForMigration(migration: MigrationFile, registered: Map<string, RegisteredMigration>): MigrationState {
  const row = registered.get(migration.version);
  if (!row) return 'pending';
  if (row.checksum_sha256 !== migration.checksumSha256) return 'checksum_mismatch';
  return row.status === 'baseline' ? 'baseline' : 'applied';
}

async function acquireLock(client: Client) {
  await client.query('SELECT pg_advisory_lock(hashtext($1))', [advisoryLockName]);
}

async function releaseLock(client: Client) {
  await client.query('SELECT pg_advisory_unlock(hashtext($1))', [advisoryLockName]);
}

async function insertRun(
  client: Client,
  migration: MigrationFile,
  status: 'dry_run' | 'success' | 'error' | 'skipped' | 'checksum_mismatch' | 'baseline',
  startedAt: Date,
  errorMessage: string | null,
  metadata: Record<string, unknown>
) {
  const executionMs = Math.max(0, Math.round(performance.now() - Number(metadata.startedPerformanceMs || 0)));
  await client.query(
    `
      INSERT INTO schema_migration_runs (
        version,
        filename,
        checksum_sha256,
        started_at,
        finished_at,
        execution_ms,
        applied_by,
        environment,
        database_name,
        git_commit,
        status,
        error_message,
        metadata
      )
      VALUES ($1, $2, $3, $4, now(), $5, $6, $7, current_database(), $8, $9, $10, $11::jsonb)
    `,
    [
      migration.version,
      migration.filename,
      migration.checksumSha256,
      startedAt,
      executionMs,
      migrationActor(),
      migrationEnvironment(),
      gitCommit(),
      status,
      errorMessage,
      JSON.stringify({ ...metadata, startedPerformanceMs: undefined })
    ]
  );
}

async function insertSchemaMigration(
  client: Client,
  migration: MigrationFile,
  status: 'applied' | 'baseline',
  executionMs: number,
  metadata: Record<string, unknown>
) {
  await client.query(
    `
      INSERT INTO schema_migrations (
        version,
        filename,
        checksum_sha256,
        applied_by,
        environment,
        database_name,
        git_commit,
        execution_ms,
        status,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, current_database(), $6, $7, $8, $9::jsonb)
    `,
    [
      migration.version,
      migration.filename,
      migration.checksumSha256,
      migrationActor(),
      migrationEnvironment(),
      gitCommit(),
      executionMs,
      status,
      JSON.stringify(metadata)
    ]
  );
}

function printSummary(migrations: MigrationFile[], registered: Map<string, RegisteredMigration>, warnings: string[]) {
  const states = migrations.map((migration) => ({
    migration,
    state: stateForMigration(migration, registered)
  }));

  const counts = states.reduce(
    (acc, item) => {
      acc[item.state] += 1;
      return acc;
    },
    { applied: 0, baseline: 0, pending: 0, checksum_mismatch: 0 } satisfies Record<MigrationState, number>
  );

  console.log('Migraciones detectadas:', migrations.length);
  console.log('Registradas en DB:', registered.size);
  console.log('Aplicadas:', counts.applied);
  console.log('Baseline:', counts.baseline);
  console.log('Pendientes:', counts.pending);
  console.log('Checksum mismatch:', counts.checksum_mismatch);

  if (warnings.length) {
    console.log('\nAdvertencias:');
    for (const warning of warnings) console.log(`- ${warning}`);
  }

  console.log('\nDetalle:');
  for (const item of states) {
    console.log(`- ${item.migration.filename}: ${item.state}`);
  }
}

async function commandStatus(client: Client, migrations: MigrationFile[], warnings: string[]) {
  const exists = await controlTablesExist(client);
  if (!exists) {
    console.log('Tablas de control no existen. Aplica database/012_h05_schema_migrations.sql antes de baseline/apply.');
    printSummary(migrations, new Map(), warnings);
    return;
  }

  printSummary(migrations, await readRegisteredMigrations(client), warnings);
}

async function commandDryRun(client: Client, migrations: MigrationFile[], warnings: string[]) {
  if (!(await controlTablesExist(client))) {
    throw new Error('Tablas de control no existen. Aplica database/012_h05_schema_migrations.sql antes de dry-run.');
  }

  const registered = await readRegisteredMigrations(client);
  printSummary(migrations, registered, warnings);

  for (const migration of migrations) {
    const startedAt = new Date();
    await insertRun(client, migration, 'dry_run', startedAt, null, {
      command: 'dry-run',
      state: stateForMigration(migration, registered),
      startedPerformanceMs: performance.now()
    });
  }
}

async function commandBaseline(client: Client, migrations: MigrationFile[], warnings: string[]) {
  if (!(await controlTablesExist(client))) {
    throw new Error('Tablas de control no existen. Aplica database/012_h05_schema_migrations.sql antes de baseline.');
  }

  const registered = await readRegisteredMigrations(client);
  for (const migration of migrations) {
    const startedAt = new Date();
    const startedPerformanceMs = performance.now();
    const existing = registered.get(migration.version);

    if (existing?.checksum_sha256 === migration.checksumSha256) {
      await insertRun(client, migration, 'skipped', startedAt, null, {
        command: 'baseline',
        reason: 'already_registered',
        startedPerformanceMs
      });
      continue;
    }

    if (existing && existing.checksum_sha256 !== migration.checksumSha256) {
      await insertRun(client, migration, 'checksum_mismatch', startedAt, 'Checksum mismatch', {
        command: 'baseline',
        expected: existing.checksum_sha256,
        actual: migration.checksumSha256,
        startedPerformanceMs
      });
      throw new Error(`Checksum mismatch en ${migration.filename}; baseline detenido.`);
    }

    const executionMs = Math.max(0, Math.round(performance.now() - startedPerformanceMs));
    await insertSchemaMigration(client, migration, 'baseline', executionMs, {
      command: 'baseline',
      warnings
    });
    await insertRun(client, migration, 'baseline', startedAt, null, {
      command: 'baseline',
      startedPerformanceMs
    });
    registered.set(migration.version, {
      version: migration.version,
      filename: migration.filename,
      checksum_sha256: migration.checksumSha256,
      status: 'baseline'
    });
    console.log(`Baseline registrado: ${migration.filename}`);
  }
}

function sqlHasExplicitTransaction(sql: string) {
  return /(^|\n)\s*BEGIN\s*;/i.test(sql) || /(^|\n)\s*COMMIT\s*;/i.test(sql);
}

function sqlShouldAvoidWrapper(sql: string) {
  return /ALTER\s+TYPE\s+.+\s+ADD\s+VALUE/i.test(sql);
}

async function executeMigrationSql(client: Client, migration: MigrationFile) {
  const sql = await readFile(migration.filePath, 'utf8');
  if (sqlHasExplicitTransaction(sql) || sqlShouldAvoidWrapper(sql)) {
    await client.query(sql);
    return;
  }

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function commandApply(client: Client, migrations: MigrationFile[], warnings: string[]) {
  if (!(await controlTablesExist(client))) {
    throw new Error('Tablas de control no existen. Aplica database/012_h05_schema_migrations.sql y baseline antes de apply.');
  }

  const registered = await readRegisteredMigrations(client);
  for (const migration of migrations) {
    const startedAt = new Date();
    const startedPerformanceMs = performance.now();
    const existing = registered.get(migration.version);

    if (existing?.checksum_sha256 === migration.checksumSha256) {
      await insertRun(client, migration, 'skipped', startedAt, null, {
        command: 'apply',
        reason: 'already_registered',
        startedPerformanceMs
      });
      continue;
    }

    if (existing && existing.checksum_sha256 !== migration.checksumSha256) {
      await insertRun(client, migration, 'checksum_mismatch', startedAt, 'Checksum mismatch', {
        command: 'apply',
        expected: existing.checksum_sha256,
        actual: migration.checksumSha256,
        startedPerformanceMs
      });
      throw new Error(`Checksum mismatch en ${migration.filename}; apply detenido.`);
    }

    try {
      await executeMigrationSql(client, migration);
      const executionMs = Math.max(0, Math.round(performance.now() - startedPerformanceMs));
      await insertSchemaMigration(client, migration, 'applied', executionMs, {
        command: 'apply',
        warnings
      });
      await insertRun(client, migration, 'success', startedAt, null, {
        command: 'apply',
        startedPerformanceMs
      });
      registered.set(migration.version, {
        version: migration.version,
        filename: migration.filename,
        checksum_sha256: migration.checksumSha256,
        status: 'applied'
      });
      console.log(`Aplicada: ${migration.filename}`);
    } catch (error) {
      await insertRun(client, migration, 'error', startedAt, error instanceof Error ? error.message : String(error), {
        command: 'apply',
        startedPerformanceMs
      });
      throw error;
    }
  }
}

async function main() {
  const command = commandFromArg(process.argv[2]);
  const config = dbConfig();
  assertSafetyGuards(command, config);

  const migrations = await listMigrationFiles();
  const warnings = migrationWarnings(migrations);
  const client = await connect(config);

  try {
    await acquireLock(client);
    try {
      if (command === 'status') await commandStatus(client, migrations, warnings);
      if (command === 'dry-run') await commandDryRun(client, migrations, warnings);
      if (command === 'baseline') await commandBaseline(client, migrations, warnings);
      if (command === 'apply') await commandApply(client, migrations, warnings);
    } finally {
      await releaseLock(client);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
