-- Importa CSV exportados desde revision hacia staging.
-- Ejecutar con psql contra destino despues de 02_prepare_staging.sql.

DO $$
BEGIN
  IF current_database() NOT IN ('nomina_docente', 'nomina_docente_h02h03_data_dryrun') THEN
    RAISE EXCEPTION 'Base incorrecta: %, esperado nomina_docente o nomina_docente_h02h03_data_dryrun', current_database();
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

TRUNCATE h02h03_may2026_staging.user_coordinations;
TRUNCATE h02h03_may2026_staging.extra_hours;
TRUNCATE h02h03_may2026_staging.schedule_incidences;
TRUNCATE h02h03_may2026_staging.schedules;
TRUNCATE h02h03_may2026_staging.teachers;
TRUNCATE h02h03_may2026_staging.calendar_blackout_dates;
TRUNCATE h02h03_may2026_staging.payroll_calendar_config;
TRUNCATE h02h03_may2026_staging.academic_cycles;
TRUNCATE h02h03_may2026_staging.tabulators;
TRUNCATE h02h03_may2026_staging.subjects;
TRUNCATE h02h03_may2026_staging.coordinations;
TRUNCATE h02h03_may2026_staging.app_users;

\copy h02h03_may2026_staging.app_users FROM :'app_users_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.coordinations FROM :'coordinations_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.subjects FROM :'subjects_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.tabulators FROM :'tabulators_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.academic_cycles FROM :'academic_cycles_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.payroll_calendar_config FROM :'payroll_calendar_config_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.calendar_blackout_dates FROM :'calendar_blackout_dates_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.teachers FROM :'teachers_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.schedules FROM :'schedules_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.schedule_incidences FROM :'schedule_incidences_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.extra_hours FROM :'extra_hours_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.user_coordinations FROM :'user_coordinations_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

SELECT 'staging_import_complete' AS status, current_database() AS target_database;
