# H24 - Plan revisable de infraestructura productiva

Fecha: 2026-11-09, America/Cancun. **Propuesta, no ejecutada ni autorizada para
producción.** Alcance de esta tarea: documentación, preparación local, commit y
push. No incluye consultas nuevas a producción, recursos, IAM, respaldo,
migraciones, merge, despliegue ni habilitación de H24.

## 1. Evidencia y punto de partida

- Candidata funcional: `3284a12af189baeaff51335401d13e9923d9d51d`.
- [PD-DEST-01](H24_PD_DEST_01_Constancias_Recuperables.md), cierre `9f06dc7`:
  siete días acreditados para la generación sintética A en GCS aislado; no
  prueba objetos productivos ni otorga acceso de restauración al runtime.
- [Precheck](H24_Precheck_Productivo_Solo_Lectura_20261105.md), `f5cc479`:
  observación de metadata del **5 de noviembre**, no inspección actual.
- [H05](H24_Ventana_Respaldo_Cloud_SQL_Inspeccion_H05_20261105.md): favorable el
  9 de noviembre a las 14:39:31 UTC según transcripción aportada por el usuario.
  20 archivos/18 registradas/15 baseline/3 aplicadas/solo 016 y 017 pendientes/
  checksum mismatch 0/exit 0. No se volvió a conectar a la BD.
- Backup `1793913186499`: SUCCESSFUL, reconfirmado el 9 según el usuario;
  restauración de ese respaldo no ensayada. No se creó otro para este plan.
- Revisión/retorno H24 de referencia: `nomina-api-00057-c7d`, digest
  `sha256:a7d0de2196c5552d50cd75b8f01e15238dc90f701941b8656613bf6d1789196b`.
  Hosting release `1793121624438000`, versión `3f9ebc88c835a143`.
  **Reconfirmar ambos y su disponibilidad antes de la ventana.**

La revisión 00056-mll sigue siendo historia anterior a 00057, no el destino
inicial de rollback de H24. No atribuir los digests del ensayo eb24250 a 3284a12.
Las aceptaciones comunicadas por Rectoría para PD-03 (salida de red/visor) y
PD-05 (segundo emisor no ejecutado) vencen para revisión el 2027-02-01; no
permiten analizadores públicos, saltar antivirus ni ampliar permisos fiscales.

## 2. Requisitos y valores por resolver

| Requisito | Esperado/propuesta | Antecedente observado | Pendiente antes de ejecutar |
|---|---|---|---|
| Destino | nomina-docente-prod, us-central1 | Confirmado 2026-11-05 | Reconfirmar proyecto/número/recursos |
| Constancias | nomina-docente-prod-constancias, soft delete 604800 s; versioning ausente o false | Compatible el 5/11, UBLA y PAP enforced, sin retenciones adicionales | Releer metadata; no cambiar política; comprobar holds por generación al operar |
| Adicionales | Bucket distinto, privado, versioning.enabled=false explícito, soft delete 0 explícito | No designado al 5/11 | Nombre global disponible y propietario aprobados; no reutilizar constancias |
| Runtime API | nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com | objectAdmin directo en constancias; no buckets.get en ese rol | Auditoría efectiva/inherencia; reemplazo mínimo sin restore |
| Inspector / scanner | Dos servicios privados por IAM | Ausentes en región al 5/11 | Nombres, identidades, URLs e imágenes por digest aprobados |
| Worker / Scheduler | Job y cuenta invocadora separados | Sin worker al 5/11 | Nombres, cuenta DB/secret version, programación y guardas horarias |
| Alertas | Error y ausencia de éxito; receptor de producción confirmado | Sin canales/políticas al 5/11 | Responsable de guardia, canal y recepción productiva |
| Capacidad | Servicios separados, límites revisados y pruebas concurrentes | API 1 CPU/512 MiB, concurrency 80/max 3; no dimensionamiento H24 productivo | Presupuesto de conexiones/CPU/memoria y prueba candidata sin degradar Nómina |
| Artefactos | API/worker/inspector/scanner ligados a 3284a12, imágenes inmutables | Hay evidencia de candidatos anteriores; no digest productivo nuevo aprobado | Build reproducible, inventario, digests y regresión exactos |

No se asignan nombres nuevos, destinatarios ni digests por inferencia. El correo
que recibió alertas H24 no queda automáticamente designado para producción.

## 3. Identidades y mínimo privilegio

Separar administrador de provisión, runtime API existente, worker, inspector,
scanner, invocador Scheduler y grupo humano de restauración. Las identidades
nuevas y propietarios están **pendientes de designación**; no usar claves JSON.

| Identidad | Permisos propuestos y alcance | Exclusiones |
|---|---|---|
| API | Rol personalizado GCS en cada bucket: buckets.get, objects.get/create/delete; Invoker solo en ambos analizadores; conservar Cloud SQL Client y secretos precisos necesarios | Sin restore/list/update de buckets/IAM; revisar otros usos antes de retirar objectAdmin |
| Worker | Rol GCS separado buckets.get, objects.get/delete en ambos destinos; Cloud SQL Client; Secret Accessor solo credencial DB designada; Invoker solo analizadores requeridos por reconciliación | No crear objetos desde el reconciliador actual; sin restore; sin permisos generales de administración |
| Inspector / scanner | Identidad por servicio; recepción exclusiva mediante Cloud Run IAM; logs stdout | Sin grants BD, buckets, secretos, Firebase users ni administración de proyecto |
| Scheduler | roles/run.invoker en el job concreto para jobs.run, OAuth al API Run | Sin override de ejecución, BD, buckets o invocación pública |
| Restauración humana | Grant acotado a constancias: objects.restore/create y consulta/listado necesarios; procedimiento con aprobación y auditoría | Nunca runtime API/worker; no restaurar dentro de Nómina ni reemplazar la vigente |
| Provisión | ActAs solo en cuentas designadas y roles de gestión de recursos autorizados temporalmente | No convertir runtime en Owner/Editor ni compartir credenciales DBA |

Las operaciones exactas del adaptador candidato justifican get/create/delete;
no añadir objects.list al runtime por comodidad. Para restaurar, revisar los
permisos adicionales del procedimiento elegido antes de concederlos; no otorgar
buckets.restore (restauración masiva) sin una necesidad aprobada.

Antes de retirar bindings: capturar metadata IAM con etag, revisar grants en
bucket/proyecto/carpeta/organización, grupos, condiciones, roles básicos y
capacidad de impersonación. Policy Troubleshooter falló con 403 en el precheck:
falta un operador autorizado para esta verificación. Añadir un rol mínimo no
elimina los permisos heredados. **Detener si restore sigue efectivo para runtime**;
no modificar políticas de grupos compartidos sin análisis/aprobación aparte.
Verificar también firebaseauth.users.get para la comprobación vigente de
revocación, sin añadir create/update/delete de usuarios. No resetear permisos
preexistentes de Cloud SQL o secretos que sostienen la API actual.

## 4. Almacenamiento y seguridad documental

Constancias: conservar política de 604800 s; no enviar un update de política
innecesario. Solo B es consultable por Nómina tras confirmar reemplazo A -> B;
A sigue vigente si falla la nueva carga antes de confirmarla. El reconciliador
retira la generación anterior sin borrar B, y GCS conserva recuperabilidad siete
días para restauradores autorizados. No prometer eliminación física inmediata.

Adicionales: destino separado Standard/us-central1 propuesto, UBLA, PAP enforced,
sin miembros públicos, retención/holds/objectRetention incompatibles ni lifecycle
que retire documentos vigentes. Exigir respuesta efectiva con versioning false
y soft delete 0; el adaptador **rechaza campos omitidos** en este destino.
Constancias acepta versioning omitido, adicionales no. Verificar metageneración
y políticas antes de habilitar, sin desproteger los buckets existentes.

Inspector/ClamAV: Cloud Run con comprobación IAM activa, sin allUsers ni
allAuthenticatedUsers. Solo API/worker autorizados con ID token de audiencia
exacta. El wrapper no autentica JWT por sí mismo: no deshabilitar la comprobación
Invoker de Run. Ingress autenticado no equivale a firewall de salida; no exigir
ingress internal sin diseñar y probar la ruta de red desde API/worker.
Conservar el alcance de la excepción de red y visor aceptada por Rectoría.

Conservar 7.5 MiB, MaxFiles 100, parser/política, firmas vigentes y veredicto
correlacionado por hash. Scanner mantiene tini y tiempos de proceso existentes;
no reemplazar entrypoint por Node. Sin respuesta válida/firma fresca: bloqueo
seguro, sin fallback. 429 controlado no es permiso para omitir análisis.

## 5. Configuración y capacidad propuesta

| Componente | Propuesta inicial, a aprobar | Verificación |
|---|---|---|
| Inspector | 1 CPU/512 MiB, concurrency 2, max 1, timeout 45 s | Una ejecución y una espera acotada; 403 sin credencial |
| Scanner | 2 CPU/4 GiB, concurrency 2, max 1, timeout 240 s | Una ejecución/una espera; firmas oficiales; 403 anónimo |
| Instancias mínimas analizadores | 1 durante ventana de prueba para replicar ensayo; régimen estable pendiente | Revalidar arranque frío si se propone min 0; no asumir Hosting tolera 230 s |
| API candidata | Proponer 2 CPU/1 GiB, max 3; concurrencia final pendiente | Contrastar con ensayo y conexiones SQL antes de asignar tráfico; no heredar 80 sin prueba |
| Worker | Imagen API candidata, node apps/api/dist/dossier-reconcile.js; 1 CPU/1 GiB, 1 tarea/parallelism 1, retry 0, timeout 240 s propuesto | Medir duración real/backlog; no aumentar plazo sobre cierre SQL |

No usar Dockerfile.rehearsal ni PostgreSQL sidecar de ensayo para producción.
El worker real requiere `NODE_ENV=production` y `ALLOW_DOSSIER_RECONCILE=true`;
**crearlo no autoriza ejecutarlo**: modifica intenciones/objetos al reconciliar.
No ejecutarlo antes de 016/017 y autorización específica de operación.

API y worker deben compartir `CONSTANCIAS_BUCKET=nomina-docente-prod-constancias`,
`DOSSIER_STORAGE_MODE=gcs`, `DOSSIER_BUCKET=<pendiente>`,
`DOCUMENT_SECURITY_MODE=cloud-run`, `DOCUMENT_SECURITY_PARSER_URL=<pendiente>`,
`DOCUMENT_SECURITY_SCANNER_URL=<pendiente>` y proyecto Firebase productivo.
El namespace sale de `gcs:<bucket>`; no introducir variables alternativas.
Conservar configuración/secretos ajenos a H24. Montaje Cloud SQL y referencias
Secret Manager/versiones deben validarse sin imprimir valores. La cuenta DB
del worker y sus privilegios mínimos sobre tablas documentales se resolverán
con DBA; no suponer que Cloud SQL Client autoriza SQL ni que app_nomina sea
de solo lectura. No diseñar grants de escritura en esta fase documental.

## 6. Horario, recuperación y alertas

Cloud SQL observado 06:50–22:00 America/Cancun. Propuesta Scheduler:
`*/10 7-20 * * *`, zona `America/Cancun`: primera 07:00, última 20:50,
84 disparos/día. Deja margen de arranque/apagado; operaciones posteriores al
último pase pueden quedar para la mañana. Confirmar esa latencia con operación.
No cambiar el horario SQL ni prometer limpieza nocturna.

Scheduler usa POST con OAuth a
`https://run.googleapis.com/v2/projects/nomina-docente-prod/locations/us-central1/jobs/<JOB_APROBADO>:run`.
Retry 0; tareas/reintentos del job también 0. HTTP 200 solo acepta el disparo,
no demuestra éxito del reconciliador. Limitar solapamiento entre ejecuciones:
parallelism 1 solo limita tareas dentro de una ejecución, no dos disparos.
Antes de activar, probar duración <240 s, ausencia de ejecuciones previas y
comportamiento ante Scheduler demorado. El entrypoint actual no comprueba la
hora local: **guarda horaria/admisión operativa por resolver antes de programar**,
no declararla implementada. Si no puede garantizarse, conservar Scheduler
pausado y usar ejecución supervisada autorizada dentro del horario.

Alertas propuestas (sin contenido de archivos, nombres docentes o tokens):

- Error: resource.labels del job/servicios aprobados; `jsonPayload.event="dossier_reconcile"`
  con severity ERROR/exitCode !=0, además de fallos de ejecución y errores de
  analizadores. Conservar señales DOCUMENT_FAILED, CERTIFICATE_PENDING,
  BACKLOG_AGE_EXCEEDED y WORKER_START_FAILED. No usar texto de SQL o PDF.
- Ausencia: métrica `run.googleapis.com/job/completed_execution_count` filtrada
  por job y result=succeeded; >25 min sin éxito durante operación. Necesita
  medición positiva inicial y consideración de retraso de Monitoring.
- Evitar alertas nocturnas falsas: diseñar mute programado fuera de 07:30–21:20
  America/Cancun o regla horaria equivalente probada. No suprimir la alerta
  ERROR fuera de horario; un disparo nocturno es anómalo. Responsable y mecanismo
  de mute por aprobar, no asumir que un conditionAbsent conoce el cron.
- Probar error sintético aislado por recurso/etiqueta, recepción por destinatario
  confirmado, resolución y ausencia real por pausa controlada después de éxito.
  Esa pausa en producción requiere aprobación operativa independiente; evidencia
  H24 no acredita recepción en el proyecto productivo.

## 7. Secuencia ejecutable y puntos de parada

1. Aprobar inventario, propietarios IAM/DB/seguridad/alertas/rollback, horario y
   gasto. Congelar candidata, builds/digests y permisos de la cuenta ejecutora.
2. Reconfirmar metadata, rollback API/Hosting y H05 en alcance explícito.
   Inventariar IAM efectivo y dependencias antes de retirar grants; sin lectura
   de expedientes. Diferencia inesperada -> detener, no corregir en silencio.
3. Provisionar bucket adicional y cuentas mínimas; constancias conserva política.
   Aplicar permisos con etag/diff aprobado, revisar herencia y controles privados.
   No retirar objectAdmin de API existente sin comprobar compatibilidad de esa
   revisión y tener reversión acotada aprobada; migrar grants en ventana acordada.
4. Construir/publicar analizadores privados por digest y probar invocación negativa
   y autorizada con archivos sintéticos. Conservar presupuestos y límites.
   Provisionar Monitoring y worker **sin ejecutarlo**; Scheduler permanece
   sin crear/activar hasta resolver guardas y esquema. No alterar API live aún.
5. Cerrar conformidad de infraestructura, red/visor y capacidad candidata. Si
   requiere nueva instrumentación, código o cambios materiales, revisar y validar
   en otra fase local antes de ejecutar el plan productivo.
6. Ventana distinta de datos: revisar vigencia del backup 1793913186499,
   restaurabilidad y obtener respaldo preventivo apropiado, esperar SUCCESSFUL;
   inspección debe seguir 20/18/solo 016 y 017/mismatch 0. Solo con autorización
   explícita de migración aplicar ambas por H05 y verificar 20/0/0. Nunca baseline,
   seeds, SQL correctivo o datos test. No incluir apply en la ventana de infraestructura.
7. Ventana de release aprobada: API candidata sin tráfico, guardas/configuración,
   worker y ejecución autorizada, luego tráfico API y Hosting. No iniciar sesiones
   productivas ni mutar un docente real sin permiso (login puede escribir auditoría).
   Smoke sintético requiere alta designada autorizada; no improvisar fixtures.
8. Probar salud 200/401/403, roles, A -> B/hash/generación/timestamps siete días,
   adicionales sin versión recuperable, teléfono/fiscal, recuperación interrumpida,
   alertas y capacidad sin degradar Nómina. Registrar por separado ensayo y smoke.

## 8. Plantillas revisables (NO ejecutadas)

No son un script de provisión masiva. Completar variables pendientes en una
copia privada revisada; cada comando requiere la autorización de su etapa.
Comprobaciones de metadata ya determinadas para una ventana futura:

```powershell
gcloud sql instances describe nomina-docente-web --project=nomina-docente-prod --format="json(name,region,state,databaseVersion)"
gcloud storage buckets describe gs://nomina-docente-prod-constancias --format=json
gcloud storage buckets get-iam-policy gs://nomina-docente-prod-constancias --format=json
gcloud run services describe nomina-api --region=us-central1 --project=nomina-docente-prod --format="value(status.latestReadyRevisionName,status.traffic)"
```

No ejecutar exports de variables/secretos completos para publicar evidencia.
Para bucket adicional usar nombre aprobado y metadata efectiva antes de cualquier
objeto. Especificación JSON del rol personalizado propuesto API, para revisión
antes de `gcloud iam roles create` (ID de rol pendiente, ningún rol creado):

```json
{
  "title": "H24 document runtime without restore",
  "description": "Bucket metadata and generation-bound object operations only",
  "stage": "GA",
  "includedPermissions": [
    "storage.buckets.get",
    "storage.objects.get",
    "storage.objects.create",
    "storage.objects.delete"
  ]
}
```

El rol worker omite objects.create. Ambos se asignan **a buckets designados**,
no al proyecto entero. Revisar compatibilidad con las llamadas reales antes de
retirar el rol amplio, y denegar release si restore queda por herencia.

Plantilla de servicio privado (variables sin resolver; no copiar/ejecutar como
si los nombres/digests ya existieran). Ejemplo de inspector, scanner usa su
identidad y digest, 2 CPU/4 GiB/240 s:

```powershell
if (-not $InspectorName -or -not $InspectorImageDigest -or -not $InspectorServiceAccount) { throw 'Falta inventario aprobado' }
if ($InspectorImageDigest -notmatch '@sha256:[a-f0-9]{64}$') { throw 'Falta imagen inmutable revisada' }
gcloud run deploy $InspectorName --project=nomina-docente-prod --region=us-central1 --image=$InspectorImageDigest --service-account=$InspectorServiceAccount --no-allow-unauthenticated --cpu=1 --memory=512Mi --concurrency=2 --min-instances=1 --max-instances=1 --timeout=45s
```

Después de cualquier provisión autorizada, comprobar política efectiva y ausencia
de bypass de Invoker; `--no-allow-unauthenticated` no acredita por sí solo todos
los permisos heredados. Las URL reales se obtienen tras crear los servicios,
no se inventan ahora. Bindings Invoker solo para cuentas aprobadas.
No se prepara comando de apply ni de tráfico live en esta tarea.

## 9. Costos, duración y límites propuestos

Solicitar ventana de infraestructura de **hasta 2 h / US$10 estimados**, todavía
no autorizada; no reutilizar el presupuesto de la ventana aislada cerrada.
Antes de comenzar, aprobar costos recurrentes y confirmar tarifas/calculadora.
Como referencia pública us-central1 sin descuentos/free tier: servicios por
solicitud CPU USD 0.000024/vCPU-s y RAM USD 0.0000025/GiB-s; jobs CPU
0.000018/vCPU-s y RAM 0.000002/GiB-s. Consultadas el 2026-11-09.

Dos analizadores (3 CPU/4.5 GiB en conjunto) activos las 2 h: aproximadamente
USD 0.60 de cómputo; worker 1 CPU/1 GiB activo 2 h: USD 0.14. No incluye API,
builds, Artifact Registry, GCS, soft-deleted bytes, operaciones, tráfico, logs,
Monitoring, Scheduler, impuestos ni respaldo/Cloud SQL. US$10 es una propuesta
de control, no garantía ni corte automático de facturación.

Para régimen mensual, ejemplo no pronóstico: mantener ambos analizadores con
min 1 las 24 h cuesta cerca de USD 48.60/30 días solo por CPU/RAM en reposo
(3 CPU +4.5 GiB a USD 0.0000025/s); se agrega tiempo activo. 84 jobs/día a
60 s cada uno, 1 CPU/1 GiB, unos USD 3.02/30 días. Si se elige min 0 disminuye
reposo pero debe aprobarse la prueba de arranque frío. Medir volumen real y
latencia antes de aceptar ese régimen; el almacenamiento de constancias borradas
continúa facturable hasta expirar. Alertas presupuestarias no detienen recursos.
Detener nuevas operaciones antes de exceder duración/gasto autorizado; no
eliminar objetos/documentos para reducir costo ni apagar limpieza pendiente.

## 10. Rollback y cierre de la ventana

Antes de cambios, conservar configuración e IAM con etag, manifiesto de recursos
nuevos y referencias exactas de rollback sin secretos. Si falla privacidad,
revocación, integridad, análisis o limpieza, impedir nuevas operaciones H24 y
no habilitar tráfico. No asumir un flag global que el código no implementa:
seleccionar la revisión segura y procedimiento operativo aprobado.

Para release futuro: volver al tráfico de `nomina-api-00057-c7d` y Hosting
`3f9ebc88c835a143` **reconfirmados**. El rollback no revierte 016/017, no borra
intenciones ni restaura toda Cloud SQL. Mantener worker compatible y alertas
para completar limpieza ya comprometida; no retirar su identidad/bucket mientras
haya pendientes. Los documentos adicionales eliminados no son recuperables por
diseño; constancias solo por restaurador humano dentro de siete días, fuera de
Nómina. No reintroducir un objeto antiguo como vigente automáticamente.

Revertir únicamente cambios IAM propios, revisados y con aprobación si reponen
un permiso amplio; no sobrescribir modificaciones concurrentes ni relajar
soft delete/privacidad. Recursos vacíos nuevos se retiran solo con confirmación
de no dependencias/objetos. Informe final separará creados, conservados,
retirados, costos, incidentes y pendientes. Un recurso saludable no prueba
capacidad ni entrega de alertas.

**Próxima autorización solicitada:** aprobar inventario y ventana exclusivamente
de infraestructura según pasos 1–5, responsables, destinatario, límites y
pruebas sintéticas; confirmar alcance de cambios IAM en la API actualmente
servida. Migraciones 016/017, nueva copia preventiva, ejecución del reconciliador
productivo y publicación API/Hosting requieren autorización posterior separada.
H05 está favorable; **H24 sigue sin GO de release**.

## Referencias técnicas

Código candidato revisado: `constancia-storage.ts`, `dossier-storage.ts`,
`dossier-runtime.ts`, `document-cloud.ts`, `dossier-worker.ts`,
`dossier-reconcile.ts`, `apps/api/Dockerfile` y `services/document-security/README.md`.
No se modificaron esos archivos. Documentación oficial consultada sin acceso
a recursos del proyecto:

- [Permisos IAM de GCS](https://docs.cloud.google.com/storage/docs/access-control/iam-permissions): metadatos, objetos y restauración son permisos distintos.
- [Scheduler para Cloud Run Jobs](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule): disparo autenticado OAuth sobre jobs:run.
- [Precios Cloud Run](https://cloud.google.com/run/pricing): referencia pública de cómputo, no cotización del entorno.
