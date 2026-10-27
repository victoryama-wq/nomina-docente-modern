# H24-PD-02 - Resultado de almacenamiento GCS aislado

Fecha: 2026-10-27. Rama: `feature/h02-h03-user-coordinations-permissions`.
Codigo ensayado: `13952f142a0ad9a0e1a28e830661a6117889ab96`, sin modificaciones funcionales.

**PD-02 cerrado en alcance tecnico local/test de almacenamiento GCS. H24 sigue
NO-GO: no autoriza deploy ni habilitacion productiva.** Autenticacion Firebase real,
roles sin actor local, operacion programada del worker y otros gates siguen
separados y abiertos. No se presenta esta prueba como smoke UI productivo.

## 1. Autorizacion y facturacion

El usuario informo aprobacion de cuota y autorizo continuar con vinculacion,
bucket exclusivo y pruebas PD-02. Se conserva el alcance previamente aprobado:
proyecto de prueba, `us-central1`, hasta 150 MiB de PDF sinteticos, sin carga masiva,
sin produccion ni deploy. La BD local saneada ya estaba autorizada y preparada.

La primera consulta todavia devolvio `billingEnabled=false`. El comando explicito
`gcloud billing projects link nomina-h24-test-20261027` con la cuenta autorizada
terminada en `35CA7B` tuvo exito. La consulta posterior confirmo
`billingEnabled=true` y la cuenta correcta. No se cambio el proyecto global gcloud
ni la vinculacion de ningun proyecto productivo.

APIs habilitadas solo en test: `storage.googleapis.com`, `iam.googleapis.com` y
`iamcredentials.googleapis.com`. No se desplego ninguna aplicacion.

## 2. Recursos y politica real

| Dato | Valor verificado |
|---|---|
| Proyecto | nomina-h24-test-20261027 |
| Numero | 234692275301 |
| Bucket | gs://nomina-h24-test-234692275301-dossier |
| Creacion UTC | 2026-10-27T22:21:10.355Z |
| Region / clase | US-CENTRAL1 / STANDARD |
| Acceso uniforme (UBLA) | true |
| Prevencion de acceso publico | enforced |
| versioning.enabled | false explicito en metadata JSON real |
| softDeletePolicy.retentionDurationSeconds | "0" explicito |
| retentionPolicy / objectRetention / lifecycle | Ausentes |
| defaultEventBasedHold | Ausente, no habilitado |
| Metageneration durante ensayos y verificacion final | 5, sin cambios |

Creado con `gcloud storage buckets create` y flags
`--uniform-bucket-level-access --public-access-prevention --soft-delete-duration=0s`;
versionado explicitamente desactivado mediante `--no-versioning` antes del ensayo.
El bucket era nuevo y vacio. No se habilitaron retenciones, CORS, copias o
notificaciones de objetos. `lockedTime` de UBLA no es una retencion documental.

El adaptador **GoogleDossierStorage real** acepto la metadata; no se relajo
`assertSafe()` ni se normalizaron campos faltantes para hacer pasar la prueba.
La generacion real de GCS fue aceptada por `googleGeneration()`.

## 3. Identidades y permisos

Tres SA nuevas, exclusivamente en el proyecto test, con sufijo
`@nomina-h24-test-20261027.iam.gserviceaccount.com`:

| SA | Rol personalizado con binding solo al bucket | Permisos concedidos |
|---|---|---|
| h24-dossier-runtime | h24DossierRuntime | buckets.get; objects.create/get/delete |
| h24-dossier-auditor | h24DossierAuditor | buckets.get/getIamPolicy; objects.get/list |
| h24-dossier-negative | h24DossierNegative | buckets.get; objects.get |

Permisos con prefijo `storage.`. No se concedio Owner, Editor ni Storage Admin a
las SA. El operador autorizado obtuvo Token Creator individualmente sobre las
tres SA de prueba, no sobre todo el proyecto. Cero claves de SA administradas por
usuario, confirmado con `keys list --managed-by=user` para cada identidad.

`testIamPermissions` verifico 10 permisos por identidad: los permitidos coinciden
exactamente con la tabla; runtime no puede listar, actualizar/borrar bucket,
cambiar IAM ni actualizar objetos. Auditor no puede crear/borrar/actualizar objetos.
Actor negativo no puede crear/borrar/listar. Ademas se ejecutaron rechazos reales
403, no solo inspeccion de bindings. No hay allUsers/allAuthenticatedUsers.

La politica conserva los bindings automaticos legacy de propietarios/editores/
lectores del proyecto test. La politica directa del proyecto muestra al operador
como Owner, no a las SA. No se auditaron ancestros de organizacion ni permisos
globales fuera de este bucket: el resultado es una comprobacion efectiva y acotada.

## 4. Credenciales y aislamiento

ADC anterior devolvio `invalid_grant/invalid_rapt` antes de cargar documentos.
El usuario completo reautenticacion en Brave con configuracion gcloud separada
dentro del directorio privado H24. Las credenciales habituales no se sobrescribieron.
Se utilizaron ADC por impersonacion de las SA de test, sin generar claves privadas.

Un primer intento con quota_project explicito fue rechazado por
`serviceusage.services.use`. Se retiro ese override de las copias ADC temporales;
GCS usa el proyecto propietario del recurso test, comprobado antes de operar.
No se ampliaron permisos para sortearlo ni se uso un proyecto alternativo.

Variables del arnes fijadas al proyecto/bucket test y BD loopback; sin emuladores,
proxy de almacenamiento o defaults productivos. Etapa A no importo pool/API ni
accedio a BD. Etapa B uso exclusivamente `nomina_docente_test`, 127.0.0.1:55440.
No se conecto a Cloud SQL, Secret Manager ni buckets productivos en esta ejecucion.

Al finalizar se eliminaron las tres copias ADC de impersonacion y el ADC aislado
del login de este ensayo. No se revocaron credenciales habituales ni se imprimieron
tokens, passwords o payloads de documentos.

## 5. Etapa A - Adaptador y GCS reales

Ejecucion aprobada: **21/21 comprobaciones**, UTC
`2026-10-27T22:34:21.554Z` a `2026-10-27T22:34:34.268Z`.
Cinco cargas, 7,239 bytes en esa ejecucion; PDF sinteticos de una pagina.

| Caso | Resultado |
|---|---|
| Proyecto propietario, politica, IAM y bucket inicialmente vacio | OK |
| assertSafe del adaptador actual | OK |
| Cargas, lectura y SHA-256 | OK; bytes identicos, application/pdf, private/no-store |
| Crear sobre clave existente | Conflicto esperado; original intacto |
| Reemplazo con clave nueva | Nuevo legible; generacion anterior GET 404 |
| Generacion obsoleta tras recrear misma clave, caso negativo controlado | Conflicto esperado; nueva generacion intacta |
| Borrado correcto y segundo borrado idempotente | OK |
| Actor negativo: crear, borrar y listar | 403 en cada operacion |
| Lectura anonima | 403 |
| Auditor independiente, GET de generaciones retiradas | 404 |
| Inventarios vivos / versions=true finales | 0 / 0 |

Un intento previo se detuvo porque el cliente de upload resumable del caso
negativo entrego un error generico. Se limpiaron sus cuatro objetos usando las
generaciones propias. Se repitio con upload no resumable, coherente con el
adaptador, obteniendo 403 explicito. Solo cambio el arnes ignorado, no la API.

## 6. Etapa B - Fastify, PostgreSQL local y GCS

Backup local previo: `pre-gcs-api-20261027-173600.dump`, 1,264,561 bytes; SHA-256
`C924AC1D0FAB42468722238E87E91009A2456556E459EEA4F0A52F7FB631F2D6`.
No se reseteo la copia saneada, no se aplico migracion ni se crearon docentes.

Se registraron las rutas reales mediante Fastify `app.inject()`, servicio real,
GCS real y pdfinfo Windows local. La imagen Linux ya fue ensayada en PD-01; esta
etapa no equivale a ensayar un contenedor/API desplegado ni una sesion de navegador.
Autenticacion mediante registro de actores `NODE_ENV=test` existente, sin tokens
Firebase reales. Permisos persistidos se revalidaron al publicar los objetos.

Ejecucion final UTC `2026-10-27T22:38:15.728Z` a `2026-10-27T22:38:38.132Z`:
**15 comprobaciones aprobadas y 2 casos sin actor local**.

| Caso | Resultado |
|---|---|
| Admin / Finanzas | GET 200 y carga real autorizada |
| Direccion / Coordinador | GET 403 |
| Sin sesion | 401 |
| RH / Contador | Pendientes en este ensayo: sin actor ACTIVO disponible; no se inventaron usuarios/permisos |
| Varios PDF del mismo tipo | Tres documentos, sin sobrescritura |
| Preview y descarga | Seis GET, SHA-256 identico, inline/attachment y private/no-store correctos |
| Reintento con operationId existente | Sin duplicado |
| Reemplazo | Nuevos bytes legibles; clave anterior ausente |
| Borrado | Documentos retirados y objetos ausentes |
| Fallo controlado antes de borrar en GCS | 202/CLEANUP; lectura 404; servicio reiniciado completa limpieza |
| Fallo antes de cargar | 202; recuperacion termina FAILED/UPLOAD_INTERRUPTED sin residuo |
| Corte real de proceso local tras cargar en GCS | Subproceso termina 77; PREPARED y objeto presentes; proceso nuevo recupera COMPLETE y luego borra |
| Reconcile al terminar | Sin operaciones elegibles pendientes |

No se adelanto el timestamp de operaciones ni se cambio el umbral de cinco
minutos. La recuperacion invoco `process(operationId)` real; no demuestra
programacion/alertas de worker (PD-04). No se probo telefono: PD-02 no necesita
cambiar teachers. Tampoco se probaron datos fiscales.

Un primer intento se detuvo al detectar ausencia de actor RH tras dos cargas.
Sus documentos se eliminaron por las rutas reales, identificados por el manifiesto
de operaciones; no DELETE SQL directo ni reset. La repeticion agrego un tercer
PDF con Admin y dejo RH/Contador explicitamente pendientes.

## 7. Integridad y borrado definitivo acotado

- Bucket final: cero objetos vivos y cero versiones, enumerados por auditor
  independiente con paginacion automatica SDK. Verificacion final UTC
  `2026-10-27T22:44:34.837Z`.
- Metageneration 5 antes/despues, soft delete 0 desde creacion, versionado false,
  sin holds/retenciones. No existian objetos anteriores al ensayo.
- `softDeleted=true` devolvio **400**, no una lista vacia. Es la respuesta
  documentada cuando no hay politica soft delete; no se cambio la politica para
  forzar una lista. Se acepta la evidencia alternativa prevista en el plan PD-02:
  bucket nuevo, politica invariable, GET exactos 404 e inventario de versiones vacio.
  [Contrato GCS](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/list).
- Conclusion: no quedan objetos recuperables por GCS en el bucket ensayado.
  No certifica borrado fisico forense interno de Google ni copias externas.
- BD test: cero documentos, cero operaciones no terminales y payloads/claves de
  operaciones purgados. Se conservan 16 operaciones de prueba (15 COMPLETE,
  1 FAILED esperado) y 31 eventos de auditoria, incluyendo el intento inicial y su
  limpieza; no se borraron para ocultar la ejecucion.
- Los fingerprints de **23 tablas restantes** son identicos antes/despues:
  teachers, roles/permisos, Nomina, corridas, snapshots y control H05 incluidos.
  H05 conserva 19 registros; no se ejecuto el runner en esta continuacion.
- Solo hubo escrituras de expediente/auditoria en la BD local autorizada y objetos
  sinteticos en GCS test. No afirmar que toda la ejecucion fue read-only.

## 8. Evidencia y recursos restantes

Directorio privado fuera de Git:
`C:\Users\Admin\AppData\Local\NominaDocente\H24-PD02-20261027`.

- `gcs-adapter-evidence-1793140461554.json`: etapa A final.
- `gcs-adapter-evidence.json`: primer intento, detenido y limpiado.
- `gcs-api-evidence-1793140626528.json`: intento local sin actor RH.
- `gcs-api-evidence-1793140683569.json`: limpieza del intento propio.
- `gcs-api-evidence-1793140695730.json`: etapa B final, fingerprints y conteos.
- `gcs-final-evidence.json`: permisos efectivos, metadata, IAM e inventarios.
- `gcs-credential-cleanup.json`: retiro de copias ADC temporales.

Arneses `.cache/h24-pd02-gcs.mts`, `h24-pd02-api.mts` y
`h24-pd02-gcs-final.mjs` ignorados; no forman parte del codigo funcional/versionado.
No se incluyen PDFs, secretos ni volcados en Git.

Se conserva proyecto, bucket vacio, tres SA, roles y bindings de prueba para
continuidad. Token Creator sigue limitado a esas SA para el operador aprobado;
su retirada y la baja de recursos requieren decidir conservacion/limpieza A7.
No se borro proyecto, bucket o identidades automaticamente. No hay API/web nueva
escuchando; Fastify y pools del arnes cerraron. El cluster test preexistente sigue
disponible en loopback. Costes de solicitudes del ensayo quedan en test; no se
presenta el limite de 150 MiB como presupuesto automatico de facturacion.

## 9. Cierre y siguientes pasos

PD-02 cierra exclusivamente compatibilidad, politica, permisos y operaciones GCS
de prueba, incluido reintento/recuperacion con PostgreSQL saneado. No cierra:

- PD-05 / AUTH-01: Firebase real, sesiones por rol, RH/Contador pendientes aqui.
- PD-03: estrategia de PDF malicioso; pdfinfo no es antivirus.
- PD-04: worker programado, alertas, operacion y envejecimiento de pendientes.
- PD-06/07/08: triage de dependencias, capacidad y requisitos DBA/release restantes.
- Provisionamiento, permisos y configuracion productivos, que no se inspeccionaron.

Recomendacion: continuar PD-05 con identidades de prueba aprobadas y resolver
PD-03/04 antes de solicitar release. H24 permanece **NO-GO**.

Validaciones: arneses reales anteriores; `git diff --check`, `git diff --name-only`
y `git status`. No se ejecuto la suite general ni test:db:prepare/reset, para no
destruir la copia saneada. Sin cambios de codigo, SQL, dependencias, H01,
migraciones, produccion o deploy. Commit/push no solicitados en esta continuacion.
