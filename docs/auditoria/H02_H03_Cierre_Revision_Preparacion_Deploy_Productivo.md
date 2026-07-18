# H02/H03 - Cierre de Revision y Preparacion de Deploy Productivo

## 1. Objetivo

Documentar el cierre formal de pruebas de revision H02/H03 y dejar preparada la fase de deploy productivo.

Este documento no ejecuta deploy productivo. Su alcance es:

- Consolidar evidencia tecnica del ambiente de revision.
- Registrar el resultado funcional reportado por pruebas de revision.
- Dejar prerequisitos, comandos, smoke tests y rollback para produccion.
- Mantener separada la decision de despliegue productivo, que requiere aprobacion Admin.

Restricciones respetadas:

- No se modifico H01.
- No se cambio la formula de nomina.
- No se cambio precision monetaria.
- No se retiro fallback legacy.
- No se activo modo estricto.
- No se modifico Apps Script legacy.
- No se ejecuto deploy productivo.

## 2. Estado de rama y version

Rama de trabajo:

```text
feature/h02-h03-user-coordinations-permissions
```

Commit verificado para cierre de revision:

```text
28b8693 docs(h02-h03): record review deployment results
```

Commits funcionales relevantes:

| Commit | Alcance |
|---|---|
| `3f580aa` | ActorScope multi-coordinacion. |
| `a9f526c` | Modulos operativos con alcance por capturador/propiedad. |
| `14b7845` | Separacion H03 fiscal/finanzas/workflow/preview. |
| `8c63f86` | Frontend, permisos visibles y correcciones O1/O2. |
| `284a583` | Correcciones de validacion local. |
| `22b76a7` | Ajuste final: operacion por capturador y docentes compartidos. |
| `a52aada` | Preparacion de deploy de revision. |
| `28b8693` | Resultado de deploy de revision. |

## 3. Ambiente de revision vigente

### 3.1 Frontend

Firebase Hosting preview channel:

```text
channel: h02-h03-review
url: https://nomina-docente-prod--h02-h03-review-nkv64mlb.web.app
expire time: 2026-06-02 18:45:44
```

Validacion actual:

```text
GET https://nomina-docente-prod--h02-h03-review-nkv64mlb.web.app
Resultado: 200 OK
```

### 3.2 API

Servicio Cloud Run de revision:

```text
servicio: nomina-api-h02h03-review
region: us-central1
revision: nomina-api-h02h03-review-00002-6g5
url publica: https://nomina-api-h02h03-review-443985127112.us-central1.run.app
status url: https://nomina-api-h02h03-review-atsjlgi6ja-uc.a.run.app
```

Healthcheck actual:

```json
{"ok":true,"service":"nomina-docente-api","tables":22,"timestamp":"2026-05-27T00:46:39.322Z"}
```

Validaciones tecnicas ya registradas:

- `GET /health`: 200 OK.
- `GET /auth/session` sin token: 401 esperado.
- CORS desde preview: `OPTIONS /auth/session` 204 con `access-control-allow-origin` correcto.
- Bundle frontend apunta a la API de revision, no a `/api` productivo.

### 3.3 Base de datos

Cloud SQL:

```text
instancia: nomina-docente-web
base revision: nomina_docente_h02h03_review
base productiva: nomina_docente
```

Bases observadas:

| Base | Uso |
|---|---|
| `postgres` | Sistema. |
| `nomina_docente` | Produccion. |
| `nomina_docente_h02h03_review` | Revision H02/H03. |

Conteos documentados despues de importacion de revision:

| Tabla | Registros |
|---|---:|
| `teachers` | 216 |
| `schedules` | 589 |
| `schedule_incidences` | 18 |
| `extra_hours` | 65 |
| `user_coordinations` | 15 |

Validaciones adicionales:

| Validacion | Resultado |
|---|---:|
| Permisos nuevos H03 | 6 |
| Coordinacion reservada `Todas / Global` | 0 |
| Coordinacion reservada `No requiere coordinacion operativa` | 0 |

## 4. Produccion no modificada

Servicio productivo actual:

```text
servicio: nomina-api
revision actual: nomina-api-00043-p96
url: https://nomina-api-atsjlgi6ja-uc.a.run.app
```

Firebase Hosting live:

```text
url: https://nomina-docente-prod.web.app
ultimo release observado: 2026-05-15 13:28:32
```

Confirmacion:

- No se desplego a Hosting live.
- No se actualizo el servicio productivo `nomina-api`.
- No se escribio sobre la base productiva `nomina_docente`.
- La base `nomina_docente_h02h03_review` es separada.

## 5. Cierre funcional de pruebas de revision

Durante las pruebas de revision se validaron los ajustes principales de H02/H03:

| Area | Resultado |
|---|---|
| Control de Accesos | Ya no se usa una lista manual de nombres/personas como alcance operativo visible para Admin. |
| Directorio | `GET /teachers` sigue global; crear/editar/eliminar para Coordinador se controla por capturador cuando aplica; fiscal sigue separado por H03. |
| Horarios | Coordinador puede trabajar con docentes activos; visibilidad/edicion/eliminacion se basa en registros capturados por el usuario. |
| Incidencias | Se muestran y editan en funcion del horario capturado; no se usa `updated_by` como autoria original. |
| Extras | Direccion/Subdireccion puede ver el listado, pero solo modificar extras capturados por el propio usuario. Coordinador tambien edita/elimina solo propios. |
| Docentes compartidos | Un docente puede ser usado por varias coordinaciones; cada coordinador solo modifica lo que capturo. |
| Nomina preview | Coordinador puede ver preview solo lectura; no guarda nomina. |
| Fiscal | `fiscal.view`, `fiscal.manage`, `fiscal.document.view`, `fiscal.document.manage` quedan separados. |
| Finanzas | `finance.view`, `finance.export` y `finance.workflow` quedan separados. |
| H01 | Sin cambios de precision, redondeo o formula. |

Resultado reportado de revision:

```text
Sin bloqueantes funcionales reportados.
Las pruebas pasan en revision.
```

## 6. Conciliacion de nomina validada

Quincena correcta validada:

```text
2026-05-15 a 2026-05-28
```

Resultado conciliado:

| Concepto | Importe |
|---|---:|
| Horarios base | `$393,235.00` |
| Extras | `$128,310.00` |
| Descuento por incidencias | `-$4,035.00` |
| Total conciliado | `$517,510.00` |

Observacion importante:

Una prueba con una quincena nueva `2026-05-15 a 2026-05-28_2DA` arrojo `$521,545.00` porque esa configuracion no tenia incidencias asociadas. La diferencia contra `$517,510.00` corresponde al descuento por incidencias:

```text
$521,545.00 - $4,035.00 = $517,510.00
```

Conclusion:

- No se detecto error en formula.
- No se detecto duplicidad de Horarios.
- No se detecto alteracion de H01.
- La diferencia se explico por datos de incidencias asociados a la configuracion de quincena.

## 7. Logica operacional final antes de produccion

La logica que debe preservarse en produccion es:

1. Un docente puede estar asociado historicamente a una coordinacion/responsable, pero puede impartir clases capturadas por otros coordinadores.
2. Coordinador puede seleccionar docentes activos para capturar Horarios.
3. Coordinador solo ve/modifica/elimina Horarios capturados por el mismo.
4. Incidencias se controlan por el horario capturado.
5. En Extras, cualquier coordinador puede agregar extra a cualquier docente activo.
6. En Extras, cada usuario solo modifica/elimina extras capturados por el mismo.
7. Direccion/Subdireccion puede ver listado de Extras, pero solo modifica lo capturado por el mismo usuario.
8. Fiscal y constancias solo se gestionan con permisos fiscales/documentales H03.
9. Finanzas workflow solo se opera con `finance.workflow`.
10. `payroll.preview` no permite guardar nomina.

`user_coordinations` se conserva como modelo formal y compatibilidad de alcance, pero la operacion diaria aprobada para esta etapa se basa en rol y propiedad de captura.

## 8. Prerequisitos para deploy productivo

Antes de autorizar produccion se requiere:

| Requisito | Estado esperado |
|---|---|
| Aprobacion Admin | Pendiente de confirmacion formal. |
| Ventana productiva | Definir fecha/hora y responsable. |
| Usuarios fuera de captura critica | Confirmar que no hay guardado de nomina en curso. |
| Backup de Cloud SQL | Obligatorio antes de migracion/deploy. |
| Migracion 011 | Aplicar o validar en `nomina_docente` antes de usar el codigo nuevo. |
| Permisos H03 | Validar existencia y asignacion por rol en produccion. |
| Variables Cloud Run | Confirmar `DB_NAME=nomina_docente` y CORS live. |
| Firebase Hosting live | Confirmar que se despliega al canal `live`, no preview. |
| Rollback | Confirmar revision API previa y version Hosting previa. |
| Smoke test por rol | Preparado y ejecutado despues de deploy. |

## 9. Plan de base de datos productiva

### 9.1 Backup obligatorio

Ejecutar antes de cualquier cambio productivo:

```powershell
$gcloud = (Get-Command gcloud.cmd).Source
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
& $gcloud sql export sql nomina-docente-web `
  "gs://nomina-docente-prod-sql-imports/backups/pre-h02h03-$stamp.sql.gz" `
  --database=nomina_docente `
  --project=nomina-docente-prod `
  --quiet
```

### 9.2 Migracion requerida

Aplicar o verificar en produccion:

```text
database/011_h02_h03_user_coordinations_permissions.sql
```

La migracion es no destructiva:

- Crea `user_coordinations`.
- Crea permisos nuevos si no existen.
- Agrega seeds/asignaciones de permisos por rol.
- No elimina permisos existentes.
- No elimina columnas existentes.
- No crea rol tecnico `subdireccion`.
- No crea coordinaciones reservadas.

### 9.3 Validaciones SQL post-migracion

Ejecutar contra `nomina_docente`:

```sql
SELECT current_database();
SELECT to_regclass('public.user_coordinations') AS user_coordinations_table;
SELECT count(*) AS h03_permissions
FROM permissions
WHERE code IN (
  'fiscal.view',
  'fiscal.document.view',
  'fiscal.document.manage',
  'finance.export',
  'finance.workflow',
  'payroll.preview'
);
SELECT count(*) AS reserved_coordinations
FROM coordinations
WHERE name IN ('Todas / Global', 'No requiere coordinacion operativa');
SELECT count(*) AS subdireccion_roles
FROM roles
WHERE code = 'subdireccion';
```

Resultados esperados:

- `user_coordinations_table = public.user_coordinations`
- `h03_permissions = 6`
- `reserved_coordinations = 0`
- `subdireccion_roles = 0`

## 10. Plan de deploy productivo

### 10.1 Validaciones antes de deploy

Ejecutar en la rama aprobada:

```powershell
npm.cmd --workspace apps/api run typecheck
npm.cmd --workspace apps/web run typecheck
npm.cmd run typecheck
npm.cmd run build
git status --short --branch
git log --oneline -5
```

### 10.2 Build de imagen API

Usar tag productivo trazable:

```powershell
$gcloud = (Get-Command gcloud.cmd).Source
$commit = git rev-parse --short HEAD
$image = "us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h02h03-prod-$commit"
& $gcloud builds submit . `
  --config cloudbuild.api.yaml `
  --substitutions _IMAGE=$image `
  --project=nomina-docente-prod
```

### 10.3 Deploy API productiva

Usar el servicio productivo existente:

```powershell
& $gcloud run deploy nomina-api `
  --image $image `
  --project nomina-docente-prod `
  --region us-central1 `
  --platform managed `
  --service-account nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com `
  --allow-unauthenticated `
  --set-cloudsql-instances nomina-docente-prod:us-central1:nomina-docente-web `
  --set-secrets DB_PASSWORD=db-app-nomina-password:latest `
  --set-env-vars "^@^NODE_ENV=production@FIREBASE_PROJECT_ID=nomina-docente-prod@GCP_PROJECT_ID=nomina-docente-prod@ALLOWED_EMAIL_DOMAIN=tecplayacar.edu.mx@CORS_ORIGINS=https://nomina-docente-prod.web.app,http://localhost:5173@DB_NAME=nomina_docente@DB_USER=app_nomina@INSTANCE_CONNECTION_NAME=nomina-docente-prod:us-central1:nomina-docente-web@CONSTANCIAS_BUCKET=nomina-docente-prod-constancias@LEGACY_COORDINATION_FALLBACK_ENABLED=true" `
  --min-instances 0 `
  --max-instances 2 `
  --cpu 1 `
  --memory 512Mi
```

Control critico:

- `DB_NAME` debe ser `nomina_docente`.
- No usar `nomina_docente_h02h03_review`.
- `LEGACY_COORDINATION_FALLBACK_ENABLED` se mantiene `true`.
- No activar modo estricto en este deploy.

### 10.4 Deploy frontend live

Para Hosting live:

```powershell
Remove-Item Env:\VITE_API_BASE_URL -ErrorAction SilentlyContinue
$env:VITE_FIREBASE_PROJECT_ID='nomina-docente-prod'
$env:VITE_FIREBASE_AUTH_DOMAIN='nomina-docente-prod.firebaseapp.com'
npm.cmd --workspace apps/web run build
npx firebase deploy --only hosting --project nomina-docente-prod
```

Nota:

El frontend live puede usar el rewrite `/api/**` de `firebase.json` hacia el servicio productivo `nomina-api`. Si se decide compilar con `VITE_API_BASE_URL`, debe apuntar explicitamente a la API productiva aprobada, no a revision.

## 11. Smoke test productivo posterior

Ejecutar inmediatamente despues del deploy:

| Prueba | Resultado esperado |
|---|---|
| `GET https://nomina-docente-prod.web.app/api/health` | 200 OK. |
| Login Admin | Acceso correcto. |
| Control de Accesos | Sin selector manual de coordinaciones/personas para operacion diaria. |
| Directorio | GET global; Coordinador no edita fiscal. |
| Horarios | Coordinador ve/modifica solo registros capturados. |
| Incidencias | Se controlan por horario capturado. |
| Extras | Direccion/Subdireccion ve listado y modifica solo propios. |
| Fiscal RH/Finanzas | Fiscal/documentos disponibles solo con permisos H03. |
| Finanzas | Export y workflow separados. |
| Nomina preview Coordinador | Solo lectura, sin guardar. |
| Guardar nomina Admin | Permitido solo con `payroll.finalize`. |
| Total quincena `2026-05-15 a 2026-05-28` | `$517,510.00` si los mismos datos estan vigentes. |

## 12. Rollback productivo

### 12.1 API

Revision productiva previa documentada:

```text
nomina-api-00043-p96
```

Rollback por trafico:

```powershell
& $gcloud run services update-traffic nomina-api `
  --region us-central1 `
  --project nomina-docente-prod `
  --to-revisions nomina-api-00043-p96=100
```

### 12.2 Frontend

Opciones:

1. Restaurar version anterior desde Firebase Hosting console.
2. Re-deploy del build anterior si esta disponible.
3. Mantener URL de revision despublicada y volver a live previo.

### 12.3 Base de datos

La migracion 011 es no destructiva. Si el problema es de permisos o datos:

- Revertir trafico API primero.
- Revisar permisos nuevos agregados.
- No borrar tablas sin diagnostico.
- Si se requiere restauracion completa, usar el backup `pre-h02h03-*.sql.gz`.

## 13. Limpieza posterior de revision

Despues de deploy productivo validado y aprobado:

```powershell
& $gcloud run services delete nomina-api-h02h03-review `
  --project=nomina-docente-prod `
  --region=us-central1 `
  --quiet

npx firebase hosting:channel:delete h02-h03-review `
  --project nomina-docente-prod `
  --force
```

La base `nomina_docente_h02h03_review` debe eliminarse solo despues de confirmar que ya no se necesita para auditoria o comparacion.

## 14. Veredicto de preparacion

Estado:

```text
Listo para solicitar aprobacion Admin y programar deploy productivo controlado.
```

No se recomienda desplegar automaticamente. El siguiente paso debe ser:

1. Aprobacion Admin sobre este cierre.
2. Definir ventana productiva.
3. Ejecutar backup.
4. Validar migracion 011 en produccion.
5. Deploy API productiva.
6. Deploy Hosting live.
7. Smoke test por rol.
8. Mantener monitoreo durante la primera captura/quincena posterior.
