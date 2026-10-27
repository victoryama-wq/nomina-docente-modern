# H24-F4 - Correccion local del empaquetado pdfinfo

Fecha: 2026-10-27.
Base revisada: `91d82c7 docs(h24): document dossier predeploy readiness`.
Rama: `feature/h02-h03-user-coordinations-permissions`; arbol limpio al inicio.

**PD-01 cerrado en alcance tecnico local: imagen API Linux construida y parser
validado, 12/12 comprobaciones. H24 mantiene NO-GO por los demas gates.**

Seguimiento posterior al reinicio manual (2026-10-27): Docker Linux operativo,
imagen del commit `95026bf` y resultados en seccion 8. Las secciones 1 a 7 conservan
la evidencia cronologica anterior, incluido el bloqueo inicial por reinicio.

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

Plan original; ejecutado posteriormente con los ajustes/evidencia de seccion 8.

Ejecutar en un equipo local/CI aislado con Docker autorizado, no en Cloud Run:

```powershell
docker build --progress=plain -f apps/api/Dockerfile -t nomina-api:h24-pdfinfo-local .
docker run --rm --network none --read-only --tmpfs /tmp:rw,noexec,nosuid,size=128m nomina-api:h24-pdfinfo-local /usr/bin/pdfinfo -v
docker run --rm --network none --read-only --tmpfs /tmp:rw,exec,nosuid,size=128m --memory=512m --cpus=1 --pids-limit=64 nomina-api:h24-pdfinfo-local node apps/api/dist/test/dossier-pdfinfo.smoke.js
docker run --rm --network none nomina-api:h24-pdfinfo-local dpkg-query -W poppler-utils
docker image inspect nomina-api:h24-pdfinfo-local
```

El smoke de timeout necesita ejecutar su fixture temporal: por eso su /tmp exige
exec explicito (Docker lo monta noexec si se omite; ver seccion 8).
No implica una decision de endurecimiento del runtime productivo.
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

## 7. Preparacion Docker local autorizada (2026-10-27)

Estado historico anterior al reinicio; resultado posterior en seccion 8.

Partida: commit `95026bfad150cca7365919f1a853fbf272ca3b9c`, rama limpia.
Se autorizo preparar Docker y construir/probar localmente, sin produccion.

| Elemento | Evidencia y resultado |
|---|---|
| Equipo | Windows 11 Home Single Language, build 26300.9711, x64, aproximadamente 16 GB RAM |
| WSL | Instalado 3.0.3.0, kernel 6.18.54.1-1, sin distribucion adicional Ubuntu |
| VirtualMachinePlatform | Habilitacion completada; Windows pide reinicio para aplicar cambios |
| Docker Desktop | 4.97.0, instalacion per-user en LOCALAPPDATA/Programs/DockerDesktop, backend wsl-2 |
| Cliente Docker | 29.9.2, build a82e528 |
| Motor Linux local | No disponible: named pipe dockerDesktopLinuxEngine inexistente |
| Imagen API / smoke Linux | No construida / no ejecutado; PD-01 NO cerrado |

WSL se preparo con elevacion UAC y `wsl --install --no-distribution --web-download`.
No se habilito WSL1 ni se reinicio el equipo automaticamente. WSL status informa
que WSL2 aun no puede iniciar; primero completar el reinicio y verificar, sin
atribuir el problema exclusivamente al BIOS mientras hay cambios pendientes.

Instalacion Docker por winget, fuente winget, paquete Docker.DockerDesktop:
`install --user --quiet --backend=wsl-2`. Primer intento fallo por falta de
VirtualMachinePlatform; reintento despues de habilitarlo termino con exit 0 y
`Installation succeeded`. Hash del instalador verificado por winget:
`2668273f82b342a058a28f9ab53ea7bddde10bb6d51307ce2ec54c2d36459744`.
No se paso --accept-license; la aceptacion inicial de Docker Desktop, si aparece,
corresponde al usuario/institucion. No se contrataron servicios ni suscripciones.

Fuentes oficiales consultadas: [instalacion Docker Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
y [comandos WSL](https://learn.microsoft.com/en-us/windows/wsl/basic-commands).

Evidencia local no versionada: `.cache/h24-wsl-install.log`,
`.cache/h24-wsl-install-result.json`, instalador en LOCALAPPDATA/Docker/install-log.txt.
Las instalaciones finalizaron; no se dejaron comandos de instalacion en curso.

### Contexto de build preparado

Se exportaron **solo archivos versionados** de `95026bf` mediante git archive:
package.json, package-lock.json y apps/api. No se usara el workspace completo con
.env locales, credenciales, node_modules, backups o datos no versionados.
Contexto: `.cache/h24-pd01-api-95026bf/`.
Archivo ZIP: `.cache/h24-pd01-api-95026bf.zip`.
SHA-256: `4db8eaa29119389a6b4dd3c2581d2b3eb19c6629aba46d472670609079bc2085`.
Unico archivo de entorno versionado en apps/api: .env.example.

### Retomar despues del reinicio manual

1. Abrir Docker Desktop, completar aceptacion institucional de terminos si la
   solicita y esperar motor Linux. No hace falta autenticarse en servicios cloud.
2. Verificar wsl --status/version y Docker **servidor** local; cliente instalado
   no significa que el motor funcione. Si persiste el error de virtualizacion,
   diagnosticar Windows/firmware antes de construir; no cambiar BIOS a ciegas.
3. Usar exclusivamente el endpoint local explicito, nunca un contexto remoto.
4. Construir el contexto sanitizado y ejecutar los comandos de smoke/inventario
   de la seccion 5 contra ese mismo endpoint. No iniciar el servidor API ni montar
   DB, credenciales o expedientes reales; no publicar puertos ni imagen.

```powershell
$docker = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
$engine = 'npipe:////./pipe/dockerDesktopLinuxEngine'
& $docker --host $engine version
& $docker --host $engine build --progress=plain -f .cache/h24-pd01-api-95026bf/apps/api/Dockerfile -t nomina-api:h24-pdfinfo-local .cache/h24-pd01-api-95026bf
& $docker --host $engine run --rm --network none --read-only --tmpfs /tmp:rw,exec,nosuid,size=128m --memory=512m --cpus=1 --pids-limit=64 nomina-api:h24-pdfinfo-local node apps/api/dist/test/dossier-pdfinfo.smoke.js
```

Los comandos build/run anteriores siguen **pendientes**, no se reportan como
ejecutados. Cerrar PD-01 solo con imagen, version Linux e inventario registrados
y 12 comprobaciones aprobadas, incluido timeout real. H24 mantiene NO-GO por este
y los otros gates. Sin produccion, Cloud Build, deploy, migraciones, BD ni cambios
de codigo funcional. No se crearon commit/push en esta preparacion.

## 8. Validacion Linux posterior al reinicio y cierre PD-01

Fecha: 2026-10-27. Autorizacion: continuar build API y pruebas pdfinfo Linux,
sin produccion ni deploy. HEAD `95026bfad150cca7365919f1a853fbf272ca3b9c`.
Se conservaron los cuatro documentos pendientes de la preparacion anterior.
No se modifico codigo, Dockerfile, SQL ni lockfile durante esta validacion.

### Entorno y artefacto real

Docker Desktop 4.97.0, cliente/servidor 29.9.2, servidor linux/amd64, BuildKit
v0.34.0. WSL2 operativo con docker-desktop. El aviso WSL1 no habilitado no impide
este backend; no se habilito WSL1. Endpoint usado explicitamente en todos los
comandos: `npipe:////./pipe/dockerDesktopLinuxEngine`, motor local, no remoto.

Se verifico SHA-256 del ZIP documentado en seccion 7 y se extrajo de nuevo a
`.cache/h24-pd01-linux-95026bf/`. Contexto transferido: aproximadamente 1.26 MB,
solo package.json/package-lock.json/apps/api versionados, sin .env real,
credenciales, documentos de docentes, backups ni BD. Build obtiene paquetes
publicos de Docker Hub, Debian y npm; no publica la imagen ni usa Cloud Build.

| Dato | Valor observado |
|---|---|
| Etiqueta local | nomina-api:h24-pdfinfo-local |
| Imagen base resuelta | node:24-slim, sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 |
| ID/digest OCI local final | sha256:34658533a39f07a1e20e6a6c46c4aa8dded3a4a0e19bf5c9c14aabaf85ffa36a |
| Manifest Linux | sha256:ec7babf3baae6726e1bc68793f7583dc93a0cd5e1be7980e5d2f6808c56a96a5 |
| Config imagen | sha256:23a33fc836826a40d816453f9b7c195b63738a8cffbb6c3b70a769bc182befb1 |
| Creacion de imagen UTC | 2026-10-27T21:20:55.291806486Z |
| Sistema / Node | Debian bookworm / Node 24.22.1 |
| pdfinfo | 22.12.0, /usr/bin/pdfinfo |
| Paquetes poppler-utils / libpoppler126 | Ambos 22.12.0-2+deb12u3 |
| SHA-256 /usr/bin/pdfinfo | 0d51aad13d5497eb59563f5dd90cdc53c21e987cf396df678317b3f4feb006e5 |
| Tamano informado por Docker | 630104553 bytes |

Se registra el artefacto exacto, no reproducibilidad bit a bit de futuros builds:
node:24-slim/apt siguen resolviendo versiones al construir. El ID permanece en
Docker local; cualquier reconstruccion o imagen de release debe repetir el smoke
y registrar su propio inventario. No se subio a ningun registry.

### Comandos ejecutados y resultados

```powershell
$docker = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
$engine = 'npipe:////./pipe/dockerDesktopLinuxEngine'
& $docker --host $engine build --builder default --progress=plain -f .cache/h24-pd01-linux-95026bf/apps/api/Dockerfile -t nomina-api:h24-pdfinfo-local .cache/h24-pd01-linux-95026bf
& $docker --host $engine run --rm --network none --read-only --tmpfs /tmp:rw,exec,nosuid,size=128m --memory=512m --cpus=1 --pids-limit=64 nomina-api:h24-pdfinfo-local node apps/api/dist/test/dossier-pdfinfo.smoke.js
& $docker --host $engine run --rm --network none --read-only --user node --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp:rw,exec,nosuid,size=128m --memory=512m --cpus=1 --pids-limit=64 sha256:34658533a39f07a1e20e6a6c46c4aa8dded3a4a0e19bf5c9c14aabaf85ffa36a node apps/api/dist/test/dossier-pdfinfo.smoke.js
& $docker --host $engine run --rm --network none --read-only nomina-api:h24-pdfinfo-local dpkg-query -W poppler-utils libpoppler126
& $docker --host $engine run --rm --network none --read-only nomina-api:h24-pdfinfo-local sha256sum /usr/bin/pdfinfo
& $docker --host $engine image inspect nomina-api:h24-pdfinfo-local
```

| Ejecucion | Resultado |
|---|---|
| Build API TypeScript dentro de Linux | OK |
| Smoke obligatorio en runtime stage | 12/12, exit 0, incluido timeout real; etapa 10.5 s |
| Smoke en imagen final, sin red, rootfs read-only, 512 MiB/1 CPU/64 PID | 12/12, exit 0 |
| Mismo smoke por ID inmutable, usuario node, cap-drop ALL/no-new-privileges | 12/12, exit 0 |
| PDF valido / magic falso / truncado | Aceptacion y rechazos esperados |
| Cifrado usuario / propietario con usuario vacio / JavaScript | Rechazados |
| 500/501 paginas, salida excesiva, bytes >7.5 MiB | Limites correctos |
| Ejecutable ausente | Falla cerrada con DOSSIER_PDF_VALIDATOR_UNAVAILABLE |
| Proceso sintetico lento | Timeout real 10 s, rechazo controlado y limpieza |
| Temporales | Verificados vacios tras cada comprobacion; limpieza final |
| Contenedores de prueba restantes | Ninguno; ejecutados con --rm, sin puertos ni mounts de host |

Incidente del primer smoke aislado: `/tmp:rw,nosuid,size=128m` resulto montado
con `noexec` (confirmado leyendo /proc/mounts). Las primeras 11 comprobaciones
pasaron, pero el fixture ejecutable del timeout fue rechazado como validator
unavailable y el smoke termino con exit 1. Se corrigio **solo el comando de ensayo**
agregando exec explicito; ambos reintentos completos pasaron. No se relajo el
validador ni se omiten errores. La ejecucion de pdfinfo instalado funciona aun
con /tmp noexec; ese permiso adicional corresponde al fixture sintetico, no a una
decision de permitir ejecutar archivos cargados por usuarios.

Evidencia local ignorada por Git: `.cache/h24-pd01-linux-build.log`,
`h24-pd01-linux-smoke.log` (intento fallido), `h24-pd01-linux-smoke-exec.log`,
`h24-pd01-linux-smoke-nonroot.log`, `h24-pd01-image-inspect.json` y
`h24-pd01-linux-os-packages.txt` (inventario dpkg completo), todos bajo `.cache/`.

### Limites del cierre

**PD-01 cerrado: parser empaquetado, ruta/version reales verificadas y smoke
Linux de la imagen final aprobado. No equivale a autorizar release H24.**

El npm install ya existente del Dockerfile informo 25 vulnerabilidades
(0 criticas, 12 high, 12 moderate, 1 low) en su contexto API/root. No es el mismo
universo del audit previo de todo el monorepo. No se ejecuto npm audit fix ni
se cambio lockfile del repositorio. Inventario/triage de vulnerabilidades de SO
y npm sigue en PD-06; no se hizo escaneo de vulnerabilidades de imagen ni se
afirma que Poppler este libre de CVE por pasar este smoke.

La imagen mantiene su usuario por defecto (root). La prueba adicional con node
demuestra compatibilidad del parser, no cambio efectivo del usuario de la API ni
hardening integral. El ensayo de 512 MiB no sustituye capacidad concurrente PD-07.
pdfinfo no es antivirus: PD-03 y estrategia de visor siguen pendientes.
GCS, autenticacion real, worker, H05/backup y AUTH-01 no se cierran aqui.

Sin produccion, conexiones BD locales/productivas, deploy, Cloud Build, migraciones,
API autenticada, storage real, archivos personales, escrituras funcionales,
cambios H01/Nomina/snapshots/permisos. No se inicio server.js. No se repitieron
tests de integracion que reconstruyen BD. Solo se actualiza documentacion en el
workspace; build y paquetes se limitaron a Docker local. Sin commit/push.
