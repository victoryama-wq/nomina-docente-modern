# H21-F1 - Migracion y busqueda normalizada de Asignaturas

Fecha: 2026-07-18

Estado: implementada y validada exclusivamente en local/test.

## 1. Alcance

Se creo la migracion aditiva `013_h21_subject_import_search.sql` para preparar
clave institucional y busqueda normalizada. No se aplica a produccion.

## 2. Opcion tecnica

`unaccent` es una funcion `STABLE`, no `IMMUTABLE`. Para no declarar una
volatilidad incorrecta, `normalized_name` es una columna almacenada mantenida
por un trigger `BEFORE INSERT OR UPDATE OF name`.

La funcion canonica:

- aplica `unaccent`;
- convierte a minusculas;
- reemplaza puntuacion por espacios;
- colapsa espacios;
- aplica trim.

El nombre oficial `subjects.name` no se modifica.

## 3. Cambios aditivos

- extensiones `unaccent` y `pg_trgm`;
- `subjects.official_code text NULL`;
- `subjects.normalized_name text NOT NULL` despues de backfill;
- check de clave en mayusculas, trim y maximo 50;
- indice unico parcial case-insensitive de clave;
- indice GIN no unico de nombre normalizado;
- trigger de mantenimiento.

No existe `UNIQUE(normalized_name)` y las colisiones se preservan.

## 4. Integridad validada

La validacion se ejecuto contra la base exacta `nomina_docente_test` en
`localhost:5432`. Antes de aplicar la migracion, el reset de integracion habia
dejado las tablas H05 sin registros. Para impedir la reaplicacion de SQL
historico, se registro baseline local/test de `001` a `012` y luego H05 aplico
unicamente `013_h21_subject_import_search.sql`.

| Evidencia | Antes | Despues |
|---|---:|---:|
| Asignaturas | 1 | 1 |
| Fingerprint UUID/nombre/estatus | `b88a1dc6b24578a480d16e319325c559` | `b88a1dc6b24578a480d16e319325c559` |
| Horarios | 6 | 6 |
| Horarios sin `subject_id` | 0 | 0 |
| Fingerprint horario/asignatura | `9c9159351fe32f1b5953bb64110dbf3f` | `9c9159351fe32f1b5953bb64110dbf3f` |
| Snapshots de horario | 0 | 0 |

H05 reporto una migracion pendiente y cero checksum mismatch antes de aplicar;
despues registro 15 baseline y una aplicada. No se alteraron UUID, nombres,
estatus, horarios ni snapshots.

## 5. Pruebas

Se agrego `api-h21-subject-schema.integration.test.ts` para extensiones,
columnas, indices, trigger, normalizacion, colisiones no unicas, unicidad de
clave y referencias de Horarios.

Resultados:

- reconstruccion completa `001` a `013` y seed H04: OK;
- prueba granular PostgreSQL: 4/4;
- `normalized_name` faltante: 0;
- extensiones `unaccent` y `pg_trgm`: presentes;
- indice unico de clave e indice trigram no unico: presentes.

## 6. Confirmaciones

- Sin produccion.
- Sin deploy.
- Sin migracion productiva.
- Sin cambios H01.
- Sin cambios a horarios o snapshots.
