-- H02/H03 Fase 1: modelo formal usuario-coordinacion y permisos objetivo.
-- Esta migracion no inserta relaciones en user_coordinations.
-- La carga de asignaciones debe ejecutarse despues de validar catalogo y usuarios.

BEGIN;

CREATE TABLE IF NOT EXISTS user_coordinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  coordination_id uuid NOT NULL REFERENCES coordinations(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at timestamptz NULL,
  updated_by_user_id uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
  UNIQUE (user_id, coordination_id)
);

CREATE INDEX IF NOT EXISTS idx_user_coordinations_user_id
  ON user_coordinations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_coordinations_coordination_id
  ON user_coordinations(coordination_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_coordinations_one_primary_per_user
  ON user_coordinations(user_id)
  WHERE is_primary = true;

INSERT INTO permissions (code, name, description) VALUES
  ('fiscal.view', 'Ver expediente fiscal', 'Consulta de expediente fiscal sin edicion.'),
  ('fiscal.document.view', 'Ver constancias fiscales', 'Vista o descarga de constancias fiscales.'),
  ('fiscal.document.manage', 'Gestionar constancias fiscales', 'Carga o reemplazo de constancias fiscales.'),
  ('finance.export', 'Exportar finanzas', 'Exportacion CSV/PDF de reportes financieros.'),
  ('finance.workflow', 'Gestionar flujo financiero', 'Aprobar, marcar pagada, cancelar y cambiar estados financieros.'),
  ('payroll.preview', 'Ver preview de nomina', 'Consulta de calculo vivo de nomina sin guardado.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'fiscal.view',
  'fiscal.document.view',
  'fiscal.document.manage',
  'finance.export',
  'finance.workflow',
  'payroll.preview'
)
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'payroll.preview'
)
WHERE r.code = 'coordinador'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'payroll.preview'
)
WHERE r.code = 'direccion'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'fiscal.view',
  'fiscal.manage',
  'fiscal.document.view',
  'fiscal.document.manage'
)
WHERE r.code = 'rh'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'fiscal.view',
  'fiscal.manage',
  'fiscal.document.view',
  'fiscal.document.manage',
  'finance.view',
  'finance.export',
  'finance.workflow',
  'payroll.view',
  'payroll.preview'
)
WHERE r.code = 'finanzas'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'finance.export'
)
WHERE r.code IN ('contador', 'contabilidad')
ON CONFLICT DO NOTHING;

COMMIT;
