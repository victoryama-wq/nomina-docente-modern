-- Valida staging antes de aplicar migracion.
-- No modifica datos productivos.

DO $$
BEGIN
  IF current_database() NOT IN ('nomina_docente', 'nomina_docente_h02h03_data_dryrun') THEN
    RAISE EXCEPTION 'Base incorrecta: %, esperado nomina_docente o nomina_docente_h02h03_data_dryrun', current_database();
  END IF;
END $$;

WITH checks AS (
  SELECT 'staging teachers' AS check_name, count(*)::text AS value, CASE WHEN count(*) >= 216 THEN 'OK' ELSE 'REVIEW' END AS status
  FROM h02h03_may2026_staging.teachers
  UNION ALL SELECT 'staging schedules', count(*)::text, CASE WHEN count(*) = 589 THEN 'OK' ELSE 'REVIEW' END
  FROM h02h03_may2026_staging.schedules
  UNION ALL SELECT 'staging incidences', count(*)::text, CASE WHEN count(*) = 18 THEN 'OK' ELSE 'REVIEW' END
  FROM h02h03_may2026_staging.schedule_incidences
  UNION ALL SELECT 'staging extras', count(*)::text, CASE WHEN count(*) = 65 THEN 'OK' ELSE 'REVIEW' END
  FROM h02h03_may2026_staging.extra_hours
  UNION ALL SELECT 'staging user_coordinations', count(*)::text, CASE WHEN count(*) = 15 THEN 'OK' ELSE 'REVIEW' END
  FROM h02h03_may2026_staging.user_coordinations
  UNION ALL SELECT 'reserved coordinations', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM h02h03_may2026_staging.coordinations
  WHERE name IN ('Todas / Global', 'No requiere coordinacion operativa')
  UNION ALL SELECT 'duplicate staging teacher normalized_name', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM (
    SELECT normalized_name
    FROM h02h03_may2026_staging.teachers
    GROUP BY normalized_name
    HAVING count(*) > 1
  ) dup
  UNION ALL SELECT 'teacher id conflicts with different normalized_name', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM h02h03_may2026_staging.teachers st
  JOIN public.teachers t ON t.id = st.id
  WHERE t.normalized_name <> st.normalized_name
  UNION ALL SELECT 'teacher normalized_name conflicts with different id', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM h02h03_may2026_staging.teachers st
  JOIN public.teachers t ON t.normalized_name = st.normalized_name
  WHERE t.id <> st.id
  UNION ALL SELECT 'schedules without staging teacher', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM h02h03_may2026_staging.schedules s
  LEFT JOIN h02h03_may2026_staging.teachers t ON t.id = s.teacher_id
  WHERE t.id IS NULL
  UNION ALL SELECT 'schedules without staging coordination', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM h02h03_may2026_staging.schedules s
  LEFT JOIN h02h03_may2026_staging.coordinations c ON c.id = s.coordination_id
  WHERE c.id IS NULL
  UNION ALL SELECT 'schedules without created_by mapping', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM h02h03_may2026_staging.schedules s
  LEFT JOIN h02h03_may2026_staging.app_users su ON su.id = s.created_by
  LEFT JOIN public.app_users tu ON tu.email = su.email
  WHERE s.created_by IS NOT NULL AND tu.id IS NULL
  UNION ALL SELECT 'teachers without created_by mapping', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM h02h03_may2026_staging.teachers t
  LEFT JOIN h02h03_may2026_staging.app_users su ON su.id = t.created_by
  LEFT JOIN public.app_users tu ON tu.email = su.email
  WHERE t.created_by IS NOT NULL AND tu.id IS NULL
  UNION ALL SELECT 'extras without captured_by mapping', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM h02h03_may2026_staging.extra_hours e
  LEFT JOIN h02h03_may2026_staging.app_users su ON su.id = e.captured_by
  LEFT JOIN public.app_users tu ON tu.email = su.email
  WHERE e.captured_by IS NOT NULL AND tu.id IS NULL
  UNION ALL SELECT 'duplicate target calendar configs for staged periods', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
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
  UNION ALL SELECT 'incidences without staging schedule', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM h02h03_may2026_staging.schedule_incidences si
  LEFT JOIN h02h03_may2026_staging.schedules s ON s.id = si.schedule_id
  WHERE s.id IS NULL
  UNION ALL SELECT 'user_coordinations without user email mapping', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM h02h03_may2026_staging.user_coordinations uc
  LEFT JOIN h02h03_may2026_staging.app_users su ON su.id = uc.user_id
  LEFT JOIN public.app_users tu ON tu.email = su.email
  WHERE tu.id IS NULL
  UNION ALL SELECT 'user_coordinations without coordination name mapping', count(*)::text, CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOCKER' END
  FROM h02h03_may2026_staging.user_coordinations uc
  LEFT JOIN h02h03_may2026_staging.coordinations sc ON sc.id = uc.coordination_id
  WHERE sc.id IS NULL
  UNION ALL SELECT 'total absences in staging', COALESCE(sum(absences), 0)::text, CASE WHEN COALESCE(sum(absences), 0) = 30 THEN 'OK' ELSE 'REVIEW' END
  FROM h02h03_may2026_staging.schedule_incidences
  UNION ALL SELECT 'total delays in staging', COALESCE(sum(delays), 0)::text, CASE WHEN COALESCE(sum(delays), 0) = 0 THEN 'OK' ELSE 'REVIEW' END
  FROM h02h03_may2026_staging.schedule_incidences
  UNION ALL SELECT 'total extra hours in staging', COALESCE(sum(hours), 0)::text, CASE WHEN COALESCE(sum(hours), 0) = 1025 THEN 'OK' ELSE 'REVIEW' END
  FROM h02h03_may2026_staging.extra_hours
  UNION ALL SELECT 'total extra amount in staging', COALESCE(sum(hours * tabulator_amount), 0)::text, CASE WHEN COALESCE(sum(hours * tabulator_amount), 0) = 128310 THEN 'OK' ELSE 'REVIEW' END
  FROM h02h03_may2026_staging.extra_hours
)
SELECT *
FROM checks
ORDER BY
  CASE status WHEN 'BLOCKER' THEN 1 WHEN 'REVIEW' THEN 2 ELSE 3 END,
  check_name;
