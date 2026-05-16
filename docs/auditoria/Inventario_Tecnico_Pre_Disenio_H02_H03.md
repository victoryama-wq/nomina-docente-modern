# Inventario Técnico Pre-Diseño H02/H03

## 1. Resumen ejecutivo

Este inventario levanta evidencia tecnica previa al diseno de implementacion de H02/H03, con base en la SPEC aprobable `docs/specs/SPEC_H02_H03_Usuario_Coordinacion_Permisos.md` y en la lectura estatica del repositorio.

Hallazgos principales confirmados en codigo:

- No existe aun el modelo `user_coordinations` como fuente formal usuario-coordinacion.
- La resolucion de coordinacion todavia depende de `display_name`, `legacy_username`, `actor.displayName` y coincidencias contra `coordinations.name`.
- Hay rutas y helpers que pueden crear coordinaciones automaticamente desde flujos operativos.
- La mayoria de modulos operativos trabajan con una sola `actorCoordination`, no con una lista de coordinaciones.
- Los permisos objetivo de H03 no existen completos: faltan `fiscal.view`, `fiscal.document.view`, `fiscal.document.manage`, `finance.export`, `finance.workflow` y `payroll.preview`.
- `finance.view`, `teachers.manage` y `reports.view` estan sobrecargados y actualmente habilitan acciones o vistas que deben separarse en la implementacion futura.
- Los campos de autoria/propiedad no estan normalizados como `created_by_user_id`; existen equivalentes parciales como `created_by`, `captured_by`, `updated_by`, `calculated_by`, `approved_by`, `reviewed_by`, `paid_by`, `status_updated_by` y `actor_user_id`.

No se modificó código, migraciones, permisos, frontend ni backend. Este documento solo registra evidencia y recomendaciones de diseño.

## 2. Campos de autoría por tabla

| Tabla | Campos encontrados | Tipo de dato estimado | Qué representa | Sirve como propiedad | Requiere migración | Observación |
|---|---|---|---|---|---|---|
| `schedules` | `created_by`, `updated_by` | `uuid REFERENCES app_users(id)` | Usuario que creo y ultimo usuario que actualizo el horario | Si, `created_by` puede funcionar como propiedad operativa si apunta al usuario real | Pendiente de decidir si se mantiene como equivalente o se migra a `created_by_user_id` | Confirmado en `database/001_initial_schema.sql:187`, `database/001_initial_schema.sql:208`, `database/001_initial_schema.sql:210`. La SPEC no debe asumir que ya existe `created_by_user_id`. |
| `schedule_incidences` | `updated_by` | `uuid REFERENCES app_users(id)` | Usuario que actualizo la incidencia | No como autoria original; solo refleja ultima edicion | Si se requiere regla "propio", falta autoria original o herencia formal desde `schedules.created_by` | Confirmado en `database/001_initial_schema.sql:221`. Punto critico: no hay `created_by` original de incidencia. |
| `extra_hours` | `captured_by`, `updated_by` | `uuid REFERENCES app_users(id)` | Usuario que capturo el extra y ultimo usuario que actualizo | Si, `captured_by` puede ser equivalente funcional de propiedad | No necesariamente, si la SPEC acepta `captured_by` como equivalente; si se normaliza, si requiere migracion | Confirmado en `database/001_initial_schema.sql:237`, `database/001_initial_schema.sql:250`, `database/001_initial_schema.sql:252`. |
| `teachers` | `created_by`, `updated_by` | `uuid REFERENCES app_users(id)` | Usuario que creo y ultimo usuario que actualizo al docente | Si para gestion operativa del Directorio, pendiente de separar fiscal | Pendiente de decidir si se mantiene como equivalente o se migra a `created_by_user_id` | Confirmado en `database/001_initial_schema.sql:77`, `database/001_initial_schema.sql:100`, `database/001_initial_schema.sql:102`. |
| `teacher_documents` | `uploaded_by` | `uuid REFERENCES app_users(id)` | Usuario que subio la constancia/documento fiscal | Sirve como autoria documental, no como permiso de acceso por si solo | No para H02; si para auditoria fiscal/documental | Confirmado en `database/001_initial_schema.sql:110`. Debe quedar bajo permisos `fiscal.document.view/manage`. |
| `payroll_runs` | `calculated_by`, `approved_by`, `reviewed_by`, `paid_by`, `status_updated_by` | `uuid REFERENCES app_users(id)` | Auditoria de workflow de nomina | No como propiedad operativa; si como auditoria de estados | No para propiedad H02; si debe respetarse en workflow H03 | `calculated_by` y `approved_by` estan en `database/001_initial_schema.sql:260`. `reviewed_by`, `paid_by` y `status_updated_by` se agregan en `database/008_payroll_status_workflow.sql:8-13`. |
| `audit_log` | `actor_user_id`, `actor_email` | `uuid`, `text` | Actor que ejecuto el evento auditado | No es propiedad del registro auditado | No | Confirmado en `database/001_initial_schema.sql:318`, `database/001_initial_schema.sql:320`. Correcto para bitacora. |
| `app_users` | `created_by`, `updated_by`, `legacy_username` | `uuid`, `text` | Auditoria de usuarios y referencia legacy | No define coordinacion operativa | No para propiedad; si H02 requiere nueva relacion `user_coordinations` | `display_name` existe en `database/001_initial_schema.sql:54`; `legacy_username` se agrega en `database/002_directory_access_module.sql:7`. |
| `roles`, `permissions`, `role_permissions` | No se detectaron campos de autoria | UUIDs y codigos de permiso | Catalogos de seguridad | No | Pendiente de confirmar si se desea auditoria futura de cambios de permisos | Definidos en `database/001_initial_schema.sql:29`, `database/001_initial_schema.sql:37`, `database/001_initial_schema.sql:44`. |

## 3. Permisos actuales

| Permiso | Existe actualmente | Donde se define | Roles que lo tienen | Uso actual | Problema detectado |
|---|---|---|---|---|---|
| `teachers.manage` | Si | `database/001_initial_schema.sql:348` | Admin por `CROSS JOIN` de todos los permisos; Coordinador, Direccion y RH en `database/001_initial_schema.sql:380`, `database/001_initial_schema.sql:395`, `database/001_initial_schema.sql:411`; tambien reforzado en `database/007_direction_hr_roles.sql:31`, `database/007_direction_hr_roles.sql:47` | Protege alta, edicion, consulta fiscal/documental parcial y vistas de docentes | Esta demasiado amplio: puede habilitar acciones de Directorio y fiscal que deben separarse. |
| `schedules.manage` | Si | `database/001_initial_schema.sql:349` | Admin, Coordinador, Direccion, RH | Gestion de horarios | El alcance depende de una sola coordinacion resuelta por texto; debe soportar multiples coordinaciones. |
| `incidences.manage` | Si | `database/001_initial_schema.sql:350` | Admin, Coordinador, Direccion, RH | Gestion de incidencias | Usa coordinacion unica y `schedule_incidences` no tiene autoria original. |
| `extras.manage` | Si | `database/001_initial_schema.sql:351` | Admin, Coordinador, Direccion, RH | Gestion de extras | Debe combinar coordinaciones asignadas + propiedad (`captured_by` o campo migrado). |
| `payroll.view` | Si | `database/001_initial_schema.sql:352` | Admin, Coordinador, Direccion, RH, Finanzas, Contador, Contabilidad | Consulta de contexto, corrida guardada y preview en algunas rutas | Mezcla consulta de nomina guardada con preview viva. Debe separarse con `payroll.preview`. |
| `payroll.calculate` | Si | `database/001_initial_schema.sql:353`, `database/006_payroll_finalize_permission.sql:6` | Admin por asignacion global; uso puntual pendiente de confirmar en datos productivos | Habilita calculo/vista previa en API | No existe `payroll.preview`; el permiso actual puede no expresar solo lectura por coordinacion. |
| `payroll.finalize` | Si | `database/001_initial_schema.sql:354`, `database/006_payroll_finalize_permission.sql:7` | Admin por asignacion global y seed especifico `database/006_payroll_finalize_permission.sql:15` | Guardar corrida y parte del control/cancelacion | Debe conservar guardado de nomina, pero workflow financiero debe moverse a `finance.workflow`. |
| `reports.view` | Si | `database/001_initial_schema.sql:355` | Admin, Coordinador, Direccion, RH, Finanzas, Contador, Contabilidad | Reportes, exports y algunas descargas/documentos | Puede exponer datos financieros o fiscales sin permisos mas finos. |
| `finance.view` | Si | `database/001_initial_schema.sql:357` | Admin, Finanzas, Contador, Contabilidad | Consulta financiera, fiscal, exports y workflow en algunos puntos | Sobrecargado: no debe editar fiscal, exportar ni cambiar estados por si solo. |
| `finance.global_view` | Si | `database/001_initial_schema.sql:358`, `database/007_direction_hr_roles.sql:13` | Admin y Direccion | Consulta global de finanzas/nomina en modo lectura | Debe revisarse contra la regla de Direccion: detalle global sin fiscal sensible. |
| `fiscal.manage` | Si | `database/001_initial_schema.sql:359`, `database/007_direction_hr_roles.sql:14` | Admin y RH; Finanzas puede acceder por `finance.view` en rutas actuales | Gestion de expediente fiscal y constancias | Mezcla ver, editar y documentos. Faltan permisos documentales separados. |
| `calendar.manage` | Si | `database/001_initial_schema.sql:360`, `database/005_calendar_permission_seed.sql:4` | Admin | Gestion de calendario | Fuera del alcance H02/H03, sin problema directo detectado. |
| `access.manage` | Si | `database/001_initial_schema.sql:362` | Admin | Control de accesos | Debe ampliarse en diseno para asignar una o varias coordinaciones. |
| `audit.view` | Si | `database/001_initial_schema.sql:363` | Admin por asignacion global | Auditoria/bitacora | Sin problema directo; debe registrar nuevos eventos H02/H03. |

Nota: las asignaciones reales en la base productiva pueden diferir de los seeds si hubo cambios manuales. Esto queda pendiente de confirmar en datos antes de ejecutar migraciones.

## 4. Permisos objetivo faltantes

| Permiso objetivo | Existe actualmente | Accion requerida | Roles destino sugeridos |
|---|---|---|---|
| `fiscal.view` | No detectado en codigo ni migraciones | Crear permiso y usarlo para ver expediente fiscal sin editar | Admin, RH, Finanzas. Direccion solo si se aprueba acceso sin datos sensibles, no como fiscal completo. |
| `fiscal.document.view` | No detectado | Crear permiso para ver/descargar constancia fiscal | Admin, RH, Finanzas. Contador solo si operacion lo aprueba para exportacion, pendiente de confirmar. |
| `fiscal.document.manage` | No detectado | Crear permiso para subir/reemplazar constancias | Admin, RH, Finanzas. |
| `finance.export` | No detectado | Crear permiso para CSV/PDF/exportaciones financieras | Admin, Finanzas, Contador, Contabilidad; Direccion solo para reportes autorizados sin fiscal sensible si aplica. |
| `finance.workflow` | No detectado | Crear permiso para aprobar, marcar pagada, cancelar y cambiar estados financieros | Admin, Finanzas. |
| `payroll.preview` | No detectado | Crear permiso para ver calculo vivo sin guardar | Admin, Coordinador por `user_coordinations`, Direccion, Finanzas segun vista autorizada. |

## 5. Rutas con creación automática de coordinaciones

| Archivo | Funcion/ruta | Evidencia | Riesgo | Recomendacion |
|---|---|---|---|---|
| `apps/api/src/routes/academic-context.ts` | `loadActorCoordination(client, actor, createIfMissing)` | Usa `display_name`, `legacy_username` y puede ejecutar `INSERT INTO coordinations` en `apps/api/src/routes/academic-context.ts:160`, `apps/api/src/routes/academic-context.ts:167`, `apps/api/src/routes/academic-context.ts:192` | Un usuario puede terminar asociado a una coordinacion creada desde su nombre visible o legacy | Reemplazar como fuente principal por `user_coordinations`; dejar fallback sin creacion automatica y con log. |
| `apps/api/src/routes/schedules.ts` | `getOrCreateCoordination` | Busca por `lower(name)` y crea con `INSERT INTO coordinations` en `apps/api/src/routes/schedules.ts:407`, `apps/api/src/routes/schedules.ts:416`, `apps/api/src/routes/schedules.ts:422` | Horarios pueden crear catalogo operativo no autorizado | Validar contra catalogo existente; si no existe, bloquear y pedir configuracion administrativa. |
| `apps/api/src/routes/schedules.ts` | `loadActorCoordination` duplicado local | Usa `display_name`, `legacy_username`, `actor.displayName` y crea coordinacion en `apps/api/src/routes/schedules.ts:428`, `apps/api/src/routes/schedules.ts:435`, `apps/api/src/routes/schedules.ts:460` | Duplica logica y puede divergir del helper compartido | Eliminar duplicidad en diseno; usar helper central multi-coordinacion. |
| `apps/api/src/routes/schedules.ts` | `listScheduleCoordinatorOptions` | Construye opciones con usuarios y puede crear coordinaciones en `apps/api/src/routes/schedules.ts:677`, `apps/api/src/routes/schedules.ts:678`, `apps/api/src/routes/schedules.ts:708` | El selector puede poblar catalogo desde nombres de usuario | Debe leer usuarios/coordinaciones formales sin insertar catalogo desde la vista operativa. |
| `apps/api/src/routes/extras.ts` | `resolveExtraCoordination` | Usa `loadActorCoordination` y fallback con `INSERT INTO coordinations` en `apps/api/src/routes/extras.ts:213`, `apps/api/src/routes/extras.ts:220`, `apps/api/src/routes/extras.ts:232` | Extras pueden crear coordinacion por nombre del actor | Resolver contra `user_coordinations`; bloquear si no hay coordinacion valida. |
| `apps/api/src/routes/teachers.ts` | `getOrCreateCoordination` | Crea coordinacion en `apps/api/src/routes/teachers.ts:309`, `apps/api/src/routes/teachers.ts:319` | Directorio puede crear coordinaciones desde captura/importacion | Mover creacion de coordinaciones a catalogo/control administrativo. |
| `database/imports/*.sql` | Scripts de importacion historica | Multiples `INSERT INTO coordinations` en archivos de importacion, por ejemplo `database/imports/legacy_import.sql` | No son rutas runtime, pero pueden crear catalogo al importar | Mantener como antecedente de migracion; validar catalogo antes de nuevos imports. |

## 6. Usos de finance.view

| Archivo | Ruta/funcion | Accion habilitada por finance.view | Debe seguir usando finance.view | Permiso objetivo recomendado |
|---|---|---|---|---|
| `apps/api/src/routes/reports.ts` | `canViewAllFinance` | Permite vista global financiera | Si, solo para consulta | `finance.view` |
| `apps/api/src/routes/reports.ts` | `canManageFinanceWorkflow` | Permite workflow financiero con `finance.view` | No | `finance.workflow` |
| `apps/api/src/routes/reports.ts` | `/reports/finance/runs/:id/status` | Cambios de estado financiero con preHandler `finance.view` o `payroll.finalize` | No para cambios de estado | `finance.workflow` para aprobar, pagar, cancelar; `finance.view` solo lectura. |
| `apps/api/src/routes/reports.ts` | PDFs y exportaciones financieras | Exporta resumen, coordinaciones, efectivo y CSV con `reports.view` o `finance.view` | Parcialmente: consulta si; export no | `finance.export` para descargas; `finance.view` para pantalla. |
| `apps/api/src/routes/teachers.ts` | `assertTeacherOwnedByActorCoordination` | Salto de restriccion por coordinacion si tiene `finance.view` | No como permiso generico | `fiscal.view`, `fiscal.manage`, o permiso financiero especifico segun accion. |
| `apps/api/src/routes/teachers.ts` | `PATCH /teachers/:id/fiscal` | Edita datos fiscales con `finance.view` | No | `fiscal.manage` |
| `apps/api/src/routes/teachers.ts` | `POST /teachers/:id/documents/constancia` | Sube constancia con `finance.view` | No | `fiscal.document.manage` |
| `apps/api/src/routes/teachers.ts` | `GET /teachers/:id/documents/constancia/current` | Descarga constancia con `finance.view` o `reports.view` | No como generico | `fiscal.document.view` |
| `apps/api/src/routes/payroll.ts` | `canViewAllPayroll` y exports | Vista global y export de nomina con `finance.view` | Si para vista financiera; no para export/workflow | `finance.view`, `finance.export`, `payroll.view` segun caso. |
| `apps/web/src/stores/auth.ts` | `canViewFinanceReports`, `canViewFiscalRecords`, `canManageFiscalRecords`, `canViewTeachers` | El frontend interpreta `finance.view` como ver finanzas, ver/gestionar fiscal y ver docentes | No para fiscal/manage | Separar `finance.view`, `finance.export`, `finance.workflow`, `fiscal.view`, `fiscal.manage`, `fiscal.document.*`. |
| `apps/web/src/views/FinanceReportsView.vue` | `canManageWorkflow` | Habilita acciones de workflow con `finance.view` | No | `finance.workflow` |
| `apps/web/src/views/FiscalRecordsView.vue` | `canManageRecord` | Habilita gestion fiscal con `finance.view` | No | `fiscal.manage` y `fiscal.document.manage` |
| `apps/web/src/views/TeachersView.vue` | `canEditTeacher` | Habilita edicion de docente si tiene `finance.view` | No | Permisos separados de Directorio/fiscal. |

## 7. Usos de teachers.manage

| Archivo | Ruta/funcion | Accion habilitada por teachers.manage | Riesgo | Permiso objetivo recomendado |
|---|---|---|---|---|
| `apps/api/src/routes/teachers.ts` | `GET /teachers` | Consulta Directorio global con docentes y campos fiscales seleccionados | Ver todos los docentes puede confundirse con editar todos; expone datos sensibles si no se filtra | Mantener `GET /teachers` global, pero separar campos sensibles con `fiscal.view`. |
| `apps/api/src/routes/teachers.ts` | `GET /teachers/export/*` | Exporta docentes incluyendo campos fiscales/historicos | Coordinador o Direccion pueden exportar mas datos de los necesarios si tienen permiso amplio | `teachers.export` o `reports.view` limitado; fiscal sensible solo con `fiscal.view`. |
| `apps/api/src/routes/teachers.ts` | `POST /teachers` | Alta docente | Coordinador tiene `teachers.manage` en seeds, pero decisiones H03 limitan gestion fiscal | Separar `teachers.directory_manage`, `teachers.operational_view` y fiscal. |
| `apps/api/src/routes/teachers.ts` | `PATCH /teachers/:id` | Edicion docente completa | Riesgo de editar datos operativos/fiscales fuera del alcance | Separar edicion operativa de edicion fiscal; validar coordinacion/propiedad. |
| `apps/api/src/routes/teachers.ts` | `PATCH /teachers/:id/fiscal` | Edita RFC, correo, banco/tipo de pago | Contradice que Coordinador no gestione fiscal si conserva `teachers.manage` | `fiscal.manage` exclusivamente. |
| `apps/api/src/routes/teachers.ts` | `DELETE /teachers/:id` | La ruta exige `teachers.manage`, aunque el cuerpo restringe a admin | El preHandler sugiere capacidad mas amplia; la regla real esta dentro de la ruta | Mantener restriccion admin o permiso explicito `teachers.delete`. |
| `apps/api/src/routes/teachers.ts` | `POST /teachers/:id/documents/constancia` | Sube constancia fiscal | Coordinador podria llegar al preHandler si tiene `teachers.manage`; la restriccion fina depende de logica interna | `fiscal.document.manage`. |
| `apps/api/src/routes/teachers.ts` | `GET /teachers/:id/documents/constancia/current` | Descarga constancia | Documento fiscal sensible habilitado por `teachers.manage` o `reports.view` | `fiscal.document.view`. |
| `apps/web/src/stores/auth.ts` | `canViewFiscalRecords`, `canManageFiscalRecords` | Usa `teachers.manage` para vista/gestion fiscal | Sobrecarga visual y funcional en frontend | Separar `fiscal.view/manage/document.*`. |
| `apps/web/src/views/TeachersView.vue` | Botones de alta/edicion/export | Usa `authStore.canManageTeachers` | Las acciones visuales no reflejan matriz H03 final | Ajustar UI a permisos especificos. |

## 8. Usos de payroll.view / payroll.calculate / payroll.finalize

| Permiso | Archivo | Ruta/funcion | Uso actual | Permiso objetivo recomendado |
|---|---|---|---|---|
| `payroll.view` | `database/001_initial_schema.sql:352` | Seed de permiso | Consulta de nomina | Mantener para ver nominas guardadas/contexto no sensible. |
| `payroll.view` | `apps/api/src/routes/payroll.ts` | `/payroll/context`, `/payroll/preview`, `/payroll/runs/:id`, exports | Permite contexto, preview, corrida guardada y export parcial | Separar `payroll.preview` para calculo vivo; `payroll.view` para consulta. |
| `payroll.view` | `apps/web/src/stores/auth.ts:23` | `canViewPayroll` | Habilita vista Nomina | Mantener vista, pero acciones deben depender de permisos finos. |
| `payroll.calculate` | `database/001_initial_schema.sql:353`, `database/006_payroll_finalize_permission.sql:6` | Seed de permiso | Calculo/vista previa | Reemplazar o complementar con `payroll.preview` para solo lectura. |
| `payroll.calculate` | `apps/api/src/routes/payroll.ts` | `/payroll/context` y `/payroll/preview` | Habilita preview junto con `payroll.view` | `payroll.preview`. |
| `payroll.calculate` | `apps/web/src/stores/auth.ts:24` | `canCalculatePayroll` | Frontend puede diferenciar calculo | Migrar a `payroll.preview` cuando exista. |
| `payroll.finalize` | `database/001_initial_schema.sql:354`, `database/006_payroll_finalize_permission.sql:7` | Seed de permiso | Guardado definitivo de nomina | Mantener para guardar nomina si rol autorizado. |
| `payroll.finalize` | `apps/api/src/routes/payroll.ts` | `POST /payroll/runs` | Guardar corrida | `payroll.finalize`. |
| `payroll.finalize` | `apps/api/src/routes/reports.ts` | Cambios/cancelacion de estado junto con `finance.view` o helper financiero | Mezcla finalizacion de nomina con workflow financiero | `finance.workflow` para aprobar, marcar pagada y cancelar; `payroll.finalize` solo guardado/cancelacion tecnica si aplica. |
| `payroll.finalize` | `apps/web/src/stores/auth.ts:26`, `apps/web/src/views/PayrollView.vue` | Boton guardar nomina | Correcto para Admin actual | Confirmar si Finanzas no guarda nomina segun decisiones. |

## 9. Resolución actual de coordinación

| Archivo | Funcion | Campos usados | Crea coordinacion automaticamente | Riesgo | Reemplazo recomendado |
|---|---|---|---|---|---|
| `apps/api/src/routes/academic-context.ts` | `loadActorCoordination` | `app_users.display_name`, `app_users.legacy_username`, `actor.displayName`, `coordinations.name` | Si, cuando `createIfMissing` es verdadero | Fuente de permisos por texto mutable | Helper central `getActorCoordinationIds(actor)` basado en `user_coordinations`; fallback solo temporal y con log. |
| `apps/api/src/routes/schedules.ts` | `loadActorCoordination` local | `display_name`, `legacy_username`, `actor.displayName`, `coordinations.name` | Si | Duplicidad y divergencia con `academic-context.ts` | Eliminar duplicado; usar helper central multi-coordinacion. |
| `apps/api/src/routes/schedules.ts` | `resolveScheduleCoordination` | `actorCoordination` unica, `schedule.coordinationId`, nombres de coordinacion | Indirectamente si llama con creacion | Bloquea o permite por una sola coordinacion | Validar contra lista `user_coordinations`. |
| `apps/api/src/routes/schedules.ts` | `getOrCreateCoordination` | `coordinations.name` desde input | Si | Creacion operativa de catalogo | Solo aceptar `coordination_id` existente. |
| `apps/api/src/routes/schedules.ts` | `listScheduleCoordinatorOptions` | `app_users.display_name`, `legacy_username`, `coordinations.name` | Si | Selector de coordinadores crea catalogo | Debe leer relaciones formales usuario-coordinacion, no crear. |
| `apps/api/src/routes/extras.ts` | `resolveExtraCoordination` | `loadActorCoordination`, `actor.displayName`, coordinacion del extra | Si en fallback | Extra puede quedar asociado a coordinacion incorrecta | Validar `coordination_id` contra `user_coordinations` y propiedad `captured_by`. |
| `apps/api/src/routes/teachers.ts` | `getOrCreateCoordination` | `coordinationName` y `coordinations.name` | Si | Directorio puede crear coordinaciones por texto de captura/importacion | Mover administracion de coordinaciones a catalogo. |
| `apps/api/src/routes/teachers.ts` | `resolveTeacherCoordinationForActor` / `assertTeacherOwnedByActorCoordination` | `actorCoordination` unica y `teacher.coordinationId` | No directamente | Un usuario con multiples coordinaciones no queda representado | Validar `teacher.coordinationId IN user_coordinations`. |
| `apps/api/src/routes/incidences.ts` | Funciones de carga/edicion de incidencias | `actorCoordination` unica y `schedule.coordinationId` | No directamente | No soporta multiples coordinaciones | Usar lista de coordinaciones y autoria definida. |
| `apps/api/src/routes/payroll.ts` | Cargas de preview/lineas/detalles | `actorCoordination` unica para filtrar | No | Preview de Coordinador no soporta multiples coordinaciones | Filtrar por lista de coordinaciones asignadas. |
| `apps/api/src/routes/reports.ts` | Cargas de finanzas/reportes | `actorCoordination` unica para usuarios no globales | No | Reportes pueden quedar incompletos o excedidos | Usar alcance global por permiso o lista `user_coordinations`. |

## 10. Compatibilidad con múltiples coordinaciones

| Modulo | Uso actual de coordinacion unica | Cambio requerido para multiples coordinaciones |
|---|---|---|
| Horarios | `actorCoordination` se devuelve como objeto unico en API y frontend; filtros y permisos comparan contra un solo `id` | Devolver y validar lista de `coordination_ids`; permitir seleccionar solo coordinaciones asignadas; usar `IN/ANY` en consultas. |
| Incidencias | Editabilidad depende de `actorCoordination.id === row.coordinationId` | Evaluar contra lista de coordinaciones; definir si incidencia hereda propiedad del horario o requiere autoria propia. |
| Extras | Visibilidad y editabilidad usan una sola coordinacion; propiedad real esta en `captured_by` | Filtrar por varias coordinaciones y validar editar/eliminar con `captured_by` o campo migrado. |
| Nomina preview | Contexto y detalles usan `actorCoordination` unico para limitar lineas | `payroll.preview` debe filtrar por todas las coordinaciones asignadas al Coordinador. |
| Finanzas | Reportes usan globalidad por rol/permisos o una sola coordinacion | Mantener global para Admin/Finanzas/Direccion autorizada; para roles UC usar lista. |
| Reportes | Similar a Finanzas; algunas descargas dependen de `finance.view`/`reports.view` | Separar `finance.export`; filtrar por lista cuando no sea global. |
| Directorio | `GET /teachers` devuelve todos, pero acciones usan actorCoordination unico en UI y API | Mantener consulta global segun decision, pero validar acciones sensibles por permisos, lista UC, propiedad y fiscal. |
| Frontend | Tipos en `apps/web/src/api.ts` exponen `actorCoordination: CoordinationOption | null` en varios contextos | Migrar contrato a lista, por ejemplo `actorCoordinations: CoordinationOption[]`, con compatibilidad temporal si se requiere. |

## 11. Información fiscal sensible

| Campo/dato | Tabla/ruta | Quien lo ve hoy | Quien deberia verlo segun SPEC | Riesgo |
|---|---|---|---|---|
| RFC | `teachers.rfc`, `payroll_lines`/reportes; `apps/api/src/routes/teachers.ts`, `apps/api/src/routes/reports.ts` | Rutas de docentes con `teachers.manage`, `finance.view`, `reports.view`; Finanzas muestra RFC en reportes | Admin, RH y Finanzas con `fiscal.view`; Contador solo en export autorizado; Direccion sin fiscal sensible | RFC aparece en busquedas, tablas, CSV y reportes; falta permiso `fiscal.view`. |
| Correo fiscal/docente | `teachers.email`, vistas de Directorio/Fiscal | Usuarios con acceso a docentes o expediente fiscal | Admin, RH, Finanzas; Coordinador solo si se considera dato operativo no fiscal y limitado | Debe definirse si el correo mostrado al Coordinador es operativo o fiscal. Pendiente de confirmar en operacion. |
| Banco / cuenta / CLABE | `teachers.bank_detail`, reportes y Fiscal Records | Rutas con `teachers.manage`, `finance.view`, `fiscal.manage`; FinanceReports lo muestra | Admin, RH, Finanzas; Contador solo si export autorizado; Direccion/Coordinador no | Dato altamente sensible; hoy depende de permisos amplios. |
| Tipo de pago | `teachers.payment_type`, `payroll_lines.payment_type_snapshot` | Finanzas, Directorio, Fiscal Records, exports | Admin, RH, Finanzas; Contador en export; Direccion solo agregado/sin fiscal sensible si aplica | Es dato financiero-operativo; debe separarse de edicion fiscal. |
| Constancia fiscal | `teacher_documents` y rutas `/teachers/:id/documents/constancia` | Puede ser alcanzada por `teachers.manage`, `finance.view`, `reports.view`, `fiscal.manage` | `fiscal.document.view` para ver/descargar; `fiscal.document.manage` para subir/reemplazar | Documento sensible expuesto por permisos demasiado amplios. |
| Estado de expediente fiscal | Calculos de `fiscalMissing`, `hasConstancia`, pendientes fiscales | Reportes financieros y vistas fiscales | Admin, RH, Finanzas; Direccion solo agregado sin datos sensibles; Contador export segun alcance | Pendientes pueden revelar informacion fiscal incompleta. |
| CSV de pagos | `apps/api/src/routes/reports.ts` export `payments` | Finanzas/reportes con permisos actuales | Contador/Contabilidad/Finanzas/Admin con `finance.export` | Export debe contener solo columnas autorizadas por rol y proposito. |
| CSV de pendientes fiscales | `apps/api/src/routes/reports.ts` export `fiscal` | `reports.view` o `finance.view` segun ruta actual | RH/Finanzas/Admin con fiscal; Contador si se aprueba solo export | Riesgo de exponer RFC/banco/constancia a roles de solo consulta. |

## 12. Hallazgos críticos antes de diseño

| Severidad | Hallazgo | Evidencia | Implicacion para diseno |
|---|---|---|---|
| Bloqueante | No existe `user_coordinations` | No se detecta tabla en migraciones actuales; la resolucion usa `display_name`/`legacy_username` | Disenar primero DB/migracion y contrato de contexto multi-coordinacion. |
| Bloqueante | Creacion automatica de coordinaciones en rutas operativas | `academic-context.ts`, `schedules.ts`, `extras.ts`, `teachers.ts` contienen `INSERT INTO coordinations` | La implementacion debe eliminar esta creacion antes de activar permisos estrictos. |
| Bloqueante | Faltan permisos objetivo H03 | No se detectan `fiscal.view`, `fiscal.document.view`, `fiscal.document.manage`, `finance.export`, `finance.workflow`, `payroll.preview` | Debe existir migracion/seed controlado antes de ajustar rutas. |
| Bloqueante | `finance.view` habilita workflow y fiscal en varios puntos | `reports.ts`, `teachers.ts`, `stores/auth.ts`, `FinanceReportsView.vue`, `FiscalRecordsView.vue` | Desacoplar permisos antes de mover UI y API a matriz final. |
| Alto | `teachers.manage` habilita fiscal y documentos | `teachers.ts` permite fiscal/documentos con `teachers.manage`; frontend usa `teachers.manage` para fiscal | Separar Directorio operativo de Expediente Fiscal. |
| Alto | `schedule_incidences` no tiene autoria original | Solo `updated_by` confirmado en schema | No activar regla "propio" sobre incidencias hasta definir si hereda del horario o se agrega autoria. |
| Alto | El sistema usa `actorCoordination` unica | API y frontend exponen `actorCoordination: CoordinationOption | null` | Disenar contrato multi-coordinacion desde el primer corte. |
| Alto | Informacion fiscal sensible aparece en vistas/reportes amplios | RFC, banco, tipo de pago y constancia se consultan desde Teachers, FinanceReports y FiscalRecords | Definir mascaramiento/ocultamiento por permiso antes de despliegue. |
| Medio | Duplicidad de `loadActorCoordination` | Existe en `academic-context.ts` y copia local en `schedules.ts` | Centralizar helper para reducir divergencias. |
| Medio | Scripts de importacion crean coordinaciones | `database/imports/*.sql` contiene multiples `INSERT INTO coordinations` | Futuras cargas deben validar catalogo antes de importar. |
| Bajo | Validacion contra datos productivos pendiente | Este inventario es lectura estatica de repo | Antes de migrar, comparar seeds contra permisos/roles reales en Cloud SQL. |

## 13. Recomendaciones para diseño técnico

Orden recomendado:

1. **DB/migraciones.** Disenar `user_coordinations`, permisos objetivo, indices, seeds y mapeo de autoria antes de tocar rutas.
2. **Inventario de datos productivos.** Validar en Cloud SQL usuarios, roles, permisos reales, coordinaciones existentes y docentes sin coordinacion.
3. **Auth/context.** Crear helper central que devuelva lista de coordinaciones del actor, alcance global y estado de fallback.
4. **Fallback controlado.** Mantener fallback legacy temporal solo como contingencia, sin crear coordinaciones y registrando advertencia/log.
5. **Eliminar creacion automatica.** Quitar de flujos operativos la capacidad de insertar en `coordinations`.
6. **Permisos H03.** Separar `finance.view`, `finance.export`, `finance.workflow`, `fiscal.view`, `fiscal.manage`, `fiscal.document.view`, `fiscal.document.manage`, `payroll.preview`.
7. **Modulos operativos.** Ajustar Horarios, Incidencias y Extras a multiples coordinaciones y propiedad.
8. **Fiscal/Finanzas.** Proteger RFC, banco, tipo de pago, constancia y pendientes fiscales por permisos especificos.
9. **Frontend.** Actualizar contrato `actorCoordination` a lista, ocultar acciones por permisos finos y evitar inferencias desde roles amplios.
10. **Pruebas.** Diseñar pruebas por rol, coordinacion, propiedad, fallback, fiscal y workflow financiero antes del despliegue.

## 14. Conclusión

Con este inventario ya existe evidencia tecnica suficiente para pasar al diseno tecnico H02/H03, siempre que antes de implementar se confirme en datos productivos:

- permisos y roles realmente activos en Cloud SQL,
- coordinaciones existentes contra la tabla operativa aprobada,
- usuarios sin coordinacion formal,
- tablas con datos historicos suficientes para migrar o mapear autoria,
- rutas de exportacion que cada rol debe conservar.

La implementacion no debe iniciar directamente sobre rutas. El primer diseno debe cubrir modelo de datos, permisos y contexto de autenticacion/autorizacion, porque esos tres puntos condicionan todos los modulos operativos.
