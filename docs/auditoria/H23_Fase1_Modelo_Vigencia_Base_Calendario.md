# H23 Fase 1 - Modelo de vigencia base y configuracion en Calendario

Fecha: 2026-08-21

Estado: **Implementado y validado en local/test. Sin deploy ni migracion productiva.**

## 1. Resumen

H23-F1 incorpora una fuente de verdad configurable para la vigencia pagable general de Horarios. El modelo vive en `academic_cycles`, se administra desde Calendario y queda expuesto por los contratos API existentes.

Esta fase no conecta aun la vigencia con `calculatePayroll()`. La sustitucion del conteo temporal de Nomina, la defensa de incidencias y la paridad del reporte vivo corresponden a H23-F2.

## 2. Migracion 015

Archivo: `database/015_h23_cycle_base_hours_dates.sql`.

Campos agregados a `academic_cycles`:

```text
base_hours_start_date date NULL
base_hours_end_date date NULL
```

Constraints:

- `academic_cycles_base_hours_dates_pair_chk`: ambos limites son `NULL`, o ambos existen y `start <= end`.
- `academic_cycles_modules_within_base_hours_chk`: cuando existe vigencia base, M1 y M2 quedan completamente contenidos.

La migracion es aditiva e idempotente. No contiene `INSERT`, `UPDATE`, `DELETE` ni backfill. No infiere fechas desde M1/M2 y no modifica ciclos cerrados, quincenas, Horarios, corridas o snapshots.

## 3. Compatibilidad historica

Los ciclos legacy pueden conservar ambos campos `NULL`. La migracion no aplica retroactivamente la regla de activacion ni altera estados existentes.

La exigencia de vigencia opera al activar un ciclo con la nueva version. La activacion manual y el cierre controlado que activa el ciclo siguiente devuelven `BASE_HOURS_DATES_INCOMPLETE` cuando faltan los limites.

Los fallbacks tecnicos que crean un ciclo ausente lo dejan en `PLANEACION`; ya no crean implicitamente un ciclo `ACTIVO` sin vigencia.

## 4. Contrato API y validaciones

Los contratos backend/frontend agregan:

```text
baseHoursStartDate
baseHoursEndDate
```

Los endpoints existentes de alta, edicion y fechas del ciclo aceptan/retornan los campos. No se crearon rutas ni permisos nuevos; Calendario conserva `calendar.manage` y la operacion de ciclos sigue limitada a Admin segun las guardas vigentes.

Errores estables agregados:

- `BASE_HOURS_DATES_INCOMPLETE`.
- `BASE_HOURS_DATES_INVALID`.
- `MODULE1_OUTSIDE_BASE_HOURS_PERIOD`.
- `MODULE2_OUTSIDE_BASE_HOURS_PERIOD`.

El backend valida el par de fechas, orden inclusivo y contencion de M1/M2. No corrige ni completa valores enviados.

## 5. Calendario

`CalendarView.vue` incorpora un bloque separado: `Vigencia pagable de horas base`.

Campos:

- `Inicio de horas base`.
- `Fin de horas base`.

La ayuda visible explica que el periodo es inclusivo, que no modifica M1/M2 y que ambos modulos deben quedar contenidos. Las fechas base se capturan explicitamente; el frontend no las infiere del codigo de cuatrimestre. Las ventanas de Incidencias/Extras permanecen en sus bloques y con su semantica previa.

## 6. Helper central

Archivo: `apps/api/src/lib/base-hours-eligibility.ts`.

Funciones puras:

- `intersectInclusiveDateRanges()`.
- `isDateWithinBaseHoursPeriod()`.
- `getEffectivePayrollBaseDateRange()`.
- `getEffectiveModulePayrollDateRange()`.

El helper calcula intersecciones inclusivas y deterministas sin mutar entradas. Permite que M1 y M2 aporten independientemente cuando ambos intersectan una misma quincena. Un periodo `2026-08-10..2026-08-22` contra la vigencia `2026-08-31..2026-12-12` produce interseccion vacia.

H23-F1 no reemplaza `countWeekday()` ni altera resultados actuales de Nomina.

## 7. Fixture 27-1

`nomina_docente_test` contiene el fixture sintetico:

```text
quarter_code: 27-1
status: PLANEACION
base_hours_start_date: 2026-08-31
base_hours_end_date: 2026-12-12
module1: 2026-08-31 .. 2026-09-17
module2: 2026-10-24 .. 2026-12-05
```

La configuracion fue aceptada por PostgreSQL y por el contrato API. Tambien existe cobertura para un ciclo legacy con ambos limites `NULL`.

## 8. H05 en test

La migracion se ensayo exclusivamente en `nomina_docente_test`:

1. Estado previo: 17 migraciones baseline, `015` pendiente, mismatch 0.
2. `db:migrate:apply`: ejecuto solo `015`; resultado 17 baseline + 1 applied, pending 0, mismatch 0.
3. La suite de integracion reconstruyo el esquema completo y limpio las filas administrativas H05, comportamiento vigente de `test:db:prepare`.
4. Estado final restaurado como baseline de test: 18 registradas, pending 0, mismatch 0.

Produccion conserva 17 migraciones registradas. No se ejecuto ningun comando H05 productivo.

## 9. Pruebas

Resultados:

- Helper H23: 12/12.
- Integracion H23 Calendario: 13/13.
- Frontend CalendarView: 8/8.
- `npm run test:api`: 39/39.
- `npm run test:web`: 90/90.
- `npm run test:api:integration`: 118/118 en 15 archivos, exclusivamente `nomina_docente_test`.
- `npm run typecheck`: OK.
- `npm run build`: OK.

La primera ejecucion completa tuvo un timeout de reset en un hook H21 (117/118); la prueba H21 aislada paso 12/12 y la repeticion completa paso 118/118. No hubo fallo de asercion funcional H23.

## 10. Alcance preservado

Confirmaciones:

- H01 intacto: sin cambios en `decimal.js`, `ROUND_HALF_UP`, `MoneyString`, tabuladores o multiplicaciones monetarias.
- `payroll.ts` y `calculatePayroll()` sin cambios en H23-F1.
- Cancelar Nomina y restauracion de Incidencias/Extras sin cambios.
- Extras independientes sin cambios.
- Incidencias sin cambio funcional en esta fase.
- `operational-reports.ts` sin cambios; paridad viva queda para H23-F2.
- snapshots y corridas historicas sin modificacion.
- sin datos productivos, deploy o ventanas productivas.

## 11. Pendiente H23-F2

H23-F2 debe reutilizar el helper en el nucleo comun de calculo para L-V, S1 y S2; aplicar defensa en profundidad a incidencias sin ocurrencias elegibles; y alinear la vista viva de Horas base y extras. Debe mantener Preview=Guardar, H20=Admin, Extras independientes, snapshots y formula H01.
