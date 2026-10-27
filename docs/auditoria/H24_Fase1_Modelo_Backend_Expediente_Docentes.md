# H24-F1 - Modelo y backend de expediente completo

Fecha: 2026-10-27.

Estado: **H24-F1 implementado y validado en local/test. No desplegado; frontend H24-F2 pendiente. H24 no cerrado operativo.**

## 1. Alcance

Implementacion del modelo y backend aprobados en la SPEC/diseno H24. Constancias y archivos adicionales conservan persistencias separadas. No se modifico frontend, calculos H01/H23, pagos, snapshots, corridas ni datos productivos. No se instalaron dependencias npm.

La configuracion nueva queda `DOSSIER_STORAGE_MODE=disabled` por defecto. No habilitar en produccion hasta completar los gates de almacenamiento, validacion de archivos, worker, migracion y pruebas de capacidad.

## 2. Modelo

`database/016_h24_teacher_dossier.sql` agrega exclusivamente:

- `teacher_dossier_documents`: metadata de PDF adicionales, referencia opaca y generacion, tipo, titulo, tamano, estado, revision y actores.
- `teacher_dossier_operations`: intenciones durables, idempotencia, resultados minimos, referencias temporales y reintentos.

Permite multiples documentos del mismo tipo/nombre. FK restrictiva sobre el docente; tipos y estados limitados mediante CHECK; referencia de objeto unica; indice parcial de una operacion pendiente por documento. No altera `teacher_documents`, su indice de constancia, `teachers` ni datos historicos.

Las operaciones terminadas conservan ID/hash/resultado minimo para evitar duplicados al reintentar; eliminan payload y referencias temporales de archivos. No conservan bytes ni versiones documentales. Auditoria guarda actor, accion, IDs y resultado, no el PDF o ficha fiscal.

## 3. API y autorizacion

Rutas bajo `/teachers/:teacherId/dossier`, tambien disponibles con prefijo `/api` del registro existente:

| Metodo | Sufijo | Funcionalidad |
|---|---|---|
| GET | vacio | Identidad, telefono/version, documentos permitidos y capacidades |
| PATCH | `/contact` | Telefono compartido con Directorio |
| POST | `/documents` | Carga de un PDF; cliente F2 podra enviar una seleccion multiple mediante cola |
| PATCH | `/documents/:documentId` | Tipo/titulo con revision esperada |
| PUT | `/documents/:documentId/content` | Reemplazo seguro |
| GET | `/documents/:documentId/content` | Preview; `download=true` para descarga |
| DELETE | `/documents/:documentId` | Borrado con `operationId` y `expectedRevision` en JSON |
| GET | `/operations/:operationId` | Resultado minimo/pending, sin referencias de storage |

Admin activo, incluida la excepcion protegida, conserva acceso completo. Finanzas/RH necesitan acceso fiscal al modulo y el permiso correspondiente a cada accion. `fiscal.document.manage` permite lectura/gestion; `fiscal.manage` permite telefono. Otros roles quedan denegados incluso con permisos amplios. Alcance global fiscal vigente para Finanzas/RH; no se impone propiedad por `created_by`.

Se aplico la guarda especifica a las rutas fiscales/constancia existentes, sin modificar los helpers compartidos de proyeccion fiscal en otros modulos. Directorio consume tambien esos endpoints: no se otorga una capacidad nueva a roles excluidos. La eliminacion administrativa de docente devuelve 409 si conserva documentos/operaciones pendientes; conserva los bloqueos previos por registros operativos.

El telefono se escribe solo en `teachers.phone`, con version de `updated_at` y transaccion. Actualiza `updated_at/updated_by` como trazabilidad normal, no `created_by` ni fiscales. El DTO exige exclusivamente campos autorizados y rechaza propiedades adicionales.

El nuevo endpoint de contacto normaliza separadores de telefono, conserva el prefijo `+` y rechaza letras/extensiones no admitidas; no cambia el validador de Directorio. UUID de rutas y operaciones se canonizan en minusculas antes de generar claves/hashes.

Contrato de operaciones: HTTP 202 indica pendiente; HTTP 200 contiene estado terminal `COMPLETE` o `FAILED`. F2 debe evaluar siempre `state`/`errorCode`, no interpretar todo HTTP 200 como carga exitosa. Validacion y permisos usan 4xx, infraestructura no disponible 503. Los reintentos de resultados terminales no dependen de que storage/parser sigan disponibles.

## 4. Consistencia e idempotencia

Cada mutacion usa `operationId`, ligado al actor y hash del payload/objetivo. Reutilizarlo con otro contenido devuelve 409; la repeticion exacta devuelve el resultado existente. Documentos usan revision esperada y estados explicitos; el telefono compara version opaca.

Las cargas reservan intencion antes de transferir. El archivo nuevo se valida y se guarda antes de publicar su referencia. Un reemplazo conserva el archivo anterior hasta publicar el nuevo; despues elimina la generacion anterior. Reintentos y recuperacion de objetos escritos antes de una caida verifican hash y permiso persistido antes de publicar.

Se usa bloqueo advisory de sesion por operacion para excluir worker/reintentos simultaneos, sin transaccion SQL abierta durante transferencias. El bloqueo se libera al cerrar la conexion; la intencion sigue en PostgreSQL.

El borrado pasa por `DELETING`, bloquea nuevas descargas y conserva referencias hasta confirmar ausencia en storage. Un fallo devuelve 202/estado pendiente, no exito definitivo. La reconciliacion reintenta operaciones de mas de cinco minutos; una carga interrumpida sin archivo termina fallida y restaura el documento anterior si era reemplazo.

Worker one-shot implementado en `apps/api/src/dossier-reconcile.ts`; tras build puede invocarse como `node apps/api/dist/dossier-reconcile.js`. No expone endpoint HTTP. Fuera de produccion exige loopback y `nomina_docente_test`; produccion exige ademas `ALLOW_DOSSIER_RECONCILE=true`. No se configuro ni ejecuto un scheduler productivo. Su programacion durable y monitoreo son gates antes de release, no un timer en Cloud Run.

## 5. Archivos y storage

- Local: `LocalDossierStorage`, exclusivamente `nomina_docente_test`, host loopback, no modo production, directorio privado temporal. Escritura create-only, claves opacas y checks de generacion/integridad; archivos sinteticos en pruebas.
- GCS: adaptador escrito y probado con mocks del SDK, nunca contra un bucket real en esta fase. Requiere bucket distinto a Constancias, acceso publico impedido, IAM uniforme, versioning deshabilitado explicitamente, soft delete en cero y ausencia de retencion/holds incompatibles. Falla de forma cerrada ante politica desconocida/insegura.
- GCS condiciona creacion y eliminacion por generacion. No se modifico la configuracion del bucket fiscal ni sus archivos historicos.
- Transporte JSON/Base64 por PDF, maximo 7.5 MiB y dos solicitudes de carga/reemplazo por proceso antes de parsear el body. Autoriza antes de reservar cupo/leer el body; limita a 30 segundos su recepcion. No se aumenta el bodyLimit global.
- La seleccion de diez archivos/concurrencia visual de la SPEC queda para F2; no existe endpoint de lote atomico.
- `pdfinfo` de Poppler, configurado por ruta absoluta `DOSSIER_PDFINFO_PATH`, realiza validacion estructural local, rechaza errores de parser, cifrado y JavaScript detectado. Limite conservador de 500 paginas, timeout y salida acotada. El proceso no recibe credenciales/configuracion de la aplicacion por ambiente. No instala Poppler ni modifica Dockerfile; si falta validador, rechaza la carga.
- Esto **no es un antivirus ni una garantia de ausencia de contenido malicioso**. La estrategia de escaneo/aislamiento y el empaquetado aprobado del parser son gates antes del despliegue.
- Preview/descarga autenticados con `application/pdf`, nombre seguro, `nosniff`, CSP restrictiva y `private, no-store`. No devuelve rutas/bucket, Base64, tokens o informacion fiscal.

## 6. Ambiente y validaciones

Base local confirmada por SELECT: `nomina_docente_test`, servidor `127.0.0.1:5432`, proceso local PostgreSQL. Las suites de integracion reconstruyen exclusivamente esa base mediante el harness vigente y fixtures sinteticos. No se utilizo Cloud SQL Auth Proxy ni una BD productiva.

Pruebas de GCS: simulacion SDK, no verificacion de infraestructura real. Pruebas PDF: archivos sinteticos generados con PDFKit y parser Poppler local disponible; sin expedientes personales reales.

| Validacion | Resultado final |
|---|---|
| `npm run test:api` | 145/145, 13 archivos |
| `npm run test:api:integration` | 158/158, 17 archivos; 27 casos de integracion H24 |
| `npm run test:web` | 98/98, 20 archivos; regresion, sin UI H24 nueva |
| `npm run typecheck` | API y web OK |
| `npm run build` | API y web OK; no deploy |
| `git diff --check` | OK |

Cobertura H24: matriz de roles/acciones, aislamiento de DTO, formatos PDF con parser
real, generacion/precondiciones GCS con mocks, archivos locales reales, UUID
canonicos, telefono, no alteracion de datos fiscales y tablas de Nomina/snapshots,
reintentos terminales sin storage/parser, revocacion persistida, fallo antes/despues
de escritura, cleanup pendiente, recuperacion tras reinicio de servicio, carreras
de carga/reemplazo, guardas de eliminacion y conexiones descartadas ante fallo.
Pruebas de admision verifican autorizacion antes del body y limite de dos solicitudes.
El timeout de recepcion de 30 segundos no fue probado con red lenta real; queda en F3.

Durante la primera corrida H24 hubo un fallo de expectativa de test: PostgreSQL 18
devuelve `23001` para la FK `ON DELETE RESTRICT`, frente a `23503` esperado. Se
corrigio la asercion para admitir ambos codigos de restriccion y comprobar la FK;
no se debilito la integridad. La revision tambien corrigio canonicalizacion UUID,
liberacion de conexion, admision temprana y reintentos durante caidas, con regresiones.

H05 local final: **19 migraciones registradas como baseline, 0 pendientes,
0 checksum mismatch**. El harness reconstruyo el esquema con las 19 migraciones,
incluida 016; despues se ejecuto `db:migrate:baseline` exclusivamente en test para
registrar el esquema ya instalado, seguido de `db:migrate:inspect`. No se presenta
016 como `applied` por el runner: fue ejecutada por el harness y registrada como
baseline de test. Un nuevo reset de integracion vacia de nuevo ese registro.
Los duplicados historicos 007/008/009 conservan su advertencia aceptada.

No se ejecuto H05 contra produccion ni se verifico su estado remoto; 016 sigue
pendiente de aprobacion/aplicacion productiva. Evidencia temporal no versionada:
`.cache/h24-integration-final.log`, `.cache/h24-build.log`,
`.cache/h24-test-baseline.log` y `.cache/h24-test-inspect.log`.

## 7. Pendientes y gates

1. H24-F2: UI de expediente, cola multiple, telefono, preview y pruebas responsive/accesibilidad.
2. H24-F3: capacidad, memoria, tiempos, navegadores reales y validacion integral de recuperacion.
3. Aprobar bucket separado y verificar su politica real de borrado/retencion sin afectar Constancias; no prometer eliminar copias descargadas/respaldos externos.
4. Aprobar empaquetado/actualizacion del parser y estrategia de archivos maliciosos.
5. Provisionar/monitorizar worker durable, alertas por operaciones atascadas y controles de acceso de su ejecucion.
6. Backup y migracion 016 por H05 antes de una futura version que use estas tablas; backend/Hosting solo con autorizacion nueva y checklist H13.

H24 no queda cerrado operativo ni autorizado para deploy con esta fase. No actualizar manuales como funcionalidad disponible.

## 8. Confirmaciones

Sin produccion, deploy, cambios de variables/secretos productivos, migracion productiva, cargas personales reales, nuevas dependencias npm ni `npm audit fix`. Sin cambios H01, Nomina, pagos, snapshots o corridas historicas. Solo el entorno local/test recibe la nueva estructura y datos sinteticos de pruebas.
