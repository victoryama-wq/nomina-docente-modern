-- Validacion posterior a migracion de datos oficiales.
-- No modifica datos.

DO $$
BEGIN
  IF current_database() NOT IN ('nomina_docente', 'nomina_docente_h02h03_data_dryrun') THEN
    RAISE EXCEPTION 'Base incorrecta: %, esperado nomina_docente o nomina_docente_h02h03_data_dryrun', current_database();
  END IF;
END $$;

WITH staged_cycles AS (
  SELECT DISTINCT tac.id AS target_cycle_id, tac.period_label, tac.quarter_code
  FROM h02h03_may2026_staging.academic_cycles sac
  JOIN public.academic_cycles tac
    ON tac.period_label = sac.period_label
   AND tac.quarter_code = sac.quarter_code
),
staged_configs AS (
  SELECT tpc.id AS target_config_id, spc.payroll_start, spc.payroll_end
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
checks AS (
  SELECT 'teachers total' AS check_name, count(*)::text AS value, 'INFO' AS status FROM public.teachers
  UNION ALL SELECT 'schedules migrated cycles', count(*)::text, CASE WHEN count(*) = 589 THEN 'OK' ELSE 'REVIEW' END
  FROM public.schedules s JOIN staged_cycles c ON c.target_cycle_id = s.cycle_id
  UNION ALL SELECT 'incidences migrated configs', count(*)::text, CASE WHEN count(*) = 18 THEN 'OK' ELSE 'REVIEW' END
  FROM public.schedule_incidences si JOIN staged_configs c ON c.target_config_id = si.calendar_config_id
  UNION ALL SELECT 'extras migrated cycles', count(*)::text, CASE WHEN count(*) = 65 THEN 'OK' ELSE 'REVIEW' END
  FROM public.extra_hours e JOIN staged_cycles c ON c.target_cycle_id = e.cycle_id
  UNION ALL SELECT 'user_coordinations total', count(*)::text, CASE WHEN count(*) >= 15 THEN 'OK' ELSE 'REVIEW' END
  FROM public.user_coordinations
  UNION ALL SELECT 'duplicate teacher normalized_name', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM (
    SELECT normalized_name FROM public.teachers GROUP BY normalized_name HAVING count(*) > 1
  ) dup
  UNION ALL SELECT 'schedules without teacher', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM public.schedules s LEFT JOIN public.teachers t ON t.id = s.teacher_id WHERE t.id IS NULL
  UNION ALL SELECT 'schedules without created_by', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM public.schedules s JOIN staged_cycles c ON c.target_cycle_id = s.cycle_id WHERE s.created_by IS NULL
  UNION ALL SELECT 'extras without captured_by', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM public.extra_hours e JOIN staged_cycles c ON c.target_cycle_id = e.cycle_id WHERE e.captured_by IS NULL
  UNION ALL SELECT 'total absences', COALESCE(sum(si.absences), 0)::text, CASE WHEN COALESCE(sum(si.absences), 0) = 30 THEN 'OK' ELSE 'REVIEW' END
  FROM public.schedule_incidences si JOIN staged_configs c ON c.target_config_id = si.calendar_config_id
  UNION ALL SELECT 'total delays', COALESCE(sum(si.delays), 0)::text, CASE WHEN COALESCE(sum(si.delays), 0) = 0 THEN 'OK' ELSE 'REVIEW' END
  FROM public.schedule_incidences si JOIN staged_configs c ON c.target_config_id = si.calendar_config_id
  UNION ALL SELECT 'total extra hours', COALESCE(sum(e.hours), 0)::text, CASE WHEN COALESCE(sum(e.hours), 0) = 1025 THEN 'OK' ELSE 'REVIEW' END
  FROM public.extra_hours e JOIN staged_cycles c ON c.target_cycle_id = e.cycle_id
  UNION ALL SELECT 'total extra amount', COALESCE(sum(e.hours * e.tabulator_amount), 0)::text, CASE WHEN COALESCE(sum(e.hours * e.tabulator_amount), 0) = 128310 THEN 'OK' ELSE 'REVIEW' END
  FROM public.extra_hours e JOIN staged_cycles c ON c.target_cycle_id = e.cycle_id
)
SELECT *
FROM checks
ORDER BY
  CASE status WHEN 'BLOCKER' THEN 1 WHEN 'REVIEW' THEN 2 WHEN 'OK' THEN 3 ELSE 4 END,
  check_name;

SELECT
  'expected_payroll_total' AS metric,
  '$517,510.00' AS value,
  'Validate in UI/API payroll preview for 2026-05-15 a 2026-05-28' AS note;
