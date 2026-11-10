# H24 - Continuacion autorizada: migraciones y worker desarmado

Fecha: 2026-11-10. Resultado: **preparacion ejecutada; H24 no habilitado**.

## 1. Autorizacion, fuente y ventana

El alcance de respaldo preventivo, H05, apply condicionado 016/017, usuario SQL,
secreto, worker desarmado y Scheduler pausado ya estaba autorizado. El usuario
concedio expresamente una sola nueva ventana continua, conservando USD10 como
objetivo acumulado de la intervencion original y esta continuacion. No se
reinicio automaticamente el plazo vencido registrado en 3e17428.

- Rama: feature/h02-h03-user-coordinations-permissions; inicio limpio y
  sincronizado, HEAD 3e1742897d1aaa4badee6f664a7a8469cc3ba99d.
- Fuente funcional: **57c565a6a6ed3b4c2dca21292289893b94fc6a5d**.
- Proyecto nomina-docente-prod, instancia nomina-docente-web, us-central1,
  base nomina_docente. RUNNABLE/PostgreSQL 18.6 comprobados.
- SQL conserva horario 06:50-22:00 America/Cancun; ambos Scheduler de
  encendido/apagado ENABLED y sin cambios. Limite adicional de cierre 21:55.

| Hito | UTC | America/Cancun, 10 de noviembre |
|---|---|---|
| Inicio, antes de primera consulta productiva | 2026-11-10T18:35:55.229Z | 13:35:55 |
| Vencimiento autorizado, sin renovacion | 2026-11-10T20:35:55.229Z | 15:35:55 |
| Cierre efectivo de operaciones productivas | 2026-11-10T18:47:31.738Z | 13:47:31 |

Duracion: **11 min 36.509 s**. Documentacion y Git posteriores son locales,
sin prolongar esta ventana productiva. No hubo bloqueo de acceso ni reintento
ciego de mutaciones. Se respeto el margen antes del apply y el cierre de SQL.

## 2. Respaldo y restaurabilidad

Se reconfirmo **1794261106620 SUCCESSFUL**, finalizado
2026-11-09T21:53:18.048Z. Tenia mas de 20 horas; no habia respaldo exitoso
reciente en el inventario. Se creo **uno solo nuevo por frescura antes del DDL**,
no por el antiguo bloqueo de acceso. Se conservo el anterior.

| Evidencia | Valor |
|---|---|
| Nuevo backup | **1794335839733**, ON_DEMAND/SNAPSHOT, SUCCESSFUL |
| Operacion unica seguida hasta finalizar | 6655284a-c1a4-4443-8adb-678e00000032 |
| Inicio | 2026-11-10T18:37:19.740Z |
| Finalizacion | 2026-11-10T18:38:51.261Z |
| Confirmacion antes de abrir fase H05 | 2026-11-10T18:39:02.688Z |

Metadata de recuperacion disponible: backups automaticos, retencion de siete
por conteo, PITR habilitado y logs de siete dias en CLOUD_STORAGE. SUCCESSFUL
acredita finalizacion del respaldo, **no una restauracion ensayada**. Restaurar
o clonar este respaldo no se ejecuto y sigue pendiente de ventana propia si
se requiere esa evidencia; no se inventa un RTO/RPO medido.

## 3. H05 inmediato, apply y comprobacion posterior

Se extrajeron desde Git y cotejaron byte a byte los 20 SQL, tools/migrate-db.ts
y package.json originales de 57c565a: 22 archivos, sin editar migraciones,
conversion de finales de linea ni regeneracion de checksums. npm 10.9.4.

| Archivo | SHA-256 original verificado |
|---|---|
| 016_h24_teacher_dossier.sql | 419cc93af11b82d72116587f53510725b440f1be8547ecb420bb4fcddd03d685 |
| 017_h24_teacher_fiscal_identity.sql | fdc71a922adf4c60b310b6d3efab7b9e11a2695c6b65d1c4966d7be46134e59d |
| tools/migrate-db.ts | 68b74e9dcd16c56f37cf1ffe3a4bb2d811ca9d7672681fbdb05cbea30d29b29e |

Conexion por Cloud SQL Auth Proxy propio en loopback, credencial existente
app_nomina usada solo en memoria. Inspect con read-only desde inicio; identidad
nomina_docente / app_nomina / app_nomina y transaction_read_only=on verificadas.
Timeouts acotados. Apply en proceso separado y explicitamente autorizado.

| Criterio | Esperado antes | Observado antes | Esperado despues | Observado despues |
|---|---:|---:|---:|---:|
| Ambas tablas H05 presentes | Si | Si | Si | Si |
| Archivos originales | 20 | 20 | 20 | 20 |
| Registradas | 18 | 18 | 20 | **20** |
| Baseline historico | 15 | 15 | 15 | 15 |
| Applied | 3 | 3 | 5 | 5 |
| Pendientes | 2: solo 016/017 | 2: solo 016/017 | 0 | **0** |
| Checksum mismatch | 0 | 0 | 0 | **0** |
| Codigo de salida inspect | 0 | 0 | 0 | 0 |

Comandos oficiales: `npm run db:migrate:inspect`,
`npm run db:migrate:apply`, `npm run db:migrate:inspect`; los tres terminaron
con **salida 0**. No dry-run, baseline, seeds ni SQL correctivo. La sugerencia
generica de dry-run impresa por inspect no se ejecuto.

El runner registro 18 skipped historicos y dos success:

| Identificador | Inicio UTC en ledger | Fin UTC en ledger | execution_ms |
|---|---|---|---:|
| 016_h24_teacher_dossier | 2026-11-10T18:39:29.791Z | 2026-11-10T18:39:30.031Z | 398 |
| 017_h24_teacher_fiscal_identity | 2026-11-10T18:39:30.272Z | 2026-11-10T18:39:30.285Z | 175 |

execution_ms es el valor del runner; no se reemplaza por la diferencia entre
timestamps del ledger. Inspect final completado a 18:39:31.946Z.
Catalogos confirman las dos tablas dossier propiedad de app_nomina y columnas
teachers.curp / teachers.fiscal_postal_code text NOT NULL con default vacio.
No se consultaron expedientes ni se reescribieron datos de Nomina o snapshots.

Advertencias historicas revisadas por identificador completo, todas baseline:

- 007_direction_hr_roles.sql y 007_incidence_period_locking.sql.
- 008_direction_live_payroll.sql y 008_payroll_status_workflow.sql.
- 009_access_windows.sql y 009_payroll_correction_flow.sql.

Los prefijos repetidos no se confundieron con migraciones nuevas ni se
renombraron. H05 productivo actual es 20/0/0; no es un resultado de la BD test.

## 4. Usuario SQL, secreto y privilegios efectivos

Creado **h24_dossier_worker** en transaccion unica de provision SQL: LOGIN,
NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOREPLICATION, NOBYPASSRLS.
Sin membresias ni objetos propios; no se delego cloudsqlsuperuser.

Se aplicaron exclusivamente los diez GRANT del runbook:

| Recurso | Privilegio |
|---|---|
| nomina_docente / public | CONNECT / USAGE, sin CREATE |
| teacher_dossier_operations | SELECT, UPDATE |
| teacher_dossier_documents | SELECT, UPDATE, DELETE |
| teacher_documents | SELECT y UPDATE solo document_type |
| app_users | SELECT solo id, status, is_protected_super_admin, role_id |
| roles / permissions | SELECT solo id, code |
| role_permissions | SELECT solo role_id, permission_id |
| audit_log | INSERT solo actor_user_id, action, entity_type, entity_id, metadata |

Se comprobaron 245 permisos de tabla, 1952 de columna y una secuencia; sin
privilegios/grant options fuera del conjunto aprobado, sin permiso sobre
teachers, tablas de Nomina, snapshots o campos fiscales. Secuencias sin grants.
PUBLIC no otorgaba acceso a tablas/columnas/secuencias ni funciones propias
SECURITY DEFINER accesibles. TEMPORARY heredado de PUBLIC sobre la base existe
y se documenta; no se alteraron permisos PUBLIC compartidos para eliminarlo.

Credencial generada en memoria; almacenamiento SCRAM-SHA-256. Se revisaron
opciones de logging antes de provisionar, sin cambiar configuracion PostgreSQL.
No se guardo contraseña/verificador en evidencia ni argumentos visibles.
Autenticacion real del usuario dedicado en sesion read-only: PASS.

Secreto **h24-dossier-worker-db-password, version numerica 1**. La version
almacenada se recupero solo en memoria y se probo nuevamente contra PostgreSQL:
identidad y read-only correctos. SecretAccessor agregado a la SA worker solo
sobre ese secreto. Esto no elimina permisos heredados preexistentes de otras
identidades; no se afirma exclusividad absoluta ni se cambio la credencial API.

## 5. Recursos preparados, sin ejecucion

| Recurso | Estado observado al cierre |
|---|---|
| Worker | nomina-h24-dossier-reconcile, Ready=True |
| SA worker | nomina-h24-recovery@nomina-docente-prod.iam.gserviceaccount.com |
| Imagen aprobada existente | us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api@sha256:f1aafc5cbc0d4f8a658c1bede3abb9af656ef3a48b3e1b584ab632f052958303 |
| Comando | node apps/api/dist/dossier-reconcile.js |
| Recursos / limites | 1 CPU, 1 GiB, una task, parallelism=1, retries=0, timeout=240s |
| Armado | **ALLOW_DOSSIER_RECONCILE=false** |
| Credencial | DB_USER=h24_dossier_worker; DB_PASSWORD referencia version 1 |
| Conexion | Cloud SQL connector a nomina-docente-web; no app_nomina en worker |
| Scheduler | nomina-h24-dossier-reconcile-10m, **PAUSED** |
| Cron / zona | */10 7-20 * * *, America/Cancun |
| SA Scheduler | nomina-h24-scheduler@nomina-docente-prod.iam.gserviceaccount.com |
| Invocacion | POST Run jobs:run, OAuth; run.invoker solo sobre el job, sin overrides |
| Reintentos Scheduler | 0, duracion 0s, deadline 60s |
| Ejecuciones del worker | **0**, verificado tras pausa y al cierre |

Se creo el job desarmado antes del Scheduler. Scheduler creado 18:46:22Z y
pausado 18:46:24Z, antes del siguiente disparo; no execute-now. La imagen ya
existia: no hubo build ni publicacion de imagen en esta ventana. Las guardas
horarias/concurrencia son las de la candidata aprobada; no se ejecutaron aqui
para generar un falso exito de limpieza. No Inspector ni ClamAV reintroducidos.

## 6. Continuidad y limites preservados

- API **nomina-api-00057-c7d**, 100% de trafico, sin cambios. SHA-256 de spec
  antes/despues: c08c65c38974e5da3de87a159aa4d2a19f4b711b01d88bbca2e50b4a1ddc8e82.
- Hosting release **1793121624438000**, version **3f9ebc88c835a143**, sin cambios.
- GET /api/health directo y via Hosting: **200/200**; /api/auth/session sin
  token: **401/401**. No smoke autenticado ni operaciones sobre expedientes.
- Metadata e IAM de ambos buckets identicos antes/despues. Constancias:
  privado UBLA/PAP, borrado recuperable 604800 segundos, versionado ausente.
  Adicionales: bucket separado privado, soft delete 0, versionado false.
- IAM del proyecto sin cambios; permisos existentes API conservados.
  Unicos bindings nuevos: secreto para worker e invoker de Scheduler en job.
- Alertas 11811020579760829856 y 3484231198314869307 siguen disabled.
  Canal 12474838942187959572 devuelve verificationStatus UNSPECIFIED: no
  acredita verificacion ni entrega; no se repitio formulario ni envio de codigo.
- Conexiones propias cerradas; proxy detenido; puerto local 25441 sin listener.
- No release API/Hosting, cambio de trafico, limpieza real, habilitacion de
  alertas/H24, reset de contraseñas existentes ni delegacion de privilegios DBA.
- Si hubo cambios productivos autorizados: backup nuevo, esquema 016/017,
  ledger H05, rol/grants dedicados, secreto/version y job/Scheduler preparados.
  No se presenta esta ventana como read-only ni como ausencia de migraciones.
- Sin cambios H01, calculos, datos de Nomina ni snapshots por estas operaciones.
  No se tomaron fingerprints de datos reales; la afirmacion de alcance se basa
  en las operaciones ejecutadas, no en una comparacion integral de contenidos.

## 7. Presupuesto acumulado y costos posteriores

Objetivo unico **USD10**. Sin cargos liquidados/export de facturacion disponible
en la evidencia consultada; no se declara gasto real ni remanente exacto.
Estimacion conservadora de planificacion: ventana original <USD1 mas esta
continuacion <USD2, **acumulado estimado <USD3**, no USD10 adicionales.

Supuestos: instancia existente sin ampliar uptime, sin nuevas instancias,
builds, imagenes, analizadores ni ejecuciones de worker. Un nuevo backup y
metadata limitada; disco observado de 20 GiB usado solo como proxy conservador
de calculo, no tamaño facturado medido del snapshot. No se observo una operacion
que hiciera prever superar USD10; no se exigio factura definitiva para avanzar.

Referencias publicas consultadas el 10 de noviembre:
[Cloud SQL](https://cloud.google.com/sql/pricing),
[Secret Manager](https://cloud.google.com/secret-manager/pricing) y
[Scheduler](https://cloud.google.com/scheduler/pricing).
Como orden de magnitud, 20 GiB de backup a USD0.000109589/GiB-h durante dos horas
son ~USD0.0044; no es el costo medido del backup. Se conserva margen amplio
en la estimacion anterior para la intervencion original y esta continuacion.

Costos recurrentes posteriores, separados del tiempo de intervencion:
una version activa Secret Manager ~USD0.06/mes, un Scheduler incluso pausado
~USD0.10/31 dias, almacenamiento de backups segun tamaño/retencion (20 GiB
hipoteticos ~USD1.58/30 dias por copia), accesos y logs segun consumo. No se
asumen cuotas gratuitas ni se elimina un respaldo para reducir esa estimacion.
La instancia productiva y recursos ya existentes mantienen sus costos habituales.

## 8. Evidencia, pendientes y siguiente ventana

Evidencia tecnica local, no publicada con secretos ni datos de expedientes:
%LOCALAPPDATA%/NominaDocente/H24-Continuation-20261110. Incluye window.json,
source-hashes.json, backup-selected.json, h05-before/apply/after.json,
migration-run-records.json, worker-effective-grants.json, worker-secret-auth.json,
worker-cloud-complete.json, continuity-final.json y window-closed.json.
No contraseñas, tokens, verificadores SCRAM ni cadenas de conexion en esta acta.

Pendientes concretos para otra autorizacion, **no ejecutados**:

1. Completar verificacion del canal de alertas mediante interfaz oficial y
   demostrar entrega operativa; habilitar alertas solo en ventana aprobada.
2. Resolver el permiso amplio preexistente de API en constancias, incluido
   restore, con una autorizacion especifica y prueba de minimo privilegio;
   en esta ventana se prohibio retirarlo.
3. Smoke sintetico productivo supervisado de worker/almacenamiento, alertas,
   reintentos, horario y solapamiento antes de armar worker o reanudar Scheduler.
4. Autorizar por separado release API/Hosting y habilitacion de H24; actualizar
   prechecks, frescura del backup y evaluacion de riesgos al llegar esa ventana.
5. Restauracion del nuevo backup no ensayada, si se exige como criterio de release.

016/017, usuario, secreto y creacion de job/Scheduler **ya no son pendientes**.
No repetir create/apply a partir de runbooks historicos. H24 permanece sin
habilitar; esta acta acredita preparacion, no cierre operativo ni deploy aprobado.

Validacion documental: git diff --check, revision de nombres/diff y estado Git.
No se repitieron tests/build: la fuente funcional no cambio; las comprobaciones
de esta ventana fueron H05, catalogos/privilegios, autenticacion, metadata y health.
