# Diseño Técnico H02/H03 - Usuario, Coordinación y Permisos

## 1. Resumen ejecutivo

Este diseño técnico prepara la implementación futura de H02/H03 para Nómina Docente sin modificar código, base de datos, permisos productivos ni flujos operativos en esta etapa.

H02 corrige la resolución frágil de coordinación por coincidencia textual entre `app_users.display_name`, `app_users.legacy_username`, `actor.displayName` y `coordinations.name`. La fuente objetivo será una relación formal en PostgreSQL: `user_coordinations`.

H03 desacopla permisos actualmente sobrecargados, principalmente `finance.view`, `teachers.manage`, `reports.view`, `payroll.view`, `payroll.calculate` y `payroll.finalize`, para separar permisos fiscales, documentales, financieros, de workflow y de nómina preview.

No se implementará en este documento:

- Código backend o frontend.
- Migraciones reales.
- Cambios en permisos productivos.
- Cambios de fórmula de nómina.
- Cambios de precisión monetaria H01.
- Cambios de calendario operativo.
- Retiro del sistema legacy Apps Script.
- Retiro del fallback legacy en la primera fase.

La implementación debe empezar por DB, permisos y auth/context antes de tocar vistas o módulos porque:

- Los módulos operativos dependen de saber si el actor tiene alcance global, una o varias coordinaciones, o ninguna coordinación.
- El frontend no debe decidir permisos sensibles por sí solo.
- `finance.view` y `teachers.manage` hoy habilitan acciones que la matriz aprobada separa explícitamente.
- Activar reglas por propiedad sin autoría confiable puede bloquear o permitir acciones incorrectas.

Riesgos críticos del inventario:

- No existe `user_coordinations`.
- Existen creaciones automáticas de coordinaciones en rutas operativas.
- Faltan permisos objetivo H03.
- `finance.view` habilita fiscal/workflow en varios puntos.
- `teachers.manage` habilita fiscal/documentos.
- `schedule_incidences` no tiene autoría original.
- API y frontend usan `actorCoordination` único.
- Información fiscal sensible aparece en vistas y reportes amplios.

## 2. Premisas técnicas

Arquitectura actual asumida:

- Frontend: Vue 3 + TypeScript.
- Backend: Fastify + TypeScript.
- Auth: Firebase Auth.
- Hosting: Firebase Hosting.
- API: Cloud Run.
- Base de datos: PostgreSQL / Cloud SQL.
- Roles y permisos: PostgreSQL.
- Constancias fiscales: Cloud Storage.
- Auditoría: `audit_log`.
- Apps Script legacy: presente, fuera de alcance.
- H01 precisión monetaria: cerrado, fuera de alcance.

Roles técnicos existentes:

- `admin`
- `coordinador`
- `direccion`
- `rh`
- `finanzas`
- `contador`
- `contabilidad`

Reglas de rol aprobadas:

- No crear rol técnico `subdireccion`; Subdirección usa `direccion`.
- `contabilidad` se comporta como `contador`.
- Admin conserva alcance global.
- Finanzas puede aprobar, marcar pagada y cancelar con `finance.workflow`.
- Coordinador puede ver nómina preview en solo lectura por `user_coordinations`.
- Dirección/Subdirección puede ver reportes agregados y detalle por docente sin datos fiscales sensibles.

Permisos actuales relevantes:

- `teachers.manage`
- `schedules.manage`
- `incidences.manage`
- `extras.manage`
- `payroll.view`
- `payroll.calculate`
- `payroll.finalize`
- `reports.view`
- `finance.view`
- `finance.global_view`
- `fiscal.manage`
- `calendar.manage`
- `access.manage`
- `audit.view`

Permisos objetivo:

- `fiscal.view`
- `fiscal.manage`
- `fiscal.document.view`
- `fiscal.document.manage`
- `finance.view`
- `finance.export`
- `finance.workflow`
- `payroll.preview`
- `payroll.view`
- `payroll.finalize`

Premisas obligatorias:

- `created_by_user_id` es el concepto objetivo de propiedad, pero no se asume que exista en todas las tablas.
- El actor puede tener múltiples coordinaciones desde el primer corte.
- `Todas / Global` no es una coordinación.
- `No requiere coordinación operativa` no es una coordinación.
- El fallback legacy permanece temporalmente, instrumentado y sin crear coordinaciones.
- Ningún cambio de H02/H03 debe tocar H01 ni reglas de cálculo monetario.

## 3. Diseño de base de datos

### 3.1 Tabla user_coordinations

SQL propuesto para diseño. No ejecutar en esta etapa:

```sql
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
```

Índices propuestos:

```sql
CREATE INDEX IF NOT EXISTS idx_user_coordinations_user_id
  ON user_coordinations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_coordinations_coordination_id
  ON user_coordinations(coordination_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_coordinations_one_primary_per_user
  ON user_coordinations(user_id)
  WHERE is_primary = true;
```

Decisiones de diseño:

- `user_id` apunta a `app_users(id)` y no a Firebase UID.
- `coordination_id` apunta a `coordinations(id)`; no se autorizan permisos por texto.
- `is_primary` es opcional operativamente, pero útil para UI cuando se necesite una coordinación predeterminada.
- `UNIQUE(user_id, coordination_id)` evita duplicados.
- `ON DELETE CASCADE` en `user_id` es aceptable si se elimina usuario; si operación prefiere preservar trazabilidad, cambiar a `RESTRICT` antes de implementar.
- `ON DELETE RESTRICT` en `coordination_id` evita borrar coordinaciones con usuarios asignados.

### 3.2 Permisos nuevos

SQL propuesto para diseño. No ejecutar en esta etapa:

```sql
INSERT INTO permissions (code, name, description)
VALUES
  ('fiscal.view', 'Ver expediente fiscal', 'Consulta de expediente fiscal sin edicion.'),
  ('fiscal.document.view', 'Ver constancias fiscales', 'Vista o descarga de constancias fiscales.'),
  ('fiscal.document.manage', 'Gestionar constancias fiscales', 'Carga o reemplazo de constancias fiscales.'),
  ('finance.export', 'Exportar finanzas', 'Exportacion CSV/PDF de reportes financieros.'),
  ('finance.workflow', 'Gestionar flujo financiero', 'Aprobar, marcar pagada, cancelar y cambiar estados financieros.'),
  ('payroll.preview', 'Ver preview de nomina', 'Consulta de calculo vivo de nomina sin guardado.')
ON CONFLICT (code) DO NOTHING;
```

Permisos existentes a revisar:

| Permiso existente | Acción de diseño |
|---|---|
| `fiscal.manage` | Mantener, pero limitar a edición de RFC, correo, banco/tipo de pago. No debe controlar documentos por sí solo. |
| `finance.view` | Mantener solo para consulta financiera. No fiscal, no export, no workflow. |
| `payroll.view` | Mantener para consulta de nóminas guardadas/contexto autorizado. |
| `payroll.finalize` | Mantener para guardar nómina por rol autorizado. No usar para aprobar/pagar/cancelar por Finanzas. |
| `reports.view` | Mantener para consulta/reportes no sensibles. No debe habilitar fiscal ni workflow. |
| `teachers.manage` | Mantener para gestión operativa si se conserva, pero no fiscal ni documentos. |

Seed objetivo por rol:

| Rol | Permisos nuevos sugeridos |
|---|---|
| `admin` | Todos los permisos nuevos. |
| `coordinador` | `payroll.preview`; sin permisos fiscales, documentales, financieros globales ni workflow. |
| `direccion` | `payroll.preview`, `finance.view` o permiso equivalente de reportes agregados; `finance.export` solo si se aprueba export agregado sin fiscal sensible. |
| `rh` | `fiscal.view`, `fiscal.manage`, `fiscal.document.view`, `fiscal.document.manage`. |
| `finanzas` | `fiscal.view`, `fiscal.manage`, `fiscal.document.view`, `fiscal.document.manage`, `finance.view`, `finance.export`, `finance.workflow`, `payroll.view`. |
| `contador` | `finance.export` y lectura mínima necesaria; sin fiscal manage/document manage/workflow. |
| `contabilidad` | Igual a `contador`. |

### 3.3 Mapeo de autoría

| Tabla | Campo actual | Se usará como equivalente | Se agregará created_by_user_id | Motivo |
|---|---|---|---|---|
| `schedules` | `created_by` | Sí, si se confirma que siempre apunta al usuario creador | Opcional | Ya representa creación del horario. Puede mapearse como propiedad sin migración inmediata si el nombre se documenta. |
| `schedule_incidences` | `updated_by` | No para propiedad original | Sí, si se requiere regla propia directa | `updated_by` solo indica última edición. Para regla "propio" se debe heredar del horario o agregar autoría. |
| `extra_hours` | `captured_by` | Sí | Opcional | Es equivalente funcional de quien capturó el extra. Debe usarse para UC + Propio. |
| `teachers` | `created_by` | Sí para propiedad operativa | Opcional | Puede representar alta del docente, pero fiscal debe separarse por permisos. |
| `teacher_documents` | `uploaded_by` | Sí como auditoría documental | No para H02 | Controla quién subió la constancia, pero el acceso lo definen permisos documentales. |
| `payroll_runs` | `calculated_by`, `approved_by`, `reviewed_by`, `paid_by`, `status_updated_by` | Sí como auditoría de workflow | No | No reemplazar por campo genérico; cada campo tiene significado financiero. |
| `audit_log` | `actor_user_id` | Sí como actor de bitácora | No | Es auditoría de acción, no propiedad de registros operativos. |
| `app_users` | `created_by`, `updated_by` | Sí como auditoría de usuarios | No | No define coordinación; la relación formal será `user_coordinations`. |

Reglas:

- No activar reglas "Propio" donde solo exista `updated_by`.
- Si se decide agregar `created_by_user_id`, hacerlo con backfill controlado y sin eliminar campos actuales.
- El diseño de permisos debe distinguir propiedad (`created_by`/`captured_by`) de alcance (`user_coordinations`).

### 3.4 Validación de datos productivos

Consultas de validación sugeridas. No ejecutar en esta etapa.

Usuarios actuales:

```sql
SELECT u.id, u.email, u.display_name, COALESCE(u.legacy_username, '') AS legacy_username,
       r.code AS role_code, u.status
FROM app_users u
JOIN roles r ON r.id = u.role_id
ORDER BY r.code, u.email;
```

Roles y permisos actuales por rol:

```sql
SELECT r.code AS role_code, p.code AS permission_code
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
ORDER BY r.code, p.code;
```

Coordinaciones existentes:

```sql
SELECT id, name, status
FROM coordinations
ORDER BY lower(name);
```

Validar si ya existe `user_coordinations`:

```sql
SELECT to_regclass('public.user_coordinations') AS user_coordinations_table;
```

Usuarios coordinadores sin coordinación formal, cuando exista la tabla:

```sql
SELECT u.email, r.code AS role_code
FROM app_users u
JOIN roles r ON r.id = u.role_id
LEFT JOIN user_coordinations uc ON uc.user_id = u.id
WHERE r.code = 'coordinador'
GROUP BY u.email, r.code
HAVING count(uc.id) = 0
ORDER BY u.email;
```

Coordinaciones de tabla operativa inicial que no existen en catálogo:

```sql
-- Diseñar con una CTE o tabla temporal de staging.
WITH staging(coordination_name) AS (
  VALUES
    ('Rectoría'),
    ('Coordinación de Investigación'),
    ('ADETUR'),
    ('ARQ')
)
SELECT s.coordination_name
FROM staging s
LEFT JOIN coordinations c ON lower(c.name) = lower(s.coordination_name)
WHERE c.id IS NULL;
```

Duplicados o ambigüedades de catálogo:

```sql
SELECT lower(name) AS normalized_name, count(*) AS total
FROM coordinations
GROUP BY lower(name)
HAVING count(*) > 1;
```

Tablas sin autoría suficiente:

```sql
SELECT 'schedule_incidences' AS table_name,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_name = 'schedule_incidences'
           AND column_name IN ('created_by', 'created_by_user_id', 'captured_by')
       ) AS has_original_author;
```

Validar extras sin capturador:

```sql
SELECT count(*) AS extras_without_captured_by
FROM extra_hours
WHERE captured_by IS NULL;
```

Validar horarios sin creador:

```sql
SELECT count(*) AS schedules_without_created_by
FROM schedules
WHERE created_by IS NULL;
```

## 4. Diseño de migración de asignaciones usuario-coordinación

La migración debe convertir la tabla operativa aprobada en filas normalizadas antes de insertar en `user_coordinations`.

Reglas:

- `"Todas / Global"` = `scope_type = 'global'`, no insertar coordinación.
- `"No requiere coordinación operativa"` = `scope_type = 'no_operational_coordination'`, no insertar coordinación.
- Listas separadas por coma = una fila por coordinación.
- Todo `coordination_name` debe validarse contra `coordinations`.
- Si no existe, marcar `requiere_revision = true`.
- No crear coordinaciones automáticamente.
- Admin global no requiere filas.
- Dirección global no requiere filas para reportes globales.
- Coordinadores sí requieren al menos una fila válida.

Tabla normalizada esperada:

| email | rol_tecnico | coordination_name | scope_type | requiere_revision | observaciones |
|---|---|---|---|---|---|
| victor.yama@tecplayacar.edu.mx | admin | NULL | global | No | Alcance global por rol; no insertar `Todas / Global`. |
| alejandra.castellanos@tecplayacar.edu.mx | coordinador | Rectoría | coordination | Sí hasta validar | Insertar solo si existe en `coordinations`. |
| cristhian.alvarado@tecplayacar.edu.mx | coordinador | Coordinación de Investigación | coordination | Sí hasta validar | Insertar solo si existe en `coordinations`. |
| david.velazquez@tecplayacar.edu.mx | finanzas | NULL | no_operational_coordination | No | No insertar coordinación. |
| elsa.garcia@tecplayacar.edu.mx | direccion | Subdirección de vinculación y calidad | coordination | Sí hasta validar | Subdirección usa rol técnico `direccion`. |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | ADETUR | coordination | Sí hasta validar | Fila 1 de 4. |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | ARQ | coordination | Sí hasta validar | Fila 2 de 4. |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | SISCOM | coordination | Sí hasta validar | Fila 3 de 4. |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | DIGRAF | coordination | Sí hasta validar | Fila 4 de 4. |
| jesus.aguilar@tecplayacar.edu.mx | coordinador | Servicio Social | coordination | Sí hasta validar | Validar catálogo. |
| josue.delgado@tecplayacar.edu.mx | coordinador | Prácticas profesionales | coordination | Sí hasta validar | Validar catálogo. |
| leonardo.sayas@tecplayacar.edu.mx | coordinador | ADEM | coordination | Sí hasta validar | Fila 1 de 3. |
| leonardo.sayas@tecplayacar.edu.mx | coordinador | CINTER | coordination | Sí hasta validar | Fila 2 de 3. |
| leonardo.sayas@tecplayacar.edu.mx | coordinador | CONPUB | coordination | Sí hasta validar | Fila 3 de 3. |
| lidia.medina@tecplayacar.edu.mx | coordinador | Idiomas | coordination | Sí hasta validar | Validar catálogo. |
| mario.medina@tecplayacar.edu.mx | coordinador | Coordinación General | coordination | Sí hasta validar | Validar catálogo. |
| merit.bazan@tecplayacar.edu.mx | coordinador | PED | coordination | Sí hasta validar | Fila 1 de 2. |
| merit.bazan@tecplayacar.edu.mx | coordinador | MAESTRIAS | coordination | Sí hasta validar | Fila 2 de 2. |
| noadia.gonzalez@tecplayacar.edu.mx | direccion | NULL | global | No | Dirección global por rol/permisos. |
| oriana.nah@tecplayacar.edu.mx | coordinador | ENF | coordination | Sí hasta validar | Fila 1 de 4. |
| oriana.nah@tecplayacar.edu.mx | coordinador | NUT | coordination | Sí hasta validar | Fila 2 de 4. |
| oriana.nah@tecplayacar.edu.mx | coordinador | ESPECIALIDAD | coordination | Sí hasta validar | Fila 3 de 4. |
| oriana.nah@tecplayacar.edu.mx | coordinador | MDH | coordination | Sí hasta validar | Fila 4 de 4. |
| roxana.landero@tecplayacar.edu.mx | coordinador | Simulación Clínica | coordination | Sí hasta validar | Validar catálogo. |
| zulma.martinez@tecplayacar.edu.mx | coordinador | DE | coordination | Sí hasta validar | Fila 1 de 3. |
| zulma.martinez@tecplayacar.edu.mx | coordinador | CRIMI | coordination | Sí hasta validar | Fila 2 de 3. |
| zulma.martinez@tecplayacar.edu.mx | coordinador | MERC | coordination | Sí hasta validar | Fila 3 de 3. |
| zuly.carrillo@tecplayacar.edu.mx | rh | NULL | no_operational_coordination | No | RH no requiere coordinación operativa para fiscal. |

Criterios de `requiere_revision`:

- `true` si el correo no existe en `app_users`.
- `true` si el rol técnico no coincide con el rol productivo.
- `true` si `coordination_name` no existe exactamente o normalizado en `coordinations`.
- `true` si existen duplicados de coordinación.
- `true` si el usuario Coordinador queda sin fila de coordinación.
- `false` para `global` o `no_operational_coordination` cuando el rol corresponde.

Flujo de revisión manual:

1. Generar staging normalizado.
2. Validar correos contra `app_users`.
3. Validar roles contra `roles`.
4. Validar coordinaciones contra `coordinations`.
5. Entregar reporte de diferencias.
6. Corregir catálogo o staging manualmente.
7. Insertar solo filas válidas.
8. Mantener fallback activo.
9. Activar modo estricto solo después de pruebas por rol.

Condición para activar modo estricto:

- Todos los Coordinadores tienen al menos una coordinación formal.
- No hay coordinaciones inexistentes pendientes.
- Admin aprobó reporte de migración.
- Pruebas de acceso por rol pasan.
- Fallback queda instrumentado pero no como fuente principal.

## 5. Diseño de auth/context multi-coordinación

El diseño debe sustituir el patrón de `loadActorCoordination` único por un helper central que devuelva alcance completo del actor.

Tipo objetivo:

```ts
type ActorScope = {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  isAdmin: boolean;
  isProtectedSuperAdmin: boolean;
  hasGlobalAccess: boolean;
  coordinationIds: string[];
  coordinations: Array<{ id: string; name: string; isPrimary: boolean }>;
  usedFallback: boolean;
  fallbackReason?: string;
  requiresOperationalCoordination: boolean;
};
```

Carga de `user_coordinations`:

```sql
SELECT c.id, c.name, uc.is_primary
FROM user_coordinations uc
JOIN coordinations c ON c.id = uc.coordination_id
WHERE uc.user_id = $1
  AND c.status = 'ACTIVO'
ORDER BY uc.is_primary DESC, lower(c.name);
```

Roles globales:

- `admin`: global para todas las acciones administrativas.
- Super admin protegido: global.
- `finanzas`: global para fiscal/finanzas/workflow, no para captura académica.
- `direccion`: global para reportes agregados y detalle sin fiscal; operación académica debe respetar propiedad/asignación según módulo.
- `contador`/`contabilidad`: global solo para exportación/lectura mínima.

Usuario sin coordinación:

- Si la ruta requiere captura operativa y `coordinationIds.length === 0`, bloquear.
- Respuesta sugerida:

```json
{
  "error": "MISSING_COORDINATION",
  "message": "Tu usuario no tiene coordinaciones asignadas. Solicita configuración al administrador."
}
```

Fallback legacy:

- Se intenta únicamente si no hay relación formal.
- No inserta coordinaciones.
- Busca coincidencia por texto contra coordinación existente.
- Registra `usedFallback = true`.
- Genera log con usuario, rol, candidatos y coordinación resuelta.

Evitar `actorCoordination` único:

- API debe exponer `actorCoordinations` como arreglo.
- Rutas deben filtrar con `= ANY($n::uuid[])` o `IN (...)`.
- UI debe permitir seleccionar entre coordinaciones asignadas cuando aplique.

Funciones sugeridas:

```ts
async function loadActorScope(client: PoolClient, actor: SessionUser): Promise<ActorScope>;

function canUseGlobalScope(scope: ActorScope, action: string): boolean;

function requireOperationalScope(scope: ActorScope): string[];

function assertCoordinationAllowed(scope: ActorScope, coordinationId: string): void;

function isOwnRecord(scope: ActorScope, ownerUserId: string | null | undefined): boolean;
```

## 6. Diseño de fallback legacy

Feature flag sugerido:

- `LEGACY_COORDINATION_FALLBACK_ENABLED=true|false`
- Valor inicial recomendado: `true` durante migración.
- Modo estricto futuro: `false`, después de una quincena sin uso de fallback.

Condiciones de uso:

- El actor no es global para la acción.
- La acción requiere coordinación operativa.
- No existen filas en `user_coordinations`.
- La bandera está habilitada.
- Hay coincidencia exacta o normalizada contra `coordinations.name`.

Prohibiciones:

- No crear coordinaciones.
- No usar fallback si ya existen relaciones formales.
- No usar fallback para permisos fiscales o financieros.
- No usar fallback como criterio principal.

Logs mínimos:

```json
{
  "event": "LEGACY_COORDINATION_FALLBACK_USED",
  "actorUserId": "uuid",
  "actorEmail": "usuario@tecplayacar.edu.mx",
  "role": "coordinador",
  "candidateNames": ["Nombre visible", "legacy"],
  "resolvedCoordinationId": "uuid",
  "resolvedCoordinationName": "Coordinación",
  "module": "schedules"
}
```

Auditoría recomendada:

- Insertar evento en `audit_log` si no genera demasiado ruido.
- Si se decide no guardar en `audit_log`, al menos log estructurado en Cloud Run.

Retiro posterior:

1. Migrar todas las asignaciones.
2. Validar una quincena completa.
3. Confirmar cero usuarios bloqueados indebidamente.
4. Confirmar cero usos de fallback en logs.
5. Cambiar flag a `false`.
6. Desplegar limpieza posterior de código en fase separada.

Pruebas:

- Usuario con `user_coordinations` no usa fallback.
- Usuario sin relación formal usa fallback si está habilitado.
- Usuario sin relación formal queda bloqueado si fallback está deshabilitado.
- Fallback no crea coordinación.
- Uso de fallback aparece en logs/auditoría.

Riesgo de mantenerlo:

- Puede perpetuar acceso por texto si no se monitorea.
- Puede ocultar asignaciones faltantes.
- Debe tener fecha o condición clara de retiro.

## 7. Diseño de permisos H03

### Fiscal

Permisos:

- `fiscal.view`: ver expediente fiscal.
- `fiscal.manage`: editar RFC, correo, banco/tipo de pago.
- `fiscal.document.view`: ver/descargar constancia.
- `fiscal.document.manage`: subir/reemplazar constancia.

Rutas que deben cambiar:

- `PATCH /teachers/:id/fiscal`: de `teachers.manage|finance.view|fiscal.manage` a `fiscal.manage`.
- `POST /teachers/:id/documents/constancia`: de `teachers.manage|finance.view|fiscal.manage` a `fiscal.document.manage`.
- `GET /teachers/:id/documents/constancia/current`: de `teachers.manage|finance.view|reports.view|fiscal.manage` a `fiscal.document.view`.
- Respuesta de `GET /teachers`: debe ocultar o enmascarar RFC/banco/constancia si el actor no tiene permiso fiscal.

Compatibilidad temporal:

- Puede conservarse `fiscal.manage` para RH/Admin, pero separando documentos.
- No usar `finance.view` para acciones fiscales.
- No usar `teachers.manage` para fiscal.

### Finanzas

Permisos:

- `finance.view`: ver reportes financieros.
- `finance.export`: exportar CSV/PDF.
- `finance.workflow`: aprobar, marcar pagada, cancelar y cambiar estados.

Rutas que deben cambiar:

- Contexto de Finanzas: `finance.view`.
- Exportes financieros: `finance.export`.
- Cambio de estado de corrida: `finance.workflow`.
- Cancelación por Finanzas: `finance.workflow`.

Compatibilidad temporal:

- Durante transición, `admin` puede conservar todos los permisos.
- Finanzas debe recibir `finance.view`, `finance.export` y `finance.workflow`.
- Contador/Contabilidad debe recibir `finance.export` y lectura mínima, no workflow.

### Nómina

Permisos:

- `payroll.preview`: ver cálculo vivo sin guardar.
- `payroll.view`: ver nóminas guardadas/contexto.
- `payroll.finalize`: guardar corrida.

Rutas que deben cambiar:

- `/payroll/preview`: `payroll.preview`.
- `/payroll/context`: `payroll.view` y/o `payroll.preview` según contenido.
- `POST /payroll/runs`: `payroll.finalize`.
- Exportes de nómina: `finance.export` o permiso de reporte según alcance.

Garantías:

- `payroll.preview` nunca guarda.
- Coordinador nunca guarda nómina.
- Finanzas no guarda nómina salvo decisión futura; sí cambia estados con `finance.workflow`.

Evitar sobrecargas:

- `finance.view` no habilita fiscal ni workflow.
- `teachers.manage` no habilita fiscal.
- `reports.view` no habilita gestión fiscal.
- `payroll.calculate` debe migrarse conceptualmente a `payroll.preview` o quedar como compatibilidad deprecada.

## 8. Diseño backend por módulo

### 8.1 Users / Access

Archivos probables:

- `apps/api/src/routes/users.ts`
- `apps/api/src/auth.ts`
- `apps/api/src/types.ts`

Diseño:

- Extender create/update de usuario para aceptar `coordinationIds: string[]`.
- Validar que cada `coordinationId` exista y esté activa.
- No aceptar `"Todas / Global"` como coordinación.
- No aceptar `"No requiere coordinación operativa"` como coordinación.
- Permitir cero coordinaciones para roles globales o no operativos: Admin, Finanzas, RH, Contador, Contabilidad.
- Exigir al menos una coordinación para `coordinador`.
- Para `direccion`, permitir:
  - cero coordinaciones si el usuario tiene alcance global de reportes;
  - coordinaciones si también operará módulos académicos con restricción UC.
- Guardar cambios en transacción:
  1. Actualizar `app_users`.
  2. Reemplazar filas de `user_coordinations`.
  3. Insertar auditoría.
- Exponer en respuesta:

```ts
type AccessUser = {
  id: string;
  email: string;
  displayName: string;
  roleCode: string;
  status: string;
  coordinations: Array<{ id: string; name: string; isPrimary: boolean }>;
};
```

Eventos de auditoría:

- `USER_COORDINATION_ASSIGNED`
- `USER_COORDINATION_REMOVED`
- `USER_COORDINATION_PRIMARY_CHANGED`
- `PERMISSION_SET_CHANGED`

### 8.2 Academic context

Archivos probables:

- `apps/api/src/routes/academic-context.ts`
- `apps/api/src/types.ts`

Diseño:

- Reemplazar `loadActorCoordination` por `loadActorScope`.
- Mantener wrapper temporal si alguna ruta necesita compatibilidad, pero marcarlo como deprecated.
- Devolver lista de coordinaciones.
- Eliminar creación automática de coordinaciones desde contexto.
- Registrar fallback con `LEGACY_COORDINATION_FALLBACK_USED`.
- Bloquear operación si `requiresOperationalCoordination` y no hay alcance.

### 8.3 Horarios

Archivo probable:

- `apps/api/src/routes/schedules.ts`

Diseño:

- Reemplazar `getOrCreateCoordination` por validación de `coordinationId`.
- Si el actor no es global, `coordinationId` debe estar en `scope.coordinationIds`.
- Si el actor tiene múltiples coordinaciones, la UI/API debe enviar `coordinationId` explícito.
- Si el actor tiene una sola coordinación, el backend puede inferirla si el body no la trae.
- No crear coordinaciones automáticamente.
- Para editar/eliminar:
  - Admin: global.
  - Coordinador: coordinación asignada.
  - Dirección/Subdirección: propiedad si aplica (`created_by`/`created_by_user_id`) y regla aprobada.
- Mantener validaciones existentes de ciclo, docente activo, categoría, carga y tabulador.

### 8.4 Incidencias

Archivo probable:

- `apps/api/src/routes/incidences.ts`

Diseño:

- Validar acceso por la coordinación del horario asociado.
- Coordinador puede agregar/editar/eliminar incidencias si el horario pertenece a una de sus coordinaciones.
- Dirección/Subdirección:
  - Si la regla es "propio", no activar hasta resolver autoría.
  - Opción A: heredar propiedad desde `schedules.created_by`.
  - Opción B: agregar `created_by_user_id` a `schedule_incidences`.
  - Opción C: manejar propiedad por coordinación solamente, si operación lo aprueba.
- Recomendación: primera implementación usa coordinación del horario para Coordinador; para Dirección, definir en diseño de tareas si heredará propiedad del horario.
- No usar `updated_by` como autoría original.

### 8.5 Extras

Archivo probable:

- `apps/api/src/routes/extras.ts`

Diseño:

- Usar `extra_hours.captured_by` como propiedad funcional.
- Para crear:
  - Coordinador: `coordinationId` dentro de `scope.coordinationIds`.
  - Dirección/Subdirección: permitido según rol; si aplica propiedad, `captured_by = actor.userId`.
  - Admin: global.
- Para editar/eliminar:
  - Admin: global.
  - Coordinador: `coordinationId IN scope.coordinationIds` y `captured_by = actor.userId`.
  - Dirección/Subdirección: `captured_by = actor.userId` si se mantiene regla "propio".
- Eliminar `INSERT INTO coordinations`.
- Mantener validaciones de quincena, ventana de acceso, bloqueo por nómina y sobrecarga.

### 8.6 Teachers / Directorio / Fiscal

Archivo probable:

- `apps/api/src/routes/teachers.ts`

Diseño:

- Mantener `GET /teachers` global como decisión aprobada.
- Separar campos:
  - Operativos: nombre, categoría, estatus, coordinación, datos mínimos de contacto si se consideran operativos.
  - Fiscales sensibles: RFC, banco, tipo de pago, constancia, pendientes fiscales.
- Si el actor no tiene `fiscal.view`, devolver fiscal sensible enmascarado o vacío según contrato.
- `PATCH /teachers/:id`: solo datos operativos, no fiscal.
- `PATCH /teachers/:id/fiscal`: `fiscal.manage`.
- `POST /teachers/:id/documents/constancia`: `fiscal.document.manage`.
- `GET /teachers/:id/documents/constancia/current`: `fiscal.document.view`.
- Dirección/Subdirección puede operar Directorio según decisión, pero sin fiscal sensible.
- Coordinador no gestiona fiscal.
- Si Dirección elimina docentes solo propios, validar contra `teachers.created_by` o campo migrado.
- Si operación decide que Dirección puede eliminar globalmente en Directorio, debe quedar como permiso separado antes de implementar.

### 8.7 Payroll

Archivo probable:

- `apps/api/src/routes/payroll.ts`

Diseño:

- Crear o usar `payroll.preview` para `/payroll/preview`.
- Preview para Coordinador:
  - Solo lectura.
  - Filtrado por `scope.coordinationIds`.
  - Sin botones/acciones de guardado o workflow.
- Admin:
  - Puede guardar con `payroll.finalize`.
- Finanzas:
  - Puede ver contexto financiero según `finance.view`/`payroll.view`.
  - No guarda nómina salvo decisión futura.
- Dirección/Subdirección:
  - Puede ver reportes agregados/detalle sin fiscal.
- No cambiar fórmula de nómina.
- No tocar H01, `decimal.js`, ni reglas de redondeo.

### 8.8 Reports / Finance

Archivo probable:

- `apps/api/src/routes/reports.ts`

Diseño:

- Contexto/listas: `finance.view`.
- Exportes: `finance.export`.
- Workflow:
  - Aprobar: `finance.workflow`.
  - Marcar pagada: `finance.workflow`.
  - Cancelar: `finance.workflow`.
- Dirección/Subdirección:
  - Reportes agregados.
  - Detalle por docente de todas las coordinaciones sin RFC, banco, tipo de pago si se considera sensible, ni constancias.
- Contador/Contabilidad:
  - Solo exportar.
  - Lectura mínima necesaria para generar exportes.
  - No editar fiscal.
  - No workflow.
- Finanzas:
  - Fiscal y workflow completos según permisos explícitos.
- `finance.view` no debe bastar para exportar ni cambiar estados.

### 8.9 Audit

Archivo probable:

- `apps/api/src/routes/audit.ts`

Diseño:

- Reusar `audit_log`.
- Añadir eventos H02/H03.
- Permitir filtros por `module`, `event_type`, actor, target y rango de fechas si no existen.
- Registrar intentos no autorizados de alto riesgo:
  - Fiscal.
  - Workflow financiero.
  - Edición/eliminación de extra ajeno.
  - Bloqueo por falta de coordinación.
- Registrar uso de fallback legacy.

## 9. Diseño frontend por módulo

### 9.1 API types

Archivo probable:

- `apps/web/src/api.ts`

Diseño:

- Reemplazar o complementar:

```ts
actorCoordination: CoordinationOption | null;
```

con:

```ts
actorCoordinations: CoordinationOption[];
```

- Mantener compatibilidad temporal si el backend conserva `actorCoordination` durante una fase.
- Agregar tipos:

```ts
type UserCoordinationAssignment = {
  id: string;
  name: string;
  isPrimary: boolean;
};

type ActorScopeDto = {
  hasGlobalAccess: boolean;
  actorCoordinations: UserCoordinationAssignment[];
  usedFallback: boolean;
};
```

- Agregar permisos nuevos al contrato de sesión sin cambiar nombres de permisos existentes hasta la migración.

### 9.2 Auth store

Archivo probable:

- `apps/web/src/stores/auth.ts`

Helpers nuevos:

```ts
canPreviewPayroll
canFinanceWorkflow
canExportFinance
canViewFiscal
canManageFiscal
canViewFiscalDocuments
canManageFiscalDocuments
```

Reglas:

- `canManageFiscal` no debe depender de `finance.view`.
- `canFinanceWorkflow` no debe depender de `finance.view`.
- `canExportFinance` no debe depender solo de `reports.view`.
- `canPreviewPayroll` no debe permitir guardar.

### 9.3 Router

Archivo probable:

- `apps/web/src/router/index.ts`

Diseño:

- Proteger Finanzas con `finance.view` o permiso de reporte autorizado.
- Proteger exportaciones por acción, no solo ruta.
- Proteger Expediente Fiscal con `fiscal.view`.
- Permitir Nómina a Coordinador con `payroll.preview` en modo solo lectura.
- Evitar que rutas visibles impliquen botones de acción.

### 9.4 AccessView

Archivo probable:

- `apps/web/src/views/AccessView.vue`

Diseño:

- Agregar selector multi-coordinación.
- Mostrar coordinaciones asignadas por usuario.
- Permitir marcar una coordinación primaria si se mantiene `is_primary`.
- Validar:
  - Coordinador requiere al menos una coordinación.
  - Admin global no requiere coordinación.
  - Finanzas/RH/Contador/Contabilidad no requieren coordinación operativa.
  - Subdirección se guarda como `direccion`.
- Mostrar advertencia si un usuario operativo queda sin coordinación.
- No permitir crear coordinación desde Control de Accesos salvo que exista módulo/catálogo administrativo aprobado.

### 9.5 PayrollView

Archivo probable:

- `apps/web/src/views/PayrollView.vue`

Diseño:

- Modo Coordinador:
  - Solo lectura.
  - Preview filtrado por `actorCoordinations`.
  - Sin `Guardar nómina`.
  - Sin aprobar, pagar, cancelar.
- Modo Admin:
  - Guardar con `payroll.finalize`.
- Modo Finanzas:
  - Consulta y workflow financiero si corresponde desde Finanzas, no desde botón de guardado.
- Mostrar indicador de alcance:
  - "Vista: coordinaciones asignadas".
  - "Vista global" para roles globales.

### 9.6 FinanceReportsView

Archivo probable:

- `apps/web/src/views/FinanceReportsView.vue`

Diseño:

- Separar:
  - Ver: `finance.view`.
  - Exportar: `finance.export`.
  - Workflow: `finance.workflow`.
- Dirección/Subdirección:
  - Ver agregado.
  - Ver detalle por docente sin fiscal sensible.
  - No workflow.
- Contador/Contabilidad:
  - Ver lo mínimo para exportar.
  - Exportar.
  - No workflow.
- Finanzas:
  - Ver, exportar, workflow.
- Ocultar RFC, banco, constancias y pendientes detallados si no hay permiso fiscal.

### 9.7 FiscalRecordsView

Archivo probable:

- `apps/web/src/views/FiscalRecordsView.vue`

Diseño:

- Acceso base: `fiscal.view`.
- Editar RFC/correo/banco/tipo de pago: `fiscal.manage`.
- Vista/descarga de constancia: `fiscal.document.view`.
- Carga/reemplazo de constancia: `fiscal.document.manage`.
- RH y Finanzas gestionan.
- Coordinador no accede a fiscal.
- Dirección no accede a fiscal salvo permiso explícito futuro.
- Contador/Contabilidad no editan fiscal.

### 9.8 Schedules / Incidences / Extras

Archivos probables:

- `apps/web/src/views/SchedulesView.vue`
- `apps/web/src/views/IncidencesView.vue`
- `apps/web/src/views/ExtrasView.vue`

Diseño:

- Si `actorCoordinations.length > 1`, mostrar selector de coordinación en alta.
- Si `actorCoordinations.length === 1`, preseleccionar.
- Si `actorCoordinations.length === 0` y el rol requiere captura, bloquear con mensaje claro.
- Horarios:
  - Solo coordinaciones válidas.
- Incidencias:
  - Solo horarios dentro del alcance.
- Extras:
  - Editar/eliminar solo si propiedad + coordinación.
- No crear coordinaciones desde modales.

## 10. Diseño de auditoría

Eventos nuevos:

| Evento | Módulo | Actor | Target | Metadata mínima |
|---|---|---|---|---|
| `USER_COORDINATION_ASSIGNED` | Access | Admin que asigna | Usuario + coordinación | `userId`, `coordinationId`, `isPrimary`, `before`, `after` |
| `USER_COORDINATION_REMOVED` | Access | Admin que quita | Usuario + coordinación | `userId`, `coordinationId`, `before`, `after` |
| `USER_COORDINATION_PRIMARY_CHANGED` | Access | Admin | Usuario | `previousPrimaryId`, `newPrimaryId` |
| `LEGACY_COORDINATION_FALLBACK_USED` | Auth/Context | Usuario autenticado | Coordinación resuelta | `candidateNames`, `resolvedCoordinationId`, `module` |
| `USER_COORDINATION_REQUIRED_BUT_MISSING` | Auth/Context | Usuario autenticado | Usuario | `route`, `module`, `role` |
| `UNAUTHORIZED_FISCAL_ACTION` | Fiscal | Usuario que intenta | Docente/documento | `action`, `teacherId`, `permissionRequired` |
| `UNAUTHORIZED_FINANCE_WORKFLOW` | Finanzas | Usuario que intenta | Payroll run | `action`, `runId`, `permissionRequired` |
| `UNAUTHORIZED_EXTRA_EDIT` | Extras | Usuario que intenta | Extra | `extraId`, `capturedBy`, `coordinationId` |
| `PERMISSION_SET_CHANGED` | Access | Admin | Rol/usuario | `beforePermissions`, `afterPermissions` |

Reglas:

- Los intentos no autorizados de alto riesgo deben registrarse como warning o auditoría.
- No registrar datos fiscales sensibles completos en metadata.
- Usar IDs y descripciones mínimas.
- Registrar fallback al menos en logs estructurados.

## 11. Plan de pruebas técnico

### Admin

- Puede ver y operar globalmente.
- Puede asignar múltiples coordinaciones.
- Puede guardar nómina.
- Puede aprobar, marcar pagada y cancelar.
- Puede gestionar fiscal y documentos.
- Super admin protegido no queda bloqueado por no tener `user_coordinations`.

### Coordinador

- Con una coordinación: ve/crea/edita horarios de su coordinación.
- Con varias coordinaciones: puede seleccionar cualquiera de sus coordinaciones.
- Intenta crear horario fuera de UC: bloqueado.
- Agrega incidencias sobre horarios de su UC.
- Bloquea incidencias fuera de UC.
- Agrega extra dentro de UC.
- Edita/elimina extra propio dentro de UC.
- Bloquea extra ajeno.
- Ve Nómina preview solo lectura de UC.
- No guarda nómina.
- No aprueba/paga/cancela.
- No edita fiscal.
- No sube/descarga constancia.
- No ve Finanzas global.

### RH

- Ver expediente fiscal.
- Editar RFC, correo, banco/tipo de pago.
- Subir constancia.
- Descargar constancia.
- Exportar cumpleaños.
- No workflow financiero.
- No captura horarios/incidencias/extras si no tiene rol operativo adicional.

### Finanzas

- Ver Finanzas con `finance.view`.
- Exportar con `finance.export`.
- Aprobar con `finance.workflow`.
- Marcar pagada con `finance.workflow`.
- Cancelar con `finance.workflow`.
- Gestionar fiscal con permisos fiscales.
- Confirmar que `finance.view` solo no permite workflow ni fiscal.

### Dirección/Subdirección

- Subdirección se autentica como `direccion`.
- Ve reportes agregados.
- Ve detalle por docente global sin RFC/banco/constancias.
- Opera horarios/incidencias/extras/directorio según reglas aprobadas.
- Edita/elimina propios cuando aplique.
- No cambia estados financieros.
- No edita fiscal.
- No guarda nómina.

### Contador/Contabilidad

- Contabilidad se comporta como Contador.
- Puede exportar con `finance.export`.
- No edita fiscal.
- No sube/descarga constancias salvo permiso explícito futuro.
- No workflow.
- No guarda nómina.

### Usuario sin coordinación

- Coordinador sin UC intenta capturar horario: bloqueado.
- Intenta incidencia: bloqueado.
- Intenta extra: bloqueado.
- Mensaje pide configuración al Admin.
- No se crea coordinación.

### Fallback legacy

- Usuario con UC no usa fallback.
- Usuario sin UC y flag activo usa fallback, registra log y no crea coordinación.
- Usuario sin UC y flag inactivo queda bloqueado.
- Durante una quincena se monitorean logs para confirmar cero uso antes del retiro.

### Propiedad

- `schedules.created_by` o campo migrado limita edición propia si aplica.
- `extra_hours.captured_by` limita extra propio.
- `schedule_incidences.updated_by` no se usa como autoría original.
- Dirección no edita registros ajenos si la regla es Propio.

### Permisos fiscales/documentales

- `fiscal.view` permite ver.
- `fiscal.manage` permite editar RFC/correo/banco/tipo de pago.
- `fiscal.document.view` permite descargar.
- `fiscal.document.manage` permite subir.
- Usuario sin permiso recibe 403 y evento de auditoría.

### Nómina preview

- `payroll.preview` muestra cálculo vivo.
- No aparece botón guardar si no hay `payroll.finalize`.
- Coordinador ve solo UC.
- Dirección ve agregado/detalle sin fiscal.
- No se persiste nada desde preview.

## 12. Plan de implementación por fases

### Fase 1: DB + permisos + validación de datos

Objetivo:

- Preparar modelo y permisos sin activar modo estricto.

Archivos probables:

- `database/*.sql`
- `docs/auditoria/*`
- `docs/diseno/*`

Tareas:

- Crear migración para `user_coordinations`.
- Crear permisos faltantes.
- Preparar seeds por rol.
- Validar usuarios, roles y permisos reales en Cloud SQL.
- Validar coordinaciones existentes.
- Validar autoría por tabla.
- Generar reporte de staging normalizado.

Riesgos:

- Coordinaciones inexistentes.
- Roles productivos distintos a seeds.
- Datos sin autoría.

Pruebas:

- Consultas de validación.
- Instalación en ambiente de revisión.
- Rollback de migración probado.

Criterio de cierre:

- Admin aprueba reporte DB/permisos/staging.

### Fase 2: Auth/context multi-coordinación

Objetivo:

- Resolver alcance del actor por relación formal.

Archivos probables:

- `apps/api/src/auth.ts`
- `apps/api/src/routes/academic-context.ts`
- `apps/api/src/types.ts`

Tareas:

- Implementar `loadActorScope`.
- Cargar `user_coordinations`.
- Soportar roles globales.
- Instrumentar fallback.
- Mantener compatibilidad temporal.

Riesgos:

- Bloqueo de usuarios operativos.
- Fallback usado sin visibilidad.

Pruebas:

- Actor global.
- Coordinador con una UC.
- Coordinador con varias UC.
- Usuario sin UC.
- Fallback activo/inactivo.

Criterio de cierre:

- Rutas pueden consultar alcance multi-coordinación sin cambiar reglas de negocio.

### Fase 3: Módulos operativos

Objetivo:

- Aplicar UC y propiedad en Horarios, Incidencias, Extras y Directorio.

Archivos probables:

- `apps/api/src/routes/schedules.ts`
- `apps/api/src/routes/incidences.ts`
- `apps/api/src/routes/extras.ts`
- `apps/api/src/routes/teachers.ts`

Tareas:

- Eliminar creación automática de coordinaciones.
- Validar `coordinationId` contra UC.
- Usar `captured_by` para extras propios.
- Definir incidencias por coordinación/herencia.
- Separar Directorio operativo de fiscal.

Riesgos:

- Incidencias sin autoría original.
- Dirección con reglas de propiedad ambiguas.

Pruebas:

- CRUD por rol y UC.
- Edición propia/ajena.
- Bloqueos 403 esperados.

Criterio de cierre:

- Operación académica funciona sin resolución por texto como fuente principal.

### Fase 4: Fiscal / Finanzas / Nómina preview

Objetivo:

- Separar permisos H03 en rutas críticas.

Archivos probables:

- `apps/api/src/routes/teachers.ts`
- `apps/api/src/routes/payroll.ts`
- `apps/api/src/routes/reports.ts`

Tareas:

- Aplicar `fiscal.view/manage/document.*`.
- Aplicar `finance.view/export/workflow`.
- Aplicar `payroll.preview`.
- Ocultar fiscal sensible para Dirección.
- Contador/Contabilidad solo exportan.

Riesgos:

- Finanzas pierde workflow si no se asigna permiso.
- Reportes muestran fiscal sensible por accidente.

Pruebas:

- Matriz rol-ruta-acción.
- Exportes por rol.
- Workflow financiero.
- Preview Coordinador.

Criterio de cierre:

- H03 queda separado en backend.

### Fase 5: Frontend

Objetivo:

- Reflejar permisos nuevos y multi-coordinación en UI.

Archivos probables:

- `apps/web/src/api.ts`
- `apps/web/src/stores/auth.ts`
- `apps/web/src/router/index.ts`
- vistas principales.

Tareas:

- `actorCoordinations[]`.
- Nuevos helpers de permisos.
- AccessView multi-coordinación.
- Mensajes de bloqueo.
- Ocultar botones no permitidos.
- Vista fiscal/finanzas separada.

Riesgos:

- UI muestra botón que backend bloquea.
- Usuario interpreta vista global como permiso de edición.

Pruebas:

- Typecheck.
- Build.
- Pruebas manuales por rol.

Criterio de cierre:

- UI coincide con permisos backend.

### Fase 6: Pruebas

Objetivo:

- Validar regresión completa H02/H03.

Tareas:

- Ejecutar typecheck/build.
- Probar matriz de roles.
- Probar multi-coordinación.
- Probar fiscal/documentos.
- Probar Finanzas workflow.
- Probar Nómina preview sin guardar.
- Confirmar H01 sin cambios.

Riesgos:

- Falta de suite automatizada H04.

Pruebas:

- Manuales documentadas.
- Scripts si se crean en fase posterior.

Criterio de cierre:

- Admin valida resultados.

### Fase 7: Deploy controlado

Objetivo:

- Publicar cambios con ventana y rollback.

Tareas:

- Backup DB.
- Deploy API.
- Deploy Hosting.
- Healthcheck.
- Logs iniciales.
- Validación con usuarios reales.

Riesgos:

- Config productiva incompleta.
- Permisos reales distintos a revisión.

Pruebas:

- `/api/health`.
- Login por rol.
- Acción bloqueada y permitida por rol.

Criterio de cierre:

- Monitoreo inicial sin errores críticos.

### Fase 8: Monitoreo de una quincena

Objetivo:

- Confirmar estabilidad antes de retirar fallback.

Tareas:

- Revisar logs de fallback.
- Revisar usuarios bloqueados.
- Revisar errores 403 esperados/no esperados.
- Validar captura de Horarios/Incidencias/Extras.
- Validar Nómina preview y Finanzas.

Riesgos:

- Fallback oculta relación faltante.

Pruebas:

- Revisión operativa por coordinación.

Criterio de cierre:

- Una quincena completa sin uso de fallback ni bloqueos indebidos.

### Fase 9: Retiro posterior de fallback

Objetivo:

- Retirar dependencia legacy por texto.

Tareas:

- Cambiar flag a false.
- Validar operación.
- En fase posterior, eliminar código de fallback.

Riesgos:

- Usuario rezagado sin UC.

Pruebas:

- Login/captura por todos los usuarios operativos.

Criterio de cierre:

- Cero uso de fallback y aprobación Admin.

## 13. Rollback

### Migración DB

- No eliminar columnas existentes.
- Crear backup antes de migración.
- `user_coordinations` puede quedar sin ser usada si se desactiva el feature flag.
- No borrar `display_name` ni `legacy_username`.
- No borrar permisos existentes durante primera fase.

### Permisos

- Mantener tabla de permisos anterior.
- Si un rol pierde acceso, reinsertar asignación anterior de `role_permissions`.
- Documentar diff de permisos antes/después.
- No remover `finance.view`, `teachers.manage` ni `reports.view` en primera migración; solo dejar de usarlos para acciones sensibles.

### Auth/context

- Feature flag para modo estricto:
  - `USER_COORDINATIONS_STRICT_MODE=false` inicial.
  - Si falla, volver a fallback legacy.
- Logs deben indicar si el bloqueo fue por UC o permisos.

### Frontend

- Revertir deploy de Firebase Hosting si UI bloquea operación.
- Backend debe seguir protegiendo permisos aunque UI falle.

### Workflow financiero

- Si `finance.workflow` falla, permitir rollback temporal a revisión manual o permisos anteriores bajo control Admin.
- No modificar corridas históricas.

### Fallback

- Mantener fallback durante transición.
- No retirarlo hasta cumplir condición aprobada.
- Si hay bloqueo masivo, fallback puede sostener operación temporal mientras se corrigen asignaciones.

Validación posterior:

- Healthcheck API.
- Login Admin, Coordinador, RH, Finanzas, Dirección, Contador.
- Acción permitida por rol.
- Acción prohibida por rol.
- Revisión de logs.

## 14. Riesgos residuales

Riesgos que pueden permanecer incluso después del diseño:

- H04 falta de pruebas automatizadas puede limitar seguridad de cambios.
- H05 migraciones SQL sin control formal debe resolverse para despliegues repetibles.
- H06 Apps Script legacy puede seguir generando confusión si no se congela formalmente.
- Dirección/Subdirección con reglas de propiedad puede requerir decisión adicional si hay tablas sin autoría confiable.
- `GET /teachers` global seguirá siendo una decisión consciente; debe mantenerse cuidado especial en fiscal sensible.
- Contador/Contabilidad con "lectura mínima necesaria" requiere precisar qué campos aparecen en cada export.
- Fallback legacy temporal conserva riesgo residual hasta retirarse.
- Datos históricos sin autoría pueden impedir aplicar regla "Propio" retroactivamente.
- Si Cloud SQL productivo difiere de migraciones del repo, el plan de seed debe ajustarse.

## 15. Checklist antes de implementar

- [ ] Admin aprobó diseño técnico.
- [ ] Backup DB definido.
- [ ] Ventana de despliegue definida.
- [ ] Catálogo `coordinations` validado.
- [ ] Usuarios y roles reales validados en Cloud SQL.
- [ ] Permisos reales validados en Cloud SQL.
- [ ] Asignaciones usuario-coordinación normalizadas.
- [ ] Coordinaciones inexistentes resueltas.
- [ ] Usuarios operativos sin coordinación resueltos.
- [ ] Autoría por tabla validada.
- [ ] Decisión sobre `schedule_incidences` documentada para regla "Propio".
- [ ] Seed de permisos nuevos revisado.
- [ ] Feature flags definidos.
- [ ] Logs/auditoría de fallback definidos.
- [ ] Matriz de pruebas por rol preparada.
- [ ] Pruebas de fiscal/documentos preparadas.
- [ ] Pruebas de workflow financiero preparadas.
- [ ] Pruebas de Nómina preview preparadas.
- [ ] Rollback DB definido.
- [ ] Rollback API/Hosting definido.
- [ ] Confirmación explícita de no tocar H01.

## 16. Entrega final

Este diseño técnico deja listo el mapa de implementación H02/H03 para dividirlo en tareas por fase.

Resumen:

- Se diseña `user_coordinations` como fuente formal de usuario-coordinación.
- Se soportan múltiples coordinaciones por usuario desde el primer corte.
- Se conserva fallback legacy temporal, instrumentado y sin creación automática.
- Se separan permisos fiscales, documentales, financieros, workflow y preview de nómina.
- Se reconoce que `created_by_user_id` no existe necesariamente y debe mapearse por tabla.
- Se distingue coordinación asignada de propiedad del registro.
- Se preserva `GET /teachers` global sin convertirlo en permiso de edición global.
- Se protege información fiscal sensible con permisos explícitos.
- Se mantiene H01 fuera de alcance.

Riesgos bloqueantes antes de implementar:

- Validar datos productivos reales en Cloud SQL.
- Resolver coordinaciones inexistentes en la tabla operativa.
- Definir comportamiento de propiedad para `schedule_incidences`.
- Crear permisos faltantes antes de cambiar rutas.
- Asegurar que Finanzas recibe `finance.workflow`.
- Asegurar que Coordinador recibe `payroll.preview` sin `payroll.finalize`.

Recomendación:

- Puede pasarse a desglose de tareas de implementación después de aprobación Admin de este diseño técnico.
- La primera tarea implementable debe ser DB/permisos/validación de datos, no frontend.

Verificación de consistencia:

- El diseño no contradice la SPEC.
- El diseño respeta decisiones humanas aprobadas.
- El diseño no modifica H01.
- El diseño no retira fallback en la primera fase.
- El diseño no crea rol técnico `subdireccion`.
- El diseño no trata `"Todas / Global"` como coordinación real.
- El diseño no trata `"No requiere coordinación operativa"` como coordinación real.
- El diseño no permite a Coordinador guardar nómina.
- El diseño no permite a Coordinador editar fiscal.
- El diseño no permite a Contador editar fiscal.
- El diseño no permite a Dirección cambiar estados financieros.
- El diseño sí permite a Finanzas aprobar, marcar pagada y cancelar con `finance.workflow`.
- El diseño sí permite a Coordinador ver Nómina preview solo lectura por `user_coordinations`.
- El diseño soporta múltiples coordinaciones por usuario desde el primer corte.
- El diseño distingue coordinación de propiedad del registro.
- El diseño reconoce que `created_by_user_id` no existe necesariamente en todas las tablas.

