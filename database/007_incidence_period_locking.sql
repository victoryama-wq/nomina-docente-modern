-- Incidencias debe operar por quincena, no por ciclo completo.
-- Para datos legacy, se asigna la quincena mas reciente del mismo ciclo cuando existe.
-- Los registros antiguos de ciclos sin calendario quedan sin calendar_config_id y ya no participan en nomina nueva.

ALTER TABLE schedule_incidences
  ADD COLUMN IF NOT EXISTS calendar_config_id uuid REFERENCES payroll_calendar_config(id) ON DELETE CASCADE;

UPDATE schedule_incidences si
SET calendar_config_id = selected_period.id
FROM schedules s
JOIN LATERAL (
  SELECT pcc.id
  FROM payroll_calendar_config pcc
  WHERE pcc.cycle_id = s.cycle_id
  ORDER BY pcc.payroll_start DESC, pcc.created_at DESC
  LIMIT 1
) selected_period ON TRUE
WHERE si.schedule_id = s.id
  AND si.calendar_config_id IS NULL;

ALTER TABLE schedule_incidences
  DROP CONSTRAINT IF EXISTS schedule_incidences_pkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schedule_incidences_schedule_calendar_unique'
  ) THEN
    ALTER TABLE schedule_incidences
      ADD CONSTRAINT schedule_incidences_schedule_calendar_unique UNIQUE (schedule_id, calendar_config_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS schedule_incidences_calendar_idx
  ON schedule_incidences(calendar_config_id);
