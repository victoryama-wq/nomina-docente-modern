# H24 PD-03 - Propuesta de imagenes, funciones PDF y vista previa

Fecha: 2026-10-28.
Base revisada: `360ea6397bcd607581d0b02ea0b44b678ab60b55`.
Rama: `feature/h02-h03-user-coordinations-permissions`.
Estado actualizado: **puntos 1-3 implementados localmente; punto 4 aprobado en test/GCS el 2026-10-29. PD-03 abierto, H24 NO-GO**.

Resultado de la nueva ronda y restitucion en
[integracion de politica JPG/PNG/PDF con test/GCS](H24_PD03_Integracion_Politica_Imagenes_PDF_GCS.md).
Esta autorizacion separada no acepta el riesgo residual del visor ni permite deploy.
19 grupos aprobados; 26 tablas e inventarios restituidos exactamente.

El usuario autorizo laboratorio, politica e implementacion local el 2026-10-28.
Ver [resultados y limites](H24_PD03_Implementacion_Imagenes_PDF_Visor_Local.md).
Las secciones siguientes conservan la propuesta anterior a esa autorizacion;
sus frases de pendiente/no implementado describen ese momento historico, no el
estado actual de 1-3. Integracion nueva BD/GCS, aceptacion residual del visor y
arquitectura cloud no quedan autorizadas ni aprobadas por los ensayos locales.

## 1. Alcance y evidencia

A3 implemento el pipeline local y A4 acredito integracion API/BD test/GCS y
restitucion. No se repitieron esos ensayos en esta revision. Se inspeccionaron
codigo, pruebas, dependencias y documentacion oficial publica; sin acceso a BD,
GCS, Firebase, credenciales ni produccion. Arbol inicialmente limpio.

Esta propuesta no modifica permisos, formatos admitidos de documentos adicionales
(solo PDF), H01, campos fiscales ni funcionamiento de Nomina. JPG/PNG corresponden
exclusivamente a la constancia. No se instala ni implementa nada en esta entrega.

## 2. Hallazgos actuales

### IMG-01 - Alta: falta decodificacion completa y acotada

`apps/api/src/lib/document-security.ts:20` comprueba firma PNG y marcadores JPEG;
`:82` ejecuta solamente AV para imagenes. No hay decodificador de pixeles ni
limites de dimensiones/fotogramas. La revision de package-lock no encontro sharp,
pngjs, jpeg-js ni jimp. Las pruebas de document-security no acreditan decodificacion.

Impacto potencial: contenido truncado o de expansion elevada puede alcanzar el
decodificador del navegador aunque tenga firma reconocida y AV negativo.
No se ha demostrado un exploit ni un archivo malicioso aceptado en produccion.

### PDF-01 - Alta: politica estructural incompleta

`apps/api/src/lib/dossier-storage.ts:315` valida PDF, EOF, paginas, cifrado y
JavaScript mediante pdfinfo. No inspecciona de forma completa acciones, adjuntos,
XFA, formularios, referencias externas y multimedia. A3 agrega ClamAV, pero un
veredicto AV negativo no acredita cumplimiento de una politica de funciones PDF.
No se afirma que todo caso no ensayado sea aceptado.

### VIEW-01 - Media: limites del visor nativo

`apps/web/src/components/TeacherDossierPanel.vue:373` y
`apps/web/src/views/FiscalRecordsView.vue:626` incrustan PDF mediante iframe Blob
sin sandbox HTML. Se limita el tipo y se reautoriza la descarga; eso no demuestra
aislamiento del motor PDF ni ausencia de solicitudes externas. No es evidencia de
XSS. La CSP de una respuesta API no debe darse por aplicada al nuevo Blob.

### VIEW-02 - Media: respuesta tardia de constancia

`FiscalRecordsView.vue:351` espera la descarga y crea un Blob sin comprobar despues
si la solicitud sigue vigente, si el componente se desmonto o si cambio el acceso.
`:104` y `:418` cierran la vista al perder acceso/desmontar, pero no invalidan esa
promesa. Dos respuestas fuera de orden pueden presentar una constancia anterior;
una respuesta posterior al cierre puede dejar una URL sin liberar. Es un hallazgo
estatico pendiente de reproduccion, no un bypass backend demostrado.
TeacherDossierPanel ya usa contador de solicitud/disposed y sirve como patron local.

## 3. Propuesta JPG/PNG pendiente de aprobacion

- Mantener JPEG/PNG en constancias y limite actual de 7.5 MiB.
- Verificar tipo real, estructura y decodificar todos los pixeles, no solo metadata.
- Proponer una sola imagen estatica: rechazar APNG/animacion/multipagina, formatos
  distintos, archivos truncados y errores/advertencias de decodificacion.
- Limites iniciales de laboratorio: 25 millones de pixeles, 10 000 px por lado,
  512 MiB RAM, 2 CPU, 64 PID, 30 s de proceso y salida de veredicto acotada.
  Son propuestas medibles, no limites operativos aprobados ni garantia de capacidad.
- Evaluar sharp/libvips en una imagen de analisis independiente, con version y
  lock propios fijados, licencias/auditoria registradas. No agregarlo al frontend
  ni al package.json/package-lock de la aplicacion en este primer laboratorio.
- Configurar rechazo estricto, limites de pixeles/canales y formatos permitidos;
  metadata() no sustituye el trabajo de decodificacion completa. No habilitar
  opciones unlimited. Los limites del contenedor siguen siendo obligatorios.
- Procesar stdin/temporales privados, sin red, secretos, BD, socket Docker ni
  montajes del proyecto; usuario no root, filesystem read-only y limpieza comprobada.
- Conservar bytes originales: no recomprimir, rotar, quitar EXIF/ICC ni convertir
  silenciosamente. El buffer decodificado es temporal y no se publica.
- AV y decodificador deben aprobar los mismos bytes/hash antes de carga, lectura
  y recuperacion. Error/timeout no significa limpio y no elimina la version vigente.

Sharp documenta failOn/limitInputPixels, pero ese limite depende de metadata y no
sustituye aislamiento. Ver [constructor](https://sharp.pixelplumbing.com/api-constructor/)
y [metadata sin decodificar pixeles](https://sharp.pixelplumbing.com/api-input/).

## 4. Politica PDF propuesta, no aprobada

| Funcion | Propuesta |
|---|---|
| Texto, imagenes, paginas estaticas y navegacion interna | Permitir si todos los controles terminan correctamente |
| Cifrado/contrasena y JavaScript | Mantener rechazo |
| Launch, acciones externas automaticas, SubmitForm/ImportData, GoToR/GoToE, multimedia/3D, XFA | Rechazar |
| Archivos adjuntos/embebidos, incluidos portfolios y adjuntos aparentemente inocuos | Rechazar en v1; pedir documentos separados |
| Formularios AcroForm | Admitir solo campos sin acciones/scripts/XFA; no prometer edicion o guardado desde el visor |
| Firma digital | Conservar bytes y permitir si no contiene funciones prohibidas; no certificar identidad, vigencia o validez de firma |
| Enlaces externos | Admitir solo anotaciones HTTPS accionadas expresamente por el usuario; nunca acciones automaticas, file/data/javascript ni recursos remotos de renderizado |
| Accion o funcion activa desconocida, analisis incompleto/ambiguo | No publicar ni servir hasta revision; sin reparacion automatica |

La lista debe implementarse mediante objetos/referencias de un parser real, no
regex de bytes. Evaluar qpdf en el contenedor aislado como inspector estructural,
con recorrido acotado, deteccion de ciclos, limites de objetos/profundidad/salida
y pruebas de object streams, nombres escapados y actualizaciones incrementales.
qpdf --check por si solo no es un veredicto de seguridad. Su JSON permite inspeccion
de objetos; no transforma originales si se usa exclusivamente en modo inspeccion.
Version/binario y cobertura se validaran antes de integrar; no se declara aprobado.
Referencias: [JSON qpdf](https://qpdf.readthedocs.io/en/stable/json.html) y
[opciones de inspeccion](https://qpdf.readthedocs.io/en/stable/cli.html).

No aplanar formularios, eliminar firmas, hacer CDR o desinfectar originales.
La politica estricta puede rechazar documentos oficiales con funciones adicionales;
ese impacto requiere decision humana y no debe resolverse ocultando el rechazo.

Historicos: proponer revalidacion al leer; conservar el archivo si se rechaza y
bloquear tanto preview como descarga con mensaje controlado. Motor indisponible:
reintento, no borrado. No analizar masivamente ni cambiar registros historicos.
Esta decision de disponibilidad requiere aprobacion previa al rollout.

## 5. Vista previa y pruebas propuestas

Conservar provisionalmente visor nativo para archivos admitidos, sujeto a prueba
y aceptacion residual posterior. No agregar sandbox a ciegas ni afirmar que
referrerpolicy impide toda red. No instalar otro visor. Alternativa si no se acepta:
preview rasterizado aislado, con presupuesto/UX y aprobacion separada; el PDF
original descargable seguiria necesitando los mismos controles.

Pruebas de laboratorio, sin sesiones institucionales ni documentos reales:

1. Imagenes sinteticas JPEG/PNG RGB, grises, CMYK/ICC, EXIF y alpha; limites exactos,
   falso MIME, truncados, dimensiones excedidas y APNG. Sin bombas no acotadas.
2. Corpus PDF inerte para cada funcion de la tabla, firmas de prueba y objetos
   comprimidos/incrementales. No ejecutar exploits ni malware real.
3. Contratos: rechazo antes de staging, hash exacto, 422 frente a 503/429,
   indisponibilidad y recuperacion sin eludir control. Primero dobles de BD/storage.
4. Reproducir y corregir respuesta tardia de constancia: cierre, cambio de docente,
   perdida de permiso, logout y desmontaje; liberar Blob e ignorar respuesta antigua.
5. Visor en perfil desechable sin credenciales, con red externa bloqueada y captura
   de intentos. Solo documentos aprobados por el pipeline; rechazados no se abren.
   Navegacion interna, enlaces sinteticos, descarga, cierre/cambio/logout, sin
   navegacion automatica ni acceso al padre. 1440x900, 768x1024 y 390x844.
6. Integracion posterior en test/GCS solo con archivos benignos: respaldo previo,
   manifest, reemplazo rechazado conserva anterior, restitucion y fingerprints.

Un resultado negativo de AV o una prueba de visor no garantiza ausencia universal
de amenazas. La descarga ya entregada tampoco se puede revocar del equipo receptor.
Fuentes: [OWASP cargas](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html),
[Blob y liberacion](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob),
[CSP sandbox](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox).

## 6. Autorizaciones concretas solicitadas

1. **Laboratorio ampliado:** descargar/fijar sharp/libvips y qpdf solo en imagenes
   Docker locales de analisis, dependencias propias reproducibles, corpus sintetico
   acotado y medicion. Sin BD/nube, sin dependencias de la app, sin npm audit fix.
   Si no son compatibles, detener y presentar alternativa, no instalar otra a ciegas.
2. **Politica funcional:** aprobar la tabla PDF, originales intactos, imagen estatica
   y limites iniciales; aprobar trato de historicos rechazados. La aceptacion del
   riesgo residual del visor queda para despues de observar las pruebas, no implicita.
3. **Implementacion/pruebas locales:** integrar decoder/inspector al pipeline local
   y corregir VIEW-02 con pruebas unitarias/UI sintetica en perfil desechable.
   Sin cambio de roles, SQL, datos reales ni arquitectura cloud. No requiere cuenta
   adicional para la primera etapa; login H24 solo si luego hace falta smoke real.
4. **Integracion posterior separada:** extender el ensayo a nomina_docente_test y
   buckets H24 existentes con respaldo/restitucion y archivos benignos. La aprobacion
   de A4 acredita el ensayo anterior, no ejecuta automaticamente esta nueva ronda.
   Ningun archivo adverso ni EICAR se enviara a GCS.

Prioridad recomendada: aprobar 1-3, ejecutar sin BD/cloud y revisar resultados;
despues 4. No se requiere proyecto nuevo, IAM nuevo, datos reales o acceso productivo.

## 7. Estado y validaciones de esta entrega

Solo documentacion. Sin cambios de codigo, SQL, dependencias, BD, servicios,
credenciales, Firebase, GCS ni produccion; sin deploy, migraciones o commit/push.
No se ejecutaron corpus, tests/build ni pruebas de navegador: no hay nueva evidencia
de ejecucion. Validaciones documentales: git diff --check y git status.
PD-03 sigue abierto; transporte/operacion cloud, PD-04/05 y capacidad PD-07 no
quedan resueltos por esta propuesta. H24 sigue NO-GO.
