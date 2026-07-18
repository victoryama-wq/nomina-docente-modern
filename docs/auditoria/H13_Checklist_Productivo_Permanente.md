# H13 - Checklist productivo permanente

Fecha: 2026-06-03
Ultima actualizacion de estado productivo: 2026-07-16

## 1. Resumen ejecutivo

H13 cierra como control documental y operativo permanente para despliegues productivos de Nomina Docente.

El sistema productivo vigente ya funciona sobre Firebase Hosting, Cloud Run, Cloud SQL PostgreSQL y Cloud Storage. H13 no introduce cambios tecnicos; documenta la configuracion esperada, las prohibiciones, los pasos de predeploy/deploy/postdeploy y el rollback minimo para reducir riesgo operativo en futuras ventanas.

Alcance de H13:

- No modifica codigo.
- No modifica base de datos.
- No ejecuta migraciones.
- No cambia Cloud Run.
- No cambia Firebase Hosting.
- No cambia secretos.
- No cambia CORS.
- No hace deploy.
- No toca produccion.

## 2. Estado productivo vigente

| Elemento | Valor documentado vigente |
|---|---|
| Proyecto GCP/Firebase | `nomina-docente-prod` |
| Firebase Hosting | Sitio `nomina-docente-prod`, canal `live` |
| URL frontend | `https://nomina-docente-prod.web.app` |
| API via Hosting | `https://nomina-docente-prod.web.app/api/health` |
| Cloud Run API | Servicio `nomina-api` |
| Region Cloud Run | `us-central1` |
| URL Cloud Run directa | `https://nomina-api-443985127112.us-central1.run.app` |
| Revision Cloud Run vigente documentada | `nomina-api-00051-9s5` |
| Imagen API vigente H20 | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h20-prod-56553f4` |
| Imagen API H11 documentada | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h11-prod-4e0c214` |
| Firebase Hosting release vigente | `1784228039752000` |
| Firebase Hosting version vigente | `41bf160c7c3595b6` |
| Instancia Cloud SQL | `nomina-docente-web` |
| Base productiva | `nomina_docente` |
| Usuario DB aplicativo | `app_nomina` |
| Cloud SQL connection name | `nomina-docente-prod:us-central1:nomina-docente-web` |
| Bucket de constancias | `nomina-docente-prod-constancias` |
| Service account API | `nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com` |
| Fallback H02 | `LEGACY_COORDINATION_FALLBACK_ENABLED=true` en monitoreo |

La revision vigente debe confirmarse antes de cada deploy con Cloud Run. Este checklist conserva su origen H13 y actualiza el ultimo estado conocido despues del cierre operativo H20.

## 3. Variables no secretas Cloud Run

Estas variables pueden documentarse y revisarse en checklist, pero no deben cambiarse sin aprobacion de release.

| Variable | Valor productivo esperado | Tipo | Observacion |
|---|---|---|---|
| `NODE_ENV` | `production` | No secreta | Debe estar en `production` para Cloud Run live. |
| `FIREBASE_PROJECT_ID` | `nomina-docente-prod` | No secreta | Usada por Firebase Admin. |
| `GCP_PROJECT_ID` | `nomina-docente-prod` | No secreta | Proyecto GCP operativo. |
| `ALLOWED_EMAIL_DOMAIN` | `tecplayacar.edu.mx` | No secreta | Control de dominio institucional. |
| `CORS_ORIGINS` | `https://nomina-docente-prod.web.app,https://nomina-docente-prod.firebaseapp.com,http://localhost:5173` | No secreta | No ampliar sin justificacion; `localhost` queda para desarrollo local controlado. |
| `DB_NAME` | `nomina_docente` | No secreta sensible operativa | Debe apuntar solo a la base productiva en Cloud Run live. |
| `DB_USER` | `app_nomina` | No secreta sensible operativa | Usuario aplicativo; permisos deben mantenerse restringidos. |
| `INSTANCE_CONNECTION_NAME` | `nomina-docente-prod:us-central1:nomina-docente-web` | No secreta | Cloud SQL asociado a produccion. |
| `CONSTANCIAS_BUCKET` | `nomina-docente-prod-constancias` | No secreta | Bucket fiscal/documental productivo. |
| `LEGACY_COORDINATION_FALLBACK_ENABLED` | `true` | No secreta | Mantener mientras H02 siga en monitoreo; no retirar sin decision humana. |

No documentar ni imprimir valores de `DB_PASSWORD` ni credenciales privadas.

## 4. Secretos y credenciales

| Secreto / credencial | Ubicacion esperada | Como se usa | Regla |
|---|---|---|---|
| `DB_PASSWORD` | Secret Manager, `db-app-nomina-password:latest` | Inyectado a Cloud Run como variable secreta | No imprimir, no copiar a docs, no guardar en repo. |
| Firebase Admin | Application Default Credentials de Cloud Run mediante service account | `firebase-admin` inicializa con `projectId` | No usar archivo JSON de service account en repo. |
| Firebase client config | Variables `VITE_FIREBASE_*` del build web | Configuracion publica del cliente Firebase | API key cliente no es password, pero no debe confundirse con secretos backend. |
| Acceso Cloud SQL | Cloud Run service account + Cloud SQL attached instance | Conexion por `/cloudsql/INSTANCE_CONNECTION_NAME` en produccion | No usar IP publica ni credenciales manuales en runtime productivo. |
| Cloud Storage constancias | Service account API con permisos controlados | Lectura/escritura autorizada desde backend | No exponer URLs/documentos fiscales sin permisos H03. |

Checklist de secretos:

- [ ] Confirmar que `DB_PASSWORD` se inyecta desde Secret Manager.
- [ ] Confirmar que no se imprime el valor del secreto en consola o documentos.
- [ ] Confirmar que no hay archivos `.env` reales versionados.
- [ ] Confirmar que no se suben llaves JSON de Firebase/GCP.
- [ ] Confirmar que el service account productivo es el esperado.

## 5. Firebase Hosting

Configuracion versionada:

- Archivo: `firebase.json`.
- Directorio publico: `apps/web/dist`.
- Rewrite `/api/**` hacia Cloud Run:
  - servicio `nomina-api`;
  - region `us-central1`.
- Fallback SPA: `**` hacia `/index.html`.
- Headers:
  - cache inmutable para JS/CSS;
  - `X-Frame-Options=DENY`;
  - `X-Content-Type-Options=nosniff`.

Checklist Hosting:

- [ ] Confirmar proyecto `.firebaserc`: `nomina-docente-prod`.
- [ ] Confirmar canal: `live`.
- [ ] Confirmar que el build web no apunta a una API preview.
- [ ] Confirmar que el rewrite `/api/**` sigue apuntando a `nomina-api`.
- [ ] Confirmar que no se cambia `firebase.json` sin revision.
- [ ] Confirmar raiz Hosting `/` responde 200 despues de deploy.
- [ ] Confirmar `/api/health` via Hosting responde 200 despues de deploy.

Comando de verificacion permitido en predeploy:

```powershell
firebase hosting:channel:list --project nomina-docente-prod
```

No ejecutar deploy desde H13. Para una ventana futura, el deploy Hosting debe estar aprobado por release.

## 6. Cloud Run

Configuracion productiva documentada:

| Elemento | Valor |
|---|---|
| Servicio | `nomina-api` |
| Region | `us-central1` |
| Service account | `nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com` |
| Cloud SQL attached | `nomina-docente-prod:us-central1:nomina-docente-web` |
| CPU documentada | `1` |
| Memoria documentada | `512Mi` |
| Max instances documentadas | `2` en H11; revisar si se cambia por ventana futura |
| Concurrency documentada | `80` |
| Timeout documentado | `300` |
| Trafico esperado | `100%` a la revision vigente despues de deploy |

Checklist Cloud Run:

- [ ] Confirmar revision actual antes de deploy.
- [ ] Registrar revision anterior para rollback.
- [ ] Confirmar imagen/tag a desplegar.
- [ ] Confirmar service account.
- [ ] Confirmar Cloud SQL attached.
- [ ] Confirmar variables no secretas.
- [ ] Confirmar secreto `DB_PASSWORD` desde Secret Manager.
- [ ] Confirmar que no se cambian CORS/secretos si no hay razon aprobada.
- [ ] Confirmar healthcheck directo Cloud Run despues de deploy.
- [ ] Confirmar logs `severity>=ERROR` de la revision nueva.

Healthchecks:

```text
GET https://nomina-api-443985127112.us-central1.run.app/api/health
GET https://nomina-docente-prod.web.app/api/health
GET https://nomina-docente-prod.web.app/api/auth/session
```

Resultados esperados:

- `/api/health`: `200`.
- `/api/auth/session` sin token: `401` esperado.

## 7. Cloud SQL y H05

Estado H05 productivo:

- Tablas administrativas existentes:
  - `schema_migrations`;
  - `schema_migration_runs`.
- Baseline productivo:
  - 15 migraciones registradas;
  - `pending = 0`;
  - `checksum mismatch = 0`.
- Migraciones historicas `001` a `012` no deben reaplicarse.
- Desde `013` queda prohibido repetir prefijos numericos.

Reglas:

- `npm run db:migrate:inspect` es el comando de lectura previa.
- `npm run db:migrate:status` revisa estado H05.
- `npm run db:migrate:dry-run` no ejecuta SQL funcional, pero puede registrar corrida en `schema_migration_runs`.
- `npm run db:migrate` / `apply` solo puede ejecutarse con backup, ventana aprobada y confirmaciones productivas.
- No ejecutar `apply` si hay `checksum mismatch`.
- No editar migraciones historicas.
- No usar bases locales/test como fuente productiva.

Checklist H05 antes de cualquier deploy:

- [ ] Confirmar que no existe migracion nueva no aprobada.
- [ ] Si hay migracion nueva, confirmar SPEC/diseno/backup/H05.
- [ ] Ejecutar `inspect` si se requiere revision productiva.
- [ ] Confirmar `pending=0` y `checksum mismatch=0` cuando no hay migracion.
- [ ] Si hay migracion futura, aplicar solo con backup y aprobacion explicita.

H13 no ejecuta H05 contra produccion.

## 8. Cloud Storage

Bucket productivo:

```text
nomina-docente-prod-constancias
```

Uso:

- Constancias/documentos fiscales.
- Acceso controlado por backend y permisos H03.

Reglas:

- No exponer documentos fiscales publicamente.
- No cambiar bucket sin decision de seguridad.
- No descargar masivamente documentos fiscales para pruebas.
- No documentar datos fiscales sensibles.
- No usar Storage productivo para pruebas locales.

## 9. Checklist predeploy permanente

Antes de cualquier deploy productivo:

- [ ] Rama correcta y sincronizada con `origin`.
- [ ] Working tree limpio.
- [ ] Commit a desplegar identificado.
- [ ] Scope del cambio documentado.
- [ ] Confirmado si requiere migracion o no.
- [ ] H05 revisado; `pending=0` y `checksum mismatch=0` si no hay migracion.
- [ ] Backup Cloud SQL preventivo creado si el release lo requiere.
- [ ] Variables Cloud Run revisadas.
- [ ] Secretos revisados sin imprimir valores.
- [ ] CORS revisado.
- [ ] Firebase Hosting rewrite revisado.
- [ ] Validaciones automatizadas ejecutadas:
  - `npm run test`;
  - `npm run test:api`;
  - `npm run test:api:integration`;
  - `npm run test:web`;
  - `npm --workspace apps/api run typecheck`;
  - `npm --workspace apps/web run typecheck`;
  - `npm run typecheck`;
  - `npm run build`.
- [ ] Plan de smoke test definido.
- [ ] Plan de rollback definido.
- [ ] Confirmacion humana de ventana productiva.

## 10. Checklist deploy permanente

Durante una ventana de deploy aprobada:

- [ ] Registrar hora de inicio.
- [ ] Registrar backup preventivo si aplica.
- [ ] Construir imagen API con tag de commit.
- [ ] Desplegar Cloud Run conservando variables, secretos y Cloud SQL attached.
- [ ] Registrar revision anterior y nueva.
- [ ] Confirmar trafico `100%` a la revision nueva.
- [ ] Construir frontend.
- [ ] Desplegar Firebase Hosting live.
- [ ] Confirmar canal `live`.
- [ ] Confirmar que no se ejecutaron seeds ni importaciones.
- [ ] Confirmar que no se copiaron datos locales/test a produccion.

## 11. Checklist postdeploy permanente

Despues de deploy:

- [ ] Healthcheck Cloud Run directo `/api/health` = 200.
- [ ] Healthcheck via Hosting `/api/health` = 200.
- [ ] `/api/auth/session` sin token = 401 esperado.
- [ ] Raiz Hosting `/` = 200.
- [ ] Logs Cloud Run revision nueva sin errores criticos.
- [ ] Smoke test por rol o modulo segun alcance.
- [ ] Confirmar que no se ejecutaron migraciones si el release no las requeria.
- [ ] Confirmar que no se modificaron datos si el release era solo codigo.
- [ ] Documentar resultado en `docs/auditoria/*Deploy_Productivo_Resultado.md`.
- [ ] Crear commit documental si se actualizo evidencia.
- [ ] Push de rama.

## 12. Rollback

### 12.1 API Cloud Run

Rollback esperado:

- mover trafico a la revision anterior documentada; o
- redeploy de imagen anterior aprobada.

Modelo de comando:

```powershell
gcloud run services update-traffic nomina-api `
  --project nomina-docente-prod `
  --region us-central1 `
  --to-revisions <REVISION_ANTERIOR>=100
```

No ejecutar rollback sin aprobacion durante H13.

### 12.2 Firebase Hosting

Rollback esperado:

- rollback de la version live anterior desde Firebase Hosting; o
- redeploy del build anterior si se cuenta con artefacto.

Verificaciones despues de rollback:

- raiz `/` 200;
- `/api/health` 200;
- login basico;
- smoke del modulo afectado.

### 12.3 Base de datos

Si no hubo migracion:

- no hay rollback DB.

Si hubo migracion futura:

- usar H05;
- revisar backup;
- definir rollback manual especifico;
- no ejecutar DROP/UPDATE masivo sin aprobacion DBA/Admin;
- documentar impacto funcional.

## 13. Prohibiciones permanentes

Queda prohibido en cualquier release sin aprobacion explicita:

- Ejecutar migraciones productivas sin H05, backup y confirmacion.
- Ejecutar `npm run db:migrate` o `db:migrate:apply` contra produccion sin ventana aprobada.
- Reaplicar migraciones historicas `001` a `012`.
- Modificar `DB_PASSWORD` fuera de Secret Manager.
- Imprimir secretos en logs, consola, commits o documentos.
- Usar datos de `nomina_docente_test`, `nomina_docente_h02h03` o seeds como fuente productiva.
- Importar datos locales/test a produccion sin plan formal.
- Cambiar CORS para permitir origenes no aprobados.
- Cambiar service account productivo sin revision de permisos.
- Cambiar bucket de constancias sin revision de seguridad.
- Ejecutar cierre de ciclo real sin aprobacion operativa.
- Cambiar H01/H02/H03/H05/H09/H10/H11/H12 sin SPEC o decision humana.

## 14. Evidencia por deploy

Cada deploy productivo debe registrar una fila equivalente:

| Fecha | Commit | API revision anterior | API revision nueva | Hosting release | Backup | Migracion | Healthcheck | Smoke | Documento |
|---|---|---|---|---|---|---|---|---|---|
| 2026-05-27 | `6ff6516` | `nomina-api-00043-p96` | `nomina-api-00044-pk9` | `2026-05-27 11:44:21` | SQL GCS pre-H02/H03 | 011 | OK | OK lectura | `H02_H03_Deploy_Productivo_Resultado.md` |
| 2026-06-01 | `0c5c8b5` | `nomina-api-00044-pk9` | `nomina-api-00045-v8h` | `2026-06-01 16:15:53` | `1780348318919` | No | OK | OK no destructivo | `H09_H10_Deploy_Productivo_Resultado.md` |
| 2026-06-03 | `4e0c214` | `nomina-api-00045-v8h` | `nomina-api-00046-6ck` | `2026-06-03 10:21:16` | `1780499832076` | No | OK | CSV OK autorizado | `H11_Deploy_Productivo_Resultado.md` y `H11_Cierre_CSV_UTF8_PostDeploy.md` |
| 2026-06-03 | `0989092` | `nomina-api-00046-6ck` | `nomina-api-00046-6ck` | `2026-06-03 15:16:08` | `1780517600085` | No | OK | H15 sesion/logout OK; API no desplegada | `H15_Deploy_Productivo_Resultado.md` |

## 15. Relacion con fases cerradas

| Fase | Relacion con H13 |
|---|---|
| H01 | H13 prohibe tocar formula, precision o reglas monetarias sin SPEC y pruebas. |
| H02/H03 | H13 preserva variables, fallback y permisos productivos; no cambia roles. |
| H04 | H13 exige pruebas automatizadas antes de deploy. |
| H05 | H13 usa H05 como control obligatorio para migraciones futuras. |
| H06/H14 | H13 mantiene Apps Script legacy fuera de operacion. |
| H09/H10 | H13 recuerda que cierre de ciclo real es irreversible y requiere aprobacion. |
| H11 | H13 conserva evidencia de deploy y smoke CSV. |
| H12 | H13 respeta politica de no intervencion sobre catalogos historicos. |
| H15 | H13 exige backup, healthcheck y smoke de sesion para cambios de autenticacion frontend. |

## 16. Estado final H13

H13 queda cerrado documentalmente como checklist productivo permanente.

Criterio de cierre:

- Checklist creado.
- Matriz formal actualizada.
- SDD consolidado actualizado.
- README referenciado.
- No se realizaron cambios tecnicos.

Uso futuro:

- Leer este documento antes de cualquier deploy productivo.
- Actualizarlo si cambia infraestructura real, secretos, CORS, Cloud Run, Hosting o proceso H05.

## 17. Confirmaciones

Confirmado para esta entrega H13:

- No se modifico codigo.
- No se modifico base de datos.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se toco produccion.
- No se cambiaron variables Cloud Run.
- No se cambiaron secretos.
- No se cambio CORS.
- No se cambio Firebase Hosting.
- No se cambio Cloud SQL.
- No se cambiaron reglas de negocio.
