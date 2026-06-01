# H09/H10 - Deploy productivo controlado

Fecha: 2026-06-01  
Proyecto: `nomina-docente-prod`  
Servicio API: `nomina-api`  
Region: `us-central1`  
Hosting: `nomina-docente-prod`, canal `live`

## 1. Alcance

Se desplegaron cambios H09/H10 a produccion:

- estados financieros seguros;
- ciclo `PLANEACION` como borrador operativo para Horarios;
- cierre controlado de ciclo/cuatrimestre;
- frontend de estados y cierre controlado;
- correcciones previas de selector de responsable operativo en Horarios.

No se ejecutaron migraciones, seeds, importaciones ni sincronizaciones de datos.

## 2. Commit desplegado

```text
0c5c8b5 docs(h09-h10): add predeploy validation report
```

Imagen API construida:

```text
us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h09h10-prod-0c5c8b5
```

Cloud Build:

```text
2797734f-6a43-42c8-88f7-ab01e456c262
STATUS: SUCCESS
digest: sha256:391fa6fed34a1499d6bcda324f078816c81185fc7a77e0fee70380f743237c1b
```

## 3. Backup preventivo

Backup Cloud SQL creado antes del deploy:

| Campo | Valor |
|---|---|
| Backup ID | `1780348318919` |
| Estado | `SUCCESSFUL` |
| Tipo | `ON_DEMAND` |
| Instancia | `nomina-docente-web` |
| Base protegida | `nomina_docente` |
| Inicio UTC | `2026-06-01T21:11:58.934Z` |
| Fin UTC | `2026-06-01T21:12:49.678Z` |
| Descripcion | `pre-h09h10-deploy-20260601-161156 commit-0c5c8b5` |

## 4. Deploy API Cloud Run

Revision anterior:

```text
nomina-api-00044-pk9
```

Revision nueva:

```text
nomina-api-00045-v8h
```

Resultado:

- revision `nomina-api-00045-v8h` desplegada;
- 100% del trafico dirigido a la nueva revision;
- URL publica: `https://nomina-api-443985127112.us-central1.run.app`;
- URL interna reportada por Cloud Run: `https://nomina-api-atsjlgi6ja-uc.a.run.app`.

Configuracion confirmada:

| Variable / recurso | Valor |
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
| `DB_PASSWORD` | Secret Manager, no impreso |
| Service account | `nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com` |

## 5. Deploy Firebase Hosting

Deploy live completado:

```text
firebase deploy --only hosting --project nomina-docente-prod
```

Resultado:

- sitio: `nomina-docente-prod`;
- canal: `live`;
- URL: `https://nomina-docente-prod.web.app`;
- release live reportado por `firebase hosting:channel:list`: `2026-06-01 16:15:53`;
- rewrite `/api/**` conserva destino Cloud Run `nomina-api` en `us-central1`.

Nota: la version instalada de Firebase CLI no expone el comando `hosting:releases:list`; se uso `hosting:channel:list` para confirmar canal live.

## 6. Healthcheck

| Verificacion | Resultado |
|---|---|
| Cloud Run directo `/api/health` | `200`, `{"ok":true,"service":"nomina-docente-api","tables":33,...}` |
| Hosting `/api/health` | `200`, `{"ok":true,"service":"nomina-docente-api","tables":33,...}` |
| Hosting `/api/auth/session` sin token | `401` esperado |
| Hosting raiz `/` | `200`, carga HTML de la app |
| Logs Cloud Run `severity>=ERROR` revision nueva | Sin resultados en la consulta posterior inicial |

## 7. Smoke test post-deploy

Smoke no destructivo con sesion Admin existente:

| Area | Resultado |
|---|---|
| Login/sesion Admin | Activa como `Victor Yama`, rol Administrador |
| Horarios | Carga correcta en produccion; se observa ciclo `ACTIVO` y listado operativo |
| CalendarView | Carga correcta; muestra panel `CIERRE CONTROLADO H10` |
| CalendarView | Muestra `Planeacion/Borrador` en el flujo de cierre |
| CalendarView | Muestra advertencia de compatibilidad administrativa legacy para activacion manual |
| Finanzas | Carga corrida `PAGADA` de segunda quincena de mayo |
| Finanzas | No se muestra accion de cancelar para corrida `PAGADA` |

No se ejecuto cierre real de ciclo.  
No se cambio estado financiero.  
No se modificaron registros operativos.

## 8. Confirmacion sin migracion

- No se creo migracion `013`.
- No se ejecuto `npm run db:migrate`.
- No se ejecuto `npm run db:migrate:apply`.
- No se ejecuto `npm run db:migrate:baseline`.
- No se ejecuto `psql -f database/*.sql`.
- No se ejecuto seed.
- No se importaron datos.
- No se sincronizaron datos desde BD local/test a produccion.
- No se modifico Cloud SQL salvo el backup preventivo.

## 9. Riesgos y observaciones

| Riesgo / observacion | Estado | Mitigacion |
|---|---|---|
| Cierre de ciclo es irreversible | Vigente | No ejecutar cierre real sin aprobacion operativa explicita y verificacion de precondiciones |
| Produccion tiene datos reales distintos a seed de test | Esperado | Smoke no destructivo y backup previo |
| H05 no fue usado para migrar | Correcto | H09/H10 no requiere migracion |
| Fallback legacy sigue activo | Esperado | Mantener monitoreo de `LEGACY_COORDINATION_FALLBACK_USED` |
| Firebase CLI no mostro ID interno de release hosting | No bloqueante | Canal live y URL confirmados por `hosting:channel:list` |

## 10. Rollback

API:

```powershell
gcloud run services update-traffic nomina-api `
  --project nomina-docente-prod `
  --region us-central1 `
  --to-revisions nomina-api-00044-pk9=100
```

Hosting:

- hacer rollback a la version anterior desde Firebase Hosting, o
- redeploy del build anterior si se requiere restaurar frontend.

Base de datos:

- no hay migracion H09/H10 que revertir;
- el backup preventivo disponible es `1780348318919`;
- si hubiera incidente operativo de cierre, detener operacion y revisar `audit_log` y `quarter_closures` antes de cualquier accion correctiva.

## 11. Resultado final

Deploy H09/H10 completado correctamente.

Recomendacion:

1. Mantener monitoreo de Cloud Run durante la operacion posterior.
2. Realizar smoke test humano adicional con Admin en CalendarView antes de ejecutar cualquier cierre real.
3. No ejecutar cierre de ciclo productivo hasta que Direccion/Admin confirme periodo, quincenas pagadas y ciclo siguiente en planeacion.
