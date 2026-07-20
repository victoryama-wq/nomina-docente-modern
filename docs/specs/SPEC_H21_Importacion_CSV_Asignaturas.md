# SPEC H21 - Importacion CSV de Asignaturas

Fecha: 2026-07-18

Estado: implementado y validado en local/test; pendiente de migracion y deploy productivo.

## 1. Objetivo

Incorporar en `Catalogos -> Asignaturas` una importacion masiva controlada que
permita descargar una plantilla, previsualizar un CSV, crear asignaturas,
actualizar registros por una clave oficial estable e inactivar solo cuando el
archivo lo indique expresamente.

H21 tambien debe permitir busquedas tolerantes a acentos, mayusculas,
minusculas, puntuacion basica y espacios repetidos sin sustituir el nombre
oficial almacenado.

## 2. Principios funcionales

1. `subjects.name` conserva acentos y ortografia oficial.
2. La representacion normalizada sirve solo para busqueda y deteccion.
3. Una actualizacion se resuelve principalmente por clave oficial unica.
4. Una coincidencia solo por nombre normalizado nunca actualiza ni fusiona de
   forma automatica.
5. No se eliminan asignaturas.
6. La ausencia de una fila en el CSV no modifica el catalogo.
7. La inactivacion requiere `estatus=INACTIVO` explicito.
8. Horarios, ciclos cerrados, nominas y snapshots conservan su historia.
9. No se modifican H01, importes ni reglas de Nomina.
10. El backend es la autoridad de validacion y permisos.

## 3. Estado actual que condiciona el diseno

La tabla productiva `subjects` tiene solamente:

- `id uuid`;
- `name text`;
- `status user_status`.

No existe clave oficial, nombre normalizado, indice sin acentos ni campos de
auditoria propios. El catalogo usa `audit_log` para registrar altas y cambios.

Consecuencias:

- no es seguro actualizar masivamente por nombre;
- la restriccion `UNIQUE(name)` distingue mayusculas y acentos;
- la busqueda actual de la UI no encuentra un nombre acentuado con texto sin
  acento;
- la carga inicial de claves oficiales para registros existentes necesita un
  identificador inequívoco adicional.

## 4. Alcance

H21 contempla:

- descarga de plantilla CSV UTF-8 con BOM;
- preview sin escrituras;
- clasificacion por fila;
- aplicacion transaccional posterior y separada;
- alta, cambio controlado de nombre/estatus y carga inicial de clave;
- busqueda normalizada e indexada;
- auditoria resumida y por registro;
- pruebas API, PostgreSQL y frontend.

Fuera de alcance:

- borrar o fusionar asignaturas;
- modificar horarios o snapshots para propagar nombres;
- cambiar claves ya referenciadas sin procedimiento especial;
- importar tabuladores u otros catalogos;
- ampliar permisos a roles distintos de Admin;
- cambiar H01 o la formula de Nomina.

## 5. Modelo de datos propuesto

H21 implementa una migracion H05 aditiva con prefijo `013`:

```text
database/013_h21_subject_import_search.sql
```

La migracion se disena para:

1. habilitar `unaccent` y `pg_trgm`, disponibles en Cloud SQL pero actualmente
   no instalados;
2. crear una funcion canonica `STABLE` y una columna almacenada mantenida por trigger;
3. agregar `subjects.official_code text NULL`;
4. agregar `subjects.normalized_name` con backfill y trigger;
5. crear indice unico parcial para
   `upper(btrim(official_code)) WHERE official_code IS NOT NULL`;
6. crear indice GIN trigram sobre `normalized_name`.

`official_code` debe permanecer nullable para los 281 registros legacy hasta
que exista un mapping institucional aprobado. Toda nueva asignatura creada por
importacion debe incluir clave.

La migracion fue aplicada y validada solo en `nomina_docente_test`. No se ha
ejecutado en produccion.

## 6. Normalizacion canonica

La funcion canonica debe vivir en PostgreSQL y ser reutilizada por consultas,
preview y restricciones de deteccion. El backend no debe mantener una segunda
regla divergente.

Transformacion:

1. aplicar `unaccent` sobre Unicode;
2. convertir a minusculas;
3. sustituir puntuacion basica por espacios;
4. colapsar espacios repetidos;
5. recortar extremos.

No se eliminan palabras, abreviaturas academicas ni contenido del nombre
oficial.

Para permitir `INTRODUCCION PROGRAMACION` sobre
`Introduccion a la Programacion`, la consulta se divide en tokens normalizados
y exige que todos aparezcan en `normalized_name`. El valor almacenado conserva
`a la`; solo el algoritmo de busqueda combina tokens.

## 7. Contrato CSV

Encabezados definitivos propuestos:

```text
id,clave,nombre,estatus
```

| Columna | Regla |
|---|---|
| `id` | UUID opcional. La plantilla de catalogo lo incluye para asociar de forma segura registros legacy que aun no tienen clave. Para nuevas filas queda vacio. |
| `clave` | Obligatoria para nuevas filas. Se compara con trim y mayusculas, pero se conserva el valor institucional aprobado. |
| `nombre` | Obligatorio, maximo vigente de 160 caracteres; conserva acentos. |
| `estatus` | Obligatorio: `ACTIVO` o `INACTIVO`. |

La descarga debe soportar:

- plantilla vacia;
- plantilla precargada con el catalogo actual, sus `id`, claves disponibles,
  nombres y estatus.

Reglas de archivo:

- entrada UTF-8 con o sin BOM;
- salida UTF-8 con BOM y CRLF mediante helper H11;
- CRLF o LF aceptados;
- comillas, comas y saltos procesados por un parser CSV real;
- no usar `split(',')`;
- maximo propuesto: 512 KiB decodificados y 5,000 filas de datos;
- encabezados obligatorios y unicos;
- columnas desconocidas: error bloqueante para evitar typos silenciosos;
- filas completamente vacias: ignoradas;
- claves y estatus se validan en servidor.

No existe parser CSV declarado directamente en el API. `@fast-csv/parse`
aparece solo como dependencia transitiva de `exceljs`; si se elige, debe
declararse como dependencia directa y pasar auditoria en una fase de
implementacion separada. H21-F0 no instala dependencias.

## 8. Matching por fila

Orden de resolucion:

1. si existe `id`, debe resolver una sola asignatura;
2. si existe `clave` en BD, debe resolver una sola asignatura;
3. si llegan `id` y `clave`, ambos deben identificar el mismo registro;
4. una clave nueva con nombre normalizado parecido genera advertencia
   bloqueante;
5. un nombre normalizado nunca sustituye el matching por clave o `id`.

El `id` solo permite el bootstrap controlado de `official_code` para registros
legacy. Una vez asignada la clave, esta es el identificador funcional principal.

## 9. Estados de preview

| Estado | Bloqueante | Tratamiento |
|---|---:|---|
| `NUEVA` | No | Insertar solo con clave, nombre y estatus validos. |
| `ACTUALIZAR_NOMBRE` | No si es correccion menor | Requiere misma clave o `id`; conservar before/after. |
| `ACTUALIZAR_ESTATUS` | Condicional | Permitir solo cambio explicito y seguro. |
| `ACTUALIZAR_MULTIPLE` | Si hasta confirmacion | Mostrar cada campo modificado. |
| `SIN_CAMBIOS` | No | No escribir. |
| `INACTIVAR` | Condicional | Bloquear si existen horarios en ciclo `ACTIVO` o `PLANEACION`. |
| `DUPLICADO_CLAVE_CSV` | Si | Corregir archivo. |
| `DUPLICADO_NOMBRE_CSV` | Si | No fusionar automaticamente. |
| `CLAVE_DUPLICADA_BD` | Si | Detener y revisar integridad. |
| `POSIBLE_DUPLICADO_NOMBRE` | Si | Requiere decision humana y nuevo preview. |
| `CLAVE_EXISTENTE_NOMBRE_INCOMPATIBLE` | Si | Diferenciar correccion ortografica de sustitucion academica. |
| `ESTATUS_INVALIDO` | Si | Solo `ACTIVO`/`INACTIVO`. |
| `CAMPO_OBLIGATORIO_FALTANTE` | Si | Corregir CSV. |
| `ERROR` | Si | No aplicar. |

Subcausas bloqueantes adicionales:

- `ID_CLAVE_INCOMPATIBLE`;
- `INACTIVACION_CON_USO_OPERATIVO`;
- `ARCHIVO_EXCEDE_LIMITE`;
- `PREVIEW_OBSOLETO`.

Un preview con cualquier estado bloqueante no puede aplicarse parcialmente por
defecto. Debe corregirse el archivo y generarse un nuevo preview.

## 10. Politica de creacion y actualizacion

### Crear

Crear cuando la clave no existe, no hay colisiones, la fila es valida y no hay
posible duplicado por nombre.

### Actualizar

Actualizar cuando `id` o clave resuelven un registro unico y el cambio se
limita a `official_code`, `name` o `status`.

Una diferencia solo de acento, mayusculas, puntuacion o espacios es correccion
ortografica. Un cambio sustancial de nombre con la misma clave es bloqueante y
requiere decision humana.

### Inactivar o reactivar

- inactivar solo con `estatus=INACTIVO` explicito;
- no inactivar por ausencia del CSV;
- no inactivar mientras existan horarios en `ACTIVO` o `PLANEACION`;
- reactivar solo con `estatus=ACTIVO` explicito;
- auditar ambos cambios.

### Cambio academico

Si cambia el significado o plan de estudios, crear una nueva clave/asignatura e
inactivar la anterior cuando sea operativamente seguro. No reutilizar ni
fusionar el registro historico.

## 11. API propuesta

```text
GET  /catalogs/subjects?q=&status=&page=&pageSize=
GET  /catalogs/subjects/import/template?scope=blank|catalog
POST /catalogs/subjects/import/preview
POST /catalogs/subjects/import/apply
```

La ruta de listado normalizado se agrega sin romper `/catalogs/context`.

### Template

Devuelve CSV H11 con `id,clave,nombre,estatus`. No incluye datos ajenos al
catalogo.

### Preview

Recibe archivo como base64 siguiendo el patron local de uploads, valida tamano,
decodifica UTF-8 y usa un parser CSV declarado. No escribe en BD.

Respuesta minima:

```ts
{
  fileSha256: string;
  catalogFingerprint: string;
  summary: Record<string, number>;
  rows: PreviewRow[];
  blockingErrors: number;
}
```

### Apply

Recibe nuevamente el mismo archivo y los hashes de preview. El servidor:

1. autentica Admin;
2. vuelve a analizar y clasificar el archivo;
3. no confia en acciones enviadas por frontend;
4. obtiene advisory lock transaccional para importacion de asignaturas;
5. bloquea las filas afectadas con `FOR UPDATE`;
6. compara `id`, clave, nombre y estatus contra el fingerprint;
7. aborta si el catalogo cambio;
8. aplica todas las filas aprobadas en una transaccion;
9. registra auditoria y conteos.

No se usa UPSERT ciego.

## 12. Frontend propuesto

En la pestaña Asignaturas:

- boton `Descargar plantilla`;
- boton `Importar CSV`;
- selector de archivo;
- ayuda breve de formato y limites;
- preview antes de cualquier escritura;
- tarjetas de nuevas, cambios, inactivaciones, sin cambios y errores;
- tabla filtrable por estado y numero de fila;
- before/after visible para cambios;
- confirmacion explicita;
- progreso y resultado final.

Seleccionar un archivo nunca aplica cambios automaticamente.

La busqueda del catalogo se ejecuta en backend con el indice normalizado; la UI
mantiene filtros por estatus y estados de carga/error/vacio.

## 13. Permisos y auditoria

Se reutiliza el acceso vigente:

- frontend: `canManageCatalogs`, actualmente `isAdmin`;
- backend: `requireCatalogAdmin`, Admin o superadmin protegido.

No se crea permiso nuevo ni se amplian roles.

Auditoria:

- evento resumen `SUBJECT_IMPORT_APPLIED` con actor, fecha, nombre sanitizado,
  SHA-256 y conteos;
- eventos `SUBJECT_CREATED`/`SUBJECT_UPDATED` por fila con before/after;
- no guardar el CSV completo;
- no guardar contenido innecesario en logs.

## 14. Dependencias e historicos

- `schedules.subject_id` referencia `subjects.id` sin borrado en cascada.
- `schedules.subject_name` conserva el nombre capturado y no cambia al editar el
  catalogo.
- `payroll_schedule_details.subject_name_snapshot` conserva el nombre de la
  corrida guardada y no tiene FK a `subjects`.
- incidencias dependen del horario, no directamente de `subjects`.
- reportes vivos usan nombres de horarios; historicos usan snapshots.

Inactivar no elimina historia, pero una asignatura inactiva deja de aparecer en
opciones nuevas y hoy puede impedir editar un horario operativo que la usa. Por
eso `INACTIVACION_CON_USO_OPERATIVO` es bloqueante.

## 15. Pruebas requeridas

- UTF-8 con y sin BOM, CRLF/LF, comas, comillas y saltos;
- nombre oficial conserva acentos;
- busqueda sin acento, en mayusculas y con espacios repetidos;
- busqueda por tokens no contiguos;
- nueva asignatura por clave;
- bootstrap de clave por `id` legacy;
- actualizacion por clave;
- correccion de acento;
- duplicados de clave/nombre en CSV;
- colision normalizada en BD;
- clave existente con nombre incompatible;
- inactivacion explicita y bloqueo por ciclo operativo;
- ausencia en CSV sin efecto;
- preview sin escrituras;
- apply transaccional y rollback total ante error;
- catalogo modificado entre preview/apply;
- permisos: Admin 200; resto 403;
- historial de horarios y snapshots sin cambios;
- limites de archivo/filas y encabezados;
- auditoria sin contenido completo del CSV.

## 16. Fases sugeridas

1. H21-F0: diagnostico y diseno, completado.
2. H21-F1: migracion 013 y helper canonico en `nomina_docente_test`, completado.
3. H21-F2: API template/preview/apply y pruebas PostgreSQL, completado.
4. H21-F3: Horarios estrictos con `subjectId`, completado.
5. H21-F4: UI, busqueda normalizada y validacion local, completado.
6. H21-F5: deploy controlado solo tras H05, H13 y aprobacion humana.

## 17. Decisiones cerradas y pendientes de release

Quedaron implementadas y validadas en local/test las siguientes decisiones:

- migracion `013` con `unaccent`, `pg_trgm`, `official_code` y
  `normalized_name`;
- `id` opcional para asociar registros existentes y `clave` oficial unica
  cuando se informa;
- Horarios selecciona exclusivamente asignaturas del catalogo mediante
  `subjectId` y no crea asignaturas por texto libre;
- parser CSV directo `@fast-csv/parse` en API;
- limites de 512 KiB y 5000 filas.

Antes de produccion siguen pendientes H05/H13, backup, aprobacion humana,
validacion con CSV institucional y smoke Admin/Coordinador. No se ha ejecutado
la migracion `013` ni se ha hecho deploy en produccion.

## 18. Confirmaciones historicas H21-F0

Las siguientes confirmaciones describen exclusivamente el diagnostico F0 y no
el estado actual de implementacion:

- No se modifico codigo.
- No se modifico SQL.
- No se creo ni ejecuto migracion.
- No se modifico base de datos.
- Las consultas productivas fueron read-only.
- No se instalaron dependencias.
- No se cambiaron permisos.
- No se hizo deploy.
- No se modifico H01.

## 19. Estado posterior H21-F1 a H21-F4

- F1-F4 estan implementadas y validadas en local/test.
- La migracion `013` fue aplicada en `nomina_docente_test` y ensayada sobre una
  restauracion temporal de produccion; no fue aplicada en produccion.
- Los fingerprints de asignaturas, horarios y snapshots permanecieron iguales
  durante el ensayo.
- Los cinco grupos normalizados legacy fueron preservados sin merge.
- El preview del catalogo restaurado detecto 10 filas bloqueantes asociadas a
  esos cinco grupos; no se ejecuto apply.
- `npm audit` reporta un hallazgo critico transitivo en
  `websocket-driver@0.7.4`; H21-F5 queda bloqueado hasta una actualizacion SEC
  controlada.
- No se ha hecho deploy H21.
