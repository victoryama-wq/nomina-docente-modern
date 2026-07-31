# H22 - Deploy productivo de importación de docentes

Fecha: 2026-07-31

Estado: **H22 cerrado operativo**.

## 1. Objetivo

H22 incorpora una importación CSV controlada de datos operativos de docentes,
exclusiva para Admin, con plantillas, Preview, validaciones, fingerprints,
confirmaciones de riesgo y Apply atómico. La ventana H22-F5 aplicó la
migración de integridad `014`, desplegó API y Hosting y validó el flujo sin
ejecutar Apply ni modificar docentes.

## 2. Commit desplegado y regresión

Commit funcional/documental predeploy desplegado:

`030ae693cfb6c459fdd3355954178bd34bf13783`

`030ae69 docs(h22): close teacher import predeploy validation`

Validaciones predeploy:

| Validación | Resultado |
|---|---|
| API | 27/27 |
| Web | 79/79 |
| Integración PostgreSQL | 105/105, exclusivamente `nomina_docente_test` |
| Typecheck | OK |
| Build | OK |
| `npm audit` | 0 críticas; 21 high, 9 moderate y 1 low residuales documentadas |

No se ejecutó `npm audit fix` ni se usó `--force`.

## 3. H05, evidencia previa y backup

Antes de la migración, H05 detectó 17 archivos, 16 migraciones registradas,
pendiente exacta `014_h22_teacher_external_identifier_unique.sql` y cero
checksum mismatch.

Backup on-demand:

| Campo | Valor |
|---|---|
| Proyecto | `nomina-docente-prod` |
| Instancia | `nomina-docente-web` |
| Base protegida | `nomina_docente` |
| Backup ID | `1785456525085` |
| Inicio UTC | `2026-07-31T00:08:45.092Z` |
| Fin UTC | `2026-07-31T00:10:16.406Z` |
| Estado | `SUCCESSFUL` |
| Descripción | `H22-F5 predeploy 030ae69 2026-07-30` |

La evidencia read-only previa confirmó 217 docentes, 69 identificadores no
vacíos, 148 vacíos, siete docentes sin `created_by`, cero identificadores
duplicados y cero nombres normalizados duplicados.

## 4. Migración 014

`014_h22_teacher_external_identifier_unique.sql` se aplicó exclusivamente por
H05. La migración crea el índice único parcial
`teachers_external_identifier_unique_idx` sobre
`upper(btrim(external_identifier))`, excluye valores vacíos y no contiene DML.

Resultado:

- ejecución H05 exitosa;
- migración 014 registrada con estado `success`;
- índice presente con la definición esperada;
- 17 migraciones registradas;
- 15 registros `baseline`;
- migraciones `013` y `014` con estado `applied`;
- `pending=0`;
- `checksum mismatch=0`;
- cero identificadores duplicados.

Los conteos y fingerprints posteriores coincidieron con los previos para
docentes operativos, documentos, información fiscal, horarios, incidencias,
extras, corridas, líneas y snapshots. Las comprobaciones de integridad
referencial produjeron cero huérfanos.

## 5. Deploy API Cloud Run

| Elemento | Resultado |
|---|---|
| Cloud Build | `1c05d173-0b82-45b3-93b8-b81ece7e0ee4` |
| Imagen | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h22-prod-030ae69` |
| Digest | `sha256:8e184919579d73fcfc1ecc3b1884edd5da40bc83891d5407d4cc7be95d215028` |
| Revisión anterior | `nomina-api-00052-xtm` |
| Revisión nueva/vigente | `nomina-api-00053-cjg` |
| Tráfico | 100% a `nomina-api-00053-cjg` |
| Región | `us-central1` |
| Servicio | `nomina-api` |

Se conservaron variables, secretos, CORS, service account, conexión Cloud SQL,
CPU, memoria, concurrencia, timeout, límites de instancias y puerto.

## 6. Deploy Firebase Hosting

| Elemento | Resultado |
|---|---|
| Proyecto/sitio | `nomina-docente-prod` |
| Canal | `live` |
| Release | `1785457082597000` |
| Version | `466c8eb59d99c2dd` |
| Rewrite `/api/**` | Servicio `nomina-api`, región `us-central1` |

El release anterior conservado para rollback es `1784583329978000`, version
`79673723ffe4f297`.

## 7. Healthchecks y logs

- `/api/health` directo Cloud Run: HTTP 200.
- `/api/health` vía Hosting: HTTP 200.
- raíz Hosting: HTTP 200.
- template, Preview y Apply sin sesión: HTTP 401 esperado.
- revisión `nomina-api-00053-cjg`: cero logs de severidad `ERROR` durante la
  validación.
- se observaron únicamente advertencias HTTP 401 esperadas de las pruebas sin
  sesión.

## 8. Smoke autenticado Admin

El usuario ejecutó manualmente y aprobó el smoke productivo:

- pestaña `Catálogos -> Importación de docentes` visible solo para Admin;
- hotfix visual y controles del Preview correctos;
- plantillas vacía, activos y catálogo completo correctas;
- confirmación previa correcta para la plantilla completa;
- diez columnas exactas y ausencia de datos fiscales;
- selección de plantilla activa y Preview correctos;
- docentes existentes resueltos por UUID;
- cero altas accidentales;
- filas existentes `SIN_CAMBIOS`;
- advertencias legacy esperadas y cero bloqueantes inesperados;
- filtros `Resultado`, `Acción` y `Buscar` correctos;
- búsqueda sin acentos;
- before/after limitado a datos operativos;
- sin Base64, fingerprints, SQL o JSON interno visibles.

## 9. Responsive

El usuario aprobó el flujo en:

| Resolución | Resultado |
|---|---|
| 1440 x 900 | OK |
| 768 x 1024 | OK |
| 390 x 844 | OK |

No hubo overflow general. Los filtros permanecieron uniformes, la tabla usó
scroll interno y los modales fueron utilizables.

## 10. Permisos por rol

| Actor | UI | Backend |
|---|---|---|
| Admin | Pestaña visible y smoke aprobado | Acceso autorizado |
| Coordinador | Pestaña oculta | HTTP 403 |
| Dirección | Pestaña oculta | HTTP 403 |
| RH | Pestaña oculta | HTTP 403 |
| Sin sesión | Sin acceso | HTTP 401 esperado |

No se agregaron roles ni permisos productivos.

## 11. Ausencia de Apply y seguridad de datos

Durante H22-F5:

- no se ejecutó Apply;
- no se generó un evento `TEACHER_IMPORT_APPLIED`;
- no se creó, actualizó, inactivó o reactivó ningún docente;
- Preview permaneció read-only;
- no se aplicó ningún CSV institucional;
- datos fiscales, RFC, banco, cuenta, CLABE, tipo de pago y constancias
  permanecieron intactos;
- H01 permaneció intacto;
- Nómina, corridas, líneas y snapshots permanecieron intactos.

## 12. Rollback

No fue necesario aplicar rollback. Recursos disponibles:

- API: devolver tráfico a `nomina-api-00052-xtm`.
- Hosting: restaurar release `1784583329978000`, version
  `79673723ffe4f297`.
- Base: backup `1785456525085`; cualquier restauración exige procedimiento DBA
  aprobado.
- Si un incidente es exclusivo de API/UI, conservar el índice 014 y no
  eliminarlo mediante SQL improvisado.

## 13. Resultado final

H22 queda **cerrado operativo**. La migración 014, API, Hosting, healthchecks,
logs y smoke autenticado fueron satisfactorios.

La capacidad de Apply está disponible para una operación futura, pero ningún
CSV institucional fue aplicado durante el deploy. Toda importación real exige
archivo aprobado, Preview revisado, ausencia de bloqueantes, backup y nueva
autorización humana.
