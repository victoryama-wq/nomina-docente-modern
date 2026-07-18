# H20 - Deploy productivo del alcance compartido de Nomina

Fecha: 2026-07-16

## 1. Objetivo H20

Desplegar y validar el alcance read-only del preview de Nomina para Coordinadores. Un Coordinador puede consultar el calculo completo de docentes bajo su responsabilidad o que imparten en alguna de sus coordinaciones, sin ampliar propiedad, edicion, permisos fiscales ni finalizacion de Nomina.

Resultado final: **H20 cerrado operativo**.

## 2. Commit funcional desplegado

```text
56553f4 feat(h20): expand coordinator payroll preview scope
```

Commit documental de cierre:

```text
02cb416 docs(h20): record shared payroll scope production deploy
```

La rama `feature/h02-h03-user-coordinations-permissions` fue subida y sincronizada con `origin` antes del deploy.

## 3. Pruebas predeploy

| Validacion | Resultado |
|---|---|
| API Vitest | OK, 22/22 |
| Web Vitest | OK, 58/58 |
| Integracion PostgreSQL | OK, 60/60 |
| Base de integracion | Exclusivamente `nomina_docente_test` en `localhost:5432` |
| Typecheck | OK |
| Build API/Web | OK |
| `git diff --check` | OK |

No se uso `nomina_docente` para pruebas de integracion.

## 4. Estado H05

Se ejecutaron solamente los controles autorizados `db:migrate:inspect` y `db:migrate:status`.

| Control | Resultado |
|---|---|
| Migraciones detectadas | 15 |
| Baseline registrado | 15 |
| Pendientes | 0 |
| Checksum mismatch | 0 |

Se conservaron como advertencias historicas aceptadas los prefijos duplicados `007`, `008` y `009`. No se ejecuto `dry-run`, `baseline`, `apply` ni SQL de migracion.

## 5. Cloud Build e imagen

| Elemento | Valor |
|---|---|
| Cloud Build ID | `39bd308f-298b-4bb5-a486-5a088a2a5c27` |
| Estado | `SUCCESS` |
| Imagen | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h20-prod-56553f4` |
| Digest | `sha256:3773e95e35836acb5ba30382d0465a800accd38491092abd625a07b4719839ac` |

## 6. Cloud Run

| Elemento | Valor |
|---|---|
| Proyecto | `nomina-docente-prod` |
| Servicio | `nomina-api` |
| Region | `us-central1` |
| Revision anterior | `nomina-api-00050-zdm` |
| Revision nueva | `nomina-api-00051-9s5` |
| Estado revision nueva | Ready |
| Trafico | 100% a `nomina-api-00051-9s5` |
| URL publica | `https://nomina-api-443985127112.us-central1.run.app` |

Se conservaron variables, secretos, CORS, service account, conexion Cloud SQL y `LEGACY_COORDINATION_FALLBACK_ENABLED=true`.

## 7. Firebase Hosting

| Elemento | Valor |
|---|---|
| Sitio/canal | `nomina-docente-prod` / `live` |
| Release | `1784228039752000` |
| Version | `41bf160c7c3595b6` |
| URL | `https://nomina-docente-prod.web.app` |

El rewrite `/api/**` continua apuntando a `nomina-api` en `us-central1`.

## 8. Healthchecks y logs

| Validacion | Resultado |
|---|---|
| Cloud Run `/api/health` | 200 |
| Hosting `/api/health` | 200 |
| Hosting `/api/auth/session` sin token | 401 esperado |
| Hosting `/api/payroll/context` sin token | 401 esperado |
| Hosting `/api/payroll/preview` sin token | 401 esperado |
| Logs de `nomina-api-00051-9s5` | Sin errores criticos |

No se detectaron errores SQL, 5xx, serializacion, `teacherSummaries` ni decimales durante la validacion tecnica.

## 9. Smoke autenticado - Coordinador

Validacion aprobada:

- visualiza docentes bajo su responsabilidad;
- visualiza docentes creados por otro usuario que imparten en su coordinacion;
- visualiza la carga completa del docente entre coordinaciones;
- cada docente aparece una sola vez;
- el desglose identifica las coordinaciones de origen;
- los totales no se duplican;
- docentes completamente fuera de alcance no aparecen;
- no aparecen controles nuevos de edicion;
- no aparece capacidad de Guardar o Finalizar Nomina.

## 10. Smoke autenticado - Admin

Validacion aprobada:

- conserva alcance global;
- no pierde docentes ni lineas;
- los totales permanecen correctos;
- no hay duplicaciones;
- conserva sus controles administrativos existentes;
- no se guardo ni finalizo una Nomina durante el smoke.

## 11. Totales y ausencia de duplicados

El preview productivo mostro cada docente una sola vez en la proyeccion de Coordinador. El desglose conserva las lineas y coordinaciones de origen necesarias para el calculo, y la suma agregada coincide con el total autorizado sin duplicacion.

Admin mantiene la presentacion y el alcance global previos, sin perdida de lineas ni alteracion de totales.

## 12. Seguridad fiscal

El smoke confirmo que el Coordinador no recibe ni visualiza:

- RFC;
- banco, cuenta o CLABE;
- correo fiscal;
- `paymentType`;
- constancias;
- alertas fiscales.

No se agregaron permisos, roles ni capacidad de finalizacion.

## 13. Rollback

No fue necesario aplicar rollback.

Recursos conservados:

- API: devolver 100% del trafico a `nomina-api-00050-zdm` o redeploy de la imagen anterior `h18-hotfix-c1e858b`.
- Hosting: restaurar el release live anterior `1783620715738000`, version `02bc186f72fde886`.
- Base de datos: no existe migracion H20 que revertir.

## 14. Confirmaciones de alcance

- No se ejecutaron migraciones.
- No se modifico Cloud SQL.
- No se ejecutaron seeds ni importaciones.
- No hubo escrituras de Nomina durante el smoke.
- No se guardo ni finalizo ninguna corrida.
- No se modifico H01 ni la precision monetaria.
- No se agregaron permisos ni roles.
- No se expusieron datos fiscales.
- No fue necesario rollback.

## 15. Resultado final

H20 queda **cerrado operativo** en produccion con la revision `nomina-api-00051-9s5` y Firebase Hosting release `1784228039752000` activos. Las pruebas automatizadas, healthchecks, logs y smoke autenticado por Coordinador/Admin fueron satisfactorios.
