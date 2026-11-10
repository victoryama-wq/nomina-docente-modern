# H24 - Release condicionado del 2026-11-10

**Resultado final: RELEASE COMPLETADO. H24 disponible y cerrado operativo,
con observacion UX no bloqueante sobre el mensaje de validacion fiscal.**
Smoke autenticado por rol y responsive aprobado por el usuario; operacion
automatica comprobada. Cierre17:18:50 America/Cancun, sin rollback.
Los apartados siguientes conservan la secuencia, incluidos rechazos del
laboratorio y correcciones del harness; no todos describen el estado final.

## Preparacion local

Autorizacion posterior a 28eb9d8: permiso exclusivo firebaseauth.users.get para
la SA API, capacidad validada, candidata sin trafico general y, solo despues de
los controles autenticados, operacion permanente del worker/alertas/Scheduler,
ejecucion programada real, trafico API y Hosting. No es otra ventana de migracion.
Fuente congelada: 57c565a6a6ed3b4c2dca21292289893b94fc6a5d. Diferencias posteriores:
solo documentacion. Imagen existente, sin reconstruir ni publicar:
`sha256:f1aafc5cbc0d4f8a658c1bede3abb9af656ef3a48b3e1b584ab632f052958303`.

La ventana nueva empieza con la primera consulta productiva, dura como maximo
dos horas y debe terminar antes de21:55 America/Cancun. No se renueva sola.
Objetivo acumulado USD10; antecedente estimado inferior a USD5, no factura ni
saldo certificado. Plan de esta ventana inferior a USD1.50 adicionales, sujeto
a duracion y consumo observados; no representa un tope de facturacion cloud.

## Capacidad propuesta antes de trafico

API: 1CPU,1GiB,concurrencia HTTP8,maximo3 instancias,minimo0,pool10 sin cambiar
codigo. Dos admisiones documentales simultaneas por instancia antes de leer
el cuerpo; 7.5MiB binarios por archivo, bodyLimit12MiB. Navegacion conserva
espacio concurrente. Presupuesto conservador transitorio: API anterior30,
candidata30,worker10,reserva20 =90 conexiones; cotejar max_connections y uso
real antes de desplegar, sin aumentar Cloud SQL.

Imagen exacta en Docker, 1CPU/1GiB, PostgreSQL18 efimero y almacenamiento local
privado; sin credenciales ni conexiones cloud. Dos clientes,10 archivos de
7.5MiB cada uno, navegacion concurrente, hash de descarga, NOT_SCANNED y borrado:
20/20 correctos,93 solicitudes,4.36s. Pico RSS283344896 bytes y cgroup375578624
bytes; sin OOM, pool observado2 y espera0. El contenido sintetico solo valida
envoltura/capacidad, no estructura PDF ni antivirus. No acredita latencia GCS.
Conservar intentos fallidos del laboratorio: puerto Docker internal no publicado,
directorio local ausente y luego modo inseguro; se corrigio solo el laboratorio
(0700), sin modificar candidata ni omitir controles. Regresion inicial incluyo
un fallo de empaquetado del harness por omitir ops/h24; repeticion con esa fuente.

El frontend se compila de la misma candidata con perfil Firebase productivo y
API relativa /api. API/web/typecheck/build locales aprobados. La exportacion
inicial con CRLF se rechazo y se rehizo con core.autocrlf=false antes de probar.

## Rollback preparado

API esperada00057-c7d; Hosting release1793121624438000/version3f9ebc88c835a143.
Reconfirmar disponibilidad por metadata. Si falla una guarda, no transferir
trafico. Ante fallo critico despues del release: impedir nuevas operaciones H24,
pausar Scheduler, desarmar worker, comprobar ejecuciones activas, restaurar
Hosting y trafico a00057-c7d. Retirar tag candidato. No down migrations, restauracion
BD por rutina, borrado de intenciones/auditoria ni reposicion de objectAdmin.

## Costos recurrentes separados

Estimaciones sin impuestos/free tier/descuentos, no factura: API request-based
1CPU/1GiB ~USD0.0954 por hora-instancia activa; incremento de memoria frente a
512MiB ~USD0.0045 por hora-instancia activa. Worker84 ejecuciones/dia,30dias,
1CPU/1GiB, minimo facturable60s: ~USD3.03/mes; si todas duran240s, ~USD12.10/mes.
Scheduler ~USD0.10/job/mes antes de franquicia. Storage, operaciones, logs,
red y metrica dependen del volumen; no se instalan analizadores ni min instances.
Referencias: [Cloud Run](https://cloud.google.com/run/pricing) y
[Scheduler](https://cloud.google.com/scheduler/pricing). No confundir este costo
recurrente con el presupuesto acumulado de la intervencion.

## Reajuste por limite real de conexiones

Primera consulta productiva16:30:57 Cancun; vencimiento18:30:57 del10/11/2026.
Precheck detecto max_connections50 y3 reservadas. Se rechazo la propuesta90
antes de mutar recursos. pg_stat_activity incluia procesos internos: posteriormente
solo3 client backend (dos cloudsqlagent y un inspector), no14 clientes de API.
H05 inspect salida0:20 registradas/0 pendientes/0 mismatch; prefijos007/008/009
historicos revisados por identificador completo. Backup1794335839733 SUCCESSFUL
del mismo dia; no se repite, restauracion de esa copia no ensayada.

Configuracion revisada: **servicio max2, revision candidata max1**,1CPU/1GiB,
concurrencia8,minimo0. Transicion: anterior20 +tag candidato10 +pool worker10
+reserva operativa7 =47 conexiones no reservadas. El worker secuencial utiliza
dos conexiones simultaneas (lease y trabajo), dejando8 adicionales del techo
conservador del pool. El tag sin porcentaje no cuenta en el limite de servicio,
por eso se presupuesta aparte. Cloud Run puede exceder temporalmente limites;
no es una garantia dura. Monitorear conexiones/errores y parar antes de trafico
si no existe margen. No se cambia Cloud SQL ni el pool hardcoded de la candidata.
El limite de una instancia H24 es deliberado para esta liberacion acotada;
ampliarlo requiere revisar de nuevo presupuesto y carga, no hacerlo implicitamente.
Referencia: [limites de Cloud Run](https://docs.cloud.google.com/run/docs/configuring/max-instances).

## Candidata sin trafico general

Rol personalizado `h24FirebaseSessionRead` creado y concedido exclusivamente a
`nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com`; unico permiso
`firebaseauth.users.get`. Diff IAM cotejado, sin otros cambios de bindings ni
impersonacion. No se retira verifyIdToken(token,true).

Revision creada **nomina-api-00058-baw**, digest aprobado, Ready; tag temporal
`h24-candidate`. API00057 conserva100% general durante las pruebas. Se conservan
SA, secreto, Cloud SQL, CORS y variables existentes; se agregan solo
DOSSIER_STORAGE_MODE=gcs y DOSSIER_BUCKET=nomina-docente-prod-h24-expedientes,
ademas de los limites de capacidad aprobados. Health200 y anonimo401.

Cuenta de pruebas institucional designada expresamente por el usuario, sin
operaciones historicas como creador y no superadministrador. Se conserva baseline
de rol Coordinador, estado y UID para restitucion; no se cambian roles compartidos.
Un error inicial de escritura del correo se corrigio tras detectar el registro
existente; el actor sintetico creado con el correo equivocado quedo inactivo.
El puente local recibe el token real de Google/Firebase exclusivamente en memoria,
sin guardarlo en evidencia, y limita llamadas al docente ficticio de este ensayo.

| Comprobacion contra la candidata | Resultado |
|---|---|
| Sesion real, checkRevoked y propagacion IAM | 200 |
| Admin, Finanzas, RH: expediente ficticio | 200 |
| Coordinador, Direccion, Contador, Contabilidad: lectura y carga | 403 |
| Constancia A, intento invalido de reemplazo | 200; rechazo422 conserva hash A |
| Constancia B confirmada | 200; solo B vigente y hash correcto |
| Adicional A, reintento mismo operationId | COMPLETE; sin documento duplicado |
| Reemplazo invalido de adicional, luego B valido | 422 conserva A; B COMPLETE/hash correcto |
| Borrado adicional | COMPLETE; lectura404 |
| C.P., CURP y telefono exclusivamente sinteticos | Persistidos y releidos |
| Descarga constancia/adicional | NOT_SCANNED, attachment, no-store, nosniff, CSP sandbox |
| Cuenta de prueba deshabilitada y reactivada | 401 y luego200 |
| Token de prueba revocado | 401 |
| Nuevo login posterior a revocacion | 200, confirmado por usuario y API |

Trece casos del recorrido autenticado aprobados. No se revocaron sesiones de
usuarios operativos. Conservar por separado estas pruebas reales y las pruebas
locales: API475 aprobadas/21 omitidas (laboratorios historicos opt-in de
Inspector/ClamAV/pdfinfo, retirados del flujo); web169/169; PostgreSQL171/171 en23
archivos, incluida017; typecheck/build0. No se activaron analizadores para cubrir
omisiones historicas. No hubo cambios de codigo, SQL ni migraciones productivas.

### Evidencia de generaciones sinteticas

Docente ficticio `e537ed34-4d07-4fbb-92b7-f83a3210f34f`, sin horarios/nomina.
A SHA-256 `da47c8b1555a6059c3ef614e91e29c730200cd1c8a1d4d7b7090ccf49c3508e6`.
B SHA-256 `d288527a1f0781456ac891520177dc3d13c306d8c29de1abbe7e1019d0ef47c6`.
Generacion A `1794346892460526`, softDeleteTime `2026-11-10T21:41:35.553Z`,
hardDeleteTime `2026-11-17T21:41:35.553Z`: diferencia604800s, consultada por
generacion exacta en GCS, no inferida de un404. B descargada desde candidata
con hash identico al original. Politica de adicionales no modificada.

## Activacion permanente condicionada

Tras aprobar los controles autenticados, a las16:44:41 America/Cancun se
habilitaron las dos politicas existentes, se armo el worker y se reanudo
Scheduler. No se repitieron create, migraciones ni ejecuciones manuales.
La ejecucion programada `nomina-h24-dossier-reconcile-fk7nr`, iniciada por la
SA Scheduler a las16:50, registro `COMPLETED`, cleanupSucceeded=true y exitCode=0
a las21:50:25.459492Z. Cola0, fallos0, constancias pendientes0; procesadas0
porque no habia trabajo pendiente. No se presenta como borrado de nuevos objetos.
Scheduler registro HTTP200 y Monitoring un punto positivo posterior a la
activacion. No se confunde SKIPPED con exito.

El digest OCI aprobado f1aafc5... contiene el manifiesto linux/amd64
`sha256:f84196bc16167db50abe438a261401751a3ebfcf2420e500df63d360bb68c784`,
observado en la ejecucion del worker. Se verifico la relacion mediante
`docker buildx imagetools inspect`; no es una candidata diferente.

## Resultado efectivo

Gates autenticados y ejecucion programada aprobados. API00058-baw al100% y
Hosting publicados a las16:52:04 America/Cancun. Release1794347521818000,
version9aaf70a74e0005e7. HTML SHA-256
`da721ff9885476a09757dfd286485c890db9efdaf4a8eb93b6d532bf4797215b`,
identico al build local de57c565a. API directa y via Hosting health200,
sesion anonima401, frontend y ruta expediente200.

Durante el smoke UI Admin, el usuario reporto alerta de cambios pendientes al
cerrar despues de eliminar adicionales y ausencia de un boton Guardar todo.
La candidata guarda cada operacion documental por separado y no tiene ese
boton; aun debe aclararse por que permanece la alerta. No se afirma perdida
de datos ni se descarta defecto sin reproducirlo. Postcheck16:59:33: errores
API5xx/severityERROR0, cola0, fallos0, marcadores constancia0, clientesSQL4.
El cierre se mantuvo pendiente hasta aclarar la observacion y completar el smoke.

### Aclaracion de la observacion de cierre

El usuario confirma que al vaciar los campos fiscales editados y volver a los
valores persistidos, Guardar datos fiscales se deshabilita y el panel cierra
sin advertencia. Habia cambios fiscales no guardados; los PDF se guardan por
operacion y no requieren Guardar todo. La consulta acotada del fixture confirma
tres UPLOAD, un REPLACE, tres DELETE y un CONTACT COMPLETE (incluye pruebas API),
sin documentos adicionales restantes. GCS versions=true sobre el prefijo
exclusivo del fixture devuelve0 generaciones; softDelete=0.

Queda observacion UX: el rechazo de datos fiscales muestra un mensaje generico,
sin identificar el campo. No se capturaron los valores rechazados; no se atribuye
una causa exacta a un campo especifico. No se confirma perdida de archivos ni
fallo del guardado valido. Se solicito comprobar C.P. valido y responsive antes
del cierre (aprobados posteriormente); cualquier mejora requiere otra candidata, no se modifica
silenciosamente57c565a durante este release.

Confirmacion humana posterior: C.P.00123->00124->00123 guardado correctamente;
descarga/reemplazo PDF y distribuciones1440x900,768x1024,390x844 satisfactorias.
Smoke Admin aprobado con observacion UX del mensaje generico, no perdida de
datos. La segunda ejecucion programada `nomina-h24-dossier-reconcile-pqnlk`
tambien completo correctamente tras el disparo de las17:00, con metrica positiva.
Las comprobaciones UI de los demas roles se completaron antes de retirar el fixture.

| Smoke UI en Hosting live, confirmado por usuario | Resultado |
|---|---|
| Admin: C.P. valido, descarga/reemplazo y eliminacion sintetica | Aprobado |
| Admin:1440x900,768x1024,390x844 | Aprobado |
| Finanzas: acceso a campos y descarga de constancia | Aprobado |
| RH: acceso a campos y descarga de constancia | Aprobado |
| Coordinador: menu oculto y URL directa | Redirige al Centro de control, sin expediente |
| Direccion: menu oculto y URL directa | Redirige al inicio, sin datos fiscales |
| Contador: menu oculto y URL directa | Redirige al inicio, sin datos fiscales |
| Contabilidad: menu oculto y acceso fiscal | Confirmado oculto, sin datos fiscales |
| Aviso de archivo no analizado sin contenido incrustado | Confirmado en los roles probados; comportamiento esperado, no fallo del visor |

No se reintroduce vista PDF incrustada para resolver una diferencia respecto
del flujo anterior: la retirada de analizadores fue acompanada por descarga
autorizada con advertencia. La apertura posterior en el equipo no es analisis
antivirus ni validacion estructural de Nomina.

### Incidencia del harness al retirar el fixture

El primer DELETE del docente sintetico fue rechazado400 antes del handler:
FST_ERR_CTP_EMPTY_JSON_BODY, Body cannot be empty when content-type is set to
application/json. El puente local adjuntaba ese encabezado aun sin cuerpo; el
helper web real lo agrega solo cuando existe body. No es un error500 ni una
mutacion parcial del docente. Los adicionales previos si quedaron COMPLETE.
Se detuvo el reintento automatico, se comprobo por SELECT que el fixture seguia
presente y se solicito su retirada al usuario por Directorio. La cuenta de
pruebas conservo Admin solo para esa retirada y fue restituida posteriormente.

## Cierre efectivo y recursos que permanecen

El usuario elimino el docente ficticio por Directorio. SELECT posterior confirma
teacherRemaining=0; cuenta de pruebas restituida a Coordinador/ACTIVO, mismo UID,
Firebase habilitado. Actor inicial del correo equivocado INACTIVO y sin UID;
se conserva por trazabilidad, no puede iniciar sesion. No se eliminaron eventos
de auditoria ni intenciones terminales. No se usaron docentes reales.

B fue verificada por SHA-256 antes de retirar el fixture. Generacion exacta
`1794346895375884`, softDeleteTime `2026-11-10T22:16:42.831Z`, hardDeleteTime
`2026-11-17T22:16:42.831Z`:604800s. Sin generacion vigente; A y B sinteticas
permanecen recuperables solo por permisos cloud hasta expirar normalmente.
No se restaura ni se cambia la politica para acelerar su eliminacion.
Adicionales:0 generaciones vigentes/no vigentes bajo el prefijo del fixture,
softDelete0 y versionado desactivado. No hay documentos sinteticos adicionales
pendientes de borrar.

| Recurso / comprobacion final | Resultado |
|---|---|
| API | nomina-api-00058-baw,100% trafico, sin tag h24-candidate |
| Hosting live | release1794347521818000/version9aaf70a74e0005e7 |
| Worker | nomina-h24-dossier-reconcile, armado, identidad SQL dedicada sin cloudsqlsuperuser |
| Scheduler | nomina-h24-dossier-reconcile-10m ENABLED, cron vigente America/Cancun |
| Alertas |11811020579760829856 y3484231198314869307 habilitadas; estrategias operativas existentes |
| Ejecuciones programadas | fk7nr16:50, pqnlk17:00 y ddmzg17:10: succeededCount1; las dos primeras con evidencia de log COMPLETED y metrica |
| Ultimo postcheck17:18:02 | health200, frontend/ruta200, sesion anonima401, errores5xx/severityERROR0, cola0, fallos0, constancias pendientes0, clientesSQL4 |
| Capacidad |1CPU/1GiB/concurrencia8, min0, servicio max2, revision H24 max1 |
| Rollback disponible/no aplicado | API00057-c7d, Hosting1793121624438000/3f9ebc88c835a143 |
| Recursos locales propios | Puente5186 y proxy25441 cerrados; sin listeners; contenedores efimeros retirados |

Ventana:10/11/2026 16:30:57 a17:18:50 America/Cancun,47.90min; vencimiento
autorizado18:30:57. No se renueva automaticamente. Despues del cierre solo se
consolida/publica documentacion local; la operacion permanente del worker,
Scheduler y alertas permanece expresamente autorizada.

Estimacion acumulada de intervenciones inferior a USD6.50: antecedente inferior
a USD5 mas reserva conservadora inferior a USD1.50 para esta ventana. No se
dispone de factura consolidada, no es cargo observado ni saldo certificado;
objetivo USD10 no previsto exceder. Costos recurrentes separados arriba.

### Confirmaciones y seguimiento

- Misma fuente57c565a e imagen por digest; sin reconstruir API ni cambiar codigo.
- Sin merge, GitHub Actions, analizadores ni servicios nuevos de analisis.
- Sin nuevas migraciones, baseline, apply o respaldo en esta ventana; H05 inspect20/0/0.
- Sin cambios H01, operaciones de Nomina, corridas o snapshots.
- Sin modificaciones a expedientes reales; solo fixture y rol temporal de la cuenta de pruebas, restituidos.
- Permiso Firebase agregado solo users.get; sin permisos Firebase Admin, impersonacion nueva ni objectAdmin.
- Constancias604800s y adicionales separados con borrado definitivo, sin restauracion en UI.
- Riesgo residual de archivos NOT_SCANNED permanece; descarga externa no equivale a archivo seguro.
- Mejora posterior: mensajes fiscales que identifiquen el campo rechazado y claridad sobre guardados independientes; no bloquea el recorrido valido aprobado.
- Restauracion del respaldo existente no ensayada; ampliar capacidad requiere revisar nuevamente el presupuesto SQL.

Evidencia tecnica local sanitizada: H24-Release-20261110 fuera del repositorio.
Tokens solo en memoria del puente, cerrado al terminar. No se publican credenciales,
cadenas de conexion, contenido documental ni datos personales de usuarios.
