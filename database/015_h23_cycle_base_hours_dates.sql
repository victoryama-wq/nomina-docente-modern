-- H23 - Vigencia pagable general de horas base por ciclo academico.
-- Migracion aditiva: no rellena ciclos legacy ni modifica Nomina o snapshots.

BEGIN;

ALTER TABLE academic_cycles
  ADD COLUMN IF NOT EXISTS base_hours_start_date date,
  ADD COLUMN IF NOT EXISTS base_hours_end_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'academic_cycles'::regclass
      AND conname = 'academic_cycles_base_hours_dates_pair_chk'
  ) THEN
    ALTER TABLE academic_cycles
      ADD CONSTRAINT academic_cycles_base_hours_dates_pair_chk
      CHECK (
        (base_hours_start_date IS NULL AND base_hours_end_date IS NULL)
        OR (
          base_hours_start_date IS NOT NULL
          AND base_hours_end_date IS NOT NULL
          AND base_hours_start_date <= base_hours_end_date
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'academic_cycles'::regclass
      AND conname = 'academic_cycles_modules_within_base_hours_chk'
  ) THEN
    ALTER TABLE academic_cycles
      ADD CONSTRAINT academic_cycles_modules_within_base_hours_chk
      CHECK (
        base_hours_start_date IS NULL
        OR (
          base_hours_start_date <= module1_start
          AND module1_end <= base_hours_end_date
          AND base_hours_start_date <= module2_start
          AND module2_end <= base_hours_end_date
        )
      );
  END IF;
END $$;

COMMIT;
