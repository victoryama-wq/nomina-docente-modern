# H24 - PostgreSQL completo, worker protegido y preparacion de infraestructura

Fecha: 2026-11-09. Rama: feature/h02-h03-user-coordinations-permissions.
Base: **b3d0681618cd5013031b8c1f7c03b9982e56dbce**, inicialmente limpia/sincronizada.
Candidata nueva: commit que contiene esta acta (consultar `git log -1 --format=%H -- docs/auditoria/H24_Preparacion_Worker_Infraestructura_20261109.md`).
Alcance: implementacion local, PostgreSQL efimero sintetico, documentacion, commit
y push. **Sin cloud, produccion, publicacion de imagenes, merge ni deploy.**

## 1. Politica conservada

Inspector/ClamAV siguen retirados por decision de costo. BASIC_ENVELOPE_V1 y
NOT_SCANNED no son antivirus ni validacion estructural completa. Contenido por
descarga autorizada attachment, sin iframe/imagen incrustada desde Nomina.
No se alteran rutas de carga/consulta, permisos, H01, snapshots ni tablas de
migracion historicas. Constancias:604800s recuperables, versionado ausente/false;
adicionales:bucket separado privado, borrado definitivo. A permanece vigente si
falla B; confirmada B, solo B es consultable. Reintentos/generaciones exactas y
ausencia de restauracion UI se conservan.

## 2. PostgreSQL aislado y autorizacion nueva

- Docker local, imagen preexistente postgres:18, PostgreSQL18.6 Debian.
- Contenedor exclusivo `h24-prep-20261109`, ID
  `9126054d37d9a8d4376778b2558e0d111a5c89397d2ad09e9d201265943581b3`.
- Etiqueta de propiedad `nomina.scope=h24-prep-20261109`.
- Puerto exclusivamente127.0.0.1:55479, BD nomina_docente_test, usuario sintetico
  h24_ephemeral. Sin bind de BD local actual ni datos reales.
- TEST_DB y DB apuntaron explicitamente a ese contenedor. Proyecto demo-h24-local;
  sin INSTANCE_CONNECTION_NAME, sin replay de snapshot, credencial GCS apuntada
  a ruta inexistente, runtime de adicionales disabled excepto adaptadores locales
  privados creados por las pruebas. No se usaron credenciales productivas.
- `npm run test:db:prepare` ejecuto los **20 archivos SQL originales**, incluido017,
  y el seed sintetico H04, solo sobre el contenedor. La suite repite preparacion
  sintetica segun sus fixtures. No se excluyo teacher-fiscal-identity.
- `git diff b3d0681 -- database` vacio: cero SQL historico modificado.

Esta autorizacion posterior supera unicamente la limitacion local de la fase
de retirada: b3d0681 habia validado166 integraciones mediante replay y omitido
las2 de identidad fiscal. Esa evidencia se conserva; no se la reetiqueta.
La nueva suite completa tiene171PASS: las168 existentes mas2 de lease real y1
de privilegios SQL. Incluye C.P./CURP, restricciones017, conservacion de columnas,
redaccion, roles, carga/reemplazo/limpieza/recuperacion e idempotencia.

**No es H05 productivo ni un nuevo baseline.** El harness ejecuta SQL original,
no el registro del migrador H05. Una consulta auxiliar concurrente con un reset
del harness devolvio42P01. Terminada la suite, ambas tablas de control existen y
schema_migrations contiene0 registros: el harness aplica los archivos sin
registrar baseline/apply. No se corrigio ni se inventaron registros. La evidencia
de18 registradas/016-017 pendientes sigue siendo solo el
H05 historico aportado para3284a12. No se consulto ni cambio Cloud SQL.

## 3. Protecciones del worker

Se conservaron los locks por operacion existentes y los estados durables.
Se agrego solo la guarda del entrypoint y su helper, sin cambios de esquema.

| Control | Implementacion y evidencia |
|---|---|
| Hora | Intl/IANA America/Cancun, limites inclusivo07:00/exclusivo21:50 para iniciar; no depende del TZ del host |
| SQL06:50-22:00 | 10min antes de admitir; deadline230s y watchdog21:55; margen antes del apagado |
| Disparo demorado | Se revisa hora real al entrar y despues de adquirir conexion/lock; no confia en hora programada |
| Exclusividad | pg_try_advisory_lock(4731444,1), sesion dedicada, mismo key por BD y todos los namespaces |
| Lease perdido | Eventos error/end o heartbeat5s con query timeout4s terminan proceso; no continuar sin lock |
| Tiempo maximo | Timer230s desde admision (incluye adquisicion); reloj de pared cada1s; process.exit(1), no Promise.race que deje limpieza suelta |
| Defensa plataforma | Job propuesto timeout240s, una tarea, parallelism1, retry0; pendiente validacion efectiva cloud |
| Omision | SKIPPED_HOURS/SKIPPED_OVERLAP, cleanupSucceeded=false; no se conecta fuera de horario ni ejecuta limpieza si otra instancia posee lease |
| Exito | Solo COMPLETED + cleanupSucceeded=true + exitCode0 contabiliza limpieza |
| Error | FAILED/exit1, codigo sanitizado; no objetos, docentes, tokens ni SQL en logs |
| Reintentos | Marcadores/per-operation locks existentes preservados; la siguiente ejecucion puede retomar despues de fallo/terminacion |

Las20 pruebas puras cubren limites, reloj UTC/estacional, fecha invalida,
adquisicion demorada, solapamiento, fallo/reintento y terminador por plazo/lease.
Los timers se prueban con reloj controlado; no se espero al apagado real de SQL.
El reloj monotono se contrasta tambien tras adquisicion y al terminar, para no
registrar exito si el callback del timer se retrasa por el event loop.
Dos pruebas PostgreSQL verifican exclusion entre workers, liberacion tras error,
terminacion de una conexion sintetica y recuperacion de su advisory lock.
La prueba del timeout inyecta terminador; el entrypoint real usa process.exit.
No se certifica aun el timeout efectivo del futuro servicio Cloud Run.

## 4. Paquete revisable, no recursos existentes

[ops/h24/README.md](../../ops/h24/README.md) contiene precheck, variables con
STOP si no se aprueban SHA/digest/secret-version/canal, orden, comandos gcloud,
SQL de grants, manifest/env, condiciones de parada y reversion por etapas.

| Recurso | Nombre propuesto | Estado |
|---|---|---|
| Bucket adicional | nomina-docente-prod-h24-expedientes | No creado ni consultado; comprobar disponibilidad |
| Worker | nomina-h24-dossier-reconcile | No creado; inicialmente ALLOW_DOSSIER_RECONCILE=false |
| SA worker | nomina-h24-recovery@nomina-docente-prod.iam.gserviceaccount.com | Propuesta |
| Scheduler | nomina-h24-dossier-reconcile-10m | Propuesto; */10 7-20 * * *, America/Cancun, pausado tras creacion |
| SA Scheduler | nomina-h24-scheduler@nomina-docente-prod.iam.gserviceaccount.com | Solo run.invoker del job, sin overrides |
| Usuario/secreto SQL | h24_dossier_worker / h24-dossier-worker-db-password | Provision segura por DBA, version numerica pendiente |
| Roles Storage | h24DossierApiStorage / h24DossierWorkerStorage | Buckets concretos, sin restore/list/policy-admin |
| Alertas | fallo / ausencia de limpieza real | JSON disabled; canal/compilacion/recepcion cloud pendientes |

Permisos API:getBucket,get/create/deleteObject. Worker:getBucket,get/deleteObject,
CloudSQLClient y SecretAccessor solo del secreto dedicado. Sin permiso Firebase
nuevo para worker: revalida usuario por SQL. Grants SQL del runbook probados con
rol sintetico transaccional: consultas del worker permitidas; teachers,
payroll_lines, email de app_users, cambio is_current y INSERT de operaciones
denegados42501. Grants y rol retirados por ROLLBACK. Falta verificar permisos
heredados/efectivos y flujos completos bajo identidad cloud en su ventana.

Metricas: log positivo exacto, no exit del job ni skip. Ausencia detecta tanto
contador cero como serie inexistente, ventana07:30-21:10 Cancun, umbral25min
sostenido5min. ERROR24h. Diez pruebas offline comprueban JSON/contratos y
conversion de limites UTC; no reemplazan compilacion PromQL, labels reales ni
recepcion del canal en Monitoring. Scheduler se crea despues del worker desarmado
y se pausa; una carrera entre creacion/pausa no autoriza acceso a la BD.

## 5. Resultados

Node/npm existentes; npm10.9.4, sin instalacion de dependencias.

| Comando/validacion | Resultado |
|---|---|
| test:db:prepare | exit0,20 SQL originales incluidos016/017; seed sintetico |
| test:api | 475PASS,21SKIP historicos de analizadores retirados,30 archivosPASS/2SKIP; exit0 |
| test:api:integration final | 171/171PASS,23archivos,0SKIP,60.86s; exit0 |
| teacher-fiscal-identity.integration.test.ts focal | 2/2PASS, ejecucion017/SQL real/rollback |
| dossier-worker-grants.integration.test.ts focal | 1/1PASS |
| test:web | 169/169PASS,23archivos; exit0 |
| typecheck | API y web OK, exit0 |
| build | API/web OK; sin publicacion de artefactos |
| Runbook PowerShell | 5 bloques parseados, cero errores; no ejecutados |
| git diff --check | OK al cerrar |

El primer typecheck detecto tipos de pg que no declaran query_timeout en literal
inline; se corrigio el tipado de los parametros sin cambiar dependencias ni SQL.
Al agregar la segunda comprobacion monotona, una expectativa del test de timer
debio exigir tambien rechazo al completar despues del plazo; se ajusto la prueba
al bloqueo mas estricto, sin quitar casos ni relajar el control.
Los21SKIP ya existian por retiro de analizadores; no se agregaron skips para
obtener aprobacion. Log de integracion sintetica en TEMP, no versionado.

## 6. Costos y siguiente ventana propuesta

Estimaciones, no recursos observados ni presupuesto autorizado: con84ejecuciones
diarias,30dias,60s minimos,1CPU/1GiB:workerUSD3.024; SchedulerUSD0.10/31dias;
10GiB medios Standard720h incluyendo recuperablesUSD0.197. Subtotal ilustrativo
USD3.32/mes. A230s todos los disparos:workerUSD11.592; a240s:USD12.096.
Arranque, API, operaciones/trafico GCS, secretos, build/registry, logs/Monitoring,
SQL/backups e impuestos quedan fuera; no es un tope ni el costo total.
[Fuentes y supuestos](H24_Plan_Infraestructura_Productiva_20261109.md#7-costos-restantes-ejemplo-no-cotizacion-ni-gasto-autorizado).

Siguiente ventana propuesta: **infraestructura restante, no habilitacion H24**.
Reconfirmar metadatos, aprobar IAM/bucket/grants, designar imagen por digest bajo
autorizacion separada de publicacion, preparar job desarmado, Scheduler pausado y
alertas disabled. No ejecutar worker contra esquema sin016/017. Termina con acta
de config efectiva, rollback de bindings propios y pruebas pendientes explicitadas.

Decisiones humanas imprescindibles:
1. Aprobar esa ventana/duracion/presupuesto/nombres y responsable DBA/operacion.
2. Confirmar receptor/guardia y canal productivo de alertas; se propone el correo
   institucional ya usado en H24, sin asumir que autoriza el canal productivo.

Datos tecnicos por resolver dentro de ventanas autorizadas: disponibilidad del
nombre, IAM heredado, secreto/rol dedicado, digest, metadata buckets, H05/backup
oportunos, compilacion/recepcion de alertas, smoke y capacidad cloud de esta
candidata. Migraciones productivas016/017 y release API/Hosting requieren otra
autorizacion. No reabrir decisiones funcionales ni reincorporar analizadores.

## 7. Cierre y limites

Contenedor y volumen anonimo de esta ejecucion se retiran al finalizar, verificando
ID/etiqueta; se conserva la imagen local preexistente. BD local habitual intacta.
No se modificaron recursos cloud/productivos, expedientes reales, migraciones
historicas, H01 ni dependencias. Sin imagen publicada, merge o deploy.
Preparacion tecnica local validada; **H24 sigue NO-GO productivo** hasta completar
la infraestructura efectiva, autorizaciones y smoke de la candidata nueva.
