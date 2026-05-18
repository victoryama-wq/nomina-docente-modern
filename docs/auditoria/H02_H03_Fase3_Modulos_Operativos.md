# H02/H03 Fase 3 - Modulos Operativos

## 1. Que se implemento

La Fase 3 aplica el contexto `ActorScope` multi-coordinacion en los modulos operativos backend:

- Horarios;
- Incidencias;
- Extras;
- Teachers / Directorio operativo.

Esta fase no activa modo estricto global y mantiene el fallback legacy temporal definido en Fase 2.

## 2. Cambios en Horarios

Se elimino la dependencia funcional de la resolucion local por texto.

Cambios aplicados:

- Se reemplazo la resolucion de coordinacion local por `loadActorScope`.
- Se dejo de crear coordinaciones automaticamente desde horarios.
- Se valida `coordinationId` recibido contra coordinaciones existentes y activas.
- Coordinador puede operar horarios dentro de cualquiera de sus coordinaciones asignadas.
- Direccion puede operar horarios propios usando `schedules.created_by`.
- Admin conserva alcance global.
- El contexto de horarios devuelve coordinaciones existentes/asignadas, sin insertar nuevas.

## 3. Cambios en Incidencias

Se aplica alcance por coordinacion del horario.

Cambios aplicados:

- Se reemplazo `actorCoordination` unico por `ActorScope`.
- La visibilidad de incidencias se filtra por lista de coordinaciones asignadas.
- La edicion se valida por `schedules.coordination_id`.
- Direccion puede operar incidencias asociadas a horarios propios mediante `schedules.created_by`.
- No se usa `schedule_incidences.updated_by` como autoria original.

Pendiente:

- Si operacion requiere regla de propiedad directa en incidencias, se debe agregar autoria original en una fase posterior.

## 4. Cambios en Extras

Se aplica alcance por coordinacion y propiedad.

Cambios aplicados:

- Se reemplazo la resolucion por coordinacion unica con `ActorScope`.
- Se elimino creacion automatica de coordinaciones desde extras.
- Coordinador puede listar/capturar dentro de sus coordinaciones asignadas.
- Coordinador solo puede editar o eliminar extras propios.
- La propiedad se valida con `extra_hours.captured_by`.
- Direccion puede editar/eliminar extras propios.
- Admin conserva alcance global.

## 5. Cambios en Teachers / Directorio

Se mantiene la decision aprobada:

- `GET /teachers` sigue trayendo todos los docentes.

Cambios aplicados:

- Se elimino creacion automatica de coordinaciones desde Directorio.
- La coordinacion indicada debe existir y estar activa.
- Coordinador opera contra sus coordinaciones asignadas.
- Direccion puede modificar docentes propios usando `teachers.created_by`.
- Se removio `teachers.manage` de rutas fiscales/documentales evidentes para evitar que Coordinador herede gestion fiscal por Directorio.

Nota:

- La separacion completa de Fiscal/Finanzas queda para Fase 4.

## 6. Creacion automatica de coordinaciones eliminada

Se elimino o desactivo la creacion automatica desde:

- `schedules.ts`;
- `extras.ts`;
- `teachers.ts`.

Los flujos operativos ya no ejecutan:

```sql
INSERT INTO coordinations
```

para resolver permisos o capturas.

## 7. Compatibilidad temporal restante

Permanece:

- `loadActorCoordination` en `academic-context.ts` como wrapper compatible;
- respuesta `actorCoordination` en algunos contextos para no romper frontend existente;
- fallback legacy temporal en `loadActorScope`.

El wrapper no crea coordinaciones y conserva `TODO H02` para migracion a `actorCoordinations[]`.

## 8. Que NO se cambio

No se modifico:

- H01;
- formula de nomina;
- precision monetaria;
- frontend funcional;
- Payroll / Nomina preview;
- Reports / Finanzas;
- workflow financiero;
- calendario operativo;
- Apps Script legacy;
- seeds o migraciones productivas;
- permisos productivos;
- modo estricto.

No se hizo deploy.

No se retiro fallback legacy.

## 9. Riesgos pendientes

- Algunos contextos aun devuelven `actorCoordination` unico para compatibilidad de frontend.
- Fiscal/Finanzas todavia debe separarse formalmente en Fase 4.
- `schedule_incidences` no tiene autoria original; solo se usa coordinacion del horario.
- Direccion usa propiedad por `created_by` / `captured_by` donde existe; si se requiere `created_by_user_id`, debe migrarse despues.
- El fallback legacy puede seguir resolviendo por texto hasta completar la validacion operativa definida.

## 10. Proximo paso

Fase 4: Fiscal / Finanzas / Nomina preview.

Debe cubrir:

- permisos fiscales separados;
- permisos documentales;
- `finance.workflow`;
- `finance.export`;
- `payroll.preview`;
- preview de nomina para Coordinador por `user_coordinations`;
- separacion definitiva de `finance.view` y `teachers.manage` para datos sensibles.
