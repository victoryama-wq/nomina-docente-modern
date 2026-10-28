# H24 - Ficha unificada y sustitucion de constancia

Fecha: 2026-10-28.
Rama: `feature/h02-h03-user-coordinations-permissions`.
Base de trabajo: `158bce9`; habia cambios AUTH-01 pendientes, conservados.
Estado: implementacion y pruebas locales; **no desplegado, H24 sigue NO-GO**.

Seguimiento posterior del 2026-10-28: el usuario autorizo preparar almacenamiento
aislado de constancias. Bucket, IAM y prueba real del adaptador completados;
API local configurada para el ensayo manual. Ver
[preparacion y resultado GCS](H24_Constancias_Preparacion_Prueba_GCS.md). El usuario
realizo carga A y sustitucion por B; verificacion posterior: A eliminado, B unica
vigente con hash correcto, cero pendientes, docentes/snapshots intactos. Quedan
fallos/worker y gates restantes; no se confunde el flujo nominal con esas pruebas.
Las limitaciones de almacenamiento descritas abajo
corresponden al momento de implementar este ajuste.

## 1. Revision humana y alcance

El usuario aprobo la distribucion del panel y las versiones web/movil existentes,
con observacion del fondo/ancho de la columna Expediente. Confirmo reunir los
campos del modal fiscal dentro del expediente y dejar Constancia dedicada al
archivo. Aprobo expresamente borrar fisicamente la constancia sustituida.

La aceptacion visual anterior no se presenta como aprobacion manual del nuevo
formulario ni como ensayo GCS real del nuevo reemplazo. Estos cambios se
validaron con pruebas automatizadas y UI sintetica sin sesion productiva.

## 2. Cambios de interfaz

- La tabla tenia cinco anchos que sumaban 100% y una sexta columna sin ancho.
  Se distribuyen las seis columnas; Expediente centra el ojo, comparte fondo
  y altura/borde de fila. Conserva nombre accesible, tooltip y foco visible.
- Expediente reune RFC, correo, tipo de pago, banco/cuenta/CLABE, telefono
  operativo y PDF adicionales. No hay columnas nuevas ni datos duplicados.
- Datos fiscales conservan `updateTeacherFiscal` y sus validaciones backend;
  telefono conserva su endpoint y guardado/version independiente.
- Tras guardar fiscal se relee la version del telefono, conservando un borrador
  local de telefono. Guardados fiscales y de telefono no se envian a la vez.
- Cambios fiscales no guardados participan en las advertencias al cerrar/salir.
  Un 401/403 retira el contenido y acciones del panel.
- Constancia conserva preview y descarga, y cambia su boton a **Actualizar
  constancia**. Su modal solo selecciona archivo; no envia PATCH fiscal.
- Carga multiple/clasificacion/preview/borrado de los PDF adicionales conserva
  su flujo existente. No se ampliaron roles ni permisos.

## 3. Reemplazo y borrado definitivo

El flujo anterior guardaba el archivo nuevo y marcaba la metadata anterior como
no vigente, pero no borraba sus bytes. No era equivalente a eliminacion fisica.

`constancia-replacement.ts` implementa:

1. Guarda de rol/accion existente y autorizacion del docente antes de storage.
2. Verificacion de politica privada del bucket sin versionado, soft delete,
   retencion ni holds. Si no se puede comprobar, falla cerrado con 503 controlado.
3. Admision durable en `teacher_documents`, estado no vigente
   `CONSTANCIA_FISCAL_STAGING`, objeto UUID inmutable y carga create-only.
4. Bloqueo del staging durante upload para impedir recreacion por un proceso
   reanudado despues de una limpieza. Timeout de upload: 30 segundos.
5. Bloqueo del docente y staging; reautorizacion; publicacion, retiro de la
   version antes vigente y auditoria en una transaccion.
6. Borrado posterior al commit de la version retirada, con precondicion de
   generacion GCS y comprobacion de que nadie la referencia como vigente.
7. Si falla borrado, conserva `CONSTANCIA_FISCAL_DELETE_PENDING`, devuelve
   `cleanupPending=true` y un aviso persistente que indica no repetir la carga.
8. Worker existente recupera pendientes y staging abandonado (>24 horas), con
   lote maximo de 25. Tras borrar conserva metadata `CONSTANCIA_FISCAL_DELETED`.
   Un 404 de objeto ya eliminado es idempotente; 403/412/500 no son exito.

No se agregaron columnas, tablas permanentes ni migraciones. `document_type`
ya es text; los tres valores internos nuevos son siempre `is_current=false`.
El vigente conserva `CONSTANCIA_FISCAL`, con el indice unico y joins existentes.
La metadata es evidencia, no una copia de los bytes retirados. No se purga el
historial ya no vigente anterior a este flujo. No hay borrado masivo de bucket.

## 4. Permisos y datos

Admin conserva acceso completo; Finanzas/RH requieren los permisos fiscales o
documentales de la accion. Los demas roles siguen denegados. Telefono no cambia
RFC/banco y la carga de constancia no cambia campos fiscales de `teachers`.
Los datos se siguen guardando en su fuente existente y Directorio los relee.

Las pruebas nuevas usan exclusivamente datos sinteticos. No se modificaron
datos fiscales reales, roles, usuarios, Nomina, H01, corridas ni snapshots.
La correccion AUTH-01 previa permanece separada conceptualmente y sin revertir.

## 5. Validaciones

| Validacion | Resultado |
|---|---|
| `npm run test:api` | 204/204; incluye 34 pruebas nuevas de reemplazo, adaptador y API |
| `npm run test:web` | 144/144; fiscal agrupado, permisos independientes, solo archivo y version del telefono |
| Integracion focalizada `constancia-replacement.integration.test.ts` | 1/1 en `nomina_docente_test`, loopback 55440 |
| Ensayo SQL adicional | Publicacion, fallo de borrado, reintento, segunda sustitucion e indice unico correctos |
| Fingerprints persistentes antes/despues | Sin cambios |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `git diff --check` | OK |

La integracion crea solo tablas `pg_temp`, con estructura/indice tomados del
esquema real, y termina en ROLLBACK. No resetea la BD de revision, no aplica
migraciones ni ejecuta seeds. Storage de esa prueba es sintetico en memoria;
GCS se simula en pruebas del adaptador. No acredita borrado real en GCS.

Brave headless con perfil efimero y API/auth simuladas, sin usar la ventana de
invitado del usuario: **1440x900, 768x1024 y 390x844**. Sin overflow horizontal
general o del panel; tabla con scroll propio; seis columnas; fondo de Expediente
igual al de su fila; campos de 44 px y modal de constancia exclusivamente archivo.
Se inspeccionaron capturas locales de escritorio/movil. Evidencia temporal
ignorada por Git: `.cache/h24-ux-*`. No se incluyeron datos institucionales.

API local reiniciada con su lanzador H24 que verifica base/host/puerto antes de
arrancar. Health `127.0.0.1:8084/api/health`: 200; sesion sin token: 401;
frontend `http://localhost:5184`: 200. Servicios disponibles para revision.
No se cerro ni controlo la ventana de invitado del usuario ni se revoco su sesion.
La configuracion local de constancias sigue apuntando al recurso de prueba no
provisionado: no realizar cargas de constancia hasta completar su gate GCS.

## 6. Pendientes y gates

- Confirmacion manual del nuevo formulario por el usuario en local.
- Preparar y autorizar un bucket aislado **de constancias**, separado del bucket
  de PDF adicionales. No se creo ni configuro ningun recurso GCS en este ajuste.
- Ensayar reemplazo, borrado fisico, permisos, ausencia de versiones retenidas,
  fallos y worker real en ese bucket. PD-02 anterior no cubre este nuevo flujo.
- Validar worker programado/alertas (PD-04). Se implemento recuperacion, no se
  afirmo que exista programacion productiva o borrado eventual garantizado sin ella.
- Antes de deploy, inspeccionar/autorizar politica del bucket de constancias;
  si retiene versiones o falta IAM, el nuevo flujo se bloquea. No cambiarlo
  automaticamente ni eliminar archivos historicos para resolverlo.
- Mantener gates de seguridad PDF, capacidad, dependencias y release H24.
  El flujo fiscal conserva compatibilidad PDF/JPG/PNG y sus validaciones actuales;
  esta fase no acredita antivirus ni extiende pdfinfo a las constancias.

No deploy, no produccion, no migracion, no cambios persistentes de BD en esta
ejecucion, no nuevas dependencias, no `npm audit fix`. No commit ni push automatico.
