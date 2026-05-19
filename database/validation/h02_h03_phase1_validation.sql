-- H02/H03 Fase 1 - validaciones de solo lectura.
-- Ejecutar despues de aplicar database/011_h02_h03_user_coordinations_permissions.sql
-- en un ambiente de revision o contra una copia controlada.

-- 1. Confirmar existencia de tabla formal.
SELECT to_regclass('public.user_coordinations') AS user_coordinations_table;

-- 2. Confirmar usuarios actuales.
SELECT
  u.email,
  u.display_name,
  u.legacy_username,
  r.code AS role_code,
  u.status,
  u.is_protected_super_admin
FROM app_users u
JOIN roles r ON r.id = u.role_id
ORDER BY r.code, u.email;

-- 3. Confirmar roles actuales.
SELECT
  code,
  name,
  description
FROM roles
ORDER BY code;

-- 4. Confirmar permisos actuales por rol.
SELECT
  r.code AS role_code,
  p.code AS permission_code
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
ORDER BY r.code, p.code;

-- 5. Confirmar coordinaciones existentes.
SELECT
  id,
  name,
  status,
  created_at
FROM coordinations
ORDER BY lower(name);

-- 6. Confirmar columnas esperadas de user_coordinations.
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_coordinations'
ORDER BY ordinal_position;

-- 7. Confirmar indices esperados de user_coordinations.
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'user_coordinations'
ORDER BY indexname;

-- 8. Confirmar permisos objetivo H03.
SELECT
  code,
  name,
  description
FROM permissions
WHERE code IN (
  'fiscal.view',
  'fiscal.document.view',
  'fiscal.document.manage',
  'finance.export',
  'finance.workflow',
  'payroll.preview'
)
ORDER BY code;

-- 9. Confirmar asignacion de permisos nuevos por rol.
SELECT
  r.code AS role_code,
  p.code AS permission_code
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.code IN (
  'fiscal.view',
  'fiscal.document.view',
  'fiscal.document.manage',
  'finance.export',
  'finance.workflow',
  'payroll.preview'
)
ORDER BY r.code, p.code;

-- 10. Fuente operativa inicial normalizada para migracion posterior.
WITH operational_assignments(email, role_code, coordination_name, scope_type) AS (
  VALUES
    ('victor.yama@tecplayacar.edu.mx', 'admin', NULL, 'global'),
    ('alejandra.castellanos@tecplayacar.edu.mx', 'coordinador', 'Rectoría', 'coordination'),
    ('cristhian.alvarado@tecplayacar.edu.mx', 'coordinador', 'Coordinación de Investigación', 'coordination'),
    ('david.velazquez@tecplayacar.edu.mx', 'finanzas', NULL, 'no_operational_coordination'),
    ('elsa.garcia@tecplayacar.edu.mx', 'direccion', 'Subdirección de vinculación y calidad', 'coordination'),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'coordinador', 'ADETUR', 'coordination'),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'coordinador', 'ARQ', 'coordination'),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'coordinador', 'SISCOM', 'coordination'),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'coordinador', 'DIGRAF', 'coordination'),
    ('jesus.aguilar@tecplayacar.edu.mx', 'coordinador', 'Servicio Social', 'coordination'),
    ('josue.delgado@tecplayacar.edu.mx', 'coordinador', 'Prácticas profesionales', 'coordination'),
    ('leonardo.sayas@tecplayacar.edu.mx', 'coordinador', 'ADEM', 'coordination'),
    ('leonardo.sayas@tecplayacar.edu.mx', 'coordinador', 'CINTER', 'coordination'),
    ('leonardo.sayas@tecplayacar.edu.mx', 'coordinador', 'CONPUB', 'coordination'),
    ('lidia.medina@tecplayacar.edu.mx', 'coordinador', 'Idiomas', 'coordination'),
    ('mario.medina@tecplayacar.edu.mx', 'coordinador', 'Coordinación General', 'coordination'),
    ('merit.bazan@tecplayacar.edu.mx', 'coordinador', 'PED', 'coordination'),
    ('merit.bazan@tecplayacar.edu.mx', 'coordinador', 'MAESTRIAS', 'coordination'),
    ('noadia.gonzalez@tecplayacar.edu.mx', 'direccion', NULL, 'global'),
    ('oriana.nah@tecplayacar.edu.mx', 'coordinador', 'ENF', 'coordination'),
    ('oriana.nah@tecplayacar.edu.mx', 'coordinador', 'NUT', 'coordination'),
    ('oriana.nah@tecplayacar.edu.mx', 'coordinador', 'ESPECIALIDAD', 'coordination'),
    ('oriana.nah@tecplayacar.edu.mx', 'coordinador', 'MDH', 'coordination'),
    ('roxana.landero@tecplayacar.edu.mx', 'coordinador', 'Simulación Clínica', 'coordination'),
    ('zulma.martinez@tecplayacar.edu.mx', 'coordinador', 'DE', 'coordination'),
    ('zulma.martinez@tecplayacar.edu.mx', 'coordinador', 'CRIMI', 'coordination'),
    ('zulma.martinez@tecplayacar.edu.mx', 'coordinador', 'MERC', 'coordination'),
    ('zuly.carrillo@tecplayacar.edu.mx', 'rh', NULL, 'no_operational_coordination')
)
SELECT
  a.email,
  a.role_code AS expected_role,
  r.code AS actual_role,
  u.status AS user_status
FROM operational_assignments a
LEFT JOIN app_users u ON lower(u.email) = lower(a.email)
LEFT JOIN roles r ON r.id = u.role_id
WHERE u.id IS NULL
   OR r.code IS DISTINCT FROM a.role_code
ORDER BY a.email;

-- 11. Coordinaciones de la fuente operativa que no existen en catalogo.
WITH operational_assignments(email, role_code, coordination_name, scope_type) AS (
  VALUES
    ('alejandra.castellanos@tecplayacar.edu.mx', 'coordinador', 'Rectoría', 'coordination'),
    ('cristhian.alvarado@tecplayacar.edu.mx', 'coordinador', 'Coordinación de Investigación', 'coordination'),
    ('elsa.garcia@tecplayacar.edu.mx', 'direccion', 'Subdirección de vinculación y calidad', 'coordination'),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'coordinador', 'ADETUR', 'coordination'),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'coordinador', 'ARQ', 'coordination'),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'coordinador', 'SISCOM', 'coordination'),
    ('eslivet.aguilar@tecplayacar.edu.mx', 'coordinador', 'DIGRAF', 'coordination'),
    ('jesus.aguilar@tecplayacar.edu.mx', 'coordinador', 'Servicio Social', 'coordination'),
    ('josue.delgado@tecplayacar.edu.mx', 'coordinador', 'Prácticas profesionales', 'coordination'),
    ('leonardo.sayas@tecplayacar.edu.mx', 'coordinador', 'ADEM', 'coordination'),
    ('leonardo.sayas@tecplayacar.edu.mx', 'coordinador', 'CINTER', 'coordination'),
    ('leonardo.sayas@tecplayacar.edu.mx', 'coordinador', 'CONPUB', 'coordination'),
    ('lidia.medina@tecplayacar.edu.mx', 'coordinador', 'Idiomas', 'coordination'),
    ('mario.medina@tecplayacar.edu.mx', 'coordinador', 'Coordinación General', 'coordination'),
    ('merit.bazan@tecplayacar.edu.mx', 'coordinador', 'PED', 'coordination'),
    ('merit.bazan@tecplayacar.edu.mx', 'coordinador', 'MAESTRIAS', 'coordination'),
    ('oriana.nah@tecplayacar.edu.mx', 'coordinador', 'ENF', 'coordination'),
    ('oriana.nah@tecplayacar.edu.mx', 'coordinador', 'NUT', 'coordination'),
    ('oriana.nah@tecplayacar.edu.mx', 'coordinador', 'ESPECIALIDAD', 'coordination'),
    ('oriana.nah@tecplayacar.edu.mx', 'coordinador', 'MDH', 'coordination'),
    ('roxana.landero@tecplayacar.edu.mx', 'coordinador', 'Simulación Clínica', 'coordination'),
    ('zulma.martinez@tecplayacar.edu.mx', 'coordinador', 'DE', 'coordination'),
    ('zulma.martinez@tecplayacar.edu.mx', 'coordinador', 'CRIMI', 'coordination'),
    ('zulma.martinez@tecplayacar.edu.mx', 'coordinador', 'MERC', 'coordination')
)
SELECT DISTINCT
  a.coordination_name
FROM operational_assignments a
LEFT JOIN coordinations c ON lower(c.name) = lower(a.coordination_name)
WHERE c.id IS NULL
ORDER BY a.coordination_name;

-- 12. Coordinaciones reservadas que no deben existir como catalogo real.
SELECT
  id,
  name,
  status
FROM coordinations
WHERE lower(name) IN (
  lower('Todas / Global'),
  lower('No requiere coordinación operativa'),
  lower('No requiere coordinacion operativa')
);

-- 13. Duplicados o ambiguedades por nombre de coordinacion.
SELECT
  lower(name) AS normalized_coordination_name,
  count(*) AS matches,
  string_agg(id::text, ', ' ORDER BY id::text) AS coordination_ids
FROM coordinations
GROUP BY lower(name)
HAVING count(*) > 1
ORDER BY lower(name);

-- 14. Coordinadores activos sin relacion formal cargada.
SELECT
  u.email,
  u.display_name,
  r.code AS role_code,
  count(uc.id) AS assigned_coordinations
FROM app_users u
JOIN roles r ON r.id = u.role_id
LEFT JOIN user_coordinations uc ON uc.user_id = u.id
WHERE r.code = 'coordinador'
  AND u.status = 'ACTIVO'
GROUP BY u.id, u.email, u.display_name, r.code
HAVING count(uc.id) = 0
ORDER BY u.email;

-- 15. Extras sin captured_by.
SELECT
  count(*) AS extras_without_captured_by
FROM extra_hours
WHERE captured_by IS NULL;

-- 16. Horarios sin created_by.
SELECT
  count(*) AS schedules_without_created_by
FROM schedules
WHERE created_by IS NULL;

-- 17. Validar que no exista rol tecnico subdireccion.
SELECT
  id,
  code,
  name
FROM roles
WHERE code = 'subdireccion';

-- 18. Validar que contabilidad tenga tratamiento equivalente a contador.
WITH contador_permissions AS (
  SELECT p.code
  FROM roles r
  JOIN role_permissions rp ON rp.role_id = r.id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE r.code = 'contador'
),
contabilidad_permissions AS (
  SELECT p.code
  FROM roles r
  JOIN role_permissions rp ON rp.role_id = r.id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE r.code = 'contabilidad'
),
diff AS (
  (SELECT 'missing_in_contabilidad' AS issue, code FROM contador_permissions
   EXCEPT
   SELECT 'missing_in_contabilidad' AS issue, code FROM contabilidad_permissions)
  UNION ALL
  (SELECT 'extra_in_contabilidad' AS issue, code FROM contabilidad_permissions
   EXCEPT
   SELECT 'extra_in_contabilidad' AS issue, code FROM contador_permissions)
)
SELECT *
FROM diff
ORDER BY issue, code;

-- 19. Inventario rapido de campos de autoria relevantes para H02/H03.
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'schedules',
    'schedule_incidences',
    'extra_hours',
    'teachers',
    'payroll_runs',
    'audit_log',
    'app_users',
    'teacher_documents'
  )
  AND column_name IN (
    'created_by',
    'created_by_user_id',
    'captured_by',
    'updated_by',
    'calculated_by',
    'approved_by',
    'reviewed_by',
    'paid_by',
    'status_updated_by',
    'actor_user_id',
    'uploaded_by'
  )
ORDER BY table_name, column_name;
