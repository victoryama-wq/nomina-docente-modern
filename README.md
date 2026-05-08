# Nómina Docente Modern

Nueva plataforma para Nómina Docente.

Stack inicial:

- Frontend: Vue 3 + Vite + TypeScript.
- Auth: Firebase Auth con Google.
- Backend: Fastify + TypeScript en Cloud Run.
- Base de datos: Cloud SQL PostgreSQL.
- Archivos: Cloud Storage.

La app legacy de Apps Script se conserva en `Codigo.gs` e `index.html` como referencia funcional durante la migración.

## Documentación de entrega

La documentación técnico-operativa del sistema está en:

- `docs/Manual_Entrega_Nomina_Docente.md`
- `docs/Manual_Entrega_Nomina_Docente.docx`

Incluye alcance, arquitectura, roles, vistas, flujos operativos, modelo de datos resumido, despliegue, respaldos, validación de entrega y recomendaciones post-entrega.

## Despliegue actual

```text
Frontend Firebase Hosting: https://nomina-docente-prod.web.app
Backend Cloud Run: https://nomina-api-443985127112.us-central1.run.app
API via Hosting: https://nomina-docente-prod.web.app/api/health
```

Firebase Hosting sirve la Web App y reenvía `/api/**` al servicio `nomina-api` en Cloud Run.

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
  --set-env-vars "^@^NODE_ENV=production@FIREBASE_PROJECT_ID=nomina-docente-prod@GCP_PROJECT_ID=nomina-docente-prod@ALLOWED_EMAIL_DOMAIN=tecplayacar.edu.mx@CORS_ORIGINS=https://nomina-docente-prod.web.app,https://nomina-docente-prod.firebaseapp.com,http://localhost:5173,http://localhost:8080@DB_NAME=nomina_docente@DB_USER=app_nomina@INSTANCE_CONNECTION_NAME=nomina-docente-prod:us-central1:nomina-docente-web@CONSTANCIAS_BUCKET=nomina-docente-prod-constancias" `
  --min-instances 0 `
  --max-instances 3 `
  --cpu 1 `
  --memory 512Mi
```
