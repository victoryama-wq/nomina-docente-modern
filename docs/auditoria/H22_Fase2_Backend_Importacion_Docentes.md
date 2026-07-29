# H22-F2 - Backend de Importacion CSV de Docentes

Fecha: 2026-07-28

Estado: implementado y validado en local/test; frontend, migracion productiva y deploy pendientes.

## 1. Resumen

H22-F2 implementa un flujo exclusivo de Admin para descargar plantillas,
previsualizar y aplicar de forma atomica cambios operativos de docentes. El
backend vuelve a parsear y resolver el archivo durante Apply; no confia en
acciones calculadas por frontend y no conserva el CSV ni su Base64.

La fase no modifica H01, datos fiscales, Horarios, Incidencias, Extras, Nomina
ni snapshots. PostgreSQL se uso exclusivamente mediante
`nomina_docente_test`.

## 2. Endpoints

| Metodo | Ruta | Funcion |
|---|---|---|
| `GET` | `/teachers/import/template?scope=blank|active|all` | Descarga plantilla UTF-8 con BOM y CRLF. |
| `POST` | `/teachers/import/preview` | Analiza todo el CSV sin escrituras ni auditoria. |
| `POST` | `/teachers/import/apply` | Recalcula y aplica todo en una transaccion. |

La guarda valida expresamente `role=admin` o superadmin protegido. No basta con
`teachers.manage`; Coordinador, Direccion, RH, Finanzas, Contador y
Contabilidad reciben `403`.

## 3. Contrato CSV

Encabezados exactos:

```text
id,identificador,nombres,apellido_paterno,apellido_materno,responsable_operativo_email,categoria,telefono,ubicacion,estatus
```

Se rechazan columnas desconocidas, faltantes, repetidas o desordenadas con
`ENCABEZADO_INVALIDO`. La entrada admite UTF-8 con o sin BOM, LF o CRLF,
comillas, comas y saltos de linea mediante `@fast-csv/parse`.

Guardas:

- extension `.csv`;
- nombre base sanitizado;
- Base64 valido;
- maximo 1 MiB decodificado;
- maximo 5,000 filas de datos;
- filas completamente vacias ignoradas.

No se aceptan ni exportan RFC, correo fiscal, tipo de pago, banco, cuenta,
CLABE, constancias, `coordination_id` ni `updated_by`.

## 4. Plantillas

- `blank`: solo encabezados; archivo
  `plantilla-importacion-docentes.csv`.
- `active`: docentes `ACTIVO`; archivo
  `docentes-activos-para-edicion.csv`.
- `all`: docentes activos e inactivos; archivo
  `todos-los-docentes-para-edicion.csv`.

Las plantillas exportan UUID completo, identificador, componentes nominales,
correo del responsable, categoria, telefono, ubicacion y estatus. Si
`created_by` es nulo o no resuelve usuario, el correo queda vacio sin bloquear
la descarga.

## 5. Matching y nombres

Orden de matching:

1. UUID;
2. identificador normalizado mediante
   `normalizeTeacherExternalIdentifierKey`;
3. nombre normalizado solo para detectar colisiones.

Un nombre nunca identifica automaticamente un UPDATE. ID e identificador que
resuelven docentes diferentes generan `ID_IDENTIFICADOR_INCOMPATIBLE`.

La construccion del nombre se centralizo en
`apps/api/src/lib/teacher-names.ts` y es compartida por el alta/edicion
individual y el importador. Conserva acentos y `Ñ` en `full_name`, colapsa
espacios, omite apellido materno vacio y recalcula `normalized_name` cuando
cambia un componente.

En existentes, una celda vacia conserva el valor vigente. H22 v1 no permite
limpiar campos mediante celda vacia.

## 6. Responsable operativo y docentes legacy

`responsable_operativo_email` resuelve `app_users.email` hacia
`teachers.created_by`.

Roles admitidos: `admin`, `coordinador` y `direccion`. El usuario debe existir,
estar activo y tener un rol admitido. RH, Finanzas, Contador y Contabilidad no
pueden asignarse como responsables H22.

Regla para docentes legacy con `created_by IS NULL`:

- sin cambios operativos: `SIN_CAMBIOS`, advertencia no bloqueante
  `RESPONSABLE_OPERATIVO_AUSENTE`;
- con cambios y sin responsable: bloqueo
  `RESPONSABLE_OPERATIVO_REQUERIDO`;
- responsable valido inicial:
  `ACTUALIZAR_RESPONSABLE_OPERATIVO`;
- cambio entre responsables:
  `REASIGNAR_RESPONSABLE_OPERATIVO`.

## 7. Inactivacion con dependencias

Preview y Apply comprueban nuevamente:

- Horarios en ciclos `ACTIVO` o `PLANEACION`;
- Incidencias vinculadas a esos Horarios;
- Extras del docente en ciclos `ACTIVO` o `PLANEACION`.

Si existe cualquier dependencia, la fila queda bloqueada con
`INACTIVACION_CON_DEPENDENCIAS` y muestra solo conteos agregados y ciclos.
Horarios exclusivamente historicos en ciclos `CERRADO`, snapshots y corridas
guardadas no bloquean por si solos.

No se modifican ni cierran dependencias automaticamente.

## 8. Preview y fingerprints

Preview devuelve SHA-256 del archivo, fingerprint determinista de todos los
campos operativos de `teachers`, fingerprint de usuarios responsables,
resumen/detalle por fila y categorias que requieren segunda confirmacion.

El fingerprint de docentes incluye identificador, componentes nominales,
nombre derivado/normalizado, categoria, contacto, estatus, `created_by` y
`updated_at`. El de responsables incluye ID, correo, estatus, rol y
`updated_at`, ademas de representar correos no encontrados.

Las dependencias de una inactivacion se recalculan obligatoriamente dentro de
Apply bajo transaccion y locks. Una dependencia creada despues del Preview
convierte el Apply en `PREVIEW_OBSOLETO`.

Preview no escribe, no audita, no cambia secuencias y no crea archivos.

## 9. Apply transaccional

Apply:

1. vuelve a validar archivo y Admin;
2. adquiere
   `pg_advisory_xact_lock(hashtext('nomina_docente_teacher_import'))`;
3. bloquea docentes y responsables con `FOR UPDATE`;
4. vuelve a parsear y construir el Preview;
5. compara SHA-256 y fingerprints;
6. recalcula dependencias;
7. rechaza bloqueos o Preview obsoleto;
8. exige categorias de riesgo expresas;
9. aplica solo `NUEVO` o filas con cambios;
10. omite `SIN_CAMBIOS`;
11. registra auditoria;
12. confirma toda la transaccion.

No usa savepoints, aplicacion parcial ni `ON CONFLICT DO NOTHING`.

Segunda confirmacion obligatoria:

- `REASIGNAR_RESPONSABLE_OPERATIVO`;
- `INACTIVAR`;
- `ACTUALIZAR_CATEGORIA`;
- `ACTUALIZAR_NOMBRE`;
- `ACTUALIZAR_MULTIPLE`.

Las altas escriben solo campos operativos aprobados. Las actualizaciones
escriben solo columnas realmente cambiadas y actualizan `updated_by` y
`updated_at`. `SIN_CAMBIOS` no ejecuta UPDATE.

El indice `teachers_external_identifier_unique_idx` se traduce a
`IDENTIFICADOR_DUPLICADO`; la colision
`teachers_normalized_name_key` se traduce a un conflicto nominal sin exponer
SQL interno.

## 10. Auditoria

Eventos:

- `TEACHER_IMPORT_APPLIED`;
- `TEACHER_CREATED`;
- `TEACHER_UPDATED`;
- `TEACHER_RESPONSIBLE_REASSIGNED`;
- `TEACHER_STATUS_CHANGED`.

La auditoria registra nombre base sanitizado, SHA-256, conteos, UUID,
identificador y before/after de campos operativos. No almacena CSV, Base64,
RFC, correo fiscal, banco, cuenta, CLABE, tipo de pago, constancias, Nomina ni
snapshots.

## 11. Pruebas

Cobertura agregada:

- helper canonico de nombres;
- guarda por todos los roles;
- tres scopes de plantilla;
- BOM, CRLF/LF, acentos, comas y saltos entrecomillados;
- limites, encabezados y Base64;
- matching por UUID/identificador;
- duplicados de identificador y nombre;
- responsables validos, inexistentes, inactivos y no autorizados;
- regla legacy sin responsable;
- dependencias activas/planeacion e historico cerrado;
- segunda confirmacion;
- alta, actualizacion, auditoria y proteccion fiscal;
- archivo, docente, responsable y dependencias obsoletos;
- `SIN_CAMBIOS` sin cambio de timestamps;
- fingerprints de tablas protegidas antes/despues.

Resultado granular H22:

- API/unitarias: 7 archivos, 27/27.
- Integracion H22: 14/14.

Validacion completa:

- `npm run test:api`: 7 archivos, 27/27.
- `npm run test:api:integration`: 14 archivos, 104/104, usando
  exclusivamente `nomina_docente_test`.
- `npm run test:web`: 14 archivos, 61/61.
- `npm run typecheck`: API y frontend aprobados.
- `npm run build`: API y frontend aprobados.
- `git diff --check`: aprobado.

Despues de reconstruir la base de integracion se restauro exclusivamente el
control H05 local/test:

- 17 migraciones detectadas y registradas.
- 16 migraciones historicas con estado `baseline`.
- `014_h22_teacher_external_identifier_unique.sql` con estado `applied`.
- `pending = 0`.
- `checksum mismatch = 0`.

No se conecto a produccion ni se ejecuto ninguna migracion productiva.

## 12. Estado de migracion y alcance

- `014_h22_teacher_external_identifier_unique.sql` permanece aplicada
  exclusivamente en `nomina_docente_test`.
- Produccion conserva 16 migraciones registradas y no recibio `014`.
- No hubo acceso productivo, deploy ni cambios de dependencias.
- Frontend de Catalogos permanece pendiente.
- H22 no queda cerrado; continua con frontend, predeploy, aprobacion productiva
  de `014` y deploy controlado.
