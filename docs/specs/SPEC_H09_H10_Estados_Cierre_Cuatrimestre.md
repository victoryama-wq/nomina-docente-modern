# SPEC H09/H10 - Estados y Cierre de Cuatrimestre

Fecha: 2026-06-01

Estado original de la SPEC: aprobada para diseño técnico posterior; este documento por sí mismo no implementa cambios.

Estado vigente: H09/H10 fue implementado y desplegado. La evidencia actual se encuentra en `docs/auditoria/H09_H10_Deploy_Productivo_Resultado.md` y en el SDD consolidado.

Alcance:

- H09: definición formal del uso de `BORRADOR`, `CERRADA`, `PAGADA` y `CANCELADA`.
- H10: definición formal del cierre moderno de cuatrimestre/ciclo.

Fuera de alcance de esta SPEC:

- No modifica código.
- No modifica base de datos.
- No ejecuta migraciones.
- No toca producción.
- No hace deploy.

Documentos base:

- `docs/auditoria/H09_H10_Analisis_Estados_Cierre_Cuatrimestre.md`
- `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md`
- `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md`

## 1. Resumen ejecutivo

H09/H10 formaliza dos dominios que hoy están parcialmente mezclados por nombres parecidos:

- Estados de corrida de nómina (`payroll_runs.status`).
- Estados de ciclo/cuatrimestre (`academic_cycles.status`).

Decisión funcional aprobada:

- `PAGADA` es el estado final financiero de una nómina.
- Una nómina `PAGADA` no se cancela, no se modifica y no regresa a estados previos.
- `CANCELADA` se conserva como mecanismo de corrección antes del pago.
- La captura anticipada del siguiente cuatrimestre debe existir, pero solo para Horarios.
- Incidencias, Extras y Nómina solo operan sobre ciclo activo.
- El cierre de cuatrimestre debe ser irreversible.
- Para cerrar un cuatrimestre, todas sus quincenas deben estar `PAGADA`.
- Para cerrar un cuatrimestre debe existir el siguiente ciclo con horarios capturados.

Punto clave de diseño:

El concepto humano de "ciclo BORRADOR" no debe confundirse automáticamente con `payroll_runs.status = 'BORRADOR'`. En el modelo actual, el ciclo ya tiene `PLANEACION`. La implementación futura debe decidir si:

1. `PLANEACION` representa el ciclo borrador operativo, o
2. se agrega un nuevo estado técnico `BORRADOR` a `cycle_status`.

Recomendación preliminar: usar `PLANEACION` como representación técnica del ciclo borrador, salvo que Dirección/Admin exijan ver literalmente "BORRADOR" en UI o reportes.

## 2. Problema actual

El análisis H09/H10 detectó:

- `BORRADOR` existe en `payroll_run_status`, pero no se usa en el flujo moderno.
- `CERRADA` existe en `payroll_run_status`, tipos y UI, pero no tiene ruta ni botón que la asigne.
- El flujo financiero real usa `CALCULADA`, `EN_REVISION`, `APROBADA`, `PAGADA` y `CANCELADA`.
- El cierre técnico actual existe con `academic_cycles.status = 'CERRADO'`.
- Al activar un ciclo nuevo, el ciclo activo anterior queda cerrado.
- Un ciclo cerrado bloquea edición de calendario y capturas operativas.
- No existe cierre formal moderno de cuatrimestre con validación de quincenas pagadas, precondición de siguiente ciclo, registro formal en `quarter_closures` o reporte de cierre.

Riesgo principal:

Si se implementa H09/H10 sin separar estados de nómina y estados de ciclo, se podría:

- tratar `payroll_runs.BORRADOR` como si fuera un ciclo borrador;
- usar `payroll_runs.CERRADA` como si cerrara un cuatrimestre;
- permitir operaciones de Nómina antes de tiempo;
- cerrar un ciclo sin nóminas pagadas;
- cancelar nóminas ya pagadas;
- bloquear o limpiar datos equivocados.

## 3. Decisiones humanas aprobadas

### BORRADOR

`BORRADOR` se usará para el siguiente cuatrimestre/ciclo cuando se estén capturando datos de Horarios, pero el ciclo actual todavía esté activo.

Reglas:

- Un ciclo borrador permite captura de Horarios.
- Un ciclo borrador no permite captura de Incidencias.
- Un ciclo borrador no permite captura de Extras.
- Un ciclo borrador no permite cálculo operativo completo de Nómina.
- El ciclo borrador representa planeación/captura anticipada del siguiente ciclo.

Nota técnica:

Esta decisión aplica al ciclo/cuatrimestre, no necesariamente a `payroll_runs.status = 'BORRADOR'`.

### CERRADA

`CERRADA`/`CERRADO` se usará para el cierre de un cuatrimestre/ciclo.

Reglas:

- Un ciclo pasa a cerrado cuando se cierra el cuatrimestre.
- Para cerrar un cuatrimestre debe existir el siguiente ciclo/cuatrimestre con datos de Horarios capturados.
- El cierre es irreversible.
- Un ciclo cerrado no puede editarse por ninguna razón.
- No se pueden editar Horarios, Incidencias ni Extras del ciclo cerrado.

Nota técnica:

El estado técnico actual de ciclo es `CERRADO`. El valor `CERRADA` existe en `payroll_run_status`, pero no debe asumirse como cierre de ciclo sin diseño posterior.

### PAGADA

`PAGADA` es el estado final financiero del módulo Finanzas.

Reglas:

- Una nómina `PAGADA` no puede cancelarse.
- Una nómina `PAGADA` no puede modificarse.
- Una nómina `PAGADA` no puede regresar a estados previos.
- `PAGADA` es terminal.

### CANCELADA

`CANCELADA` mantiene la lógica actual del módulo Finanzas.

Uso:

- Se usa cuando una quincena estaba en revisión/aprobación y se detecta:
  - anomalía de pagos;
  - falta de captura de Incidencia;
  - falta de captura de Extra;
  - corrección operativa necesaria antes de pagar.

Reglas:

- Al cancelar, se restauran los datos de Incidencias y Extras de esa quincena calculada.
- Después de corregir/agregar datos, se vuelve a guardar la nómina.
- La nueva nómina pasa nuevamente a revisión.
- `CANCELADA` no aplica a nóminas `PAGADA`.

### Cierre de cuatrimestre

Cerrar cuatrimestre significa:

- cerrar el ciclo/cuatrimestre actual;
- guardar la información como histórico;
- preparar el módulo Horarios para el nuevo ciclo;
- limpiar Incidencias y Extras si es necesario;
- activar el nuevo ciclo;
- bloquear de forma irreversible el ciclo cerrado.

Reglas:

- Solo Admin puede ejecutar el cierre en el sistema.
- Dirección aprueba las fechas del nuevo cuatrimestre/ciclo.
- No se requiere reporte de cierre obligatorio.
- Puede existir gráfica o vista histórica de fluctuación de quincenas en el ciclo.
- Puede generarse folio/acta solo si operación lo justifica en el futuro.
- No se debe abrir una nueva quincena sin haber pagado la anterior.
- Todas las quincenas del ciclo deben estar `PAGADA` para cerrar cuatrimestre.

### Nuevo ciclo/cuatrimestre

Funcionamiento esperado:

1. Mientras el ciclo actual está `ACTIVO`, Dirección aprueba fechas del nuevo ciclo.
2. Admin crea o apertura el nuevo ciclo en borrador/planeación.
3. En el ciclo borrador/planeación solo se permite captura de Horarios.
4. No se permite capturar Incidencias ni Extras en ciclo borrador/planeación.
5. No se permite operar Nómina del ciclo borrador/planeación.
6. Cuando el ciclo actual se cierra:
   - ciclo actual pasa a `CERRADO`;
   - ciclo borrador/planeación pasa a `ACTIVO`;
   - se habilitan Incidencias, Extras y Nómina para el nuevo ciclo.

## 4. Modelo conceptual objetivo

### Estado de ciclo académico

Define la etapa operativa del cuatrimestre/ciclo:

- planeación/borrador;
- activo;
- cerrado.

Controla:

- si se pueden capturar Horarios;
- si se pueden capturar Incidencias;
- si se pueden capturar Extras;
- si se puede calcular Nómina;
- si el ciclo es editable.

### Estado de corrida de nómina

Define el estado de una nómina guardada para una quincena:

- calculada;
- en revisión;
- aprobada;
- pagada;
- cancelada.

Controla:

- flujo de revisión financiera;
- exportaciones/reportes;
- posibilidad de corrección antes de pago;
- historial de pagos.

### Estado financiero

Es una lectura funcional de `payroll_runs.status`.

Estados financieros operativos:

- `CALCULADA`
- `EN_REVISION`
- `APROBADA`
- `PAGADA`
- `CANCELADA`

`PAGADA` es terminal.

`CANCELADA` es terminal para la corrida cancelada, pero permite crear una nueva corrida corregida para la misma quincena.

### Cierre de cuatrimestre

Es un evento administrativo-operativo sobre el ciclo:

- valida que las quincenas estén pagadas;
- valida que exista siguiente ciclo con horarios capturados;
- cierra irreversiblemente el ciclo actual;
- activa el siguiente ciclo;
- conserva histórico.

No debe depender de `payroll_runs.status = 'CERRADA'` salvo que una decisión técnica futura lo justifique.

## 5. Estados de payroll_runs objetivo

| Estado | Uso objetivo | Terminal | Editable | Transiciones permitidas |
|---|---|---|---|---|
| `BORRADOR` | Reservado. No usar para capturas anticipadas de ciclo. | No definido | No operativo | Ninguna hasta nueva decisión. |
| `CALCULADA` | Nómina guardada desde preview/cálculo vivo. Inicio del flujo financiero. | No | No se edita la corrida; se cancela si requiere corrección. | `EN_REVISION`, `CANCELADA` |
| `EN_REVISION` | Nómina enviada a revisión financiera. | No | No se edita la corrida; se cancela si requiere corrección. | `APROBADA`, `CANCELADA` |
| `APROBADA` | Nómina aprobada para pago. | No | No se edita la corrida; se cancela si requiere corrección antes de pagar. | `PAGADA`, `CANCELADA` |
| `PAGADA` | Estado final financiero. Pago confirmado. | Sí | No | Ninguna |
| `CANCELADA` | Corrida cancelada para corrección antes de pago. Conserva historial y restaura datos operativos. | Sí para esa corrida | No | Ninguna |
| `CERRADA` | Reservado. No usar como cierre de cuatrimestre sin rediseño. | Sí si existiera | No operativo | Ninguna hasta nueva decisión. |

Decisión de SPEC:

- La captura anticipada de Horarios del siguiente ciclo no debe usar `payroll_runs.BORRADOR`.
- El cierre de cuatrimestre no debe usar `payroll_runs.CERRADA` como mecanismo principal.
- `BORRADOR` y `CERRADA` pueden permanecer en el enum por compatibilidad histórica, pero deben documentarse como no operativos para nómina hasta diseño técnico posterior.

## 6. Estados de academic_cycles objetivo

| Estado | Uso objetivo | Captura Horarios | Incidencias | Extras | Nómina | Editable |
|---|---|---|---|---|---|---|
| `PLANEACION` | Representa el ciclo futuro/borrador si no se agrega nuevo enum. Permite preparar fechas y horarios antes de activar. | Sí | No | No | No | Sí, por Admin/calendario según reglas. |
| `BORRADOR` | Estado conceptual aprobado por operación. Requiere decisión técnica: agregarlo al enum o mapearlo a `PLANEACION`. | Sí | No | No | No | Sí, por Admin/calendario según reglas. |
| `ACTIVO` | Ciclo operativo vigente. | Sí | Sí, sujeto a ventana/quincena y permisos | Sí, sujeto a ventana/quincena y permisos | Sí | Sí, salvo bloqueos por nómina/flujo. |
| `CERRADO` | Ciclo finalizado irreversiblemente. Histórico. | No | No | No | No | No |

Recomendación técnica preliminar:

- Usar `PLANEACION` como implementación de ciclo borrador para evitar una migración de enum innecesaria.
- Mostrarlo en UI como "Borrador/Planeación" si operación necesita el concepto visible.
- Agregar `BORRADOR` a `cycle_status` solo si se requiere distinguir formalmente entre planeación administrativa y borrador operativo con horarios.

## 7. Flujo objetivo del ciclo

1. Existe un ciclo actual `ACTIVO`.
2. Dirección aprueba fechas del nuevo ciclo/cuatrimestre.
3. Admin crea el nuevo ciclo en `PLANEACION` o `BORRADOR`.
4. Admin configura fechas modulares y quincenas del nuevo ciclo.
5. Coordinadores/Admin capturan Horarios del nuevo ciclo.
6. El sistema bloquea Incidencias, Extras y Nómina para el nuevo ciclo mientras no esté `ACTIVO`.
7. El sistema valida el ciclo actual antes de cierre:
   - todas las quincenas requeridas existen;
   - todas las quincenas del ciclo actual tienen corrida no cancelada;
   - todas las corridas requeridas están `PAGADA`;
   - no hay quincenas previas pendientes;
   - existe siguiente ciclo con Horarios capturados.
8. Admin ejecuta cierre de cuatrimestre.
9. El sistema marca el ciclo actual como `CERRADO`.
10. El sistema activa el ciclo futuro.
11. El ciclo cerrado queda bloqueado.
12. El nuevo ciclo permite Incidencias, Extras y Nómina conforme a calendario.

Regla de irreversibilidad:

- No debe existir operación ordinaria para reabrir un ciclo `CERRADO`.
- Cualquier corrección excepcional sobre un ciclo cerrado debe tratarse como proceso fuera de flujo normal, con respaldo, autorización y auditoría específica.

## 8. Reglas de quincenas

- No se debe abrir una quincena nueva si la anterior no está `PAGADA`.
- Todas las quincenas de un ciclo deben estar `PAGADA` antes de cerrar ciclo.
- Una nómina `PAGADA` no puede cancelarse.
- `CANCELADA` solo aplica antes de `PAGADA`.
- Una quincena con corrida `CANCELADA` debe tener una nueva corrida vigente antes de considerarse completa.
- Para validar cierre, no basta con que exista historial cancelado; debe existir corrida final no cancelada en `PAGADA`.
- Una nueva corrida corregida inicia nuevamente como `CALCULADA` y debe pasar por `EN_REVISION`, `APROBADA`, `PAGADA`.

Criterio recomendado de "quincena pagada":

```text
Existe al menos una payroll_run para cycle_id + period_label
con status = 'PAGADA'
y no existe una payroll_run no cancelada más reciente en estado previo.
```

El diseño técnico debe precisar cómo ordenar corridas cuando haya historial de cancelaciones.

## 9. Reglas por módulo

### Calendario

`PLANEACION`/`BORRADOR`:

- Permite definir fechas del ciclo.
- Permite configurar quincenas.
- Permite ajustar fechas mientras el ciclo no esté cerrado y no rompa reglas de preparación.
- No habilita Incidencias, Extras ni Nómina.

`ACTIVO`:

- Permite operación normal.
- Permite abrir/cerrar ventanas de Incidencias y Extras según configuración.
- Debe impedir crear una nueva quincena operativa si la anterior no está `PAGADA`.

`CERRADO`:

- No permite editar ciclo.
- No permite editar quincenas.
- No permite modificar fechas modulares.
- Solo permite consulta histórica.

### Horarios

`PLANEACION`/`BORRADOR`:

- Permite captura anticipada de Horarios.
- Permite preparar carga docente del siguiente ciclo.
- Debe conservar reglas H02 de coordinador/propiedad/alcance vigentes.

`ACTIVO`:

- Permite captura/edición conforme a permisos actuales.
- Mantiene validaciones de categoría, máximo de horas y coordinación/capturador.

`CERRADO`:

- No permite crear, editar ni eliminar Horarios.
- Solo consulta histórica si se expone.

### Incidencias

`PLANEACION`/`BORRADOR`:

- Bloqueado.
- No permite captura anticipada.

`ACTIVO`:

- Permitido conforme a ventana de captura, quincena, rol y reglas H02.
- Se bloquea cuando la quincena ya tiene nómina guardada no cancelada.

`CERRADO`:

- Bloqueado.

### Extras

`PLANEACION`/`BORRADOR`:

- Bloqueado.
- No permite captura anticipada.

`ACTIVO`:

- Permitido conforme a ventana de captura, quincena, rol, propiedad y reglas H02.
- Dirección/Subdirección mantiene regla vigente: puede ver listado y solo modificar extras capturados por su usuario si tiene acceso operativo.

`CERRADO`:

- Bloqueado.

### Nómina

`PLANEACION`/`BORRADOR`:

- No permite cálculo operativo completo.
- No permite guardar corrida.
- Si existe preview técnico futuro, debe ser explícitamente marcado como no operativo y no guardar datos.

`ACTIVO`:

- Permite preview conforme a permisos.
- Permite guardar con `payroll.finalize`.
- La corrida guardada inicia como `CALCULADA`.

`CERRADO`:

- No permite cálculo nuevo ni guardado nuevo.
- Solo consulta histórica.

### Finanzas

Flujo objetivo:

```text
CALCULADA -> EN_REVISION -> APROBADA -> PAGADA
CALCULADA -> CANCELADA
EN_REVISION -> CANCELADA
APROBADA -> CANCELADA
```

Reglas:

- `finance.workflow` controla transiciones financieras.
- `PAGADA` no tiene salida.
- `CANCELADA` no aplica a `PAGADA`.
- Cancelar restaura Incidencias/Extras de la quincena calculada.
- Cancelar mantiene historial de la corrida cancelada.
- Una nueva corrida corregida debe volver a revisión.

### Reportes históricos

`PLANEACION`/`BORRADOR`:

- Puede mostrar preparación de horarios si se requiere.
- No debe mostrar montos de nómina operativa como definitivos.

`ACTIVO`:

- Reporta nóminas guardadas y flujo financiero normal.

`CERRADO`:

- Debe conservar consulta histórica de:
  - ciclos;
  - quincenas;
  - horarios snapshot;
  - incidencias snapshot;
  - extras snapshot;
  - nóminas pagadas;
  - totales por docente/coordinación;
  - fluctuación por quincena si se implementa gráfica.

## 10. quarter_closures

Tabla actual detectada en `database/001_initial_schema.sql`:

| Campo | Uso actual esperado |
|---|---|
| `id` | Identificador del cierre. |
| `cycle_id` | Ciclo cerrado. |
| `action` | Acción ejecutada. |
| `observation` | Observación libre. |
| `schedules_archived` | Conteo de horarios archivados. |
| `extras_archived` | Conteo de extras archivados. |
| `affected_teachers` | Conteo de docentes afectados. |
| `affected_coordinations` | Conteo de coordinaciones afectadas. |
| `executed_at` | Fecha/hora de ejecución. |
| `executed_by` | Usuario ejecutor. |

Evaluación:

- La tabla sirve como base mínima para registrar un evento de cierre.
- No cubre por sí sola todas las reglas aprobadas.
- No registra estado previo/posterior del ciclo.
- No registra ciclo siguiente activado.
- No registra validación de quincenas pagadas.
- No registra lista de payroll_runs validadas.
- No registra si el cierre fue irreversible.
- No tiene folio/acta.
- No tiene JSON de evidencia.

Recomendación:

- Puede usarse en H10 como tabla principal si se amplía con metadata JSON o columnas nuevas.
- Alternativamente puede conservarse como tabla legado/prevista y crear un modelo nuevo más explícito.
- La decisión debe tomarse en diseño técnico H09/H10.

Campos candidatos si se amplía:

- `next_cycle_id`
- `closure_status`
- `closed_payroll_runs_count`
- `paid_periods_count`
- `expected_periods_count`
- `evidence`
- `approved_by`
- `approved_at`
- `folio`

## 11. Cambios backend requeridos

Archivos probables:

- `apps/api/src/routes/calendar.ts`
- `apps/api/src/routes/schedules.ts`
- `apps/api/src/routes/incidences.ts`
- `apps/api/src/routes/extras.ts`
- `apps/api/src/routes/payroll.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/types.ts`

Cambios esperados, sin implementar todavía:

- Definir si `PLANEACION` funcionará como ciclo borrador.
- Permitir Horarios en ciclo `PLANEACION`/borrador.
- Bloquear Incidencias/Extras/Nómina en ciclo `PLANEACION`/borrador.
- Validar que todas las quincenas del ciclo actual estén `PAGADA` antes del cierre.
- Validar que exista ciclo siguiente con Horarios capturados.
- Implementar cierre irreversible de ciclo.
- Registrar cierre en `quarter_closures` o modelo nuevo.
- Impedir transición/cancelación de `PAGADA`.
- Asegurar que `CANCELADA` no aplique a `PAGADA`.
- Mantener H01/H02/H03 sin cambios de reglas.
- Mantener `finance.workflow` como permiso de estados financieros.
- Definir permiso de cierre de cuatrimestre, probablemente `closures.manage` restringido a Admin.

Migración posible:

- Solo si se decide agregar `BORRADOR` a `cycle_status`.
- Solo si se decide ampliar `quarter_closures`.
- No se debe tocar `payroll_run_status` sin decisión explícita.

## 12. Cambios frontend requeridos

Vistas probables:

- `apps/web/src/views/CalendarView.vue`
- `apps/web/src/views/SchedulesView.vue`
- `apps/web/src/views/IncidencesView.vue`
- `apps/web/src/views/ExtrasView.vue`
- `apps/web/src/views/PayrollView.vue`
- `apps/web/src/views/FinanceReportsView.vue`

Cambios esperados, sin implementar todavía:

- Mostrar ciclo `PLANEACION` como "Borrador/Planeación" si se aprueba.
- Permitir seleccionar ciclo futuro para capturar Horarios.
- Bloquear visualmente Incidencias/Extras/Nómina en ciclo borrador.
- Mostrar precondiciones de cierre de cuatrimestre.
- Mostrar advertencia de irreversibilidad.
- Ocultar o deshabilitar cancelación si la nómina está `PAGADA`.
- Mostrar historial por ciclo cerrado.
- Mostrar gráfica de fluctuación de quincenas si se aprueba.
- Evitar que `CERRADA` parezca una acción financiera disponible si no se usa en `payroll_runs`.

## 13. Pruebas requeridas H04

Pruebas backend/integración futuras:

- ciclo borrador/planeación permite crear Horarios;
- ciclo borrador/planeación permite editar Horarios según reglas H02;
- ciclo borrador/planeación bloquea Incidencias;
- ciclo borrador/planeación bloquea Extras;
- ciclo borrador/planeación bloquea preview/guardado operativo de Nómina;
- ciclo activo permite flujo normal;
- cierre exige todas las quincenas `PAGADA`;
- cierre exige siguiente ciclo con Horarios capturados;
- cierre irreversible bloquea edición del ciclo cerrado;
- cierre irreversible bloquea Horarios, Incidencias y Extras del ciclo cerrado;
- `PAGADA` no puede cancelarse;
- `PAGADA` no puede regresar a `APROBADA` o `EN_REVISION`;
- `CANCELADA` restaura Incidencias/Extras antes de pago;
- nueva corrida corregida vuelve a iniciar en `CALCULADA`;
- activación de nuevo ciclo deja el ciclo anterior cerrado;
- histórico permanece disponible después del cierre;
- `payroll_runs.BORRADOR` no se usa para ciclo borrador.

Pruebas frontend futuras:

- Calendario muestra estado borrador/planeación correctamente.
- Horarios permite seleccionar ciclo futuro.
- Incidencias/Extras muestran bloqueo claro para ciclo borrador.
- Nómina oculta/deshabilita acciones para ciclo borrador.
- Finanzas no muestra cancelar en `PAGADA`.
- Cierre muestra checklist de precondiciones.
- Cierre muestra confirmación de irreversibilidad.

## 14. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Confundir estado `BORRADOR` de `payroll_runs` con ciclo borrador | Alto | Separar dominio de ciclo y dominio de nómina en tipos, docs y UI. |
| Romper operación actual de calendario | Alto | Cambios por fases, pruebas H04 y validación local antes de deploy. |
| Impedir capturas anticipadas de Horarios | Medio | Permitir Horarios en `PLANEACION`/borrador explícitamente. |
| Permitir Incidencias/Extras antes de activar ciclo | Alto | Bloqueos backend obligatorios; UI solo acompaña. |
| Permitir editar ciclo cerrado | Alto | Validación backend centralizada de ciclo `CERRADO`. |
| Cerrar sin quincenas pagadas | Alto | Precondición obligatoria de cierre. |
| Cancelar nómina pagada | Alto | `PAGADA` terminal en backend y tests. |
| Duplicar cierre con `quarter_closures` sin uso claro | Medio | Definir modelo de cierre antes de implementar. |
| Limpiar datos que debían conservarse como histórico | Alto | Usar snapshots existentes; limpieza solo de capa viva, con pruebas y respaldo. |
| Introducir migración de enum innecesaria | Medio | Preferir mapear `PLANEACION` a borrador si satisface operación. |

## 15. Decisiones técnicas pendientes

- ¿Usar `PLANEACION` como BORRADOR de ciclo o agregar `BORRADOR` a `cycle_status`?
- ¿`CERRADA` debe seguir en `payroll_run_status` solo como valor reservado o se usará para algo?
- ¿El cierre de ciclo debe llamarse siempre `CERRADO` por consistencia con `academic_cycles.status`?
- ¿`quarter_closures` se usará o se reemplazará?
- ¿Qué datos se limpian realmente y qué queda como histórico?
- ¿Cómo se visualizará la gráfica de fluctuación?
- ¿Qué define una quincena "abierta" desde la perspectiva de calendario?
- ¿Qué ocurre si una quincena no tuvo docentes/horarios y no requiere pago?
- ¿Se requiere folio/acta de cierre en primera versión o queda reservado?
- ¿`closures.manage` será exclusivo de Admin o también Dirección podrá aprobar sin ejecutar?
- ¿La captura de Horarios del ciclo borrador requiere ventanas o está siempre abierta hasta activación?

## 16. Recomendación técnica

Recomendación para diseño técnico:

1. No usar `payroll_runs.BORRADOR` para representar ciclo borrador.
2. No usar `payroll_runs.CERRADA` para cierre de cuatrimestre.
3. Usar `academic_cycles.PLANEACION` como estado técnico del ciclo borrador, salvo decisión contraria.
4. Mantener `PAGADA` como estado terminal financiero.
5. Mantener `CANCELADA` solo antes de pago.
6. Implementar H10 como cierre de ciclo, no como transición de corrida de nómina.
7. Usar `quarter_closures` solo si el diseño técnico confirma que sus campos son suficientes o define una ampliación controlada.
8. Implementar por fases:
   - Fase 1: diseño técnico y pruebas.
   - Fase 2: backend de ciclo borrador/planeación.
   - Fase 3: backend cierre de ciclo.
   - Fase 4: frontend y UX.
   - Fase 5: pruebas integrales y deploy controlado.

Recomendación de menor riesgo:

- Modelar el "ciclo BORRADOR" como `academic_cycles.status = 'PLANEACION'` y solo cambiar etiquetas/reglas operativas.
- Evitar agregar enum `BORRADOR` en `cycle_status` hasta demostrar que `PLANEACION` no alcanza.

## 17. Próximo paso

Después de aprobar esta SPEC, el siguiente paso es crear:

```text
docs/diseno/DISENO_TECNICO_H09_H10_Estados_Cierre_Cuatrimestre.md
```

El diseño técnico debe definir:

- modelo final de estados;
- si habrá migraciones;
- cambios backend por módulo;
- cambios frontend por vista;
- validaciones SQL;
- pruebas H04 nuevas;
- plan de despliegue controlado;
- rollback;
- checklist de aceptación por Admin/Finanzas/Dirección.

No se debe implementar H09/H10 hasta aprobar el diseño técnico.
