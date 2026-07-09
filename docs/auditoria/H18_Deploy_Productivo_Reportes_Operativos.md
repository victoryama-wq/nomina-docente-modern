# H18 - Deploy Productivo Reportes Operativos

Fecha: 2026-07-08

## 1. Resumen

Se ejecuto deploy controlado de H18 para publicar el modulo `Reportes` en produccion, con backend Cloud Run y frontend Firebase Hosting live.

H18 agrega:

- Ruta frontend `/reports`.
- Pestana `Horas base y extras`.
- Pestana `Horas base por categoria`.
- Endpoints backend `/reports/operational/*`.
- Exportacion CSV con helper H11.
- Exportacion XLSX server-side con `exceljs`.

No se ejecutaron migraciones, seeds, imports, `db:migrate`, `apply`, `baseline` ni cambios de base de datos.

## 2. Commits desplegados

| Commit | Descripcion |
|---|---|
| `72c244f` | `feat(h18): add operational reports backend` |
| `76ce383` | `feat(h18): add operational reports frontend` |
| `59057c0` | `docs(sec-01): document exceljs npm audit evidence` |
| `1cefd18` | `docs(h18): validate operational reports ui exports` |

Commit usado para imagen productiva:

```text
1cefd18
```

## 3. Prechecks ejecutados

### Git

- Rama: `feature/h02-h03-user-coordinations-permissions`.
- Working tree: limpio antes de deploy.
- Commits H18 presentes.
- Rama sincronizada con `origin` antes de deploy.

### Validaciones automaticas

| Comando | Resultado |
|---|---|
| `npm run test:api` | OK |
| `npm run test:web` | OK |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `git diff --check` | OK |

### H05 / migraciones

Se ejecutaron solo comandos de inspeccion/estado:

```text
npm run db:migrate:inspect
npm run db:migrate:status
```

Resultado:

- Base inspeccionada: `nomina_docente`.
- `schema_migrations`: existe.
- `schema_migration_runs`: existe.
- Migraciones filesystem: `15`.
- Registradas DB: `15`.
- Baseline: `15`.
- Pendientes: `0`.
- Checksum mismatch: `0`.
- Advertencias historicas aceptadas: prefijos duplicados `007`, `008`, `009`.

No se ejecuto:

- `npm run db:migrate`.
- `npm run db:migrate:apply`.
- `npm run db:migrate:baseline`.
- `npm run db:migrate:dry-run`.
- `psql -f database/*.sql`.

### H13

Se revisaron:

- Proyecto GCP: `nomina-docente-prod`.
- Cuenta activa gcloud: cuenta institucional autorizada.
- Servicio Cloud Run: `nomina-api`.
- Region: `us-central1`.
- Firebase Hosting: sitio `nomina-docente-prod`, canal `live`.
- Rewrite `/api/**` hacia Cloud Run `nomina-api`.
- Variables productivas existentes.
- Secret `DB_PASSWORD` conservado como referencia de Secret Manager.
- Service account Cloud Run: `nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com`.
- Plan de rollback API/Hosting.

No se genero backup Cloud SQL nuevo para H18 porque el release no ejecuta migraciones ni escrituras de BD. No hay rollback de BD asociado.

## 4. Deploy API Cloud Run

### Build

Comando ejecutado:

```powershell
gcloud builds submit . --config cloudbuild.api.yaml --substitutions _IMAGE=us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h18-prod-1cefd18 --project=nomina-docente-prod
```

Resultado:

- Cloud Build ID: `29286888-e1cb-4c98-9be1-684cf350a346`.
- Estado: `SUCCESS`.
- Imagen: `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h18-prod-1cefd18`.
- Digest: `sha256:308e1ed29dae95f6faf792f6fd676820036754958b6964daf4da1e4dbc755190`.

Observacion:

- El build de Docker reporto vulnerabilidades npm conocidas en dependencias transitivas.
- No se ejecuto `npm audit fix`.
- La evidencia SEC-01 de `exceljs` queda documentada por separado.

### Deploy

Comando ejecutado:

```powershell
gcloud run deploy nomina-api `
  --image us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h18-prod-1cefd18 `
  --project nomina-docente-prod `
  --region us-central1 `
  --platform managed `
  --service-account nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com `
  --allow-unauthenticated `
  --set-cloudsql-instances nomina-docente-prod:us-central1:nomina-docente-web `
  --set-secrets DB_PASSWORD=db-app-nomina-password:latest `
  --set-env-vars NODE_ENV=production,FIREBASE_PROJECT_ID=nomina-docente-prod,GCP_PROJECT_ID=nomina-docente-prod,ALLOWED_EMAIL_DOMAIN=tecplayacar.edu.mx,CORS_ORIGINS=https://nomina-docente-prod.web.app,https://nomina-docente-prod.firebaseapp.com,http://localhost:5173,DB_NAME=nomina_docente,DB_USER=app_nomina,INSTANCE_CONNECTION_NAME=nomina-docente-prod:us-central1:nomina-docente-web,CONSTANCIAS_BUCKET=nomina-docente-prod-constancias,LEGACY_COORDINATION_FALLBACK_ENABLED=true `
  --min-instances 0 `
  --max-instances 3 `
  --cpu 1 `
  --memory 512Mi
```

Resultado:

| Elemento | Valor |
|---|---|
| Revision anterior | `nomina-api-00047-bxq` |
| Revision nueva | `nomina-api-00048-js8` |
| Trafico | `100%` a `nomina-api-00048-js8` |
| URL publica | `https://nomina-api-443985127112.us-central1.run.app` |
| Imagen vigente | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h18-prod-1cefd18` |

## 5. Deploy Firebase Hosting

Comando ejecutado:

```powershell
firebase deploy --only hosting --project nomina-docente-prod
```

Resultado:

- Sitio: `nomina-docente-prod`.
- Canal: `live`.
- URL: `https://nomina-docente-prod.web.app`.
- Ultima publicacion live: `2026-07-08 12:33:41`.
- Rewrite `/api/**` conservado hacia Cloud Run `nomina-api`.

## 6. Healthchecks

| Validacion | Resultado |
|---|---|
| `https://nomina-docente-prod.web.app/` | `200` |
| `https://nomina-docente-prod.web.app/reports` | `200` |
| `https://nomina-docente-prod.web.app/api/health` | `200` |
| `https://nomina-api-443985127112.us-central1.run.app/api/health` | `200` |
| `https://nomina-docente-prod.web.app/api/auth/session` sin token | `401` esperado |
| `https://nomina-docente-prod.web.app/api/reports/operational/base-extra` sin token | `401` esperado |

Respuesta health via Hosting:

```json
{"ok":true,"service":"nomina-docente-api","tables":33}
```

Logs de nueva revision:

- Consulta de errores sobre `nomina-api-00048-js8`: sin errores `severity>=ERROR` al momento de la verificacion.

## 7. Smoke productivo H18

### Smoke tecnico ejecutado

| Caso | Resultado |
|---|---|
| Hosting raiz carga | OK |
| Ruta `/reports` carga | OK |
| API health via Hosting | OK |
| API health Cloud Run directo | OK |
| Sesion sin token bloqueada | OK, `401` |
| Endpoint H18 sin token bloqueado | OK, `401` |

### Smoke funcional por rol

No se ejecuto smoke funcional con sesiones reales desde este entorno porque no habia token ni sesion autorizada disponible para Admin, Direccion, Coordinador, RH, Finanzas, Contador o Contabilidad.

Queda pendiente validacion manual/autorizada:

| Rol | Validacion pendiente |
|---|---|
| Admin | Menu `Reportes`, ambas pestanas, consultas y descargas CSV/XLSX. |
| Direccion/Subdireccion | Menu `Reportes`, ambas pestanas, consultas y descargas CSV/XLSX. |
| Coordinador | Solo pestana `Horas base por categoria`, alcance operativo y descargas de pestana 2. |
| RH | Solo pestana `Horas base por categoria`. |
| Finanzas | Modulo `Reportes` oculto o acceso bloqueado por URL. |
| Contador/Contabilidad | Modulo `Reportes` oculto o acceso bloqueado por URL. |

### Validacion CSV/XLSX

Pendiente con usuario autorizado:

- Descargar CSV pestana 1.
- Descargar XLSX pestana 1.
- Descargar CSV pestana 2.
- Descargar XLSX pestana 2.
- Abrir en Excel institucional.
- Confirmar acentos, columnas, hojas, encabezados y ausencia de datos fiscales.

## 8. Confirmaciones de seguridad

Confirmado:

- No se ejecutaron migraciones.
- No se ejecuto `db:migrate`.
- No se ejecuto `apply`.
- No se ejecuto `baseline`.
- No se ejecutaron seeds.
- No se importaron datos.
- No se modifico base de datos.
- No se modifico H01.
- No se cambiaron roles ni permisos productivos por SQL.
- No se tocaron datos fiscales.
- No se expusieron RFC, bancos, `paymentType` ni constancias en el smoke tecnico.
- No se ejecuto `npm audit fix`.

## 9. Riesgos restantes

| Riesgo | Estado | Mitigacion |
|---|---|---|
| Smoke manual por rol pendiente | Abierto | Ejecutar con usuarios autorizados antes de cerrar H18 operativo. |
| Validacion Excel de CSV/XLSX pendiente | Abierto | Descargar desde UI con Admin/Direccion/Coordinador/RH y abrir en Excel institucional. |
| Rendimiento de consultas con datos reales | En observacion | Monitorear logs Cloud Run y tiempos de respuesta durante smoke. |
| Vulnerabilidades npm transitivas | Documentado | Mantener SEC-01 y no aplicar `audit fix` sin fase separada. |
| Snapshot sin capturador historico completo | Conocido | Documentado en SPEC H18 como pendiente futuro si operacion lo requiere. |

## 10. Rollback

No se aplico rollback.

Plan disponible:

### API Cloud Run

Volver trafico a la revision anterior:

```powershell
gcloud run services update-traffic nomina-api `
  --project nomina-docente-prod `
  --region us-central1 `
  --to-revisions nomina-api-00047-bxq=100
```

### Firebase Hosting

- Rollback a release live anterior desde Firebase Hosting.
- O redeploy del build anterior si se cuenta con artefacto.

### Base de datos

- No hay rollback de BD para H18 porque no hubo migracion ni modificacion de datos.

## 11. Recomendacion

H18 queda desplegado productivamente con smoke tecnico aprobado.

Recomendacion inmediata:

1. Ejecutar smoke manual/autorizado por rol.
2. Validar CSV/XLSX en Excel institucional.
3. Si todo pasa, cerrar H18 como operativo.
4. Si falla permiso, exportable o rendimiento, evaluar rollback API/Hosting segun severidad.

## 12. Nota posterior H18-F6

El 2026-07-09 se implemento localmente H18-F6 para reemplazar filtros visibles por ID con selectores de ciclo/quincena y busqueda general.

Esta mejora no forma parte del deploy documentado en este archivo y queda pendiente de deploy controlado posterior.
