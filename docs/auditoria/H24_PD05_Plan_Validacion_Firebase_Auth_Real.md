# H24-PD-05 - Plan de validacion Firebase Auth real y sesiones por rol

Fecha: 2026-10-27. Base revisada: `a9733d6`.
Rama: `feature/h02-h03-user-coordinations-permissions`, limpia al iniciar.
Estado: **preparado; pendiente de autorizacion, provisionamiento y ejecucion**.
PD-05 y AUTH-01 abiertos. H24 mantiene NO-GO. No hay smoke real aprobado en esta fase.

## 1. Objetivo y alcance actual

Preparar login Google real en Brave, Firebase Auth de prueba, API local y sesiones
autorizadas por rol, conservando PostgreSQL saneado y GCS aislado de PD-02.
No sustituir verifyIdToken, inyectar SessionUser, usar test-actor, emulador o custom
tokens como evidencia equivalente al login normal Google de la aplicacion.

Esta preparacion solo lee codigo/documentos locales y documentacion oficial publica.
No consulta consolas privadas ni recursos cloud, no crea usuarios, no abre servicios,
no modifica BD, IAM, Firebase, codigo, SQL, variables o credenciales. No incluye
migraciones, dependencias, tests de integracion con reset, deploy, commit o push.
El estado de recursos se toma del acta PD-02; debe verificarse antes de ejecutar.

## 2. Entorno propuesto y evidencia previa

| Recurso | Destino permitido |
|---|---|
| GCP/Firebase propuesto | nomina-h24-test-20261027, numero 234692275301 |
| Facturacion | Cuenta ya autorizada, terminada en 35CA7B; no cambiar vinculacion |
| Firebase/Auth/Web App | Habilitacion y existencia pendientes de verificar; un proyecto GCP no demuestra que Firebase Auth este configurado |
| BD | nomina_docente_test, 127.0.0.1:55440, copia saneada existente |
| Bucket | nomina-h24-test-234692275301-dossier |
| API / frontend | Solo loopback; puertos propuestos 8080 / 5173, comprobar disponibilidad |
| Navegador | Brave con perfil exclusivo de ensayo, sin sesion productiva de Nomina |

PD-02 ya valido adaptador GCS e integracion con PostgreSQL mediante actores
sinteticos. No habia actores activos RH/Contador en ese ensayo. No se inventara
que sus sesiones reales fueron probadas. Evidencia:
[resultado PD-02](H24_PD02_Resultado_GCS_Aislado.md).

Prohibidos como destino: nomina-docente-prod, Cloud SQL productivo, buckets fiscales
reales, Hosting live, Cloud Run, usuarios/UID exportados de produccion. No restaurar
otra copia ni resetear la existente para simplificar fixtures.

## 3. Contrato real revisado

| Archivo / evidencia | Implicacion para el ensayo |
|---|---|
| apps/web/src/firebase.ts | GoogleAuthProvider; browserSessionPersistence; no login email/password en la UI |
| apps/web/src/stores/auth.ts: login, initAuth | signInWithPopup, fetchSession y logout; sesion local depende tambien de autorizacion API |
| apps/web/src/api.ts: getIdToken/request | ID token real del SDK en Authorization Bearer, no token IAM de gcloud |
| apps/api/src/auth.ts: loadTestSessionUser | Bypass solo con NODE_ENV=test; usar development sin registro de actores de test |
| apps/api/src/auth.ts: authenticate | verifyIdToken; email_verified=true; dominio permitido; app_users ACTIVO; UID compatible |
| apps/api/src/auth.ts: loadUserByEmail | Vincula firebase_uid si NULL y actualiza last_login_at; roles/permisos se consultan en BD en cada solicitud |
| database/001_initial_schema.sql: app_users | Email unico, minusculas y dominio @tecplayacar.edu.mx; UID unico; superadmin protegido no debe reciclarse |
| apps/api/src/lib/dossier-policy.ts | Admin/protegido activo o Finanzas/RH con permisos por accion; no basta login Firebase |
| apps/api/src/lib/teacher-dossier.ts: actorStillAllowed | Revalida autorizacion persistida antes de publicar objetos cargados |
| apps/web/src/config.ts; apps/api/src/config.ts | Defaults productivos: todas las variables de destino deben quedar explicitas |
| apps/api/src/server.ts | Escucha 0.0.0.0; no usar npm run dev de API sin un arranque local restringido |

Login real **no es read-only**, aunque se consulte solo GET /auth/session.
Autorizacion para BD local y alta de identidades Firebase es necesaria antes del ensayo.
No crear cuentas Google Workspace, licencias, buzones o invitaciones sin aprobacion
institucional separada. Crear un usuario Firebase no crea una cuenta Google usable
con el proveedor actual.

## 4. Autorizaciones que debe confirmar el usuario

| ID | Autorizacion requerida | Limites / datos faltantes |
|---|---|---|
| A1 | Consultar y agregar Firebase al proyecto H24 existente, si falta; registrar una Web App exclusiva; habilitar Firebase Auth y Google | Solo proyecto test; APIs/configuracion y service agents propios del alta. Sin Analytics, Firestore, Realtime Database, Functions, despliegue Hosting o bucket default adicional solicitado. Inspeccionar efectos de provisionamiento antes/despues |
| A2 | Configurar proveedor Google, contacto de soporte/consentimiento y dominio autorizado localhost | Confirmar correo institucional de soporte. Si OAuth requiere configuracion/verificacion o Workspace bloquea la app, interviene Admin; no eludir politicas ni cambiar produccion |
| A3 | Usar cuentas Google institucionales de prueba designadas por el usuario | Entregar solo correo y rol; nunca passwords/tokens. Login interactivo por sus titulares en Brave. Preferible Admin, Finanzas, RH y una cuenta negativa adicional |
| A4 | Crear/actualizar fixtures de acceso exclusivamente en nomina_docente_test y permitir escrituras normales de login | Backup previo; usuarios nuevos de QA no protegidos, mapping correo/UID/rol, estado y user_coordinations si aplica; sin reutilizar superadmin protegido ni modificar maestros reales |
| A5 | Ensayar cambios temporales de rol/estado/permisos SOLO en test | Incluye negativos, UID incompatible y permisos reducidos. role_permissions es compartido por rol: ventana exclusiva, snapshot previo, manifiesto y restitucion exacta; no cambios silenciosos que afecten otros ensayos |
| A6 | Reutilizar bucket, SA e impersonacion PD-02 y ejecutar API/web local con PDF sinteticos | Mismo limite hasta 150 MiB; carga, reemplazo, borrado y telefono sintetico mediante API; sin constancias reales ni modificar bucket fiscal |
| A7 | Gestionar solo identidades Firebase de QA para negativos y cierre | Si se aprueba: deshabilitar/rehabilitar o revocar refresh tokens de usuarios QA en test; no deshabilitar su cuenta Google/Workspace. Borrar identidades/fixtures o conservarlos requiere decision de retencion |

Recomendacion para ahorrar cuentas: cuatro cuentas institucionales de prueba,
tres positivas (Admin no protegido, Finanzas, RH) y una negativa que recorra
Coordinador, Direccion, Contador y Contabilidad en BD LOCAL, con logout/login entre
casos. Si hay menos cuentas, la rotacion secuencial debe aprobarse expresamente y
documentarse; no se presenta como concurrencia entre actores independientes.

A4/A5 no autorizan cambiar codigo de autorizacion, dominio permitido o CHECK de BD.
Si solo se dispone de cuentas Gmail/otro dominio, detener y acordar alternativa:
no vaciar ALLOWED_EMAIL_DOMAIN ni relajar constraints para hacer pasar pruebas.
El dominio puede someterse a negativo sin agregar ese usuario a la BD.

## 5. Provisionamiento futuro, sin despliegue

1. Confirmar aprobaciones, SHA, proyecto/numero, facturacion, Web App/Auth existentes
   y permisos del operador. Renovar credenciales aisladas por Brave si hace falta;
   PD-02 retiro sus ADC temporales. No sobrescribir credenciales habituales.
2. Agregar Firebase al proyecto GCP autorizado solo si no esta agregado. Registrar
   app web de pruebas, habilitar Google y configurar correo de soporte/consentimiento.
   No habilitar SMS/telefono, email/password, Identity Platform avanzado, App Check
   bypass, otros proveedores o servicios por conveniencia.
3. Autorizar localhost SOLO en Firebase test y comprobar origen/handler OAuth
   efectivamente utilizado. Para proyectos nuevos localhost no viene autorizado
   por defecto. No modificar dominios OAuth productivos ni hacer firebase init/use
   que cambie .firebaserc o firebase.json del repo.
4. Obtener la configuracion publica SDK de esa Web App (appId, apiKey, authDomain,
   projectId, messagingSenderId). No inventar valores ni copiar configuracion prod.
   API key web no es credencial de Admin; nunca incluir OAuth client_secret/ADC en VITE_*.
5. Provisionar cuentas locales aprobadas tras backup y validacion exacta de DB.
   Conservar los 21 usuarios anonimizados y sus relaciones; agregar fixtures QA con
   emails reales autorizados para login, sin convertirlos en docentes o datos fiscales.
6. Arrancar API/web restringidos, verificar health local y 401 sin sesion antes de
   abrir login. Verificar destinos de red y config efectiva sin publicar secretos.

Agregar Firebase cambia configuracion/servicios cloud de TEST; no es deploy de
aplicacion ni una operacion read-only. Google puede provisionar service agents y
configuracion propia; registrar esos efectos. Si requiere servicios/costes fuera
de este alcance, detener y pedir aprobacion.
[Firebase sobre GCP existente](https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project).
[Google Sign-In](https://firebase.google.com/docs/auth/web/google-signin).
[Dominios autorizados](https://firebase.google.com/docs/auth/faq-and-troubleshooting).

## 6. Arranque aislado y credenciales

Configurar proceso/archivo privado fuera de Git, no .env productivo. API:
NODE_ENV=development, FIREBASE_PROJECT_ID/GCP_PROJECT_ID/GOOGLE_CLOUD_PROJECT/
GCLOUD_PROJECT=nomina-h24-test-20261027, DB_NAME=nomina_docente_test,
DB_HOST=127.0.0.1, DB_PORT=55440, DB_USER=app_nomina y password local custodiado.
ALLOWED_EMAIL_DOMAIN=tecplayacar.edu.mx y CORS_ORIGINS solo del frontend local.
DOSSIER_STORAGE_MODE=gcs y DOSSIER_BUCKET al bucket PD-02. CONSTANCIAS_BUCKET a un
nombre test separado no utilizado; no probar escritura de constancia en este ensayo.
DOSSIER_PDFINFO_PATH absoluto validado y ADC impersonado de runtime H24.

Frontend: VITE_API_BASE_URL a API loopback y **todas** las variables
VITE_FIREBASE_PROJECT_ID, APP_ID, API_KEY, AUTH_DOMAIN, MESSAGING_SENDER_ID y
STORAGE_BUCKET explicitas, con prefijo VITE_FIREBASE_ completo. No heredar
storageBucket productivo aunque la UI no suba directamente a GCS. Verificar el
objeto firebaseConfig resultante antes del login.

Puertos sugeridos 8080 y 5173 no son servicios ya levantados. Recomendacion:
frontend http://localhost:5173 y API http://localhost:8080, listeners loopback;
usar otros puertos coherentes si estan ocupados. Arranque temporal ignorado que
importe buildApp() real y llame listen con host loopback; no modificar server.ts
ni exponer 0.0.0.0/LAN. Vite tambien con host explicito localhost y puerto estricto.
No tunnels, reverse proxies publicos ni Hosting.

Eliminar variables de emuladores, INSTANCE_CONNECTION_NAME y credenciales/proxies
ajenos. NODE_ENV no puede ser test; no cargar auth-test-utils ni fixtures inyectados.
ID token debe provenir de Google login en Firebase H24; audience/issuer de ese
proyecto. No decodificar y confiar en un JWT sin verificar firma.

Runtime conserva IAM GCS minimo. verifyIdToken sin chequeo de revocacion no justifica
otorgarle Firebase Auth Admin. Gestionar identidades/revocacion mediante operador
de QA autorizado, por separado. Cualquier permiso adicional se enumera y aprueba;
no Owner/Editor por conveniencia, claves de SA, secretos productivos ni tokens en chat.

## 7. Matriz de autorizacion esperada

Todos los actores deben estar ACTIVO y pasar dominio/email verificado/UID. El alcance
fiscal vigente de Admin, Finanzas y RH es global; no introducir alcance por capturador.

| Actor / permisos | Ver modulo/listado | Leer PDF | Gestionar PDF | Telefono |
|---|---|---|---|---|
| Admin no protegido | Si | Si | Si | Si |
| Admin protegido, solo si se aprueba identidad test separada | Si | Si | Si | Si |
| Finanzas/RH con fiscal.view o fiscal.manage y permisos documentales completos | Si | Si | Si | Solo fiscal.manage |
| Finanzas/RH con fiscal.view + fiscal.document.view | Si | Si | No, 403 | No, 403 |
| Finanzas/RH con fiscal.view sin permisos documentales | Si, sin documentos/bytes | No, 403 | No, 403 | No, 403 |
| Finanzas/RH con fiscal.manage sin permisos documentales | Si, sin documentos/bytes | No, 403 | No, 403 | Si |
| Finanzas/RH sin fiscal.view/manage, aunque tenga permisos documentales | No | No | No | No |
| Coordinador/Direccion/Contador/Contabilidad u otro no aprobado, no protegido | No | No | No | No |

No cambiar permisos globales de rol sin A5. Inspeccionar codigos reales y fixtures
antes de cada variante; no crear roles ficticios equivalentes que el backend no
reconoce. Para alias Contabilidad, registrar si corresponde al codigo contador;
no contar como otro rol tecnico si no existe.

## 8. Pruebas a ejecutar y evidencia exigida

Todas estan pendientes. Para cada caso registrar actor QA por alias/rol, HTTP,
resultado observable y evidencia saneada, no el token o datos personales.

1. Login Google por cada rol, GET /auth/session, menu y acceso directo a
   /expediente-fiscal. Roles excluidos: sin menu y API 403 aun manipulando URL.
2. Admin/Finanzas/RH autorizados: seleccionar varios PDF sinteticos, incluidos dos
   del mismo tipo; preview/descarga con hashes, reemplazo, metadata y borrado.
   Confirmar compatibilidad visual y estados por archivo, sin completar datos fiscales.
3. Telefono ficticio en un docente QA identificado: solo fiscal.manage/Admin;
   verificar Directorio tras recarga, conflicto 409 con version vieja, restaurar
   telefono al valor previo por API. Conservar auditoria y updated_at/updated_by
   esperados, sin fingir fingerprint teachers identico si hubo esta prueba.
4. Cubrir todos los endpoints dossier: GET expediente, POST documento, PATCH metadata,
   PUT contenido, DELETE documento, GET contenido inline/download, PATCH contacto y
   GET operacion. No basta validar un GET. Roles excluidos 403 antes de mutacion.
5. Sin token y token malformado: 401; token Google/Firebase de proyecto equivocado
   solo si existe otra identidad/proyecto no productivo autorizado. No obtener token
   productivo ni crear otro proyecto implicitamente. JWT editado prueba firma, no
   reemplaza prueba de issuer/audience con token valido de otro proyecto.
6. Correo sin registro local, app_users INACTIVO, UID incompatible: 403 controlado.
   Rol y permisos reducidos con token aun valido deben reflejarse en nueva solicitud.
   Restaurar fixture despues; nunca tocar superadmin protegido.
7. Correo no verificado y dominio incorrecto: casos negativos suplementarios cuando
   haya identidades apropiadas autorizadas. Google suele entregar email verificado;
   no fingir esa cobertura alterando JWT o habilitar otro proveedor sin aprobacion.
8. Permiso revocado durante una carga controlada: revalidacion persistida evita
   publicar; limpiar objetos/intenciones por protocolo. No cambiar la identidad
   Google ni tokens ajenos. Si no se logra controlar la ventana, documentar pendiente.
9. Documento de docente A solicitado bajo B, revision obsoleta y operacion ajena:
   rechazo controlado sin bytes o mutaciones. No confundir acceso global legitimo a
   A y B con IDOR; tampoco imponer propiedad por creador donde no existe esa regla.
10. Refresh conserva sesion de navegador; logout limpia UI y vuelve a login;
    cierre/reapertura sin restauracion de sesion requiere login. Probar cambio de
    cuenta y recarga de permisos. Persistencia no equivale a revocar tokens emitidos.
11. H15: modal y cierre por inactividad; reloj real preferido. Si se acelera con
    herramienta local, registrar metodo/limitacion; no cambiar constantes productivas.
12. Comparar inventarios GCS y fingerprints locales antes/despues; cero objetos de
    prueba recuperables y cero operaciones pendientes. Solo cambios de fixtures,
    timestamps/UID de login, expediente/auditoria y telefono QA autorizado; Nomina,
    snapshots, fiscales y tablas no autorizadas intactos.

No capturar HAR o traces con Authorization/cookies. Logs locales restringidos y
saneados antes de compartir: auth.ts imprime diagnostico de error; no asumir que
todos los errores SDK son seguros. PDF/Blob o descargas ya recibidos no se pueden
revocar retroactivamente; el rechazo se mide en nuevas solicitudes autenticadas.

## 9. AUTH-01: separacion de sesion y revocacion

Codigo vigente: verifyIdToken(token), sin checkRevoked=true. Permite verificar firma,
expiracion y proyecto, pero no demuestra revocacion inmediata de un ID token ya
emitido al deshabilitar/revocar solo en Firebase. Inactivar app_users es distinto:
se consulta en cada nueva solicitud. Logout del navegador tampoco invalida por si
solo un token ya emitido. [Firebase verifica tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
y [gestiona revocacion](https://firebase.google.com/docs/auth/admin/manage-sessions).

Con A7, registrar resultado observado de deshabilitacion/revocacion Firebase test
sin convertir aceptacion de un token aun vigente en aprobacion de ese control.
Si falta autorizacion o identidad adecuada, dejar caso pendiente. No corregir auth
compartido ni habilitar chequeo de revocacion silenciosamente en este ensayo.
Seguridad debe decidir una correccion separada o aceptar formalmente el riesgo;
PD-05 no cierra AUTH-01 ni autoriza release automaticamente.

## 10. Cierre, limpieza y condiciones de detencion

Detener antes del login ante destino/config productivos, ADC de identidad no
autorizada, DB distinta de nomina_docente_test, esquema incompleto, bucket inseguro,
fixture inexistente o necesidad de ampliar permisos/servicios. No usar produccion
para resolver errores, abrir CORS indiscriminadamente o bajar restricciones Brave
globales. Si Workspace requiere consentimiento de administrador, solicitarlo.

Tras el ensayo: logout, cerrar procesos locales propios, borrar solo objetos del
manifiesto, purgar credenciales temporales y preservar evidencias sin tokens.
Restituir roles/permisos/estados segun snapshot de fixtures; no borrar auditoria ni
restaurar toda la BD para ocultar escrituras. Conservar o retirar usuarios Firebase
QA y recursos segun decision A7, no borrar cuentas Google institucionales.
Backup local no sustituye plan de limpieza granular; no ejecutar test:db:prepare.

PD-05 solo se marcara aprobado con login real, matriz por accion, sesiones y
limpieza demostrados. Casos no ejecutados se marcan pendientes, no equivalentes a
pruebas automatizadas previas. Resultados futuros en un acta distinta; documentar
AUTH-01 y demas dependencias expresamente. H24 sigue NO-GO mientras falten gates.

## 11. Resultado de esta preparacion

- Plan y autorizaciones definidos, sin pruebas Firebase reales ejecutadas.
- Documentos de seguimiento enlazados; PD-01/02 conservan su cierre local/test.
- git diff --check, git diff --name-only y git status; no tests/build por ser Markdown.
- Sin cambios de codigo, SQL, BD, cuentas, IAM, recursos cloud, migraciones,
  dependencias, produccion o deploy. Sin commit/push automaticos.
