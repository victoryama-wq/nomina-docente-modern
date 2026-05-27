# H02/H03 - Dry-run Migracion Datos Oficiales Mayo 2026

## 1. Objetivo

Validar la migracion de datos oficiales de mayo 2026 sobre una copia temporal de produccion antes de tocar la base productiva `nomina_docente`.

Este dry-run no escribio sobre `nomina_docente`.

## 2. Ambientes usados

Destino temporal:

```text
Cloud SQL instance: nomina-docente-web
Base dry-run: nomina_docente_h02h03_data_dryrun
```

Base usada para crear dry-run:

```text
nomina_docente
```

Fuente oficial viva usada para datos:

```text
nomina_docente_deploy_snapshot_20260526_111616_h02h03
```

Motivo de cambio de fuente:

- La base Cloud `nomina_docente_h02h03_review` conserva el resultado correcto en `payroll_runs`.
- Sin embargo, al haberse guardado/pagado la nomina en revision, los modulos vivos `schedule_incidences` y `extra_hours` quedaron limpios.
- Para migrar datos operativos vivos se uso la base local validada, que conserva Incidencias y Extras oficiales.

## 3. Preparacion

Se creo la base dry-run:

```text
nomina_docente_h02h03_data_dryrun
```

Se exporto produccion actual y se importo en dry-run:

```text
gs://nomina-docente-prod-sql-imports/dryrun/h02h03-data-dryrun-source-prod-20260527-124338.sql.gz
```

Resultado:

```text
Dry-run creada desde el estado real de produccion.
```

## 4. Fuente exportada

Export desde:

```text
nomina_docente_deploy_snapshot_20260526_111616_h02h03
```

Conteos exportados:

| Tabla | Filas |
|---|---:|
| `app_users` | 19 |
| `coordinations` | 27 |
| `subjects` | 274 |
| `tabulators` | 8 |
| `academic_cycles` | 1 |
| `payroll_calendar_config` | 2 |
| `calendar_blackout_dates` | 0 |
| `teachers` | 216 |
| `schedules` | 589 |
| `schedule_incidences` | 18 |
| `extra_hours` | 65 |
| `user_coordinations` | 15 |

Los CSV fueron archivos temporales locales para staging y no deben versionarse.

## 5. Validacion de staging

Resultado de `04_validate_staging.sql`:

| Validacion | Resultado |
|---|---|
| `staging teachers` | 216, OK |
| `staging schedules` | 589, OK |
| `staging incidences` | 18, OK |
| `staging extras` | 65, OK |
| `staging user_coordinations` | 15, OK |
| Coordinaciones reservadas | 0, OK |
| Duplicados por `normalized_name` | 0, OK |
| Horarios sin docente/coordinacion | 0, OK |
| Horarios sin `created_by` mapeable | 0, OK |
| Extras sin `captured_by` mapeable | 0, OK |
| Incidencias sin horario | 0, OK |
| Faltas totales | 30.0, OK |
| Retardos totales | 0, OK |
| Horas extra | 1025.0, OK |
| Importe extras | 128310.000, OK |

Observacion:

Se detectaron 3 cambios oficiales de nombre con el mismo `id` de docente y diferente `normalized_name`.

| Produccion previa | Fuente oficial |
|---|---|
| `ARANDA HANSMANN BLANCA MARIA TERESA` | `BLANCA MARIA TERESA ARANDA HANSMANN` |
| `ROXANA DEL CARMEN LANDERO RAMIREZ` | `LANDERO RAMIREZ ROXANA DEL CARMEN` |
| `SHIELDS MUÑOZ LUIS RODOLFO` | `LUIS RODOLFO SHIELDS MUÑOZ` |

Decision tecnica:

- Se trato como `REVIEW`, no como bloqueante.
- No habia conflicto con otro `normalized_name`.
- Corresponde a los cambios oficiales de Directorio anticipados por Operacion/Admin.

## 6. Aplicacion en dry-run

Script ejecutado:

```text
database/imports/h02_h03_may_2026_official/05_apply_official_may_2026.sql
```

Resultado:

```text
official_may_2026_data_applied
```

Resumen de escritura en dry-run:

| Accion | Resultado |
|---|---:|
| Backup interno teachers | 213 |
| Backup interno schedules | 595 |
| Backup interno schedule_incidences | 0 |
| Backup interno extra_hours | 0 |
| Backup interno user_coordinations | 0 |
| Horarios reemplazados | 595 eliminados, 589 insertados |
| Incidencias insertadas | 18 |
| Extras insertados | 65 |
| `user_coordinations` insertadas | 15 |

## 7. Validacion post-migracion

Resultado de `06_post_migration_validation.sql`:

| Validacion | Resultado |
|---|---|
| `teachers total` | 216 |
| `schedules migrated cycles` | 589, OK |
| `incidences migrated configs` | 18, OK |
| `extras migrated cycles` | 65, OK |
| `user_coordinations total` | 15, OK |
| Duplicados `normalized_name` | 0, OK |
| Horarios sin docente | 0, OK |
| Horarios sin `created_by` | 0, OK |
| Extras sin `captured_by` | 0, OK |
| Faltas totales | 30.0, OK |
| Retardos totales | 0, OK |
| Horas extra | 1025.0, OK |
| Importe extras | 128310.000, OK |

Conteos finales en dry-run:

| Tabla | Filas |
|---|---:|
| `teachers` | 216 |
| `schedules` | 589 |
| `schedule_incidences` | 18 |
| `extra_hours` | 65 |
| `user_coordinations` | 15 |
| `payroll_runs` | 2 |
| `payroll_lines` | 401 |

Historial productivo preservado:

- `payroll_runs`: 2
- `payroll_lines`: 401

## 8. Resultado esperado de nomina

La validacion de datos deja preparado el calculo esperado:

| Concepto | Esperado |
|---|---:|
| Horas base | 3021.0 |
| Importe bruto horarios | `$393,235.00` |
| Faltas | 30 |
| Descuento incidencias | `-$4,035.00` |
| Horas extra | 1025.0 |
| Importe extras | `$128,310.00` |
| Total esperado | `$517,510.00` |

La confirmacion final del total debe hacerse en UI/API despues de aplicar en produccion o apuntando una API temporal a la base dry-run.

## 9. Riesgos y observaciones

- La base Cloud de preview ya no sirve como fuente de datos vivos para Incidencias/Extras porque el flujo de nomina las limpio.
- Los datos vivos oficiales estan en la base local validada.
- Los CSV temporales contienen datos operativos reales y no deben versionarse.
- Antes de produccion se debe volver a exportar la fuente viva o conservar un paquete controlado de CSV aprobado.
- La limpieza de preview/dry-run debe hacerse solo despues de migracion productiva y smoke tests finales.

## 10. Veredicto

Dry-run aprobado.

Estado:

```text
Sin bloqueantes para ejecutar la migracion productiva de datos oficiales, previo backup y confirmacion Admin.
```

Siguiente paso recomendado:

1. Ejecutar backup nuevo de `nomina_docente`.
2. Reexportar datos oficiales desde `nomina_docente_deploy_snapshot_20260526_111616_h02h03`.
3. Ejecutar staging y validacion contra `nomina_docente`.
4. Aplicar migracion productiva.
5. Validar conteos y nomina `$517,510.00`.
6. Ejecutar smoke tests por rol.
7. Eliminar `nomina_docente_h02h03_review` y `nomina_docente_h02h03_data_dryrun` cuando Admin confirme cierre.
