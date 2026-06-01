# H09/H10 Fase 3 - Cierre controlado de ciclo/cuatrimestre

## 1. Que se implemento

Se agrego backend para cerrar de forma controlada un ciclo academico activo y activar el siguiente ciclo en planeacion.

La implementacion usa las tablas existentes:

- `academic_cycles`
- `payroll_calendar_config`
- `payroll_runs`
- `schedules`
- `extra_hours`
- `quarter_closures`
- `audit_log`

No se creo migracion nueva y no se amplio `quarter_closures`.

## 2. Endpoint de cierre

Ruta creada:

```http
POST /calendar/cycles/:id/close
```

Body:

```json
{
  "nextCycleId": "uuid",
  "observation": "texto opcional"
}
```

`id` representa el ciclo actual a cerrar. `nextCycleId` representa el ciclo siguiente, que debe estar en `PLANEACION`.

## 3. Validaciones de cierre

Antes de cerrar se valida:

- El actor debe ser Admin.
- El ciclo actual existe.
- El ciclo actual esta en `ACTIVO`.
- El ciclo siguiente existe.
- El ciclo siguiente esta en `PLANEACION`.
- El ciclo siguiente tiene al menos un horario capturado.
- El ciclo actual tiene quincenas configuradas.
- Cada quincena del ciclo actual tiene al menos una corrida `PAGADA`.
- No hay corridas pendientes en `BORRADOR`, `CALCULADA`, `EN_REVISION`, `APROBADA` o `CERRADA`.
- Una corrida `CANCELADA` no cuenta como pagada.

## 4. quarter_closures

Se registra un resumen operativo en `quarter_closures` con:

- `action = 'CYCLE_CLOSED_AND_NEXT_ACTIVATED'`
- observacion con ciclo siguiente y conteos de validacion
- horarios archivados
- extras archivados
- docentes afectados
- coordinaciones afectadas
- usuario ejecutor

La tabla se usa sin cambios de esquema.

## 5. audit_log

La evidencia detallada se registra en `audit_log.after_data`, incluyendo:

- `closedCycleId`
- `activatedCycleId`
- `quarterClosureId`
- `paidPeriods`
- `payrollRunIds`
- `scheduleCountNextCycle`
- `irreversible: true`
- snapshot del ciclo cerrado y del ciclo activado

`before_data` conserva los ciclos antes del cierre, quincenas, corridas pagadas y conteos usados.

## 6. Que NO se cambio

- No se modifico frontend.
- No se modifico la formula de nomina.
- No se modifico precision monetaria H01.
- No se cambiaron reglas H02/H03.
- No se modifico H05.
- No se creo migracion 013.
- No se modifico `quarter_closures`.
- No se modifico `cycle_status`.
- No se agrego enum.
- No se toco produccion.
- No se hizo deploy.

## 7. Pruebas agregadas

Se agregaron pruebas de integracion H09/H10 para:

- cierre exitoso por Admin;
- registro en `quarter_closures`;
- registro en `audit_log`;
- cambio de ciclo actual a `CERRADO`;
- cambio de ciclo siguiente a `ACTIVO`;
- bloqueo a no Admin aunque tenga `calendar.manage`;
- bloqueo si el ciclo actual no esta `ACTIVO`;
- bloqueo si el ciclo siguiente no esta `PLANEACION`;
- bloqueo si el ciclo siguiente no tiene horarios;
- bloqueo si falta quincena `PAGADA`;
- bloqueo con corridas `CALCULADA`, `EN_REVISION` o `APROBADA`;
- confirmacion de que `CANCELADA` no cuenta como pagada;
- irreversibilidad del ciclo cerrado para Horarios, Incidencias, Extras y Preview de nomina.

El seed H04 de pruebas agrego datos sinteticos para cierre, sin datos reales ni informacion fiscal.

## 8. Riesgos pendientes

- La ruta manual existente `POST /calendar/cycles/:id/activate` sigue disponible como compatibilidad administrativa y puede activar ciclos sin validar las reglas completas de cierre. Queda documentada como bypass residual a resolver en H09/H10 Fase 4 o con decision humana especifica.
- Falta alinear frontend para exponer el cierre controlado y evitar que la UI use activacion manual como flujo normal.
- Falta definir si Direccion registrara aprobacion en sistema o si seguira siendo evidencia externa.

## 9. Proximo paso

H09/H10 Fase 4: actualizar frontend de calendario para mostrar cierre controlado, estados, mensajes de bloqueo, evidencia y separacion clara entre planeacion, activo y cerrado.
