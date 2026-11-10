# H24 - Candidata posterior: validacion fiscal y pago del Coordinador

Fecha: 2026-11-10. Estado: implementada y validada localmente; **no desplegada**.
Base publicada: `da151b8c35f39a43244b8733c309f8109fedf40d`, rama
`feature/h02-h03-user-coordinations-permissions`, inicialmente limpia y sincronizada.
No habia commits posteriores ni cambios ajenos al comenzar. No se encontro un
AGENTS.md aplicable con instrucciones adicionales en el repositorio/ancestros.

El [release H24](H24_Release_Condicionado_20261110.md) sigue cerrado operativo.
Su evidencia no se reescribe ni se atribuyen estas mejoras a la imagen desplegada.

## Causa y reproduccion

- `TeacherDossierPanel.saveFiscal()` reutilizaba `dossierError`, cuyo mensaje
  generico es apropiado para otras operaciones, pero ocultaba la causa fiscal.
  La API devolvia el primer error, sin un contrato de campos. La validacion local
  solo contemplaba pago, C.P. y CURP, no todos los rechazos actuales de la API.
- Directorio decidia el selector/payload y el backend decidia la escritura solo
  por `fiscal.manage` o administrador. Faltaba una prohibicion explicita por rol
  para `coordinador`. Un permiso accidental permitia alcanzar la logica SQL.
- En PATCH, `paymentType` ausente se convertia en `''` por el default del schema;
  con permiso fiscal podia vaciar el pago. Sin permiso se copiaba el valor leido
  antes del UPDATE, en vez de conservarlo directamente en la fila actual.
- Antes de corregir, ocho pruebas nuevas fallaron: seis por falta del contrato
  de campos y dos porque POST/PATCH no rechazaban antes de SQL al Coordinador
  con `fiscal.manage`. El mock incompleto devolvio 500 al alcanzar SQL/alcance;
  esto no demuestra un 500 productivo ni una asignacion real de ese permiso.
- No se consultaron sesiones, permisos ni expedientes productivos. La causa se
  acredita en codigo y fixtures locales, no se atribuye un fallo a produccion.

## Cambios

### Fiscal

- La API conserva `400`, `error: VALIDATION_ERROR` y `message`; agrega
  `fieldErrors`, mapa opcional de los seis nombres de campo a `INVALID_FORMAT`.
  Mensajes estaticos en espanol, sin valores rechazados, trazas ni detalle SQL.
  RFC/correo se validan dentro del mismo schema para identificar varios campos,
  con las mismas expresiones, normalizaciones y limites anteriores.
- El cliente conserva el contrato anterior de `ApiRequestError`, con un cuarto
  argumento opcional. El panel solo interpreta claves/codigos conocidos y usa
  textos propios: nunca muestra indiscriminadamente el mensaje del servidor.
- RFC, correo, C.P. fiscal, CURP, pago y banco tienen orientacion junto al campo,
  `aria-invalid`, `aria-describedby` y foco en el primer error. `novalidate`
  permite una experiencia uniforme sin quitar la validacion autoritativa API.
- Valores retenidos ante validacion/conflicto/fallo de servicio, errores que se
  actualizan al corregir y confirmacion fija de exito. Una perdida de sesion o
  permisos conserva el cierre de acceso existente y oculta datos sensibles.
- El guardado exitoso adopta la respuesta canonica, restablece dirty fiscal y
  renueva la version para telefono. Un telefono editado no se pierde ni se da
  por guardado al guardar fiscal. El aviso de cambios reales pendientes sigue.
- Se explica que fiscal/telefono tienen sus propios botones y cada operacion
  documental se guarda por separado. No se agrega Guardar todo.
- C.P. sigue siendo texto opcional; `00123` no pierde ceros. RFC/CURP conservan
  validacion de formato, no verificacion oficial SAT/RENAPO. Banco maximo140,
  correo maximo160; no se cambian reglas fiscales.
- `useDossierOperations.ts` fue revisado, no modificado. Sus mensajes y estados
  documentales, NOT_SCANNED y descarga sin contenido incrustado se conservan.

### Tipo de pago en Directorio

- Capacidad UI de pago separada de la capacidad fiscal existente: Coordinador
  no tiene selector en alta/edicion y ambos payloads omiten `paymentType`, aun
  con `fiscal.manage`. No se amplia la visibilidad fiscal ni se cambia categoria.
- POST/PATCH rechazan cualquier presencia explicita del campo para Coordinador
  antes de parsear/consultar SQL: `403`, `COORDINATOR_PAYMENT_FORBIDDEN`. Incluye
  vacio, null, formato invalido, otro pago y el mismo pago persistido.
- POST sin campo conserva `''` / Sin definir. PATCH usa CASE en SQL: solo escribe
  el pago si el actor esta autorizado, no es Coordinador y envio el campo;
  en otro caso conserva `payment_type` en la fila, sin copiar una lectura vieja.
- Ruta fiscal mantiene su guarda H24 y agrega defensa de pago por rol. Import
  preview/apply siguen Admin-only, con exclusion explicita de Coordinador incluso
  ante un indicador administrativo contradictorio. El import H22 no agrega
  campos fiscales al CSV; contacto del expediente solo escribe telefono.
- Propietario/ambito y permisos de otros roles se conservan. La denegacion
  historica por propietario sigue usando REQUEST_ERROR/400, sin cambiarla a403.
  Admin, Finanzas y RH conservan gestion fiscal autorizada.

## Pruebas y evidencia

Datos exclusivamente sinteticos. PostgreSQL18 en Docker temporal
`nomina-fiscal-qa-20261110`, host127.0.0.1:55491, DB `nomina_docente_test`, datos
en tmpfs. El runner de integracion aplica los SQL originales en esa base efimera,
incluida017; no crea ni modifica migraciones. No usa la BD local habitual.

Comandos npm ejecutados con CLI10.9.4 ya instalada, sin instalar dependencias:

| Validacion | Resultado |
|---|---|
| `npm run test:api` | 483 PASS, 21 omitidas historicas optativas, 30 suites PASS |
| `npm run test:api:integration` | 175/175 PASS, 24 suites, PostgreSQL efimero |
| `npm run test:web` | 194/194 PASS, 25 suites |
| `npm run typecheck` | API/web OK |
| `npm run build` | API/web OK |
| `git diff --check` | OK |
| Brave headless / Playwright local | 9 recorridos PASS, cero pageerror |

No se omitieron pruebas para lograr aprobacion. Las21 omitidas corresponden a
ensayos optativos historicos, no a la cobertura nueva. Se corrigieron errores
del harness nuevo (fixture incompleto, selector/acentos, expectativa de400 por
propietario y campos requeridos TypeScript) antes de repetir las validaciones.

Cobertura nueva: alta Sin definir, conservacion del pago en edicion operativa,
rechazos manipulados y rutas alternativas, Coordinador con/sin permiso fiscal,
ambito de otro propietario, gestores fiscales autorizados, rechazos sin escritura,
campos accesibles/foco, mensajes seguros, conservacion y correccion, C.P. con cero,
guardado posterior y dirty correcto. La suite existente cubre H01, cancelacion,
importacion, documentos y otros modulos sin modificar sus implementaciones.

UI real de componentes y estilos con API/sesion sinteticas (no login Firebase
ni smoke productivo): 1440x900,768x1024,390x844. Por resolucion: alta/edicion
Coordinador normal y con permiso accidental, y fiscal error/correccion/guardado.
Se verificaron payloads sin pago, foco, valores conservados, warning real,
confirmacion, controles accesibles por scroll y ausencia de overflow del panel.
Capturas revisadas visualmente; logs, harness y18 PNG locales en
`C:\Users\Admin\AppData\Local\NominaDocente\H24-FiscalUX-20261110`.
No se publican fixtures, credenciales ni capturas de datos reales.
Al terminar se cerraron Brave/Vite de prueba y se retiro el contenedor PostgreSQL
efimero, incluido su tmpfs. Se conservan solo las evidencias locales indicadas.

## Despliegue y rollback propuestos, no ejecutados

1. Obtener autorizacion para una ventana nueva. Verificar SHA publicado, pruebas,
   arbol limpio y metadatos vigentes; no asumir vigencia solo por este documento.
2. Referencia historica de rollback para ESTA candidata: API00058-baw, digest
   `sha256:f1aafc5cbc0d4f8a658c1bede3abb9af656ef3a48b3e1b584ab632f052958303`,
   Hosting release1794347521818000/version9aaf70a74e0005e7. Reconfirmar y registrar
   antes de desplegar. No confundir con00057, rollback del release H24 anterior.
3. Construir/publicar imagen de esta candidata y desplegar API primero, luego
   Hosting; contrato de errores compatible. Sin migraciones ni cambios cloud
   ajenos a ese release. Mantener worker/Scheduler/buckets/IAM/alertas actuales.
4. Health200 directo/via Hosting, sesion no autenticada401, smoke autorizado con
   datos sinteticos: gestores fiscales, seis errores/correccion, telefono dirty,
   Coordinador normal y payload manipulado403, alta Sin definir y edicion sin
   cambio de pago, permisos/alcance intactos y movil. Verificar logs.
5. Ante regresion critica, restaurar Hosting y trafico a las versiones previas
   verificadas. Sin down migrations, restauracion rutinaria de BD ni cambios al
   worker. El rollback de API retiraria tambien la nueva prohibicion explicita;
   registrarlo y no declarar vigente esa defensa tras volver a la imagen previa.

Pendiente: autorizacion de release y smoke real de la nueva candidata. No queda
ninguna migracion ni infraestructura nueva requerida por estas adecuaciones.

## Confirmaciones

Sin acceso ni cambios productivos, deploy, cambios de roles reales o IAM,
modificaciones de buckets/worker/Scheduler/alertas, H01 o calculos de Nomina.
Sin dependencias, analizadores ni GitHub Actions. Sin escrituras a expedientes
reales. El cierre operativo H24 y su historial se conservan.
