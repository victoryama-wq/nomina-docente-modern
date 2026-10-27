# H24-PD-02 - Plan de validacion GCS aislado

Fecha: 2026-10-27.
Base revisada: `be4646d` en `feature/h02-h03-user-coordinations-permissions`.
Estado inicial: **preparado, pendiente de autorizacion y ejecucion. PD-02 abierto; H24 NO-GO**.

Primer seguimiento autorizado 2026-10-27: exportacion read-only y copia local saneada
completadas; proyecto `nomina-h24-test-20261027` creado. Vinculacion de facturacion
rechazada por cuota; no hay bucket ni prueba GCS. Ver
[resultado y custodia local](H24_PD02_Copia_Local_Anonimizada_GCS.md).
Las autorizaciones pendientes de las tablas siguientes describen la preparacion
inicial; el acta de resultado registra las aprobaciones posteriores y su alcance.

Continuacion tras aprobacion de cuota: facturacion vinculada, bucket privado e
IAM de prueba creados; adaptador real y API local con GCS ensayados. **PD-02
cerrado en alcance tecnico local/test**, con RH/Contador y Firebase real separados
en PD-05, y programacion del worker en PD-04. H24 permanece NO-GO. Ver
[resultado GCS y limites de evidencia](H24_PD02_Resultado_GCS_Aislado.md).
Las matrices futuras y pendientes siguientes se conservan como protocolo original;
no representan el resultado final de las pruebas.

## 1. Alcance y evidencia disponible

Preparacion documental tras el cierre local de PD-01. Se revisaron configuracion,
adaptador GCS y predeploy F4; no se consultaron recursos ni credenciales cloud.
Solo se consulto documentacion publica oficial. Arbol limpio al comenzar.

Fuentes locales: `apps/api/src/lib/dossier-storage.ts`, `apps/api/src/config.ts`,
`apps/api/src/firebase.ts`, SPEC/diseno H24 y
[predeploy F4](H24_Fase4_PreDeploy_Expediente_Docentes.md), secciones 2 a 5.
La evidencia anterior de GCS es simulada; la prueba Linux de pdfinfo no valida GCS.

Esta preparacion no crea recursos, scripts ejecutables ni modifica permisos,
codigo, SQL, BD, dependencias o configuracion de servicios. No incluye deploy.
La ejecucion futura SI escribira y borrara objetos sinteticos en GCS de prueba;
por eso requiere autorizacion expresa y no se denomina read-only.

## 2. Recursos y autorizaciones pendientes

No se ha elegido ni comprobado un proyecto o bucket de prueba. Completar y aprobar
los valores siguientes antes de autenticar o provisionar. No usar el proyecto
`nomina-docente-prod`, sus cuentas de servicio ni `nomina-docente-prod-constancias`.

| Autorizacion | Datos/alcance que debe confirmar Admin/DevOps | Estado |
|---|---|---|
| A1. Entorno aislado | ID y numero de proyecto NO productivo; proyecto existente autorizado o aprobacion para crear uno; responsable y facturacion | Pendiente |
| A2. Recursos y coste | Bucket nuevo exclusivo H24, nombre y region; ventana/duracion, presupuesto y responsable de cleanup. Propuesta: Standard, namespace plano, hasta 20 PDF sinteticos y 150 MiB por ejecucion, sin prueba de carga | Pendiente |
| A3. Politica de borrado | Autorizar versionado desactivado, soft delete 0, sin retenciones/holds, UBLA y prevencion publica obligatorias, solo en el bucket nuevo | Pendiente |
| A4. Identidades/IAM | Crear o usar SA de prueba; permisos runtime y auditor separados, operador autorizado para impersonacion temporal; permisos de provisionamiento solo al administrador | Pendiente |
| A5. Ensayo y destruccion | Carga, lectura, descarga, reemplazo y borrado irreversible de TODOS los objetos sinteticos identificados en el manifiesto; pruebas negativas de acceso y generacion | Pendiente |
| A6. Integracion posterior | Autorizar API local, escrituras sinteticas en nomina_docente_test y reconciliador local sobre el mismo bucket; sin reset ni migracion implicitos | Pendiente, separada de etapa A |
| A7. Retirada de recursos | Revocar bindings temporales y borrar bucket vacio/SA/roles creados exclusivamente para la prueba, o conservarlos por plazo acordado; nunca borrar proyecto ni recursos compartidos automaticamente | Pendiente |

Un presupuesto/alerta de facturacion no se considerara un limite automatico de
gasto. No solicitar contrasenas, claves privadas o tokens por chat. Login humano
en Brave cuando se autorice; configuracion/ADC local separada, fuera del repo y
sin sobrescribir credenciales habituales. Preferir impersonacion de SA con
credenciales de corta duracion; no crear claves JSON privadas. Node.js admite
ADC por impersonacion, sujeto a probarlo con las versiones instaladas.
[Referencia oficial](https://docs.cloud.google.com/docs/authentication/use-service-account-impersonation).

## 3. Separacion de permisos

| Identidad | Permisos propuestos en el bucket de prueba | Restricciones |
|---|---|---|
| Runtime de prueba | storage.buckets.get; storage.objects.create, get, delete | Rol minimo dedicado con binding al bucket, sin Storage Admin, list, cambio de politica ni IAM |
| Auditor de prueba | storage.buckets.get, getIamPolicy; storage.objects.get, list | Sin crear ni borrar objetos; evidencia de metadata, inventario y ausencia |
| Actor negativo | Metadata sola, o lectura sin delete segun caso | SA independiente sin permisos heredados que invaliden la prueba negativa |
| Provisionador humano | Crear/configurar exclusivamente recursos aprobados; crear rol/bindings/SA si hace falta | No trasladar estos permisos al runtime; registrar cambios y retirar acceso temporal |

La lectura IAM de proyecto/ancestros, si se necesita para revisar herencia, se
autoriza aparte sobre el entorno de prueba o la aporta su administrador. No
consultar jerarquia productiva. Revisar que runtime no herede Editor/Owner/Storage
Admin ni acceso a buckets reales. Token Creator se concede solo sobre la SA de
prueba aprobada, no sobre todo el proyecto. API IAM Credentials y cualquier otra
API necesaria solo se habilitan en proyecto test con aprobacion.

`storage.buckets.get` no permite leer IAM; el auditor necesita getIamPolicy.
Inventario necesita objects.list. Estos permisos cloud no sustituyen roles y
alcance Admin/Finanzas/RH de la API.
[Referencia IAM](https://docs.cloud.google.com/storage/docs/access-control/iam-permissions).
No dar acceso GCS directo al navegador ni cambiar CORS del bucket para este ensayo.

## 4. Preflight obligatorio y politica

Antes de importar Firebase/config o ejecutar operaciones:

1. Registrar SHA, proyecto ID/numero, bucket, identidades, ventana y aprobaciones.
2. Usar proceso/credenciales aislados y variables explicitas GCP_PROJECT_ID,
   FIREBASE_PROJECT_ID y DOSSIER_BUCKET del entorno aprobado. NODE_ENV=test para
   harness; DOSSIER_STORAGE_MODE=gcs. No heredar endpoints de emulador ni proxies
   que conviertan la prueba en simulada. No imprimir el entorno completo.
3. Configurar DB_NAME=nomina_docente_test y DB_HOST loopback como defensa adicional;
   en etapa A NO importar servidor, pool o worker ni conectarse a BD. Sin
   INSTANCE_CONNECTION_NAME ni secretos productivos. CONSTANCIAS_BUCKET sera un
   nombre de prueba distinto y no utilizado, no el default productivo.
4. Verificar identidad efectiva, proyecto propietario del bucket y coincidencia
   con el manifiesto aprobado. No basta con cambiar el proyecto activo de gcloud.
   El adaptador actual NO impone una allowlist de proyectos: esta guarda debe
   estar en el arnes de prueba futuro, antes de invocar el SDK.
5. Verificar que el bucket es nuevo y vacio, sin IAM publico ni permisos excesivos
   heredados. Registrar metadata/politica antes y despues; detenerse si cambia.
6. Ejecutar assertSafe() del adaptador real antes de la primera carga.

Politica exigida por el codigo: versioning.enabled=false;
softDeletePolicy.retentionDurationSeconds=0; sin retentionPolicy ni objectRetention;
defaultEventBasedHold no true; uniformBucketLevelAccess.enabled=true;
publicAccessPrevention=enforced. Revisar tambien ausencia de holds individuales.
No crear Bucket Lock, retenciones bloqueadas, lifecycle, replicadores externos o
notificaciones que alteren/copian objetos de prueba.

**Gate de compatibilidad:** si GCS omite false/0 en metadata, el adaptador actual
rechaza la operacion. Registrar la respuesta sanitizada y detenerse: no relajar
la guarda ni modificar codigo en esta preparacion. Cualquier correccion requiere
fase acotada, pruebas y aprobacion. Comprobar tambien la generacion real retornada
por save() y su aceptacion por googleGeneration().

Desactivar soft delete no acorta la retencion de objetos eliminados anteriormente.
Se exige bucket nuevo y politica verificada antes de crear/borrar archivos.
[Referencia soft delete](https://docs.cloud.google.com/storage/docs/soft-delete).

## 5. Matriz de ejecucion futura

Todos los casos estan **pendientes**, no aprobados por inspeccion de codigo.
PDF generados sinteticos, sin nombres de docentes, CURP, constancias ni otros datos
personales. Claves UUID compatibles con validateKey; manifiesto local con clave,
generacion, hash SHA-256, longitud y caso. No usar nombres humanos como object key.

### Etapa A - Adaptador real, sin API ni BD

| Caso | Resultado exigido y evidencia |
|---|---|
| Politica/identidad | assertSafe real satisfactorio; proyecto/bucket/SA y metadata correctos |
| Carga multiple controlada | Varias cargas individuales con el adaptador existente, generaciones validas, MIME PDF y private/no-store; no equivale aun a prueba UI |
| Lectura/descarga | Hash y bytes iguales al PDF sintetico; CRC32C validado por SDK |
| Crear sobre clave existente | ifGenerationMatch=0 impide sobreescribir; conflicto y objeto original intacto |
| Reemplazo | Cargar nueva clave UUID, comprobar lectura, retirar generacion anterior; nuevo hash correcto y anterior ausente |
| Generacion obsoleta | Crear, borrar y recrear misma clave con otra generacion; delete con generacion vieja da 412/conflicto, conserva nueva; limpieza posterior con generacion vigente |
| Borrado e idempotencia | Eliminar con generacion correcta; segunda eliminacion 404 tolerada por adaptador, sin recreacion |
| Actor sin delete | Borrado rechazado 403 en GCS; comprobar objeto intacto con auditor; error API saneado puede no conservar HTTP proveedor |
| Actor sin acceso/anonimo | No leer bytes ni listar; verificar denegacion real, no timeout ni credencial expirada confundidos con permisos correctos |
| Inventario final | Ausencia de claves/generaciones de la prueba conforme seccion 6; cero huerfanos |

Para negativos usar identidades separadas con permisos prefijados; evitar toggles
IAM durante una operacion y falsos resultados por propagacion. No habilitar
publico, soft delete ni retencion para probar rechazo en el bucket principal.
Los negativos de politicas peligrosas se mantienen simulados salvo autorizacion
separada de un recurso desechable adicional; nunca bloquear retencion.

### Etapa B - Servicio completo local/test, autorizacion A6

Una vez aprobada etapa A y resuelto el entorno DBA de PD-08, probar API local con
nomina_docente_test, fixtures sinteticos existentes y el bucket aprobado. Verificar
subida multiple, preview/descarga, reemplazo, borrado y registro de operaciones.
Provocar fallos controlados de storage y corte de proceso local para comprobar
intenciones pendientes, reintento idempotente, reconciliacion y cero huerfanos.
No correr reset/prepare/migracion o crear docentes implicitamente. Si falta schema
o fixture, detener y solicitar autorizacion local especifica.

Reutilizar pruebas por rol sin ampliar permisos. Actores sinteticos solo demuestran
autorizacion de aplicacion; no cierran PD-05 de Firebase real. El reconciliador
manual no cierra PD-04 de programacion, alertas y operacion. No ensayar telefono
ni datos fiscales para demostrar borrado GCS. No programar Cloud Run/Scheduler.

## 6. Evidencia de borrado definitivo

Con auditor independiente, registrar por cada clave/generacion retirada:

- GET exacto ausente; distinguir 404 de 403, fallo de red o permiso insuficiente.
- Inventario vivo y versions=true sin coincidencias; recorrer todas las paginas.
- Consulta separada softDeleted=true, sin versions=true, para evidenciar retenidos
  cuando la API la admita. Nunca traducir una respuesta de error a lista vacia.

La API documenta 400 invalidArgument cuando no existe politica soft delete. Si
ocurre, registrar esa limitacion, no afirmar que se listaron cero retenidos.
La aceptacion alternativa exige evidencia del bucket nuevo, politica 0 verificada
antes de toda eliminacion, ausencia de cambios durante el ensayo y GET/inventario
de generaciones negativos. Si esa trazabilidad no es suficiente, PD-02 permanece
abierto; no habilitar soft delete para forzar la consulta.
[Contrato de inventario GCS](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/list).

Un DELETE exitoso o una fila marcada eliminada en BD no demuestran por si solos
ausencia de versiones. La conclusion se limita a ausencia de objetos recuperables
por GCS en el alcance probado; no certifica borrado fisico forense interno de
Google ni elimina copias descargadas/backups externos.

## 7. Cierre, abortos y limpieza

Detenerse ante destino/identidad incorrectos, politicas no verificables, acceso
inesperado, error de integridad, residuo recuperable, conteo diferente o necesidad
de permisos no aprobados. No reparar produccion ni ampliar permisos para continuar.
No considerar 403 inesperado o timeout como prueba satisfactoria.

Limpiar solo claves/generaciones propias del manifiesto con precondiciones; nunca
borrado recursivo por comodin. Si hay residuo, documentarlo y conservar trazabilidad
para limpieza autorizada; no declarar cierre. Borrar bucket/SA/roles solo con A7,
tras demostrar vacio, y sin afectar recursos compartidos. No borrar el proyecto.

Evidencia local restringida: metadata sanitizada, resultados SDK/HTTP, hashes,
generaciones, inventarios completos, duraciones y limpieza. No versionar PDFs,
tokens, ADC, secretos ni volcados de entorno. Acta final: SHA, aprobaciones,
matriz ejecutada, incidencias, recursos restantes y conclusiones comprobadas.

PD-02 se cierra solo con politica e IAM reales, pruebas positivas/negativas,
borrado/reemplazo sin versiones recuperables y recuperacion local/test demostrada
o dependencias abiertas explicitamente separadas sin falsear el gate completo.
No cierra los otros bloqueantes H24 ni autoriza deploy automaticamente.

## 8. Resultado de esta preparacion

- Plan y autorizaciones definidos; ninguna prueba GCS real ejecutada.
- PD-01 permanece cerrado localmente; PD-02 permanece abierto.
- Sin acceso a produccion, recursos cloud creados, IAM modificado, BD, migraciones,
  deploy, cambios funcionales o dependencias nuevas.
- Validaciones documentales: git diff --check, git diff --name-only y git status.
- Tests/build no requeridos: solo Markdown. Commit/push no solicitados en esta fase.
