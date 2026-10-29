# H24 PD-03 - Imagenes, politica PDF y visor: implementacion local

Fecha: 2026-10-28.
Base: `59a8498 docs(h24): propose image PDF and preview security policy`.
Rama: `feature/h02-h03-user-coordinations-permissions`; arbol inicialmente limpio.
Estado: **puntos 1-3 autorizados e implementados localmente; PD-03 abierto, H24 NO-GO**.

## 1. Autorizacion y alcance

El usuario aprobo laboratorio, politica e implementacion local de JPG/PNG, PDF y
vista previa, con datos sinteticos, sin BD, produccion o deploy. Esta entrega no
ejecuta el punto 4 de la [propuesta](H24_PD03_Politica_Imagenes_PDF_Visor_Propuesta.md):
la nueva ronda BD test/GCS necesita autorizacion separada. A4 anterior no acredita
esta version del inspector. No se abrieron sesiones institucionales ni se usaron
documentos reales, credenciales, Firebase, GCS o clientes PostgreSQL.

## 2. Controles implementados

### JPG/PNG, exclusivamente para constancias

- Se mantienen formatos y limite de 7.5 MiB. Documentos adicionales siguen solo PDF.
- Tipo real y estructura, despues decodificacion completa a pixeles mediante
  sharp/libvips; consultar metadata no basta. Advertencias/errores rechazan.
- Imagen estatica, maximo 25 000 000 pixeles y 10 000 por lado. Rechazo de APNG,
  MPO, JPEG concatenado, datos posteriores al cierre, truncados y tipo falso.
- RGB, grises, CMYK/ICC, EXIF, alpha y JPEG progresivo ensayados. Sin rotacion,
  recompresion, eliminacion de metadata o conversion del archivo entregado.
- Buffer de pixeles temporal acotado; AV y decoder deben aprobar el mismo hash.

### PDF

- Se conserva pdfinfo, limite de 500 paginas y rechazo de cifrado/JavaScript.
- qpdf --check y JSON v2 sin datos de streams; recorrido estructural de todos los
  objetos, incluidos no referenciados. No se usa regex de bytes para esta politica.
- Limites: 10 000 objetos, 150 000 nodos, profundidad 64, resolucion indirecta 64;
  salida qpdf hasta 8 MiB, 10 s por invocacion y 30 s de inspector total.
- Se permiten contenido estatico, navegacion interna y anotaciones Link HTTPS
  sin credenciales, accionadas por usuario. Se rechazan acciones automaticas
  externas, Launch, SubmitForm/ImportData, GoToR/E, JavaScript/AA, XFA, adjuntos,
  portfolios, multimedia/3D y referencias externas de streams, entre otras.
- AcroForm inerte y campos de firma se conservan si cumplen la politica. No se
  verifica autenticidad criptografica, vigencia o identidad de la firma; la prueba
  usa un campo de firma sintetico, no una constancia firmada institucional.
- Acciones no admitidas por el contexto, referencias irresolubles, advertencias
  del parser o analisis incompleto fallan cerrado. No hay reparacion ni CDR.

La inspeccion es conservadora, no un verificador universal de toda la especificacion
PDF. Puede rechazar archivos validos con funciones/estructuras no admitidas, por
ejemplo atributos que compartan nombres con acciones. Requiere ensayo institucional
controlado antes de rollout; nunca eludir el control para aceptar un documento.

### Pipeline y lectura historica

`document-security.ts` exige inspector y AV para los tres formatos, en los flujos
existentes de carga, lectura y recuperacion. Rechazo de contenido conserva semantica
422; indisponibilidad/protocolo/hash inesperado conserva 503, nunca equivale a limpio.
La concurrencia/429 existente no cambia. El protocolo `H24_POLICY_V1_*` impide que
la imagen parser A3 anterior pase silenciosamente como nueva politica: debe fallar
cerrado. No hay fallback al parser antiguo.

La politica aprobada para historicos es revalidar al leer, bloquear preview y
descarga si se rechaza, conservar el original y permitir reintento si el motor no
esta disponible. No se hizo escaneo masivo, borrado ni cambio de registros. La
conservacion/restitucion real bajo este inspector debe repetirse en el punto 4.

### Carrera de vista previa VIEW-02

`FiscalRecordsView.vue` invalida solicitudes al cerrar, cambiar identidad/permisos,
cerrar sesion y desmontar. Solo la solicitud vigente puede crear la URL Blob;
respuestas tardias y errores antiguos no reabren ni sustituyen el documento.
URLs se revocan al cerrar. No se cambiaron roles, campos fiscales ni layout.

## 3. Laboratorio y dependencias

Directorio: `tools/validation/h24-pd03/inspector`, con package.json/lock propios.
sharp **0.35.5**, libvips **8.18.7** y qpdf Debian **11.3.0-1+deb12u1** fijados.
sharp y qpdf usan Apache-2.0; conservar avisos de sus dependencias y bibliotecas
empaquetadas. `npm audit --package-lock-only --omit=dev --json --workspaces=false`
en ese directorio: **0 vulnerabilidades** en las cuatro severidades. No es un
audit de la aplicacion ni del sistema operativo completo. No se uso audit fix.

No cambian package.json/package-lock raiz ni workspaces. No hay decoder en el
frontend ni instalacion npm en el host para este laboratorio. Instalacion efectiva
mediante npm ci dentro de Docker, sin scripts; binarios opcionales del lock propios.
Descarga de paquetes tiene red durante build; procesamiento siempre sin red.

Base PD-01 verificada: `sha256:34658533a39f07a1e20e6a6c46c4aa8dded3a4a0e19bf5c9c14aabaf85ffa36a`.
Inspector final `h24-pd03-policy:local`:
`sha256:d9147e0cb6ee7f3d0feb9a3d7d4a82021c2d9890dbcaf53233dd9f8a0bc5454e`.
Scanner A3 conservado:
`sha256:5e14fd90d6a4d35b87dcde8ce555627061904288e42fb15c28084b018afd8360`.
Firmas en volumen aislado `h24-pd03-signatures-20261028` de solo lectura al escanear.

Inspector: no root 1000:1000, sin red/puertos/montajes host, read-only, cap-drop ALL,
no-new-privileges, 512 MiB RAM/swap, 2 CPU, 64 PID, tmpfs privado 128 MiB. AV conserva
4 GiB y usuario 100:101. API host controla contenedores efimeros; **no es arquitectura
Cloud Run y no autoriza montar socket Docker en produccion**. Dockerfile de la API
productiva no cambia. El corpus final termino exit 0, OOMKilled=false, sin bindings.
Contenedores eliminados; imagenes locales de laboratorio conservadas.

## 4. Validaciones ejecutadas

| Validacion | Resultado y alcance |
|---|---|
| Politica pura `node --test .../pdf-policy.test.mjs` | 7/7 grupos |
| Corpus Docker real, politica + corpus | 15/15 grupos, sin skipped; 22:15:06 a 22:15:12 UTC, exit 0 y sin OOM |
| Pipeline API Docker final, `document-security.docker.test.ts` | 7/7: PDF benigno/JS/cifrado/malformado/501 paginas y PNG/JPEG reales, 34.63 s |
| `npm run test:api` | 283 passed, 15 skipped: 7 Docker opt-in ejecutados aparte; 8 dependientes de DOSSIER_PDFINFO_PATH no configurado en esa ejecucion host |
| `npm run test:web` | 158 passed |
| FiscalRecordsView enfocado | 14 passed; incluye cinco casos nuevos de carreras/identidad/permisos |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| Audit del lock propio de inspector | 0 critical/high/moderate/low |
| `git diff --check` | OK; revision de alcance sin SQL, Dockerfile API ni manifests/locks de aplicacion modificados |

Corpus sintetico: object streams, nombres escapados, actualizaciones incrementales,
acciones/adjuntos/XFA/multimedia, formularios inertes, hash original; imagenes validas,
falso tipo, truncados, APNG/MPO/JPEG concatenado y limites exactos/excedidos. Archivos
de rechazo se generan/procesan dentro del contenedor, no se abren en navegador ni
se envian a GCS. Esta ronda no genera EICAR nuevo ni usa malware real.

No se ejecuto test:api:integration ni reset/seed: esta autorizacion excluye BD.
Estas pruebas no sustituyen integracion de almacenamiento, carga concurrente o PD-07.

## 5. Visor local sintetico

Harness `preview-local.mjs`: componentes Vue reales, API interceptada de solo GET,
identidad sintetica en memoria, Firebase sustituido en memoria y Vite sin .env de
la app. Brave headless con perfil desechable, sin login, service workers bloqueados,
DNS externo bloqueado y solicitudes externas interceptadas. Solo PDF benigno
previamente aprobado por el pipeline Docker real. Ningun token valido.

- Constancia y adicional renderizados; descarga de constancia con SHA-256 exacto.
- Capturas 1440x900, 768x1024, 390x844, sin overflow general. En movil el panel
  adicional requiere scroll vertical; el visor nativo conserva su zoom/scroll
  interno, no se promete ajuste completo de pagina a cualquier viewport.
- Cierre y logout liberan URLs Blob; al logout desaparece iframe. Sin errores JS,
  navegacion automatica o solicitudes externas observadas; marcador del padre intacto.
- Se permitieron explicitamente recursos internos `chrome://resources` y
  `chrome://theme` tras corregir un bloqueo del propio harness que impedia renderizar.
  No se amplio permiso de red para dominios externos.
- Evidencia sintetica local ignorada por Git en `.cache/h24-pd03-policy-preview`.
  Servidor temporal 5196 y perfil automatizado cerrados al terminar.

No se pulso un enlace externo desde el visor ni se hizo smoke manual institucional.
La politica permite enlace HTTPS manual, pero no demuestra que todos los motores
PDF lo manejen de forma identica. No se afirma sandbox HTML, ausencia universal de
acceso al padre o seguridad ante toda variante PDF. Aceptacion residual pendiente;
alternativa rasterizada requeriria alcance y autorizacion propios. Un archivo
descargado no puede revocarse del equipo del destinatario.

## 6. Pendientes y confirmaciones

1. Autorizar punto 4 para repetir integracion benignos en nomina_docente_test/GCS
   H24, respaldo/restitucion, reemplazo rechazado, lectura y recuperacion con nuevo
   inspector. Ningun adverso/EICAR a cloud.
2. Revisar compatibilidad institucional de imagenes/PDF y aceptar explicitamente
   riesgo residual del visor, o definir alternativa. No se presupone aceptacion.
3. Disenar/validar transporte y operacion cloud, actualizacion de firmas/parsers,
   capacidad PD-07 y demas gates pendientes PD-04/05/06/08. No desplegar Docker local.

Sin BD leida/modificada, SQL, migraciones, produccion, deploy, cambios H01, nomina,
snapshots, roles/permisos o datos fiscales reales. Sin commit/push en esta entrega.
Fuentes tecnicas: [sharp constructor](https://sharp.pixelplumbing.com/api-constructor/),
[decodificacion raw](https://sharp.pixelplumbing.com/api-output/),
[JSON qpdf](https://qpdf.readthedocs.io/en/stable/json.html).
