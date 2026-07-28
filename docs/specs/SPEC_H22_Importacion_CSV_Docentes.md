# SPEC H22 - Importacion CSV de Docentes

Fecha: 2026-07-28

Estado: Diagnostico y diseno aprobable; no implementado

## 1. Objetivo

H22 propone una importacion masiva y controlada de datos operativos de
docentes mediante CSV, disponible exclusivamente para Admin en:

```text
Catalogos -> Importacion de docentes
```

La edicion individual permanece en `Directorio`. H22 no reemplaza Directorio,
no sustituye el catalogo completo y no modifica datos fiscales, financieros,
Nomina, snapshots ni historicos.

## 2. Alcance funcional

La primera implementacion debe permitir:

- descargar una plantilla vacia;
- descargar docentes activos con UUID completo;
- descargar todos los docentes con UUID completo mediante una accion
  explicita;
- agregar filas nuevas con `id` vacio;
- editar campos operativos de docentes existentes;
- validar el archivo sin escrituras;
- mostrar altas, actualizaciones, reasignaciones, inactivaciones,
  reactivaciones, filas sin cambios, advertencias y errores;
- aplicar el archivo completo en una sola transaccion;
- impedir cualquier aplicacion parcial;
- registrar auditoria operativa sin almacenar el CSV completo.

## 3. Fuera de alcance

H22 no puede:

- leer, descargar o modificar RFC;
- leer, descargar o modificar correo fiscal (`teachers.email`);
- leer, descargar o modificar banco, cuenta, CLABE o `bank_detail`;
- leer, descargar o modificar `payment_type`;
- leer, descargar o modificar constancias o documentos fiscales;
- modificar `updated_by` para representar propiedad;
- modificar `coordination_id`;
- modificar Horarios, Incidencias, Extras, Nomina, Finanzas o snapshots;
- eliminar docentes;
- hacer UPSERT ciego;
- identificar un UPDATE por posicion de fila o coincidencia aproximada;
- crear permisos, roles o dependencias nuevas;
- cambiar formulas H01.

## 4. Plantilla definitiva

Los encabezados exactos son:

```csv
id,identificador,nombres,apellido_paterno,apellido_materno,responsable_operativo_email,categoria,telefono,ubicacion,estatus
```

Las columnas desconocidas, faltantes o repetidas son bloqueantes.
El CSV no acepta ni exporta columnas independientes llamadas `nombre`,
`full_name` o `normalized_name`.

### 4.1 `id`

- UUID tecnico completo de `teachers.id`.
- Vacio para una nueva alta.
- Obligatorio para la edicion de una fila proveniente de una plantilla
  precargada.
- Si existe, debe resolver exactamente un docente.
- Un UUID invalido o inexistente bloquea la fila.
- No se trunca ni se presenta como identificador para captura manual.

### 4.2 `identificador`

- Mapea a `teachers.external_identifier`.
- Obligatorio para altas nuevas.
- Vacio en un docente existente conserva el valor actual.
- Se compara con `upper(trim(external_identifier))`.
- Debe resolver como maximo un docente.
- Si `id` e `identificador` resuelven docentes distintos, la fila se bloquea.
- La aplicacion debe proteger unicidad funcional aunque el esquema actual no
  tenga una restriccion `UNIQUE`.

### 4.3 Componentes nominales

Mapeo aprobado:

```text
nombres            -> teachers.first_names
apellido_paterno   -> teachers.paternal_last_name
apellido_materno   -> teachers.maternal_last_name
```

`teachers.full_name` y `teachers.normalized_name` son campos derivados por el
backend. Nunca se reciben directamente desde el CSV.

Para nuevas altas:

- `nombres` es obligatorio;
- `apellido_paterno` es obligatorio;
- `apellido_materno` es opcional;
- se aplican las mismas validaciones vigentes del alta individual;
- no se inventan apellidos ni se divide automaticamente un nombre completo.

Para docentes existentes:

- una celda vacia conserva el componente actual;
- cambiar `nombres` actualiza `first_names`;
- cambiar `apellido_paterno` actualiza `paternal_last_name`;
- cambiar `apellido_materno` actualiza `maternal_last_name`;
- una celda vacia no elimina un apellido existente;
- la eliminacion explicita de un componente queda fuera de H22 v1.

Despues de resolver los valores efectivos, el backend aplica una unica funcion
canonica:

```text
first_names
  + paternal_last_name
  + maternal_last_name
      -> full_name
      -> normalized_name
```

La funcion debe:

- aplicar `trim` a cada componente;
- omitir componentes vacios;
- evitar espacios duplicados;
- conservar acentos y `Ñ` en `full_name`;
- aplicar la normalizacion vigente a `normalized_name`;
- bloquear una colision con la restriccion unica de `normalized_name`;
- reutilizar o centralizar la logica de altas/ediciones individuales;
- no introducir una segunda implementacion incompatible.

No se actualiza unicamente `full_name` ni se permite desalinear los componentes
del nombre. `normalized_name` sigue siendo solo una ayuda de busqueda y
advertencia, nunca identidad suficiente para un UPDATE.

### 4.4 `responsable_operativo_email`

Se resuelve exclusivamente asi:

```text
responsable_operativo_email
  -> app_users.email
  -> app_users.id
  -> teachers.created_by
```

Reglas:

- obligatorio para nuevas altas;
- vacio en docente existente conserva el `created_by`;
- el correo debe resolver exactamente un usuario activo;
- el correo se normaliza con `lower(trim(email))`;
- el usuario debe pertenecer a un rol operativo permitido;
- un responsable diferente genera
  `REASIGNAR_RESPONSABLE_OPERATIVO`;
- el preview muestra responsable actual y propuesto;
- el Admin ejecutor se registra como actor de auditoria;
- `updated_by`, `coordination_id` y `user_coordinations` no representan esta
  propiedad.

Con base en las reglas vigentes de Directorio, el conjunto propuesto para H22
es:

| Rol | Responsable H22 propuesto | Motivo |
|---|---|---|
| `admin` | Si | Tiene alcance global y el alta individual ya registra al actor. |
| `coordinador` | Si | `created_by` habilita propiedad y edicion individual. |
| `direccion` | Si | La regla backend actual reconoce propiedad por `created_by`; existe precedente aprobado H17/H19. |
| `rh` | Pendiente de decision | Tiene `teachers.manage`, pero la rama de propiedad de Directorio no usa `created_by` para RH. |
| `finanzas` | No | No administra datos operativos del docente por propiedad. |
| `contador` | No | Sin permiso operativo de Directorio. |
| `contabilidad` | No | Sin permiso operativo de Directorio. |

La implementacion no debe ampliar el conjunto sin una decision humana
explicita. La recomendacion conservadora para H22-F1 es permitir
`admin`, `coordinador` y `direccion`, y mantener RH fuera hasta resolver la
decision indicada.

### 4.5 `categoria`

- Valores tecnicos vigentes: `V`, `M`, `N`.
- Vacio en existente conserva el valor actual.
- Obligatorio para altas.
- No se inventan categorias.
- Un cambio requiere segunda confirmacion por su impacto operativo en
  Horarios y Reportes.
- No cambia formulas H01 ni recalcula Nomina guardada.

### 4.6 `telefono` y `ubicacion`

- Campos operativos opcionales.
- Vacio en existente conserva el valor actual.
- H22 v1 no permite limpiar un valor con celda vacia.
- `telefono` conserva la regla actual de 10 a 15 digitos, con `+` inicial
  opcional.

### 4.7 `estatus`

- Valores permitidos: `ACTIVO`, `INACTIVO`.
- Obligatorio para altas.
- Vacio en existente conserva el valor actual.
- La ausencia de una fila no cambia el estatus del docente.
- `INACTIVO` explicito genera `INACTIVAR`.
- `ACTIVO` explicito sobre un inactivo genera `REACTIVAR`.

La inactivacion debe bloquearse cuando existan dependencias vigentes:

- Horarios en ciclos `ACTIVO` o `PLANEACION`;
- Incidencias operativas asociadas a esos horarios;
- Extras del ciclo operativo.

Los horarios y snapshots historicos de ciclos cerrados no se modifican. Una
inactivacion con dependencias vigentes usa el error adicional
`INACTIVACION_CON_DEPENDENCIAS`.

## 5. Plantillas descargables

### 5.1 Plantilla vacia

Endpoint:

```text
GET /teachers/import/template?scope=blank
```

Contenido: solo encabezados.

Nombre:

```text
plantilla-importacion-docentes.csv
```

### 5.2 Docentes activos

Endpoint:

```text
GET /teachers/import/template?scope=active
```

Contenido: docentes `ACTIVO`, ordenados por nombre, con UUID completo y los
diez campos operativos aprobados:

- `id`;
- `identificador`;
- `first_names` como `nombres`;
- `paternal_last_name` como `apellido_paterno`;
- `maternal_last_name` como `apellido_materno`;
- correo del responsable operativo;
- categoria;
- telefono;
- ubicacion;
- estatus.

Nombre:

```text
docentes-activos-para-edicion.csv
```

Esta es la opcion principal de la interfaz.

### 5.3 Todos los docentes

Endpoint:

```text
GET /teachers/import/template?scope=all
```

Contenido: docentes `ACTIVO` e `INACTIVO` con los mismos diez campos de
`scope=active`.

Nombre:

```text
todos-los-docentes-para-edicion.csv
```

La UI debe exigir una seleccion explicita; no es la descarga predeterminada.

### 5.4 Formato de salida

Las tres plantillas usan el helper H11:

- UTF-8 con BOM;
- CRLF;
- comillas CSV correctas;
- UUID completo;
- acentos preservados;
- sin campos fiscales.

Las plantillas no exportan `full_name`, `normalized_name`, RFC, correo fiscal,
banco, cuenta, CLABE, `payment_type`, documentos fiscales ni datos de Nomina.

## 6. Matching definitivo

Orden:

1. `id`;
2. `external_identifier`;
3. `normalized_name` solo como advertencia.

Reglas:

- si existe `id`, debe resolver exactamente un registro;
- si existe identificador, debe resolver cero o un registro;
- si ambos existen, deben identificar al mismo docente;
- un nombre normalizado nunca determina un UPDATE;
- un posible duplicado nominal bloquea una alta;
- no se usa similitud como escritura;
- no se usa posicion de fila;
- no se reemplaza un registro completo;
- no existe aplicacion parcial.

Para busqueda y advertencias se normalizan acentos, mayusculas, espacios y
puntuacion basica. La coincidencia por tokens debe requerir que todos los
tokens de consulta existan, aunque no sean contiguos.

## 7. Estados del preview

### 7.1 Acciones no bloqueantes

- `NUEVO`
- `ACTUALIZAR_IDENTIFICADOR`
- `ACTUALIZAR_NOMBRE`
- `ACTUALIZAR_RESPONSABLE_OPERATIVO`
- `REASIGNAR_RESPONSABLE_OPERATIVO`
- `ACTUALIZAR_CATEGORIA`
- `ACTUALIZAR_CONTACTO`
- `ACTUALIZAR_ESTATUS`
- `ACTUALIZAR_MULTIPLE`
- `INACTIVAR`
- `REACTIVAR`
- `SIN_CAMBIOS`

### 7.2 Estados bloqueantes

- `ID_NO_ENCONTRADO`
- `ID_INVALIDO`
- `ID_IDENTIFICADOR_INCOMPATIBLE`
- `IDENTIFICADOR_DUPLICADO_CSV`
- `IDENTIFICADOR_DUPLICADO_BD`
- `DUPLICADO_NOMBRE_CSV`
- `POSIBLE_DUPLICADO_NOMBRE`
- `RESPONSABLE_NO_ENCONTRADO`
- `RESPONSABLE_INACTIVO`
- `RESPONSABLE_AMBIGUO`
- `RESPONSABLE_NO_AUTORIZADO`
- `CATEGORIA_INVALIDA`
- `ESTATUS_INVALIDO`
- `CAMPO_OBLIGATORIO_FALTANTE`
- `INACTIVACION_CON_DEPENDENCIAS`
- `ARCHIVO_EXCEDE_LIMITE`
- `ENCABEZADO_INVALIDO`
- `PREVIEW_OBSOLETO`
- `ERROR`

`ACTUALIZAR_NOMBRE` representa uno o varios cambios en `nombres`,
`apellido_paterno` o `apellido_materno`, junto con la reconstruccion
consecuente de `full_name` y `normalized_name`. No se agrega un estado
equivalente como `ACTUALIZAR_NOMBRE_COMPLETO`.

El preview compara por separado:

| Campo | Actual | Propuesto |
|---|---|---|
| Nombres | `first_names` actual | `first_names` efectivo |
| Apellido paterno | `paternal_last_name` actual | valor efectivo |
| Apellido materno | `maternal_last_name` actual | valor efectivo |
| Nombre derivado | `full_name` actual | `full_name` reconstruido |

Cuando cambian componentes nominales y otros datos operativos, la accion
general es `ACTUALIZAR_MULTIPLE`.

Bloqueos nominales minimos:

- componentes obligatorios faltantes en una nueva alta;
- UUID e identificador incompatibles;
- colision de `normalized_name`;
- posible duplicado nominal en una nueva alta;
- nombre derivado invalido.

## 8. Segunda confirmacion

Las siguientes acciones requieren una segunda confirmacion:

- `REASIGNAR_RESPONSABLE_OPERATIVO`;
- `INACTIVAR`;
- `ACTUALIZAR_CATEGORIA`;
- `ACTUALIZAR_MULTIPLE`;
- cualquier `ACTUALIZAR_NOMBRE`.

El frontend debe mostrar conteos y before/after. Apply debe enviar las
categorias de riesgo confirmadas; el backend recalcula el preview y rechaza si
aparece una categoria no confirmada.

## 9. API propuesta

La ruta definitiva es:

```text
GET  /teachers/import/template?scope=blank|active|all
POST /teachers/import/preview
POST /teachers/import/apply
```

Motivo:

- el dominio y las mutaciones actuales viven en `routes/teachers.ts`;
- evita mezclar reglas de docentes con Asignaturas/Tabuladores;
- facilita reutilizar sanitizacion, normalizacion y auditoria de Directorio;
- la ubicacion visual en Catálogos no obliga a usar `/catalogs`.

Los tres endpoints son exclusivos de Admin mediante una guarda explicita por
rol/protected super admin. No se usa solo `teachers.manage`, porque ese permiso
tambien existe en roles no autorizados para importacion.

### 9.1 Preview

El preview:

- recibe nombre sanitizado y contenido CSV;
- limita tamaño y filas antes de parsear;
- valida UTF-8 con o sin BOM;
- usa `@fast-csv/parse`, ya instalado en API;
- valida encabezados exactos;
- ignora filas completamente vacias;
- calcula SHA-256 del archivo;
- calcula fingerprint de docentes afectados y candidatos de colision;
- calcula fingerprint de usuarios responsables;
- devuelve acciones, before/after operativo, observaciones y bloqueos;
- no escribe en BD ni en auditoria.

El fingerprint de docentes debe incluir, ordenado por UUID:

```text
id | external_identifier | normalized_name | category | phone |
location | status | created_by | updated_at
```

El fingerprint de responsables debe incluir:

```text
id | email | status | role | updated_at
```

### 9.2 Apply

Apply:

1. recibe nuevamente el archivo;
2. vuelve a parsearlo;
3. abre una sola transaccion;
4. adquiere
   `pg_advisory_xact_lock(hashtext('nomina_docente_teacher_import'))`;
5. bloquea docentes y usuarios afectados con `FOR UPDATE`;
6. recalcula acciones y fingerprints;
7. rechaza archivo, catalogo o responsables obsoletos;
8. rechaza cualquier error bloqueante;
9. verifica las segundas confirmaciones;
10. ejecuta solo filas `NUEVO` o con cambios;
11. omite `SIN_CAMBIOS` sin UPDATE ni auditoria por fila;
12. registra auditoria sanitizada;
13. confirma toda la transaccion o revierte toda la transaccion.

Para que la unicidad funcional de `external_identifier` sea segura sin
migracion, H22-F1 debe aplicar el mismo advisory lock en `POST /teachers` y en
cambios individuales de identificador. Si esa integracion no se acepta, debe
reabrirse la decision de una migracion con indice unico parcial.

## 10. Frontend propuesto

La pestaña `Importacion de docentes` se integra en `CatalogsView.vue` y solo
se renderiza para Admin.

Controles:

- Descargar plantilla vacia;
- Descargar docentes activos, como accion principal;
- Descargar todos los docentes, como accion secundaria explicita;
- ayuda breve de columnas;
- selector de archivo `.csv`;
- boton Preview;
- tarjetas de conteos;
- filtro por accion/estado;
- tabla por fila con before/after;
- detalle de responsable actual/propuesto;
- mensajes bloqueantes;
- confirmacion general;
- segunda confirmacion para acciones de riesgo;
- boton Apply deshabilitado con bloqueos;
- resumen final.

Despues de Apply:

- recarga Directorio y catalogos relacionados;
- limpia archivo y preview;
- muestra resultado;
- no reenvia el archivo automaticamente.

## 11. Auditoria

Eventos:

- `TEACHER_IMPORT_APPLIED`
- `TEACHER_CREATED`
- `TEACHER_UPDATED`
- `TEACHER_RESPONSIBLE_REASSIGNED`
- `TEACHER_STATUS_CHANGED`

Registrar:

- Admin ejecutor;
- nombre base sanitizado del archivo;
- SHA-256;
- conteos;
- UUID e identificador tecnico del docente;
- before/after solo de campos operativos;
- responsable anterior y nuevo.

No registrar:

- contenido completo del CSV;
- RFC;
- correo fiscal;
- banco, cuenta, CLABE o `bank_detail`;
- `payment_type`;
- constancias o documentos;
- datos de Nomina o snapshots.

## 12. Formato y limites

- Entrada CSV UTF-8 con o sin BOM.
- Salida CSV UTF-8 con BOM y CRLF.
- Parser: `@fast-csv/parse` ya disponible.
- Maximo: 1 MiB.
- Maximo: 5,000 filas de datos.
- Encabezados exactos y unicos.
- Columnas desconocidas bloqueantes.
- Filas completamente vacias ignoradas.
- Comas, comillas y saltos de linea procesados por parser real.
- No se agrega dependencia.

## 13. Dependencias historicas

`teachers.id` es referenciado directa o indirectamente por:

- `schedules`;
- `schedule_incidences` mediante `schedules`;
- `extra_hours`;
- `payroll_lines`;
- `payroll_schedule_details`;
- `payroll_extra_details`;
- `teacher_documents`;
- `audit_log` mediante `entity_type/entity_id`;
- Reportes y Finanzas mediante consultas y snapshots.

H22 conserva UUID, no elimina filas y no reasigna historicos. Los snapshots
guardan nombres y valores historicos; no deben recalcularse por un cambio
operativo del docente.

## 14. Migracion

H22-F0 no crea migracion.

La primera implementacion puede reutilizar:

- `teachers`;
- `teachers.normalized_name`;
- `app_users`;
- `audit_log`;
- `@fast-csv/parse`;
- helper CSV H11;
- transacciones PostgreSQL;
- advisory locks.

Riesgo residual:

`external_identifier` no tiene unicidad fisica. H22 puede operar sin migracion
solo si las altas/ediciones individuales y el importador comparten la misma
guarda de concurrencia. Una migracion futura se justificaria unicamente para
crear una restriccion unica parcial despues de confirmar en produccion que no
hay identificadores duplicados.

## 15. Pruebas requeridas para H22-F1/F2

- plantilla vacia;
- plantilla activa;
- plantilla completa;
- template con los diez encabezados exactos;
- export correcto de `nombres`, `apellido_paterno` y `apellido_materno`;
- ausencia de `full_name` y `normalized_name` en el CSV;
- UUID completo;
- ausencia de datos fiscales;
- nueva alta con `id` vacio;
- alta con `nombres` y `apellido_paterno`;
- `apellido_materno` opcional;
- actualizacion por `id`;
- actualizacion por identificador;
- actualizacion individual de cada componente nominal;
- vacio conserva cada componente nominal existente;
- reconstruccion correcta de `full_name`;
- recalculo correcto de `normalized_name`;
- acentos y `Ñ` preservados;
- espacios duplicados eliminados;
- colision normalizada bloqueante;
- matching no dependiente de componentes nominales;
- comportamiento nominal equivalente al formulario individual;
- `id` e identificador incompatibles;
- identificador duplicado CSV/BD;
- posible duplicado por nombre;
- responsable valido, inexistente, inactivo, ambiguo y no autorizado;
- reasignacion de responsable;
- categoria invalida;
- vacio conserva valor;
- inactivacion y reactivacion explicitas;
- inactivacion con dependencia operativa;
- ausencia en CSV sin efecto;
- preview sin escrituras;
- Apply atomico;
- fingerprint obsoleto;
- rollback total;
- `SIN_CAMBIOS` sin UPDATE;
- Admin 200 y resto 403;
- datos fiscales intactos;
- Nomina y snapshots intactos;
- UTF-8 con/sin BOM;
- CRLF/LF;
- comas, comillas y saltos;
- limites de archivo/filas;
- encabezados invalidos;
- auditoria sin datos sensibles;
- busqueda con/sin acentos y tokens no contiguos;
- concurrencia con alta/edicion individual.

## 16. Decisiones pendientes

Antes de implementar H22-F1 deben cerrarse:

1. confirmar si RH puede ser responsable operativo o queda excluido;
2. aprobar la regla de bloqueo de inactivacion con dependencias vigentes;
3. aceptar advisory lock compartido en mutaciones individuales o solicitar
   una migracion de unicidad para `external_identifier`;
4. renovar autenticacion institucional y repetir el diagnostico productivo
   read-only de duplicados antes de implementar Apply.

La decision nominal queda cerrada: la plantilla usa componentes separados y
el backend deriva `full_name` y `normalized_name`.

## 17. Confirmaciones H22-F0

- No se modifico codigo.
- No se modifico SQL.
- No se modifico base de datos.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se instalaron dependencias.
- No se cambiaron permisos.
- No se modifico H01.
- No se expusieron datos fiscales.
