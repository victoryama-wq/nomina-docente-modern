# H24 PD-07 - Capacidad integrada local B01/B02/B03

Fecha: 2026-10-31, America/Cancun.
Base funcional: `d0ae6d389af2fe0f1c2e90dd63ea69ac64c1bd72`.
Rama: `feature/h02-h03-user-coordinations-permissions`.

**Resultado: NO-GO de capacidad. Integridad aprobada en la reanudacion;
hallazgo PD07-B04 de concurrencia. No autoriza deploy ni cierra H24.**
El usuario autorizo los puntos 1 y 2 del
[plan de capacidad](H24_PD07_Plan_Capacidad_EndToEnd_B01_B02_B03.md): laboratorio
desechable, carga acotada y fallos controlados. No autorizo cambios funcionales
automaticos ni el recorrido cloud de la etapa B.

## 1. Entorno y limites de evidencia

- PostgreSQL 18.6 en contenedor nuevo, DB `nomina_docente_test`, tmpfs propio,
  sin mounts de datos habituales. Publicacion exclusiva `127.0.0.1:58328`.
- API HTTP real, rutas/servicios/transacciones actuales y archivos locales
  privados. Adicionales usan LocalDossierStorage; constancia usa adaptador de
  test para put/read/remove. No equivale a precondiciones/generaciones GCS.
- Inspector y scanner ejecutan los procesos reales sobre HTTP interno.
  MaxFiles=100 y demas limites AV permanecen intactos; tini activo.
- Actores sinteticos de autorizacion; no login Firebase real. Identidad de
  analizador inyectada solo desde test hacia loopback, no validacion IAM.
- API 1 GiB/2 CPU/128 PIDs; scanner 4 GiB/2 CPU/64 PIDs;
  inspector 512 MiB/1 CPU/64 PIDs; PostgreSQL 512 MiB/1 CPU/128 PIDs.
- Copia privada de firmas desde volumen original montado read-only; freshclam
  solo actualiza la copia. Sin credenciales cloud, exportaciones reales o
  acceso a la BD local habitual. La red permite registros/fuentes de firmas;
  no se presenta como ejecucion totalmente offline.
- Se construyo la imagen runtime API, pero los casos HTTP se ejecutaron con
  imagen de regresion, fuente actual y Vitest. No afirmar equivalencia del
  comando runtime Cloud Run, navegador, Hosting, Firebase Auth o GCS.

El lockfile coincide con el de la imagen de regresion:
`2fe9d136048c46dc967126f422897cf1cc3ccf67a7ac2fb18c545231f76a3ed5`.
Node `24.22.2`; npm `10.9.4`. No se actualizaron dependencias.
El modulo compilado dossier-storage coincide entre API e inspector:
`c4d37c0286129be199b26e7e2f3d25db55cf2ecbd792ce151b0f5c86952a2e5b`.

## 2. Trazabilidad del laboratorio

Harness: `tools/validation/h24-pd07-e2e/`. Evidencia local ignorada:
`.cache/pd07-e2e/<id>/`. Incluye manifiesto, builds, H05, dump/corpus sinteticos,
requests, metricas, estados, logs e inventarios de limpieza. No contiene
documentos reales, tokens ni payloads Base64 en los reportes.

| Intento | Resultado y tratamiento |
|---|---|
| `d4a10989-81b4-412f-96a0-2fddca448bc1` | Build fallido: ID sha256 interpretado como nombre de repositorio; corregida referencia local verificada |
| `329f0219-953f-4ed7-981c-a30f07e54b8c` | Fixture incompleto de snapshot sintetico; agregada columna NOT NULL exigida por esquema, solo en harness |
| `86132e11-3c41-4bc7-b6e1-4548df9ed918` | Vitest intentaba escribir cache en root readonly; loader nativo y cache temporal |
| `938fa2dd-b6f4-4ebe-834e-325eca713f8f` | Error sintactico en adaptador de test; corregido y typecheck aprobado |
| `b17500c0-bb2e-4d78-aeb7-187354c7f325` | Ejecucion parcial: corpus serial aprobado hasta exceso de tamano; expectativa HTTP incorrecta y payload de reemplazo incorrecto. Interrumpida con SIGINT, exit 130; no cierre de integridad ni proxy acreditado |
| `efa3a0e9-d768-4037-873f-977b0b2156f1` | Reanudacion acotada con contratos corregidos, serial/proxy omitidos explicitamente; resultados siguientes |

No se ocultaron intentos fallidos ni se cambiaron contratos de la aplicacion
para hacerlos pasar. La constancia rechaza exceso Base64 con 400
VALIDATION_ERROR; adicionales tienen FILE_TOO_LARGE/413. El reemplazo adicional
usa operationId, expectedRevision y archivo, no documentType/title de alta.

Imagenes de la reanudacion, construidas localmente y no publicadas:

| Componente | Image ID |
|---|---|
| Harness/API | `sha256:d015151dc3a3f253698c4e41a916778410ea967bdb69fbe350e97ac09d077b83` |
| Runtime API construido | `sha256:495ded22aab50ab073d6ab08341eb6221838b20190585cec851ec5aae5853898` |
| Scanner | `sha256:c5118f7eaaaa531172598398c128274cbba2a234d2ebe64c88db7be49ce1e1d1` |
| Inspector | `sha256:62b55855086ffe298e3c25f3b66a1d80db88e5094a45e413366ca020aa4be78f` |

## 3. Esquema y datos sinteticos

En cada BD nueva se preparo el esquema hasta 015, fixtures H04 y centinelas
no vacios de corrida/lineas/snapshots sinteticos, sin invocar el motor monetario.
H05 registro **18 baseline + 016/017 aplicadas = 20; pending=0; mismatch=0**.
No se modifico ningun archivo SQL. Esto no es el estado productivo.

Fingerprint previo/posterior: todas las tablas publicas salvo las cuatro
tablas documentales/auditoria cuyo cambio es parte del ensayo:
teacher_documents, teacher_dossier_documents, teacher_dossier_operations,
audit_log. Se conservan nombres, conteos y hashes, no solo tablas vacias.

## 4. Resultados funcionales y de seguridad

| Caso | Resultado | Alcance |
|---|---|---|
| Permisos sinteticos | Comprobaciones positivas | Admin/Finanzas/RH GET 200; sin sesion POST 401; Coordinador/Direccion POST 403, intento parcial |
| B01, PDF pequeno / 1 / 4 / 7.5 MiB | Cargas y lecturas 200, hashes iguales | Ambos flujos, primer intento; sin RangeError. No representa aprobacion de toda la suite interrumpida |
| Exceso por un byte | Constancia 400 esperado por contrato real | Expectativa original del harness incorrecta; adicional no ejecutado en ese bloque |
| B03, PDF sintetico de 500 paginas | PASS | 422 DOCUMENT_SCAN_LIMIT_EXCEEDED en ambos reemplazos; anterior conservado, constancia sin cambio de metadatos, lectura adicional con hash igual |
| Recuperacion por fallo de borrado | PASS | Adicional queda CLEANUP/202 y termina COMPLETE al recuperar; constancia cleanupPending=true y conciliacion posterior sin pendiente |
| PNG/JPG | PASS | PNG pequeno, PNG 7,695,273 bytes, JPG 4,058,076 bytes y PNG 25 MP: carga/lectura y hashes iguales |
| Dos cuerpos incompletos | PASS | Tercera carga 429; conexiones liberadas a 30,002/30,001 ms; sin altas documentales por esos cuerpos |
| Proxy 60 s / replay | INCONCLUSO | Intento interrumpido; no se acredita persistencia/idempotencia ni Hosting |
| UI real y preview navegador | NO EJECUTADO | No se cambio Auth para habilitar un bypass de navegador |

La prueba de imagen utiliza muestras sinteticas, no escaneos institucionales.
Los lotes usan oleadas de dos solicitudes por sesion: ejercen el pico de
concurrencia, pero no reproducen exactamente el pump continuo de la UI.

## 5. Capacidad e integridad final

Vitest de la reanudacion: **4 PASS, 1 FAIL, 2 SKIP**, exit 1, 426 s.
Los omitidos son serial/permisos y proxy, no casos aprobados por esa ejecucion.
El fallo final corresponde al lote incompleto, no a fingerprints ni a H05.

| Lote sintetico | Primer intento 200/COMPLETE | 503 seguridad no disponible | 429 admision API | Final con asistencia |
|---|---:|---:|---:|---:|
| 1 sesion, 10 PDF | 5/10 | 5 | 0 | 6/10 |
| 2 sesiones, 10 PDF cada una | 5/20 | 5 | 10 | 5/20 |

Total inicial **10/30**. Se hizo **un** reintento asistido diez segundos
despues; completo, total **11/30**. Los otros 19 no se completaron dentro del
presupuesto y no se reintentaron ilimitadamente. No son perdidas de documentos
publicados: se rechazo la solicitud antes de una publicacion exitosa.

Presupuesto real: primer intento 14 envios registrados antes del proxy y uno
de proxy interrumpido; reanudacion 43 POST/PUT del helper + dos POST de cuerpo
incompleto = **60 envios** entre ambos. Reanudacion: 61 requests por helper y
dos cuerpos incompletos. El intento interrumpido no tiene ledger final de
polling; no se presenta un total HTTP exacto conjunto. Su bucle era acotado a
100 consultas y aun sumando analizadores se mantiene bajo 1500 solicitudes.
Scanner: 23 analisis terminados en el primer intento y 41 en la reanudacion
(39 limpios, dos limite B03), **64 terminados**, bajo tope 300.
La ventana completa, incluidos problemas de bootstrap, fue menor de 30 minutos.

Latencias de POST 200 de la reanudacion, n=19: min 9,102 ms, mediana 17,992 ms,
max 21,139 ms. Primer intento parcial, n=9: max 23,999 ms.
No hubo cruce normal observado de 60 s en esas cargas exitosas. No es SLA ni
prueba del proxy Hosting; las solicitudes fallidas rapidas no mejoran esta
metrica ni se cuentan como exito. No se extrapola p95 con esta muestra.

| Recurso | memory.peak cgroup | PIDs observados, 85 muestras cada 5 s |
|---|---:|---:|
| API de ensayo | 320.96 MiB | 5-37 |
| Scanner | 1257.47 MiB | 12-16 |
| Inspector | 142.85 MiB | 11 |
| PostgreSQL | 110.82 MiB | 9-11 |

RSS pico del worker de tests: 268.78 MiB; no representa memoria de navegador.
OOMKilled=false en los cuatro contenedores; sin reinicios realizados durante
la reanudacion. Scanner final con tini PID 1, sin procesos Z ni hijos de
analisis residuales; pids.current=13 incluye la sonda. No hubo agotamiento de
PIDs. No se dispone de ps en API/inspector; no afirmar inspeccion de zombis de
esos dos procesos. El muestreo no es un estudio sostenido de crecimiento.

**Integridad final aprobada:** 22 tablas protegidas con hash/conteo identico,
incluyendo teachers=2, payroll_runs=7, payroll_lines=2,
payroll_schedule_details=7 y payroll_extra_details=2. Datos exclusivamente
sinteticos. Cero documentos adicionales remanentes, cero operaciones pendientes
y cero archivos adicionales; una constancia vigente y un archivo correspondiente,
con metadatos historicos de versiones retiradas conservados. Sin huerfanos.

Los cuatro contenedores y la copia de firmas de cada intento fueron retirados.
Inventario final: cero contenedores, solo el volumen de firmas original previo.
Se conservan imagenes locales y evidencia ignorada, no servicios activos ni BD
de laboratorio. No se elimino ningun recurso ajeno.

### PD07-B04: concurrencia sin coordinacion de capacidad

La evidencia HTTP confirma 503 DOCUMENT_SECURITY_UNAVAILABLE y 429 DOSSIER_BUSY
bajo carga concurrente. La inspeccion estatica explica una desalineacion:

- useDossierOperations admite dos solicitudes por instancia.
- document-admission admite dos por proceso API.
- Cada servidor inspector/scanner mantiene una sola solicitud activa y devuelve
  429 BUSY si ya esta ocupado.
- createCloudDocumentRunner trata cualquier respuesta no-200 como indisponibilidad;
  no implementa espera ni coordinacion compartida.

Es una causa consistente con el comportamiento observado. El harness no guardo
el status HTTP interno de cada rechazo del analizador: falta atribuir cada 503
a inspector o scanner. No se atribuye exclusivamente a ClamAV ni a un OOM.
La UI real puede despachar el siguiente archivo antes de terminar toda la
oleada; por eso 10/30 no se presenta como porcentaje medido en navegador.

Propuesta, **no implementada**: disenar admision/cola acotada que coordine API
y analizadores, con estados visibles, idempotencia y backpressure. Considerar
mas de una instancia API y conservar el limite de 60 s del proxy; una espera
sin limite o subir CPU/MaxFiles no es solucion validada. Si el diseno necesita
procesamiento asincrono durable, requiere alcance y aprobacion especificos.

Reducir unicamente la UI a una carga por usuario no garantiza coordinacion
entre usuarios ni replicas. No se cambiaron controles para hacer pasar el lote.

## 6. Pendientes y decisiones

- Solicitar aprobacion para diagnostico instrumentado/correccion de PD07-B04
  y nuevo presupuesto de carga; no continuar consumiendo el cupo agotado.
- No autorizar deploy solo por cargas seriales o rechazos seguros.
- Completar proxy/constancia tras respuesta perdida, fallos de put,
  indisponibilidad/firmas y reinicio del worker; no declararlos cubiertos por
  la recuperacion de delete ejecutada.
- UI/visor, comportamiento de cola real, Auth/IAM/GCS/Hosting y dimensionamiento
  del destino requieren su evidencia separada. No se ejecuta etapa B.
- El SLA institucional y la tolerancia a reintentos siguen sin aprobacion.
- Cualquier correccion funcional resultante requiere autorizacion nueva;
  no aumentar MaxFiles, recursos o timeouts para transformar un fallo en PASS.

## 7. Confirmaciones

Solo harness local y documentacion. Sin cambios en apps/api, apps/web,
services/document-security, dependencias, SQL, permisos o H01. Sin acceso a
produccion, BD habitual, Firebase, GCS o Cloud SQL. Sin deploy ni publicacion
de imagenes. Si hubo escrituras/migraciones/fixtures fue exclusivamente en
la BD efimera autorizada; no afirmar "sin BD" para este ensayo.

No commit ni push en esta fase. Los archivos quedan pendientes de revision.

## 8. Validaciones del artefacto

Typecheck del harness y build API en Docker aprobados; imagen runtime API
construida localmente con su smoke pdfinfo de build. Las ultimas repeticiones
reutilizaron capas cacheadas; no presentar esos pasos como nuevos ensayos.
No se repitieron las suites generales API/web/integracion ni build frontend:
no hubo cambios de aplicacion y la suite de capacidad tiene un fallo real.
Validacion de sintaxis de scripts, git diff --check y revision de alcance se
completaron al cerrar la documentacion, sin errores. `git diff --check` avisa
normalizacion LF/CRLF, no errores de whitespace. Sin archivos SQL o de
aplicacion modificados. El harness reserva ahora explicitamente dos de los
60 envios para los cuerpos incompletos; la reanudacion ejecutada ya respeto
ese total (43 helper + dos cuerpos, mas 15 del intento interrumpido).

Working tree final: 12 archivos pendientes (tres documentos y nueve archivos
del laboratorio). No se hicieron commit/push; no se inicio ninguna correccion
funcional de PD07-B04. Los registros de Docker acreditan la retirada de los
recursos temporales, no una aprobacion de capacidad productiva.
