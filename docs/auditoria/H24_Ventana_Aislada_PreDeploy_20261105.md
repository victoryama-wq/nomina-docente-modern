# H24 - Ventana aislada del candidato eb24250

Fecha: 2026-11-05, America/Cancun. Proyecto exclusivo `nomina-h24-test-20261027`,
region `us-central1`. Candidato `eb2425007c31d9149e43bd22c50fe98f0186f382`.
Autorizacion: hasta dos horas y US$10 estimados, identidades y documentos
sinteticos, canal de prueba y API temporal accesibles por Internet, analizadores
y buckets privados. Sin Cloud SQL permanente. No es una autorizacion de release.

**Resultado: ventana aislada completada y restituida. Candidato probado;
NO-GO para activar en el destino productivo actual (PD-DEST-01).** Preparar
ventana independiente para almacenamiento, backup/H05, infraestructura y
release. PD-03 y PD-05 tienen aceptaciones temporales, no riesgos eliminados.

## Ambiente y limites

**Adenda posterior al cierre cb19e50:** el ensayo y las instrucciones de
transicion a cero dias de este acta describen exclusivamente `eb24250`.
No ejecutar esa transicion para constancias. La decision vigente conserva siete
dias en GCS exclusivamente para constancias sustituidas. [Adecuacion y evidencia
del ensayo independiente con 3284a12](H24_PD_DEST_01_Constancias_Recuperables.md). La ventana anterior
no valida el nuevo binario ni autoriza una nueva ventana.

Seguimiento 2026-11-09, fuera del ensayo: [H05 productivo favorable aportado](H24_Ventana_Respaldo_Cloud_SQL_Inspeccion_H05_20261105.md)
para 3284a12 (20 archivos/18 registradas/solo 016 y 017 pendientes/mismatch 0).
No sustituye la evidencia histórica de eb24250 ni aplica migraciones.
El [plan de infraestructura](H24_Plan_Infraestructura_Productiva_20261109.md)
requiere otra autorización; el backup existente no se restauró en una prueba.

- Imagen API exacta de PD-06: `sha256:39842256ac4ebc3fc67c71aa452ca9daba4913d8f0346a7ae1f47455d87b6f75`.
  Frontend Vite del checkout con variables exclusivamente H24, 61 archivos.
  Se sustituyeron las tres URLs sociales estaticas en el HTML generado de prueba;
  ningun cambio en el HTML versionado. Verificacion de ausencia de referencias
  productivas en el sitio de ensayo antes de publicar.
- Hosting: solo canal `h24-eb24250`, version `4d07e8d381219563`, release
  `1793903065271000`. Reescritura a API H24, nunca a nomina-api productivo.
- PostgreSQL 18 como sidecar temporal, acceso exclusivo loopback, esquema extraido
  sin datos del backup sintetico PD-08 y dos docentes de prueba. El reinicio de
  una instancia destruye el dataset: **no** es una arquitectura productiva.
- Inspector y scanner candidatos: una instancia minima y maxima durante el
  ensayo, concurrencia HTTP 2, inspector 1 CPU/512 MiB, AV 2 CPU/4 GiB. Acceso
  anonimo 403; solo se observo grant Invoker de la identidad runtime H24 a nivel
  servicio y ningun rol directo de proyecto para las identidades de analizadores.
  La comprobacion no equivale a una auditoria de permisos heredados de organizacion.
- Salud directa y por Hosting 200; /api/auth/session y /api/teachers sin token 401.
  Datos de ejecucion en `.cache/h24-window-eb24250-20261105/` (ignorada).
  Tokens/credenciales no forman parte de la evidencia publicada.

## PD-03: decision de riesgo

La ventana no demuestra denegacion universal de salida. Los servicios son
privados por IAM, pero sin Direct VPC/connector restrictivo; el scanner necesita
actualizaciones de firmas. La vista previa nativa y el PDF descargado conservan
las limitaciones del navegador/lector: no es un sandbox absoluto.

**Aceptacion comunicada por el usuario, responsable: Rectoria; revision:
1 de febrero de 2027.** Alcance limitado a esos dos riesgos residuales. No
acepta exposicion publica de analizadores/objetos, fallos de autorizacion,
omision del parser/AV, firmas caducadas ni filtracion de datos fiscales.
No se atribuye firma digital ni verificacion externa de la comunicacion.
Reabrir si cambian red, visor, politica, identidad, amenazas o condiciones de
operacion. Mantener clientes actualizados, logs sin contenido, controles por
rol y bloqueo ante veredicto incierto.

## PD-04: programacion y omision

El Scheduler original se encontro PAUSED y se uso un disparador temporal. Primer
job de ensayo anterior: disparo real a las 18:15 UTC, fallo en worker_upload;
el inspector anterior respondio 500 por espera de instancia, no rechazo del PDF.
Segunda cadencia 18:21 UTC: ejecucion satisfactoria. Ambas registraron limpieza
de objetos y BD. No se confunde el HTTP 200 de Scheduler con exito del worker.
Ejecuciones: `h24-recovery-rehearsal-hkfvv` y `h24-recovery-rehearsal-2q6rl`.
Tras observar una medicion positiva de `run.googleapis.com/job/completed_execution_count`
con result=succeeded, la politica de ausencia de 600 s abrio incidente
`0.oeo0i440yoef` a 18:38:30Z, politica `6742091236965144966`. El usuario
confirmo recepcion del correo de ausencia; es distinto del correo ERROR de octubre.

Worker candidato en job privado `h24-win-worker-eb24250`. Se compararon por
SHA-256 entrypoint, servicio documental, transporte cloud y reemplazo de
constancia entre las imagenes de API y worker; los cuatro coincidieron. El
envoltorio de ensayo usa PostgreSQL efimero y fallos sinteticos, no Cloud SQL.
Scheduler temporal con OAuth/Invoker acotado al job y sin retry:

| Ejecucion programada candidata | UTC inicio / fin | Resultado |
|---|---|---|
| `h24-win-worker-eb24250-7wzb8` | 18:54:13 / 18:56:02 | 1 tarea exitosa |
| `h24-win-worker-eb24250-jxf8f` | 19:00:45 / 19:02:34 | 1 tarea exitosa |

Cada ejecucion confirma recuperacion del alta interrumpida, lectura/hash,
repeticion idempotente, borrado y limpieza de constancia reemplazada; ocho
resumenes del reconciliador en total. Ambas retiraron sus objetos propios y su
BD. Scheduler pausado a 19:02:44Z antes de la tercera cadencia de 19:06 UTC.
Se verificaron exactamente dos ejecuciones y dos muestras positivas (18:57
y 19:03 UTC). Tras la omision sin eliminar el recurso monitorizado, el incidente
candidato `0.oeo1d3w05pfv` abrio a **19:16:12Z** para el job correcto y la
politica `4516727023755591324`. El incidente se comprobo via Monitoring; el
correo confirmado por el usuario corresponde a la primera politica de ausencia.
PD-04 aprobado en el ensayo, no evidencia de una programacion productiva activa.

## PD-05: autenticacion

Cuatro identidades sinteticas en Firebase H24 real, sign-in mediante custom
token y verificacion real de ID token por la API, sin habilitar password. Admin
y RH obtienen 200. Correo no verificado: 403 EMAIL_NOT_VERIFIED. Correo
verificado de dominio externo: 403 DOMAIN_NOT_ALLOWED. En el mismo Brave:
logout de Admin, entrada como otra identidad RH y comprobacion de UID/rol
devueltos por la sesion real. No se automatizo ni se simulo el selector de
cuentas de Google: el puente de autenticacion sintetica solo existio dentro del
navegador de prueba, no en el sitio, la API ni la aplicacion del usuario.

No se designo un segundo proyecto Firebase. Prueba compensatoria en sentido
inverso: el mismo token real H24 obtiene 200 en su backend; en la imagen exacta
sin red, con otra audiencia esperada, SDK rechaza especificamente por aud, luego
el endpoint responde 401 INVALID_TOKEN. No se cuenta como token emitido por un
segundo proyecto real presentado a H24. Decision de excepcion independiente.
**Aceptacion temporal comunicada por Rectoria, revision el 1 de febrero de 2027.**
No crear proyectos ni usar tokens productivos para marcar este caso como probado.
Revalidar al disponer de segundo emisor autorizado, al cambiar proyecto/SDK/guardas
o al vencimiento; no aceptar otros fallos de autenticacion bajo esta excepcion.

## PD-07: capacidad y compatibilidad

Brave con dos contextos independientes y Firebase real. Multiseleccion de dos
PDF, preview Blob y descarga con SHA-256 identico, reemplazo y eliminacion
definitiva por UI aprobados, sin intentos externos observados en ese recorrido.
Navegacion por Hosting, API e inspector/scanner reales, PostgreSQL efimero y
GCS aislado; no se uso mock para ninguno de esos eslabones.

Primera revision API de ensayo `h24-win-api-eb24250-00001-c6w`, concurrencia
HTTP 2: lotes 30/30 COMPLETE al primer intento y <55 s por archivo. **No
aprobada para convivencia con navegacion:** GET /api/auth/session obtuvo 429 a
18:37:04Z mientras habia dos cargas. Log Cloud Run confirma espera excesiva por
instancia; no es error de login ni del proceso de analisis. Fuera de carga
la misma ruta vuelve a responder 200. No ocultar este resultado.

Segunda revision `h24-win-api-eb24250-00002-ssv`: misma imagen; concurrencia
HTTP de entrada API 8, sin aumentar el limite interno de dos documentos ni la
concurrencia de los analizadores. Repeticion con lecturas autenticadas de
sesion/Directorio en paralelo. Los PDF de peso exacto son sinteticos con
padding, no una garantia para escaneos de cualquier complejidad.

| Revision / carga | Primer intento | Maximo observado |
|---|---:|---:|
| API concurrencia 8, un panel | 10/10 COMPLETE | 30.211 s |
| API concurrencia 8, dos paneles (10+10) | 20/20 COMPLETE | 31.333 s |
| Consultas autenticadas al coincidir dos cargas (sesion y Directorio) | 56/56 HTTP 200 | 1.290 s |

Sin reintentos, p95 de las 20 cargas simultaneas: 31.034 s. En la segunda
matriz se reemplazo una muestra de 4 MiB por 1 MiB por panel para acotar bytes;
se conservaron los casos de 4 y 7.5 MiB, 30 resultados y umbral de 55 s.
No es SLA para mayor concurrencia, red del usuario o arranque en frio a cero.
En el destino no fijar la API general en 2 ni reducir automaticamente su
capacidad previa. Conservar margen para navegacion y el limite interno de dos
analisis por proceso. Validar capacidad/costo del perfil elegido (incluido minimo
caliente de analizadores) antes de publicar, no trasladar la BD sidecar de prueba.

Constancias en segunda revision: A y B cargadas por UI; A ausente por metadata
GCS 404 tras sustitucion, B presente con hash y tamano esperados y GET actual
identico a B. PDF sintetico malformado: 422 en ambos flujos. Campos C.P./CURP
visibles; telefono ficticio reflejado en Directorio y restituido. No se escribieron
datos fiscales reales. Version publica de ensayo retirada despues de comprobar los
resultados: canal 404, API eliminada, las cuatro identidades eliminadas y
comprobadas inexistentes; B sintetica retirada con precondicion de generacion.

## PD-08: rollback

Autorizacion inicial excepcional de lectura del **digest** publicado en
Artifact Registry. Posteriormente el usuario autorizo GETs de metadatos del
destino; no conexiones a la BD, lectura de objetos ni cambios productivos.
Se descargo `sha256:a7d0de2196c5552d50cd75b8f01e15238dc90f701941b8656613bf6d1789196b`
(Finanzas). Restauracion en Docker sin red externa del post.dump sintetico
previamente verificado por hash: 016/017 presentes, 20 migraciones registradas,
dos docentes. La imagen anterior y sus dependencias originales consultaron
en modo PostgreSQL **transaction_read_only=on**, comprobado: /api/health,
/api/teachers, /api/teachers/export/active: 200/200/200. Actor inyectado solo
en este probe local; no es prueba Firebase del artefacto antiguo. Contenedor
retirado. No supone cobertura de todas las operaciones de la revision anterior.

PostgreSQL 18 coincide en version mayor con el destino documentado en PD-02.
Se consultaron metadatos de infraestructura, no el esquema ni H05 de la BD
productiva; no se creo backup productivo ni se ejecutaron sus migraciones.
Rollback conserva esquema aditivo y obligaciones
de limpieza; no hacer DROP ni prometer restauracion de documentos ya borrados.

## Decision

### PD-DEST-01: incompatibilidad comprobada de eb24250 (historico)

Precheck productivo **solo GET de metadatos**, autorizado separadamente, 19:00 UTC.
Cloud Run vigente `nomina-api-00057-c7d` recibe 100%, con el digest exacto probado
para rollback, concurrencia 80 y maximo de revision 3. **No reducir la
concurrencia productiva a 8** por esta prueba de dos usuarios. Hosting live
release `1793121624438000`, version `3f9ebc88c835a143`. Cloud SQL
`nomina-docente-web`: POSTGRES_18, RUNNABLE, us-central1. No se consultaron
secretos, contenido de documentos, filas productivas ni el ledger H05.

`nomina-docente-prod-constancias`: UBLA activo, public access prevention
enforced y sin grants publicos directos en su politica; soft delete **604800 s**
(7 dias), sin campo explicito versioning.enabled, sin politica de retencion de
bucket ni objectRetention. No confundir soft delete con un hold o con backup.
No se identifico por nombre un bucket adicional dossier/expediente bajo el
prefijo inventariado; se requiere designacion explicita, no inferir ausencia
de todo recurso a partir del nombre.

**NO-GO para habilitar la carga con la configuracion actual.** En la imagen
candidata, sin red, el adaptador real rechazo los metadatos observados. Prueba
de cinco controles: rechazo de estado actual, rechazo con solo uno de los dos
campos corregidos (ambas combinaciones), aceptacion con ambos correctos y
rechazo de borrado de otro bucket. No se probo una escritura contra produccion.
Cambiar unicamente CONSTANCIAS_BUCKET podria publicar B pero dejar pendiente
la eliminacion de A en el bucket anterior.

Decision de aquella ventana (sustituida; **no ejecutar** el cambio siguiente):
**no se requiere conservar constancias una vez
eliminadas**. No es permiso para purgar registros ni para cambiar hoy la politica
productiva. En una ventana autorizada, la alternativa preparada es conservar
el nombre del bucket y modificar unicamente softDeletePolicy.retentionDurationSeconds
a "0" y versioning.enabled a false, con precondicion de metageneracion fresca.
Preservar UBLA, PAP, IAM, holds y cualquier obligacion legal. Pausar reemplazos
durante la transicion, esperar propagacion y releer la metadata. Si difiere el
estado esperado, detener sin forzar. El cambio aplica a borrados futuros, no
acorta retroactivamente la retencion de objetos ya borrados. Reactivar retencion
despues no recupera lo eliminado permanentemente. Ver [comportamiento de soft
delete en GCS](https://docs.cloud.google.com/storage/docs/soft-delete).

**Transicion ensayada solo en buckets vacios y temporales H24.** Se reprodujo
el punto inicial (7 dias y campo versioning ausente). PATCH condicionado a la
metageneracion inicial: 1 a 2; nueva lectura: "0" y false explicitos, sin
cambiar PAP ni UBLA. Se espero propagacion, subio un PDF sintetico con
ifGenerationMatch=0, verifico MD5/tamano y elimino solo su generacion.
Primer intento: el listado softDeleted=true con politica desactivada devolvio
400 (listado no soportado); intento conservado, no cuenta como prueba de cero
versiones recuperables. Se retiro ese bucket.

Segundo ensayo independiente: estado vivo 404 y listado de versiones vacio.
Se volvio a habilitar temporalmente la politica **solo en el bucket de prueba
ya vacio, sin borrar nada bajo esa politica**, se espero propagacion y el
listado softDeleted=true no encontro la clave de la muestra. Se desactivo de
nuevo, se espero propagacion y se retiro el bucket (GET 404). Resultado:
0 versiones vivas/no vigentes y 0 soft-deleted para la muestra. No repetir
la alternancia auxiliar en produccion; su finalidad fue obtener evidencia de
borrado y no se inspeccionaron versiones u objetos del bucket productivo.

### Regresion final

Checkout eb24250, mismo lock SHA-256 que el cierre PD-06. npm audit online:
0 en todas las severidades. API 417 PASS/21 SKIP opt-in, web 169/169;
integracion 167/167, 21 archivos, 60.04 s, en otro PostgreSQL local efimero
con guardas de container/BD/puerto y limpieza confirmada. Typecheck y build
API/web OK. No se modificaron aplicaciones, SQL ni dependencias en esta fase.

### Restitucion y dictamen

18:08:37 a 19:19:26 UTC (70.8 minutos). Tres servicios de ensayo, job candidato,
dos disparadores y dos politicas temporales, canal de preview y ambos buckets
de laboratorio: GET 404 verificados. Se retiro la version temporal de Hosting.
Cuatro usuarios Firebase sinteticos eliminados; no se revoco ninguna cuenta real.
El Scheduler original quedo PAUSED con su cron previo. Buckets originales H24:
dossier 0 objetos, constancias 1 preexistente; inventarios ordenados por nombre,
generacion, tamano y CRC con huellas identicas antes/despues.

Se conservaron los fallos intermedios de limpieza: al retirar los indices OCI
quedaron manifiestos hijos de plataforma/attestation. La guarda impidio borrar
paquetes no vacios. Se cotejaron los diez digests sin tags contra los logs de
build y el digest padre correspondiente antes de retirarlos. Verificacion
independiente final: los cinco paquetes exclusivos de la ventana devolvieron
404. Retirados tags locales temporales y referencia descargada de rollback;
sin podar cache/imagenes compartidas. Evidencia sintetica local conservada.
No se creo Cloud SQL o red nueva. US$10 fue presupuesto estimado, no se
consulto facturacion ni se certifica el cargo liquidado.

**Pruebas del candidato completadas; no hay GO para el estado actual del
almacenamiento productivo.** La guarda debe seguir fallando de forma segura
hasta resolver PD-DEST-01 en una ventana productiva autorizada. Registrar esa
decision/configuracion y completar los pasos siguientes antes de abrir al uso
operativo. No hubo escrituras en produccion, deploy productivo, cambios H01,
acceso a filas/documentos productivos ni migraciones productivas.

### Condiciones para una ventana productiva distinta

1. Congelar este SHA, lockfile e imagenes; si cambia codigo, dependencias o
   dimensionamiento material, revisar que esta evidencia siga siendo aplicable.
   Acordar propietarios de IAM, datos, worker, alerta, costo y rollback. No
   activar la infraestructura productiva con las URLs/identidades/buckets H24.
2. Con autorizacion productiva, contrastar servicio/revision/imagen, release de
   Hosting, version de PostgreSQL, secretos y CORS reales con H13. Si el rollback
   vigente no es el digest probado, verificarlo antes de continuar.
3. Verificar politicas e IAM efectivos por bucket sin desproteger el archivo
   historico: bucket dedicado para adicionales, acceso privado, sin versionado,
   soft delete, holds o retencion incompatibles con borrado definitivo. Verificar
   tambien el bucket permitido para constancias nuevas **y sustituidas**. Un
   cambio de nombre de bucket no habilita al reconciliador a borrar un objeto
   de otro bucket. Si el destino historico no cumple, detener y acordar transicion;
   nunca desactivar protecciones o copiar el expediente automaticamente.
4. Backup Cloud SQL SUCCESSFUL y evidencia de restaurabilidad; H05 debe identificar
   18 registradas hasta 015, solo 016/017 pendientes y cero discrepancias. Aplicar
   solo por runner en ventana aprobada, verificar 20/0/0. No baseline, seed,
   importacion o restauracion de datos de prueba en produccion.
5. Validar IAM minimo de analizadores/worker y capacidad suficiente para el resto
   de Nomina. API y worker deben compartir esquema, namespace, politica y destino
   de almacenamiento. Configurar verificacion Firebase (incluida revocacion),
   protocolos de fallo cerrado, alertas por error y por falta de ejecucion
   exitosa. Ajustar umbral de ausencia a la cadencia operativa acordada.
6. Validar revision candidata antes de habilitar trafico, API antes de Hosting;
   smoke 200/401/403, roles, fiscal/Directorio, navegacion con cargas y salud del
   worker. No probar mutaciones en un docente real sin autorizacion especifica.
   Si falla seguridad, limpieza, integridad o continuidad de otros modulos,
   detener altas/cambios, preservar obligaciones de limpieza y ejecutar el
   rollback aprobado. No restaurar toda la BD ni borrar objetos en lote.
