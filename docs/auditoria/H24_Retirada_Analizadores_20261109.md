# H24 - Retirada de Inspector y ClamAV por decision de costo

Fecha: 2026-11-09. Rama: feature/h02-h03-user-coordinations-permissions.
Base revisada: 66b9639f0ba2360723a5d0bb5ed79e29bbe3adc5, limpia y sincronizada al
inicio. No AGENTS.md encontrado en el checkout/ancestros. Candidata nueva:
el commit que incorpora esta acta; su SHA se entrega con el resultado de Git.

## 1. Decision y alcance

El usuario autoriza retirar el Inspector de documentos y ClamAV del flujo H24,
incluyendo sus requisitos de infraestructura, por costo. Alcance: codigo local,
pruebas aisladas, documentos, commit/push. No autoriza cloud/produccion, cambios
de buckets/IAM, migraciones, merge ni despliegue. No se instalaron dependencias
nuevas ni cambiaron manifests/lockfiles.

El login institucional y un documento escaneado no prueban ausencia de malware.
**Riesgo residual alto:** archivos maliciosos, cifrados, corruptos, con contenido
activo o imagenes de expansion excesiva pueden superar la firma basica.
Se acepta retirar el control; no se afirma que el riesgo este eliminado.
No atribuir las excepciones anteriores de Rectoria a una nueva prueba AV.

## 2. Dependencias revisadas y comportamiento final

| Flujo | Antes | Ahora |
|---|---|---|
| Carga/reemplazo constancia | validateDocumentContent invocaba parser/AV | Firma/tipo/tamano; sin servicios externos |
| Adicionales y relectura al publicar | Parser/AV, hash y operacion | Sobre basico, hash/operacion/generacion conservados |
| Consulta/descarga | Reanalisis previo a entrega inline | Reautorizacion, sobre basico, attachment y NOT_SCANNED |
| Reconciliacion de adicionales | Validacion con analizadores | Validacion basica real; recupera intenciones con hash |
| Limpieza constancia | Elimina solo no vigente/generacion exacta | Sin cambio funcional; no necesitaba analizador |
| UI | Visor nativo iframe/imagen o pestaña Blob | Informacion, advertencia y descarga autorizada; no renderiza contenido |

No hay mock productivo, respuesta limpia, flag de fallback ni aprobacion fingida.
document-security.ts no importa procesos/red ni lee DOCUMENT_SECURITY_*.
Nombres/extension, MIME permitido y firma basica (PDF/PNG/JPEG), 7.5 MiB, limites
de lote/admisión, IDs/rutas del servidor y permisos se conservan. Adicionales
siguen solo PDF; constancias PDF/JPG/PNG. No hay validacion de estructura,
paginas, adjuntos, JavaScript, firmas AV, pixeles ni decodificacion completa.

Responses de contenido: Content-Disposition attachment, X-Document-Analysis
NOT_SCANNED, CSP sandbox/default-src none, nosniff y private no-store. Se conserva
el parametro download para compatibilidad, sin conceder inline con false.
La UI reautoriza descarga, no expone URL publica GCS, revoca Blob al cerrar/logout
y no abre contenido en iframe/object/embed/img/window.open. La apertura externa
posterior exige herramientas de seguridad del equipo; no se promete inmunidad.

## 3. Persistencia e integridad

Revisadas 016 y 017: los estados UPLOADING/AVAILABLE/REPLACING/DELETING y
PREPARED/CLEANUP/ABORTING/COMPLETE/FAILED son operacionales, no veredictos AV.
Constancias usan marcadores STAGING/DELETE_PENDING/DELETED. No hay columna
antivirus persistida que requiera migracion, conversion o borrado de evidencia.

Se agrega a intenciones nuevas el payload JSON existente validationMode
BASIC_ENVELOPE_V1 y analysisStatus NOT_SCANNED; la purga normal del payload sigue
igual. DTO/cabecera describen la politica actual, no niegan analisis historicos.
Codigos de error antiguos permanecen legibles para operaciones/pruebas historicas.
No se actualizan filas antiguas por esta tarea.

A->B conserva atomicidad: falla antes de confirmar B conserva A; B confirmada
es la unica vigente, aunque cleanup de A falle; reconciliacion repetida no
borra B. Hash, generacion exacta, permisos y rechazo de IDs cruzados se conservan.
Constancias mantienen 604800 s recuperables, versioning ausente/false; adicionales
destino separado privado false/0 y borrado definitivo. Adaptadores de almacenamiento
y SQL historico no modificados. Sin restauracion dentro de Nomina.

## 4. Laboratorio y limites de evidencia

PostgreSQL 18 efimero en Docker desktop-linux, contenedor
h24-basic-regression-20261109, etiqueta purpose=h24-basic-regression,
127.0.0.1:55479, DB nomina_docente_test, usuario sintetico h24_basic_test.
Sin mounts de la BD habitual, disco tmpfs 2 GiB, memoria 3 GiB, CPU 2.
Ninguna conexion cloud ni credencial productiva.

No se ejecutan archivos de migracion: el helper requiere opt-in, host/puerto/
usuario/base exactos y SHA-256 del snapshot de esquema sintetico anterior:
3f6b00d306dc80637126a048ba3fe1b2668aa5dd9501b3f4ff88e3589bfb3eac.
Origen local: .cache/h24-window-eb24250-20261105/schema.sql (solo DDL, no filas),
procedente del laboratorio sintetico previo, no dump productivo.
Se restaura ese esquema solo dentro del contenedor y se crean fixtures QA.
schema_migrations y schema_migration_runs quedan con cero filas; esto NO es H05.
El mensaje inicial de setup decia genericamente "con migraciones"; se corrigio
para distinguir el replay, que nunca entro en la rama de ejecucion de migraciones.

La suite teacher-fiscal-identity.integration.test.ts se excluye **solo en esta
ejecucion** porque ejecuta 017 sobre tablas temporales, prohibido por el alcance.
No se elimina ni se cambia su prueba. Las otras 20 suites de integracion corren.
21 tests opt-in de parser/Docker historicos conservan su skip previo; no son PASS
ni controles de la candidata. No se omiten fallos para aprobar la ejecucion.

Constancias: SQL real y storage sintetico en memoria con fallos inyectados.
Adicionales: SQL real y adaptador local privado con lectura/escritura/borrado
real y fallos controlados. Politicas GCS: unit tests con metadata simulada,
**no nuevo ensayo GCS**. La evidencia cloud de 3284a12 sigue siendo historica.

## 5. Pruebas y resultados

| Validacion | Resultado |
|---|---|
| npm run test:api y repeticion npm run test | 445 PASS / 21 SKIP historicos; exit 0 |
| npm run test:web y repeticion npm run test | 169 PASS; exit 0 |
| Integracion PostgreSQL sin suite migratoria 017 | 20 archivos / 166 PASS; exit 0 |
| Integracion granular api-h24-dossier + constancia-replacement | 29 PASS; exit 0 |
| npm run typecheck | API/web OK; exit 0 |
| npm run build | API/web OK; exit 0 |
| Docker API Linux | Build local OK; sin Poppler/ClamAV |
| Smoke modulo real dentro de imagen, network none/read-only | Firma valida admitida, falsa rechazada, NOT_SCANNED; sin pdfinfo/scanner |
| Playwright + Brave headless local | 1440x900, 768x1024, 390x844; sin overflow general; sin render de archivo |
| Descarga UI y cierres | SHA-256 del PDF coincide; URLs revocadas; cero errores y peticiones externas |
| git diff --check | OK al cierre |
| SQL/H01/manifests/lockfiles | Sin cambios |

Fallos conservados: primer test:api encontro seis imports de helpers historicos
pendientes de trasladar; corregidos a document-analyzers-legacy. Primera
integracion: 164 PASS / 2 FAIL por expectativas antiguas de DTO y cabecera.
Se ajustaron a NOT_SCANNED y exposicion de cabecera, sin relajar permisos/hash.
Repeticiones aprobadas. La firma admite ejemplos inertes truncados/con marcadores
de contenido activo: prueba deliberada de limitacion, no certificacion de limpieza.

Evidencia visual local: .cache/h24-basic-download-preview-20261109/result.json
y siete PNG; sin datos personales. El harness solo simula API/actor para UI,
no acredita Firebase real ni sesiones productivas. Descarga original verificada.
La imagen h24-basic-api:20261109-local es artefacto local, no digest aprobado
para release. Contenedor PostgreSQL retirado tras comprobar nombre, ID/etiqueta
y ausencia de mounts; tmpfs descartado. El harness visual cerro Brave headless
y Vite; permanecen solo la imagen local y evidencia sintetica en cache.

## 6. Infraestructura y riesgos pendientes

[Plan vigente](H24_Plan_Infraestructura_Productiva_20261109.md) reemplaza el plan
con analizadores, cuya version sigue en Git 66b9639. Se excluyen servicios,
imagenes, cuentas/Invoker, firmas, alertas y costos exclusivos de Inspector/AV.
Sus Dockerfiles bloquean build ordinario; requieren opt-in de replay historico.
Rehearsal cloud antiguo y harness de capacidad antiguo detienen ejecucion;
biblioteca/tests historicos quedan separados del runtime. No se eliminan ensayos.

Estimacion ilustrativa restante: worker 84/dia x 60 s x 30 dias, 1 CPU/1 GiB:
USD 3.024; Scheduler USD 0.10/31 dias; GCS Standard 10 GiB medios x 720 h:
USD 0.197. Subtotal aproximado USD 3.32, **no costo total**. API, operaciones,
red, builds/artefactos, secretos, logs/Monitoring, backups y Cloud SQL excluidos.
Supuestos, tarifas publicas y sensibilidad a duracion detallados en el plan.
No se inspeccionaron recursos/facturas ni se elimino infraestructura existente.

Pendientes concretos: designacion del bucket adicional, IAM efectivo sin restore,
worker y privilegios SQL/secretos, guarda horaria/solapamiento, Scheduler,
alertas y receptor de limpieza, dimensionamiento/smoke de esta candidata,
ventana autorizada H05/backup/migraciones 016/017 y API/Hosting/rollback.
Mantener procedimiento institucional de descarga/antivirus del equipo e incidentes.
Actualizar manuales finales al liberar, sin presentar esta candidata como productiva.

**Dictamen:** adecuacion local validada y publicable en rama; H24 conserva
NO-GO de produccion hasta cumplir esos gates. No hubo migraciones, servicios
cloud creados/eliminados, cambios productivos, merge ni deploy.
Sin cambios H01, permisos/roles de negocio, snapshots o corridas productivas.

## 7. Archivos de esta adecuacion

- `README.md`
- `apps/api/Dockerfile`
- `apps/api/src/lib/constancia-replacement.ts`
- `apps/api/src/lib/document-cloud.ts`
- `apps/api/src/lib/document-security.ts`
- `apps/api/src/lib/teacher-dossier.ts`
- `apps/api/src/routes/teacher-dossier.ts`
- `apps/api/src/routes/teachers.ts`
- `apps/api/src/test/api-h24-dossier.integration.test.ts`
- `apps/api/src/test/constancia-replacement.integration.test.ts`
- `apps/api/src/test/constancia-route.test.ts`
- `apps/api/src/test/db/setup-test-db.ts`
- `apps/api/src/test/db/test-db-utils.ts`
- `apps/api/src/test/document-cloud.test.ts`
- `apps/api/src/test/document-scan-limit.docker.test.ts`
- `apps/api/src/test/document-security.docker.test.ts`
- `apps/api/src/test/document-security.test.ts`
- `apps/api/src/test/document-transport.test.ts`
- `apps/web/src/api.ts`
- `apps/web/src/components/TeacherDossierPanel.test.ts`
- `apps/web/src/components/TeacherDossierPanel.vue`
- `apps/web/src/views/FiscalRecordsView.test.ts`
- `apps/web/src/views/FiscalRecordsView.vue`
- `docs/auditoria/H13_Checklist_Productivo_Permanente.md`
- `docs/auditoria/H24_Fase4_PreDeploy_Expediente_Docentes.md`
- `docs/auditoria/H24_Plan_Infraestructura_Productiva_20261109.md`
- `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md`
- `docs/diseno/DISENO_TECNICO_H24_Expediente_Completo_Docentes.md`
- `docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md`
- `docs/specs/SPEC_H24_Expediente_Completo_Docentes.md`
- `services/document-security/Dockerfile.inspector`
- `services/document-security/Dockerfile.rehearsal`
- `services/document-security/Dockerfile.scanner`
- `services/document-security/README.md`
- `services/document-security/rehearsal.mjs`
- `tools/validation/h24-pd03/README.md`
- `tools/validation/h24-pd03/preview-local.mjs`
- `tools/validation/h24-pd07-b04/README.md`
- `tools/validation/h24-pd07-b04/probe.mjs`
- `tools/validation/h24-pd07-e2e/README.md`
- `tools/validation/h24-pd07-e2e/flow.test.ts`
- `tools/validation/h24-pd07-e2e/regression.mjs`
- `tools/validation/h24-pd07-e2e/run.mjs`
- `apps/api/src/lib/document-analyzers-legacy.ts`
- `apps/api/src/test/document-basic-policy.test.ts`
- `docs/auditoria/H24_Retirada_Analizadores_20261109.md` (esta acta).
