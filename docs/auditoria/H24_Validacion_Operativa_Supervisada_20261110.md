# H24 - Ventana supervisada de validacion operativa

## Plan previo a mutaciones

Autorizacion: una ventana de dos horas desde la primera consulta productiva,
sin release API/Hosting ni habilitacion de H24. Inicio 2026-11-10 14:17:47
America/Cancun (19:17:47.507Z), vencimiento 16:17:47 (21:17:47.507Z).
SQL conserva 06:50-22:00; cierre obligatorio antes de 21:55. No renovacion automatica.
Referencia documental 6d0ee7b; candidata 57c565a. Rama limpia y sincronizada;
las diferencias contra candidata son nueve archivos documentales, no runtime.
H05 reconfirmado 20/0/0, inspect read-only salida 0. Backup1794335839733
SUCCESSFUL de hoy; no se repite backup ni se aplican migraciones.

### IAM: diff y condicion de ejecucion

Recurso: bucket nomina-docente-prod-constancias. Miembro:
serviceAccount:nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com.
Diff previsto: quitar solo ese miembro de roles/storage.objectAdmin y conservar
projects/nomina-docente-prod/roles/h24DossierApiStorage, que contiene
storage.buckets.get y storage.objects.get/create/delete. Ningun otro binding,
SQL, politica de bucket o permiso de impersonacion debe cambiar.
Reversion ante regresion: reponer unicamente el miembro/binding retirado.

La API vigente y rollback b3f40ce/00057 usan save/download/delete; la candidata
agrega metadata y precondiciones de generacion, cubiertas por el rol minimo.
La prueba operativa debe usar la identidad runtime con objetos sinteticos y
confirmar que restore no persiste por grants heredados. El acceso existente
generateAccessToken devolvio403; no se otorgaron permisos nuevos. **Retirada
suspendida hasta acreditar esa prueba**, no se confunde metadata con CRUD real.

Alternativa dentro del alcance: el usuario confirmo disponibilidad de sesion
Admin productiva. Se prepara un segundo docente ficticio, separado del worker,
para prueba humana de carga/lectura/reemplazo/borrado por API vigente. Esto usa
el runtime real sin ampliar impersonacion. Solo tras confirmar baseline y
compatibilidad del codigo se retira el binding; ante fallo se repone y se para.

### Casos y resultados esperados

| Caso | Preparacion / ejecucion prevista | Esperado |
|---|---|---|
| Aislamiento de cola | Conteos previos globales de dossier y marcadores de constancia; cotejo antes de cada job contra UUID de fixture | Cero operaciones ajenas; detener ante discrepancia |
| Productor vigente | Revision exacta 00057/b3f40ce solo escribe CONSTANCIA_FISCAL, sin estados H24 | API actual no agrega intenciones al worker |
| Canal / ERROR | Habilitar politicas existentes; ejecutar job aun desarmado una vez | Fallo real WORKER_START_FAILED sin BD/GCS; aviso de fallo, no falso exito |
| Ausencia | Mantener Scheduler PAUSED y no emitir exitos de limpieza hasta apertura | Incidente por serie ausente/25min sin exito, sostenido5min |
| Recuperacion | Procesar operaciones sinteticas reales con worker temporalmente armado | Exito real y cierre de ausencia con correo de recuperacion |
| Reemplazo y reintento | A retirada/B vigente; adicional con generacion incorrecta en fixture, despues corregida a la observada | 412/fallo seguro; B intacta; reintento con generacion correcta limpia solo A |
| Constancia | Marcar A sintetica retirada, B sintetica vigente | A soft-deleted con timestamps separados604800s; B hash intacto |
| Adicional | Operaciones sinteticas PREPARED/CLEANUP/DELETE | Publicacion recuperada, integridad y borrado definitivo |
| Idempotencia | Reejecucion sin intenciones pendientes | Ninguna repeticion de cambios ni auditoria adicional por operaciones completas |
| Solapamiento | Mantener lease advisory del worker desde conexion de prueba y disparar job | SKIPPED_OVERLAP, cleanupSucceeded=false |
| Horario | Codigo y pruebas locales con reloj inyectado, sin alterar reloj productivo | Documentar separado; no afirmar borde horario productivo ejecutado |

Fixtures: usuario sin identidad Firebase, docente ficticio inactivo, PDF
sinteticos, IDs y generaciones inventariados. app_nomina prepara solo fixtures;
worker conserva su identidad SQL y grants. La cola global observada inicialmente
tiene0 operaciones,0 documentos adicionales y0 marcadores de constancia.
No basta el prefijo: comprobar conjuntos de IDs y estados elegibles antes del
armado/ejecuciones. No ejecutar si aparece una fila ajena.

### Alertas y reversion de configuracion

Politicas11811020579760829856 (ERROR) y3484231198314869307 (ausencia):
enabled false -> true temporal. ERROR autoClose86400s ->1800s exclusivamente
para observar cierre dentro de ventana; conservar filtro y limite300s.
Ausencia conserva query/25min/5min y solicita notificationPrompts OPENED,CLOSED
para recibir recuperacion. Al terminar, restaurar estrategias originales y
enabled=false. Canal email12474838942187959572 activo, receptor autorizado;
UNSPECIFIED no prueba por si solo necesidad de codigo. No cambiar destinatario.

La API Monitoring solo admite OPENED para LogMatch: el cierre de ERROR se
verificara por estado y recuperacion real; **no prometer correo CLOSED de esa
politica**. Ausencia si puede notificar OPENED/CLOSED. Referencias:
[AlertStrategy](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.alertPolicies#AlertStrategy),
[autocierre minimo30min](https://docs.cloud.google.com/logging/docs/alerting/log-based-alerts),
[canal email](https://docs.cloud.google.com/monitoring/support/notification-options).

### Cierre y costo previstos

Desarmar worker, Scheduler PAUSED, ninguna ejecucion activa, alertas disabled,
estrategias originales restauradas. Eliminar exclusivamente fixtures propios;
conservar evidencia de auditoria y soft-deleted sinteticos durante los siete dias
normales. Ninguna politica de bucket se acorta. API/Hosting/trafico intactos.

Objetivo acumulado USD10, no adicional. Estimacion anterior <USD3; reservar
<USD2 para esta ventana: acumulado estimado <USD5, no gasto liquidado ni saldo
exacto. Supuestos: hasta8 ejecuciones de1CPU/1GiB y240s maximo, PDF pequenos,
sin builds, instancias nuevas, ampliacion de horario, backups ni analizadores.
Retencion de recursos despues de la ventana se separa del ensayo.

## Resultados

### Precheck e IAM

H05 inspect20/0/0 a19:18:35Z, ambas tablas presentes, prefijos historicos
007/008/009 revisados por identificador completo. Sin apply ni nuevo respaldo.
API00057-c7d conserva digest a7d0de2196c5552d50cd75b8f01e15238dc90f701941b8656613bf6d1789196b.
La candidata worker conserva digest f1aafc5cbc0d4f8a658c1bede3abb9af656ef3a48b3e1b584ab632f052958303.

La jerarquia observada es proyecto -> organizacion908354127471, sin carpetas.
La SA API solo tiene cloudsql.client y secretmanager.secretAccessor en proyecto;
ningun binding directo en organizacion o politica propia de SA. Bucket conserva
el rol minimo y objectAdmin. Intento de credencial runtime existente:403.
Policy Troubleshooter tambien403; no se habilito API ni se ampliaron permisos.
No se afirma restore denegado mientras objectAdmin siga presente.

El bloqueo de impersonacion se resolvio para la prueba funcional mediante la
sesion Admin real del usuario, sin obtener credenciales runtime ni otorgar
privilegios. Confirmo carga/descarga de PDF A; GCS acredita el SHA-256 original.
La enumeracion completa organizacion/proyecto/bucket no encontro grupos,
condiciones ni grants ambiguos aplicables a la SA: objectAdmin es la unica
fuente de restore. Se procede al diff exacto previsto y a repetir smoke por
API. Policy Troubleshooter403 queda documentado como limitacion de esa
herramienta, no se presenta como un dictamen de denegacion del permiso.

### Alertas y aislamiento: evidencia inicial

Canal email existente enabled=true; metadata no tiene verificationStatus.
La documentacion oficial contempla UNSPECIFIED para canales donde la verificacion
no aplica. No se intento forzar VERIFIED ni recapturar codigo: la recepcion real
es la evidencia operativa del canal en este ensayo.

Usuario confirmo por chat: **llegaron ambos avisos**, ERROR y ausencia, alrededor
de14:22 Cancun. Incidente de ausencia0.oeuyxzu1au4z OPEN a19:22:30Z.
Ejecucion desarmada nomina-h24-dossier-reconcile-v6tnm: WORKER_START_FAILED,
exit1, cleanupSucceeded=false a19:22:18Z. Es prueba real de guarda/canal,
no prueba de limpieza ni fallo de un servicio compartido.

Ejecucion nomina-h24-dossier-reconcile-krhmb: SKIPPED_OVERLAP a19:25:30Z,
cleanupSucceeded=false, plataforma exit0; lease ocupado por conexion dedicada
del propio ensayo y liberado al terminar. No se registro limpieza exitosa.

Fixtures creados a19:22:07.750Z: un docente sintetico INACTIVO, un usuario
sintetico sin firebase_uid, dos constancias, dos documentos adicionales, dos
operaciones y cinco objetos PDF sinteticos. No se cambiaron roles compartidos
ni se otorgaron permisos al worker para crear fixtures. Se respeta la espera
real de cinco minutos; no se antedatan registros ni se cambia reloj productivo.

### Pruebas locales complementarias

`npm --workspace apps/api run test -- src/test/dossier-worker-guard.test.ts
src/test/dossier-worker.test.ts src/test/constancia-storage.test.ts
src/test/dossier-storage.test.ts`: salida0, cuatro archivos,134PASS y8skipped.
Los ocho corresponden a la seccion historica installed pdfinfo condicionada
por DOSSIER_PDFINFO_PATH ausente; no se reinstala el analizador retirado ni se
presentan como pruebas ejecutadas. Guardas de inicio/cierre, disparos demorados,
lease y limite230s se probaron localmente con reloj inyectado, no forzando el
horario del servicio productivo. No equivale a ensayo productivo nocturno.

El cierre y los limites del dictamen se registran al final; ningun resultado
de este ensayo autoriza por si solo el release API/Hosting.

### Primer ciclo del worker

Ejecucion nomina-h24-dossier-reconcile-sr8ct, final19:28:53.848Z, exit1 esperado:
dos operaciones procesadas, una COMPLETE y otra pendiente por generacion
incorrecta. PREPARED recuperada; la intencion REPLACE conserva CLEANUP con
DOSSIER_RETRY_REQUIRED y attempts=1. La constancia A se retiro pese al fallo
independiente del adicional. La generacion y SHA-256 de B permanecen intactos.

| Objeto sintetico | Generacion | Evidencia |
|---|---|---|
| Constancia A | 1794338515045110 | Sin vigente; GET softDeleted=true de esa generacion200 |
| Constancia B vigente | 1794338516720596 | GET200 y SHA-256 correcto |
| Adicional A que debe retirarse | 1794338518395718 | Permanece intacto tras intento con1794338518395719 |
| Adicional B vigente | 1794338519981142 | GET200 y SHA-256 correcto |
| Adicional recuperado PREPARED | 1794338521559171 | COMPLETE, GET200 y SHA-256 correcto |

Constancia A: softDeleteTime2026-11-10T19:28:49.266Z,
hardDeleteTime2026-11-17T19:28:49.266Z, diferencia exacta604800s.
SHA-256 PDF A: da47c8b1555a6059c3ef614e91e29c730200cd1c8a1d4d7b7090ccf49c3508e6.
SHA-256 PDF B: d288527a1f0781456ac891520177dc3d13c306d8c29de1abbe7e1019d0ef47c6.
Se corrigio solo la generacion deliberadamente incorrecta del fixture a la
generacion previamente inventariada y se espera nuevamente la elegibilidad
normal de cinco minutos; no se modifican intenciones reales ni codigo.

### Recuperacion e idempotencia del worker

Ejecucion nomina-h24-dossier-reconcile-tjdgk, final19:37:23.101Z: exit0,
REPLACE paso a COMPLETE, attempts=2, error_code=NULL; old_generation quedo
limpiada. La generacion retirada del adicional dejo de estar vigente y los
tres objetos B conservaron sus generaciones y SHA-256 originales. Auditoria:
dos OPERATION_COMPLETED y un UPLOADED, sin duplicar la recuperacion previa.

Ejecucion nomina-h24-dossier-reconcile-5kfpp, final19:40:41.841Z: exit0,
processed=0, pending=0, cleanupSucceeded=true. Inspeccion SQL posterior identica
en estados, intentos y conteos de auditoria a la previa: idempotencia PASS.
Es una inspeccion real de colas vacias, no un log de exito fabricado.

### Continuidad API con IAM minimo: smoke humano y evidencia GCS

Retirada autorizada del unico miembro API de roles/storage.objectAdmin a
19:36:08.381Z, con etag y diff previo. El rol h24DossierApiStorage permanece.
Enumeracion efectiva posterior: storage.buckets.get y objects.get/create/delete;
**storage.objects.restore no otorgado** en jerarquia completa observada, sin
grupos/condiciones ambiguos. No se realizo una restauracion ni se obtuvo un
token impersonado; este dictamen de permisos procede de politicas y definiciones
de roles, distinto del smoke funcional con runtime autentico de la API.

Usuario confirmo carga/descarga baseline A y, tras retirar el binding, lectura A,
reemplazo por B y descarga B. Verificacion read-only: A is_current=false,
B is_current=true, SHA-256 de ambas coincide con los originales sinteticos.
Docente exclusivo UI: df5bf1e2-1010-4d73-935d-4c6cbe319bd4. Generaciones:
A1794339323059492; B1794339614665087. No se editaron RFC, correo, banco o pago.

La API anterior conserva A almacenada como historica al reemplazarla; esto es
comportamiento de 00057, **no prueba del reemplazo H24 futuro**. Para acreditar
delete con el runtime minimo y retirar el fixture, el usuario elimino solo ese
docente desde Directorio. Verificado teacher=0 y documents=0 para su UUID.
Ambos objetos carecen de vigente y GET softDeleted de su generacion devuelve200:

| Generacion UI | softDeleteTime UTC | hardDeleteTime UTC | Diferencia |
|---|---|---|---:|
| 1794339323059492 | 2026-11-10T19:41:35.704Z | 2026-11-17T19:41:35.704Z | 604800s |
| 1794339614665087 | 2026-11-10T19:41:35.765Z | 2026-11-17T19:41:35.765Z | 604800s |

La consulta posterior no borro objetos: acredita el delete efectuado por la API
vigente. No se repuso objectAdmin porque no hubo regresion ni grants nuevos.

### Recuperacion de ausencia

La metrica DELTA h24_dossier_cleanup_success contiene puntos1 correspondientes
a las ejecuciones reales19:37 y19:40. No se escribieron puntos sinteticos en
Monitoring. Incidente0.oeuyxzu1au4z: CLOSED automatico19:42:59Z, despues de OPEN
19:22:30Z. El resultado vacio de la consulta PromQL despues del exito se observo
por API de consultas; no se cambio la query ni se cerro manualmente el incidente.
La entrega del correo de recuperacion se registra por confirmacion del receptor,
separada del estado CLOSED observado.
El usuario confirmo expresamente **"Si lo recibi"** para el correo de
recuperacion/cierre, no solo para las aperturas. La comprobacion de ausencia y
recuperacion queda PASS sin alterar umbral, horario o filtro de la politica.

### Borrado final, fixtures y conservacion de evidencia

Ejecucion nomina-h24-dossier-reconcile-gkfdk, final19:49:01.633Z, exit0:
dos DELETE adicionales COMPLETE y retiro de la constancia B sintetica al cerrar
el ensayo. Antes de esta ultima ejecucion se retiraron explicitamente los
fixtures ya probados; no se intento borrar una constancia todavia vigente.
Cuatro intenciones finales COMPLETE: UPLOAD attempts1, REPLACE attempts2 y
dos DELETE attempts1. Cero backlog o intenciones ajenas observadas.

Adicionales: las generaciones1794338518395718,1794338519981142 y1794338521559171
devuelven404 por nombre y por generacion exacta; list versions con prefijo
individual devuelve200 sin versiones. Politica efectiva softDelete0,
versioning=false, sin retenciones/holds. La consulta softDeleted devuelve400
con motivo explicito de politica no habilitada, **no404**. El primer chequeo
local esperaba404 y se detuvo; se conservo el diagnostico y se corrigio solo
el observador fuera del repositorio para exigir ese400 especifico, metadata0,
ausencia de generacion y lista vacia. No se modifico el adaptador ni GCS.

Constancia B del worker: generacion1794338516720596,
softDeleteTime2026-11-10T19:48:58.463Z,
hardDeleteTime2026-11-17T19:48:58.463Z;604800s. Junto con A y los dos PDF UI,
quedan **cuatro objetos sinteticos recuperables** hasta el17 de noviembre,
segun los timestamps individuales, sin restaurarlos ni acortar su politica.
No queda ningun objeto sintetico vigente de este ensayo en ambos buckets.

Worker desarmado a19:49:34Z y sin ejecuciones activas antes de retirar las filas.
Fixture worker retirado de teachers a19:50:27.369Z; sin horarios/extras/payroll.
Los dos docentes ficticios ya no aparecen. Se conservan cuatro operaciones
terminales como evidencia, con teacher_id=NULL por FK, y los eventos de
auditoria. El actor sintetico sin Firebase UID queda INACTIVO para preservar
las FK de auditoria; no se borra ni se reescribe historia. Se agrego un evento
H24_SYNTHETIC_FIXTURE_REMOVED. Conexiones propias y proxy cerrados.

### Requisito de autenticacion detectado para el release

**Pendiente concreto, no corregido en esta ventana:** la SA runtime API
nomina-api-sa no tiene firebaseauth.users.get en las politicas completas
observadas ni en las definiciones de sus roles. La candidata57c565a usa
verifyIdToken(token,true); la revision actual b3f40ce usa verifyIdToken(token)
sin esa comprobacion adicional. El SDK instalado llama getUser al verificar
revocacion/deshabilitacion. Por eso el login del smoke de00057 **no acredita**
la autorizacion Firebase necesaria para la candidata H24.

Se necesita autorizar un rol de lectura minimo a nivel proyecto para esa SA,
solo firebaseauth.users.get (nombre propuesto h24FirebaseSessionRead, no creado),
y comprobar la sesion con la candidata sin trafico general antes del release.
No se propone desactivar checkRevoked, otorgar Firebase Admin, usar otra SA ni
ampliar impersonacion. No se consultaron usuarios reales Firebase en este
diagnostico. Se trata de una carencia acreditada por politicas/codigo, no de un
fallo productivo provocado mediante login contra una API nueva.
Fuentes: [sesiones Firebase](https://firebase.google.com/docs/auth/admin/manage-sessions)
y [permiso de lectura](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaseauth).

Tambien queda por fijar y validar CPU/RAM/concurrencia/conexiones de la API
57c565a sin analizadores: el runtime actual1CPU/512Mi/concurrencia80 no se
certifica por estos PDF pequenos ni por las seis ejecuciones del worker.
No se cambia capacidad ni trafico en esta ventana.

## Cierre efectivo y dictamen

| Control final | Observado |
|---|---|
| Cierre de la ventana | 2026-11-10T20:08:27.292Z; **15:08:27 America/Cancun** |
| Duracion | **50 min 39.785 s**, dentro de las dos horas; sin renovacion |
| Worker | ALLOW_DOSSIER_RECONCILE=false, misma imagen/identidad dedicada |
| Scheduler | PAUSED; nunca se reanudo ni se altero su cron |
| Ejecuciones | Seis, todas terminales; cero activas |
| Cola | Cero intenciones pendientes, cero documentos adicionales, cero constancias pendientes/staging |
| Fixtures | Cero docentes y constancias SQL del ensayo; cuatro operaciones COMPLETE conservadas y actor ficticio INACTIVO sin Firebase UID |
| Alertas | Ambas disabled; estrategias y condiciones originales verificadas |
| ERROR | Incidente0.oeuz3yenat1x CLOSED; apertura19:29:45Z, cierre20:04:40Z |
| Ausencia | Incidente0.oeuyxzu1au4z CLOSED automatico19:42:59Z; correo de recuperacion confirmado |
| API | nomina-api-00057-c7d, trafico100%, misma spec e imagen |
| Hosting | Release1793121624438000 / version3f9ebc88c835a143, sin cambios |
| Health | 200 directo y por Hosting; auth/session anonimo401 en ambos |
| IAM | Proyecto identico; adicional identico; constancias solo retiro autorizado de objectAdmin para API |
| Buckets | Constancias604800/versionado ausente; adicionales0/versionado false; privacidad/retenciones/holds/lifecycle intactos |
| Conexiones | Conexion propia cerrada y proxy detenido |

La API de incidentes confirma CLOSED de ERROR pero no identifica por si sola
si fue autocierre o cierre humano. Se solicito al operador el cierre por consola
y despues precisar su intervencion. **No se acredita autocierre de ERROR solo
por el timestamp**; la recuperacion del worker si esta acreditada por ejecuciones,
colas y metrica. LogMatch no exige ni soporta correo CLOSED en notificationPrompts.
El cierre automatico y el correo de recuperacion de ausencia son comprobaciones
separadas, satisfactorias y confirmadas por el usuario.

Incidencia de procedimiento durante la restitucion: primer PATCH de alerta con
mascara anidada devolvio400. Se detuvo ese paso, se leyo la politica y se comprobo
que seguia exactamente en el estado temporal esperado; entonces se empleo la
mascara de nivel superior enabled,alertStrategy ya admitida por Monitoring.
Ambas politicas quedaron disabled y sus estrategias originales coinciden.
No hubo repeticion ciega ni cambio de condiciones, receptor o datos de metrica.

SHA-256 de spec API antes y despues:
c08c65c38974e5da3de87a159aa4d2a19f4b711b01d88bbca2e50b4a1ddc8e82.
No se desplegaron API/Hosting, cambiaron traficos, aplicaron migraciones,
generaron respaldos, publicaron imagenes o reintrodujeron analizadores.
Si hubo mutaciones productivas autorizadas: IAM acotado, configuracion temporal
de worker/alertas y creacion/limpieza de fixtures sinteticos. **No es un ensayo
read-only ni una afirmacion de cero escrituras de BD**. No se operaron expedientes
reales, Horarios, Nomina o snapshots; no se hizo fingerprint integral de datos
reales para sostener una afirmacion mas amplia que el alcance ejecutado.

### Costos y recursos restantes

Se mantuvo USD10 como objetivo unico acumulado. Estimacion conservadora anterior
<USD3 mas esta ventana <USD2: **acumulado estimado <USD5**. No hay export/cargos
liquidados que permitan afirmar gasto real o saldo exacto. Se ejecutaron seis
jobs frente a un presupuesto de hasta ocho, sin ampliacion de instancia SQL,
builds, nuevos servicios o backups; no se preve superar el objetivo.

Permanecen los recursos previamente preparados, no creados en este ensayo:
job desarmado, Scheduler pausado, secretos/identidades, buckets, metrica y
politicas disabled. Sus costos recurrentes son los del acta anterior y del
plan de infraestructura, separados de esta intervencion. Los cuatro PDF
sinteticos soft-deleted expiran por sus fechas normales del17 de noviembre;
los adicionales fueron eliminados definitivamente. No se acorta retencion ni
se borran recursos compartidos para simular ahorro o cierre.

### Resultado y siguiente paso ejecutable

- **PASS del ensayo operativo acotado**: IAM Storage minimo con continuidad
  real de API anterior; worker publicado con identidad dedicada, fallo parcial,
  reintento, idempotencia, exclusion por solapamiento, integridad y politicas
  diferenciadas de borrado; avisos ERROR/ausencia recibidos y recuperacion
  operativa comprobada. Guardas horarias son evidencia local, no ensayo nocturno.
- **No es GO de release ni cierre operativo H24**. Antes de publicar la candidata
  falta autorizar/comprobar firebaseauth.users.get para nomina-api-sa y fijar
  capacidad API de la arquitectura sin analizadores. Las reglas de negocio y
  permisos UI no cambian por esta observacion.
- Otra ventana debe autorizar revision API candidata sin trafico, smoke
  autenticado de esa version, release API/Hosting, activacion permanente de
  limpieza/alertas y smoke UI por rol. La secuencia y rollback quedan en
  ops/h24/README.md, condicionados; no ejecutados. No repetir016/017.
- Restauracion del backup1794335839733 no ensayada: SUCCESSFUL no equivale a
  restaurabilidad medida. Mantenerlo separado si se exige ese criterio futuro.

### Evidencia y validacion documental

Evidencia local fuera de Git:
%LOCALAPPDATA%/NominaDocente/H24-Supervised-20261110. Incluye window.json,
source-hashes.json, h05-inspect.json, precheck-complete.json,
iam-effective-enumeration-before/after.json, iam-bucket-post-remove.json,
iam-ui-observed-after-minimum-role.json, iam-ui-deletion-evidence.json,
fixture-manifest.json, resultados de las seis ejecuciones,
after-partial/after-retry/after-idempotence-queue.json,
additional-deletion-diagnostic.json, additional-deletion-evidence.json,
worker-certificates-deletion-evidence.json, fixture-removal-complete.json,
metric/incident-observed-*.json, alert-final-*.json, continuity-final.json y
window-closed.json. No credenciales, tokens o cadenas de conexion en esta acta.

Versionado limitado a esta acta, enlace de seguimiento en el acta anterior y
runbook. Sin cambios de codigo funcional, SQL, dependencias o workflows CI.
git diff --check, revision de diff/nombres y estado antes del commit.
No se repitio build/typecheck por cambios exclusivamente documentales; las
pruebas locales pertinentes y la evidencia operativa estan detalladas arriba.
