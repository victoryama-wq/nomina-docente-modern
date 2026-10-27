# H24-F3 - Integracion local del expediente completo

Fecha: 2026-10-27.

Estado: **Validacion local aprobada con observaciones; no autorizado para deploy.
H24 no cerrado operativo.**

## 1. Alcance y ambiente

Rama `feature/h02-h03-user-coordinations-permissions`, HEAD inicial `9a1aafc`
(`feat(h24): add teacher dossier frontend`); arbol limpio al iniciar. F1 `9179051`.
No se hizo fetch, push ni consulta productiva. Esta fase no cambia el estado
productivo documentado de H05 ni aplica 016 en produccion.

- PostgreSQL 18.3 local, `127.0.0.1:5432`, exclusivamente `nomina_docente_test`, usuario `app_nomina`.
- Datos sinteticos H04; el harness reconstruye public y aplica los SQL existentes,
  incluida 016, exclusivamente en test. No se creo ni modifico SQL.
- Fastify completo escuchando en loopback y puerto efimero; Vue/Vite en `127.0.0.1:5178`.
- Brave headless mediante Playwright previamente instalado; no nuevas dependencias.
- Storage local real en directorio privado temporal; PDF sinteticos generados con
  PDFKit existente y validados por Poppler `pdfinfo` local. Ningun archivo personal real.
- Proyectos de entorno `demo-nomina-h24-test`; sin credenciales Google ni llamadas
  Firebase/Cloud SQL/GCS. Navegador limitado a loopback y recursos internos del visor.

La identidad Firebase se sustituye solo en el harness por los actores sinteticos
del mecanismo existente de pruebas `NODE_ENV=test`. No se simulan respuestas de
API, PostgreSQL o storage. La autorizacion y las operaciones usan los servicios
reales; esto **no prueba login Firebase real ni IAM/bucket GCS**.

## 2. Recorrido real HTTP / UI / BD / archivos

| Caso | Evidencia y resultado |
|---|---|
| Carga multiple | Tres PDF validos y un TXT invalido; se cargan solo tres, con maximo dos transferencias simultaneas |
| Multiplicidad | Dos PDF del mismo tipo y nombre permanecen como documentos distintos |
| Preview | PDF sintetico visible en visor nativo de Brave, obtenido por API autenticada |
| Descarga | SHA-256 de bytes identico al original; nombre con acento conservado tras correccion CORS |
| Clasificacion | Cambio de titulo y tipo persistido, sin cambiar UUID del documento |
| Reemplazo | UUID estable, revision incrementada, bytes nuevos verificados contra disco y objeto anterior eliminado |
| Telefono | Numero sintetico normalizado guardado en teachers.phone y visible al abrir la ficha de Directorio tras nueva consulta |
| Respuesta perdida | Se corta solo la respuesta despues de una carga HTTP realmente aceptada; reintento con misma operacion no crea duplicados |
| Recarga | Tras recargar pagina, los cuatro documentos aceptados aparecen; no se afirma restauracion de cola pendiente local |
| Borrado | Confirmacion individual, documentos ausentes en listado, contenido 404 y directorio fisico vacio antes del cleanup del harness |
| Responsive | 1440x900, 768x1024 y 390x844, sin overflow horizontal general ni del panel; capturas revisadas |

Resultado final del recorrido: `passed=true`, `physicalDeletionProven=true`,
`filesRemaining=[]`. El cierre del harness elimina su directorio temporal; esa
limpieza se distingue del borrado ya demostrado por la aplicacion.

## 3. Permisos y seguridad

| Actor sintetico | UI y HTTP real |
|---|---|
| Admin | Ciclo completo de documentos y telefono aprobado |
| Finanzas / RH | Panel y controles segun capacidades; lectura de metadata y PDF 200 |
| Coordinador / Direccion / Contador / Contabilidad | Sin acceso UI; metadata y bytes 403 |
| Sin sesion | 401 |

Los 27 casos H24 de la suite PostgreSQL complementan el navegador: mutaciones
Admin/Finanzas/RH, permisos por accion, usuarios inactivos, revocacion durante
carga/reemplazo, IDs de otro docente, revisiones obsoletas, concurrencia,
idempotencia y auditoria, rechazos PDF/Base64/tamano, recuperacion durable,
indisponibilidad de parser/storage y borrado que permanece pendiente hasta
completar la eliminacion fisica. No se cambia la matriz de permisos.

Los fingerprints antes/despues del recorrido UI son identicos para las tablas
protegidas: constancias, horarios, incidencias, extras, corridas, snapshots,
roles/permisos, ciclos/calendarios y campos de teachers ajenos al contacto.
El otro docente conserva su fila completa. El telefono modifica su valor y
campos de auditoria previstos; las operaciones del expediente generan sus
registros/auditoria locales. **Si hubo escrituras sinteticas en test.**

Limite de evidencia: el fixture del navegador contiene 7 horarios, 3 incidencias,
5 extras y 6 corridas, pero cero lineas/snapshots y constancias. No se presenta un
hash de tabla vacia como prueba de conservacion de contenido historico real.
La suite H24 incluye ademas constancias y campos fiscales sinteticos para verificar
que el ciclo documental y el telefono no los alteran. No se consultaron fiscales
reales ni se extrajo informacion productiva.

## 4. Hallazgo y correccion minima

La primera ejecucion HTTP/Brave reprodujo una descarga denominada `documento.pdf`
en lugar de `Identidad sintética.pdf`, aunque los bytes eran correctos. El backend
ya enviaba `Content-Disposition`, pero no lo exponia a JavaScript bajo CORS cuando
web/API tienen distinto origen. Las pruebas con respuestas simuladas F2 no
detectaban esta diferencia del navegador.

Se agrega exclusivamente `Access-Control-Expose-Headers: Content-Disposition`
en la respuesta de contenido PDF de `teacher-dossier.ts`. No se amplian origenes,
metodos, credenciales, roles ni URLs. Se agrega asercion de regresion en el caso
de headers/filename Unicode de `api-h24-dossier.integration.test.ts`.
El mismo recorrido que fallaba pasa con el cambio. No se modifica frontend,
calculos, esquema, contrato de operaciones ni logica fiscal.

Una espera inicial del harness buscaba telefono en la tabla de Directorio, cuando
el dato esta en su ficha. Se corrigio el selector de prueba para abrir la ficha;
no fue defecto de la aplicacion ni se cambio Directorio.

## 5. Ejecucion reproducible

Archivo: `tools/validation/h24-dossier-local-ui.mjs`, fuera del build de la app.
Requiere puerto 5178 libre. **Destruye/reconstruye public en la BD test** mediante
el harness existente; no ejecutarlo sobre datos locales que deban conservarse.
Rechaza DB distinta, host no loopback, NODE_ENV production y Cloud SQL instance.
No ejecutar concurrentemente con otras suites que usen esa base.

```powershell
$env:H24_LOCAL_RESET_APPROVED='true'
$env:TEST_DB_HOST='127.0.0.1'
$env:TEST_DB_PORT='5432'
$env:TEST_DB_NAME='nomina_docente_test'
$env:TEST_DB_USER='app_nomina'
# TEST_DB_PASSWORD: credencial local/test, configurar sin registrarla.
# Rutas absolutas a herramientas previamente instaladas:
$env:H24_PLAYWRIGHT_MODULE='<ruta a node_modules/playwright>'
$env:H24_BROWSER_PATH='<ruta a brave.exe>'
$env:DOSSIER_PDFINFO_PATH='<ruta a pdfinfo.exe>'
node --import tsx tools/validation/h24-dossier-local-ui.mjs
```

Evidencia temporal no versionada: `.cache/h24-f3-ui/result.json`, capturas
`panel-1440.png`, `panel-768.png`, `panel-390.png`, `preview.png` y PDF sintetico
descargado. Los servidores y el navegador del harness se cierran al terminar;
no se modifico ni detuvo el Vite previo del usuario en 5173.

## 6. Validaciones automatizadas

| Comando / ensayo posterior a la correccion | Resultado |
|---|---|
| `npm run test:api` | 145/145, 13 archivos |
| `npm run test:web` | 139/139, 23 archivos |
| `npm run test:api:integration` | 158/158, 17 archivos, incluye 27 casos H24 |
| `npm run typecheck` | API y web OK |
| `npm run build` | API y web OK, sin publicar |
| Harness HTTP/Brave | Aprobado; 15 comprobaciones registradas |
| `git diff --check` | OK |

Poppler configurado, sin omitir sus ocho casos de prueba, y TEST_DB_NAME exacto
en PostgreSQL. Logs finales en `.cache/h24-f3-test-api.log`,
`h24-f3-test-web.log`, `h24-f3-test-api-integration.log`,
`h24-f3-typecheck.log` y `h24-f3-build.log`.

Consulta read-only posterior confirma `nomina_docente_test`, usuario `app_nomina`,
cero documentos/operaciones de expediente. El reset de integracion aplica los SQL
directamente y deja **cero filas en schema_migrations**: no se hizo baseline H05 ni
se afirma pending=0 en este estado de test. Las 19 migraciones del filesystem se
aplican por el harness, pero no se registran en H05. Esto reemplaza el estado local
previo de F1, no el estado productivo, que no se consulto ni modifico.

## 7. Observacion del entorno local

El respaldo preventivo opcional con pg_dump 18.3 fallo:
`schema with OID 3776149 does not exist`. La inspeccion local identifico la funcion
`prevent_protected_super_admin_removal` referenciando ese namespace ausente.
Tambien fallo el intento limitado a public. **No hay backup exitoso de esta fase**;
no se repararon catalogos internos ni se supone la causa de la inconsistencia.

La primera corrida de integracion se detuvo durante la reconstruccion del esquema
al revisar esta observacion; no cuenta como exito. Se reconstruyo de nuevo solo la
base sintetica de test y se repitieron las validaciones. Esta observacion requiere
revision separada del PostgreSQL local antes de usarlo para respaldos confiables.
No es evidencia de un problema en Cloud SQL, que no se consulto.

## 8. Pendientes y recomendacion

Integracion local F3 **aprobada con observaciones**. Antes de habilitar H24:

- Probar sesiones Firebase reales autorizadas en ambiente aislado, sin datos productivos.
- Validar GCS de prueba, permisos IAM y politica efectiva de retencion/versionado/soft delete compatible con eliminacion definitiva.
- Aprobar/provisionar parser y escaneo PDF; `pdfinfo` no certifica ausencia de malware.
- Validar worker programado, recuperacion tras reinicio de proceso/infraestructura y capacidad sostenida; el ensayo local de reconciliacion no prueba Cloud Run/Cloud Scheduler.
- Completar accesibilidad asistiva y dispositivos moviles reales; un viewport de Brave desktop no equivale a telefono fisico.
- Mantener advertencia de cola no persistida; tras recarga, revisar lo aceptado antes de reenviar archivos con IDs nuevos.
- Resolver observacion de backup local por separado. Release posterior requiere H05/H13, backup productivo propio y aprobacion explicita.

Sin produccion, deploy, nuevas dependencias, audit fix, cambios H01, migracion
productiva, cambios de reglas de Nomina/Finanzas o snapshots productivos. No se
hicieron commit ni push en esta fase. Los manuales no se actualizan como si H24
estuviera disponible en produccion.
