# SPEC H12 - Politica de Catalogos Historicos

## 1. Resumen ejecutivo

H12 atiende el riesgo de alterar catalogos que ya fueron usados por Horarios, Extras, Nomina, Finanzas, reportes o auditoria.

El problema principal es que un catalogo no es solo una lista de opciones: cuando un tabulador, asignatura, coordinacion, docente, ciclo o quincena ya participo en capturas o pagos, forma parte de la explicacion historica de la nomina. Renombrarlo, reutilizarlo, eliminarlo o cambiarle el significado puede romper reportes historicos, conciliaciones, auditoria y explicacion de pagos.

Objetivo H12:

- Definir una politica formal de conservacion historica.
- Priorizar inactivar antes que borrar.
- Crear registros nuevos ante cambios funcionales.
- Mantener snapshots de nomina como fuente historica de lo pagado.
- Dejar pendientes las decisiones humanas y tecnicas antes de implementar cambios.

Principio rector:

> Conservar historia primero. Inactivar antes que borrar. Crear nuevo registro cuando cambie el significado operativo.

Esta fase es documental/SPEC. No modifica codigo, base de datos, catalogos reales, permisos, UI ni reglas de negocio.

## 2. Catalogos identificados

| Catalogo / Tabla | Uso actual | Referenciado por | Tiene estado activo/inactivo | Riesgo historico |
|---|---|---|---|---|
| `tabulators` | Catalogo de categorias/montos usados para horarios y calculos. | `schedules.tabulator_id`, `schedules.tabulator_name`, `schedules.tabulator_amount`, `extra_hours.tabulator_amount`, `payroll_schedule_details`, `payroll_extra_details`. | Si, `status user_status`. | Alto: cambiar importe o nombre podria alterar explicacion de pagos y conciliaciones. |
| `subjects` | Catalogo de asignaturas para horarios. | `schedules.subject_id`, `schedules.subject_name`, `payroll_schedule_details.subject_name_snapshot`. | Si, `status user_status`. | Medio-alto: renombrar o borrar podria romper lectura historica de horarios y nominas. |
| `coordinations` | Catalogo operativo/academico de coordinaciones. | `teachers.coordination_id`, `schedules.coordination_id`, `extra_hours.coordination_id`, `payroll_lines.coordination_id`, `user_coordinations.coordination_id`, reportes. | Si, `status user_status`. | Alto: afecta alcance H02, reportes por coordinacion, historicos y permisos operativos. |
| `academic_cycles` | Ciclos academicos y estado operativo. | `schedules.cycle_id`, `extra_hours.cycle_id`, `payroll_runs.cycle_id`, `payroll_calendar_config.cycle_id`, `quarter_closures.cycle_id`. | Si, `status cycle_status`: `PLANEACION`, `ACTIVO`, `CERRADO`. | Alto: ciclo cerrado es irreversible; cambios retroactivos afectan pagos y cierre H09/H10. |
| `payroll_calendar_config` | Quincenas/periodos de nomina y ventanas de captura. | `schedule_incidences.calendar_config_id`, `payroll_runs.period_label`, calculo de nomina, calendario. | No tiene status propio. Depende del ciclo y existencia de nomina. | Alto: borrar o editar una quincena usada rompe incidencias, runs, periodos y trazabilidad. |
| `calendar_blackout_dates` | Dias inhabiles por quincena. | Calculo/validacion de calendario y ventanas. | No tiene status propio. Se reemplaza por quincena. | Medio: eliminar dias historicos puede cambiar explicacion de periodos si afectaron operacion. |
| `teachers` | Directorio docente, datos operativos y fiscales. | `schedules.teacher_id`, `extra_hours.teacher_id`, `payroll_lines.teacher_id`, `teacher_documents.teacher_id`, exportes e historico. | Si, `status teacher_status`. | Alto: borrar o fusionar docentes con registros impide explicar horarios, pagos y documentos. |
| `roles` | Catalogo tecnico de roles. | `app_users.role_id`, autorizacion. | No tiene status. | Medio: renombrar codigos o eliminar roles puede romper acceso historico y pruebas. |
| `permissions` | Catalogo tecnico de permisos. | `role_permissions.permission_id`, guards backend/frontend. | No tiene status. | Alto tecnico: cambiar codigos rompe autorizacion y rutas. |
| `app_users` | Usuarios operativos/capturadores y actores de auditoria. | `created_by`, `updated_by`, `captured_by`, `audit_log.actor_user_id`, `user_coordinations.user_id`. | Si, `status user_status`. | Alto: borrar usuarios rompe propiedad, auditoria y trazabilidad de capturas. |

## 3. Dependencias historicas

| Catalogo | Tablas dependientes | Snapshot existente | Riesgo si se borra | Riesgo si se renombra |
|---|---|---|---|---|
| `tabulators` | `schedules`, `extra_hours`, `payroll_schedule_details`, `payroll_extra_details`. | Parcial. `schedules` guarda `tabulator_name` y `tabulator_amount`; nomina guarda `tabulator_name_snapshot` y `tabulator_amount`. | Horarios vivos pueden quedar sin referencia y reportes pueden perder explicacion. | Puede cambiar lectura de horarios actuales; snapshots de nomina se conservan, pero catalogo visible podria confundir. |
| `subjects` | `schedules`, `payroll_schedule_details`. | Parcial. `schedules.subject_name` y `payroll_schedule_details.subject_name_snapshot`. | Horarios con `subject_id` pierden referencia. | Reportes vivos podrian mostrar un nombre distinto al capturado originalmente. |
| `coordinations` | `teachers`, `schedules`, `extra_hours`, `payroll_lines`, `payroll_schedule_details`, `payroll_extra_details`, `user_coordinations`, reportes. | Si en nomina: `coordination_name_snapshot`. | Afecta reportes, permisos H02, propiedad operativa y filtros. | Puede cambiar agrupaciones visibles y generar confusion historica. |
| `teachers` | `schedules`, `extra_hours`, `payroll_lines`, `payroll_schedule_details`, `payroll_extra_details`, `teacher_documents`, `audit_log`. | Si en nomina: `teacher_name_snapshot`, `category_snapshot`, `payment_type_snapshot`. | Se pierde entidad operativa para explicar horarios/extras; documentos pueden quedar huerfanos si se borran. | Cambia directorio vivo; snapshots explican nomina guardada, pero historicos operativos vivos pueden confundirse. |
| `academic_cycles` | `schedules`, `extra_hours`, `payroll_runs`, `payroll_calendar_config`, `quarter_closures`. | Parcial en `payroll_runs.period_label` y reportes por ciclo. | Rompe casi toda la trazabilidad de calendario, horarios y nomina. | Cambia etiquetas historicas de reportes y cierres. |
| `payroll_calendar_config` | `schedule_incidences`, `payroll_runs` por `period_label`, ventanas de captura. | Parcial en `payroll_runs.period_label` y detalles de nomina. | Incidencias pueden perder quincena; runs quedan dificilmente explicables. | Cambia etiqueta/fechas historicas de una nomina. |
| `calendar_blackout_dates` | `payroll_calendar_config` y reglas de calendario. | No directo. | Puede perder evidencia de dias inhabiles configurados. | Cambiar razon/fecha puede alterar explicacion del periodo. |
| `roles` | `app_users`, `role_permissions`. | En auditoria se guarda actor/email; no snapshot formal de rol por evento. | Usuarios quedan sin rol o se rompe autorizacion. | Codigos funcionales no deben renombrarse sin migracion/SPEC. |
| `permissions` | `role_permissions`, guards backend/frontend. | No. | Rutas dejan de resolver permisos. | Cambiar `code` rompe autorizacion. |

## 4. Politica propuesta

### 4.1 Regla general

- No borrar catalogos con uso historico.
- No renombrar registros usados historicamente sin conservar evidencia.
- Inactivar en lugar de borrar.
- Crear nuevo registro cuando cambie el significado operativo.
- Mantener snapshots de nomina como fuente historica de lo pagado.
- Mantener auditoria para inactivaciones, reactivaciones y cambios excepcionales.
- Diferenciar correccion visual menor de cambio funcional.
- No reutilizar el mismo registro para representar conceptos distintos en periodos distintos.

### 4.2 Tabuladores

Reglas:

- No editar importe de tabulador si ya fue usado en horarios, extras o nomina.
- Si cambia el monto, crear nuevo tabulador.
- Inactivar tabulador anterior cuando ya no deba usarse en nuevas capturas.
- Conservar nombre/importe historico.
- No reutilizar nombre para importe distinto sin vigencia clara.
- Si se requiere vigencia formal futura, documentar y disenar columnas de vigencia antes de implementar.

Estado actual observado:

- `tabulators` tiene `status`.
- `Catalogs` permite actualizar nombre, importe, estado y orden.
- Horarios resuelven solo tabuladores `ACTIVO`.
- Nomina guarda `tabulator_name_snapshot` y `tabulator_amount`.

### 4.3 Asignaturas

Reglas:

- No borrar asignaturas usadas en horarios.
- Si cambia nombre oficial, decidir entre:
  - correccion ortografica menor con auditoria;
  - nuevo registro si cambia significado.
- Inactivar asignaturas que ya no se usen.
- Mantener nombre historico en snapshots de nomina.
- Evitar crear duplicados por acentos, mayusculas o variantes de escritura sin revision.

Estado actual observado:

- `subjects` tiene `status`.
- Horarios pueden crear asignaturas activas si no existen.
- Si una asignatura existe inactiva, Horarios bloquea su uso.
- Nomina guarda `subject_name_snapshot`.

### 4.4 Coordinaciones

Reglas:

- No borrar coordinaciones usadas por horarios, extras, nomina, docentes o `user_coordinations`.
- Cambios de nombre deben seguir politica formal:
  - alias visible;
  - nuevo registro;
  - inactivacion del anterior;
  - auditoria.
- No usar coordinaciones como persona responsable operativa; responsable es usuario/capturador segun H02.
- No tratar `Todas / Global` ni `No requiere coordinacion operativa` como coordinaciones reales.
- No fusionar coordinaciones sin plan de migracion y validacion historica.

Estado actual observado:

- `coordinations` tiene `status`.
- H02 usa `user_coordinations`.
- Horarios/Extras/Reportes filtran por coordinacion y tambien existen snapshots de nombre en nomina.

### 4.5 Docentes

Reglas:

- No eliminar docente si tiene horarios, extras, `payroll_lines`, documentos o auditoria relevante.
- Inactivar en vez de borrar.
- Mantener datos historicos necesarios para explicar nomina.
- Datos fiscales pueden actualizarse segun permisos H03, pero snapshots de nomina conservan lo pagado.
- Definir campos historicos vs actuales antes de cualquier normalizacion futura.
- Fusionar duplicados solo mediante proceso especial documentado, con backup, auditoria y validacion de dependencias.

Campos actuales sugeridos:

- Historicos/explicativos: `full_name`, nombres y apellidos, categoria, coordinacion, payment type, capturas relacionadas.
- Actuales/operativos: telefono, correo, estatus, datos fiscales vigentes segun H03.
- Sensibles: RFC, banco, correo fiscal y payment type se rigen por permisos fiscales.

Estado actual observado:

- `teachers` tiene `status`.
- El backend ya bloquea eliminacion si hay `schedules`, `extra_hours` o `payroll_lines`.
- Nomina guarda snapshots de nombre, categoria y tipo de pago.

### 4.6 Ciclos y quincenas

Reglas:

- Ciclos `CERRADO` son irreversibles segun H09/H10.
- No editar ciclos cerrados.
- No borrar quincenas con nomina.
- No editar fechas/etiquetas de quincenas usadas por nomina sin procedimiento excepcional documentado.
- Correcciones de calendario deben tener auditoria y validacion de impacto.
- `calendar_blackout_dates` debe conservar explicacion si afecto una quincena usada.

Estado actual observado:

- `academic_cycles.status` usa `PLANEACION`, `ACTIVO`, `CERRADO`.
- Calendario bloquea varias acciones sobre ciclos cerrados.
- Calendario no permite eliminar quincenas con nomina calculada.

### 4.7 Roles y permisos

Reglas:

- No borrar permisos usados por codigo.
- No renombrar codigos de permisos sin migracion, SPEC y pruebas.
- Agregar permisos nuevos solo con SPEC y pruebas.
- No crear roles tecnicos nuevos sin decision formal.
- No modificar asignaciones productivas sin auditoria y aprobacion.

Estado actual observado:

- `roles` y `permissions` no tienen estado activo/inactivo.
- Los codigos de permisos son contratos funcionales usados por backend/frontend.

## 5. Acciones permitidas / prohibidas

| Accion | Permitida | Condicion | Requiere aprobacion |
|---|---|---|---|
| Crear catalogo nuevo | Si | Cuando representa un concepto nuevo o cambio funcional. | Admin/Operacion segun catalogo. |
| Editar nombre | Condicionada | Solo correccion menor o cambio aprobado con auditoria. | Si, si ya tiene uso historico. |
| Editar importe de tabulador | No si fue usado | Crear nuevo tabulador cuando cambie monto. | Si, siempre que afecte nomina. |
| Inactivar | Si | Preferente ante baja operativa; no borra historia. | Si, Admin/Operacion. |
| Reactivar | Condicionada | Solo si conserva mismo significado y no genera conflicto. | Si. |
| Eliminar | Prohibida con dependencias | Solo registros sin uso historico y con validacion previa. | Si, Admin/DBA si aplica. |
| Fusionar registros | Evitar | Solo proceso especial con backup, auditoria y plan de migracion. | Si, Admin/DBA/Operacion. |
| Corregir acento | Condicionada | Si es correccion visual menor y no cambia significado. | Si, si fue usado historicamente. |
| Corregir typo | Condicionada | Igual que acentos; auditar. | Si, si fue usado historicamente. |
| Cambiar coordinacion | Condicionada | Crear nueva o alias si cambia estructura operativa. | Si. |
| Cambiar docente a inactivo | Si | Preferido sobre eliminar. | Admin/Operacion. |
| Editar ciclo cerrado | No | Solo procedimiento excepcional fuera de flujo normal. | Admin/DBA y aprobacion formal. |
| Borrar quincena con nomina | No | Debe conservarse. | No permitido en flujo normal. |

## 6. Reglas por modulo

### Catalogos

- Nuevas capturas deben usar catalogos activos.
- Catalogos inactivos deben seguir visibles en historicos si fueron usados.
- Edicion de nombre/importe de registros usados debe quedar bloqueada o sometida a flujo excepcional futuro.
- Inactivacion/reactivacion debe auditarse.

### Horarios

- Nuevos horarios deben mostrar solo asignaturas/tabuladores/coordinaciones activas.
- Horarios historicos deben mostrar el nombre usado aunque el catalogo quede inactivo.
- No se debe borrar un horario que ya alimenta nomina historica sin regla especial.
- Si una asignatura ya no se usa, se inactiva, no se elimina.

### Extras

- Nuevos extras deben usar docente/coordinacion activa y tabulador vigente segun regla definida.
- Extras historicos deben conservar razon, tabulador e importe usados.
- Extras con nomina guardada no deben eliminarse fuera del flujo actual de correccion aprobado.

### Nomina

- La nomina guardada debe seguir leyendo snapshots como fuente historica.
- Cambios posteriores en catalogos no deben alterar montos ni nombres snapshot de corridas guardadas.
- Cualquier cambio que altere snapshots historicos debe considerarse migracion de datos y requerir SPEC, backup y aprobacion.

### Finanzas

- Reportes historicos deben usar snapshots de nomina para explicar pagos.
- Reportes vivos pueden usar catalogos actuales, pero deben evitar confundir registros inactivos con borrados.
- Exportables CSV deben conservar nombres snapshot en historicos.

### Directorio

- Docentes con uso historico deben inactivarse, no eliminarse.
- Datos fiscales se gestionan por H03, pero no deben romper la explicacion de nominas ya guardadas.
- Duplicados deben resolverse con proceso especial, no con borrado directo si hay dependencias.

### Calendario

- Ciclos cerrados no se editan.
- Quincenas con nomina no se eliminan.
- Dias inhabiles historicos deben conservarse si afectaron una quincena usada.
- Correcciones excepcionales deben auditarse.

### Auditoria

- Inactivacion, reactivacion, cambio de nombre, cambio de importe y eliminacion excepcional deben registrarse.
- No registrar secretos ni datos fiscales completos innecesarios.
- Fusionar registros debe quedar como proceso extraordinario con evidencia.

## 7. Reglas UI/UX propuestas

Sin implementar en esta fase.

Propuestas:

- UI debe ocultar inactivos en nuevas capturas.
- UI debe mostrar inactivos en historico si fueron usados.
- UI debe impedir edicion peligrosa de registros usados o mostrar bloqueo claro.
- UI debe diferenciar correccion menor de cambio funcional.
- UI debe permitir consultar catalogos inactivos con filtros administrativos.

Etiquetas sugeridas:

- `Inactivo`.
- `Historico`.
- `No disponible para nuevas capturas`.
- `Usado en nomina historica`.
- `Requiere nuevo registro`.

No se cambian botones, vistas ni flujos en esta SPEC.

## 8. Reglas de auditoria

- Toda inactivacion debe auditarse.
- Toda reactivacion debe auditarse.
- Cambio de nombre debe auditarse con before/after.
- Cambio de importe debe auditarse y bloquearse si ya hay uso historico, salvo procedimiento especial futuro.
- Eliminacion debe quedar bloqueada si hay dependencias.
- Fusion debe evitarse salvo proceso especial.
- Auditoria debe registrar actor, fecha, entidad, antes/despues y motivo.
- No se deben registrar secretos ni datos fiscales completos si no son necesarios para la evidencia.

## 9. Reglas de migracion

- H12 puede requerir migracion futura si falta `status`, `is_active`, alias, vigencias o campos de auditoria en algun catalogo.
- Cualquier migracion futura debe iniciar en `013` o siguiente numero disponible segun H05.
- Antes de produccion debe pasar por:
  - `db:migrate:inspect`.
  - `db:migrate:status`.
  - `db:migrate:dry-run`.
  - backup.
  - `db:migrate:apply` solo con aprobacion.
- No crear migracion en esta fase.
- No modificar migraciones historicas.
- No renombrar archivos historicos.

## 10. Pruebas requeridas

Pruebas futuras recomendadas:

- No borrar tabulador usado.
- No editar importe de tabulador usado.
- Inactivar tabulador usado y conservar historico.
- Horarios nuevos no muestran tabuladores/asignaturas inactivas.
- Historicos si muestran inactivos usados.
- Nomina historica conserva snapshots aunque catalogo cambie/inactive.
- Docentes con nomina no se eliminan.
- Docentes con horarios/extras no se eliminan.
- Ciclos cerrados no se editan.
- Quincenas con nomina no se eliminan.
- Permisos no se renombran.
- `user_coordinations` no pierde referencia si coordinacion se inactiva.
- Reportes CSV siguen mostrando snapshots correctos.

## 11. Riesgos

- Perdida de trazabilidad.
- Ruptura de reportes historicos.
- Pagos no explicables.
- Cambios retroactivos.
- Duplicados por acentos, typos o nombres equivalentes.
- Confusion entre correccion ortografica y cambio funcional.
- Inconsistencias si UI oculta todo inactivo en historicos.
- Reutilizacion de un tabulador con monto distinto.
- Borrado de quincenas o ciclos usados.
- Fusion manual de docentes con dependencias.
- Renombrado de permisos/roles usados por codigo.

## 12. Decisiones humanas pendientes

[ ] Se permite corregir acentos/typos en catalogos ya usados?

[ ] Correccion de acento se considera cambio historico o correccion visual?

[ ] Cambio de importe de tabulador obliga siempre a nuevo registro?

[ ] Quien puede inactivar catalogos?

[ ] Quien puede reactivar?

[ ] Se permite fusionar duplicados?

[ ] Como se debe mostrar un catalogo inactivo en reportes historicos?

[ ] Cuanto tiempo conservar catalogos inactivos?

[ ] Se requiere alias/nombre visible actual vs nombre historico?

[ ] Se requiere vigencia formal para tabuladores?

[ ] Se requiere estatus para quincenas o basta con reglas por ciclo y dependencias?

## 13. Recomendacion tecnica

Recomendacion H12:

- Adoptar formalmente politica de `inactivar, no borrar`.
- Crear nuevos registros ante cambios funcionales.
- Bloquear edicion de importes de tabuladores usados.
- Conservar y priorizar snapshots de nomina.
- Auditar cambios de catalogos.
- Implementar por fases, iniciando con inventario tecnico de columnas/dependencias existentes.
- No tocar H01/H02/H03/H05/H09/H10/H11 funcional.

## 14. Plan propuesto H12

### H12-F0 SPEC

Esta fase.

Resultado esperado:

- Politica documental aprobada.
- No codigo.
- No base de datos.
- No migraciones.

### H12-F1 Inventario tecnico de columnas existentes

Objetivo:

- Confirmar columnas de estado/activo por tabla.
- Confirmar dependencias FK y snapshots.
- Identificar rutas que permiten `UPDATE` o `DELETE`.
- Identificar UI que muestra activos/inactivos.

### H12-F2 Diseno tecnico

Objetivo:

- Definir cambios por tabla/modulo.
- Definir si se requiere migracion `013`.
- Definir contratos API.
- Definir reglas de auditoria.

### H12-F3 Implementacion backend

Objetivo:

- Bloqueos de borrado/edicion con dependencias.
- Auditoria de inactivacion/reactivacion.
- Reglas para tabuladores usados.
- Validaciones de quincenas/ciclos.

### H12-F4 Frontend

Objetivo:

- Filtros de activos/historicos.
- Etiquetas visuales.
- Bloqueos claros.
- Formularios para inactivar/reactivar segun permisos.

### H12-F5 Pruebas/deploy

Objetivo:

- Pruebas automatizadas.
- Pruebas manuales por rol.
- Predeploy, backup y deploy controlado si hay cambios funcionales o DB.

## 15. Que NO se hizo

Confirmado:

- No se modifico codigo.
- No se modifico BD.
- No se ejecutaron migraciones.
- No se cambio UI.
- No se tocaron catalogos reales.
- No se hizo deploy.
- No se modificaron reglas cerradas H01/H02/H03/H05/H09/H10/H11.
- No se modificaron permisos.
- No se modifico formula de nomina.
- No se modificaron datos productivos.
