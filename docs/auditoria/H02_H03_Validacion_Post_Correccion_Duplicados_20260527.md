# Validacion post-correccion de duplicados de docentes - H02/H03

Fecha: 2026-05-27

## 1. Objetivo

Validar el impacto posterior a la correccion productiva de docentes duplicados por formato de nombre:

- apellido(s) + nombre(s)
- nombre(s) + apellido(s)

La validacion confirma que la limpieza no afecto nomina, historial, permisos H02/H03, H01 ni disponibilidad de API.

## 2. Ambiente validado

| Componente | Valor |
|---|---|
| Proyecto GCP | `nomina-docente-prod` |
| Cloud Run | `nomina-api` |
| Revision activa | `nomina-api-00044-pk9` |
| Base validada | `nomina_docente` |
| Backup previo | `gs://nomina-docente-prod-sql-imports/backups/pre-teacher-dedup-20260527-135717.sql.gz` |

## 3. Resultado general

Estado: **Pasó con observaciones no bloqueantes**.

No se detectaron errores criticos ni impacto sobre calculos de nomina.

## 4. Validacion de datos

### Docentes conservados

Despues de la correccion solo quedaron los registros normalizados por nombre(s) + apellido(s):

| Docente |
|---|
| ALEJANDRA BERENICE HEDDING RODRIGUEZ |
| ELBERTH ABEL FLOTA GARIBAY |
| JUAN DOMINGUEZ CASAUX |
| KARLA ELVIRA MORALES GOMEZ |

### Duplicados restantes

Busqueda por firma de tokens del nombre:

| Validacion | Resultado |
|---|---:|
| Duplicados por orden de tokens | 0 |

## 5. Validacion de nomina

La limpieza no cambio importes ni conteos historicos de nomina.

| Periodo | Estado | Lineas | Total |
|---|---|---:|---:|
| 2026-05-15 a 2026-05-28 | PAGADA | 221 | 517,510.00 |
| 2026-05-04 a 2026-05-14 | PAGADA | 201 | 435,405.00 |
| 2026-05-04 a 2026-05-14 | CANCELADA | 200 | 438,765.00 |

Para `ELBERTH ABEL FLOTA GARIBAY`, las lineas historicas quedaron apuntando al docente correcto y con snapshot normalizado.

## 6. Auditoria

Se confirmaron 4 eventos en `audit_log`:

| Evento | Conteo |
|---|---:|
| `TEACHER_DEDUP_MERGED` | 4 |

Detalle confirmado:

| Duplicado eliminado | Docente conservado | Lineas de nomina reasignadas |
|---|---|---:|
| DOMINGUEZ CASAUX JUAN | JUAN DOMINGUEZ CASAUX | 0 |
| FLOTA GARIBAY ELBERTH ABEL | ELBERTH ABEL FLOTA GARIBAY | 2 |
| HEDDING RODRIGUEZ ALEJANDRA BERENICE | ALEJANDRA BERENICE HEDDING RODRIGUEZ | 0 |
| MORALES GOMEZ KARLA ELVIRA | KARLA ELVIRA MORALES GOMEZ | 0 |

Cada evento conserva referencia al backup previo.

## 7. Logs revisados

Se revisaron logs recientes de Cloud Run para `nomina-api`.

| Validacion | Resultado |
|---|---|
| `severity >= ERROR` en ultima hora | Sin resultados |
| `httpRequest.status >= 500` en ultimas 2 horas | Sin resultados |
| Healthcheck API | 200 OK |
| Intentos previos de eliminar docente duplicado | 3 respuestas 400 antes de la correccion |
| Fallback legacy | Eventos `LEGACY_COORDINATION_FALLBACK_USED` visibles |

Los `400` corresponden al comportamiento esperado antes de la correccion: el backend bloqueo la eliminacion directa porque el docente tenia registros historicos.

Los eventos `LEGACY_COORDINATION_FALLBACK_USED` son una observacion no bloqueante. El fallback sigue habilitado por decision H02 y debe monitorearse durante el periodo de estabilizacion antes de su retiro.

## 8. Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| `npm --workspace apps/api run typecheck` | Paso |
| `npm --workspace apps/web run typecheck` | Paso |
| `npm run typecheck` | Paso |
| `npm run build` | Paso |
| Healthcheck productivo | Paso |
| Validacion SQL de duplicados | Paso |
| Validacion SQL de nomina | Paso |
| Validacion SQL de auditoria | Paso |
| Validacion de backup en Storage | Paso |

## 9. Impacto

### Impacto confirmado

- Se corrigio identidad de docentes duplicados.
- Se conservaron los historicos de nomina.
- Se mantuvo el total de nomina de la segunda quincena de mayo en `$517,510.00`.
- Se mantuvo el historial de auditoria.

### Sin impacto detectado

- No cambio formula de nomina.
- No cambio precision monetaria H01.
- No cambiaron permisos H02/H03.
- No cambiaron horarios vivos.
- No cambiaron extras vivos.
- No cambiaron incidencias.
- No hubo deploy.
- No hubo cambios de codigo funcional.

## 10. Observaciones no bloqueantes

1. El fallback legacy sigue apareciendo en logs. Esto es esperado mientras `LEGACY_COORDINATION_FALLBACK_ENABLED=true`, pero debe considerarse al definir la fecha de retiro.
2. La rama local queda con documentacion pendiente de subir si aun no se hace push.
3. Siguen existiendo recursos temporales de revision/dry-run que deben eliminarse solo cuando Admin confirme cierre:
   - base `nomina_docente_h02h03_review`
   - base `nomina_docente_h02h03_data_dryrun`
   - servicio Cloud Run `nomina-api-h02h03-review`
   - canal Firebase Hosting `h02-h03-review`

## 11. Recomendacion

Se puede considerar cerrada la correccion de duplicados de docentes.

Siguiente paso recomendado:

1. Subir commits de documentacion pendientes.
2. Confirmar que ya no se requiere la base/servicio/canal de revision.
3. Ejecutar limpieza controlada de recursos temporales con validacion previa y posterior.

No se recomienda retirar fallback legacy todavia; debe cumplirse la condicion aprobada de estabilizacion H02.
