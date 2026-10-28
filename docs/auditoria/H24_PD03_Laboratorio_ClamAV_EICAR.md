# H24-PD-03 - Laboratorio local ClamAV y EICAR

Fecha: 2026-10-28. Rama: `feature/h02-h03-user-coordinations-permissions`.
Base funcional: `c11a8e875fa47c28b9ea179ec240919dd8fbb0c9`.
Estado: **A1/A2 ejecutados satisfactoriamente en laboratorio; PD-03 abierto,
H24 NO-GO**. Sin integracion en la aplicacion ni autorizacion de deploy.

## 1. Autorizacion y alcance

El usuario autorizo preparar Docker local con ClamAV y probar archivos sinteticos
y EICAR. No autorizo en esta entrega corregir la API/visor ni probar contra BD/GCS.
No se accedio a BD, produccion, Firebase, GCS ni expedientes reales; no se cambiaron
credenciales, IAM, roles, antivirus de Windows, dependencias npm ni Dockerfile API.
Los dos documentos pendientes de la revision anterior se conservaron y ampliaron.

EICAR es un marcador de prueba, no malware real, conforme a su [definicion oficial](https://www.eicar.org/download-anti-malware-testfile/).
No se ejecuto el marcador como programa. Se genero dentro del tmpfs del contenedor;
no se descargo como archivo al host ni se abrio en navegador. No se detecto una
intervencion del antivirus anfitrion durante los comandos; no se desactivo ni se
crearon exclusiones. No se realizo auditoria independiente del antivirus Windows.

## 2. Motor, firmas y reproducibilidad

| Concepto | Evidencia |
|---|---|
| Docker | Desktop 4.97.0; Engine 29.9.2; contexto desktop-linux |
| ClamAV | 1.5.4, imagen oficial clamav/clamav; seleccion inicial stable y posterior fijacion por digest |
| Digest base | `sha256:bda39705e291105049c3936e2803ac90b955172af8030f94f05dce1252df6c6d` |
| Imagen laboratorio | `h24-pd03-clamav:local` |
| ID imagen final | `sha256:b9a6420a82ddb624f77b5241931db79c0f55320db1b50c0d6a2c49fb986d3dbf` |
| Actualizacion firmas UTC | 20:31:09 a 20:31:14; FreshClam exit 0, prueba de base aprobada |
| Firmas oficiales | main 63; daily 28167, 2026-10-28 06:24:17; bytecode 339 |
| Motor cargado | 3,628,233 firmas segun resumen clamscan; no firmas locales propias |
| Ejecucion final UTC | 20:35:49.642 a 20:36:27.038; exit 0, OOMKilled=false |
| Memoria pico cgroup | 1,009,311,744 bytes, aproximadamente 963 MiB |
| Temporal usado al final | 120 KiB incluyendo fixtures y logs; luego eliminado |

La [imagen oficial](https://docs.clamav.net/manual/Installing/Docker.html) incluye
firmas iniciales; se actualizaron en un paso separado. El aviso de FreshClam
`Clamd was NOT notified` fue esperado: no habia daemon escuchando y la actualizacion
termino correctamente. La licencia principal de ClamAV es GPLv2, documentada por
el [proyecto](https://docs.clamav.net/); esta revision no sustituye inventario de
licencias/vulnerabilidades de todos los paquetes de la imagen antes de distribuirla.

SHA-256 de firmas usadas:

| Archivo | SHA-256 |
|---|---|
| daily.cld | `c0a396585ceae5465a199808fbfbcb1256fddb67d13018a5915c8c5774c9c2e4` |
| main.cvd | `0b2182d229f46981ec8f535382222f7c9dfdd656b250ad47988b910a8d302365` |
| bytecode.cvd | `6d4aa01f219e988060fc419f495d07f27e0cdf1a2cccc065971da922c76f7ffb` |

## 3. Aislamiento verificado

- Analisis con `--network none`; tabla IPv4 sin rutas y ningun puerto publicado.
- Usuario Linux `100:101`, no root; `CapEff=0`, `NoNewPrivs=1`, no privileged.
- Filesystem de solo lectura; intento de escritura en `/opt/h24` rechazado.
- Unico montaje persistente: firmas oficiales, solo lectura durante analisis.
- Sin montajes del repositorio, archivos personales, socket Docker o credenciales.
  Variables de imagen observadas: PATH y TZ, sin configuracion de la aplicacion.
- `/tmp` tmpfs de 128 MiB con noexec/nosuid/nodev; fixtures y logs efimeros.
- Limites: 4 GiB RAM y memory-swap=4 GiB, 2 CPU, 64 PID. La igualdad de limites
  [deshabilita swap del contenedor](https://docs.docker.com/engine/containers/resource_constraints/).
- Analisis limitado a 8 MiB de entrada, 32 MiB de expansion, 8 niveles y 100 archivos
  internos; plazo de motor 10 s y deadline externo 120 s. Son valores de laboratorio,
  no nueva politica productiva ni sustituto del limite API de 7.5 MiB.
- Actualizacion de firmas con red, sin corpus ni credenciales, en otro contenedor.

Estos controles acreditan el laboratorio, no que la API o el visor ya tengan el
mismo aislamiento. No se probo escape de contenedor ni se certifico el host.

## 4. Resultados reales

Siete grupos de comprobacion, once observaciones de archivo/fallo. El harness
final y sus aserciones terminaron con `LAB_RESULT=PASS cleanup=PASS`.

| Caso | Resultado observado | Interpretacion |
|---|---|---|
| Texto benigno | OK, exit 0 | Sin deteccion, no datos personales |
| PDF sintetico benigno | OK, exit 0 | Sin deteccion; no abrir archivo real |
| EICAR texto, 68 bytes | Eicar-Test-Signature, exit 1 | Deteccion correcta |
| Mismos bytes con extension .pdf | Eicar-Test-Signature, exit 1 | La extension no evadio el motor |
| PDF sintetico con EICAR como adjunto | Eicar-Signature, exit 1 | Deteccion del marcador en este contenedor PDF |
| PDF malformado | OK, exit 0 | Limite confirmado: antivirus no valida estructura |
| PDF con JavaScript inerte `void 0` | OK, exit 0 | Limite confirmado: no implementa politica de rechazo de JS |
| Directorio de firmas vacio | ERROR, exit 2, cero archivos escaneados | No disponible, nunca limpio |
| 64 KiB con limite de 1 KiB | Heuristics.Limits.Exceeded.MaxFileSize, exit 2 | Analisis incompleto, no publicar |
| Deadline externo de 1 s | Proceso detenido, exit 137 | Se interrumpio carga del motor; no resultado limpio |
| Firmas iniciales antiguas y limite de edad 1 dia | ERROR, exit 2 real en docker inspect | Rechazo por antiguedad, cero archivos escaneados |

Se verifico el MD5 estandar del marcador antes de probar; los SHA-256 del corpus
permanecieron identicos antes/despues. Las lineas `OK` de `sha256sum -c` son
integridad, NO veredictos antivirus. El marcador y el PDF con adjunto nunca se
abrieron ni ejecutaron; no se uso malware real ni una bomba de descompresion.

El caso de firmas antiguas utilizo daily 28164 del 2026-10-25, incluido en la imagen
fijada, sin montar el volumen actualizado. No se altero el reloj ni las firmas.
La caducidad de dos dias del harness es una propuesta de ensayo, no una regla ya
aprobada para produccion. La clasificacion futura debe atender el resultado completo:
exit 0 con analisis completo, rechazos, errores, limites, edad de firmas y deadline.
No interpretar todo exit 1 como malware ni todo resumen `Infected files: 0` como limpio.

## 5. Ajustes del harness y limites de la evidencia

Se conservaron los intentos iniciales fallidos como evidencia local:

1. Primer ensayo paso dos opciones max-filesize; la expectativa de limite no se
   cumplio. Se eliminaron opciones repetidas y se hizo un caso independiente.
2. El caso independiente alerto correctamente, pero retorno 2, no el 1 esperado
   inicialmente. Se ajusto la asercion a la version fijada, manteniendo rechazo.
3. La imagen oficial trae healthcheck para clamd; al usar clamscan sin daemon
   reportaba unhealthy. El Dockerfile exclusivo del laboratorio desactiva ese
   healthcheck inaplicable. Se repitio toda la bateria con la imagen final.

No se modifico la aplicacion para adaptar estos resultados. No se ensayaron aun
cifrado, formularios XFA/AcroForms, enlaces, firmas digitales, CDR, limites de
expansion/recursion alcanzados, timeout dentro del parser PDF o corpus amplio.
El deadline ejercitado fue durante carga de firmas, no una prueba de todos los
tiempos internos. Tampoco se probo clamd persistente, concurrencia o capacidad
productiva; cada invocacion de clamscan tardo alrededor de 9 s por cargar motor/firmas.

## 6. Artefactos y limpieza

Harness reproducible, sin conexion a la aplicacion:

- `tools/validation/h24-pd03/Dockerfile`;
- `tools/validation/h24-pd03/smoke.sh`;
- `tools/validation/h24-pd03/pdf.awk`;
- `tools/validation/h24-pd03/.gitattributes` para conservar LF en scripts Linux;
- `tools/validation/h24-pd03/README.md` con comandos y condiciones de parada.

Registros generados locales, ignorados por Git:
`.cache/h24-pd03-20261028/`. No contienen bytes de documentos ni EICAR completo.

| Evidencia | SHA-256 |
|---|---|
| final-scan.txt | `c5544ddda7da79df32993bfeabe987624183b41bd908d0d7a066424f7af644bc` |
| containers.json | `5b766f2fc226693b72276855c8e023112330f7cde0755cacb6d2763c7dcdf656` |
| stale-signatures.txt | `82e31035bd1135f768561868415cb6c606b96b97d8404157b54985107c297663` |

Se verifico limpieza del temporal y se retiraron los seis contenedores creados,
incluidos intentos intermedios y actualizador. `docker ps` final no mostro contenedores
activos. Se conservan imagenes locales/cache de build y el volumen identificado
`h24-pd03-signatures-20261028` con solo firmas oficiales para evitar redescargas;
no contiene expedientes, fixtures ni EICAR. No se ejecuto prune ni se retiraron
recursos ajenos. No se instalaron componentes en el sistema Windows.

## 7. Siguiente paso y confirmaciones

A1/A2 quedan atendidos en este alcance. La evidencia confirma la utilidad del
motor y tambien que **ClamAV no reemplaza pdfinfo ni la politica PDF**.

Requiere autorizacion A3 para implementar el pipeline local de ambas rutas,
veredictos completos, error seguro, aislamiento y proteccion de reemplazo. A4
permitiria despues integrarlo con BD/buckets H24 con respaldo/restitucion. Antes
de ello deben decidirse funciones PDF permitidas, historicos y riesgo del visor.
No se aprobaron implicitamente nuevos paquetes, migraciones, IAM ni infraestructura
productiva. PD-03 sigue abierto y los otros gates H24 conservan su estado.

Validacion de entrega: build de imagen laboratorio, smoke real, inspeccion de
restricciones/exit codes, integridad y limpieza; `git diff --check` y revision de
archivos. No se ejecutaron suites API/Web/BD ni build de la aplicacion por no haber
cambios funcionales. Sin commit/push automaticos.

Confirmaciones: sin BD (incluida nomina_docente_test), sin GCS/Firebase, sin produccion,
sin deploy, sin migraciones, sin npm audit fix, sin cambios de API/UI/H01/datos
fiscales, sin cambios en roles, Nomina, corridas o snapshots.
