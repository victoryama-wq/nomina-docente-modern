# H09/H10 Fase 1 - Estados financieros seguros

## 1. Contexto

H09/H10 separa el flujo financiero de nómina del cierre de ciclo/cuatrimestre. Esta fase cubre solo el blindaje backend de estados financieros de `payroll_runs`.

La decisión aprobada es no usar `payroll_runs.status = 'BORRADOR'` para ciclo borrador y no usar `payroll_runs.status = 'CERRADA'` para cierre de cuatrimestre. El ciclo borrador se representará con `academic_cycles.status = 'PLANEACION'` en una fase posterior.

## 2. Qué se implementó

- Se alineó el tipo `PayrollRunRow.status` en `apps/api/src/routes/payroll.ts` para reflejar todos los estados históricos existentes: `BORRADOR`, `CALCULADA`, `EN_REVISION`, `APROBADA`, `PAGADA`, `CERRADA` y `CANCELADA`.
- Se agregaron pruebas de integración backend para validar el flujo financiero aprobado.
- No se modificó la fórmula de nómina.
- No se modificó la lógica monetaria H01.
- No se modificó la lógica H02/H03 de coordinaciones, fiscal, documentos o permisos visibles.

## 3. Estados operativos

Estados operativos para la ruta moderna de Finanzas:

| Estado | Uso |
|---|---|
| `CALCULADA` | Corrida guardada por nómina, pendiente de revisión financiera. |
| `EN_REVISION` | Corrida enviada a revisión financiera. |
| `APROBADA` | Corrida aprobada para pago. |
| `PAGADA` | Estado terminal financiero. |
| `CANCELADA` | Corrida cancelada para corrección antes de pago. |

Estados reservados/no operativos en esta fase:

| Estado | Decisión |
|---|---|
| `BORRADOR` | Reservado. No se usa como ciclo borrador. |
| `CERRADA` | Reservado. No se usa como cierre de cuatrimestre. |

## 4. Transiciones permitidas

| Desde | Hacia | Condición |
|---|---|---|
| `CALCULADA` | `EN_REVISION` | Usuario con `finance.workflow`. |
| `CALCULADA` | `CANCELADA` | Usuario autorizado a cancelar antes de pago. |
| `EN_REVISION` | `APROBADA` | Usuario con `finance.workflow`. |
| `EN_REVISION` | `CANCELADA` | Usuario autorizado a cancelar antes de pago. |
| `APROBADA` | `PAGADA` | Usuario con `finance.workflow`. |
| `APROBADA` | `CANCELADA` | Usuario autorizado a cancelar antes de pago. |

## 5. Transiciones bloqueadas

- `PAGADA -> CANCELADA`
- `PAGADA -> EN_REVISION`
- `PAGADA -> APROBADA`
- `PAGADA -> CALCULADA`
- Targets `BORRADOR` y `CERRADA` desde la ruta moderna de Finanzas.
- Workflow financiero para Dirección/Subdirección y Contador/Contabilidad.

## 6. Pruebas agregadas

Se amplió `apps/api/src/test/api-h03-permissions.integration.test.ts` con cobertura para:

- `CALCULADA -> EN_REVISION -> APROBADA -> PAGADA`.
- `PAGADA` como estado terminal.
- bloqueo de `PAGADA -> CANCELADA`.
- bloqueo de `PAGADA -> EN_REVISION`.
- bloqueo de `PAGADA -> APROBADA`.
- bloqueo de target `CALCULADA` desde la ruta moderna.
- bloqueo de targets reservados `BORRADOR` y `CERRADA`.
- cancelación permitida antes de pago desde `CALCULADA`, `EN_REVISION` y `APROBADA`.
- bloqueo de workflow financiero para Dirección/Subdirección y Contador/Contabilidad ya cubierto por H03.

## 7. Qué NO se cambió

- No se tocó producción.
- No se hizo deploy.
- No se ejecutaron migraciones.
- No se modificó base de datos.
- No se modificó `academic_cycles`.
- No se modificó `quarter_closures`.
- No se modificó calendario.
- No se modificaron Horarios, Incidencias ni Extras.
- No se modificó frontend.
- No se tocó H01 ni la fórmula de nómina.
- No se cambió H02/H03 funcional.

## 8. Riesgos pendientes

- La UI debe ocultar acciones de cancelación o cambio cuando una nómina esté `PAGADA`; esta fase valida backend, no frontend.
- `BORRADOR` y `CERRADA` siguen existiendo en el enum histórico de base de datos, pero quedan documentados como reservados/no operativos.
- El cierre de ciclo/cuatrimestre aún no se implementa; será una fase separada sobre `academic_cycles`, `quarter_closures` y `audit_log`.

## 9. Próximo paso

Implementar H09/H10 Fase 2: ciclo `PLANEACION` como borrador operativo para captura anticipada de Horarios, manteniendo bloqueadas Incidencias, Extras y Nómina hasta que el ciclo esté `ACTIVO`.
