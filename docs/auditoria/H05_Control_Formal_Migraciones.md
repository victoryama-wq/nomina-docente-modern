# H05 - Control Formal de Migraciones SQL

Fecha: 2026-05-28

## 1. Resumen

H05 agrega infraestructura para registrar migraciones SQL aplicadas con orden, checksum, ambiente, fecha, actor, commit, duracion y resultado.

Esta entrega implementa solo H05-F1, H05-F2 y H05-F3 en local/test:

- H05-F1: tablas administrativas de control.
- H05-F2: script TypeScript de migraciones.
- H05-F3: baseline local/test en `nomina_docente_test`.

No se ejecuto nada contra produccion.

## 2. Estado anterior

El proyecto tenia migraciones SQL planas en `database/*.sql` y pruebas H04 que aplicaban esos archivos en orden lexicografico sobre `nomina_docente_test`.

No existia tabla formal de control para:

- migraciones aplicadas;
- checksum;
- ambiente;
- fecha;
- actor;
- resultado;
- duracion;
- errores;
- baseline.

## 3. Riesgos detectados

Riesgos mitigados parcialmente por H05:

- No habia registro formal de migraciones aplicadas.
- No habia checksum para detectar ediciones historicas.
- No habia historial de ejecuciones o errores.
- No habia bloqueo formal ante doble aplicacion.
- No habia dry-run formal.
- La numeracion historica tiene prefijos duplicados:
  - `007`
  - `008`
  - `009`

H05 conserva compatibilidad con esos duplicados usando como `version` el nombre completo del archivo sin extension.

## 4. Migracion administrativa creada

Archivo:

```text
database/012_h05_schema_migrations.sql
```

Tablas administrativas:

- `schema_migrations`
- `schema_migration_runs`

Indices agregados:

- `schema_migration_runs(version)`
- `schema_migration_runs(status)`
- `schema_migration_runs(started_at)`

La migracion es idempotente y no modifica tablas funcionales.

## 5. Script creado

Archivo:

```text
tools/migrate-db.ts
```

Comandos soportados:

```bash
npm run db:migrate:inspect
npm run db:migrate:status
npm run db:migrate:dry-run
npm run db:migrate:baseline
npm run db:migrate
npm run db:migrate:apply
```

Capacidades:

- Lee `database/*.sql`.
- Ordena por nombre completo de archivo.
- Calcula checksum `SHA-256` sobre el contenido real.
- Extrae version desde el nombre del archivo sin `.sql`.
- Advierte prefijos duplicados.
- Advierte archivos fuera del patron `NNN_nombre.sql`.
- Detecta checksum mismatch.
- Detecta pendientes.
- Evita doble aplicacion.
- Usa advisory lock:

```sql
pg_advisory_lock(hashtext('nomina_docente_schema_migrations'))
```

- Registra intentos en `schema_migration_runs`.
- Registra baseline/aplicacion en `schema_migrations`.
- No implementa rollback automatico.

### 5.1 Comando `inspect`

H05-F3.5 agrega:

```bash
npm run db:migrate:inspect
```

`inspect` es el comando de revision 100% read-only antes de cualquier dry-run o baseline productivo.

`inspect`:

- lee archivos `database/*.sql`;
- calcula checksum `SHA-256`;
- detecta prefijos duplicados;
- detecta archivos fuera del patron `NNN_nombre.sql`;
- conecta a la base destino;
- lee `current_database()`;
- lee `current_user`;
- lee host/puerto configurados y, si PostgreSQL lo permite, host/puerto del servidor;
- consulta `information_schema.tables`;
- detecta si existen `schema_migrations` y `schema_migration_runs`;
- si existen tablas de control, lee `schema_migrations` y compara checksums;
- si no existen tablas de control, reporta que baseline no esta inicializado;
- no toma advisory lock;
- no hace `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE` ni `DELETE`;
- no ejecuta SQL de migraciones;
- no requiere que `012_h05_schema_migrations.sql` este aplicada.

`inspect` contra un destino productivo sigue bloqueado por defecto y requiere:

```text
ALLOW_PRODUCTION_MIGRATIONS=true
```

No requiere:

```text
CONFIRM_PRODUCTION_BASELINE
CONFIRM_PRODUCTION_APPLY
```

### 5.2 Diferencia entre comandos

| Comando | Crea tablas | Inserta auditoria | Toma advisory lock | Requiere tablas de control | Ejecuta SQL funcional |
|---|---:|---:|---:|---:|---:|
| `inspect` | No | No | No | No | No |
| `status` | No | No | Si | No | No |
| `dry-run` | No | Si, en `schema_migration_runs` | Si | Si | No |
| `baseline` | No | Si | Si | Si | No |
| `apply` | No | Si | Si | Si | Si, solo pendientes |

## 6. Variables

Variables usadas:

```text
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
MIGRATION_ENV
MIGRATION_ACTOR
GIT_COMMIT
```

Guardas productivas:

```text
ALLOW_PRODUCTION_MIGRATIONS=true
CONFIRM_PRODUCTION_BASELINE=true
CONFIRM_PRODUCTION_APPLY=true
```

Sin esas variables, cualquier destino productivo queda bloqueado si:

- `DB_NAME=nomina_docente`, o
- `MIGRATION_ENV=production`.

## 7. Como ejecutar en local/test

Variables usadas para la validacion local:

```powershell
$env:DB_HOST='localhost'
$env:DB_PORT='55432'
$env:DB_NAME='nomina_docente_test'
$env:DB_USER='app_nomina'
$env:DB_PASSWORD='local_nomina_dev'
$env:MIGRATION_ENV='test'
$env:MIGRATION_ACTOR='local-dev'
$env:GIT_COMMIT=(git rev-parse --short HEAD)
```

Se aplico solo la migracion administrativa 012 en `nomina_docente_test`:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' `
  -h localhost -p 55432 -U app_nomina -d nomina_docente_test `
  -v ON_ERROR_STOP=1 `
  -f database/012_h05_schema_migrations.sql
```

Luego:

```bash
npm run db:migrate:status
npm run db:migrate:dry-run
npm run db:migrate:baseline
npm run db:migrate:status
npm run db:migrate:dry-run
```

Resultado final en `nomina_docente_test`:

- Migraciones detectadas: 15.
- Registradas en DB: 15.
- Baseline: 15.
- Pendientes: 0.
- Checksum mismatch: 0.

## 8. Baseline

Baseline significa registrar que una migracion ya existe en una base, sin volver a ejecutar su SQL funcional.

Esto es clave para produccion porque las migraciones `001` a `011` ya fueron aplicadas historicamente.

En produccion no deben reaplicarse `001` a `011`.

El futuro baseline productivo debe:

1. Crear tablas administrativas con `012_h05_schema_migrations.sql`.
2. Registrar `001` a `012` como baseline.
3. No ejecutar SQL funcional de `001` a `011`.
4. Validar checksum y estado.

## Advertencias historicas aceptadas

H05-F4.1 `inspect` read-only contra produccion detecto prefijos duplicados historicos:

- `007`
- `008`
- `009`

Estas advertencias no se consideran bloqueantes para H05 porque el script usa como `version` el nombre completo del archivo sin extension, no solo el prefijo numerico.

Reglas aprobadas:

- No se deben renombrar archivos historicos.
- No se deben modificar migraciones ya aplicadas.
- Renombrar archivos historicos afectaria trazabilidad, checksums y baseline.
- Los prefijos duplicados `007`, `008` y `009` quedan aceptados solo como deuda historica documentada.
- Desde `013` en adelante queda prohibido repetir prefijos numericos.
- Si aparece un nuevo duplicado en futuras migraciones, debe bloquearse antes de merge.

## 9. Procedimiento futuro H05-F4: dry-run produccion

No ejecutado en esta fase.

Cuando se apruebe:

1. Confirmar ventana de revision.
2. Confirmar que no se hara `baseline` ni `apply`.
3. Ejecutar primero `inspect`, porque no crea tablas ni inserta registros.
4. Definir:

```powershell
$env:MIGRATION_ENV='production'
$env:ALLOW_PRODUCTION_MIGRATIONS='true'
```

5. Ejecutar:

```bash
npm run db:migrate:inspect
```

6. Revisar:

   - base conectada;
   - usuario DB;
   - migraciones en filesystem;
   - prefijos duplicados;
   - existencia de `schema_migrations`;
   - existencia de `schema_migration_runs`;
   - si hay baseline inicializado;
   - pendientes;
   - checksum mismatch.

7. Si `inspect` no tiene bloqueantes, crear tablas administrativas 012 solo con backup y aprobacion:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' `
  -h <host> -p <port> -U <user> -d nomina_docente `
  -v ON_ERROR_STOP=1 `
  -f database/012_h05_schema_migrations.sql
```

8. Despues de aplicar solo 012, ejecutar:

```bash
npm run db:migrate:status
npm run db:migrate:dry-run
```

9. Revisar:
   - pendientes;
   - checksum mismatch;
   - duplicados historicos;
   - si existen tablas administrativas;
   - si la estructura real corresponde al baseline esperado.

## Procedimiento H05-F4.2 - Crear tablas administrativas en produccion

Objetivo:

Crear unicamente las tablas administrativas de control:

- `schema_migrations`
- `schema_migration_runs`

Archivo permitido:

```text
database/012_h05_schema_migrations.sql
```

Condiciones obligatorias:

1. Backup Cloud SQL previo.
2. Confirmacion manual Admin/DevOps.
3. Confirmar que se ejecuto H05-F4.1 `inspect`.
4. Confirmar que `inspect` no tuvo checksum mismatch.
5. Confirmar que no se ejecutara `baseline`.
6. Confirmar que no se ejecutara `apply`.
7. Confirmar que no se modificaran tablas funcionales.

Comando permitido:

Ejecutar solo `database/012_h05_schema_migrations.sql` contra produccion.

Ejemplo operativo:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' `
  -h <host> -p <port> -U <user> -d nomina_docente `
  -v ON_ERROR_STOP=1 `
  -f database/012_h05_schema_migrations.sql
```

No ejecutar en H05-F4.2:

- `npm run db:migrate:baseline`
- `npm run db:migrate`
- `npm run db:migrate:apply`

Validacion posterior:

1. Confirmar que existe `schema_migrations`.
2. Confirmar que existe `schema_migration_runs`.
3. Confirmar que no hay filas todavia, o que solo existen las esperadas si el script administrativo registra algo.
4. Ejecutar `npm run db:migrate:status`.
5. Ejecutar `npm run db:migrate:dry-run`.
6. Confirmar que no hay checksum mismatch.
7. Confirmar que siguen apareciendo migraciones pendientes hasta ejecutar baseline.
8. No ejecutar baseline todavia.

Rollback:

- Si falla antes de crear tablas, no hacer nada.
- Si se crean tablas y se decide revertir, eliminar unicamente:
  - `schema_migration_runs`
  - `schema_migrations`
- El rollback solo aplica si no tienen registros criticos y con aprobacion Admin/DBA.
- No tocar tablas funcionales.

## Checklist H05-F4.2

- [ ] Backup Cloud SQL creado.
- [ ] Nombre backup registrado.
- [ ] Hora backup registrada.
- [ ] Inspect H05-F4.1 revisado.
- [ ] Admin aprueba crear tablas administrativas.
- [ ] Se confirma que solo se ejecutara 012.
- [ ] Se confirma que no se hara baseline.
- [ ] Se confirma que no se hara apply.
- [ ] Se confirma rollback.
- [ ] Se ejecuta 012.
- [ ] Se valida existencia de tablas.
- [ ] Se ejecuta status.
- [ ] Se ejecuta dry-run.
- [ ] Se documenta resultado.

## Resultado H05-F4.2 - Produccion

Fecha/hora de ejecucion:

- 2026-05-28 14:02:18 -05:00.

Backup creado:

- Proyecto: `nomina-docente-prod`.
- Instancia: `nomina-docente-web`.
- Base protegida: `nomina_docente`.
- Metodo: backup Cloud SQL `ON_DEMAND`.
- ID backup: `1779994726761`.
- Estado: `SUCCESSFUL`.
- Inicio: `2026-05-28T18:58:46.773Z`.
- Fin: `2026-05-28T19:00:18.025Z`.
- Descripcion: `H05-F4.2 before schema_migrations setup 2026-05-28`.

Conexion usada:

- Metodo: Cloud SQL Auth Proxy local.
- Endpoint local: `127.0.0.1:15432`.
- Instancia Cloud SQL: `nomina-docente-prod:us-central1:nomina-docente-web`.
- Usuario DB: `app_nomina`.
- Base destino: `nomina_docente`.
- El proxy fue cerrado al finalizar.

Comando ejecutado:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' `
  -h 127.0.0.1 `
  -p 15432 `
  -U app_nomina `
  -d nomina_docente `
  -v ON_ERROR_STOP=1 `
  -f database/012_h05_schema_migrations.sql
```

Resultado del comando:

```text
BEGIN
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
COMMIT
```

Tablas creadas:

- `schema_migrations`.
- `schema_migration_runs`.

Validacion SQL posterior inmediata:

```text
schema_migrations: schema_migrations
schema_migration_runs: schema_migration_runs
schema_migrations_rows: 0
schema_migration_runs_rows: 0
```

Resultado `npm run db:migrate:status`:

```text
Migraciones detectadas: 15
Registradas en DB: 0
Aplicadas: 0
Baseline: 0
Pendientes: 15
Checksum mismatch: 0
```

Advertencias reportadas:

- Prefijo duplicado `007`: `007_direction_hr_roles.sql`, `007_incidence_period_locking.sql`.
- Prefijo duplicado `008`: `008_direction_live_payroll.sql`, `008_payroll_status_workflow.sql`.
- Prefijo duplicado `009`: `009_access_windows.sql`, `009_payroll_correction_flow.sql`.

Estas advertencias son historicas aceptadas y no bloquean H05 porque la version formal usa el nombre completo del archivo sin extension.

Resultado `npm run db:migrate:dry-run`:

```text
Migraciones detectadas: 15
Registradas en DB: 0
Aplicadas: 0
Baseline: 0
Pendientes: 15
Checksum mismatch: 0
```

Validacion posterior al `dry-run`:

```text
schema_migrations_rows: 0
schema_migration_runs:
  dry_run: 15
```

Confirmaciones:

- No se ejecuto baseline.
- No se ejecuto apply.
- No se ejecuto `npm run db:migrate`.
- No se ejecutaron migraciones historicas `001` a `011`.
- No se modificaron tablas funcionales.
- No se modificaron datos reales de nomina.
- No se cambiaron H01/H02/H03.
- No se hizo deploy.

Riesgos restantes:

- Produccion aun no tiene baseline formal; `schema_migrations` permanece en `0` filas.
- Hasta H05-F5, `status` seguira mostrando `15` pendientes.
- Los prefijos duplicados `007`, `008` y `009` seguiran apareciendo como advertencia historica aceptada.

Siguiente paso:

- H05-F5: baseline produccion con backup vigente o nuevo, confirmacion manual, `CONFIRM_PRODUCTION_BASELINE=true`, sin ejecutar SQL funcional historico.

## 10. Procedimiento futuro H05-F5: baseline produccion

No ejecutado en esta fase.

Requisitos:

1. Backup Cloud SQL previo.
2. Confirmacion manual Admin/DevOps.
3. Dry-run sin bloqueantes.
4. Variables:

```powershell
$env:MIGRATION_ENV='production'
$env:ALLOW_PRODUCTION_MIGRATIONS='true'
$env:CONFIRM_PRODUCTION_BASELINE='true'
```

5. Ejecutar:

```bash
npm run db:migrate:baseline
```

6. Ejecutar despues:

```bash
npm run db:migrate:status
npm run db:migrate:dry-run
```

7. Confirmar:
   - `001` a `012` registrados;
   - pendientes `0`;
   - checksum mismatch `0`;
   - no se ejecutaron migraciones funcionales historicas.

## Resultado H05-F5 - Baseline produccion

Fecha/hora de ejecucion:

- 2026-05-28 14:08:35 -05:00.

Backup usado:

- Proyecto: `nomina-docente-prod`.
- Instancia: `nomina-docente-web`.
- Base protegida: `nomina_docente`.
- Metodo: backup Cloud SQL `ON_DEMAND`.
- ID backup: `1779994726761`.
- Estado: `SUCCESSFUL`.
- Inicio: `2026-05-28T18:58:46.773Z`.
- Fin: `2026-05-28T19:00:18.025Z`.
- Descripcion: `H05-F4.2 before schema_migrations setup 2026-05-28`.

Conexion usada:

- Metodo: Cloud SQL Auth Proxy local.
- Endpoint local: `127.0.0.1:15432`.
- Instancia Cloud SQL: `nomina-docente-prod:us-central1:nomina-docente-web`.
- Usuario DB: `app_nomina`.
- Base destino: `nomina_docente`.
- El proxy fue cerrado al finalizar.

Comando ejecutado:

```bash
npm run db:migrate:baseline
```

Variables de seguridad usadas:

```text
MIGRATION_ENV=production
ALLOW_PRODUCTION_MIGRATIONS=true
CONFIRM_PRODUCTION_BASELINE=true
```

No se definio:

```text
CONFIRM_PRODUCTION_APPLY
```

Resultado baseline:

```text
Baseline registrado: 001_initial_schema.sql
Baseline registrado: 002_directory_access_module.sql
Baseline registrado: 003_seed_tabulators.sql
Baseline registrado: 004_calendar_payroll_history.sql
Baseline registrado: 005_calendar_permission_seed.sql
Baseline registrado: 006_payroll_finalize_permission.sql
Baseline registrado: 007_direction_hr_roles.sql
Baseline registrado: 007_incidence_period_locking.sql
Baseline registrado: 008_direction_live_payroll.sql
Baseline registrado: 008_payroll_status_workflow.sql
Baseline registrado: 009_access_windows.sql
Baseline registrado: 009_payroll_correction_flow.sql
Baseline registrado: 010_payroll_no_rounding_precision.sql
Baseline registrado: 011_h02_h03_user_coordinations_permissions.sql
Baseline registrado: 012_h05_schema_migrations.sql
```

Resultado `npm run db:migrate:status`:

```text
Migraciones detectadas: 15
Registradas en DB: 15
Aplicadas: 0
Baseline: 15
Pendientes: 0
Checksum mismatch: 0
```

Resultado `npm run db:migrate:dry-run` posterior:

```text
Migraciones detectadas: 15
Registradas en DB: 15
Aplicadas: 0
Baseline: 15
Pendientes: 0
Checksum mismatch: 0
```

Consultas SQL de validacion:

```sql
SELECT status, count(*) FROM schema_migrations GROUP BY status ORDER BY status;
SELECT count(*) AS total_migrations FROM schema_migrations;
SELECT status, count(*) FROM schema_migration_runs GROUP BY status ORDER BY status;
```

Resultado SQL:

```text
schema_migrations:
  baseline: 15

total_migrations: 15

schema_migration_runs:
  baseline: 15
  dry_run: 30
```

Versiones registradas como baseline:

```text
001_initial_schema
002_directory_access_module
003_seed_tabulators
004_calendar_payroll_history
005_calendar_permission_seed
006_payroll_finalize_permission
007_direction_hr_roles
007_incidence_period_locking
008_direction_live_payroll
008_payroll_status_workflow
009_access_windows
009_payroll_correction_flow
010_payroll_no_rounding_precision
011_h02_h03_user_coordinations_permissions
012_h05_schema_migrations
```

Confirmaciones:

- No se ejecuto `apply`.
- No se ejecuto `npm run db:migrate`.
- No se ejecutaron migraciones historicas `001` a `011`.
- No se ejecuto SQL funcional historico.
- No se modificaron tablas funcionales.
- No se modificaron datos reales de nomina.
- No se cambiaron H01/H02/H03.
- No se hizo deploy.
- Las advertencias `007`, `008` y `009` permanecen como historicas aceptadas.

Estado final H05:

- Produccion ya cuenta con tablas administrativas H05.
- Produccion ya tiene baseline formal para `001` a `012`.
- `pending = 0`.
- `checksum mismatch = 0`.

Riesgos residuales:

- Las migraciones historicas no deben editarse; cualquier cambio posterior generara checksum mismatch.
- Los prefijos duplicados `007`, `008` y `009` se mantienen como deuda historica documentada.
- Futuras migraciones deben iniciar desde `013` y no repetir prefijo.

Regla para futuras migraciones:

- Toda nueva migracion desde `013` debe pasar primero por `inspect/status/dry-run`.
- Solo despues de backup, revision y aprobacion se podra ejecutar `apply`.
- `apply` debe ejecutar exclusivamente migraciones pendientes nuevas, nunca historicas ya registradas.

## 11. Apply futuro

`apply` queda disponible para migraciones futuras posteriores al baseline.

Reglas:

- Salta migraciones ya registradas con mismo checksum.
- Bloquea si el checksum difiere.
- Ejecuta solo pendientes.
- Registra `success` o `error`.
- Se detiene ante primer error.

Produccion requiere:

```powershell
$env:ALLOW_PRODUCTION_MIGRATIONS='true'
$env:CONFIRM_PRODUCTION_APPLY='true'
```

No debe usarse sin backup y ventana aprobada.

## 12. Por que no hay rollback automatico

No se implementa rollback automatico porque las migraciones historicas:

- alteran estructura;
- modifican permisos;
- agregan enums;
- crean datos semilla;
- afectan tablas usadas por produccion.

Rollback debe ser manual, documentado y precedido por backup.

La tabla `schema_migrations` permite marcar:

```text
rolled_back_manual
```

solo si un DBA/Admin confirma una reversa controlada.

## 13. Validaciones ejecutadas

H05 local/test:

- `database/012_h05_schema_migrations.sql` aplicado en `nomina_docente_test`.
- `npm run db:migrate:inspect`.
- `npm run db:migrate:status`.
- `npm run db:migrate:dry-run`.
- `npm run db:migrate:baseline`.
- `npm run db:migrate:status`.
- `npm run db:migrate:dry-run`.

Suite general:

- `npm run test`.
- `npm run test:api`.
- `npm run test:api:integration`.
- `npm run test:web`.
- `npm --workspace apps/api run typecheck`.
- `npm --workspace apps/web run typecheck`.
- `npm run typecheck`.
- `npm run build`.

Resultado: todas pasaron.

## 14. Riesgos residuales

- Produccion aun no tiene baseline formal; queda para H05-F5.
- Los prefijos duplicados historicos permanecen como advertencia.
- `apply` para produccion debe quedar sujeto a backup, ventana y confirmacion manual.
- Las migraciones antiguas no deben editarse; cualquier cambio historico generara checksum mismatch.
- Futuras migraciones deben usar prefijo unico desde `013`.

## 15. Confirmaciones

- No se conecto a produccion.
- No se ejecuto H05-F4.
- No se ejecuto H05-F5.
- `inspect` no crea tablas, no inserta datos, no toma advisory lock y no ejecuta migraciones.
- No se aplico baseline en produccion.
- No se aplicaron migraciones en produccion.
- No se tocaron datos reales.
- No se modificaron tablas funcionales.
- No se cambiaron H01/H02/H03.
- No se hizo deploy.

## 16. Siguiente fase recomendada

H05-F4:

- Dry-run controlado contra produccion, solo despues de aprobacion explicita.
- Sin baseline productivo todavia.
- Sin apply productivo.

H05-F5:

- Backup Cloud SQL.
- Confirmacion manual.
- Baseline produccion.
- Validacion post-baseline.
