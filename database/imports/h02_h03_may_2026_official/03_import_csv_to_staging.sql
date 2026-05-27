-- Importa CSV exportados desde revision hacia staging.
-- Ejecutar con psql contra destino despues de 02_prepare_staging.sql.

DO $$
BEGIN
  IF current_database() NOT IN ('nomina_docente', 'nomina_docente_h02h03_data_dryrun') THEN
    RAISE EXCEPTION 'Base incorrecta: %, esperado nomina_docente o nomina_docente_h02h03_data_dryrun', current_database();
  END IF;
END $$;

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

\copy h02h03_may2026_staging.app_users FROM 'database/imports/h02_h03_may_2026_official/data/app_users.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.coordinations FROM 'database/imports/h02_h03_may_2026_official/data/coordinations.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.subjects FROM 'database/imports/h02_h03_may_2026_official/data/subjects.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.tabulators FROM 'database/imports/h02_h03_may_2026_official/data/tabulators.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.academic_cycles FROM 'database/imports/h02_h03_may_2026_official/data/academic_cycles.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.payroll_calendar_config FROM 'database/imports/h02_h03_may_2026_official/data/payroll_calendar_config.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.calendar_blackout_dates FROM 'database/imports/h02_h03_may_2026_official/data/calendar_blackout_dates.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.teachers FROM 'database/imports/h02_h03_may_2026_official/data/teachers.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.schedules FROM 'database/imports/h02_h03_may_2026_official/data/schedules.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.schedule_incidences FROM 'database/imports/h02_h03_may_2026_official/data/schedule_incidences.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.extra_hours FROM 'database/imports/h02_h03_may_2026_official/data/extra_hours.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy h02h03_may2026_staging.user_coordinations FROM 'database/imports/h02_h03_may_2026_official/data/user_coordinations.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

SELECT 'staging_import_complete' AS status, current_database() AS target_database;
