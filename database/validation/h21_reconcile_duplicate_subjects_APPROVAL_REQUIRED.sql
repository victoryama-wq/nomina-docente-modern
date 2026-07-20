-- H21 - Conciliacion de cinco pares de asignaturas duplicadas legacy.
-- NO EJECUTAR EN PRODUCCION SIN BACKUP CLOUD SQL, APROBACION HUMANA Y VENTANA H05/H13.
-- El archivo versionado termina en ROLLBACK. No modifica snapshots, Nomina ni importes.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF current_database() <> 'nomina_docente' THEN
    RAISE EXCEPTION 'H21 guard: base incorrecta %, se esperaba nomina_docente', current_database();
  END IF;
END $$;

CREATE TEMP TABLE h21_subject_reconciliation_map (
  group_number integer PRIMARY KEY,
  duplicate_subject_id uuid NOT NULL UNIQUE,
  canonical_subject_id uuid NOT NULL UNIQUE,
  canonical_name text NOT NULL,
  expected_duplicate_name text NOT NULL,
  expected_duplicate_status text NOT NULL,
  expected_canonical_status text NOT NULL,
  expected_schedule_count integer NOT NULL CHECK (expected_schedule_count > 0),
  CHECK (duplicate_subject_id <> canonical_subject_id)
) ON COMMIT DROP;

INSERT INTO h21_subject_reconciliation_map (
  group_number,
  duplicate_subject_id,
  canonical_subject_id,
  canonical_name,
  expected_duplicate_name,
  expected_duplicate_status,
  expected_canonical_status,
  expected_schedule_count
) VALUES
  (1, 'dc73b77d-ff7d-4ff2-a122-f9593b401220', 'adac657f-5ebd-41f7-b925-a442fee2c9ef', 'DERECHOS HUMANOS Y GARANTÍAS', 'DERECHOS HUMANOS Y GARANTIAS', 'ACTIVO', 'ACTIVO', 1),
  (2, '984f875a-4739-4ded-870f-cd73ed2a939d', '1aca811f-b8d6-45e1-b0df-f65687711824', 'ENFERMERÍA COMUNITARIA I', 'ENFERMERIA COMUNITARIA I', 'ACTIVO', 'ACTIVO', 1),
  (3, '66102312-ae9b-4fd1-bc8e-eb55aae814b2', '670cc3e4-a4bb-420e-a4b5-706951450da6', 'ESTUDIO DE MERCADO E INVERSIÓN', 'ESTUDIO DE MERCADO E INVERSION', 'ACTIVO', 'INACTIVO', 1),
  (4, '8517e7b4-de56-4314-8ede-748b5f0827d8', '51d2e1cb-634e-4c88-ade3-08bd1f91bd5e', 'EVALUACIÓN DEL DESEMPEÑO LABORAL', 'EVALUACION DEL DESEMPEÑO LABORAL', 'ACTIVO', 'ACTIVO', 1),
  (5, 'e16b3ec3-8e55-40b2-956a-1827e6f3b00e', '968b2a44-f431-4f8e-946d-de0472c094c9', 'PLANEACIÓN Y CONTROL DE PRESUPUESTOS', 'PLANEACION Y CONTROL DE PRESUPUESTOS', 'ACTIVO', 'ACTIVO', 4);

DO $$
DECLARE
  actual_count integer;
BEGIN
  SELECT count(*) INTO actual_count FROM h21_subject_reconciliation_map;
  IF actual_count <> 5 THEN
    RAISE EXCEPTION 'H21 mapping incompleto: % grupos, se esperaban 5', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM subjects s
  JOIN (
    SELECT duplicate_subject_id AS id FROM h21_subject_reconciliation_map
    UNION ALL
    SELECT canonical_subject_id FROM h21_subject_reconciliation_map
  ) expected ON expected.id = s.id;
  IF actual_count <> 10 THEN
    RAISE EXCEPTION 'H21 subjects: % UUID encontrados, se esperaban 10', actual_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM h21_subject_reconciliation_map m
    JOIN subjects duplicate_subject ON duplicate_subject.id = m.duplicate_subject_id
    JOIN subjects canonical_subject ON canonical_subject.id = m.canonical_subject_id
    WHERE duplicate_subject.name <> m.expected_duplicate_name
       OR duplicate_subject.status::text <> m.expected_duplicate_status
       OR canonical_subject.name <> m.canonical_name
       OR canonical_subject.status::text <> m.expected_canonical_status
  ) THEN
    RAISE EXCEPTION 'H21 subjects: nombre o estatus difiere del mapping aprobado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM h21_subject_reconciliation_map m
    LEFT JOIN schedules s ON s.subject_id = m.duplicate_subject_id
    GROUP BY m.group_number, m.expected_schedule_count
    HAVING count(s.id) <> m.expected_schedule_count
  ) THEN
    RAISE EXCEPTION 'H21 schedules: conteo por grupo diferente al esperado';
  END IF;

  SELECT count(*) INTO actual_count
  FROM schedules s
  JOIN h21_subject_reconciliation_map m ON m.duplicate_subject_id = s.subject_id;
  IF actual_count <> 8 THEN
    RAISE EXCEPTION 'H21 schedules: % horarios a reasignar, se esperaban 8', actual_count;
  END IF;
END $$;

SELECT s.id
FROM subjects s
JOIN (
  SELECT duplicate_subject_id AS id FROM h21_subject_reconciliation_map
  UNION ALL
  SELECT canonical_subject_id FROM h21_subject_reconciliation_map
) target ON target.id = s.id
ORDER BY s.id
FOR UPDATE OF s;

SELECT s.id
FROM schedules s
JOIN h21_subject_reconciliation_map m ON m.duplicate_subject_id = s.subject_id
ORDER BY s.id
FOR UPDATE OF s;

CREATE TEMP TABLE h21_subject_state_before ON COMMIT DROP AS
SELECT s.id, s.name, s.status::text AS status
FROM subjects s
JOIN (
  SELECT duplicate_subject_id AS id FROM h21_subject_reconciliation_map
  UNION ALL
  SELECT canonical_subject_id FROM h21_subject_reconciliation_map
) target ON target.id = s.id;

CREATE TEMP TABLE h21_schedule_state_before ON COMMIT DROP AS
SELECT
  s.id,
  s.subject_id,
  s.subject_name,
  to_jsonb(s) - 'subject_id' - 'subject_name' AS invariant_data
FROM schedules s
JOIN h21_subject_reconciliation_map m ON m.duplicate_subject_id = s.subject_id;

CREATE TEMP TABLE h21_integrity_before (
  metric text PRIMARY KEY,
  value text NOT NULL
) ON COMMIT DROP;

INSERT INTO h21_integrity_before (metric, value) VALUES
  ('subjects_count', (SELECT count(*)::text FROM subjects)),
  ('schedules_count', (SELECT count(*)::text FROM schedules)),
  ('orphan_schedules', (SELECT count(*)::text FROM schedules s LEFT JOIN subjects sub ON sub.id = s.subject_id WHERE sub.id IS NULL)),
  ('schedule_snapshots_count', (SELECT count(*)::text FROM payroll_schedule_details)),
  ('schedule_snapshots_fingerprint', (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM payroll_schedule_details row_data)),
  ('extra_snapshots_count', (SELECT count(*)::text FROM payroll_extra_details)),
  ('extra_snapshots_fingerprint', (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM payroll_extra_details row_data)),
  ('payroll_runs_count', (SELECT count(*)::text FROM payroll_runs)),
  ('payroll_runs_fingerprint', (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM payroll_runs row_data));

DO $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE schedules s
  SET subject_id = m.canonical_subject_id,
      subject_name = m.canonical_name
  FROM h21_subject_reconciliation_map m
  WHERE s.subject_id = m.duplicate_subject_id;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 8 THEN
    RAISE EXCEPTION 'H21 update schedules: % filas, se esperaban 8', affected_count;
  END IF;

  UPDATE subjects canonical_subject
  SET status = 'ACTIVO'
  FROM h21_subject_reconciliation_map m
  WHERE canonical_subject.id = m.canonical_subject_id
    AND canonical_subject.status::text = m.expected_canonical_status
    AND canonical_subject.status <> 'ACTIVO';

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 1 THEN
    RAISE EXCEPTION 'H21 activacion canonica: % filas, se esperaba 1', affected_count;
  END IF;

  UPDATE subjects duplicate_subject
  SET status = 'INACTIVO'
  FROM h21_subject_reconciliation_map m
  WHERE duplicate_subject.id = m.duplicate_subject_id
    AND duplicate_subject.status::text = m.expected_duplicate_status
    AND duplicate_subject.status <> 'INACTIVO';

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 5 THEN
    RAISE EXCEPTION 'H21 inactivacion duplicados: % filas, se esperaban 5', affected_count;
  END IF;
END $$;

CREATE TEMP TABLE h21_integrity_after ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('subjects_count', (SELECT count(*)::text FROM subjects)),
  ('schedules_count', (SELECT count(*)::text FROM schedules)),
  ('orphan_schedules', (SELECT count(*)::text FROM schedules s LEFT JOIN subjects sub ON sub.id = s.subject_id WHERE sub.id IS NULL)),
  ('schedule_snapshots_count', (SELECT count(*)::text FROM payroll_schedule_details)),
  ('schedule_snapshots_fingerprint', (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM payroll_schedule_details row_data)),
  ('extra_snapshots_count', (SELECT count(*)::text FROM payroll_extra_details)),
  ('extra_snapshots_fingerprint', (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM payroll_extra_details row_data)),
  ('payroll_runs_count', (SELECT count(*)::text FROM payroll_runs)),
  ('payroll_runs_fingerprint', (SELECT md5(coalesce(string_agg(to_jsonb(row_data)::text, E'\n' ORDER BY row_data.id), '')) FROM payroll_runs row_data))
) AS metrics(metric, value);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM h21_integrity_before before_state
    FULL JOIN h21_integrity_after after_state USING (metric)
    WHERE before_state.value IS DISTINCT FROM after_state.value
  ) THEN
    RAISE EXCEPTION 'H21 integridad: cambiaron conteos o fingerprints protegidos';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM h21_schedule_state_before before_state
    LEFT JOIN schedules current_state ON current_state.id = before_state.id
    WHERE current_state.id IS NULL
       OR (to_jsonb(current_state) - 'subject_id' - 'subject_name') IS DISTINCT FROM before_state.invariant_data
  ) THEN
    RAISE EXCEPTION 'H21 integridad: cambio una columna de horario fuera de subject_id/subject_name';
  END IF;

  IF (SELECT count(*) FROM h21_schedule_state_before) <> 8 THEN
    RAISE EXCEPTION 'H21 integridad: no se conservaron los ocho IDs de horario';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM h21_schedule_state_before before_state
    JOIN schedules current_state ON current_state.id = before_state.id
    JOIN h21_subject_reconciliation_map m ON m.duplicate_subject_id = before_state.subject_id
    WHERE current_state.subject_id <> m.canonical_subject_id
       OR current_state.subject_name <> m.canonical_name
  ) THEN
    RAISE EXCEPTION 'H21 integridad: destino canonico incorrecto';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM schedules s
    JOIN h21_subject_reconciliation_map m ON m.duplicate_subject_id = s.subject_id
  ) THEN
    RAISE EXCEPTION 'H21 integridad: quedan horarios ligados a UUID duplicado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM h21_subject_reconciliation_map m
    JOIN subjects canonical_subject ON canonical_subject.id = m.canonical_subject_id
    JOIN subjects duplicate_subject ON duplicate_subject.id = m.duplicate_subject_id
    WHERE canonical_subject.status <> 'ACTIVO'
       OR canonical_subject.name <> m.canonical_name
       OR duplicate_subject.status <> 'INACTIVO'
  ) THEN
    RAISE EXCEPTION 'H21 integridad: estatus final de canonicos/duplicados incorrecto';
  END IF;
END $$;

INSERT INTO audit_log (
  actor_user_id,
  actor_email,
  action,
  entity_type,
  entity_id,
  before_data,
  after_data,
  metadata
)
SELECT
  NULL,
  current_user,
  'SUBJECT_RECONCILIATION_CANONICAL',
  'subject',
  m.canonical_subject_id,
  to_jsonb(before_state),
  jsonb_build_object('id', canonical_subject.id, 'name', canonical_subject.name, 'status', canonical_subject.status),
  jsonb_build_object('duplicateSubjectId', m.duplicate_subject_id, 'movedSchedules', m.expected_schedule_count)
FROM h21_subject_reconciliation_map m
JOIN h21_subject_state_before before_state ON before_state.id = m.canonical_subject_id
JOIN subjects canonical_subject ON canonical_subject.id = m.canonical_subject_id;

INSERT INTO audit_log (
  actor_user_id,
  actor_email,
  action,
  entity_type,
  entity_id,
  before_data,
  after_data,
  metadata
)
SELECT
  NULL,
  current_user,
  'SUBJECT_RECONCILIATION_DUPLICATE',
  'subject',
  m.duplicate_subject_id,
  to_jsonb(before_state),
  jsonb_build_object('id', duplicate_subject.id, 'name', duplicate_subject.name, 'status', duplicate_subject.status),
  jsonb_build_object('canonicalSubjectId', m.canonical_subject_id, 'movedSchedules', m.expected_schedule_count)
FROM h21_subject_reconciliation_map m
JOIN h21_subject_state_before before_state ON before_state.id = m.duplicate_subject_id
JOIN subjects duplicate_subject ON duplicate_subject.id = m.duplicate_subject_id;

INSERT INTO audit_log (
  actor_user_id,
  actor_email,
  action,
  entity_type,
  entity_id,
  before_data,
  after_data,
  metadata
) VALUES (
  NULL,
  current_user,
  'SUBJECT_DUPLICATES_RECONCILED',
  'subject_reconciliation',
  NULL,
  NULL,
  NULL,
  jsonb_build_object('groups', 5, 'movedSchedules', 8, 'deletedSubjects', 0)
);

SELECT
  m.group_number,
  m.duplicate_subject_id,
  duplicate_subject.status AS duplicate_status,
  m.canonical_subject_id,
  canonical_subject.name AS canonical_name,
  canonical_subject.status AS canonical_status,
  count(s.id)::int AS schedules_on_canonical
FROM h21_subject_reconciliation_map m
JOIN subjects duplicate_subject ON duplicate_subject.id = m.duplicate_subject_id
JOIN subjects canonical_subject ON canonical_subject.id = m.canonical_subject_id
LEFT JOIN schedules s ON s.subject_id = m.canonical_subject_id
GROUP BY m.group_number, m.duplicate_subject_id, duplicate_subject.status,
  m.canonical_subject_id, canonical_subject.name, canonical_subject.status
ORDER BY m.group_number;

SELECT metric, value FROM h21_integrity_before ORDER BY metric;

-- Mantener ROLLBACK en el archivo versionado. Una ejecucion aprobada debe usar
-- una copia temporal revisada y cambiar exclusivamente esta ultima sentencia.
ROLLBACK;
