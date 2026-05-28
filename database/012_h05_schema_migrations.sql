-- H05: control formal de migraciones SQL.
-- Solo crea tablas administrativas de control; no modifica tablas funcionales.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  filename text NOT NULL,
  checksum_sha256 text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL,
  environment text NOT NULL,
  database_name text NOT NULL,
  git_commit text NULL,
  execution_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('applied', 'baseline', 'rolled_back_manual')),
  rollback_notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS schema_migration_runs (
  id bigserial PRIMARY KEY,
  version text NOT NULL,
  filename text NOT NULL,
  checksum_sha256 text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL,
  execution_ms integer NULL,
  applied_by text NOT NULL,
  environment text NOT NULL,
  database_name text NOT NULL,
  git_commit text NULL,
  status text NOT NULL CHECK (
    status IN ('dry_run', 'success', 'error', 'skipped', 'checksum_mismatch', 'baseline')
  ),
  error_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS schema_migration_runs_version_idx
  ON schema_migration_runs(version);

CREATE INDEX IF NOT EXISTS schema_migration_runs_status_idx
  ON schema_migration_runs(status);

CREATE INDEX IF NOT EXISTS schema_migration_runs_started_at_idx
  ON schema_migration_runs(started_at);

COMMIT;
