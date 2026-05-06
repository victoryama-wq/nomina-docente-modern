-- Separa la vista previa de nomina del guardado definitivo para Admin.

BEGIN;

INSERT INTO permissions (code, name, description) VALUES
  ('payroll.calculate', 'Calcular nomina', 'Calculo de vista previa de nomina.'),
  ('payroll.finalize', 'Guardar nomina', 'Guardado definitivo de nomina quincenal.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'payroll.finalize'
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

COMMIT;
