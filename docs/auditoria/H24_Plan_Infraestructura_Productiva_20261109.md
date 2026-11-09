# H24 - Plan revisable de infraestructura productiva

Actualizado: 2026-11-09. **Preparacion cloud parcial; H24 sin GO productivo.**

Ultimo seguimiento: [ventana backup/DBA](H24_Ventana_Respaldo_Migraciones_Worker_20261109.md).
Respaldo1794261106620 SUCCESSFUL, sin restauracion ensayada. Falta credencial
DBA: inspect/apply no ejecutados; tampoco usuario/secreto/worker/Scheduler.
No tomar el H05 historico como dictamen actual de57c565a. Canal sin verificacion
acreditada; formulario bloqueado por el entorno, sin intentar otra via.

Estado posterior verificado: [acta de ventana de infraestructura](H24_Ventana_Preparacion_Infraestructura_20261109.md).
Imagen57c565a publicada sin deploy; bucket adicional, SA, roles, metrica y alertas
disabled creados. No worker/Scheduler: falta credencial SQL dedicada. API conserva
restore por objectAdmin; IAM pendiente antes del release. Canal creado, correo
de verificacion recibido, verificacion/alerta operativa aun no acreditadas.
Las secciones de antecedente y costos ilustrativos conservan su alcance original.

Preparacion posterior sobre b3d0681: [acta de PostgreSQL/worker](H24_Preparacion_Worker_Infraestructura_20261109.md)
y [paquete revisable por etapas](../../ops/h24/README.md).
La guarda horaria y exclusion ya estan implementadas/probadas localmente.
La preparacion local anterior no era provisionamiento ni H05 productivo;
la ventana parcial posterior queda diferenciada en el acta enlazada arriba.

## 1. Cambio de alcance vigente

Por decision expresa del usuario se retiran Inspector, Poppler y ClamAV del
flujo API y del plan productivo para evitar sus costos. No se reemplazan por
mocks ni veredictos de limpio. La candidata aplica BASIC_ENVELOPE_V1 y entrega
NOT_SCANNED. No hay decodificacion de imagenes, inspeccion estructural PDF,
limite de paginas/MaxFiles ni deteccion de malware. La vista de contenido
incrustado se sustituye por informacion y descarga autorizada.
[Acta de esta adecuacion](H24_Retirada_Analizadores_20261109.md).

La version previa de este plan queda en Git en 66b9639. Los ensayos de
eb24250, 3284a12 y sus actas permanecen historicos; no certifican esta candidata.
Las aceptaciones previas de Rectoria para red/visor y segundo emisor se revisan
el 2027-02-01; no se reinterpretan como prueba antivirus de archivos nuevos.
La decision de costo de esta fase acepta retirar el control, no elimina el riesgo.

## 2. Antecedentes previos a la ventana cloud parcial

- H05 favorable aportado por el usuario el 2026-11-09, 14:39:31 UTC para 3284a12:
  dos tablas, 20 archivos, 18 registradas (15 baseline/3 aplicadas),
  solo 016/017 pendientes, checksum mismatch 0, exit 0.
- Backup 1793913186499 SUCCESSFUL segun usuario; restauracion no ensayada.
- Referencia API/rollback: nomina-api-00057-c7d, digest
  sha256:a7d0de2196c5552d50cd75b8f01e15238dc90f701941b8656613bf6d1789196b.
- Hosting: release 1793121624438000 / version 3f9ebc88c835a143.
- Metadata observada inicialmente el 2026-11-05; reconfirmada por la ventana
  parcial del 2026-11-09 en el acta, sin repetir inspeccion SQL.
- PD-DEST-01: siete dias acreditados en GCS aislado para 3284a12.
  Se conserva su evidencia; no se repitio GCS en esta adecuacion.
- No se modifican 016/017 ni se ejecuta H05 productivo. La preparacion posterior
  autorizada si ejecuto los 20 SQL originales, incluida 017, exclusivamente en
  PostgreSQL efimero sintetico; no cambia el historial productivo anterior.

## 3. Inventario restante y pendientes

| Recurso/control | Plan vigente | Pendiente productivo |
|---|---|---|
| API | Imagen57c565a publicada por digest; API vigente no cambiada | Capacidad/configuracion H24 y ventana de release |
| Inspector / scanner | Excluidos: cero servicios/imagenes/cuentas/Invoker/alertas exclusivos nuevos | No aprovisionar. Inventario y retiro de recursos de ensayo antiguos requieren otra autorizacion |
| Constancias | Metadata reconfirmada: privado,604800,versioning ausente; politica no cambiada | Sustituir objectAdmin/restore de API bajo autorizacion y validar runtime IAM |
| Adicionales | Creado nomina-docente-prod-h24-expedientes; privado,versioning false,softDelete 0 | Validar acceso runtime en futura ventana, no se operaron objetos |
| Worker | Propuesto nomina-h24-dossier-reconcile; SA/roles preparados, imagen publicada; guarda y exclusion locales probadas | Credencial dedicada, permisos SQL/secreto, crear desarmado y validar ejecucion autorizada |
| Scheduler | Propuesto nomina-h24-dossier-reconcile-10m; OAuth; retry 0; guarda del worker implementada | Provisionar pausado tras crear worker desarmado; validar efectivamente antes de habilitar |
| Alertas de limpieza | Canal, metrica y politicas fallo/ausencia creados disabled; sintaxis aceptada | Verificacion canal, series runtime, pruebas/recepcion y recuperacion productiva |
| Seguridad residual | Archivos no analizados; descarga attachment, sin visor incrustado | Procedimiento institucional para abrir archivos y gestion de incidentes |
| Release | H24 no habilitado | Migraciones 016/017, backup oportuno, rollback, smoke y autorizaciones separados |

No hay retiro automatico de cloud en el codigo ni permisos para hacerlo aqui.
No se promete ahorro en la factura actual: la ventana inspecciono metadata y no
elimino servicios existentes. Costos observados/estimados separados en el acta.

## 4. IAM y configuracion

Separar runtime API, worker, Scheduler y restauradores humanos. API:
storage.buckets.get + objects.get/create/delete en los dos buckets designados;
worker: buckets.get + objects.get/delete. Sin restore para ambos. Verificar
herencia, grupos, condiciones y roles amplios antes de sustituir objectAdmin;
anadir un rol minimo no elimina permisos heredados. No dar objects.list por
comodidad. El restaurador humano sigue fuera de Nomina.

Conservar Cloud SQL Client, referencias Secret Manager y firebaseauth.users.get
necesarios. Resolver con DBA los permisos SQL del worker sobre tablas documentales.
Cloud SQL Client no concede permisos SQL. No exponer credenciales en manifiestos.
Scheduler solo Invoker del job aprobado, sin overrides.

**No conceder Invoker a Inspector/ClamAV ni crear cuentas exclusivas para ellos.**
No incluir DOCUMENT_SECURITY_MODE, DOCUMENT_SECURITY_PARSER_URL,
DOCUMENT_SECURITY_SCANNER_URL, imagenes/firma AV ni DOSSIER_PDFINFO_PATH en la
configuracion H24 nueva. El validador actual no los consulta: no hay modo de
fallback ni opcion que simule antivirus. Configuracion restante:
CONSTANCIAS_BUCKET, DOSSIER_STORAGE_MODE=gcs, DOSSIER_BUCKET, Firebase/BD actuales.
Conservar variables/secretos ajenos. ALLOW_DOSSIER_RECONCILE=true habilita el
entrypoint del worker; no es autorizacion para ejecutarlo sobre produccion.

## 5. Almacenamiento y reemplazo

Ambos destinos privados, UBLA y PAP enforced; sin ACL publicas, retenciones,
holds o lifecycle incompatibles. Constancias: conservar 604800 segundos y
versioning omitido/false. Adicionales: false/0 explicitos y destino separado.
No modificar politicas productivas mediante esta tarea.

A sigue vigente si B falla antes del cambio. Al confirmar B solo B se entrega
desde Nomina. Cleanup/reconciliacion retira exclusivamente la generacion anterior;
reintentos no borran la vigente. Constancias quedan recuperables siete dias
desde el borrado en GCS, solo para personal autorizado; no hay restauracion UI.
Adicionales conservan borrado definitivo. Integridad hash/generacion sin cambios.

## 6. Capacidad, horario y alertas de limpieza

API: no heredar dimensionamiento de analizadores. Validar CPU/RAM/concurrencia
y presupuesto de conexiones para la candidata sin servicios externos. El
antecedente 1 CPU/512 MiB/concurrency 80/max 3 no es capacidad H24 certificada.
Worker propuesto 1 CPU/1 GiB, una tarea, parallelism 1, retry 0, timeout 240 s;
medir backlog y duracion real antes de habilitar. No usar Dockerfile.rehearsal ni
PostgreSQL sidecar historico como worker productivo.

Horario SQL antecedente: 06:50-22:00 America/Cancun. Propuesta Scheduler
`*/10 7-20 * * *`, 84 disparos/dia, ultimo 20:50. Confirmar con operacion
latencia nocturna. Una tarea no impide dos ejecuciones solapadas.
Guarda implementada en la candidata posterior a b3d0681: admision real
07:00 inclusive a 21:50 exclusiva, revalidada tras adquirir conexion/lock;
presupuesto monotono 230 s y watchdog a las 21:55. El timeout Cloud Run propuesto
es 240 s, tambien protege frente a bloqueo del event loop. No admitir despues
del corte aunque el Scheduler haya programado antes. Conexion PostgreSQL dedicada
con pg_try_advisory_lock(4731444,1), sin espera: otro worker omite la ejecucion.
Heartbeat y perdida de lease terminan el proceso; locks por operacion siguen.
No cambiar horario SQL ni abrir ventanas automaticamente. Falta comprobar esta
imagen/configuracion efectivas en cloud autorizado, no implementar otra guarda.

Alertas restantes: dossier_reconcile ERROR/exitCode, DOCUMENT_FAILED,
CERTIFICATE_PENDING, BACKLOG_AGE_EXCEEDED, WORKER_START_FAILED; sin contenido,
nombres ni tokens. Ausencia de exito REAL mediante metrica de log
outcome=COMPLETED, cleanupSucceeded=true, exitCode=0; nunca contar
SKIPPED_HOURS/SKIPPED_OVERLAP ni usar completed_execution_count como sustituto.
Propuesta PromQL: 25 min sin exito, sostenidos 5 min, solo07:30-21:10 Cancun;
contempla cero y serie ausente aun sin positivo inicial. ERROR permanece24h.
JSON/configuracion y conversion horaria probados offline; Monitoring acepto
las politicas disabled. Series, verificacion de canal, recepcion y resolucion
siguen pendientes de otra ventana. No se generan alertas reales en esta fase.
Se retiran alertas AV/Inspector/firmas/MaxFiles exclusivas.

## 7. Costos restantes: ejemplo, no cotizacion ni gasto autorizado

Precios publicos consultados 2026-11-09, us-central1, USD sin free tier,
descuentos, impuestos ni conversion monetaria. No son mediciones de consumo.

| Concepto | Supuesto | Estimacion |
|---|---|---:|
| Nuevos analizadores | No provisionados ni invocados | USD 0 previstos en el nuevo plan |
| Worker | 84 ejecuciones/dia x 30 dias x 60 s minimos; 1 CPU + 1 GiB | USD 3.024/30 dias |
| Scheduler | 1 job, sin franquicia | USD 0.10/31 dias |
| GCS Standard | 10 GiB medios, incluyendo bytes recuperables, 720 h | USD 0.197/30 dias |
| Subtotal ilustrativo | Solo los tres conceptos anteriores | Aproximadamente USD 3.32/mes |

Worker: 151200 s x (0.000018 CPU + 0.000002 RAM). Si consume 230 s cada ejecucion,
serian USD 11.592/30 dias solo worker; a 240 s de techo de plataforma, USD 12.096.
El minimo facturable por ejecucion es 60 s. Scheduler pausado sigue siendo facturable.
Storage: 10 x 720 x 0.000027397; no supone volumen real de expedientes.
Soft-deleted bytes tambien se facturan hasta expirar. API incremental, operaciones
GCS, trafico, builds, Artifact Registry, secretos, Monitoring/logs, backups y
Cloud SQL quedan fuera del subtotal: requieren volumen/retencion y configuracion.
No confundir este subtotal con costo total o tope automatico. Presupuesto/ventana
de operacion necesitan autorizacion; la ventana parcial tuvo USD10 de objetivo
solo para su intervencion, no hereda ni renueva limites de ensayos anteriores.

Fuentes: [Cloud Run](https://cloud.google.com/run/pricing),
[Scheduler](https://cloud.google.com/scheduler/pricing),
[GCS](https://cloud.google.com/storage/pricing).

## 8. Secuencia futura y rollback

1. Partir del inventario ya creado del acta, sin duplicar bucket/canal/roles/SA.
   Completar IAM efectivo, credencial DBA, dimensionamiento y operacion/alertas.
   Conservar candidata57c565a y su digest; cualquier cambio exige revalidacion.
2. Precheck de metadata/rollback/H05 en ventana autorizada; parar ante diferencias.
3. Provisionar solo recursos restantes aprobados. No construir/desplegar
   Inspector/ClamAV. Scripts historicos archivados no son runbooks actuales.
4. Backup preventivo vigente SUCCESSFUL y restaurabilidad revisada; autorizar
   aparte migraciones 016/017. Esperar 20 registradas/0 pendientes/0 mismatch.
   Ningun apply, baseline, dry-run, seed o restauracion se ejecuta en esta fase.
5. Autorizar API/worker/Hosting y smoke sintético designado. Verificar 200/401/403,
   roles, descarga sin visor, hashes, A->B, fallos/reintentos, soft delete,
   borrado adicional, alertas y capacidad sin degradar Nomina.
6. Si falla privacidad, autorizacion, integridad o limpieza, impedir habilitacion.
   Rollback API/Hosting a referencias reconfirmadas; no revierte 016/017 ni
   elimina intenciones. Mantener worker compatible para cleanup comprometido.
   No restaurar un PDF antiguo como vigente ni restaurar toda la BD por defecto.

**H24 mantiene NO-GO productivo.** La ventana separada autorizo los recursos
parciales del acta, no migraciones, ejecucion worker, merge ni deploy.
