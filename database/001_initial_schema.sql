-- Nomina Docente - esquema inicial
-- Proyecto: nomina-docente-prod
-- Instancia Cloud SQL: nomina-docente-web
-- Base de datos: nomina_docente

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('ACTIVO', 'INACTIVO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teacher_status') THEN
    CREATE TYPE teacher_status AS ENUM ('ACTIVO', 'INACTIVO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cycle_status') THEN
    CREATE TYPE cycle_status AS ENUM ('PLANEACION', 'ACTIVO', 'CERRADO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_run_status') THEN
    CREATE TYPE payroll_run_status AS ENUM ('BORRADOR', 'CALCULADA', 'APROBADA', 'CERRADA', 'CANCELADA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text UNIQUE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  status user_status NOT NULL DEFAULT 'ACTIVO',
  is_protected_super_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES app_users(id),
  last_login_at timestamptz,
  CONSTRAINT app_users_email_domain_chk CHECK (email = lower(email) AND email LIKE '%@tecplayacar.edu.mx')
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_single_protected_super_admin_idx
  ON app_users (is_protected_super_admin)
  WHERE is_protected_super_admin = true;

CREATE TABLE IF NOT EXISTS coordinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status user_status NOT NULL DEFAULT 'ACTIVO',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_row_number integer,
  legacy_teacher_id text,
  full_name text NOT NULL,
  normalized_name text NOT NULL UNIQUE,
  first_names text NOT NULL DEFAULT '',
  paternal_last_name text NOT NULL DEFAULT '',
  maternal_last_name text NOT NULL DEFAULT '',
  degree text NOT NULL DEFAULT '',
  payment_type text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  observation text NOT NULL DEFAULT '',
  coordination_id uuid REFERENCES coordinations(id),
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  rfc text NOT NULL DEFAULT '',
  external_identifier text NOT NULL DEFAULT '',
  bank_detail text NOT NULL DEFAULT '',
  status teacher_status NOT NULL DEFAULT 'ACTIVO',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES app_users(id),
  CONSTRAINT teachers_payment_type_chk CHECK (payment_type IN ('', 'E', '1', '2')),
  CONSTRAINT teachers_category_chk CHECK (category IN ('', 'V', 'M', 'N'))
);

CREATE INDEX IF NOT EXISTS teachers_status_idx ON teachers(status);
CREATE INDEX IF NOT EXISTS teachers_coordination_idx ON teachers(coordination_id);

CREATE TABLE IF NOT EXISTS teacher_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'CONSTANCIA_FISCAL',
  storage_bucket text NOT NULL,
  storage_object text NOT NULL,
  original_file_name text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT '',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES app_users(id),
  is_current boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_documents_one_current_constancia_idx
  ON teacher_documents (teacher_id, document_type)
  WHERE is_current = true;

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status user_status NOT NULL DEFAULT 'ACTIVO'
);

CREATE TABLE IF NOT EXISTS tabulators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  amount numeric(12, 2) NOT NULL,
  status user_status NOT NULL DEFAULT 'ACTIVO'
);

CREATE TABLE IF NOT EXISTS academic_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label text NOT NULL,
  quarter_code text NOT NULL,
  module1_start date NOT NULL,
  module1_end date NOT NULL,
  module2_start date NOT NULL,
  module2_end date NOT NULL,
  status cycle_status NOT NULL DEFAULT 'PLANEACION',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id),
  closed_at timestamptz,
  closed_by uuid REFERENCES app_users(id),
  UNIQUE (period_label, quarter_code),
  CONSTRAINT academic_cycles_dates_chk CHECK (
    module1_start <= module1_end
    AND module2_start <= module2_end
    AND module1_end <= module2_end
  )
);

CREATE TABLE IF NOT EXISTS payroll_calendar_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES academic_cycles(id),
  payroll_start date NOT NULL,
  payroll_end date NOT NULL,
  incidences_access_days integer NOT NULL DEFAULT 5,
  extras_access_days integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_calendar_dates_chk CHECK (payroll_start <= payroll_end),
  CONSTRAINT payroll_calendar_access_days_chk CHECK (
    incidences_access_days BETWEEN 0 AND 31
    AND extras_access_days BETWEEN 0 AND 31
  )
);

CREATE TABLE IF NOT EXISTS calendar_blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES payroll_calendar_config(id) ON DELETE CASCADE,
  blackout_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  UNIQUE (config_id, blackout_date)
);

CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_sheet_name text NOT NULL DEFAULT '',
  legacy_row_number integer,
  cycle_id uuid NOT NULL REFERENCES academic_cycles(id),
  coordination_id uuid NOT NULL REFERENCES coordinations(id),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  subject_id uuid REFERENCES subjects(id),
  subject_name text NOT NULL DEFAULT '',
  group_code text NOT NULL,
  tabulator_id uuid REFERENCES tabulators(id),
  tabulator_name text NOT NULL DEFAULT '',
  tabulator_amount numeric(12, 2) NOT NULL DEFAULT 0,
  hours_l numeric(6, 2) NOT NULL DEFAULT 0,
  hours_m numeric(6, 2) NOT NULL DEFAULT 0,
  hours_x numeric(6, 2) NOT NULL DEFAULT 0,
  hours_j numeric(6, 2) NOT NULL DEFAULT 0,
  hours_v numeric(6, 2) NOT NULL DEFAULT 0,
  hours_s1 numeric(6, 2) NOT NULL DEFAULT 0,
  hours_s2 numeric(6, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES app_users(id),
  CONSTRAINT schedules_hours_nonnegative_chk CHECK (
    hours_l >= 0 AND hours_m >= 0 AND hours_x >= 0 AND hours_j >= 0
    AND hours_v >= 0 AND hours_s1 >= 0 AND hours_s2 >= 0
  )
);

CREATE INDEX IF NOT EXISTS schedules_cycle_idx ON schedules(cycle_id);
CREATE INDEX IF NOT EXISTS schedules_teacher_idx ON schedules(teacher_id);
CREATE INDEX IF NOT EXISTS schedules_coordination_idx ON schedules(coordination_id);

CREATE TABLE IF NOT EXISTS schedule_incidences (
  schedule_id uuid PRIMARY KEY REFERENCES schedules(id) ON DELETE CASCADE,
  absences numeric(6, 2) NOT NULL DEFAULT 0,
  delays numeric(6, 2) NOT NULL DEFAULT 0,
  extra_hours_in_schedule numeric(6, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES app_users(id),
  CONSTRAINT schedule_incidences_nonnegative_chk CHECK (
    absences >= 0 AND delays >= 0 AND extra_hours_in_schedule >= 0
  )
);

CREATE TABLE IF NOT EXISTS extra_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_row_number integer,
  cycle_id uuid NOT NULL REFERENCES academic_cycles(id),
  coordination_id uuid NOT NULL REFERENCES coordinations(id),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  hours numeric(6, 2) NOT NULL,
  tabulator_amount numeric(12, 2) NOT NULL,
  reason text NOT NULL,
  activity_date date,
  reference text NOT NULL DEFAULT '',
  observations text NOT NULL DEFAULT '',
  captured_at timestamptz NOT NULL DEFAULT now(),
  captured_by uuid REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES app_users(id),
  CONSTRAINT extra_hours_positive_chk CHECK (hours > 0 AND tabulator_amount > 0)
);

CREATE INDEX IF NOT EXISTS extra_hours_cycle_idx ON extra_hours(cycle_id);
CREATE INDEX IF NOT EXISTS extra_hours_teacher_idx ON extra_hours(teacher_id);
CREATE INDEX IF NOT EXISTS extra_hours_coordination_idx ON extra_hours(coordination_id);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES academic_cycles(id),
  period_label text NOT NULL,
  status payroll_run_status NOT NULL DEFAULT 'BORRADOR',
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz,
  calculated_by uuid REFERENCES app_users(id),
  approved_at timestamptz,
  approved_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, period_label)
);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id),
  coordination_id uuid REFERENCES coordinations(id),
  teacher_name_snapshot text NOT NULL,
  coordination_name_snapshot text NOT NULL,
  payment_type_snapshot text NOT NULL DEFAULT '',
  category_snapshot text NOT NULL DEFAULT '',
  base_hours numeric(10, 2) NOT NULL DEFAULT 0,
  absences numeric(10, 2) NOT NULL DEFAULT 0,
  delays numeric(10, 2) NOT NULL DEFAULT 0,
  delay_discount_hours numeric(10, 2) NOT NULL DEFAULT 0,
  gross_base_amount numeric(12, 2) NOT NULL DEFAULT 0,
  absence_discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  delay_discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  base_net_amount numeric(12, 2) NOT NULL DEFAULT 0,
  schedule_extra_hours numeric(10, 2) NOT NULL DEFAULT 0,
  schedule_extra_amount numeric(12, 2) NOT NULL DEFAULT 0,
  logged_extra_hours numeric(10, 2) NOT NULL DEFAULT 0,
  logged_extra_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_extra_hours numeric(10, 2) NOT NULL DEFAULT 0,
  total_extra_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  alerts jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS payroll_lines_run_idx ON payroll_lines(payroll_run_id);
CREATE INDEX IF NOT EXISTS payroll_lines_teacher_idx ON payroll_lines(teacher_id);

CREATE TABLE IF NOT EXISTS quarter_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES academic_cycles(id),
  action text NOT NULL,
  observation text NOT NULL DEFAULT '',
  schedules_archived integer NOT NULL DEFAULT 0,
  extras_archived integer NOT NULL DEFAULT 0,
  affected_teachers integer NOT NULL DEFAULT 0,
  affected_coordinations integer NOT NULL DEFAULT 0,
  executed_at timestamptz NOT NULL DEFAULT now(),
  executed_by uuid REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES app_users(id),
  actor_email text NOT NULL DEFAULT '',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at);

INSERT INTO roles (code, name, description) VALUES
  ('admin', 'Administrador', 'Acceso administrativo completo.'),
  ('coordinador', 'Coordinador', 'Captura y consulta registros de su coordinacion.'),
  ('finanzas', 'Finanzas', 'Consulta expedientes fiscales y reportes financieros.'),
  ('contador', 'Contador', 'Consulta expedientes fiscales y pendientes contables.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO permissions (code, name, description) VALUES
  ('dashboard.view', 'Ver dashboard', 'Acceso al resumen general.'),
  ('teachers.manage', 'Gestionar docentes', 'Alta y edicion de docentes.'),
  ('schedules.manage', 'Gestionar horarios', 'Captura, edicion y eliminacion de horarios.'),
  ('incidences.manage', 'Gestionar incidencias', 'Captura de faltas, retardos y extras de horario.'),
  ('extras.manage', 'Gestionar extras', 'Captura de horas extra.'),
  ('payroll.view', 'Ver nomina', 'Consulta de nomina.'),
  ('payroll.calculate', 'Calcular nomina', 'Calculo y guardado de nomina.'),
  ('reports.view', 'Ver reportes', 'Consulta y exportacion de reportes.'),
  ('statistics.view', 'Ver estadisticas', 'Consulta de estadisticas historicas.'),
  ('finance.view', 'Ver finanzas', 'Consulta de expedientes fiscales.'),
  ('calendar.manage', 'Gestionar calendario', 'Configuracion de calendario operativo.'),
  ('closures.manage', 'Gestionar cierres', 'Ejecucion de cierres de cuatrimestre.'),
  ('access.manage', 'Gestionar accesos', 'Alta y mantenimiento de usuarios y roles.'),
  ('audit.view', 'Ver auditoria', 'Consulta de bitacoras y auditoria.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
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
  'reports.view'
)
WHERE r.code = 'coordinador'
ON CONFLICT DO NOTHING;

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
WHERE r.code IN ('finanzas', 'contador')
ON CONFLICT DO NOTHING;

INSERT INTO app_users (
  email,
  display_name,
  role_id,
  status,
  is_protected_super_admin
)
SELECT
  'victor.yama@tecplayacar.edu.mx',
  'Victor Yama',
  r.id,
  'ACTIVO',
  true
FROM roles r
WHERE r.code = 'admin'
ON CONFLICT (email) DO UPDATE
SET role_id = EXCLUDED.role_id,
    status = 'ACTIVO',
    is_protected_super_admin = true,
    updated_at = now();

CREATE OR REPLACE FUNCTION prevent_protected_super_admin_removal()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_protected_super_admin THEN
    RAISE EXCEPTION 'El administrador general protegido no puede ser eliminado.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_protected_super_admin THEN
    IF NEW.status <> 'ACTIVO'
       OR NEW.is_protected_super_admin IS DISTINCT FROM true
       OR NEW.email <> OLD.email THEN
      RAISE EXCEPTION 'El administrador general protegido no puede ser desactivado, degradado ni renombrado.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_users_protected_super_admin_guard ON app_users;

CREATE TRIGGER app_users_protected_super_admin_guard
BEFORE UPDATE OR DELETE ON app_users
FOR EACH ROW
EXECUTE FUNCTION prevent_protected_super_admin_removal();

COMMIT;
