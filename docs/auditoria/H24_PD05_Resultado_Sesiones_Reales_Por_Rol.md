# H24-PD-05 - Resultado de sesiones reales por rol

Fecha: 2026-10-27 (America/Cancun). Codigo validado: `8d131c5`.
Rama: `feature/h02-h03-user-coordinations-permissions`; limpia al inicio.
**Matriz de roles vigentes y flujo documental: satisfactorios en entorno aislado.
PD-05 con validacion parcial; casos complementarios pendientes. H24 sigue NO-GO.**

Seguimiento posterior del mismo dia: [validacion complementaria autorizada](H24_PD05_Validacion_Complementaria_Auth_Sesiones.md).
Resuelve permisos reducidos, identidad local y retirada durante carga; confirma
AUTH-01, no lo corrige. Los conteos y la restitucion INACTIVO de este documento
corresponden al primer ensayo. El seguimiento conserva QA ACTIVO para revision
expresa del usuario y registra los nuevos conteos por separado.

## 1. Autorizacion y aislamiento

El usuario autorizo usar su cuenta institucional para login Google real, preparar
un usuario en `nomina_docente_test`, rotar temporalmente rol/estado con respaldo
y restitucion, gestionar PDF sinteticos en GCS H24 y cambiar/restaurar un telefono
ficticio. No autorizo cambiar permisos compartidos ni revocar su cuenta Google.

| Componente | Destino efectivo |
|---|---|
| Firebase Auth / Google | nomina-h24-test-20261027 |
| Actor | Una identidad institucional autorizada; alias local H24 QA Sesiones |
| PostgreSQL | nomina_docente_test, 127.0.0.1:55440 |
| API real | http://localhost:8084, listener 127.0.0.1, NODE_ENV=development |
| Web / navegador | http://localhost:5184, listener 127.0.0.1, Brave |
| GCS | nomina-h24-test-234692275301-dossier |
| Credencial storage | ADC temporal con impersonacion de h24-dossier-runtime |
| Inventario storage | h24-dossier-auditor, consulta de objetos/versiones |

Configuracion Firebase completa y explicita, sin defaults productivos ni emuladores.
No se sustituyo verifyIdToken, no se inyectaron actores ni se usaron custom tokens.
La API valido el ID token obtenido por el login Google normal en Brave.
Un arnes temporal ignorado por Git lanzo buildApp real en loopback y ejecuto
solicitudes HTTP con ese token, custodiado fuera de Git y eliminado al terminar.

Backup local previo: `pre-pd05.dump`, formato custom de pg_dump 18, 1,268,173 bytes.
SHA-256: `ac5ba740ff7479cdd6e6ebeb133267fab65b16c46eb3bd27935b7eda796528f6`.
Evidencias privadas en `%LOCALAPPDATA%/NominaDocente/H24-PD05-20261027`, con ACL
restringida. No publicar dump, credenciales, tokens ni datos de configuracion privada.
No se restauro la BD completa ni se ejecuto un reset de integracion.

## 2. Login y metodo de rotacion

El primer acceso no se completo y mostro `auth/popup-closed-by-user`. No se atribuye
una causa raiz no demostrada: Google y el retorno Firebase respondian y aun no
llegaba una sesion autenticada a la API. El usuario completo posteriormente el
login; GET /auth/session devolvio 200, correo esperado, rol admin y protegido=false.
No se cambiaron protecciones de Brave ni autenticacion para lograrlo.

Se reutilizo **una identidad real, secuencialmente**, cambiando solo role_id/status
de su fixture local. El backend relee autorizacion en cada solicitud, incluso con
el mismo token vigente. La UI recargo la sesion persistida para cada rol; no se
afirma login Google independiente, concurrencia entre cuentas o cambio de cuenta
por cada rol. El refresh conservo la sesion y actualizo las capacidades visibles.

## 3. Matriz observada

| Rol local | Menu / URL directa | Lectura, archivos y telefono por API | Resultado |
|---|---|---|---|
| Admin no protegido | Visible; panel y controles disponibles | 200 y operaciones COMPLETE | Satisfactorio |
| Finanzas | Visible; panel y controles disponibles | 200 y operaciones COMPLETE | Satisfactorio |
| RH | Visible; panel y controles disponibles | 200 y operaciones COMPLETE | Satisfactorio |
| Coordinador | Sin menu; URL redirige a / | 403 en nueve variantes | Satisfactorio |
| Direccion/Subdireccion | Sin menu; URL redirige a / | 403 en nueve variantes | Satisfactorio |
| Contador | Sin menu; URL redirige a / | 403 en nueve variantes | Satisfactorio |
| Contabilidad | Sin menu; URL redirige a / | 403 en nueve variantes | Satisfactorio |

Contador y Contabilidad son codigos de rol distintos en esta BD. No se modificaron
roles, role_permissions ni user_coordinations. Se probaron los permisos completos
vigentes de Finanzas/RH, no variantes de permisos reducidos.

Las nueve variantes cubren GET expediente, POST documento, PATCH metadata,
PUT contenido, DELETE documento, GET contenido inline, GET contenido download,
PATCH contacto y GET operacion. Los roles excluidos recibieron 403 antes de parsear
los payloads de mutacion; los negativos usan cuerpos vacios para verificar ese orden.
Sin token y con token malformado: 401 en las nueve variantes de cada caso.
Admin INACTIVO con token aun vigente: 403 en las nueve variantes; repetido tras
restitucion final. **72 solicitudes negativas verificadas**, sin nuevas operaciones,
documentos o auditoria de expediente. No equivalen a 72 identidades independientes.

## 4. Flujo autorizado y UI

Admin, Finanzas y RH completaron por API real:
- Dos cargas del mismo tipo OTRO y consulta de estado COMPLETE.
- Lectura inline/descarga PDF, Content-Disposition correcto, no-store y SHA-256
  identico al archivo enviado.
- Cambio de metadata, reemplazo del contenido y comprobacion del nuevo hash.
- Documento de A solicitado bajo B: 404, sin bytes. Revision obsoleta: 409.
- Telefono ficticio, reflejo inmediato en el endpoint de Directorio, version vieja
  rechazada con 409 y restitucion del telefono original.
- Borrado por API, lectura posterior 404 y limpieza del objeto por el adaptador GCS.

Admin se ejecuto dos veces: la repeticion agrego la asercion explicita de Directorio.
No hubo fallos de las aserciones HTTP funcionales. Los comandos del arnes salieron 0.

UI Admin: el usuario selecciono dos PDF sinteticos juntos; ambas operaciones
terminaron Completado. El visor nativo mostro el documento, y el boton Descargar
produjo un PDF de 1,369 bytes con hash identico. Finanzas/RH mostraron los controles
de carga y telefono al recargar su rol. Reemplazo, metadata y borrado se verificaron
por API; no se presentan como acciones repetidas por UI en todos los roles.

La extension Brave no tenia acceso a file URLs: el usuario selecciono los PDF
sin ampliar permisos de la extension. Se proporcionaron copias sinteticas en
`Downloads/H24-PD05-PDF-Sinteticos`. Un PDF alternativo seleccionado inicialmente
se retiro de la cola **antes de cualquier carga**; no fue enviado a GCS.
La espera automatica del evento download agoto su plazo, pero el archivo si se
descargo: existencia, tamano y hash se comprobaron directamente en Descargas.

Logout desde la UI redirigio a /login y mostro el boton de acceso. No se confunde
logout con revocacion de ID tokens ya emitidos; AUTH-01 permanece abierto.

## 5. Escrituras sinteticas, limpieza y restitucion

36 operaciones nuevas, todas COMPLETE: 10 UPLOAD, 4 REPLACE, 4 METADATA,
10 DELETE y 8 CONTACT (cuatro cambios y cuatro restituciones). Dos de las diez
cargas corresponden al lote UI. Se generaron 60 eventos de auditoria esperados,
incluidos eventos de solicitud y finalizacion; no se borraron para ocultar el ensayo.

| Tabla | Filas antes / despues | Evidencia |
|---|---:|---|
| app_users | 21 / 22 | Un nuevo fixture QA; otros 21 usuarios identicos |
| audit_log | 31 / 91 | Auditoria sintetica conservada |
| teacher_dossier_operations | 16 / 52 | 36 nuevas COMPLETE; cero pendientes |
| teacher_dossier_documents | 0 / 0 | Sin documentos residuales |
| teachers | 271 / 271 | Telefono restaurado; cambios esperados en updated_at/updated_by |
| payroll_runs | 19 / 19 | Fingerprint identico |
| payroll_lines | 4455 / 4455 | Fingerprint identico |
| payroll_schedule_details | 12020 / 12020 | Fingerprint identico |
| payroll_extra_details | 1058 / 1058 | Fingerprint identico |
| roles / role_permissions | 7 / 7; 75 / 75 | Fingerprints identicos |
| schema_migrations | 19 / 19 | Fingerprint identico; ninguna migracion ejecutada |

Se compararon las 26 tablas publicas. Solo cambiaron app_users, audit_log,
teacher_dossier_operations y teachers. Los campos de todos los docentes distintos
de phone/updated_at/updated_by conservaron su hash, incluidos fiscales, created_by,
coordinacion y estatus. Los telefonos de los fixtures quedaron restituidos.

La cuenta institucional no existia en app_users antes del ensayo. Se conserva el
fixture nuevo **INACTIVO, rol admin, no protegido**, segun baseline QA respaldado;
no se afirma que se elimino la fila ni que app_users regreso a 21 registros.
UID/last_login_at reflejan el login real. No se borro ni revoco la identidad Firebase
de prueba o la cuenta Google; su gestion requiere alcance separado.

Inventario final GCS --all-versions: vacio, exit 0, con auditor de solo lectura.
Bucket US-CENTRAL1, UBLA=true, PAP=enforced, versionado=false, soft-delete=0.
No se declararon objetos soft-deleted recuperables a partir de una consulta no hecha:
la evidencia es politica de retencion cero e inventario completo de versiones vacio.
Los dos PDF UI tambien fueron eliminados por API, no mediante borrado SQL.

Se detuvieron solo los procesos API/web propios del ensayo. Token temporal y ADC
aislado eliminados; credenciales habituales del operador sin cambio. Backup,
evidencias restringidas y copias de PDF sinteticos conservados. No se hizo deploy.

## 6. Pendientes y recomendacion

PD-05 avanza de preparacion a **validacion parcial satisfactoria**. La matriz de
roles vigentes esta probada, pero el plan completo conserva pendientes:
- Finanzas/RH con permisos reducidos y revocacion durante una carga; no se cambio
  role_permissions compartido para probarlos.
- Correo sin registro local, UID incompatible, dominio/correo no verificado y token
  valido de otro proyecto de prueba; no cubiertos por el caso de token malformado.
- Cuentas independientes, cambio de cuenta, cierre/reapertura del navegador sin
  restauracion de sesion y H15 al minuto 60; no ejecutados en este ensayo.
- AUTH-01: revocacion/deshabilitacion Firebase y tratamiento formal del riesgo.

No se modifico codigo para resolver pendientes ni se cerraron por equivalencia con
tests anteriores. Completar casos pertinentes o aprobar formalmente alcance/aceptacion
de riesgo; mantener NO-GO mientras falten gates PD-03/04/06/07/08 y AUTH-01.
Este ensayo no autoriza despliegue productivo ni sustituye H05/H13.

## 7. Validaciones y confirmaciones

Arnes HTTP local con Firebase/GCS reales; verificaciones de roles, fingerprints,
inventario y restauracion descritas arriba. Se corrigio solo una consulta de
evidencia del arnes temporal (actor_id por actor_user_id), sin cambios funcionales.
Un intento de listar GCS con --format=json se rechazo; la consulta --all-versions
sin ese formato termino correctamente. No se ocultaron como fallos del producto.

Validaciones documentales: git diff --check, git diff --name-only y git status.
No tests/build generales ni test:db:prepare; no se cambio codigo o dependencias.
Sin commit/push automaticos. Solo documentos versionados modificados.
Sin produccion, Cloud SQL productivo, migraciones, deploy, seeds, cambios H01,
Nomina, snapshots, fiscales, permisos compartidos, npm audit fix o --force.
