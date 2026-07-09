# H18 - Hotfix Reportes Snapshot LineKey

Fecha: 2026-07-09

## 1. Resumen

Se corrigio un bug productivo en el modulo `Reportes`, pestana `Horas base y extras`, al consultar una quincena guardada/snapshot.

Error reportado:

```text
column ped.line_key does not exist
```

El error ocurria cuando H18 resolvia `source=snapshot`, ya sea por seleccion explicita de snapshot o por `source=auto` con `calendarConfigId` asociado a una corrida de nomina guardada no cancelada.

## 2. Causa raiz

La consulta snapshot de `apps/api/src/routes/operational-reports.ts` usaba columnas que no existen en el esquema real:

- `ped.line_key`
- `ped.run_id`
- `pl.line_key`
- `pl.run_id`
- `pl.cycle_id`

La tabla `payroll_extra_details` definida en `database/004_calendar_payroll_history.sql` no tiene `line_key`; su llave de corrida es `payroll_run_id`.

La tabla `payroll_lines` definida en `database/001_initial_schema.sql` tampoco tiene `line_key`, `run_id` ni `cycle_id`; su llave de corrida es `payroll_run_id`. El `cycle_id` se obtiene desde `payroll_runs`.

## 3. Consulta afectada

Funcion:

```text
listBaseExtraSnapshotRows()
```

Archivo:

```text
apps/api/src/routes/operational-reports.ts
```

Flujos afectados:

```text
GET /reports/operational/base-extra?calendarConfigId=...
GET /reports/operational/base-extra/export?format=csv&calendarConfigId=...
GET /reports/operational/base-extra/export?format=xlsx&calendarConfigId=...
```

## 4. Correccion aplicada

Se reemplazo la relacion inexistente por `line_key` con la relacion real disponible en snapshots:

```text
payroll_lines.payroll_run_id = payroll_extra_details.payroll_run_id
teacher_id IS NOT DISTINCT FROM teacher_id
coordination_id IS NOT DISTINCT FROM coordination_id
```

Tambien se corrigieron referencias a columnas reales:

- `ped.run_id` -> `ped.payroll_run_id`
- `pl.run_id` -> `pl.payroll_run_id`
- `pl.cycle_id` -> `pr.cycle_id` mediante `JOIN payroll_runs pr ON pr.id = pl.payroll_run_id`

No se agrego columna `line_key`.

## 5. Pruebas agregadas

Se agregaron pruebas de integracion H18 para el flujo snapshot:

- JSON de `base-extra` con `calendarConfigId` y `source=auto`.
- Export CSV de `base-extra` con snapshot.
- Export XLSX de `base-extra` con snapshot.
- Validacion de ausencia de campos fiscales.
- Validacion de que el snapshot no depende de columnas `line_key`.

Archivo:

```text
apps/api/src/test/api-h18-operational-reports.integration.test.ts
```

Nota: la suite de integracion H18 quedo agregada/preparada. En este equipo, `nomina_docente_test` no estaba disponible en `localhost:55432`, por lo que el intento de ejecucion granular quedo `skipped` por configuracion de integracion y no pudo ejecutarse contra PostgreSQL local.

## 6. Validaciones ejecutadas

```text
npm run test:api
npm run typecheck
npm run build
git diff --check
```

Resultados:

- `npm run test:api`: OK, 5 archivos / 22 pruebas.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- `git diff --check`: OK, solo avisos CRLF normales de Windows.

Adicionalmente se intento:

```text
npm run test:api:integration -- api-h18-operational-reports
```

Resultado: suite `skipped` por no tener PostgreSQL local de test activo/configurado.

## 7. Confirmaciones

- No se crearon migraciones.
- No se modifico base de datos.
- No se agrego columna `line_key`.
- No se ejecuto `db:migrate`.
- No se tocaron datos productivos.
- No se tocaron datos fiscales.
- No se cambio formula H01.
- No se modifico frontend.
- No se ejecuto `npm audit fix`.
- No se hizo deploy.

## 8. Siguiente paso recomendado

Ejecutar la suite de integracion H18 contra `nomina_docente_test` cuando PostgreSQL local este disponible y, si pasa, preparar deploy controlado del hotfix backend/API.
