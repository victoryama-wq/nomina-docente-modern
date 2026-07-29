# H22-F3 - Frontend de Importacion CSV de Docentes

Fecha: 2026-07-29

Estado: implementado y validado en local/test; predeploy, migracion productiva
`014` y deploy pendientes.

## 1. Resumen

H22-F3 integra en `Catalogos` una tercera pestana administrativa:

```text
Importacion de docentes
```

La interfaz consume sin reinterpretar el contrato backend H22-F2. El frontend
no calcula acciones como autoridad, no modifica filas del Preview y no envia
objetos before/after durante Apply.

La edicion individual permanece en `Directorio`. No se duplico el formulario
individual dentro de Catalogos.

## 2. Ubicacion y visibilidad

Archivos principales:

- `apps/web/src/views/CatalogsView.vue`;
- `apps/web/src/components/catalogs/TeacherImportPanel.vue`;
- `apps/web/src/api.ts`.

La pestana usa una comprobacion explicita `authStore.isAdmin`. La ruta
`/catalogos` conserva ademas la guarda `canManageCatalogs`, tambien derivada de
Admin. No se usa `teachers.manage`, porque Coordinador, Direccion y RH pueden
tener ese permiso y no estan autorizados para importar.

Matriz frontend:

| Rol | Pestana |
|---|---|
| Admin / protected super admin | Visible y operativa |
| Coordinador | Oculta |
| Direccion | Oculta |
| RH | Oculta |
| Finanzas | Oculta |
| Contador | Oculta |
| Contabilidad | Oculta |

El backend permanece como autoridad final y responde `403` a actores no Admin.

## 3. Descargas

Se implementaron tres acciones:

- `Descargar docentes activos` -> `scope=active`;
- `Descargar plantilla vacia` -> `scope=blank`;
- `Descargar todos los docentes` -> `scope=all`.

La descarga completa exige una confirmacion previa que advierte que incluye
activos e inactivos. Durante una descarga se deshabilitan las demas acciones,
se conserva el filename de `Content-Disposition` mediante el helper comun y se
revoca el Object URL.

La UI no interpreta ni registra el contenido descargado.

## 4. Selector y contrato CSV

El selector:

- acepta un solo `.csv`;
- muestra nombre y tamano legible;
- aplica una validacion orientativa de 1 MiB;
- limpia Preview y confirmaciones al reemplazar el archivo;
- conserva archivo/Base64 solo en memoria;
- no usa `localStorage` ni `sessionStorage`;
- no ejecuta Preview o Apply automaticamente.

Encabezados mostrados en la ayuda:

```text
id,identificador,nombres,apellido_paterno,apellido_materno,responsable_operativo_email,categoria,telefono,ubicacion,estatus
```

No se muestran ni aceptan campos fiscales, `full_name` o `normalized_name`.
UTF-8, Base64, limite real, filas y encabezados siguen bajo autoridad backend.

## 5. Preview

`Generar vista previa` envia solamente:

```ts
{
  fileName,
  base64Data
}
```

La respuesta tipada conserva:

- SHA-256 del archivo;
- fingerprint de docentes;
- fingerprint de responsables;
- resumen;
- bloqueos;
- categorias de riesgo;
- filas con valores actuales/propuestos;
- dependencias operativas agregadas.

Hashes, fingerprints y Base64 permanecen en estado del componente y no se
renderizan.

## 6. Revision de filas

El panel incluye:

- tarjetas de total, nuevos, actualizaciones, sin cambios, reasignaciones,
  inactivaciones, reactivaciones, advertencias y bloqueos;
- filtro por resultado;
- filtro por accion presente;
- busqueda sin distinguir acentos o mayusculas;
- conteo `Mostrando X de Y filas`;
- tabla con fila, docente, identificador, accion, estado, observacion y
  detalle;
- modal before/after de campos operativos;
- conteos agregados de Horarios, Incidencias, Extras y ciclos cuando una
  inactivacion esta bloqueada.

El estado combina texto e icono y no depende solo del color.

## 7. Docentes legacy sin responsable

La UI distingue:

- `SIN_CAMBIOS` +
  `RESPONSABLE_OPERATIVO_AUSENTE`: advertencia no bloqueante; la fila puede
  permanecer sin cambios;
- `RESPONSABLE_OPERATIVO_REQUERIDO`: bloqueo; el Admin debe corregir el CSV y
  generar otro Preview.

No existe edicion inline del correo del responsable.

## 8. Confirmaciones y Apply

Apply exige:

1. Preview vigente;
2. cero bloqueos;
3. confirmacion general;
4. una confirmacion independiente por cada categoria de riesgo presente;
5. modal final con archivo y resumen.

Categorias soportadas:

- `REASIGNAR_RESPONSABLE_OPERATIVO`;
- `INACTIVAR`;
- `ACTUALIZAR_CATEGORIA`;
- `ACTUALIZAR_NOMBRE`;
- `ACTUALIZAR_MULTIPLE`.

El payload real contiene:

```ts
{
  fileName,
  base64Data,
  fileSha256,
  teachersFingerprint,
  responsibleUsersFingerprint,
  confirmedRiskActions
}
```

No se envian filas, acciones recalculadas, current/proposed ni datos fiscales.

El modal final recuerda que la operacion es completa o se revierte completa.
Se bloquea el doble clic. Tras exito, se limpia archivo, Preview y
confirmaciones, se emite recarga de Catalogos y se muestra un resumen final.

## 9. Errores

El cliente HTTP conserva `status` y `code` en `ApiRequestError`, sin cambiar el
contrato backend.

Tratamiento:

- `401`: sesion expirada;
- `403`: permisos insuficientes;
- `409 PREVIEW_OBSOLETO`: limpia Preview y confirmaciones, conserva el archivo;
- `409 CONFIRMACION_INSUFICIENTE`: conserva Preview y exige revisar
  confirmaciones;
- duplicados en Apply: requieren nuevo Preview;
- `500`: mensaje general sin stack, query ni detalle interno.

La UI incluye etiquetas funcionales en espanol para codigos H22. Nunca muestra
JSON crudo, SQL, constraints ni payload completo.

## 10. Responsive y accesibilidad

- controles flexibles y apilables en telefono;
- tarjetas con grid adaptable;
- tabla dentro de contenedor con scroll horizontal;
- modal de detalle limitado al viewport;
- labels asociados;
- mensajes con `aria-live`;
- botones con texto e icono;
- estados `disabled` reales;
- dialogs con `role=dialog` y `aria-modal`.

No se agregaron dependencias ni anchos fijos que rompan Catalogos.

## 11. Pruebas

Cobertura H22-F3 agregada:

- visibilidad Admin y exclusion de seis roles;
- tres descargas, confirmacion `all`, error y doble clic;
- extension, nombre, tamano, reemplazo y ausencia de carga automatica;
- Preview, tarjetas, filas, bloqueos y advertencias;
- legacy sin responsable bloqueante/no bloqueante;
- dependencias de inactivacion;
- before/after;
- filtros y busqueda sin acentos;
- confirmacion general y riesgos separados;
- modal final;
- payload original con hashes/fingerprints y sin filas como autoridad;
- exito, limpieza y evento de recarga;
- errores `403`, `409` y `500`;
- ausencia visual de datos fiscales, Base64 y fingerprints;
- estructura responsive basica.

Resultado granular:

- 2 archivos H22 frontend;
- 18/18 pruebas aprobadas.

Regresion completa:

- `npm run test:web`: 16 archivos, 79/79 pruebas.
- `npm run test:api`: 7 archivos, 27/27 pruebas.
- `npm run test:api:integration`: 14 archivos, 104/104 pruebas usando
  exclusivamente `nomina_docente_test`.
- `npm run typecheck`: API y web aprobados.
- `npm run build`: API y web aprobados.
- `git diff --check`: aprobado.

El reset de integracion recrea el esquema y vacia el control H05. Despues de
la suite se restauro exclusivamente en `nomina_docente_test` el estado
esperado mediante H05:

- 17 migraciones detectadas y registradas;
- 16 `baseline`;
- `014_h22_teacher_external_identifier_unique.sql` aplicada;
- `pending = 0`;
- `checksum mismatch = 0`.

## 12. Confirmaciones

- no acceso productivo;
- no migracion productiva;
- no deploy;
- no SQL modificado;
- no dependencias instaladas;
- no permisos backend modificados;
- no datos fiscales;
- no cambios H01;
- no cambios en Nomina o snapshots.

H22 permanece abierto. Predeploy, aplicacion productiva aprobada de `014` y
deploy controlado son fases posteriores.
