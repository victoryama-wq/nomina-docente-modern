# H02/H03 Fase 3 - Deploy de Revision

## 1. Objetivo

Ejecutar un deploy de revision para H02/H03 usando datos actuales de revision, sin tocar produccion y sin cambiar la logica operacional aprobada.

Esta fase publico:

- API de revision en Cloud Run.
- Base de datos separada de revision en Cloud SQL.
- Frontend en Firebase Hosting preview channel.

No se desplego a Hosting live y no se modifico el servicio productivo `nomina-api`.

## 2. Rama y commit

```text
rama: feature/h02-h03-user-coordinations-permissions
commit base: a52aada docs(h02-h03): prepare review deployment phase
```

## 3. Validaciones previas

Se ejecutaron correctamente:

```powershell
npm.cmd --workspace apps/api run typecheck
npm.cmd --workspace apps/web run typecheck
npm.cmd run typecheck
npm.cmd run build
```

Resultado:

```text
API typecheck: correcto
Web typecheck: correcto
Typecheck global: correcto
Build global: correcto
```

## 4. Base de datos de revision

Se creo una base separada en Cloud SQL:

```text
instancia: nomina-docente-web
database: nomina_docente_h02h03_review
proyecto: nomina-docente-prod
```

Origen de datos:

```text
BD local: nomina_docente_deploy_snapshot_20260526_111616_h02h03
host local: localhost
puerto local: 55432
usuario local: app_nomina
```

Archivo de importacion subido a GCS:

```text
gs://nomina-docente-prod-sql-imports/h02h03-review/nomina_docente_h02h03_review_20260526-183825.sql
```

Validacion posterior a importacion:

| Tabla | Registros |
|---|---:|
| teachers | 216 |
| schedules | 589 |
| schedule_incidences | 18 |
| extra_hours | 65 |
| user_coordinations | 15 |

Validaciones adicionales:

| Validacion | Resultado |
|---|---:|
| Coordinacion `Todas / Global` | 0 |
| Coordinacion `No requiere coordinacion operativa` | 0 |
| Permisos nuevos H03 | 6 |

## 5. API de revision

Servicio Cloud Run creado:

```text
servicio: nomina-api-h02h03-review
region: us-central1
revision actual: nomina-api-h02h03-review-00002-6g5
url publica: https://nomina-api-h02h03-review-443985127112.us-central1.run.app
```

Imagen:

```text
us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h02h03-a52aada-review
```

Cloud Build:

```text
build: 35ce2b2a-c8d3-44a4-9ddd-58dd8b7552f8
status: SUCCESS
```

Variables relevantes:

```text
NODE_ENV=production
FIREBASE_PROJECT_ID=nomina-docente-prod
GCP_PROJECT_ID=nomina-docente-prod
ALLOWED_EMAIL_DOMAIN=tecplayacar.edu.mx
CORS_ORIGINS=https://nomina-docente-prod--h02-h03-review-nkv64mlb.web.app,http://localhost:5173
DB_NAME=nomina_docente_h02h03_review
DB_USER=app_nomina
INSTANCE_CONNECTION_NAME=nomina-docente-prod:us-central1:nomina-docente-web
CONSTANCIAS_BUCKET=nomina-docente-prod-constancias
LEGACY_COORDINATION_FALLBACK_ENABLED=true
```

Se corrigio una configuracion inicial de revision donde PowerShell genero una variable mal formada `@NODE_ENV`. El servicio de revision fue eliminado y recreado limpio. Esto no afecto produccion.

Healthcheck:

```json
{
  "ok": true,
  "service": "nomina-docente-api",
  "tables": 22
}
```

## 6. Frontend de revision

Firebase Hosting preview channel:

```text
channel: h02-h03-review
url: https://nomina-docente-prod--h02-h03-review-nkv64mlb.web.app
expira: 2026-06-02 18:45:44
```

Build frontend:

```text
VITE_API_BASE_URL=https://nomina-api-h02h03-review-443985127112.us-central1.run.app
VITE_FIREBASE_PROJECT_ID=nomina-docente-prod
VITE_FIREBASE_AUTH_DOMAIN=nomina-docente-prod.firebaseapp.com
```

Validacion:

- El bundle generado contiene la URL de API de revision.
- No usa `/api` como destino principal.
- El canal `live` de Firebase Hosting no fue actualizado.

Canales actuales verificados:

| Canal | URL | Expira |
|---|---|---|
| h02-h03-review | https://nomina-docente-prod--h02-h03-review-nkv64mlb.web.app | 2026-06-02 18:45:44 |
| live | https://nomina-docente-prod.web.app | never |

## 7. Produccion no modificada

Servicio productivo verificado:

```text
servicio: nomina-api
revision actual: nomina-api-00043-p96
url: https://nomina-api-atsjlgi6ja-uc.a.run.app
```

Base productiva existente:

```text
nomina_docente
```

Base de revision creada aparte:

```text
nomina_docente_h02h03_review
```

No se modifico Hosting live.

## 8. Smoke checks tecnicos

### API health

```text
GET /health: 200 OK
```

### Auth sin token

```text
GET /auth/session sin token: 401 esperado
```

### CORS desde preview

Preflight desde:

```text
https://nomina-docente-prod--h02-h03-review-nkv64mlb.web.app
```

Resultado:

```text
OPTIONS /auth/session: 204
access-control-allow-origin: https://nomina-docente-prod--h02-h03-review-nkv64mlb.web.app
access-control-allow-credentials: true
```

## 9. Revision por modulo y logica

La Fase 3 no modifico codigo funcional. Se desplego el commit ya aprobado de la rama.

Se revisaron las reglas de los modulos para confirmar que la logica operacional sigue alineada:

| Modulo | Logica validada |
|---|---|
| Control de Accesos | No muestra selector manual de nombres/combinaciones como alcance operativo. Para Coordinador informa que el alcance se toma del usuario capturador. |
| Directorio | `GET /teachers` sigue global. Edicion para Coordinador/Direccion se basa en `teachers.created_by`. Fiscal sigue protegido por permisos H03. |
| Horarios | Coordinador puede trabajar con docentes activos, pero visibilidad/edicion/eliminacion se basa en `schedules.created_by`. |
| Incidencias | Incidencias se controlan por el horario capturado; no se usa `updated_by` como autor original. |
| Extras | Coordinador y Direccion/Subdireccion pueden ver segun rol; edicion/eliminacion se basa en `extra_hours.captured_by`. |
| Nomina preview | `payroll.preview` permite preview; `payroll.finalize` conserva guardado. Coordinador no guarda nomina. |
| Fiscal | `fiscal.view`, `fiscal.manage`, `fiscal.document.view` y `fiscal.document.manage` siguen separados. |
| Finanzas | `finance.view`, `finance.export` y `finance.workflow` siguen separados; `finance.view` no habilita workflow. |
| H01 | No se modifico precision monetaria ni formula de nomina. |

## 10. Riesgos y observaciones

- La validacion autenticada por rol debe ejecutarse manualmente en el preview con Firebase Auth real.
- El preview usa Firebase Auth del proyecto productivo, pero permisos y datos se resuelven contra la BD de revision.
- El servicio de revision usa el mismo bucket de constancias configurado, pero no debe probarse descarga/subida real de documentos sensibles sin aprobacion.
- El canal preview expira el 2026-06-02 18:45:44.
- El deploy de revision agrega una base de datos y un servicio de revision; deben eliminarse al terminar la evaluacion si no se siguen usando.

## 11. Rollback / limpieza de revision

Eliminar servicio API de revision:

```powershell
$gcloud = 'C:\Users\Admin\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
& $gcloud run services delete nomina-api-h02h03-review `
  --project=nomina-docente-prod `
  --region=us-central1 `
  --quiet
```

Eliminar canal preview:

```powershell
firebase hosting:channel:delete h02-h03-review --project nomina-docente-prod
```

Eliminar BD de revision si ya no se requiere:

```powershell
$gcloud = 'C:\Users\Admin\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
& $gcloud sql databases delete nomina_docente_h02h03_review `
  --instance=nomina-docente-web `
  --project=nomina-docente-prod `
  --quiet
```

Produccion no requiere rollback porque no se actualizo.

## 12. Siguiente paso

Fase 4 recomendada:

Ejecutar pruebas manuales autenticadas por rol en el preview:

- Admin
- Coordinador
- Direccion/Subdireccion
- RH
- Finanzas
- Contador/Contabilidad

Validar especialmente:

- Directorio con docente compartido.
- Horarios capturados por usuario.
- Incidencias sobre horarios propios.
- Extras visibles y editables solo por capturador.
- Nomina preview sin guardado para Coordinador.
- Fiscal/Finanzas H03 sin regresion.

