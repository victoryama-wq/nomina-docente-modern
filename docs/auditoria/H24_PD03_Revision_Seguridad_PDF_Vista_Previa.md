# H24-PD-03 - Revision de seguridad PDF y vista previa

Fecha: 2026-10-28.
Base revisada: `c11a8e875fa47c28b9ea179ec240919dd8fbb0c9`.
Rama: `feature/h02-h03-user-coordinations-permissions`.
Estado: revision inicial y seguimiento A1/A2/A3/A4 aislado; **PD-03 abierto, H24 NO-GO**.

Seguimiento autorizado del 2026-10-28: A1/A2 ejecutados en laboratorio Docker local,
con firmas oficiales y EICAR, sin BD/nube. Ver [resultados y limites](H24_PD03_Laboratorio_ClamAV_EICAR.md).
Ese laboratorio no implemento A3/A4 ni cerro PD-03. Las afirmaciones de revision sin pruebas de
las secciones siguientes corresponden a la entrega inicial, anterior al laboratorio.

Seguimiento A3 autorizado: [controles locales PDF/ClamAV](H24_PD03_A3_Controles_PDF_ClamAV_Local.md)
implementados en constancias/adicionales, recuperacion y entrega fail-closed, con
pruebas unitarias y Docker real sin BD/nube. A4 no se ejecuto durante A3; decodificador JPG/PNG,
politica completa PDF, historicos, visor y arquitectura cloud pendientes. Las
brechas iniciales se conservan como antecedente; consultar el acta A3 para su avance.

Seguimiento A4 autorizado y aprobado: [integracion API/BD test/GCS](H24_PD03_A4_Integracion_PDF_ClamAV_GCS.md),
16 grupos con respaldo/restitucion exacta de 26 tablas e inventarios. Sin adversos
en GCS, produccion ni deploy. Los pendientes de politica, imagenes, visor y cloud
se mantienen; no confundir la integracion aprobada con cierre integral PD-03.

Revision posterior a A4: [propuesta de imagenes, funciones PDF y visor](H24_PD03_Politica_Imagenes_PDF_Visor_Propuesta.md).
Confirma la brecha de decodificacion JPG/PNG, propone politica PDF/historicos y
registra una carrera de respuestas de constancia pendiente de reproduccion.
Contiene autorizaciones separadas de laboratorio, politica, implementacion e
integracion. Ninguna herramienta nueva instalada ni control adicional implementado.

## 1. Resumen y limites

La carga de PDF adicionales tiene controles estructurales, permisos y almacenamiento
privado. No tiene analisis antimalware. La ruta de constancias mantiene controles
de contenido mas debiles y debe incluirse en el alcance de seguridad del expediente.
La vista previa depende del visor PDF nativo, no de un sandbox HTML demostrado.

Esta revision no demuestra explotacion, infeccion ni exposicion productiva. Las
prioridades siguientes expresan riesgo y brechas de control, no un CVSS ni una
vulnerabilidad confirmada del binario Poppler instalado. No se consulto produccion,
BD, Firebase ni GCS. No se ejecutaron archivos adversos, escaneos ni pruebas nuevas.
Las evidencias anteriores PD-01/02/05 siguen siendo historicas, no reejecutadas aqui.

## 2. Controles existentes verificados en codigo

| Control | Evidencia en la base revisada |
|---|---|
| Admin; Finanzas/RH con permisos fiscales correspondientes; estado activo | `apps/api/src/lib/dossier-policy.ts:7` |
| PDF adicional: extension, MIME literal, nombre sin rutas/control, Base64 canonico, 7.5 MiB | `apps/api/src/lib/dossier-contract.ts:10` y `:35` |
| Firma/EOF, parser real, maximo 500 paginas, rechazo de cifrado y JavaScript detectado | `apps/api/src/lib/dossier-storage.ts:314` |
| Ejecucion sin shell, timeout 10 s por invocacion, salida 256 KiB, entorno reducido, temporales privados y limpieza | `apps/api/src/lib/dossier-storage.ts:291` |
| Autorizacion antes de parsear el cuerpo; dos cargas por proceso; plazo de recepcion 30 s, 429 | `apps/api/src/routes/teacher-dossier.ts:20` |
| Validacion previa a preparar/publicar PDF adicional; hash del contenido, revisiones e idempotencia | `apps/api/src/lib/teacher-dossier.ts:184` |
| Lectura por docente/documento, namespace y generacion; comprobacion posterior contra sustitucion/borrado | `apps/api/src/lib/teacher-dossier.ts:244` |
| Respuesta PDF adicional privada/no-store/nosniff, disposition segura y CSP | `apps/api/src/routes/teacher-dossier.ts:103` |
| Frontend adicional comprueba MIME, longitud y firma; crea Blob PDF; descarga vuelve a autorizar | `apps/web/src/api.ts:1476`; `apps/web/src/components/TeacherDossierPanel.vue:217` |
| URL temporal revocada al cerrar; no URL de archivo suministrada por el usuario en iframe | `apps/web/src/components/TeacherDossierPanel.vue:195` |

No extrapolar los controles de PDF adicional a constancias. Las constancias
admiten tambien JPG/PNG; no se propone retirar esa compatibilidad sin decision.

## 3. Hallazgos priorizados

### PD03-01 - Alta: constancia sin validacion real de contenido equivalente

Evidencia: `apps/api/src/routes/teachers.ts:169` y `:1169` valida MIME declarado,
decodifica con `Buffer.from` y verifica un maximo de bytes; no invoca parser PDF,
no exige Base64 canonico ni comprueba contenido no vacio decodificado. El adaptador
`apps/api/src/lib/constancia-storage.ts:29` guarda los bytes y el MIME recibido.

Impacto potencial: una cuenta con permiso de carga puede publicar como constancia
contenido no acreditado como PDF/imagen, que otros usuarios autorizados reciben.
El reemplazo durable y el borrado fisico no acreditan seguridad del contenido.

Propuesta: validar bytes/formato antes de iniciar reemplazo; aplicar el mismo
pipeline de PDF a ambas rutas. Para JPG/PNG, verificar formato real con decodificador
acotado y limites de dimensiones/pixeles. Un rechazo nunca debe retirar la version
vigente. No se ha elegido ni instalado una dependencia para imagenes.

### PD03-02 - Alta: falta estrategia antimalware y politica de funciones PDF

Evidencia: `apps/api/src/lib/dossier-storage.ts:313` declara expresamente que no es
un escaner; `apps/api/src/lib/dossier-runtime.ts:10` conecta ese unico validador.
Se verifican paginas, cifrado y JavaScript, no una politica completa para adjuntos,
acciones Launch, XFA, multimedia, referencias externas o expansion de streams.
No se afirma que todos esos casos pasen: todavia no se ensayaron.

Propuesta: parser estructural mas escaner local aislado (candidato: ClamAV), con
resultado limpio explicito y completo antes de publicar/servir contenido. Timeout,
error, limite alcanzado, firmas caducadas o motor ausente no equivalen a limpio.
La politica de funciones activas necesita aprobacion y pruebas, no busquedas regex
sobre el PDF. Antivirus negativo tampoco garantiza ausencia de amenazas nuevas.

Esta defensa por capas sigue la [guia de cargas de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
No enviar documentos ni hashes de expedientes a servicios publicos de analisis.

### PD03-03 - Alta condicionada: aislamiento del parser no demostrado

Evidencia: `apps/api/src/lib/dossier-storage.ts:291` lanza `execFile` con entorno
reducido pero sin aislamiento propio de archivos/red. `apps/api/Dockerfile:14`
instala el parser en la imagen API y no declara `USER`. No se inspecciono runtime
productivo ni se afirma haber explotado un fallo del parser.

Impacto potencial si el parser fuese comprometido: compartir identidad, archivos
y red del proceso API puede ampliar el alcance del incidente. Eliminar variables
de credenciales no bloquea por si mismo archivos montados o servicios de metadata.

Propuesta para ensayo: contenedor de analisis separado, usuario no root, sin
credenciales ni socket Docker, sin montajes de aplicacion/BD, filesystem de solo
lectura, temporal acotado, capacidades retiradas, no-new-privileges, limites de
memoria/CPU/PID/tiempo/salida y sin salida de red durante el analisis. Descargar
firmas en un paso separado autorizado. Verificar restricciones efectivas, no solo
declararlas. La arquitectura cloud posterior requerira su propia aprobacion.

### PD03-04 - Media: visor nativo no acredita aislamiento HTML

Evidencia: `apps/web/src/components/TeacherDossierPanel.vue:372` y
`apps/web/src/views/FiscalRecordsView.vue:626` usan iframe Blob sin sandbox.
La implementacion adicional no admite HTML ni una URL arbitraria; esto reduce
riesgo y no demuestra XSS. El comentario registra incompatibilidad previa de
sandbox con el visor nativo, no una garantia universal de todos los navegadores.

El frontend crea un nuevo Blob: no debe atribuirse a ese recurso automaticamente
la CSP de la respuesta API descargada. Referencias: [ciclo de vida de Blob](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob)
y [alcance de CSP sandbox](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox).

Propuesta inicial: conservar visor nativo solo para bytes aprobados por el pipeline,
navegador actualizado y pruebas de ausencia de ejecucion/navegacion automatica,
peticiones externas y acceso al documento padre. No abrir fixtures activos en el
perfil institucional. Si el riesgo residual no se acepta, evaluar preview rasterizado
en proceso aislado: cambia recursos/UX, no sustituye seguridad del PDF descargable.
No agregar a ciegas `sandbox` ni instalar otro visor. Ninguna opcion esta aprobada.

### PD03-05 - Media: paridad de entrega y admision pendiente en constancias

Evidencia: `apps/api/src/routes/teachers.ts:1170` autentica en preHandler y no usa
el limite compartido de cargas adicionales. El limite global de cuerpo es 12 MiB
(`apps/api/src/app.ts:9`): no se afirma que la carga sea ilimitada.
`teachers.ts:1271` entrega la constancia sin Cache-Control/CSP explicitos y con
filename menos estricto. Helmet esta registrado globalmente (`app.ts:17`), con
CSP desactivada: no afirmar ausencia global de nosniff sin medir la respuesta.
`apps/web/src/api.ts:1365` no comprueba tipo/tamano/firma como el helper adicional.

Propuesta: admision temprana y acotada para ambas rutas; comprobar cabeceras reales
con app.inject, cache privada/no-store, MIME validado, filename seguro y tipos
permitidos exactos en frontend. Evaluar CORS/disposition sin ampliar origenes.
La prueba sostenida multiusuario/multirreplica corresponde a PD-07.

## 4. Diseno propuesto y decisiones pendientes

1. Un contrato comun de veredicto: valido, rechazado o no disponible; hash de bytes,
   version del motor, version/fecha de firmas y politica. No registrar contenido,
   nombres personales, tokens, campos fiscales ni salidas crudas del parser.
2. Validar antes de cualquier publicacion. El veredicto debe corresponder a los
   mismos bytes/generacion servidos; recuperacion y reintentos no pueden saltarlo.
3. ClamAV es candidato, no implementacion aprobada. Requiere firmas oficiales y
   operacion/memoria medidas. No exponer su TCP sin autenticar: la [documentacion
   oficial](https://docs.clamav.net/manual/Usage/Scanning.html) advierte que clamd
   acepta comandos de cualquier origen que alcance ese socket. Preferir transporte
   local privado; sin puertos publicos ni acceso al daemon desde el navegador.
4. Proponer rechazo de JavaScript, Launch, adjuntos ejecutables/contenido activo,
   XFA y acciones automaticas externas. Acordar trato de adjuntos inocuos, enlaces
   y AcroForms estaticos; documentos oficiales pueden contener enlaces o firmas.
   No transformar, aplanar, quitar firmas ni ejecutar CDR sin aprobacion separada.
5. Historicos sin veredicto: no declararlos limpios ni borrarlos. Ensayar validacion
   de lectura sobre copia sintetica y decidir politica de acceso antes de rollout.
   Una descarga directa no es alternativa segura para eludir un rechazo del escaner.
6. No cambiar esquema ahora. Si persistir veredictos exige migracion/estados nuevos,
   presentar diseno separado bajo H05; no reutilizar un campo con semantica distinta.
7. Mantener limites y permisos actuales, PDF originales, multiples del mismo tipo,
   recuperacion de reemplazo y borrado definitivo aprobados. Sin cambios H01,
   telefono, C.P./CURP, Directorio, pagos ni snapshots.

## 5. Plan de pruebas sujeto a autorizacion

| Etapa | Evidencia requerida | Limite |
|---|---|---|
| A. Harness sin BD | PDF valido, MIME/extension falsa, Base64 invalido, truncado, cifrado, JS inerte, limites de bytes/paginas | Solo sinteticos, parser aislado, no abrir adversos en visor |
| B. Antimalware | Veredicto limpio/rechazo; timeout, motor caido, firmas vencidas, limites; hash igual al contenido | EICAR opcional autorizado, sin malware real ni desactivar antivirus del equipo |
| C. Funciones PDF | Adjuntos, acciones, formularios, enlaces, firmas sinteticas; politica documentada por caso | No exploits ni destinos de red reales; captura en aislado |
| D. API/recuperacion | 401/403 por rol, ID ajeno, rechazo antes de publicar, reemplazo rechazado conserva original, reintento/worker no eluden analisis | Solo nomina_docente_test con respaldo, datos sinteticos y restitucion |
| E. Almacenamiento | Ningun rechazado disponible, hashes/generaciones, borrado y limpieza | Primero adaptador local; luego solo buckets H24 autorizados |
| F. Vista previa | Solo aceptados, PDF/JPG/PNG segun ruta, cierre/cambio/logout, URL revocada, descarga autorizada, cabeceras y sin fuga/red no prevista | Brave invitado/perfil desechable; 1440x900, 768x1024, 390x844 |

Medir tiempo/memoria de cada caso y limpieza tras errores. Un escaneo omitido,
skipped o limitado es pendiente, no aprobado. No generar bombas de descompresion
sin limites ni pruebas de carga sostenida en esta etapa. No cargar EICAR en GCS.
Un fixture EICAR detectado acredita la conexion del motor, no eficacia universal
ante PDF malicioso. Firmas y seguridad del contenedor tambien requieren seguimiento.

## 6. Autorizaciones necesarias

- **A1, laboratorio local:** descargar imagen/herramienta de escaneo y firmas
  oficiales; construir contenedor Linux aislado, sin nube ni BD, y producir corpus
  sintetico acotado. No instalar dependencias npm ni usar audit fix. Registrar
  versiones/digests/licencias; detener si requiere ampliar recursos o herramientas.
- **A2, prueba de deteccion opcional:** usar marcador EICAR oficial exclusivamente
  dentro del laboratorio desechable, sin malware real, sin subirlo a GCS ni abrirlo
  en el navegador. Si el antivirus anfitrion interviene, detener, no excluir rutas.
- **A3, implementacion local posterior:** corregir constancias/parser/entrega y
  conectar controles con pruebas; revisar primero impacto de nuevos paquetes o
  esquema, sin instalacion ni migracion implicita. Es distinta de autorizar A1.
- **A4, integracion posterior:** respaldo/restitucion de nomina_docente_test y
  carga/reemplazo/borrado de archivos sinteticos aceptados en los buckets H24
  existentes; sin reset general, proyectos nuevos, IAM nuevo ni documentos reales.
- **Decision funcional:** aprobar politica de funciones PDF y tratamiento de
  historicos/firmas; aceptar o no riesgo residual del visor nativo tras pruebas.
  No convertir permisos de prueba en aceptacion de riesgo ni autorizacion de deploy.

Recomendacion: empezar por A1; anadir A2 si se autoriza explicitamente. Con los
resultados, elegir arquitectura y pedir A3/A4 concretos. No se necesitan cuentas
productivas, documentos reales ni un nuevo proyecto para esta primera etapa.

## 7. Criterio de cierre y validacion documental

PD-03 se cerrara con politica aprobada, controles implementados, corpus ejecutado,
paridad constancia/adicional, verificacion de aislamiento/visor y tratamiento de
historicos documentado. Una excepcion de riesgo requiere aprobacion explicita;
no puede inferirse de un PDF que abre correctamente o de PD-01 aprobado.
No cierra PD-04 cloud, casos pendientes PD-05, PD-06, PD-07 ni otros gates H24.

Esta entrega solo incorpora este informe y seguimiento en el predeploy. Se revisan
`git diff --check`, `git diff --name-only` y `git status`. No se ejecutan tests/build
por ser documental. No hay commit/push automaticos, cambios funcionales, SQL,
BD, credenciales, permisos, instalaciones, produccion ni deploy.
