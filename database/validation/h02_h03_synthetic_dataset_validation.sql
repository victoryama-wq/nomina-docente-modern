-- H02/H03 synthetic dataset validation for LOCAL/REVIEW only.
-- Read-only validation. Target database: nomina_docente_h02h03.

\pset pager off

DO $$
BEGIN
  IF current_database() <> 'nomina_docente_h02h03' THEN
    RAISE EXCEPTION 'This validation is only allowed on nomina_docente_h02h03. Current database: %', current_database();
  END IF;
END $$;

\echo '== H02/H03 synthetic dataset: active cycle and payroll period =='
SELECT
  ac.id AS cycle_id,
  ac.period_label,
  ac.quarter_code,
  ac.status,
  pcc.id AS calendar_config_id,
  pcc.period_label AS payroll_period,
  pcc.payroll_start,
  pcc.payroll_end,
  CASE WHEN ac.status = 'ACTIVO' AND pcc.id IS NOT NULL THEN 'OK' ELSE 'REVIEW' END AS validation_status
FROM academic_cycles ac
LEFT JOIN payroll_calendar_config pcc ON pcc.cycle_id = ac.id
WHERE ac.id = '20000000-0000-4000-8000-000000000001'::uuid;

\echo '== H02/H03 synthetic dataset: subjects and tabulators =='
SELECT
  (SELECT count(*) FROM subjects WHERE id = '20000000-0000-4000-8000-000000000101'::uuid) AS synthetic_subjects,
  (SELECT count(*) FROM tabulators WHERE id = '20000000-0000-4000-8000-000000000201'::uuid AND amount = 100.00) AS synthetic_tabulators_100,
  CASE
    WHEN (SELECT count(*) FROM subjects WHERE id = '20000000-0000-4000-8000-000000000101'::uuid) = 1
     AND (SELECT count(*) FROM tabulators WHERE id = '20000000-0000-4000-8000-000000000201'::uuid AND amount = 100.00) = 1
    THEN 'OK'
    ELSE 'REVIEW'
  END AS validation_status;

\echo '== H02/H03 synthetic dataset: teachers and sensitive fields =='
SELECT
  count(*) AS synthetic_teachers,
  count(*) FILTER (WHERE rfc <> '') AS teachers_with_rfc,
  count(*) FILTER (WHERE bank_detail <> '') AS teachers_with_bank_detail,
  count(*) FILTER (WHERE email <> '') AS teachers_with_email,
  count(*) FILTER (WHERE payment_type <> '') AS teachers_with_payment_type,
  CASE
    WHEN count(*) >= 4
     AND count(*) FILTER (WHERE rfc <> '') = 0
     AND count(*) FILTER (WHERE bank_detail <> '') = 0
     AND count(*) FILTER (WHERE email <> '') = 0
     AND count(*) FILTER (WHERE payment_type <> '') = 0
    THEN 'OK'
    ELSE 'REVIEW'
  END AS validation_status
FROM teachers
WHERE normalized_name LIKE 'qa docente %';

\echo '== H02/H03 synthetic dataset: schedules by coordination =='
SELECT
  c.name AS coordination,
  count(s.id) AS schedules,
  string_agg(t.full_name, ', ' ORDER BY t.full_name) AS teachers,
  CASE WHEN count(s.id) > 0 THEN 'OK' ELSE 'REVIEW' END AS validation_status
FROM schedules s
JOIN coordinations c ON c.id = s.coordination_id
JOIN teachers t ON t.id = s.teacher_id
WHERE s.id IN (
  '20000000-0000-4000-8000-000000000401'::uuid,
  '20000000-0000-4000-8000-000000000402'::uuid,
  '20000000-0000-4000-8000-000000000403'::uuid,
  '20000000-0000-4000-8000-000000000404'::uuid
)
GROUP BY c.name
ORDER BY c.name;

\echo '== H02/H03 synthetic dataset: incidences =='
SELECT
  count(*) AS synthetic_incidences,
  sum(absences) AS total_absences,
  sum(delays) AS total_delays,
  sum(extra_hours_in_schedule) AS total_schedule_extra_hours,
  CASE WHEN count(*) >= 4 THEN 'OK' ELSE 'REVIEW' END AS validation_status
FROM schedule_incidences
WHERE calendar_config_id = '20000000-0000-4000-8000-000000000002'::uuid;

\echo '== H02/H03 synthetic dataset: extras own and foreign =='
SELECT
  u.email AS captured_by,
  c.name AS coordination,
  count(eh.id) AS extras,
  sum(eh.hours) AS hours,
  CASE WHEN count(eh.id) > 0 THEN 'OK' ELSE 'REVIEW' END AS validation_status
FROM extra_hours eh
JOIN app_users u ON u.id = eh.captured_by
JOIN coordinations c ON c.id = eh.coordination_id
WHERE eh.id IN (
  '20000000-0000-4000-8000-000000000501'::uuid,
  '20000000-0000-4000-8000-000000000502'::uuid,
  '20000000-0000-4000-8000-000000000503'::uuid,
  '20000000-0000-4000-8000-000000000504'::uuid,
  '20000000-0000-4000-8000-000000000505'::uuid
)
GROUP BY u.email, c.name
ORDER BY c.name, u.email;

\echo '== H02/H03 synthetic dataset: coordinator single coordination =='
SELECT
  u.email,
  r.code AS role_code,
  count(uc.id) AS assigned_coordinations,
  string_agg(c.name, ', ' ORDER BY c.name) AS coordinations,
  CASE WHEN count(uc.id) = 1 THEN 'OK' ELSE 'REVIEW' END AS validation_status
FROM app_users u
JOIN roles r ON r.id = u.role_id
LEFT JOIN user_coordinations uc ON uc.user_id = u.id
LEFT JOIN coordinations c ON c.id = uc.coordination_id
WHERE u.email = 'lidia.medina@tecplayacar.edu.mx'
GROUP BY u.email, r.code;

\echo '== H02/H03 synthetic dataset: coordinator multiple coordinations =='
SELECT
  u.email,
  r.code AS role_code,
  count(uc.id) AS assigned_coordinations,
  string_agg(c.name, ', ' ORDER BY c.name) AS coordinations,
  CASE WHEN count(uc.id) > 1 THEN 'OK' ELSE 'REVIEW' END AS validation_status
FROM app_users u
JOIN roles r ON r.id = u.role_id
LEFT JOIN user_coordinations uc ON uc.user_id = u.id
LEFT JOIN coordinations c ON c.id = uc.coordination_id
WHERE u.email = 'eslivet.aguilar@tecplayacar.edu.mx'
GROUP BY u.email, r.code;

\echo '== H02/H03 synthetic dataset: preview readiness =='
SELECT
  (SELECT count(*) FROM academic_cycles WHERE id = '20000000-0000-4000-8000-000000000001'::uuid AND status = 'ACTIVO') AS active_cycles,
  (SELECT count(*) FROM payroll_calendar_config WHERE id = '20000000-0000-4000-8000-000000000002'::uuid) AS payroll_periods,
  (SELECT count(*) FROM teachers WHERE normalized_name LIKE 'qa docente %') AS teachers,
  (SELECT count(*) FROM schedules WHERE cycle_id = '20000000-0000-4000-8000-000000000001'::uuid) AS schedules,
  (SELECT count(*) FROM schedule_incidences WHERE calendar_config_id = '20000000-0000-4000-8000-000000000002'::uuid) AS incidences,
  (SELECT count(*) FROM extra_hours WHERE cycle_id = '20000000-0000-4000-8000-000000000001'::uuid) AS extras,
  CASE
    WHEN (SELECT count(*) FROM academic_cycles WHERE id = '20000000-0000-4000-8000-000000000001'::uuid AND status = 'ACTIVO') = 1
     AND (SELECT count(*) FROM payroll_calendar_config WHERE id = '20000000-0000-4000-8000-000000000002'::uuid) = 1
     AND (SELECT count(*) FROM teachers WHERE normalized_name LIKE 'qa docente %') >= 4
     AND (SELECT count(*) FROM schedules WHERE cycle_id = '20000000-0000-4000-8000-000000000001'::uuid) >= 4
    THEN 'OK'
    ELSE 'REVIEW'
  END AS validation_status;

\echo '== H02/H03 synthetic dataset: reserved coordination names absent =='
SELECT
  count(*) FILTER (WHERE lower(name) = lower('Todas / Global')) AS global_reserved_names,
  count(*) FILTER (
    WHERE lower(name) IN (lower('No requiere coordinacion operativa'), lower('No requiere coordinación operativa'))
  ) AS no_operational_reserved_names,
  CASE
    WHEN count(*) FILTER (WHERE lower(name) = lower('Todas / Global')) = 0
     AND count(*) FILTER (
       WHERE lower(name) IN (lower('No requiere coordinacion operativa'), lower('No requiere coordinación operativa'))
     ) = 0
    THEN 'OK'
    ELSE 'REVIEW'
  END AS validation_status
FROM coordinations;
