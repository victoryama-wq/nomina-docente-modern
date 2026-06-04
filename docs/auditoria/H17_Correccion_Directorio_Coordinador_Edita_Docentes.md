# H17 - Correccion Directorio Coordinador Edita Docentes

Fecha: 2026-06-04

## 1. Problema

En el modulo Directorio, usuarios con rol `coordinador` no podian editar docentes cuando el docente pertenecia a su alcance operativo pero habia sido capturado por otro usuario.

El boton de edicion quedaba deshabilitado en frontend y el backend tambien rechazaba el `PATCH /teachers/:id` por una regla de autoria directa (`created_by`).

## 2. Causa raiz

La regla de Directorio quedo atada a "docentes capturados por el usuario" en vez de "docentes dentro de las coordinaciones asignadas al actor".

Esa regla era demasiado restrictiva para Directorio porque los docentes pueden existir previamente o ser compartidos operativamente entre responsables, mientras que el coordinador solo debe quedar limitado por su alcance operativo.

## 3. Regla funcional aprobada

- Coordinador puede editar datos operativos de docentes dentro de sus coordinaciones asignadas.
- Coordinador no puede editar docentes fuera de su alcance.
- Coordinador no puede mover docentes a una coordinacion fuera de su alcance.
- Coordinador no puede editar datos fiscales o financieros.
- `teachers.manage` no habilita fiscal.
- `fiscal.manage` sigue siendo requisito para datos fiscales.
- Permisos documentales fiscales siguen separados.

## 4. Cambios backend

Archivo: `apps/api/src/routes/teachers.ts`

- `PATCH /teachers/:id` ahora valida al coordinador por `teacher.coordination_id` contra `actorCoordinations`.
- Si el docente esta fuera del alcance del coordinador, responde error controlado.
- Si el coordinador intenta asignar una coordinacion fuera de su alcance, responde error controlado.
- Si el coordinador no tiene coordinacion vinculada, se bloquea la captura/edicion.
- Direccion conserva la regla previa por autoria directa donde aplica.
- Admin conserva alcance global.
- El bloqueo de campos fiscales en `POST /teachers` y `PATCH /teachers/:id` se mantiene antes de procesar la actualizacion.

## 5. Cambios frontend

Archivos:

- `apps/web/src/views/TeachersView.vue`
- `apps/web/src/components/modals/TeacherModal.vue`
- `apps/web/src/utils/teacherAccess.ts`

Cambios:

- El boton Editar se habilita para coordinador cuando el docente pertenece a una coordinacion asignada.
- El boton queda bloqueado cuando el docente esta fuera del alcance operativo.
- El alta/edicion de docente para coordinador conserva o asigna una coordinacion permitida.
- Coordinador con varias coordinaciones puede seleccionar solo coordinaciones dentro de su alcance.
- Coordinador con una coordinacion recibe asignacion automatica al responsable operativo permitido.
- Se retiro el mensaje visual que sugeria que el responsable operativo era simplemente el usuario capturador.
- Campos fiscales siguen ocultos para usuarios sin `fiscal.manage`.

## 6. Campos operativos permitidos

Para coordinador dentro de su alcance:

- nombres;
- apellidos;
- grado;
- categoria;
- ubicacion;
- telefono;
- identificador operativo;
- comentario;
- observacion;
- estatus operativo;
- coordinacion operativa dentro de su alcance.

## 7. Campos fiscales bloqueados

Sin `fiscal.manage`, el backend bloquea intentos de enviar:

- tipo de pago / `paymentType`;
- RFC;
- correo fiscal / `email`;
- banco, cuenta o datos bancarios / `bankDetail`;
- constancias o documentos fiscales por rutas documentales.

## 8. Pruebas agregadas

Backend:

- Coordinador edita datos operativos de docente dentro de su coordinacion aunque no sea el capturador original.
- Coordinador no edita docente fuera de su coordinacion.
- Coordinador multiple edita docente en cualquiera de sus coordinaciones asignadas.
- Coordinador multiple no reasigna a coordinacion fuera de alcance.
- `PATCH /teachers/:id` bloquea `paymentType`, RFC, correo fiscal y banco sin `fiscal.manage`.

Frontend:

- Helper de visibilidad permite edicion de coordinador por alcance operativo.
- Helper bloquea docentes fuera del alcance.
- Multi-coordinador puede editar coordinaciones asignadas y no otras.
- Admin conserva edicion global.
- Direccion conserva regla existente por autoria.
- Campos fiscales siguen modelados por `fiscal.manage`.

## 9. Que NO se toco

- No se modifico base de datos.
- No se crearon migraciones.
- No se tocaron datos reales.
- No se toco produccion.
- No se hizo deploy.
- No se modifico nomina, formula, precision monetaria ni H01.
- No se modifico finanzas, workflow, CSV, cierre de ciclo ni migraciones H05.
- No se otorgaron permisos fiscales nuevos.
- No se modificaron constancias ni documentos fiscales.

## 10. Riesgos residuales

- Los docentes sin `coordination_id` valido no quedan editables por coordinador; deben normalizarse operativamente si aparecen.
- Si una cuenta de coordinador no tiene `user_coordinations` ni fallback valido, la edicion queda bloqueada.
- El fallback legacy sigue en monitoreo por H02 y no fue modificado en H17.

## 11. Recomendacion para deploy

Antes de deploy:

- ejecutar suite completa de pruebas;
- validar manualmente en local con un coordinador de una coordinacion y uno multi-coordinacion;
- confirmar que campos fiscales siguen ocultos y que el backend responde 403 si se fuerzan manualmente.

Si las pruebas pasan, H17 puede desplegarse como correccion funcional acotada de Directorio.
