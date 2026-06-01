# SPEC H02/H03 - Usuario, Coordinación y Permisos

## 1. Resumen ejecutivo

Esta SPEC documenta la implementación futura para corregir los riesgos H02 y H03 del sistema Nómina Docente.

H02 identifica que la coordinación del usuario se resuelve actualmente por coincidencia textual entre campos como `app_users.display_name`, `app_users.legacy_username` o `actor.displayName` contra `coordinations.name`. Esa estrategia es frágil porque un cambio de nombre visible, un duplicado, un error ortográfico o una diferencia histórica puede otorgar o negar acceso operativo de forma incorrecta. La solución aprobada es usar una relación formal en PostgreSQL mediante `user_coordinations`.

H03 identifica que `finance.view` está sobrecargado y puede habilitar acciones que no corresponden solamente a consulta financiera, incluyendo edición fiscal, gestión de constancias y flujo financiero de nómina. La solución aprobada es separar permisos fiscales, documentales, financieros, de workflow y de nómina.

Las decisiones humanas ya aprobadas se incorporan como requisitos obligatorios: Subdirección usa el rol técnico `direccion`, Contabilidad es equivalente a Contador, Finanzas puede aprobar, marcar pagada y cancelar nómina mediante `finance.workflow`, y la propiedad de registros se valida con `created_by_user_id` o con el campo equivalente que exista en la tabla actual.

La revisión técnica previa a aprobación detectó que la SPEC es implementable, pero requiere reconocer el estado real del esquema y del código: hoy existen campos como `created_by`, `captured_by`, `calculated_by`, `approved_by`, `reviewed_by`, `paid_by`, `status_updated_by` y `actor_user_id`; además, varios permisos objetivo todavía no existen y `finance.view` sigue sobrecargado. Esta versión incorpora esos ajustes como puntos obligatorios para diseño técnico.

Esta SPEC no implementa cambios. Solo documenta el diseño objetivo, fases de implementación, pruebas, rollback y criterios de aceptación. El único pendiente antes de implementar es que Admin revise y apruebe esta SPEC técnica.

## 2. Objetivo

El objetivo es corregir H02/H03 sin modificar reglas de negocio de nómina ni tocar el cierre H01 de precisión monetaria.

Objetivos específicos:

- Resolver la coordinación del usuario mediante una relación formal en base de datos.
- Sustituir la dependencia principal de coincidencias por texto (`display_name`, `legacy_username`, `actor.displayName`) por `user_coordinations`.
- Separar permisos fiscales, documentales, financieros, de workflow y de nómina.
- Mantener la operación académica filtrada por coordinación asignada.
- Permitir que Coordinador vea Nómina vigente / preview en solo lectura y solo para sus coordinaciones asignadas.
- Mantener a RH y Finanzas como dueños funcionales del expediente fiscal.
- Mantener a Admin y Finanzas como responsables de estados financieros de nómina.
- Respetar que Contador y Contabilidad solo exportan con lectura mínima necesaria.
- Respetar que Dirección/Subdirección pueden ver reportes agregados y detalle por docente sin datos fiscales sensibles.
- Evitar creación automática de coordinaciones desde flujos operativos.
- Mantener fallback legacy temporal solo como contingencia controlada.

## 3. Alcance

El alcance funcional y técnico de la futura implementación incluye:

- Crear el modelo `user_coordinations`.
- Actualizar Control de Accesos para asignar una o varias coordinaciones a usuarios.
- Actualizar la resolución de coordinación en backend.
- Eliminar como mecanismo principal la coincidencia textual por nombre visible o usuario legado.
- Mantener fallback legacy temporal mientras se valida una quincena operativa completa.
- Evitar creación automática de coordinaciones en Horarios, Incidencias, Extras y Nómina.
- Separar permisos fiscales y financieros.
- Ajustar permisos de roles técnicos existentes.
- Ajustar Nómina preview para Coordinador en modo solo lectura.
- Ajustar Horarios, Incidencias, Extras, Directorio, Expediente Fiscal y Finanzas conforme a la matriz rol-acción.
- Agregar pruebas por rol, coordinación, permiso y propiedad del registro.
- Registrar auditoría/logs para cambios de asignación, uso de fallback e intentos no autorizados.

Arquitectura asumida:

- Frontend: Vue 3 + TypeScript.
- Backend: Fastify + TypeScript.
- Autenticación: Firebase Auth.
- Hosting: Firebase Hosting.
- API: Cloud Run.
- Base de datos: PostgreSQL / Cloud SQL.
- Roles y permisos almacenados en PostgreSQL.
- Sistema legacy Apps Script presente, pero fuera de alcance.

## 4. Fuera de alcance

Esta SPEC no contempla:

- Cambiar fórmula de nómina.
- Modificar precisión monetaria H01.
- Cambiar calendario operativo.
- Retirar Apps Script legado.
- Refactorizar módulos completos.
- Cambiar diseño visual general.
- Crear cierre de cuatrimestre.
- Resolver H04-H14 salvo lo estrictamente relacionado con H02/H03.
- Eliminar fallback legacy en esta primera implementación.
- Cambiar estructura de datos histórica no relacionada.
- Cambiar flujo operativo de captura de quincena.
- Cambiar lógica de tabuladores, incidencias, extras o reportes monetarios.

## 5. Modelo de datos objetivo

### Tabla `user_coordinations`

Modelo PostgreSQL propuesto:

```sql
CREATE TABLE user_coordinations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id),
  coordination_id UUID NOT NULL REFERENCES coordinations(id),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL REFERENCES app_users(id),
  updated_at TIMESTAMPTZ NULL,
  updated_by_user_id UUID NULL REFERENCES app_users(id),
  UNIQUE(user_id, coordination_id)
);
```

Índices recomendados:

```sql
CREATE INDEX idx_user_coordinations_user_id
  ON user_coordinations(user_id);

CREATE INDEX idx_user_coordinations_coordination_id
  ON user_coordinations(coordination_id);

CREATE UNIQUE INDEX idx_user_coordinations_one_primary_per_user
  ON user_coordinations(user_id)
  WHERE is_primary = true;
```

El índice parcial de coordinación primaria aplica si operación confirma que una coordinación principal tiene utilidad operativa. Si no se usa en interfaz o reportes, puede omitirse en la primera migración.

### Uso de campos existentes

- `app_users.display_name`: queda como dato visual del usuario.
- `app_users.legacy_username`: queda como referencia histórica y apoyo temporal de migración/fallback.
- `coordinations.name`: se usa para mostrar y validar catálogos, pero no como fuente principal de autorización por coincidencia textual.
- `created_by_user_id`: campo oficial objetivo para propiedad/autoría del registro.

### Propiedad del registro

`created_by_user_id` representa el nombre objetivo de propiedad/autoría. La implementación no debe asumir que este campo ya existe en todas las tablas; debe revisar cada tabla y decidir si usa un equivalente existente, agrega un campo nuevo o migra datos.

`created_by_user_id` o su equivalente actual debe usarse para reglas como:

- Editar solo información propia.
- Eliminar solo información propia.
- Editar/eliminar extras propios.
- Aplicar restricciones de Dirección/Subdirección cuando la regla sea por propiedad.

Tablas que requieren revisión durante implementación:

| Módulo | Requiere autoría/propiedad | Uso esperado |
|---|---:|---|
| Horarios | Sí, si Dirección/Subdirección editan/eliminan solo propios | Propiedad de captura |
| Incidencias | Sí, directa o heredada del horario | Propiedad de captura o coordinación del horario |
| Extras | Sí | Editar/eliminar solo propios salvo Admin/permiso superior |
| Directorio | Sí, si aplica edición/eliminación propia | Propiedad de alta/edición operativa |
| Nómina | No para cálculo; sí para auditoría de corrida | Autoría de guardado/cambio de estado |
| User coordinations | Sí | Auditoría de asignaciones |

Si alguna tabla no tiene `created_by_user_id`, la implementación debe agregarlo mediante migración controlada antes de activar reglas de propiedad en ese módulo.

### Mapeo de autoría/propiedad actual vs objetivo

| Tabla | Campo actual | Significado actual | Campo objetivo | Decisión SPEC | Requiere migración |
|---|---|---|---|---|---|
| `schedules` | `created_by` | Usuario que creó el horario | `created_by_user_id` | Definir en diseño técnico si se renombra, se mantiene como equivalente o se agrega campo nuevo | Por definir |
| `schedule_incidences` | `updated_by` | Último usuario que actualizó la incidencia | `created_by_user_id` | Falta autoría original; si se requiere regla de propiedad, agregar campo nuevo o heredar propiedad desde `schedules.created_by` | Sí, si aplica regla "propio" |
| `extra_hours` | `captured_by` | Usuario que capturó el extra | `created_by_user_id` | Puede usarse como equivalente funcional si apunta al usuario real creador | No necesariamente |
| `teachers` | `created_by` | Usuario que creó el docente | `created_by_user_id` | Definir si se mantiene, se migra o se agrega campo nuevo | Por definir |
| `payroll_runs` | `calculated_by`, `approved_by`, `reviewed_by`, `paid_by`, `status_updated_by` | Auditoría de cálculo y workflow financiero | No requiere `created_by_user_id` para cálculo | Mantener como auditoría de workflow; no usar para propiedad académica | No para H02/H03 |
| `audit_log` | `actor_user_id` | Usuario que ejecutó la acción auditada | `actor_user_id` | Correcto para bitácora; no sustituir por `created_by_user_id` | No |

Regla técnica:

- La implementación no debe asumir que `created_by_user_id` ya existe en todas las tablas.
- Antes de activar reglas por propiedad se debe decidir por tabla si se usa equivalente existente, se agrega campo nuevo, se migran datos o se documenta una limitación.
- No se debe activar una regla "propio" sobre una tabla sin autoría confiable.

## 6. Migración de datos

La migración debe ejecutarse de forma controlada y reversible, sin activar modo estricto hasta validar datos.

Estrategia general:

1. Crear tabla `user_coordinations`.
2. Convertir la tabla operativa inicial a formato normalizado.
3. Validar `coordination_name` contra el catálogo real `coordinations`.
4. No crear coordinación `"Todas / Global"`.
5. No insertar `"No requiere coordinación operativa"` como coordinación.
6. Crear una fila por cada coordinación múltiple.
7. Reportar usuarios sin coordinación cuando su rol requiera operación académica.
8. Reportar coordinaciones inexistentes.
9. Permitir corrección manual antes de activar modo estricto.
10. Mantener fallback temporal durante transición.

### Migración de `user_coordinations`

- Crear tabla `user_coordinations`.
- Normalizar asignaciones iniciales.
- Validar nombres contra catálogo `coordinations`.
- Soportar múltiples coordinaciones por usuario desde el primer corte.
- No crear coordinación `"Todas / Global"`.
- No insertar `"No requiere coordinación operativa"` como coordinación.
- No activar modo estricto hasta validar asignaciones.

### Migración de autoría/propiedad

- Revisar campos actuales por tabla: `created_by`, `captured_by`, `updated_by`, `calculated_by`, `approved_by`, `reviewed_by`, `paid_by`, `status_updated_by` y `actor_user_id`.
- Mapear campos existentes contra el concepto objetivo `created_by_user_id`.
- Agregar `created_by_user_id` solo donde sea necesario para reglas de propiedad.
- No perder información histórica.
- No reemplazar auditorías de workflow de nómina por un campo genérico.
- No activar reglas de propiedad hasta que los datos estén completos y verificados.

### Asignaciones iniciales entregadas por operación

| Usuario | Rol operativo | Coordinación asignada |
|---|---|---|
| victor.yama@tecplayacar.edu.mx | Admin | Todas / Global |
| alejandra.castellanos@tecplayacar.edu.mx | Coordinador | Rectoría |
| cristhian.alvarado@tecplayacar.edu.mx | Coordinador | Coordinación de Investigación |
| david.velazquez@tecplayacar.edu.mx | Finanzas | No requiere coordinación operativa |
| elsa.garcia@tecplayacar.edu.mx | Subdirección | Subdirección de vinculación y calidad |
| eslivet.aguilar@tecplayacar.edu.mx | Coordinador | ADETUR, ARQ, SISCOM, DIGRAF |
| jesus.aguilar@tecplayacar.edu.mx | Coordinador | Servicio Social |
| josue.delgado@tecplayacar.edu.mx | Coordinador | Prácticas profesionales |
| leonardo.sayas@tecplayacar.edu.mx | Coordinador | ADEM, CINTER, CONPUB |
| lidia.medina@tecplayacar.edu.mx | Coordinador | Idiomas |
| mario.medina@tecplayacar.edu.mx | Coordinador | Coordinación General |
| merit.bazan@tecplayacar.edu.mx | Coordinador | PED, MAESTRIAS |
| noadia.gonzalez@tecplayacar.edu.mx | Dirección | Todas / Global |
| oriana.nah@tecplayacar.edu.mx | Coordinador | ENF, NUT, ESPECIALIDAD, MDH |
| roxana.landero@tecplayacar.edu.mx | Coordinador | Simulación Clínica |
| zulma.martinez@tecplayacar.edu.mx | Coordinador | DE, CRIMI, MERC |
| zuly.carrillo@tecplayacar.edu.mx | RH | Recursos Humanos |

### Formato normalizado esperado

| email | rol_tecnico | coordination_name | scope_type | requiere_revision | observaciones |
|---|---|---|---|---|---|
| victor.yama@tecplayacar.edu.mx | admin | NULL | global | No | Admin global; no insertar `"Todas / Global"` |
| alejandra.castellanos@tecplayacar.edu.mx | coordinador | Rectoría | coordination | Por validar | Validar contra `coordinations` |
| cristhian.alvarado@tecplayacar.edu.mx | coordinador | Coordinación de Investigación | coordination | Por validar | Validar contra `coordinations` |
| david.velazquez@tecplayacar.edu.mx | finanzas | NULL | no_operational_coordination | No | No insertar coordinación operativa |
| elsa.garcia@tecplayacar.edu.mx | direccion | Subdirección de vinculación y calidad | coordination | Por validar | Subdirección usa rol técnico `direccion` |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | ADETUR | coordination | Por validar | Fila normalizada 1 de 4 |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | ARQ | coordination | Por validar | Fila normalizada 2 de 4 |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | SISCOM | coordination | Por validar | Fila normalizada 3 de 4 |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | DIGRAF | coordination | Por validar | Fila normalizada 4 de 4 |
| jesus.aguilar@tecplayacar.edu.mx | coordinador | Servicio Social | coordination | Por validar | Validar contra `coordinations` |
| josue.delgado@tecplayacar.edu.mx | coordinador | Prácticas profesionales | coordination | Por validar | Validar contra `coordinations` |
| leonardo.sayas@tecplayacar.edu.mx | coordinador | ADEM | coordination | Por validar | Fila normalizada 1 de 3 |
| leonardo.sayas@tecplayacar.edu.mx | coordinador | CINTER | coordination | Por validar | Fila normalizada 2 de 3 |
| leonardo.sayas@tecplayacar.edu.mx | coordinador | CONPUB | coordination | Por validar | Fila normalizada 3 de 3 |
| lidia.medina@tecplayacar.edu.mx | coordinador | Idiomas | coordination | Por validar | Validar contra `coordinations` |
| mario.medina@tecplayacar.edu.mx | coordinador | Coordinación General | coordination | Por validar | Validar contra `coordinations` |
| merit.bazan@tecplayacar.edu.mx | coordinador | PED | coordination | Por validar | Fila normalizada 1 de 2 |
| merit.bazan@tecplayacar.edu.mx | coordinador | MAESTRIAS | coordination | Por validar | Fila normalizada 2 de 2 |
| noadia.gonzalez@tecplayacar.edu.mx | direccion | NULL | global | No | Dirección global; no insertar `"Todas / Global"` |
| oriana.nah@tecplayacar.edu.mx | coordinador | ENF | coordination | Por validar | Fila normalizada 1 de 4 |
| oriana.nah@tecplayacar.edu.mx | coordinador | NUT | coordination | Por validar | Fila normalizada 2 de 4 |
| oriana.nah@tecplayacar.edu.mx | coordinador | ESPECIALIDAD | coordination | Por validar | Fila normalizada 3 de 4 |
| oriana.nah@tecplayacar.edu.mx | coordinador | MDH | coordination | Por validar | Fila normalizada 4 de 4 |
| roxana.landero@tecplayacar.edu.mx | coordinador | Simulación Clínica | coordination | Por validar | Validar contra `coordinations` |
| zulma.martinez@tecplayacar.edu.mx | coordinador | DE | coordination | Por validar | Fila normalizada 1 de 3 |
| zulma.martinez@tecplayacar.edu.mx | coordinador | CRIMI | coordination | Por validar | Fila normalizada 2 de 3 |
| zulma.martinez@tecplayacar.edu.mx | coordinador | MERC | coordination | Por validar | Fila normalizada 3 de 3 |
| zuly.carrillo@tecplayacar.edu.mx | rh | NULL | no_operational_coordination | No | RH no requiere coordinación operativa |

### Casos de migración

| Caso | Acción |
|---|---|
| Usuario coincide exactamente con coordinación | Insertar relación `user_coordinations` después de validar FK |
| Usuario no coincide | Reportar para revisión; no inferir por texto |
| Coordinación no existe | Marcar `requiere_revision`; no crear automáticamente |
| Usuario con múltiples coordinaciones | Crear una fila por coordinación |
| Usuario Admin global | No insertar `"Todas / Global"`; resolver por rol/permisos |
| Usuario Dirección global | No insertar `"Todas / Global"`; resolver alcance global por rol/permisos |
| Usuario Finanzas | No insertar coordinación operativa; resolver por permisos financieros/fiscales |
| Usuario RH | No insertar coordinación operativa salvo decisión futura |
| Usuario Coordinador | Debe tener al menos una fila `user_coordinations` validada |

## 7. Resolución de coordinación objetivo

Orden de resolución requerido:

1. Si el usuario es `admin` o super admin: acceso global.
2. Si el rol tiene acceso global explícito para la acción: aplicar permisos globales.
3. Si la acción requiere alcance operativo: consultar `user_coordinations`.
4. Si el usuario requiere captura operativa y no tiene coordinación asignada: bloquear captura operativa y mostrar mensaje para solicitar configuración al Admin.
5. Si fallback legacy está habilitado y no existe relación formal: usarlo solo como contingencia temporal y registrar advertencia/log.
6. No crear coordinación automáticamente desde Horarios, Extras, Incidencias o Nómina.

### Resultado esperado de resolución

| Tipo de usuario | Resolución esperada |
|---|---|
| Admin | Global por rol/permisos |
| Finanzas | Fiscal/finanzas/workflow por permisos, sin coordinación operativa |
| RH | Fiscal por permisos, sin coordinación operativa |
| Coordinador | Coordinaciones asignadas por `user_coordinations` |
| Dirección global | Reportes globales por rol/permisos; operación propia donde aplique |
| Dirección con coordinación asignada | Operación según asignación y propiedad |
| Usuario sin coordinación requerida | Bloqueo de captura operativa |

## 8. Permisos objetivo

Permisos fiscales:

- `fiscal.view`: ver expediente fiscal.
- `fiscal.manage`: editar RFC, correo, banco y tipo de pago.
- `fiscal.document.view`: ver o descargar constancia fiscal.
- `fiscal.document.manage`: subir o reemplazar constancia fiscal.

Permisos financieros:

- `finance.view`: ver reportes financieros.
- `finance.export`: exportar CSV/PDF financieros.
- `finance.workflow`: aprobar, marcar pagada, cancelar y cambiar estados financieros de nómina.

Permisos de nómina:

- `payroll.preview`: ver cálculo vivo sin guardar.
- `payroll.view`: ver contexto de nómina o nóminas guardadas, según rol.
- `payroll.finalize`: guardar/cancelar corrida si aplica al rol autorizado.

### Estado actual de permisos y acción requerida

| Permiso objetivo | Estado actual | Acción requerida |
|---|---|---|
| `fiscal.view` | No existe | Crear permiso y asignarlo a Admin, RH y Finanzas según matriz |
| `fiscal.manage` | Existe, pero actualmente está sobrecargado | Mantener para edición fiscal; retirar responsabilidad documental si se separa |
| `fiscal.document.view` | No existe | Crear permiso para ver/descargar constancias |
| `fiscal.document.manage` | No existe | Crear permiso para subir/reemplazar constancias |
| `finance.view` | Existe, pero está sobrecargado | Reducir a consulta financiera |
| `finance.export` | No existe | Crear permiso para CSV/PDF financieros |
| `finance.workflow` | No existe | Crear permiso para aprobar, marcar pagada, cancelar y cambiar estados |
| `payroll.preview` | No existe | Crear permiso para cálculo vivo sin guardado |
| `payroll.view` | Existe | Mantener para consulta; no debe implicar preview si se separa |
| `payroll.finalize` | Existe | Mantener para guardar/cancelar corrida según rol autorizado |
| `reports.view` | Existe | No debe habilitar gestión fiscal |

Aclaraciones obligatorias:

- `finance.view` no debe habilitar edición fiscal.
- `finance.view` no debe habilitar workflow financiero.
- `reports.view`, si existe, no debe habilitar gestión fiscal.
- `payroll.preview` no debe permitir guardar nómina.
- `payroll.finalize` debe permanecer restringido a roles autorizados.

### Desacoplar `finance.view`

`finance.view` debe quedar limitado a consulta financiera.

- `finance.view` no debe editar RFC.
- `finance.view` no debe editar banco/tipo de pago.
- `finance.view` no debe subir constancias.
- `finance.view` no debe descargar constancias si el usuario no tiene `fiscal.document.view`.
- `finance.view` no debe aprobar nómina.
- `finance.view` no debe marcar nómina como pagada.
- `finance.view` no debe cancelar nómina.
- `finance.view` no debe cambiar estados financieros.

Los permisos separados deben ser:

- `finance.export`: controla exportaciones CSV/PDF financieros.
- `finance.workflow`: controla aprobar, marcar pagada, cancelar y cambiar estados financieros.

### Desacoplar fiscal

Los permisos fiscales deben dividir responsabilidades:

- `fiscal.view`: ver expediente fiscal.
- `fiscal.manage`: editar RFC, correo, banco y tipo de pago.
- `fiscal.document.view`: ver o descargar constancia.
- `fiscal.document.manage`: subir o reemplazar constancia.

RH y Finanzas deben recibir estos permisos según las decisiones humanas aprobadas. Contador/Contabilidad no deben recibir edición fiscal ni gestión documental salvo decisión posterior.

## 9. Matriz rol-acción objetivo

Leyenda:

- `Sí`: permitido.
- `No`: no permitido.
- `UC`: permitido solo dentro de `user_coordinations`.
- `Propio`: permitido solo si `created_by_user_id` o su equivalente actual corresponde al usuario actor.
- `Agregado`: permitido como reporte agregado o consulta global sin detalle fiscal sensible.
- `Sin fiscal`: permitido solo si se excluyen datos fiscales sensibles.

Aclaración: Subdirección usa el rol técnico `direccion`.

| Acción | admin | coordinador | direccion | rh | finanzas | contador | contabilidad |
|---|---|---|---|---|---|---|---|
| ver expediente fiscal | Sí | No | No | Sí | Sí | No | No |
| editar RFC | Sí | No | No | Sí | Sí | No | No |
| editar correo | Sí | No | No | Sí | Sí | No | No |
| editar banco/tipo de pago | Sí | No | No | Sí | Sí | No | No |
| subir constancia | Sí | No | No | Sí | Sí | No | No |
| descargar constancia | Sí | No | No | Sí | Sí | No | No |
| ver finanzas | Sí | No | Agregado | No | Sí | No | No |
| exportar finanzas | Sí | No | Agregado/Sin fiscal | No | Sí | Sí | Sí |
| cambiar estado financiero | Sí | No | No | No | Sí | No | No |
| horarios agregar | Sí | UC | Sí | No | No | No | No |
| horarios editar | Sí | UC | Propio | No | No | No | No |
| horarios eliminar | Sí | UC | Propio | No | No | No | No |
| incidencias agregar | Sí | UC | Sí | No | No | No | No |
| incidencias editar | Sí | UC | Propio | No | No | No | No |
| incidencias eliminar | Sí | UC | Propio | No | No | No | No |
| extras agregar | Sí | UC | Sí | No | No | No | No |
| extras editar | Sí | UC + Propio | Propio | No | No | No | No |
| extras eliminar | Sí | UC + Propio | Propio | No | No | No | No |
| directorio agregar | Sí | No | Sí | No | No | No | No |
| directorio editar | Sí | No | Sí | No | No | No | No |
| directorio eliminar | Sí | No | Sí | No | No | No | No |
| ver nómina vigente / preview | Sí | UC | Agregado/Sin fiscal | No | Sí | No | No |
| ver resumen de nómina | Sí | UC | Agregado/Sin fiscal | No | Sí | No | No |
| ver detalle por docente | Sí | UC | Sin fiscal | No | Sí | No | No |
| guardar nómina | Sí | No | No | No | No | No | No |
| aprobar nómina | Sí | No | No | No | Sí | No | No |
| marcar nómina pagada | Sí | No | No | No | Sí | No | No |
| cancelar nómina | Sí | No | No | No | Sí | No | No |

Notas:

- Contabilidad es equivalente a Contador.
- Finanzas realiza workflow financiero con `finance.workflow`, no con `finance.view`.
- Coordinador no edita fiscal y no guarda nómina.
- Dirección/Subdirección no cambian estados financieros.
- Dirección/Subdirección pueden ver detalle por docente de todas las coordinaciones sin datos fiscales sensibles.
- `GET /teachers` puede seguir devolviendo todos los docentes, pero las acciones sensibles se validan por permisos, coordinación, propiedad o regla específica.

### Punto de atención: `teachers.manage`

Actualmente el seed de permisos puede otorgar `teachers.manage` a Coordinador. Esto puede permitir acciones más amplias de Directorio o fiscal si no se desacopla correctamente.

La implementación debe evitar que Coordinador herede capacidades fiscales, gestión global de docentes o gestión de constancias solo por tener `teachers.manage`.

Opciones a evaluar en diseño técnico:

1. Crear permisos separados:
   - `teachers.view`
   - `teachers.manage`
   - `teachers.operational_view`
   - `teachers.directory_manage`
2. Mantener `GET /teachers` global, pero proteger acciones sensibles por permisos específicos.
3. Separar Directorio operativo de Expediente Fiscal.

La SPEC reconoce el riesgo; la decisión técnica concreta debe tomarse en diseño técnico sin contradecir la matriz rol-acción aprobada.

## 10. Cambios backend requeridos

Archivos probables:

- `apps/api/src/auth.ts`
- `apps/api/src/routes/users.ts`
- `apps/api/src/routes/academic-context.ts`
- `apps/api/src/routes/schedules.ts`
- `apps/api/src/routes/incidences.ts`
- `apps/api/src/routes/extras.ts`
- `apps/api/src/routes/teachers.ts`
- `apps/api/src/routes/payroll.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/audit.ts`
- `apps/api/src/types.ts`

Cambios esperados:

1. Cargar coordinaciones asignadas en sesión o contexto del actor.
2. Crear helper central para obtener una lista de `coordination_id` del actor desde `user_coordinations`.
3. Retirar duplicación de lógica tipo `loadActorCoordination`.
4. Reemplazar match por nombre con resolución por FK.
5. Mantener fallback legacy temporal, controlado y auditable.
6. Ajustar validaciones de Horarios por coordinación asignada.
7. Ajustar Incidencias por coordinación del horario.
8. Ajustar Extras por coordinación y `captured_by` o `created_by_user_id` migrado.
9. Ajustar Nómina preview para filtrar por `user_coordinations` cuando el actor sea Coordinador.
10. Ajustar Finanzas y Expediente Fiscal para usar permisos nuevos.
11. Registrar auditoría/log cuando se use fallback legacy.
12. Bloquear captura operativa si el usuario requiere coordinación y no tiene asignación.
13. Evitar que `finance.view` habilite acciones de escritura.
14. Evitar que `payroll.preview` habilite `payroll.finalize`.
15. Proteger datos fiscales sensibles en rutas usadas por Dirección/Subdirección.
16. Identificar y eliminar todas las rutas que crean coordinaciones automáticamente en `schedules`, `extras`, `teachers` y cualquier otro flujo operativo detectado.
17. Centralizar resolución de coordinaciones múltiples; no usar un único `actorCoordination` si el usuario tiene varias coordinaciones.
18. Reemplazar helpers que devuelven un objeto único por helpers que devuelvan lista de coordinaciones y utilidades de validación.
19. Mantener fallback legacy solo como contingencia, no como camino principal.
20. Registrar uso de fallback en logs y, si es viable, en auditoría.
21. Separar `finance.workflow` de `finance.view` en rutas de estado financiero.
22. Separar permisos fiscales y documentales en rutas de docentes/constancias.
23. Revisar usos de `teachers.manage` para evitar que habilite fiscal o gestión global no autorizada.

### Contradicciones o puntos de atención para implementación

- Si el código actual crea coordinaciones desde flujos operativos, debe desactivarse en la implementación futura porque contradice la decisión aprobada.
- Si alguna ruta sigue resolviendo permisos con `display_name` o `legacy_username`, debe quedar detrás de fallback temporal y no como ruta principal.
- Si una tabla operativa no tiene `created_by_user_id`, no se puede aplicar correctamente la regla de propiedad hasta agregarlo.
- Si `finance.view` se usa actualmente para edición fiscal o workflow, debe separarse sin cambiar nombres públicos innecesariamente.
- Si una ruta asume una sola coordinación del actor, debe ajustarse para múltiples coordinaciones desde el primer corte.
- Si una acción depende de propiedad y la tabla solo tiene `updated_by`, debe definirse si se agrega autoría original o si se hereda desde otra entidad.

## 11. Cambios frontend requeridos

Archivos probables:

- `apps/web/src/api.ts`
- `apps/web/src/stores/auth.ts`
- `apps/web/src/router/index.ts`
- `apps/web/src/views/AccessView.vue`
- `apps/web/src/views/PayrollView.vue`
- `apps/web/src/views/FinanceReportsView.vue`
- `apps/web/src/views/FiscalRecordsView.vue`
- `apps/web/src/views/SchedulesView.vue`
- `apps/web/src/views/IncidencesView.vue`
- `apps/web/src/views/ExtrasView.vue`
- `apps/web/src/views/TeachersView.vue`

Cambios esperados:

1. Mostrar asignación de coordinaciones en Control de Accesos.
2. Permitir seleccionar una o varias coordinaciones por usuario.
3. Mostrar mensaje si un usuario requiere captura operativa y no tiene coordinación asignada.
4. Ocultar acciones no permitidas por rol y permiso.
5. Mostrar Nómina preview para Coordinador en solo lectura.
6. Bloquear botones de guardar, aprobar, pagar o cancelar para Coordinador.
7. Separar permisos de Fiscal, Finanzas y Workflow.
8. Evitar asumir que `finance.view` habilita todo.
9. Ocultar datos fiscales sensibles para Dirección/Subdirección si no tienen permiso fiscal explícito.
10. Mantener `GET /teachers` como consulta global, sin inferir edición global.

El frontend debe actuar como capa de experiencia y prevención visual. La autorización real debe validarse en backend.

## 12. Fallback legacy temporal

El fallback legacy existe para evitar bloqueos operativos durante la migración desde coincidencia textual hacia `user_coordinations`.

### Cuándo se usa

Solo debe usarse cuando:

- No existe relación formal en `user_coordinations`.
- La acción requiere alcance operativo.
- El fallback está habilitado explícitamente.
- El usuario habría sido resoluble por la lógica legacy.

### Cómo se registra

Debe registrarse al menos en logs de API. Si es viable, también en auditoría:

- usuario actor
- rol
- acción intentada
- campo legacy usado
- coordinación resuelta
- módulo
- fecha/hora

### Cómo se desactiva

El fallback debe retirarse después de cumplir la condición aprobada:

1. Migrar todas las asignaciones usuario-coordinación.
2. Validar por al menos una quincena operativa completa sin errores de acceso.
3. Confirmar que no hubo usuarios bloqueados indebidamente.
4. Confirmar que no se usó fallback en logs durante el periodo de validación.

### Riesgos

- Resolver coordinación incorrecta por nombres similares.
- Mantener deuda técnica si no se define fecha o condición de retiro.
- Ocultar errores de asignación si se usa silenciosamente.
- Permitir operación sin relación formal.

### Pruebas

- Usuario con `user_coordinations`: no debe usar fallback.
- Usuario sin `user_coordinations` con fallback habilitado: debe registrar advertencia.
- Usuario sin `user_coordinations` con fallback deshabilitado: debe bloquear captura operativa.
- Fallback nunca debe crear coordinaciones automáticamente.

## 13. Reglas por módulo

### Horarios

- Admin opera globalmente.
- Coordinador puede agregar horarios como responsable operativo de su propia captura.
- Coordinador puede editar y eliminar solo horarios capturados por su usuario (`schedules.created_by` o equivalente).
- Dirección/Subdirección puede agregar horarios y editar/eliminar solo información propia cuando aplique.
- RH, Finanzas, Contador y Contabilidad no operan horarios.
- Si el actor requiere coordinación operativa y no tiene asignación, se bloquea la captura.
- No se crean coordinaciones automáticamente desde el modal o flujo de horarios.
- El campo visible `Responsable operativo` debe representar al usuario responsable/capturador, no el nombre tecnico de una coordinacion o ambito.
- Para Admin/Direccion, el selector de `Responsable operativo` debe listar usuarios operativos activos, usando `app_users.display_name` o email como etiqueta visible.
- Los usuarios inactivos no deben mostrarse en el selector de responsables operativos.
- El selector visible no debe limitarse a usuarios con `user_coordinations`; `user_coordinations` es alcance tecnico interno, no catalogo visible de responsables.
- Para Coordinador y usuarios no globales, `Responsable operativo` debe mostrarse en modo solo lectura con el nombre del usuario conectado.
- `coordinations` y `user_coordinations` pueden seguir usandose internamente como compatibilidad tecnica para nomina, reportes e importaciones, pero no deben exponerse en la UI como si fueran nombres de responsables.
- No se deben mostrar valores como `ADETUR`, `ARQ`, `SISCOM`, `DIGRAF`, `Idiomas` u otros ambitos tecnicos en un selector etiquetado como `Responsable operativo`.
- Si un usuario tiene multiples ambitos tecnicos, la API puede usar la relacion primaria para compatibilidad interna, pero la propiedad de edicion/eliminacion sigue siendo el usuario capturador.
- Si en el futuro se requiere asignar una persona responsable distinta del capturador, debe agregarse un campo explicito de responsable usuario; no reutilizar `coordinations.name` como nombre de persona.

### Incidencias

- Admin opera globalmente.
- Coordinador puede agregar, editar y eliminar incidencias dentro de sus coordinaciones asignadas.
- La validación debe considerar la coordinación del horario asociado.
- Dirección/Subdirección puede agregar incidencias y editar/eliminar propias.
- RH, Finanzas, Contador y Contabilidad no operan incidencias.
- Si una incidencia depende de un horario fuera del alcance del actor, debe bloquearse.
- `schedule_incidences` no tiene autoría original actualmente; solo registra `updated_by`.
- Si se aplicará regla de propiedad sobre incidencias, se debe agregar autoría original o heredar propiedad desde el horario.
- No se debe activar edición/eliminación "propia" en incidencias hasta definir ese criterio.

### Extras

- Admin opera globalmente.
- Coordinador puede agregar extras dentro de sus coordinaciones asignadas.
- Coordinador solo puede editar/eliminar extras si están dentro de sus coordinaciones asignadas y `created_by_user_id` corresponde al propio usuario.
- Dirección/Subdirección puede agregar extras y editar/eliminar propios.
- RH, Finanzas, Contador y Contabilidad no operan extras.
- La regla de sobrecarga por categoría no cambia en esta SPEC.
- `extra_hours.captured_by` puede usarse como equivalente funcional de `created_by_user_id` si apunta al usuario creador.
- La regla de propiedad debe validar `captured_by` o el campo migrado que se defina.
- Si se migra a `created_by_user_id`, no debe perderse el dato histórico de `captured_by`.

### Nómina preview

- Admin puede ver y guardar nómina.
- Coordinador puede ver Nómina vigente / preview en solo lectura para sus coordinaciones asignadas.
- Coordinador puede ver resumen y detalle por docente dentro de su alcance.
- Coordinador no puede guardar, aprobar, marcar pagada, cancelar ni cambiar estados.
- Dirección/Subdirección puede ver reportes agregados y detalle por docente sin datos fiscales sensibles.
- Finanzas puede ver nómina y gestionar estados financieros según permisos.
- La fórmula de nómina no cambia.

### Expediente fiscal

- Admin, RH y Finanzas pueden ver y gestionar expediente fiscal según permisos.
- RH puede editar RFC, correo, banco/tipo de pago, subir/descargar constancia y descargar CSV de cumpleaños.
- Finanzas puede gestionar fiscal en relación con pago y validación financiera.
- Coordinador no gestiona datos fiscales.
- Dirección/Subdirección no edita datos fiscales ni ve datos sensibles salvo permiso fiscal explícito.
- Contador/Contabilidad no editan fiscal ni gestionan constancias.

### Finanzas

- Admin y Finanzas pueden ver finanzas.
- Finanzas puede exportar y operar workflow financiero con `finance.workflow`.
- Contador/Contabilidad solo exportan con lectura mínima necesaria.
- Dirección/Subdirección ven reportes agregados y detalle por docente sin fiscal sensible.
- Coordinador no ve Finanzas global ni exporta Finanzas global.
- `finance.view` no habilita edición fiscal ni workflow.
- La cancelación por Finanzas debe quedar explícitamente incluida en `finance.workflow`.
- Aprobar, marcar pagada, cancelar y cambiar estados no deben depender de `finance.view`.

### Directorio

- `GET /teachers` trae todos los docentes de todas las coordinaciones.
- Ver todos los docentes no implica editar todos los docentes.
- Admin puede gestionar globalmente.
- Dirección/Subdirección puede agregar, editar y eliminar docentes según decisión aprobada.
- Coordinador puede usar la información para operación, pero no gestiona datos fiscales ni edición global.
- Acciones sensibles deben validarse por rol, permiso, coordinación, propiedad o regla específica.
- Datos fiscales sensibles deben protegerse con permisos fiscales.
- Edición fiscal debe moverse a permisos fiscales explícitos.
- Coordinador no debe gestionar fiscal, subir constancias ni descargar constancias.
- Si Dirección puede editar/eliminar Directorio, el diseño técnico debe definir si aplica por propiedad, permiso global específico o regla de rol.
- `teachers.manage` no debe interpretarse automáticamente como permiso fiscal.

## 14. Auditoría y bitácora

Eventos a registrar:

- Asignar coordinación a usuario.
- Quitar coordinación a usuario.
- Cambiar coordinación primaria.
- Cambio de permisos fiscales.
- Cambio de permisos financieros.
- Cambio de permisos de workflow.
- Uso de fallback legacy.
- Bloqueo por falta de coordinación.
- Intento no autorizado de acción fiscal.
- Intento no autorizado de descarga/subida de constancia.
- Intento no autorizado de workflow financiero.
- Edición de extras propios.
- Intento de edición/eliminación de extras ajenos.
- Cambios en `user_coordinations`.
- Creación, edición o eliminación de usuario con acceso.

Campos mínimos sugeridos:

- `actor_user_id`
- `actor_email`
- `event_type`
- `module`
- `target_type`
- `target_id`
- `before`
- `after`
- `created_at`
- `metadata`

## 15. Pruebas requeridas

### Coordinador

- Ver Horarios solo dentro de `user_coordinations`.
- Agregar horario dentro de coordinación asignada.
- Bloquear horario fuera de coordinación asignada.
- Editar/eliminar horario permitido dentro de su alcance.
- Agregar incidencia sobre horario de su coordinación.
- Bloquear incidencia sobre horario fuera de su coordinación.
- Agregar extra dentro de su coordinación.
- Editar/eliminar extra propio dentro de su coordinación.
- Bloquear edición/eliminación de extra ajeno.
- Ver Nómina preview solo lectura dentro de su coordinación.
- Bloquear guardar nómina.
- Bloquear aprobar, marcar pagada y cancelar.
- Bloquear edición fiscal.
- Bloquear descarga/subida de constancia.
- Bloquear Finanzas global y exportación global.

### RH

- Ver expediente fiscal.
- Editar RFC, correo, banco/tipo de pago.
- Subir constancia.
- Descargar constancia.
- Descargar CSV de cumpleaños.
- Bloquear workflow financiero.
- Bloquear aprobar, marcar pagada y cancelar nómina.
- Bloquear Horarios, Incidencias y Extras si no tiene rol operativo adicional.

### Finanzas

- Ver expediente fiscal.
- Editar RFC, correo, banco/tipo de pago.
- Subir y descargar constancias.
- Ver Finanzas.
- Exportar Finanzas.
- Aprobar nómina con `finance.workflow`.
- Marcar nómina pagada con `finance.workflow`.
- Cancelar nómina con `finance.workflow`.
- Confirmar que `finance.view` por sí solo no edita fiscal ni cambia estados.

### Dirección/Subdirección

- Confirmar que Subdirección usa rol técnico `direccion`.
- Agregar horarios.
- Editar/eliminar horarios propios.
- Agregar incidencias.
- Editar/eliminar incidencias propias.
- Agregar extras.
- Editar/eliminar extras propios.
- Agregar, editar y eliminar docentes según decisión aprobada.
- Ver reportes agregados.
- Ver detalle por docente sin datos fiscales sensibles.
- Bloquear edición fiscal.
- Bloquear cambio de estados financieros.
- Bloquear aprobar, pagar y cancelar nómina.

### Contador/Contabilidad

- Confirmar que Contabilidad se comporta como Contador.
- Exportar reportes autorizados.
- Bloquear edición fiscal.
- Bloquear subida/descarga de constancias si no tiene permiso explícito.
- Bloquear cambio de estados financieros.
- Bloquear aprobar, marcar pagada y cancelar.

### Admin

- Gestionar usuarios.
- Asignar y quitar coordinaciones.
- Ver y operar globalmente.
- Gestionar fiscal.
- Guardar nómina.
- Aprobar, marcar pagada y cancelar.
- Confirmar que el super admin no queda bloqueado por falta de `user_coordinations`.

### Usuario sin coordinación

- Intentar capturar Horarios: debe bloquear.
- Intentar capturar Incidencias: debe bloquear.
- Intentar capturar Extras: debe bloquear.
- Debe mostrarse mensaje claro para solicitar configuración al Admin.
- No debe crear coordinaciones automáticamente.

### Fallback legacy

- Usuario con relación formal no usa fallback.
- Usuario sin relación formal y fallback habilitado registra advertencia/log.
- Usuario sin relación formal y fallback deshabilitado queda bloqueado para captura operativa.
- Confirmar que fallback no crea coordinaciones.
- Confirmar que fallback puede monitorearse durante una quincena operativa completa.

### Propiedad del registro

- Validar `schedules.created_by` o `created_by_user_id` migrado.
- Validar `extra_hours.captured_by` como propiedad funcional.
- Validar comportamiento definido para `schedule_incidences` sin autoría original.
- Confirmar que Dirección/Subdirección puede editar propios y no ajenos cuando aplique.
- Confirmar que Coordinador puede editar extras propios y no ajenos.
- Confirmar que no se activa regla "propio" en tablas sin autoría confiable.

### Permisos nuevos

- Usuario con `finance.view` pero sin `finance.workflow` no cambia estados.
- Usuario con `finance.workflow` sí aprueba, marca pagada y cancela.
- Usuario con `fiscal.view` pero sin `fiscal.manage` no edita RFC, correo, banco o tipo de pago.
- Usuario con `fiscal.document.view` pero sin `fiscal.document.manage` descarga pero no sube constancia.
- Usuario con `payroll.preview` no guarda nómina.
- Usuario con `finance.export` exporta lo autorizado sin recibir workflow.

### Coordinaciones múltiples

- Coordinador con una coordinación.
- Coordinador con varias coordinaciones.
- Coordinador intentando acceder fuera de sus coordinaciones.
- Horarios con selector de coordinación válida cuando hay más de una asignación.
- Preview de nómina filtrado por múltiples coordinaciones.
- Extras e Incidencias aceptando cualquiera de las coordinaciones asignadas y bloqueando las demás.

## 16. Criterios de aceptación

La implementación H02/H03 se acepta si:

- `user_coordinations` existe y funciona.
- La coordinación se resuelve por FK, no por texto, como ruta principal.
- Coordinador solo ve y edita lo permitido por sus coordinaciones asignadas.
- Coordinador ve Nómina preview UC en solo lectura.
- Coordinador no guarda nómina ni cambia estados financieros.
- Coordinador no edita datos fiscales.
- RH y Finanzas gestionan expediente fiscal con permisos explícitos.
- Finanzas aprueba, marca pagada y cancela con `finance.workflow`.
- Contador y Contabilidad solo exportan.
- Dirección/Subdirección ven reportes agregados y detalle por docente sin datos fiscales sensibles.
- `GET /teachers` sigue trayendo todos los docentes.
- Acciones sensibles están protegidas por permisos en backend.
- Fallback legacy no es fuente principal.
- Fallback legacy genera advertencia/log cuando se usa.
- No se crean coordinaciones automáticamente.
- Usuarios sin coordinación operativa quedan bloqueados para captura.
- Pruebas por rol pasan.
- Pruebas por coordinación pasan.
- Pruebas de propiedad con `created_by_user_id` pasan.
- Se documentó y resolvió el mapeo de campos de autoría.
- No se activa regla "propio" en tablas sin autoría confiable.
- `finance.view` no habilita workflow.
- `finance.view` no habilita fiscal.
- `teachers.manage` no otorga permisos fiscales indebidos.
- `user_coordinations` soporta múltiples coordinaciones.
- No existe resolución principal por `actorCoordination` único.
- No quedan rutas operativas creando coordinaciones automáticamente.
- Los permisos nuevos existen y están asignados conforme a matriz.
- Typecheck y build pasan.
- No se modifica H01.
- No se crea rol técnico `subdireccion`.
- No se trata `"Todas / Global"` como coordinación real.
- No se trata `"No requiere coordinación operativa"` como coordinación real.

## 17. Plan de implementación por fases

### Fase 1: Documentación y migración DB

Objetivo:

Crear la base de datos necesaria y preparar migración sin activar modo estricto.

Archivos probables:

- `database/*.sql`
- `docs/auditoria/*`
- `docs/specs/*`

Tareas:

- Crear migración para `user_coordinations`.
- Agregar índices.
- Revisar/migrar campos de autoría y propiedad existentes.
- Validar existencia de `created_by_user_id` o equivalentes en tablas operativas.
- Crear permisos nuevos: `fiscal.view`, `fiscal.document.view`, `fiscal.document.manage`, `finance.export`, `finance.workflow`, `payroll.preview`.
- Preparar seed/migración de permisos.
- Preparar script o consulta de normalización de asignaciones iniciales.
- Validar coordinaciones contra catálogo real.
- Generar reporte de inconsistencias de coordinaciones, autoría y permisos.

Resultado esperado:

- Tabla creada.
- Datos listos para revisar.
- Ningún cambio de autorización activa todavía.

Criterio para avanzar:

- Admin aprueba migración y reporte de validación.

### Fase 2: Backend auth/context

Objetivo:

Centralizar resolución de coordinaciones del actor.

Archivos probables:

- `apps/api/src/auth.ts`
- `apps/api/src/types.ts`
- helper nuevo o existente de contexto académico

Tareas:

- Cargar coordinaciones por `user_coordinations`.
- Crear helper central multi-coordinación.
- Mantener fallback legacy temporal.
- Registrar uso del fallback.
- Bloquear captura operativa cuando falte coordinación.
- Eliminar duplicidad de resolución por texto.
- Sustituir helpers que devuelven un solo `actorCoordination` por utilidades que trabajen con listas.

Resultado esperado:

- Backend puede distinguir alcance global, UC, sin coordinación y fallback.

Criterio para avanzar:

- Pruebas unitarias/manuales de resolución por rol pasan.

### Fase 3: Backend módulos operativos

Objetivo:

Aplicar `user_coordinations` y propiedad en Horarios, Incidencias, Extras y Directorio.

Archivos probables:

- `apps/api/src/routes/schedules.ts`
- `apps/api/src/routes/incidences.ts`
- `apps/api/src/routes/extras.ts`
- `apps/api/src/routes/teachers.ts`

Tareas:

- Validar Horarios por coordinación asignada.
- Validar Incidencias por coordinación del horario.
- Validar Extras por coordinación y `captured_by` o campo migrado.
- Validar Directorio según permisos/rol.
- Eliminar creación automática de coordinaciones desde flujos operativos.
- Controlar propiedad por campos actuales o migrados.
- Definir comportamiento de `schedule_incidences` antes de aplicar regla "propio".

Resultado esperado:

- Operación académica queda filtrada por relación formal y propiedad.

Criterio para avanzar:

- Pruebas de Coordinador, Dirección/Subdirección y Admin pasan.

### Fase 4: Nómina preview y Finanzas

Objetivo:

Separar preview, finalización y workflow financiero.

Archivos probables:

- `apps/api/src/routes/payroll.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/audit.ts`

Tareas:

- Aplicar `payroll.preview` para Coordinador.
- Filtrar preview por `user_coordinations`.
- Evitar que Coordinador guarde o cambie estados.
- Aplicar separación fiscal/finanzas/workflow.
- Aplicar `finance.view`, `finance.export` y `finance.workflow`.
- Aplicar `payroll.preview` como permiso separado de `payroll.finalize`.
- Ocultar fiscal sensible para Dirección/Subdirección.
- Confirmar Contador/Contabilidad solo exportan.

Resultado esperado:

- Nómina preview y Finanzas respetan permisos separados.

Criterio para avanzar:

- Pruebas por rol y exportación pasan.

### Fase 5: Frontend

Objetivo:

Ajustar interfaz para asignaciones, permisos y mensajes.

Archivos probables:

- `apps/web/src/api.ts`
- `apps/web/src/stores/auth.ts`
- `apps/web/src/router/index.ts`
- `apps/web/src/views/AccessView.vue`
- `apps/web/src/views/PayrollView.vue`
- `apps/web/src/views/FinanceReportsView.vue`
- `apps/web/src/views/FiscalRecordsView.vue`
- `apps/web/src/views/SchedulesView.vue`
- `apps/web/src/views/IncidencesView.vue`
- `apps/web/src/views/ExtrasView.vue`
- `apps/web/src/views/TeachersView.vue`

Tareas:

- Permitir asignar múltiples coordinaciones en Control de Accesos.
- Mostrar mensajes de falta de coordinación.
- Ocultar botones no permitidos.
- Mostrar preview de nómina solo lectura para Coordinador.
- Separar vistas/acciones de Fiscal, Finanzas y Workflow.

Resultado esperado:

- Interfaz refleja permisos reales sin sustituir validación backend.

Criterio para avanzar:

- Typecheck/build frontend pasan y pruebas manuales por rol son correctas.

### Fase 6: Pruebas y despliegue

Objetivo:

Validar operación completa antes de producción.

Archivos probables:

- Scripts de prueba si existen.
- Documentación de validación.
- Configuración de despliegue.

Tareas:

- Ejecutar typecheck y build.
- Probar roles completos.
- Probar una quincena preview sin guardar.
- Probar workflow financiero con roles autorizados.
- Revisar logs de fallback.
- Validar que no se rompió H01.

Resultado esperado:

- Implementación lista para despliegue controlado.

Criterio para avanzar:

- Admin aprueba resultados de pruebas y ventana de despliegue.

## 18. Plan de rollback

El rollback debe permitir volver al comportamiento anterior sin pérdida de datos.

Medidas:

- No eliminar columnas existentes.
- No eliminar `display_name` ni `legacy_username`.
- Mantener fallback legacy temporal.
- Usar feature flag opcional para activar/desactivar nuevo modelo.
- Hacer respaldo antes de migración.
- Mantener migración reversible o desactivable.
- Si un rol pierde acceso indebidamente, restaurar permisos anteriores mientras se corrige asignación.
- Si `user_coordinations` falla, restaurar lectura anterior mediante fallback temporal.
- No borrar registros de auditoría.
- No tocar corridas de nómina históricas.
- No modificar cálculos monetarios H01.

Pasos de rollback sugeridos:

1. Desactivar feature flag de resolución estricta por `user_coordinations`.
2. Mantener tabla `user_coordinations` sin usarla como fuente estricta.
3. Reactivar fallback legacy como mecanismo temporal.
4. Revertir despliegue de API si la falla es de backend.
5. Revertir despliegue de frontend si la falla es visual o de permisos de interfaz.
6. Revisar logs y auditoría.
7. Corregir asignaciones antes de reintentar.

## 19. Riesgos de implementación

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Asignaciones incorrectas | Usuarios ven o capturan información indebida | Validar contra catálogo y prueba por usuario |
| Coordinador sin acceso | Bloqueo operativo | Reporte de usuarios sin coordinación antes de activar modo estricto |
| Acceso excesivo | Riesgo de privacidad y operación | Backend debe validar permisos, no solo UI |
| Finanzas sin workflow | No se puede aprobar/pagar/cancelar | Probar `finance.workflow` con usuario real de Finanzas |
| RH sin expediente fiscal | Bloquea actualización fiscal | Probar permisos fiscales completos |
| Dirección perdiendo operación | Impacta captura académica | Probar rol `direccion` y reglas de propiedad |
| Contador heredando edición | Riesgo de cambios no autorizados | Contador/Contabilidad solo `finance.export` y lectura mínima |
| Fallback mal usado | Continúa riesgo H02 | Registrar uso y monitorear durante una quincena |
| Pruebas insuficientes | Regresión productiva | Matriz de pruebas por rol y coordinación |
| Confusión entre coordinación y propiedad | Permisos incorrectos | Separar `user_coordinations` de `created_by_user_id` |
| Confusión entre responsable operativo y ambito tecnico | UI muestra catalogos como si fueran personas responsables | En Horarios/Docentes/Extras, la etiqueta visible debe ser usuario responsable/capturador; `coordinations` queda como referencia tecnica interna |
| `GET /teachers` interpretado como edición global | Edición indebida | Validar acciones sensibles en backend |
| Coordinaciones inexistentes | Migración incompleta | No crear automáticamente; marcar para revisión |
| Subdirección creada como rol técnico nuevo por error | Fragmenta permisos | Usar `direccion` |
| `"Todas / Global"` insertado como coordinación real | Datos incorrectos | Tratar como `scope_type = global` |
| `"No requiere coordinación operativa"` insertado como coordinación real | Datos incorrectos | Tratar como `scope_type = no_operational_coordination` |

## 20. Pendientes antes de implementar

El único pendiente antes de implementar es:

- Admin debe revisar y aprobar esta SPEC técnica H02/H03.

Antes del diseño técnico, Codex debe levantar inventario exacto de:

- Campos de autoría por tabla.
- Permisos actuales y asignación por rol.
- Rutas con creación automática de coordinaciones.
- Usos de `finance.view`.
- Usos de `teachers.manage`.
- Usos de `payroll.view`, `payroll.calculate` y `payroll.finalize`.

Este inventario no es una nueva decisión humana; es una tarea técnica previa al diseño.

Después de aprobación Admin, puede pasarse a diseño técnico detallado de migraciones, cambios backend, cambios frontend, pruebas y plan de despliegue.
