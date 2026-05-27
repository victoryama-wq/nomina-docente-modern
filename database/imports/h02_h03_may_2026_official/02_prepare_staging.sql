-- Prepara staging local dentro de la base destino.
-- Puede ejecutarse en dry-run o produccion.
-- Bases permitidas: nomina_docente, nomina_docente_h02h03_data_dryrun.

DO $$
BEGIN
  IF current_database() NOT IN ('nomina_docente', 'nomina_docente_h02h03_data_dryrun') THEN
    RAISE EXCEPTION 'Base incorrecta: %, esperado nomina_docente o nomina_docente_h02h03_data_dryrun', current_database();
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS h02h03_may2026_staging;

DROP TABLE IF EXISTS h02h03_may2026_staging.user_coordinations;
DROP TABLE IF EXISTS h02h03_may2026_staging.extra_hours;
DROP TABLE IF EXISTS h02h03_may2026_staging.schedule_incidences;
DROP TABLE IF EXISTS h02h03_may2026_staging.schedules;
DROP TABLE IF EXISTS h02h03_may2026_staging.teachers;
DROP TABLE IF EXISTS h02h03_may2026_staging.calendar_blackout_dates;
DROP TABLE IF EXISTS h02h03_may2026_staging.payroll_calendar_config;
DROP TABLE IF EXISTS h02h03_may2026_staging.academic_cycles;
DROP TABLE IF EXISTS h02h03_may2026_staging.tabulators;
DROP TABLE IF EXISTS h02h03_may2026_staging.subjects;
DROP TABLE IF EXISTS h02h03_may2026_staging.coordinations;
DROP TABLE IF EXISTS h02h03_may2026_staging.app_users;

CREATE TABLE h02h03_may2026_staging.app_users (LIKE public.app_users INCLUDING DEFAULTS);
CREATE TABLE h02h03_may2026_staging.coordinations (LIKE public.coordinations INCLUDING DEFAULTS);
CREATE TABLE h02h03_may2026_staging.subjects (LIKE public.subjects INCLUDING DEFAULTS);
CREATE TABLE h02h03_may2026_staging.tabulators (LIKE public.tabulators INCLUDING DEFAULTS);
CREATE TABLE h02h03_may2026_staging.academic_cycles (LIKE public.academic_cycles INCLUDING DEFAULTS);
CREATE TABLE h02h03_may2026_staging.payroll_calendar_config (LIKE public.payroll_calendar_config INCLUDING DEFAULTS);
CREATE TABLE h02h03_may2026_staging.calendar_blackout_dates (LIKE public.calendar_blackout_dates INCLUDING DEFAULTS);
CREATE TABLE h02h03_may2026_staging.teachers (LIKE public.teachers INCLUDING DEFAULTS);
CREATE TABLE h02h03_may2026_staging.schedules (LIKE public.schedules INCLUDING DEFAULTS);
CREATE TABLE h02h03_may2026_staging.schedule_incidences (LIKE public.schedule_incidences INCLUDING DEFAULTS);
CREATE TABLE h02h03_may2026_staging.extra_hours (LIKE public.extra_hours INCLUDING DEFAULTS);
CREATE TABLE h02h03_may2026_staging.user_coordinations (LIKE public.user_coordinations INCLUDING DEFAULTS);

SELECT 'staging_ready' AS status, current_database() AS target_database;
