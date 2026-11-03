# H24 PD-07 - Revalidacion end-to-end B01 a B04

Fecha: 2026-11-03. Rama: `feature/h02-h03-user-coordinations-permissions`.
Base: `4e48cac711c92a4f56f1b47b4a3af5f95d427253`, inicialmente limpia y sincronizada.
Autorizacion: repetir capacidad, diagnosticar y corregir localmente; no desplegar.
**H24 mantiene NO-GO. Esta evidencia no autoriza produccion.**

## 1. Alcance y laboratorio

Docker Desktop Linux, 16 CPU logicas, aproximadamente 7.6 GiB disponibles.
API 1 GiB/2 CPU/128 PIDs; scanner 4 GiB/2 CPU/64 PIDs; inspector
512 MiB/1 CPU/64 PIDs; PostgreSQL 18 efimero 512 MiB/1 CPU/128 PIDs.
Filesystem raiz read-only para API/analizadores; tmpfs acotados. Firmas originales
montadas solo para copia read-only; freshclam actualiza un volumen desechable.

BD exacta `nomina_docente_test`, puerto loopback 58328, contenedor nuevo sin
volumen compartido. Datos exclusivamente sinteticos. H05 parte de 18 baseline
y aplica 016/017 solo aqui: 20 registradas, pending=0, mismatch=0.
Se conserva dump sintetico previo, hashes, imagenes inmutables, logs, metricas,
inventarios y limpieza en `.cache/pd07-e2e/<id>/`, fuera de Git.

API/Fastify, HTTP, SQL, parser, antivirus y almacenamiento de archivos son reales.
Auth usa actores de test e identidad interna inyectada: NO acredita Firebase real,
IAM, GCS, Hosting, navegador ni el comando de arranque runtime productivo. La imagen
runtime se construye separadamente; los casos se ejecutan con Vitest en imagen de
regresion. No se accede a produccion, a credenciales cloud ni a la BD local habitual.

## 2. Ensayo inicial: fallo conservado

Evidencia: `192045a2-1d46-4d5a-b835-68ee9f42c4fa`, inicio 16:21:16 UTC.
Codigo funcional anterior a la correccion de este informe, capturado en sus
imagenes antes de editarlo. El harness usa una transferencia por cliente,
alineada con B04, y no reintenta cargas del lote.

- 6 casos aprobados, 1 fallido; salida 1, no aceptado como capacidad.
- Serial/permisos, preservacion B03, proxy 60 s/replay, recuperacion de borrado,
  JPG/PNG y cuerpos lentos: aprobados en su alcance local.
- Lote de una sesion: 10/10 completos al primer intento, 34.3 a 44.8 s.
- Dos sesiones: un cliente queda con 202 pendiente en su primera carga; el otro
  completa 10. De 30 archivos planificados, 20 completos, uno pendiente y nueve
  no enviados. Una carga completa tarda 57.7 s, supera objetivo local de 55 s.
- El cierre de limpieza tambien falla por documento/operacion pendiente. No se
  cuenta como exito ni como publicacion de bytes sin validar. Fingerprints de las
  22 tablas protegidas coinciden. No se ejecuta recuperacion asistida para ocultarlo.
- Contenedores y volumen propio retirados; se conserva evidencia del fallo.

## 3. Diagnostico y correccion

El flujo adicional analizaba inicialmente los bytes y volvia a analizarlos
inmediatamente despues de releerlos del almacenamiento, aun cuando el hash era
identico. Con escaneos observados de aproximadamente 18 a 23 s, el segundo
analisis duplicaba carga y competia con el siguiente cliente. La espera de 20 s
era menor que algunos analisis validos (29 s en frio).

Cambios acotados:

1. `TeacherDossierService` conserva un comprobante privado de validacion solo
   dentro de la solicitud, ligado a operationId, SHA-256 y tiempo. Despues de
   almacenar, SIEMPRE relee y verifica el hash. Solo omite el segundo analisis
   si coinciden operacion/hash y han pasado entre 0 y 30000 ms.
2. No existe cache persistente/global ni veredicto enviado por el cliente.
   Cambio de hash bloquea publicacion; expiracion/reloj inverso requiere analisis.
   Worker, replay independiente y lectura posterior no reciben el comprobante.
   Autorizacion persistida se vuelve a verificar antes de publicar.
3. Cola del analizador: sigue un proceso activo y un solicitante en espera;
   espera maxima 30 s. Tercero recibe BUSY; no se elevan MaxFiles, bytes, PIDs,
   memoria ni deadlines de freshclam/analisis. Constancia no cambia de logica.

Diez pruebas unitarias especificas cubren upload/reemplazo, expiracion, reloj,
hash, operacion distinta, worker, rechazo inicial, rechazo al revalidar y
revocacion persistida. No cambia H01, SQL, contratos publicos ni permisos.

## 4. Repeticion corregida

Evidencia: `cc93d5e7-e07a-46e5-a422-de15b369510a`.
Inicio 16:54:51 UTC. **Capacidad local aprobada: 7/7, exit del recorrido 0.**
`results.json`: passed=true, integrityPassed=true, unassistedBatchPassed=true.

| Lote | Completos al primer intento | Minimo | Media | p95 (nearest rank) | Maximo |
|---|---:|---:|---:|---:|---:|
| Una sesion | 10/10 | 17.463 s | 19.772 s | 23.298 s | 23.298 s |
| Dos sesiones | 20/20 | 18.140 s | 37.213 s | 40.931 s | 41.218 s |

Cero reintentos o fallos iniciales de lote. La carga mas lenta cumple <55 s.
Recorrido completo: 1327.534 s; lotes combinados 580.684 s. 121 requests del
helper, 56 envios POST/PUT mas dos cuerpos incompletos (58); 62 analisis AV.
Primer ensayo: 47 envios del helper mas dos incompletos (49), 82 AV. Total de
ambos recorridos: 107 envios y 144 AV, sin tercera repeticion de capacidad.

Integridad antes de la suite general: 22 fingerprints identicos; cero documentos
adicionales, operaciones pendientes o archivos adicionales; una constancia vigente
y su unico archivo, esperados por el escenario. B03 mantiene los archivos previos.
Proxy: 504 controlado a 60.007 s; operacion termina COMPLETE y replay conserva un
solo documento. Cuerpos lentos liberan admision a 30.008/30.006 s.
RSS maximo del proceso de capacidad 375164928 bytes. Cgroup API al final incluye
la primera regresion: pico 481259520; scanner 1507102720 bytes, sin OOM/oom_kill.
Scanner con tini y sin zombis al cierre. Cuatro contenedores y volumen propio
retirados; inventarios/cleanup conservados. La BD habitual no se consulto.

Imagenes locales inmutables (no publicadas):
- API de prueba: `sha256:6165bed082c42c7471b7fc6ce57a1efba2ca4515c0703d6e13f7948726baab7a`.
- API runtime: `sha256:667b4525d40de4083a09fd134632ddbd43c3821eef7a63895fa4bfc2adbc836a`.
- Scanner: `sha256:9ad2914ee8a8a7e608b51dd99499979361a39c9759fe138f3c4d6336cb8b3237`.
- Inspector: `sha256:472559fcd44f0b9a96644f2693705b5296411be82293fa1c0d3a8b0a9bfab790`.
Runtime: 12/12 comprobaciones pdfinfo Linux aprobadas. Lockfile sin cambios:
`2fe9d136048c46dc967126f422897cf1cc3ccf67a7ac2fb18c545231f76a3ed5`.

Se repite TODO el recorrido sin FOLLOWUP ni reintentos encubiertos. Lotes:
una sesion de diez, despues dos sesiones de diez cada una; cada cliente envia
una solicitud a la vez. Mezcla PDF pequeno/1/4/7.5 MiB. Criterio: 30/30 COMPLETE
en primer intento y cada carga <55 s. El harness se detiene por cliente tambien
ante 202: criterio mas estricto que la continuacion de algunos estados UI.
Los PDF de tamano exacto son sinteticos de una pagina con padding, no escaneos
institucionales de complejidad arbitraria. La muestra de 500 paginas se usa para
verificar rechazo seguro por MaxFiles; no es una carga aprobada. JPG/PNG incluyen
una muestra de 25 megapixeles. Los hashes del corpus quedan en results.json.

El proxy sintetico conserva corte 60 s; se inyectan 61 s de demora para comprobar
504, asentamiento posterior y replay de la misma operacion sin duplicacion.
No equivale a Hosting real ni demuestra que todos los escaneos caben en 60 s.
Constancia no adquiere idempotencia de operaciones adicionales por este ensayo.

Presupuesto por ejecucion: 60 POST/PUT, 300 AV, 1500 requests, dos horas;
15 minutos por caso. Los dos intentos tienen presupuestos y evidencia separados.
La regresion PostgreSQL opcional ocurre solo despues de aprobar capacidad y
guardar evidencia. Su primer intento reutilizo el contenedor de capacidad:
75 PASS, 70 FAIL y 22 SKIP; termina exit 1. PostgreSQL registro `No space left on
device` en el tmpfs de 256 MiB al recrear esquemas/WAL; faltantes de tablas y
errores posteriores son cascada. No se atribuye ese intento a regresion funcional
ni se elimina del historial. Manifest general conserva integrationExit=1.

Se corrige solo infraestructura del harness: `regression.mjs` crea otra BD
efimera sin puertos publicados, 2 GiB de tmpfs/3 GiB de memoria, y usa la MISMA
imagen de codigo aprobada. Exige manifest/results de capacidad aprobados y hashes
coincidentes. No eleva recursos del ensayo de capacidad ni modifica tests H01,
backend de negocio o fixtures para hacerlos pasar.
Repeticion `regression-2eddd533-21fb-4200-9751-076f17d3d254`: **167/167, 21 archivos,
exit 0, 71.34 s**. Disco al terminar: 396 MiB usados de 2 GiB, frente a los
256 MiB insuficientes del intento anterior. Ambos contenedores retirados,
sin OOM. El resultado independiente es `regression-*/result.json`; no se
reescribe integrationExit=1 ni se ocultan los logs del primer intento.

## 5. Regresion

| Validacion | Resultado |
|---|---|
| npm run test:api | 417 PASS, 21 SKIP opt-in |
| npm run test:web | 169 PASS |
| npm run typecheck | OK |
| npm run build | OK |
| node --test services/document-security/server.test.mjs | 7 PASS |
| Typecheck del harness end-to-end | OK |
| Integracion PostgreSQL aislada, misma imagen, laboratorio separado | 167 PASS / 167, exit 0 |
| Imagen runtime / pdfinfo Linux | 12 PASS |
| git diff --check | OK |

Comandos de regresion y comprobacion (sin conectar BD habitual):

```powershell
npm run test:api
npm run test:web
npm run typecheck
npm run build
node --test services/document-security/server.test.mjs
node node_modules/typescript/bin/tsc -p tools/validation/h24-pd07-e2e/tsconfig.json
$env:H24_PD07_APPROVED='true'
$env:H24_PD07_REGRESSION='true'
node tools/validation/h24-pd07-e2e/run.mjs
node tools/validation/h24-pd07-e2e/regression.mjs .cache/pd07-e2e/cc93d5e7-e07a-46e5-a422-de15b369510a/manifest.json
git diff --check
git status --short
```

El ultimo comando Node es la repeticion SOLO de integracion tras corregir el
laboratorio. Es equivalente a la suite `test:api:integration`, con configuracion
guardada para Docker y cache temporal; no se ejecuta contra PostgreSQL del host.
No se reejecuta capacidad para ocultar un fallo de regresion.

## 6. Gates restantes y siguiente decision

| Gate | Evidencia / pendiente real |
|---|---|
| PD-01 / PD-02 | Evidencia previa de parser Linux y GCS aislado; no se declara validacion productiva |
| PD-03 | Politica segura conservada; falta cerrar riesgo del visor/aislamiento y configuracion cloud final |
| PD-04 | Usuario confirma recepcion del correo sintetico el 03/11. Cierra entrega, no multiples cadencias ni alerta por ausencia; Scheduler sigue pausado segun acta previa, no consultado/modificado hoy |
| PD-05 | Cuatro casos de identidad real siguen pendientes por decision humana: segunda cuenta, dominio distinto, correo no verificado y token valido de otro proyecto; no se crean recursos ni se acepta riesgo implicitamente |
| PD-06 | Audit online actualizado: 0 criticas, 0 altas, 20 moderadas, 1 baja. Nuevos glob/minimatch ademas de UUID/esbuild; requiere remediacion compatible y regresion, o excepcion humana formal, no audit fix |
| PD-07 | Capacidad local 7/7 y lotes 30/30 aprobados; runtime/cloud/Hosting/UI reales siguen separados |
| PD-08 | Ensayo previo H05/restauracion local aprobado. Falta artefacto exacto de rollback, paridad del destino y backup/ventana productivos autorizados |

Siguiente orden recomendado: cerrar PD-06 por consumidor con regresion o
decision formal de riesgo; resolver identidades/excepciones PD-05 y aceptacion
de aislamiento/visor PD-03; autorizar una ventana de validacion cloud aislada
con los artefactos finales para PD-04/PD-07, sin usar produccion. Por ultimo,
comprobar artefacto de rollback y preparar ventana H05/backup. No hay GO implicito.

Ver [triage actualizado](H24_PD06_Triage_Residual_UUID_Esbuild.md),
[cloud aislado](H24_PD03_PD04_Arquitectura_Cloud_Aislada.md) y
[predeploy](H24_Fase4_PreDeploy_Expediente_Docentes.md).
No convertir el uso institucional en excepcion de seguridad ni extender las
autorizaciones locales a creacion de identidades, cambios IAM o despliegues.

## 7. Confirmaciones

Sin produccion ni deploy, sin acceso a la BD habitual, sin cambios de H01,
datos reales/fiscales, snapshots o corridas historicas. Solo fixtures y migraciones
016/017 en contenedores desechables autorizados. Sin dependencias instaladas o
actualizadas, audit fix o force. No se realiza commit/push en esta fase.
