# H24 PD07-B02 - Procesos del scanner y carga concurrente local

Fecha: 2026-10-30, America/Cancun. Base Git: `00e3f94`.
Rama: `feature/h02-h03-user-coordinations-permissions`, limpia al inicio.
Usuario autoriza diagnostico, correccion y carga concurrente Docker local,
sin produccion ni deploy. No autoriza un nuevo release ni cierra los otros gates.

**Resultado: defecto PD07-B02 corregido y carga del scanner aprobada localmente.**
PD-07 completo y H24 conservan NO-GO; no se ha repetido la carga API/BD/GCS/Hosting
end-to-end ni corregido PD07-B03.

## 1. Causa reproducida

La imagen scanner ejecutaba Node como PID 1. El script real scan-stdin.sh usa
`timeout -s KILL 115 clamscan`; timeout pertenece a BusyBox 1.37.0 en la base
Alpine fijada. Sus procesos watchdog huerfanos terminaban como zombis adoptados
por PID 1, que no los recolectaba. Se verifico por /proc, no solo por docker top.

Control minimo, sin antivirus, red ni BD: veinte ejecuciones de
`timeout -s KILL 115 /bin/true` en la misma imagen y limite de 64 PIDs:

| PID 1 | PIDs antes | PIDs despues | Zombis timeout con PPID 1 |
|---|---:|---:|---:|
| Node | 11 | 31 | 20 |
| tini | 12 | 12 | 0 |

Esto explica un proceso residual por invocacion de timeout, compatible con el
agotamiento observado en PD-07. En esta reproduccion se acumulan watchdogs zombis,
no threads del motor ClamAV; no justifica elevar pids-limit. El runner de aquel ensayo diferia del
runner cloud; por eso esta fase usa tambien la imagen/runner real en carga.

## 2. Correccion minima

Solo se cambia el entrypoint de `Dockerfile.scanner`:

```text
/sbin/tini -- /usr/bin/node /opt/h24/server.mjs
```

La base fijada ya incluye tini; no se instalan nuevos paquetes ni cambian
dependencias npm. Tini queda como PID 1, Node conserva el servidor y el runner.
Se conservan usuario 100:101, 64 PIDs de ensayo, 4 GiB, limites temporales,
process-group termination, freshclam, antiguedad de firmas, controles AV,
MaxFiles, protocolo de veredictos y rechazo seguro ante fallos.

Fundamento adicional: [Docker, responsabilidad del proceso principal y uso de init](https://docs.docker.com/engine/containers/multi-service_container/).
Se incluye init en la imagen, sin depender de que el operador agregue --init
al comando local ni de una capacidad implicita del entorno cloud.

## 3. Regresion de procesos

Nuevos process-lifecycle-probe.mjs y process-lifecycle.test.mjs. Opt-in explicito,
imagen por SHA, Docker desktop-linux, sin red, root filesystem read-only,
cap-drop ALL, no-new-privileges, 128 MiB, 1 CPU, 64 PIDs.

- Control negativo: Node PID 1 reproduce acumulacion de zombis.
- Control positivo: 100 comandos exitosos y dos salidas reales por timeout,
  cero zombis y mismo numero de PIDs antes/despues.
- Se verifica que la imagen entregada declare el entrypoint con tini.
- Health del entrypoint real y SIGTERM: terminacion limpia con exit 0, sin OOM.
- Resultado: 3/3 pruebas de ciclo de procesos aprobadas. Contenedores retirados.
- Servidor HTTP existente: 3/3 pruebas aprobadas (rutas, contrato, concurrencia,
  rechazo saneado y liberacion de cupo).
- API: 379 pruebas aprobadas, 15 opt-in Docker omitidas, exit 0; sin BD.

## 4. Carga concurrente

Dos clientes sinteticos, diez PDF cada uno, tres analisis por archivo y warmup;
servidor/runner reales con freshclam. El volumen AV corresponde al que generarian
carga, validacion de publicacion y lectura, pero no se ejecutan esas operaciones
contra una API/BD real en este ensayo.
La prueba se limita al scanner HTTP. No guarda expedientes ni modifica BD/GCS.
Reintentos 429 explicitos del harness no equivalen a una cola de aplicacion.

Primera ejecucion: 20/20 archivos, 61 veredictos limpios con hash correcto,
cero errores AV, cero zombis, cero directorios de solicitud pendientes, sin OOM.
Termino con exit 1 por una asercion del harness: comparaba 15 PIDs de arranque
frio contra 19 al terminar. /proc/7/task identifica cuatro `libuv-worker`
inicializados durante la primera operacion fs/freshclam. No son zombis.
Se conserva scanner-load-first-results.json con passed=false, sin convertirlo
retroactivamente en aprobado. Se corrigio el harness para comparar reposo tras
warmup con reposo final, con igualdad exacta, no aumentando la tolerancia ni los
64 PIDs. Se repite el lote completo sin reiniciar el scanner.

Segunda ejecucion completa con la asercion corregida: **exit 0 / passed=true**.

| Comprobacion | Resultado |
|---|---|
| Clientes / archivos | 2 clientes, 10 por cliente, 20/20 completados |
| Analisis reales ClamAV | 60 + 1 warmup, 61/61 limpios, hash y requestId correctos |
| Duracion | 547,025 ms, aproximadamente 9 min 7 s |
| Warmup de segunda ejecucion | 8,851 ms; freshclam ya verificado en primera solicitud de la primera ejecucion (14,473 ms) |
| PIDs reposo antes/despues del lote | 19 / 19 incluyendo los 7 threads de la sonda docker exec; runtime solo, al final: 12 |
| Zombis finales | 0 |
| Directorios h24-request pendientes | 0 |
| Logs segunda ejecucion | 61 document_check, todos code=0, cero severity ERROR |
| Rechazos por cupo ocupado | 1,100 respuestas 429; reintentos explicitos del harness, sin cambiar el servidor/API |
| Reinicios entre ejecuciones | 0; mismo contenedor durante 122 analisis reales acumulados |
| OOMKilled | false |
| Apagado final | SIGTERM, exit 0 |

Los snapshots al terminar archivos no capturan el pico durante clamscan: en el
segundo lote su maximo fue 20 PIDs / 177.01 MiB incluyendo la sonda. Observaciones
docker stats durante analisis mostraron alrededor de 15 PIDs y hasta 1.042 GiB;
al final en reposo: 12 PIDs / 123.5 MiB. Son muestras, no maximos exactos ni SLA.

### Imagen, aislamiento y limpieza

- Imagen local: `h24-cloud-scanner:pd07-b02-local-20261030`.
- ID: `sha256:87e358377b80187b3291d4140db789d4dba3329155861994725adbe16d452b39`.
- Capas RootFS identicas a la imagen anterior `be67cc35d053...`; solo cambio
  de configuracion de arranque, sin instalar paquetes ni ampliar limites.
- Runner real createProcessRunner, sin reemplazar freshclam ni scan-stdin.sh.
- Firmas oficiales daily 28169, build 2026-10-30 06:26 UTC, Verification OK;
  controles de edad/antiguedad intactos.
- Contenedor h24-pd07-b02-scanner: 4 GiB, 2 CPU, 64 PIDs, read-only root,
  cap-drop ALL, no-new-privileges, tmpfs /tmp 128 MiB; escucha publicada solo
  en 127.0.0.1:5262. Red de Docker para actualizacion oficial, no se afirma
  aislamiento de egress equivalente a network none en la carga con freshclam.
- Copia de firmas en volumen exclusivo h24-pd07-b02-signatures-20261030;
  volumen original montado read-only al copiar, sin actualizarlo.
- Contenedor y volumen exclusivo retirados por nombre/etiqueta verificados.
  Inventario final de contenedores vacio; se conserva exclusivamente el volumen
  original h24-pd03-signatures-20261028. Imagen local retenida, no publicada.

### Evidencia reproducible

Comandos de opt-in y guardas en `services/document-security/README.md`.
Carga: `scanner-load-local.mjs`. Ciclo de procesos: process-lifecycle.test.mjs
y process-lifecycle-probe.mjs. Build local con Dockerfile.scanner; nunca push
de imagen ni deploy. `node --check` de harness/probe y `git diff --check`: OK.
No se repite typecheck/build de API/web: no se modificaron esos componentes.

Evidencia ignorada `.cache/pd07-b02-20261030/`: scanner-load-first-results.json,
summary-first.json, scanner-first.log, scanner-load-results.json, summary.json,
scanner.log (segunda ejecucion), cleanup-results.json. El primer resultado
failed se conserva y no se sustituye como evidencia de aprobacion.

## 5. Pendientes

- PD07-B03: 500 paginas pueden exceder MaxFiles AV; no se tocaron estos limites.
- Repetir capacidad end-to-end final, con API, carga/publicacion/lectura,
  autenticacion y almacenamiento correspondientes; este ensayo no acredita ese flujo.
- El cliente cloud API sigue convirtiendo un scanner ocupado/no-200 en
  indisponibilidad. No se agrego cola ni se cambiaron reintentos de aplicacion;
  tampoco se garantiza que dos cargas de usuario terminen sin intervencion.
- Firma en cold start, tiempo total frente a Hosting, visor, otros gates H24 y
  destino cloud final siguen sujetos a su validacion/autorizacion propia.

## 6. Confirmaciones

No se cambia la API, frontend, H01, formulas monetarias, Nomina, snapshots,
permisos, datos fiscales ni SQL. Sin migraciones, acceso a BD local/productiva,
credenciales cloud, deploy, push o commit. PD07-B03 y capacidad end-to-end final
siguen pendientes. H24 mantiene NO-GO.
