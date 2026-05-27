# H02/H03 - Migracion Productiva Datos Oficiales Mayo 2026

## 1. Resumen

Se ejecuto la migracion productiva de datos oficiales de mayo 2026 sobre:

```text
nomina_docente
```

Alcance:

- Directorio oficial.
- Horarios oficiales.
- Incidencias oficiales de la segunda quincena de mayo 2026.
- Extras oficiales de la segunda quincena de mayo 2026.
- `user_coordinations` tecnicas.

No se migraron:

- `payroll_runs`.
- `payroll_lines`.
- `audit_log`.
- documentos fiscales.
- Storage de constancias.

## 2. Fecha y entorno

Proyecto:

```text
nomina-docente-prod
```

Cloud SQL:

```text
instancia: nomina-docente-web
base destino: nomina_docente
```

Rama:

```text
feature/h02-h03-user-coordinations-permissions
```

Commit base de scripts:

```text
3c6cc04 test(h02-h03): record official May data migration dry run
```

## 3. Backup previo

Backup productivo creado antes de staging/migracion:

```text
gs://nomina-docente-prod-sql-imports/backups/pre-h02h03-official-data-migration-20260527-125812.sql.gz
```

## 4. Fuente de datos

Fuente viva validada:

```text
nomina_docente_deploy_snapshot_20260526_111616_h02h03
```

Motivo:

- La base Cloud de preview `nomina_docente_h02h03_review` conserva la corrida correcta en historial.
- Pero el flujo de nomina limpio `schedule_incidences` y `extra_hours` al guardar/pagar.
- La base local validada conservaba los datos vivos oficiales.

Export realizado:

| Tabla | Filas exportadas |
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

Los CSV temporales locales fueron eliminados despues de la migracion.

## 5. Validacion de staging productivo

Script:

```text
database/imports/h02_h03_may_2026_official/04_validate_staging.sql
```

Resultado:

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

Observacion `REVIEW`:

Se aplicaron 3 cambios oficiales de nombre:

| Antes | Despues |
|---|---|
| `ARANDA HANSMANN BLANCA MARIA TERESA` | `BLANCA MARIA TERESA ARANDA HANSMANN` |
| `ROXANA DEL CARMEN LANDERO RAMIREZ` | `LANDERO RAMIREZ ROXANA DEL CARMEN` |
| `SHIELDS MUÑOZ LUIS RODOLFO` | `LUIS RODOLFO SHIELDS MUÑOZ` |

No hubo conflicto con otro `normalized_name`.

## 6. Aplicacion productiva

Script:

```text
database/imports/h02_h03_may_2026_official/05_apply_official_may_2026.sql
```

Resultado:

```text
official_may_2026_data_applied
```

Resumen de aplicacion:

| Accion | Resultado |
|---|---:|
| Backup interno `teachers` | 213 |
| Backup interno `schedules` | 595 |
| Backup interno `schedule_incidences` | 0 |
| Backup interno `extra_hours` | 0 |
| Backup interno `user_coordinations` | 0 |
| Horarios previos del ciclo | 595 eliminados |
| Horarios oficiales insertados | 589 |
| Incidencias oficiales insertadas | 18 |
| Extras oficiales insertados | 65 |
| `user_coordinations` insertadas | 15 |

La transaccion finalizo con `COMMIT`.

## 7. Validacion post-migracion

Script:

```text
database/imports/h02_h03_may_2026_official/06_post_migration_validation.sql
```

Resultado:

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

Conteos finales:

| Tabla | Filas |
|---|---:|
| `teachers` | 216 |
| `schedules` | 589 |
| `schedule_incidences` | 18 |
| `extra_hours` | 65 |
| `user_coordinations` | 15 |
| `payroll_runs` | 2 |
| `payroll_lines` | 401 |

Historial preservado:

- `payroll_runs` permanece con 2 registros.
- `payroll_lines` permanece con 401 registros.

## 8. Smoke tecnico

API productiva:

```text
GET https://nomina-docente-prod.web.app/api/health
Resultado: 200 OK
```

Respuesta:

```json
{"ok":true,"service":"nomina-docente-api","tables":31}
```

Auth sin token:

```text
GET /api/auth/session
Resultado: 401 Unauthorized esperado
```

Logs Cloud Run recientes:

```text
Sin errores severity>=ERROR en los ultimos 20 minutos.
```

## 9. Resultado esperado de nomina

Con los datos migrados, el calculo esperado de la quincena es:

```text
2026-05-15 a 2026-05-28
```

| Concepto | Esperado |
|---|---:|
| Horas base | 3021.0 |
| Importe bruto horarios | `$393,235.00` |
| Faltas | 30 |
| Descuento incidencias | `-$4,035.00` |
| Horas extra | 1025.0 |
| Importe extras | `$128,310.00` |
| Total esperado | `$517,510.00` |

La validacion final del total debe realizarse en la UI productiva con sesion Admin/Finanzas.

## 10. Rollback

Backup Cloud SQL:

```text
gs://nomina-docente-prod-sql-imports/backups/pre-h02h03-official-data-migration-20260527-125812.sql.gz
```

Backups internos creados por el script:

```text
h02h03_may2026_backup.teachers_pre_migration
h02h03_may2026_backup.schedules_pre_migration
h02h03_may2026_backup.schedule_incidences_pre_migration
h02h03_may2026_backup.extra_hours_pre_migration
h02h03_may2026_backup.user_coordinations_pre_migration
h02h03_may2026_backup.academic_cycles_pre_migration
h02h03_may2026_backup.payroll_calendar_config_pre_migration
```

Recomendacion:

- Usar backup interno si el problema es acotado a tablas operativas.
- Usar backup Cloud SQL completo solo si el problema es amplio.

## 11. Pendientes

1. Confirmar en UI productiva que la nomina `2026-05-15 a 2026-05-28` calcula `$517,510.00`.
2. Ejecutar smoke autenticado por rol:
   - Admin.
   - Coordinador.
   - Direccion/Subdireccion.
   - RH.
   - Finanzas.
3. Cuando Admin confirme cierre, limpiar recursos temporales:
   - `nomina_docente_h02h03_review`.
   - `nomina_docente_h02h03_data_dryrun`.
   - `nomina-api-h02h03-review`.
   - Hosting channel `h02-h03-review`.

## 12. Veredicto

Migracion productiva de datos oficiales mayo 2026 ejecutada correctamente.

Estado:

```text
Produccion contiene datos oficiales migrados y validaciones tecnicas aprobadas.
```
