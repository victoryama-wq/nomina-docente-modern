# H24 PD-03 A4 - Integracion de PDF/ClamAV con BD test y GCS aislado

Fecha: 2026-10-28.
Commit ensayado: `5c4084bf20db7becac7b5538ef378d840b610439`.
Rama: `feature/h02-h03-user-coordinations-permissions`.
Estado: **A4 aprobada en alcance de integracion API/BD test/GCS aislado.
PD-03 permanece abierto; H24 NO-GO, sin permiso de deploy.**

## 1. Alcance y aislamiento

Autorizacion humana para carga, reemplazo, lectura y recuperacion en
`nomina_docente_test` y almacenamiento H24, con respaldo y restitucion. No se
autorizaron ni ejecutaron cambios productivos, deploy, migraciones, IAM, roles,
dependencias o cambios funcionales. Se ensaya el codigo A3 publicado, sin modificarlo.

- BD confirmada por SELECT: `nomina_docente_test`, `127.0.0.1:55440`.
- Proyecto propietario de ambos buckets: `nomina-h24-test-20261027` / `234692275301`.
- PDF adicionales: `nomina-h24-test-234692275301-dossier`.
- Constancias: `nomina-h24-test-234692275301-constancias`.
- Credencial runtime y auditor de H24 por impersonacion; sin claves nuevas ni IAM.
- Docker Desktop Linux, imagenes/parser/firmas de A3, sin red en los contenedores.
- Fastify `app.inject`, rutas reales y runtime factory nominal; sin listener nuevo.
- Autenticacion del registro existente `NODE_ENV=test`, con actor Admin persistido.
  No se presentan los resultados como smoke Firebase/navegador o matriz completa PD-05.
- Docente sintetico exclusivo: `02fb4827-3955-4a92-9b86-4e383007662f`.
  No se modifica su ficha ni se crean docentes/usuarios.
- La constancia B manual del docente `02a96d03-05d3-480c-879d-0eb5222efd84`
  queda fuera del ensayo y se conserva en el inventario de referencia.

Se permiten objetos benignos sinteticos en GCS. Malformados/JS inerte se presentan
al endpoint para verificar rechazo previo, nunca se cargan directamente en GCS.
No se usa EICAR en BD, HTTP, storage cloud o navegador durante A4; su prueba sigue
siendo el laboratorio A1/A2/A3. No hay archivos de docentes reales.

## 2. Respaldo y controles previos

Respaldo local pg_dump formato custom, exit 0; `pg_restore -l` exit 0 antes de
escribir. Archivo privado `before-pd03-a4.dump`, SHA-256:
`c748957a8c65c2ea1e8482f035c86a88e7c19eeb2a3afa012042cb28a932e5e2`.
No es un backup de produccion ni implico conexion a Cloud SQL.

Evidencias/manifest/dump bajo:
`%LOCALAPPDATA%/NominaDocente/H24-PD05-20261027/pd03-a4-20261028/`.
Arnes privado ignorado: `.cache/h24-pd03-a4.mts`, comandos `preflight`, `run`,
`cleanup`. No se versionan credenciales, payloads, archivos ni dumps.

Estado previo: 271 teachers, 20 schema_migrations, 2 teacher_documents historicos
A/B, 0 teacher_dossier_documents, 65 operaciones previas de expediente.
Inventario versions=true: dossier 0, constancias 1 (B manual).
Se capturan fingerprints de todas las tablas public y metadata/inventarios GCS;
se exige igualdad antes de iniciar respecto al respaldo. No reset de public,
test:db:prepare ni suite global de integracion que sustituya los datos existentes.

## 3. Resultados

Inicio del ensayo: `2026-10-28T21:25:42.979Z`. Verificacion independiente final:
`2026-10-28T21:30:53.153Z`. Preflight, run y verify terminaron con exit 0.
Se aprobaron **16 grupos de comprobaciones**, no 16 sesiones humanas.

| Grupo | Resultado observado |
|---|---|
| Admision/permisos | Sin sesion 401 y Coordinador 403 en ambas cargas, antes del cuerpo invalido; sin modificar roles |
| Rechazo previo | Cuatro rechazos 422: malformado/JS inerte en constancia y adicional; fingerprints e inventarios sin cambios |
| Varios documentos del mismo tipo | Dos PDF independientes OTRO, ambos COMPLETE; sin sobrescritura |
| Idempotencia | Repetir operationId conserva documentId y dos documentos, sin alta duplicada |
| Lectura adicional | Cuatro GET inline/attachment, 200, hash de bytes identico, private/no-store y nosniff |
| Reemplazo adicional rechazado | 422; fila/generacion/bytes anteriores identicos |
| Reemplazo adicional aceptado | COMPLETE; objeto anterior ausente, nuevo publicado |
| Constancia rechazada | 422 al sustituir con JS inerte; documento vigente preservado, GET 200 con hash y cabeceras correctos |
| Constancia aceptada | Sustitucion correcta, GET del objeto anterior 404, nueva lectura con hash esperado |
| Scanner no disponible | Cuatro 503, carga/lectura de ambos tipos; BD y GCS identicos antes/despues |
| Carga interrumpida | Excepcion tras put real deja PREPARED; scanner caido mantiene PREPARED/DOSSIER_RETRY_REQUIRED; recuperacion revalida y completa; reintento idempotente |
| Rechazo definitivo al recuperar | Veredicto inyectado sobre PDF benigno: FAILED, candidato eliminado, anterior AVAILABLE y mismos bytes |
| Borrado adicional interrumpido | CLEANUP y lectura 404 mientras pendiente; siguiente process completa |
| Limpieza de constancia interrumpida | Nueva vigente, anterior DELETE_PENDING; reconcile elimina anterior y mantiene vigente legible |
| Staging de constancia abandonado | Excepcion antes de publicar; envejecimiento solo del fixture a 25 h; reconcile elimina objeto y conserva vigente |
| Datos protegidos | Durante ensayo solo cambian las cuatro tablas documentales/auditoria permitidas; resto identico |

No se omitieron casos tras un fallo ni se modifico codigo funcional para pasar.
La carga multiple representa dos solicitudes reales consecutivas, como la API por
archivo; no es evidencia nueva del selector multiarchivo ni de carga concurrente UI.
La recuperacion usa una instancia nueva del servicio, no un reinicio de Cloud Run.
No se ejecuto un worker global que pudiera procesar operaciones anteriores de otros
ensayos: process por operationId y reconcile de constancias por docente sintetico.
El permiso definitivo se revalida por el servicio contra el actor persistido.

No se repitio Firebase/Auth real, roles RH/Finanzas completos, ni smoke visual de
Brave. A4 no sustituye los resultados y pendientes PD-05. No se ejecutaron
test:api:integration/reset globales, ni tests/build generales, al no cambiar codigo.
Las regresiones API/web/typecheck/build de A3 permanecen evidencia de ese commit.

## 4. Restitucion

El arnes registra operationIds y docente objetivo antes de operar. Limpieza
acotada a esos objetos/UUID, con evidencia privada de filas sinteticas antes de
retirarlas. No restaura globalmente el dump ni borra registros previos. Los
fingerprints finales y las generaciones GCS deben coincidir con el estado inicial.

**Restitucion completada y confirmada por otro proceso de solo lectura:**

- 26 tablas public: mismos conteos y fingerprints MD5 de filas ordenadas; 0 diferencias.
- Se retiraron solo los 6 registros de operaciones A4 (5 COMPLETE, 1 FAILED esperado),
  sus documentos, 4 filas sinteticas de constancia y 13 eventos de auditoria A4.
  Evidencia privada de esas filas conservada antes de la restitucion.
- Las 65 operaciones anteriores y las 2 filas historicas de constancia A/B permanecen.
- teachers, app_users/roles, campos fiscales y telefono/C.P./CURP, Nomina, corridas,
  snapshots y H05 identicos. H05 conserva 20 filas; no se ejecutaron inspect/apply.
- Dossier: 0 objetos/versiones. Constancias: solo B manual, misma generacion
  `1793201059272242`, tamano/CRC32C e inventario de referencia. Metadata de buckets
  sin cambios; no se modifico retencion, versionado, acceso o IAM.
- Cero operaciones A4 remanentes y cero contenedores h24-security al terminar.
- Copia ADC temporal del auditor retirada; credencial runtime existente conservada.
  No se revocaron sesiones del usuario ni se reiniciaron API/frontend existentes.
- No se hizo una restauracion global ni se borraron datos ajenos para forzar verde.

Archivos privados principales: `manifest.json`, `before.json`, `inventory-before.json`,
`evidence.json`, `during.json`, `synthetic-records-before-cleanup.json`, `after.json`
y `final-verification.json`. SHA-256 del arnes final con modo verify:
`f7f2353c6d282880e0c38b55c98a62dc19a4caf69bd25e7f66c05d5ec4716b19`.

## 5. Limites

Las interrupciones se inyectan alrededor de adaptadores reales. No simulan una
caida global de Google ni reinicio de Cloud Run. La indisponibilidad del scanner
se provoca solo en el proceso del arnes con un ID Docker inexistente, sin pull.
El rechazo definitivo durante recuperacion se inyecta sobre bytes benignos;
no equivale a publicar malware en GCS. No se alteran los servicios de revision.

A4 no decide la politica completa de funciones PDF, el decodificador JPG/PNG,
el riesgo residual del visor, capacidad PD-07 o transporte cloud. PD-03 permanece
abierto y H24 NO-GO. No sustituye los pendientes cloud PD-04 ni sesiones PD-05.

## 6. Confirmaciones y siguiente paso

Hubo escrituras sinteticas autorizadas en test y GCS H24, posteriormente restituidas;
no debe describirse toda la fase como read-only. Sin produccion, Cloud SQL, deploy,
migracion, seeds, cambios funcionales, dependencias, IAM, H01, Nomina o snapshots.
No se cargaron adversos en cloud ni se expusieron datos fiscales en la documentacion.

Validaciones documentales: git diff --check, git diff --name-only y git status.
No se solicito ni realizo commit/push en esta continuacion.
Siguiente prioridad: resolver decodificacion acotada JPG/PNG y acordar politica de
funciones PDF/visor; despues dimensionamiento y transporte cloud bajo autorizacion
separada. A4 por si sola no autoriza el deploy de H24.
