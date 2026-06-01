# H09/H10 Fase 4 - Frontend de estados y cierre de ciclo

## 1. Objetivo

Alinear la interfaz Vue con las reglas H09/H10 aprobadas para estados de ciclo, cierre controlado de cuatrimestre y estados financieros terminales, sin modificar backend funcional, base de datos ni reglas de nomina.

## 2. Cambios implementados

- `PLANEACION` se muestra como `Planeacion/Borrador` en selectores y vistas operativas.
- `CERRADO` se muestra como estado irreversible y de consulta historica.
- Calendario agrega control de cierre H10 usando `POST /calendar/cycles/:id/close`.
- La activacion manual de ciclo queda visible como compatibilidad administrativa legacy.
- Horarios permite captura en `PLANEACION` y `ACTIVO`, pero bloquea `CERRADO`.
- Incidencias bloquea captura en `PLANEACION` y `CERRADO`.
- Extras bloquea captura en `PLANEACION` y `CERRADO`.
- Nomina bloquea calculo/guardado en `PLANEACION` y `CERRADO`; el historico guardado queda consultable.
- Finanzas no muestra cancelacion para corridas `PAGADA`.

## 3. CalendarView

Se agrego un panel Admin de cierre controlado H10. El flujo pide seleccionar un ciclo siguiente en `Planeacion/Borrador`, permite observacion de cierre y confirma la accion irreversible antes de llamar al backend.

La activacion manual existente se conserva y se marca como compatibilidad legacy/admin, separada del cierre H10 controlado.

## 4. SchedulesView

Horarios queda habilitado para preparar carga en ciclos `PLANEACION`. Si el ciclo esta `CERRADO`, la captura, edicion y eliminacion quedan bloqueadas visualmente.

## 5. IncidencesView

Incidencias muestra aviso de bloqueo para ciclos en `PLANEACION` y `CERRADO`. La edicion solo queda habilitada con ciclo `ACTIVO` y ventana de captura abierta.

## 6. ExtrasView

Extras muestra aviso de bloqueo para ciclos en `PLANEACION` y `CERRADO`. La captura/edicion/eliminacion solo queda habilitada con ciclo `ACTIVO`, ventana abierta y propiedad del registro segun backend.

## 7. PayrollView

Nomina preview y guardado quedan bloqueados cuando el ciclo no esta `ACTIVO`. Para ciclos cerrados se conserva consulta de historicos existentes sin recalcular ni guardar.

## 8. FinanceReportsView

Se mantiene la regla H09: `PAGADA` es terminal. La UI solo permite cancelacion para `CALCULADA`, `EN_REVISION` o `APROBADA`, y nunca para `PAGADA`.

## 9. Pruebas agregadas

Se ampliaron helpers frontend para cubrir:

- etiqueta `Planeacion/Borrador`;
- Horarios permitido en `PLANEACION`;
- Incidencias, Extras y Nomina bloqueados en `PLANEACION`;
- bloqueo general en `CERRADO`;
- cancelacion financiera no disponible en `PAGADA`.

## 10. Fuera de alcance

- No se modifico base de datos.
- No se crearon migraciones.
- No se modifico formula de nomina.
- No se modifico precision monetaria H01.
- No se modifico backend funcional H02/H03/H05.
- No se ejecuto deploy.
- No se toco produccion.

## 11. Riesgos pendientes

- Validar manualmente el cierre controlado con un ciclo activo completo, todas sus quincenas `PAGADA` y un ciclo siguiente con horarios.
- Revisar si se desea retirar la activacion manual legacy en una fase futura.
- H04-F6 Playwright queda como validacion e2e opcional posterior.

## 12. Siguiente paso

Ejecutar validaciones automatizadas y prueba manual local/revision del flujo Admin:

1. Crear o seleccionar ciclo `PLANEACION`.
2. Confirmar que Horarios permite captura.
3. Confirmar que Incidencias, Extras y Nomina bloquean captura/calculo.
4. Con ciclo activo con quincenas `PAGADA`, ejecutar cierre controlado H10.
5. Confirmar que el ciclo anterior queda `CERRADO` y el siguiente queda `ACTIVO`.
