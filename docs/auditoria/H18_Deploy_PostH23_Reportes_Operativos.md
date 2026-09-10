# H18 - Deploy productivo del ajuste post-H23 de Reportes Operativos

Fecha: 2026-09-10

Estado: cerrado operativo; deploy, smoke tecnico y smoke autenticado aprobados.

## 1. Objetivo

Publicar el ajuste H18 que alinea `Horas base y extras` con la elegibilidad temporal H23 y consolida `Horas base por categoria` por docente entre coordinaciones, sin migraciones ni escrituras funcionales sobre Cloud SQL.

## 2. Commit desplegado

| Elemento | Valor |
|---|---|
| Commit | `85c3e34 feat(h18): align operational reports with H23` |
| Rama | `feature/h02-h03-user-coordinations-permissions` |
| Estado remoto previo al build | Commit publicado en `origin` |

## 3. Validaciones previas

- `npm run test`: API 42/42 y Web 92/92.
- `npm run test:api:integration` contra `nomina_docente_test`: 130/130.
- Integracion H18 enfocada: 15/15.
- Regresion H01 enfocada: 5/5.
- `npm run typecheck`: aprobado.
- `npm run build`: aprobado.
- `git diff --check`: aprobado.

No se uso `nomina_docente` como base de pruebas.

## 4. H05 y backup

`npm run db:migrate:inspect` se ejecuto contra produccion en modo read-only mediante Cloud SQL Auth Proxy. Resultado:

- 18 migraciones detectadas y registradas;
- 15 baseline;
- `013`, `014` y `015` aplicadas;
- `pending=0`;
- `checksum mismatch=0`;
- no DDL, no DML, no advisory lock y ninguna migracion ejecutada.

Backup preventivo:

| Elemento | Valor |
|---|---|
| Proyecto | `nomina-docente-prod` |
| Instancia | `nomina-docente-web` |
| Backup ID | `1789068493579` |
| Tipo | On-demand |
| Descripcion | `Predeploy H18 post-H23 reports 85c3e34` |
| Inicio UTC | `2026-09-10T19:28:13.587Z` |
| Fin UTC | `2026-09-10T19:29:44.984Z` |
| Estado | `SUCCESSFUL` |

## 5. Cloud Run

| Elemento | Valor |
|---|---|
| Cloud Build | `43f44d78-f73f-4791-bbe9-a52eeeffd584` |
| Imagen | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h18-posth23-85c3e34` |
| Digest | `sha256:b52af3b562c2687ff09f45712ea4f9b3c33c8622c254393c4c8c3f2187cde22f` |
| Servicio | `nomina-api` |
| Region | `us-central1` |
| Revision anterior | `nomina-api-00055-8wn` |
| Revision nueva | `nomina-api-00056-mll` |
| Trafico | 100% a `nomina-api-00056-mll` |

El deploy actualizo unicamente la imagen. Se conservaron la cuenta de servicio, conexion Cloud SQL, secreto y variables vigentes, incluyendo CORS y `LEGACY_COORDINATION_FALLBACK_ENABLED`.

## 6. Firebase Hosting

| Elemento | Valor |
|---|---|
| Sitio | `nomina-docente-prod` |
| Canal | live |
| Release | `1789068812732000` |
| Version | `c29c9b5b84133c9a` |
| URL | `https://nomina-docente-prod.web.app` |

El rewrite `/api/**` permanece operativo hacia `nomina-api`.

## 7. Smoke tecnico

| Validacion | Resultado |
|---|---|
| Cloud Run directo `/api/health` | HTTP 200 |
| Hosting `/api/health` | HTTP 200 |
| Hosting `/` | HTTP 200 |
| Hosting `/reports` | HTTP 200 |
| `/api/auth/session` sin sesion | HTTP 401 esperado |
| Filtros H18 sin sesion | HTTP 401 esperado |
| Reporte H18 sin sesion | HTTP 401 esperado |
| Logs `severity>=ERROR` revision nueva | 0 |

## 8. Smoke autenticado

El usuario confirmo manualmente que los smoke productivos pasaron sin novedades. Se registran como aprobadas las siguientes validaciones:

- Admin, Direccion/Subdireccion y Coordinador ven ambas pestanas.
- RH, Finanzas, Contador y Contabilidad no tienen acceso a H18; las guardas backend permanecen como autoridad.
- `Horas base y extras` exige el ciclo activo y una quincena seleccionada.
- La lista contiene todas las quincenas configuradas del ciclo activo.
- `source=auto` presenta snapshot cuando existe corrida no cancelada y datos vivos H23 cuando aun no existe corrida.
- El calculo quincenal muestra horas base, faltas, descuento de `0.5` horas por retardo, extras y sobrecarga `70/50/30`.
- `Horas base por categoria` consolida la carga semanal global del docente contra `35/25/15`, con desglose por coordinacion y sin duplicar el umbral.
- Docentes inactivos y docentes sin horario quedan excluidos.
- CSV y XLSX se descargan y abren correctamente, conservando columnas y datos legibles.
- No se observaron RFC, banco, cuenta, CLABE, `paymentType`, constancias ni otros datos fiscales.

Con esta evidencia, el ajuste H18 post-H23 queda cerrado operativo.

## 9. Rollback

- API: regresar el trafico a `nomina-api-00055-8wn`.
- Hosting: restaurar el release anterior `1787419305880000` / version `07924eeeb7713f30`.
- BD: no existe migracion ni cambio de datos H18 que revertir.

No fue necesario aplicar rollback durante el smoke tecnico.

## 10. Confirmaciones

- No se ejecutaron migraciones, `apply`, `baseline`, `dry-run` ni seeds.
- No se modifico Cloud SQL ni se escribieron datos productivos.
- No se modifico H01 ni la matematica monetaria de Nomina.
- No se modificaron corridas ni snapshots historicos.
- No se cambiaron roles, permisos persistidos, secretos o variables productivas.
- No se expusieron datos fiscales.
- El ajuste es de consulta y exportacion read-only.
