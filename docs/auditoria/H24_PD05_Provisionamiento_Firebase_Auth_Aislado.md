# H24-PD-05 - Firebase Auth aislado habilitado

Fecha: 2026-10-27. Base de codigo/documentacion: `a5393bd`.
Estado: infraestructura Auth de prueba configurada; sesiones por rol pendientes.
**PD-05 abierto. H24 NO-GO para deploy.**

## 1. Autorizacion y alcance

El usuario autorizo habilitar Firebase Auth y Google Sign-In exclusivamente en
`nomina-h24-test-20261027`. Confirmo `victor.yama@tecplayacar.edu.mx` como soporte
y el guardado del proveedor Google con su cliente OAuth de prueba asociado.
No se interpreta como autorizacion de usuarios Google Workspace, escrituras BD,
mutaciones de fixtures, nuevas pruebas GCS, revocaciones o deploy productivo.

## 2. Resultado comprobado

| Concepto | Resultado |
|---|---|
| Proyecto | nomina-h24-test-20261027, numero 234692275301, ACTIVE |
| Firebase | Agregado al proyecto GCP existente, operacion finalizada sin error |
| Auth | Config projects/234692275301/config, subtype FIREBASE_AUTH |
| Proveedor Google | google.com enabled=true; cliente OAuth configurado |
| Nombre publico | Nomina H24 - Pruebas aisladas |
| Soporte | victor.yama@tecplayacar.edu.mx, aprobado por usuario |
| Dominios autorizados observados | localhost, nomina-h24-test-20261027.firebaseapp.com, nomina-h24-test-20261027.web.app |
| Web App | H24 PD05 local web, ACTIVE |
| App ID | 1:234692275301:web:6da2148e2f6cc0dae32a8c |
| Email/password, telefono, anonimo | No habilitados |
| Identity Platform avanzado | No se solicito upgrade; subtipo FIREBASE_AUTH confirmado |
| Usuarios Firebase | 0; listado vacio sin siguiente pagina |
| Bucket existente | Solo nomina-h24-test-234692275301-dossier en listado del proyecto |
| Claves de usuario de SA Firebase Admin | 0; no se descargo clave privada |

Operaciones Firebase Management completadas:
- addFirebase: `operations/workflows/NWQzYjY5N2YtOWM1MS00YzQ4LTkwMmEtZTZhMDZmZTRmYTU3`.
- webApps.create: `operations/workflows/M2MxM2NmODctOGU1MC00ZjYzLWFmNjEtY2U0NTAxY2FlYjg4`.

Se habilitaron explicitamente firebase.googleapis.com e identitytoolkit.googleapis.com.
El alta Firebase habilito servicios auxiliares: appengine, cloudresourcemanager,
fcm, firebasehosting, firebaseinstallations, firebaseremoteconfig,
firebaseremoteconfigrealtime, firebaserules, pubsub, runtimeconfig, securetoken y
testing (dominio googleapis.com). API habilitada no significa aplicacion desplegada.
No se solicito Analytics, base Firestore/Realtime Database, Functions, bucket nuevo,
Hosting deploy o Cloud Run. No se modifico la vinculacion de facturacion.

IAM final muestra los agentes automaticos Firebase Management y Firebase Admin SDK.
El segundo tiene roles firebase.sdkAdminServiceAgent, firebaseauth.admin y
iam.serviceAccountTokenCreator en el proyecto TEST, creados por el provisionamiento.
No se concedieron esos roles al runtime GCS H24 ni se ampliaron manualmente sus
permisos. Deben revisarse como parte del inventario de seguridad del entorno.

## 3. Evidencia y precauciones

Se uso API oficial con proyecto de cuota H24 explicito y consola Firebase en Brave.
La consola mostro Google habilitado y la API confirmo enabled=true. No se inicio
sesion en la aplicacion Nomina; acceso administrativo a consola no es smoke por rol.

Una consulta de configuracion devolvio un parametro sensible de hash de Auth en
la salida de herramienta. No se reproduce aqui ni se incorpora a archivos del repo.
La consulta posterior uso solo campos permitidos. No hay usuarios Auth ni proveedor
password habilitado; esto no justifica tratar la configuracion como publica.
Custodiar el registro de ejecucion y evaluar saneamiento/rotacion con Seguridad antes
de habilitar password o importar usuarios; no se hizo rotacion sin autorizacion.
El secreto OAuth y los tokens de acceso no se imprimieron ni guardaron en el repo.

## 4. Cuentas necesarias y preparacion

Propuesta: cuatro identidades Google institucionales @tecplayacar.edu.mx:

| Cuenta QA | Rol local | Finalidad |
|---|---|---|
| Admin QA, no superadmin protegido | admin | Acceso completo |
| Finanzas QA | finanzas | Documentos y telefono segun permisos fiscales |
| RH QA | rh | Documentos y telefono segun permisos fiscales |
| Negativos QA | coordinador, direccion, contador secuencialmente | Menu oculto y backend 403; Contabilidad segun codigo real existente |

1. El administrador institucional designa cuentas existentes exclusivamente de QA
   o crea nuevas cuentas Google Workspace mediante su procedimiento aprobado.
   No basta un alias de correo ni un usuario email/password de Firebase.
2. Cada titular comprueba su acceso Google y completa MFA si aplica. No desactivar
   protecciones ni compartir passwords, codigos o tokens con el agente.
3. El usuario entrega solo los correos y roles. No necesitan acceso IAM/GCP ni a la
   consola Firebase; son usuarios finales de la aplicacion, no administradores cloud.
4. Autorizar A4/A5 del plan: respaldo y alta/mapping de fixtures en nomina_docente_test,
   escrituras de login, rotacion de la cuenta negativa y pruebas temporales de
   estado/permisos con restitucion. No modificar la BD productiva ni resetear test.
5. Configurar API/web solo loopback y exclusivamente Firebase H24. El titular entra
   por Google en Brave; Firebase crea la identidad al primer acceso y la API valida
   app_users local. No importar usuarios/UID desde produccion.
6. Autorizar por separado A6/A7 si se ejecutaran nuevas mutaciones sinteticas GCS,
   telefono o pruebas de revocacion/deshabilitacion de identidades Firebase QA.

Una cuenta rotada puede reducir cuentas solo con aprobacion explicita y resultados
secuenciales, sin afirmar concurrencia. Preferibles cuatro para reducir errores.

## 5. Deploy: aun no autorizado

Habilitar Auth no cierra PD-05: faltan cuentas, sesiones reales, matriz por accion,
negativos, limpieza y evidencia. PD-01 y PD-02 mantienen su cierre local/test.
Ademas siguen abiertos en F4:
- PD-03: PDF malicioso/visor; estrategia probada o excepcion formal.
- PD-04: worker programado, recuperacion y alertas.
- PD-06: triage de dependencias y tratamiento de hallazgos.
- PD-07: capacidad/concurrencia sostenidas.
- PD-08: completar evidencia DBA/release/backup; PD-02 ya avanzo ensayo 016/H05 local,
  no volver a declararlo inexistente ni confundirlo con aprobacion productiva.
- AUTH-01: evaluacion de revocacion de tokens; habilitar Google no cambia verifyIdToken.

El deploy requerira cierre o excepciones formales aceptables de los controles,
regresion final, infraestructura/backup y autorizacion productiva independiente.

## 6. Confirmaciones

Sin cambios de codigo, SQL, PostgreSQL local/productivo, datos docentes, Nomina,
snapshots o H01. Sin migraciones, deploy, usuarios de prueba creados por el agente,
fixtures modificados o nuevas operaciones GCS de documentos. Si hubo provisionamiento
cloud autorizado exclusivamente en el proyecto TEST. Sin commit/push automaticos.
Validacion documental: git diff --check y git status; no tests/build por ser documentos.

Referencias oficiales:
- [Agregar Firebase a GCP existente](https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project).
- [Google Sign-In](https://firebase.google.com/docs/auth/web/google-signin).
- [Plan PD-05 y matriz completa](H24_PD05_Plan_Validacion_Firebase_Auth_Real.md).
