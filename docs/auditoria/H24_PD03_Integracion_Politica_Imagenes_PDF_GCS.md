# H24 PD-03 - Integracion de politica JPG/PNG/PDF con BD test y GCS

Fecha: 2026-10-29.
Commit ensayado: `224db3c3baa264a4a52044aacbc40fa0260db1c0`.
Rama: `feature/h02-h03-user-coordinations-permissions`; arbol inicial limpio.
Estado: **punto 4 aprobado en integracion API/BD test/GCS, con restitucion verificada**.
PD-03 permanece abierto; H24 NO-GO para deploy.

## 1. Autorizacion y alcance

El usuario autorizo expresamente el punto 4 posterior a la implementacion de la
[politica e inspector locales](H24_PD03_Implementacion_Imagenes_PDF_Visor_Local.md):
escrituras temporales exclusivamente en nomina_docente_test y buckets H24, con
respaldo y restitucion. No autoriza produccion, migraciones, deploy ni IAM.
Se reutiliza y amplia el arnes A4; no se modifica codigo funcional ni dependencias.

- BD comprobada mediante SELECT: `nomina_docente_test`, `127.0.0.1:55440`.
- Proyecto propietario: `nomina-h24-test-20261027`, numero `234692275301`.
- Adicionales: `nomina-h24-test-234692275301-dossier`.
- Constancias: `nomina-h24-test-234692275301-constancias`.
- Runtime/auditor H24 por impersonacion; no claves nuevas ni cambio de permisos.
- Fastify app.inject, rutas/servicios reales, BD y GCS reales aislados. Actor Admin
  existente y autenticacion NODE_ENV=test. No es smoke Firebase ni navegador.
- Docente QA `02fb4827-3955-4a92-9b86-4e383007662f`, sin documentos/operaciones
  previos, seleccionado por guardas; la
  constancia B manual del docente `02a96d03-05d3-480c-879d-0eb5222efd84` queda excluida.

Solo bytes benignos sinteticos se publican en GCS. Rechazos se presentan al
endpoint local antes de staging: PDF malformado, JS inerte, portfolio vacio e
imagenes truncadas. Sin EICAR ni malware real en HTTP, BD, GCS o navegador.
El rechazo definitivo de recuperacion se inyecta sobre un PDF benigno, no se
almacena contenido adverso para simularlo.

## 2. Precheck, respaldo y referencia

El cluster aislado estaba apagado y se inicio solo en loopback/puerto 55440, sin
reset, seeds ni recrear nomina_docente_test. No se interviene el servicio PostgreSQL
habitual. Las imagenes locales existentes se verificaron sin reconstruir/publicar:

- Inspector: `sha256:d9147e0cb6ee7f3d0feb9a3d7d4a82021c2d9890dbcaf53233dd9f8a0bc5454e`.
- AV: `sha256:5e14fd90d6a4d35b87dcde8ce555627061904288e42fb15c28084b018afd8360`.
- Volumen de firmas: `h24-pd03-signatures-20261028`, montado read-only.
- Procesamiento Docker sin red, no root, limites A3/politica vigentes.

Preflight exit 0, bucket safety y pipeline real aprobados. pg_dump custom y
pg_restore -l exit 0 antes de escribir. Respaldo `before-pd03-policy.dump`, SHA-256:
`02640069047260104201dd9a4311c582c0616ec8a8f75ee2d88a5f2dbda620d8`.

Evidencias privadas en
`%LOCALAPPDATA%/NominaDocente/H24-PD05-20261027/pd03-policy-integration-20261029/`.
Arnes ignorado `.cache/h24-pd03-policy-integration.mts`; modos preflight/run/cleanup/verify.
SHA-256: `d19562d57d99b47c96be6965a0cf0182089099a8b9ca861617fdb55a3f416874`.
No versionar dumps, credenciales, payloads ni manifests privados.

Referencia previa: 26 tablas public; 271 teachers, 20 schema_migrations,
2 teacher_documents A/B historicos, 0 teacher_dossier_documents,
65 operaciones previas. GCS: dossier 0, constancias 1 (B manual).
Se exige igualdad de fingerprints e inventarios contra el respaldo antes de run.

## 3. Resultado de la integracion

Preflight, run y verify terminaron con exit 0. Inicio del ensayo:
`2026-10-29T16:38:11.687Z`; verificacion final independiente:
`2026-10-29T16:51:42.398Z` (11:51 America/Cancun).
**19 grupos aprobados**, sin fallos de asercion ni casos omitidos para pasar.

| Grupo | Resultado observado |
|---|---|
| Admision/permisos | 401 sin sesion y 403 Coordinador antes del cuerpo invalido; sin cambiar roles |
| PDF rechazados antes de staging | 6 respuestas 422: malformado, JavaScript inerte y portfolio vacio, en constancias y adicionales; BD/GCS identicos |
| Imagenes rechazadas antes de staging | PNG/JPEG truncados: 422. Imagenes validas en adicionales: 415, se conserva PDF-only; BD/GCS identicos |
| Constancia PNG | Carga 200, dos lecturas con MIME/cabeceras/hash exactos, reemplazo truncado rechazado sin cambios; inspector ausente da 503 en carga/lectura; relectura 200 al restablecer |
| Constancia JPEG | Mismas verificaciones que PNG; objeto PNG sustituido ausente en GCS |
| Dos documentos del mismo tipo | Dos PDF OTRO independientes, ambos COMPLETE |
| Idempotencia | Repetir operationId conserva documentId y conteo, sin duplicar |
| Preview/descarga adicional por API | Cuatro GET inline/attachment 200, hash exacto, private/no-store y nosniff |
| Reemplazo adicional rechazado | 422, fila/generacion/bytes vigentes intactos |
| Reemplazo adicional aceptado | COMPLETE, objeto anterior fisicamente ausente |
| Constancia PDF rechazada | Sustitucion con JS inerte 422, vigente intacta y lectura con hash esperado |
| Constancia PDF aceptada | Nueva lectura correcta, objeto anterior 404 |
| Scanner ausente | Cuatro 503 entre carga/lectura de ambos flujos; BD/GCS sin cambios |
| Carga interrumpida y recuperada | Excepcion tras put real deja PREPARED; scanner ausente mantiene pendiente; nueva instancia revalida y completa, reintento idempotente |
| Rechazo definitivo al recuperar | Veredicto inyectado sobre PDF benigno: FAILED, candidato eliminado y anterior AVAILABLE/bytes intactos |
| Borrado adicional interrumpido | CLEANUP, lectura 404 mientras pendiente, process posterior completa |
| Limpieza de constancia interrumpida | Nueva vigente, anterior DELETE_PENDING; reconcile elimina anterior y conserva lectura correcta |
| Staging abandonado | Excepcion antes de publicar; solo fixture envejecido a 25 h; reconcile lo elimina |
| Datos protegidos | Durante ensayo solo cambiaron audit_log y las tres tablas documentales; resto de fingerprints identicos |

### Restitucion y comprobacion independiente

La limpieza en finally se limita a teacherId/operationIds/documentIds del manifest.
Se conserva evidencia privada antes de retirar registros sinteticos. No se restaura
globalmente el dump ni se eliminan datos ajenos para obtener igualdad.

- 26 tablas public: mismos conteos y fingerprints MD5 de filas ordenadas; cero
  diferencias confirmadas por otro proceso verify de solo lectura.
- Se retiraron 6 operaciones del ensayo (5 COMPLETE y 1 FAILED esperado), sus
  documentos, 6 registros sinteticos de constancia y 15 eventos de auditoria.
- Las 65 operaciones previas, 2 registros historicos A/B y 271 docentes permanecen.
- teachers, usuarios/roles/permisos, campos fiscales, telefono/C.P./CURP, Nomina,
  horarios, incidencias, extras, corridas y snapshots conservan conteos/fingerprints.
- H05 mantiene 20 filas registradas y su fingerprint; no se ejecutaron comandos
  H05 ni se afirma una inspeccion nueva de pending/checksums productivos.
- Dossier: 0 objetos/versiones. Constancias: solo B manual, misma generacion
  `1793201059272242`, tamano y CRC32C. Metageneraciones de buckets identicas;
  sin cambios de IAM, versionado, retencion o soft delete.
- Cero contenedores h24-security al terminar; copia temporal ADC del auditor
  retirada, credencial runtime existente conservada. Sin revocar sesiones.
- Cluster aislado apagado con parada smart al terminar, como al inicio. El servicio
  Windows PostgreSQL ajeno sigue activo; no se reiniciaron API/frontend de revision.

Evidencia privada: manifest.json, before.json, inventory-before.json, evidence.json,
during.json, synthetic-records-before-cleanup.json, after.json y final-verification.json.
La comparacion del respaldo SHA-256 tambien paso en verify. `pg_restore -l`
acredita lectura del archivo, no un ensayo adicional de restauracion completa.

No se repitieron suites generales, build ni test:api:integration/reset: no hubo
cambios funcionales y esa suite podria sustituir fixtures locales. Se ensayo
directamente el commit indicado con rutas reales y servicios aislados.

## 4. Limites y pendientes

No prueba interfaz, login real ni compatibilidad con documentos institucionales.
GET de constancia sirve bytes inline; no se atribuye a ese endpoint un modo
attachment nuevo. Descarga del navegador y responsive conservan evidencia local
de la fase anterior, no se reejecutan aqui. Cargas multiples son solicitudes
consecutivas, no una prueba de concurrencia o capacidad.

Las fallas se inyectan en adaptadores/proceso del arnes. No son caidas reales de
Google ni reinicios de Cloud Run. Recuperacion se limita a operationIds propios y
reconcile al docente sintetico; no se ejecuta worker global sobre pendientes previos.

El punto 4 no acepta implicitamente el riesgo residual del visor, no valida el
transporte cloud ni cierra PD-07/otros gates H24. No hay autorizacion de deploy.

## 5. Confirmaciones

Fase con escrituras sinteticas autorizadas, no read-only. Sin produccion, Cloud SQL,
migraciones, deploy, seeds, IAM, cambios H01, roles, codigo funcional o dependencias.
No se modifica ficha del docente, telefono/C.P./CURP, datos fiscales, Nomina,
corridas ni snapshots; fingerprints finales identicos.
Sin commit/push automaticos.

Validaciones documentales: git diff --check, git diff --name-only y git status.
Solo siete documentos versionables cambiados; arnes/evidencia privados ignorados.

Siguiente paso: revisar compatibilidad institucional y riesgo residual del visor,
y resolver transporte/operacion cloud, firmas/parsers y capacidad PD-07 con alcance
explicito. Esta integracion no cierra PD-03 completo ni autoriza deploy H24.
