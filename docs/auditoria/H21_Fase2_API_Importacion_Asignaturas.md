# H21-F2 - API de importacion controlada de Asignaturas

Fecha: 2026-07-18

Estado: implementada y validada en local/test; sin deploy.

## 1. Alcance

Se implemento importacion CSV exclusiva de Admin con flujo obligatorio
`plantilla -> preview -> confirmacion -> apply`. El backend no conserva el
archivo original y el apply vuelve a parsear y clasificar dentro de una unica
transaccion.

## 2. Dependencia

Se declaro `@fast-csv/parse@^4.3.6` directamente en `apps/api`. Esa version ya
existia transitivamente en el lock y se usa para respetar comillas, comas y
saltos de linea del formato CSV. No se instalo ninguna dependencia frontend y
no se ejecuto `npm audit fix`.

## 3. Endpoints

- `GET /catalogs/subjects`: busqueda paginada, normalizada y activa por defecto
  para actores con `schedules.manage`.
- `GET /catalogs/subjects/import/template`: plantilla H11 con BOM UTF-8 y CRLF.
- `POST /catalogs/subjects/import/preview`: validacion read-only del archivo.
- `POST /catalogs/subjects/import/apply`: aplicacion atomica exclusiva de Admin.

## 4. Guardas

- maximo 512 KiB y 5,000 filas;
- UTF-8 estricto;
- encabezados exactos `id,clave,nombre,estatus`;
- clave obligatoria, normalizada a mayusculas y sin duplicados;
- ID opcional solo para registros existentes;
- bloqueo de ID/clave incompatibles;
- bloqueo de colision de nombre normalizado;
- bloqueo de inactivacion con Horarios en ciclos `ACTIVO` o `PLANEACION`;
- fingerprint SHA-256 del archivo y del catalogo;
- advisory lock transaccional;
- cero aplicacion parcial cuando existe una fila bloqueante.

Los estados del preview distinguen altas, cambios de clave/nombre/estatus,
inactivacion, multiples cambios, ausencia de cambios y cada bloqueo relevante
(`DUPLICADO_CLAVE_CSV`, `DUPLICADO_NOMBRE_CSV`,
`POSIBLE_DUPLICADO_NOMBRE`, `ID_CLAVE_INCOMPATIBLE`,
`CLAVE_EXISTENTE_NOMBRE_INCOMPATIBLE`,
`INACTIVACION_CON_USO_OPERATIVO`, campos faltantes y estatus invalido).

## 5. Auditoria

Cada alta o cambio genera un evento por asignatura y el apply genera un evento
resumen con nombre del archivo, hashes y conteos. No se registra el contenido
del CSV ni se exponen datos fiscales.

## 6. Pruebas

La cobertura PostgreSQL con `app.inject()` valida:

- permisos Admin/Coordinador;
- BOM, CRLF y nombre de plantilla;
- preview y apply de alta/cambio;
- auditoria por fila y resumen;
- duplicados CSV;
- inactivacion con uso operativo;
- archivo o catalogo cambiado despues del preview;
- busqueda por tokens sin acentos;
- rechazo de UTF-8 invalido.

Resultado granular final: 10/10 pruebas. Incluye BOM, LF/CRLF, comas,
comillas, saltos embebidos, limite de bytes, limite de filas, encabezados,
matching por ID/clave, correccion de acento y rollback total.

## 7. Confirmaciones

- Sin produccion.
- Sin deploy.
- Sin migracion productiva.
- Sin escritura fuera de `nomina_docente_test`.
- Sin `DELETE`, merge ni reemplazo masivo.
- Sin cambios H01.
- Sin datos fiscales.
