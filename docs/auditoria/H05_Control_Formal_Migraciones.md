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
