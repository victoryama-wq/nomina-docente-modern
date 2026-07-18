# Nómina Docente Modern

Nueva plataforma para Nómina Docente.

Stack inicial:

- Frontend: Vue 3 + Vite + TypeScript.
- Auth: Firebase Auth con Google.
- Backend: Fastify + TypeScript en Cloud Run.
- Base de datos: Cloud SQL PostgreSQL.
- Archivos: Cloud Storage.

El legacy Apps Script fue retirado del repositorio en H06/H14. `Codigo.gs` e `index.html` ya no se usan operativamente ni son referencia funcional válida para la operación actual. La trazabilidad histórica queda en Git y en la documentación de auditoría.

## Documentación de entrega

La documentación técnico-operativa del sistema está en:

- `docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md`
- `docs/Manual_Entrega_Nomina_Docente.md`
- `docs/Manual_Entrega_Nomina_Docente.docx`

El SDD consolidado es la fuente documental principal para H11 en adelante. Los manuales de entrega incluyen alcance, arquitectura, roles, vistas, flujos operativos, modelo de datos resumido, despliegue, respaldos, validación de entrega y recomendaciones post-entrega.

La metadata publica de la Web App, favicon y recursos de vista previa social quedan versionados en `apps/web/index.html` y `apps/web/public/`. Ver `docs/auditoria/H16_Metadata_Favicon_WebApp.md`.

## Despliegue actual

```text
Frontend Firebase Hosting: https://nomina-docente-prod.web.app
Backend Cloud Run: https://nomina-api-443985127112.us-central1.run.app
API via Hosting: https://nomina-docente-prod.web.app/api/health
```

Firebase Hosting sirve la Web App y reenvía `/api/**` al servicio `nomina-api` en Cloud Run.

Estado productivo consolidado posterior a H20:

- Cloud Run productivo: `nomina-api`, revision vigente documentada `nomina-api-00051-9s5`.
- Firebase Hosting live: release `1784228039752000`, version `41bf160c7c3595b6`.
- Base aplicativa activa: `nomina_docente`.
- Canal Firebase Hosting activo: `live`.
- Recursos preview/dry-run H02/H03 eliminados.
- H01 precision monetaria: cerrado.
- H02/H03 permisos/coordinacion: desplegado y validado.
- H04 pruebas automatizadas: implementado hasta Fase 5; Playwright queda opcional.
- H05 control formal de migraciones: baseline productivo 001 a 012, sin pendientes ni checksum mismatch.
- H09/H10 estados y cierre de ciclo: desplegado en produccion sin migracion 013.
- H11 CSV UTF-8: desplegado y cerrado operativo con smoke autorizado.
- H12 catalogos historicos: cerrado documental como politica operativa.
- H13 checklist productivo permanente: cerrado documental; usar antes de cada deploy.
- H15 sesion por inactividad: desplegado en Firebase Hosting live; `browserSessionPersistence`, timeout 60 minutos y modal de advertencia vigentes.
- H17 Directorio: normalizacion productiva ejecutada y documentada bajo control de `teachers.created_by`.
- H18 Reportes Operativos: cerrado operativo con filtros amigables y hotfix snapshot desplegado.
- H19 Directorio: actualizacion controlada y altas minimas ejecutadas sin duplicados.
- H20 Nomina compartida: cerrado operativo en `nomina-api-00051-9s5`; smoke autenticado Coordinador/Admin aprobado, sin migraciones ni cambios H01.
- Nomina `2026-05-15 a 2026-05-28`: guardada correctamente por `$517,510.00`.

Documentos de estado relevantes:

- `docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md`
- `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md`
- `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md`
- `docs/auditoria/CIERRE_GLOBAL_MATRIZ_RIESGOS_NOMINA_DOCENTE_20260603.md`
- `docs/auditoria/H02_H03_Deploy_Productivo_Resultado.md`
- `docs/auditoria/H02_H03_Migracion_Productiva_Datos_Oficiales_Mayo_2026.md`
- `docs/auditoria/H02_H03_Cierre_Controlado_Recursos_Revision_20260527.md`
- `docs/auditoria/H05_Control_Formal_Migraciones.md`
- `docs/auditoria/H09_H10_Deploy_Productivo_Resultado.md`
- `docs/auditoria/H11_Cierre_CSV_UTF8_PostDeploy.md`
- `docs/auditoria/H12_Cierre_Documental_Catalogos_Historicos.md`
- `docs/auditoria/H13_Checklist_Productivo_Permanente.md`
- `docs/auditoria/H15_Deploy_Productivo_Resultado.md`
- `docs/auditoria/H16_Metadata_Favicon_WebApp.md`
- `docs/auditoria/H06_H14_Cierre_AppsScript_Legacy.md`
- `docs/specs/SPEC_H20_Alcance_Compartido_Nomina_Coordinadores.md`
- `docs/auditoria/H20_Deploy_Productivo_Alcance_Compartido_Nomina.md`

## Comandos útiles

```powershell
npm install
npm run typecheck
npm run build
firebase deploy --only hosting --project nomina-docente-prod
```

Para preparar la importación de datos legacy:

```powershell
npm run legacy:csv-to-sql -- --directorio database/imports/Directorio.csv --usuarios database/imports/Coord_Academicos.csv --out database/imports/legacy_import.sql
```

Guía completa: `database/import_legacy_data.md`.

Para reconstruir y publicar la API:

```powershell
$gcloud = 'C:\Users\Admin\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
$image = 'us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:latest'
& $gcloud builds submit . --config cloudbuild.api.yaml --substitutions _IMAGE=$image --project=nomina-docente-prod
& $gcloud run deploy nomina-api `
  --image $image `
  --project nomina-docente-prod `
  --region us-central1 `
  --platform managed `
  --service-account nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com `
  --allow-unauthenticated `
  --set-cloudsql-instances nomina-docente-prod:us-central1:nomina-docente-web `
  --set-secrets DB_PASSWORD=db-app-nomina-password:latest `
  --set-env-vars "^@^NODE_ENV=production@FIREBASE_PROJECT_ID=nomina-docente-prod@GCP_PROJECT_ID=nomina-docente-prod@ALLOWED_EMAIL_DOMAIN=tecplayacar.edu.mx@CORS_ORIGINS=https://nomina-docente-prod.web.app,https://nomina-docente-prod.firebaseapp.com,http://localhost:5173@DB_NAME=nomina_docente@DB_USER=app_nomina@INSTANCE_CONNECTION_NAME=nomina-docente-prod:us-central1:nomina-docente-web@CONSTANCIAS_BUCKET=nomina-docente-prod-constancias@LEGACY_COORDINATION_FALLBACK_ENABLED=true" `
  --min-instances 0 `
  --max-instances 3 `
  --cpu 1 `
  --memory 512Mi
```

Checklist minimo antes de deploy:

```powershell
npm run test
npm run test:api
npm run test:api:integration
npm run test:web
npm --workspace apps/api run typecheck
npm --workspace apps/web run typecheck
npm run typecheck
npm run build
```

Checklist productivo completo: `docs/auditoria/H13_Checklist_Productivo_Permanente.md`.

Despues de deploy:

```powershell
Invoke-RestMethod https://nomina-docente-prod.web.app/api/health
firebase hosting:channel:list --project nomina-docente-prod
```
