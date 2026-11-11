# H24 - Candidata posterior: validacion fiscal y pago del Coordinador

Fecha: 2026-11-10. Estado actual: **RELEASE COMPLETADO** desde `7511717`;
API/Hosting publicados, smoke API/UI aprobados y ventana cerrada19:28:14 Cancun.
Las secciones locales siguientes conservan la evidencia anterior al release.
Base publicada: `da151b8c35f39a43244b8733c309f8109fedf40d`, rama
`feature/h02-h03-user-coordinations-permissions`, inicialmente limpia y sincronizada.
No habia commits posteriores ni cambios ajenos al comenzar. No se encontro un
AGENTS.md aplicable con instrucciones adicionales en el repositorio/ancestros.

El [release H24](H24_Release_Condicionado_20261110.md) sigue cerrado operativo.
Su evidencia no se reescribe ni se atribuyen estas mejoras a la imagen desplegada.

## Causa y reproduccion

- `TeacherDossierPanel.saveFiscal()` reutilizaba `dossierError`, cuyo mensaje
  generico es apropiado para otras operaciones, pero ocultaba la causa fiscal.
  La API devolvia el primer error, sin un contrato de campos. La validacion local
  solo contemplaba pago, C.P. y CURP, no todos los rechazos actuales de la API.
- Directorio decidia el selector/payload y el backend decidia la escritura solo
  por `fiscal.manage` o administrador. Faltaba una prohibicion explicita por rol
  para `coordinador`. Un permiso accidental permitia alcanzar la logica SQL.
- En PATCH, `paymentType` ausente se convertia en `''` por el default del schema;
  con permiso fiscal podia vaciar el pago. Sin permiso se copiaba el valor leido
  antes del UPDATE, en vez de conservarlo directamente en la fila actual.
- Antes de corregir, ocho pruebas nuevas fallaron: seis por falta del contrato
  de campos y dos porque POST/PATCH no rechazaban antes de SQL al Coordinador
  con `fiscal.manage`. El mock incompleto devolvio 500 al alcanzar SQL/alcance;
  esto no demuestra un 500 productivo ni una asignacion real de ese permiso.
- No se consultaron sesiones, permisos ni expedientes productivos. La causa se
  acredita en codigo y fixtures locales, no se atribuye un fallo a produccion.

## Cambios

### Fiscal

- La API conserva `400`, `error: VALIDATION_ERROR` y `message`; agrega
  `fieldErrors`, mapa opcional de los seis nombres de campo a `INVALID_FORMAT`.
  Mensajes estaticos en espanol, sin valores rechazados, trazas ni detalle SQL.
  RFC/correo se validan dentro del mismo schema para identificar varios campos,
  con las mismas expresiones, normalizaciones y limites anteriores.
- El cliente conserva el contrato anterior de `ApiRequestError`, con un cuarto
  argumento opcional. El panel solo interpreta claves/codigos conocidos y usa
  textos propios: nunca muestra indiscriminadamente el mensaje del servidor.
- RFC, correo, C.P. fiscal, CURP, pago y banco tienen orientacion junto al campo,
  `aria-invalid`, `aria-describedby` y foco en el primer error. `novalidate`
  permite una experiencia uniforme sin quitar la validacion autoritativa API.
- Valores retenidos ante validacion/conflicto/fallo de servicio, errores que se
  actualizan al corregir y confirmacion fija de exito. Una perdida de sesion o
  permisos conserva el cierre de acceso existente y oculta datos sensibles.
- El guardado exitoso adopta la respuesta canonica, restablece dirty fiscal y
  renueva la version para telefono. Un telefono editado no se pierde ni se da
  por guardado al guardar fiscal. El aviso de cambios reales pendientes sigue.
- Se explica que fiscal/telefono tienen sus propios botones y cada operacion
  documental se guarda por separado. No se agrega Guardar todo.
- C.P. sigue siendo texto opcional; `00123` no pierde ceros. RFC/CURP conservan
  validacion de formato, no verificacion oficial SAT/RENAPO. Banco maximo140,
  correo maximo160; no se cambian reglas fiscales.
- `useDossierOperations.ts` fue revisado, no modificado. Sus mensajes y estados
  documentales, NOT_SCANNED y descarga sin contenido incrustado se conservan.

### Tipo de pago en Directorio

- Capacidad UI de pago separada de la capacidad fiscal existente: Coordinador
  no tiene selector en alta/edicion y ambos payloads omiten `paymentType`, aun
  con `fiscal.manage`. No se amplia la visibilidad fiscal ni se cambia categoria.
- POST/PATCH rechazan cualquier presencia explicita del campo para Coordinador
  antes de parsear/consultar SQL: `403`, `COORDINATOR_PAYMENT_FORBIDDEN`. Incluye
  vacio, null, formato invalido, otro pago y el mismo pago persistido.
- POST sin campo conserva `''` / Sin definir. PATCH usa CASE en SQL: solo escribe
  el pago si el actor esta autorizado, no es Coordinador y envio el campo;
  en otro caso conserva `payment_type` en la fila, sin copiar una lectura vieja.
- Ruta fiscal mantiene su guarda H24 y agrega defensa de pago por rol. Import
  preview/apply siguen Admin-only, con exclusion explicita de Coordinador incluso
  ante un indicador administrativo contradictorio. El import H22 no agrega
  campos fiscales al CSV; contacto del expediente solo escribe telefono.
- Propietario/ambito y permisos de otros roles se conservan. La denegacion
  historica por propietario sigue usando REQUEST_ERROR/400, sin cambiarla a403.
  Admin, Finanzas y RH conservan gestion fiscal autorizada.

## Pruebas y evidencia

Datos exclusivamente sinteticos. PostgreSQL18 en Docker temporal
`nomina-fiscal-qa-20261110`, host127.0.0.1:55491, DB `nomina_docente_test`, datos
en tmpfs. El runner de integracion aplica los SQL originales en esa base efimera,
incluida017; no crea ni modifica migraciones. No usa la BD local habitual.

Comandos npm ejecutados con CLI10.9.4 ya instalada, sin instalar dependencias:

| Validacion | Resultado |
|---|---|
| `npm run test:api` | 483 PASS, 21 omitidas historicas optativas, 30 suites PASS |
| `npm run test:api:integration` | 175/175 PASS, 24 suites, PostgreSQL efimero |
| `npm run test:web` | 194/194 PASS, 25 suites |
| `npm run typecheck` | API/web OK |
| `npm run build` | API/web OK |
| `git diff --check` | OK |
| Brave headless / Playwright local | 9 recorridos PASS, cero pageerror |

No se omitieron pruebas para lograr aprobacion. Las21 omitidas corresponden a
ensayos optativos historicos, no a la cobertura nueva. Se corrigieron errores
del harness nuevo (fixture incompleto, selector/acentos, expectativa de400 por
propietario y campos requeridos TypeScript) antes de repetir las validaciones.

Cobertura nueva: alta Sin definir, conservacion del pago en edicion operativa,
rechazos manipulados y rutas alternativas, Coordinador con/sin permiso fiscal,
ambito de otro propietario, gestores fiscales autorizados, rechazos sin escritura,
campos accesibles/foco, mensajes seguros, conservacion y correccion, C.P. con cero,
guardado posterior y dirty correcto. La suite existente cubre H01, cancelacion,
importacion, documentos y otros modulos sin modificar sus implementaciones.

UI real de componentes y estilos con API/sesion sinteticas (no login Firebase
ni smoke productivo): 1440x900,768x1024,390x844. Por resolucion: alta/edicion
Coordinador normal y con permiso accidental, y fiscal error/correccion/guardado.
Se verificaron payloads sin pago, foco, valores conservados, warning real,
confirmacion, controles accesibles por scroll y ausencia de overflow del panel.
Capturas revisadas visualmente; logs, harness y18 PNG locales en
`C:\Users\Admin\AppData\Local\NominaDocente\H24-FiscalUX-20261110`.
No se publican fixtures, credenciales ni capturas de datos reales.
Al terminar se cerraron Brave/Vite de prueba y se retiro el contenedor PostgreSQL
efimero, incluido su tmpfs. Se conservan solo las evidencias locales indicadas.

## Plan previo al release (antecedente historico)

1. Obtener autorizacion para una ventana nueva. Verificar SHA publicado, pruebas,
   arbol limpio y metadatos vigentes; no asumir vigencia solo por este documento.
2. Referencia historica de rollback para ESTA candidata: API00058-baw, digest
   `sha256:f1aafc5cbc0d4f8a658c1bede3abb9af656ef3a48b3e1b584ab632f052958303`,
   Hosting release1794347521818000/version9aaf70a74e0005e7. Reconfirmar y registrar
   antes de desplegar. No confundir con00057, rollback del release H24 anterior.
3. Construir/publicar imagen de esta candidata y desplegar API primero, luego
   Hosting; contrato de errores compatible. Sin migraciones ni cambios cloud
   ajenos a ese release. Mantener worker/Scheduler/buckets/IAM/alertas actuales.
4. Health200 directo/via Hosting, sesion no autenticada401, smoke autorizado con
   datos sinteticos: gestores fiscales, seis errores/correccion, telefono dirty,
   Coordinador normal y payload manipulado403, alta Sin definir y edicion sin
   cambio de pago, permisos/alcance intactos y movil. Verificar logs.
5. Ante regresion critica, restaurar Hosting y trafico a las versiones previas
   verificadas. Sin down migrations, restauracion rutinaria de BD ni cambios al
   worker. El rollback de API retiraria tambien la nueva prohibicion explicita;
   registrarlo y no declarar vigente esa defensa tras volver a la imagen previa.

Pendiente al cerrar la fase local: autorizacion de release y smoke real. No queda
ninguna migracion ni infraestructura nueva requerida por estas adecuaciones.

## Confirmaciones de la fase local anterior

Sin acceso ni cambios productivos, deploy, cambios de roles reales o IAM,
modificaciones de buckets/worker/Scheduler/alertas, H01 o calculos de Nomina.
Sin dependencias, analizadores ni GitHub Actions. Sin escrituras a expedientes
reales. El cierre operativo H24 y su historial se conservan.

## Release condicionado del 2026-11-10

Autorizacion nueva y explicita para publicar exclusivamente
`75117176be70cbd28dac7512ccad53c14970f069`, sin merge ni cambios funcionales
adicionales. Rama limpia y sincronizada con origin antes de construir; contexto
controlado de121 archivos del SHA aprobado, sin archivos locales secretos.
No se modifican las conclusiones historicas del release H24 anterior.

### Ventana y presupuesto

- Inicio de primera consulta productiva: 2026-11-10 18:59:10 America/Cancun
  (`2026-11-10T23:59:10.205Z`). Vencimiento unico: 20:59:10 del mismo dia
  (`2026-11-11T01:59:10.205Z`), con20 minutos reservados para rollback.
- Cloud SQL RUNNABLE en us-central1; encendido06:50/apagado22:00 confirmado.
  Sin nueva ventana automatica, respaldo, H05 inspect ni migraciones.
- Objetivo acumulado USD10. Estimacion conservadora previa hastaUSD6.50 mas
  hastaUSD2 de esta intervencion: hastaUSD8.50 acumulados estimados, no cargos
  facturados ni remanente exacto. Incluye build, imagen y ejecucion temporal API;
  no se crea infraestructura persistente adicional al release autorizado.

### Procedencia y resultado tecnico

| Elemento | Resultado observado |
|---|---|
| Fuente API/frontend | `75117176be70cbd28dac7512ccad53c14970f069` |
| Cloud Build | `3af23829-e7ad-4414-b6e0-cdf47a1c509f`, SUCCESS |
| Imagen | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h24-fiscal-7511717-20261110` |
| Digest inmutable | `sha256:227fdd167cc3aa6107199466694482ea4ec916ef59f08a7548924588bf3127f2` |
| API anterior/rollback | `nomina-api-00058-baw` |
| API nueva | `nomina-api-00061-xin` |
| Validacion sin trafico general | Health200, anonimo401 y sesiones Admin/Coordinador200 |
| Trafico general | 100% a00061-xin, confirmado19:11:36 Cancun |
| Hosting live | Release `1794355920347000`, version `354df4645c244f3a` |
| Hosting anterior/rollback | Release `1794347521818000`, version `9aaf70a74e0005e7` |
| SHA-256 index.html publicado | `1cc4767d2e3577a9c9ba3bdd498b2b48a90e835f172e63830b45cffff3121ce4`, igual al artefacto local |
| Publicacion Hosting | Confirmada19:12:03 Cancun, exclusivamente Hosting |
| Capacidad conservada | CPU1, memoria1Gi, concurrencia8, timeout300s, min0, servicio max2, revision max1 |
| Configuracion API | Identidad, variables, referencias de secretos, conexiones y conectividad conservadas |

Comandos ejecutados con proyecto explicito, sin imprimir credenciales:

```text
gcloud builds submit <contexto-controlado> --config=<cloudbuild-local.yaml> --async --project=nomina-docente-prod
gcloud run services update nomina-api --region=us-central1 --image=<digest-aprobado> --no-traffic --tag=fiscal-candidate --project=nomina-docente-prod
gcloud run services update-traffic nomina-api --region=us-central1 --to-revisions=nomina-api-00061-xin=100 --project=nomina-docente-prod
firebase deploy --only hosting --project nomina-docente-prod --non-interactive
```

API/web tests, typecheck y build repetidos desde el archivo Git exacto: exit0.
La integracion PostgreSQL175/175 de la fase local corresponde a esta misma
candidata; no se repitio sobre produccion ni equivale a H05 productivo nuevo.
Cloud Build SUCCESS acredita la construccion, no sustituye el smoke. No se
configuro GitHub Actions ni se atribuye una ejecucion CI adicional.

### Smoke autenticado de API

Ejecutado dos veces: en la revision etiquetada sin trafico y luego via Hosting
productivo. Login personal Firebase; credenciales de sesion solo en memoria del
puente loopback. Dos cuentas existentes, Admin y Coordinador, sin cambiar roles
ni conceder fiscal.manage. Solo dos docentes ficticios propios identificados.

| Prueba | Resultado en candidata y live |
|---|---|
| RFC, correo, C.P., CURP, pago y limite bancario invalidos | Seis400 con fieldErrors seguros, sin valor rechazado ni traza |
| Contrato anterior | Conserva error/message/400; consumidor anterior compatible |
| Gestor fiscal autorizado | Admin guarda pago y C.P.00123, ceros conservados |
| Alta Coordinador sin paymentType | 201; persistencia Sin definir |
| Edicion operativa Coordinador | 200; telefono/categoria permitidos, pago asignado por Admin conservado |
| POST/PATCH manipulados | Ocho403: otro pago, mismo pago, vacio y null |
| Rutas alternativas | Import preview/apply y fiscal rechazadas403 |
| Propietario/ambito | Edicion de docente ajeno rechazada400, contrato historico conservado |
| Ausencia de escritura ante ataques | SELECT readonly de los dos fixtures antes/despues identico |

La prueba con permiso fiscal accidental permanece exclusivamente aislada; no
se alteraron permisos productivos para repetirla. Los SELECT se limitaron a
fixtures, roles de las dos cuentas autorizadas y conteos de la cola, sin leer
expedientes reales. No se imprime informacion fiscal en la evidencia publicada.

### Continuidad preliminar y limites

Verificada19:13:36 Cancun: worker con spec e imagen anteriores intactos,
Scheduler ENABLED sin cambio de configuracion, ambas politicas de alerta
habilitadas e identicas. Cola:0 pendientes,0 fallos de ventana,0 constancias
pendientes. Roles/estado de ambas cuentas sin cambios. Logs de la revision
nueva severity>=ERROR:0. Health200 y anonimo401 directo/via Hosting.

Incidencia del harness: la primera consulta CLI de logs rechazo el filtro por
comillas de PowerShell (INVALID_ARGUMENT); se sustituyo por la API de lectura
Logging y paso. No fue un error de la aplicacion ni se repitio una mutacion.

Esta comprobacion preliminar precede al smoke manual y a la retirada final;
no sustituye el cierre registrado mas abajo.

### Smoke UI humano y persistencia

Confirmado por el usuario con sus cuentas existentes, sin modificaciones de rol:

- Admin: errores junto a RFC/correo/C.P./CURP, foco en el primer error, valores
  conservados, correccion y guardado exitoso. Guardar fiscal conserva el telefono
  pendiente y la advertencia al cerrar; al devolver ese telefono a su valor
  original sin guardar, desaparece la advertencia. No existe Guardar todo.
- C.P.00124 conservado al reabrir. Panel, errores y botones accesibles sin
  desbordamiento general en1440x900,768x1024,390x844.
- Coordinador: alta real de un tercer docente ficticio desde Directorio sin
  selector de pago, con Categoria disponible. Guardado satisfactorio. Edicion
  de telefono/categoria en el fixture propio anterior, sin selector de pago;
  escritorio/movil accesibles y sin desbordamiento.
- SELECT readonly a19:22:48 Cancun: tercer fixture creado por Coordinador,
  pago Sin definir; cambio operativo del otro fixture persistido y pago Banorte
  intacto. C.P.00124 con ceros, telefono pendiente del fixture Admin no persistido.
- La omision de paymentType del payload normal esta cubierta por las pruebas
  locales del cliente y corroborada por el alta/edicion UI exitosas frente a la
  API que rechaza toda presencia explicita del campo. No se almacenaron HAR ni
  tokens productivos. La validacion visual es confirmacion humana, no ejecucion
  automatizada del navegador productivo.

### Retirada de fixtures

Tres registros sinteticos propios: dos creados por API y uno creado en UI.
El tercero fue eliminado por Admin en la interfaz y su ausencia se confirmo por
SELECT. La primera retirada automatica de los dos restantes devolvio400 y se
detuvo, sin reintento ciego: ambos continuaban presentes. El harness enviaba
Content-Type application/json sin cuerpo en DELETE; Fastify local reprodujo
400/FST_ERR_CTP_EMPTY_JSON_BODY y200 al omitir ese header. La interfaz normal
no envia ese header vacio. Ambos se retiraron por la interfaz Admin. El usuario
observo que desaparecen de la tabla sin un mensaje visible de confirmacion;
se registra como observacion UX, no como fallo de persistencia. SELECT readonly
a19:27:22 Cancun confirmo cero filas para los tres UUID/identificadores propios
y tres eventos TEACHER_DELETED conservados en auditoria. Sin SQL correctivo ni
borrado directo de tablas. No se cambia codigo funcional ni se reconstruye la
candidata por un defecto del harness local.

### Rollback disponible

Hosting anterior `9aaf70a74e0005e7` y trafico API a00058-baw. Digest de imagen
de plataforma anterior verificado:
`sha256:f84196bc16167db50abe438a261401751a3ebfcf2420e500df63d360bb68c784`.
El indice OCI historico `sha256:f1aafc5cbc0d4f8a658c1bede3abb9af656ef3a48b3e1b584ab632f052958303`
es una referencia distinta del mismo release, no un avance productivo posterior.
Ante regresion critica atribuible: restaurar Hosting y trafico API, verificar
salud/sesion; sin down migration, restauracion BD ni cambio de worker. Volver a
la API anterior retiraria la prohibicion explicita nueva por rol. No aplicado.

### Dictamen y cierre efectivo

**RELEASE COMPLETADO**: ambas mejoras publicadas y comprobadas. La evidencia
manual corresponde a las confirmaciones del usuario durante esta ventana;
los resultados de API y persistencia fueron comprobados directamente.

- Continuidad final19:27:48 Cancun: configuracion/capacidad API intactas salvo
  imagen y trafico; worker conserva spec/imagen57c565a, Scheduler ENABLED y
  alertas habilitadas sin cambios. Ejecucion programada19:20:43 con
  outcome=COMPLETED, cleanupSucceeded=true, exitCode=0; no se disparo el job
  manualmente para esta adecuacion.
- Cola final:0 operaciones pendientes,0 fallos desde inicio y0 constancias
  pendientes. Logs ERROR de00061-xin durante la ventana:0. Health200 y sesion
  anonima401 por API directa y Hosting, repetidos tras retirar el tag.
- Tres fixtures retirados mediante interfaz Admin/API normal; auditoria
  conservada. Ninguna cuenta cambio de rol/estado, por lo que no hubo ajustes
  de cuenta que restituir. El puente local5186 fue cerrado; no se guardaron
  tokens en evidencias ni se revocaron sesiones reales.
- Tag fiscal-candidate retirado mediante update-traffic --remove-tags;
  trafico100% a00061-xin y template sin cambios adicionales. Revision anterior
  y version Hosting anterior disponibles para rollback; rollback no aplicado.
- Fin de operaciones productivas: 2026-11-10 19:28:14 America/Cancun
  (`2026-11-11T00:28:14.501Z`), duracion29.07 minutos, antes del vencimiento
  20:59:10 y del corte SQL. Ventana cerrada, sin renovacion automatica.
- Estimacion acumulada conservadora hastaUSD8.50, dentro del objetivoUSD10;
  no equivale a factura ni a saldo exacto. No se crean servicios persistentes
  adicionales; permanecen solamente los artefactos normales de release/rollback.

Evidencia local separada por candidata/live/manual/continuidad en
`C:\Users\Admin\AppData\Local\NominaDocente\H24-FiscalUX-Release-20261110`.
Se publica solo el resumen sanitizado. Cambios posteriores al SHA funcional:
unicamente documentacion propia (acta, SDD, matriz, H13 y README).

Sin migraciones, respaldo nuevo, merge, IAM, cambios de secretos/roles/buckets,
worker/Scheduler/alertas, H01 ni calculos de Nomina. Sin analizadores ni GitHub
Actions. Hubo exclusivamente escrituras de smoke a los tres fixtures autorizados;
no se modificaron expedientes reales, Nomina, corridas ni snapshots.

Limite residual no bloqueante: mensaje visible de confirmacion de eliminacion
no observado por el usuario. No se afirma una regresion atribuible a esta
candidata ni se incorpora una correccion funcional ajena al release aprobado.
