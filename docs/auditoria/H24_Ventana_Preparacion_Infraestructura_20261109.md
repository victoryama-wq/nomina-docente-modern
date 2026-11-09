# H24 - Ventana parcial de preparacion de infraestructura

Fecha: 2026-11-09. **Preparacion parcial completada; H24 sigue NO-GO y no habilitado.**
Candidata fuente: `57c565a6a6ed3b4c2dca21292289893b94fc6a5d`.
Rama: `feature/h02-h03-user-coordinations-permissions`, inicialmente limpia y
sin divergencia con origin. No se encontraron AGENTS.md aplicables.

## 1. Autorizacion y limites

Ventana autorizada para metadata, imagen, bucket adicional, IAM aditivo y
alertas deshabilitadas en nomina-docente-prod/us-central1. Identidad ejecutora y
receptor autorizado: victor.yama@tecplayacar.edu.mx. Inicio cloud conservador
21:10:38 UTC (16:10:38 Cancun); cierre de operaciones cloud 21:26:00 UTC
(16:26:00 Cancun), menos de 16 minutos. Limite autorizado 23:10:38 UTC / 2 h.
Las comprobaciones locales y documentacion posteriores no prolongan operaciones
cloud. Objetivo USD 10 de intervencion, no limite automatico ni mensual.

No PostgreSQL, expedientes, valores de secretos, backup, H05, migraciones,
ejecucion de worker, limpieza real, activacion Scheduler, deploy API/Hosting,
merge ni creacion de Inspector/ClamAV. No se borraron recursos preexistentes.

## 2. Precheck y continuidad productiva

| Requisito | Observado antes y al cierre | Resultado |
|---|---|---|
| Proyecto | nomina-docente-prod, numero 443985127112, ACTIVE | Correcto |
| Region / SQL metadata | us-central1; nomina-docente-web RUNNABLE, POSTGRES_18 | Sin conexion SQL |
| Horario SQL | Scheduler existente 50 6 * * * y 0 22 * * *, America/Cancun, ENABLED | 06:50-22:00; no cambiado |
| APIs | Storage, IAM, Run, SQL, AR, Scheduler, Logging, Monitoring, SecretManager y Hosting habilitadas | No se habilito ninguna |
| API | nomina-api-00057-c7d, Ready=True, 100% | Sin nueva revision |
| Runtime API | nomina-api-sa; 1 CPU, 512 MiB, concurrencia 80, max 3, timeout 300 s | Spec completa antes/despues identica |
| Hosting | release 1793121624438000; version 3f9ebc88c835a143 | Sin cambio |

Digest de API vigente:
`sha256:a7d0de2196c5552d50cd75b8f01e15238dc90f701941b8656613bf6d1789196b`.
Rollback disponible anterior Ready=True: nomina-api-00056-mll,
`sha256:b52af3b562c2687ff09f45712ea4f9b3c33c8622c254393c4c8c3f2187cde22f`.
Para revertir un release H24 futuro, la referencia inmediatamente previa hoy es
00057-c7d, no confundirla con su revision anterior 00056-mll.
Hosting actual tambien es el punto de retorno del futuro release; version previa
historica disponible c29c9b5b84133c9a / release 1789068812732000.
No se aplico rollback ni se certifico capacidad H24 con el runtime vigente.

## 3. Imagen congelada y publicada, no desplegada

Se construyo localmente con Docker linux/amd64 desde git archive del SHA exacto,
no desde cambios del arbol. Allowlist: .npmrc, package.json, package-lock.json,
apps/api/Dockerfile, apps/api/package.json, apps/api/tsconfig.json, apps/api/src,
apps/web/package.json. 120 archivos / 1.34 MiB; sin .env, credenciales, dumps,
documentos reales, .git ni node_modules del host. .npmrc contiene engine-strict,
no credenciales. El repo carece de .dockerignore: no usar contexto raiz sin revision.
SHA-256 del tar fuente:
`357ec04a2c88225cb86d3b640ee13ecee6c0230c1bd94227fbb34edb923d6c0e`.

- Repositorio existente: us-central1-docker.pkg.dev/nomina-docente-prod/nomina.
- Tag: nomina-api:h24-prep-57c565a-20261109.
- Referencia inmutable confirmada por Artifact Registry:
  `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api@sha256:f1aafc5cbc0d4f8a658c1bede3abb9af656ef3a48b3e1b584ab632f052958303`.
- Manifest de plataforma Linux: sha256:f84196bc16167db50abe438a261401751a3ebfcf2420e500df63d360bb68c784.
- Label org.opencontainers.image.revision: SHA fuente completo anterior.
- Tamano local descomprimido 697298023 bytes; no es consumo facturado del registry.
- Node 24.22.2, npm 10.9.4; build TypeScript API dentro de imagen exit 0.
- Sin clamscan, clamd ni pdfinfo. Documentos NOT_SCANNED, no antivirus simulado.

Push Docker exit 0 y digest remoto coincidente. No se uso Cloud Build ni se
desplego la imagen. La base node:24-slim no estaba fijada por digest en la
candidata; para esta ventana la identidad verificable es la imagen publicada,
no una promesa de rebuild bit a bit. Scanning del repositorio esta DISABLED
porque Container Scanning API no esta habilitada; no se cambio esa configuracion.

## 4. Inventario creado e IAM efectivo observado

| Recurso | Resultado |
|---|---|
| nomina-docente-prod-h24-expedientes | Creado, region US-CENTRAL1, STANDARD, label purpose=h24-dossier |
| nomina-h24-recovery@nomina-docente-prod.iam.gserviceaccount.com | SA creada, sin claves creadas |
| nomina-h24-scheduler@nomina-docente-prod.iam.gserviceaccount.com | SA creada, sin claves ni Invoker concedidos |
| projects/nomina-docente-prod/roles/h24DossierApiStorage | Creado: storage.buckets.get, objects.get/create/delete |
| projects/nomina-docente-prod/roles/h24DossierWorkerStorage | Creado: storage.buckets.get, objects.get/delete |
| IAM de ambos buckets | Roles personalizados respectivos agregados a API y worker; bindings previos preservados |
| IAM de proyecto | Agregado roles/cloudsql.client a worker; conectividad, no permisos SQL |

Bucket adicional: creacion 21:15:59.791Z, generation 1794258959350851695,
metageneration 2. JSON Storage real: versioning.enabled=false,
softDeletePolicy.retentionDurationSeconds="0", UBLA=true, PAP=enforced.
Sin retentionPolicy, objectRetention, default hold ni lifecycle. No se cargaron
ni listaron objetos. El bucket fue observado inexistente mediante 404 antes de
crearlo; no se interpreto un 403 como ausencia.

Constancias nomina-docente-prod-constancias: versioning ausente, softDelete="604800",
UBLA=true, PAP=enforced, sin las retenciones/holds/lifecycle incompatibles.
Su politica de almacenamiento NO se modifico. Solo se agregaron bindings IAM.

Se contrasto la metadata JSON real con assertSafe de ambos adaptadores compilados
en la imagen exacta: PASS offline usando respuestas capturadas, sin red/objetos.
Esto prueba compatibilidad de metadata, no el uso de una identidad runtime en GCS.

**Pendiente IAM obligatorio:** la API conserva roles/storage.objectAdmin en el
bucket de constancias. IAM roles.get confirma storage.objects.restore dentro de
ese rol. El rol minimo aditivo NO elimina esa facultad. No se retiro el binding
que sostiene la API actual; revisar y sustituirlo en una ventana controlada antes
del release, preservando permisos necesarios y verificando herencia efectiva.

Se leyeron politicas de buckets, proyecto y organizacion padre directa
908354127471 (sin carpeta). En buckets permanecen grants legacy para projectOwner,
projectEditor y projectViewer. En proyecto API conserva Cloud SQL Client y
Secret Accessor; worker agrega solo Cloud SQL Client. No se observaron grants
storage amplios de organizacion a las nuevas SA. No hay allUsers/allAuthenticatedUsers
en las politicas de buckets. No se auditaron transitivamente todos los grupos ni
posibles impersonadores: esta inspeccion no certifica minimo privilegio universal.
Los grants administrativos humanos preexistentes se conservaron.

## 5. Monitoring: preparado, no probado operacionalmente

| Elemento | Evidencia / estado |
|---|---|
| Canal email | projects/nomina-docente-prod/notificationChannels/12474838942187959572, enabled=true |
| Receptor | victor.yama@tecplayacar.edu.mx, autorizado expresamente |
| Verificacion | sendVerificationCode aceptado; usuario confirma recepcion de correo con codigo; verificacion aun no completada/acreditada |
| Alerta real recibida | NO probada; no confundir con correo de verificacion o ensayo H24 anterior |
| Metrica | logging.googleapis.com/user/h24_dossier_cleanup_success creada |
| Fallo | projects/nomina-docente-prod/alertPolicies/11811020579760829856, enabled=false |
| Ausencia | projects/nomina-docente-prod/alertPolicies/3484231198314869307, enabled=false |

Monitoring acepto ambos JSON y la expresion PromQL sin cambios. La metrica
cuenta exclusivamente COMPLETED + cleanupSucceeded=true + exitCode=0, nunca
omisiones. Ausencia: cero o serie ausente por 25 min, sostenidos 5 min, solo
07:30-21:10 America/Cancun; ERROR sin silencio nocturno. Politicas reconsultadas
deshabilitadas al cierre. Aceptacion de sintaxis no equivale a series/labels
runtime, entrega ni recuperacion probadas. El campo verificationStatus no vino
en GET del canal; no se inventa VERIFIED. El codigo no se solicita en el chat.

## 6. Worker y Scheduler: NO CREADOS

Imagen por digest disponible. No existe el secreto dedicado
h24-dossier-worker-db-password en el inventario de Secret Manager. Solo existe
el secreto de la aplicacion actual; no se leyo su valor ni se uso de sustituto.
Tampoco se consulto SQL para inferir la existencia/validez del usuario.

Falta credencial h24_dossier_worker validada por DBA y version numerica de su
secreto. Por ello no se creo job nomina-h24-dossier-reconcile ni Scheduler
nomina-h24-dossier-reconcile-10m. Lista final: cero Run Jobs y solo los dos
Scheduler de encendido/apagado SQL preexistentes. Sin ejecuciones, limpieza,
Secret Accessor de worker ni Invoker de Scheduler concedidos.

Configuracion futura preservada: ALLOW_DOSSIER_RECONCILE=false, tarea1,
parallelism1, retry0, timeout240s; admision07:00-21:50, presupuesto230s,
corte21:55, lease PostgreSQL global y locks de operacion. Scheduler posterior
`*/10 7-20 * * *`, PAUSED. No armar hasta esquema, IAM y smoke autorizados.

## 7. Validaciones y ajustes del runbook

- Fuente congelada y build Linux API: PASS, exit0.
- Imagen sin red: entrada desarmada rechaza con exit1 esperado,
  WORKER_START_FAILED y cleanupSucceeded=false; no abre BD/GCS.
- Imagen: admision07:00 y rechazo21:50, firma basica PDF valida/invalida,
  NOT_SCANNED y ausencia de binarios analizadores: PASS.
- Adaptadores exactos contra metadata capturada: 2/2 PASS offline.
- Vitest local h24-infrastructure, constancia-storage, dossier-storage:
  111 PASS, 8 SKIP; los ocho dependen del pdfinfo historico no configurado,
  no son pruebas nuevas omitidas ni controles productivos reintroducidos.
- Vitest local dossier-worker-guard y dossier-worker: 33/33 PASS.
- No nueva suite PostgreSQL: no se autorizo conexion BD en esta ventana.
  171 PASS de la fase efimera anterior conserva su SHA y alcance historico.
- Comparacion spec API antes/despues: identica, incluidas referencias de
  secretos, variables, recursos, identidad y especificacion de trafico.
- Runbook: prerrequisitos por etapa; el secreto solo bloquea worker/Scheduler,
  el canal solo politicas, y el digest solo las etapas que usan la imagen.
- Validacion documental: git diff --check OK, seis bloques PowerShell parseados
  sin ejecutarlos y todos los JSON de infraestructura parseados correctamente.

Incidencias sin impacto: CLI instalada rechazo --labels en buckets create antes
de crear recurso; se reconfirmo404 y se creo sin ese flag, luego se etiqueto el
bucket nuevo con update. CLI roles describe --view=FULL no disponible y describe
con --project no resolvio rol predefinido; se obtuvo evidencia por IAM REST GET.
Hosting inicialmente403 por quota project, resuelto con cabecera explicita sin
ampliar permisos. No reintentos ciegos de mutaciones ni duplicacion de recursos.

Evidencia local privada: %LOCALAPPDATA%/NominaDocente/H24-Infra-20261109T211038Z.
Incluye respuestas metadata/IAM previas y finales, imagen, logs y comprobaciones;
no tokens ni valores de secretos. No incorporar respuestas IAM crudas a Git.

## 8. Costos: estimados, no factura

Construccion Docker local; cero Cloud Build y cero ejecuciones worker. Bucket
adicional sin uploads realizados; canal y dos politicas deshabilitadas. Imagen
unica conservada; provisionamiento sin analizadores. Presupuesto conservador de
intervencion menor a USD1 para metadata/control plane, almacenamiento transitorio
y operaciones de esta ventana; sin descargas de capas productivas ni scanning.
No se consulto factura ni se afirma gasto exacto/cero o corte automatico.

Artifact Registry: tomando como techo ilustrativo 0.65 GiB de imagen local,
0.000136986 USD/GiB-h x 720h = menos de USD0.065/30dias para esta imagen, sin
franquicia; bytes comprimidos/deduplicados efectivos pueden diferir. Ingreso de
datos gratuito; sin scanning automatico habilitado en el repositorio observado.
[Tarifa oficial consultada](https://cloud.google.com/artifact-registry/pricing).

Futuro ilustrativo, NO consumo actual: worker84/dia a60s,1CPU/1GiB USD3.024;
Scheduler USD0.10;10GiB GCS USD0.197/30dias; subtotal USD3.32 mas registry y
otros rubros. A230s el worker solo seria USD11.592/30dias. Ver supuestos y
exclusiones en [plan](H24_Plan_Infraestructura_Productiva_20261109.md).
API incremental, SQL, secretos, logs/metricas, operaciones/egress y objetos
recuperables no estan cotizados integralmente. No hay costo recurrente de job
o Scheduler H24 aun porque no fueron creados.

## 9. Proxima ventana y reversion

1. DBA: autorizar por separado migraciones016/017 y preparacion del usuario
   dedicado/privilegios efectivos del runbook, sin app_nomina/postgres de fallback.
   Determinar orden seguro con backup oportuno, restaurabilidad y H05 exactos.
2. Provisionar secreto/version dedicada por canal seguro; validar grants SQL en
   aislado. No aceptar solo existencia del secreto como credencial funcional.
3. Resolver storage.objectAdmin/restore de API antes del release mediante cambio
   IAM controlado y revalidacion de acceso. Verificar permiso Firebase requerido.
4. Crear worker desarmado por digest y Scheduler pausado tras validar credencial;
   conservar guardas y configuracion probadas. Completar verificacion del canal.
5. Autorizar aparte migraciones, deploy API/Hosting, ejecucion sintetica supervisada
   y alertas fallo/ausencia/recuperacion realmente recibidas. Validar runtime IAM,
   limites/capacidad y reemplazo/cleanup antes de armar operacion automatica.

H05 productivo sigue como evidencia historica aportada para3284a12:20 archivos,
18 registradas,016/017 pendientes,0 mismatch; backup1793913186499 SUCCESSFUL,
restauracion no ensayada. No fue reconfirmado por SQL ni actualizado hoy.

No se aplico reversion. Si se revoca esta preparacion, retirar solo bindings
nuevos tras autorizacion y analisis de dependencias, mantener alertas disabled;
no borrar buckets/objetos ni sobrescribir IAM previo. Inventario anterior permite
separar los grants nuevos de los heredados. Job/Scheduler no requieren pausa
porque no existen. Imagen/canal/roles/SA quedan disponibles, no habilitan H24.
No cambios H01, datos fiscales, Nomina, snapshots, migraciones ni recursos runtime
API/Hosting. Inspector/ClamAV siguen retirados. **Preparacion no es release.**
