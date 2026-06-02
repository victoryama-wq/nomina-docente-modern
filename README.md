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

## Despliegue actual

```text
Frontend Firebase Hosting: https://nomina-docente-prod.web.app
Backend Cloud Run: https://nomina-api-443985127112.us-central1.run.app
API via Hosting: https://nomina-docente-prod.web.app/api/health
```

Firebase Hosting sirve la Web App y reenvía `/api/**` al servicio `nomina-api` en Cloud Run.

Estado productivo consolidado posterior a H09/H10:

- Cloud Run productivo: `nomina-api`, revision `nomina-api-00045-v8h`.
- Base aplicativa activa: `nomina_docente`.
- Canal Firebase Hosting activo: `live`.
- Recursos preview/dry-run H02/H03 eliminados.
- H01 precision monetaria: cerrado.
- H02/H03 permisos/coordinacion: desplegado y validado.
- H04 pruebas automatizadas: implementado hasta Fase 5; Playwright queda opcional.
- H05 control formal de migraciones: baseline productivo 001 a 012, sin pendientes ni checksum mismatch.
- H09/H10 estados y cierre de ciclo: desplegado en produccion sin migracion 013.
- Nomina `2026-05-15 a 2026-05-28`: guardada correctamente por `$517,510.00`.

Documentos de estado relevantes:

- `docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md`
- `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md`
- `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md`
- `docs/auditoria/H02_H03_Deploy_Productivo_Resultado.md`
- `docs/auditoria/H02_H03_Migracion_Productiva_Datos_Oficiales_Mayo_2026.md`
- `docs/auditoria/H02_H03_Cierre_Controlado_Recursos_Revision_20260527.md`
- `docs/auditoria/H05_Control_Formal_Migraciones.md`
- `docs/auditoria/H09_H10_Deploy_Productivo_Resultado.md`
- `docs/auditoria/H11_Inventario_CSV_Acentos_Codificacion.md`
- `docs/auditoria/H06_H14_Cierre_AppsScript_Legacy.md`

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
npm --workspace apps/api run typecheck
npm --workspace apps/web run typecheck
npm run typecheck
npm run build
```

Despues de deploy:

```powershell
Invoke-RestMethod https://nomina-docente-prod.web.app/api/health
firebase hosting:channel:list --project nomina-docente-prod
```
