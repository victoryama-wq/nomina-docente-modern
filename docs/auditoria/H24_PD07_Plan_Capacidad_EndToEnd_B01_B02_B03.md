# H24 PD-07 - Preparacion de capacidad end-to-end B01/B02/B03

Fecha: 2026-10-31, America/Cancun.
Base funcional: `d0ae6d3`; rama `feature/h02-h03-user-coordinations-permissions`.
Working tree limpio al iniciar la preparacion original.
**Plan original; puntos 1 y 2 autorizados y ensayo ejecutado posteriormente.**
Resultado: [acta local de capacidad](H24_PD07_Capacidad_EndToEnd_B01_B02_B03_Resultados.md).
Integridad aprobada en reanudacion; lote incompleto y nuevo PD07-B04.
La etapa cloud sigue sin autorizacion en esta fase. H24 mantiene NO-GO.
H24 mantiene NO-GO. Esta fase no autoriza produccion ni despliegues de prueba.

## 1. Evidencia disponible y brecha

| Correccion | Evidencia local existente | Falta reunir en la prueba final |
|---|---|---|
| B01 `00e3f94` | Decoder Base64 lineal y regresion de archivos grandes, constancias/adicionales | HTTP, BD, persistencia, analisis y UI con archivos limite |
| B02 `ac1df1a` | tini en scanner, 61 analisis por lote, cero zombis; solo scanner | Runner real dentro de cargas/publicaciones/lecturas concurrentes |
| B03 `d0ae6d3` | 16 casos del clasificador y 6 casos con parser/AV reales; persistencia simulada | Rechazo 422 sin escrituras publicables en BD/almacenamiento reales del laboratorio |

Fuentes: H24_PD07_B01_Correccion_Base64_Archivos_Grandes.md,
H24_PD07_B02_Correccion_Procesos_Scanner.md,
H24_PD07_B03_Mensaje_Limites_Analisis_PDF.md,
H24_PD07_Capacidad_Local_Resultados.md y
H24_PD08_Ensayo_Local_Migraciones_016_017.md.

Los resultados anteriores no equivalen a una carga completa del artefacto final.
B03 mejora el diagnostico, no la capacidad: MaxFiles sigue en 100. Un PDF de
500 paginas puede ser rechazado correctamente y no cuenta como carga exitosa.

## 2. Revision estatica actual

- UI de adicionales: dos solicitudes en vuelo por instancia del composable,
  seleccion de hasta diez archivos; dos usuarios pueden intentar cuatro envios.
- Admision API: dos cargas/reemplazos por proceso, cuerpo incompleto limitado
  a 30 s y respuesta 429 con Retry-After=2 ante cupo ocupado.
- Validacion: dos validaciones por proceso; scanner HTTP atiende una a la vez.
  No hay cola global garantizada. El cliente traduce no-200 del scanner a
  indisponibilidad; no ocultar los 503/429 con reintentos del generador.
- Body API 12 MiB; archivo hasta 7.5 MiB, antes de expansion Base64 y copias.
- Inspector cliente 40 s; scanner cliente 230 s; runner permite freshclam
  100 s y proceso scanner 120 s. No son latencias observadas ni SLA.
- Firebase Hosting establece 60 s y 504 al excederlo. Verificado el 31 de
  octubre en [documentacion oficial](https://firebase.google.com/docs/hosting/cloud-run).
  Aumentar Cloud Run no resuelve ese limite del proxy.
- Adicionales tienen operationId y estados durables. La constancia genera
  documentId en servidor, usa staging/cleanup y NO comparte ese contrato de
  idempotencia. Tras un timeout no reenviar ciegamente la constancia: consultar
  documento vigente, bytes y marcadores antes de decidir un nuevo envio.
- Adicionales tienen LocalDossierStorage. Constancia usa adaptador GCS en runtime;
  un adaptador local de laboratorio no acredita sus precondiciones GCS reales.

Archivos revisados: apps/api/src/lib/document-admission.ts, document-security.ts,
document-cloud.ts, constancia-replacement.ts, constancia-storage.ts,
dossier-runtime.ts, apps/api/src/app.ts, services/document-security/server.mjs,
apps/web/src/composables/useDossierOperations.ts, FiscalRecordsView.vue,
apps/api/Dockerfile y firebase.json. No se modifican.

## 3. Etapa A recomendada: laboratorio local reproducible

Repetir primero el recorrido local, sin cuentas reales, ADC, GCS, IAM ni nube.
No requiere crear otro proyecto ni volver a exportar la BD productiva.

Preparar harness versionable con dependencias ya presentes, aprovechando
el ensayo previo `.cache/pd78-20261030/` solo como referencia: no ejecutarlo
sin revisar ni tratar archivos ignorados como artefactos finales confiables.
No agregar Postman u otra dependencia para sustituir el harness existente.

### Componentes y fronteras

1. Fijar SHA del checkout, lockfile y hashes de los archivos incluidos. Construir
   API/web/inspector/scanner localmente con los Dockerfiles vigentes. Registrar
   IDs/digests, Node, npm 10.9.4, herramientas y firmas. No publicar imagenes.
   No actualizar dependencias ni bases deliberadamente; registrar cualquier
   diferencia de capa resuelta por tags y no llamarla equivalencia productiva.
2. PostgreSQL efimero dedicado, DB exacta `nomina_docente_test`, fixtures
   exclusivamente sinteticos. Verificar contenedor, etiqueta, puerto y database;
   mismo nombre de BD no basta. Sin mounts de datos actuales ni puerto 5432.
3. Preparar esquema mediante el procedimiento H05 ensayado en PD-08, sin editar
   SQL/checksums; en la BD nueva, estado hasta 015 y despues 016/017. Referencia
   actual: 20 registradas, pending=0/mismatch=0; detener ante discrepancias.
   No ejecutar reset/seed/migraciones contra la BD local habitual.
4. Rutas Fastify, servicios y transacciones reales por HTTP. Persistencia
   de documentos adicionales real sobre LocalDossierStorage; constancia con
   adaptador de test en directorio privado que ejerza put/read/remove reales.
   Cualquier inyeccion se limita al harness, no altera codigo funcional.
5. Inspector y scanner HTTP con createProcessRunner reales; conservar tini,
   freshclam, verificacion de edad y protocolo B03. No sustituir el scanner
   por un runner simplificado como en la primera prueba de capacidad.
6. Cliente HTTP real de analizadores con identidad sintetica solo en el
   harness y destinos loopback permitidos por inyeccion existente. No relajar
   guardas cloud de la aplicacion ni simular IAM como si estuviera validado.
7. Frontend construido del mismo SHA, proxy local y navegador de prueba.
   Sesiones sinteticas controladas en el harness, sin bypass de produccion ni
   modificar Auth funcional. Registrar por separado pruebas HTTP y UI real;
   si no se puede ejercitar UI sin cambiar auth, dejarla pendiente para B,
   no presentar mocks de componentes como prueba de navegador completa.

Esto acredita un recorrido integrado local con PostgreSQL y archivos reales,
pero Auth/IAM/GCS/Hosting siguen siendo fronteras simuladas. No etiquetarlo
como smoke productivo ni como equivalencia del runtime Cloud Run completo.

### Limites propuestos, sujetos a autorizacion

| Recurso | Limite |
|---|---|
| Ventana | Hasta 120 minutos de ejecucion; watchdog 15 min por bloque |
| Carga | Maximo 2 sesiones sinteticas, 10 archivos por seleccion, 2 envios por sesion |
| Volumen total | Hasta 60 envios de carga/reemplazo, incluidos reintentos; hasta 300 analisis AV |
| Trafico | Hasta 1500 solicitudes totales, incluidos polling/lecturas; sin bucle abierto |
| Archivos persistidos | Hasta 1 GiB de corpus/objetos sinteticos en espacio exclusivo |
| Scanner | 4 GiB, 2 CPU, 64 PIDs; limites AV intactos |
| Inspector | 512 MiB, 1 CPU, 64 PIDs |
| API de ensayo | 1 GiB, 2 CPU, 128 PIDs |
| PostgreSQL efimero | 512 MiB RAM, tmpfs 256 MiB, 1 CPU, 128 PIDs |
| Cliente/proxy | Hasta 1 GiB combinado; navegador medido por separado |
| Limpieza | Solo recursos propios por ID/nombre y etiqueta del ensayo |

Preflight verifica recursos disponibles; no ampliar automaticamente Docker/WSL
ni detener servicios ajenos para alcanzar esos limites. Si falta capacidad del
host, registrar limitacion del generador/laboratorio y solicitar decision.
Limites locales no son una recomendacion de dimensionamiento productivo.

Red interna aislada entre componentes, puertos UI/proxy solo 127.0.0.1 y libres.
Sin tuneles ni exposicion LAN. Copiar firmas originales read-only a volumen
desechable; freshclam solo puede modificar la copia. Las descargas necesarias
para build y firmas se registran; sin credenciales cloud montadas. El scanner
real requiere salida a firmas para probar freshclam: no afirmar network=none
en ese bloque. Separar pruebas offline/fallo de firmas de la carga normal.

## 4. Matriz de ejecucion propuesta

| Bloque | Casos | Evidencia esperada |
|---|---|---|
| Preflight | SHA, imagenes, esquema, destino, baseline y permisos | Guardas positivas/negativas, sin acceso a BD habitual |
| Serial/frio | PDF pequeno, 1/4/7.5 MiB exactos y exceso por un byte; constancia y adicionales | Resultado por archivo, hash de subida/lectura, pico de memoria y tiempo |
| Imagenes constancia | JPG/PNG pequenos, proximos al limite y muestra 25 MP dentro de politica | HTTP completo y persistencia, no solo parser/AV |
| Lote normal | 1 sesion/10 archivos; despues 2 sesiones/10 cada una | Resultados por primera solicitud y por lote, estados visibles, cero exito falso |
| Complejidad B03 | PDF 500 paginas con MaxFiles; corpus menos complejo valido; errores/timeout separados | 422 especifico ante limite confirmado, 503 ambiguo; sin publicacion del rechazado |
| Reemplazo/lectura | Cada flujo; fallo de validacion y documento existente bloqueado | Anterior conservado, lectura sin bytes cuando rechazada |
| Proxy lento | Corte sintetico 60 s antes/despues de persistir, carga/lectura/reemplazo | Resultado observado en UI y BD; 504 no interpretado como rollback |
| Idempotencia | Adicionales: mismo operationId tras respuesta perdida; constancia: conciliacion previa | Un resultado por operacion, una constancia vigente, historial trazable |
| Fallos recuperables | Fallo acotado de storage put/delete, scanner no disponible y reinicio local del worker | Marcadores durables, limpieza y recuperacion sin borrar el vigente |
| Saturacion/cuerpos lentos | Cuatro intentos simultaneos de dos clientes y admision incompleta | 429/503 explicitos, liberacion de cupos, sin cola infinita |
| Frio/caliente/firmas | Reinicio solo entre bloques declarados, freshclam real; rechazo por firmas no disponibles | Separar arranque/actualizacion del escaneo y probar recuperacion |
| UI/visor | Subida multiple, mensaje B03, estado incierto, preview/descarga y cierre del visor | Sin URL de bytes rechazados, sin congelamiento; escritorio/movil si alcanzable |

Las muestras validas por tamano no se consideran aprobadas automaticamente por
paginas: primero clasificar corpus y registrar razon real de rechazo. Limites
esperados no son cargas exitosas. No reducir controles para cumplir una cuota.

Reintentos: primera pasada respeta el comportamiento real de UI, sin retry
oculto del harness. Luego, como escenario separado de recuperacion asistida,
maximo dos reintentos manuales por archivo, dentro de los topes globales,
respetando Retry-After y verificando estado. No reintentar 422 B03 sin un
archivo nuevo ni reenviar exitosos. Reportar cuantos necesitaron intervencion.

Los fallos y latencias se inyectan solo desde fronteras del harness/proxy,
nunca editando scanner/guards/politica. Parar si requieren cambiar funcionalidad.
Toda escritura de fixtures/estados para simular antiguedad ocurre solo en BD
efimera, queda en manifest y no se confunde con comportamiento natural medido.

## 5. Medicion, criterios y detencion

Guardar manifest del corpus (bytes, MIME, paginas/dimensiones, SHA sintetico),
duracion por etapa y solicitud, HTTP/code, estado durable, numero de intentos,
inventario de objetos y filas, cleanup, auditoria y fingerprints de fixtures
de teachers/Nomina/snapshots excluyendo solo tablas documentales/auditoria que
deben cambiar durante el ensayo. No registrar tokens, Base64 ni documentos reales.

Medir memory.peak/OOM/PIDs/zombis cuando este disponible, RSS/CPU muestreados
indicando intervalo y limites de observacion. Comparar reposo tras warmup
contra reposo final, no contra el proceso frio; conservar evidencia fallida.
Latencias min/mediana/max y p95 solo con n explicito, sin extrapolar un SLA con
una muestra pequena. Separar respuestas 4xx/5xx de operaciones completas.

Criterios de integridad obligatorios:

- Cero archivos sin validacion publicados, bytes corruptos o exposicion fuera
  de rol/alcance; Admin/Finanzas/RH positivos, Coordinador/Direccion negativos
  segun permisos vigentes, sin sesion 401 con fixtures de autorizacion.
- Cero OOM, agotamiento de PIDs, zombis acumulados o reinicio oculto del scanner.
- Cero duplicados de operacion adicional; constancia unica vigente. No llamar
  duplicacion a una nueva version deliberada sin analizar su contrato.
- Rechazo B03 conserva el anterior; fallo temporal no destruye datos. Marcadores
  pendientes conciliables; al finalizar no quedan objetos huerfanos o limpieza
  pendiente; registros terminales/auditoria de test pueden conservarse en la
  evidencia hasta destruir el entorno, sin exigir cero filas historicas.
- Sin exito falso en UI, sin reintentos no declarados y sin cambios de H01.

La aprobacion funcional de lotes se evalua aparte de la seguridad: una carga
que termina 503 de forma segura sigue siendo un fallo operativo/no completada.
Se informara tasa de finalizacion sin intervencion y con recuperacion asistida;
no aceptar 20/20 si el harness oculto fallos o reintento ilimitadamente.

Presupuesto temporal propuesto: observar si las solicitudes normales terminan
antes de 60 s y medir margen; los retrasos inyectados son casos de recuperacion,
no latencia normal. Cualquier cruce normal de 60 s abre hallazgo, aunque conserve
datos. SLA definitivo por archivo/lote y tolerancia a reintentos requieren
decision humana con las mediciones. No hay SLA institucional aprobado aqui.

Detener bloque ante OOM, error de integridad, escritura fuera del destino,
firmas no verificables, agotamiento de recursos o watchdog. Permitir limpieza
controlada hasta 5 minutos; si no concilia, registrar fallo y evidencia antes
de retirar unicamente el entorno efimero. No ampliar timeouts/MaxFiles/recursos
para convertir un resultado fallido en aprobado.

## 6. Etapa B posterior, no incluida en la autorizacion local

Tras A, decidir si hace falta ajuste funcional antes de ensayar servicios reales.
Firebase Auth H24, GCS aislado y Hosting/Cloud Run reales necesitan autorizacion
especifica, proyecto/destinos verificados, presupuesto y ventana. Reutilizar
recursos H24 existentes solo tras inspeccion autorizada; no crear otro proyecto.

Actualizar revisiones API/analizadores/Hosting en H24 constituye deploy de
prueba y esta expresamente fuera de esta fase sin deploy. La simulacion de
60 s no acredita Hosting, ni la persistencia de archivos locales acredita
IAM/generaciones/borrado GCS. La instancia local no debe conectarse a Cloud SQL
productivo ni usar nomina_docente como destino.

Sesiones reales de Brave Invitado se solicitarian solo para ese bloque, con
login personal del usuario, sin compartir tokens. No repetir cambios de roles,
revocaciones o identidades PD-05 por inferencia. Si se exige no hacer ningun
deploy todavia, esta etapa queda pendiente y no se declara PD-07 cloud cerrado.

## 7. Autorizaciones solicitadas ahora

1. **Laboratorio y datos efimeros locales:** construir imagenes y preparar
   harness de pruebas, BD nueva nomina_docente_test en contenedor exclusivo,
   esquema H05/fixtures sinteticos y almacenamiento temporal; ejecutar las
   escrituras de carga/reemplazo/borrado y limpiar solo recursos propios.
   No usar la BD habitual, dumps reales/anonimizados ni credenciales cloud.
2. **Carga acotada y fallos controlados:** matriz y topes de secciones 3-5,
   copia/actualizacion de firmas, cuerpos lentos, proxy de 60 s, interrupciones
   exclusivamente de contenedores del ensayo y fallos inyectados de storage;
   sin cambiar reglas, limites AV o dependencias. Autorizar artefactos de
   pruebas/documentacion, no correcciones funcionales automaticas.

No se solicita autorizacion de produccion ni deploy. Una autorizacion local
no incluye B. Si se requiere cambio funcional por un hallazgo, presentarlo
con evidencia y pedir aprobacion antes de implementarlo.

## 8. Entregables y estado original de esta preparacion

La ejecucion autorizada producira un acta con SHA/imagenes/configuracion,
matriz PASS/FAIL/NO EJECUTADO, metricas, muestras fallidas, recuperacion,
inventarios/fingerprints, cleanup y recomendaciones separadas local/cloud.
Se reutilizaran pruebas existentes de API/web y typecheck/build si cambia
el harness tipado; ninguna ejecucion se da por hecha en este plan.

En el turno original de preparacion solo se leyeron codigo/documentos y documentacion oficial de
Hosting. Sin comandos Docker de ejecucion, conexiones BD, pruebas de carga,
migraciones, seeds, instalaciones, cloud, produccion, deploy, commit ni push.
Validacion documental: git diff --check y git status. Sin cambios funcionales,
H01, permisos, datos fiscales, Nomina ni snapshots.
