# H24 - Respaldo preventivo y detencion por acceso DBA

Fecha: 2026-11-09. **Resultado parcial: backup SUCCESSFUL; H05 y pasos dependientes
NO ejecutados. H24 permanece NO-GO y sin habilitarse.**

Actualizacion posterior, 2026-11-10: el
[diagnostico autorizado de solo lectura](H24_Diagnostico_Permisos_PostgreSQL_H05_20261110.md)
comprobo acceso con la credencial existente de app_nomina y permisos efectivos;
H05 inspect de 57c565a termino con salida 0: 20 archivos, 18 registradas, solo
016/017 pendientes y 0 mismatch. El bloqueo de acceso queda resuelto para esa ruta, sin restablecer
contrasenas. Esta acta conserva los hechos del 9 de noviembre: no hubo apply ni
usuario worker entonces ni en el diagnostico posterior. La ejecucion de 016/017
requiere una nueva autorizacion; no se repitio el respaldo.

- Candidata funcional: `57c565a6a6ed3b4c2dca21292289893b94fc6a5d`.
- Acta previa / HEAD inicial limpio: `6e91986c4350448b4ebd0c25d2f04bb84d11f998`.
- Rama: feature/h02-h03-user-coordinations-permissions.
- Proyecto/instancia/base/region: nomina-docente-prod / nomina-docente-web /
  nomina_docente / us-central1. La base es el destino autorizado, no una conexion
  SQL establecida en esta ventana.

## 1. Autorizacion y bloqueo

Se autorizaron respaldo, inspect read-only, aplicacion condicionada de016/017,
usuario SQL dedicado, secreto y recursos worker/Scheduler desarmados. Sin deploy
API/Hosting, trafico, merge, H24 habilitado ni analizadores.

El usuario confirmo que **no dispone de la contrasena PostgreSQL administrativa**.
No hay perfil DBA activo en el entorno. El login de Google Cloud no acredita
autenticacion PostgreSQL. No se restablecio postgres, no se extrajo el secreto
de app_nomina, no se creo un inspector ni se uso una cuenta alternativa.
No se solicito contrasena por chat ni se abrio conexion/proxy SQL.

Por ello se completaron solo las etapas independientes: respaldo y metadata.
Inspect no se lanzo y no tiene codigo de salida. No se interpreta el cierre
H05 historico para3284a12 como un inspect actual de57c565a.

## 2. Destino, horario y fuente

Identidad cloud activa victor.yama@tecplayacar.edu.mx; proyecto ACTIVE.
Cloud SQL RUNNABLE/us-central1/POSTGRES_18, disco configurado20GiB.
Scheduler existente: encendido50 6 * * *, apagado0 22 * * *, America/Cancun;
ambos ENABLED. Horario06:50-22:00 intacto. A16:51 quedaban mas de5h antes del
apagado y casi2h de ventana; no se cambio el horario.

Los20 SQL raiz, tools/migrate-db.ts y package.json fueron extraidos de57c565a
con `git -c core.autocrlf=false archive` y comparados byte a byte contra sus blobs.
Todos coinciden. El primer archive sin esa opcion convirtio LF a CRLF por la
configuracion Git del puesto: se detecto antes de cualquier conexion, se conservo
como evidencia descartada y se extrajo otra copia exacta. No se modifico ningun
SQL ni checksum ni se ejecuto el runner sobre la copia convertida.

| Archivo original | SHA-256 |
|---|---|
| 016_h24_teacher_dossier.sql | 419cc93af11b82d72116587f53510725b440f1be8547ecb420bb4fcddd03d685 |
| 017_h24_teacher_fiscal_identity.sql | fdc71a922adf4c60b310b6d3efab7b9e11a2695c6b65d1c4966d7be46134e59d |

Compatibilidad revisada:016 crea tablas/indices documentales;017 agrega dos
columnas de texto con default vacio y constraints que admiten ese valor. Sin
backfill, DROP, cambio de H01 ni reescritura de snapshots.017 requiere bloqueo DDL
y validacion de constraints: esto no demuestra ausencia de contencion productiva.
El [ensayo previo PD-08 con imagen exacta](H24_Ventana_Aislada_PreDeploy_20261105.md)
probo el digest a7d0de...9196b de API vigente sobre esquema sintetico016/017:
health, teachers y export/active200 en read-only. Evidencia historica acotada,
no regresion productiva ni cobertura total repetida en esta ventana.

El runner oficial omite los18 SQL ya registrados y registra sus eventos skipped;
016/017 son las unicas aplicables solo si inspect confirma el estado esperado.
DDL y ledger se confirman en pasos separados del runner: ante resultado incierto
se requiere inspeccionar esquema/ledger, no repetir ni corregir automaticamente.

## 3. Respaldo unico

| Campo | Resultado |
|---|---|
| Backup ID | 1794261106620 |
| Operacion | 7a1ebe81-b990-47b0-b0df-673900000032 |
| Tipo / estado final | ON_DEMAND / SUCCESSFUL; operacion DONE sin error |
| Encolado / inicio backup UTC | 2026-11-09T21:51:46.620Z / 21:51:46.627Z |
| Inicio operacion UTC | 2026-11-09T21:51:46.720Z |
| Fin UTC | 2026-11-09T21:53:18.048Z |
| Duracion backup | 91.421 segundos |
| Ubicacion | us |
| Descripcion | H24 pre-016-017 candidate 57c565a window 20261109T215059Z |

Una sola solicitud con --async. Se siguio la operacion original y se localizo
el backup por su descripcion antes de consultarlo por ID; no se duplico.
Backup anterior1793913186499 tambien observado SUCCESSFUL, conservado.

Restaurabilidad disponible por metadata: backups automaticos habilitados,
retencion7 backups; PITR habilitado, logs7dias, almacenamiento CLOUD_STORAGE.
SUCCESSFUL confirma respaldo finalizado, **no restauracion ensayada**.
No se clono/restauro la instancia, no se descargaron datos. La restauracion de
este backup sigue pendiente; ensayos sinteticos previos no la sustituyen.

## 4. Dictamen H05 antes y despues

| Requisito | Esperado antes | Observado en esta ventana | Resultado |
|---|---|---|---|
| Archivos | 20 originales de57c565a | 20, coincidencia byte a byte local | PASS local |
| public.schema_migrations | Presente | Sin consulta PostgreSQL | Pendiente |
| public.schema_migration_runs | Presente | Sin consulta PostgreSQL | Pendiente |
| Registradas | 18 hasta015_h23_cycle_base_hours_dates | Sin lectura de ledger | Pendiente |
| Pendientes | Solo016_h24_teacher_dossier y017_h24_teacher_fiscal_identity | Estado productivo no reconfirmado | Pendiente |
| Checksums vs ledger | 0 discrepancias | No comparados con produccion | Pendiente |
| Exit inspect | 0 y detalle conforme | No ejecutado; sin codigo | Bloqueado por credencial DBA |
| Apply | Solo016/017 tras cumplir guardas | No ejecutado | 0 migraciones aplicadas por esta intervencion |
| H05 posterior | 20 registradas,0 pendientes,0 mismatch | No ejecutado | No declarar ese resultado |

Prefijos historicos locales revisados por identificador completo:
007_direction_hr_roles /007_incidence_period_locking;
008_direction_live_payroll /008_payroll_status_workflow;
009_access_windows /009_payroll_correction_flow. No son nuevas advertencias del
inspector: no hubo salida productiva. No renombrar ni reaplicar estos archivos.
No dry-run, baseline, seeds, SQL correctivo ni correccion de ledger.

## 5. Usuario, secreto y recursos dependientes

| Elemento | Estado al cerrar |
|---|---|
| h24_dossier_worker SQL | No creado; permisos efectivos y autenticacion no comprobados |
| h24-dossier-worker-db-password | No creado; sin version numerica ni contraseña generada |
| Secret Accessor dedicado | No concedido en esta ventana |
| nomina-h24-dossier-reconcile | NO CREADO; cero Run Jobs en el inventario |
| nomina-h24-dossier-reconcile-10m | NO CREADO; solo Scheduler de encendido/apagado existentes |
| Invoker Scheduler | No concedido en esta ventana |

No describir un recurso inexistente como PAUSED o como worker desarmado desplegado.
La configuracion sigue preparada en ops/h24: ALLOW_DOSSIER_RECONCILE=false,
tarea1/parallelism1/retry0/timeout240, guarda07:00-21:50 Cancun, presupuesto230s,
corte21:55 y exclusividad PostgreSQL. Ningun job ejecutado ni limpieza real.

Imagen inmutable reconfirmada en Artifact Registry, sin publicar otra imagen:
`us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api@sha256:f1aafc5cbc0d4f8a658c1bede3abb9af656ef3a48b3e1b584ab632f052958303`.

## 6. Canal y continuidad

Canal12474838942187959572 habilitado, destinatario autorizado conservado.
La captura local del codigo no completo la verificacion; el reintento del
formulario fue bloqueado por politica del entorno antes de lanzar el proceso.
No se eludio el bloqueo ni se envio el codigo mediante otro mecanismo.
No se versionan codigos, tokens ni credenciales. GET final no incluye
verificationStatus; no hay evidencia VERIFIED ni de alerta real recibida.
La [semantica oficial del campo](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.notificationChannels)
no permite inferir UNVERIFIED/no funcional solo por su ausencia. Sigue pendiente
acreditar la verificacion solicitada y probar entrega/recuperacion operacional.
Politicas11811020579760829856 y3484231198314869307 siguen enabled=false.

Constancias:604800 segundos, versioning ausente, UBLA/PAP privados.
Adicionales:0 segundos, versioning=false, UBLA/PAP privados. Sin cambios de
politicas, IAM, objetos ni consultas a expedientes. objectAdmin/restore de API
permanece como pendiente de otra autorizacion, sin retirarlo.

API sigue nomina-api-00057-c7d,100% trafico; spec antes/despues identica.
Hosting sigue release1793121624438000/version3f9ebc88c835a143.
No deploy, cambios de secretos runtime, merge ni habilitacion H24.

## 7. Duracion, costos y limpieza

Inicio conservador21:50:59 UTC /16:50:59 Cancun; ultima comprobacion cloud y
cierre operativo21:58:27 UTC /16:58:27 Cancun,7min28s. Limite23:50:59 UTC,
no consumido. La documentacion posterior no abre otra ventana productiva.

ObjetivoUSD10; sin factura consultada ni corte automatico. Supuesto ilustrativo:
20GiB (disco configurado, NO tamano facturado del respaldo) x2h x
USD0.000109589/GiB-h = USD0.0044 de almacenamiento del backup en dos horas;
a720h seria USD1.58. [Tarifa de referencia](https://cloud.google.com/sql/pricing).
No implica que todo ese disco sea respaldo usado. Estimacion incremental de
intervencion menor aUSD1, con margen para metadata; no se extiende uptime,
no hay nuevos jobs, secretos, builds o analizadores. Retencion posterior,
instancia habitual y costos previamente provisionados son separados.

No sesiones PostgreSQL ni proxies abiertos. Procesos del formulario terminados;
no listener15432 al verificar cierre. No se genero/capturo contraseña DBA/worker,
no hay variables DB/PG configuradas por esta tarea ni archivos de credenciales.
Las respuestas cloud saneadas y copias originales de fuente quedan fuera de
Git en %LOCALAPPDATA%/NominaDocente/H24-DB-20261109. No contienen secreto de BD.

Validaciones documentales: git diff --check, diff de nombres, estado Git y
parsing de bloques PowerShell del runbook. Sin codigo funcional/SQL modificado;
no se repiten tests/build de la candidata para un cierre documental bloqueado.

## 8. Entrega al DBA y siguiente paso

1. Obtener acceso DBA existente por el canal institucional. Si no existe una
   credencial disponible, definir y autorizar por separado su recuperacion o
   restablecimiento controlado; no cambiar la clave de la aplicacion por comodidad.
2. Reabrir/confirmar ventana y vigencia del backup1794261106620 sin duplicarlo por
   incertidumbre; revisar restaurabilidad y margen antes de iniciar SQL.
3. Inspect oficial de57c565a en sesion read-only, comparar todos los criterios;
   solo despues pasar a sesion de escritura separada y runner oficial016/017.
4. H05 final conforme antes de usuario dedicado/secret version/worker desarmado
   y Scheduler PAUSED. No suplir la autenticacion con IAM Cloud SQL Client.
5. Completar canal por interfaz segura cuando el entorno lo permita, sin
   compartir codigos; mantener alertas disabled hasta smoke autorizado separado.

Esta acta no certifica migracion ni crea permisos nuevos. H24 conserva NO-GO.
No H01, Nomina, snapshots ni datos fiscales modificados por esta intervencion.
