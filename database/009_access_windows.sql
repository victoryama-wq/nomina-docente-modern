-- Ventanas de acceso para captura de incidencias y extras.

BEGIN;

ALTER TABLE payroll_calendar_config
  ADD COLUMN IF NOT EXISTS incidences_access_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS extras_access_start_at timestamptz;

UPDATE payroll_calendar_config
SET
  incidences_access_start_at = COALESCE(incidences_access_start_at, created_at),
  extras_access_start_at = COALESCE(extras_access_start_at, created_at);

ALTER TABLE payroll_calendar_config
  ALTER COLUMN incidences_access_start_at SET DEFAULT now(),
  ALTER COLUMN extras_access_start_at SET DEFAULT now(),
  ALTER COLUMN incidences_access_start_at SET NOT NULL,
  ALTER COLUMN extras_access_start_at SET NOT NULL;

COMMIT;
