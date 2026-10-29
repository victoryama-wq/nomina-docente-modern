# Diseno tecnico H24 - Expediente completo de docentes

Fecha: 2026-10-27.

Estado: **Diseno aprobado; F1/F2 implementadas y F3 validada en integracion local con observaciones. PD-02 GCS aislado cerrado tecnicamente; PD-05 real parcialmente validado; despliegue pendiente.**

F4: [revision predeploy](../auditoria/H24_Fase4_PreDeploy_Expediente_Docentes.md)
preparada; NO-GO hasta cerrar PD-03 a PD-08. AUTH-01 tiene correccion local autorizada
el 2026-10-28, [evidencia aislada](../auditoria/H24_AUTH01_Correccion_Revocacion_Firebase.md),
sin publicacion. Requiere firebaseauth.users.get en runtime; permiso aprobado solo
para H24, sin capacidad de modificar identidades. AUTH-01 cerrado tecnicamente
en ese entorno con rechazo real, nuevo login e integridad comprobados. PD-01 cerrado:
imagen Linux local de `95026bf` con pdfinfo 22.12.0 y smoke obligatorio, 12/12 en
build/runtime, tambien como usuario node. GCS real aislado validado en
[PD-02](../auditoria/H24_PD02_Resultado_GCS_Aislado.md). Autenticacion real
[parcialmente validada en PD-05](../auditoria/H24_PD05_Plan_Validacion_Firebase_Auth_Real.md),
con casos de sesiones avanzadas pendientes. No hay provisionamiento probado del
worker. El plan de release describe configuracion productiva y rollback futuros,
no cambios productivos ejecutados ni autorizacion de deploy. El default de storage
sigue disabled; PD-02 uso gcs explicitamente solo en el entorno aislado.
Evidencia: [correccion local pdfinfo](../auditoria/H24_Fase4_Correccion_Parser_Pdfinfo.md).

Seguimiento tecnico 2026-10-29: transporte `DOCUMENT_SECURITY_MODE=cloud-run`
implementado y validado exclusivamente en H24. Servicios privados inspector/AV,
ID token de runtime por audiencia, limites/hash/politica sin fallback. Job efimero
con recuperacion y disparo Scheduler probados; recepcion email aun pendiente.
El comentario anterior sobre worker describe la preparacion inicial: ahora hay
provisionamiento de ensayo, no productivo. Ver
[arquitectura, digests y limitaciones](../auditoria/H24_PD03_PD04_Arquitectura_Cloud_Aislada.md)
y `services/document-security/README.md`. No afirmar equivalencia entre IAM privado
y aislamiento de red Docker. PD-06 tiene correccion compatible parcial y regresion
local, sin cierre de riesgos ni cambio del contrato funcional.

Evidencia F3: [Integracion HTTP/PostgreSQL/storage local](../auditoria/H24_Fase3_Validacion_Integracion_Expediente_Docentes.md). Se expone `Content-Disposition` mediante CORS exclusivamente en la respuesta PDF del expediente para conservar el nombre UTF-8 en descargas cross-origin. No se amplian origenes ni autorizaciones.

Evidencia F2: [Frontend](../auditoria/H24_Fase2_Frontend_Expediente_Docentes.md).
Se conserva panel durante la visita y se advierte al salir; no se persiste la cola
en el navegador. El visor nativo usa exclusivamente Blob PDF autenticado y validado,
sin sandbox HTML porque Brave bloquea su visor con ese atributo. No se admite HTML;
seguridad integral del visor sigue pendiente. F3 verifica relectura tras recarga y
reintento sin duplicados, no persistencia de cola local. Las secciones
de propuesta F0 siguientes son historicas, no evidencia de capacidades productivas.

Implementacion y desviaciones acotadas: [H24-F1](../auditoria/H24_Fase1_Modelo_Backend_Expediente_Docentes.md). Las secciones de propuesta siguientes conservan el contexto F0; para capacidades implementadas consultar esa auditoria. Se asigno 016, storage permanece deshabilitado por defecto y los gates productivos no estan satisfechos.

Contrato funcional: [SPEC_H24_Expediente_Completo_Docentes.md](../specs/SPEC_H24_Expediente_Completo_Docentes.md).

Seguimiento 2026-10-29: autorizacion separada para integrar el inspector actual
con API/BD test/GCS. [Acta y restitucion](../auditoria/H24_PD03_Integracion_Politica_Imagenes_PDF_GCS.md).
19 grupos aprobados, 26 tablas e inventarios restituidos; PNG/JPEG y PDF reales
del pipeline local, sin publicar bytes adversos en GCS.
Conserva transporte Docker local y originales; no incorpora adaptador cloud ni
constituye aceptacion residual del visor. No hay cambio de diseno funcional.

Ampliacion PD-03 aprobada 2026-10-28: [implementacion local de politica/decoder/visor](../auditoria/H24_PD03_Implementacion_Imagenes_PDF_Visor_Local.md).
Inspector separado con sharp 0.35.5/libvips 8.18.7 y qpdf 11.3.0-1+deb12u1;
lock propio de laboratorio, sin dependencias nuevas en app. Decodifica JPG/PNG
completos y examina JSON estructural PDF antes de AV sobre los mismos bytes.
Protocolo H24_POLICY_V1 rechaza la imagen parser A3 antigua, sin fallback.
512 MiB/2 CPU/64 PID/30 s, sin red, no root, filesystem read-only y tmpfs privado.
Constancias invalidan solicitudes y Blob al cambiar identidad/permisos o desmontar.
El visor nativo sigue sin sandbox HTML demostrado; ensayo sintetico no constituye
aceptacion residual. Nueva ronda BD/GCS y arquitectura cloud requieren aprobacion;
no desplegar transporte Docker local. Se conserva politica historica sin borrados
ni transformaciones. El acta contiene limites exactos y evidencia reproducible.

Seguimiento tecnico 2026-10-28: [PD-03 A3](../auditoria/H24_PD03_A3_Controles_PDF_ClamAV_Local.md)
agrega document-security.ts y admision compartida. Parser y ClamAV ejecutados por
stdin en contenedores separados, no root/sin red, con limites y firmas recientes;
hash/veredicto exacto, sin cache persistente. Transporte exclusivamente Docker
Desktop local y entorno H24/test explicito; no hay adaptador Cloud Run. Lectura y
recuperacion se revalidan. Fallos de infraestructura no publican ni retiran el
anterior. No hay migracion. Visor/politica PDF y JPG/PNG completos pendientes.
[A4 posterior](../auditoria/H24_PD03_A4_Integracion_PDF_ClamAV_GCS.md) valida 16 grupos
con API/BD test/GCS reales, scanner Docker, fallos controlados y restitucion exacta.
No hay transporte cloud ni cierre PD-03; el runtime factory nominal fue ensayado
sin inyectar un validador alternativo. Inyeccion de rechazo durante recuperacion
queda distinguida del pipeline real para no subir adversos a GCS.

## 1. Arquitectura y limites

### Ampliacion local 2026-10-28: C.P. fiscal y CURP

Migracion `017_h24_teacher_fiscal_identity.sql` agrega `teachers.fiscal_postal_code`
y `teachers.curp` como text NOT NULL DEFAULT '', con CHECK de vacio/formato.
Sin modificar 016 ni backfill. `PATCH /teachers/:id/fiscal` recibe campos opcionales
`fiscalPostalCode`/`curp`: omision conserva, '' limpia, null o formato invalido 400;
trim y CURP mayuscula. C.P. cinco digitos; CURP estructura basica de 18 caracteres,
sin validar identidad, fecha interna, entidad o digito verificador oficial.

Lectura de ambos valores exige `canUseDossier(actor, 'view')`; mutacion conserva
`requireDossier('contact')`. Roles ajenos reciben campos vacios en proyeccion de
teachers. No cambia autorizacion del resto de campos ni exportables. Auditoria
general omite estos valores y registra presencia/campos cambiados. No OCR.
Panel reutiliza grid responsive/guardado fiscal; archivos y telefono siguen separados.
017 ensayada por H05 solo en test: 20 registradas, pending=0/mismatch=0. Release
futuro requiere 016 y 017 antes de API. Ver [evidencia](../auditoria/H24_Ajuste_CP_CURP_Expediente.md).

### Actualizacion aprobada 2026-10-28: ficha y sustitucion de constancia

Implementada solo localmente, ver
[auditoria del ajuste](../auditoria/H24_Ajuste_Expediente_Fiscal_Constancia.md).
El panel reutiliza `PATCH /teachers/:id/fiscal` para RFC, correo, pago y banco;
telefono conserva su endpoint/version independiente. Tras guardar fiscal se
relee la version de telefono sin perder una edicion local no guardada.

La sustitucion usa la ruta POST de constancia existente. Se conserva el esquema
de `teacher_documents` y su indice. Su campo text `document_type` representa
estados internos nuevos siempre no vigentes: `CONSTANCIA_FISCAL_STAGING`,
`CONSTANCIA_FISCAL_DELETE_PENDING`, `CONSTANCIA_FISCAL_DELETED`. Solo el documento
vigente mantiene `CONSTANCIA_FISCAL` y `is_current=true`, compatible con joins
existentes. Esta extension de valores implementa el ajuste posterior al diseno
F0, sin nueva columna ni migracion. La metadata permanece para trazabilidad;
los bytes retirados se eliminan. No se recorre ni borra el historial previo.

Admision persistida antes de GCS; objeto UUID create-only; bloqueo de staging
durante upload; publicacion transaccional bajo bloqueo del docente con auditoria;
limpieza posterior. Si falla publicacion queda staging recuperable y la constancia
anterior sigue vigente. Si falla borrado queda pendiente durable, con advertencia
explicita al usuario. El worker one-shot existente tambien procesa estos estados,
maximo 25 por invocacion, y staging abandonado de mas de 24 horas. No se programa
ni ejecuta worker productivo en esta fase. No se borran referencias vigentes.

El adaptador exige bucket privado sin versionado, soft delete, retencion ni holds;
borra condicionando la generacion observada. Configuracion insegura/desconocida
produce error controlado, no relajacion de la politica ni cambios automaticos.
**Seguimiento 2026-10-28:** bucket aislado de constancias creado y ensayo manual
A/B verificado: A borrada fisicamente, B vigente. PD-04 agrega fallos controlados,
recuperacion y ejecucion programada local; falta job cloud y entrega de alertas.
PD-02 validaba documentos adicionales, no sustituye estas nuevas evidencias.
La prohibicion de purga retroactiva del texto F0 sigue vigente; la constancia
que se sustituye ahora es la unica version previa incorporada al borrado nuevo.

### Alcance original F0 (referencia historica)

Extender `/expediente-fiscal`, conservando Vue 3/TypeScript, Fastify, PostgreSQL y almacenamiento privado. Separar el documento fiscal existente de los documentos personales/academicos adicionales.

Flujo propuesto: panel Vue -> API autenticada/autorizada -> metadatos PostgreSQL + objetos privados. Los binarios no se guardan en PostgreSQL. No hay acceso publico directo ni credenciales de almacenamiento en frontend.

No modificar `teacher_documents` ni su indice vigente, los joins de constancias usados por Nomina/Reportes, ni la formula de completitud fiscal. El indice actual es unico por `(teacher_id, document_type)` cuando `is_current = true`; no permite la multiplicidad aprobada sin cambiar su contrato. Por eso se propone un modelo separado.

No existe atomicidad distribuida entre PostgreSQL y almacenamiento. Se requiere un protocolo de operaciones persistidas y reconciliacion; una transaccion SQL alrededor de una carga no resuelve los objetos huerfanos.

## 2. Autorizacion

Crear una politica especifica de este modulo: administrador del sistema (incluida la excepcion protegida existente), `finanzas` o `rh`. Dentro de esa politica exigir los permisos de la matriz SPEC para cada accion y resolver el docente dentro del alcance vigente.

No reutilizar `finance.view`, `reports.view` o `teachers.manage` como permiso para documentos. No modificar globalmente los helpers fiscales compartidos para ocultar informacion que otros modulos ya entregan legitimamente. Aislar la guarda de Expediente y cubrir sus endpoints, incluidos los de constancia utilizados desde este modulo, sin retirar capacidades independientes de otros flujos.

El codigo actual de `teachers.ts` con `allowFinance: true` concede alcance global al actor con permisos fiscales/documentales. Mantenerlo para Finanzas/RH autorizados; no introducir propiedad por creador. La nueva guarda debe comprobar ademas que `document.teacher_id` coincide con el docente solicitado y que el estado permite la accion.

Admin conserva acceso completo explicitamente: `requirePermission()` por si solo no constituye un bypass Admin. Resolver esta semantica en la guarda del modulo y probarla. Gestion documental implica lectura documental dentro de este contrato; no modificar roles/permisos almacenados.

Aplicar las mismas reglas en metadata, bytes, descarga, reemplazo, borrado, estado de operaciones y telefono. Usuario inactivo o sesion invalida no accede. No registrar tokens ni cuerpos Base64 en errores.

## 3. Persistencia propuesta

### 3.1 Documentos adicionales

Tabla propuesta `teacher_dossier_documents`, sin crearla en esta fase:

| Campo conceptual | Finalidad |
|---|---|
| `id` UUID | Identidad estable del documento, independiente del nombre del archivo |
| `teacher_id` UUID | FK a docente existente; borrado restringido |
| `document_type` | CURP, ACTA_NACIMIENTO, CEDULA_PROFESIONAL, TITULO u OTRO |
| `title`, `original_file_name` | Etiquetas limitadas/sanitizadas; nunca rutas |
| `mime_type`, `size_bytes` | PDF validado y tamano real positivo |
| `storage_bucket`, `storage_object`, `storage_generation` | Referencia interna exacta del objeto vigente |
| `state`, `revision` | Estado y version para concurrencia optimista |
| `created_at/by`, `updated_at/by` | Trazabilidad del documento, no campos de `teachers` |

Estados conceptuales: `UPLOADING`, `AVAILABLE`, `REPLACING`, `DELETING`, `FAILED`. La implementacion fijara sus transiciones y constraints. Indice por docente/estado; unicidad de referencia de objeto; **sin unicidad por docente/tipo o nombre**. No almacenar bytes ni copias historicas de PDF.

FK restrictiva: la eliminacion existente de un docente no debe hacer cascade de metadata dejando archivos. Si hay documentos u operaciones pendientes, bloquear esa eliminacion con error controlado hasta resolverlos mediante el flujo autorizado. No modificar las reglas actuales de dependencias de Nomina/horarios.

### 3.2 Operaciones durables

Tabla propuesta `teacher_dossier_operations` para intenciones/reintentos: UUID/idempotency key, actor, docente/documento, accion, revision esperada, estado, referencias temporales de objetos/generaciones, intentos, fechas y codigo de error sanitizado. No guardar contenido del PDF en esta tabla.

Unicidad de operacion por actor y clave; una operacion documental en curso por documento; reutilizacion de clave con otro payload debe producir conflicto. Referencias temporales se purgan despues de confirmar limpieza, dejando solo auditoria minima. No retener indefinidamente objetos fallidos.

Un reconciliador durable debe recuperar operaciones interrumpidas tras reinicios de Cloud Run. No basta con promesas pendientes, timers en memoria o solo reintentos del navegador. La eleccion de tarea/worker y su provisionamiento quedan como gate tecnico antes de implementar/desplegar; no se afirma que ya existan.

### 3.3 Telefono

Usar exclusivamente `teachers.phone`. Endpoint estricto acepta telefono y token de concurrencia; reutiliza validacion operativa vigente (limite del schema y normalizacion de 10 a 15 digitos si hay numero). Sin escritura de correo, RFC, pago, categoria, responsable ni coordinacion.

El token deriva de la version/`updated_at` actual, comparada dentro de una transaccion. Si cambia, devolver 409 y pedir recarga. Es valido actualizar `updated_at`/`updated_by` como trazabilidad normal de una edicion de telefono, sin modificar `created_by`. Registrar evento especifico con campos cambiados y actor; evitar duplicar el numero completo en logs generales.

## 4. Almacenamiento y borrado definitivo

Proponer un bucket privado separado para documentos adicionales, configurable server-side, para no alterar retencion de constancias historicas. No crear bucket ni cambiar IAM/configuracion ahora. Evaluar con DevOps el costo y configuracion antes de autorizar infraestructura.

Claves de objetos opacas, por ejemplo UUID docente/documento/operacion; sin RFC, CURP o nombre personal en la ruta. Conservar nombre amigable solamente como metadata autorizada. Escrituras y eliminaciones condicionadas a la generacion esperada para evitar que una carrera borre una version nueva.

Antes del release comprobar: IAM minimo, ausencia de acceso publico, ubicacion aprobada, politicas de retencion, object versioning, soft delete y copias externas. La politica del nuevo espacio debe permitir la eliminacion definitiva aprobada. Si hay retencion incompatible, bloquear la habilitacion; no eludirla ni prometer borrado fisico.

No reutilizar automaticamente la politica del bucket `CONSTANCIAS_BUCKET`. No purgar objetos del flujo fiscal anterior. Los respaldos PostgreSQL conservarian metadata, no bytes nuevos; descargas realizadas y respaldos externos requieren gestion fuera de la aplicacion y no se pueden revocar desde el panel.

## 5. Contratos API propuestos

Rutas relativas; conservar los prefijos existentes del registro de rutas, incluida su variante `/api`.

| Metodo/ruta | Contrato |
|---|---|
| `GET /teachers/:teacherId/dossier` | Identidad operativa, telefono/version, documentos autorizados, capacidades; sin fiscal completo por defecto |
| `PATCH /teachers/:teacherId/dossier/contact` | Solo `phone`, `expectedVersion`, `operationId`; permiso `fiscal.manage` |
| `POST /teachers/:teacherId/dossier/documents` | Un PDF por solicitud, tipo/titulo, nombre, MIME, contenido y `operationId` |
| `PATCH /teachers/:teacherId/dossier/documents/:documentId` | Tipo/titulo y revision esperada; no cambia docente propietario |
| `PUT /teachers/:teacherId/dossier/documents/:documentId/content` | Reemplazo explicito de PDF, revision esperada e idempotencia |
| `GET /teachers/:teacherId/dossier/documents/:documentId/content` | Preview o descarga autenticada del archivo vigente |
| `DELETE /teachers/:teacherId/dossier/documents/:documentId` | Solicitud de borrado con revision esperada e idempotencia |
| `GET /teachers/:teacherId/dossier/operations/:operationId` | Estado minimo de operacion autorizada; sin rutas internas |

Los endpoints actuales de constancia mantienen sus rutas y formatos. Inventariar consumidores antes de ajustar sus guardas al acceso aprobado para Expediente; no redirigir reportes o Nomina a documentos adicionales.

DTO documental publico: id, tipo, titulo, nombre, MIME, tamano, fecha, estado, revision y capacidades. Omitir bucket, object, generation, contenido Base64 en respuestas de metadata y cualquier dato fiscal no requerido. El UUID se usa internamente, no se muestra como etiqueta.

Propuesta de transporte inicial: reutilizar JSON/Base64 por archivo como el flujo vigente, evitando dependencias nuevas. `app.ts` tiene bodyLimit global de 12 MiB y la constancia limita el contenido decodificado a 7.5 MiB. Proponer inicialmente hasta ese limite por PDF, 10 archivos por seleccion y maximo 2 transferencias simultaneas; **parametros tecnicos pendientes de prueba de capacidad/aprobacion**, no nuevos limites productivos vigentes.

Validar longitud codificada antes de decodificar, tamano real, MIME y estructura PDF; nunca agregar todo el lote a un unico JSON ni aumentar el limite global para acomodarlo. Si la prueba de memoria requiere streaming/multipart, tramitar su ajuste/dependencia antes de implementarlo. No afirmar que comprobar `%PDF` equivale a escaneo de seguridad: definir parser y estrategia de archivos maliciosos antes del release.

Ubicar idempotencia/version en cuerpo JSON o query validado para DELETE conforme a convenciones, evitando nuevos headers por defecto: CORS actual permite `Authorization` y `Content-Type`. El `operationId` no es credencial y debe ligarse al actor/accion/payload.

Errores propuestos: 401 sin sesion; 403 sin permiso; 404 recurso no visible; 409 revision/idempotencia en conflicto; 413 tamano; 415 tipo; 422 PDF invalido; 503 almacenamiento no disponible. Codigos de dominio estables. Operacion persistida pero pendiente: 202 con estado, nunca falso exito.

## 6. Protocolo de consistencia

### Carga

1. Autorizar docente/accion, validar metadata, limites y PDF; reservar operacion y referencia opaca en transaccion corta.
2. Almacenar objeto privado con precondicion de no existencia; registrar generacion.
3. Publicar documento disponible y evento de auditoria en transaccion, solo tras validar que la intencion sigue vigente.
4. Ante fallo, conservar operacion recuperable para eliminar el objeto o completar de forma idempotente. Un reinicio no debe perder la tarea de limpieza.

### Reemplazo

1. Reservar operacion contra revision esperada, manteniendo disponible la referencia anterior para lectura.
2. Cargar/validar nuevo objeto distinto. Si falla, conservar el anterior y limpiar el fallido.
3. Cambiar referencia vigente con comparacion de revision y dejar tarea de eliminacion del objeto anterior en la misma transaccion.
4. Eliminar generacion anterior y confirmar limpieza; informar reemplazo con limpieza pendiente hasta completar. No conservar versiones como archivo historico.

### Eliminacion

1. Confirmacion UI y autorizacion backend; bloquear nuevas operaciones concurrentes, marcar `DELETING` y persistir intencion.
2. No entregar nuevos previews/descargas del documento en eliminacion. Eliminar el objeto/generacion y referencias temporales asociadas de forma controlada.
3. Confirmar ausencia conforme a la politica de almacenamiento; retirar metadata activa y registrar evento minimo. Objeto ya ausente es exito idempotente; permisos/retencion denegados no lo son.
4. Ante fallo, mantener pendiente y reintentar mediante reconciliador. Nunca eliminar primero toda la metadata y perder la referencia necesaria para limpiar almacenamiento.

No mantener transacciones SQL abiertas durante transferencias largas. Usar revision/CAS y transiciones condicionadas, no un bloqueo de conexion prolongado. Revalidar acceso del actor antes de publicar mutaciones; el worker solo completa intenciones autorizadas persistidas y limpieza interna, no acepta operaciones arbitrarias.

La eliminacion definitiva no tiene restauracion automatica. Un rollback de codigo no debe reponer archivos borrados ni ejecutar reversion destructiva de tablas.

## 7. Preview, descarga y auditoria

Reutilizar el patron autenticado fetch/blob + URL temporal local y revocacion al cerrar/cambiar documento. Aislar visor PDF, sin permitir scripts/HTML del archivo; probar navegador real. Respuesta `application/pdf`, `nosniff`, `Cache-Control: private, no-store`; `Content-Disposition` seguro inline/attachment segun accion. No registrar URLs de objeto ni exponer enlaces publicos.

Eventos propuestos: carga, reemplazo, reclasificacion, solicitud/eliminacion completada o fallida y actualizacion de telefono. Guardar actor, fecha, docente/documento, accion, resultado y correlation id. No contenido documental, Base64, tokens ni ficha fiscal completa. Auditoria y operacion deben evitar duplicados al reintentar.

No habilitar OCR/extraccion ni envio a proveedores externos. La validacion de PDF no garantiza ausencia de malware; documentar/probar el control elegido y no servir un archivo aun no validado.

## 8. Frontend

Mantener `FiscalRecordsView.vue` como entrada. Extraer componentes acotados para panel de expediente, lista/cola documental y visor si reduce duplicacion. Reutilizar patrones e iconos del proyecto, no instalar librerias visuales nuevas sin necesidad aprobada.

Agregar helpers de autorizacion especificos del modulo en store/router/menu; no cambiar indiscriminadamente `canViewFiscal` usado por otras vistas. Backend sigue siendo autoridad.

Carga: seleccion multiple, validacion temprana por archivo, asignacion de tipo, cola limitada, progreso individual y reintento idempotente. Cerrar panel no cancela silenciosamente una operacion ya aceptada: advertir cargas pendientes y recuperar estado al volver. Cancelar una transferencia no equivale a borrar un documento confirmado.

Telefono: guardado independiente con control de version, actualizar el estado del docente y refrescar el listado; Directorio relee la fuente compartida. No reenviar campos fiscales para guardar telefono. Errores 403/409 deben retirar capacidad o pedir recarga, no reintentar escrituras ciegas.

## 9. Migracion y compatibilidad futura

Se requerira una migracion aditiva H05 para metadata/operaciones. La ultima migracion encontrada en el repositorio es 015; el nombre/numero siguiente se confirma al iniciar implementacion. **No se crea SQL en H24-F0 y no se autoriza aplicar ninguna migracion.**

No backfill de constancias, no copiar archivos antiguos, no modificar `teachers`, no DML de roles/permisos ni snapshots. Probar exclusivamente en `nomina_docente_test` y almacenamiento aislado con PDF sinteticos. Migracion productiva requiere backup, revision, aprobacion y checklist H05/H13 separados.

Regresiones obligatorias: joins y exportables de constancia, avance fiscal, Directorio, importacion H22, PDF consolidado de efectivo, nombres por rol, alcance H20 y calculos H01/H23. No modificar su logica para incorporar documentos adicionales.

## 10. Plan de pruebas y gates

| Nivel | Evidencia requerida |
|---|---|
| API permisos | Admin completo; Finanzas/RH por accion; roles excluidos 403 aun con permisos amplios; sin sesion 401 |
| API recursos | IDs cruzados, acceso a contenido/operaciones, usuario inactivo, revocacion y alcance |
| Archivos | PDF valido/invalido, extension falsa, exceso de tamano/cantidad, nombre peligroso, caracteres/acento, multiples del mismo tipo |
| Concurrencia | Dos reemplazos, reemplazo vs delete, reintentos de upload, clave repetida con payload distinto, telefono obsoleto |
| Fallos | Caida antes/despues de cada escritura de objeto/metadata, storage 403/timeout, restart del worker, eliminacion repetida |
| Eliminacion | Ausencia de bytes/versiones retenidas en storage de prueba; sin huerfanos; auditoria minima preservada |
| Frontend | Cola, errores parciales, visor/descarga, permisos, foco/teclado, 1440x900, 768x1024, 390x844 |
| Regresion | Constancia, telefono Directorio, avance fiscal, pagos y Nomina intactos |

Validaciones futuras: `npm run test:api`, `npm run test:api:integration` solo en test, `npm run test:web`, `npm run typecheck`, `npm run build`, pruebas de almacenamiento aislado y smoke autorizado. No se ejecutan ahora por ser fase documental.

Antes de desarrollar: confirmar parametros de carga, solucion de validacion PDF, reconciliador y almacenamiento compatible con borrado. Antes de desplegar: pruebas verdes, backup/migracion autorizados, roles reales revisados sin ampliar permisos, alertas de operaciones atascadas y plan de rollback. No prometer borrado definitivo con solo un DELETE HTTP exitoso.

## 11. Superficie futura de cambios

- API: rutas de expediente separadas o agrupadas segun patron vigente, servicio de documentos/storage y guardas especificas; ajuste acotado de la eliminacion de docente para evitar huerfanos.
- Web: `FiscalRecordsView.vue`, componentes acotados, contratos de `api.ts`, store/router/menu y pruebas.
- BD: futura migracion aditiva de metadata/operaciones, nunca alteracion de migraciones historicas.
- Infraestructura: almacenamiento/reconciliador privados sujetos a aprobacion independiente.
- Documentacion: auditorias por fase; SDD/matriz/manuales al estado real, sin presentar H24 como productivo antes de su cierre.

## 12. Evidencia y confirmaciones de la fase documental F0

Seguimiento de implementacion PD-04 (2026-10-28): `dossier-worker.ts` separa
recuperacion de adicionales/constancias, reporta backlog posterior y no expone
detalles privados de errores. Umbrales iniciales: >25 pendientes o >900 s;
FAILED reciente avisa por 24 h, sin reintento de operaciones terminales.
Antiguedad de adicionales usa created_at para no reiniciarla en cada retry.
Constancias usa uploaded_at como limite conservador y gracia STAGING de 24 h.
Prueba programada Windows limitada a dos ejecuciones, tarea retirada, test
restituido. No equivale a job Cloud Run/Scheduler ni Monitoring aprovisionados.
Evidencia y pendientes en
`docs/auditoria/H24_PD04_Validacion_Worker_Recuperacion_Alertas.md`.

Confirmaciones historicas F0:

Fuentes locales revisadas: `database/001_initial_schema.sql`, `apps/api/src/routes/teachers.ts`, `apps/api/src/auth.ts`, `apps/api/src/app.ts`, `apps/web/src/views/FiscalRecordsView.vue`, `apps/web/src/stores/auth.ts`, `apps/web/src/router/index.ts`, SDD consolidado y auditorias H03/H05/H13.

Solo se prepararon SPEC y diseno. No se modifico codigo, SQL, BD, archivos docentes, infraestructura, permisos ni reglas de negocio; no hubo migracion, instalacion de dependencias, acceso a produccion ni deploy. La capacidad descrita es futura, no una funcionalidad disponible.
