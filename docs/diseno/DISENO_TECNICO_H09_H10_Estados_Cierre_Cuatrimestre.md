# Diseño Técnico H09/H10 - Estados y Cierre de Cuatrimestre

Fecha: 2026-06-01

Estado: diseño técnico propuesto para implementación futura. No implementa cambios.

Alcance:

- H09: blindaje del flujo financiero de nómina.
- H10: ciclo en planeación como borrador operativo, captura anticipada de Horarios y cierre moderno de cuatrimestre/ciclo.

Fuera de alcance de este documento:

- No modifica código.
- No modifica base de datos.
- No ejecuta migraciones.
- No toca producción.
- No hace deploy.

Documentos base:

- `docs/specs/SPEC_H09_H10_Estados_Cierre_Cuatrimestre.md`
- `docs/auditoria/H09_H10_Analisis_Estados_Cierre_Cuatrimestre.md`
- `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md`
- `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md`

## 1. Resumen ejecutivo

La implementación futura de H09/H10 debe separar dos dominios:

- Dominio financiero: `payroll_runs.status`.
- Dominio académico-operativo: `academic_cycles.status`.

Decisiones técnicas base:

- No usar `payroll_runs.BORRADOR` para representar el ciclo futuro.
- No usar `payroll_runs.CERRADA` para cerrar cuatrimestre.
- Mantener el flujo financiero operativo en `CALCULADA`, `EN_REVISION`, `APROBADA`, `PAGADA` y `CANCELADA`.
- Blindar `PAGADA` como estado terminal sin transición de salida.
- Mantener `CANCELADA` solo antes de pago y con restauración de Incidencias/Extras.
- Usar `academic_cycles.status = 'PLANEACION'` como representación técnica final del ciclo borrador operativo.
- No agregar `BORRADOR` al enum `cycle_status` para H09/H10.
- Permitir Horarios en ciclo `PLANEACION`.
- Bloquear Incidencias, Extras y Nómina en ciclo `PLANEACION`.
- Tratar `academic_cycles.status = 'CERRADO'` como irreversible.
- Cerrar cuatrimestre mediante transacción controlada: validar, registrar cierre, cerrar ciclo actual, activar ciclo siguiente y auditar.

Conclusión final para primera implementación:

- H09/H10 se puede implementar sin migraciones.
- `quarter_closures` se usará como está actualmente.
- La evidencia detallada del cierre se registrará en `audit_log`.
- No se requiere migración `013` para la primera implementación de H09/H10.
- Cualquier migración futura queda reservada para folio/acta, gráfica formal o trazabilidad ampliada posterior.

## 2. Principios de diseño

### Separar ciclo y nómina

El ciclo académico define cuándo se puede capturar y operar.

La corrida de nómina define el estado financiero de una quincena ya calculada.

No deben mezclarse:

- `payroll_runs.BORRADOR` no significa ciclo borrador.
- `payroll_runs.CERRADA` no significa cuatrimestre cerrado.
- `academic_cycles.CERRADO` no significa nómina pagada.

### No usar `payroll_runs.BORRADOR`

`BORRADOR` existe en el enum histórico `payroll_run_status`, pero queda reservado/no operativo.

La nómina guardada seguirá naciendo como `CALCULADA`.

### No usar `payroll_runs.CERRADA`

`CERRADA` existe en el enum histórico `payroll_run_status`, pero queda reservado/no operativo.

El cierre de cuatrimestre debe vivir en `academic_cycles.status = 'CERRADO'` y, si aplica, en `quarter_closures`.

### Minimizar migraciones

Preferencia:

- No agregar `BORRADOR` a `cycle_status`.
- No modificar `payroll_run_status`.
- No ampliar `quarter_closures` para la primera implementación H09/H10.
- No crear migración `013` para H09/H10 en su primera versión.

Si hay migración futura para mejoras posteriores:

- Debe iniciar en `database/013_...sql`.
- Debe pasar por H05 (`inspect`, `status`, `dry-run`, `apply`).
- No debe repetir prefijos.

### Preservar H01/H02/H03/H05

H09/H10 no debe alterar:

- fórmula de nómina;
- precisión monetaria;
- reglas por coordinador/capturador;
- separación Fiscal/Finanzas/Nómina preview;
- control formal de migraciones H05.

## 3. Modelo técnico objetivo

### 3.1 Payroll runs

Estados usados:

- `CALCULADA`
- `EN_REVISION`
- `APROBADA`
- `PAGADA`
- `CANCELADA`

Estados reservados/no operativos:

- `BORRADOR`
- `CERRADA`

Transiciones permitidas:

| Desde | Hacia | Motivo | Permiso |
|---|---|---|---|
| `CALCULADA` | `EN_REVISION` | Enviar a revisión financiera | `finance.workflow` |
| `CALCULADA` | `CANCELADA` | Corrección antes de revisión/pago | `finance.workflow` + regla de cancelación |
| `EN_REVISION` | `APROBADA` | Aprobar para pago | `finance.workflow` |
| `EN_REVISION` | `CANCELADA` | Corrección antes de aprobación/pago | `finance.workflow` + regla de cancelación |
| `APROBADA` | `PAGADA` | Confirmar pago | `finance.workflow` |
| `APROBADA` | `CANCELADA` | Corrección antes de pago | `finance.workflow` + regla de cancelación |

Transiciones prohibidas:

- `PAGADA -> cualquier estado`
- `CANCELADA -> cualquier estado`
- `BORRADOR -> cualquier estado`
- `CERRADA -> cualquier estado`
- cualquier transición no listada explícitamente.

Reglas:

- `PAGADA` es terminal.
- `CANCELADA` solo aplica antes de `PAGADA`.
- `CANCELADA` mantiene la lógica actual: restaurar Incidencias/Extras desde snapshots de la corrida calculada.
- `CANCELADA` conserva la lógica actual del módulo Finanzas y solo se bloquea adicionalmente cuando la nómina ya está `PAGADA`.
- Después de corrección se guarda una nueva corrida en `CALCULADA`.
- La corrida cancelada queda histórica y no se edita.
- La nueva corrida debe pasar nuevamente por revisión.

Validaciones técnicas requeridas:

- `validateStatusTransition` debe conservar `PAGADA: []`.
- La ruta de cambio de estado no debe aceptar `BORRADOR` ni `CERRADA` como target.
- Si llega target `CANCELADA`, validar que estado actual no sea `PAGADA`.
- Las pruebas H04 deben cubrir intento de cancelar `PAGADA`.

### 3.2 Academic cycles

Estados técnicos actuales:

- `PLANEACION`
- `ACTIVO`
- `CERRADO`

Uso objetivo:

| Estado | Uso técnico | Operación |
|---|---|---|
| `PLANEACION` | Ciclo futuro/borrador | Permite preparación de calendario y Horarios. Bloquea Incidencias, Extras y Nómina. |
| `ACTIVO` | Ciclo vigente | Permite operación completa según ventanas, permisos y reglas. |
| `CERRADO` | Ciclo cerrado irreversible | Bloquea edición y captura. Solo consulta histórica. |

Reglas:

- Solo debe existir un ciclo `ACTIVO`.
- Puede existir uno o más ciclos `PLANEACION`, pero la UI debe guiar hacia el siguiente ciclo objetivo.
- Un ciclo `PLANEACION` puede tener Horarios.
- Un ciclo `PLANEACION` no puede tener Incidencias/Extras operativos.
- Un ciclo `PLANEACION` no puede calcular ni guardar Nómina.
- Un ciclo `CERRADO` no puede editarse por rutas ordinarias.
- La activación del nuevo ciclo debe ocurrir dentro del cierre controlado cuando el ciclo actual cumpla precondiciones.

### 3.3 Quarter closures

Tabla actual:

- `quarter_closures.id`
- `quarter_closures.cycle_id`
- `quarter_closures.action`
- `quarter_closures.observation`
- `quarter_closures.schedules_archived`
- `quarter_closures.extras_archived`
- `quarter_closures.affected_teachers`
- `quarter_closures.affected_coordinations`
- `quarter_closures.executed_at`
- `quarter_closures.executed_by`

Decisión técnica final:

- Se usará `quarter_closures` con su estructura actual.
- No se ampliará `quarter_closures` para H09/H10 primera implementación.
- No se creará migración `013` para H09/H10 primera implementación.
- La evidencia detallada del cierre se registrará en `audit_log.after_data`.

Uso propuesto sin migración:

- `quarter_closures.action = 'CYCLE_CLOSED_AND_NEXT_ACTIVATED'`.
- `quarter_closures.observation` contendrá un resumen textual del cierre.
- Los conteos actuales se llenarán con información disponible del ciclo cerrado y del ciclo activado.
- `audit_log.after_data` registrará metadata detallada:
  - `closedCycleId`;
  - `activatedCycleId`;
  - `paidPeriods`;
  - `payrollRunIds`;
  - `scheduleCountNextCycle`;
  - `executedBy`;
  - `irreversible: true`.

Reservado para fase futura:

- Folio/acta formal.
- Metadata JSON dentro de `quarter_closures`.
- `next_cycle_id` como FK.
- Evidencia de cierre independiente de `audit_log`.

## 4. Cambios backend requeridos

| Archivo | Cambio requerido | Riesgo | Pruebas necesarias |
|---|---|---|---|
| `apps/api/src/routes/calendar.ts` | Agregar flujo de cierre de ciclo/cuatrimestre; validar precondiciones; cerrar ciclo actual; activar ciclo siguiente; registrar `quarter_closures`/auditoría. Impedir nueva quincena si la anterior no está `PAGADA`. | Alto: toca estado de ciclos y calendario operativo. | Cierre exitoso, cierre sin quincenas pagadas, cierre sin ciclo siguiente, cierre sin horarios, bloqueo de edición en cerrado. |
| `apps/api/src/routes/schedules.ts` | Confirmar/ajustar que Horarios se puedan crear/editar en `PLANEACION` y `ACTIVO`, pero no en `CERRADO`. Evitar autocrear ciclos activos innecesarios. | Medio: puede afectar captura anticipada y operación activa. | Crear horario en `PLANEACION`, crear en `ACTIVO`, bloquear en `CERRADO`, validar H02/coordinador. |
| `apps/api/src/routes/incidences.ts` | Mantener bloqueo si `cycleStatus !== 'ACTIVO'`. Asegurar mensaje claro para `PLANEACION`. | Bajo-medio: ya bloquea no activo, pero UX/API debe ser explícito. | Intento en `PLANEACION` 403/409 controlado, intento en `CERRADO` bloqueado, activo permitido. |
| `apps/api/src/routes/extras.ts` | Mantener bloqueo si ciclo no está `ACTIVO`. Asegurar mensaje claro para `PLANEACION`. | Bajo-medio: ya exige activo, pero debe cubrir nuevo flujo. | Intento en `PLANEACION` bloqueado, en `CERRADO` bloqueado, activo permitido, propiedad H02 intacta. |
| `apps/api/src/routes/payroll.ts` | Confirmar bloqueo de cálculo/guardado si ciclo no está `ACTIVO`; actualizar tipo `PayrollRunRow.status` para incluir `EN_REVISION` y `PAGADA`; no usar `BORRADOR`. | Medio: payroll es crítico, no tocar fórmula. | Preview bloqueado en `PLANEACION`, guardado bloqueado en `PLANEACION`, cálculo activo intacto, H01 intacto. |
| `apps/api/src/routes/reports.ts` | Blindar `PAGADA` terminal; conservar cancelación solo antes de pago; no permitir target `BORRADOR`/`CERRADA`; cubrir con auditoría. | Medio: workflow financiero productivo. | `PAGADA -> CANCELADA` bloqueado, `APROBADA -> CANCELADA` permitido, targets inválidos bloqueados. |
| `apps/api/src/types.ts` | Si se centralizan tipos, reflejar estados reales de ciclo y nómina sin cambiar reglas. | Bajo: riesgo de typecheck si se dispersan tipos. | Typecheck API/global. |

Notas técnicas:

- El cierre debe ejecutarse dentro de transacción.
- La activación de ciclo por cierre debe ser distinta conceptualmente de la activación manual actual.
- Si se conserva `POST /calendar/cycles/:id/activate`, debe validarse que no permita saltarse reglas de cierre cuando exista ciclo activo con quincenas pendientes.

## 5. Cambios frontend requeridos

| Vista | Cambio requerido | Mensajes visuales | Bloqueo de acciones | Pruebas necesarias |
|---|---|---|---|---|
| `CalendarView.vue` | Mostrar ciclo `PLANEACION` como borrador/planeación; agregar checklist de cierre; acción Admin para cerrar ciclo si se implementa. | "Ciclo en planeación: solo Horarios"; "Cierre irreversible"; "Todas las quincenas deben estar pagadas". | Deshabilitar cierre si faltan precondiciones; deshabilitar edición en `CERRADO`. | Render de estados; cierre habilitado/deshabilitado; mensajes de error. |
| `SchedulesView.vue` | Permitir seleccionar ciclo `PLANEACION`; permitir captura de Horarios en ciclo futuro. | "Captura anticipada de horarios"; "Este ciclo aún no permite incidencias/extras/nómina". | Bloquear edición si ciclo `CERRADO`. | Selector de ciclo futuro; crear horario en `PLANEACION`; bloqueo en `CERRADO`. |
| `IncidencesView.vue` | Mostrar bloqueo si ciclo es `PLANEACION` o `CERRADO`. | "Las incidencias se habilitan cuando el ciclo esté activo". | Ocultar/deshabilitar guardar en no activo. | Bloqueo en `PLANEACION`; activo sin regresión. |
| `ExtrasView.vue` | Mostrar bloqueo si ciclo es `PLANEACION` o `CERRADO`. | "Los extras se capturan solo en ciclo activo". | Ocultar/deshabilitar nuevo/editar/eliminar en no activo. | Bloqueo en `PLANEACION` y `CERRADO`; propiedad H02 intacta. |
| `PayrollView.vue` | No permitir preview operativo ni guardado en ciclo `PLANEACION`; mantener H01 intacto. | "La nómina se habilita al activar el ciclo". | Ocultar/deshabilitar calcular/guardar en ciclo no activo. | Preview bloqueado en `PLANEACION`; guardado activo intacto. |
| `FinanceReportsView.vue` | Ocultar/deshabilitar cancelación cuando run está `PAGADA`; mantener flujo actual antes de pago. | "Nómina pagada: estado final". | No mostrar workflow si no hay transición permitida. | No renderizar cancelación en `PAGADA`; transiciones previas visibles. |

## 6. Reglas por módulo

### Calendario

`PLANEACION`/BORRADOR:

- Permite crear/configurar ciclo futuro.
- Permite crear/configurar quincenas futuras.
- No abre operación completa.
- Debe mostrar estado como preparación.

`ACTIVO`:

- Permite operación completa.
- Debe impedir abrir una nueva quincena operativa si la anterior no está `PAGADA`.
- Permite cierre solo si precondiciones se cumplen.

`CERRADO`:

- No permite edición de ciclo, fechas ni quincenas.
- Solo consulta histórica.

### Horarios

`PLANEACION`/BORRADOR:

- Permite crear/editar/eliminar Horarios según permisos actuales.
- Conserva reglas H02: coordinador/propiedad/alcance.
- No debe crear coordinaciones.

`ACTIVO`:

- Operación normal vigente.
- Mantiene validaciones de máximo de horas por categoría y reglas de docentes compartidos.

`CERRADO`:

- Bloqueado.

### Incidencias

`PLANEACION`/BORRADOR:

- Bloqueado.

`ACTIVO`:

- Permitido por ventana de captura, calendario y permisos.
- Bloqueado si la quincena ya tiene nómina guardada vigente.

`CERRADO`:

- Bloqueado.

### Extras

`PLANEACION`/BORRADOR:

- Bloqueado.

`ACTIVO`:

- Permitido por ventana de captura, calendario y permisos.
- Conserva regla de propiedad/capturador.
- Dirección/Subdirección solo modifica extras capturados por su usuario si aplica.

`CERRADO`:

- Bloqueado.

### Nómina

`PLANEACION`/BORRADOR:

- Bloqueado para cálculo operativo.
- Bloqueado para guardar corrida.

`ACTIVO`:

- Preview/guardado conforme a permisos H03.
- Guardado genera `CALCULADA`.

`CERRADO`:

- Bloqueado para nuevos cálculos.
- Solo histórico.

### Finanzas

`PLANEACION`/BORRADOR:

- No debe tener corridas operativas.

`ACTIVO`:

- Flujo financiero normal.
- `CANCELADA` antes de `PAGADA`.
- `PAGADA` terminal.

`CERRADO`:

- Consulta histórica.
- Sin cambios financieros salvo si se define proceso excepcional fuera de flujo normal.

### Reportes históricos

`PLANEACION`/BORRADOR:

- Reportes de preparación opcionales, sin totales financieros definitivos.

`ACTIVO`:

- Reportes financieros y operativos vigentes.

`CERRADO`:

- Histórico por ciclo/quincena/docente/coordinación.
- Posible gráfica de fluctuación por quincena en fase posterior.

## 7. Validaciones de cierre

Reglas obligatorias antes de cerrar:

1. Usuario ejecutor es Admin.
2. Ciclo actual existe y está `ACTIVO`.
3. Ciclo siguiente existe y está `PLANEACION`.
4. Ciclo siguiente tiene al menos un horario capturado.
5. Todas las quincenas requeridas del ciclo actual existen.
6. Todas las quincenas del ciclo actual tienen corrida final `PAGADA`.
7. No hay quincena previa pendiente.
8. No hay corrida vigente no cancelada en estado previo.
9. No hay nómina `CALCULADA`, `EN_REVISION` o `APROBADA` que impida cierre.

Regla de corrida final por quincena:

```sql
-- Idea conceptual, no ejecutar como migración.
SELECT pcc.id, pcc.period_label
FROM payroll_calendar_config pcc
WHERE pcc.cycle_id = :cycle_id
  AND NOT EXISTS (
    SELECT 1
    FROM payroll_runs pr
    WHERE pr.cycle_id = pcc.cycle_id
      AND pr.period_label = pcc.period_label
      AND pr.status = 'PAGADA'
  );
```

Regla de corrida vigente pendiente:

```sql
-- Idea conceptual, no ejecutar como migración.
SELECT pr.id, pr.period_label, pr.status
FROM payroll_runs pr
WHERE pr.cycle_id = :cycle_id
  AND pr.status IN ('CALCULADA', 'EN_REVISION', 'APROBADA', 'BORRADOR', 'CERRADA');
```

Regla de siguiente ciclo con horarios:

```sql
-- Idea conceptual, no ejecutar como migración.
SELECT count(*)::int AS schedule_count
FROM schedules
WHERE cycle_id = :next_cycle_id;
```

Regla de ciclo siguiente:

```sql
-- Idea conceptual, no ejecutar como migración.
SELECT id, status
FROM academic_cycles
WHERE id = :next_cycle_id
  AND status = 'PLANEACION';
```

## 8. Diseño de cierre

Flujo transaccional propuesto:

1. Abrir transacción.
2. Bloquear ciclo actual y ciclo siguiente con `FOR UPDATE`.
3. Validar que el actor sea Admin.
4. Validar ciclo actual `ACTIVO`.
5. Validar ciclo siguiente `PLANEACION`.
6. Validar quincenas pagadas del ciclo actual.
7. Validar que no existan corridas pendientes vigentes.
8. Validar que el ciclo siguiente tenga Horarios capturados.
9. Registrar cierre en `quarter_closures` usando su estructura actual.
10. Insertar `audit_log` con evidencia detallada.
11. Actualizar ciclo actual:
    - `status = 'CERRADO'`
    - `closed_at = now()`
    - `closed_by = actor.id`
12. Actualizar ciclo siguiente:
    - `status = 'ACTIVO'`
    - `closed_at = NULL`
    - `closed_by = NULL`
13. Confirmar transacción.
14. Responder con resumen del cierre.

Consideraciones:

- No debe limpiar snapshots de nómina.
- No debe borrar Horarios históricos.
- No debe borrar `payroll_runs`, `payroll_lines`, `payroll_schedule_details` ni `payroll_extra_details`.
- La "limpieza" de Incidencias/Extras debe entenderse como cierre de capa viva del ciclo anterior y apertura de captura para el nuevo ciclo, no como borrado indiscriminado de histórico.
- Si se decide limpiar tablas vivas del ciclo cerrado, debe hacerse solo si el histórico está completo y con respaldo.

## 9. Migraciones posibles

Decisión final para primera implementación:

- No se requiere migración `013` para H09/H10.
- `PLANEACION` representa técnicamente el ciclo borrador.
- `quarter_closures` se usará sin ampliaciones.
- La evidencia detallada se registrará en `audit_log`.
- No se agregará enum `BORRADOR` a `cycle_status`.
- No se modificará `payroll_run_status`.

Migración futura reservada:

- Solo si una fase posterior requiere folio/acta formal.
- Solo si se aprueba una gráfica formal con evidencia persistida adicional.
- Solo si se requiere trazabilidad independiente de `audit_log`.
- Solo si se decide almacenar `next_cycle_id` o metadata JSON dentro de `quarter_closures`.

Preferencias:

- No agregar enum `BORRADOR`.
- Usar `PLANEACION`.
- Evitar modificar `payroll_run_status`.
- No crear nuevos estados financieros.
- No tocar H01.
- No cambiar H02/H03.

Reglas H05:

- Toda migración futura debe iniciar desde `013`.
- Debe pasar por `db:migrate:inspect`, `status`, `dry-run` y `apply`.
- No repetir prefijos.
- No modificar migraciones históricas.

## 10. Pruebas H04 requeridas

Backend:

- `PLANEACION` permite crear Horarios.
- `PLANEACION` permite editar Horarios según H02.
- `PLANEACION` bloquea Incidencias.
- `PLANEACION` bloquea Extras.
- `PLANEACION` bloquea Nómina preview operativo/guardado.
- `CERRADO` bloquea Horarios.
- `CERRADO` bloquea Incidencias.
- `CERRADO` bloquea Extras.
- `CERRADO` bloquea Nómina.
- `PAGADA` no puede cancelarse.
- `PAGADA` no puede volver a `APROBADA`.
- `CANCELADA` funciona antes de pago.
- Cierre exige todas las quincenas `PAGADA`.
- Cierre exige ciclo siguiente `PLANEACION`.
- Cierre exige ciclo siguiente con Horarios.
- Cierre activa nuevo ciclo.
- Cierre registra auditoría.
- Cierre registra `quarter_closures` si se usa.
- No se usa `payroll_runs.BORRADOR`.
- No se usa `payroll_runs.CERRADA`.

Frontend:

- CalendarView muestra ciclo en planeación/borrador.
- CalendarView muestra checklist de cierre.
- SchedulesView permite ciclo futuro `PLANEACION`.
- IncidencesView bloquea `PLANEACION`.
- ExtrasView bloquea `PLANEACION`.
- PayrollView bloquea `PLANEACION`.
- FinanceReportsView no muestra cancelar en `PAGADA`.
- El cierre muestra confirmación irreversible.

SQL/validación:

- Query de quincenas sin `PAGADA`.
- Query de corridas pendientes.
- Query de ciclo siguiente sin Horarios.
- Query de ciclos cerrados con bloqueos esperados.

## 11. Plan de implementación por fases

### Fase 1: backend estados financieros seguros

Alcance:

- Blindar explícitamente `PAGADA` terminal.
- Confirmar que `CANCELADA` no aplica a `PAGADA`.
- Mantener targets permitidos sin `BORRADOR`/`CERRADA`.
- Actualizar tipos si están incompletos.
- Agregar pruebas H04.

Sin migración.

### Fase 2: ciclo `PLANEACION` como borrador

Alcance:

- Permitir Horarios en `PLANEACION`.
- Bloquear Incidencias/Extras/Nómina en `PLANEACION`.
- Mensajes claros API.
- Mantener reglas H02 de coordinación/capturador.
- Agregar pruebas.

Sin migración. La decisión final es usar `PLANEACION`.

### Fase 3: cierre de ciclo/cuatrimestre

Alcance:

- Validaciones de precondiciones.
- Endpoint/servicio de cierre.
- Uso de `quarter_closures` y `audit_log`.
- Actualizar ciclo actual a `CERRADO`.
- Activar ciclo siguiente.
- Bloquear ciclo cerrado.

Migración:

- No requerida para la primera implementación H09/H10.
- `quarter_closures` se usará como está.
- Cualquier migración `013` queda reservada para una fase futura de folio/acta, gráfica formal o evidencia ampliada.

### Fase 4: frontend

Alcance:

- `CalendarView`.
- `SchedulesView`.
- Bloqueos visuales en `IncidencesView`, `ExtrasView`, `PayrollView`.
- Ajustes en `FinanceReportsView`.
- UX de cierre y confirmación irreversible.

### Fase 5: pruebas y deploy controlado

Alcance:

- Ejecutar H04 backend/frontend.
- Pruebas manuales por rol.
- Validación local/revisión.
- Backup si hay migración.
- Deploy controlado.
- Smoke test por rol y por ciclo.

## 12. Rollback

### Rollback técnico sin migración

Si la implementación no incluye migraciones:

- Revertir commit(s) de backend/frontend.
- Redeploy versión anterior.
- No requiere rollback de base de datos.
- Revisar que no haya cierres ejecutados con la versión fallida.

### Rollback técnico con migración 013 futura

No aplica para la primera implementación H09/H10, porque la decisión final es no crear migración `013`.

Si una fase futura amplía `quarter_closures`:

- Crear backup antes de aplicar.
- La migración debe ser compatible hacia atrás si solo agrega columnas nullable/default.
- Rollback preferente: revertir código y dejar columnas sin uso.
- Rollback destructivo: solo con aprobación DBA/Admin y si no hay datos críticos.

### Rollback operativo de cierre ejecutado

El cierre aprobado es irreversible en operación normal.

Si se ejecuta por error:

- No reabrir desde UI.
- Detener operación.
- Revisar backup.
- Requerir aprobación Admin/DBA/Dirección.
- Ejecutar corrección manual documentada si procede.

## 13. Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Confundir `PLANEACION` con ciclo activo | Alta | Mensajes claros y bloqueos backend por módulo. |
| Usar `payroll_runs.BORRADOR` incorrectamente | Alta | Tests que aseguren que no se usa en flujo H10. |
| Usar `payroll_runs.CERRADA` como cierre de ciclo | Alta | Separar tipos y documentación; no exponer acción. |
| Cerrar ciclo sin quincenas pagadas | Alta | Validación transaccional obligatoria. |
| Cerrar sin ciclo siguiente preparado | Alta | Validar ciclo siguiente y Horarios. |
| Bloquear captura anticipada de Horarios por accidente | Media | Pruebas de Horarios en `PLANEACION`. |
| Permitir Incidencias/Extras antes de tiempo | Alta | Bloqueo backend, no solo UI. |
| Permitir cancelar `PAGADA` | Alta | `PAGADA` terminal y pruebas H04. |
| Cambiar fórmula de nómina accidentalmente | Alta | No tocar helpers H01 ni cálculo; pruebas H01. |
| `quarter_closures` mínimo depende de `audit_log` para evidencia detallada | Media | Decisión aceptada para primera versión; folio/acta/gráfica formal quedan para fase futura. |

## 14. Decisiones pendientes

- ¿Cómo se visualizará la gráfica de fluctuación por quincena si se decide implementarla después?
- ¿Qué ocurre si un ciclo no tuvo quincenas con pago?
- ¿Qué ocurre si una quincena quedó sin docentes/horarios y no requiere nómina?
- ¿Debe existir aprobación registrada de Dirección antes del cierre o basta con validación externa?
- ¿`closures.manage` será exclusivo de Admin o se combinará con `isAdmin`?
- ¿La activación manual actual de ciclo debe restringirse cuando exista un ciclo activo con quincenas no pagadas?
- ¿Debe permitirse más de un ciclo `PLANEACION`?
- ¿La captura de Horarios en `PLANEACION` requiere ventanas o queda abierta hasta activación?

## 15. Recomendación final

Se puede implementar H09/H10 sin migraciones. Decisiones cerradas:

- usar `PLANEACION` como ciclo borrador;
- no agregar `BORRADOR` a `cycle_status`;
- no modificar `payroll_run_status`;
- usar `quarter_closures` actual junto con `audit_log` para cierre mínimo;
- no ampliar `quarter_closures` en la primera implementación;
- no crear migración `013` para H09/H10.

Migración futura reservada solo si:

- se requiere folio/acta formal;
- se aprueba gráfica formal con persistencia adicional;
- se decide modelar evidencia de cierre fuera de `audit_log` en una fase posterior.

Siguiente paso recomendado:

1. Aprobar este diseño técnico.
2. Implementar H09/H10 Fase 1: backend estados financieros seguros.
3. Agregar pruebas H04 para `PAGADA` terminal y `CANCELADA` solo antes de pago.
4. Mantener todo en rama/local/revisión hasta completar pruebas integrales.
5. No desplegar producción sin backup, checklist y aprobación Admin/Finanzas/Dirección.
