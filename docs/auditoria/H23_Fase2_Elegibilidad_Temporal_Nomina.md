# H23-F2 - Elegibilidad temporal en Nomina

Fecha: 2026-08-22

Estado: **Implementado y validado en local/test. Sin deploy ni migracion productiva.**

## 1. Objetivo

Integrar la vigencia pagable definida en H23-F1 en el nucleo compartido de Nomina, Incidencias y el reporte operativo vivo, sin modificar la formula monetaria H01 ni reescribir historia.

## 2. Implementacion

- `calculatePayroll()` obtiene las ocurrencias L-V de la interseccion inclusiva entre quincena y vigencia base.
- S1 y S2 usan, de forma independiente, la interseccion entre quincena, vigencia base y su modulo.
- Los dias inhabiles se descuentan de las ocurrencias elegibles.
- Un horario con cero ocurrencias elegibles conserva su fila, pero faltas, retardos y extra de incidencia aportan cero.
- Incidencias bloquea la captura de ese horario con `SCHEDULE_OUTSIDE_BASE_HOURS_PERIOD` y lo muestra como `Fuera de vigencia` en modo no editable.
- Un ciclo `ACTIVO` sin ambas fechas base produce el error controlado `BASE_HOURS_DATES_INCOMPLETE`.
- La vista viva de `Horas base y extras` aplica la misma regla temporal que Preview.
- Los reportes basados en snapshot no fueron modificados.

## 3. Extras independientes

Los extras de `extra_hours` conservan exactamente su seleccion vigente por ciclo, fecha de actividad o captura, quincena, ventana y ausencia de corrida bloqueante. No se limitan por vigencia base ni por M1/M2.

El fixture `27-1` confirma que una quincena anterior al inicio de clases puede producir base, S1, S2 e incidencias en cero y conservar extras independientes elegibles.

## 4. Regresion H01 e historia

No se modificaron `decimal.js`, `ROUND_HALF_UP`, tabuladores, multiplicaciones, descuentos, valores monetarios ni formulas de extras. H23 decide las ocurrencias temporales antes de H01.

Preview y Guardar siguen compartiendo `calculatePayroll()`. Las pruebas tambien confirman que cancelar, restaurar y recalcular conserva el flujo vigente, y que una corrida historica previa mantiene su fingerprint. No se reescribieron snapshots ni corridas existentes.

## 5. Pruebas implementadas

Se cubrieron:

- quincena totalmente anterior a la vigencia;
- cruce parcial del inicio;
- quincena interna con dia inhabil;
- S1 y S2 intersectando independientemente una misma quincena;
- extra independiente sin horas base elegibles;
- fila de incidencia visible, no editable y bloqueada por backend;
- paridad Preview/Guardar;
- paridad H20 Admin/Coordinador para un mismo docente autorizado;
- paridad entre Preview y reporte vivo;
- cancelacion y recalculo sin reescritura historica;
- ciclo activo legacy sin fechas con error controlado.

## 6. Resultados de validacion

| Validacion | Resultado |
|---|---|
| `npm run test:api` | OK, 42 pruebas |
| `npm run test:api:integration` | OK, 127 pruebas, solo `nomina_docente_test` |
| `npm run test:web` | OK, 91 pruebas |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `git diff --check` | OK |

Tras el reset de integracion se restauro exclusivamente el control administrativo H05 de `nomina_docente_test` mediante baseline: 18 migraciones registradas, `pending=0` y `checksum mismatch=0`. No se ejecuto SQL funcional historico ni se accedio a produccion.

## 7. Compatibilidad

- Los ciclos legacy pueden conservar ambas fechas base en `NULL` mientras no se intenten activar bajo la nueva version.
- No se modificaron M1/M2, ventanas, horarios, estados de ciclo, quincenas ni datos historicos.
- No se cambio la semantica del reporte de carga por categoria.
- H23-F2 no modifica la cancelacion/restauracion de Nomina.

## 8. Pendientes

1. Preparar predeploy H23 con H13.
2. Crear backup productivo.
3. Aplicar `015_h23_cycle_base_hours_dates.sql` mediante H05.
4. Configurar las fechas aprobadas del ciclo `27-1` desde Calendario.
5. Desplegar API/Hosting y ejecutar smoke controlado antes de guardar la quincena especial.

## 9. Confirmaciones

- No se toco produccion.
- No se hizo deploy.
- No se aplico la migracion `015` en produccion.
- No se modifico H01.
- No se modificaron snapshots ni corridas historicas.
- No se modificaron formulas de Extras.
- No se abrieron ventanas automaticamente.
