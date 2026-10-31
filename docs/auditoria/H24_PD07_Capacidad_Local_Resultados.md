# H24 PD-07 - Capacidad local, limites y recuperacion

Fecha: 2026-10-30, America/Cancun. Base: `ecdf7d6`.
Rama: `feature/h02-h03-user-coordinations-permissions`, limpia al inicio.
Resultado: **PD-07 NO aprobado; H24 mantiene NO-GO**.

Seguimiento posterior 2026-10-30: [correccion autorizada PD07-B01](H24_PD07_B01_Correccion_Base64_Archivos_Grandes.md).
Decoder corregido localmente; 84/84 pruebas enfocadas en Windows y Linux.
Se preserva abajo la evidencia inicial. PD07-B02/B03 y repeticion end-to-end
con artefacto final siguen pendientes; PD-07/H24 no quedan aprobados.

Seguimiento posterior PD07-B02: [correccion del scanner y carga local](H24_PD07_B02_Correccion_Procesos_Scanner.md).
Confirmados watchdogs timeout zombis bajo Node PID 1; la imagen usa tini ya
incluido en su base. Carga scanner-only: 20/20 PDF, 61 analisis, PIDs estables,
cero zombis, sin elevar limites ni reiniciar. Pruebas de procesos/HTTP 6/6.
Se conserva el primer resultado fallido por comparar contra proceso frio y la
repeticion completa aprobada. B02 corregido localmente; B03 y capacidad
end-to-end final siguen pendientes, H24 NO-GO.

Revision posterior 2026-10-31: [PD07-B03 MaxFiles y complejidad PDF](H24_PD07_B03_Revision_MaxFiles_ClamAV.md).
Se reproduce MaxFiles=100 y se comparan candidatos acotados solo en Docker local.
Las paginas no equivalen a extracciones; tambien se observa MaxScanTime con
contenido mas complejo. La propuesta no modifica el wrapper operativo ni
garantiza aceptar todo PDF de 500 paginas. H24 mantiene NO-GO; ver resultados y
pendientes exactos en el documento enlazado, sin alterar la evidencia inicial.

## 1. Autorizacion y laboratorio

Usuario autorizo Docker local, almacenamiento sintetico y BD efimera, sin alterar
la BD local habitual, produccion ni hacer deploy. No autorizo corregir codigo
funcional como parte de estos ensayos. No se aplicaron correcciones funcionales.

Docker Desktop estaba detenido; se inicio y `docker ps -a` estaba vacio. Recursos
propios con etiqueta `purpose=h24-pd78-ephemeral`, prefijo `h24-pd78-*`:

- API: imagen local `nomina-regression:h24-pd06-local-20261029`, 1 GiB, 2 CPU,
  128 PIDs; Node 24.22.2. Codigo de contrato, servicio, rutas y cliente cloud
  cotejado SHA-256 contra el checkout, sin diferencias.
- Inspector: `h24-cloud-inspector:20261029`, 512 MiB, 1 CPU, 64 PIDs.
- Scanner: `h24-cloud-scanner:20261029`, 4 GiB, 2 CPU, 64 PIDs.
- PostgreSQL 18.6: contenedores exclusivos de 512 MiB, datos en tmpfs,
  `nomina_docente_test`; puertos 127.0.0.1:58318 y 58319, sin volumen de la BD habitual.
- API/analizadores comunicados por loopback del namespace de red del laboratorio;
  sin publicar endpoints HTTP fuera del laboratorio. Sin credenciales cloud.
- Cada intento de capacidad tuvo watchdog de 15 minutos. No prueba de carga abierta.

Se probaron rutas Fastify reales por HTTP, servicio documental real, PostgreSQL
y adaptador LocalDossierStorage en directorio privado temporal. Sesiones sinteticas
Admin/Finanzas mediante el mecanismo de test existente, no login Firebase real.
El cliente cloud real recibio URLs loopback y un proveedor de identidad sintetico
inyectados solo en el harness; no se alteraron sus guardas de configuracion.

El inspector ejecuto su wrapper real. El scanner utilizo createCheckServer y el
script AV real con firmas oficiales de solo lectura, pero un runner de laboratorio
sin freshclam automatico ni autenticacion IAM. No es equivalencia completa con
el proceso cloud: especialmente importante para interpretar el agotamiento de PIDs.

## 2. Resultados medidos

| Caso | Resultado |
|---|---|
| Firmas iniciales antiguas | API 503; ClamAV rechazo por antiguedad mayor a 2 dias; ninguna omision de antivirus |
| PDF sintetico 1,275 bytes, primer uso | Upload 200 en 19.411 s; lectura 200 en 8.915 s; SHA-256 identico |
| PDF 1 MiB | Upload 200 en 18.886 s; lectura 200 en 9.571 s; SHA-256 identico |
| Repeticion pequeno/1 MiB | 17.969/18.306 s de upload; 9.020/9.524 s de lectura |
| PDF valido exacto 7.5 MiB | Upload 503 en 102 ms; parser+AV directos OK en 10.154 s; defecto Base64 reproducido |
| PDF 500 paginas, 243,430 bytes | Parser acepta; AV alcanza MaxFiles; pipeline devuelve 503 y no publica |
| Dos sesiones, diez archivos por sesion, concurrencia 2 | 19/20 cargas y borrados completados; intento detenido a los 367.029 s por indisponibilidad del scanner |
| Cuerpos lentos, dos solicitudes incompletas | Conexion cortada a 30.013/30.016 s; cero llamadas a almacenamiento |
| Tercera carga durante los cuerpos lentos | 429, Retry-After=2; cupos liberados despues; la solicitud siguiente alcanza validacion (415 por MIME ausente) |
| Proxy local con corte a 60 s | 504 a 60.012 s; operacion original termina COMPLETE; reintento mismo operationId retorna 200 y mismo documentId, una sola fila |
| Reemplazo con borrado fallido inyectado | 202/CLEANUP; al retirar fallo, process(operationId) termina COMPLETE, bytes nuevos correctos y limpieza completada |
| PNG de 7,695,273 bytes | Parser/AV OK en 10.662 s |
| JPEG de 4,057,742 bytes | Parser/AV OK en 9.768 s |
| PNG 5000x5000, 25 MP, 349,068 bytes | Parser/AV OK en 9.554 s |
| Pruebas frontend existentes del expediente | 45/45, dos archivos; API mock, no navegador real |

JPG/PNG se ensayaron en pipeline de seguridad, no como cargas HTTP completas de
constancia. El resultado del decoder Base64 impide dar por aprobado ese recorrido
para imagenes grandes. La prueba de proxy inyecto 31 s por validacion y uso
analizadores reales; no demuestra que la latencia cloud sea esa ni que Hosting
real se haya probado. El resultado `ok` del ultimo harness describe solamente
timeout/recuperacion, no anula los intentos anteriores fallidos.

## 3. Hallazgos

### PD07-B01 - Base64 agota la pila con archivos dentro del limite

`apps/api/src/lib/dossier-contract.ts:33`, funcion decodeDossierPdf, utiliza una
expresion regular con grupos repetidos sobre toda la cadena Base64. En Node Linux
de la imagen actual, la invocacion directa con Base64 canonico produjo:

| Bytes decodificados | Resultado |
|---:|---|
| 1,048,576 | OK |
| 2,097,152 | OK |
| 4,194,304 | RangeError: Maximum call stack size exceeded |
| 7,864,320 | RangeError: Maximum call stack size exceeded |

No se determino el umbral exacto ni se extrapola a todas las versiones de Node.
El PDF de 7.5 MiB fue validado por parser/ClamAV separadamente: no era un archivo
malformado, no excedia los 12 MiB del body HTTP y no hubo OOM.

Las rutas de documentos adicionales traducen el fallo a DOSSIER_UNAVAILABLE/503.
La ruta de constancias tambien llama decodeDossierPdf; se identifica alcance por
codigo, sin afirmar un smoke HTTP de constancias grandes ejecutado en este turno.

Propuesta pendiente de implementacion: validacion Base64 de costo lineal y sin
patron repetitivo que agote pila, conservando limite, padding/canonicalidad y
round-trip. Agregar regresion a 1/2/4/7.5 MiB, Base64 invalido y exceso de limite,
para upload/reemplazo y constancia PDF/JPG/PNG. No reducir silenciosamente el
limite ni omitir controles de archivo para hacer pasar el ensayo.

### PD07-B02 - Lote concurrente no completa bajo el limite local de procesos

El scanner alcanzo 63 PIDs muestreados frente al limite 64; llamadas docker exec
fallaron con Resource temporarily unavailable y un analisis termino code=2.
La API lo rechazo con DOCUMENT_SECURITY_UNAVAILABLE. El lote completo no paso:
19 cargas nuevas llegaron a COMPLETE y fueron borradas; la restante no genero
intencion durable. No se observaron documentos duplicados ni estados pendientes.

Se reinicio solo ese scanner para terminar pruebas independientes. No se cambio
la aplicacion ni se aumento el limite. La causa precisa de acumulacion/liberacion
de procesos debe aislarse con el runner final, supervisado y sin diferencias de
laboratorio, antes de atribuirla a Cloud Run o afirmar que esta corregida.
Tambien se conserva el riesgo de 429 del analizador convertido en 503 por el
cliente API; no se afirma una cola global ni procesamiento transparente del lote.

### PD07-B03 - 500 paginas no garantizan aceptacion del antivirus

La ejecucion directa con los mismos limites AV devolvio
`Heuristics.Limits.Exceeded.MaxFiles FOUND`. Es una alerta por limite, no evidencia
de malware real en el PDF sintetico. `--max-files=100` alcanza el limite de objetos
inspeccionados para esta muestra aunque pdfinfo admita hasta 500 paginas.
El script responde indisponibilidad, no un veredicto limpio. Definir coherencia
de limites y mensaje operativo, sin ampliar capacidades o debilitar ClamAV
automaticamente. No se garantiza que todo PDF menor a 500 paginas sea aceptado.

## 4. Recursos y seguridad

Muestreo docker stats aproximadamente cada 5 segundos, no maximo exacto del kernel:

| Servicio | Pico de memoria muestreado | CPU maxima muestreada | PIDs maximos |
|---|---:|---:|---:|
| API/harness | 247.9 MiB | 20.29% | 22 |
| Scanner | 1,149.952 MiB | 100.47% | 63 |
| Inspector | 120 MiB | 20.44% | 17 |

El muestreo RSS interno de API llego a 370,065,408 bytes en el primer ensayo de
tamanos; incluye generacion/retencion del corpus dentro del harness y no es
memoria exclusiva del servidor. No se observo OOMKilled. Estas cifras no definen
un SLA ni dimensionan automaticamente el destino productivo.

Firmas: el volumen original h24-pd03-signatures-20261028 se monto solo lectura y
se conservo. Se copio a h24-pd78-signatures-20261030 y se actualizo por freshclam
contra el CDN oficial: daily 28169, build 2026-10-30 06:26 UTC, Verification OK;
main 63, bytecode 339. No se altero el limite de antiguedad. El volumen nuevo fue
eliminado al finalizar. No se usaron archivos institucionales.

## 5. Evidencia, limpieza y siguientes pasos

Evidencia local ignorada: `.cache/pd78-20261030/`:
pd07-first-capacity-results.json, pd07-size-page-results.json,
pd07-batch-results.json, pd07-results.json (timeout/recuperacion),
image-probe-results.json, slow-body-results.json, metrics-summary.json,
source-check.json, post-capacity-preserved.json y cleanup-results.json.
Los harness no modifican archivos funcionales y quedan fuera del commit.

Comando frontend ejecutado:
`npm --workspace apps/web run test -- src/components/TeacherDossierPanel.test.ts src/api.dossier.test.ts`.
No se instalaron dependencias ni se repitio build completo: codigo sin cambios.

Al terminar el ensayo HTTP: cero documentos, cero operaciones pendientes y
directorio temporal vacio; 21 tablas previas, excluyendo auditoria, conservaron
conteos/fingerprints. Auditoria de operaciones sinteticas permanece solo en el
laboratorio hasta su eliminacion. Antes de repetir PD-08 se destruyo/recreo
unicamente esa BD efimera, nunca la BD local habitual.

Todos los contenedores del ensayo y el volumen nuevo se retiraron verificando
nombres y etiquetas; tmpfs de BD desaparecio. Sin recursos cloud nuevos,
credenciales, produccion, deploy, cambios H01 ni datos reales. Sin commit/push.

**Siguiente paso:** aprobar correccion acotada PD07-B01 y diagnostico/ajuste
PD07-B02/B03; repetir capacidad completa con artefacto final. Mantener pendientes
recorrido cloud/Hosting real, capacidad del visor/navegador, SLA, cold start con
actualizacion de firmas y restantes gates H24. No autorizar deploy por estas pruebas.
