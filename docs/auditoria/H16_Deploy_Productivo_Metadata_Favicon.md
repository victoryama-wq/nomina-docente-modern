# H16 - Deploy productivo metadata y favicon

Fecha: 2026-06-04

## 1. Commit desplegado

Commit H16 desplegado a Firebase Hosting live:

```text
a82ef83 chore(web): add favicon and social metadata
```

Alcance:

- favicon;
- apple touch icon;
- imagen social `og-image.png`;
- metadata SEO basica;
- Open Graph;
- Twitter Card;
- documentacion H16.

## 2. Validaciones predeploy

| Validacion | Resultado |
|---|---|
| Rama `feature/h02-h03-user-coordinations-permissions` limpia | OK |
| Rama sincronizada con origin antes del deploy | OK |
| Commit H16 presente | OK |
| Sin cambios backend | OK |
| Sin migraciones nuevas | OK |
| `npm --workspace apps/web run typecheck` | OK |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `npm run test:web` | OK |
| `npm run test` | OK |

## 3. Deploy ejecutado

Comando ejecutado:

```powershell
firebase deploy --only hosting --project nomina-docente-prod
```

Resultado:

- Proyecto: `nomina-docente-prod`.
- Hosting: `nomina-docente-prod`.
- Canal: `live`.
- URL: `https://nomina-docente-prod.web.app`.
- Release live: `2026-06-04 14:20:50`.
- Archivos detectados en deploy: `53`.
- Deploy completo.

## 4. API Cloud Run

No se desplego API Cloud Run.

Confirmacion posterior:

| Campo | Valor |
|---|---|
| Servicio | `nomina-api` |
| Region | `us-central1` |
| Revision vigente antes/despues | `nomina-api-00046-6ck` |
| Trafico | `100%` |

## 5. Smoke postdeploy

| Validacion | Resultado |
|---|---|
| `/` | 200 OK |
| `/favicon.ico` | 200 OK |
| `/favicon.svg` | 200 OK |
| `/apple-touch-icon.png` | 200 OK |
| `/og-image.png` | 200 OK |
| `/api/health` via Hosting | 200 OK |
| `/api/auth/session` sin token | 401 esperado |

## 6. Metadata productiva

HTML productivo validado en `https://nomina-docente-prod.web.app/`.

| Metadata | Resultado |
|---|---|
| `<title>Nómina Docente</title>` | OK |
| `description` | OK |
| `theme-color` | OK |
| `og:title` | OK |
| `og:description` | OK |
| `og:image` | OK |
| `twitter:card` | OK |
| `twitter:title` | OK |
| `twitter:image` | OK |
| `favicon.ico` | OK |
| `favicon.svg` | OK |
| `apple-touch-icon` | OK |

## 7. Confirmaciones de alcance

Confirmado:

- No se desplego API Cloud Run.
- No se modifico base de datos.
- No se ejecutaron migraciones.
- No se ejecuto `db:migrate`.
- No se importaron datos.
- No se sincronizaron datos locales/test.
- No se cambiaron variables productivas.
- No se tocaron secretos.
- No se cambiaron permisos.
- No se cambiaron roles.
- No se cambiaron rutas internas.
- No se cambiaron reglas de negocio.
- No se modifico UI funcional.
- No se tocaron H01/H02/H03/H05/H09/H10/H11/H12/H13/H15 funcional.

## 8. Rollback

Rollback disponible:

- Firebase Hosting: volver a la version live anterior desde consola Firebase Hosting o redeploy del commit anterior.
- API Cloud Run: no aplica, porque H16 no desplego API.
- Base de datos: no aplica, porque H16 no tuvo migracion ni cambios de datos.

## 9. Resultado

H16 queda desplegado productivamente en Firebase Hosting live.

Recomendacion:

- Mantener assets publicos versionados en `apps/web/public/`.
- Si se requiere imagen social institucional oficial, reemplazar `og-image.png` en una fase menor futura sin tocar reglas funcionales.
