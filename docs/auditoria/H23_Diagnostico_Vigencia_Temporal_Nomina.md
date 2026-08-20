# H23-F0 - Diagnostico de vigencia temporal de Horarios en Nomina

Fecha: 2026-08-20

Estado: **diagnosticado; sin implementacion**.

## 1. Resumen ejecutivo

El comportamiento observado es reproducible y corresponde al algoritmo vigente, no a un error de datos del horario ni a H01.

Para las horas L-V, Nomina cuenta todos los dias de la semana comprendidos entre `payroll_start` y `payroll_end`, con limites inclusivos, y solo excluye dias registrados en `calendar_blackout_dates`. No intersecta esas fechas con una vigencia general del ciclo, con M1/M2, con la fecha de creacion del horario ni con una vigencia propia del horario.

El modelo actual no contiene una fecha general de inicio/fin pagable para horas base. `academic_cycles` solo contiene las fechas de M1 y M2; `schedules` no contiene inicio, fin ni estatus propio. Por ello, basta que un horario pertenezca al `cycle_id` activo para que sus horas L-V se multipliquen por las ocurrencias de la quincena.

La consulta productiva read-only del 2026-08-20 confirmo:

- ciclo `27-1`, etiqueta `Septiembre - Diciembre 2026`, estado `ACTIVO`;
- M1: 2026-08-31 a 2026-09-17;
- M2: 2026-10-24 a 2026-12-05;
- quincena: 2026-08-10 a 2026-08-22;
- 435 horarios asociados al ciclo;
- 0 dias inhabiles, 0 incidencias, 0 extras y 0 corridas guardadas para esa quincena;
- el motor cuenta dos lunes, dos martes, dos miercoles, dos jueves y dos viernes;
- una muestra anonimizada suma 36 horas base y `$4,500.00`, exclusivamente por L-V.

La correccion futura puede y debe realizarse antes de H01:

```text
elegibilidad temporal
  -> horas elegibles
  -> valoracion monetaria H01 existente
```

La recomendacion principal es agregar a `academic_cycles` una vigencia explicita e inclusiva para horas base, propuesta como `base_hours_start_date` y `base_hours_end_date`. L-V se intersectaria con esa vigencia; S1/S2 se intersectarian, ademas, con su modulo. Los Extras independientes conservarian su regla por `activity_date`/quincena y no quedarian limitados por la vigencia de horas base.

Esta recomendacion requiere una migracion futura controlada por H05, probablemente `015`, y aprobacion humana de fechas y reglas antes de implementarse. **No se creo migracion en H23-F0.**

## 2. Metodo y garantias de solo lectura

Se revisaron migraciones, backend, frontend, pruebas y documentacion vigente. La evidencia productiva se obtuvo mediante Cloud SQL Auth Proxy temporal sobre `127.0.0.1:25436`, usuario `app_nomina`, base exacta `nomina_docente` y:

```text
default_transaction_read_only = on
```

Solo se ejecutaron consultas `SELECT`. El proxy temporal fue detenido al terminar. No se uso una BD local como sustituto de evidencia productiva y no se expusieron identidades docentes ni datos fiscales.

## 3. Inventario completo de fechas

### 3.1 Ciclo academico

| Campo real | Tabla | Semantica UI | Semantica backend | Usado por Nomina | Evidencia |
|---|---|---|---|---|---|
| `period_label` | `academic_cycles` | Nombre legible del ciclo | Etiqueta, no fecha | Solo etiqueta/contexto | `database/001_initial_schema.sql`; `CalendarView.vue` |
| `quarter_code` | `academic_cycles` | Codigo del ciclo | Identificador operativo legible | No limita fechas | `database/001_initial_schema.sql` |
| `module1_start`, `module1_end` | `academic_cycles` | Inicio/cierre M1 | Limites del conteo de sabados S1 | Si, solo S1 | `payroll.ts:421-458` |
| `module2_start`, `module2_end` | `academic_cycles` | Inicio/cierre M2 | Limites del conteo de sabados S2 | Si, solo S2 | `payroll.ts:421-458` |
| `status` | `academic_cycles` | Planeacion/Activo/Cerrado | Habilita o bloquea operacion | Si; exige `ACTIVO` | `payroll.ts:1206-1209` |
| `created_at` | `academic_cycles` | Auditoria tecnica | Alta del registro | No | Esquema productivo |
| `closed_at` | `academic_cycles` | Evidencia de cierre | Cierre irreversible H09/H10 | No cuenta ocurrencias | Esquema productivo |

No existen en `academic_cycles` campos generales equivalentes a `start_date`, `end_date`, inicio de clases o fin pagable. Tampoco existe `activated_at`; la activacion queda trazable por estatus/auditoria, no como limite de calculo.

### 3.2 Quincena y ventanas

| Campo real | Tabla | Semantica | Uso actual |
|---|---|---|---|
| `cycle_id` | `payroll_calendar_config` | Ciclo al que pertenece la quincena | Valida pertenencia al ciclo seleccionado |
| `period_label` | `payroll_calendar_config` | Etiqueta de periodo | Identifica UI y corridas |
| `payroll_start`, `payroll_end` | `payroll_calendar_config` | Inicio/cierre de quincena | Limites inclusivos para L-V y Extras |
| `incidences_access_start_at`, `incidences_access_days` | `payroll_calendar_config` | Apertura/duracion de captura | Determina ventana por reloj; no determina elegibilidad academica |
| `extras_access_start_at`, `extras_access_days` | `payroll_calendar_config` | Apertura/duracion de captura | Determina ventana por reloj; no limita por M1/M2 |
| `module1_start/end`, `module2_start/end` | `payroll_calendar_config` | Copia historica agregada por migracion 004 | Se sincroniza al editar el ciclo, pero Nomina vigente lee M1/M2 de `academic_cycles` |
| `created_at`, `updated_at` | `payroll_calendar_config` | Auditoria tecnica | No cuentan horas |
| `blackout_date` | `calendar_blackout_dates` | Dia inhabil dentro de una quincena | Excluye L-V y sabados modulares |

Los finales de acceso son derivados:

```text
access_end_at = access_start_at + make_interval(days => access_days)
```

### 3.3 Horarios

`schedules` contiene:

- `cycle_id`;
- `hours_l`, `hours_m`, `hours_x`, `hours_j`, `hours_v`;
- `hours_s1`, `hours_s2`;
- `created_at`, `updated_at` para auditoria.

No contiene:

- fecha de inicio/fin propia;
- vigencia pagable;
- estatus del horario;
- modulo asignado como rango temporal independiente.

`created_at` no se usa como inicio de vigencia. Un horario creado despues del inicio de una quincena puede participar en todo el rango de esa quincena si se calcula posteriormente.

### 3.4 Incidencias

`schedule_incidences` relaciona:

- un `schedule_id`;
- una quincena mediante `calendar_config_id`;
- `absences`;
- `delays`;
- `extra_hours_in_schedule`;
- `updated_at`/`updated_by`.

No existe fecha individual de falta, retardo o extra de incidencia. Son cantidades agregadas por horario y quincena. La relacion con una ocurrencia diaria es operacional, no estructural.

### 3.5 Extras independientes

`extra_hours` contiene:

- `cycle_id`;
- `activity_date` nullable;
- `captured_at`;
- horas, tabulador y capturador.

No contiene `calendar_config_id`. La pertenencia a quincena se infiere con:

```sql
COALESCE(activity_date, captured_at::date)
  BETWEEN payroll_start AND payroll_end
```

Los limites son inclusivos.

### 3.6 Corridas y snapshots

| Tabla | Fechas/periodo relevantes | Funcion |
|---|---|---|
| `payroll_runs` | `cycle_id`, `period_label`, `calculated_at`, `created_at`, estados financieros | Identifica la corrida guardada |
| `payroll_lines` | Sin fecha diaria; conserva agregados | Snapshot de linea monetaria |
| `payroll_schedule_details` | Sin fecha de ocurrencia; conserva `weekday_hours`, `module1_hours`, `module2_hours` y montos | Snapshot de horarios calculados |
| `payroll_extra_details` | `activity_date`, `created_at` | Snapshot de Extras independientes |

`payroll_runs.weights` guarda las fechas y conteos usados en el calculo. Una correccion futura no debe reescribir estos snapshots.

## 4. Call graph real de Preview y Guardar

```text
PayrollView.vue
  loadContext() / calculatePreview()
    -> api.ts fetchPayrollContext()
    -> api.ts previewPayroll()
       POST /api/payroll/preview
          -> payroll.ts calculatePayroll()
             -> ensureWorkingCycle()
             -> resolvePayrollPreviewTeacherScope() [H20]
             -> resolvePayrollBody()
                -> loadCalendarConfig()
             -> buildPayrollCalendar()
                -> countWeekday()
                -> countSaturdaysInIntersection()
             -> listPayrollSchedules()
                -> schedules + schedule_incidences
             -> listPayrollExtras()
             -> calculateSchedule()
             -> applyExtra()
             -> buildSummary()
          -> publicCalculation()

PayrollView.vue confirmSaveCurrentRun()
  -> api.ts savePayrollRun()
     POST /api/payroll/runs
        -> calculatePayroll() [el mismo camino anterior]
        -> savePayrollRun()
           -> payroll_runs
           -> payroll_lines
           -> payroll_schedule_details
           -> payroll_extra_details
           -> limpieza de incidencias/Extras del periodo
```

Referencias principales:

- frontend: `apps/web/src/views/PayrollView.vue:412-485`;
- API cliente: `apps/web/src/api.ts:1634-1650`;
- rutas: `apps/api/src/routes/payroll.ts:1967-1995`;
- calculo comun: `apps/api/src/routes/payroll.ts:1206-1241`;
- persistencia: `apps/api/src/routes/payroll.ts:1704-1923`.

Preview y Guardar **no tienen motores temporales separados**. Ambos llaman `calculatePayroll()`. Este punto reduce el riesgo de divergencia; la futura regla debe permanecer dentro de ese camino comun.

## 5. Algoritmo actual L-V

Codigo: `apps/api/src/routes/payroll.ts:412-458` y `999-1057`.

Pseudocodigo exacto:

```text
for weekday in [L, M, X, J, V]:
    occurrences[weekday] = 0
    for date from payrollStart through payrollEnd inclusive:
        if UTC_weekday(date) == weekday and date not in blackoutDates:
            occurrences[weekday] += 1

for each schedule where schedule.cycle_id == activeCycle.id:
    weekdayHours =
        hours_l * occurrences[L] +
        hours_m * occurrences[M] +
        hours_x * occurrences[X] +
        hours_j * occurrences[J] +
        hours_v * occurrences[V]
```

Respuestas comprobadas:

| Pregunta | Comportamiento actual |
|---|---|
| Solo dentro de quincena | Si, inclusiva |
| Interseccion con vigencia general del ciclo | No existe el campo y no se hace |
| Interseccion con M1/M2 | No para L-V |
| Considera creacion del horario | No |
| Considera inicio/fin del horario | No existen |
| Basta `cycle_id` | Si, mas alcance read-only H20 cuando el actor es Coordinador |
| Descuenta dias | Solo `calendar_blackout_dates` |
| Quincena antes de clases | Cuenta todos los L-V de la quincena |
| Quincena cruza inicio conceptual | Cuenta tambien los L-V anteriores al inicio |

## 6. Algoritmo actual S1/S2

Pseudocodigo exacto:

```text
intersectionStart = max(payrollStart, moduleStart)
intersectionEnd   = min(payrollEnd, moduleEnd)

if intersectionStart > intersectionEnd:
    saturdayCount = 0
else:
    saturdayCount = count Saturdays, inclusive,
                    excluding blackoutDates

module1Hours = schedule.hours_s1 * Saturdays(payPeriod intersect M1)
module2Hours = schedule.hours_s2 * Saturdays(payPeriod intersect M2)
```

Consecuencias:

- los limites de quincena y modulo son inclusivos;
- una quincena que cruza el inicio/cierre modular solo cuenta sabados dentro de la interseccion;
- entre fin M1 e inicio M2, S1 y S2 valen cero;
- L-V siguen contandose en ese hueco porque no dependen de M1/M2;
- usar la union M1/M2 para limitar L-V cambiaria una semantica que hoy es deliberadamente independiente.

## 7. Significado real del ciclo

`academic_cycles.status` expresa vigencia administrativa/operativa:

- `PLANEACION`: permite preparar Horarios; bloquea Incidencias, Extras y Nomina;
- `ACTIVO`: habilita la operacion sujeta a permisos y ventanas;
- `CERRADO`: historico irreversible.

No expresa por si mismo que cada fecha dentro de una quincena sea pagable. La activacion habilita Nomina para el ciclo completo, pero no aporta limites diarios.

Las fechas M1/M2 se capturan en `CalendarView.vue` como "fechas modulares", se guardan en `academic_cycles` y se copian a todas las quincenas del ciclo. Nomina las usa exclusivamente para S1/S2. Horarios permite capturar carga en `PLANEACION` y `ACTIVO`, pero no filtra horarios por esas fechas. Incidencias y Extras exigen ciclo `ACTIVO`; sus ventanas provienen de la quincena.

Por tanto:

```text
vigencia administrativa del ciclo != vigencia diaria pagable de Horarios
```

## 8. Algoritmo actual de Extras independientes

### 8.1 Participacion en Nomina

`listPayrollExtras()` carga un Extra cuando:

```text
extra.cycle_id == activeCycle.id
and COALESCE(activity_date, captured_at::date)
    is between payrollStart and payrollEnd inclusive
```

No exige M1/M2 ni una fecha general del ciclo.

Un Extra con `activity_date = 2026-08-15` pertenece a la quincena 2026-08-10 a 2026-08-22 y seria candidato de pago, aunque las horas base regulares fueran cero.

### 8.2 Posibilidad de captura

Para crear/modificar un Extra, `assertExtraPeriodOpen()` exige:

1. ciclo `ACTIVO`;
2. fecha dentro de una quincena configurada;
3. quincena sin corrida no cancelada;
4. reloj actual dentro de `extras_access_start_at + extras_access_days`.

En produccion, la ventana de la quincena analizada fue:

- apertura: 2026-08-10 19:29 UTC;
- cierre: 2026-08-12 19:29 UTC;
- estado al consultar el 2026-08-20: `CERRADO`.

Por eso un Extra del 15/08 cumple la regla de pertenencia temporal a la quincena, pero ya no puede capturarse hoy con la configuracion vigente. Resolver una reapertura operativa de ventana es una decision separada; no requiere acoplar Extras a la vigencia de horas base.

## 9. Incidencias fuera de vigencia

Nomina carga la incidencia por `schedule_id + calendar_config_id` sin fecha individual y aplica siempre:

```text
absenceDiscount = absences * tabulator
delayDiscountHours = delays * 0.5
delayDiscount = delayDiscountHours * tabulator
scheduleExtraAmount = extra_hours_in_schedule * tabulator
baseNetAmount = grossBaseAmount - absenceDiscount - delayDiscount
```

La API acepta cantidades entre 0 y 999, pero no las relaciona con ocurrencias elegibles.

Si una futura regla vuelve `grossBaseAmount = 0` y se deja una incidencia activa:

- una falta puede producir `baseNetAmount` negativo;
- un retardo puede producir `baseNetAmount` negativo;
- `extra_hours_in_schedule` puede generar un pago positivo aunque el horario regular no sea elegible.

Regla conceptual requerida:

- si un horario tiene cero ocurrencias base elegibles en la quincena, sus faltas, retardos y extras de incidencia deben ser no elegibles y computarse como cero;
- la captura debe bloquearse o mostrarse no editable para ese horario/periodo;
- los Extras independientes permanecen elegibles por su propia fecha.

Riesgo residual: las incidencias actuales son agregadas, no fechadas. En una quincena que cruza el inicio/fin puede saberse cuantas ocurrencias base son elegibles, pero no a que fecha corresponde cada falta o retardo. La solucion minima puede exigir que operacion capture solo incidencias de ocurrencias elegibles; una precision diaria requeriria otro modelo y no se recomienda dentro del cambio minimo.

## 10. Evidencia productiva del caso 27-1

### 10.1 Estado almacenado

| Elemento | Valor productivo |
|---|---|
| Ciclo | `27-1` / `Septiembre - Diciembre 2026` |
| Estado | `ACTIVO` |
| M1 | 2026-08-31 a 2026-09-17 |
| M2 | 2026-10-24 a 2026-12-05 |
| Inicio/fin general del ciclo | No existen columnas |
| Quincena | 2026-08-10 a 2026-08-22 |
| Dias inhabiles | 0 |
| Horarios del ciclo | 435 |
| Incidencias de la quincena | 0 |
| Extras de la quincena | 0 |
| Corridas no canceladas | 0 |
| Ciclo anterior real en BD | `2026-3`, estado `CERRADO` |

La denominacion humana `26-3` no coincide literalmente con el valor almacenado `2026-3`; se conserva esta diferencia como evidencia, sin modificar datos.

### 10.2 Muestra anonimizada

La muestra `DOCENTE-MUESTRA-001` tiene ocho horarios, dos coordinaciones y un tabulador uniforme de `$125.00`. No se consultaron ni documentaron datos fiscales.

Suma semanal de horarios:

| L | M | X | J | V | S1 | S2 |
|---:|---:|---:|---:|---:|---:|---:|
| 3.0 | 3.0 | 6.0 | 1.5 | 4.5 | 3.0 | 1.5 |

Ocurrencias actuales:

| L | M | X | J | V | Sabados M1 | Sabados M2 |
|---:|---:|---:|---:|---:|---:|---:|
| 2 | 2 | 2 | 2 | 2 | 0 | 0 |

Reproduccion:

```text
weekdayHours = 3*2 + 3*2 + 6*2 + 1.5*2 + 4.5*2 = 36
module1Hours = 3*0 = 0
module2Hours = 1.5*0 = 0
baseHours = 36
grossBaseAmount = 36 * 125.00 = 4,500.00
incidencias = 0
extras independientes = 0
total = 4,500.00
```

La reproduccion coincide exactamente con el valor que produce el camino de calculo actual para esas filas. La comprobacion se realizo contra datos productivos y el algoritmo fuente, sin invocar Guardar Nomina ni usar un token de sesion en el documento.

Con la regla requerida, la misma muestra tendria base cero. Si existiera, por ejemplo, un Extra independiente de 2 horas a `$125.00` con fecha 15/08, el total seria `$250.00` mediante H01 sin cambiar su formula.

## 11. Ledger diario 2026-08-10 a 2026-08-22

`Dentro ciclo` significa actualmente pertenencia administrativa al ciclo activo; no existe una fecha general con la cual evaluar el dia.

| Fecha | Dia | Dentro quincena | Dentro ciclo actual | M1 | M2 | Inhabil | Base L-V actual | S1/S2 actual | Extra independiente |
|---|---|---|---|---|---|---|---|---|---|
| 10/08 | Lunes | Si | Si por `cycle_id`; sin limite diario | No | No | No | Si | No | Candidato si existe |
| 11/08 | Martes | Si | Si por `cycle_id`; sin limite diario | No | No | No | Si | No | Candidato si existe |
| 12/08 | Miercoles | Si | Si por `cycle_id`; sin limite diario | No | No | No | Si | No | Candidato si existe |
| 13/08 | Jueves | Si | Si por `cycle_id`; sin limite diario | No | No | No | Si | No | Candidato si existe |
| 14/08 | Viernes | Si | Si por `cycle_id`; sin limite diario | No | No | No | Si | No | Candidato si existe |
| 15/08 | Sabado | Si | Si por `cycle_id`; sin limite diario | No | No | No | No | No | Si por fecha si existe |
| 16/08 | Domingo | Si | Si por `cycle_id`; sin limite diario | No | No | No | No | No | Candidato si existe |
| 17/08 | Lunes | Si | Si por `cycle_id`; sin limite diario | No | No | No | Si | No | Candidato si existe |
| 18/08 | Martes | Si | Si por `cycle_id`; sin limite diario | No | No | No | Si | No | Candidato si existe |
| 19/08 | Miercoles | Si | Si por `cycle_id`; sin limite diario | No | No | No | Si | No | Candidato si existe |
| 20/08 | Jueves | Si | Si por `cycle_id`; sin limite diario | No | No | No | Si | No | Candidato si existe |
| 21/08 | Viernes | Si | Si por `cycle_id`; sin limite diario | No | No | No | Si | No | Candidato si existe |
| 22/08 | Sabado | Si | Si por `cycle_id`; sin limite diario | No | No | No | No | No | Candidato si existe |

No habia Extras productivos en la muestra de la quincena. La columna expresa elegibilidad potencial por fecha, no existencia de un registro.

### 11.1 Ledgers reducidos de frontera

`S` y `F` representan un inicio y fin pagable futuros, todavia no existentes en el modelo. Para ilustrar el cruce inicial se usa el candidato informado `S=31/08/2026`; no se aprueba por este documento. El fin `F` debe definirse humanamente y no se deduce de M2.

| Escenario | Rango representativo | Motor actual | Regla requerida |
|---|---|---|---|
| Cruza inicio | 24/08-04/09, `S=31/08` | Cuenta 10 L-V | Cuenta 5 L-V: 24-30 en cero; 31/08-04/09 normal |
| Totalmente dentro | 07/09-18/09, si esta dentro de `S..F` | Cuenta 10 L-V; S1 segun M1 | Mismo conteo salvo inhabiles |
| Cruza fin | Periodo con dias antes y despues de `F` | Cuenta todos los L-V | Cuenta solo fechas `<= F` |
| Totalmente despues | Periodo posterior a `F` | Cuenta todos los L-V | Base Horarios, S1/S2 e incidencias = 0; Extras por fecha pueden permanecer |
| Hueco M1/M2 | 18/09-23/10 | Cuenta L-V; S1/S2 en cero | L-V sigue si esta dentro de `S..F`; no usar union modular como corte |

## 12. Matriz actual vs necesario

| Fuente | Regla actual | Resultado actual | Regla requerida | Cambio necesario |
|---|---|---|---|---|
| Horarios L-V | Quincena inclusiva menos inhabiles | Paga antes/despues de clases | Intersecar con vigencia base | Nuevo dato y conteo central |
| S1 | Quincena intersectada con M1 | Correcto para modulo, sin vigencia global | Intersecar tambien con vigencia base | Reusar conteo central |
| S2 | Quincena intersectada con M2 | Correcto para modulo, sin vigencia global | Intersecar tambien con vigencia base | Reusar conteo central |
| Faltas | Agregado por horario/quincena | Puede descontar sin base elegible | Cero/bloqueo si no hay ocurrencia elegible | Guardas de captura y calculo |
| Retardos | Agregado por horario/quincena | Puede volver negativo el neto | Cero/bloqueo si no hay ocurrencia elegible | Guardas de captura y calculo |
| Extra de incidencia | Agregado por horario/quincena | Puede pagar sin horario elegible | Cero/bloqueo si no hay ocurrencia elegible | Guardas de captura y calculo |
| Extra independiente | Fecha o captura dentro de quincena | Correctamente independiente de M1/M2 | Mantener; no limitar por vigencia base | Ninguno en calculo; revisar ventana operativa |
| Inhabil | Excluye ocurrencias | Correcto | Mantener | Ninguno |
| Quincena | Delimita calculo | Necesaria, pero insuficiente | Mantener e intersectar | Ninguno en su contrato |
| Ciclo | Solo `ACTIVO` + `cycle_id` | Habilita horarios sin limite diario | Agregar vigencia base | Modelo y validacion |
| Fechas modulares | Solo sabados S1/S2 | Correcto para modulos | Mantener semantica | No reutilizarlas como ciclo general |

## 13. Casos frontera

1. **Antes del inicio:** base e incidencias de Horarios en cero; Extras independientes segun fecha/quincena.
2. **Cruza inicio:** contar solamente ocurrencias desde el inicio inclusivo.
3. **Dentro:** conservar comportamiento actual y H01.
4. **Cruza fin:** contar solamente ocurrencias hasta el fin inclusivo; Extras posteriores pueden pagarse si pertenecen a la quincena y la operacion lo autoriza.
5. **Hueco M1/M2:** no implica ausencia de L-V. Solo S1/S2 quedan en cero fuera de sus modulos.
6. **Extra antes de clases:** candidato si su fecha cae en la quincena; la ventana de captura sigue siendo una condicion administrativa independiente.
7. **Horario creado a mitad de periodo:** el modelo actual no permite decidir si debe prorratearse por `created_at`; no debe usarse ese timestamp como vigencia sin decision humana.
8. **Incidencias en periodo parcial:** el agregado no identifica fecha; se requiere regla operativa o un modelo posterior mas granular.

## 14. Alternativas evaluadas

| Alternativa | Ventajas | Riesgos/desventajas | Dictamen |
|---|---|---|---|
| A. Usar fechas existentes del ciclo | Sin migracion | No hay inicio/fin general; M1/M2 son modulares y dejarian un hueco falso para L-V | No viable |
| B. Vigencia especifica de horas base en ciclo | Fuente unica, soporta cruces y no toca cada horario | Requiere migracion, UI/validacion y carga inicial aprobada | **Recomendada** |
| C. Vigencia por horario | Maxima precision para altas tardias o cursos distintos | Mayor complejidad, captura masiva y riesgo de datos incompletos | Diferir hasta requerimiento real |
| D. Tipo de quincena `SOLO_EXTRAS` | Resuelve rapidamente agosto | No resuelve cruces, fines ni vigencias futuras; introduce excepcion de periodo | No como solucion principal |

## 15. Recomendacion principal

### 15.1 Fuente de verdad

Agregar a `academic_cycles`, mediante una fase posterior y H05:

```text
base_hours_start_date date
base_hours_end_date date
```

Nombres finales pendientes de aprobacion humana. Ambos limites deben ser inclusivos y cumplir `start <= end`.

No inferirlos automaticamente de M1/M2. Para `27-1`, 31/08/2026 es candidato informado para inicio, pero el fin pagable no se encuentra en el modelo ni debe suponerse igual a 05/12/2026.

### 15.2 Algoritmo propuesto

```text
eligibleBaseDate(date) =
    payrollStart <= date <= payrollEnd
    and baseHoursStart <= date <= baseHoursEnd
    and date not in blackoutDates

L-V occurrence = eligibleBaseDate(date) and weekday matches
S1 occurrence  = eligibleBaseDate(date) and Saturday and date in M1
S2 occurrence  = eligibleBaseDate(date) and Saturday and date in M2

if schedule has zero eligible base occurrences in period:
    absences = 0
    delays = 0
    extraHoursInSchedule = 0

external Extra eligibility =
    cycle ACTIVE
    and extra date in payroll period
    and normal capture/run locks
```

### 15.3 Compatibilidad y despliegue futuro

- ciclos `CERRADO`: no recalcular ni rellenar snapshots;
- corridas guardadas: conservar `weights`, lineas y detalles historicos;
- ciclo `ACTIVO` actual: cargar fechas aprobadas antes de habilitar codigo que las exija;
- ciclos futuros: bloquear activacion si faltan fechas de vigencia base;
- no usar fallback silencioso para un ciclo activo sin configurar, porque reintroduciria el defecto;
- Preview y Guardar deben seguir usando `calculatePayroll()`;
- H20 solo cambia alcance de lectura; la elegibilidad temporal debe ser identica para Admin y Coordinador sobre el mismo docente;
- Reportes Operativos vivos deben adoptar el mismo conteo; reportes snapshot deben permanecer intactos.

### 15.4 Necesidad de migracion

Si se aprueba la alternativa B, **si requiere migracion**. El siguiente prefijo disponible seria `015`, sujeto a H05, backup y procedimiento productivo. H23-F0 no contiene SQL ni migracion.

## 16. Impacto en H01

No es necesario tocar H01. La nueva capa decide cantidades elegibles antes de:

- multiplicar horas por tabulador;
- descontar faltas;
- descontar `0.5` horas por retardo;
- sumar extras;
- aplicar `Decimal` y `ROUND_HALF_UP`.

`decimal.js`, tabuladores, redondeo y contratos de strings decimales permanecen iguales.

## 17. Preview, Guardar, snapshots y reportes

### Preview y Guardar

Ambos usan `calculatePayroll()`. No existe hoy una divergencia temporal entre ambos. La implementacion debe centralizar la nueva interseccion en el calendario/calculo comun y añadir una prueba de igualdad.

### Snapshots

Una correccion futura solo aplica a calculos nuevos. No debe actualizar:

- `payroll_runs` historicos;
- `payroll_lines`;
- `payroll_schedule_details`;
- `payroll_extra_details`.

### Reportes Operativos

`operational-reports.ts` no llama al motor de Nomina. Su consulta viva duplica la logica actual con `generate_series`: L-V por quincena y S1/S2 por modulos. Por tanto, una implementacion H23 que cambie solo `payroll.ts` produciria inconsistencia entre Preview y Reportes vivos.

Se requiere ajustar en la misma implementacion o fase coordinada:

- reporte vivo `Horas base y extras`;
- CSV/XLSX vivos derivados;
- pruebas de paridad con Preview.

El origen snapshot del reporte debe conservar las cifras guardadas. `Horas base por categoria` mide carga asignada del ciclo, no ocurrencias pagables de una quincena; no debe cambiar automaticamente por H23.

## 18. Plan de pruebas futuras

| Caso | Asercion principal |
|---|---|
| Periodo totalmente antes | Base/S1/S2/incidencias cero |
| Cruza inicio | Solo fechas desde inicio inclusivo |
| Dentro de vigencia | Regresion exacta del calculo vigente |
| Cruza fin | Solo fechas hasta fin inclusivo |
| Posterior | Base e incidencias cero |
| Solo Extras antes de clases | Base cero; Extra independiente pagado |
| L-V individual | Conteo por cada dia correcto |
| S1 | Interseccion quincena + vigencia base + M1 |
| S2 | Interseccion quincena + vigencia base + M2 |
| Hueco M1/M2 | L-V continua; S1/S2 cero |
| Dia inhabil | Excluido en todos los conteos base |
| Falta sin base | No descuenta ni genera negativo |
| Retardo sin base | No descuenta ni genera negativo |
| Extra de incidencia sin base | No genera pago |
| Extra independiente | Solo por fecha/quincena y ventana |
| Base + Extra | Total usa H01 sin regresion |
| Cero base + Extra | Total igual al Extra |
| Preview = Guardar | Misma entrada produce mismos detalles/total |
| H20 Coordinador = Admin | Mismo docente autorizado, mismo calculo |
| Snapshot historico | Fingerprint/conteos sin cambios |
| Reporte vivo = Preview | Mismas horas elegibles |
| Reporte snapshot | Conserva corrida historica |
| H01 | Decimal, redondeo y tabulador sin cambios |
| `PLANEACION` | Preview/Guardar bloqueados |
| `ACTIVO` sin fechas futuras | Error controlado de configuracion |
| `CERRADO` | Preview/Guardar bloqueados |

Las pruebas deben incluir periodos con limites exactos, fines de semana, dias inhabiles y una quincena que contenga simultaneamente dias no elegibles y elegibles.

## 19. Decisiones humanas pendientes

- [ ] Aprobar alternativa B como modelo principal.
- [ ] Aprobar nombres finales de los campos.
- [ ] Aprobar `base_hours_start_date` de `27-1`; 31/08/2026 solo es candidato informado.
- [ ] Definir y aprobar `base_hours_end_date` de `27-1`.
- [ ] Confirmar si M1/M2 deben estar obligatoriamente contenidos en la vigencia base.
- [ ] Aprobar bloqueo de incidencias cuando no existan ocurrencias base elegibles.
- [ ] Definir regla operativa para incidencias agregadas en quincenas que cruzan limites.
- [ ] Decidir si se reabre la ventana de Extras de la quincena 10/08-22/08 para capturar propedeuticos.
- [ ] Aprobar alcance conjunto sobre Reportes Operativos vivos.

## 20. Criterio de salida H23-F0

H23-F0 queda diagnosticado:

- comportamiento temporal actual demostrado;
- causa raiz identificada;
- caso productivo reproducido de forma anonimizada;
- necesidad operativa contrastada;
- alternativa principal propuesta;
- implementacion y migracion pendientes de aprobacion.

Hasta implementar y validar H23, la quincena especial 2026-08-10 a 2026-08-22 **no debe guardarse** con horas base regulares calculadas.

Confirmaciones de esta fase:

- sin cambios de codigo;
- sin cambios SQL;
- sin migraciones;
- sin cambios de BD;
- sin Guardar/Cancelar Nomina;
- sin cambios de ciclos, quincenas, Horarios, Extras o Incidencias;
- sin deploy;
- sin cambios H01;
- sin alteracion de snapshots;
- consultas productivas exclusivamente read-only.
