# Infraestructura Google Cloud preparada

Estado documental: **histórico**.

Fuente vigente que lo sustituye:
`docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md` y
`docs/auditoria/H13_Checklist_Productivo_Permanente.md`.

Los datos siguientes documentan la preparación inicial. La configuración actual debe verificarse en modo read-only antes de cada deploy.

Proyecto:

```text
nomina-docente-prod
```

Cloud SQL:

```text
Instancia: nomina-docente-web
Region: us-central1
Motor: PostgreSQL 18
Connection name: nomina-docente-prod:us-central1:nomina-docente-web
Base de datos: nomina_docente
Usuario de aplicacion: app_nomina
```

Secret Manager:

```text
db-app-nomina-password
```

Este secreto contiene la contrasena vigente del usuario `app_nomina`. No debe copiarse a archivos `.env` versionados ni pegarse en conversaciones.

Cloud Storage:

```text
Bucket constancias: gs://nomina-docente-prod-constancias
Bucket imports SQL: gs://nomina-docente-prod-sql-imports
```

Cuenta de servicio para backend:

```text
nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com
```

Permisos asignados:

```text
roles/cloudsql.client
roles/secretmanager.secretAccessor
roles/storage.objectAdmin sobre gs://nomina-docente-prod-constancias
```

Artifact Registry:

```text
Repositorio Docker: us-central1-docker.pkg.dev/nomina-docente-prod/nomina
Imagen API: us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:latest
```

Cloud Run:

```text
Servicio: nomina-api
Region: us-central1
URL: https://nomina-api-443985127112.us-central1.run.app
Service account: nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com
Cloud SQL montado: nomina-docente-prod:us-central1:nomina-docente-web
Min instances: 0
Max instances: 3
```

CORS permitido:

```text
https://nomina-docente-prod.web.app
https://nomina-docente-prod.firebaseapp.com
http://localhost:5173
http://localhost:8080
```

Firebase Hosting:

```text
Sitio: https://nomina-docente-prod.web.app
Rewrite API: /api/** -> Cloud Run nomina-api
```

APIs habilitadas:

```text
run.googleapis.com
sqladmin.googleapis.com
cloudbuild.googleapis.com
artifactregistry.googleapis.com
secretmanager.googleapis.com
firebase.googleapis.com
identitytoolkit.googleapis.com
storage.googleapis.com
```

Validacion realizada:

1. Se importo `database/001_initial_schema.sql` en la base `nomina_docente`.
2. Se exporto la base a Cloud Storage para confirmar que las tablas existen.
3. Se verifico que existe el super admin protegido `victor.yama@tecplayacar.edu.mx`.
4. Se verifico que existe el trigger `app_users_protected_super_admin_guard`.
5. Se verifico `https://nomina-docente-prod.web.app/api/health` con respuesta `ok: true`.

Migraciones aplicadas al momento de esta evidencia histórica:

```text
001_initial_schema.sql
002_directory_access_module.sql
```
