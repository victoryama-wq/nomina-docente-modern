-- Nomina Docente - calendario quincenal e historicos de nomina
-- Aplica sobre el esquema inicial sin romper datos existentes.

ALTER TABLE payroll_calendar_config
  ADD COLUMN IF NOT EXISTS period_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS module1_start date,
  ADD COLUMN IF NOT EXISTS module1_end date,
  ADD COLUMN IF NOT EXISTS module2_start date,
  ADD COLUMN IF NOT EXISTS module2_end date;

UPDATE payroll_calendar_config pcc
SET
  period_label = CASE
    WHEN pcc.period_label = '' THEN CONCAT(pcc.payroll_start::text, ' a ', pcc.payroll_end::text)
    ELSE pcc.period_label
  END,
  module1_start = COALESCE(pcc.module1_start, ac.module1_start),
  module1_end = COALESCE(pcc.module1_end, ac.module1_end),
  module2_start = COALESCE(pcc.module2_start, ac.module2_start),
  module2_end = COALESCE(pcc.module2_end, ac.module2_end)
FROM academic_cycles ac
WHERE ac.id = pcc.cycle_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_calendar_module_dates_chk'
  ) THEN
    ALTER TABLE payroll_calendar_config
      ADD CONSTRAINT payroll_calendar_module_dates_chk CHECK (
        module1_start IS NULL
        OR (
          module1_start <= module1_end
          AND module2_start <= module2_end
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS payroll_calendar_cycle_period_label_idx
  ON payroll_calendar_config(cycle_id, period_label)
  WHERE cycle_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payroll_schedule_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  schedule_id uuid,
  teacher_id uuid,
  coordination_id uuid,
  teacher_name_snapshot text NOT NULL DEFAULT '',
  coordination_name_snapshot text NOT NULL DEFAULT '',
  subject_name_snapshot text NOT NULL DEFAULT '',
  group_code_snapshot text NOT NULL DEFAULT '',
  tabulator_name_snapshot text NOT NULL DEFAULT '',
  tabulator_amount numeric NOT NULL DEFAULT 0,
  weekday_hours numeric NOT NULL DEFAULT 0,
  module1_hours numeric NOT NULL DEFAULT 0,
  module2_hours numeric NOT NULL DEFAULT 0,
  base_hours numeric NOT NULL DEFAULT 0,
  gross_base_amount numeric NOT NULL DEFAULT 0,
  absences numeric NOT NULL DEFAULT 0,
  delays numeric NOT NULL DEFAULT 0,
  delay_discount_hours numeric NOT NULL DEFAULT 0,
  absence_discount_amount numeric NOT NULL DEFAULT 0,
  delay_discount_amount numeric NOT NULL DEFAULT 0,
  schedule_extra_hours numeric NOT NULL DEFAULT 0,
  schedule_extra_amount numeric NOT NULL DEFAULT 0,
  base_net_amount numeric NOT NULL DEFAULT 0,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payroll_schedule_details_run_idx
  ON payroll_schedule_details(payroll_run_id);

CREATE INDEX IF NOT EXISTS payroll_schedule_details_teacher_idx
  ON payroll_schedule_details(teacher_id);

CREATE TABLE IF NOT EXISTS payroll_extra_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  extra_id uuid,
  teacher_id uuid,
  coordination_id uuid,
  teacher_name_snapshot text NOT NULL DEFAULT '',
  coordination_name_snapshot text NOT NULL DEFAULT '',
  reason_snapshot text NOT NULL DEFAULT '',
  activity_date date,
  hours numeric NOT NULL DEFAULT 0,
  tabulator_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payroll_extra_details_run_idx
  ON payroll_extra_details(payroll_run_id);

CREATE INDEX IF NOT EXISTS payroll_extra_details_teacher_idx
  ON payroll_extra_details(teacher_id);
