# Correccion de duplicados de docentes - H02/H03

Fecha: 2026-05-27

## Objetivo

Normalizar docentes duplicados que existian con dos variantes de nombre:

- apellido(s) + nombre(s)
- nombre(s) + apellido(s)

La decision operativa fue conservar unicamente la forma nombre(s) + apellido(s).

## Alcance

Se realizo una correccion controlada en la base productiva `nomina_docente`.

No se modifico:

- formula de nomina
- precision monetaria H01
- horarios vivos
- extras vivos
- incidencias
- permisos
- codigo frontend/backend
- migraciones

## Backup previo

Antes de la correccion se genero backup completo de Cloud SQL:

`gs://nomina-docente-prod-sql-imports/backups/pre-teacher-dedup-20260527-135717.sql.gz`

## Docentes normalizados

| Docente conservado | Duplicado eliminado | Accion |
|---|---|---|
| ELBERTH ABEL FLOTA GARIBAY | FLOTA GARIBAY ELBERTH ABEL | Se reasignaron 2 lineas historicas de nomina al docente conservado y se elimino el duplicado. |
| ALEJANDRA BERENICE HEDDING RODRIGUEZ | HEDDING RODRIGUEZ ALEJANDRA BERENICE | Se elimino duplicado sin dependencias. |
| JUAN DOMINGUEZ CASAUX | DOMINGUEZ CASAUX JUAN | Se elimino duplicado sin dependencias. |
| KARLA ELVIRA MORALES GOMEZ | MORALES GOMEZ KARLA ELVIRA | Se elimino duplicado sin dependencias. |

## Validaciones previas

Se identifico que `FLOTA GARIBAY ELBERTH ABEL` no tenia horarios, extras ni documentos, pero si tenia 2 registros historicos en `payroll_lines`.

Por ello no era seguro eliminarlo directamente desde la aplicacion: la ruta de borrado bloquea docentes con dependencias operativas o historicas.

## Cambios aplicados

En una sola transaccion:

1. Se valido que los 4 pares esperados existieran.
2. Se reasignaron dependencias de duplicados a docentes conservados.
3. Se actualizaron snapshots historicos de nombre en `payroll_lines` para dejar el nombre normalizado.
4. Se eliminaron los 4 registros duplicados de `teachers`.
5. Se registraron 4 eventos `TEACHER_DEDUP_MERGED` en `audit_log`.
6. Se valido que el conteo y suma historica de `payroll_lines` no cambiara.

Resultado de reasignaciones:

| Tabla | Registros reasignados |
|---|---:|
| schedules | 0 |
| extra_hours | 0 |
| teacher_documents | 0 |
| payroll_lines | 2 |

## Validaciones posteriores

Despues de la correccion:

- Solo quedan los 4 docentes con formato nombre(s) + apellido(s).
- No quedan duplicados detectables por firma de tokens del nombre.
- Las lineas historicas de FLOTA apuntan a `ELBERTH ABEL FLOTA GARIBAY`.
- La nomina `2026-05-15 a 2026-05-28` permanece en `$517,510.00`.
- El total historico de `payroll_lines` no cambio.

Totales validados en `payroll_lines`:

| Momento | Lineas | Total |
|---|---:|---:|
| Antes | 622 | 1,391,680.00 |
| Despues | 622 | 1,391,680.00 |

Ultimas corridas validadas:

| Periodo | Estado | Lineas | Total |
|---|---|---:|---:|
| 2026-05-15 a 2026-05-28 | PAGADA | 221 | 517,510.00 |
| 2026-05-04 a 2026-05-14 | PAGADA | 201 | 435,405.00 |
| 2026-05-04 a 2026-05-14 | CANCELADA | 200 | 438,765.00 |

## Rollback

Si se requiriera revertir por un problema amplio, usar el backup completo:

`gs://nomina-docente-prod-sql-imports/backups/pre-teacher-dedup-20260527-135717.sql.gz`

Si se requiriera revertir solo esta correccion, se puede reconstruir desde `audit_log` usando los eventos `TEACHER_DEDUP_MERGED`, que conservan `before_data`, `after_data`, docente canonico y docente duplicado.

## Resultado

Correccion completada sin impacto en calculo de nomina, H01, permisos H02/H03 ni datos vivos de horarios/extras/incidencias.
