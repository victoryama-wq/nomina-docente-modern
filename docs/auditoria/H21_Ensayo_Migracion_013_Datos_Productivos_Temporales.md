# H21 - Ensayo de migracion 013 con datos productivos temporales

Fecha: 2026-07-20

Estado: ensayo satisfactorio en copia temporal; sin migracion productiva.

## 1. Origen y aislamiento

| Campo | Valor |
|---|---|
| Proyecto | `nomina-docente-prod` |
| Instancia origen | `nomina-docente-web` |
| Base protegida | `nomina_docente` |
| Backup usado | `1784484000000` |
| Tipo | Automatizado, `SUCCESSFUL` |
| Inicio backup | `2026-07-19T20:16:23.138Z` |
| Fin backup | `2026-07-19T20:17:13.866Z` |
| Instancia temporal | `h21-rehearsal-20260720` |
| Motor | PostgreSQL 18, Enterprise, `db-f1-micro`, 20 GB |
| Conexion | Cloud SQL Auth Proxy local `127.0.0.1:25433` |
| Acceso | Identidad GCP autorizada y secreto existente; no se imprimieron credenciales |

La restauracion se ejecuto exclusivamente sobre la instancia temporal. La
instancia productiva fue origen del backup y no recibio DDL ni DML.

## 2. Precheck H05

Antes de aplicar `013`:

- migraciones filesystem: 16;
- baseline registrado: 15;
- pendientes: 1 (`013_h21_subject_import_search.sql`);
- checksum mismatch: 0;
- `unaccent` y `pg_trgm`: no instaladas en la copia previa;
- advertencias historicas 007/008/009: sin cambio.

Se ejecutaron `inspect`, `status` y `dry-run` contra la copia temporal. Luego
H05 aplico exclusivamente `013`.

## 3. Comparacion antes/despues

| Metrica | Antes | Despues | Resultado |
|---|---:|---:|---|
| Asignaturas | 281 | 281 | Igual |
| Horarios | 594 | 594 | Igual |
| Horarios sin `subject_id` | 0 | 0 | Igual |
| Horarios huerfanos | 0 | 0 | Igual |
| Snapshots de horario | 4,738 | 4,738 | Igual |
| Snapshots de extras | 429 | 429 | Igual |
| `normalized_name` vacio/nulo | No existia | 0 | Backfill completo |
| `official_code IS NULL` | No existia | 281 | Legacy permitido |
| Grupos de colision canonica | Diagnostico previo: 5 | 5 grupos de 2 | Preservados |

Fingerprints:

| Conjunto | Antes | Despues |
|---|---|---|
| `subjects.id/name/status` | `0a6b6247698ab3d358448217b2e1ade7` | `0a6b6247698ab3d358448217b2e1ade7` |
| `schedules.id/subject_id` | `0ceffb0a45747240765c4d12f5f4dedb` | `0ceffb0a45747240765c4d12f5f4dedb` |
| `payroll_schedule_details` | `c27d20e6440a75af8608578c58fadcb9` | `c27d20e6440a75af8608578c58fadcb9` |
| `payroll_extra_details` | `1a0c9d90d872a85eb77331ef03fbe3c3` | `1a0c9d90d872a85eb77331ef03fbe3c3` |

Los cinco grupos se contaron con `normalize_subject_search` despues del
backfill. No se listaron nombres ni se fusionaron registros.

## 4. Objetos creados

- extension `unaccent` 1.1;
- extension `pg_trgm` 1.6;
- columnas `official_code` y `normalized_name`;
- trigger `subjects_normalized_name_trg`;
- constraint `subjects_official_code_format_chk`;
- indice unico parcial `subjects_official_code_unique_idx`;
- indice GIN `subjects_normalized_name_trgm_idx`.

La ejecucion registrada fue de 334 ms en `schema_migrations` y 413 ms en
`schema_migration_runs`. No se observaron sesiones esperando locks al cierre,
errores SQL, checksum mismatch ni migraciones adicionales.

## 5. Estado H05 posterior

- registradas: 16;
- baseline: 15;
- aplicadas: 1 (`013`);
- pendientes: 0;
- checksum mismatch: 0.

Este estado existio solo en la instancia temporal. Produccion conserva su
baseline 001-012 y no recibio `013`.

## 6. Pruebas contra la copia

Se validaron con `app.inject()` y actor Admin de test, sin Firebase real:

- descarga de plantilla de catalogo: HTTP 200;
- preview del catalogo restaurado: HTTP 200;
- no se invoco el endpoint apply.

La suite de integracion completa no se apunto a esta copia porque su guard exige
exactamente `nomina_docente_test` y reconstruye datos. Se ejecuto posteriormente
contra la base local permitida.

## 7. Eliminacion posterior

Finalizadas las validaciones:

- se cerraron los proxies locales;
- se elimino `h21-rehearsal-20260720`;
- la consulta posterior devolvio 404, confirmando que la instancia ya no existe;
- el backup administrado original no se elimino.

## 8. Confirmaciones

- Sin migracion productiva.
- Sin DDL/DML en `nomina-docente-web`.
- Sin cambios de datos productivos.
- Sin borrado o fusion de asignaturas.
- Sin cambios H01.
- Sin deploy.
