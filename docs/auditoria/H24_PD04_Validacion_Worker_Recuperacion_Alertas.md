# H24 PD-04 - Recuperacion, worker programado y alertas

Fecha: 2026-10-28.
Rama: `feature/h02-h03-user-coordinations-permissions`.
Base publicada antes del ensayo: `e66977a`, junto con `acf6f62` y `a880a4b`.

**Resultado: recuperacion y programacion local validadas con GCS aislado.
PD-04 permanece PARCIAL: job cloud privado y entrega externa de alertas pendientes.
No autoriza deploy ni cierra H24.**

Seguimiento cloud autorizado 2026-10-29:
[ensayo privado con PostgreSQL efimero](H24_PD03_PD04_Arquitectura_Cloud_Aislada.md).
Job `h24-recovery-rehearsal` aprobado en ejecuciones `qdq7q` y `qrr5j`; segunda
disparada por Scheduler con OAuth/IAM minimo. Carga, lectura, idempotencia, borrado
y retiro de constancia recuperados; tres objetos sinteticos y BD efimera retirados.
Inventarios previos intactos. Scheduler PAUSED; politica ERROR y canal email creados
solo H24, recepcion externa pendiente. No es ensayo Cloud SQL ni cadencia productiva;
PD-04 permanece parcial. Las secciones siguientes conservan el ensayo local anterior.

## 1. Alcance y aislamiento

- Proyecto exclusivo `nomina-h24-test-20261027`.
- BD `nomina_docente_test`, loopback `127.0.0.1:55440`, guard verificado por SELECT.
- Buckets `nomina-h24-test-234692275301-dossier` y `nomina-h24-test-234692275301-constancias`.
- Adaptadores GCS reales con identidad runtime existente y politica de borrado ya validada.
- Datos/PDF sinteticos; no se alteraron roles, IAM, politica de buckets o Firebase.
- Docente QA de prueba distinto al usado en la revision manual de constancia A/B.
- No se detuvo API/frontend ni se controlo la sesion del usuario.
- No se ejecuto el reset de integracion ni una suite que sustituya public.

Respaldo local `before-pd04.dump` completado con pg_dump exit 0 antes de escribir.
SHA-256: `b24b8cae13909b9b93ab7f724c6151b08c343522df94fa276469a37435890569`.
No es un backup de produccion. Evidencias privadas, configuracion y dump no versionados:
`%LOCALAPPDATA%/NominaDocente/H24-PD05-20261027/pd04-20261028/`.

## 2. Defectos detectados y ajuste acotado

El worker anterior solo marcaba salida no exitosa cuando constancias informaba
pending. Un fallo global de documentos adicionales impedia intentar constancias;
el lote procesado tampoco representaba el backlog restante ni su antiguedad.

Se agrega `apps/api/src/lib/dossier-worker.ts` y se integra en el entrypoint existente:

- Canales independientes para documentos y constancias; ambos se intentan.
- Resumen JSON sin nombres, correos, rutas de objetos, tokens ni errores SQL crudos.
- Conteos de procesados/COMPLETE/FAILED/pendientes y backlog posterior.
- Antiguedad de documentos desde created_at, no desde el ultimo retry.
- FAILED de las ultimas 24 h, separado de operaciones pendientes de borrado.
- Constancias: pendientes de retiro, staging total y staging abandonado >24 h.
- Salida 1 ante pendientes, abortos/fallos recientes o imposibilidad de recuperar/medir.
- No cambian contratos HTTP, roles, reglas de expediente, UI, SQL/migraciones ni H01.

Codigos de alerta: `DOCUMENT_RECONCILIATION_FAILED`,
`CERTIFICATE_RECONCILIATION_FAILED`, `BACKLOG_READ_FAILED`, `DOCUMENT_PENDING`,
`DOCUMENT_FAILED`, `CERTIFICATE_PENDING`, `BACKLOG_OVER_BATCH`,
`BACKLOG_AGE_EXCEEDED`; fallo de arranque: `WORKER_START_FAILED`.
Son senales locales estructuradas, no una notificacion ya entregada por Monitoring.

## 3. Escenarios y resultados reales

| Escenario | Evidencia | Resultado |
|---|---|---|
| Fallo antes de guardar PDF | PREPARED sin objeto; retry clasifica UPLOAD_INTERRUPTED | FAILED terminal, metadata transitoria retirada |
| Fallo despues de guardar PDF | Objeto real persistido, publicacion interrumpida; recuperacion verifica hash | COMPLETE, objeto disponible sin duplicar |
| Reemplazo con borrado fallido | Nuevo objeto disponible; anterior permanece CLEANUP | Retry elimina el anterior y completa |
| Eliminacion con fallo storage | DELETING/CLEANUP durable, sin ocultar el pendiente | Retry elimina bytes y metadata del documento |
| Caida de proceso con advisory lock | Proceso hijo propio terminado; segunda conexion bloqueada antes y habilitada despues | Lock liberado por PostgreSQL |
| Constancia sustituida con delete fallido | Nueva version current; anterior DELETE_PENDING | Worker borra anterior, conserva vigente |
| Constancia abandonada despues de upload | Fallo controlado en publicacion; STAGING envejecido >24 h solo en fixture | Worker elimina bytes; marca DELETED |
| Reejecucion programada | Segundo proceso nuevo, sin depender de la API/UI | 0 operaciones, 0 borrados; idempotente |
| Fallos/antiguedad | Inyeccion controlada con GCS real, no indisponibilidad real de Google | Alertas visibles y exit 1 |

Se prepararon seis operaciones de documentos (cinco COMPLETE y una FAILED esperada)
y tres registros sinteticos de constancia (una vigente y dos DELETED tras recuperar).
El ensayo no simulo una caida total de Google ni un reinicio de Cloud Run.
El corte de proceso verifico liberacion del lock; los cortes de transferencia/publicacion
se modelaron mediante excepciones controladas alrededor del adaptador real.

## 4. Programacion local comprobada

Task Scheduler de Windows: tarea temporal `Nomina-H24-PD04-20261028-Controlled`,
principal de usuario interactivo limitado, sin guardar contrasena, dos disparos
unicos separados por un minuto, IgnoreNew y limite de dos minutos.
Ejecuto el worker real con configuracion privada de test; no una ruta HTTP.

| Finalizacion UTC | Procesados / COMPLETE | Constancias eliminadas | Backlog final | Exit |
|---|---:|---:|---:|---:|
| 2026-10-28T16:35:52.275Z | 2 / 2 | 2 | 0 documentos / 0 constancias | 1 |
| 2026-10-28T16:36:50.229Z | 0 / 0 | 0 | 0 documentos / 0 constancias | 1 |

Exit 1 es esperado: `DOCUMENT_FAILED` refleja tres abortos en las ultimas 24 h
(dos anteriores conservados mas el nuevo fallo sintetico). No significa que sigan
existiendo objetos pendientes de borrar. Una cola vacia sin fallos arroja exit 0,
cubierto por prueba automatizada; no se borraron abortos anteriores para forzar verde.

Dos intentos iniciales del envoltorio local fallaron por cerrar el pool antes de
invocar el entrypoint; PowerShell tambien interrumpia captura de stderr. Se corrigio
solo el arnes privado y se repitieron ambos disparos con evidencia completa. No se
presentan esos intentos fallidos como ejecuciones aprobadas ni como fallo productivo.

La tarea fue exportada como evidencia y **eliminada** al terminar. No queda una
ejecucion desatendida nueva. XML SHA-256:
`6cb645b965268778d1205de54497ab92d89aeF621c383611dff1969f81c55837`.
La programacion Windows no sustituye el futuro scheduler cloud privado.

## 5. Alertas, limites y pendientes de operacion

Umbrales iniciales del worker: backlog >25 o antiguedad >900 s genera alerta;
documentos elegibles para retry conservan espera >5 min y lote 25 (maximo interno 100).
Constancias conservan lote 25, STAGING >24 h y proteccion de referencias vigentes.
Staging reciente se contabiliza, pero no se considera abandonado ni se elimina.
La edad de DELETE_PENDING usa uploaded_at, un indicador conservador, no el instante
exacto de solicitud de borrado; la de staging vencido descuenta las 24 h de gracia.

Pendiente antes del cierre cloud de PD-04:

1. Autorizar y ensayar job privado, invocador/scheduler y Monitoring en H24 aislado.
2. Definir destinatario real, deduplicacion/escalamiento y verificar recepcion de alerta.
3. Probar timeout, reintentos acotados y ejecucion en runtime cloud con identidad minima.
4. Adoptar procedimiento de reconocimiento de FAILED recientes: el worker avisa por 24 h;
   no configurar reintentos inmediatos infinitos para un aborto terminal ya revisado.
5. Tratar filas invalidas o buckets ajenos como incidente: constancias falla cerrado,
   conserva marcadores y puede bloquear el lote. No ampliar permisos ni borrar manualmente.

Propuesta futura: job sin endpoint publico, mismo artefacto/DB/namespace de API;
`node apps/api/dist/dossier-reconcile.js`, `ALLOW_DOSSIER_RECONCILE=true` solo en worker.
Cadencia inicial cinco minutos. Crear alerta por ausencia de ejecucion ademas de
severidad ERROR/backlog. Su provisionamiento y el productivo requieren autorizacion;
no se ejecutaron en esta fase ni se instalaron dependencias.

## 6. Restitucion e integridad

- Limpieza exclusiva de objetos, operaciones, auditorias y metadata sinteticos creados
  por este ensayo, usando UUID registrados previamente en manifiesto privado.
- Comparacion final de fingerprints de todas las tablas public: **0 diferencias**.
- Cero pendientes nuevos; los dos FAILED anteriores se conservan identicos.
- teachers, usuarios/roles, datos fiscales, Nomina, corridas y snapshots intactos.
- Inventario auditor GCS con all-versions: bucket dossier vacio; constancias contiene
  solo la B manual original, misma generacion `1793201059272242`.
- No se borro la B del docente revisado por el usuario ni se altero su ficha.
- No produccion, deploy, migracion, cambio de permisos/IAM ni modificacion H01.
- Hubo escrituras sinteticas temporales en test; no se presenta esta prueba como read-only.

## 7. Regresion

| Validacion | Resultado |
|---|---|
| Worker unitario nuevo | 13/13 |
| npm run test:api | 217/217, 18 archivos |
| Integracion granular worker + constancia | 2/2; tablas temporales, ROLLBACK; 0 fingerprints persistentes cambiados |
| npm run test:web | 144/144, 23 archivos |
| npm run typecheck | OK |
| npm run build | OK |
| git diff --check | OK |

No se ejecuto la suite de integracion completa: contiene reset de public y sustituiria
el entorno conservado para revision. Los dos tests ejecutados no usan ese reset.

## 8. Resultado de release

PD-04: **parcial, recuperacion y scheduler local aprobados; cloud/alerta externa pendientes**.
H24 permanece NO-GO. Los tres commits previos fueron publicados antes de iniciar
PD-04. Este cambio versiona el worker, sus pruebas y las seis piezas documentales
de PD-04; no cierra los pendientes cloud ni inicia PD-05.
