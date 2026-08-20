# SPEC H23 - Vigencia temporal de Horarios en Nomina

Estado: **Propuesta; pendiente de aprobacion humana.**

Fecha: 2026-08-20

## 1. Objetivo

Separar la elegibilidad temporal de horas provenientes de Horarios de su cantidad y de la valoracion monetaria H01.

La solucion debe permitir una Nomina de solo Extras en periodos anteriores o posteriores a la vigencia pagable de los Horarios, sin borrar carga, mover horarios, alterar tabuladores ni cambiar H01.

## 2. Problema confirmado

El motor vigente cuenta L-V en todo `payroll_start..payroll_end`, menos dias inhabiles. No existe una fecha general de vigencia pagable en `academic_cycles` y `schedules` no tiene inicio/fin propio.

M1/M2 solo delimitan sabados S1/S2. No son una fuente semantica segura para limitar L-V, especialmente por el hueco entre modulos.

Evidencia completa: `docs/auditoria/H23_Diagnostico_Vigencia_Temporal_Nomina.md`.

## 3. Modelo propuesto

Agregar a `academic_cycles`, en una migracion futura gestionada por H05:

```text
base_hours_start_date date
base_hours_end_date date
```

Los nombres son propuestos. Reglas:

- limites inclusivos;
- `base_hours_start_date <= base_hours_end_date`;
- ciclos futuros no pueden activarse sin ambos valores;
- ciclos cerrados y snapshots historicos no se recalculan;
- no inferir fechas desde M1/M2;
- no usar `created_at` del horario como vigencia.

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

31/08/2026 es candidato informado para inicio de horas base de `27-1`. El fin pagable no se deduce de M2 y permanece pendiente de aprobacion.

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

## 11. Compatibilidad y despliegue propuesto

1. Aprobar esta SPEC y las fechas de `27-1`.
2. Crear migracion H05, previsiblemente `015`.
3. Añadir campos y `CHECK` sin recalcular historicos.
4. Cargar valores aprobados del ciclo activo con backup/control productivo.
5. Centralizar conteo temporal en backend.
6. Aplicar paridad en Reportes Operativos vivos.
7. Añadir pruebas H23.
8. Validar local/test.
9. Predeploy y deploy controlados.

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

- [ ] Aprobar modelo a nivel ciclo.
- [ ] Aprobar nombres de columnas.
- [ ] Aprobar inicio y fin pagable de `27-1`.
- [ ] Confirmar relacion obligatoria entre vigencia base y M1/M2.
- [ ] Aprobar manejo de incidencias en periodos parciales.
- [ ] Aprobar inclusion de Reportes Operativos vivos en la implementacion.
- [ ] Autorizar migracion futura mediante H05.

No hay implementacion, SQL, migracion ni deploy asociados a esta SPEC en H23-F0.
