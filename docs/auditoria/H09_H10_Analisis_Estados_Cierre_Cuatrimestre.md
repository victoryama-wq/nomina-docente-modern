# H09/H10 - Análisis de estados financieros y cierre de cuatrimestre

Fecha de análisis: 2026-05-28

Alcance: revisión documental y técnica sin cambios funcionales, sin conexión a producción, sin modificación de base de datos y sin deploy.

Fuentes revisadas:

- `apps/api/src/routes/payroll.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/calendar.ts`
- `apps/api/src/routes/academic-context.ts`
- `apps/api/src/routes/schedules.ts`
- `apps/api/src/routes/incidences.ts`
- `apps/api/src/routes/extras.ts`
- `apps/web/src/views/PayrollView.vue`
- `apps/web/src/views/FinanceReportsView.vue`
- `apps/web/src/views/CalendarView.vue`
- `database/001_initial_schema.sql`
- `database/004_calendar_payroll_history.sql`
- `database/008_payroll_status_workflow.sql`
- `database/009_payroll_correction_flow.sql`
- `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md`
- `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md`

## 1. Resumen ejecutivo

El sistema tiene siete estados posibles para `payroll_runs.status`:

- `BORRADOR`
- `CALCULADA`
- `EN_REVISION`
- `APROBADA`
- `PAGADA`
- `CANCELADA`
- `CERRADA`

El flujo operativo real usa actualmente:

```text
CALCULADA -> EN_REVISION -> APROBADA -> PAGADA
                  \             \
                   \             -> CANCELADA
                    -> CANCELADA
CALCULADA -> CANCELADA
```

`BORRADOR` existe como valor inicial histórico/default de base de datos, pero la ruta moderna de guardado de nómina inserta directamente `CALCULADA`. No hay botón, ruta ni transición aprobada que cree o use `BORRADOR` como estado operativo.

`CERRADA` existe en el enum, tipos y algunas etiquetas visuales, pero no se encontró ruta backend ni acción frontend que la asigne. En la máquina actual se comporta como estado terminal reservado/no operativo.

Para H10, el sistema sí tiene cierre técnico de ciclo mediante `academic_cycles.status = 'CERRADO'`. Al activar un ciclo nuevo, el ciclo activo anterior se marca como cerrado. Ese cierre bloquea cambios de calendario, modificación de horarios/incidencias/extras del ciclo cerrado y cálculo de nómina sobre ciclos no activos. Sin embargo, no existe todavía un módulo moderno de cierre de cuatrimestre que use `quarter_closures`, emita reporte formal, valide que todas las nóminas estén pagadas o ejecute un cierre financiero/histórico irreversible.

Conclusión: no se recomienda cambiar código todavía. Se recomienda tomar decisión humana/SPEC para definir si `BORRADOR` y `CERRADA` quedan documentados como reservados, y si H10 requiere un cierre formal adicional o basta con el cierre técnico actual de ciclo.

## 2. Estados de nómina existentes

Estados detectados en base de datos, backend y frontend:

| Estado | Origen detectado | Descripción actual |
|---|---|---|
| `BORRADOR` | `database/001_initial_schema.sql`, default de `payroll_runs.status`, tipos API/web | Estado histórico/default. No tiene uso operativo moderno detectado. |
| `CALCULADA` | `database/001_initial_schema.sql`, `payroll.ts`, `reports.ts`, UI Finanzas | Estado inicial real de una nómina guardada desde `/payroll/runs`. |
| `EN_REVISION` | `database/008_payroll_status_workflow.sql`, `reports.ts`, UI Finanzas | Estado de revisión financiera posterior a `CALCULADA`. |
| `APROBADA` | `database/001_initial_schema.sql`, `reports.ts`, UI Finanzas | Estado financiero aprobado para proceder a pago. |
| `PAGADA` | `database/008_payroll_status_workflow.sql`, `reports.ts`, UI Finanzas | Estado final financiero operativo actual. |
| `CANCELADA` | `database/001_initial_schema.sql`, `database/009_payroll_correction_flow.sql`, `reports.ts` | Estado terminal de corrección; permite guardar una nueva corrida para la misma quincena. |
| `CERRADA` | `database/001_initial_schema.sql`, tipos API/web, UI Finanzas/Payroll | Estado reservado/no operativo; no se encontró ruta que lo asigne. |

Detalle técnico:

- `database/001_initial_schema.sql` creó `payroll_run_status` con `BORRADOR`, `CALCULADA`, `APROBADA`, `CERRADA`, `CANCELADA`.
- `database/008_payroll_status_workflow.sql` agregó `EN_REVISION` y `PAGADA`.
- `database/009_payroll_correction_flow.sql` cambió la unicidad de corridas por ciclo/quincena para excluir `CANCELADA`, permitiendo una nueva corrida no cancelada para la misma quincena.

## 3. Estados realmente usados

| Estado | Usado actualmente | Dónde | Quién lo asigna | Observación |
|---|---|---|---|---|
| `BORRADOR` | No operativo | Enum/default en `database/001_initial_schema.sql`; tipos en API/web | Nadie desde rutas modernas | `POST /payroll/runs` inserta `CALCULADA`, no `BORRADOR`. La transición desde `BORRADOR` está vacía en `validateStatusTransition`. |
| `CALCULADA` | Sí | `apps/api/src/routes/payroll.ts` en `savePayrollRun` | Usuario con `payroll.finalize` al guardar nómina | Es el estado inicial real de una corrida guardada. |
| `EN_REVISION` | Sí | `apps/api/src/routes/reports.ts`, `apps/web/src/views/FinanceReportsView.vue` | Usuario con `finance.workflow` | Se asigna desde `CALCULADA`; registra `reviewed_at/reviewed_by`. |
| `APROBADA` | Sí | `apps/api/src/routes/reports.ts`, `apps/web/src/views/FinanceReportsView.vue` | Usuario con `finance.workflow` | Se asigna desde `EN_REVISION`; registra `approved_at/approved_by`. |
| `PAGADA` | Sí | `apps/api/src/routes/reports.ts`, `apps/web/src/views/FinanceReportsView.vue` | Usuario con `finance.workflow` | Se asigna desde `APROBADA`; registra `paid_at/paid_by`. Es terminal en el flujo actual. |
| `CANCELADA` | Sí | `apps/api/src/routes/reports.ts`, `database/009_payroll_correction_flow.sql` | Usuario con `finance.workflow` y permiso de cancelación para corrección | Se permite desde `CALCULADA`, `EN_REVISION` o `APROBADA`. Restaura incidencias/extras desde histórico y deja la corrida cancelada en historial. |
| `CERRADA` | Parcial/no operativo | Enum/tipos y visualización en `PayrollView.vue`/`FinanceReportsView.vue` | Nadie desde rutas modernas | No se detectó payload, botón o endpoint que permita asignarla. Aparece como estado visual/terminal reservado. |

## 4. Transiciones actuales

| Desde | Hacia | Ruta/API | Permiso requerido | Usuario/rol |
|---|---|---|---|---|
| Sin corrida | `CALCULADA` | `POST /payroll/runs` | `payroll.finalize` | Admin o usuario autorizado para guardar nómina |
| `CALCULADA` | `EN_REVISION` | `PATCH /reports/finance/runs/:id/status` | `finance.workflow` | Finanzas/Admin con workflow |
| `CALCULADA` | `CANCELADA` | `PATCH /reports/finance/runs/:id/status` | `finance.workflow` + autorización de cancelación | Finanzas/Admin según regla backend |
| `EN_REVISION` | `APROBADA` | `PATCH /reports/finance/runs/:id/status` | `finance.workflow` | Finanzas/Admin con workflow |
| `EN_REVISION` | `CANCELADA` | `PATCH /reports/finance/runs/:id/status` | `finance.workflow` + autorización de cancelación | Finanzas/Admin según regla backend |
| `APROBADA` | `PAGADA` | `PATCH /reports/finance/runs/:id/status` | `finance.workflow` | Finanzas/Admin con workflow |
| `APROBADA` | `CANCELADA` | `PATCH /reports/finance/runs/:id/status` | `finance.workflow` + autorización de cancelación | Finanzas/Admin según regla backend |
| `BORRADOR` | Ninguna | No aplica | No aplica | Estado sin transición operativa. |
| `PAGADA` | Ninguna | No aplica | No aplica | Estado terminal financiero actual. |
| `CERRADA` | Ninguna | No aplica | No aplica | Estado terminal/reservado. |
| `CANCELADA` | Ninguna | No aplica | No aplica | Estado terminal de corrección; la nueva nómina se crea como otra corrida. |

Validaciones detectadas:

- `reports.ts` acepta como payload de cambio de estado solo `EN_REVISION`, `APROBADA`, `PAGADA` y `CANCELADA`.
- `reports.ts` bloquea transiciones no definidas con error de conflicto.
- La UI de Finanzas solo presenta acciones para `CALCULADA`, `EN_REVISION`, `APROBADA` y `CANCELADA`.
- No hay acción UI para mover una nómina a `BORRADOR` o `CERRADA`.

## 5. Estados ambiguos

### `BORRADOR`

Estado actual:

- Existe en el enum de base de datos.
- Es default de `payroll_runs.status`.
- No se usa en el flujo moderno de guardado.
- La ruta `POST /payroll/runs` guarda directamente en `CALCULADA`.
- No tiene transiciones permitidas en `validateStatusTransition`.
- No aparece como filtro preferido en `FinanceReportsView.vue`.

Interpretación técnica:

- Debe considerarse reservado/no operativo.
- Puede existir por compatibilidad histórica del modelo inicial.
- Sería riesgoso activarlo sin definir qué significa un borrador: si bloquea quincena, si permite editar, si consume incidencias/extras, si aparece en finanzas o si puede descartarse.

Recomendación para este estado:

- Documentarlo como reservado mientras no haya SPEC.
- No mostrarlo como flujo principal.
- Si se decide usarlo, requerirá máquina de estados formal y UX específica.

### `CERRADA`

Estado actual:

- Existe en el enum de base de datos y en tipos frontend/API.
- `FinanceReportsView.vue` lo contempla para etiquetas/timeline.
- `PayrollView.vue` lo clasifica visualmente como estado correcto.
- No se encontró endpoint ni botón que lo asigne.
- No tiene transiciones permitidas en `validateStatusTransition`.

Interpretación técnica:

- Debe considerarse reservado/no operativo.
- No equivale hoy al cierre de cuatrimestre.
- No equivale hoy a `PAGADA`.
- No equivale hoy a una nómina archivada irreversible.

Recomendación para este estado:

- Mantenerlo reservado hasta decisión humana.
- Evitar presentarlo como acción disponible.
- Si se decide usarlo, definir si `CERRADA` aplica a una corrida de nómina individual, a un periodo/quincena o al cuatrimestre completo.

## 6. Riesgos actuales

| Riesgo | Severidad | Comentario |
|---|---|---|
| Confusión en UI por `CERRADA` | Media | La UI lo sabe mostrar, pero no existe acción que lo produzca. Puede generar expectativa de cierre financiero adicional. |
| Confusión conceptual entre `PAGADA` y `CERRADA` | Media | `PAGADA` es terminal financiero actual; `CERRADA` no tiene significado operativo aprobado. |
| `BORRADOR` creado por inserción directa o script externo | Media | Al ser default, una inserción SQL sin status crearía una corrida fuera del flujo moderno y sin transición de salida. |
| Reportes históricos con estados reservados | Media | Si aparecen corridas `BORRADOR` o `CERRADA`, Finanzas podría mostrarlas, pero sin acciones claras. |
| Permisos futuros incorrectos | Media | Activar `CERRADA` o `BORRADOR` sin permisos separados podría mezclar `payroll.finalize` con `finance.workflow`. |
| Cancelación vs cierre | Media | `CANCELADA` reabre corrección y permite nueva corrida; un cierre financiero irreversible no existe formalmente. |
| Nóminas pagadas modificables | Baja-media | El backend no permite transición desde `PAGADA`, pero se debe confirmar si otros flujos de edición histórica quedan siempre bloqueados por nómina guardada. |
| Tipo desactualizado en `payroll.ts` | Baja-media | `PayrollRunRow.status` en `payroll.ts` no lista `EN_REVISION` ni `PAGADA`, aunque la base y Finanzas sí los usan. No rompe hoy, pero puede causar errores de mantenimiento. |
| `quarter_closures` sin flujo | Media | La tabla existe como intención de cierre, pero no hay módulo/ruta que la alimente. |

## 7. Cierre de cuatrimestre actual

### Modelo de ciclos

El cierre técnico actual se basa en:

- `academic_cycles.status`: `PLANEACION`, `ACTIVO`, `CERRADO`.
- `academic_cycles.closed_at`.
- `academic_cycles.closed_by`.

La ruta de calendario permite:

- Crear ciclos en `PLANEACION`.
- Editar ciclos si no están `CERRADO`.
- Activar un ciclo.
- Al activar un ciclo, cerrar otros ciclos activos (`status = 'CERRADO'`, `closed_at`, `closed_by`).
- Crear/editar/eliminar quincenas solo si el ciclo no está cerrado.
- Modificar fechas modulares solo si el ciclo no está cerrado.

### Captura operativa

Evidencia en backend:

- Horarios: no se pueden modificar horarios de un ciclo cerrado.
- Incidencias: no se pueden modificar incidencias de un ciclo cerrado y solo se capturan en ciclo activo.
- Extras: no se pueden capturar/modificar/eliminar extras de un ciclo cerrado y solo se capturan/modifican en ciclo activo.
- Nómina: `calculatePayroll` exige ciclo `ACTIVO`.

Por lo anterior, cerrar un ciclo sí bloquea la operación normal futura sobre ese ciclo desde los módulos revisados.

### Relación con `payroll_runs`

El cierre de ciclo no cambia directamente el estado de `payroll_runs`.

Las nóminas guardadas quedan como histórico en:

- `payroll_runs`
- `payroll_lines`
- `payroll_schedule_details`
- `payroll_extra_details`

Esos snapshots conservan:

- Docente.
- Coordinación.
- Tipo de pago/categoría al momento de cálculo.
- Horarios calculados.
- Incidencias.
- Extras.
- Montos.
- Alertas.

### Tabla `quarter_closures`

`database/001_initial_schema.sql` incluye `quarter_closures` con:

- `cycle_id`
- `action`
- `observation`
- conteos archivados
- `executed_at`
- `executed_by`

También existe permiso `closures.manage`.

Sin embargo:

- No se detectó ruta API moderna que cree registros en `quarter_closures`.
- No se detectó vista frontend moderna de cierre de cuatrimestre.
- No se detectó proceso que valide "todas las nóminas pagadas" antes de cerrar cuatrimestre.
- No se detectó reporte formal de cierre usando esa tabla.

Conclusión H10 actual: existe cierre técnico de ciclo y bloqueo operativo suficiente para evitar capturas futuras sobre ciclos cerrados, pero no existe cierre de cuatrimestre formal/reportable como módulo completo.

## 8. Cierre de cuatrimestre esperado

Para decidir H10 conviene separar cuatro conceptos:

| Tipo de cierre | Significado | Estado actual |
|---|---|---|
| Cierre técnico de ciclo | Marcar `academic_cycles.status = 'CERRADO'` y bloquear edición del calendario/capturas del ciclo | Implementado parcialmente mediante activación de nuevo ciclo y bloqueos por `CERRADO`. |
| Cierre operativo de captura | Impedir horarios, incidencias y extras del ciclo/quincena | Implementado por estado de ciclo, ventanas de captura y bloqueo por nómina guardada. |
| Cierre financiero de nóminas | Confirmar que las corridas del ciclo estén revisadas/aprobadas/pagadas y sin pendientes | Parcial: existe flujo hasta `PAGADA`, pero no validación agregada por cuatrimestre. |
| Cierre histórico/reportable | Emitir registro formal, conteos, evidencia y reporte final de cuatrimestre | No implementado como módulo moderno; `quarter_closures` parece previsto pero no conectado. |

Si la operación solo necesita impedir nuevas capturas al pasar a un nuevo cuatrimestre, el cierre actual por `academic_cycles.status = 'CERRADO'` puede ser suficiente.

Si la operación necesita un acto formal de cierre con evidencia, autorización, reporte, validación de nóminas pagadas, bitácora específica e irreversibilidad, entonces H10 requiere SPEC funcional.

## 9. Decisiones humanas necesarias

- [ ] ¿`BORRADOR` se usará o queda reservado?
- [ ] ¿`CERRADA` se usará o queda reservado?
- [ ] ¿`PAGADA` es estado final financiero?
- [ ] ¿`CANCELADA` permite nueva corrida?
- [ ] ¿Qué significa cerrar cuatrimestre?
- [ ] ¿Quién puede cerrar cuatrimestre?
- [ ] ¿Se requiere reporte de cierre?
- [ ] ¿Se requiere bloqueo irreversible?

Preguntas adicionales recomendadas:

- [ ] ¿Una nómina `PAGADA` puede cancelarse en algún caso extraordinario?
- [ ] ¿Debe existir un estado posterior a `PAGADA`?
- [ ] ¿El cierre de cuatrimestre debe exigir que todas las quincenas estén `PAGADA`?
- [ ] ¿Debe generarse un folio o acta de cierre?
- [ ] ¿Debe usarse `quarter_closures` o debe reemplazarse por un modelo nuevo?
- [ ] ¿Quién aprueba el cierre: Admin, Dirección, Finanzas o combinación de roles?

## 10. Opciones de solución

### Opción A: Documentar estados no usados como reservados

Acciones:

- Declarar `BORRADOR` y `CERRADA` como estados reservados/no operativos.
- Mantener flujo actual `CALCULADA -> EN_REVISION -> APROBADA -> PAGADA`, con `CANCELADA` para corrección.
- Ajustar documentación y eventualmente ocultar `CERRADA` de filtros si no existe en datos.

Ventaja:

- Menor riesgo.
- No cambia operación productiva actual.
- Evita implementar una máquina de estados innecesaria.

Riesgo:

- Si la operación espera cierre formal, la deuda H10 sigue abierta.

### Opción B: Implementar máquina de estados formal

Acciones:

- Crear SPEC de estados y transiciones.
- Definir permisos por transición.
- Definir si `BORRADOR` y `CERRADA` se activan.
- Añadir pruebas automatizadas H04 para cada transición.

Ventaja:

- Reduce ambigüedad a largo plazo.

Riesgo:

- Alto impacto funcional si se cambia sin consenso operativo.

### Opción C: Crear módulo de cierre de cuatrimestre

Acciones:

- Usar o rediseñar `quarter_closures`.
- Validar nóminas por ciclo.
- Generar reporte/acta de cierre.
- Registrar auditoría.
- Bloquear ciclo de forma explícita.

Ventaja:

- Resuelve H10 de forma formal.

Riesgo:

- Requiere definición humana de reglas, responsables e irreversibilidad.

### Opción D: Solo reforzar UI/documentación

Acciones:

- Mantener backend igual.
- Aclarar en UI/documentación que `PAGADA` es final financiero actual.
- No presentar `BORRADOR` ni `CERRADA` como acciones.

Ventaja:

- Cero impacto en cálculo y datos.

Riesgo:

- No resuelve necesidades futuras de cierre formal si existen.

## 11. Recomendación técnica

Recomendación inmediata:

1. No cambiar código todavía.
2. Aprobar documentalmente que `BORRADOR` y `CERRADA` son estados reservados/no operativos mientras no haya SPEC.
3. Mantener `PAGADA` como estado final financiero actual.
4. Mantener `CANCELADA` como estado terminal de corrección que permite generar una nueva corrida para la misma quincena.
5. Corregir documentación para que Finanzas y Dirección entiendan que `CERRADA` no equivale hoy a cierre de cuatrimestre.

Recomendación para H10:

1. Levantar decisión humana sobre si el cierre técnico actual de `academic_cycles.status='CERRADO'` cubre la operación.
2. Si basta con cierre técnico, cerrar H10 como "documentado/validado" y no implementar módulo nuevo.
3. Si no basta, crear SPEC de cierre de cuatrimestre antes de tocar código.

Posibles ajustes futuros de bajo riesgo, solo después de decisión:

- Alinear el tipo `PayrollRunRow.status` en `payroll.ts` para incluir `EN_REVISION` y `PAGADA`.
- Ocultar `CERRADA` de filtros visuales si no hay datos en ese estado.
- Agregar validación automatizada para impedir que una corrida `BORRADOR` quede atrapada sin transición si llegara por importación/script.

## 12. Próximo paso

Sí se requiere decisión humana antes de implementar.

Siguiente paso recomendado:

1. Reunión corta con Admin/Finanzas/Dirección para responder el checklist de la sección 9.
2. Si se decide no usar `BORRADOR`/`CERRADA`, crear un documento de decisión H09 y cerrar como reservado.
3. Si se decide usar alguno, crear SPEC H09 de máquina de estados.
4. Para H10, decidir si el cierre actual por ciclo es suficiente o si se requiere SPEC de cierre formal de cuatrimestre.

Estado recomendado al cierre de este análisis:

- H09: pendiente de decisión humana; sin cambio funcional recomendado todavía.
- H10: pendiente de decisión humana; cierre técnico existe, cierre formal moderno no confirmado.
