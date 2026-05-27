# H02/H03 Mayo 2026 - Scripts de migracion de datos oficiales

## Objetivo

Migrar de forma controlada los datos oficiales validados en revision hacia produccion:

- Directorio.
- Horarios.
- Incidencias.
- Extras.
- `user_coordinations` tecnicas.

Fuente recomendada si conserva datos vivos:

```text
nomina_docente_h02h03_review
```

Fuente local validada cuando preview ya limpio Incidencias/Extras por guardado de nomina:

```text
nomina_docente_deploy_snapshot_20260526_111616_h02h03
```

Destino:

```text
nomina_docente
```

Este flujo no importa `payroll_runs`, `payroll_lines`, `audit_log` ni documentos fiscales.

## Orden de ejecucion

### 1. Exportar datos desde la fuente validada

Ejecutar contra la base que conserve Directorio, Horarios, Incidencias y Extras vivos.

```powershell
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$env:PGPASSWORD = '<password>'
& $psql -h localhost -p 55432 -U app_nomina -d nomina_docente_deploy_snapshot_20260526_111616_h02h03 `
  -v ON_ERROR_STOP=1 `
  -f database/imports/h02_h03_may_2026_official/01_export_review_to_csv.sql
```

Esto genera CSV locales en:

```text
database/imports/h02_h03_may_2026_official/data/
```

### 2. Preparar staging en destino

Ejecutar contra una copia dry-run primero. Despues, si todo pasa, contra produccion.

```powershell
& $psql -h 127.0.0.1 -p 55433 -U app_nomina -d nomina_docente `
  -v ON_ERROR_STOP=1 `
  -f database/imports/h02_h03_may_2026_official/02_prepare_staging.sql
```

### 3. Importar CSV a staging

```powershell
& $psql -h 127.0.0.1 -p 55433 -U app_nomina -d nomina_docente `
  -v ON_ERROR_STOP=1 `
  -f database/imports/h02_h03_may_2026_official/03_import_csv_to_staging.sql
```

### 4. Validar staging

```powershell
& $psql -h 127.0.0.1 -p 55433 -U app_nomina -d nomina_docente `
  -v ON_ERROR_STOP=1 `
  -f database/imports/h02_h03_may_2026_official/04_validate_staging.sql
```

No continuar si aparece algun `BLOCKER`.

### 5. Aplicar datos oficiales

Solo despues de backup, dry-run y aprobacion:

```powershell
& $psql -h 127.0.0.1 -p 55433 -U app_nomina -d nomina_docente `
  -v ON_ERROR_STOP=1 `
  -f database/imports/h02_h03_may_2026_official/05_apply_official_may_2026.sql
```

### 6. Validar post-migracion

```powershell
& $psql -h 127.0.0.1 -p 55433 -U app_nomina -d nomina_docente `
  -v ON_ERROR_STOP=1 `
  -f database/imports/h02_h03_may_2026_official/06_post_migration_validation.sql
```

## Resultado esperado

| Concepto | Esperado |
|---|---:|
| Horarios oficiales | 589 |
| Incidencias oficiales | 18 |
| Extras oficiales | 65 |
| Faltas | 30 |
| Extras horas | 1025.0 |
| Extras importe | `$128,310.00` |
| Total nomina esperado | `$517,510.00` |

## Limpieza de bases de revision

No limpiar hasta que produccion quede validada con usuarios reales.

Despues de aprobacion final se podra eliminar:

- Base `nomina_docente_h02h03_review`.
- Servicio `nomina-api-h02h03-review`.
- Firebase Hosting channel `h02-h03-review`.

La limpieza debe ejecutarse como fase separada y documentada. Ver:

```text
99_cleanup_after_validation.md
```
