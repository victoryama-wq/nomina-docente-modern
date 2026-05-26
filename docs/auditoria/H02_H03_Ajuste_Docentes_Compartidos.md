# Ajuste H02/H03 - Docentes Compartidos y Alcance por Capturador

## 1. Contexto

Durante la validacion local con datos reales minimos se confirmo una regla operativa que no debe perderse con H02/H03:

- Un docente puede tener un responsable operativo en Directorio.
- Ese mismo docente puede impartir clases capturadas por otros coordinadores.
- El responsable del docente no debe limitar por si solo la captura de Horarios o Extras.
- Para operacion diaria, el permiso real debe basarse en rol y usuario capturador.
- El catalogo `coordinations` conserva utilidad tecnica/legacy para reportes, importaciones y agrupaciones, pero no debe presentarse al Admin como una lista manual de nombres de personas/combinaciones a elegir.

## 2. Regla aprobada

### Directorio

`teachers.coordination_id` queda como referencia legacy/tecnica del responsable operativo cuando exista.

No representa por si sola el permiso de edicion del docente ni el alcance operativo de todos los horarios o extras del docente.

Para Coordinador/Direccion, la edicion operativa se valida por `teachers.created_by`.

En alta de docente desde un Coordinador:

- no se muestra selector manual de coordinaciones;
- se muestra el responsable operativo como el usuario que captura;
- el backend bloquea datos fiscales si el usuario no tiene `fiscal.manage`;
- la autorizacion de edicion posterior se basa en el usuario capturador.

### Horarios

`schedules.coordination_id` se mantiene como etiqueta tecnica/legacy para reportes y nomina.

Un Coordinador puede seleccionar cualquier docente activo para crear un horario, pero:

- el horario queda capturado por su propio usuario (`schedules.created_by`);
- el responsable operativo mostrado se asigna automaticamente desde el usuario capturador;
- no puede seleccionar manualmente nombres de coordinadores/combinaciones;
- solo puede editar o eliminar horarios capturados por su propio usuario.

Admin conserva acceso global.

Direccion/Subdireccion conserva regla de edicion/eliminacion propia cuando aplique.

### Incidencias

Las incidencias se controlan por el horario capturado.

Para Coordinador/Direccion, solo se pueden editar incidencias de horarios donde `schedules.created_by` corresponda al usuario actor.

### Extras

`extra_hours.coordination_id` se mantiene como etiqueta tecnica/legacy para reportes y nomina.

Un Coordinador puede agregar extras a cualquier docente activo, pero:

- el extra queda capturado por su propio usuario (`extra_hours.captured_by`);
- el responsable operativo mostrado se asigna automaticamente desde el usuario capturador;
- no puede seleccionar manualmente nombres de coordinadores/combinaciones;
- solo puede editar o eliminar extras capturados por su propio usuario (`captured_by`).

Direccion/Subdireccion puede ver el listado de Extras, pero solo modificar los extras que haya capturado.

### Control de Accesos

La pantalla de alta/edicion de usuarios ya no debe mostrar una lista manual de "Coordinaciones asignadas" con nombres de personas o combinaciones.

Para un usuario con rol `coordinador`:

- el acceso se define por rol;
- la operacion se define por usuario capturador;
- si el sistema necesita una etiqueta tecnica para tablas que aun requieren `coordination_id`, el backend puede mantener un ambito personal compatible desde Control de Accesos;
- esa etiqueta no es una decision manual del Admin ni un permiso visible para operar otros usuarios.

## 3. Cambios realizados

### Backend

- `apps/api/src/routes/schedules.ts`
  - se elimino la validacion que obligaba a que el docente perteneciera a la misma coordinacion del horario;
  - la resolucion de etiqueta tecnica de Horarios usa el ambito personal del actor cuando existe;
  - la lista de docentes para Horarios ya no se filtra por `teachers.coordination_id`;
  - la visibilidad y edicion/eliminacion de Horarios para Coordinador valida propiedad del registro (`created_by`);
  - las respuestas de Horarios incluyen `canEdit` calculado por backend.

- `apps/api/src/routes/extras.ts`
  - la resolucion de coordinacion de Extras ya no hereda por defecto la coordinacion responsable del docente para actores operativos;
  - para Coordinador se usa la etiqueta tecnica del actor cuando existe;
  - la visibilidad y edicion/eliminacion se basan en `captured_by`;
  - se conserva la regla de edicion/eliminacion por propiedad (`captured_by`).

- `apps/api/src/routes/incidences.ts`
  - la visibilidad y edicion de Incidencias para Coordinador se basa en el horario capturado por el usuario (`schedules.created_by`).

- `apps/api/src/routes/teachers.ts`
  - la edicion de docentes para Coordinador/Direccion se valida por `teachers.created_by`;
  - el alta de docente ya no depende de que el usuario seleccione una coordinacion manual.

- `apps/api/src/routes/users.ts`
  - el rol Coordinador ya no exige seleccion manual de coordinaciones en el body;
  - el backend mantiene compatibilidad tecnica para tablas que aun usan `coordination_id`, sin exponer esa decision como selector operativo.

### Frontend

- `apps/web/src/views/SchedulesView.vue`
  - el buscador de docentes ya no filtra por la coordinacion responsable del docente;
  - al seleccionar docente ya no se cambia automaticamente la coordinacion del horario a la coordinacion del docente;
  - los botones de editar/eliminar usan `canEdit` calculado por backend.

- `apps/web/src/views/ExtrasView.vue`
  - el responsable operativo mostrado en captura de Extras usa el usuario capturador, no la coordinacion del docente;
  - para Coordinador no se muestra selector manual de coordinaciones.

- `apps/web/src/components/modals/ExtraModal.vue`
  - el selector ya no ofrece "segun docente" como comportamiento implicito;
  - el campo bloqueado muestra el responsable operativo conectado.

- `apps/web/src/components/modals/AccessModal.vue`
  - se elimino el listado manual de "Coordinaciones asignadas";
  - ahora se informa que el alcance operativo de Coordinador se toma del usuario capturador.

- `apps/web/src/components/modals/TeacherModal.vue`
  - el campo visible cambio a "Responsable operativo";
  - para Coordinador queda bloqueado y se asigna automaticamente al usuario que captura.

## 4. Que no se cambio

- No se modifico H01.
- No se cambio formula de nomina.
- No se cambio precision monetaria.
- No se retiro fallback legacy.
- No se activo modo estricto.
- No se hizo deploy.
- No se modifico produccion.
- No se cambiaron migraciones ni seeds productivos.

## 5. Implicacion para migracion local/productiva

Para datos historicos importados desde CSV, `created_by` en `schedules` debe representar al usuario coordinador que capturo o es responsable operativo del horario.

Si los horarios historicos quedan con `created_by` generico de Admin, los coordinadores no podran editar esos registros bajo la nueva regla de propiedad.

Por eso, en la migracion controlada de Horarios, el CSV debe resolver:

- `COORDINADOR` -> `coordinations.id`
- `COORDINADOR` -> `app_users.id` para `created_by` y `updated_by`

Para datos nuevos, `created_by` y `captured_by` son la fuente operativa de edicion. `coordinations.id` queda como etiqueta tecnica para reportes/nomina mientras el modelo historico aun la requiera.

## 6. Pendientes de prueba local

- Validar Coordinador creando horario para docente capturado por otro coordinador.
- Validar que el responsable operativo visible sea el usuario capturador, sin selector manual.
- Validar que Coordinador no edite/elimine horario capturado por otro usuario.
- Validar que Extras permite capturar para cualquier docente.
- Validar que Extras solo permite editar/eliminar registros propios.
- Validar Direccion/Subdireccion viendo Extras y modificando solo propios.
