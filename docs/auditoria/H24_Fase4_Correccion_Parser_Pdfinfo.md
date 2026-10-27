# H24-F4 - Correccion local del empaquetado pdfinfo

Fecha: 2026-10-27.
Base revisada: `91d82c7 docs(h24): document dossier predeploy readiness`.
Rama: `feature/h02-h03-user-coordinations-permissions`; arbol limpio al inicio.

**PD-01 parcialmente atendido. Dockerfile corregido y parser probado en Windows;
imagen Linux pendiente de construir/probar. H24 mantiene NO-GO.**

## 1. Alcance y causa

El runtime `node:24-slim` no instalaba pdfinfo. El validador existente exige
DOSSIER_PDFINFO_PATH absoluto y falla cerrado si falta el ejecutable. Compilar
TypeScript no detectaba esa ausencia. Esta correccion se limita al empaquetado,
smoke sintetico del parser y documentacion; no cambia el validador funcional.

## 2. Cambios

- `apps/api/Dockerfile`: instala `poppler-utils` sin recommends en la etapa
  runtime, limpia listas apt y configura DOSSIER_PDFINFO_PATH=/usr/bin/pdfinfo.
  Comprueba ejecutabilidad/version y ejecuta el smoke sobre el codigo compilado
  en esa misma etapa antes de terminar la imagen. Un fallo aborta el build.
- `apps/api/src/test/dossier-pdfinfo.smoke.ts`: comando standalone compilado
  para comprobar el parser real. No inicia servidor, Firebase, GCS ni BD.
  Usa PDFKit ya instalado; no agrega dependencias npm.
- SPEC, diseno, SDD, matriz y acta F4 reflejan el avance sin cerrar el gate.

Se mantienen los stages/base Node, CMD, instalacion npm y lockfile existentes.
No se habilita storage ni se modifican variables productivas. La ruta del parser
queda como default de la futura imagen; una variable externa incorrecta podria
sobrescribirla y debe comprobarse en un futuro release autorizado.

## 3. Smoke reproducible

El smoke exige el ejecutable (no omite pruebas si falta) y comprueba:

1. PDF estructuralmente valido, incluyendo recorrido `-js` del validador.
2. PDF falso con magic/EOF y PDF truncado.
3. Cifrado con password de usuario y con password de propietario/usuario vacio.
4. JavaScript embebido.
5. Limite de 500 paginas aceptado y 501 rechazado.
6. Limite de salida con metadata sobredimensionada y limite de 7.5 MiB.
7. Ejecutable inexistente: DOSSIER_PDF_VALIDATOR_UNAVAILABLE.
8. Ausencia de temporales despues de cada caso, incluso rechazos.
9. Solo en Linux: ejecutable sintetico que se demora 60 s; el validador debe
   terminarlo por su timeout de 10 s, rechazar y limpiar temporales. No es un PDF
   malicioso ni una medicion de rendimiento de Poppler.

Comandos locales ejecutados (ruta del binario del entorno de herramientas, no
del proyecto ni de produccion):

```powershell
$env:DOSSIER_PDFINFO_PATH='C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdfinfo.exe'
npm --workspace apps/api run build
node apps/api/dist/test/dossier-pdfinfo.smoke.js
npm --workspace apps/api run test -- src/test/dossier-storage.test.ts
npm run test:api
npm run typecheck
npm run build
npm run test:web
```

Las variables se usaron solo en procesos locales de validacion, sin editar .env.

## 4. Resultados reales

| Validacion | Resultado |
|---|---|
| Binario local Windows | pdfinfo 26.07.0 |
| Smoke standalone contra codigo compilado | 11 comprobaciones OK; timeout Linux explicitamente pendiente |
| dossier-storage.test.ts | 81/81, incluye 8 pruebas con pdfinfo real; timeout/error se simulan en pruebas unitarias |
| test:api | 145/145, 13 archivos, sin pruebas omitidas |
| test:web | 139/139, 23 archivos |
| typecheck | API/web OK |
| build | API/web OK; no construye/publica imagen Docker |
| Integracion PostgreSQL | No ejecutada: este cambio no requiere BD ni reset de datos |
| Imagen Linux y timeout real Linux | No ejecutados: Docker/Podman no disponibles y WSL no instalado |
| git diff --check | OK |

No se instalo Docker/WSL, no se recurrio a Cloud Build, ni se inicio API contra
datos reales. Las pruebas de timeout existentes verifican opciones y respuesta
fail-closed mediante mock; no sustituyen la prueba de subprocess Linux.

## 5. Pendiente para cerrar PD-01

Ejecutar en un equipo local/CI aislado con Docker autorizado, no en Cloud Run:

```powershell
docker build --progress=plain -f apps/api/Dockerfile -t nomina-api:h24-pdfinfo-local .
docker run --rm --network none --read-only --tmpfs /tmp:rw,noexec,nosuid,size=128m nomina-api:h24-pdfinfo-local /usr/bin/pdfinfo -v
docker run --rm --network none --read-only --tmpfs /tmp:rw,nosuid,size=128m --memory=512m --cpus=1 --pids-limit=64 nomina-api:h24-pdfinfo-local node apps/api/dist/test/dossier-pdfinfo.smoke.js
docker run --rm --network none nomina-api:h24-pdfinfo-local dpkg-query -W poppler-utils
docker image inspect nomina-api:h24-pdfinfo-local
```

El smoke de timeout necesita ejecutar su fixture temporal: por eso su /tmp no
lleva noexec. No implica una decision de endurecimiento del runtime productivo.
No montar credenciales, .env, documentos reales, BD ni puertos del servidor.
Esperado Linux: 12 comprobaciones OK y exit 0, version del binario/paquete y
digest/ID de imagen registrados. Los limites anteriores son un ensayo, no una
dimension de capacidad aprobada para Cloud Run.

La version Debian/Poppler de la imagen **no fue observada**; no atribuirle 26.07.0
del host Windows. node:24-slim y apt resuelven versiones en build, no estan fijados
por digest/snapshot en este cambio. Registrar inventario, revisar vulnerabilidades
del SO/parser y congelar el artefacto validado antes de release. No se afirma
reproducibilidad bit a bit ni cierre de seguridad por instalar el paquete.

## 6. Riesgos y confirmaciones

pdfinfo es un control estructural, **no antivirus ni garantia de ausencia de
malware**. PD-02 a PD-08 y AUTH-01 siguen pendientes segun el acta F4; no se aceptan
excepciones automaticamente. La prueba Windows no cierra compatibilidad Linux,
capacidad, usuario/privilegios de imagen ni aislamiento de archivos maliciosos.

Sin acceso a produccion, deploy, recursos cloud, BD local/productiva, SQL,
migraciones, seeds, cambios de permisos, UI, H01, Nomina, snapshots ni constancias.
Sin cambios package.json/package-lock.json ni npm audit fix. Unico nuevo paquete
de sistema declarado: poppler-utils y sus dependencias apt requeridas, todavia
sin construir la imagen. No se crearon commit/push en esta correccion.
