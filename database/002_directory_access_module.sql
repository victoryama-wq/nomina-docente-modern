-- Nomina Docente - modulo Directorio Docente y Control de Accesos

BEGIN;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS legacy_row_number integer,
  ADD COLUMN IF NOT EXISTS legacy_username text,
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS app_users_status_idx ON app_users(status);
CREATE INDEX IF NOT EXISTS app_users_role_idx ON app_users(role_id);

CREATE INDEX IF NOT EXISTS teachers_payment_type_idx ON teachers(payment_type);
CREATE INDEX IF NOT EXISTS teachers_category_idx ON teachers(category);
CREATE INDEX IF NOT EXISTS teacher_documents_teacher_current_idx
  ON teacher_documents(teacher_id, is_current);

INSERT INTO roles (code, name, description) VALUES
  ('contabilidad', 'Contabilidad', 'Consulta expedientes fiscales y pendientes contables.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'dashboard.view',
  'payroll.view',
  'reports.view',
  'statistics.view',
  'finance.view'
)
WHERE r.code = 'contabilidad'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_protected_super_admin_removal()
RETURNS trigger AS $$
DECLARE
  admin_role_id uuid;
BEGIN
  SELECT id INTO admin_role_id FROM roles WHERE code = 'admin';

  IF TG_OP = 'DELETE' AND OLD.is_protected_super_admin THEN
    RAISE EXCEPTION 'El administrador general protegido no puede ser eliminado.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_protected_super_admin THEN
    IF NEW.status <> 'ACTIVO'
       OR NEW.is_protected_super_admin IS DISTINCT FROM true
       OR NEW.email <> OLD.email
       OR NEW.role_id IS DISTINCT FROM admin_role_id THEN
      RAISE EXCEPTION 'El administrador general protegido no puede ser desactivado, degradado ni renombrado.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMIT;
