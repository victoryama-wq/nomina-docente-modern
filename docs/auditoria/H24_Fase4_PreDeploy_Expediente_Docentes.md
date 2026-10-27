# H24-F4 - Predeploy del expediente completo de docentes

Fecha: 2026-10-27.
Commit revisado: `9a5dd27 test(h24): validate local teacher dossier integration`.
Rama: `feature/h02-h03-user-coordinations-permissions`.

**Resultado: preparacion y revision local completadas; NO-GO para deploy/habilitacion.
H24 no cerrado operativo. Los bloqueantes siguientes requieren evidencia y aprobacion.**

## 1. Alcance y evidencia

Arbol limpio al inicio; HEAD y tracking local de origin sin diferencias (0/0).
No se hizo fetch ni consulta remota de Git en esta fase; no se confunde tracking
local con verificacion nueva de GitHub. Commits F0 `d8efc5d`, F1 `9179051`,
F2 `9a1aafc`, F3 `9a5dd27` presentes.

Revision de SPEC/diseno H24, auditorias F1/F2/F3, H05/H13 y codigo/configuracion
versionados. No se consultaron proyectos, usuarios, buckets, Cloud SQL, secretos,
revisiones ni logs productivos. Las consultas externas se limitaron a documentacion
publica oficial y npm audit. No se crearon recursos de prueba en la nube.

F3 acredita API HTTP real, BD `nomina_docente_test`, archivos locales reales,
Brave, carga multiple, preview/descarga, reemplazo, borrado fisico, telefono,
reintento idempotente y permisos con actores sinteticos. **No acredita Firebase
real, Cloud Storage real, seguridad antivirus ni capacidad productiva.**

## 2. Bloqueantes de release

Las prioridades indican riesgo para habilitar H24, no explotaciones demostradas
ni afirmaciones sobre la infraestructura actualmente desplegada.

| ID / prioridad | Evidencia local y riesgo | Condicion de cierre / responsable |
|---|---|---|
| H24-PD-01 / Alta | `apps/api/Dockerfile:14` usa node:24-slim sin instalar/copiar pdfinfo; `dossier-storage.ts:320` exige ruta absoluta. Cargas/reemplazos fallaran si la imagen no contiene el parser | DevOps: imagen reproducible con parser aprobado, version registrada y prueba Linux de PDF valido/invalido/timeout antes de release |
| H24-PD-02 / Alta | Solo hay mock SDK GCS. `dossier-storage.ts:207` exige politica estricta; no se conoce bucket/IAM de prueba ni evidencia de borrado real | DevOps/Seguridad: bucket nuevo aislado, nunca Constancias, prueba de politica, permisos y ausencia de objetos/versiones tras borrar/reemplazar |
| H24-PD-03 / Alta | `validateDossierPdf` hace comprobaciones estructurales/JavaScript, no antivirus. Preview Blob usa visor nativo sin sandbox HTML (`TeacherDossierPanel.vue:312`) | Seguridad: aprobar e implementar/probar estrategia PDF malicioso o aceptar formalmente control alternativo con riesgo acotado; no declarar pdfinfo un escaner |
| H24-PD-04 / Alta | `dossier-reconcile.ts:14` es worker one-shot; no existe programacion versionada/probada. `reconcile()` procesa hasta 25 pendientes mayores de cinco minutos por invocacion | DevOps: worker privado programado, permisos minimos, reinicios/fallos ensayados, alertas por backlog y antiguedad; recuperacion real en entorno de prueba |
| H24-PD-05 / Alta | F3 sustituye identidad Firebase. Cliente/API tienen defaults de proyecto productivo; un arranque local sin configurar no es aislamiento | QA/Admin: proyecto de autenticacion de prueba explicitamente aprobado y sesiones autorizadas por rol contra BD/storage test, sin mocks ni identidades productivas |
| H24-PD-06 / Alta | npm audit actual tiene hallazgos high, incluidos Fastify/Zod; ninguna explotabilidad fue ensayada | Seguridad: triage por ruta real, correcciones puntuales y regresion o excepcion formal por hallazgo no alcanzable; cero criticas no autoriza por si solo |
| H24-PD-07 / Media | Limite de dos cargas por proceso, Base64 y buffers en memoria; no prueba sostenida con memoria/concurrencia de destino | QA/DevOps: medir capacidad, memoria, latencias, cola y 429 con archivos limite, red lenta, usuarios y replicas concurrentes |
| H24-PD-08 / Alta operativa | 016 solo ensayada por harness local; F3 dejo registro H05 test vacio. Backup local fallo por namespace PostgreSQL ausente | DBA: resolver entorno de ensayo confiable, probar 016 por H05 y restauracion; luego backup/ventana productiva aprobados independientemente |

No se cambian codigo, dependencias, Dockerfile, SQL ni politicas para cerrar
artificialmente estos puntos en F4. La siguiente fase debe autorizar los ajustes
tecnicos y recursos aislados necesarios; no es todavia H24-F5 deploy.

## 3. Autenticacion y permisos

Revision estatica:

- `auth.ts:50` limita actores sinteticos a NODE_ENV=test. Runtime productivo debe
  usar NODE_ENV=production y rechazar test-actor; no registrar actores de QA alli.
- `auth.ts:140` verifica ID token; exige correo verificado, dominio institucional,
  app_users ACTIVO y UID compatible, con roles/permisos obtenidos de BD.
- `dossier-policy.ts:7` permite Admin/protegido activo; Finanzas/RH necesitan acceso
  fiscal y permisos por accion. Resto denegado, independientemente de botones.
- Documento/docente y revision se comprueban en servicio; carga/reemplazo revalidan
  permisos persistidos antes de publicar el objeto (`teacher-dossier.ts:65`).
- El frontend usa browserSessionPersistence y Bearer; no almacena cola/documentos
  en localStorage/sessionStorage. El control de permisos sigue en API.

**Advertencia operativa:** autenticar una consulta real no equivale a SQL read-only.
`auth.ts:85` puede vincular firebase_uid y `auth.ts:92` actualiza last_login_at.
El ensayo de autenticacion se limita a usuarios de prueba y BD test; no se ejecuta
una sesion productiva como atajo para completar F4.

**Observacion AUTH-01 (Media, preexistente):** verifyIdToken(token) no solicita
checkRevoked=true. No prometer rechazo inmediato por revocacion/deshabilitacion
solo en Firebase; distinguirlo de la inactivacion en app_users, consultada en cada
solicitud. Antes de habilitar documentos personales, Seguridad debe evaluar el
riesgo y definir cambio o aceptacion explicita; no se modifica auth compartido aqui.
Referencia: [verificacion Firebase](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
y [revocacion de sesiones](https://firebase.google.com/docs/auth/admin/manage-sessions).

Plan de smoke en entorno aislado, pendiente de ejecutar:

| Actor / escenario | Resultado exigido |
|---|---|
| Admin activo, incluido no protegido | Listar, cargar, ver, descargar, clasificar, reemplazar, borrar y telefono |
| Finanzas/RH con permisos completos | Igual dentro del alcance global fiscal aprobado |
| Finanzas/RH solo lectura documental | Lectura permitida; mutaciones 403; telefono solo con fiscal.manage |
| Finanzas/RH sin permiso documental | Sin bytes ni gestion; no inferir permiso por nombre del rol |
| Coordinador, Direccion, Contador/Contabilidad | Modulo oculto y 403 en todos los endpoints del expediente |
| Sin token / expirado / proyecto equivocado | 401; sin documento ni bytes |
| Correo no verificado, dominio no admitido, UID incompatible o usuario inactivo | Rechazo controlado sin capacidades nuevas |
| Revocacion de permiso durante transferencia | No publicar bytes nuevos; limpieza recuperable |
| ID de otro docente / revision vieja / otra operacion | Rechazo controlado; sin sobreescritura ni fuga |

Usar Brave con login normal de usuarios autorizados de prueba, sin compartir tokens
en chat, logs, capturas o documentos. Registrar rol, entorno, HTTP y evidencia
sanitizada. No cambiar permisos productivos para hacer pasar las pruebas.

## 4. Almacenamiento y eliminacion definitiva

Propuesta pendiente de aprobacion: bucket dedicado de prueba y luego uno dedicado
para H24 productivo. Nombres/proyecto de prueba **por definir**, no se inventa un
recurso existente. Prohibido reutilizar o cambiar `nomina-docente-prod-constancias`.

El adaptador exige: versioning.enabled=false, softDeletePolicy.retentionDurationSeconds
0, sin retentionPolicy/objectRetention/defaultEventBasedHold, uniformBucketLevelAccess
true y publicAccessPrevention=enforced. Lectura/escritura/borrado estan vinculados
a generacion, CRC32C y claves UUID opacas, no a nombres de archivo.

La forma exacta devuelta por getMetadata debe ensayarse con el SDK instalado:
campos omitidos no equivalen para este adaptador a false/0 explicitos. Si un bucket
seguro produce una forma no admitida, registrar el caso y revisar el codigo en otra
fase; no relajar la guarda ni activar retencion para eludir el fallo.

Permisos de runtime propuestos, limitados al bucket dedicado: storage.buckets.get,
storage.objects.create/get/delete; no otorgar Storage Admin ni permisos de cambio
de IAM/politicas. La verificacion de inventario/versions puede usar una identidad
de auditoria separada con list. Confirmar tambien permisos heredados y actores que
puedan cambiar politicas; public access prevention no sustituye IAM de usuarios.

Ensayo requerido: carga, bytes/hash, reemplazo y ausencia de generacion anterior,
borrado de objeto vivo y ausencia de versiones no actuales/soft-deleted, storage
403/timeout, generacion conflictiva, interrupcion de proceso y recuperacion sin
huerfanos. Solo PDF sinteticos. Registrar IDs tecnicos de prueba en evidencia
restringida, nunca PDF o tokens en el reporte versionado.

Desactivar soft delete se expresa con retencion 0; no elimina retroactivamente
objetos ya retenidos. Desactivar versioning no elimina versiones antiguas.
Referencias oficiales: [soft delete](https://docs.cloud.google.com/storage/docs/soft-delete),
[Object Versioning](https://docs.cloud.google.com/storage/docs/object-versioning) y
[metadata del bucket](https://docs.cloud.google.com/storage/docs/json_api/v1/buckets).
Por eso se exige bucket separado y evidencia, no solo un DELETE HTTP exitoso.
La garantia no abarca copias ya descargadas ni backups externos; no se promete
recuperar archivos eliminados definitivamente.

## 5. Parser, visor, capacidad y worker

Controles presentes: PDF <=7.5 MiB, hasta 500 paginas, Base64 canonico, schemas
estrictos, filename seguro, timeout parser 10 s/salida limitada, proceso sin
credenciales de aplicacion, rechazo de cifrado y JavaScript detectado. La respuesta
PDF es privada/no-store/nosniff; CORS expone solo Content-Disposition para el nombre.

No hay escaneo antivirus implementado ni certificacion de ausencia de malware.
El Blob del visor no hereda automaticamente la cabecera CSP de la respuesta
descargada; no afirmar sandbox HTML. Elegir control compatible con la decision
funcional, probar corpus benigno/adverso aprobado en aislado y verificar que no se
sirva un archivo no aprobado. No enviar expedientes a servicios de analisis externos.

Imagen futura: verificar parser en la **imagen Linux final**, ruta absoluta y
version, timeout, temporales, permisos de ejecucion/usuario y consumo de memoria.
El Dockerfile actual usa npm install y copia node_modules del build; revisar
reproducibilidad/inventario de imagen en el trabajo de empaquetado, sin aceptar
cambios de lockfile no explicados. Build TypeScript OK no prueba que exista pdfinfo.

Propuesta worker: job privado ejecutando `node apps/api/dist/dossier-reconcile.js`,
misma version de codigo/BD/namespace que API. En produccion requiere
ALLOW_DOSSIER_RECONCILE=true **solo en worker**. API sin trigger HTTP nuevo.
Scheduler/identidad de invocacion autorizados aparte; no timer residente dependiente
de trafico Cloud Run. Cadencia inicial propuesta cinco minutos, sujeta a capacidad:
worker espera antiguedad >5 min y procesa 25 operaciones por invocacion, no vacia
automaticamente backlog ilimitado. Alertar por pendientes, FAILED, edad y fallos
de job; exit 0 con pending>0 no demuestra limpieza completa.

Capacidad pendiente: 10 archivos por seleccion y dos envios simultaneos UI no son
cuota global. API admite dos cuerpos grandes por proceso, no por proyecto/usuario;
otros endpoints/downloads pueden competir por memoria. Probar 7.5 MiB, 500 paginas,
cola completa, replicas, transferencia lenta >30 s, desconexion y reintentos.
Definir umbrales de latencia/memoria y backlog antes de aceptar el resultado.

## 6. Auditoria npm read-only actual

| Comando | Criticas | Altas | Moderadas | Bajas | Total |
|---|---:|---:|---:|---:|---:|
| npm audit --json | 0 | 15 | 12 | 1 | 28 |
| npm audit --workspace apps/api --omit=dev --json | 0 | 11 | 10 | 0 | 21 |

Ambos devolvieron exit 1 por hallazgos, no por error de consulta. Evidencia local
`.cache/h24-f4-npm-audit.json` y `.cache/h24-f4-npm-audit-api-runtime.json`.
Son conteos de paquetes reportados por npm, con propagacion transitiva, no 28
explotaciones independientes ni un inventario de la imagen productiva. El filtro
workspace/omit-dev orienta el triage, no prueba que cada ruta sea alcanzable.

Paquetes high del reporte completo: @fastify/busboy, @grpc/grpc-js,
@vue/server-renderer, brace-expansion, fast-uri, fastify, find-my-way, form-data,
nanoid, postcss, source-map-js, undici, vite, vue, zod.
Moderate: @google-cloud/firestore, @google-cloud/storage, @vitest/mocker, exceljs,
firebase-admin, gaxios, google-gax, protobufjs, retry-request, teeny-request, uuid,
vitest. Low: esbuild.

Priorizar API Fastify 5.8.5, find-my-way 9.5.0, Zod 3.25.76 y dependencias de
Firebase Admin 13.10.0 / Storage 7.19.0; frontend Vue 3.5.33 y tooling Vite 6.4.2.
Algunos avisos dependen de HTTP/2, trustProxy, SSR o multipart: no afirmar
explotabilidad sin probar la ruta usada (H24 carga JSON/Base64; frontend es SPA).
El advisory Fastify `GHSA-p68q-wchp-6fh7` y Zod `GHSA-mrhx-c7xc-m3w5` requieren
revision prioritaria del runtime. websocket-driver permanece 0.7.5.

No ejecutar fix automatico: npm propone cambios mayores para firebase-admin/Zod
y cambiar exceljs a 3.4.0, incompatible con asumir actualizacion inocua. Abrir
correccion SEC separada, acotada, con regresion y aprobacion; ninguna dependencia
se instalo, actualizo ni acepto como riesgo automaticamente.

## 7. Configuracion propuesta, no aplicada

| Elemento | Test aislado futuro | Produccion futura (solo aprobada) |
|---|---|---|
| Firebase proyecto/config completa web/API | Proyecto de prueba acordado; sin defaults productivos | Conservar proyecto actual verificado en ventana |
| NODE_ENV | development para login real sin registro sintetico | production, sin emuladores ni actores test |
| DB | nomina_docente_test local, jamas origen de datos productivos | nomina_docente por conexion segura vigente |
| DOSSIER_STORAGE_MODE | gcs para prueba real o local para F3 | gcs solo despues de cerrar gates; disabled mientras tanto |
| DOSSIER_BUCKET | Bucket aislado de prueba por aprobar | Bucket H24 dedicado por aprobar; no Constancias |
| DOSSIER_PDFINFO_PATH | Ruta absoluta local aprobada | Ruta absoluta comprobada en imagen Linux |
| DOSSIER_LOCAL_ROOT | Solo test local | No configurar como almacenamiento productivo |
| ALLOW_DOSSIER_RECONCILE | No requerido fuera de production, guardas test vigentes | true solo en job aprobado |
| Secretos / SA / CORS | Identidad aislada y origen local explicito | Conservar existentes; IAM minimo adicional revisado, nunca valores secretos en docs |

No basta con cambiar VITE_FIREBASE_PROJECT_ID: appId/authDomain/apiKey y demas
configuracion deben pertenecer al proyecto test. No lanzar login con defaults
de `apps/web/src/config.ts`. No se solicitan ni crean cuentas/recursos ahora.

## 8. H05, plan de release futuro y rollback

016 es aditiva: dos tablas, indices/FK/checks, sin backfill, sin modificar teachers
ni constancias/roles/snapshots. SHA-256 local del archivo revisado:
`419cc93af11b82d72116587f53510725b440f1be8547ecb420bb4fcddd03d685`.
H13 documenta historicamente 18 migraciones registradas hasta 015; no se verifico
Cloud SQL en F4. Frente a las 19 del filesystem, se espera **solo 016 pendiente**
antes de migrar, no exigir pending=0 antes de aplicar la nueva migracion.
Despues se espera 19 registradas, pending=0, mismatch=0; son expectativas futuras.

F3 dejo H05 test vacio tras reset: no ejecutar apply general alli sin reconstruir
el estado administrativo de ensayo correctamente. Para probar H05, preparar test
con esquema/registro hasta 015 y ejecutar 016 por runner, con autorizacion local
separada. No copiar ese estado ni los datos sinteticos hacia produccion.

Orden propuesto **NO ejecutado**:
1. Cerrar PD-01 a PD-08 y AUTH-01, aprobar estrategia PDF/infraestructura y registrar
   responsables. Confirmar pruebas en entorno aislado y revision del diff.
2. Congelar SHA/lockfile e imagen comprobada, rama limpia/sincronizada. Registrar
   revision/Hosting anteriores por consulta autorizada durante ventana, no por
   asumir que los valores historicos del SDD siguen vigentes.
3. Backup Cloud SQL SUCCESSFUL y restaurabilidad; inspect H05 autorizado: solo
   016 pendiente y cero mismatch. apply recorre todos los pendientes
   (`tools/migrate-db.ts:478`): abortar si aparece otro. No baseline historico.
4. Aplicar exclusivamente 016 mediante H05 con confirmaciones y ventana aprobadas.
   Verificar schema/registro y ausencia de cambios a datos funcionales. dry-run
   puede escribir registro administrativo; no llamarlo read-only.
5. Habilitar infraestructura aprobada y worker, desplegar API antes de Hosting;
   conservar secretos/configuracion ajena a H24. No habilitar UI productiva con
   backend disabled o sin tablas/parser (produciria 503 en expediente).
6. Health API/Hosting, 401 sin sesion, login y smoke autorizado por rol. Un health
   200 solo prueba disponibilidad general, no GCS/parser/worker. Para probar
   escrituras documentales productivas se necesita autorizacion y docente/archivo
   de prueba acordados; no usar expedientes personales ni crear docentes a ciegas.
7. Validar limpieza y auditoria, errores y regresiones Constancia/Directorio/H01/
   H20/H22/Finanzas; documentar deploy y aceptacion humana antes de cerrar H24.

Rollback propuesto: detener nuevas operaciones H24, registrar estados pendientes
y coordinar cleanup/worker, revertir API/Hosting a artefactos anteriores aprobados
si falla acceso, login, permisos, bytes o consistencia. No eliminar tablas/objetos
en lote ni perder intenciones de limpieza; cambiar bucket/namespace impediria
reconciliar. Revertir codigo no deshace telefono ni restaura PDF borrados. No
restaurar toda la BD automaticamente por un error de UI. DBA decide recuperacion
especifica con backup y analisis de efectos. No ejecutar rollback en F4.

## 9. Validaciones F4 y checklist

| Validacion | Resultado |
|---|---|
| test:api con Poppler local | 145/145, 13 archivos |
| test:web | 139/139, 23 archivos |
| typecheck | API/web OK |
| build | API/web OK, sin publicar ni construir imagen Cloud |
| test:api:integration | No repetida en F4: reconstruye BD. Evidencia F3 158/158, 27 H24, mismo codigo en 9a5dd27 |
| Brave HTTP real | Evidencia F3, no repetida ni login real en F4 |
| npm audit | Ejecutado read-only; hallazgos, ver seccion 6 |
| git diff --check | OK; cambios documentales solamente |

Logs locales `.cache/h24-f4-{test-api,test-web,typecheck,build}.log`.
Lockfile SHA-256 sin cambios:
`b840496398aae4750c9648622d1a5d982cf4bb66a24e2ed5f155f0079e0361a8`.

- [x] Codigo, contratos, roles y evidencia F1/F2/F3 revisados.
- [x] Bloqueantes y plan de smoke/release/rollback documentados.
- [x] Regresion sin BD y auditoria de dependencias repetidas.
- [ ] Sesiones Firebase reales autorizadas en test.
- [ ] GCS privado de prueba, IAM/politicas/borrado comprobados.
- [ ] Parser en imagen final y estrategia PDF aprobada/probada.
- [ ] Worker programado y alertas/recuperacion probados.
- [ ] Capacidad y accesibilidad/dispositivos completados.
- [ ] Hallazgos npm y AUTH-01 resueltos o excepciones fundamentadas aprobadas.
- [ ] Entorno DBA confiable, ensayo H05 016 y restauracion.
- [ ] Aprobacion explicita de backup/migracion/API/Hosting productivos.

## 10. Confirmaciones

Solo documentos modificados. Sin codigo, SQL, dependencias, BD local/productiva,
migraciones, seeds, recursos cloud, credenciales/variables productivas, deploy,
carga de archivos personales, cambios H01, Nomina, snapshots, permisos o reglas.
No se hizo commit/push. No se actualizan manuales como funcionalidad productiva.
Preparacion F4 terminada; autorizacion de release pendiente, no implicita.
