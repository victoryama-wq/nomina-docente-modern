// Only called inside the guarded disposable container by run.mjs.
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, copyFile, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
assert.equal(process.env.H24_PD07_E2E, 'approved-local');
assert.equal(process.env.DB_NAME, 'nomina_docente_test');
assert.equal(process.env.DB_HOST, '127.0.0.1');
assert.equal(process.env.DB_PORT, '5432');
assert.equal(process.env.NODE_ENV, 'test');
assert(!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.INSTANCE_CONNECTION_NAME);
const c = new Client({ host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD });
await c.connect();
try {
  assert.equal((await c.query('select current_database() n')).rows[0].n, 'nomina_docente_test');
  assert.equal((await c.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n, 0);
  const files = (await readdir('/app/database')).filter(f => /^\d{3}.*\.sql$/.test(f)).sort();
  assert.equal(files.length, 20);
  const before = files.filter(f => Number(f.slice(0, 3)) < 16); assert.equal(before.length, 18);
  await mkdir('/tmp/pre-h24/database', { recursive: true }); await mkdir('/tmp/pre-h24/tools');
  await symlink('/app/node_modules', '/tmp/pre-h24/node_modules');
  await writeFile('/tmp/pre-h24/package.json', JSON.stringify({ type: 'module' }));
  await copyFile('/app/tools/migrate-db.ts', '/tmp/pre-h24/tools/migrate-db.ts');
  for (const file of before) {
    await c.query(await readFile(`/app/database/${file}`, 'utf8'));
    await copyFile(`/app/database/${file}`, `/tmp/pre-h24/database/${file}`);
  }
  await c.query(await readFile('/app/apps/api/src/test/db/seed-h04-minimal.sql', 'utf8'));
  // Nonempty historical sentinels are fixture setup, never a payroll calculation.
  const run = (await c.query("INSERT INTO payroll_runs(cycle_id,period_label,status,summary) SELECT id,'PD07 SYNTHETIC HISTORY','PAGADA','{}'::jsonb FROM academic_cycles ORDER BY id LIMIT 1 RETURNING id")).rows[0].id;
  await c.query("INSERT INTO payroll_lines(payroll_run_id,teacher_id,coordination_id,teacher_name_snapshot,coordination_name_snapshot,base_hours,total_amount) SELECT $1,id,coordination_id,'SYNTHETIC','QA',10,100 FROM teachers", [run]);
  await c.query("INSERT INTO payroll_schedule_details(payroll_run_id,schedule_id,teacher_id,coordination_id,teacher_name_snapshot,base_hours,source_payload) SELECT $1,id,teacher_id,coordination_id,'SYNTHETIC',10,'{}' FROM schedules", [run]);
  await c.query("INSERT INTO payroll_extra_details(payroll_run_id,teacher_id,teacher_name_snapshot,hours,total_amount,source_payload) SELECT $1,id,'SYNTHETIC',1,100,'{}' FROM teachers", [run]);
  const steps = [];
  for (const [script, command] of [['/tmp/pre-h24/tools/migrate-db.ts', 'baseline'], ['/app/tools/migrate-db.ts', 'inspect'], ['/app/tools/migrate-db.ts', 'apply'], ['/app/tools/migrate-db.ts', 'inspect']]) {
    const out = execFileSync(process.execPath, ['--import', 'tsx', script, command], { cwd: '/app', encoding: 'utf8', timeout: 120000,
      env: { ...process.env, MIGRATION_ENV: 'test', MIGRATION_ACTOR: 'pd07-e2e-synthetic', ALLOW_PRODUCTION_MIGRATIONS: 'false' } });
    steps.push({ script, command, output: out });
  }
  assert.equal((await c.query('select count(*)::int n from schema_migrations')).rows[0].n, 20);
  await writeFile('/evidence/h05.json', JSON.stringify(steps, null, 2));
  console.log('Isolated schema ready: 18 baseline + 016/017; see H05 inspect evidence.');
} finally { await c.end(); }
