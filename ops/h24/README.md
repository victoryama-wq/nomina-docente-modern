# H24: paquete revisable para una ventana futura

Preparado 2026-11-09. Ventana parcial autorizada sobre 57c565a: ver
[acta de infraestructura](../../docs/auditoria/H24_Ventana_Preparacion_Infraestructura_20261109.md).
La autorizacion no incluye SQL, migraciones, ejecucion del worker ni release.
Base funcional b3d0681618cd5013031b8c1f7c03b9982e56dbce mas el commit que contiene
este paquete. No usar la imagen anterior para el worker nuevo. No contiene
servicios, IAM, imagenes ni alertas de Inspector/ClamAV. Archivos NOT_SCANNED.

## Destinos del plan; inventario separado en el acta

Al cierre del 2026-11-09 estan creados bucket adicional, SA, roles, metrica,
canal y politicas disabled. Imagen 57c565a publicada sin desplegar. Worker y
Scheduler NO creados por falta de credencial dedicada. Los comandos de creacion
de abajo NO deben repetirse sobre esos recursos; consultar y comparar primero.
IDs, digest e IAM efectivo se registran en el acta, no en placeholders.

| Elemento | Propuesta |
|---|---|
| Proyecto / region | nomina-docente-prod / us-central1 |
| Bucket adicional | nomina-docente-prod-h24-expedientes (creado; verificar metadata antes de uso) |
| Worker / SA | nomina-h24-dossier-reconcile / nomina-h24-recovery@nomina-docente-prod.iam.gserviceaccount.com |
| Scheduler / SA | nomina-h24-dossier-reconcile-10m / nomina-h24-scheduler@nomina-docente-prod.iam.gserviceaccount.com |
| Usuario SQL / secreto | h24_dossier_worker / h24-dossier-worker-db-password; version numerica por designar |
| Roles personalizados | h24DossierApiStorage / h24DossierWorkerStorage |
| Metrica | h24_dossier_cleanup_success |
| Alertas | H24 document cleanup failure / H24 no successful cleanup during operating hours |

Constancias `nomina-docente-prod-constancias`, API SA `nomina-api-sa` y horario
SQL 06:50-22:00 Cancun fueron reconfirmados por metadata el 2026-11-09.
No cambiarlo. Bucket adicional separado, UBLA/PAP, sin
versionado, soft delete 0, sin holds/retenciones/lifecycle. Constancias conservan
604800 segundos; **no hay comando para cambiar su politica** en este paquete.

## 0. Autorizacion, congelamiento y precheck

Ejecutar bloques individualmente solo en una ventana expresamente autorizada.
No pegar todo el documento en una terminal. Detenerse ante cualquier salida
distinta de cero en esa etapa, registrar y continuar solo etapas independientes.
No activar nuevas APIs, crear secretos, migrar, ejecutar un job o desplegar
API/Hosting como efecto implicito del plan. Publicar la imagen requiere
autorizacion explicita (concedida para 57c565a en esta ventana).

Variables en PowerShell; reemplazar solo despues de aprobar cada valor:

```powershell
$ErrorActionPreference = 'Stop'
function Check-Exit { if ($LASTEXITCODE -ne 0) { throw 'Comando fallido; detener sin reintento de creacion' } }
$P = 'nomina-docente-prod'
$R = 'us-central1'
$Job = 'nomina-h24-dossier-reconcile'
$Schedule = 'nomina-h24-dossier-reconcile-10m'
$Bucket = 'nomina-docente-prod-h24-expedientes'
$Cert = 'nomina-docente-prod-constancias'
$Worker = "nomina-h24-recovery@$P.iam.gserviceaccount.com"
$Scheduler = "nomina-h24-scheduler@$P.iam.gserviceaccount.com"
$Api = "nomina-api-sa@$P.iam.gserviceaccount.com"
$Image = 'REQUIERE_IMAGEN_APROBADA_POR_DIGEST'
$SecretVersion = 'REQUIERE_VERSION_NUMERICA'
$Channel = 'REQUIERE_CANAL_APROBADO'
$ApprovedSha = 'REQUIERE_SHA_CANDIDATA'
if ((git rev-parse HEAD) -ne $ApprovedSha -or (git status --porcelain)) { throw 'Candidata no congelada/limpia' }
gcloud projects describe $P --format='value(projectId,lifecycleState)'
Check-Exit
gcloud sql instances describe nomina-docente-web --project=$P --format='yaml(name,region,state,settings.activationPolicy)'
Check-Exit
gcloud run services describe nomina-api --project=$P --region=$R --format='yaml(status.latestReadyRevisionName,status.traffic,spec.template.spec.serviceAccountName)'
Check-Exit
gcloud storage buckets describe "gs://$Cert" --project=$P --format=json
Check-Exit
gcloud storage buckets get-iam-policy "gs://$Cert" --project=$P --format=json
Check-Exit
gcloud services list --enabled --project=$P --format='value(config.name)'
Check-Exit
```

Registrar antes de continuar: proyecto ACTIVE, SQL RUNNABLE/us-central1,
horario confirmado con operacion, API/Hosting/rollback vigentes, SHA candidato,
servicios Run/SQL/Storage/Scheduler/Logging/Monitoring/SecretManager habilitados.
Falta de API o permisos no autoriza habilitarlos automaticamente. Revisar IAM
heredado y condiciones: bindings locales minimos no eliminan privilegios amplios.
Bucket constancias: nombre exacto, UBLA true, PAP enforced, softDelete 604800,
versioning ausente/false, sin retentionPolicy/objectRetention/default holds.
No leer expedientes para este precheck. Describir recursos propuestos antes de
crear: si ya existen, detener y comparar, no hacer update ni duplicar. Un error
403 no acredita inexistencia; solo NOT_FOUND verificado permite crear.
No sobreescribir ficheros de evidencia existentes.

Prerrequisitos por etapa, no globales: bucket/IAM requieren destino, identidad,
APIs y ausencia/compatibilidad acreditada; imagen requiere fuente congelada y
repositorio existente; metrica no requiere canal ni SQL; politicas requieren
canal de identidad confirmada (registrar verificacion por separado); worker
requiere digest y credencial dedicada validada; Scheduler requiere worker
desarmado. Un bloqueo no autoriza inventar referencias ni usar app_nomina.

## 0.1 Imagen desde contexto permitido (solo con autorizacion de publicacion)

El SHA aprobado es fuente, no el HEAD documental posterior. Trabajar con fuente
congelada y verificar identidad antes de publicar. No construir usando `.` de
la copia de trabajo: no existe .dockerignore en la candidata. Este bloque no
despliega, y tampoco debe repetir un tag ya publicado sin comparar su digest.

```powershell
$Source = Join-Path $env:LOCALAPPDATA ('NominaDocente/H24-image-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $Source | Out-Null
$Archive = Join-Path $Source 'candidate.tar'
$Context = Join-Path $Source 'context'
New-Item -ItemType Directory -Path $Context | Out-Null
git archive --format=tar --output=$Archive $ApprovedSha .npmrc package.json package-lock.json apps/api/Dockerfile apps/api/package.json apps/api/tsconfig.json apps/api/src apps/web/package.json
Check-Exit
tar -xf $Archive -C $Context
Check-Exit
Get-FileHash -LiteralPath $Archive -Algorithm SHA256
# Revisar allowlist y contenido: sin credenciales, .env, datos reales ni dumps.
$Tag = 'REQUIERE_TAG_NUEVO_APROBADO'
if ($Tag -notmatch '^us-central1-docker\.pkg\.dev/nomina-docente-prod/nomina/nomina-api:[a-z0-9.-]+$') { throw 'Falta tag aprobado' }
docker build --platform linux/amd64 --label "org.opencontainers.image.revision=$ApprovedSha" -f "$Context/apps/api/Dockerfile" -t $Tag $Context
Check-Exit
# Antes del push: comprobar label/SHA, Linux, build y entrypoint desarmado sin red.
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
Check-Exit
docker push $Tag
Check-Exit
gcloud artifacts docker images describe $Tag --project=$P --format=json
Check-Exit
# Registrar digest remoto; establecer $Image con la referencia inmutable comprobada.
```

## 1. Bucket adicional e identidades (solo con aprobacion de infraestructura)

```powershell
gcloud storage buckets create "gs://$Bucket" --project=$P --location=$R --uniform-bucket-level-access --public-access-prevention --soft-delete-duration=0 --default-storage-class=STANDARD
Check-Exit
gcloud storage buckets update "gs://$Bucket" --project=$P --no-versioning --update-labels=purpose=h24-dossier
Check-Exit
gcloud storage buckets describe "gs://$Bucket" --project=$P --format=json
Check-Exit
gcloud iam service-accounts create nomina-h24-recovery --project=$P --display-name='H24 document recovery'
Check-Exit
gcloud iam service-accounts create nomina-h24-scheduler --project=$P --display-name='H24 scheduler only'
Check-Exit
gcloud iam roles create h24DossierApiStorage --project=$P --file=ops/h24/api-storage-role.json
Check-Exit
gcloud iam roles create h24DossierWorkerStorage --project=$P --file=ops/h24/worker-storage-role.json
Check-Exit
foreach ($B in @($Cert, $Bucket)) {
  gcloud storage buckets add-iam-policy-binding "gs://$B" --project=$P --member="serviceAccount:$Worker" --role="projects/$P/roles/h24DossierWorkerStorage"
  Check-Exit
  gcloud storage buckets add-iam-policy-binding "gs://$B" --project=$P --member="serviceAccount:$Api" --role="projects/$P/roles/h24DossierApiStorage"
  Check-Exit
}
gcloud projects add-iam-policy-binding $P --member="serviceAccount:$Worker" --role=roles/cloudsql.client --condition=None
Check-Exit
```

Confirmar JSON efectivo adicional: versioning.enabled=false, softDelete=0,
UBLA/PAP y ninguna politica incompatible. Si GCS omite el cero/false y el
adaptador lo rechaza, detener: no relajar la politica silenciosamente. Verificar
IAM efectivo sin allUsers/allAuthenticatedUsers, sin keys, sin restore/list/create
para worker. `roles/cloudsql.client` es conectividad, no privilegios SQL.
Worker no verifica tokens de usuario: revalida actor contra SQL. No necesita
firebaseauth.users.get. API conserva su permiso Firebase existente y secretos
ajenos; no modificar esos bindings en esta ventana.
La verificacion final encontro roles/storage.objectAdmin preexistente para API
en constancias, incluido storage.objects.restore. Sigue pendiente sustituirlo
bajo autorizacion especifica antes del release: agregar el rol minimo no basta.

## 2. Privilegios SQL propuestos (ventana DBA separada, NO migracion)

Prerequisitos: 016/017 autorizadas/aplicadas, H05 concordante y backup oportuno;
rol dedicado nuevo, LOGIN sin SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS,
sin membresias/herencia que amplien acceso. La provision de credenciales y su
secreto se hace por canal DBA, nunca en Git ni linea de comandos. No utilizar
app_nomina/postgres como sustitutos. Revisar permisos PUBLIC antes de aprobar:
no alterar grants PUBLIC compartidos como efecto colateral de H24.

Propuesta revisable, **no ejecutada**; el DBA debe contrastar privilegios
efectivos/propietarios/secuencias/RLS y probar este usuario en aislado:

```sql
GRANT CONNECT ON DATABASE nomina_docente TO h24_dossier_worker;
GRANT USAGE ON SCHEMA public TO h24_dossier_worker;
GRANT SELECT, UPDATE ON public.teacher_dossier_operations TO h24_dossier_worker;
GRANT SELECT, UPDATE, DELETE ON public.teacher_dossier_documents TO h24_dossier_worker;
GRANT SELECT ON public.teacher_documents TO h24_dossier_worker;
GRANT UPDATE (document_type) ON public.teacher_documents TO h24_dossier_worker;
GRANT SELECT (id, status, is_protected_super_admin, role_id) ON public.app_users TO h24_dossier_worker;
GRANT SELECT (id, code) ON public.roles, public.permissions TO h24_dossier_worker;
GRANT SELECT (role_id, permission_id) ON public.role_permissions TO h24_dossier_worker;
GRANT INSERT (actor_user_id, action, entity_type, entity_id, metadata) ON public.audit_log TO h24_dossier_worker;
```

No grants sobre teachers, nomina, snapshots ni campos fiscales. El worker no
crea intenciones nuevas ni cambia telefono. audit_log usa UUID/default en el
esquema candidato; si el esquema efectivo necesita una secuencia, detener y
justificar USAGE solo sobre esa secuencia, nunca ALL SEQUENCES. Ejecutar pruebas
de las rutas de reconciliacion con estos grants antes de uso no supervisado.

## 3. Worker desarmado y Scheduler pausado

Solo imagen ya publicada bajo autorizacion explicita y con SHA/digest verificados.
La ventana actual permite construir/publicar la candidata, no desplegar API.
Cloud SQL connector y secreto
pueden requerir IAM incluso estando desarmado. No usar execute-now.

```powershell
if ($Image -notmatch '^us-central1-docker\.pkg\.dev/nomina-docente-prod/[^@]+@sha256:[a-f0-9]{64}$') { throw 'Falta imagen candidata aprobada' }
if ($SecretVersion -notmatch '^[1-9][0-9]*$') { throw 'Falta credencial SQL dedicada validada por DBA; omitir worker/Scheduler' }
gcloud secrets add-iam-policy-binding h24-dossier-worker-db-password --project=$P --member="serviceAccount:$Worker" --role=roles/secretmanager.secretAccessor
Check-Exit
gcloud run jobs create $Job --project=$P --region=$R --image=$Image --service-account=$Worker --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=240s --cpu=1 --memory=1Gi --command=node --args=apps/api/dist/dossier-reconcile.js --env-vars-file=ops/h24/worker-env.yaml --set-cloudsql-instances=nomina-docente-prod:us-central1:nomina-docente-web --set-secrets="DB_PASSWORD=h24-dossier-worker-db-password:$SecretVersion"
Check-Exit
gcloud run jobs describe $Job --project=$P --region=$R --format=yaml
Check-Exit
gcloud run jobs add-iam-policy-binding $Job --project=$P --region=$R --member="serviceAccount:$Scheduler" --role=roles/run.invoker
Check-Exit
gcloud scheduler jobs create http $Schedule --project=$P --location=$R --schedule='*/10 7-20 * * *' --time-zone=America/Cancun --uri="https://run.googleapis.com/v2/projects/$P/locations/$R/jobs/${Job}:run" --http-method=POST --oauth-service-account-email=$Scheduler --oauth-token-scope=https://www.googleapis.com/auth/cloud-platform --message-body='{}' --headers=Content-Type=application/json --max-retry-attempts=0 --max-retry-duration=0s --attempt-deadline=60s
Check-Exit
gcloud scheduler jobs pause $Schedule --project=$P --location=$R
Check-Exit
gcloud scheduler jobs describe $Schedule --project=$P --location=$R --format=yaml
Check-Exit
```

No flag create-paused asumido. Por eso el job se crea con
ALLOW_DOSSIER_RECONCILE=false ANTES del Scheduler: una invocacion entre crear y
pausar no abre BD ni toca GCS. Si pause falla, detener manteniendo el worker
desarmado. Roles/run.invoker no permite overrides; no asignar jobsExecutorWithOverrides.
Confirmar agente administrado de Scheduler y capacidad de impersonar solo su SA;
no dar TokenCreator global por comodidad.

## 4. Alertas preparadas, deshabilitadas hasta ventana supervisada

Receptor autorizado victor.yama@tecplayacar.edu.mx; canal productivo creado en
esta ventana, distinto del ensayo. Verificacion y alerta operativa recibida son
pendientes separados (el usuario recibio solo correo con codigo). Preparar copias
temporales de JSON, sustituir REPLACE_WITH_APPROVED_CHANNEL_RESOURCE con $Channel
usando ConvertFrom-Json/ConvertTo-Json y mantener enabled=false. No versionar IDs
privados ni contactos adicionales. No enviar tokens a archivos/logs.

```powershell
gcloud logging metrics create h24_dossier_cleanup_success --project=$P --config-from-file=ops/h24/cleanup-success-metric.json
Check-Exit
if ($Channel -notmatch '^projects/nomina-docente-prod/notificationChannels/[0-9]+$') { throw 'Falta canal con receptor comprobado; metrica independiente ya preparada' }
$Out = Join-Path $env:TEMP ('h24-monitoring-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $Out | Out-Null
foreach ($Name in @('cleanup-failure-alert', 'cleanup-absence-alert')) {
  $Policy = Get-Content "ops/h24/$Name.json" -Raw | ConvertFrom-Json
  $Policy.notificationChannels = @($Channel)
  $Policy | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $Out "$Name.json") -Encoding utf8
}
gcloud monitoring policies create --project=$P --policy-from-file="$Out/cleanup-failure-alert.json"
Check-Exit
gcloud monitoring policies create --project=$P --policy-from-file="$Out/cleanup-absence-alert.json"
Check-Exit
```

Guardar IDs creados en acta. Validar expresion PromQL en Monitoring y labels
reales: el chequeo local no sustituye al compilador/series cloud. Ausencia usa
sum=0 O serie ausente, no solo absent_over_time ni completed_execution_count.
Ventana07:30-21:10 Cancun, 25min sin exito sostenidos5min; no alerta cada noche.
ERROR se vigila las24h. Si proceso muere antes del log, ausencia detecta falta de
progreso en horario; revisar tambien ejecuciones fallidas de plataforma.

## 5. Condiciones de parada y habilitacion posterior

La ventana de preparacion termina con Scheduler PAUSED, worker false, alertas
creadas disabled; si falta credencial dedicada, worker/Scheduler quedan NO CREADOS.
No armar sobre esquema incompleto. Para otra ventana autorizada:
reconfirmar H05, backup, IAM/SQL, digest, metadata de ambos buckets, horario y
canal; habilitar alertas e iniciar un smoke sintetico supervisado. Probar ERROR,
ausencia y recuperacion recibidas, saltos horarios sin exito, solapamiento, A->B
y generaciones. Solo despues de aprobar: worker true y Scheduler resume.
No se incluyen esos comandos de activacion ni migracion/API/Hosting aqui.
Cualquier discrepancia/403/privilegioamplio/cola persistente/filtracion/hash
incorrecto es STOP, no fallback, grant amplio ni reintento ciego.

## 6. Reversion de preparacion

Registrar cada recurso/binding creado y sus politicas previas antes de mutar.
Primero pausar Scheduler; no borrar bucket, objetos o intenciones. Para desarmar
job futuro sin ejecutar limpieza:

```powershell
gcloud scheduler jobs pause $Schedule --project=$P --location=$R
Check-Exit
gcloud run jobs update $Job --project=$P --region=$R --update-env-vars=ALLOW_DOSSIER_RECONCILE=false
Check-Exit
gcloud run jobs executions list --job=$Job --project=$P --region=$R --format=yaml
Check-Exit
```

Confirmar que no quedan ejecuciones activas antes de retirar grants. No cancelar
una ejecucion a ciegas: esperar limite240s y revisar intenciones durables en una
ventana DBA autorizada. Retirar **solo bindings nuevos de esta acta**, por ejemplo
remove-iam-policy-binding con el mismo recurso/member/role anterior; no retirar
bindings preexistentes ni borrar roles compartidos. Guardar alertas deshabilitadas
como evidencia. Eliminar job/Scheduler/SA nuevos solo con aprobacion e inventario
sin dependencias. No borrar buckets, secretos ni datos para simular rollback.
Rollback API/Hosting y migraciones pertenecen a otra ventana.

## Referencias de sintaxis

- https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/create
- https://docs.cloud.google.com/sdk/gcloud/reference/scheduler/jobs/create/http
- https://docs.cloud.google.com/sdk/gcloud/reference/storage/buckets/create
- https://docs.cloud.google.com/sdk/gcloud/reference/storage/buckets/update
- https://docs.cloud.google.com/monitoring/alerts/using-promql

Los JSON fueron aceptados por Monitoring en esta ventana, con enabled=false.
Eso no certifica series runtime, entrega, minimo privilegio integral ni release.
Los comandos aqui son una guia por etapas, no un script para repetir en bloque.
