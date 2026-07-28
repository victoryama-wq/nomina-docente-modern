# H22-F1A - Integridad de identificadores de docentes

Fecha: 2026-07-28

## 1. Resumen

H22-F1A cerro las decisiones funcionales previas al importador, valido
produccion en modo read-only y agrego en local/test una garantia fisica para
`teachers.external_identifier`.

Esta fase no implementa los endpoints de importacion, frontend, Apply CSV,
deploy ni migracion productiva.

## 2. Decisiones humanas cerradas

### Responsables operativos

Los unicos roles que H22 podra resolver como
`responsable_operativo_email -> teachers.created_by` son:

- `admin`;
- `coordinador`;
- `direccion`.

`rh`, `finanzas`, `contador` y `contabilidad` quedan excluidos. Una fila con un
usuario RH debe clasificarse como `RESPONSABLE_NO_AUTORIZADO`. Esta regla no
modifica permisos vigentes de RH.

### Inactivacion con dependencias

Una solicitud `INACTIVO` debe quedar bloqueada con
`INACTIVACION_CON_DEPENDENCIAS` cuando el docente tenga horarios en ciclos
`ACTIVO` o `PLANEACION`, incidencias operativas relacionadas o extras del ciclo
operativo vigente.

La comprobacion se ejecutara en Preview y nuevamente dentro de la transaccion
de Apply. No se modifican horarios, incidencias, extras, ciclos, snapshots,
corridas ni historicos.

### Unicidad del identificador

La clave canonica aprobada es:

```text
upper(btrim(external_identifier))
```

Los identificadores vacios legacy quedan excluidos de la unicidad. No se hizo
backfill ni se modificaron valores almacenados.

## 3. Validacion productiva read-only

Conexion:

- proyecto: `nomina-docente-prod`;
- instancia: `nomina-docente-web`;
- base: `nomina_docente`;
- usuario DB: `app_nomina`;
- Cloud SQL Auth Proxy: `127.0.0.1:55433`;
- transaccion: `READ ONLY`;
- `transaction_read_only`: `on`.

Conteos agregados:

| Concepto | Resultado |
|---|---:|
| Docentes totales | 217 |
| Con identificador no vacio | 69 |
| Sin identificador | 148 |
| Sin `created_by` | 7 |
| Grupos duplicados por `upper(btrim(...))` | 0 |

No se documentaron nombres de docentes ni datos fiscales.

La estructura productiva conserva:

- constraint `teachers_normalized_name_key`;
- definicion `UNIQUE (normalized_name)`;
- indice unico asociado sobre `teachers.normalized_name`.

## 4. Estado H05 productivo inicial

La revision se ejecuto antes de crear `014`:

| Concepto | Resultado |
|---|---:|
| Migraciones en filesystem | 16 |
| Registradas | 16 |
| Baseline | 15 |
| Aplicadas | 1 (`013`) |
| Pendientes | 0 |
| Checksum mismatch | 0 |

Solo se ejecutaron `db:migrate:inspect` y `db:migrate:status`. No se ejecuto
`dry-run`, `baseline` ni `apply` contra produccion.

## 5. Migracion 014

Archivo:

```text
database/014_h22_teacher_external_identifier_unique.sql
```

Objeto creado:

```sql
CREATE UNIQUE INDEX teachers_external_identifier_unique_idx
  ON teachers ((upper(btrim(external_identifier))))
  WHERE btrim(external_identifier) <> '';
```

La migracion contiene solo DDL. No contiene `INSERT`, `UPDATE`, `DELETE`,
backfill ni cambios de valores visibles.

## 6. Aplicacion local/test mediante H05

Base exclusiva: `nomina_docente_test`.

Como la reconstruccion de integracion habia dejado las tablas de control H05
sin registros, primero se registraron como baseline local/test las 16
migraciones ya presentes. Despues H05 aplico solamente `014`.

Resultado:

| Concepto | Resultado |
|---|---:|
| Registradas | 17 |
| Baseline local/test | 16 |
| Aplicadas | 1 (`014`) |
| Pendientes | 0 |
| Checksum mismatch | 0 |

Produccion conserva 16 registros. `014` no fue aplicada en produccion.

## 7. Cambios API

Se agrego un helper canonico reutilizable:

```ts
normalizeTeacherExternalIdentifierKey(value)
```

La funcion usa `trim().toUpperCase()` para coincidencia y prevalidacion. El
valor visible conserva el comportamiento vigente del formulario.

`POST /teachers` y `PATCH /teachers/:id`:

- prevalidan identificadores no vacios;
- permiten conservar el identificador del mismo docente;
- confian en el indice PostgreSQL como autoridad final de concurrencia;
- traducen solo `SQLSTATE 23505` de
  `teachers_external_identifier_unique_idx`;
- responden HTTP `409` con codigo estable `IDENTIFICADOR_DUPLICADO`;
- no exponen query, constraint, stack ni datos sensibles.

Otros conflictos `23505`, incluido `teachers_normalized_name_key`, conservan
el manejo general existente.

Las rutas individuales no comparten el advisory lock del futuro importador.
El importador mantendra su lock, fingerprints, `FOR UPDATE` y transaccion unica.

## 8. Pruebas

Cobertura agregada:

- normalizacion canonica;
- deteccion exacta del indice aprobado;
- identificador nuevo;
- duplicado exacto;
- duplicado por mayusculas/minusculas;
- duplicado por espacios laterales;
- multiples identificadores vacios;
- edicion conservando identificador;
- edicion hacia identificador ajeno;
- respuesta `409 / IDENTIFICADOR_DUPLICADO`;
- ausencia de SQL interno en respuesta;
- `normalized_name` sigue independiente;
- PostgreSQL devuelve `23505` con el indice exacto.

Resultados:

| Validacion | Resultado |
|---|---|
| `npm run test:api` | 6 archivos, 24 pruebas, OK |
| `npm run test:api:integration` | 13 archivos, 90 pruebas, OK; solo `nomina_docente_test` |
| `npm run test:web` | 14 archivos, 61 pruebas, OK |
| `npm run typecheck` | API y web, OK |
| `npm run build` | API y web, OK |

Estado H05 final de test despues de las suites:

- 17 registradas;
- 16 baseline;
- `014` aplicada;
- `pending=0`;
- `checksum mismatch=0`.

## 9. Pendientes

- backend del importador H22;
- reglas completas de Preview y Apply, incluida inactivacion;
- frontend Admin;
- pruebas completas del flujo;
- predeploy;
- backup y aplicacion productiva posterior de `014`;
- deploy posterior.

## 10. Confirmaciones

- RH queda excluido como responsable operativo H22.
- La inactivacion con dependencias queda bloqueada.
- La unicidad fisica fue implementada solo en local/test.
- No hubo escrituras productivas.
- No se aplico migracion productiva.
- No se hizo deploy.
- No se modificaron datos fiscales.
- No se modifico H01.
- No se modificaron snapshots ni corridas de Nomina.
