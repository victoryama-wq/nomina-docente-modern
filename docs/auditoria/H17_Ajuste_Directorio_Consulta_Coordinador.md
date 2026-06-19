# H17 - Ajuste Directorio consulta para Coordinador

Fecha: 2026-06-19

## 1. Contexto

El Directorio conserva la regla de propiedad operativa basada en
`teachers.created_by`: Coordinador solo puede editar docentes capturados por su
usuario. La operacion aprobo una mejora acotada para que cualquier Coordinador
pueda consultar informacion operativa de docentes aunque no los haya capturado.

## 2. Decision funcional

Coordinador puede:

- Ver todos los docentes disponibles en Directorio.
- Abrir un detalle de solo lectura mediante boton de ojo.
- Consultar datos operativos y de contacto como telefono, correo, identificador,
  responsable operativo, categoria, estatus, comentario y observacion.

Coordinador no puede:

- Editar docentes capturados por otro usuario.
- Eliminar docentes.
- Editar datos fiscales.
- Ver RFC, banco/cuenta, tipo de pago o constancias sin permisos fiscales o
  documentales.
- Usar `teachers.manage` como permiso fiscal.

## 3. Cambios implementados

- Backend: la sanitizacion de Directorio para usuarios sin permiso fiscal
  mantiene ocultos `paymentType`, `rfc`, `bankDetail` y constancias, pero permite
  consultar el correo de contacto.
- Frontend: `TeachersView` agrega boton de ojo por docente y modal de detalle
  operativo de solo lectura.
- Frontend: el boton de editar sigue deshabilitado para docentes cuyo
  `createdById` no corresponde al usuario actor, salvo Admin.
- Pruebas: se actualiza helper de visibilidad para modelar el detalle de
  contacto de solo lectura.
- SDD: se documenta el nuevo alcance del Coordinador en Directorio.

## 4. Reglas que permanecen vigentes

- Admin mantiene alcance global.
- `teachers.created_by` sigue siendo la fuente tecnica de capturador para
  edicion por Coordinador.
- Coordinador no edita fiscal.
- RH/Finanzas/Admin siguen siendo responsables de informacion fiscal y
  documentos fiscales.
- Direccion/Subdireccion no reciben permisos fiscales por este ajuste.
- Contador/Contabilidad no reciben permisos fiscales ni operativos de
  Directorio por este ajuste.

## 5. Validaciones esperadas

- Coordinador ve boton de ojo en docentes propios y ajenos.
- Coordinador abre detalle y ve telefono/correo.
- Coordinador no ve RFC/banco/tipo de pago si no tiene `fiscal.view`.
- Coordinador no puede editar docente ajeno.
- Coordinador no puede enviar datos fiscales por API.
- Admin conserva edicion/eliminacion segun reglas existentes.

## 6. Fuera de alcance

- No se cambio nomina.
- No se cambio finanzas.
- No se cambio H01.
- No se cambiaron permisos productivos.
- No se cambiaron migraciones.
- No se hizo deploy.
