# H02/H03 - Resultado de Deploy Productivo

## 1. Resumen

El deploy productivo de H02/H03 fue ejecutado de forma controlada en el proyecto:

```text
nomina-docente-prod
```

Alcance ejecutado:

- Backup previo de la base productiva.
- Importacion de migracion 011 no destructiva en `nomina_docente`.
- Build y deploy de API productiva `nomina-api`.
- Build y deploy de Firebase Hosting live.
- Smoke tests productivos de lectura.

No se importaron datos de la base local/revision a produccion. La base productiva conservo sus datos actuales; solo se aplico la migracion 011 y el codigo H02/H03.

## 2. Rama y commit

Rama:

```text
feature/h02-h03-user-coordinations-permissions
```

Commit desplegado:

```text
6ff6516 docs(h02-h03): close review validation and prepare production deploy
```

## 3. Validaciones previas

Se ejecutaron antes del deploy:

```text
npm.cmd --workspace apps/api run typecheck
npm.cmd --workspace apps/web run typecheck
npm.cmd run typecheck
npm.cmd run build
```

Resultado:

| Validacion | Resultado |
|---|---|
| API typecheck | Correcto |
| Web typecheck | Correcto |
| Typecheck global | Correcto |
| Build global | Correcto |

## 4. Backup productivo

Backup previo a cambios:

```text
gs://nomina-docente-prod-sql-imports/backups/pre-h02h03-20260527-113834.sql.gz
```

Resultado:

```text
Exportado correctamente desde Cloud SQL instancia nomina-docente-web, base nomina_docente.
```

## 5. Migracion 011

Migracion aplicada:

```text
database/011_h02_h03_user_coordinations_permissions.sql
```

Archivo subido a GCS:

```text
gs://nomina-docente-prod-sql-imports/migrations/011_h02_h03_user_coordinations_permissions_6ff6516.sql
```

Resultado:

```text
Importacion SQL completada correctamente en nomina_docente.
```

Validacion SQL productiva:

| Validacion | Resultado |
|---|---:|
| Base actual | `nomina_docente` |
| Tabla `user_coordinations` | Existe |
| Permisos nuevos H03 | 6 |
| Coordinacion reservada `Todas / Global` | 0 |
| Coordinacion reservada `No requiere coordinacion operativa` | 0 |
| Rol tecnico `subdireccion` | 0 |

Seeds nuevos por rol observados:

| Rol | Permisos H02/H03 nuevos observados |
|---|---|
| `admin` | `finance.export`, `finance.workflow`, `fiscal.document.manage`, `fiscal.document.view`, `fiscal.view`, `payroll.preview` |
| `coordinador` | `payroll.preview` |
| `direccion` | `payroll.preview` |
| `finanzas` | `finance.export`, `finance.workflow`, `fiscal.document.manage`, `fiscal.document.view`, `fiscal.view`, `payroll.preview` |
| `rh` | `fiscal.document.manage`, `fiscal.document.view`, `fiscal.view` |
| `contador` | `finance.export` |
| `contabilidad` | `finance.export` |

## 6. API productiva

Revision previa para rollback:

```text
nomina-api-00043-p96
```

Imagen desplegada:

```text
us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h02h03-prod-6ff6516
```

Cloud Build:

```text
56a4c191-9fa4-4829-8f37-5c9bc5bda618
```

Revision productiva nueva:

```text
nomina-api-00044-pk9
```

Trafico:

```text
100% a nomina-api-00044-pk9
```

URL Cloud Run:

```text
https://nomina-api-443985127112.us-central1.run.app
```

Variables productivas verificadas:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `FIREBASE_PROJECT_ID` | `nomina-docente-prod` |
| `GCP_PROJECT_ID` | `nomina-docente-prod` |
| `ALLOWED_EMAIL_DOMAIN` | `tecplayacar.edu.mx` |
| `CORS_ORIGINS` | `https://nomina-docente-prod.web.app,https://nomina-docente-prod.firebaseapp.com,http://localhost:5173` |
| `DB_NAME` | `nomina_docente` |
| `DB_USER` | `app_nomina` |
| `INSTANCE_CONNECTION_NAME` | `nomina-docente-prod:us-central1:nomina-docente-web` |
| `CONSTANCIAS_BUCKET` | `nomina-docente-prod-constancias` |
| `LEGACY_COORDINATION_FALLBACK_ENABLED` | `true` |
| `DB_PASSWORD` | Secret Manager `db-app-nomina-password:latest` |

## 7. Frontend productivo

Firebase Hosting live:

```text
https://nomina-docente-prod.web.app
```

Release observado:

```text
2026-05-27 11:44:21
```

Build frontend:

- Se removio `VITE_API_BASE_URL` antes del build live.
- El bundle no contiene URL de API de revision.
- El bundle no contiene URL directa de API productiva.
- El frontend live usa el rewrite `/api/**` hacia el servicio productivo `nomina-api`.

## 8. Smoke tests productivos

| Prueba | Resultado |
|---|---|
| `GET https://nomina-docente-prod.web.app` | 200 OK |
| `GET https://nomina-docente-prod.web.app/api/health` | 200 OK |
| `GET /api/auth/session` sin token | 401 Unauthorized esperado |
| CORS preflight desde `https://nomina-docente-prod.web.app` | 204, origin permitido |
| Logs Cloud Run severidad ERROR ultimos 15 min | Sin registros |

Healthcheck:

```json
{"ok":true,"service":"nomina-docente-api","tables":31}
```

## 9. Datos productivos observados

Consulta posterior a deploy en `nomina_docente`:

| Tabla | Registros |
|---|---:|
| `app_users` | 19 |
| `teachers` | 213 |
| `schedules` | 595 |
| `schedule_incidences` | 0 |
| `extra_hours` | 0 |

Nota:

- Estos son los datos que ya estaban en la base productiva al momento del deploy.
- No se copiaron Incidencias/Extras de revision/local a produccion.
- Si Operacion requiere cargar Incidencias/Extras o actualizar Directorio/Horarios en produccion, debe ejecutarse como fase de datos aparte y controlada.

## 10. Confirmaciones de alcance

Confirmado:

- No se modifico H01.
- No se cambio formula de nomina.
- No se cambio precision monetaria.
- No se retiro fallback legacy.
- No se activo modo estricto.
- No se creo rol tecnico `subdireccion`.
- No se crearon coordinaciones reservadas.
- No se desplego contra base de revision.
- No se importaron datos locales/revision a produccion.

## 11. Rollback disponible

### 11.1 API

Revertir trafico a la revision previa:

```powershell
$gcloud = (Get-Command gcloud.cmd).Source
& $gcloud run services update-traffic nomina-api `
  --region us-central1 `
  --project nomina-docente-prod `
  --to-revisions nomina-api-00043-p96=100
```

### 11.2 Hosting

Restaurar version anterior desde Firebase Hosting console o re-deploy del build anterior.

### 11.3 Base de datos

Backup disponible:

```text
gs://nomina-docente-prod-sql-imports/backups/pre-h02h03-20260527-113834.sql.gz
```

La migracion 011 es no destructiva. Ante un incidente, primero revertir API/Hosting y diagnosticar antes de restaurar base completa.

## 12. Pendientes post-deploy

1. Ejecutar smoke test autenticado por rol:
   - Admin.
   - Coordinador.
   - Direccion/Subdireccion.
   - RH.
   - Finanzas.
   - Contador/Contabilidad.
2. Confirmar con Operacion si se cargaran datos de Incidencias/Extras en produccion o si iniciaran captura desde cero.
3. Mantener monitoreo durante la primera captura/quincena posterior al deploy.
4. Eliminar recursos de revision cuando Admin confirme que ya no se necesitan:
   - `nomina-api-h02h03-review`.
   - Hosting channel `h02-h03-review`.
   - Base `nomina_docente_h02h03_review`, si ya no se requiere auditoria.

## 13. Veredicto

Deploy productivo H02/H03 ejecutado correctamente con smoke tests tecnicos basicos aprobados.

Estado:

```text
Produccion actualizada y operativa.
```
