# H03 - Deploy Finanzas: comprobantes consolidados y nombre docente

Fecha: 2026-10-27
Estado: ajuste de Finanzas cerrado operativo. API y Hosting desplegados;
healthchecks y smoke autenticado postdeploy aprobados.

## Alcance

Commit desplegado: `b3f40ce1a062e06c86c76422842a2728ebb318c1`, publicado en
`feature/h02-h03-user-coordinations-permissions`, con arbol limpio y rama
sincronizada antes del build.

- PDF de efectivo consolidado por docente, sumando importes guardados incluyendo
  extras, sin fila de coordinacion y sin recalcular Nomina.
- Nombre docente visible en Finanzas para los roles autorizados, conservando
  alcance de coordinaciones y separacion de permisos fiscales.

## Validaciones

- Reejecutadas antes del deploy: API 44/44, Web 98/98, typecheck y build OK.
- Integracion previa del mismo cambio: 131/131 exclusivamente en
  `nomina_docente_test`; no se repitio durante este deploy.
- Sin cambios SQL ni migraciones en el commit.
- H05: ultimo estado documentado 18 registradas, pending=0 y mismatch=0.
  No se volvio a consultar H05 ni se ejecutaron comandos de migracion en esta
  ventana; no se presenta el estado documental como una verificacion nueva.

## API Cloud Run

| Elemento | Valor |
|---|---|
| Proyecto / region / servicio | `nomina-docente-prod` / `us-central1` / `nomina-api` |
| Cloud Build | `849e12a7-a8fc-46ad-8b2b-27e1daff9793` |
| Build UTC | `2026-10-27T17:15:45.814501561Z` a `2026-10-27T17:17:22.416472Z` |
| Resultado build | `SUCCESS` |
| Imagen | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:finance-b3f40ce` |
| Digest desplegado | `sha256:a7d0de2196c5552d50cd75b8f01e15238dc90f701941b8656613bf6d1789196b` |
| Revision anterior | `nomina-api-00056-mll` |
| Revision nueva | `nomina-api-00057-c7d` |
| Trafico | 100% nueva revision |

Comandos ejecutados:

```powershell
gcloud.cmd builds submit . --config cloudbuild.api.yaml --substitutions=_IMAGE=us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:finance-b3f40ce --project=nomina-docente-prod --async --format=json
gcloud.cmd run deploy nomina-api --image us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api@sha256:a7d0de2196c5552d50cd75b8f01e15238dc90f701941b8656613bf6d1789196b --project nomina-docente-prod --region us-central1 --platform managed --quiet
```

Comparacion de configuracion antes/despues: variables y referencias de secretos,
cuenta de servicio, conexion Cloud SQL, recursos, concurrencia y timeout sin
cambios. No se imprimieron valores secretos. No se creo backup nuevo: release
exclusivamente de codigo, sin migracion ni operacion de escritura en BD.

## Firebase Hosting

Build local productivo con `VITE_API_BASE_URL=/api` y proyecto
`nomina-docente-prod`. Se ejecuto:

```powershell
firebase deploy --only hosting --project nomina-docente-prod --non-interactive
```

| Elemento | Valor |
|---|---|
| Sitio / canal | `nomina-docente-prod` / `live` |
| Release | `1793121624438000` |
| Version | `3f9ebc88c835a143` |
| Fecha UTC | `2026-10-27T17:20:24.438Z` |
| Release anterior | `1789068812732000` |
| Version anterior | `c29c9b5b84133c9a` |

Rewrite `/api/**` conservado hacia `nomina-api` en `us-central1`.
HTML live verificado contra el build local: `/assets/index-DFZ-z_X6.js`;
asset servido con HTTP 200.

## Healthchecks

| Validacion | Resultado |
|---|---|
| Cloud Run directo `/api/health` | 200 |
| Hosting `/api/health` | 200 |
| Hosting `/` | 200 |
| Cloud Run y Hosting `/api/auth/session` sin token | 401 esperado |
| Hosting `/api/reports/finance/context` sin token | 401 esperado |
| Logs nueva revision con severity >= ERROR | 0 en la consulta postdeploy |

## Smoke autenticado y cierre operativo

El 2026-10-27 el usuario confirmo manualmente que los smoke productivos pasaron
y que el PDF consolidado y los nombres por rol funcionan correctamente.

| Validacion productiva | Resultado |
|---|---|
| PDF de efectivo consolidado por docente | Aprobado por el usuario |
| Nombres docentes visibles por rol conforme al alcance autorizado | Aprobado por el usuario |

Esta confirmacion posterior al deploy cierra el pendiente de validacion
autenticada de `nomina-api-00057-c7d` y Hosting release `1793121624438000`.
Es evidencia humana, distinta de los healthchecks tecnicos y del smoke local
previo al commit. No se registran identidades, datos fiscales ni comprobantes
personales en esta acta.

Resultado: ajuste cerrado operativo, sin incidencias reportadas en el smoke.
Permanecen los controles de regresion de alcance por coordinacion, separacion
fiscal y consolidacion de los importes guardados. No se modifico codigo ni se
repitieron tests/build, consultas productivas, operaciones de BD o deploy para
este cierre exclusivamente documental.

Validaciones documentales: `git diff --check`, revision de archivos cambiados y
estado Git. Solo se versionan README y documentacion del ajuste/despliegue.

## Rollback

- API: devolver trafico a `nomina-api-00056-mll`.
- Hosting: restaurar version `c29c9b5b84133c9a` del release anterior.
- BD: no hay migracion ni datos de este release que revertir.
- No se aplico rollback.

## Confirmaciones

- No se ejecutaron migraciones, apply, baseline, dry-run, seeds o importaciones.
- No se ejecutaron escrituras ni cambios de esquema en la BD.
- No se guardo, cancelo ni finalizo Nomina.
- No se modificaron H01, snapshots ni corridas historicas.
- No se cambiaron permisos persistidos, secretos, CORS ni configuracion de BD.
- No se consultaron ni exportaron datos fiscales durante los healthchecks.
- No se copiaron datos locales/test a produccion.
