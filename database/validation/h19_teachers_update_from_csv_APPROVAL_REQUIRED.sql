-- H19 - Propuesta regenerada de actualizacion teachers.created_by desde docentes.csv
-- Fecha de regeneracion: 2026-07-09
-- NO EJECUTAR SIN BACKUP CLOUD SQL Y APROBACION HUMANA EXPLICITA.
-- Generado en modo seguro: ROLLBACK por defecto, sin COMMIT operativo.
-- Alcance: solo teachers.created_by para docentes con match unico y responsable resuelto.
-- El SQL anterior de H19 queda reemplazado por esta regeneracion contra el CSV actualizado.
-- Prohibido: payment_type/tipo_pago, email fiscal, RFC, banco, cuenta, CLABE, constancias, nomina y snapshots.

\echo 'H19 preview: validar base exacta nomina_docente'
DO $$
BEGIN
  IF current_database() <> 'nomina_docente' THEN
    RAISE EXCEPTION 'Base incorrecta: %, esperado nomina_docente', current_database();
  END IF;
END $$;

BEGIN;

CREATE TEMP TABLE h19_teacher_created_by_mapping (
  csv_line integer NOT NULL,
  teacher_id uuid NOT NULL,
  teacher_name text NOT NULL,
  responsable_csv text NOT NULL,
  expected_current_created_by uuid NULL,
  expected_current_created_by_email text NOT NULL DEFAULT '',
  new_created_by uuid NOT NULL,
  new_created_by_email text NOT NULL,
  action text NOT NULL CHECK (action IN ('UPDATE_CANDIDATO_CREATED_BY_NULL', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'))
) ON COMMIT DROP;

INSERT INTO h19_teacher_created_by_mapping (
  csv_line,
  teacher_id,
  teacher_name,
  responsable_csv,
  expected_current_created_by,
  expected_current_created_by_email,
  new_created_by,
  new_created_by_email,
  action
) VALUES
  (30, '525a34da-39d1-4c6a-8b7f-bbc8b07d9e96'::uuid, 'OSCAR OLIVER NOH ABAN', 'Merit Berenice Bazan Garcia', '5377a59d-8e09-4d56-b993-c1c7205ba8af'::uuid, 'zulma.martinez@tecplayacar.edu.mx', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (31, 'bcc6cd01-f32c-4e08-921b-f7d12cbb5c01'::uuid, 'HECTOR LEONEL PEREZ RAMIREZ', 'Eslivet Aguilar Santos', '5377a59d-8e09-4d56-b993-c1c7205ba8af'::uuid, 'zulma.martinez@tecplayacar.edu.mx', '61744d7e-6f64-4bfe-82b0-d4c056aad239'::uuid, 'eslivet.aguilar@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (33, '2108d981-58fb-4e87-94a2-ea96f0443747'::uuid, 'JULIO CESAR HERNANDEZ BAILON', 'Eslivet Aguilar Santos', '5377a59d-8e09-4d56-b993-c1c7205ba8af'::uuid, 'zulma.martinez@tecplayacar.edu.mx', '61744d7e-6f64-4bfe-82b0-d4c056aad239'::uuid, 'eslivet.aguilar@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (34, '4221043d-d1a0-4148-9c14-41441e6065f4'::uuid, 'LEONARDO JAVIER PRECIADO HERRERA', 'Eslivet Aguilar Santos', '5377a59d-8e09-4d56-b993-c1c7205ba8af'::uuid, 'zulma.martinez@tecplayacar.edu.mx', '61744d7e-6f64-4bfe-82b0-d4c056aad239'::uuid, 'eslivet.aguilar@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (36, '0cafbcd8-ab0b-433d-957a-96132c571600'::uuid, 'OSCAR DAVID CATZIM PAT', 'Eslivet Aguilar Santos', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'::uuid, 'elsa.garcia@tecplayacar.edu.mx', '61744d7e-6f64-4bfe-82b0-d4c056aad239'::uuid, 'eslivet.aguilar@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (37, '409e126d-c4d2-46d1-9fde-746def75e172'::uuid, 'PEDRO CARLOS CITUK CAUICH', 'Eslivet Aguilar Santos', '5377a59d-8e09-4d56-b993-c1c7205ba8af'::uuid, 'zulma.martinez@tecplayacar.edu.mx', '61744d7e-6f64-4bfe-82b0-d4c056aad239'::uuid, 'eslivet.aguilar@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (53, '701e27ac-7627-4cd3-887a-96c141a1f43c'::uuid, 'ELBERTH ABEL FLOTA GARIBAY', 'Zulma Martinez Duque', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'::uuid, 'elsa.garcia@tecplayacar.edu.mx', '5377a59d-8e09-4d56-b993-c1c7205ba8af'::uuid, 'zulma.martinez@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (54, '52622334-9e1c-4c86-9790-6f5aa790de8a'::uuid, 'ALMA ISABEL PEREZ DOMINGUEZ', 'Merit Berenice Bazan Garcia', '61744d7e-6f64-4bfe-82b0-d4c056aad239'::uuid, 'eslivet.aguilar@tecplayacar.edu.mx', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (70, 'fb2ae413-1323-4f2c-a762-b6ef96cacc38'::uuid, 'ALEJANDRA BERENICE HEDDING RODRIGUEZ', 'Merit Berenice Bazan Garcia', '5377a59d-8e09-4d56-b993-c1c7205ba8af'::uuid, 'zulma.martinez@tecplayacar.edu.mx', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (71, '4b8a9a5d-5c22-4452-b136-a0c640bd710a'::uuid, 'BEATRIZ PACHECO OJEDA', 'Merit Berenice Bazan Garcia', NULL::uuid, '', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_NULL'),
  (75, '0a6b732b-cadd-4da8-ad7d-c46cc4127a2b'::uuid, 'ARMANDO CHAVARRIA MORALES', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (76, 'b8ace0e8-c6b5-4476-ac6e-ae869ea6d54e'::uuid, 'DANIEL JESUS MEX KANTUN', 'Leonardo Sayas', '61744d7e-6f64-4bfe-82b0-d4c056aad239'::uuid, 'eslivet.aguilar@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (78, 'eafaf2aa-8e95-4d8c-b11e-eaf70d3f400d'::uuid, 'DANIELA AURORA PEREZ EDGAR', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (79, '1fb66a61-6027-4617-bbb8-5d6e51b9de4b'::uuid, 'DANIELA GEORGINA MARQUEZ ALAMILLA', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (81, 'd904dc05-5b92-4c92-b130-b79a91e0e31a'::uuid, 'HUMBERTO GARCIA LUNA BAEZA', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (82, '928b7da7-7149-49ea-a554-f1249fa3571a'::uuid, 'ISRAEL JESREEL FAJARDO GONZALEZ', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (86, '7945b773-8e37-41d3-b70f-292fec3cbc3a'::uuid, 'JOSE GABRIEL GONZALEZ CARDENAS', 'Leonardo Sayas', '61744d7e-6f64-4bfe-82b0-d4c056aad239'::uuid, 'eslivet.aguilar@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (87, 'c96f989c-28f8-421e-acdb-d1543252b014'::uuid, 'JOSE GONZALO POOL ROBLES', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (88, '4a0dd2b0-c15b-46c2-ae96-7da9046a25fc'::uuid, 'JOSE LUIS MONTEMAYOR GONZALEZ', 'Leonardo Sayas', '5377a59d-8e09-4d56-b993-c1c7205ba8af'::uuid, 'zulma.martinez@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (89, '21bcc1db-100e-4d30-9b91-2e88cdef6928'::uuid, 'JOSUE BALLINAS BARRIOS', 'Leonardo Sayas', '61744d7e-6f64-4bfe-82b0-d4c056aad239'::uuid, 'eslivet.aguilar@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (90, '21c077f2-fc1d-4d66-a671-0f7627835fdf'::uuid, 'LEYDI JAQUELIN ALCOCER URBIETA', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (91, 'eebddcef-fc1c-4744-8ab2-a61aa85b0848'::uuid, 'MELINA ABRIL DIAZ CARRILLO', 'Leonardo Sayas', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (92, 'afc1732c-208d-4790-a444-5b6c72fe8ef5'::uuid, 'MIGUEL SANCHEZ RODRIGUEZ', 'Leonardo Sayas', '5377a59d-8e09-4d56-b993-c1c7205ba8af'::uuid, 'zulma.martinez@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (93, '38f7dbe8-d7c3-478e-b2f7-d796fda3ed8b'::uuid, 'RAUL INAKI CHAN AGUILAR', 'Leonardo Sayas', '61744d7e-6f64-4bfe-82b0-d4c056aad239'::uuid, 'eslivet.aguilar@tecplayacar.edu.mx', 'ebf0079f-598e-40d9-8b4f-d08d9922f3fa'::uuid, 'brian.sayas@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (96, 'f8070581-4eed-45a1-bbd3-919801e2a4b7'::uuid, 'ALBERTO MONTERO CEME', 'Oriana Nah Rosado', NULL::uuid, '', 'df3ad085-321c-45b5-9054-e6a036d70793'::uuid, 'oriana.nah@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_NULL'),
  (104, '300ffabf-0913-4476-9fc2-4389f21cd3ce'::uuid, 'DAISY MARGARITA MENDEZ TRIGUEROS', 'Oriana Nah Rosado', '051543e4-4058-42b0-83ad-7d2cd25e1dd5'::uuid, 'victor.yama@tecplayacar.edu.mx', 'df3ad085-321c-45b5-9054-e6a036d70793'::uuid, 'oriana.nah@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (116, '9cc536e5-48c1-4398-8c43-68e836069975'::uuid, 'MAYRA ISABEL GARCIA MARTIN', 'Oriana Nah Rosado', NULL::uuid, '', 'df3ad085-321c-45b5-9054-e6a036d70793'::uuid, 'oriana.nah@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_NULL'),
  (136, 'b74ffef4-adfb-49bb-b422-bcfd6428c050'::uuid, 'JUAN DOMINGUEZ CASAUX', 'Zulma Martinez Duque', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'::uuid, 'merit.bazan@tecplayacar.edu.mx', '5377a59d-8e09-4d56-b993-c1c7205ba8af'::uuid, 'zulma.martinez@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE'),
  (141, 'a4f8ce05-a5a3-4de8-a21f-8ee2840461b6'::uuid, 'MARIA CLEMENTE MARTINEZ', 'Zulma Martinez Duque', '61744d7e-6f64-4bfe-82b0-d4c056aad239'::uuid, 'eslivet.aguilar@tecplayacar.edu.mx', '5377a59d-8e09-4d56-b993-c1c7205ba8af'::uuid, 'zulma.martinez@tecplayacar.edu.mx', 'UPDATE_CANDIDATO_CREATED_BY_DIFERENTE');

\echo 'H19 preview: resumen mapping'
SELECT action, count(*) AS rows
FROM h19_teacher_created_by_mapping
GROUP BY action
ORDER BY action;

\echo 'H19 preview: validar responsables destino existen'
SELECT m.new_created_by_email, count(*) AS rows, bool_and(u.id IS NOT NULL) AS target_user_exists
FROM h19_teacher_created_by_mapping m
LEFT JOIN app_users u ON u.id = m.new_created_by
GROUP BY m.new_created_by_email
ORDER BY m.new_created_by_email;

\echo 'H19 preview: validar docentes target y propietario esperado'
SELECT
  count(*) AS mapping_rows,
  count(t.id) AS teachers_found,
  count(*) FILTER (WHERE t.created_by IS NOT DISTINCT FROM m.expected_current_created_by) AS current_owner_matches,
  count(*) FILTER (WHERE t.created_by IS DISTINCT FROM m.expected_current_created_by) AS current_owner_mismatch,
  count(*) FILTER (WHERE t.created_by IS DISTINCT FROM m.new_created_by) AS would_update
FROM h19_teacher_created_by_mapping m
LEFT JOIN teachers t ON t.id = m.teacher_id;

\echo 'H19 preview: filas que se actualizarian sin tocar datos fiscales'
WITH candidate AS (
  SELECT t.id
  FROM teachers t
  JOIN h19_teacher_created_by_mapping m ON m.teacher_id = t.id
  JOIN app_users u ON u.id = m.new_created_by
  WHERE t.created_by IS NOT DISTINCT FROM m.expected_current_created_by
    AND t.created_by IS DISTINCT FROM m.new_created_by
)
SELECT count(*) AS would_update FROM candidate;

\echo 'H19 preview: UPDATE queda dentro de transaccion con ROLLBACK'
UPDATE teachers t
SET created_by = m.new_created_by
FROM h19_teacher_created_by_mapping m
JOIN app_users u ON u.id = m.new_created_by
WHERE t.id = m.teacher_id
  AND t.created_by IS NOT DISTINCT FROM m.expected_current_created_by
  AND t.created_by IS DISTINCT FROM m.new_created_by;

\echo 'H19 preview: conteo despues del UPDATE dentro de transaccion'
SELECT count(*) AS updated_inside_transaction
FROM teachers t
JOIN h19_teacher_created_by_mapping m ON m.teacher_id = t.id
WHERE t.created_by = m.new_created_by;

-- ROLLBACK obligatorio por defecto. Cambiar a COMMIT solo en una copia temporal,
-- con backup Cloud SQL exitoso y aprobacion humana explicita.
ROLLBACK;
