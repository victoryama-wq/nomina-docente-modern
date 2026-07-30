# H22 - Diagnostico de Importacion CSV de Docentes

Fecha: 2026-07-28
Última actualización: 2026-07-30

Estado: diagnostico cerrado; H22-F4 y smoke autenticado humano aprobados.
Implementación local/test completada; migración y despliegue productivos
pendientes.

## 1. Resumen ejecutivo

H22 puede construirse sobre la arquitectura actual sin una migracion inicial:

- Fastify ya concentra Directorio en `routes/teachers.ts`;
- Vue usa `TeachersView.vue`, `TeacherModal.vue` y `api.ts`;
- `teachers.created_by` es la fuente tecnica de propiedad de edicion;
- H11 aporta serializacion CSV UTF-8 con BOM y CRLF;
- H21 ya instalo y usa `@fast-csv/parse`;
- PostgreSQL aporta transacciones, `FOR UPDATE` y advisory locks;
- `audit_log` permite evidencia sin tabla nueva.

La ruta recomendada es `/teachers/import/*`, aunque la pestaña se muestre en
Catálogos.

No se identifico necesidad obligatoria de migracion para H22-F1. La decision
nominal se cerro despues del diagnostico original: la plantilla usa tres
componentes y el backend deriva `full_name` y `normalized_name`. Permanecen
pendientes el rol RH, el bloqueo de inactivaciones, la estrategia de unicidad
concurrente del identificador y la revalidacion productiva read-only.

### 1.1 Decision humana posterior a H22-F0

El diagnostico original identifico correctamente que `teachers` conserva
`first_names`, `paternal_last_name` y `maternal_last_name`, mientras el primer
diseño de plantilla proponia una sola columna `nombre`.

La decision aprobada elimina esa incertidumbre:

```csv
id,identificador,nombres,apellido_paterno,apellido_materno,responsable_operativo_email,categoria,telefono,ubicacion,estatus
```

Mapeo:

```text
nombres            -> teachers.first_names
apellido_paterno   -> teachers.paternal_last_name
apellido_materno   -> teachers.maternal_last_name
```

El backend reconstruye `full_name` y recalcula `normalized_name`; ninguna de
esas columnas se acepta o exporta en el CSV. La semantica queda alineada con el
formulario individual de Directorio y no requiere inferir apellidos.

## 2. Evidencia y limites del diagnostico

Se revisaron:

- documentos obligatorios H02/H03, H05, H13, H17, H19, H20 y H21;
- `database/001_initial_schema.sql` y migraciones posteriores;
- esquema de `nomina_docente_test` mediante una transaccion `READ ONLY`;
- rutas Fastify, auth, tipos y helpers CSV/import;
- Vue, router, store de auth y cliente API.

Se intento abrir Cloud SQL productivo exclusivamente mediante Cloud SQL Auth
Proxy para consultas read-only. La autenticacion institucional expiro antes de
abrir una sesion PostgreSQL:

```text
invalid_grant / invalid_rapt
```

Por tanto:

- no se ejecuto ninguna consulta productiva;
- no se abrio transaccion en `nomina_docente`;
- no hubo DDL ni DML;
- las comprobaciones de duplicados productivos deben repetirse tras renovar la
  autenticacion, antes de H22-F1.

## 3. Diagnostico del modulo Directorio

### 3.1 Frontend

| Elemento | Ubicacion / comportamiento |
|---|---|
| Ruta | `/docentes`, nombre `teachers` |
| Vista | `apps/web/src/views/TeachersView.vue` |
| Modal | `apps/web/src/components/modals/TeacherModal.vue` |
| Cliente API | `apps/web/src/api.ts` |
| Acceso a vista | `canViewTeachers` |
| Alta/edicion | `canManageTeachers` / `teachers.manage` |
| Propiedad UI | Admin global; otro actor solo si `teacher.createdById === session.id` |
| Lectura coordinador | Todos los docentes, con detalle operativo read-only |
| Fiscal UI | Solo con helpers `canViewFiscal` / `canManageFiscal` |
| Inactivos | La API devuelve todos por defecto; la UI inicia con filtro `TODOS` |

La busqueda actual de Directorio es local, por `toLowerCase()` sobre un
`haystack`. No es consistentemente tolerante a acentos. La API acepta `q`, pero
usa `lower(...) LIKE` sobre nombre, identificador y coordinacion; no consulta
`normalized_name`.

### 3.2 Endpoints vigentes

| Operacion | Endpoint | Guarda |
|---|---|---|
| Listado | `GET /teachers` | Cualquiera de `teachers.manage`, `finance.view`, `reports.view`, `fiscal.view` |
| Detalle | No existe endpoint dedicado | La UI reutiliza la fila sanitizada del listado |
| Alta | `POST /teachers` | `teachers.manage` |
| Edicion operativa | `PATCH /teachers/:id` | `teachers.manage` + propiedad/alcance backend |
| Edicion fiscal | `PATCH /teachers/:id/fiscal` | `fiscal.manage` |
| Baja fisica | `DELETE /teachers/:id` | Solo Admin y sin dependencias |
| Export activo fiscal | `GET /teachers/export/active` | `fiscal.view` |
| Export historial | `GET /teachers/export/history` | `audit.view` |
| Constancia | `/teachers/:id/documents/*` | permisos fiscales documentales |

H22 no debe reutilizar los exportables actuales porque contienen campos
fiscales. Debe seleccionar explicitamente solo las diez columnas aprobadas.

### 3.3 Alta/edicion actual

El body individual exige:

- `firstNames`;
- `paternalLastName`;
- `category`;
- `status`.

Permite ademas grado, apellidos, ubicacion, comentario, observacion,
coordinacion, telefono e identificador.

Campos fiscales se bloquean para actores sin `fiscal.manage`.

En alta:

- `created_by = actor.id`;
- `updated_by = actor.id`.

En edicion:

- `created_by` no cambia;
- `updated_by = actor.id`;
- `updated_at = now()`.

H22 debe cambiar `created_by` solo ante una reasignacion explicita y no usar
`updated_by` como propiedad.

## 4. Esquema real de `teachers`

La estructura fue confirmada contra la migracion base y
`nomina_docente_test`.

| Campo | Tipo | Nullable | Default | Unico | Sensible | Uso |
|---|---|---:|---|---:|---:|---|
| `id` | uuid | No | `gen_random_uuid()` | Si, PK | No | Identidad tecnica |
| `legacy_row_number` | integer | Si | - | No | No | Trazabilidad legacy |
| `legacy_teacher_id` | text | Si | - | No | No | Trazabilidad legacy |
| `full_name` | text | No | - | No | No | Nombre oficial visible |
| `normalized_name` | text | No | - | Si | No | Busqueda/colision |
| `first_names` | text | No | `''` | No | No | Componente de nombre |
| `paternal_last_name` | text | No | `''` | No | No | Componente de nombre |
| `maternal_last_name` | text | No | `''` | No | No | Componente de nombre |
| `degree` | text | No | `''` | No | No | Operativo |
| `payment_type` | text | No | `''` | No | Si | Fiscal/financiero, excluido |
| `category` | text | No | `''` | No | No | Operativo, `''/V/M/N` |
| `location` | text | No | `''` | No | No | Operativo |
| `comment` | text | No | `''` | No | No | Operativo |
| `observation` | text | No | `''` | No | No | Operativo |
| `coordination_id` | uuid | Si | - | No | No | Relacion heredada; excluida |
| `phone` | text | No | `''` | No | Contacto | Operativo aprobado |
| `email` | text | No | `''` | No | Si | Correo fiscal, excluido |
| `rfc` | text | No | `''` | No | Si | Fiscal, excluido |
| `external_identifier` | text | No | `''` | No | No | Identificador institucional |
| `bank_detail` | text | No | `''` | No | Si | Financiero, excluido |
| `status` | `teacher_status` | No | `ACTIVO` | No | No | `ACTIVO/INACTIVO` |
| `created_at` | timestamptz | No | `now()` | No | No | Auditoria tecnica |
| `created_by` | uuid | Si | - | FK | No | Responsable/propiedad |
| `updated_at` | timestamptz | No | `now()` | No | No | Control de concurrencia |
| `updated_by` | uuid | Si | - | FK | No | Ultimo actor, no propiedad |

Hallazgos:

- `normalized_name` tiene unicidad fisica.
- `external_identifier` no tiene restriccion ni indice unico.
- Categoria admite `''`, `V`, `M`, `N` en BD; H22 exige `V/M/N` para altas.
- Los campos de nombre descompuesto tienen default vacio, pero la UI
  individual los usa para reconstruir `full_name`.
- No existe campo separado `responsable_operativo`.

## 5. Campos H22

### 5.1 Permitidos

- `external_identifier`;
- `first_names`, recibido como `nombres`;
- `paternal_last_name`, recibido como `apellido_paterno`;
- `maternal_last_name`, recibido como `apellido_materno`;
- `full_name`, derivado por backend;
- `normalized_name`, derivado por backend y nunca capturado;
- `created_by`, resuelto por correo;
- `category`;
- `phone`;
- `location`;
- `status`.

### 5.2 Excluidos

- `payment_type`;
- `email`;
- `rfc`;
- `bank_detail`;
- `teacher_documents`;
- `coordination_id`;
- `updated_by`;
- campos legacy;
- datos de Horarios, Incidencias, Extras, Nomina, Finanzas y snapshots.

El CSV tampoco acepta ni exporta columnas llamadas `nombre`, `full_name` o
`normalized_name`.

## 6. Responsable operativo

La fuente vigente es:

```text
teachers.created_by -> app_users.id
```

Efecto actual:

- Admin edita globalmente.
- Coordinador y Direccion editan si `created_by` coincide con su usuario.
- Otros roles pasan por validacion de alcance/coordinacion, no por propiedad
  `created_by`.
- La UI aplica la misma regla Admin/`createdById`.

| Rol | `teachers.manage` actual | Propiedad por `created_by` | Propuesta H22 | Decision |
|---|---:|---:|---|---|
| Admin | Si | Global | Permitido | Cerrada |
| Coordinador | Si | Si | Permitido | Cerrada |
| Direccion | Si | Si | Permitido | Cerrada por regla y precedente H17/H19 |
| RH | Si | No en la rama de propiedad | Excluido | Cerrada en H22-F1A |
| Finanzas | No | No | Denegado | Cerrada |
| Contador | No | No | Denegado | Cerrada |
| Contabilidad | No | No | Denegado | Cerrada |

La sesion local/test confirma que `teachers.manage` existe para Admin,
Coordinador, Direccion y RH. H22 no debe confundir permiso de gestion con rol
valido para propiedad. La decision final permite solo `admin`, `coordinador` y
`direccion`; RH se clasifica como `RESPONSABLE_NO_AUTORIZADO`.

## 7. Dependencias historicas

Relaciones directas:

| Tabla | Relacion |
|---|---|
| `schedules` | FK `teacher_id -> teachers.id` |
| `extra_hours` | FK `teacher_id -> teachers.id` |
| `payroll_lines` | FK `teacher_id -> teachers.id` |
| `teacher_documents` | FK `teacher_id -> teachers.id`, cascade solo ante DELETE |

Relaciones indirectas/snapshot:

- `schedule_incidences` depende de `schedules`;
- `payroll_schedule_details` guarda `teacher_id` y nombre snapshot;
- `payroll_extra_details` guarda `teacher_id` y nombre snapshot;
- `audit_log` usa `entity_type/entity_id`;
- Reportes/Finanzas consultan lineas y snapshots.

Consecuencias:

- conservar `teachers.id` mantiene relaciones;
- no hacer DELETE evita perdida/cascade de documentos;
- cambiar campos operativos vivos no debe reescribir snapshots;
- un cambio de categoria no recalcula Nomina guardada;
- inactivar no elimina historicos;
- un docente con actividad vigente no debe inactivarse por CSV sin resolver
  dependencias.

## 8. Matching y duplicados

Matching aprobado:

1. UUID;
2. identificador institucional;
3. nombre normalizado como advertencia.

Estado de evidencia actualizado por H22-F1A:

- en `nomina_docente_test` no hay identificadores no vacios duplicados;
- en `nomina_docente_test` no hay nombres normalizados duplicados;
- ese seed contiene solo dos docentes y no sustituye validacion productiva;
- H19 documento cero duplicados tras su ejecucion productiva;
- produccion tiene 217 docentes, 69 identificadores no vacios y cero grupos
  duplicados por `upper(btrim(external_identifier))`;
- `teachers_normalized_name_key` permanece como `UNIQUE (normalized_name)`.

Riesgo:

H22-F1A agrega en local/test la unicidad fisica mediante
`teachers_external_identifier_unique_idx`. Las rutas individuales confian en
PostgreSQL y manejan el `23505` exacto. El futuro importador conserva su
advisory lock propio.

## 9. Diseño API

Decision final:

```text
GET  /teachers/import/template
POST /teachers/import/preview
POST /teachers/import/apply
```

Todos exclusivos de Admin.

Se descarta `/catalogs/teachers/import` porque:

- las reglas y auditoria de docentes ya viven en `teachers`;
- la URL visual no debe fragmentar el dominio backend;
- reduce duplicacion de sanitizacion y consultas.

Contrato de template:

```text
scope=blank|active|all
```

Contrato conceptual de preview:

```ts
{
  fileName: string;
  base64Data: string;
}
```

Respuesta conceptual:

```ts
{
  fileSha256: string;
  teachersFingerprint: string;
  responsibleUsersFingerprint: string;
  totalRows: number;
  summary: Record<string, number>;
  hasBlockingErrors: boolean;
  requiresSecondConfirmation: string[];
  rows: Array<{
    rowNumber: number;
    teacherId: string | null;
    teacherName: string;
    action: string;
    blocking: boolean;
    current: Record<string, string | null>;
    proposed: Record<string, string | null>;
    message: string;
  }>;
}
```

Apply recibe otra vez archivo, hashes y confirmaciones. El backend no acepta
acciones precalculadas por el frontend.

## 10. Diseño frontend

Ubicacion:

```text
Catalogos -> Importacion de docentes
```

Solo Admin puede ver la pestaña, descargar plantillas, ejecutar preview o
Apply.

Flujo:

```text
Descargar -> Editar -> Seleccionar -> Preview -> Revisar ->
Confirmar -> Apply -> Resultado
```

La pestaña debe seguir los patrones de H21:

- descarga principal de activos;
- descarga `all` secundaria y explicita;
- selector de archivo;
- tarjetas;
- filtro por estado;
- tabla por fila;
- before/after;
- bloqueos visibles;
- Apply deshabilitado con errores;
- confirmacion reforzada;
- limpieza del estado despues del resultado.

## 11. Seguridad y concurrencia

- Exclusivo Admin en frontend y backend.
- No usar solo `teachers.manage`.
- Maximo 1 MiB y 5,000 filas.
- SHA-256 del archivo.
- Fingerprints de docentes y responsables.
- Reparseo en Apply.
- Advisory lock especifico.
- `FOR UPDATE` en docentes y responsables.
- Transaccion unica.
- Cero aplicacion parcial.
- `SIN_CAMBIOS` no escribe.
- Campos fiscales nunca se seleccionan para template ni se aceptan en CSV.
- No guardar CSV completo.

## 12. Auditoria propuesta

Eventos:

- `TEACHER_IMPORT_APPLIED`;
- `TEACHER_CREATED`;
- `TEACHER_UPDATED`;
- `TEACHER_RESPONSIBLE_REASSIGNED`;
- `TEACHER_STATUS_CHANGED`.

El evento agregado incluye SHA-256, archivo sanitizado y conteos. Los eventos
por docente incluyen solo before/after operativo.

## 13. Reutilizacion tecnica

Disponible sin dependencias nuevas:

- `@fast-csv/parse@4.3.6`;
- helper CSV H11;
- `crypto.createHash`;
- `withTransaction`;
- `audit_log`;
- Vitest y `app.inject()`;
- PostgreSQL real `nomina_docente_test`;
- fixtures de actores H04.

## 14. Necesidad de migracion

La decision posterior H22-F1A aprueba
`014_h22_teacher_external_identifier_unique.sql`.

La migracion crea solo el indice unico parcial sobre
`upper(btrim(external_identifier))`, excluye vacios y no modifica filas. Fue
aplicada mediante H05 exclusivamente a `nomina_docente_test`. Produccion
conserva 16 migraciones registradas y no recibio `014`.

## 15. Pruebas propuestas

Backend/API:

- tres templates y sus permisos;
- diez encabezados exactos y ausencia fiscal;
- export correcto de los tres componentes nominales;
- ausencia de `full_name` y `normalized_name` en CSV;
- alta con nombres/apellido paterno y apellido materno opcional;
- actualizacion separada de cada componente;
- vacio conserva el componente existente;
- reconstruccion de `full_name` y `normalized_name`;
- acentos/`Ñ` preservados y espacios duplicados eliminados;
- colision normalizada bloqueante;
- comportamiento equivalente al formulario individual;
- parser/encoding/limites;
- matching;
- responsables;
- acciones y bloqueos;
- preview sin escrituras;
- Apply atomico y obsoleto;
- auditoria sanitizada;
- dependencias de inactivacion;
- concurrencia;
- snapshots intactos.

Frontend:

- pestaña solo Admin;
- tres descargas;
- selector/preview;
- tarjetas/tabla/filtros;
- before/after;
- segunda confirmacion;
- Apply deshabilitado;
- errores 400/403/409/500;
- limpieza y recarga final.

Integracion PostgreSQL:

- alta, actualizacion, reasignacion, inactivacion/reactivacion;
- rollback total;
- `SIN_CAMBIOS` sin auditoria;
- no cambios fiscales;
- no cambios en Nomina/snapshots;
- bloqueo concurrente.

## 16. Riesgos y decisiones pendientes

| Riesgo/decision | Estado | Recomendacion |
|---|---|---|
| Nombre completo vs componentes | Cerrada | Diez columnas; componentes separados y campos derivados por backend. |
| RH como responsable | Cerrada | Excluido; clasificar como `RESPONSABLE_NO_AUTORIZADO`. |
| Inactivacion con dependencias | Cerrada | Bloquear ciclos ACTIVO/PLANEACION y operaciones vigentes. |
| Identificador sin UNIQUE | Mitigada en test | `014` crea el indice; aplicacion productiva pendiente de fase aprobada. |
| Validacion productiva | Completada read-only | 217 docentes y cero grupos duplicados. |
| CSV injection | Fuera de alcance | Mantener politica H11; evaluar por exportable aparte. |

Pendientes restantes:

- predeploy;
- aplicar `014` en produccion solo con backup y aprobacion;
- deploy posterior.

## 17. Estado final

H22 queda en:

```text
H22-F1A, H22-F2 y H22-F3 implementadas; H22-F4 tiene regresión completa,
ensayo temporal y smoke autenticado humano aprobados. La migración productiva
`014`, el deploy y cualquier Apply institucional permanecen pendientes.
```

Confirmaciones:

- helper y rutas individuales protegidos localmente;
- migracion `014` creada y aplicada solo en test;
- endpoints de plantilla, Preview y Apply atomico implementados;
- pestana Admin, descargas, Preview visual, filtros, before/after,
  confirmaciones y Apply frontend implementados;
- fingerprints de docentes/responsables y revalidacion transaccional de
  dependencias implementados;
- pruebas API e integracion PostgreSQL agregadas;
- produccion read-only y sin escrituras;
- sin deploy;
- sin dependencias;
- sin cambios de permisos;
- sin H01;
- sin exposicion fiscal.
- fix legacy validado con 184 filas restauradas `SIN_CAMBIOS`, sin altas
  accidentales;
- hotfix visual validado técnicamente en 1440 x 900, 768 x 1024 y 390 x 844;
- H22 no está cerrado operativo ni desplegado.
