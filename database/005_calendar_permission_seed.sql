-- Asegura permiso de Calendario para instalaciones ya migradas.

INSERT INTO permissions (code, name, description) VALUES
  ('calendar.manage', 'Gestionar calendario', 'Configuracion de calendario operativo.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'calendar.manage'
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;
