# H09/H10 Fase 2 - Ciclo PLANEACION para Horarios

Fecha: 2026-06-01

## 1. Contexto

H09/H10 separa el estado financiero de una corrida de nomina del estado operativo de un ciclo academico. La decision aprobada para esta fase es usar `academic_cycles.status = 'PLANEACION'` como borrador operativo del siguiente ciclo, sin crear un enum nuevo y sin usar `payroll_runs.status = 'BORRADOR'`.

## 2. Que se implemento

- Se mantuvo Horarios habilitado para ciclos `PLANEACION` y `ACTIVO`.
- Se reforzo que Horarios siga bloqueado en ciclos `CERRADO`.
- Se ajusto la editabilidad calculada para que Horarios no aparezca editable en ciclos cerrados.
- Se mantuvo el bloqueo de Incidencias cuando el ciclo no esta `ACTIVO`.
- Se mantuvo el bloqueo de Extras cuando el ciclo no esta `ACTIVO` y se agrego bloqueo explicito para eliminacion.
- Se mantuvo el bloqueo de Nomina preview/guardado cuando el ciclo no esta `ACTIVO`.
- Se agregaron ciclos sinteticos H09 de prueba para `PLANEACION` y `CERRADO`.
- Se agregaron pruebas de integracion para proteger estas reglas.

## 3. Cambios en Horarios

`apps/api/src/routes/schedules.ts` ya resolvia ciclos de trabajo con `ACTIVO` y `PLANEACION`. En esta fase se cubrio explicitamente con pruebas que:

- Admin puede crear horarios en ciclo `PLANEACION`.
- Coordinador puede crear horarios en `PLANEACION`, respetando su alcance/capturador H02.
- Coordinador puede editar horarios propios en `PLANEACION`.
- Ciclo `CERRADO` bloquea creacion, edicion y eliminacion de horarios.

No se cambio la regla de maximo de horas por categoria (`V`, `M`, `N`) ni la regla de docentes compartidos/capturador.

## 4. Cambios en Incidencias

`apps/api/src/routes/incidences.ts` conserva la regla de que solo se capturan incidencias cuando el ciclo esta `ACTIVO`.

La respuesta para ciclos no activos queda con mensaje claro:

```text
Las incidencias solo pueden capturarse cuando el ciclo esta activo.
```

No se habilito captura anticipada de incidencias en `PLANEACION`.

## 5. Cambios en Extras

`apps/api/src/routes/extras.ts` conserva la regla de que solo se capturan o modifican extras cuando el ciclo esta `ACTIVO`.

Se agrego bloqueo explicito para eliminar extras si el ciclo no esta `ACTIVO`, cubriendo tambien datos historicos o sinteticos que pudieran existir en `PLANEACION`.

Mensajes relevantes:

```text
Los extras solo pueden capturarse cuando el ciclo esta activo.
Los extras solo pueden modificarse cuando el ciclo esta activo.
Los extras solo pueden eliminarse cuando el ciclo esta activo.
```

No se cambio la regla H02: Coordinador y Direccion/Subdireccion solo modifican extras capturados por su usuario cuando aplica.

## 6. Cambios en Nomina

`apps/api/src/routes/payroll.ts` conserva la regla de que la nomina solo se calcula sobre ciclo `ACTIVO`.

El mismo bloqueo protege:

- preview de nomina;
- guardado de corrida.

Mensaje:

```text
La nomina solo puede calcularse cuando el ciclo esta activo.
```

No se modifico formula, precision monetaria ni helpers H01.

## 7. Seed y pruebas H04

Se amplio `apps/api/src/test/db/seed-h04-minimal.sql` con datos sinteticos:

- ciclo `H09 QA Planeacion 2026` en estado `PLANEACION`;
- quincena sintetica asociada a ese ciclo para validar bloqueos;
- horario sintetico en ciclo `PLANEACION`;
- ciclo `H09 QA Cerrado 2026` en estado `CERRADO`;
- horario sintetico en ciclo `CERRADO`.

Pruebas agregadas:

- Horarios en `PLANEACION` permitidos para Admin.
- Horarios en `PLANEACION` permitidos para Coordinador dentro de reglas H02.
- Horarios en `CERRADO` bloqueados.
- Incidencias en `PLANEACION` bloqueadas.
- Extras crear/modificar/eliminar en `PLANEACION` bloqueados.
- Nomina preview y guardado en `PLANEACION` bloqueados.

## 8. Que NO se cambio

- No se creo migracion `013`.
- No se modifico `cycle_status`.
- No se agrego enum `BORRADOR`.
- No se modifico `payroll_run_status`.
- No se uso `payroll_runs.BORRADOR`.
- No se uso `payroll_runs.CERRADA`.
- No se modifico `quarter_closures`.
- No se implemento cierre de cuatrimestre.
- No se modifico frontend.
- No se modifico H01 ni la formula de nomina.
- No se modifico H03 fiscal/documentos/finanzas.
- No se toco produccion.
- No se hizo deploy.

## 9. Riesgos pendientes

- La UI aun debe exponer claramente ciclo `PLANEACION` como preparacion/borrador y bloquear visualmente Incidencias, Extras y Nomina.
- El cierre formal de cuatrimestre sigue pendiente para H09/H10 Fase 3.
- `PLANEACION` puede tener quincenas configuradas para preparar calendario, pero eso no habilita captura operativa fuera de Horarios.
- Los estados `BORRADOR` y `CERRADA` de `payroll_runs` siguen reservados/no operativos.

## 10. Proximo paso

Implementar H09/H10 Fase 3: cierre controlado de ciclo/cuatrimestre usando `academic_cycles`, `quarter_closures` actual y evidencia detallada en `audit_log`, sin migracion para la primera version.
