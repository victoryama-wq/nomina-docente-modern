-- Nomina Docente - flujo financiero de estados de nomina.
-- Agrega estados operativos sin afectar corridas existentes.

ALTER TYPE payroll_run_status ADD VALUE IF NOT EXISTS 'EN_REVISION';
ALTER TYPE payroll_run_status ADD VALUE IF NOT EXISTS 'PAGADA';

ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES app_users(id),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES app_users(id),
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_updated_by uuid REFERENCES app_users(id);

CREATE INDEX IF NOT EXISTS payroll_runs_status_idx
  ON payroll_runs(status);

CREATE INDEX IF NOT EXISTS payroll_runs_status_updated_idx
  ON payroll_runs(status_updated_at);
