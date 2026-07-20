# H21 - Deploy productivo de importacion de Asignaturas

Fecha: 2026-07-20

Estado: cerrado operativo.

## 1. Objetivo

H21 incorpora busqueda normalizada de Asignaturas, importacion CSV controlada
con template/preview/apply, seleccion estricta por `subjectId` en Horarios y la
conciliacion documentada de cinco pares legacy. Esta ventana productiva no
aplico un CSV institucional con altas o cambios masivos.

## 2. Commits desplegados

- `0735782 feat(h21): add subject search schema migration`.
- `e667bc2 feat(h21): add subject csv import api`.
- `21824d1 fix(h21): use subjects catalog as schedule source`.
- `a5eec53 feat(h21): add subject csv import ui`.
- `89fbfa2 fix(sec): update vulnerable websocket-driver resolution`.
- `1b449a1 fix(h21): reconcile legacy duplicate subjects`.
- `ceb15b5 docs(h21): validate duplicate subject reconciliation`.

## 3. Predeploy y seguridad npm

| Validacion | Resultado |
|---|---|
| API | 22/22 |
| Web | 61/61 |
| Integracion PostgreSQL | 83/83, exclusivamente `nomina_docente_test` |
| Typecheck | OK |
| Build | OK |
| `npm audit` | 0 criticas; 1 low, 10 moderate y 5 high residuales documentadas |
| `websocket-driver` | `0.7.5`; advisory critico ausente |

No se ejecuto `npm audit fix` ni se uso `--force`.

## 4. H05 y backup

Antes de la migracion, H05 reporto 16 archivos, 15 migraciones baseline, una
pendiente (`013_h21_subject_import_search.sql`) y cero checksum mismatch.

Backup on-demand:

| Campo | Valor |
|---|---|
| Proyecto | `nomina-docente-prod` |
| Instancia | `nomina-docente-web` |
| Backup ID | `1784582556252` |
| Inicio UTC | `2026-07-20T21:22:36.258Z` |
| Fin UTC | `2026-07-20T21:24:07.633Z` |
| Estado | `SUCCESSFUL` |

Despues del apply, H05 quedo con 16 migraciones registradas, 15 baseline, una
aplicada, `pending=0` y `checksum mismatch=0`.

## 5. Evidencia previa y conteo 282

La consulta inmediatamente anterior a aplicar `013` registro:

| Entidad | Conteo |
|---|---:|
| `subjects` | 282 |
| `schedules` | 594 |
| Horarios sin `subject_id` | 0 |
| Horarios huerfanos | 0 |
| `payroll_schedule_details` | 4,738 |
| `payroll_extra_details` | 429 |
| `payroll_runs` | 8 |

El conteo de 282 ya existia antes de la migracion. La asignatura adicional
frente al ensayo temporal fue `DIPLOMADO BIM`, creada operativamente antes de
esta ventana, activa y sin horarios asociados. La migracion `013` no contiene
`INSERT INTO subjects`; el SQL de conciliacion tampoco contiene altas de
asignaturas. Por tanto, no se identifico ninguna insercion atribuible a
H21-F5.

Fingerprints previos protegidos:

| Entidad | Fingerprint MD5 |
|---|---|
| `schedules` | `341e52152d3dd6af6bb6c8b415dbdd45` |
| `payroll_schedule_details` | `7ea915fdb2b9729d519328c863c2baa9` |
| `payroll_extra_details` | `8e620911d20cdb4b0e6553fa17c66aa4` |
| `payroll_runs` | `030c7a8e2a1610d115ada63b4f7e9f01` |

Los cinco pares conservaron la distribucion aprobada de horarios a mover:
`1, 1, 1, 1, 4`, para un total de ocho.

## 6. Migracion 013

`013_h21_subject_import_search.sql` se aplico exclusivamente mediante H05.
La validacion posterior confirmo:

- extensiones `unaccent` y `pg_trgm` instaladas;
- `subjects.official_code` nullable;
- `subjects.normalized_name` completo y `NOT NULL`;
- trigger `subjects_normalized_name_trg` presente;
- indices `subjects_official_code_unique_idx` y
  `subjects_normalized_name_trgm_idx` presentes;
- 282 asignaturas y 594 horarios;
- cinco grupos normalizados preservados antes de conciliarlos;
- snapshots y corridas sin cambios.

## 7. Conciliacion productiva

El archivo versionado
`database/validation/h21_reconcile_duplicate_subjects_APPROVAL_REQUIRED.sql`
se ejecuto primero sin modificar su `ROLLBACK`. El preview confirmo:

- cinco mappings y diez UUID validos;
- ocho horarios, con conteos `1, 1, 1, 1, 4`;
- cinco canonicos activos y cinco duplicados inactivos dentro de la
  transaccion;
- once eventos de auditoria dentro de la transaccion;
- fingerprints iguales despues del rollback.

La ejecucion aprobada uso una copia temporal cuyo unico cambio fue la ultima
sentencia `ROLLBACK` por `COMMIT`. Resultado:

- ocho horarios reasignados, conservando sus IDs;
- solo cambiaron `subject_id` y `subject_name` en esos horarios;
- cinco asignaturas canonicas `ACTIVO`;
- cinco duplicados historicos `INACTIVO`;
- 282 asignaturas, 594 horarios y cero huerfanos;
- once eventos persistentes en `audit_log`;
- ningun `DELETE` ni fusion fisica.

El fingerprint de IDs de los ocho horarios fue
`903c6a48163ee782b19a264f53c7631a`; su informacion invariante, excluyendo
`subject_id` y `subject_name`, conservo
`bda36e36a1a21991abff16ed63be7ee6`.

Los fingerprints posteriores de snapshots y corridas coincidieron con los
previos. H01, Nomina y sus snapshots no fueron modificados.

## 8. Plantilla y preview productivos

La validacion controlada mediante `app.inject()` con actor Admin, sin invocar
Apply, obtuvo:

| Prueba | Resultado |
|---|---|
| Plantilla activa | HTTP 200, 277 filas |
| Plantilla con inactivas | HTTP 200, 282 filas |
| Preview activo | HTTP 200, 277 filas |
| `SIN_CAMBIOS` | 277 |
| `DUPLICADO_NOMBRE_CSV` | 0 |
| `POSIBLE_DUPLICADO_NOMBRE` | 0 |
| Bloqueantes | 0 |

El ajuste de 276 a 277 filas activas corresponde a `DIPLOMADO BIM`, ya
existente antes de `013`.

## 9. Deploy API y Hosting

| Elemento | Resultado |
|---|---|
| Cloud Build | `7ec69c84-e1dc-4e30-8cfc-4b10e5f4bcb7` |
| Imagen | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h21-prod-1b449a1` |
| Digest | `sha256:b087fd5b77771df23367dc630c06e7f59132e8c803f5809e1ed628e026bf839c` |
| Revision anterior | `nomina-api-00051-9s5` |
| Revision nueva/vigente | `nomina-api-00052-xtm` |
| Trafico | 100% a `nomina-api-00052-xtm` |
| Hosting release | `1784583329978000` |
| Hosting version | `79673723ffe4f297` |

Se conservaron variables, secretos, service account, Cloud SQL attached, CORS,
CPU, memoria, concurrencia, timeout y limites de instancias.

## 10. Healthchecks y logs

- `/api/health` directo Cloud Run: HTTP 200.
- `/api/health` via Hosting: HTTP 200.
- raiz Hosting: HTTP 200.
- `/api/auth/session` sin token: HTTP 401 esperado.
- catalogo, template y preview H21 sin token: HTTP 401 esperado.
- nueva revision con cero logs de severidad `ERROR` durante la validacion.

## 11. Smoke manual autenticado

El usuario ejecuto y aprobo el smoke productivo con sesion autorizada.

### Catalogos -> Asignaturas

- la pestana y el catalogo vigente cargan correctamente;
- busqueda sin acentos y en mayusculas aprobada;
- nombres con acentuacion oficial;
- plantilla vacia descargada correctamente;
- plantilla activa con 277 filas;
- preview con 277 `SIN_CAMBIOS`, cero colisiones y cero bloqueantes;
- cinco inactivas consultables solo mediante opcion administrativa explicita;
- no se ejecuto Apply.

### Horarios

- selector alimentado solo por asignaturas activas del catalogo;
- busqueda sin acentos y nombres con ortografia oficial;
- sin alta libre por texto y con `subjectId` obligatorio;
- asignaturas inactivas no seleccionables para altas nuevas;
- horarios existentes visibles;
- ocho horarios conciliados muestran el nombre canonico correcto;
- no se creo ni modifico un horario durante el smoke.

## 12. Rollback

No fue necesario aplicar rollback. Recursos disponibles:

- API: devolver trafico a `nomina-api-00051-9s5`.
- Hosting: restaurar la version anterior documentada en H20.
- Base de datos: backup `1784582556252`; cualquier restauracion requiere
  procedimiento DBA aprobado, no SQL inverso improvisado.

## 13. Resultado final

H21 queda **cerrado operativo**. La migracion, conciliacion, API, Hosting,
healthchecks y smoke autenticado fueron satisfactorios.

Permanece fuera del cierre la aplicacion de un CSV institucional definitivo.
Cualquier Apply futuro requiere archivo aprobado, preview sin bloqueantes,
backup y nueva autorizacion humana.

Confirmaciones:

- no se ejecuto DELETE ni fusion fisica;
- no se aplico CSV institucional;
- no se modificaron docentes, ciclos, coordinaciones, horas o tabuladores;
- no se modificaron snapshots ni corridas guardadas;
- no se cambio H01;
- vulnerabilidades criticas npm: 0.
