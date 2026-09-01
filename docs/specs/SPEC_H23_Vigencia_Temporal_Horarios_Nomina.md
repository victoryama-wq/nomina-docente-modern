# SPEC H23 - Vigencia temporal de Horarios en Nomina

Estado: **H23 cerrado operativo. Migracion 015, configuracion 27-1, API/Hosting y smoke productivo aprobados.**

Fecha: 2026-08-22

## 1. Objetivo

Separar la elegibilidad temporal de horas provenientes de Horarios de su cantidad y de la valoracion monetaria H01.

La solucion debe permitir una Nomina de solo Extras en periodos anteriores o posteriores a la vigencia pagable de los Horarios, sin borrar carga, mover horarios, alterar tabuladores ni cambiar H01.

## 2. Problema confirmado

El motor vigente cuenta L-V en todo `payroll_start..payroll_end`, menos dias inhabiles. No existe una fecha general de vigencia pagable en `academic_cycles` y `schedules` no tiene inicio/fin propio.

M1/M2 solo delimitan sabados S1/S2. No son una fuente semantica segura para limitar L-V, especialmente por el hueco entre modulos.

Evidencia completa: `docs/auditoria/H23_Diagnostico_Vigencia_Temporal_Nomina.md`. La validacion integral y el ensayo sobre restauracion productiva aislada se documentan en `docs/auditoria/H23_Fase3_Validacion_Integral_PreDeploy.md` y `docs/auditoria/H23_Ensayo_Productivo_Temporal_Vigencia_Nomina.md`. El cierre productivo esta en `docs/auditoria/H23_Deploy_Productivo_Vigencia_Temporal_Nomina.md`.

## 3. Modelo aprobado

Agregar a `academic_cycles` mediante `database/015_h23_cycle_base_hours_dates.sql`, gestionada por H05:

```text
base_hours_start_date date
base_hours_end_date date
```

Los nombres y el nivel ciclo estan aprobados. Reglas:

- limites inclusivos;
- `base_hours_start_date <= base_hours_end_date`;
- ciclos futuros no pueden activarse sin ambos valores;
- ciclos cerrados y snapshots historicos no se recalculan;
- no inferir fechas desde M1/M2;
- no usar `created_at` del horario como vigencia.

M1 y M2 deben quedar completamente contenidos dentro de la vigencia base:

```text
base_hours_start_date <= module1_start
module1_end <= base_hours_end_date
base_hours_start_date <= module2_start
module2_end <= base_hours_end_date
```

La migracion permite que ambos campos permanezcan `NULL` en ciclos legacy. No permite una sola fecha ni un rango invertido. No contiene backfill ni modifica ciclos historicos.

## 4. Regla de elegibilidad

```text
eligibleBaseDate(date) =
  date in payroll period
  and date in cycle base-hours period
  and date is not blackout
```

| Fuente | Regla propuesta |
|---|---|
| L-V | `eligibleBaseDate` + dia de semana correspondiente |
| S1 | `eligibleBaseDate` + sabado + fecha dentro de M1 |
| S2 | `eligibleBaseDate` + sabado + fecha dentro de M2 |
| Falta/retardo | No elegible cuando el horario tiene cero ocurrencias base elegibles |
| Extra de incidencia | No elegible cuando el horario tiene cero ocurrencias base elegibles |
| Extra independiente | Fecha dentro de quincena; no limitado por vigencia base |

El periodo de Nomina, la vigencia base y M1/M2 usan intersecciones inclusivas.

## 5. Caso 27-1

Para la quincena 2026-08-10 a 2026-08-22:

- Horarios L-V = 0;
- S1 = 0;
- S2 = 0;
- faltas/retardos/extras de incidencia = 0/no elegibles;
- Extras independientes fechados dentro de la quincena = elegibles segun las reglas operativas existentes.

Configuracion aprobada para `27-1`:

```text
base_hours_start_date = 2026-08-31
base_hours_end_date   = 2026-12-12
module1               = 2026-08-31 .. 2026-09-17
module2               = 2026-10-24 .. 2026-12-05
```

Estas fechas son configurables por Admin desde Calendario y no se infieren ni quedan codificadas como regla del sistema.

## 6. H01

H23 se ejecuta antes de H01:

```text
fechas -> ocurrencias elegibles -> horas elegibles -> H01
```

No cambia:

- `decimal.js`;
- `ROUND_HALF_UP`;
- strings monetarios;
- tabuladores;
- valor de falta;
- retardo de 0.5 horas;
- formulas de Extras.

## 7. Preview y persistencia

Preview y Guardar deben seguir usando el mismo `calculatePayroll()`.

Guardar persistira solo resultados de calculos nuevos. No se deben reescribir:

- `payroll_runs` existentes;
- `payroll_lines` existentes;
- `payroll_schedule_details` existentes;
- `payroll_extra_details` existentes.

## 8. Incidencias

Cuando un horario tenga cero ocurrencias elegibles en la quincena:

- la UI debe mostrarlo no editable o fuera de captura;
- backend debe bloquear captura no elegible;
- calculo debe aplicar defensa en profundidad y usar cero.

Para quincenas parciales, el modelo agregado actual no identifica la fecha de cada falta/retardo. La primera implementacion puede conservar el agregado solo para ocurrencias elegibles y documentar la disciplina de captura. Una futura incidencia fechada requiere otra SPEC.

Decision H23 v1: si existe al menos una ocurrencia base elegible, operacion puede continuar con el modelo agregado actual y debe capturar solo incidencias de clases realmente elegibles. H23-F2 implementa el bloqueo UI/backend cuando no existe ninguna ocurrencia y la defensa en profundidad del calculo.

## 9. Extras independientes

Los Extras propedeuticos permanecen desacoplados de la vigencia base. Se consideran por:

- ciclo `ACTIVO`;
- `activity_date`, o `captured_at::date` si falta;
- fecha dentro de quincena;
- ventana de captura y ausencia de corrida guardada.

La configuracion operativa debe abrir la ventana el tiempo necesario. H23 no debe ampliar ventanas automaticamente.

## 10. Reportes

La vista viva de `Horas base y extras` debe usar la misma regla temporal que Preview. CSV/XLSX vivos deben coincidir con la tabla.

Los reportes desde snapshot conservan historia. `Horas base por categoria` sigue midiendo carga asignada del ciclo y no cambia por esta regla de ocurrencias pagables.

H23-F2 implementa la paridad temporal de la vista viva con Preview. Los reportes desde snapshot y el reporte de carga por categoria permanecen sin cambios.

## 11. Plan aprobado y estado

1. H23-F1: migracion `015`, campos, constraints, configuracion Calendario, validaciones y helper puro. Implementado en local/test.
2. H23-F2: integrar el helper en `calculatePayroll()`, incidencias y Reportes Operativos vivos, manteniendo Preview=Guardar. Implementado en local/test.
3. H23-F3: validar fronteras, H20=Admin, historicos, UX y regresion H01 sobre restauracion productiva temporal. Completado y aprobado.
4. H23-F4: aplicar `015` mediante H05, configurar `27-1`, desplegar API/Hosting y ejecutar smoke productivo sin guardar Nomina. Completado y aprobado.

No debe existir fallback silencioso para un ciclo `ACTIVO` sin vigencia base una vez habilitada la nueva regla.

## 12. Criterios de aceptacion

- periodo previo: base e incidencias de Horarios en cero;
- periodo parcial: prorrateo diario inclusivo correcto;
- periodo interno: sin regresion;
- periodo posterior: base e incidencias de Horarios en cero;
- hueco M1/M2: L-V continua dentro de vigencia;
- Extra independiente previo: se paga si cumple fecha/quincena/ventana;
- Preview y Guardar coinciden;
- Admin y Coordinador H20 obtienen el mismo calculo para un mismo docente autorizado;
- Reporte vivo coincide con Preview;
- snapshots historicos intactos;
- H01 intacto.

## 13. Decisiones pendientes

Las decisiones funcionales de modelo, columnas, fechas `27-1`, contencion M1/M2, incidencias agregadas, Extras independientes y paridad del reporte vivo estan cerradas.

Pendientes exclusivamente tecnicos/operativos:

- [x] Integrar elegibilidad en el nucleo comun `calculatePayroll()` durante H23-F2.
- [x] Aplicar defensa en profundidad para incidencias sin ocurrencias elegibles.
- [x] Aplicar paridad en Reportes Operativos vivos sin tocar snapshots.
- [x] Ejecutar predeploy completo y ensayo con backup/restauracion temporal.
- [x] Obtener autorizacion manual de la ventana productiva H23-F4.
- [x] Aplicar migracion `015` en produccion mediante H05.
- [x] Configurar `27-1` y validar smoke antes de guardar la quincena especial.

H23-F4 desplego la implementacion y cerro el smoke productivo. El ciclo `27-1` usa vigencia inclusiva `2026-08-31` a `2026-12-12`; la quincena `2026-08-10` a `2026-08-22` devuelve base e incidencias en cero. H23 limita ocurrencias antes de H01 y no sustituye ni modifica la matematica monetaria, Extras independientes o snapshots historicos.
