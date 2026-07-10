-- H19 - Actualizacion controlada de created_by y altas minimas de docentes.
-- NO EJECUTAR SIN BACKUP CLOUD SQL Y APROBACION HUMANA.
--
-- Alcance autorizado:
--   A) 36 docentes existentes: actualizar SOLO teachers.created_by.
--      - 29 candidatos H19 originales aprobados.
--      - 7 docentes encontrados por correo bajo otra variante de nombre.
--   B) 3 nuevas contrataciones confirmadas: insertar SOLO full_name,
--      normalized_name, external_identifier, status y created_by.
--
-- Este archivo versionado SIEMPRE termina en ROLLBACK. No contiene COMMIT
-- operativo. Para una ejecucion aprobada se debe usar una copia temporal y
-- cambiar unicamente el ROLLBACK final por COMMIT.

DO $$
BEGIN
  IF current_database() <> 'nomina_docente' THEN
    RAISE EXCEPTION 'H19 bloqueado: base actual %, se esperaba nomina_docente', current_database();
  END IF;
END $$;

BEGIN;

CREATE TEMP TABLE h19_existing_created_by_mapping (
  source_group text NOT NULL CHECK (source_group IN ('ORIGINAL_29', 'FOUND_EXISTING_10')),
  csv_line integer NOT NULL,
  teacher_id uuid NOT NULL,
  teacher_name text NOT NULL,
  responsable_csv text NOT NULL,
  expected_current_created_by uuid NULL,
  new_created_by uuid NOT NULL,
  new_created_by_email text NOT NULL,
  PRIMARY KEY (teacher_id)
) ON COMMIT DROP;

INSERT INTO h19_existing_created_by_mapping (
  source_group, csv_line, teacher_id, teacher_name, responsable_csv,
  expected_current_created_by, new_created_by, new_created_by_email
) VALUES
  ('ORIGINAL_29', 30, '525a34da-39d1-4c6a-8b7f-bbc8b07d9e96', 'OSCAR OLIVER NOH ABAN', 'Merit Berenice Bazan Garcia', '5377a59d-8e09-4d56-b993-c1c7205ba8af', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'merit.bazan@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 31, 'bcc6cd01-f32c-4e08-921b-f7d12cbb5c01', 'HECTOR LEONEL PEREZ RAMIREZ', 'Eslivet Aguilar Santos', '5377a59d-8e09-4d56-b993-c1c7205ba8af', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'eslivet.aguilar@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 33, '2108d981-58fb-4e87-94a2-ea96f0443747', 'JULIO CESAR HERNANDEZ BAILON', 'Eslivet Aguilar Santos', '5377a59d-8e09-4d56-b993-c1c7205ba8af', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'eslivet.aguilar@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 34, '4221043d-d1a0-4148-9c14-41441e6065f4', 'LEONARDO JAVIER PRECIADO HERRERA', 'Eslivet Aguilar Santos', '5377a59d-8e09-4d56-b993-c1c7205ba8af', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'eslivet.aguilar@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 36, '0cafbcd8-ab0b-433d-957a-96132c571600', 'OSCAR DAVID CATZIM PAT', 'Eslivet Aguilar Santos', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'eslivet.aguilar@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 37, '409e126d-c4d2-46d1-9fde-746def75e172', 'PEDRO CARLOS CITUK CAUICH', 'Eslivet Aguilar Santos', '5377a59d-8e09-4d56-b993-c1c7205ba8af', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'eslivet.aguilar@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 53, '701e27ac-7627-4cd3-887a-96c141a1f43c', 'ELBERTH ABEL FLOTA GARIBAY', 'Zulma Martinez Duque', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7', '5377a59d-8e09-4d56-b993-c1c7205ba8af', 'zulma.martinez@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 54, '52622334-9e1c-4c86-9790-6f5aa790de8a', 'ALMA ISABEL PEREZ DOMINGUEZ', 'Merit Berenice Bazan Garcia', '61744d7e-6f64-4bfe-82b0-d4c056aad239', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'merit.bazan@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 70, 'fb2ae413-1323-4f2c-a762-b6ef96cacc38', 'ALEJANDRA BERENICE HEDDING RODRIGUEZ', 'Merit Berenice Bazan Garcia', '5377a59d-8e09-4d56-b993-c1c7205ba8af', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'merit.bazan@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 71, '4b8a9a5d-5c22-4452-b136-a0c640bd710a', 'BEATRIZ PACHECO OJEDA', 'Merit Berenice Bazan Garcia', NULL, '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'merit.bazan@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 75, '0a6b732b-cadd-4da8-ad7d-c46cc4127a2b', 'ARMANDO CHAVARRIA MORALES', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 76, 'b8ace0e8-c6b5-4476-ac6e-ae869ea6d54e', 'DANIEL JESUS MEX KANTUN', 'Leonardo Sayas', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 78, 'eafaf2aa-8e95-4d8c-b11e-eaf70d3f400d', 'DANIELA AURORA PEREZ EDGAR', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 79, '1fb66a61-6027-4617-bbb8-5d6e51b9de4b', 'DANIELA GEORGINA MARQUEZ ALAMILLA', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 81, 'd904dc05-5b92-4c92-b130-b79a91e0e31a', 'HUMBERTO GARCIA LUNA BAEZA', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 82, '928b7da7-7149-49ea-a554-f1249fa3571a', 'ISRAEL JESREEL FAJARDO GONZALEZ', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 86, '7945b773-8e37-41d3-b70f-292fec3cbc3a', 'JOSE GABRIEL GONZALEZ CARDENAS', 'Leonardo Sayas', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 87, 'c96f989c-28f8-421e-acdb-d1543252b014', 'JOSE GONZALO POOL ROBLES', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 88, '4a0dd2b0-c15b-46c2-ae96-7da9046a25fc', 'JOSE LUIS MONTEMAYOR GONZALEZ', 'Leonardo Sayas', '5377a59d-8e09-4d56-b993-c1c7205ba8af', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 89, '21bcc1db-100e-4d30-9b91-2e88cdef6928', 'JOSUE BALLINAS BARRIOS', 'Leonardo Sayas', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 90, '21c077f2-fc1d-4d66-a671-0f7627835fdf', 'LEYDI JAQUELIN ALCOCER URBIETA', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 91, 'eebddcef-fc1c-4744-8ab2-a61aa85b0848', 'MELINA ABRIL DIAZ CARRILLO', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 92, 'afc1732c-208d-4790-a444-5b6c72fe8ef5', 'MIGUEL SANCHEZ RODRIGUEZ', 'Leonardo Sayas', '5377a59d-8e09-4d56-b993-c1c7205ba8af', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 93, '38f7dbe8-d7c3-478e-b2f7-d796fda3ed8b', 'RAUL INAKI CHAN AGUILAR', 'Leonardo Sayas', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 96, 'f8070581-4eed-45a1-bbd3-919801e2a4b7', 'ALBERTO MONTERO CEME', 'Oriana Nah Rosado', NULL, 'df3ad085-321c-45b5-9054-e6a036d70793', 'oriana.nah@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 104, '300ffabf-0913-4476-9fc2-4389f21cd3ce', 'DAISY MARGARITA MENDEZ TRIGUEROS', 'Oriana Nah Rosado', '051543e4-4058-42b0-83ad-7d2cd25e1dd5', 'df3ad085-321c-45b5-9054-e6a036d70793', 'oriana.nah@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 116, '9cc536e5-48c1-4398-8c43-68e836069975', 'MAYRA ISABEL GARCIA MARTIN', 'Oriana Nah Rosado', NULL, 'df3ad085-321c-45b5-9054-e6a036d70793', 'oriana.nah@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 136, 'b74ffef4-adfb-49bb-b422-bcfd6428c050', 'JUAN DOMINGUEZ CASAUX', 'Zulma Martinez Duque', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', '5377a59d-8e09-4d56-b993-c1c7205ba8af', 'zulma.martinez@tecplayacar.edu.mx'),
  ('ORIGINAL_29', 141, 'a4f8ce05-a5a3-4de8-a21f-8ee2840461b6', 'MARIA CLEMENTE MARTINEZ', 'Zulma Martinez Duque', '61744d7e-6f64-4bfe-82b0-d4c056aad239', '5377a59d-8e09-4d56-b993-c1c7205ba8af', 'zulma.martinez@tecplayacar.edu.mx'),
  ('FOUND_EXISTING_10', 74, '49c5c5b4-c49f-462e-b904-d1bbd207a1a4', 'PRADO HIGAREDA ANDREA', 'Leonardo Sayas', NULL, 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('FOUND_EXISTING_10', 77, 'b8ec1975-5da6-429a-a0c7-1adf6e25e8f9', 'DANIEL PEREZ SAAVEDRA', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('FOUND_EXISTING_10', 83, '742ce060-f325-43b6-815a-4de1c8500005', 'ARANTXA JEANNIE BURGOS MAGAÑA', 'Leonardo Sayas', NULL, 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('FOUND_EXISTING_10', 84, 'ae3d917c-4c2d-499c-b27b-5a1d325e667a', 'JORGE ALBERTO GUTIERREZ TRUEBA', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('FOUND_EXISTING_10', 85, '1bd3e2f7-a5a2-499a-97c6-60f8b74b68ee', 'JOSE BENJAMIN LUEVANO GONZALEZ', 'Leonardo Sayas', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('FOUND_EXISTING_10', 94, '80f219e9-f899-4476-8dd2-9aef1dafaf68', 'SHANTAL PATRICIA JASSO RODRIGUEZ', 'Leonardo Sayas', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx'),
  ('FOUND_EXISTING_10', 95, 'b2e84d8b-e512-4e54-a960-f58be7f398f1', 'VÍCTOR MANUEL GONZÁLEZ CÁRDENAS', 'Leonardo Sayas', '61744d7e-6f64-4bfe-82b0-d4c056aad239', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx');

CREATE TEMP TABLE h19_new_hires (
  csv_line integer PRIMARY KEY,
  full_name text NOT NULL,
  normalized_name text NOT NULL,
  external_identifier text NOT NULL,
  source_email_sha256 text NOT NULL,
  status teacher_status NOT NULL,
  created_by uuid NOT NULL,
  created_by_email text NOT NULL
) ON COMMIT DROP;

INSERT INTO h19_new_hires (
  csv_line, full_name, normalized_name, external_identifier,
  source_email_sha256, status, created_by, created_by_email
) VALUES
  (55, 'BEATRIZ ADRIANA LOPEZ OSORIO', 'BEATRIZ ADRIANA LOPEZ OSORIO', 'tup-d1719', 'f78bad48b78a962189e1b67d49c3d3074ab7399b2bc0895350eeb5de722940c3', 'ACTIVO', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e', 'merit.bazan@tecplayacar.edu.mx'),
  (73, 'LUZ ENEIDA GORDON PALACIOS', 'LUZ ENEIDA GORDON PALACIOS', 'tup-d1546', '5d18928f70bd391c1b3529c0ecd7cb48bf2f3f99432b337c3e5a16d829abb3f0', 'ACTIVO', 'df3ad085-321c-45b5-9054-e6a036d70793', 'oriana.nah@tecplayacar.edu.mx'),
  (80, 'FELIPE UC KUYOC', 'FELIPE UC KUYOC', 'tup-d1026', 'cceda795403fdec9e251182c4d740626a760aada87be65442598e556829b3ac6', 'ACTIVO', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa', 'brian.sayas@tecplayacar.edu.mx');

\echo 'H19 preview: conteos previstos'
SELECT source_group, count(*) AS existing_updates
FROM h19_existing_created_by_mapping
GROUP BY source_group
ORDER BY source_group;
SELECT count(*) AS new_hires FROM h19_new_hires;

DO $$
DECLARE
  original_count integer;
  found_count integer;
  new_count integer;
  owner_mismatch integer;
  target_user_mismatch integer;
  new_duplicate_count integer;
BEGIN
  SELECT count(*) FILTER (WHERE source_group = 'ORIGINAL_29'),
         count(*) FILTER (WHERE source_group = 'FOUND_EXISTING_10')
  INTO original_count, found_count
  FROM h19_existing_created_by_mapping;

  SELECT count(*) INTO new_count FROM h19_new_hires;

  IF original_count <> 29 OR found_count <> 7 OR new_count <> 3 THEN
    RAISE EXCEPTION 'H19 conteos inesperados: original %, existentes adicionales %, nuevos %',
      original_count, found_count, new_count;
  END IF;

  SELECT count(*) INTO owner_mismatch
  FROM h19_existing_created_by_mapping m
  LEFT JOIN teachers t ON t.id = m.teacher_id
  WHERE t.id IS NULL
     OR t.created_by IS DISTINCT FROM m.expected_current_created_by
     OR t.created_by IS NOT DISTINCT FROM m.new_created_by;

  IF owner_mismatch <> 0 THEN
    RAISE EXCEPTION 'H19 bloqueado: % docentes no coinciden con estado esperado', owner_mismatch;
  END IF;

  SELECT count(*) INTO target_user_mismatch
  FROM (
    SELECT new_created_by AS id, new_created_by_email AS email
    FROM h19_existing_created_by_mapping
    UNION
    SELECT created_by, created_by_email FROM h19_new_hires
  ) target
  LEFT JOIN app_users u ON u.id = target.id
  WHERE u.id IS NULL OR lower(u.email) <> lower(target.email) OR u.status <> 'ACTIVO';

  IF target_user_mismatch <> 0 THEN
    RAISE EXCEPTION 'H19 bloqueado: % responsables destino no coinciden o no estan activos', target_user_mismatch;
  END IF;

  SELECT count(*) INTO new_duplicate_count
  FROM h19_new_hires n
  WHERE EXISTS (
          SELECT 1 FROM teachers t
          WHERE lower(trim(t.external_identifier)) = lower(trim(n.external_identifier))
        )
     OR EXISTS (
          SELECT 1 FROM teachers t
          WHERE t.normalized_name = n.normalized_name
        )
     OR EXISTS (
          SELECT 1 FROM teachers t
          WHERE trim(t.email) <> ''
            AND encode(digest(lower(trim(t.email)), 'sha256'), 'hex') = n.source_email_sha256
        );

  IF new_duplicate_count <> 0 THEN
    RAISE EXCEPTION 'H19 bloqueado: % nuevas contrataciones ya tienen identificador, nombre o correo existente', new_duplicate_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM h19_new_hires
    GROUP BY lower(trim(external_identifier)) HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM h19_new_hires
    GROUP BY normalized_name HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM h19_new_hires
    GROUP BY source_email_sha256 HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'H19 bloqueado: duplicados internos en staging de nuevas contrataciones';
  END IF;
END $$;

CREATE TEMP TABLE h19_updated_teachers (id uuid PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE h19_inserted_teachers (id uuid PRIMARY KEY) ON COMMIT DROP;

WITH updated AS (
  UPDATE teachers t
  SET created_by = m.new_created_by
  FROM h19_existing_created_by_mapping m
  WHERE t.id = m.teacher_id
    AND t.created_by IS NOT DISTINCT FROM m.expected_current_created_by
    AND t.created_by IS DISTINCT FROM m.new_created_by
  RETURNING t.id
)
INSERT INTO h19_updated_teachers (id)
SELECT id FROM updated;

WITH inserted AS (
  INSERT INTO teachers (
    full_name,
    normalized_name,
    external_identifier,
    status,
    created_by
  )
  SELECT
    n.full_name,
    n.normalized_name,
    n.external_identifier,
    n.status,
    n.created_by
  FROM h19_new_hires n
  WHERE NOT EXISTS (
          SELECT 1 FROM teachers t
          WHERE lower(trim(t.external_identifier)) = lower(trim(n.external_identifier))
        )
    AND NOT EXISTS (
          SELECT 1 FROM teachers t
          WHERE t.normalized_name = n.normalized_name
        )
    AND NOT EXISTS (
          SELECT 1 FROM teachers t
          WHERE trim(t.email) <> ''
            AND encode(digest(lower(trim(t.email)), 'sha256'), 'hex') = n.source_email_sha256
        )
  RETURNING id
)
INSERT INTO h19_inserted_teachers (id)
SELECT id FROM inserted;

DO $$
DECLARE
  updated_count integer;
  inserted_count integer;
  post_mismatch integer;
BEGIN
  SELECT count(*) INTO updated_count FROM h19_updated_teachers;
  SELECT count(*) INTO inserted_count FROM h19_inserted_teachers;

  IF updated_count <> 36 OR inserted_count <> 3 THEN
    RAISE EXCEPTION 'H19 resultado inesperado: UPDATE %, INSERT %', updated_count, inserted_count;
  END IF;

  SELECT count(*) INTO post_mismatch
  FROM h19_existing_created_by_mapping m
  JOIN teachers t ON t.id = m.teacher_id
  WHERE t.created_by IS DISTINCT FROM m.new_created_by;

  IF post_mismatch <> 0 THEN
    RAISE EXCEPTION 'H19 validacion posterior fallo en % docentes existentes', post_mismatch;
  END IF;

  IF EXISTS (
    SELECT normalized_name FROM teachers
    GROUP BY normalized_name HAVING count(*) > 1
  ) OR EXISTS (
    SELECT lower(trim(external_identifier))
    FROM teachers
    WHERE trim(external_identifier) <> ''
    GROUP BY lower(trim(external_identifier)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'H19 validacion posterior detecto duplicados';
  END IF;
END $$;

\echo 'H19 preview: resultado dentro de la transaccion'
SELECT (SELECT count(*) FROM h19_updated_teachers) AS updated_rows,
       (SELECT count(*) FROM h19_inserted_teachers) AS inserted_rows;

\echo 'H19 preview: distribucion de actualizaciones por responsable destino'
SELECT new_created_by_email, source_group, count(*) AS rows
FROM h19_existing_created_by_mapping
GROUP BY new_created_by_email, source_group
ORDER BY new_created_by_email, source_group;

\echo 'H19 preview: distribucion de nuevas contrataciones por responsable destino'
SELECT created_by_email, count(*) AS rows
FROM h19_new_hires
GROUP BY created_by_email
ORDER BY created_by_email;

-- ROLLBACK obligatorio del archivo versionado.
ROLLBACK;
