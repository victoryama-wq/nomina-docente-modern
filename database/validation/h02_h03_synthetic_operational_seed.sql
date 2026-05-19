-- H02/H03 synthetic operational seed for LOCAL/REVIEW validation only.
-- Do not run against production.
-- Target database: nomina_docente_h02h03.

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'nomina_docente_h02h03' THEN
    RAISE EXCEPTION 'This synthetic seed is only allowed on nomina_docente_h02h03. Current database: %', current_database();
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'lidia.medina@tecplayacar.edu.mx') THEN
    RAISE EXCEPTION 'Required local coordinator user is missing: lidia.medina@tecplayacar.edu.mx';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'eslivet.aguilar@tecplayacar.edu.mx') THEN
    RAISE EXCEPTION 'Required local coordinator user is missing: eslivet.aguilar@tecplayacar.edu.mx';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'leonardo.sayas@tecplayacar.edu.mx') THEN
    RAISE EXCEPTION 'Required local coordinator user is missing: leonardo.sayas@tecplayacar.edu.mx';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM coordinations WHERE name IN ('Idiomas', 'ADETUR', 'ARQ', 'CINTER')) THEN
    RAISE EXCEPTION 'Required local coordinations are missing. Expected: Idiomas, ADETUR, ARQ, CINTER';
  END IF;
END $$;

INSERT INTO academic_cycles (
  id,
  period_label,
  quarter_code,
  module1_start,
  module1_end,
  module2_start,
  module2_end,
  status,
  created_by
)
SELECT
  '20000000-0000-4000-8000-000000000001'::uuid,
  'H02H03 QA Local 2026',
  'QA-H02H03',
  '2026-05-01'::date,
  '2026-06-30'::date,
  '2026-07-01'::date,
  '2026-08-31'::date,
  'ACTIVO',
  u.id
FROM app_users u
WHERE u.email = 'victor.yama@tecplayacar.edu.mx'
ON CONFLICT (period_label, quarter_code) DO UPDATE
SET module1_start = EXCLUDED.module1_start,
    module1_end = EXCLUDED.module1_end,
    module2_start = EXCLUDED.module2_start,
    module2_end = EXCLUDED.module2_end,
    status = EXCLUDED.status;

INSERT INTO payroll_calendar_config (
  id,
  cycle_id,
  period_label,
  payroll_start,
  payroll_end,
  module1_start,
  module1_end,
  module2_start,
  module2_end,
  incidences_access_start_at,
  incidences_access_days,
  extras_access_start_at,
  extras_access_days
)
VALUES (
  '20000000-0000-4000-8000-000000000002'::uuid,
  '20000000-0000-4000-8000-000000000001'::uuid,
  'QA Mayo 1-15 2026',
  '2026-05-01'::date,
  '2026-05-15'::date,
  '2026-05-01'::date,
  '2026-06-30'::date,
  '2026-07-01'::date,
  '2026-08-31'::date,
  now() - interval '1 day',
  31,
  now() - interval '1 day',
  31
)
ON CONFLICT (cycle_id, period_label) WHERE cycle_id IS NOT NULL DO UPDATE
SET payroll_start = EXCLUDED.payroll_start,
    payroll_end = EXCLUDED.payroll_end,
    module1_start = EXCLUDED.module1_start,
    module1_end = EXCLUDED.module1_end,
    module2_start = EXCLUDED.module2_start,
    module2_end = EXCLUDED.module2_end,
    incidences_access_start_at = EXCLUDED.incidences_access_start_at,
    incidences_access_days = EXCLUDED.incidences_access_days,
    extras_access_start_at = EXCLUDED.extras_access_start_at,
    extras_access_days = EXCLUDED.extras_access_days;

INSERT INTO calendar_blackout_dates (id, config_id, blackout_date, reason)
VALUES (
  '20000000-0000-4000-8000-000000000003'::uuid,
  '20000000-0000-4000-8000-000000000002'::uuid,
  '2026-05-05'::date,
  'QA local blackout'
)
ON CONFLICT (config_id, blackout_date) DO UPDATE
SET reason = EXCLUDED.reason;

INSERT INTO subjects (id, name, status)
VALUES
  ('20000000-0000-4000-8000-000000000101'::uuid, 'QA H02H03 Materia Operativa', 'ACTIVO')
ON CONFLICT (name) DO UPDATE
SET status = EXCLUDED.status;

INSERT INTO tabulators (id, name, amount, status)
VALUES
  ('20000000-0000-4000-8000-000000000201'::uuid, 'QA H02H03 Tabulador 100', 100.00, 'ACTIVO')
ON CONFLICT (name) DO UPDATE
SET amount = EXCLUDED.amount,
    status = EXCLUDED.status;

WITH refs AS (
  SELECT
    (SELECT id FROM app_users WHERE email = 'lidia.medina@tecplayacar.edu.mx') AS lidia_id,
    (SELECT id FROM app_users WHERE email = 'eslivet.aguilar@tecplayacar.edu.mx') AS eslivet_id,
    (SELECT id FROM app_users WHERE email = 'leonardo.sayas@tecplayacar.edu.mx') AS leonardo_id,
    (SELECT id FROM coordinations WHERE name = 'Idiomas') AS idiomas_id,
    (SELECT id FROM coordinations WHERE name = 'ADETUR') AS adetur_id,
    (SELECT id FROM coordinations WHERE name = 'ARQ') AS arq_id,
    (SELECT id FROM coordinations WHERE name = 'CINTER') AS cinter_id
)
INSERT INTO teachers (
  id,
  full_name,
  normalized_name,
  first_names,
  paternal_last_name,
  maternal_last_name,
  category,
  coordination_id,
  status,
  created_by,
  updated_by
)
SELECT *
FROM (
  SELECT
    '20000000-0000-4000-8000-000000000301'::uuid,
    'QA Docente Idiomas Uno',
    'qa docente idiomas uno',
    'QA Docente',
    'Idiomas',
    'Uno',
    'V',
    idiomas_id,
    'ACTIVO'::teacher_status,
    lidia_id,
    lidia_id
  FROM refs
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000302'::uuid,
    'QA Docente ADETUR Uno',
    'qa docente adetur uno',
    'QA Docente',
    'ADETUR',
    'Uno',
    'M',
    adetur_id,
    'ACTIVO'::teacher_status,
    eslivet_id,
    eslivet_id
  FROM refs
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000303'::uuid,
    'QA Docente ARQ Uno',
    'qa docente arq uno',
    'QA Docente',
    'ARQ',
    'Uno',
    'N',
    arq_id,
    'ACTIVO'::teacher_status,
    eslivet_id,
    eslivet_id
  FROM refs
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000304'::uuid,
    'QA Docente CINTER Fuera',
    'qa docente cinter fuera',
    'QA Docente',
    'CINTER',
    'Fuera',
    'V',
    cinter_id,
    'ACTIVO'::teacher_status,
    leonardo_id,
    leonardo_id
  FROM refs
) AS rows
ON CONFLICT (normalized_name) DO UPDATE
SET full_name = EXCLUDED.full_name,
    first_names = EXCLUDED.first_names,
    paternal_last_name = EXCLUDED.paternal_last_name,
    maternal_last_name = EXCLUDED.maternal_last_name,
    category = EXCLUDED.category,
    coordination_id = EXCLUDED.coordination_id,
    status = EXCLUDED.status,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    payment_type = '',
    phone = '',
    email = '',
    rfc = '',
    external_identifier = '',
    bank_detail = '';

INSERT INTO schedules (
  id,
  cycle_id,
  coordination_id,
  teacher_id,
  subject_id,
  subject_name,
  group_code,
  tabulator_id,
  tabulator_name,
  tabulator_amount,
  hours_l,
  hours_m,
  hours_x,
  hours_j,
  hours_v,
  hours_s1,
  hours_s2,
  created_by,
  updated_by
)
SELECT *
FROM (
  SELECT
    '20000000-0000-4000-8000-000000000401'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    c.id,
    '20000000-0000-4000-8000-000000000301'::uuid,
    '20000000-0000-4000-8000-000000000101'::uuid,
    'QA H02H03 Materia Operativa',
    'QA-IDM-1',
    '20000000-0000-4000-8000-000000000201'::uuid,
    'QA H02H03 Tabulador 100',
    100.00,
    2, 2, 0, 0, 0, 0, 0,
    u.id,
    u.id
  FROM coordinations c
  JOIN app_users u ON u.email = 'lidia.medina@tecplayacar.edu.mx'
  WHERE c.name = 'Idiomas'
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000402'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    c.id,
    '20000000-0000-4000-8000-000000000302'::uuid,
    '20000000-0000-4000-8000-000000000101'::uuid,
    'QA H02H03 Materia Operativa',
    'QA-ADE-1',
    '20000000-0000-4000-8000-000000000201'::uuid,
    'QA H02H03 Tabulador 100',
    100.00,
    1, 1, 1, 1, 0, 0, 0,
    u.id,
    u.id
  FROM coordinations c
  JOIN app_users u ON u.email = 'eslivet.aguilar@tecplayacar.edu.mx'
  WHERE c.name = 'ADETUR'
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000403'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    c.id,
    '20000000-0000-4000-8000-000000000303'::uuid,
    '20000000-0000-4000-8000-000000000101'::uuid,
    'QA H02H03 Materia Operativa',
    'QA-ARQ-1',
    '20000000-0000-4000-8000-000000000201'::uuid,
    'QA H02H03 Tabulador 100',
    100.00,
    0, 0, 2, 2, 0, 0, 0,
    u.id,
    u.id
  FROM coordinations c
  JOIN app_users u ON u.email = 'eslivet.aguilar@tecplayacar.edu.mx'
  WHERE c.name = 'ARQ'
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000404'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    c.id,
    '20000000-0000-4000-8000-000000000304'::uuid,
    '20000000-0000-4000-8000-000000000101'::uuid,
    'QA H02H03 Materia Operativa',
    'QA-CIN-1',
    '20000000-0000-4000-8000-000000000201'::uuid,
    'QA H02H03 Tabulador 100',
    100.00,
    0, 0, 0, 0, 3, 0, 0,
    u.id,
    u.id
  FROM coordinations c
  JOIN app_users u ON u.email = 'leonardo.sayas@tecplayacar.edu.mx'
  WHERE c.name = 'CINTER'
) AS rows
ON CONFLICT (id) DO UPDATE
SET coordination_id = EXCLUDED.coordination_id,
    teacher_id = EXCLUDED.teacher_id,
    subject_id = EXCLUDED.subject_id,
    subject_name = EXCLUDED.subject_name,
    group_code = EXCLUDED.group_code,
    tabulator_id = EXCLUDED.tabulator_id,
    tabulator_name = EXCLUDED.tabulator_name,
    tabulator_amount = EXCLUDED.tabulator_amount,
    hours_l = EXCLUDED.hours_l,
    hours_m = EXCLUDED.hours_m,
    hours_x = EXCLUDED.hours_x,
    hours_j = EXCLUDED.hours_j,
    hours_v = EXCLUDED.hours_v,
    hours_s1 = EXCLUDED.hours_s1,
    hours_s2 = EXCLUDED.hours_s2,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

INSERT INTO schedule_incidences (
  schedule_id,
  calendar_config_id,
  absences,
  delays,
  extra_hours_in_schedule,
  updated_by
)
SELECT *
FROM (
  SELECT
    '20000000-0000-4000-8000-000000000401'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid,
    1.00,
    1.00,
    0.50,
    (SELECT id FROM app_users WHERE email = 'lidia.medina@tecplayacar.edu.mx')
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000402'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid,
    0.00,
    2.00,
    1.00,
    (SELECT id FROM app_users WHERE email = 'eslivet.aguilar@tecplayacar.edu.mx')
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000403'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid,
    0.50,
    0.00,
    0.00,
    (SELECT id FROM app_users WHERE email = 'eslivet.aguilar@tecplayacar.edu.mx')
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000404'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid,
    0.00,
    0.00,
    0.25,
    (SELECT id FROM app_users WHERE email = 'leonardo.sayas@tecplayacar.edu.mx')
) AS rows
ON CONFLICT (schedule_id, calendar_config_id) DO UPDATE
SET absences = EXCLUDED.absences,
    delays = EXCLUDED.delays,
    extra_hours_in_schedule = EXCLUDED.extra_hours_in_schedule,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

INSERT INTO extra_hours (
  id,
  cycle_id,
  coordination_id,
  teacher_id,
  hours,
  tabulator_amount,
  reason,
  activity_date,
  reference,
  observations,
  captured_by,
  updated_by
)
SELECT *
FROM (
  SELECT
    '20000000-0000-4000-8000-000000000501'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    c.id,
    '20000000-0000-4000-8000-000000000301'::uuid,
    2.00,
    100.00,
    'QA extra propio Lidia',
    '2026-05-10'::date,
    'QA-H02H03-IDM-PROPIO',
    'Dato sintetico local',
    u.id,
    u.id
  FROM coordinations c
  JOIN app_users u ON u.email = 'lidia.medina@tecplayacar.edu.mx'
  WHERE c.name = 'Idiomas'
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000502'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    c.id,
    '20000000-0000-4000-8000-000000000301'::uuid,
    1.50,
    100.00,
    'QA extra ajeno en Idiomas',
    '2026-05-11'::date,
    'QA-H02H03-IDM-AJENO',
    'Dato sintetico local',
    u.id,
    u.id
  FROM coordinations c
  JOIN app_users u ON u.email = 'eslivet.aguilar@tecplayacar.edu.mx'
  WHERE c.name = 'Idiomas'
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000503'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    c.id,
    '20000000-0000-4000-8000-000000000302'::uuid,
    3.00,
    100.00,
    'QA extra propio Eslivet',
    '2026-05-12'::date,
    'QA-H02H03-ADE-PROPIO',
    'Dato sintetico local',
    u.id,
    u.id
  FROM coordinations c
  JOIN app_users u ON u.email = 'eslivet.aguilar@tecplayacar.edu.mx'
  WHERE c.name = 'ADETUR'
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000504'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    c.id,
    '20000000-0000-4000-8000-000000000303'::uuid,
    2.25,
    100.00,
    'QA extra ajeno en ARQ',
    '2026-05-13'::date,
    'QA-H02H03-ARQ-AJENO',
    'Dato sintetico local',
    u.id,
    u.id
  FROM coordinations c
  JOIN app_users u ON u.email = 'lidia.medina@tecplayacar.edu.mx'
  WHERE c.name = 'ARQ'
  UNION ALL
  SELECT
    '20000000-0000-4000-8000-000000000505'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    c.id,
    '20000000-0000-4000-8000-000000000304'::uuid,
    1.00,
    100.00,
    'QA extra fuera de alcance Eslivet/Lidia',
    '2026-05-14'::date,
    'QA-H02H03-CIN-FUERA',
    'Dato sintetico local',
    u.id,
    u.id
  FROM coordinations c
  JOIN app_users u ON u.email = 'leonardo.sayas@tecplayacar.edu.mx'
  WHERE c.name = 'CINTER'
) AS rows
ON CONFLICT (id) DO UPDATE
SET coordination_id = EXCLUDED.coordination_id,
    teacher_id = EXCLUDED.teacher_id,
    hours = EXCLUDED.hours,
    tabulator_amount = EXCLUDED.tabulator_amount,
    reason = EXCLUDED.reason,
    activity_date = EXCLUDED.activity_date,
    reference = EXCLUDED.reference,
    observations = EXCLUDED.observations,
    captured_by = EXCLUDED.captured_by,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

COMMIT;
