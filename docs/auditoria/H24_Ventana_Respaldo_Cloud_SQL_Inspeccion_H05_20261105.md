# H24: respaldo productivo y cierre de inspección H05

**Dictamen actualizado del 2026-11-09: H05 favorable para el estado inspeccionado,
según evidencia aportada por el usuario desde Cloud Shell. No constituye
autorización de release ni de aplicación de 016/017.**
Candidata `3284a12af189baeaff51335401d13e9923d9d51d`; [precheck previo](H24_Precheck_Productivo_Solo_Lectura_20261105.md) en `f5cc479`.

Las secciones del 5 de noviembre se conservan como antecedentes: sus bloqueos
y pendientes no representan el dictamen del 9 de noviembre, registrado al final.

## Destino y horario

Antes de solicitar el respaldo se confirmó el proyecto activo `nomina-docente-prod`
(`443985127112`), la instancia `nomina-docente-web`, región `us-central1`,
PostgreSQL 18, estado RUNNABLE y política de encendido ALWAYS. Ambos trabajos
de Scheduler estaban habilitados y apuntaban a esa instancia: encendido diario
06:50 y apagado 22:00, zona America/Cancun. A las 16:12 locales quedaban más
de cinco horas antes del apagado; los cinco respaldos previos duraron menos
de dos minutos cada uno. No se alteró el horario ni el estado de la instancia.

## Respaldo único bajo demanda

| Concepto | Evidencia Cloud SQL |
|---|---|
| ID / tipo / estado | `1793913186499` / ON_DEMAND / SUCCESSFUL |
| Operación original | `029f02a0-c511-4c8f-8e16-640700000032`, consultada hasta DONE |
| Encolado (UTC) | `2026-11-05T21:13:06.499Z` |
| Inicio / fin (UTC) | `2026-11-05T21:13:06.514Z` / `2026-11-05T21:15:08.276Z` |
| Duración / ubicación del respaldo | 121.762 s / `us` |
| Descripción | `H24 pre-H05 016-017 candidate 3284a12 2026-11-05` |

Se envió una única solicitud. El seguimiento consultó el ID de la operación y
el del respaldo, sin repetir la creación. El respaldo cubre la instancia;
la base designada para la inspección es `nomina_docente`.

**Restaurabilidad:** Cloud SQL confirmó la finalización del respaldo. La instancia
tiene respaldos automáticos y PITR habilitados. El [ensayo PD-08](H24_PD08_Ensayo_Local_Migraciones_016_017.md)
acreditó restauración de dumps locales sintéticos, no la de este respaldo.
**Restauración de 1793913186499 no probada**; no se restauró ni clonó la instancia.

## Inspección H05 del 5 de noviembre (antecedente)

Después de SUCCESSFUL se intentó iniciar la ejecución protegida de
`npm run db:migrate:inspect`. El entorno de ejecución rechazó la creación
del proceso por política, antes de abrir el proxy o conectar con PostgreSQL.
No hubo SQL ni salida del runner. No se intentó un acceso alternativo.

| Criterio | Esperado | Observado | Resultado |
|---|---|---|---|
| Archivos de la candidata | 20 SQL | 20 en disco; cada archivo idéntico byte a byte al blob de 3284a12 | Verificado localmente |
| Tablas de control | `public.schema_migrations` y `public.schema_migration_runs` presentes | Sin lectura productiva | Pendiente |
| Historial | 18 registradas hasta `015_h23_cycle_base_hours_dates` | Sin lectura del ledger | Pendiente |
| Identificadores pendientes | Solo `016_h24_teacher_dossier` y `017_h24_teacher_fiscal_identity` | Ambos archivos existen; su estado en producción no se observó | Pendiente |
| Checksum frente al ledger | 0 discrepancias | No se contrastaron checksums con producción | Pendiente |
| Advertencias | Revisar los prefijos históricos repetidos y cualquier otra advertencia | En archivos: 007 (direction_hr_roles / incidence_period_locking), 008 (direction_live_payroll / payroll_status_workflow) y 009 (access_windows / payroll_correction_flow). Son versiones de nombre completo distintas, no salida del runner | Revisión local; salida H05 pendiente |
| Código de salida | 0 y detalle conforme | No existe código de salida de H05: el proceso no arrancó | No ejecutado |

La ventana termina sin acceso a expedientes ni a datos de nómina. No se
ejecutaron status, dry-run, baseline, apply, correcciones o migraciones. Sin cambios
de IAM o buckets, infraestructura nueva, merge, deploy ni habilitación H24.
Para completar el dictamen falta una ejecución por un canal DBA autorizado de
**solo inspect**, conservando la trazabilidad de este respaldo. No duplicar
el respaldo por el fallo de lanzamiento del comando.

## Reintento autorizado y entrega al DBA

2026-11-05, 16:22 de Cancún (21:22 UTC). Se reconfirmaron por metadata el
destino, estado RUNNABLE, horario 06:50–22:00 y respaldo existente
`1793913186499` SUCCESSFUL. No se solicitó otro respaldo. Los 20 archivos
SQL locales coincidieron byte a byte con `3284a12`; sin diferencias en el
runner ni en la definición del comando.

El único intento de lanzamiento por el mismo canal fue rechazado por la
política del entorno (`CreateProcess: blocked by policy`). No arrancaron
el proxy ni npm; **código de salida H05: no disponible**. No hubo consultas
a PostgreSQL, advertencias emitidas por el runner ni un resultado de checksum.
La tabla anterior sigue vigente. No se intentó otro canal.

**Entrega al DBA:** desde la candidata `3284a12`, dentro del horario indicado
y con el perfil DBA productivo de solo lectura para `nomina_docente`, ejecutar
únicamente `npm run db:migrate:inspect`. Referenciar el respaldo ya creado.
Devolver las dos presencias de tabla, los conteos, el detalle por identificador,
las advertencias y el código de salida; omitir credenciales y datos de conexión.
Contrastar por separado ambas versiones de cada prefijo:

| Prefijo | Identificadores distintos en la candidata |
|---|---|
| 007 | `007_direction_hr_roles`, `007_incidence_period_locking` |
| 008 | `008_direction_live_payroll`, `008_payroll_status_workflow` |
| 009 | `009_access_windows`, `009_payroll_correction_flow` |

No interpretar un código 0 por sí solo como conformidad. Si falta una tabla,
hay un identificador inesperado, una discrepancia de checksum u otra diferencia,
registrarla y terminar sin corregir. No seguir recomendaciones de dry-run del
runner. Hasta contar con salida productiva, el dictamen queda **pendiente del DBA**.

## Cierre favorable del 9 de noviembre de 2026

Comprobaciones de cierre: **14:39:31 UTC / 09:39:31 America/Cancun**.
Fuente: resultado observado en Google Cloud Shell y transcrito por el usuario
en la instrucción de cierre. El agente no repitió la inspección ni consultó
producción para esta actualización documental.

Destino reportado: proyecto `nomina-docente-prod`, instancia `nomina-docente-web`,
región `us-central1`, base `nomina_docente`. Checkout separado de `3284a12`;
los 20 archivos de migración coincidieron byte a byte con la candidata, según
la comprobación aportada. El horario reportado está dentro de 06:50–22:00
America/Cancun; no se realizó aquí una nueva consulta de Scheduler.

Se utilizó el usuario existente `app_nomina`, con contraseña introducida de
forma oculta por el usuario y la sesión configurada con:

```text
PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000'
npx --yes npm@10.9.4 run db:migrate:inspect
```

La comprobación previa confirmó la base esperada y `transaction_read_only=on`.
**Esto no convierte a app_nomina en un usuario intrínsecamente de solo lectura**
ni acredita privilegios mínimos permanentes. No se creó `h05_inspector` como
parte de este cierre. El procedimiento propuesto para ese rol no fue ejecutado.

| Criterio | Esperado | Observado aportado | Resultado |
|---|---|---|---|
| `public.schema_migrations` | Presente | Presente | Conforme |
| `public.schema_migration_runs` | Presente | Presente | Conforme |
| Baseline inicializado | Sí | Sí | Conforme |
| Archivos de la candidata | 20, byte a byte contra 3284a12 | 20, coincidencia reportada | Conforme |
| Migraciones registradas hasta 015 | 18 | 18 | Conforme |
| Baseline / aplicadas | 15 / 3 | 15 / 3 | Conforme |
| Pendientes | 2, solo 016 y 017 | `016_h24_teacher_dossier`, `017_h24_teacher_fiscal_identity` | Conforme |
| Checksum mismatch | 0 | 0 | Conforme |
| Código de salida | 0, con detalle conforme | 0 | Conforme |
| Prefijos 007/008/009 | Identificadores completos distintos | Advertencia histórica conservada; pares detallados arriba | No renombrar ni reaplicar |

Las tres aplicadas son `013_h21_subject_import_search`,
`014_h22_teacher_external_identifier_unique` y `015_h23_cycle_base_hours_dates`.
No se aportó otra advertencia específica; no se atribuye al agente una revisión
independiente de todas las líneas del log. Ruta temporal indicada en Cloud Shell:
`/tmp/nomina-h05-inspect-ItLJ45YC.log`. No se dispone de ese archivo en el equipo
local, no se adjunta ni se declara un hash o verificación independiente.

El usuario informó cierre del proxy temporal y comprobación de que la variable
de contraseña no permanecía definida en la shell principal. No se ejecutaron
dry-run, baseline, apply ni migraciones en esa inspección.

El respaldo `1793913186499`, creado el 5 de noviembre, fue confirmado nuevamente
como **SUCCESSFUL** el 9 de noviembre según la evidencia aportada. Su restauración
continúa **no ensayada**. No se creó otro respaldo para documentar este cierre.

**Dictamen:** H05 favorable para este estado y candidata. Sustituye el pendiente
DBA anterior, pero 016/017 siguen sin aplicar y H24 no queda autorizado para
release. Antes de una futura migración, revisar vigencia/restaurabilidad del
respaldo y obtener el respaldo preventivo que corresponda en una ventana
expresamente autorizada; reconfirmar el estado H05 si hubo cambios.

Siguiente paso propuesto: [plan de infraestructura pendiente de autorización](H24_Plan_Infraestructura_Productiva_20261109.md).
Esta actualización solo modifica documentación; no ejecuta comandos productivos.
