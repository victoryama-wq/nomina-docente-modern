-- H04 Fase 2: seed minimo para pruebas automatizadas.
-- Uso previsto: base local/test `nomina_docente_test`.
-- No usar en produccion ni en Cloud SQL productivo.

DO $$
BEGIN
  IF current_database() <> 'nomina_docente_test' THEN
    RAISE EXCEPTION 'seed-h04-minimal.sql solo puede ejecutarse en nomina_docente_test. Base actual: %', current_database();
  END IF;
END $$;

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO roles (code, name, description) VALUES
  ('admin', 'Administrador QA', 'Acceso administrativo completo para pruebas H04.'),
  ('coordinador', 'Coordinador QA', 'Captura academica por alcance de prueba.'),
  ('direccion', 'Direccion/Subdireccion QA', 'Consulta ejecutiva sin workflow para pruebas H04.'),
  ('rh', 'Recursos Humanos QA', 'Gestion fiscal de prueba sin datos reales.'),
  ('finanzas', 'Finanzas QA', 'Workflow financiero de prueba.'),
  ('contador', 'Contador QA', 'Exportacion financiera de prueba.'),
  ('contabilidad', 'Contabilidad QA', 'Equivalente a contador en pruebas H04.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO permissions (code, name, description) VALUES
  ('dashboard.view', 'Ver dashboard', 'Acceso al resumen general.'),
  ('teachers.manage', 'Gestionar docentes', 'Alta y edicion operativa de docentes.'),
  ('schedules.manage', 'Gestionar horarios', 'Captura, edicion y eliminacion de horarios.'),
  ('incidences.manage', 'Gestionar incidencias', 'Captura de faltas, retardos y extras de horario.'),
  ('extras.manage', 'Gestionar extras', 'Captura de horas extra.'),
  ('payroll.view', 'Ver nomina', 'Consulta de nomina.'),
  ('payroll.calculate', 'Calcular nomina', 'Compatibilidad legacy para calculo de vista previa.'),
  ('payroll.preview', 'Ver preview de nomina', 'Consulta de calculo vivo sin guardado.'),
  ('payroll.finalize', 'Guardar nomina', 'Guardado definitivo de nomina quincenal.'),
  ('reports.view', 'Ver reportes', 'Consulta de reportes.'),
  ('statistics.view', 'Ver estadisticas', 'Consulta de estadisticas historicas.'),
  ('finance.view', 'Ver finanzas', 'Consulta financiera.'),
  ('finance.global_view', 'Ver finanzas global', 'Consulta ejecutiva global sin workflow.'),
  ('finance.export', 'Exportar finanzas', 'Exportacion CSV/PDF financiera.'),
  ('finance.workflow', 'Gestionar flujo financiero', 'Aprobar, marcar pagada, cancelar y cambiar estados.'),
  ('fiscal.view', 'Ver expediente fiscal', 'Consulta fiscal sin edicion.'),
  ('fiscal.manage', 'Gestionar expediente fiscal', 'Edicion de RFC, correo, banco y tipo de pago.'),
  ('fiscal.document.view', 'Ver constancias fiscales', 'Vista o descarga de constancias fiscales.'),
  ('fiscal.document.manage', 'Gestionar constancias fiscales', 'Carga o reemplazo de constancias fiscales.'),
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
  'payroll.preview',
  'reports.view'
)
WHERE r.code = 'coordinador'
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
  'payroll.preview',
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
  'payroll.view',
  'reports.view',
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
  'dashboard.view',
  'payroll.view',
  'reports.view',
  'finance.view',
  'finance.export',
  'finance.workflow',
  'fiscal.view',
  'fiscal.manage',
  'fiscal.document.view',
  'fiscal.document.manage'
)
WHERE r.code = 'finanzas'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'dashboard.view',
  'payroll.view',
  'reports.view',
  'statistics.view',
  'finance.view',
  'finance.export'
)
WHERE r.code IN ('contador', 'contabilidad')
ON CONFLICT DO NOTHING;

INSERT INTO coordinations (id, name, status) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Idiomas', 'ACTIVO'),
  ('10000000-0000-4000-8000-000000000002', 'ADETUR', 'ACTIVO'),
  ('10000000-0000-4000-8000-000000000003', 'ARQ', 'ACTIVO'),
  ('10000000-0000-4000-8000-000000000004', 'SISCOM', 'ACTIVO'),
  ('10000000-0000-4000-8000-000000000005', 'DIGRAF', 'ACTIVO')
ON CONFLICT (name) DO UPDATE
SET status = EXCLUDED.status;

INSERT INTO app_users (id, firebase_uid, email, display_name, role_id, status, is_protected_super_admin)
SELECT users.id, users.firebase_uid, users.email, users.display_name, r.id, 'ACTIVO', users.is_protected_super_admin
FROM (
  VALUES
    ('20000000-0000-4000-8000-000000000001'::uuid, 'qa-fixture-admin', 'qa.admin@tecplayacar.edu.mx', 'QA Admin', 'admin', false),
    ('20000000-0000-4000-8000-000000000002'::uuid, 'qa-fixture-coordinator', 'qa.coordinador.idiomas@tecplayacar.edu.mx', 'QA Coordinador Idiomas', 'coordinador', false),
    ('20000000-0000-4000-8000-000000000003'::uuid, 'qa-fixture-coordinator-multi', 'qa.coordinador.multi@tecplayacar.edu.mx', 'QA Coordinador Multi', 'coordinador', false),
    ('20000000-0000-4000-8000-000000000004'::uuid, 'qa-fixture-coordinator-empty', 'qa.coordinador.sin.coordinacion@tecplayacar.edu.mx', 'QA Coordinador Sin Coordinacion', 'coordinador', false),
    ('20000000-0000-4000-8000-000000000005'::uuid, 'qa-fixture-rh', 'qa.rh@tecplayacar.edu.mx', 'QA RH', 'rh', false),
    ('20000000-0000-4000-8000-000000000006'::uuid, 'qa-fixture-finanzas', 'qa.finanzas@tecplayacar.edu.mx', 'QA Finanzas', 'finanzas', false),
    ('20000000-0000-4000-8000-000000000007'::uuid, 'qa-fixture-direccion', 'qa.direccion@tecplayacar.edu.mx', 'QA Direccion', 'direccion', false),
    ('20000000-0000-4000-8000-000000000008'::uuid, 'qa-fixture-contador', 'qa.contador@tecplayacar.edu.mx', 'QA Contador', 'contador', false),
    ('20000000-0000-4000-8000-000000000009'::uuid, 'qa-fixture-contabilidad', 'qa.contabilidad@tecplayacar.edu.mx', 'QA Contabilidad', 'contabilidad', false)
) AS users(id, firebase_uid, email, display_name, role_code, is_protected_super_admin)
JOIN roles r ON r.code = users.role_code
ON CONFLICT (email) DO UPDATE
SET firebase_uid = EXCLUDED.firebase_uid,
    display_name = EXCLUDED.display_name,
    role_id = EXCLUDED.role_id,
    status = 'ACTIVO',
    is_protected_super_admin = EXCLUDED.is_protected_super_admin,
    updated_at = now();

INSERT INTO user_coordinations (user_id, coordination_id, is_primary, created_by_user_id)
SELECT u.id, c.id, assignments.is_primary, admin_user.id
FROM (
  VALUES
    ('qa.coordinador.idiomas@tecplayacar.edu.mx', 'Idiomas', true),
    ('qa.coordinador.multi@tecplayacar.edu.mx', 'ADETUR', true),
    ('qa.coordinador.multi@tecplayacar.edu.mx', 'ARQ', false),
    ('qa.coordinador.multi@tecplayacar.edu.mx', 'SISCOM', false),
    ('qa.coordinador.multi@tecplayacar.edu.mx', 'DIGRAF', false)
) AS assignments(email, coordination_name, is_primary)
JOIN app_users u ON u.email = assignments.email
JOIN coordinations c ON c.name = assignments.coordination_name
LEFT JOIN app_users admin_user ON admin_user.email = 'qa.admin@tecplayacar.edu.mx'
ON CONFLICT (user_id, coordination_id) DO UPDATE
SET is_primary = EXCLUDED.is_primary,
    updated_at = now(),
    updated_by_user_id = EXCLUDED.created_by_user_id;

INSERT INTO subjects (id, name, status) VALUES
  ('30000000-0000-4000-8000-000000000001', 'H04 QA Materia Base', 'ACTIVO')
ON CONFLICT (name) DO UPDATE
SET status = EXCLUDED.status;

INSERT INTO tabulators (id, name, amount, status) VALUES
  ('30000000-0000-4000-8000-000000000002', 'H04 QA Tabulador 100', 100.00, 'ACTIVO')
ON CONFLICT (name) DO UPDATE
SET amount = EXCLUDED.amount,
    status = EXCLUDED.status;

INSERT INTO academic_cycles (
  id,
  period_label,
  quarter_code,
  module1_start,
  module1_end,
  module2_start,
  module2_end,
  status,
  created_by
) VALUES (
  '30000000-0000-4000-8000-000000000003',
  'H04 QA Local 2026',
  'H04TEST',
  '2026-05-01',
  '2026-06-30',
  '2026-07-01',
  '2026-08-31',
  'ACTIVO',
  (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
)
ON CONFLICT (period_label, quarter_code) DO UPDATE
SET module1_start = EXCLUDED.module1_start,
    module1_end = EXCLUDED.module1_end,
    module2_start = EXCLUDED.module2_start,
    module2_end = EXCLUDED.module2_end,
    status = EXCLUDED.status;

INSERT INTO academic_cycles (
  id,
  period_label,
  quarter_code,
  module1_start,
  module1_end,
  module2_start,
  module2_end,
  status,
  created_by
) VALUES
  (
    '30000000-0000-4000-8000-000000000013',
    'H09 QA Planeacion 2026',
    'H09PLAN',
    '2026-09-01',
    '2026-10-31',
    '2026-11-01',
    '2026-12-31',
    'PLANEACION',
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '30000000-0000-4000-8000-000000000015',
    'H09 QA Cerrado 2026',
    'H09CLOSED',
    '2026-01-01',
    '2026-02-28',
    '2026-03-01',
    '2026-04-30',
    'CERRADO',
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '30000000-0000-4000-8000-000000000021',
    'H10 QA Cierre Pagado 2026',
    'H10CLOSE',
    '2026-05-01',
    '2026-06-30',
    '2026-07-01',
    '2026-08-31',
    'PLANEACION',
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '30000000-0000-4000-8000-000000000024',
    'H10 QA Siguiente Planeacion 2026',
    'H10NEXT',
    '2026-09-01',
    '2026-10-31',
    '2026-11-01',
    '2026-12-31',
    'PLANEACION',
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '30000000-0000-4000-8000-000000000025',
    'H10 QA Planeacion Sin Horarios 2026',
    'H10NOSCHED',
    '2026-09-01',
    '2026-10-31',
    '2026-11-01',
    '2026-12-31',
    'PLANEACION',
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '30000000-0000-4000-8000-000000000026',
    'H10 QA Cierre Sin Pagada 2026',
    'H10UNPAID',
    '2026-05-01',
    '2026-06-30',
    '2026-07-01',
    '2026-08-31',
    'PLANEACION',
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '30000000-0000-4000-8000-000000000028',
    'H10 QA Cierre Pendiente 2026',
    'H10PENDING',
    '2026-05-01',
    '2026-06-30',
    '2026-07-01',
    '2026-08-31',
    'PLANEACION',
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '30000000-0000-4000-8000-000000000030',
    'H10 QA Cierre Solo Cancelada 2026',
    'H10CANCEL',
    '2026-05-01',
    '2026-06-30',
    '2026-07-01',
    '2026-08-31',
    'PLANEACION',
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  )
ON CONFLICT (period_label, quarter_code) DO UPDATE
SET module1_start = EXCLUDED.module1_start,
    module1_end = EXCLUDED.module1_end,
    module2_start = EXCLUDED.module2_start,
    module2_end = EXCLUDED.module2_end,
    status = EXCLUDED.status;

INSERT INTO payroll_calendar_config (
  id,
  cycle_id,
  period_label,
  payroll_start,
  payroll_end,
  module1_start,
  module1_end,
  module2_start,
  module2_end,
  incidences_access_start_at,
  incidences_access_days,
  extras_access_start_at,
  extras_access_days
)
SELECT
  '30000000-0000-4000-8000-000000000004',
  ac.id,
  'H04 QA Mayo 15-28 2026',
  '2026-05-15',
  '2026-05-28',
  ac.module1_start,
  ac.module1_end,
  ac.module2_start,
  ac.module2_end,
  now() - interval '1 day',
  15,
  now() - interval '1 day',
  15
FROM academic_cycles ac
WHERE ac.period_label = 'H04 QA Local 2026'
  AND ac.quarter_code = 'H04TEST'
ON CONFLICT (id) DO UPDATE
SET payroll_start = EXCLUDED.payroll_start,
    payroll_end = EXCLUDED.payroll_end,
    period_label = EXCLUDED.period_label,
    module1_start = EXCLUDED.module1_start,
    module1_end = EXCLUDED.module1_end,
    module2_start = EXCLUDED.module2_start,
    module2_end = EXCLUDED.module2_end,
    incidences_access_start_at = EXCLUDED.incidences_access_start_at,
    incidences_access_days = EXCLUDED.incidences_access_days,
    extras_access_start_at = EXCLUDED.extras_access_start_at,
    extras_access_days = EXCLUDED.extras_access_days,
    updated_at = now();

INSERT INTO payroll_calendar_config (
  id,
  cycle_id,
  period_label,
  payroll_start,
  payroll_end,
  module1_start,
  module1_end,
  module2_start,
  module2_end,
  incidences_access_start_at,
  incidences_access_days,
  extras_access_start_at,
  extras_access_days
)
SELECT
  '30000000-0000-4000-8000-000000000014',
  ac.id,
  'H09 QA Planeacion Sep 1-15 2026',
  '2026-09-01',
  '2026-09-15',
  ac.module1_start,
  ac.module1_end,
  ac.module2_start,
  ac.module2_end,
  now() - interval '1 day',
  15,
  now() - interval '1 day',
  15
FROM academic_cycles ac
WHERE ac.period_label = 'H09 QA Planeacion 2026'
  AND ac.quarter_code = 'H09PLAN'
ON CONFLICT (id) DO UPDATE
SET payroll_start = EXCLUDED.payroll_start,
    payroll_end = EXCLUDED.payroll_end,
    period_label = EXCLUDED.period_label,
    module1_start = EXCLUDED.module1_start,
    module1_end = EXCLUDED.module1_end,
    module2_start = EXCLUDED.module2_start,
    module2_end = EXCLUDED.module2_end,
    incidences_access_start_at = EXCLUDED.incidences_access_start_at,
    incidences_access_days = EXCLUDED.incidences_access_days,
    extras_access_start_at = EXCLUDED.extras_access_start_at,
    extras_access_days = EXCLUDED.extras_access_days,
    updated_at = now();

INSERT INTO payroll_calendar_config (
  id,
  cycle_id,
  period_label,
  payroll_start,
  payroll_end,
  module1_start,
  module1_end,
  module2_start,
  module2_end,
  incidences_access_start_at,
  incidences_access_days,
  extras_access_start_at,
  extras_access_days
)
VALUES
  (
    '30000000-0000-4000-8000-000000000022',
    '30000000-0000-4000-8000-000000000021',
    'H10 QA Cierre Mayo 1-15 2026',
    '2026-05-01',
    '2026-05-15',
    '2026-05-01',
    '2026-06-30',
    '2026-07-01',
    '2026-08-31',
    now() - interval '1 day',
    15,
    now() - interval '1 day',
    15
  ),
  (
    '30000000-0000-4000-8000-000000000023',
    '30000000-0000-4000-8000-000000000021',
    'H10 QA Cierre Mayo 16-31 2026',
    '2026-05-16',
    '2026-05-31',
    '2026-05-01',
    '2026-06-30',
    '2026-07-01',
    '2026-08-31',
    now() - interval '1 day',
    15,
    now() - interval '1 day',
    15
  ),
  (
    '30000000-0000-4000-8000-000000000027',
    '30000000-0000-4000-8000-000000000026',
    'H10 QA Sin Pagada Mayo 1-15 2026',
    '2026-05-01',
    '2026-05-15',
    '2026-05-01',
    '2026-06-30',
    '2026-07-01',
    '2026-08-31',
    now() - interval '1 day',
    15,
    now() - interval '1 day',
    15
  ),
  (
    '30000000-0000-4000-8000-000000000029',
    '30000000-0000-4000-8000-000000000028',
    'H10 QA Pendiente Mayo 1-15 2026',
    '2026-05-01',
    '2026-05-15',
    '2026-05-01',
    '2026-06-30',
    '2026-07-01',
    '2026-08-31',
    now() - interval '1 day',
    15,
    now() - interval '1 day',
    15
  ),
  (
    '30000000-0000-4000-8000-000000000031',
    '30000000-0000-4000-8000-000000000030',
    'H10 QA Cancelada Mayo 1-15 2026',
    '2026-05-01',
    '2026-05-15',
    '2026-05-01',
    '2026-06-30',
    '2026-07-01',
    '2026-08-31',
    now() - interval '1 day',
    15,
    now() - interval '1 day',
    15
  )
ON CONFLICT (id) DO UPDATE
SET payroll_start = EXCLUDED.payroll_start,
    payroll_end = EXCLUDED.payroll_end,
    period_label = EXCLUDED.period_label,
    module1_start = EXCLUDED.module1_start,
    module1_end = EXCLUDED.module1_end,
    module2_start = EXCLUDED.module2_start,
    module2_end = EXCLUDED.module2_end,
    incidences_access_start_at = EXCLUDED.incidences_access_start_at,
    incidences_access_days = EXCLUDED.incidences_access_days,
    extras_access_start_at = EXCLUDED.extras_access_start_at,
    extras_access_days = EXCLUDED.extras_access_days,
    updated_at = now();

INSERT INTO teachers (
  id,
  full_name,
  normalized_name,
  first_names,
  paternal_last_name,
  maternal_last_name,
  degree,
  payment_type,
  category,
  location,
  coordination_id,
  status,
  created_by,
  updated_by
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    'Docente QA Idiomas Uno',
    'docente qa idiomas uno',
    'Docente QA',
    'Idiomas',
    'Uno',
    'Licenciatura',
    '',
    'N',
    'Local',
    (SELECT id FROM coordinations WHERE name = 'Idiomas'),
    'ACTIVO',
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx')
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'Docente QA Multi Uno',
    'docente qa multi uno',
    'Docente QA',
    'Multi',
    'Uno',
    'Licenciatura',
    '',
    'M',
    'Local',
    (SELECT id FROM coordinations WHERE name = 'ADETUR'),
    'ACTIVO',
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.multi@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.multi@tecplayacar.edu.mx')
  )
ON CONFLICT (normalized_name) DO UPDATE
SET full_name = EXCLUDED.full_name,
    category = EXCLUDED.category,
    coordination_id = EXCLUDED.coordination_id,
    status = EXCLUDED.status,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;

INSERT INTO schedules (
  id,
  cycle_id,
  coordination_id,
  teacher_id,
  subject_id,
  subject_name,
  group_code,
  tabulator_id,
  tabulator_name,
  tabulator_amount,
  hours_l,
  hours_m,
  hours_x,
  hours_j,
  hours_v,
  hours_s1,
  hours_s2,
  created_by,
  updated_by
) VALUES
  (
    '50000000-0000-4000-8000-000000000001',
    (SELECT id FROM academic_cycles WHERE period_label = 'H04 QA Local 2026' AND quarter_code = 'H04TEST'),
    (SELECT id FROM coordinations WHERE name = 'Idiomas'),
    (SELECT id FROM teachers WHERE normalized_name = 'docente qa idiomas uno'),
    (SELECT id FROM subjects WHERE name = 'H04 QA Materia Base'),
    'H04 QA Materia Base',
    'QA-ID-01',
    (SELECT id FROM tabulators WHERE name = 'H04 QA Tabulador 100'),
    'H04 QA Tabulador 100',
    100.00,
    2, 2, 2, 2, 2, 0, 0,
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx')
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    (SELECT id FROM academic_cycles WHERE period_label = 'H04 QA Local 2026' AND quarter_code = 'H04TEST'),
    (SELECT id FROM coordinations WHERE name = 'ADETUR'),
    (SELECT id FROM teachers WHERE normalized_name = 'docente qa multi uno'),
    (SELECT id FROM subjects WHERE name = 'H04 QA Materia Base'),
    'H04 QA Materia Base',
    'QA-MU-01',
    (SELECT id FROM tabulators WHERE name = 'H04 QA Tabulador 100'),
    'H04 QA Tabulador 100',
    100.00,
    3, 3, 0, 0, 0, 0, 0,
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.multi@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.multi@tecplayacar.edu.mx')
  )
ON CONFLICT (id) DO UPDATE
SET coordination_id = EXCLUDED.coordination_id,
    teacher_id = EXCLUDED.teacher_id,
    hours_l = EXCLUDED.hours_l,
    hours_m = EXCLUDED.hours_m,
    hours_x = EXCLUDED.hours_x,
    hours_j = EXCLUDED.hours_j,
    hours_v = EXCLUDED.hours_v,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;

INSERT INTO schedules (
  id,
  cycle_id,
  coordination_id,
  teacher_id,
  subject_id,
  subject_name,
  group_code,
  tabulator_id,
  tabulator_name,
  tabulator_amount,
  hours_l,
  hours_m,
  hours_x,
  hours_j,
  hours_v,
  hours_s1,
  hours_s2,
  created_by,
  updated_by
) VALUES
  (
    '50000000-0000-4000-8000-000000000013',
    (SELECT id FROM academic_cycles WHERE period_label = 'H09 QA Planeacion 2026' AND quarter_code = 'H09PLAN'),
    (SELECT id FROM coordinations WHERE name = 'Idiomas'),
    (SELECT id FROM teachers WHERE normalized_name = 'docente qa idiomas uno'),
    (SELECT id FROM subjects WHERE name = 'H04 QA Materia Base'),
    'H04 QA Materia Base',
    'QA-PLAN-ID-01',
    (SELECT id FROM tabulators WHERE name = 'H04 QA Tabulador 100'),
    'H04 QA Tabulador 100',
    100.00,
    1, 1, 1, 1, 0, 0, 0,
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx')
  ),
  (
    '50000000-0000-4000-8000-000000000015',
    (SELECT id FROM academic_cycles WHERE period_label = 'H09 QA Cerrado 2026' AND quarter_code = 'H09CLOSED'),
    (SELECT id FROM coordinations WHERE name = 'Idiomas'),
    (SELECT id FROM teachers WHERE normalized_name = 'docente qa idiomas uno'),
    (SELECT id FROM subjects WHERE name = 'H04 QA Materia Base'),
    'H04 QA Materia Base',
    'QA-CLOSED-ID-01',
    (SELECT id FROM tabulators WHERE name = 'H04 QA Tabulador 100'),
    'H04 QA Tabulador 100',
    100.00,
    1, 1, 0, 0, 0, 0, 0,
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx')
  ),
  (
    '50000000-0000-4000-8000-000000000021',
    (SELECT id FROM academic_cycles WHERE period_label = 'H10 QA Cierre Pagado 2026' AND quarter_code = 'H10CLOSE'),
    (SELECT id FROM coordinations WHERE name = 'Idiomas'),
    (SELECT id FROM teachers WHERE normalized_name = 'docente qa idiomas uno'),
    (SELECT id FROM subjects WHERE name = 'H04 QA Materia Base'),
    'H04 QA Materia Base',
    'QA-CLOSE-ID-01',
    (SELECT id FROM tabulators WHERE name = 'H04 QA Tabulador 100'),
    'H04 QA Tabulador 100',
    100.00,
    2, 2, 0, 0, 0, 0, 0,
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx')
  ),
  (
    '50000000-0000-4000-8000-000000000024',
    (SELECT id FROM academic_cycles WHERE period_label = 'H10 QA Siguiente Planeacion 2026' AND quarter_code = 'H10NEXT'),
    (SELECT id FROM coordinations WHERE name = 'Idiomas'),
    (SELECT id FROM teachers WHERE normalized_name = 'docente qa idiomas uno'),
    (SELECT id FROM subjects WHERE name = 'H04 QA Materia Base'),
    'H04 QA Materia Base',
    'QA-NEXT-ID-01',
    (SELECT id FROM tabulators WHERE name = 'H04 QA Tabulador 100'),
    'H04 QA Tabulador 100',
    100.00,
    1, 1, 1, 1, 0, 0, 0,
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx')
  )
ON CONFLICT (id) DO UPDATE
SET cycle_id = EXCLUDED.cycle_id,
    coordination_id = EXCLUDED.coordination_id,
    teacher_id = EXCLUDED.teacher_id,
    subject_id = EXCLUDED.subject_id,
    subject_name = EXCLUDED.subject_name,
    group_code = EXCLUDED.group_code,
    tabulator_id = EXCLUDED.tabulator_id,
    tabulator_name = EXCLUDED.tabulator_name,
    tabulator_amount = EXCLUDED.tabulator_amount,
    hours_l = EXCLUDED.hours_l,
    hours_m = EXCLUDED.hours_m,
    hours_x = EXCLUDED.hours_x,
    hours_j = EXCLUDED.hours_j,
    hours_v = EXCLUDED.hours_v,
    hours_s1 = EXCLUDED.hours_s1,
    hours_s2 = EXCLUDED.hours_s2,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;

INSERT INTO schedule_incidences (
  schedule_id,
  calendar_config_id,
  absences,
  delays,
  extra_hours_in_schedule,
  updated_by
) VALUES
  (
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000004',
    1,
    2,
    1,
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx')
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000004',
    0,
    1,
    2,
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.multi@tecplayacar.edu.mx')
  )
ON CONFLICT (schedule_id, calendar_config_id) DO UPDATE
SET absences = EXCLUDED.absences,
    delays = EXCLUDED.delays,
    extra_hours_in_schedule = EXCLUDED.extra_hours_in_schedule,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;

INSERT INTO extra_hours (
  id,
  cycle_id,
  coordination_id,
  teacher_id,
  hours,
  tabulator_amount,
  reason,
  activity_date,
  reference,
  observations,
  captured_by,
  updated_by
) VALUES
  (
    '60000000-0000-4000-8000-000000000001',
    (SELECT id FROM academic_cycles WHERE period_label = 'H04 QA Local 2026' AND quarter_code = 'H04TEST'),
    (SELECT id FROM coordinations WHERE name = 'Idiomas'),
    (SELECT id FROM teachers WHERE normalized_name = 'docente qa idiomas uno'),
    2,
    100.00,
    'Extra propio QA',
    '2026-05-20',
    'H04-PROPIO',
    'Extra propio para prueba H04',
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx')
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    (SELECT id FROM academic_cycles WHERE period_label = 'H04 QA Local 2026' AND quarter_code = 'H04TEST'),
    (SELECT id FROM coordinations WHERE name = 'Idiomas'),
    (SELECT id FROM teachers WHERE normalized_name = 'docente qa idiomas uno'),
    1,
    100.00,
    'Extra ajeno QA',
    '2026-05-21',
    'H04-AJENO',
    'Extra ajeno para prueba H04',
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.multi@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.multi@tecplayacar.edu.mx')
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    (SELECT id FROM academic_cycles WHERE period_label = 'H04 QA Local 2026' AND quarter_code = 'H04TEST'),
    (SELECT id FROM coordinations WHERE name = 'ADETUR'),
    (SELECT id FROM teachers WHERE normalized_name = 'docente qa multi uno'),
    3,
    100.00,
    'Extra multi QA',
    '2026-05-22',
    'H04-MULTI',
    'Extra propio multi-coordinacion para prueba H04',
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.multi@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.multi@tecplayacar.edu.mx')
  ),
  (
    '60000000-0000-4000-8000-000000000021',
    (SELECT id FROM academic_cycles WHERE period_label = 'H10 QA Cierre Pagado 2026' AND quarter_code = 'H10CLOSE'),
    (SELECT id FROM coordinations WHERE name = 'Idiomas'),
    (SELECT id FROM teachers WHERE normalized_name = 'docente qa idiomas uno'),
    1,
    100.00,
    'Extra cierre QA',
    '2026-05-10',
    'H10-CLOSE-EXTRA',
    'Extra sintetico para cierre H10',
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx'),
    (SELECT id FROM app_users WHERE email = 'qa.coordinador.idiomas@tecplayacar.edu.mx')
  )
ON CONFLICT (id) DO UPDATE
SET hours = EXCLUDED.hours,
    tabulator_amount = EXCLUDED.tabulator_amount,
    reason = EXCLUDED.reason,
    activity_date = EXCLUDED.activity_date,
    observations = EXCLUDED.observations,
    captured_by = EXCLUDED.captured_by,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;

INSERT INTO payroll_runs (
  id,
  cycle_id,
  period_label,
  status,
  weights,
  summary,
  calculated_at,
  calculated_by,
  status_updated_at,
  status_updated_by
)
VALUES
  (
    '70000000-0000-4000-8000-000000000001',
    (SELECT id FROM academic_cycles WHERE period_label = 'H04 QA Local 2026' AND quarter_code = 'H04TEST'),
    'H04 QA Workflow Seed',
    'CALCULADA',
    jsonb_build_object(
      'calendarConfigId', '30000000-0000-4000-8000-000000000004',
      'payrollStart', '2026-05-15',
      'payrollEnd', '2026-05-28',
      'module1Start', '2026-05-01',
      'module1End', '2026-06-30',
      'module2Start', '2026-07-01',
      'module2End', '2026-08-31'
    ),
    jsonb_build_object(
      'lines', 0,
      'teachers', 0,
      'coordinations', 0,
      'totalAmount', '0.00'
    ),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx'),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '70000000-0000-4000-8000-000000000021',
    (SELECT id FROM academic_cycles WHERE period_label = 'H10 QA Cierre Pagado 2026' AND quarter_code = 'H10CLOSE'),
    'H10 QA Cierre Mayo 1-15 2026',
    'PAGADA',
    jsonb_build_object('calendarConfigId', '30000000-0000-4000-8000-000000000022'),
    jsonb_build_object('lines', 1, 'teachers', 1, 'coordinations', 1, 'totalAmount', '100.00'),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx'),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '70000000-0000-4000-8000-000000000022',
    (SELECT id FROM academic_cycles WHERE period_label = 'H10 QA Cierre Pagado 2026' AND quarter_code = 'H10CLOSE'),
    'H10 QA Cierre Mayo 16-31 2026',
    'PAGADA',
    jsonb_build_object('calendarConfigId', '30000000-0000-4000-8000-000000000023'),
    jsonb_build_object('lines', 1, 'teachers', 1, 'coordinations', 1, 'totalAmount', '100.00'),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx'),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '70000000-0000-4000-8000-000000000028',
    (SELECT id FROM academic_cycles WHERE period_label = 'H10 QA Cierre Pendiente 2026' AND quarter_code = 'H10PENDING'),
    'H10 QA Pendiente Fuera Calendario 2026',
    'CALCULADA',
    jsonb_build_object('calendarConfigId', '30000000-0000-4000-8000-000000000029'),
    jsonb_build_object('lines', 0, 'teachers', 0, 'coordinations', 0, 'totalAmount', '0.00'),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx'),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '70000000-0000-4000-8000-000000000029',
    (SELECT id FROM academic_cycles WHERE period_label = 'H10 QA Cierre Pendiente 2026' AND quarter_code = 'H10PENDING'),
    'H10 QA Pendiente Mayo 1-15 2026',
    'PAGADA',
    jsonb_build_object('calendarConfigId', '30000000-0000-4000-8000-000000000029'),
    jsonb_build_object('lines', 1, 'teachers', 1, 'coordinations', 1, 'totalAmount', '100.00'),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx'),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  ),
  (
    '70000000-0000-4000-8000-000000000030',
    (SELECT id FROM academic_cycles WHERE period_label = 'H10 QA Cierre Solo Cancelada 2026' AND quarter_code = 'H10CANCEL'),
    'H10 QA Cancelada Mayo 1-15 2026',
    'CANCELADA',
    jsonb_build_object('calendarConfigId', '30000000-0000-4000-8000-000000000031'),
    jsonb_build_object('lines', 0, 'teachers', 0, 'coordinations', 0, 'totalAmount', '0.00'),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx'),
    now(),
    (SELECT id FROM app_users WHERE email = 'qa.admin@tecplayacar.edu.mx')
  )
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    weights = EXCLUDED.weights,
    summary = EXCLUDED.summary,
    status_updated_at = EXCLUDED.status_updated_at,
    status_updated_by = EXCLUDED.status_updated_by;

COMMIT;
