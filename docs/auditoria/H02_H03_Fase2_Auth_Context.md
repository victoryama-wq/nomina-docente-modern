# H02/H03 Fase 2 - Auth Context Multi-Coordinacion

## 1. Que se implemento

La Fase 2 prepara el backend para resolver el alcance del usuario mediante multiples coordinaciones formales desde `user_coordinations`.

Se implemento:

- tipo `ActorScope`;
- tipo `ActorCoordination`;
- helper backend `apps/api/src/actor-scope.ts`;
- carga formal de coordinaciones por usuario desde `user_coordinations`;
- fallback legacy temporal por texto;
- wrapper compatible para `loadActorCoordination`;
- funciones base para fases posteriores:
  - `loadActorScope`;
  - `getActorCoordinationIds`;
  - `canUseGlobalScope`;
  - `requireOperationalScope`;
  - `assertCoordinationAllowed`;
  - `isOwnRecord`;
  - `selectCompatibleActorCoordination`.

## 2. Nuevos tipos y helpers

`ActorScope` contiene:

- usuario;
- rol;
- permisos;
- marcas de admin y super admin protegido;
- marca de acceso global;
- lista `coordinationIds`;
- lista `coordinations`;
- indicador `usedFallback`;
- `fallbackReason`;
- indicador `requiresOperationalCoordination`.

El helper central vive en:

```text
apps/api/src/actor-scope.ts
```

## 3. Carga de user_coordinations

`loadActorScope(client, actor)` consulta:

```sql
user_coordinations
```

con relacion a:

```sql
coordinations
```

Solo carga coordinaciones con `coordinations.status = 'ACTIVO'`.

La consulta devuelve todas las coordinaciones del usuario, ordenando primero la primaria y despues por nombre.

## 4. Fallback legacy temporal

El fallback legacy se conserva de forma temporal.

Variable preparada:

```text
LEGACY_COORDINATION_FALLBACK_ENABLED
```

Comportamiento:

- si la variable no existe, el fallback queda habilitado;
- si vale `0`, `false`, `no` u `off`, queda deshabilitado;
- solo se usa cuando el usuario no tiene filas formales en `user_coordinations`;
- usa `display_name`, `legacy_username` y `actor.displayName` como candidatos;
- compara contra coordinaciones existentes;
- no crea coordinaciones;
- no inserta filas en `coordinations`;
- registra advertencias en log con el correo, rol, candidatos y coordinacion resuelta.

Eventos de log:

- `LEGACY_COORDINATION_FALLBACK_USED`;
- `LEGACY_COORDINATION_FALLBACK_NOT_FOUND`;
- `H02_COMPAT_COORDINATION_NOT_CREATED`.

## 5. Compatibilidad temporal

El sistema aun tiene modulos que esperan una sola coordinacion del actor.

Para no romper esos modulos, `loadActorCoordination` se mantiene como wrapper compatible:

- internamente usa `loadActorScope`;
- si hay una coordinacion, devuelve esa;
- si hay varias, devuelve la primaria o la primera;
- no crea coordinaciones aunque reciba `createIfMissing = true`;
- conserva un `TODO H02` para migrar cada uso a `actorCoordinations[]` en fases posteriores.

## 6. Que NO se cambio

No se modifico:

- H01;
- formula de nomina;
- frontend funcional;
- rutas operativas de Horarios;
- rutas operativas de Incidencias;
- rutas operativas de Extras;
- rutas operativas de Teachers;
- rutas operativas de Payroll;
- rutas operativas de Reports;
- calendario;
- Apps Script legacy;
- migraciones o seeds de base de datos;
- permisos productivos;
- modo estricto.

No se hizo deploy.

No se retiro el fallback legacy.

## 7. Riesgos pendientes

- `schedules.ts` conserva una funcion local duplicada de resolucion de coordinacion que aun puede crear coordinaciones automaticamente.
- Varios modulos siguen recibiendo `actorCoordination` unico y deben migrarse en Fase 3/4.
- El wrapper compatible devuelve una sola coordinacion cuando un usuario tiene varias; esto es temporal y puede limitar visibilidad hasta migrar los modulos.
- Las reglas de propiedad por `created_by`, `captured_by` o `created_by_user_id` aun no se aplican.
- El fallback legacy puede seguir resolviendo por texto hasta que se complete una quincena operativa sin uso de fallback.

## 8. Proximo paso

La siguiente fase es Fase 3: modulos operativos.

Debe cubrir:

- Horarios;
- Incidencias;
- Extras;
- eliminacion de creacion automatica de coordinaciones en flujos operativos;
- soporte real para multiples coordinaciones;
- validacion por coordinacion asignada;
- validacion de propiedad donde exista autoria confiable.
