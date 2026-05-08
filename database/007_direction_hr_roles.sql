-- Roles de Direccion/Subdireccion y RH con permisos separados.

BEGIN;

INSERT INTO roles (code, name, description) VALUES
  ('direccion', 'Dirección/Subdirección', 'Consulta ejecutiva global sin acciones operativas.'),
  ('rh', 'Recursos Humanos', 'Consulta operativa y gestión de expedientes fiscales.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO permissions (code, name, description) VALUES
  ('finance.global_view', 'Ver finanzas global', 'Consulta financiera global sin acciones de flujo.'),
  ('fiscal.manage', 'Gestionar expediente fiscal', 'Actualización de datos fiscales y constancias.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('finance.global_view', 'fiscal.manage')
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'dashboard.view',
  'teachers.manage',
  'schedules.manage',
  'incidences.manage',
  'extras.manage',
  'payroll.view',
  'reports.view',
  'finance.global_view'
)
WHERE r.code = 'direccion'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'dashboard.view',
  'teachers.manage',
  'schedules.manage',
  'incidences.manage',
  'extras.manage',
  'payroll.view',
  'reports.view',
  'fiscal.manage'
)
WHERE r.code = 'rh'
ON CONFLICT DO NOTHING;

COMMIT;
