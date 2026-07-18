# H02/H03 - Plan de Migracion de Datos Oficiales Mayo 2026

## 1. Objetivo

Preparar una migracion controlada de los datos oficiales validados en preview/local hacia la base productiva `nomina_docente`.

Este plan cubre:

- Directorio oficial actualizado.
- Horarios oficiales.
- Incidencias de la segunda quincena de mayo 2026.
- Extras oficiales de la segunda quincena de mayo 2026.
- Relaciones tecnicas `user_coordinations` si se requieren para preview de nomina por alcance.
- Validacion del calculo final esperado de `$517,510.00`.

Este documento no ejecuta la migracion. Define el procedimiento, compuertas, validaciones y rollback.

## 2. Estado actual confirmado

Produccion ya tiene desplegado H02/H03 en codigo y migracion 011, pero no tiene los datos oficiales que se probaron en preview/local.

Conteo observado en produccion despues del deploy:

| Tabla | Produccion `nomina_docente` |
|---|---:|
| `app_users` | 19 |
| `teachers` | 213 |
| `schedules` | 595 |
| `schedule_incidences` | 0 |
| `extra_hours` | 0 |
| `payroll_runs` | 2 |
| `user_coordinations` | 0 |

Conteo documentado en preview/revision:

| Tabla | Revision H02/H03 |
|---|---:|
| `teachers` | 216 |
| `schedules` | 589 |
| `schedule_incidences` | 18 |
| `extra_hours` | 65 |
| `user_coordinations` | 15 |

Conclusion:

- El deploy productivo actualizo aplicacion y permisos.
- No se migraron Directorio/Horarios/Incidencias/Extras desde preview/local.
- Se requiere fase de datos separada antes de validar la segunda quincena en produccion.

## 3. Fuente de verdad para datos

Fuente recomendada:

```text
Cloud SQL: nomina-docente-web
Base origen: nomina_docente_h02h03_review
Base destino: nomina_docente
```

Motivo:

- La base de revision contiene los CSV oficiales ya cargados y conciliados.
- Evita reprocesar manualmente archivos CSV en produccion.
- Permite comparar origen/destino dentro de la misma instancia Cloud SQL.

Fuentes documentales de respaldo:

- CSV Directorio oficial actualizado.
- CSV Horarios Doc oficiales.
- CSV Extras oficial.
- `docs/auditoria/H02_H03_Conciliacion_Nomina_Mayo_2026.md`
- `docs/auditoria/H02_H03_Deploy_Productivo_Resultado.md`

Si la base de revision no coincide con los CSV oficiales, detener la migracion y corregir primero la base de revision.

Actualizacion de dry-run:

- La base Cloud `nomina_docente_h02h03_review` conserva el resultado correcto en `payroll_runs`, pero despues de guardar/pagar nomina ya no conserva Incidencias/Extras vivos.
- La fuente viva validada para migrar datos operativos es la base local `nomina_docente_deploy_snapshot_20260526_111616_h02h03`.
- Esa base contiene `teachers=216`, `schedules=589`, `schedule_incidences=18`, `extra_hours=65` y `user_coordinations=15`.
- Por tanto, para migrar datos vivos se debe exportar desde esa base local validada, no desde la preview Cloud si esta ya fue limpiada por el flujo de nomina.

## 4. Principios de migracion

1. No hacer truncado global de base de datos.
2. No tocar `payroll_runs` ni `payroll_lines` historicos.
3. No borrar historial de la primera quincena.
4. No modificar H01 ni formula de nomina.
5. No cambiar precision monetaria.
6. No retirar fallback legacy.
7. No activar modo estricto.
8. No importar documentos fiscales ni constancias desde Storage.
9. No documentar valores sensibles en reportes visibles.
10. Ejecutar backup productivo antes de cualquier escritura.
11. Ejecutar primero en dry-run sobre una copia de produccion.
12. Migrar produccion solo despues de validar diffs y calculo esperado.

## 5. Alcance por tabla

### 5.1 Tablas a migrar o sincronizar

| Tabla | Accion recomendada | Motivo |
|---|---|---|
| `teachers` | Upsert controlado | Directorio oficial actualizado. |
| `coordinations` | Upsert solo si faltan catalogos oficiales | Evitar referencias rotas. |
| `subjects` | Upsert | Horarios oficiales pueden traer asignaturas nuevas. |
| `tabulators` | Upsert | Horarios/Extras requieren tabuladores. |
| `academic_cycles` | Validar/upsert si falta ciclo activo | Necesario para horarios/extras. |
| `payroll_calendar_config` | Validar/upsert quincena `2026-05-15 a 2026-05-28` | Necesario para incidencias y calculo. |
| `schedules` | Reemplazo controlado por ciclo oficial | Horarios oficiales deben quedar como fuente actual. |
| `schedule_incidences` | Reemplazo controlado para quincena oficial | Produccion tiene 0 y se requieren 18. |
| `extra_hours` | Reemplazo controlado por ciclo oficial | Produccion tiene 0 y se requieren 65. |
| `user_coordinations` | Insert tecnico si se mantiene preview por alcance | Produccion tiene 0; revision tiene 15. |

### 5.2 Tablas que no se deben migrar

| Tabla | Motivo |
|---|---|
| `payroll_runs` | Ya existe historial productivo; no debe pisarse. |
| `payroll_lines` | Historial de nomina; no debe pisarse. |
| `audit_log` | Auditoria productiva propia. |
| `teacher_documents` | Constancias/documentos no forman parte de esta migracion. |
| Storage de constancias | Fuera de alcance; no mover documentos fiscales. |

## 6. Reglas especiales por modulo

### 6.1 Directorio

El Directorio debe actualizarse con la version oficial.

Reglas:

- Usar `normalized_name` como llave principal cuando el docente ya existe.
- Si hay cambios de nombre que rompen `normalized_name`, generar reporte manual de equivalencias antes de escribir.
- Si el mismo `id` existe y el `normalized_name` cambia por correccion oficial de orden/nombre, tratarlo como `REVIEW`, no como bloqueante, siempre que no exista otro docente con ese `normalized_name`.
- No eliminar docentes de produccion automaticamente.
- Docentes que existan en produccion y no en la fuente oficial deben quedar en reporte de revision.
- `payment_type` es dato fiscal-financiero sensible; se puede migrar solo si el archivo oficial fue aprobado por Admin/RH/Finanzas.
- `rfc` y `bank_detail` no deben exponerse en reportes. Si se migran, hacerlo solo desde fuente oficial autorizada y con reporte redacted.

Validaciones esperadas:

| Validacion | Esperado |
|---|---:|
| Docentes despues de migracion | 216 o el total oficial aprobado |
| Docentes duplicados por `normalized_name` | 0 |
| Docentes sin nombre | 0 |
| Categoria fuera de `V/M/N/''` | 0 |
| Tipo de pago fuera de `E/1/2/''` | 0 |

### 6.2 Horarios

El CSV de Horarios oficial sustituye la carga operativa actual para el ciclo validado.

Reglas:

- No truncar todos los horarios historicos.
- Reemplazar solo horarios del ciclo objetivo.
- Preservar o insertar `teacher_id`, `coordination_id`, `subject_id`, `tabulator_id` validos.
- Mantener `created_by` desde la fuente de revision para respetar reglas H02 por capturador.
- Validar que no existan horarios con docente inexistente.
- Validar maximo de horas por semana segun categoria antes y despues.

Validaciones esperadas:

| Validacion | Esperado |
|---|---:|
| Horarios oficiales | 589 |
| Horarios sin docente valido | 0 |
| Horarios sin coordinacion valida | 0 |
| Horarios sin `created_by` | 0 |
| Violaciones de maxima carga semanal | 0 bloqueantes, o reporte aprobado |

### 6.3 Incidencias

Las incidencias vienen del CSV de Horarios, columnas:

- Faltas.
- Retardos.
- Extras en horario.

Reglas:

- Asociar incidencias al `schedule_id` oficial y a la quincena `2026-05-15 a 2026-05-28`.
- No usar la quincena de prueba `_2DA` como fuente final.
- No usar `updated_by` como autoria original.
- Si se reemplazan horarios, insertar incidencias despues de insertar horarios.

Validaciones esperadas:

| Validacion | Esperado |
|---|---:|
| Incidencias oficiales | 18 |
| Faltas totales | 30 |
| Retardos totales | 0 |
| Descuento por faltas esperado | `$4,035.00` |

### 6.4 Extras

Los Extras oficiales son los del CSV conciliado.

Reglas:

- Insertar solo extras de la quincena/ciclo oficial.
- Mantener `captured_by` desde la fuente de revision.
- Mantener observaciones donde se coloco la fecha/actividad indicada por CSV.
- Incluir filas detectadas como omitidas por el programa anterior:
  - LUCIANO COCOM UHH, `$1,500.00`.
  - PEDRO ANTONIO RUIZ MARTINEZ, `$90.00`.
- No crear extras duplicados si se reejecuta la migracion.

Validaciones esperadas:

| Validacion | Esperado |
|---|---:|
| Extras oficiales | 65 |
| Horas extra | 1025.0 |
| Importe extras | `$128,310.00` |
| Extras sin `captured_by` | 0 |

### 6.5 `user_coordinations`

Aunque la operacion diaria quedo basada en rol y capturador, `user_coordinations` sigue siendo modelo formal H02 y puede ser necesario para preview de nomina por alcance.

Reglas:

- Migrar desde revision si se confirma que las 15 filas son correctas.
- No mostrar al Admin una lista confusa de nombres/personas como flujo operativo.
- No crear coordinaciones reservadas.
- No crear rol tecnico `subdireccion`.

Validaciones esperadas:

| Validacion | Esperado |
|---|---:|
| Filas tecnicas `user_coordinations` | 15 o total aprobado |
| Coordinadores sin alcance formal cuando aplique | 0 |
| Coordinacion `Todas / Global` | 0 |
| Coordinacion `No requiere coordinacion operativa` | 0 |

## 7. Fase 0 - Congelamiento operativo

Antes de migrar datos:

1. Avisar a usuarios que no capturen Directorio, Horarios, Incidencias ni Extras durante la ventana.
2. Confirmar que no hay guardado de nomina en curso.
3. Confirmar que no existe corrida activa para la quincena final que pueda limpiar Incidencias/Extras.
4. Confirmar que la quincena correcta es:

```text
2026-05-15 a 2026-05-28
```

5. Confirmar que el total esperado es:

```text
$517,510.00
```

## 8. Fase 1 - Backup e inventario productivo

Backup nuevo recomendado antes de la migracion de datos:

```powershell
$gcloud = (Get-Command gcloud.cmd).Source
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
& $gcloud sql export sql nomina-docente-web `
  "gs://nomina-docente-prod-sql-imports/backups/pre-h02h03-data-migration-$stamp.sql.gz" `
  --database=nomina_docente `
  --project=nomina-docente-prod `
  --quiet
```

Inventario minimo:

```sql
SELECT 'teachers' AS table_name, count(*) FROM teachers
UNION ALL SELECT 'schedules', count(*) FROM schedules
UNION ALL SELECT 'schedule_incidences', count(*) FROM schedule_incidences
UNION ALL SELECT 'extra_hours', count(*) FROM extra_hours
UNION ALL SELECT 'payroll_runs', count(*) FROM payroll_runs
UNION ALL SELECT 'payroll_lines', count(*) FROM payroll_lines
UNION ALL SELECT 'user_coordinations', count(*) FROM user_coordinations;
```

## 9. Fase 2 - Diff origen vs destino

Comparar `nomina_docente_h02h03_review` contra `nomina_docente`.

Consultas de control:

```sql
SELECT 'source teachers' AS metric, count(*) FROM nomina_docente_h02h03_review.public.teachers
UNION ALL SELECT 'target teachers', count(*) FROM nomina_docente.public.teachers;
```

Si no se puede consultar cross-database directamente en Cloud SQL, exportar reportes CSV desde cada base y comparar localmente.

Reportes obligatorios:

| Reporte | Debe revisarse antes de escribir |
|---|---|
| Docentes en fuente no encontrados en produccion | Si |
| Docentes en produccion no encontrados en fuente | Si |
| Docentes con cambio de nombre/normalizacion | Si |
| Horarios por coordinacion | Si |
| Horarios por docente | Si |
| Incidencias por quincena | Si |
| Extras por docente/coordinacion/capturador | Si |
| Diferencias de tabulador | Si |

Bloquear migracion si:

- Hay docentes oficiales sin mapeo.
- Hay horarios con docente o coordinacion inexistente.
- Hay extras sin docente, tabulador o capturador.
- Hay incidencias apuntando a horarios que no existiran en destino.
- Hay diferencias no explicadas contra el total `$517,510.00`.

## 10. Fase 3 - Dry-run en copia de produccion

Crear una base temporal de prueba desde produccion, por ejemplo:

```text
nomina_docente_h02h03_data_dryrun
```

Flujo:

1. Restaurar copia de `nomina_docente`.
2. Aplicar script de migracion de datos sobre la copia.
3. Ejecutar validaciones.
4. Levantar API temporal o apuntar localmente a esa base.
5. Calcular nomina de `2026-05-15 a 2026-05-28`.
6. Confirmar total `$517,510.00`.

No pasar a produccion si el dry-run no cuadra.

## 11. Fase 4 - Script productivo controlado

El script productivo debe ser transaccional.

Orden recomendado:

1. Validar base actual `nomina_docente`.
2. Crear tablas backup internas con timestamp:
   - `backup_h02h03_teachers_<stamp>`
   - `backup_h02h03_schedules_<stamp>`
   - `backup_h02h03_schedule_incidences_<stamp>`
   - `backup_h02h03_extra_hours_<stamp>`
   - `backup_h02h03_user_coordinations_<stamp>`
3. Upsert catalogos: `coordinations`, `subjects`, `tabulators`, `academic_cycles`, `payroll_calendar_config`.
4. Upsert Directorio.
5. Reemplazar Horarios del ciclo objetivo.
6. Insertar Incidencias de la quincena oficial.
7. Insertar Extras oficiales.
8. Insertar `user_coordinations` tecnicas si se aprueba.
9. Ejecutar validaciones dentro de la misma transaccion.
10. Confirmar con `COMMIT` solo si todo pasa.

No hacer:

- `TRUNCATE teachers`.
- `TRUNCATE payroll_runs`.
- `TRUNCATE payroll_lines`.
- `DELETE` global sin filtro por ciclo/quincena.

## 12. Fase 5 - Validacion post-migracion

### 12.1 Conteos

Esperado despues de migrar:

| Tabla | Esperado |
|---|---:|
| `teachers` | 216 o total oficial aprobado |
| `schedules` | 589 para ciclo oficial |
| `schedule_incidences` | 18 para quincena oficial |
| `extra_hours` | 65 para ciclo/quincena oficial |
| `user_coordinations` | 15 si se aprueba migrarlas |
| `payroll_runs` | Sin perdida de historial |
| `payroll_lines` | Sin perdida de historial |

### 12.2 Calidad de datos

```sql
SELECT count(*) AS duplicated_teachers
FROM (
  SELECT normalized_name
  FROM teachers
  GROUP BY normalized_name
  HAVING count(*) > 1
) dup;

SELECT count(*) AS schedules_without_teacher
FROM schedules s
LEFT JOIN teachers t ON t.id = s.teacher_id
WHERE t.id IS NULL;

SELECT count(*) AS extras_without_captured_by
FROM extra_hours
WHERE captured_by IS NULL;

SELECT count(*) AS incidences_without_schedule
FROM schedule_incidences si
LEFT JOIN schedules s ON s.id = si.schedule_id
WHERE s.id IS NULL;
```

Esperado:

```text
0 en todos los casos.
```

### 12.3 Calculo de nomina

Validar en UI/API:

```text
Quincena: 2026-05-15 a 2026-05-28
Dias inhabiles: 0
```

Resultado esperado:

| Concepto | Esperado |
|---|---:|
| Horas base | 3021.0 |
| Importe bruto horarios | `$393,235.00` |
| Faltas | 30 |
| Descuento incidencias | `-$4,035.00` |
| Extras | 1025.0 |
| Importe extras | `$128,310.00` |
| Total | `$517,510.00` |

Si el total es `$521,545.00`, falta asociar incidencias a la quincena correcta.

## 13. Fase 6 - Smoke test funcional

Usuarios/roles a probar:

| Rol | Prueba minima |
|---|---|
| Admin | Ve Directorio, Horarios, Incidencias, Extras y Nomina. |
| Coordinador | Ve/edita solo lo que capturo; puede usar docentes compartidos. |
| Direccion/Subdireccion | Ve Extras, edita solo propios. |
| RH | Fiscal/documentos permitidos. |
| Finanzas | Finance workflow permitido. |
| Contador/Contabilidad | Export permitido, sin fiscal/workflow. |

Pruebas de bloqueo:

- Coordinador no guarda nomina.
- Coordinador no edita fiscal.
- Coordinador no sube/descarga constancia.
- Direccion no cambia estados financieros.
- Contador no cambia estados financieros.

## 14. Rollback

Orden de rollback recomendado:

1. Si falla codigo: revertir API a `nomina-api-00043-p96` o revision estable posterior.
2. Si falla Hosting: restaurar version previa desde Firebase Hosting.
3. Si falla migracion de datos antes de `COMMIT`: `ROLLBACK`.
4. Si falla despues de `COMMIT`: restaurar tablas desde backups internos si el problema es acotado.
5. Si el problema es amplio: restaurar backup Cloud SQL completo:

```text
pre-h02h03-data-migration-<stamp>.sql.gz
```

La restauracion completa debe ser ultima opcion porque puede perder capturas hechas despues del backup.

## 15. Entregables antes de ejecutar

Antes de migrar datos en produccion se deben crear:

1. Script SQL de diff origen/destino.
2. Script SQL de dry-run.
3. Script SQL productivo transaccional.
4. Documento de resultado de dry-run.
5. Documento de resultado productivo.

## 16. Scripts preparados

Se prepararon los scripts en:

```text
database/imports/h02_h03_may_2026_official/
```

Archivos:

| Archivo | Funcion |
|---|---|
| `README.md` | Orden de ejecucion, comandos y resultado esperado. |
| `01_export_review_to_csv.sql` | Exporta CSV desde `nomina_docente_h02h03_review`. |
| `02_prepare_staging.sql` | Crea staging en `nomina_docente` o dry-run. |
| `03_import_csv_to_staging.sql` | Carga CSV al staging. |
| `04_validate_staging.sql` | Valida bloqueantes antes de escribir datos oficiales. |
| `05_apply_official_may_2026.sql` | Aplica migracion transaccional desde staging. |
| `06_post_migration_validation.sql` | Valida conteos y totales clave despues de aplicar. |
| `99_cleanup_after_validation.md` | Comandos de limpieza posterior, no ejecutables automaticamente. |

Caracteristicas de seguridad:

- Tienen guardas por nombre de base.
- No migran `payroll_runs`.
- No migran `payroll_lines`.
- No migran `audit_log`.
- No migran documentos fiscales.
- No hacen truncados globales.
- Usan staging antes de aplicar.
- El script productivo crea backup interno de tablas operativas antes de reemplazar datos del ciclo.
- El script productivo mapea usuarios por `email`, no por UUID directo.
- El script productivo mapea coordinaciones, materias y tabuladores por nombre.
- El script productivo conserva `created_by` y `captured_by` usando equivalencia por correo.

## 17. Veredicto

Se recomienda migrar los datos en una fase separada, no como deploy de codigo.

Orden recomendado:

```text
1. Validar fuente revision.
2. Crear dry-run desde produccion.
3. Ejecutar migracion en dry-run.
4. Confirmar calculo $517,510.00.
5. Ejecutar backup productivo.
6. Ejecutar migracion productiva.
7. Validar calculo y smoke por rol.
```

No capturar nueva informacion operativa en produccion hasta completar esta migracion o hasta decidir formalmente que Operacion empezara captura desde cero.
