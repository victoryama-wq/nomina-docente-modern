-- Exporta datos oficiales validados desde la fuente de revision/local.
-- Fuentes permitidas:
-- - nomina_docente_h02h03_review, si conserva Incidencias/Extras vivos.
-- - nomina_docente_deploy_snapshot_20260526_111616_h02h03, fuente local validada con datos vivos.
-- No ejecutar contra produccion.

DO $$
BEGIN
  IF current_database() NOT IN (
    'nomina_docente_h02h03_review',
    'nomina_docente_deploy_snapshot_20260526_111616_h02h03'
  ) THEN
    RAISE EXCEPTION 'Base incorrecta: %, esperado fuente H02/H03 validada', current_database();
  END IF;
END $$;

\copy (SELECT * FROM app_users ORDER BY email) TO 'database/imports/h02_h03_may_2026_official/data/app_users.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM coordinations ORDER BY name) TO 'database/imports/h02_h03_may_2026_official/data/coordinations.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM subjects ORDER BY name) TO 'database/imports/h02_h03_may_2026_official/data/subjects.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM tabulators ORDER BY name) TO 'database/imports/h02_h03_may_2026_official/data/tabulators.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM academic_cycles ORDER BY period_label, quarter_code) TO 'database/imports/h02_h03_may_2026_official/data/academic_cycles.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM payroll_calendar_config ORDER BY payroll_start, payroll_end, created_at) TO 'database/imports/h02_h03_may_2026_official/data/payroll_calendar_config.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM calendar_blackout_dates ORDER BY blackout_date, reason) TO 'database/imports/h02_h03_may_2026_official/data/calendar_blackout_dates.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM teachers ORDER BY normalized_name) TO 'database/imports/h02_h03_may_2026_official/data/teachers.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM schedules ORDER BY legacy_sheet_name, legacy_row_number, id) TO 'database/imports/h02_h03_may_2026_official/data/schedules.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM schedule_incidences ORDER BY schedule_id, calendar_config_id) TO 'database/imports/h02_h03_may_2026_official/data/schedule_incidences.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM extra_hours ORDER BY legacy_row_number, id) TO 'database/imports/h02_h03_may_2026_official/data/extra_hours.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM user_coordinations ORDER BY user_id, coordination_id) TO 'database/imports/h02_h03_may_2026_official/data/user_coordinations.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

SELECT 'export_complete' AS status, current_database() AS source_database;
