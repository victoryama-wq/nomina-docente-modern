# H20 - Alcance compartido de Nomina para Coordinadores

Fecha: 2026-07-16

## 1. Resumen

Se implemento el alcance compartido read-only de docentes en el preview de Nomina para Coordinadores. El cambio separa la autorizacion del docente de las filas usadas para calcularlo, sin modificar H01, la precision monetaria ni los alcances de edicion operativa.

Estado: cerrado operativo y desplegado en produccion.

## 2. Diagnostico del alcance anterior

Endpoint usado por frontend:

- `POST /api/payroll/preview`, protegido por `payroll.preview` o `payroll.calculate`.

Endpoints relacionados revisados:

- `GET /api/payroll/context`.
- `GET /api/payroll/runs/:id`.
- `POST /api/payroll/runs`, protegido por `payroll.finalize`.
- `GET /api/payroll/runs/:id/export/:kind`, protegido por `payroll.finalize` o `finance.export`.

Causa exacta:

- `listPayrollSchedules()` filtraba `s.coordination_id` con el alcance del actor.
- `listPayrollExtras()` filtraba `eh.coordination_id` con el mismo alcance.
- la lectura de `payroll_lines`, `payroll_schedule_details` y `payroll_extra_details` repetia el filtro por coordinacion.

El filtro ocurria antes del calculo. Por ello se eliminaban horarios, incidencias y extras validos del mismo docente cuando provenian de otra coordinacion.

El filtro no dependia de `schedules.created_by` ni resolvia el OR aprobado con `teachers.created_by`; se basaba en `coordination_id`.

## 3. Implementacion backend

Se agrego `resolvePayrollPreviewTeacherScope()` en `apps/api/src/routes/payroll.ts`.

Para `coordinador` resuelve UUID de docentes cuando:

1. `teachers.created_by = actor.id`; o
2. existe un horario del docente en el ciclo seleccionado cuya coordinacion pertenece a `actorCoordinations[]`.

Despues, horarios, incidencias, extras vivos y snapshots se filtran por el conjunto de `teacher_id`. Esto permite incluir la carga completa entre coordinaciones sin ampliar la capacidad de edicion del actor.

Admin conserva alcance global. Otros roles conservan el alcance previo.

## 4. Calculo y respuesta

Las lineas internas siguen separadas por docente/coordinacion. No se cambio:

- `lineKey`;
- formula de horas base;
- descuentos por faltas o retardos;
- extras de incidencia;
- extras externos;
- redondeo monetario;
- persistencia de snapshots.

Para Coordinador se agrega `teacherSummaries`, que agrupa las lineas autorizadas por docente y suma sus importes mediante los helpers decimales vigentes. El total del docente no se duplica y el total general coincide con la suma de los docentes agregados.

La respuesta conserva coordinaciones de origen en lineas y detalles.

## 5. Seguridad H03

Para actores sin permiso fiscal, la proyeccion publica omite:

- `paymentType`;
- alertas `RFC pendiente`;
- alertas de datos bancarios;
- alertas de correo pendiente;
- alertas de constancia fiscal.

El preview no entrega RFC, banco, cuenta, CLABE, correo fiscal ni constancias.

El Coordinador sigue sin:

- guardar/finalizar Nomina;
- exportar Finanzas;
- cambiar workflow;
- gestionar fiscal;
- editar registros ajenos en modulos operativos.

## 6. Frontend

`PayrollView` usa la proyeccion agrupada solo cuando la API la entrega. Para Coordinador:

- cada docente aparece una sola vez;
- se muestra el total completo;
- el detalle incluye horarios y extras de todas sus coordinaciones autorizadas;
- cada detalle muestra la coordinacion de origen;
- se muestran etiquetas de responsabilidad, participacion y carga compartida;
- no aparece tipo de pago ni controles nuevos de edicion/finalizacion.

Admin mantiene la presentacion previa por linea y no pierde alcance.

## 7. Pruebas agregadas

Backend PostgreSQL real:

- docente creado por Coordinador con horarios en Idiomas y ARQ;
- docente creado por otro Coordinador que imparte en Idiomas y tambien tiene carga ADETUR;
- docente ajeno con carga solo ARQ fuera del alcance;
- detalle completo por coordinacion;
- extra externo de otra coordinacion;
- una sola fila agregada por docente;
- igualdad entre suma por docente y total autorizado;
- ausencia de campos/alertas fiscales;
- Admin global sin regresion;
- finalizacion de Coordinador continua bloqueada por la prueba existente.

Frontend:

- uso de `teacherSummaries` en lugar de lineas repetidas;
- detalles de horarios y extras de varias coordinaciones;
- etiquetas visuales H20.

## 8. Validaciones ejecutadas

| Validacion | Resultado |
|---|---|
| `npm run test:api` | OK, 22/22 |
| `npm run test:web` | OK, 58/58 |
| `npm run typecheck` | OK |
| `npm run test:api:integration` con `nomina_docente_test` en `localhost:5432` | OK, 60/60 |

Observacion: el primer intento de integracion contra `localhost:55432` no conecto porque no habia un listener en ese puerto. No ejecuto logica ni toco una base. La ejecucion valida uso PostgreSQL local en `5432`, con guard exacto `TEST_DB_NAME=nomina_docente_test`.

## 9. Alcance e impacto

- Impacto funcional: consulta mas completa para Coordinador en Nomina.
- Impacto de seguridad: no se amplian permisos; el alcance agregado solo existe despues de elegibilidad por docente.
- Impacto H01: ninguno.
- Impacto BD: ninguno.
- Migraciones: ninguna.
- Produccion: codigo API/frontend desplegado sin cambios de BD.
- Deploy: revision Cloud Run `nomina-api-00051-9s5`, Hosting release `1784228039752000` y version `41bf160c7c3595b6` activos.

## 10. Cierre productivo

- Smoke autenticado de Coordinador aprobado con docentes propios, docentes compartidos y exclusiones fuera de alcance.
- Smoke autenticado de Admin aprobado sin perdida de alcance, lineas ni totales.
- Ausencia de duplicaciones y datos fiscales confirmada.
- Evidencia completa: `docs/auditoria/H20_Deploy_Productivo_Alcance_Compartido_Nomina.md`.
- Commit documental de cierre: `02cb416 docs(h20): record shared payroll scope production deploy`.
- H20 queda cerrado operativo; solo permanece monitoreo normal de regresion.

## 11. Confirmaciones

- No se modifico la formula H01.
- No se modifico precision monetaria.
- No se modifico Cloud SQL ni datos productivos.
- No se ejecutaron migraciones.
- Se desplego exclusivamente codigo API/frontend H20.
- No hubo escrituras de Nomina ni finalizacion de corridas durante el smoke.
- No se agregaron permisos.
- No se concedio acceso fiscal.
- No se cambio propiedad ni edicion de Horarios, Incidencias, Extras o Directorio.
