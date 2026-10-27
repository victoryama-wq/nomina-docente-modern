# H24-F2 - Frontend del expediente completo de docentes

Fecha: 2026-10-27.

Estado: **Frontend implementado y validado localmente con API simulada. H24 no cerrado operativo; integracion real F3 y despliegue pendientes.**

## 1. Alcance y precheck

Rama: `feature/h02-h03-user-coordinations-permissions`. Arbol inicialmente limpio,
HEAD `9179051 feat(h24): add teacher dossier model and backend`, alineado con el
tracking local de origin al comenzar. No se hizo fetch/push ni se consulto produccion.
Typecheck web previo a las modificaciones: OK.

Se implementa solo frontend sobre el contrato H24-F1, sin modificar API, SQL,
configuracion de infraestructura ni dependencias. SPEC y diseno H24 conservan la
autoridad funcional. No se actualizan manuales como funcionalidad productiva.

## 2. Entrada, roles y alcance

`FiscalRecordsView.vue` conserva Constancia, sus formatos PDF/JPG/PNG y operaciones
existentes. Agrega columna Expediente con ojo, nombre accesible y tooltip. La
columna de porcentaje se llama Avance fiscal; su formula y los exportables no cambian.

`canViewFiscalRecords` limita menu, ruta y contenido a usuarios activos Admin,
Finanzas/RH. Admin protegido conserva la excepcion existente. Finanzas/RH necesitan
`fiscal.view` o `fiscal.manage`; dentro del panel se respetan las capacidades por
accion devueltas por API. Gestion documental requiere permiso documental; telefono
requiere edicion fiscal. No se modifican los helpers fiscales compartidos usados
por Finanzas, Directorio u otros modulos. No se escribieron roles/permisos.

Coordinador, Direccion/Subdireccion y Contador/Contabilidad quedan fuera del modulo
incluso con permisos fiscales amplios. La API F1 sigue siendo autoridad. La
visibilidad no sustituye el control backend y no constituye un smoke autenticado.

## 3. Panel y documentos

`TeacherDossierPanel.vue` muestra identidad, telefono, documentos y operaciones.
Tipos: CURP, Acta de nacimiento, Cedula profesional, Titulo y Otro. Permite:

- Seleccionar hasta diez PDF por lote; 7.5 MiB por archivo, no vacios, extension/MIME y nombre validos.
- Asignar tipo comun antes de seleccionar y editar tipo/titulo individualmente.
- Cargar archivos validos con maximo dos transferencias simultaneas; un rechazo no duplica los exitosos.
- Conservar varios PDF del mismo tipo o nombre, sin reemplazo implicito.
- Editar titulo/tipo usando revision esperada.
- Reemplazar un PDF solo sobre el documento seleccionado expresamente.
- Eliminar con confirmacion nominal irreversible; una limpieza pendiente no se anuncia como eliminacion final.
- Consultar y descargar con autenticacion, sin mostrar UUID, buckets, tokens ni Base64.

No se incorpora criterio de expediente completo para pagos. Los archivos personales
no forman parte del avance fiscal ni de CSV fiscales existentes.

## 4. Contratos, reintentos y cierre

`api.ts` define DTOs y adaptadores de los ocho endpoints F1 existentes. DELETE usa
JSON con `operationId` y `expectedRevision`; contacto solo envia telefono/version/id.
No se crean endpoints ni se cambia el contrato backend.

`useDossierOperations.ts` implementa cola y resultados por archivo/operacion:

- HTTP 200 con `FAILED` es fallo, no exito. Solo `COMPLETE` termina satisfactoriamente.
- `PREPARED`, `CLEANUP` y `ABORTING` se muestran pendientes. Consulta de estado cada
  tres segundos, como maximo veinte intentos automaticos; despues queda consulta manual.
- Fallo de transporte, respuesta incierta o 429 permite reintento explicito con el
  mismo ID/payload; no hay reenvio automatico ciego. 409 pide recarga; 403 retira
  contenido/capacidades y detiene nuevas transferencias en cola. 503 no oculta la
  indisponibilidad del backend deshabilitado por defecto.
- Una carga con `FAILED` terminal admite nuevo intento deliberado del archivo con
  nuevo ID. No vuelve a cargar los exitosos. Rechazos de validacion requieren corregir
  archivo/datos; reemplazo o edicion fallidos se revisan contra la revision recargada.
- El cierre del panel advierte trabajo pendiente; mantiene la instancia y permite
  reabrirla durante la misma visita. No permite cambiar de docente con trabajo pendiente.
- Salir de la ruta o recargar advierte perdida de la cola local. Las operaciones
  aceptadas no se cancelan por cerrar; el worker durable F1 es responsable de recuperarlas.
  Al desmontar no se inician nuevos envios en cola.

No se guardan archivos, Base64, telefono ni cola en localStorage/sessionStorage.
La recuperacion automatica de IDs tras recargar la pagina no esta implementada;
se debe confirmar el resultado mediante recarga del expediente y, si sigue
pendiente, soporte/worker. No reintentar un lote entero con IDs nuevos sin revisar.
Este limite queda expresamente pendiente de validacion integral F3.

## 5. Telefono y Directorio

Guardado explicito separado de la gestion documental/fiscal, validacion de 10 a
15 digitos y prefijo internacional opcional, version opaca de F1 sin convertirla
a Date. No envia RFC, correo, banco, responsable, categoria ni ficha completa.

Tras confirmar, relee el valor canonico de `teachers.phone` y actualiza la ficha
local. Directorio consume el mismo campo al volver a consultar, sin duplicar BD
ni prometer actualizacion en tiempo real entre sesiones. Un conflicto requiere
recarga/revision; no sobrescribe silenciosamente.

## 6. Preview, responsive y seguridad

Preview y descarga usan fetch autenticado, validan `application/pdf`, tamano y
cabecera `%PDF-`, y crean Blob PDF local; nunca se acepta HTML ni URL remota como
fuente del visor. La verificacion cliente no sustituye al parser/escaneo backend.
Se revoca objectURL al cerrar, cambiar documento o desmontar; respuestas tardias
no vuelven a abrir un PDF cerrado. La descarga se reautoriza por API.

Hallazgo local: Brave bloquea su visor PDF nativo dentro de iframe con `sandbox`,
tanto con `allow-same-origin` como con `allow-scripts` individual. Se conserva el
patron de visor nativo autenticado del sistema, sin atributo sandbox HTML, con
`referrerpolicy=no-referrer` y las comprobaciones PDF anteriores. No se usa srcdoc,
v-html, render HTML ni libreria externa. El aislamiento efectivo depende del visor
PDF del navegador; no afirmar aislamiento HTML sandbox ni ausencia de malware.
La seguridad de archivos/visor sigue como gate F3 antes de habilitar produccion.

Validacion con Playwright instalado y Brave headless, datos sinteticos y respuestas
API simuladas. Red externa bloqueada; solo loopback y recursos internos del visor.
No se inicio sesion Firebase ni se abrio un expediente real.

| Resolucion | Panel/cola | Overflow horizontal | Preview PDF sintetico / descarga |
|---|---|---|---|
| 1440x900 | OK | No | OK |
| 768x1024 | OK | No | OK |
| 390x844 | OK, controles apilados | No | OK |

Foco visible, tabulacion contenida, Escape, labels y mensajes accesibles. El panel
restaura foco al cerrar. Validar adicionalmente lectores de pantalla y dispositivos
moviles reales en F3; no equiparar viewport movil de escritorio con un telefono real.

Evidencia local temporal no versionada: `.cache/h24-f2-*-preview.png`,
`.cache/h24-f2-*-queue.png` y `.cache/h24-f2-*.png`. El harness visual temporal no
se incorpora al build ni constituye bypass de autenticacion de la aplicacion.

## 7. Pruebas

| Validacion | Resultado |
|---|---|
| `npm run test:web` | 139/139, 23 archivos |
| `npm run test:api` | 145/145, 13 archivos; parser PDF local configurado |
| `npm run typecheck` | API/web OK |
| `npm run build` | API/web OK, sin publicar |
| `git diff --check` | OK |
| Brave local | Tres resoluciones, carga simulada, preview PDF real sintetico y descarga OK |

La primera corrida API omitio ocho pruebas por no tener `DOSSIER_PDFINFO_PATH`.
Se repitio con Poppler local existente y las 145 pasaron. No se instalaron herramientas.

Cobertura nueva: matriz de roles, capacidades por accion, columna de expediente y
constancia intacta, telefono/version/payload, lote mixto/limites, concurrencia dos,
reintento idempotente, fallo terminal y nuevo intento individual, polling acotado,
confirmacion/cleanup, metadata/reemplazo, preview/revocacion, respuestas tardias,
desmontaje sin nuevos envios, codigos de error y MIME/cabecera/filename de descarga.

No se ejecuto `test:api:integration`: F2 usa mocks y no modifica BD. La evidencia de
integracion real F1 se conserva en su acta; no se presenta como repetida en F2.
Prueba end-to-end con API F1, storage de test y permisos reales queda para F3.

## 8. Pendientes y confirmaciones

H24-F2 listo para integracion F3, **no autorizado para deploy**. Pendientes:
sesiones reales autorizadas en entorno local/test, efectos persistidos de telefono,
reemplazo/borrado real, revocacion durante transferencias, recuperacion tras recarga,
capacidad y seguridad del visor/PDF. Se conservan gates F1 de storage privado sin
retencion incompatible, parser/escaneo aprobado, worker, backup y migracion 016 H05.

Sin cambios backend, SQL, BD, migraciones, produccion, deploy, secretos, variables
productivas ni dependencias. Sin cambios H01, Nomina, Finanzas, snapshots/corridas,
constancias historicas, datos fiscales o reglas de importacion. No se cargaron
documentos personales reales. No se hizo commit ni push en esta fase.
