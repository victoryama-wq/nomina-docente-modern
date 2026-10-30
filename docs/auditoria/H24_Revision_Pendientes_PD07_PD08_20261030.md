# H24 - Revision de pendientes y preparacion PD-07/PD-08

Fecha: 2026-10-30, America/Cancun.
Base: `0121161`; rama `feature/h02-h03-user-coordinations-permissions` limpia al iniciar.
Alcance: lectura de codigo/configuracion y actas, sin ejecutar nuevas pruebas.
Resultado: **H24 mantiene NO-GO; propuesta de ensayos pendiente de autorizacion**.

## 1. Estado reconciliado

La tabla original de F4 contiene observaciones anteriores a los seguimientos.
No tratar esos textos como anulacion de las pruebas posteriores ni cerrar un
gate completo por un ensayo parcial. Esta revision no consulto estado cloud vivo.

| Gate | Evidencia existente | Pendiente real |
|---|---|---|
| PD-01 | Empaquetado pdfinfo y gate Linux aprobados, repetidos en PD-06 | Repetir en artefacto final si cambia |
| PD-02 | GCS aislado, permisos y borrado aprobados; constancias tambien ensayadas por separado | Verificacion del destino productivo en futura ventana autorizada |
| PD-03 | PDF/JPG/PNG, ClamAV, visor e integracion aislada probados; servicios privados cloud ensayados | Resolver/aceptar aislamiento de salida y riesgo residual del visor; configuracion final |
| PD-04 | Worker, recuperacion, idempotencia y disparo Scheduler cloud aprobados | Recepcion de email, multiples cadencias y alerta por ausencia; destino final. Scheduler pausado segun ultima acta |
| PD-05 | Roles secuenciales, revocacion/deshabilitacion, login, persistencia y timeout abreviado aprobados | Identidades complementarias conservadas pendientes por decision humana, o excepcion formal especifica |
| PD-06 | Zod/gRPC corregidos; audit online 0 criticas/0 altas/9 moderadas/1 baja | Autorizar ensayo UUID/tsx o aceptar explicitamente excepciones; no hay decision nueva |
| PD-07 | Muestras cloud de archivos pequenos y pruebas de concurrencia unitarias | Capacidad, memoria, archivos limite, red lenta, arranque frio y recorrido completo |
| PD-08 | 016 y 017 aplicadas por H05 en test en fases distintas; restauracion saneada previa a 016 acreditada | Ensayo conjunto reproducible desde estado anterior a H24, backup/restauracion posterior y plan de rollback |

Fuentes: H24_Fase4_PreDeploy_Expediente_Docentes.md,
H24_PD03_PD04_Arquitectura_Cloud_Aislada.md,
H24_PD03_Integracion_Politica_Imagenes_PDF_GCS.md,
H24_PD05_Resultado_Persistencia_Inactividad.md,
H24_PD06_Triage_Residual_UUID_Esbuild.md,
H24_PD02_Copia_Local_Anonimizada_GCS.md y H24_Ajuste_CP_CURP_Expediente.md.

## 2. PD-07: observaciones de revision estatica

### R07-01 - Presupuesto de tiempo end-to-end pendiente

`firebase.json` dirige /api/** a Cloud Run. Firebase documenta un timeout de
60 segundos en Hosting, con respuesta 504 al excederlo:
[documentacion oficial](https://firebase.google.com/docs/hosting/cloud-run).

`apps/api/src/lib/document-cloud.ts:51` admite 40 segundos para inspector y
230 segundos para scanner. `services/document-security/server.mjs:33,38`
admite hasta 100 segundos de freshclam y 120 de escaneo. Esos limites no son
tiempos observados ni una garantia de fallo, pero permiten superar el presupuesto
del proxy. Las muestras cloud previas de unos 15 segundos y 25 segundos en frio
no cubren archivo maximo, renovacion de firmas o cola concurrente.

Probar upload/reemplazo/lectura con retrasos sinteticos, corte a los 60 segundos,
consulta posterior del estado e idempotencia. La UI no debe declarar exito o
fracaso definitivo sin evidencia, ni crear duplicados al reintentar. Si el
recorrido real excede el limite de forma operativamente relevante, presentar
correccion acotada de tiempos/procesamiento antes de implementarla; no desactivar
el antivirus ni ampliar un timeout de Cloud Run como supuesto arreglo de Hosting.

### R07-02 - Saturacion y memoria pendientes

- `apps/web/src/composables/useDossierOperations.ts:85` permite dos operaciones
  en vuelo; cada archivo es una solicitud independiente. El lote de diez NO se
  envia como un unico JSON de 75 MiB.
- `apps/api/src/lib/document-security.ts:105` limita a dos validaciones por proceso.
- `services/document-security/server.mjs:63` rechaza trabajo simultaneo con 429;
  el acta cloud registra concurrencia/max instancias 1 en cada analizador.
- El cliente cloud convierte cualquier HTTP distinto de 200 en indisponibilidad;
  el 429 del scanner no se conserva necesariamente como 429 en la API. Probar
  el 503/estado incierto y el reintento, sin afirmar que exista cola global.
- Un PDF de 7.5 MiB equivale a unos 10 MiB Base64 antes de JSON; API admite
  12 MiB (`apps/api/src/app.ts:9`). El limite por archivo no mide memoria total:
  cuerpos concurrentes, copias, bytes y parser requieren medicion.

## 3. Ensayo propuesto PD-07

Primera etapa local, sin nube ni datos reales: Docker limitado, API/analizadores,
BD efimera sintetica y almacenamiento temporal. Usar archivos validos pequenos,
intermedios y de 7.5 MiB, PDF de muchas paginas y JPG/PNG dentro de limites vigentes.

Matriz acotada: 1 y 2 usuarios, 1 y 10 archivos por seleccion, servicios calientes
y arranque frio; red/retrasos controlados y saturacion deliberada breve. Registrar
RSS/pico, CPU, duracion por archivo/lote, respuestas 429/503/504, estados de
operacion, residuos, hashes e inventario final. Proponer antes de ejecutar un
limite de duracion/recursos; detener ante agotamiento, no hacer carga abierta.

Criterios: no OOM, no exito falso, no perdida/corrupcion, sin duplicados, limpieza
recuperable y respuestas comprensibles. Definir SLA operativo con el usuario tras
obtener medidas; no inventar un tiempo institucional ya aprobado. La simulacion
local de 60 segundos no reemplaza la futura prueba de Hosting aislado real.

Segunda etapa cloud, solo con autorizacion especifica de presupuesto/alcance:
repetir el recorrido equivalente en H24 con las revisiones finales. Los servicios
actuales de analisis aislado no equivalen por si solos a API+Hosting+BD final.
No desplegar ni conectar una API de prueba a la BD productiva.

## 4. Ensayo propuesto PD-08

Evidencia previa: el dump saneado anterior a 016 se restauro correctamente;
016 fue aplicada por H05, con 19 registros. 017 fue aplicada despues y dejo
20 registros/pending=0/mismatch=0. El backup anterior a 017 se creo, pero su acta
no acredita restauracion. No confundir esos pasos con un ensayo completo de release.

Preparar otro PostgreSQL efimero, puerto/volumen exclusivos y sin montar la BD
local actual. Por defecto usar fixtures sinteticos con esquema/registro H05
equivalente al estado anterior a H24; esto no valida volumen/distribucion reales.
Si se requiere realismo adicional, pedir aprobacion para usar exclusivamente el
dump ya anonimizado, sin exportar nuevamente produccion ni leer el dump crudo.

Secuencia propuesta:

1. Guardar identidad del contenedor y current_database, revision base y checksums.
2. Verificar estado previo esperado, solo 016/017 pendientes; no alterar historicos
   o checksums para forzar que el ensayo pase.
3. Backup previo y restauracion en segundo destino efimero; verificar integridad.
4. Aplicar 016 y 017 por H05 solo en el laboratorio, en orden, sin editar SQL.
5. Verificar conteos reales de H05, constraints, valores iniciales vacios C.P./CURP
   y fingerprints de datos previos; no interpretar fixtures como datos productivos.
6. Probar backup posterior/restauracion y comparar esquema, H05 y datos.
7. Probar revision API anterior contra esquema ampliado, si esta disponible, antes
   de afirmar rollback de codigo compatible. No proponer DROP de tablas/columnas
   para rollback ni restauracion productiva que pierda escrituras posteriores.
8. Retirar solo contenedores/volumenes del ensayo y documentar tiempos/resultados.

No ejecutar db:migrate, restore o reset contra el cluster local compartido.
El backup Cloud SQL, inspeccion de produccion y ventana final siguen requiriendo
autorizacion independiente aunque este ensayo pase.

## 5. Orden y autorizaciones

Recomiendo preparar/ejecutar primero PD-07 local por el riesgo de tiempos; puede
descubrir ajustes de arquitectura que deban preceder al ensayo final. PD-08 puede
avanzar en laboratorio separado sin cloud. La correccion UUID/tsx PD-06 sigue
requiriendo los tres puntos de autorizacion del informe residual.

Para pasar de esta revision a ejecucion: autorizar laboratorio Docker local y
BDs/almacenamiento efimeros exclusivamente sinteticos para PD-07/PD-08, con
limites y limpieza, incluyendo apply H05 016/017 solo alli. No implica cambios de
codigo, nuevas pruebas cloud, acceso a la BD local actual o deploy. Si aparece un
defecto que requiera cambio funcional o de arquitectura, presentar el ajuste.

PD-04: preguntar al usuario si recibio el correo de ensayo del 29 de octubre
alrededor de 13:30 Cancun, asunto `H24 isolated document security and recovery errors`,
en `victor.yama@tecplayacar.edu.mx`. No leer el buzon ni reenviar automaticamente.
Confirmar entrega no sustituye prueba de alerta por ausencia de ejecucion.

PD-05: mantener los cuatro casos de identidades pendientes sin crear cuentas ni
aceptar riesgo implicitamente. PD-03: aislamiento/visor requiere decision de
seguridad especifica, no se cierra por ser uso interno o archivos escaneados.

## 6. Confirmaciones

Solo revision/documentacion. Sin instalaciones, pruebas nuevas, acceso a BD,
escrituras cloud, produccion, migraciones, seeds, deploy, commit o push.
No se modifica H01, permisos, datos fiscales, Nomina ni snapshots.
Validaciones documentales: git diff --check y git status.
