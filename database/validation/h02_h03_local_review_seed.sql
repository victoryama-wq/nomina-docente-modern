-- H02/H03 local review seed.
-- SOLO para base local/revision. NO ejecutar en produccion.
--
-- Objetivo:
-- - Cargar usuarios, roles y coordinaciones minimas para validar H02/H03.
-- - Crear relaciones user_coordinations para coordinadores.
-- - No insertar datos sensibles de nomina, fiscales, bancarios ni documentos.
--
-- Requisitos previos:
-- - Haber aplicado database/001_initial_schema.sql a database/011_h02_h03_user_coordinations_permissions.sql.
-- - Ejecutar contra una BD local/revision, nunca contra Cloud SQL productivo.

BEGIN;

-- Coordinaciones operativas reales requeridas por coordinadores y Subdireccion en revision.
-- NO se insertan "Todas / Global" ni "No requiere coordinacion operativa".
INSERT INTO coordinations (name, status)
VALUES
  ('Rectoría', 'ACTIVO'),
  ('Coordinación de Investigación', 'ACTIVO'),
  ('Subdirección de vinculación y calidad', 'ACTIVO'),
  ('ADETUR', 'ACTIVO'),
  ('ARQ', 'ACTIVO'),
  ('SISCOM', 'ACTIVO'),
  ('DIGRAF', 'ACTIVO'),
  ('Servicio Social', 'ACTIVO'),
  ('Prácticas profesionales', 'ACTIVO'),
  ('ADEM', 'ACTIVO'),
  ('CINTER', 'ACTIVO'),
  ('CONPUB', 'ACTIVO'),
  ('Idiomas', 'ACTIVO'),
  ('Coordinación General', 'ACTIVO'),
  ('PED', 'ACTIVO'),
  ('MAESTRIAS', 'ACTIVO'),
  ('ENF', 'ACTIVO'),
  ('NUT', 'ACTIVO'),
  ('ESPECIALIDAD', 'ACTIVO'),
  ('MDH', 'ACTIVO'),
  ('Simulación Clínica', 'ACTIVO'),
  ('DE', 'ACTIVO'),
  ('CRIMI', 'ACTIVO'),
  ('MERC', 'ACTIVO')
ON CONFLICT (name) DO UPDATE
SET status = EXCLUDED.status;

-- Usuarios operativos aprobados.
-- Subdireccion usa rol tecnico direccion.
-- Finanzas y RH no reciben user_coordinations por defecto.
INSERT INTO app_users (
  email,
  display_name,
  legacy_username,
  role_id,
  status,
  is_protected_super_admin
)
SELECT
  seed.email,
  seed.display_name,
  seed.legacy_username,
  roles.id,
  'ACTIVO',
  seed.is_protected_super_admin
FROM (
  VALUES
    ('victor.yama@tecplayacar.edu.mx', 'Victor Yama', NULL, 'admin', true),
    ('alejandra.castellanos@tecplayacar.edu.mx', 'Alejandra Castellanos', NULL, 'coordinador', false),
    ('cristhian.alvarado@tecplayacar.edu.mx', 'Cristhian Alvarado', NULL, 'coordinador', false),
    ('david.velazquez@tecplayacar.edu.mx', 'David Velazquez', NULL, 'finanzas', false),
    ('elsa.garcia@tecplayacar.edu.mx', 'Elsa Garcia', NULL, 'direccion', false),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'Eslivet Aguilar', NULL, 'coordinador', false),
    ('jesus.aguilar@tecplayacar.edu.mx', 'Jesus Aguilar', NULL, 'coordinador', false),
    ('josue.delgado@tecplayacar.edu.mx', 'Josue Delgado', NULL, 'coordinador', false),
    ('leonardo.sayas@tecplayacar.edu.mx', 'Leonardo Sayas', NULL, 'coordinador', false),
    ('lidia.medina@tecplayacar.edu.mx', 'Lidia Medina', NULL, 'coordinador', false),
    ('mario.medina@tecplayacar.edu.mx', 'Mario Medina', NULL, 'coordinador', false),
    ('merit.bazan@tecplayacar.edu.mx', 'Merit Bazan', NULL, 'coordinador', false),
    ('noadia.gonzalez@tecplayacar.edu.mx', 'Noadia Gonzalez', NULL, 'direccion', false),
    ('oriana.nah@tecplayacar.edu.mx', 'Oriana Nah', NULL, 'coordinador', false),
    ('roxana.landero@tecplayacar.edu.mx', 'Roxana Landero', NULL, 'coordinador', false),
    ('zulma.martinez@tecplayacar.edu.mx', 'Zulma Martinez', NULL, 'coordinador', false),
    ('zuly.carrillo@tecplayacar.edu.mx', 'Zuly Carrillo', NULL, 'rh', false)
) AS seed(email, display_name, legacy_username, role_code, is_protected_super_admin)
JOIN roles ON roles.code = seed.role_code
ON CONFLICT (email) DO UPDATE
SET display_name = EXCLUDED.display_name,
    legacy_username = EXCLUDED.legacy_username,
    role_id = EXCLUDED.role_id,
    status = EXCLUDED.status,
    is_protected_super_admin = EXCLUDED.is_protected_super_admin,
    updated_at = now();

-- Relaciones formales usuario-coordinacion para coordinadores.
-- No se insertan relaciones para:
-- - victor.yama: admin global.
-- - noadia.gonzalez: direccion global.
-- - david.velazquez: finanzas sin coordinacion operativa.
-- - zuly.carrillo: RH sin coordinacion operativa por defecto.
WITH assignments(email, coordination_name, is_primary) AS (
  VALUES
    ('alejandra.castellanos@tecplayacar.edu.mx', 'Rectoría', true),
    ('cristhian.alvarado@tecplayacar.edu.mx', 'Coordinación de Investigación', true),
    ('elsa.garcia@tecplayacar.edu.mx', 'Subdirección de vinculación y calidad', true),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'ADETUR', true),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'ARQ', false),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'SISCOM', false),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'DIGRAF', false),
    ('jesus.aguilar@tecplayacar.edu.mx', 'Servicio Social', true),
    ('josue.delgado@tecplayacar.edu.mx', 'Prácticas profesionales', true),
    ('leonardo.sayas@tecplayacar.edu.mx', 'ADEM', true),
    ('leonardo.sayas@tecplayacar.edu.mx', 'CINTER', false),
    ('leonardo.sayas@tecplayacar.edu.mx', 'CONPUB', false),
    ('lidia.medina@tecplayacar.edu.mx', 'Idiomas', true),
    ('mario.medina@tecplayacar.edu.mx', 'Coordinación General', true),
    ('merit.bazan@tecplayacar.edu.mx', 'PED', true),
    ('merit.bazan@tecplayacar.edu.mx', 'MAESTRIAS', false),
    ('oriana.nah@tecplayacar.edu.mx', 'ENF', true),
    ('oriana.nah@tecplayacar.edu.mx', 'NUT', false),
    ('oriana.nah@tecplayacar.edu.mx', 'ESPECIALIDAD', false),
    ('oriana.nah@tecplayacar.edu.mx', 'MDH', false),
    ('roxana.landero@tecplayacar.edu.mx', 'Simulación Clínica', true),
    ('zulma.martinez@tecplayacar.edu.mx', 'DE', true),
    ('zulma.martinez@tecplayacar.edu.mx', 'CRIMI', false),
    ('zulma.martinez@tecplayacar.edu.mx', 'MERC', false)
)
INSERT INTO user_coordinations (
  user_id,
  coordination_id,
  is_primary,
  created_by_user_id,
  updated_at,
  updated_by_user_id
)
SELECT
  users.id,
  coordinations.id,
  assignments.is_primary,
  admin_user.id,
  now(),
  admin_user.id
FROM assignments
JOIN app_users users ON lower(users.email) = lower(assignments.email)
JOIN coordinations ON coordinations.name = assignments.coordination_name
LEFT JOIN app_users admin_user ON lower(admin_user.email) = lower('victor.yama@tecplayacar.edu.mx')
ON CONFLICT (user_id, coordination_id) DO UPDATE
SET is_primary = EXCLUDED.is_primary,
    updated_at = now(),
    updated_by_user_id = EXCLUDED.updated_by_user_id;

COMMIT;
