# H11-F5 - Resultado deploy productivo CSV UTF-8

## 1. Resumen

El 2026-06-03 se ejecuto deploy controlado de H11-F1/F2/F3A/F3B despues de la validacion H11-F4.

Objetivo del deploy:

- Publicar estandarizacion CSV UTF-8 con BOM.
- Mantener columnas, filtros, permisos, rutas, nombres de archivo, montos y UX.
- No ejecutar migraciones.
- No modificar base de datos.
- No importar ni sincronizar datos.

Resultado general: **deploy ejecutado correctamente con observacion de smoke CSV autorizado pendiente**.

## 2. Commit desplegado

- Rama: `feature/h02-h03-user-coordinations-permissions`.
- Commit: `4e0c214 docs(h11): add spreadsheet validation results for csv exports`.
- Imagen API: `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h11-prod-4e0c214`.
- Digest API desplegado: `sha256:52be8b0da6bf08c2776248af8a7f1c6737ff5429238c6b00d69dcd1f960dd98c`.

## 3. Precondiciones verificadas

- Rama correcta y sincronizada con `origin`.
- Working tree limpio antes del deploy.
- H11-F0/F1/F2/F3A/F3B/F4 presentes en historial Git.
- No existe `database/013*.sql`.
- H11 no requiere migracion.
- H05 `inspect` produccion se ejecuto en modo read-only:
  - `schema_migrations`: existe.
  - `schema_migration_runs`: existe.
  - Baseline inicializado: si.
  - Migraciones registradas: 15.
  - Pendientes: 0.
  - Checksum mismatch: 0.
  - Advertencias historicas aceptadas: prefijos duplicados 007, 008 y 009.
- No se ejecuto `db:migrate`.
- No se ejecuto `db:migrate:apply`.
- No se ejecuto `db:migrate:baseline`.
- No se ejecuto `db:migrate:dry-run`.

## 4. Validaciones predeploy

Ejecutadas correctamente:

- `npm run test`: OK.
- `npm run test:api`: OK.
- `npm run test:api:integration`: OK, usando `TEST_DB_NAME=nomina_docente_test`.
- `npm run test:web`: OK.
- `npm --workspace apps/api run typecheck`: OK.
- `npm --workspace apps/web run typecheck`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.

## 5. Backup preventivo Cloud SQL

- Instancia: `nomina-docente-web`.
- Base protegida: `nomina_docente`.
- Proyecto: `nomina-docente-prod`.
- Tipo: `ON_DEMAND`.
- ID backup: `1780499832076`.
- Descripcion: `H11-F5 CSV UTF8 predeploy backup 2026-06-03T10:17:10-05:00`.
- Inicio UTC: `2026-06-03T15:17:12.076Z`.
- Fin UTC: `2026-06-03T15:18:02.871Z`.
- Estado: `SUCCESSFUL`.

## 6. Deploy API Cloud Run

- Proyecto: `nomina-docente-prod`.
- Servicio: `nomina-api`.
- Region: `us-central1`.
- Revision anterior: `nomina-api-00045-v8h`.
- Revision nueva: `nomina-api-00046-6ck`.
- Trafico: `100%` a `nomina-api-00046-6ck`.
- Service URL: `https://nomina-api-443985127112.us-central1.run.app`.

Configuracion conservada:

- `DB_NAME=nomina_docente`.
- `DB_USER=app_nomina`.
- `INSTANCE_CONNECTION_NAME=nomina-docente-prod:us-central1:nomina-docente-web`.
- `LEGACY_COORDINATION_FALLBACK_ENABLED=true`.
- `CORS_ORIGINS=https://nomina-docente-prod.web.app,https://nomina-docente-prod.firebaseapp.com,http://localhost:5173`.
- Secret `DB_PASSWORD=db-app-nomina-password:latest`.
- Service account `nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com`.
- Cloud SQL instance asociada.
- CPU `1`.
- Memoria `512Mi`.
- Max instances `2`.
- Concurrency `80`.
- Timeout `300`.

Nota operativa: un primer intento de deploy fue rechazado por sintaxis local de `--set-env-vars`; no creo revision ni cambio trafico. El deploy efectivo se ejecuto con archivo temporal de variables de entorno sin secretos.

## 7. Deploy Firebase Hosting

- Proyecto: `nomina-docente-prod`.
- Sitio: `nomina-docente-prod`.
- Canal: `live`.
- URL: `https://nomina-docente-prod.web.app`.
- Release live: `2026-06-03 10:21:16`.
- Archivos detectados: `48` en `apps/web/dist`.
- Rewrite `/api/**`: permanece apuntando a Cloud Run `nomina-api` en `us-central1`.

## 8. Healthcheck post-deploy

- Cloud Run directo `/api/health`: `200`.
- Hosting `/api/health`: `200`.
- Hosting `/api/auth/session` sin token: `401 Unauthorized`, esperado.
- Hosting raiz `/`: `200`, titulo `Nomina Docente`.
- Logs Cloud Run revision `nomina-api-00046-6ck`: sin errores `ERROR` recientes al momento de la validacion.

## 9. Smoke test CSV backend

Validacion sin token:

| Ruta | Resultado |
|---|---|
| `/api/reports/finance/export/payments` | `401 Unauthorized` |
| `/api/payroll/runs/:id/export/summary` | `401 Unauthorized` |
| `/api/teachers/export/active` | `401 Unauthorized` |
| `/api/audit/export` | `401 Unauthorized` |

Resultado:

- Las rutas CSV protegidas no quedaron publicas.
- No se detectaron errores Cloud Run en la nueva revision.
- La validacion con `status 200`, `Content-Type`, `Content-Disposition` y BOM en produccion requiere sesion Firebase real de usuario autorizado. No se uso token de usuario ni se inspeccionaron cookies/local storage.

## 10. Smoke test CSV frontend

No ejecutado automaticamente en produccion porque requiere sesion autorizada en navegador:

- PayrollView Detalle CSV.
- FiscalRecordsView Cumpleanos CSV.

Cobertura previa:

- H11-F4 valido los 11 CSV criticos con datos sinteticos locales.
- Excel Windows 16.0 abrio los CSV sin mojibake.
- BOM UTF-8 y CRLF confirmados.
- Columnas, orden, comas, comillas, saltos e importes validados.

Pendiente recomendado:

- Usuario autorizado Finanzas/RH/Admin debe descargar al menos un CSV backend y los dos CSV frontend en produccion y abrirlos en Excel institucional.

## 11. Confirmacion sin cambios de datos

Confirmado:

- No se ejecutaron migraciones.
- No se ejecuto `db:migrate`.
- No se ejecuto `db:migrate:apply`.
- No se ejecuto `db:migrate:baseline`.
- No se importaron datos.
- No se sincronizaron datos locales/test.
- No se modifico base de datos productiva.
- No se modifico nomina.
- No se modificaron estados financieros ni ciclos.
- No se ejecuto cierre de ciclo.
- No se cambiaron permisos, columnas, filtros, montos, rutas, nombres de archivo ni UX.
- No se tocaron H01/H02/H03/H05/H09/H10.

## 12. Rollback

API Cloud Run:

- Volver trafico a revision anterior `nomina-api-00045-v8h`.
- Alternativamente redeploy de imagen previa `sha256:391fa6fed34a1499d6bcda324f078816c81185fc7a77e0fee70380f743237c1b`.

Firebase Hosting:

- Rollback a version live anterior desde Firebase Hosting.

Base de datos:

- No hay migracion H11 que revertir.
- No hay cambios de datos H11 que revertir.
- Backup preventivo disponible: `1780499832076`.

## 13. Riesgos y observaciones

- Smoke CSV autorizado en produccion queda pendiente por falta de token/sesion de usuario autorizado durante esta corrida.
- Google Sheets y LibreOffice no fueron validados en produccion; H11-F4 los dejo como observaciones no bloqueantes.
- Excel puede mostrar algunos importes como numeros sin ceros finales en formato General, aunque el CSV conserva el decimal.
- La sanitizacion de formulas CSV sigue como decision futura por exportable; el helper ya soporta la opcion, pero no se activo en H11 para no cambiar semantica de datos.

## 14. Recomendacion

Deploy H11-F5 queda **publicado y operativo**.

Recomendacion final:

1. Mantener despliegue.
2. Ejecutar validacion manual con usuario autorizado de Finanzas/RH/Admin:
   - Descargar Finanzas pagos CSV.
   - Descargar Nomina resumen CSV.
   - Descargar Docentes activos CSV.
   - Descargar Auditoria CSV.
   - Descargar PayrollView Detalle CSV.
   - Descargar FiscalRecordsView Cumpleanos CSV.
3. Si esa validacion manual pasa, cerrar H11 como completado.

