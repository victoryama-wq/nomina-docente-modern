# H24 - Preparacion de prueba de constancias en GCS aislado

Fecha: 2026-10-28.
Autorizacion humana: habilitar lo necesario para probar la sustitucion y borrado
de constancias, exclusivamente local/H24 y con PDF sinteticos.
Estado: **almacenamiento preparado; carga A y sustitucion por B realizadas por
el usuario y verificadas por lectura en BD/GCS el 2026-10-28**.
No constituye cierre de H24 ni autorizacion de deploy.

## Recursos y permisos

| Concepto | Valor verificado |
|---|---|
| Proyecto | `nomina-h24-test-20261027`, ACTIVE |
| Numero | `234692275301` |
| Bucket nuevo | `gs://nomina-h24-test-234692275301-constancias` |
| Creacion UTC | `2026-10-28T14:53:20Z` |
| Region / clase | US-CENTRAL1 / STANDARD |
| UBLA / publicAccessPrevention | true / enforced |
| Versionado | false explicito |
| Soft delete | 0 segundos explicitos |
| Retencion / objectRetention / holds por defecto | Ausentes |
| API / web | `127.0.0.1:8084` / `localhost:5184` |
| BD | `nomina_docente_test`, `127.0.0.1:55440` |

Se reutilizaron las SA del proyecto H24; no se generaron claves ni roles nuevos.
Bindings nuevos solo sobre este bucket:

- `h24-dossier-runtime`: rol existente `h24DossierRuntime`, con
  `storage.buckets.get`, `storage.objects.create/get/delete`.
- `h24-dossier-auditor`: rol existente `h24DossierAuditor`, de lectura/listado.

Sin allUsers/allAuthenticatedUsers ni ampliacion de roles productivos. Se
conservan los bindings automaticos de propietarios/lectores/editores del proyecto
de pruebas; no se afirmo una auditoria de todos los ancestros de organizacion.
El bucket de PDF adicionales se mantuvo separado y sin cambios. Tampoco se
modifico la cuenta de facturacion ni la configuracion global de proyecto gcloud.

## Validacion previa real

Entre `2026-10-28T15:00:37.869Z` y `2026-10-28T15:00:44.338Z`, el adaptador actual
`constanciaStorage` con las credenciales runtime H24 verifico:

- Politica del bucket aceptada sin relajar ninguna guarda.
- Dos cargas de PDF sinteticos, lectura y SHA-256 identico.
- Borrado fisico de cada objeto mediante precondicion de generacion.
- GET del objeto vigente y de su generacion exacta: 404 tras el borrado.
- Repeticion del borrado: idempotente.
- Inventario posterior independiente con SA auditor, incluyendo versiones:
  vacio, comando finalizado con exit 0.
- Fingerprints de tablas persistentes locales antes/despues: sin cambios.

Esto verifica el adaptador y GCS, no sustituye la prueba manual del endpoint
de reemplazo ni el ensayo de fallos/worker programado. No se subio un documento
real ni se escribio en `teachers` o `teacher_documents` para esta preparacion.

## Preparacion manual

La configuracion ignorada local H24 ahora fija `CONSTANCIAS_BUCKET` al bucket
nuevo. API reiniciada mediante su lanzador aislado, con guard de base/host/puerto.
Health API 200, frontend 200 y sesion sin token 401. No se revoco ni controlo la
sesion de invitado del usuario.

PDF generados en `C:\Users\Admin\Downloads\H24-Constancias-Prueba`:

- `constancia-prueba-A.pdf`: primera carga, sin validez fiscal.
- `constancia-prueba-B.pdf`: sustitucion, sin validez fiscal.

Docente sintetico disponible y sin documentos previos:
`Docente QA 02a96d03-05d3-480c-879d-0eb5222efd84`, ACTIVO.
Se guardo evidencia privada del objetivo y fingerprints antes del ensayo manual.
Respaldo local `before-manual-constancias.dump`, pg_dump exit 0 sin advertencias,
fuera del repositorio bajo el directorio privado H24.

Procedimiento: entrar a Expediente Fiscal local, usar Actualizar constancia para
cargar A, verificar preview, sustituir por B y verificar preview/descarga de B.
Despues comprobar por lectura GCS/BD que A ya no existe, B es la unica vigente,
no quedan pendientes de limpieza y no cambiaron datos del docente ni snapshots.
No repetir cargas si aparece aviso de limpieza pendiente; informar y reconciliar
de forma controlada. Este procedimiento se ejecuto despues de la preparacion;
el resultado se registra a continuacion. B permanece disponible para revision,
sin eliminar el documento vigente como parte de la comprobacion.

## Resultado posterior a la prueba manual

El usuario confirmo haber cargado A y sustituido por B sobre el docente sintetico
indicado. Verificacion read-only terminada a `2026-10-28T15:27:25.636Z`, con guard
de `nomina_docente_test`, loopback 55440 y bucket del proyecto H24.

| Comprobacion | Resultado |
|---|---|
| A, carga UTC | 2026-10-28T15:23:49.104Z |
| A, metadata | `CONSTANCIA_FISCAL_DELETED`, no vigente |
| A, objeto GCS | GET metadata 404; eliminado fisicamente |
| B, carga UTC | 2026-10-28T15:24:18.304Z |
| B, metadata | `CONSTANCIA_FISCAL`, unica vigente |
| B, objeto GCS | Disponible, application/pdf, 1,555 bytes |
| B, integridad | SHA-256 identico al PDF sintetico local B |
| Inventario independiente con auditor y todas las versiones | Unicamente B; generacion `1793201059272242` |
| Staging / borrado pendiente del docente | 0 |
| Auditoria del docente | Dos `TEACHER_CONSTANCIA_UPLOADED` |

Fingerprints contra la preparacion: solo cambiaron `teacher_documents` (0 -> 2
filas, metadata de A/B), `audit_log` (108 -> 110) y `app_users` (22 -> 22).
Los demas usuarios permanecen identicos. Comparacion de la fila QA contra el
backup local: **solo `last_login_at` cambio**; no rol, estado ni permisos.
`teachers` completo permanece identico, incluidos telefono y campos fiscales.
Nomina, corridas, snapshots y las demas tablas persistentes mantienen fingerprints.

La metadata de A se conserva para trazabilidad, no contiene los bytes del PDF.
No se borro B ni se hizo limpieza adicional. Esta comprobacion no ejecuto DML,
worker, migraciones, deploy ni escrituras GCS; las dos cargas corresponden a la
accion manual autorizada del usuario. Evidencia detallada privada bajo el
directorio local H24; no contiene tokens en el documento versionado.

La lectura de B se verifico mediante SDK autenticado y hash, no se presenta como
confirmacion humana de preview/descarga del navegador, que no fue reportada
explicitamente. El flujo nominal de sustitucion queda validado en local/H24;
fallos reales/reconciliacion programada, seguridad y demas gates de H24 siguen
pendientes. No equivale a cierre operativo ni permiso para deploy.

## Confirmaciones

Sin produccion, Cloud SQL, deploy, migraciones, seeds, cambios funcionales,
dependencias nuevas ni cambios de permisos de usuarios. Solo recurso GCS de
prueba, bindings acotados, configuracion local ignorada, PDF sinteticos y
documentacion. Cambios AUTH-01/UX pendientes preservados. Sin commit/push.
