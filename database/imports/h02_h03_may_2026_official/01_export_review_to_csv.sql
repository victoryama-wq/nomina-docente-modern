-- Exporta datos oficiales validados desde la base de revision.
-- Ejecutar con psql contra: nomina_docente_h02h03_review
-- No ejecutar contra produccion.

DO $$
BEGIN
  IF current_database() <> 'nomina_docente_h02h03_review' THEN
    RAISE EXCEPTION 'Base incorrecta: %, esperado nomina_docente_h02h03_review', current_database();
  END IF;
END $$;

\set app_users_csv 'database/imports/h02_h03_may_2026_official/data/app_users.csv'
\set coordinations_csv 'database/imports/h02_h03_may_2026_official/data/coordinations.csv'
\set subjects_csv 'database/imports/h02_h03_may_2026_official/data/subjects.csv'
\set tabulators_csv 'database/imports/h02_h03_may_2026_official/data/tabulators.csv'
\set academic_cycles_csv 'database/imports/h02_h03_may_2026_official/data/academic_cycles.csv'
\set payroll_calendar_config_csv 'database/imports/h02_h03_may_2026_official/data/payroll_calendar_config.csv'
\set calendar_blackout_dates_csv 'database/imports/h02_h03_may_2026_official/data/calendar_blackout_dates.csv'
\set teachers_csv 'database/imports/h02_h03_may_2026_official/data/teachers.csv'
\set schedules_csv 'database/imports/h02_h03_may_2026_official/data/schedules.csv'
\set schedule_incidences_csv 'database/imports/h02_h03_may_2026_official/data/schedule_incidences.csv'
\set extra_hours_csv 'database/imports/h02_h03_may_2026_official/data/extra_hours.csv'
\set user_coordinations_csv 'database/imports/h02_h03_may_2026_official/data/user_coordinations.csv'

\copy (SELECT * FROM app_users ORDER BY email) TO :'app_users_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM coordinations ORDER BY name) TO :'coordinations_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM subjects ORDER BY name) TO :'subjects_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM tabulators ORDER BY name) TO :'tabulators_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM academic_cycles ORDER BY period_label, quarter_code) TO :'academic_cycles_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM payroll_calendar_config ORDER BY payroll_start, payroll_end, created_at) TO :'payroll_calendar_config_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM calendar_blackout_dates ORDER BY blackout_date, reason) TO :'calendar_blackout_dates_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM teachers ORDER BY normalized_name) TO :'teachers_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM schedules ORDER BY legacy_sheet_name, legacy_row_number, id) TO :'schedules_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM schedule_incidences ORDER BY schedule_id, calendar_config_id) TO :'schedule_incidences_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM extra_hours ORDER BY legacy_row_number, id) TO :'extra_hours_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM user_coordinations ORDER BY user_id, coordination_id) TO :'user_coordinations_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

SELECT 'export_complete' AS status, current_database() AS source_database;
