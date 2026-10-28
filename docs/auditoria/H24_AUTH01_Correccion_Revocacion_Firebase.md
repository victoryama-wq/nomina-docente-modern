# H24 / AUTH-01 - Correccion de revocacion y deshabilitacion Firebase

Fecha: 2026-10-28 (America/Cancun). Base Git: `158bce9`.
Rama: `feature/h02-h03-user-coordinations-permissions`, limpia al inicio.
Estado: **AUTH-01 corregido y cerrado tecnicamente en local/H24**: rechazo real
disabled/revoked, nuevo login valido e integridad posterior comprobados.
No desplegado. No cierra PD-05 completo ni autoriza H24-F5.

## 1. Alcance autorizado y causa

El usuario autorizo corregir AUTH-01 y probar exclusivamente en el entorno H24.
El acta complementaria del 2026-10-27 demostro que `verifyIdToken(token)` aceptaba
un ID token aun vigente despues de deshabilitar al usuario o revocar sus sesiones.
La comprobacion de firma, proyecto y expiracion no consulta esos estados por defecto.

Se cambia `apps/api/src/auth.ts` a `verifyIdToken(token, true)`, antes de consultar
app_users. Se conserva el contrato `401 INVALID_TOKEN`, sin detallar a clientes si
la cuenta fue deshabilitada o revocada. No hay cache propia de aceptacion ni fallback
a verificacion sin revocacion cuando Firebase falla. Los logs ya no imprimen el
objeto/mensaje completo del SDK: registran solo codigo auth seguro o codigo generico.

Se conservan email_verified, dominio, usuario local ACTIVO, UID, permisos,
coordinaciones, excepcion de superadmin y bypass test-actor exclusivo de NODE_ENV=test.
No cambian frontend, H15, rutas, reglas fiscales, H01, dependencias ni SQL.

Referencias: [Firebase: gestionar sesiones](https://firebase.google.com/docs/auth/admin/manage-sessions)
y [contrato BaseAuth](https://firebase.google.com/docs/reference/admin/node/firebase-admin.auth.baseauth).
Tambien se inspecciono la implementacion instalada de firebase-admin.

## 2. Aislamiento e IAM minimo

- Firebase/GCP existente: `nomina-h24-test-20261027`; no se creo otro proyecto.
- BD comprobada: `nomina_docente_test`, `127.0.0.1:55440`.
- API real: `127.0.0.1:8084`; web/Brave: `http://localhost:5184`.
- Identidad institucional autorizada, fixture QA ACTIVO/admin no protegido.
- Runtime: `h24-dossier-runtime@nomina-h24-test-20261027.iam.gserviceaccount.com`.
- Sin emulador, custom token, mock de verifyIdToken ni actor sintetico en el ensayo real.

El preflight real obtuvo `auth/insufficient-permission` al consultar el usuario con
la identidad runtime. Se pidio autorizacion adicional y el usuario aprobo **solo**
`firebaseauth.users.get` en el proyecto H24 existente. Se creo el rol personalizado
`projects/nomina-h24-test-20261027/roles/h24FirebaseSessionVerifier` (GA), con ese unico
permiso, y se asigno al runtime. `getUser` paso despues sin elevar a Firebase Auth Admin.
No se concedieron permisos para crear, modificar, eliminar usuarios o revocar sesiones.
No se cambiaron role_permissions ni roles de Nomina, ni IAM/buckets productivos.

Deshabilitar/rehabilitar y revocar se hizo con el operador autorizado, separado del
runtime. El permiso de lectura se conserva como requisito del entorno H24 corregido.
Una futura salida a produccion debe comprobar ese permiso en su identidad runtime
con autorizacion independiente; no se consulto ni modifico produccion en esta fase.

## 3. Pruebas automatizadas

| Comprobacion | Resultado |
|---|---|
| `npm --workspace apps/api run test -- src/test/auth.test.ts` | 25/25 |
| `npm run test:api`, primera pasada sin ruta pdfinfo | 162 aprobadas, 8 omitidas por configuracion |
| `npm run test:api`, con DOSSIER_PDFINFO_PATH local existente | 170/170, 14 archivos, cero omitidas |
| `npm run test:web` | 139/139, 23 archivos |
| `npm run typecheck` | OK API/web |
| `npm run build` | OK API/web; no publicacion |

Las pruebas nuevas usan Fastify inject y mocks explicitos de Firebase/DB: verifican
el segundo argumento true, orden anterior a BD, rechazo en los cuatro guards,
revocacion, disabled, usuario eliminado, expiracion, token invalido, IAM insuficiente,
fallo interno/red, ausencia de datos sensibles en logs, sin cache, nuevo token,
correo/dominio, UID/estado local, permisos y alcance conservados. No sustituyen
las pruebas reales de la seccion siguiente.

No se ejecuto test:db:prepare/reset ni la suite general de integracion que recrea
fixtures. Se uso la API HTTP real y la BD test existente para AUTH-01 sin resetearla.

## 4. Ensayo real Firebase / API / PostgreSQL

Se guardaron manifiesto de la fila QA y fingerprints de todas las tablas antes
del ensayo. Evidencia privada fuera del repositorio:
`%LOCALAPPDATA%/NominaDocente/H24-PD05-20261027/auth01-20261028`.
No se versionan tokens, credenciales, dumps, IDs privados ni respuestas con datos.
Se conserva el respaldo local del ensayo anterior; esta fase no altera roles,
identidad local ni datos de negocio, salvo last_login_at del login existente.

Mismo ID token Google real previo a la accion para cada negativo; no JWT modificado.
Se consultaron `/auth/session`, `/api/auth/session` y el dossier del docente sintetico.

| Caso | Sesion | Sesion /api | Dossier | Contraste runtime SDK |
|---|---:|---:|---:|---|
| Sesion valida inicial | 200 | 200 | 200 | Verificacion estricta valida |
| Usuario Firebase deshabilitado | 401 | 401 | 401 | auth/user-disabled |
| Firebase rehabilitado antes de revocar | 200 | No repetido | No repetido | disabled=false |
| Refresh tokens revocados, token anterior | 401 | 401 | 401 | auth/id-token-revoked |
| Nuevo login posterior en Brave invitado | 200 | 200 | 200 | Verificacion estricta valida |

En los negativos, cuerpo `INVALID_TOKEN` y last_login_at sin cambios antes/despues:
no se llego al lookup/actualizacion local. Firebase disabled se restituye en finally.
Revocar refresh tokens no es reversible; se requiere login nuevo, no renovar el token
antiguo como atajo. Solo se revoco la identidad Firebase H24, no Google/Workspace.
Brave volvio a `/login` tras recargar con la sesion revocada.

Observaciones del arnes: el primer pase rechazo correctamente por API al usuario
disabled, pero el contraste auxiliar fallo `app/no-app` por inicializacion de app
nombrada. Se rehabilito en finally. Se separaron instancias operator/runtime en el
arnes ignorado y se repitio toda la secuencia con resultado correcto. No se atribuye
ese fallo a la API ni se oculta como prueba aprobada. La primera renovacion CLI
sin navegador termino EOF; se completo acceso interactivo en Brave sin compartir codigos.

Al solicitar el segundo login, el usuario reporto cierre completo de Brave. Se
observaron archivos Crashpad locales con fechas 2026-10-28 08:26 y 08:38 (America/Cancun),
sin leer ni subir sus contenidos. No aparecieron eventos Application 1000/1001
correspondientes en la ventana revisada y la API no registro un login nuevo en
ese intento. No se establece causa raiz ni se atribuye al fix backend. Se propuso
al usuario un intento manual en ventana de invitado, sin extensiones ni cambios
de seguridad/perfil habitual, para separar la recuperacion de sesion de este incidente.
El usuario confirmo acceso correcto en invitado; el arnes verifico el token nuevo
con checkRevoked=true y las tres rutas devolvieron 200. No se controlo esa ventana.
Esto acredita recuperacion Firebase/API, no identifica ni corrige la causa del
cierre de Brave en su perfil habitual. No hubo cambios frontend para evitarlo.

## 5. Limites y riesgos de release

- Consulta extra a Firebase Auth por autenticacion: dependencia de red, latencia,
  cuota e IAM. Si no se puede verificar, acceso denegado, nunca aceptacion silenciosa.
- Control en la siguiente solicitud autenticada; no cancela retroactivamente una
  solicitud ya autorizada ni borra PDF descargados/datos previamente visibles.
- No introduce push de logout al navegador ni cambia H15. Se comprobo rechazo API
  y retorno a login al recargar; no prometer desaparicion instantanea de toda UI.
- Alcance compartido de authenticate: requiere el predeploy/smoke del artefacto final,
  incluida identidad runtime, antes de publicar; no ejecutar deploy solo por cerrar AUTH-01.
- Seguimiento PD-05 2026-10-28: cierre/reapertura de Brave Invitado sin restauracion,
  F5/logout y H15 con tiempo abreviado autorizado 90/120 s aprobados por usuario.
  No se esperaron 60 minutos reales. Cuentas independientes e identidades especiales
  siguen pendientes por decision humana; ver `H24_PD05_Resultado_Persistencia_Inactividad.md`.
- PD-03/04/06/07/08 y reorganizacion UX de campos fiscales no se implementan aqui.

## 6. Confirmaciones

Sin produccion, Cloud SQL productivo, deploy, migraciones, seeds, cambios H01,
dependencias o npm audit fix. Sin escrituras de docentes, fiscales, permisos,
Nomina, corridas o snapshots. Cambios Firebase e IAM exclusivamente H24 aprobados.
Comparacion posterior de fingerprints: solo cambia app_users, exclusivamente
last_login_at de la identidad QA; rol, estado, UID, email y demas campos identicos.
Otros usuarios, teachers, role_permissions, auditoria, documentos, operaciones,
Nomina, corridas y snapshots sin cambios. Firebase disabled=false comprobado.
API sin token: 401. Tras el nuevo login se repitio la comparacion con igual resultado.
Se detuvo exclusivamente el servidor de captura del ensayo, se elimino el token
privado y se inicio la API corregida sin captura (PID 15236). Frontend existente
5184 y BD test se conservaron; la ventana de invitado queda bajo control del usuario.
QA permanece ACTIVO/admin, identico al inicio y a la autorizacion previa de revision;
no se desactiva H15 ni se garantiza sesion indefinida. Credencial runtime H24 privada
se mantiene solo para esos servicios locales. Al terminar revision: logout, limpieza
de credencial temporal y restitucion del fixture segun el plan PD-05.

Validacion Git: git diff --check OK; archivos nuevos comprobados sin errores de
whitespace. Solo auth.ts, su prueba y documentacion; sin SQL, lockfiles ni frontend.
Sin commit/push automaticos. H24 sigue NO-GO hasta cerrar los otros gates y aprobar
un release independiente; no afirmar AUTH-01 corregido en produccion.
