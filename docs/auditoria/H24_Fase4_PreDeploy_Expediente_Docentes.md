# H24-F4 - Predeploy del expediente completo de docentes

Fecha: 2026-10-27.
Commit revisado: `9a5dd27 test(h24): validate local teacher dossier integration`.
Rama: `feature/h02-h03-user-coordinations-permissions`.

**Resultado: preparacion y revision local completadas; NO-GO para deploy/habilitacion.
H24 no cerrado operativo. Los bloqueantes siguientes requieren evidencia y aprobacion.**

Seguimiento PD07-B03 2026-10-31: [mensaje de limites PDF](H24_PD07_B03_Mensaje_Limites_Analisis_PDF.md)
implementado en scanner/API/UI local, manteniendo rechazo seguro. No se aumenta
MaxFiles ni se equipara diagnostico claro con capacidad suficiente. No se ha
desplegado; siguen pendientes capacidad final, recorrido cloud/Hosting y los
restantes gates documentados. Se conserva NO-GO.

Seguimiento 2026-10-29, posterior a la evidencia siguiente:
[cloud aislado PD-03/PD-04](H24_PD03_PD04_Arquitectura_Cloud_Aislada.md).
Servicios privados y job efimero autorizados y probados con datos sinteticos;
13 comprobaciones cloud, dos ejecuciones de recuperacion exitosas (una mediante
Scheduler), inventarios GCS restituidos. Scheduler queda pausado. Recepcion email
externa aun no confirmada; aislamiento/capacidad/destino final siguen pendientes.
[PD-06 compatible](H24_PD06_Correccion_Compatible_Dependencias.md): audit pasa de
0 criticas/15 altas/12 moderadas/1 baja a 0/5/9/1, regresion local aprobada.
Posteriormente se autorizaron y validaron Zod 4.6.7, gRPC 1.14.7 y npm 10.9.4:
[regresion aislada PD-06](H24_PD06_Zod_Grpc_Regresion_Aislada.md).
Audit actual 0 criticas/0 altas/9 moderadas/1 baja; API, web, integracion efimera,
typecheck/build e imagen API Linux validados. No equivale a aceptar los hallazgos
restantes ni autorizar produccion. Se conserva NO-GO y el objetivo condicionado al sabado 31.

Triage residual 2026-10-30: [UUID/esbuild y autorizaciones pendientes](H24_PD06_Triage_Residual_UUID_Esbuild.md).
Audit online mantiene 0/0/9/1; los nueve moderados derivan de UUID, el bajo de
esbuild. Se proponen ensayo UUID 11.1.1 y actualizacion puntual tsx con regresion
efimera, o excepciones temporales explicitas si no son compatibles. No se
actualizaron paquetes ni se aceptaron riesgos; H24 sigue NO-GO.

Revision de pendientes 2026-10-30:
[preparacion PD-07/PD-08 y estado reconciliado](H24_Revision_Pendientes_PD07_PD08_20261030.md).
Se identifico un presupuesto end-to-end por validar: Hosting limita a 60 s,
frente a hasta 230 s admitidos por el cliente antivirus cloud. No es fallo
reproducido ni prueba de capacidad. Ensayo local acotado y migracion/restauracion
conjunta 016/017 propuestos; sin ejecucion ni autorizacion productiva.

Ensayos locales posteriormente autorizados y ejecutados el 2026-10-30:
[PD-07 capacidad y hallazgos](H24_PD07_Capacidad_Local_Resultados.md) y
[PD-08 H05/backup/restauracion](H24_PD08_Ensayo_Local_Migraciones_016_017.md).
PD-07 no aprobado: Base64 causa RangeError con archivos de 4/7.5 MiB; el lote
20 archivos completo 19 antes de agotamiento de PIDs del scanner de laboratorio;
500 paginas excedieron MaxFiles AV. No se corrigio codigo ni se relajaron limites.
Timeout simulado 60 s, reintento sin duplicacion, recuperacion de reemplazo,
pipeline JPG/PNG y 45 pruebas frontend aprobados en sus alcances.
PD-08 local satisfactorio: 016/017 aplicadas solo en BD efimera; 20 registradas,
pending=0/mismatch=0, backups pre/post restaurados y datos sinteticos preservados.
Compatibilidad de codigo anterior solo parcial; artefacto exacto/destino real
pendientes. Laboratorio retirado, BD habitual y produccion sin acceso/cambios.
**H24 sigue NO-GO**; corregir/diagnosticar PD07-B01/B02/B03 antes de repetir capacidad.

Correccion posterior autorizada 2026-10-30:
[PD07-B01 Base64 grande](H24_PD07_B01_Correccion_Base64_Archivos_Grandes.md).
Validacion iterativa sin agotamiento de pila, conservando limites/canonicalidad;
84/84 pruebas enfocadas Windows/Linux, API 379 aprobadas (15 opt-in omitidas),
web 158/158, typecheck/build OK. Sin BD/nube/deploy. B01 corregido localmente;
B02/B03 y capacidad end-to-end final pendientes. **H24 mantiene NO-GO**.

Seguimiento posterior autorizado PD07-B02:
[scanner con recoleccion de procesos y carga local](H24_PD07_B02_Correccion_Procesos_Scanner.md).
Tini como PID 1, sin paquetes nuevos ni mayor limite de PIDs. Carga real del
scanner 20/20 archivos, 61/61 analisis, PIDs estables y cero zombis; 6/6 pruebas
de procesos/servidor. Primer harness fallo por baseline frio; evidencia preservada
y repeticion completa aprobada. Sin BD/GCS/cloud/deploy; 429 reintentados por el
harness no equivalen a una cola API. B02 corregido localmente, B03 y repeticion
end-to-end con artefacto final pendientes. **H24 mantiene NO-GO**.

Revision posterior 2026-10-31, PD07-B03:
[MaxFiles, paginas y complejidad PDF](H24_PD07_B03_Revision_MaxFiles_ClamAV.md).
Diagnostico/propuesta probados exclusivamente con corpus sintetico en Docker;
MaxFiles=100 se reproduce y el aumento acotado no evita todos los limites de
tiempo. Wrapper operativo sin cambios, sin BD/cloud/deploy. No es cierre de
capacidad end-to-end ni aprobacion de todo PDF de 500 paginas. La aplicacion de
la propuesta y sus contratos operativos permanece separada. Matriz final:
12 comprobaciones de seguridad satisfactorias, no 12 cargas aceptadas; algunas
muestras siguen bloqueadas con 1000/2000. EICAR rechazado, cero OOM/zombis,
laboratorio retirado. No aprobar el aumento aislado como solucion. **H24 NO-GO**.

Seguimiento PD-03 (2026-10-28): [revision de seguridad PDF y vista previa](H24_PD03_Revision_Seguridad_PDF_Vista_Previa.md)
completada en codigo, sin ensayos nuevos ni cambios tecnicos. Identifica diferencia
de validacion entre constancias y PDF adicionales, falta de analisis antimalware,
aislamiento del parser no demostrado y visor nativo sin sandbox HTML acreditado.
Incluye propuesta, corpus y autorizaciones A1-A4; no implica aprobacion para
ejecutarlos. PD-03 permanece abierto y H24 NO-GO.

Seguimiento A1/A2 posteriormente autorizado (2026-10-28): [laboratorio ClamAV/EICAR](H24_PD03_Laboratorio_ClamAV_EICAR.md)
completado sin BD ni nube; deteccion del marcador, errores/limites/edad de firmas y
deadline comprobados. PDF malformado y JS inerte no detectados por antivirus:
se mantienen parser y politica como controles separados. Sin integracion API/visor;
A3/A4 estaban pendientes de autorizacion en ese laboratorio. No autorizo deploy.

Seguimiento A3 autorizado (2026-10-28): [pipeline local PDF/ClamAV](H24_PD03_A3_Controles_PDF_ClamAV_Local.md)
implementado en ambas clases de documentos, recuperacion y lectura. API/web y cinco
casos reales Docker aprobados; wrapper EICAR aprobado. Sin BD/nube. **PD-03 sigue
abierto:** al terminar A3, A4 requeria autorizacion; faltan politica completa PDF, decodificacion
acotada JPG/PNG y prueba/aceptacion del visor. Solo existe transporte Docker local;
no desplegarlo a Cloud Run. Sin configuracion H24 explicita se rechaza validacion
con 503, nunca se omite analisis. H24 permanece NO-GO.

Seguimiento A4 autorizado (2026-10-28): [integracion real API/BD test/GCS](H24_PD03_A4_Integracion_PDF_ClamAV_GCS.md)
aprobada en 16 grupos. Respaldo local, pipeline A3 real, rechazo previo, lecturas,
reemplazos, fallos/recuperacion y restitucion verificados. Las 26 tablas y ambos
inventarios regresaron exactamente al estado inicial; B manual conservada.
A4 ya no requiere autorizacion para este ensayo completado. No se valida UI/Auth
real de nuevo, ni se cierran JPG/PNG, politica PDF, visor, capacidad o cloud.
PD-03 permanece abierto, H24 NO-GO; no hubo produccion ni deploy.

Seguimiento posterior PD-03: puntos 1-3 autorizados e implementados localmente,
[decoder JPG/PNG, politica PDF y visor](H24_PD03_Implementacion_Imagenes_PDF_Visor_Local.md).
15 grupos Docker, 7 pruebas pipeline real, API/web/typecheck/build y UI sintetica
aprobados. Sin BD/nube. Requiere nueva autorizacion para repetir integracion GCS,
aceptacion residual del visor y arquitectura cloud; no cierra PD-03 ni habilita deploy.

Seguimiento 2026-10-29: punto 4 autorizado para repetir el ensayo con la politica
actual y PNG/JPEG. [Acta de integracion y restitucion](H24_PD03_Integracion_Politica_Imagenes_PDF_GCS.md).
Resultado aprobado: 19 grupos, restitucion exacta de 26 tablas e inventarios GCS.
La autorizacion pendiente del parrafo anterior describe el cierre local previo.
No habilita deploy ni acepta implicitamente los demas gates H24.

Ampliacion C.P./CURP 2026-10-28: campos fiscales opcionales implementados localmente,
sin ampliar roles ni cambiar completitud/pagos. [Acta del ajuste](H24_Ajuste_CP_CURP_Expediente.md).
017 aplicada por H05 solo en nomina_docente_test: 20 registradas, pending=0/mismatch=0.
**Actualiza el plan de salida historico de la seccion 8:** H24 ahora requiere 016 y
017, en orden; estado esperado despues del futuro release: 20 registradas. Verificar
inspect real autorizado antes de apply, sin asumir estado productivo desde test.
No se modifico/aplico 016 de nuevo. Ningun gate pendiente queda aprobado por este ajuste.

Seguimiento UX/constancia (2026-10-28): campos fiscales reunidos en Expediente;
Constancia solo gestiona archivo. Borrado fisico de la version sustituida aprobado
por el usuario e implementado localmente con recuperacion durable. Ver
[auditoria del ajuste](H24_Ajuste_Expediente_Fiscal_Constancia.md).
**Gate adicional antes de habilitar este cambio:** validar bucket aislado de
constancias (distinto del bucket de PDF adicionales), politica sin retencion,
IAM y borrado GCS real, junto con worker/alertas PD-04. No reutilizar como evidencia
de constancias el cierre PD-02 de documentos adicionales. No se cambio GCS/IAM.

Seguimiento posterior autorizado: [bucket de constancias aislado preparado](H24_Constancias_Preparacion_Prueba_GCS.md)
el 2026-10-28. Politica privada sin retencion y adaptador real (carga/lectura/borrado
fisico) verificados. Seguimiento manual: usuario cargo A y sustituyo por B;
lectura posterior confirmo A eliminado fisicamente, B unica vigente con SHA-256
correcto, cero pendientes y fingerprints de docentes/Nomina/snapshots intactos.
Seguimiento PD-04 del 2026-10-28: fallos controlados alrededor de GCS real,
recuperacion y dos ejecuciones programadas locales aprobados; restitucion completa
de test y constancia B conservada. Worker reforzado con canales independientes,
backlog/edad/FAILED y salida no exitosa ante incidentes. Ver
[acta PD-04](H24_PD04_Validacion_Worker_Recuperacion_Alertas.md).
PD-04 sigue parcial: job cloud privado, alertas externas y ensayo en runtime cloud
pendientes. No habilita produccion ni cierra el gate completo de H24.

Seguimiento tecnico autorizado (2026-10-27):
[correccion del empaquetado pdfinfo](H24_Fase4_Correccion_Parser_Pdfinfo.md).
**PD-01 cerrado localmente**: imagen API Linux construida desde `95026bf`, pdfinfo
22.12.0 y 12/12 comprobaciones en build y runtime aislado, tambien como usuario node.
PD-03 a PD-08 siguen pendientes; no se autoriza release. AUTH-01 tiene correccion
local autorizada el 2026-10-28, con evidencia especifica enlazada abajo. PD-02 obtuvo
cierre tecnico local/test en el seguimiento siguiente. Las secciones de
revision inicial y sus confirmaciones documentales se conservan como evidencia
de la preparacion F4 anterior a esta correccion.

Seguimiento PD-02 (2026-10-27):
[plan de validacion GCS aislado](H24_PD02_Plan_Validacion_GCS_Aislado.md)
preparado, con autorizaciones de proyecto/bucket, IAM temporal y borrado sintetico
pendientes al preparar el plan. Seguimiento autorizado:
[copia local saneada y proyecto de pruebas](H24_PD02_Copia_Local_Anonimizada_GCS.md).
BD test nueva en 127.0.0.1:55440; 016 aplicada por H05 local, 19 registradas,
pending=0/mismatch=0. La cuota inicial se resolvio: facturacion vinculada, bucket
privado `nomina-h24-test-234692275301-dossier` e IAM minimo creados. **PD-02 cerrado
en alcance tecnico local/test**: 21/21 comprobaciones de adaptador, 15 de API/BD
con GCS, borrado sin residuos y recuperacion tras corte de proceso. RH/Contador
sin actor local y Firebase real permanecen en PD-05; worker programado en PD-04.
Ver [resultado GCS aislado](H24_PD02_Resultado_GCS_Aislado.md). H24 sigue NO-GO.

Seguimiento PD-05 (2026-10-27):
[plan de Firebase Auth real y sesiones por rol](H24_PD05_Plan_Validacion_Firebase_Auth_Real.md)
preparado, no ejecutado. Requiere aprobar Firebase/Google en el proyecto H24,
designar cuentas institucionales QA y autorizar fixtures/escrituras de sesion
en BD local. Incluye aislamiento de configuracion, matriz por accion y limpieza.
No se han provisionado recursos Auth ni validado sesiones reales; AUTH-01 sigue abierto.

Continuacion autorizada PD-05 del mismo dia: Firebase Auth estandar, Google Sign-In
y Web App habilitados exclusivamente en el proyecto H24. Ver
[acta de provisionamiento](H24_PD05_Provisionamiento_Firebase_Auth_Aislado.md).
Esto sustituye el pendiente de provisionamiento anterior, no el de pruebas:
al provisionar habia 0 usuarios Auth, cuentas QA y sesiones por rol pendientes.
Seguimiento ejecutado: [resultado de sesiones reales](H24_PD05_Resultado_Sesiones_Reales_Por_Rol.md).
Una identidad autorizada rotada en test valido Admin/Finanzas/RH y denegaciones
Coordinador/Direccion/Contador/Contabilidad, UI/API, GCS y telefono. 72 solicitudes
negativas correctas, 36 operaciones COMPLETE, cero objetos/versiones o pendientes
residuales; rol/estado y telefono restituidos. No se modificaron permisos compartidos.
PD-05 parcialmente validado: faltan negativos complementarios, sesiones avanzadas
y tratamiento AUTH-01. H24 sigue NO-GO; no hubo produccion ni deploy.

Continuacion PD-05 autorizada: [acta complementaria](H24_PD05_Validacion_Complementaria_Auth_Sesiones.md).
Diez variantes de permisos reducidos, identidad local ausente/incompatible y retiro
durante carga validados; restitucion y GCS vacio. AUTH-01 confirmado: API acepta
token emitido antes de revocacion/deshabilitacion Firebase. No cerrar PD-05 ni
autorizar deploy sin decision de correccion/riesgo. Casos de sesiones/identidades
adicionales siguen pendientes. QA local activo y servicios abiertos solo para la
revision solicitada, no como estado productivo.

Seguimiento 2026-10-28: [correccion AUTH-01](H24_AUTH01_Correccion_Revocacion_Firebase.md).
authenticate solicita checkRevoked=true; tokens disabled/revoked reciben 401 antes
de BD en API H24 real. Se concedio exclusivamente firebaseauth.users.get al runtime
aislado, con aprobacion adicional. No se concede Firebase Auth Admin ni se cambia
IAM productivo. API 170/170, web 139/139, typecheck/build OK. Ver acta para cierre
del ensayo y casos pendientes; no equivale a cerrar PD-05 ni autorizar deploy.
AUTH-01 cerrado tecnicamente en local/H24: nuevo login real posterior 200,
integridad comprobada (solo last_login_at QA), cuenta habilitada y token temporal
eliminado. Login recuperado en Brave invitado; cierre del perfil habitual sin causa
determinada, no presentado como corregido. No hubo publicacion productiva.

Continuacion PD-05 del 2026-10-28: [acta de persistencia e inactividad](H24_PD05_Resultado_Persistencia_Inactividad.md).
Usuario aprobo F5, logout manual, cierre/reapertura Invitado, aviso/contador,
Continuar y logout automatico a login con tiempo abreviado autorizado 90/120 s.
Sin modificar H15 versionado; no se esperaron 60 minutos reales. Test H15 9/9,
auth/policy 36/36; fingerprints solo last_login_at QA. Instancia temporal detenida.
PD-05 parcial: usuario mantiene pendientes cuentas independientes, dominio externo,
correo no verificado y token valido de otro proyecto. PD-04 cloud no cerrado.

## 1. Alcance y evidencia

Arbol limpio al inicio; HEAD y tracking local de origin sin diferencias (0/0).
No se hizo fetch ni consulta remota de Git en esta fase; no se confunde tracking
local con verificacion nueva de GitHub. Commits F0 `d8efc5d`, F1 `9179051`,
F2 `9a1aafc`, F3 `9a5dd27` presentes.

Revision de SPEC/diseno H24, auditorias F1/F2/F3, H05/H13 y codigo/configuracion
versionados. No se consultaron proyectos, usuarios, buckets, Cloud SQL, secretos,
revisiones ni logs productivos. Las consultas externas se limitaron a documentacion
publica oficial y npm audit. No se crearon recursos de prueba en la nube.

F3 acredita API HTTP real, BD `nomina_docente_test`, archivos locales reales,
Brave, carga multiple, preview/descarga, reemplazo, borrado fisico, telefono,
reintento idempotente y permisos con actores sinteticos. **No acredita Firebase
real, Cloud Storage real, seguridad antivirus ni capacidad productiva.**

## 2. Bloqueantes de release

Las prioridades indican riesgo para habilitar H24, no explotaciones demostradas
ni afirmaciones sobre la infraestructura actualmente desplegada.

| ID / prioridad | Evidencia local y riesgo | Condicion de cierre / responsable |
|---|---|---|
| H24-PD-01 / Alta inicial | Dockerfile corregido; imagen Linux local de 95026bf con /usr/bin/pdfinfo 22.12.0, paquete 22.12.0-2+deb12u3. Inventario/digest registrados; smoke final 12/12 incluido timeout real y limpieza, tambien como usuario node | Cerrado en alcance empaquetado/parser Linux local. Repetir sobre artefacto de release si cambia; no cierra seguridad PDF ni vulnerabilidades. Ver acta de correccion, seccion 8 |
| H24-PD-02 / Alta inicial | Bucket test nuevo, privado, versionado false y soft delete 0; politica aceptada por adaptador real, permisos efectivos minimos, operaciones GCS y recuperacion con BD test aprobadas; inventarios finales 0 vivos/0 versiones | Cerrado tecnicamente en local/test. softDeleted=true retorna 400, con evidencia alternativa prevista en plan. No cierra Firebase/roles faltantes (PD-05), worker programado (PD-04), ni configuracion productiva. Ver acta GCS |
| H24-PD-03 / Alta | `validateDossierPdf` hace comprobaciones estructurales/JavaScript, no antivirus. Preview Blob usa visor nativo sin sandbox HTML (`TeacherDossierPanel.vue:312`) | Seguridad: aprobar e implementar/probar estrategia PDF malicioso o aceptar formalmente control alternativo con riesgo acotado; no declarar pdfinfo un escaner |
| H24-PD-04 / Alta | Worker reforzado y recuperacion GCS/test aprobada; dos disparos de Task Scheduler locales, idempotencia, alarma estructurada y restitucion sin diferencias. Lotes de 25 y espera >5 min conservados | Parcial: falta job/scheduler cloud privado, entrega externa de alertas, timeout/reintentos e identidad del runtime cloud. Evidencia en H24_PD04_Validacion_Worker_Recuperacion_Alertas.md; no deploy autorizado |
| H24-PD-05 / Alta | Firebase H24 real, matriz secuencial por rol, AUTH-01 y sesiones de navegador validados en sus actas. Inactividad abreviada 90/120 s autorizada; defaults productivos requieren configuracion local explicita | Parcial: identidades complementarias pendientes por decision humana; no confundir mocks o una cuenta rotada con cambio entre cuentas reales. Ver H24_PD05_Resultado_Persistencia_Inactividad.md |
| H24-PD-06 / Media | Zod/gRPC corregidos localmente; audit 0 criticas/0 altas/9 moderadas/1 baja | Completar triage o aceptacion formal de hallazgos restantes y ensayo final; regresion local no autoriza deploy |
| H24-PD-07 / Media | Limite de dos cargas por proceso, Base64 y buffers en memoria; no prueba sostenida con memoria/concurrencia de destino | QA/DevOps: medir capacidad, memoria, latencias, cola y 429 con archivos limite, red lenta, usuarios y replicas concurrentes |
| H24-PD-08 / Alta operativa | 016 solo ensayada por harness local; F3 dejo registro H05 test vacio. Backup local fallo por namespace PostgreSQL ausente | DBA: resolver entorno de ensayo confiable, probar 016 por H05 y restauracion; luego backup/ventana productiva aprobados independientemente |

La revision documental inicial no cambio codigo, dependencias, Dockerfile, SQL
ni politicas. Los seguimientos autorizados incorporaron empaquetado del parser,
smoke Linux, copia saneada y GCS aislado. La ultima prueba no cambio codigo ni SQL;
si escribio objetos sinteticos test y expediente/auditoria local. No autoriza H24-F5.

## 3. Autenticacion y permisos

Revision estatica:

- `auth.ts:50` limita actores sinteticos a NODE_ENV=test. Runtime productivo debe
  usar NODE_ENV=production y rechazar test-actor; no registrar actores de QA alli.
- `auth.ts:140` verifica ID token; exige correo verificado, dominio institucional,
  app_users ACTIVO y UID compatible, con roles/permisos obtenidos de BD.
- `dossier-policy.ts:7` permite Admin/protegido activo; Finanzas/RH necesitan acceso
  fiscal y permisos por accion. Resto denegado, independientemente de botones.
- Documento/docente y revision se comprueban en servicio; carga/reemplazo revalidan
  permisos persistidos antes de publicar el objeto (`teacher-dossier.ts:65`).
- El frontend usa browserSessionPersistence y Bearer; no almacena cola/documentos
  en localStorage/sessionStorage. El control de permisos sigue en API.

**Advertencia operativa:** autenticar una consulta real no equivale a SQL read-only.
`auth.ts:85` puede vincular firebase_uid y `auth.ts:92` actualiza last_login_at.
El ensayo de autenticacion se limita a usuarios de prueba y BD test; no se ejecuta
una sesion productiva como atajo para completar F4.

**Observacion inicial AUTH-01 (Media, preexistente, antes de la correccion):** verifyIdToken(token) no solicita
checkRevoked=true. No prometer rechazo inmediato por revocacion/deshabilitacion
solo en Firebase; distinguirlo de la inactivacion en app_users, consultada en cada
solicitud. Antes de habilitar documentos personales, Seguridad debe evaluar el
riesgo y definir cambio o aceptacion explicita; la revision inicial no modifico auth.
El seguimiento autorizado del 2026-10-28 si corrige auth compartido localmente;
la verificacion de IAM runtime y regresion del artefacto productivo sigue siendo
precondicion de una futura salida, sin ejecutarla en este ensayo.
Referencia: [verificacion Firebase](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
y [revocacion de sesiones](https://firebase.google.com/docs/auth/admin/manage-sessions).

Plan de smoke en entorno aislado, pendiente de ejecutar:

| Actor / escenario | Resultado exigido |
|---|---|
| Admin activo, incluido no protegido | Listar, cargar, ver, descargar, clasificar, reemplazar, borrar y telefono |
| Finanzas/RH con permisos completos | Igual dentro del alcance global fiscal aprobado |
| Finanzas/RH solo lectura documental | Lectura permitida; mutaciones 403; telefono solo con fiscal.manage |
| Finanzas/RH sin permiso documental | Sin bytes ni gestion; no inferir permiso por nombre del rol |
| Coordinador, Direccion, Contador/Contabilidad | Modulo oculto y 403 en todos los endpoints del expediente |
| Sin token / expirado / proyecto equivocado | 401; sin documento ni bytes |
| Correo no verificado, dominio no admitido, UID incompatible o usuario inactivo | Rechazo controlado sin capacidades nuevas |
| Revocacion de permiso durante transferencia | No publicar bytes nuevos; limpieza recuperable |
| ID de otro docente / revision vieja / otra operacion | Rechazo controlado; sin sobreescritura ni fuga |

Usar Brave con login normal de usuarios autorizados de prueba, sin compartir tokens
en chat, logs, capturas o documentos. Registrar rol, entorno, HTTP y evidencia
sanitizada. No cambiar permisos productivos para hacer pasar las pruebas.

## 4. Almacenamiento y eliminacion definitiva

Propuesta pendiente de aprobacion: bucket dedicado de prueba y luego uno dedicado
para H24 productivo. Nombres/proyecto de prueba **por definir**, no se inventa un
recurso existente. Prohibido reutilizar o cambiar `nomina-docente-prod-constancias`.

El adaptador exige: versioning.enabled=false, softDeletePolicy.retentionDurationSeconds
0, sin retentionPolicy/objectRetention/defaultEventBasedHold, uniformBucketLevelAccess
true y publicAccessPrevention=enforced. Lectura/escritura/borrado estan vinculados
a generacion, CRC32C y claves UUID opacas, no a nombres de archivo.

La forma exacta devuelta por getMetadata debe ensayarse con el SDK instalado:
campos omitidos no equivalen para este adaptador a false/0 explicitos. Si un bucket
seguro produce una forma no admitida, registrar el caso y revisar el codigo en otra
fase; no relajar la guarda ni activar retencion para eludir el fallo.

Permisos de runtime propuestos, limitados al bucket dedicado: storage.buckets.get,
storage.objects.create/get/delete; no otorgar Storage Admin ni permisos de cambio
de IAM/politicas. La verificacion de inventario/versions puede usar una identidad
de auditoria separada con list. Confirmar tambien permisos heredados y actores que
puedan cambiar politicas; public access prevention no sustituye IAM de usuarios.

Ensayo requerido: carga, bytes/hash, reemplazo y ausencia de generacion anterior,
borrado de objeto vivo y ausencia de versiones no actuales/soft-deleted, storage
403/timeout, generacion conflictiva, interrupcion de proceso y recuperacion sin
huerfanos. Solo PDF sinteticos. Registrar IDs tecnicos de prueba en evidencia
restringida, nunca PDF o tokens en el reporte versionado.

Desactivar soft delete se expresa con retencion 0; no elimina retroactivamente
objetos ya retenidos. Desactivar versioning no elimina versiones antiguas.
Referencias oficiales: [soft delete](https://docs.cloud.google.com/storage/docs/soft-delete),
[Object Versioning](https://docs.cloud.google.com/storage/docs/object-versioning) y
[metadata del bucket](https://docs.cloud.google.com/storage/docs/json_api/v1/buckets).
Por eso se exige bucket separado y evidencia, no solo un DELETE HTTP exitoso.
La garantia no abarca copias ya descargadas ni backups externos; no se promete
recuperar archivos eliminados definitivamente.

## 5. Parser, visor, capacidad y worker

Controles presentes: PDF <=7.5 MiB, hasta 500 paginas, Base64 canonico, schemas
estrictos, filename seguro, timeout parser 10 s/salida limitada y entorno del
subproceso sin variables de credenciales de aplicacion. Esto no acredita aislamiento
de archivos/red/metadata respecto de la API. Rechazo de cifrado y JavaScript
detectado. La respuesta de PDF adicionales es privada/no-store/nosniff; CORS expone
Content-Disposition para el nombre. No extrapolar estos controles a constancias;
ver brechas y propuesta PD-03.

No hay escaneo antivirus implementado ni certificacion de ausencia de malware.
El Blob del visor no hereda automaticamente la cabecera CSP de la respuesta
descargada; no afirmar sandbox HTML. Elegir control compatible con la decision
funcional, probar corpus benigno/adverso aprobado en aislado y verificar que no se
sirva un archivo no aprobado. No enviar expedientes a servicios de analisis externos.

En la revision inicial se requirio verificar parser en la **imagen Linux final**, ruta absoluta y
version, timeout, temporales, permisos de ejecucion/usuario y consumo de memoria.
Seguimiento PD-01: build local y smoke Linux aislado aprobados, ver seccion 8 del
acta de correccion. Prueba limitada a 512 MiB/1 CPU; capacidad sostenida pendiente.
El Dockerfile actual usa npm install y copia node_modules del build; revisar
reproducibilidad/inventario de imagen en el trabajo de empaquetado, sin aceptar
cambios de lockfile no explicados. Build TypeScript OK no prueba que exista pdfinfo.

Propuesta worker: job privado ejecutando `node apps/api/dist/dossier-reconcile.js`,
misma version de codigo/BD/namespace que API. En produccion requiere
ALLOW_DOSSIER_RECONCILE=true **solo en worker**. API sin trigger HTTP nuevo.
Scheduler/identidad de invocacion autorizados aparte; no timer residente dependiente
de trafico Cloud Run. Cadencia inicial propuesta cinco minutos, sujeta a capacidad:
worker espera antiguedad >5 min y procesa 25 operaciones por invocacion, no vacia
automaticamente backlog ilimitado. Alertar por pendientes, FAILED, edad y fallos
de job; exit 0 con pending>0 no demuestra limpieza completa. El ajuste local PD-04
ya retorna exit 1 por pendientes/fallos y emite senales estructuradas; los FAILED
recientes alertan durante 24 h aunque la limpieza este completa. No confundir esos
abortos terminales con backlog. Todavia no hay entrega a destinatario de Monitoring.

Capacidad pendiente: 10 archivos por seleccion y dos envios simultaneos UI no son
cuota global. API admite dos cuerpos grandes por proceso, no por proyecto/usuario;
otros endpoints/downloads pueden competir por memoria. Probar 7.5 MiB, 500 paginas,
cola completa, replicas, transferencia lenta >30 s, desconexion y reintentos.
Definir umbrales de latencia/memoria y backlog antes de aceptar el resultado.

## 6. Auditoria npm read-only actual

| Comando | Criticas | Altas | Moderadas | Bajas | Total |
|---|---:|---:|---:|---:|---:|
| npm audit --json | 0 | 15 | 12 | 1 | 28 |
| npm audit --workspace apps/api --omit=dev --json | 0 | 11 | 10 | 0 | 21 |

Ambos devolvieron exit 1 por hallazgos, no por error de consulta. Evidencia local
`.cache/h24-f4-npm-audit.json` y `.cache/h24-f4-npm-audit-api-runtime.json`.
Son conteos de paquetes reportados por npm, con propagacion transitiva, no 28
explotaciones independientes ni un inventario de la imagen productiva. El filtro
workspace/omit-dev orienta el triage, no prueba que cada ruta sea alcanzable.

Paquetes high del reporte completo: @fastify/busboy, @grpc/grpc-js,
@vue/server-renderer, brace-expansion, fast-uri, fastify, find-my-way, form-data,
nanoid, postcss, source-map-js, undici, vite, vue, zod.
Moderate: @google-cloud/firestore, @google-cloud/storage, @vitest/mocker, exceljs,
firebase-admin, gaxios, google-gax, protobufjs, retry-request, teeny-request, uuid,
vitest. Low: esbuild.

Priorizar API Fastify 5.8.5, find-my-way 9.5.0, Zod 3.25.76 y dependencias de
Firebase Admin 13.10.0 / Storage 7.19.0; frontend Vue 3.5.33 y tooling Vite 6.4.2.
Algunos avisos dependen de HTTP/2, trustProxy, SSR o multipart: no afirmar
explotabilidad sin probar la ruta usada (H24 carga JSON/Base64; frontend es SPA).
El advisory Fastify `GHSA-p68q-wchp-6fh7` y Zod `GHSA-mrhx-c7xc-m3w5` requieren
revision prioritaria del runtime. websocket-driver permanece 0.7.5.

No ejecutar fix automatico: npm propone cambios mayores para firebase-admin/Zod
y cambiar exceljs a 3.4.0, incompatible con asumir actualizacion inocua. Abrir
correccion SEC separada, acotada, con regresion y aprobacion; ninguna dependencia
se instalo, actualizo ni acepto como riesgo automaticamente.

## 7. Configuracion propuesta, no aplicada

| Elemento | Test aislado futuro | Produccion futura (solo aprobada) |
|---|---|---|
| Firebase proyecto/config completa web/API | Proyecto de prueba acordado; sin defaults productivos | Conservar proyecto actual verificado en ventana |
| NODE_ENV | development para login real sin registro sintetico | production, sin emuladores ni actores test |
| DB | nomina_docente_test local, jamas origen de datos productivos | nomina_docente por conexion segura vigente |
| DOSSIER_STORAGE_MODE | gcs para prueba real o local para F3 | gcs solo despues de cerrar gates; disabled mientras tanto |
| DOSSIER_BUCKET | Bucket aislado de prueba por aprobar | Bucket H24 dedicado por aprobar; no Constancias |
| DOSSIER_PDFINFO_PATH | Ruta absoluta local aprobada | Ruta absoluta comprobada en imagen Linux |
| DOSSIER_LOCAL_ROOT | Solo test local | No configurar como almacenamiento productivo |
| ALLOW_DOSSIER_RECONCILE | No requerido fuera de production, guardas test vigentes | true solo en job aprobado |
| Secretos / SA / CORS | Identidad aislada y origen local explicito | Conservar existentes; IAM minimo adicional revisado, nunca valores secretos en docs |

No basta con cambiar VITE_FIREBASE_PROJECT_ID: appId/authDomain/apiKey y demas
configuracion deben pertenecer al proyecto test. No lanzar login con defaults
de `apps/web/src/config.ts`. No se solicitan ni crean cuentas/recursos ahora.

## 8. H05, plan de release futuro y rollback

016 es aditiva: dos tablas, indices/FK/checks, sin backfill, sin modificar teachers
ni constancias/roles/snapshots. SHA-256 local del archivo revisado:
`419cc93af11b82d72116587f53510725b440f1be8547ecb420bb4fcddd03d685`.
H13 documenta historicamente 18 migraciones registradas hasta 015; no se verifico
Cloud SQL en F4. Frente a las 19 del filesystem, se espera **solo 016 pendiente**
antes de migrar, no exigir pending=0 antes de aplicar la nueva migracion.
Despues se espera 19 registradas, pending=0, mismatch=0; son expectativas futuras.

F3 dejo H05 test vacio tras reset: no ejecutar apply general alli sin reconstruir
el estado administrativo de ensayo correctamente. Para probar H05, preparar test
con esquema/registro hasta 015 y ejecutar 016 por runner, con autorizacion local
separada. No copiar ese estado ni los datos sinteticos hacia produccion.

Orden propuesto **NO ejecutado**:
1. Conservar evidencia PD-01 y PD-02 cerrados en sus alcances locales; cerrar PD-03 a PD-08 y AUTH-01, aprobar estrategia PDF/infraestructura y registrar
   responsables. Confirmar pruebas en entorno aislado y revision del diff.
2. Congelar SHA/lockfile e imagen comprobada, rama limpia/sincronizada. Registrar
   revision/Hosting anteriores por consulta autorizada durante ventana, no por
   asumir que los valores historicos del SDD siguen vigentes.
3. Backup Cloud SQL SUCCESSFUL y restaurabilidad; inspect H05 autorizado: solo
   016 pendiente y cero mismatch. apply recorre todos los pendientes
   (`tools/migrate-db.ts:478`): abortar si aparece otro. No baseline historico.
4. Aplicar exclusivamente 016 mediante H05 con confirmaciones y ventana aprobadas.
   Verificar schema/registro y ausencia de cambios a datos funcionales. dry-run
   puede escribir registro administrativo; no llamarlo read-only.
5. Habilitar infraestructura aprobada y worker, desplegar API antes de Hosting;
   conservar secretos/configuracion ajena a H24. No habilitar UI productiva con
   backend disabled o sin tablas/parser (produciria 503 en expediente).
6. Health API/Hosting, 401 sin sesion, login y smoke autorizado por rol. Un health
   200 solo prueba disponibilidad general, no GCS/parser/worker. Para probar
   escrituras documentales productivas se necesita autorizacion y docente/archivo
   de prueba acordados; no usar expedientes personales ni crear docentes a ciegas.
7. Validar limpieza y auditoria, errores y regresiones Constancia/Directorio/H01/
   H20/H22/Finanzas; documentar deploy y aceptacion humana antes de cerrar H24.

Rollback propuesto: detener nuevas operaciones H24, registrar estados pendientes
y coordinar cleanup/worker, revertir API/Hosting a artefactos anteriores aprobados
si falla acceso, login, permisos, bytes o consistencia. No eliminar tablas/objetos
en lote ni perder intenciones de limpieza; cambiar bucket/namespace impediria
reconciliar. Revertir codigo no deshace telefono ni restaura PDF borrados. No
restaurar toda la BD automaticamente por un error de UI. DBA decide recuperacion
especifica con backup y analisis de efectos. No ejecutar rollback en F4.

## 9. Validaciones F4 y checklist

| Validacion | Resultado |
|---|---|
| test:api con Poppler local | 145/145, 13 archivos |
| test:web | 139/139, 23 archivos |
| typecheck | API/web OK |
| build | API/web OK, sin publicar ni construir imagen Cloud |
| test:api:integration | No repetida en F4: reconstruye BD. Evidencia F3 158/158, 27 H24, mismo codigo en 9a5dd27 |
| Brave HTTP real | Evidencia F3, no repetida ni login real en F4 |
| npm audit | Ejecutado read-only; hallazgos, ver seccion 6 |
| git diff --check | OK; cambios documentales solamente |

Logs locales `.cache/h24-f4-{test-api,test-web,typecheck,build}.log`.
Lockfile SHA-256 sin cambios:
`b840496398aae4750c9648622d1a5d982cf4bb66a24e2ed5f155f0079e0361a8`.

- [x] Codigo, contratos, roles y evidencia F1/F2/F3 revisados.
- [x] Bloqueantes y plan de smoke/release/rollback documentados.
- [x] Regresion sin BD y auditoria de dependencias repetidas.
- [x] Login Firebase real autorizado y matriz de roles vigentes en test; AUTH-01
  cerrado local/H24. PD-05 parcial por identidades complementarias pendientes.
- [x] Persistencia, logout y cierre/reapertura Invitado; H15 abreviado autorizado
  90/120 s aprobado. No es espera real de una hora ni prueba de perfil restaurado.
- [x] GCS privado de prueba, IAM/politicas/borrado comprobados en PD-02 y limpieza
  con sesiones reales confirmada en PD-05; no equivale a infraestructura productiva.
- [x] Parser en imagen Linux final local validado (seguimiento PD-01, 12/12).
- [ ] Estrategia PDF/visor aprobada/probada (PD-03; pdfinfo no es antivirus).
- [ ] Worker programado y alertas/recuperacion probados.
- [ ] Capacidad y accesibilidad/dispositivos completados.
- [x] AUTH-01 corregido y validado local/H24; no desplegado.
- [ ] Hallazgos npm resueltos o excepciones fundamentadas aprobadas; verificar
  IAM/latencia AUTH-01 del runtime destino dentro de un release autorizado.
- [ ] Entorno DBA confiable, ensayo H05 016 y restauracion.
- [ ] Aprobacion explicita de backup/migracion/API/Hosting productivos.

## 10. Confirmaciones

Solo documentos modificados. Sin codigo, SQL, dependencias, BD local/productiva,
migraciones, seeds, recursos cloud, credenciales/variables productivas, deploy,
carga de archivos personales, cambios H01, Nomina, snapshots, permisos o reglas.
No se hizo commit/push. No se actualizan manuales como funcionalidad productiva.
Preparacion F4 terminada; autorizacion de release pendiente, no implicita.
