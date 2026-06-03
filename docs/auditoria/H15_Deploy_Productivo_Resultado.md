# H15 - Deploy productivo sesion por inactividad

Fecha: 2026-06-03

## 1. Commit desplegado

Commit desplegado a Firebase Hosting live:

```text
0989092 docs(h15): update idle session manual validation
```

Commits H15 incluidos:

- `788818b feat(auth): add idle session timeout`
- `7e914ef fix(auth): add idle timeout unsaved changes warning`
- `f11a039 docs(h15): add idle session predeploy validation`
- `0989092 docs(h15): update idle session manual validation`

## 2. Backup preventivo

Backup Cloud SQL creado antes del deploy:

| Campo | Valor |
|---|---|
| Proyecto | `nomina-docente-prod` |
| Instancia | `nomina-docente-web` |
| Base protegida | `nomina_docente` |
| Tipo | `ON_DEMAND` |
| ID backup | `1780517600085` |
| Inicio UTC | `2026-06-03T20:13:20.085Z` |
| Fin UTC | `2026-06-03T20:14:51.469Z` |
| Estado | `SUCCESSFUL` |
| Descripcion | `H15 idle session controlled deploy backup 2026-06-03` |

## 3. API Cloud Run

Decision de release:

- No se desplego API Cloud Run.
- Motivo: H15 solo modifica frontend/Firebase Auth y documentacion.
- No habia cambios backend funcionales.
- Se evito crear una revision innecesaria de Cloud Run.

Estado Cloud Run confirmado:

| Campo | Valor |
|---|---|
| Servicio | `nomina-api` |
| Region | `us-central1` |
| Revision vigente antes/despues | `nomina-api-00046-6ck` |
| Trafico | `100%` |
| Service account | `nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com` |

## 4. Firebase Hosting

Deploy ejecutado:

```powershell
firebase deploy --only hosting --project nomina-docente-prod
```

Resultado:

- Deploy completo.
- Canal: `live`.
- URL: `https://nomina-docente-prod.web.app`.
- Release live: `2026-06-03 15:16:08`.
- Rewrite `/api/**` se conserva hacia Cloud Run `nomina-api`.

## 5. Healthcheck

| Validacion | Resultado |
|---|---|
| Cloud Run directo `/api/health` | 200 OK |
| Hosting `/api/health` | 200 OK |
| Hosting `/` | 200 OK |
| `/api/auth/session` sin token | 401 esperado |

## 6. Smoke test H15

Smoke autenticado realizado en produccion con usuario autorizado Admin, sin exponer token ni datos sensibles.

| Prueba | Resultado | Observacion |
|---|---|---|
| Login/sesion existente | OK | La app cargo vistas protegidas con usuario Admin autorizado. |
| Vistas protegidas | OK | Dashboard productivo cargo correctamente. |
| Refresh de pagina | OK | La sesion se mantuvo durante la misma sesion del navegador. |
| Logout manual | OK | `Cerrar sesion` redirigio a `/login`. |
| Ruta protegida despues de logout | OK | `/payroll` redirigio a `/login`. |
| Modal de inactividad | Validado localmente antes del deploy | Usuario confirmo visualmente el aviso/modal en navegador local. |
| Texto de datos no guardados | Cubierto por prueba automatizada | `session-timeout.test.ts` valida render del texto. |
| Boton `Continuar sesion` | Cubierto por prueba automatizada | Validado con timers falsos. |
| Boton `Cerrar sesion` | OK postdeploy y cubierto por prueba automatizada | Logout manual validado en produccion. |
| Cierre automatico minuto 60 | Cubierto por prueba automatizada | No se espero ciclo real de 60 minutos durante ventana de deploy. |
| Persistencia al cerrar/reabrir navegador | Observacion pendiente operativa | Depende de comportamiento de restauracion de sesion/tabs del navegador institucional. |

## 7. Confirmacion sin migracion

Confirmado:

- No se ejecutaron migraciones.
- No se ejecuto `db:migrate`.
- No se ejecuto `db:migrate:apply`.
- No se ejecuto `db:migrate:baseline`.
- No se importaron datos.
- No se sincronizaron datos locales/test.
- No se modifico base de datos.
- No se modificaron permisos.
- No se modificaron roles.
- No se cambiaron reglas de negocio.
- No se modifico nomina.
- No se modifico finanzas.
- No se modificaron CSV.
- No se ejecuto cierre de ciclo.
- No se cambiaron variables productivas.
- No se cambiaron secretos.
- No se tocaron H01/H02/H03/H05/H09/H10/H11/H12/H13.

## 8. Riesgos residuales

| Riesgo | Estado | Mitigacion |
|---|---|---|
| Ciclo real completo de 60 minutos no observado en produccion | Bajo | Cubierto por pruebas automatizadas; puede observarse posteriormente en operacion. |
| Cierre/reapertura de navegador depende de restauracion de sesion/tabs | Bajo | Documentar comportamiento real del navegador institucional si se valida despues. |
| Usuario puede perder datos no guardados al expirar sesion | Riesgo esperado | Modal advierte perdida de datos no guardados antes del cierre. |

## 9. Rollback

Rollback disponible:

- Hosting: volver a la version anterior de Firebase Hosting desde la consola o redeploy de commit anterior.
- API: no aplica para H15 porque Cloud Run no se desplego; si fuera necesario, mantener `nomina-api-00046-6ck`.
- BD: no hay migracion H15 que revertir.

## 10. Resultado

H15 queda desplegado productivamente en Firebase Hosting live.

Recomendacion final:

- Mantener H15 en produccion.
- Observar comportamiento real de inactividad durante operacion normal.
- Si el texto, tiempo o UX del modal requiere ajuste, tratarlo como correccion frontend menor posterior, sin tocar backend ni BD.
