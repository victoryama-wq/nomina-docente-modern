# H24-PD-05 - Validacion complementaria de autenticacion y sesiones

Fecha: 2026-10-27 (America/Cancun). Base: `36aa68e`.
Estado: pruebas adicionales autorizadas ejecutadas; **AUTH-01 confirmado**.
PD-05 no cerrado como aprobado. H24 conserva NO-GO para deploy.

## 1. Autorizacion y destinos

El usuario aprobo tres ampliaciones: permisos compartidos reducidos de Finanzas/RH
solo en test; cambios temporales de email/UID del fixture QA; deshabilitacion,
rehabilitacion y revocacion de sesiones de su identidad exclusivamente en Firebase
H24. Tambien solicito dejar abierta la sesion local para revisar el expediente.

- BD: `nomina_docente_test`, `127.0.0.1:55440`, identidad comprobada por SQL.
- Auth: `nomina-h24-test-20261027`, UID local comprobado contra Firebase.
- Storage: `nomina-h24-test-234692275301-dossier`, solo PDF sinteticos.
- API: loopback `8084`; frontend: `http://localhost:5184`; Brave.
- Identidad: una cuenta institucional autorizada, fixture H24 QA Sesiones,
  Admin no protegido; rotacion secuencial, no cuentas concurrentes.

No se uso produccion, emulador, custom token, test-actor ni sustitucion de
verifyIdToken. Las solicitudes usaron ID token de login Google real en H24.
No se modifico IAM ni la cuenta Google/Workspace. El operador gestiono Firebase
por separado del runtime GCS minimo; no se amplio IAM de la API.

## 2. Respaldo y metodo

Backup local `pre-continuation.dump`: 1,275,195 bytes, pg_dump custom.
SHA-256: `b5374e7e7c0c2d86b1dfae068502863e21db7119759d1060b380f191cd072a64`.
Manifiesto previo de usuario, role_permissions y fingerprints de las 26 tablas,
guardado fuera de Git con las evidencias privadas del ensayo.
Ubicacion: `%LOCALAPPDATA%/NominaDocente/H24-PD05-20261027/continuation-20261027`.
No se publico dump, credenciales ni tokens.

Arneses temporales ignorados por Git ejecutaron la API real. Los cambios de
role_permissions se limitaron a permisos fiscal.* de Finanzas/RH, con restitucion
en finally y comparacion exacta de toda la tabla al terminar. No se reseteo la BD.
La prueba de retiro durante carga pausa el cuerpo HTTP tras autenticar onRequest;
no intercepta la autorizacion ni reemplaza el adaptador GCS o el parser.

## 3. Identidad local

| Caso con token real vigente | Resultado |
|---|---|
| Email de sesion sin fila local coincidente | 403 USER_NOT_ALLOWED |
| UID de la fila local distinto al token | 403 USER_NOT_ALLOWED |
| Email y UID restituidos | /auth/session 200 |

Solo se altero la fila QA local. No se crearon buzones, usuarios extra ni docentes.

## 4. Permisos reducidos

Cinco variantes para cada rol Finanzas/RH: **10 variantes completas satisfactorias**.
Se comprobaron listado/capacidades, PDF inline/descarga, consulta de operacion,
POST/PUT/PATCH/DELETE y contacto. Bytes de lectura autorizada con SHA identico.

| Permisos fiscales del ensayo | Listado | PDF | Gestion documental | Telefono |
|---|---|---|---|---|
| fiscal.view + fiscal.document.view | 200 | 200 | 403 | 403 |
| fiscal.view | 200, sin documentos | 403 | 403 | 403 |
| fiscal.manage | 200, sin documentos | 403 | 403 | 200 y restitucion |
| fiscal.document.manage, sin acceso fiscal | 403 | 403 | 403 | 403 |
| fiscal.view + fiscal.document.manage | 200 | 200 | Permitida; metadata valida 200 | 403 |

Con permisos de gestion, los payloads vacios de POST/PUT recibieron 415 por MIME,
y PATCH/DELETE 400 por contrato. No se presentan como cargas positivas validas.
Metadata real si completo con 200; las cargas y borrados positivos completos ya
se probaron en el acta inicial y para crear/limpiar el documento de este ensayo.

Retiro de fiscal.document.manage durante una carga real: HTTP 200 del protocolo,
operacion **FAILED / AUTHORIZATION_REVOKED**, sin documento publicado. El objeto
GCS se elimino y la intencion quedo terminal; no confundir HTTP 200 con carga exitosa.

## 5. AUTH-01 confirmado

Se uso el mismo ID token real emitido antes de cada cambio en Firebase H24:

| Cambio Firebase | API vigente /auth/session | Verificador SDK con checkRevoked=true | Control inmediato |
|---|---|---|---|
| Usuario deshabilitado | 200 | auth/user-disabled | No satisfecho |
| Refresh tokens revocados | 200 | auth/id-token-revoked | No satisfecho |

Causa comprobada en `apps/api/src/auth.ts`: usa verifyIdToken(token), sin chequeo
de revocacion. Se mantienen comprobaciones de firma/proyecto/expiracion y de
app_users activo; estas no equivalen a consultar deshabilitacion/revocacion Firebase.
No se cambio codigo para ocultar el resultado ni se interpreta como aprobacion.
La comprobacion estricta solo fue un contraste del arnes, no la API desplegada.

El usuario Firebase quedo habilitado como antes. Revocar sesiones no es reversible:
se hizo logout visible y el usuario inicio otra sesion. El nuevo token paso
verifyIdToken(token, true) y /auth/session devolvio 200. No se revoco Google/Workspace.

Se requiere decision humana: correccion tecnica separada de AUTH-01 o aceptacion
formal del riesgo residual. Esta ejecucion no implementa ni autoriza una correccion
de autenticacion compartida y no permite declarar H24 listo para deploy.

## 6. Sesion y observaciones de ejecucion

El login lanzado por automatizacion termino dos veces con auth/popup-closed-by-user;
no se demostro causa raiz. El usuario accedio desde otra ventana local y se valido
el token por API. No se relajaron protecciones del navegador ni proveedores Auth.
Despues de revocar, Brave se reconecto con identificadores nuevos; se recupero la
pestana local y se comprobo el nuevo login. No se atribuye ese reinicio a una causa
no demostrada ni se cuenta como prueba controlada de cierre sin restauracion.

Un primer pase del arnes de permisos esperaba 400 para payload vacio de archivo y
recibio el 415 correcto por MIME. Se restituyo acceso y se limpio el documento;
se corrigio solo la asercion temporal, luego las diez variantes pasaron (exit 0).
El primer lookup administrativo Firebase fallo SERVICE_DISABLED por atribucion de
cuota; se explicito el proyecto de cuota H24 solo en el proceso del operador.
No se habilito otro servicio ni se modifico IAM para resolverlo.

H15 unitario repetido en la preparacion: 9/9, reloj simulado; politica dossier 11/11.
No se esperaron 60 minutos reales ni se simulo que ese ensayo ya paso. Permanecen
pendientes cambio entre cuentas independientes, cierre sin restauracion, correo
no verificado/dominio incorrecto y token valido de otro proyecto de prueba autorizado.

## 7. Restitucion e integridad

Antes de entregar la sesion para revision:
- role_permissions completo identico al respaldo, incluidos permisos no fiscales.
- Email, UID, rol y flag protegido QA restituidos; otros usuarios identicos.
- Estado QA restituido a INACTIVO al cerrar ensayos y reactivado expresamente como
  Admin para la revision solicitada. **Excepcion intencional: queda ACTIVO local**.
- Telefono original restituido; campos de teachers distintos de phone/updated_at/
  updated_by con hash identico, incluidos fiscales, creador, coordinacion y estatus.
- Nomina, corridas, snapshots, roles, migraciones y tablas no autorizadas identicos.
- Solo variaron app_users, teachers, audit_log y teacher_dossier_operations.
- 13 operaciones nuevas: 12 COMPLETE (2 UPLOAD, 2 DELETE, 2 METADATA, 6 CONTACT)
  y 1 UPLOAD FAILED por retirada de autorizacion, resultado esperado.
- Cero documentos y cero operaciones PREPARED/CLEANUP/ABORTING al entregar.
- Inventario GCS de objetos y versiones vacio; UBLA=true, PAP=enforced,
  versionado=false, soft-delete=0. No se borraron auditoria ni intenciones terminales.

La revocacion Firebase permanece como evidencia temporal y no se intenta revertir.
Firebase disabled=false comprobado y nuevo login valido. Se elimino el token local
capturado y se sustituyo el arranque temporal por otro sin captura de tokens.

## 8. Sesion abierta y observacion UX

Por solicitud expresa, se conservan API `127.0.0.1:8084` (PID 19780) y frontend
`127.0.0.1:5184` (PID 23836), credencial runtime H24 privada necesaria para GCS,
y pestana Brave en el expediente sintetico. No se prolonga ni desactiva H15:
la sesion puede expirar normalmente por inactividad. No cerrar ventanas ajenas.
Al terminar la revision: logout, restituir QA a INACTIVO, detener solo esos procesos
previa comprobacion de identidad y retirar ADC temporal; preservar backup/auditoria.

Solicitud UX registrada, **no implementada en este ensayo**:
- Integrar en el expediente RFC, correo, tipo de pago y banco/cuenta/CLABE actuales,
  junto con telefono y documentos adicionales.
- Dejar la accion Constancia dedicada al archivo, conservando preview/descarga.
- Reutilizar campos, endpoints, permisos y validaciones fiscales existentes;
  no duplicar datos ni ampliar acceso por disponer de permiso documental.
- Mantener la sincronizacion del telefono con Directorio y distinguir permisos
  fiscal.manage de fiscal.document.manage al reorganizar controles.

Se confirmo por codigo y UI que hoy TeacherDossierPanel ofrece telefono/documentos;
los demas campos siguen en la ventana Actualizacion fiscal de FiscalRecordsView.
La nueva organizacion debe especificarse y probarse por separado de PD-05.

## 9. Confirmaciones

Sin produccion, deploy, migraciones, cambios de codigo funcional/dependencias,
H01, Nomina ni snapshots. Sin escrituras fiscales. Cambios temporales solo en test
y en la identidad Firebase H24 autorizada; evidencia y auditoria conservadas.
git diff --check y revision de archivos documentales. Sin commit/push automaticos.
