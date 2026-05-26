# H02/H03 Fase 2 - Preparacion de Deploy de Revision

## 1. Objetivo

Preparar el deploy de revision de H02/H03 sin tocar produccion.

Esta fase no despliega, no ejecuta migraciones productivas y no cambia datos. Su objetivo es dejar claro el ambiente, los comandos, los controles y la logica operacional que debe preservarse antes de publicar una revision para pruebas.

## 2. Fuentes revisadas

- `docs/specs/SPEC_H02_H03_Usuario_Coordinacion_Permisos.md`
- `docs/diseno/DISENO_TECNICO_H02_H03_Usuario_Coordinacion_Permisos.md`
- `docs/diseno/FLUJO_TRABAJO_H02_H03.md`
- `docs/auditoria/H02_H03_Ajuste_Docentes_Compartidos.md`
- `docs/auditoria/H02_H03_Conciliacion_Nomina_Mayo_2026.md`
- `firebase.json`
- `cloudbuild.api.yaml`
- `apps/api/.env.example`
- `apps/web/.env.example`
- `README.md`

## 3. Decision de alcance

La SPEC original de H02/H03 define `user_coordinations` como fuente formal objetivo para evitar resolver permisos por texto. Durante validacion local se ajusto la logica operacional para respetar el modelo real de la escuela:

- Un docente puede estar asociado a un responsable operativo, pero puede impartir clases capturadas por otros coordinadores.
- Un Coordinador puede capturar Horarios y Extras para cualquier docente activo.
- El usuario solo puede modificar lo que capturo.
- Directorio, Horarios e Incidencias usan `created_by` como propiedad operativa.
- Extras usa `captured_by` como propiedad operativa.
- El catalogo `coordinations` queda como etiqueta tecnica/legacy para reportes, nomina e importaciones mientras el modelo historico lo requiera.
- Control de Accesos no debe mostrar al Admin una lista manual de nombres/personas/combinaciones como alcance operativo.

Esta fase debe conservar esa logica por capturador y no volver al selector manual de coordinaciones para operacion diaria.

## 4. Estado local base

Rama:

```text
feature/h02-h03-user-coordinations-permissions
```

Commit base para revision:

```text
22b76a7 fix(h02-h03): align operational scope with captured records
```

Base local/revision verificada:

```text
host: localhost
port: 55432
db: nomina_docente_deploy_snapshot_20260526_111616_h02h03
user: app_nomina
```

Conteo local observado:

| Tabla | Registros |
|---|---:|
| app_users | 19 |
| coordinations | 27 |
| teachers | 216 |
| schedules | 589 |
| schedule_incidences | 18 |
| extra_hours | 65 |
| payroll_runs | 3 |
| user_coordinations | 15 |

Quincena viva para pruebas:

```text
2026-05-15 a 2026-05-28
```

Datos vivos confirmados:

- Incidencias: 18
- Faltas: 30
- Retardos: 0
- Extras: 65
- Horas extra: 1025.0
- Importe extras: 128310.00
- Corrida de la quincena actual: existe en estado CANCELADA, lo que permite que Incidencias y Extras vuelvan a estar disponibles para captura/pruebas.

## 5. Ambiente destino recomendado

No usar produccion directa.

Crear o usar un ambiente de revision con:

| Componente | Recomendacion |
|---|---|
| API | Servicio Cloud Run separado, por ejemplo `nomina-api-h02h03-review`, o revision sin trafico/tag de revision. |
| Base de datos | Base de revision en Cloud SQL, por ejemplo `nomina_docente_h02h03_review`, cargada desde la copia local/controlada. |
| Frontend | Firebase Hosting preview channel, por ejemplo `h02-h03-review`. |
| Auth | Firebase Auth real del proyecto `nomina-docente-prod`, solo para validar sesiones reales. |
| Storage constancias | No validar documentos reales salvo que Admin lo autorice. |

Control critico:

`firebase.json` tiene rewrite de `/api/**` al servicio productivo `nomina-api`. Por eso, para el preview de H02/H03 el frontend debe compilarse con `VITE_API_BASE_URL` apuntando explicitamente a la API de revision.

No se debe confiar en `/api` dentro del preview si el objetivo es probar la API de revision.

## 6. Variables API de revision

Variables esperadas para Cloud Run revision:

```text
NODE_ENV=production
FIREBASE_PROJECT_ID=nomina-docente-prod
GCP_PROJECT_ID=nomina-docente-prod
ALLOWED_EMAIL_DOMAIN=tecplayacar.edu.mx
CORS_ORIGINS=<URL_FIREBASE_PREVIEW>,<URL_API_REVISION>,http://localhost:5173
DB_NAME=nomina_docente_h02h03_review
DB_USER=app_nomina
INSTANCE_CONNECTION_NAME=nomina-docente-prod:us-central1:nomina-docente-web
CONSTANCIAS_BUCKET=nomina-docente-prod-constancias
LEGACY_COORDINATION_FALLBACK_ENABLED=true
```

Secret:

```text
DB_PASSWORD=db-app-nomina-password:latest
```

Notas:

- `LEGACY_COORDINATION_FALLBACK_ENABLED` se conserva activo temporalmente.
- No activar modo estricto.
- No retirar fallback legacy.
- No cambiar permisos productivos fuera de la BD de revision.

## 7. Variables frontend de revision

Antes del build de frontend para preview:

```powershell
$env:VITE_API_BASE_URL='<URL_API_REVISION>'
$env:VITE_FIREBASE_PROJECT_ID='nomina-docente-prod'
$env:VITE_FIREBASE_AUTH_DOMAIN='nomina-docente-prod.firebaseapp.com'
```

Despues ejecutar:

```powershell
npm.cmd --workspace apps/web run build
npx firebase hosting:channel:deploy h02-h03-review --project nomina-docente-prod --expires 7d
```

El preview debe validarse contra la API configurada en `VITE_API_BASE_URL`, no contra `/api`.

## 8. Plan de base de datos de revision

La BD de revision debe venir de la copia local/controlada, no de escrituras directas sobre produccion.

Opciones permitidas:

1. Exportar desde la BD local verificada e importar a una BD de revision en Cloud SQL.
2. Crear copia de Cloud SQL y aplicar sobre esa copia los datos ya conciliados.
3. Usar una base de revision existente, siempre que se valide que contiene migracion 011, permisos H03 y datos vivos de la quincena.

Validaciones minimas antes de usarla:

```sql
SELECT current_database();
SELECT count(*) FROM user_coordinations;
SELECT count(*) FROM teachers;
SELECT count(*) FROM schedules;
SELECT count(*) FROM schedule_incidences;
SELECT count(*) FROM extra_hours;
SELECT count(*) FROM permissions WHERE code IN (
  'fiscal.view',
  'fiscal.document.view',
  'fiscal.document.manage',
  'finance.export',
  'finance.workflow',
  'payroll.preview'
);
SELECT count(*) FROM coordinations WHERE name IN ('Todas / Global', 'No requiere coordinacion operativa');
```

Resultados esperados:

- `user_coordinations` existe.
- Permisos nuevos H03 existen.
- No existe coordinacion `"Todas / Global"`.
- No existe coordinacion `"No requiere coordinacion operativa"`.
- Incidencias y Extras de la quincena actual estan disponibles.

## 9. Comandos API de revision

Imagen sugerida:

```powershell
$gcloud = 'C:\Users\Admin\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
$image = 'us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h02h03-22b76a7'
```

Build:

```powershell
& $gcloud builds submit . `
  --config cloudbuild.api.yaml `
  --substitutions _IMAGE=$image `
  --project=nomina-docente-prod
```

Deploy de revision recomendado como servicio separado:

```powershell
& $gcloud run deploy nomina-api-h02h03-review `
  --image $image `
  --project nomina-docente-prod `
  --region us-central1 `
  --platform managed `
  --service-account nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com `
  --allow-unauthenticated `
  --set-cloudsql-instances nomina-docente-prod:us-central1:nomina-docente-web `
  --set-secrets DB_PASSWORD=db-app-nomina-password:latest `
  --set-env-vars "^@^NODE_ENV=production@FIREBASE_PROJECT_ID=nomina-docente-prod@GCP_PROJECT_ID=nomina-docente-prod@ALLOWED_EMAIL_DOMAIN=tecplayacar.edu.mx@CORS_ORIGINS=<URL_FIREBASE_PREVIEW>,http://localhost:5173@DB_NAME=nomina_docente_h02h03_review@DB_USER=app_nomina@INSTANCE_CONNECTION_NAME=nomina-docente-prod:us-central1:nomina-docente-web@CONSTANCIAS_BUCKET=nomina-docente-prod-constancias@LEGACY_COORDINATION_FALLBACK_ENABLED=true" `
  --min-instances 0 `
  --max-instances 1 `
  --cpu 1 `
  --memory 512Mi
```

No usar el servicio productivo `nomina-api` para esta revision salvo que sea una revision sin trafico y con tag controlado.

## 10. Validaciones previas al deploy de revision

Ejecutar antes de cualquier deploy:

```powershell
npm.cmd --workspace apps/api run typecheck
npm.cmd --workspace apps/web run typecheck
npm.cmd run typecheck
npm.cmd run build
git status --short --branch
git log --oneline -6
```

Confirmar:

- Working tree limpio.
- Rama correcta.
- Commit `22b76a7` o posterior aprobado.
- Build correcto.
- No hay cambios no commiteados.
- Ambiente destino es revision, no produccion.

## 11. Smoke test de revision

### Healthcheck

```powershell
Invoke-RestMethod <URL_API_REVISION>/health
```

Esperado:

```json
{
  "ok": true,
  "service": "nomina-docente-api"
}
```

### Roles minimos

| Rol | Prueba |
|---|---|
| Admin | Login, Control de Accesos, crear/editar usuario, sin selector manual de coordinaciones operativas. |
| Coordinador | Crear docente/horario/extra; solo editar registros capturados por su usuario. |
| Direccion/Subdireccion | Ver Extras; modificar solo extras capturados por su usuario; sin workflow financiero. |
| RH | Ver/editar fiscal y documentos; sin workflow financiero. |
| Finanzas | Ver fiscal, exportar finanzas y workflow con `finance.workflow`. |
| Contador/Contabilidad | Exportar; sin fiscal ni workflow. |

### Pruebas de H03 obligatorias

- `finance.view` solo consulta.
- `finance.export` controla exportaciones.
- `finance.workflow` controla aprobar, marcar pagada y cancelar.
- `fiscal.manage` controla RFC, correo, banco y tipo de pago.
- `fiscal.document.view` controla descarga/ver constancia.
- `fiscal.document.manage` controla subida/reemplazo.
- `payroll.preview` no guarda nomina.
- `payroll.finalize` conserva guardado de nomina.

### Pruebas de logica operacional

- Coordinador puede elegir cualquier docente activo para Horarios.
- Horarios mostrados al Coordinador corresponden a `schedules.created_by`.
- Incidencias editables corresponden a horarios propios.
- Extras mostrados/editables para Coordinador corresponden a `extra_hours.captured_by`.
- Direccion/Subdireccion ve listado de Extras pero solo modifica propios.
- No se muestra selector manual de nombres/combinaciones como alcance operativo.

## 12. Rollback de revision

API:

- Eliminar o dejar inactivo el servicio `nomina-api-h02h03-review`.
- Si se uso revision sin trafico/tag, retirar el tag.

Frontend:

```powershell
npx firebase hosting:channel:delete h02-h03-review --project nomina-docente-prod
```

BD:

- Descartar la BD de revision.
- Restaurar dump previo si se requiere repetir pruebas.

Produccion:

- Sin rollback productivo si esta fase se ejecuta correctamente, porque no se modifica produccion.

## 13. Restricciones

No hacer en Fase 2:

- No desplegar a Hosting productivo.
- No desplegar al servicio productivo `nomina-api` con trafico.
- No ejecutar migraciones contra produccion.
- No modificar H01.
- No cambiar formula de nomina.
- No retirar fallback legacy.
- No activar modo estricto.
- No crear rol tecnico `subdireccion`.
- No tratar `"Todas / Global"` como coordinacion real.
- No tratar `"No requiere coordinacion operativa"` como coordinacion real.
- No cambiar H03 para permitir workflow con `finance.view`.

## 14. Criterio de cierre

Fase 2 queda lista cuando:

- Documento de preparacion queda versionado.
- Typecheck/build siguen correctos.
- Working tree queda limpio.
- Se confirma que el deploy de revision usara API y BD de revision.
- Se confirma que el frontend preview no apuntara al rewrite productivo `/api`.
- Se mantiene la logica operacional por capturador.

## 15. Siguiente paso

Fase 3 recomendada:

Ejecutar el deploy de revision con:

- API de revision.
- BD de revision cargada con datos actuales.
- Hosting preview channel.
- Smoke test por rol.

