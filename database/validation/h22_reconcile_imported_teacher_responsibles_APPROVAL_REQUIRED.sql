-- H22-HF1A - Validacion segura de responsables de docentes importados.
-- NO EJECUTAR SIN BACKUP CLOUD SQL Y APROBACION HUMANA.
--
-- Este artefacto conserva el mapping exacto obtenido de audit_log para la
-- ejecucion TEACHER_IMPORT_APPLIED identificada abajo. El diagnostico
-- productivo read-only comprobo que las 14 filas ya tienen created_by correcto,
-- por lo que este archivo NO contiene UPDATE, INSERT persistente ni COMMIT.
-- Su finalidad es detectar deriva antes de cualquier decision futura.

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'nomina_docente' THEN
    RAISE EXCEPTION 'H22-HF1A guard: base no autorizada: %', current_database();
  END IF;
END $$;

CREATE TEMP TABLE h22_expected_responsibles (
  teacher_id uuid PRIMARY KEY,
  expected_responsible_app_user_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO h22_expected_responsibles (
  teacher_id,
  expected_responsible_app_user_id
) VALUES
  ('0a2b82b2-fc94-4cf4-b3c4-0cd4619738cb', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('0e5e16bc-9d20-46ce-a379-51b23d619b09', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('13862401-cd39-447a-9baa-06d26b195067', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'),
  ('2367b5e8-af6c-4b9d-a2a1-92cf83ff97c0', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'),
  ('3ce6bf33-053b-483b-aa5b-fe389c2e836b', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'),
  ('4f023a30-3d82-4cd2-82eb-81b77e31416f', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'),
  ('63ec7156-5543-45a6-8b9d-bf142025e370', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('728f2686-f117-4728-8e73-71727076480a', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'),
  ('99419268-0f6d-4877-ad4c-cc4ecc97e01b', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('b82fe9d1-8b3f-4052-9e96-d837fbe435cd', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'),
  ('ba842df5-2c80-4789-b241-eec960c225bd', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('bcee79a6-57a4-4d41-bfdd-af7bb5f33284', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'),
  ('c4c8ceb7-b4b9-4e30-b8bb-f62b6416e59e', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('c9ebab3e-493d-4744-9d8d-f8e0d320a604', '5377a59d-8e09-4d56-b993-c1c7205ba8af');

DO $$
DECLARE
  mapping_count integer;
  import_count integer;
  invalid_count integer;
BEGIN
  SELECT count(*) INTO mapping_count FROM h22_expected_responsibles;
  IF mapping_count <> 14 THEN
    RAISE EXCEPTION 'H22-HF1A mapping incompleto: esperado 14, obtenido %', mapping_count;
  END IF;

  SELECT count(*) INTO import_count
  FROM audit_log
  WHERE id = '955ba4c3-9aa6-4622-880e-0d766b22f190'
    AND action = 'TEACHER_IMPORT_APPLIED'
    AND after_data ->> 'fileSha256' = '3113dbce07fd46fd077a4b280326e9bba878c340217ba1882ccdcd3929a1255a'
    AND (after_data ->> 'totalRows')::integer = 14
    AND (after_data ->> 'created')::integer = 14
    AND (after_data ->> 'updated')::integer = 0;
  IF import_count <> 1 THEN
    RAISE EXCEPTION 'H22-HF1A ejecucion importadora no coincide con la evidencia aprobada';
  END IF;

  SELECT count(*) INTO invalid_count
  FROM h22_expected_responsibles m
  LEFT JOIN teachers t ON t.id = m.teacher_id
  LEFT JOIN app_users u ON u.id = m.expected_responsible_app_user_id
  LEFT JOIN roles r ON r.id = u.role_id
  WHERE t.id IS NULL
     OR u.id IS NULL
     OR u.status <> 'ACTIVO'
     OR r.code NOT IN ('admin', 'coordinador', 'direccion');
  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'H22-HF1A mapping con docentes o responsables invalidos: %', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM h22_expected_responsibles m
  JOIN teachers t ON t.id = m.teacher_id
  WHERE t.created_by IS DISTINCT FROM m.expected_responsible_app_user_id;
  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'H22-HF1A deriva detectada en teachers.created_by: %', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM h22_expected_responsibles m
  WHERE NOT EXISTS (
    SELECT 1
    FROM audit_log a
    JOIN app_users expected
      ON lower(expected.email) = lower(a.after_data ->> 'responsibleEmail')
    WHERE a.action = 'TEACHER_CREATED'
      AND a.entity_id = m.teacher_id
      AND expected.id = m.expected_responsible_app_user_id
  );
  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'H22-HF1A mapping sin evidencia TEACHER_CREATED equivalente: %', invalid_count;
  END IF;
END $$;

SELECT
  count(*) AS mapped_teachers,
  count(*) FILTER (WHERE t.created_by IS NULL) AS created_by_null,
  count(*) FILTER (
    WHERE t.created_by = m.expected_responsible_app_user_id
  ) AS already_correct,
  count(*) FILTER (
    WHERE t.created_by IS DISTINCT FROM m.expected_responsible_app_user_id
  ) AS reconciliation_candidates
FROM h22_expected_responsibles m
JOIN teachers t ON t.id = m.teacher_id;

SELECT
  count(*) AS persistent_writes_planned,
  count(*) AS audit_rows_planned
FROM h22_expected_responsibles
WHERE false;

-- ROLLBACK obligatorio. El diagnostico H22-HF1A no autoriza DML productivo.
ROLLBACK;
