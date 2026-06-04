# H16 - Metadata publica y favicon Web App

Fecha: 2026-06-04

## 1. Que se agrego

Se agrego metadata publica basica para la Web App Nomina Docente:

- titulo del sitio;
- descripcion publica;
- `theme-color`;
- favicon;
- apple touch icon;
- Open Graph para vista previa al compartir enlaces;
- Twitter/X Card.

El cambio es exclusivamente frontend estatico en la Web App.

## 2. Favicon creado/usado

No existia carpeta `apps/web/public/` ni assets previos de favicon/logo versionados.

Assets agregados:

| Archivo | Uso | Observacion |
|---|---|---|
| `apps/web/public/favicon.ico` | Favicon tradicional | Asset neutro generado para la Web App; no representa un logotipo institucional formal. |
| `apps/web/public/favicon.svg` | Favicon moderno SVG | Usa color institucional y una marca tipografica minima `ND`. |
| `apps/web/public/apple-touch-icon.png` | Icono para dispositivos Apple | No contiene datos reales ni informacion sensible. |

Como no habia logo institucional versionado, no se incorporo escudo ni marca oficial nueva. Los assets son recursos tecnicos neutros para identificar la Web App.

## 3. Metadata agregada

Archivo actualizado:

- `apps/web/index.html`

Valores principales:

| Campo | Valor |
|---|---|
| Title | `Nómina Docente` |
| Description | `Sistema institucional para la gestión, revisión y seguimiento de la nómina docente.` |
| Theme color | `#252a86` |
| OG type | `website` |
| OG URL | `https://nomina-docente-prod.web.app/` |
| OG image | `https://nomina-docente-prod.web.app/og-image.png` |
| Twitter card | `summary_large_image` |

## 4. Imagen social

Se agrego:

- `apps/web/public/og-image.png`

Caracteristicas:

- PNG;
- 1200x630;
- fondo institucional;
- texto: `Nómina Docente`;
- descripcion publica breve;
- sin datos reales;
- sin nombres de usuarios;
- sin montos;
- sin datos fiscales;
- sin capturas de pantalla.

## 5. Validaciones ejecutadas

| Validacion | Resultado |
|---|---|
| `npm --workspace apps/web run typecheck` | OK |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `npm run test:web` | OK |
| `npm run test` | OK |
| `apps/web/dist/index.html` contiene title correcto | OK |
| `apps/web/dist/index.html` contiene description | OK |
| `apps/web/dist/index.html` contiene `og:title` | OK |
| `apps/web/dist/index.html` contiene `og:description` | OK |
| `apps/web/dist/index.html` contiene `og:image` | OK |
| `apps/web/dist/favicon.ico` existe | OK |
| `apps/web/dist/favicon.svg` existe | OK |
| `apps/web/dist/apple-touch-icon.png` existe | OK |
| `apps/web/dist/og-image.png` existe | OK |
| Imagen social sin datos sensibles | OK |

## 6. Que NO se toco

Confirmado:

- No se modifico backend.
- No se modifico base de datos.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se toco produccion.
- No se cambiaron permisos.
- No se cambiaron roles.
- No se cambiaron reglas de negocio.
- No se cambiaron rutas internas.
- No se cambio UI funcional.
- No se cambio Firebase config.
- No se cambio CORS.
- No se tocaron H01/H02/H03/H05/H09/H10/H11/H12/H13/H15 funcional.

## 7. Recomendacion para deploy

H16 queda listo para deploy controlado de Firebase Hosting cuando el usuario lo autorice.

Como no hay cambios backend ni de base de datos:

- no requiere migracion;
- no requiere deploy de API Cloud Run;
- no requiere cambio de variables productivas;
- basta con build web y deploy Hosting live siguiendo H13.

Smoke recomendado postdeploy:

1. Confirmar `https://nomina-docente-prod.web.app/` responde 200.
2. Confirmar `/favicon.ico` responde 200.
3. Confirmar `/favicon.svg` responde 200.
4. Confirmar `/og-image.png` responde 200.
5. Confirmar que el HTML productivo contiene title, description, Open Graph y Twitter Card.
