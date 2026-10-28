# H24 PD-05 - Persistencia, logout e inactividad

Fecha: 2026-10-28 (America/Cancun; marcas de evidencia indicadas en UTC).
Base versionada: `ac1a0c8 fix(h24): harden reconciliation worker and validate PD-04`.
Rama: `feature/h02-h03-user-coordinations-permissions`; limpia al iniciar.

**Resultado: pruebas de sesion con la cuenta autorizada satisfactorias, con
inactividad abreviada aprobada. PD-05 permanece parcial por casos de identidades
complementarias no ejecutados. H24 sigue NO-GO; sin produccion ni deploy.**

## 1. Autorizacion y ambiente

El usuario autorizo continuar PD-05 exclusivamente en H24 y eligio expresamente
tiempo abreviado local, documentando la limitacion. Posteriormente confirmo los
resultados manuales y decidio **mantener pendientes los casos que requieren otras
identidades/proyectos**, sin crear recursos ni aceptar implicitamente esos riesgos.

- Firebase real: `nomina-h24-test-20261027`, Google Sign-In existente.
- BD: `nomina_docente_test`, `127.0.0.1:55440`; guard por SELECT al inicio/final.
- Identidad institucional QA previamente autorizada; Admin ACTIVO local, no protegido.
- Navegador: Brave, operacion manual del usuario; cierre/reapertura en Invitado.
- Instancia temporal: web `http://localhost:5185`, API `http://127.0.0.1:8085`.
- Instancia ordinaria de revision conservada: web 5184 / API 8084.
- Sin emulador de autenticacion, sin JWT fabricados ni captura de tokens/cookies.

La API temporal bloqueo POST/PUT/PATCH/DELETE con 403 para este ensayo de sesion.
GET /auth/session conserva su escritura habitual de last_login_at; no se presenta
la fase como ausencia absoluta de escrituras en test.

## 2. Metodo de tiempo abreviado

Un plugin Vite local ignorado por Git transformo en memoria exclusivamente las
constantes de `useIdleTimeout.ts` para esta instancia:

| Valor | Codigo versionado / instancia 5184 | Instancia temporal 5185 |
|---|---:|---:|
| Inactividad total | 60 minutos | 120 segundos |
| Aviso previo | 5 minutos | 30 segundos |
| Aparicion del aviso | minuto 55 | segundo 90 |

No se editaron fuentes versionadas, configuracion productiva ni H15. Se comprobo
que el modulo servido por Vite contenia 120000/30000 ms. El texto del modal siguio
diciendo "5 minutos": el usuario fue informado de esta diferencia del arnes.
La prueba real de 60 minutos no se ejecuto; no se presenta el ensayo abreviado como
equivalente a una espera real de una hora o a una validacion con navegador suspendido.

Un observador local registro solo estados UI permitidos (login/protegido, modal,
presencia del aviso de datos no guardados y tiempos) y la API registro estados HTTP.
No se guardaron HAR, encabezados Authorization, contenido de documentos ni datos de
docentes. Los registros privados no se incluyen en Git.

## 3. Resultados

| Caso | Resultado | Fuente de evidencia |
|---|---|---|
| Login Firebase H24 | Aprobado | Sesion real, API 200 y menu protegido |
| F5 en la misma sesion | Aprobado | Confirmacion del usuario y recarga seguida de API 200 sin retorno a login |
| Aviso previo y contador | Aprobado en tiempo abreviado | Confirmacion del usuario y observador UI |
| Texto sobre datos no guardados | Presente | Observador detecto el texto del modal; tambien cubierto por pruebas H15 |
| Continuar sesion | Aprobado por usuario | El usuario confirmo desaparicion del aviso y navegacion conservada |
| Nuevo periodo de inactividad | Aprobado en tiempo abreviado | Aviso reaparece y se produce logout al vencer el nuevo plazo |
| Cierre automatico /login | Aprobado en tiempo abreviado | Confirmacion del usuario y transicion UI a login |
| Logout manual del menu | Aprobado | Confirmacion del usuario y transicion a login antes del plazo |
| Cierre/reapertura sin restauracion | Aprobado en Brave Invitado | Usuario cerro ventanas Invitado de prueba sin logout; nueva ventana solicito login |

La telemetria de desaparicion del modal no distingue por si sola un click en
Continuar de otra actividad que reinicie el temporizador. La aprobacion especifica
del boton se sustenta en la confirmacion manual, no en una inferencia del registro.
El cierre de Invitado descarta su contexto; no acredita comportamiento de restauracion
de pestanas del perfil habitual, que no se modifico ni controlo.

## 4. Cronologia y observaciones

Marcas UTC del 2026-10-28:

- 17:20:06: menu protegido; 17:21:36: aviso; 17:22:06: login automatico.
- 17:30:00: segundo aviso; 17:30:06: desaparece por actividad.
- 17:31:45: aviso posterior; 17:32:15: cierre automatico, alrededor de 120 s
  desde la ultima actividad registrada.
- 17:36:05: recarga de pagina, API 200 y menu conservado.
- 17:36:18: logout manual a login; confirmado por el usuario.
- 17:37:09: nueva carga en login tras cerrar/reabrir Invitado; confirmado por usuario.

La observacion inicial "pasaron dos minutos y no aparece" ocurrio en 5184, segun
confirmacion posterior del usuario. Esa instancia conserva 60 minutos. Al usar
5185 aparecieron aviso y contador; no se identifico un defecto del temporizador
a partir de aquella observacion inicial.

La herramienta de inspeccion automatica de Brave se detuvo al no poder determinar
la URL con confianza. No se insistio ni se automatizaron dialogos Google. Los
resultados de navegador se basan en acciones del usuario y evidencia local saneada.

## 5. Regresion automatizada

| Comando | Resultado |
|---|---|
| npm --workspace apps/web run test -- src/test/session-timeout.test.ts | 9/9 |
| npm --workspace apps/api run test -- src/test/auth.test.ts src/test/dossier-policy.test.ts | 36/36 |
| git diff --check | OK |

H15 cubre los tiempos originales 55/60 minutos con reloj simulado, texto, actividad,
continuar, logout y cierre. Auth/policy usa mocks para negativos de correo/dominio;
no equivale a sesiones reales con esas identidades. La evidencia real de revocacion,
deshabilitacion y nuevo login corresponde al acta AUTH-01 previamente aprobada.
No se ejecuto reset, integracion destructiva, build o migraciones en esta continuacion
documental; el arnes local no se distribuye como cambio de producto.

## 6. Integridad y cierre del entorno temporal

Comparacion final 17:37:59 UTC: solo cambio `app_users.last_login_at` de QA.
Email, UID, rol, estado, flags y otros usuarios identicos. teachers, permisos,
documentos, operaciones, datos fiscales, auditoria, Nomina, corridas y snapshots
sin diferencias de fingerprints. Firebase QA permanece habilitado.

No hubo rotacion de roles/estado, revocacion nueva, edicion de telefono ni cargas,
reemplazos/borrados en este ensayo. Por tanto no habia campos temporales que
restituir; last_login_at se conserva como evidencia legitima de acceso.
QA permanece ACTIVO/Admin conforme a la autorizacion previa de revision.

Los procesos propios de API 8085 y web 5185 se identificaron por PID/comando y
se detuvieron al terminar. Se verifico ausencia de listeners en ambos puertos.
API 8084 y web 5184 continuaron con HTTP 200; no se cerraron ventanas ajenas.
La credencial local H24 compartida con revision no se elimino ni se revoco.
Evidencia privada: `%LOCALAPPDATA%/NominaDocente/H24-PD05-20261027/sessions-20261028/`.
Sin cambios productivos, IAM, dependencias, codigo funcional, SQL, H01 o deploy.

## 7. Pendientes expresamente conservados

Decision humana: mantener pendientes y documentar lo validado, sin crear recursos.

| Caso | Recurso necesario | Estado |
|---|---|---|
| Cambio entre cuentas independientes | Segunda cuenta Google autorizada por su titular | No ejecutado |
| Dominio incorrecto con identidad real | Cuenta autorizada de dominio externo | No ejecutado; guarda cubierta unitariamente |
| Correo no verificado real | Identidad/proveedor de prueba aprobado por separado | No ejecutado; guarda cubierta unitariamente |
| Token valido de otro proyecto | Segundo Firebase de prueba expresamente autorizado | No ejecutado; no usar token productivo ni JWT editado como sustituto |

No se solicitan cuatro cuentas por rol: la matriz secuencial ya validada se conserva.
Tampoco se crea automaticamente otro proyecto/proveedor. Una eventual aceptacion
formal de cobertura limitada requeriria decision expresa distinta; no fue concedida.

## 8. Estado final

PD-05: **avance satisfactorio, parcial por identidades complementarias pendientes**.
Persistencia/logout/inactividad abreviada aprobados dentro del alcance descrito.
AUTH-01 cerrado tecnicamente local/H24; runtime productivo no probado en esta fase.
PD-04 conserva job/scheduler cloud y entrega externa de alertas pendientes, segun
[su acta](H24_PD04_Validacion_Worker_Recuperacion_Alertas.md). H24 sigue NO-GO.
Sin commit ni push automaticos en esta continuacion.
