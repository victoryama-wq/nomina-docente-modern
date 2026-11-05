# H24: respaldo productivo e inspección H05 pendiente

**Dictamen del 2026-11-05: respaldo SUCCESSFUL; inspección productiva no ejecutada.
No hay dictamen favorable de H05 ni autorización para aplicar 016/017.**
Candidata `3284a12af189baeaff51335401d13e9923d9d51d`; [precheck previo](H24_Precheck_Productivo_Solo_Lectura_20261105.md) en `f5cc479`.

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

## Inspección H05

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
