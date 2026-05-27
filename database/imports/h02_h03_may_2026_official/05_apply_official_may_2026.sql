-- Aplica datos oficiales Mayo 2026 desde staging hacia destino.
-- Requiere haber ejecutado 04_validate_staging.sql sin BLOCKER.
-- Ejecutar primero en nomina_docente_h02h03_data_dryrun.
-- Ejecutar en produccion solo despues de backup y aprobacion.

DO $$
BEGIN
  IF current_database() NOT IN ('nomina_docente', 'nomina_docente_h02h03_data_dryrun') THEN
    RAISE EXCEPTION 'Base incorrecta: %, esperado nomina_docente o nomina_docente_h02h03_data_dryrun', current_database();
  END IF;
END $$;

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM h02h03_may2026_staging.teachers st
    JOIN public.teachers t ON t.normalized_name = st.normalized_name
    WHERE t.id <> st.id
  ) THEN
    RAISE EXCEPTION 'BLOCKER: teacher normalized_name conflict with different id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM h02h03_may2026_staging.schedules s
    LEFT JOIN h02h03_may2026_staging.teachers t ON t.id = s.teacher_id
    WHERE t.id IS NULL
  ) THEN
    RAISE EXCEPTION 'BLOCKER: schedules without staging teacher';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM h02h03_may2026_staging.teachers t
    LEFT JOIN h02h03_may2026_staging.app_users su ON su.id = t.created_by
    LEFT JOIN public.app_users tu ON tu.email = su.email
    WHERE t.created_by IS NOT NULL AND tu.id IS NULL
  ) THEN
    RAISE EXCEPTION 'BLOCKER: teachers without created_by mapping';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM h02h03_may2026_staging.extra_hours e
    LEFT JOIN h02h03_may2026_staging.app_users su ON su.id = e.captured_by
    LEFT JOIN public.app_users tu ON tu.email = su.email
    WHERE e.captured_by IS NOT NULL AND tu.id IS NULL
  ) THEN
    RAISE EXCEPTION 'BLOCKER: extras without captured_by mapping';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT tac.id AS target_cycle_id, spc.payroll_start, spc.payroll_end, count(tpc.id) AS total
      FROM h02h03_may2026_staging.payroll_calendar_config spc
      LEFT JOIN h02h03_may2026_staging.academic_cycles sac ON sac.id = spc.cycle_id
      LEFT JOIN public.academic_cycles tac
        ON tac.period_label = sac.period_label
       AND tac.quarter_code = sac.quarter_code
      JOIN public.payroll_calendar_config tpc
        ON tpc.cycle_id IS NOT DISTINCT FROM tac.id
       AND tpc.payroll_start = spc.payroll_start
       AND tpc.payroll_end = spc.payroll_end
      GROUP BY tac.id, spc.payroll_start, spc.payroll_end
      HAVING count(tpc.id) > 1
    ) dup_config
  ) THEN
    RAISE EXCEPTION 'BLOCKER: duplicate target calendar configs for staged periods';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS h02h03_may2026_backup;

CREATE TABLE IF NOT EXISTS h02h03_may2026_backup.teachers_pre_migration AS
SELECT * FROM public.teachers;

CREATE TABLE IF NOT EXISTS h02h03_may2026_backup.schedules_pre_migration AS
SELECT * FROM public.schedules;

CREATE TABLE IF NOT EXISTS h02h03_may2026_backup.schedule_incidences_pre_migration AS
SELECT * FROM public.schedule_incidences;

CREATE TABLE IF NOT EXISTS h02h03_may2026_backup.extra_hours_pre_migration AS
SELECT * FROM public.extra_hours;

CREATE TABLE IF NOT EXISTS h02h03_may2026_backup.user_coordinations_pre_migration AS
SELECT * FROM public.user_coordinations;

CREATE TABLE IF NOT EXISTS h02h03_may2026_backup.academic_cycles_pre_migration AS
SELECT * FROM public.academic_cycles;

CREATE TABLE IF NOT EXISTS h02h03_may2026_backup.payroll_calendar_config_pre_migration AS
SELECT * FROM public.payroll_calendar_config;

INSERT INTO public.coordinations (name, status, created_at)
SELECT name, status, created_at
FROM h02h03_may2026_staging.coordinations sc
WHERE sc.name NOT IN ('Todas / Global', 'No requiere coordinacion operativa')
ON CONFLICT (name) DO UPDATE
SET status = EXCLUDED.status;

INSERT INTO public.subjects (name, status)
SELECT name, status
FROM h02h03_may2026_staging.subjects
ON CONFLICT (name) DO UPDATE
SET status = EXCLUDED.status;

INSERT INTO public.tabulators (name, amount, status)
SELECT name, amount, status
FROM h02h03_may2026_staging.tabulators
ON CONFLICT (name) DO UPDATE
SET amount = EXCLUDED.amount,
    status = EXCLUDED.status;

WITH actor_map AS (
  SELECT su.id AS source_user_id, tu.id AS target_user_id
  FROM h02h03_may2026_staging.app_users su
  JOIN public.app_users tu ON tu.email = su.email
)
INSERT INTO public.academic_cycles (
  period_label, quarter_code, module1_start, module1_end,
  module2_start, module2_end, status, created_at, created_by, closed_at, closed_by
)
SELECT
  sc.period_label,
  sc.quarter_code,
  sc.module1_start,
  sc.module1_end,
  sc.module2_start,
  sc.module2_end,
  sc.status,
  sc.created_at,
  created.target_user_id,
  sc.closed_at,
  closed.target_user_id
FROM h02h03_may2026_staging.academic_cycles sc
LEFT JOIN actor_map created ON created.source_user_id = sc.created_by
LEFT JOIN actor_map closed ON closed.source_user_id = sc.closed_by
ON CONFLICT (period_label, quarter_code) DO UPDATE
SET module1_start = EXCLUDED.module1_start,
    module1_end = EXCLUDED.module1_end,
    module2_start = EXCLUDED.module2_start,
    module2_end = EXCLUDED.module2_end,
    status = EXCLUDED.status,
    closed_at = EXCLUDED.closed_at,
    closed_by = EXCLUDED.closed_by;

WITH source_config AS (
  SELECT
    spc.*,
    sac.period_label,
    sac.quarter_code,
    tac.id AS target_cycle_id
  FROM h02h03_may2026_staging.payroll_calendar_config spc
  LEFT JOIN h02h03_may2026_staging.academic_cycles sac ON sac.id = spc.cycle_id
  LEFT JOIN public.academic_cycles tac
    ON tac.period_label = sac.period_label
   AND tac.quarter_code = sac.quarter_code
)
INSERT INTO public.payroll_calendar_config (
  cycle_id, payroll_start, payroll_end,
  incidences_access_start_at, incidences_access_days,
  extras_access_start_at, extras_access_days,
  created_at, updated_at
)
SELECT
  target_cycle_id,
  payroll_start,
  payroll_end,
  incidences_access_start_at,
  incidences_access_days,
  extras_access_start_at,
  extras_access_days,
  created_at,
  updated_at
FROM source_config
WHERE target_cycle_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.payroll_calendar_config existing
    WHERE existing.cycle_id = source_config.target_cycle_id
      AND existing.payroll_start = source_config.payroll_start
      AND existing.payroll_end = source_config.payroll_end
  );

WITH config_map AS (
  SELECT
    spc.id AS source_config_id,
    tpc.id AS target_config_id
  FROM h02h03_may2026_staging.payroll_calendar_config spc
  LEFT JOIN h02h03_may2026_staging.academic_cycles sac ON sac.id = spc.cycle_id
  LEFT JOIN public.academic_cycles tac
    ON tac.period_label = sac.period_label
   AND tac.quarter_code = sac.quarter_code
  JOIN public.payroll_calendar_config tpc
    ON tpc.cycle_id IS NOT DISTINCT FROM tac.id
   AND tpc.payroll_start = spc.payroll_start
   AND tpc.payroll_end = spc.payroll_end
)
INSERT INTO public.calendar_blackout_dates (
  config_id, blackout_date, reason
)
SELECT
  cm.target_config_id,
  cbd.blackout_date,
  cbd.reason
FROM h02h03_may2026_staging.calendar_blackout_dates cbd
JOIN config_map cm ON cm.source_config_id = cbd.config_id
ON CONFLICT (config_id, blackout_date) DO UPDATE
SET reason = EXCLUDED.reason;

WITH actor_map AS (
  SELECT su.id AS source_user_id, tu.id AS target_user_id
  FROM h02h03_may2026_staging.app_users su
  JOIN public.app_users tu ON tu.email = su.email
),
coordination_map AS (
  SELECT sc.id AS source_coordination_id, tc.id AS target_coordination_id
  FROM h02h03_may2026_staging.coordinations sc
  LEFT JOIN public.coordinations tc ON tc.name = sc.name
)
INSERT INTO public.teachers (
  id, legacy_row_number, legacy_teacher_id, full_name, normalized_name,
  first_names, paternal_last_name, maternal_last_name, degree, payment_type,
  category, location, comment, observation, coordination_id, phone, email,
  rfc, external_identifier, bank_detail, status, created_at, created_by,
  updated_at, updated_by
)
SELECT
  st.id,
  st.legacy_row_number,
  st.legacy_teacher_id,
  st.full_name,
  st.normalized_name,
  st.first_names,
  st.paternal_last_name,
  st.maternal_last_name,
  st.degree,
  st.payment_type,
  st.category,
  st.location,
  st.comment,
  st.observation,
  cm.target_coordination_id,
  st.phone,
  st.email,
  st.rfc,
  st.external_identifier,
  st.bank_detail,
  st.status,
  st.created_at,
  created.target_user_id,
  st.updated_at,
  updated.target_user_id
FROM h02h03_may2026_staging.teachers st
LEFT JOIN coordination_map cm ON cm.source_coordination_id = st.coordination_id
LEFT JOIN actor_map created ON created.source_user_id = st.created_by
LEFT JOIN actor_map updated ON updated.source_user_id = st.updated_by
ON CONFLICT (id) DO UPDATE
SET legacy_row_number = EXCLUDED.legacy_row_number,
    legacy_teacher_id = EXCLUDED.legacy_teacher_id,
    full_name = EXCLUDED.full_name,
    normalized_name = EXCLUDED.normalized_name,
    first_names = EXCLUDED.first_names,
    paternal_last_name = EXCLUDED.paternal_last_name,
    maternal_last_name = EXCLUDED.maternal_last_name,
    degree = EXCLUDED.degree,
    payment_type = EXCLUDED.payment_type,
    category = EXCLUDED.category,
    location = EXCLUDED.location,
    comment = EXCLUDED.comment,
    observation = EXCLUDED.observation,
    coordination_id = EXCLUDED.coordination_id,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    rfc = EXCLUDED.rfc,
    external_identifier = EXCLUDED.external_identifier,
    bank_detail = EXCLUDED.bank_detail,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

WITH staging_cycles AS (
  SELECT DISTINCT tac.id AS target_cycle_id
  FROM h02h03_may2026_staging.schedules ss
  JOIN h02h03_may2026_staging.academic_cycles sac ON sac.id = ss.cycle_id
  JOIN public.academic_cycles tac
    ON tac.period_label = sac.period_label
   AND tac.quarter_code = sac.quarter_code
)
DELETE FROM public.schedules s
USING staging_cycles sc
WHERE s.cycle_id = sc.target_cycle_id;

WITH actor_map AS (
  SELECT su.id AS source_user_id, tu.id AS target_user_id
  FROM h02h03_may2026_staging.app_users su
  JOIN public.app_users tu ON tu.email = su.email
),
coordination_map AS (
  SELECT sc.id AS source_coordination_id, tc.id AS target_coordination_id
  FROM h02h03_may2026_staging.coordinations sc
  JOIN public.coordinations tc ON tc.name = sc.name
),
cycle_map AS (
  SELECT sac.id AS source_cycle_id, tac.id AS target_cycle_id
  FROM h02h03_may2026_staging.academic_cycles sac
  JOIN public.academic_cycles tac
    ON tac.period_label = sac.period_label
   AND tac.quarter_code = sac.quarter_code
),
subject_map AS (
  SELECT ss.id AS source_subject_id, ts.id AS target_subject_id
  FROM h02h03_may2026_staging.subjects ss
  JOIN public.subjects ts ON ts.name = ss.name
),
tabulator_map AS (
  SELECT st.id AS source_tabulator_id, tt.id AS target_tabulator_id
  FROM h02h03_may2026_staging.tabulators st
  JOIN public.tabulators tt ON tt.name = st.name
)
INSERT INTO public.schedules (
  id, legacy_sheet_name, legacy_row_number, cycle_id, coordination_id,
  teacher_id, subject_id, subject_name, group_code, tabulator_id,
  tabulator_name, tabulator_amount, hours_l, hours_m, hours_x,
  hours_j, hours_v, hours_s1, hours_s2, created_at, created_by,
  updated_at, updated_by
)
SELECT
  ss.id,
  ss.legacy_sheet_name,
  ss.legacy_row_number,
  cm.target_cycle_id,
  com.target_coordination_id,
  ss.teacher_id,
  sm.target_subject_id,
  ss.subject_name,
  ss.group_code,
  tm.target_tabulator_id,
  ss.tabulator_name,
  ss.tabulator_amount,
  ss.hours_l,
  ss.hours_m,
  ss.hours_x,
  ss.hours_j,
  ss.hours_v,
  ss.hours_s1,
  ss.hours_s2,
  ss.created_at,
  created.target_user_id,
  ss.updated_at,
  updated.target_user_id
FROM h02h03_may2026_staging.schedules ss
JOIN cycle_map cm ON cm.source_cycle_id = ss.cycle_id
JOIN coordination_map com ON com.source_coordination_id = ss.coordination_id
LEFT JOIN subject_map sm ON sm.source_subject_id = ss.subject_id
LEFT JOIN tabulator_map tm ON tm.source_tabulator_id = ss.tabulator_id
LEFT JOIN actor_map created ON created.source_user_id = ss.created_by
LEFT JOIN actor_map updated ON updated.source_user_id = ss.updated_by;

WITH staging_cycles AS (
  SELECT DISTINCT tac.id AS target_cycle_id
  FROM h02h03_may2026_staging.extra_hours se
  JOIN h02h03_may2026_staging.academic_cycles sac ON sac.id = se.cycle_id
  JOIN public.academic_cycles tac
    ON tac.period_label = sac.period_label
   AND tac.quarter_code = sac.quarter_code
)
DELETE FROM public.extra_hours e
USING staging_cycles sc
WHERE e.cycle_id = sc.target_cycle_id;

WITH actor_map AS (
  SELECT su.id AS source_user_id, tu.id AS target_user_id
  FROM h02h03_may2026_staging.app_users su
  JOIN public.app_users tu ON tu.email = su.email
),
coordination_map AS (
  SELECT sc.id AS source_coordination_id, tc.id AS target_coordination_id
  FROM h02h03_may2026_staging.coordinations sc
  JOIN public.coordinations tc ON tc.name = sc.name
),
cycle_map AS (
  SELECT sac.id AS source_cycle_id, tac.id AS target_cycle_id
  FROM h02h03_may2026_staging.academic_cycles sac
  JOIN public.academic_cycles tac
    ON tac.period_label = sac.period_label
   AND tac.quarter_code = sac.quarter_code
)
INSERT INTO public.extra_hours (
  id, legacy_row_number, cycle_id, coordination_id, teacher_id,
  hours, tabulator_amount, reason, activity_date, reference,
  observations, captured_at, captured_by, updated_at, updated_by
)
SELECT
  se.id,
  se.legacy_row_number,
  cm.target_cycle_id,
  com.target_coordination_id,
  se.teacher_id,
  se.hours,
  se.tabulator_amount,
  se.reason,
  se.activity_date,
  se.reference,
  se.observations,
  se.captured_at,
  captured.target_user_id,
  se.updated_at,
  updated.target_user_id
FROM h02h03_may2026_staging.extra_hours se
JOIN cycle_map cm ON cm.source_cycle_id = se.cycle_id
JOIN coordination_map com ON com.source_coordination_id = se.coordination_id
LEFT JOIN actor_map captured ON captured.source_user_id = se.captured_by
LEFT JOIN actor_map updated ON updated.source_user_id = se.updated_by;

WITH config_map AS (
  SELECT
    spc.id AS source_config_id,
    tpc.id AS target_config_id
  FROM h02h03_may2026_staging.payroll_calendar_config spc
  LEFT JOIN h02h03_may2026_staging.academic_cycles sac ON sac.id = spc.cycle_id
  LEFT JOIN public.academic_cycles tac
    ON tac.period_label = sac.period_label
   AND tac.quarter_code = sac.quarter_code
  JOIN public.payroll_calendar_config tpc
    ON tpc.cycle_id IS NOT DISTINCT FROM tac.id
   AND tpc.payroll_start = spc.payroll_start
   AND tpc.payroll_end = spc.payroll_end
),
actor_map AS (
  SELECT su.id AS source_user_id, tu.id AS target_user_id
  FROM h02h03_may2026_staging.app_users su
  JOIN public.app_users tu ON tu.email = su.email
)
INSERT INTO public.schedule_incidences (
  schedule_id, calendar_config_id, absences, delays,
  extra_hours_in_schedule, updated_at, updated_by
)
SELECT
  si.schedule_id,
  cm.target_config_id,
  si.absences,
  si.delays,
  si.extra_hours_in_schedule,
  si.updated_at,
  updated.target_user_id
FROM h02h03_may2026_staging.schedule_incidences si
JOIN config_map cm ON cm.source_config_id = si.calendar_config_id
LEFT JOIN actor_map updated ON updated.source_user_id = si.updated_by
ON CONFLICT (schedule_id, calendar_config_id) DO UPDATE
SET absences = EXCLUDED.absences,
    delays = EXCLUDED.delays,
    extra_hours_in_schedule = EXCLUDED.extra_hours_in_schedule,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

WITH actor_map AS (
  SELECT su.id AS source_user_id, tu.id AS target_user_id
  FROM h02h03_may2026_staging.app_users su
  JOIN public.app_users tu ON tu.email = su.email
),
coordination_map AS (
  SELECT sc.id AS source_coordination_id, tc.id AS target_coordination_id
  FROM h02h03_may2026_staging.coordinations sc
  JOIN public.coordinations tc ON tc.name = sc.name
),
target_users AS (
  SELECT DISTINCT am.target_user_id
  FROM h02h03_may2026_staging.user_coordinations suc
  JOIN actor_map am ON am.source_user_id = suc.user_id
)
DELETE FROM public.user_coordinations uc
USING target_users tu
WHERE uc.user_id = tu.target_user_id;

WITH actor_map AS (
  SELECT su.id AS source_user_id, tu.id AS target_user_id
  FROM h02h03_may2026_staging.app_users su
  JOIN public.app_users tu ON tu.email = su.email
),
coordination_map AS (
  SELECT sc.id AS source_coordination_id, tc.id AS target_coordination_id
  FROM h02h03_may2026_staging.coordinations sc
  JOIN public.coordinations tc ON tc.name = sc.name
),
created_map AS (
  SELECT su.id AS source_user_id, tu.id AS target_user_id
  FROM h02h03_may2026_staging.app_users su
  JOIN public.app_users tu ON tu.email = su.email
)
INSERT INTO public.user_coordinations (
  user_id, coordination_id, is_primary, created_at,
  created_by_user_id, updated_at, updated_by_user_id
)
SELECT
  am.target_user_id,
  cm.target_coordination_id,
  suc.is_primary,
  suc.created_at,
  cb.target_user_id,
  suc.updated_at,
  ub.target_user_id
FROM h02h03_may2026_staging.user_coordinations suc
JOIN actor_map am ON am.source_user_id = suc.user_id
JOIN coordination_map cm ON cm.source_coordination_id = suc.coordination_id
LEFT JOIN created_map cb ON cb.source_user_id = suc.created_by_user_id
LEFT JOIN created_map ub ON ub.source_user_id = suc.updated_by_user_id
ON CONFLICT (user_id, coordination_id) DO UPDATE
SET is_primary = EXCLUDED.is_primary,
    updated_at = EXCLUDED.updated_at,
    updated_by_user_id = EXCLUDED.updated_by_user_id;

DO $$
DECLARE
  staging_schedules integer;
  target_schedules integer;
  staging_incidences integer;
  target_incidences integer;
  staging_extras integer;
  target_extras integer;
BEGIN
  SELECT count(*) INTO staging_schedules FROM h02h03_may2026_staging.schedules;
  SELECT count(*) INTO target_schedules
  FROM public.schedules s
  JOIN h02h03_may2026_staging.academic_cycles sac ON true
  JOIN public.academic_cycles tac
    ON tac.period_label = sac.period_label
   AND tac.quarter_code = sac.quarter_code
   AND tac.id = s.cycle_id;

  SELECT count(*) INTO staging_incidences FROM h02h03_may2026_staging.schedule_incidences;
  SELECT count(*) INTO target_incidences
  FROM public.schedule_incidences si
  JOIN public.schedules s ON s.id = si.schedule_id
  JOIN h02h03_may2026_staging.academic_cycles sac ON true
  JOIN public.academic_cycles tac
    ON tac.period_label = sac.period_label
   AND tac.quarter_code = sac.quarter_code
   AND tac.id = s.cycle_id;

  SELECT count(*) INTO staging_extras FROM h02h03_may2026_staging.extra_hours;
  SELECT count(*) INTO target_extras
  FROM public.extra_hours e
  JOIN h02h03_may2026_staging.academic_cycles sac ON true
  JOIN public.academic_cycles tac
    ON tac.period_label = sac.period_label
   AND tac.quarter_code = sac.quarter_code
   AND tac.id = e.cycle_id;

  IF target_schedules <> staging_schedules THEN
    RAISE EXCEPTION 'Post-check failed: target schedules %, staging %', target_schedules, staging_schedules;
  END IF;
  IF target_incidences <> staging_incidences THEN
    RAISE EXCEPTION 'Post-check failed: target incidences %, staging %', target_incidences, staging_incidences;
  END IF;
  IF target_extras <> staging_extras THEN
    RAISE EXCEPTION 'Post-check failed: target extras %, staging %', target_extras, staging_extras;
  END IF;
END $$;

COMMIT;

SELECT 'official_may_2026_data_applied' AS status, current_database() AS target_database;
