# SPEC H24 - Expediente completo de docentes

Fecha: 2026-10-27.

Estado: **H24-F1/F2 implementadas; H24-F3 integracion local validada con observaciones. PD-02 GCS aislado cerrado tecnicamente; autenticacion real y gates productivos pendientes. No cerrado operativo.**

H24-F4: preparacion predeploy completada, **NO-GO para deploy/habilitacion**.
Ver [predeploy y bloqueantes](../auditoria/H24_Fase4_PreDeploy_Expediente_Docentes.md):
Auth real pendiente, seguridad PDF, worker,
capacidad, triage npm y ensayo H05/backup. No cambia las decisiones funcionales.

Seguimiento 2026-10-29: [servicios cloud privados y recuperacion aislada](../auditoria/H24_PD03_PD04_Arquitectura_Cloud_Aislada.md)
autorizados y probados, sin produccion. Scheduler manual verificado y pausado;
recepcion de alerta externa y controles residuales pendientes. Se conserva NO-GO, alcance
funcional y roles. No se presenta H24 como funcionalidad productiva.

Seguimiento 2026-10-28: [PD-03 A3 local](../auditoria/H24_PD03_A3_Controles_PDF_ClamAV_Local.md)
implementa pipeline PDF/ClamAV para constancias/adicionales y revalidacion de
lectura/recuperacion, sin BD/nube. Rechazo antes de publicar y sin retirar el
anterior; indisponibilidad no equivale a limpio. JPG/PNG mantienen compatibilidad,
con decodificacion acotada pendiente. Politica completa PDF, historicos, visor
y transporte cloud no aprobados/validados por esa entrega. H24 sigue NO-GO.
Seguimiento [A4](../auditoria/H24_PD03_A4_Integracion_PDF_ClamAV_GCS.md): autorizado
y aprobado en API/BD test/GCS, 16 grupos con restitucion exacta; no modifica
decisiones funcionales ni representa smoke visual/Auth real o cierre PD-03.

Politica PD-03 aprobada posteriormente, puntos 1-3: imagenes JPG/PNG estaticas hasta
25 MP y 10 000 px por lado, decodificacion completa aislada, politica PDF estructural
y originales sin transformacion. Historicos se revalidan al leer; rechazo bloquea
preview/descarga sin eliminar original, indisponibilidad permite reintentar sin
bypass. VIEW-02 corregido y probado. [Implementacion local y limites](../auditoria/H24_PD03_Implementacion_Imagenes_PDF_Visor_Local.md).
No modifica permisos ni formatos de PDF adicionales. Nueva integracion test/GCS,
compatibilidad institucional, aceptacion residual del visor y cloud pendientes.
H24 sigue NO-GO; las menciones previas de politica pendiente son antecedentes A3/A4.

Seguimiento 2026-10-29: nueva integracion de politica en test/GCS autorizada como
punto 4 separado. Ver [evidencia y restitucion](../auditoria/H24_PD03_Integracion_Politica_Imagenes_PDF_GCS.md).
Resultado: 19 grupos aprobados y restitucion exacta de 26 tablas/inventarios.
No modifica contratos, roles, limites ni decisiones funcionales. Los pendientes
del visor y transporte cloud permanecen; no implica habilitacion productiva.

PD-02 acredita GCS real solo en test; ver
[resultado aislado](../auditoria/H24_PD02_Resultado_GCS_Aislado.md).
PD-05 tiene [plan y seguimiento](../auditoria/H24_PD05_Plan_Validacion_Firebase_Auth_Real.md),
con validacion real parcial en H24 y AUTH-01 cerrado tecnicamente en ese entorno;
sesiones avanzadas y gates restantes siguen pendientes. Estos ensayos no habilitan
configuracion productiva ni constituyen aprobacion de deploy.

Seguimiento PD-01 cerrado localmente: imagen Linux de `95026bf` construida,
pdfinfo 22.12.0 y smoke 12/12 en build/runtime aislado, tambien como usuario node.
No implica deploy ni cierre de seguridad PDF o de H24. Evidencia:
[correccion local pdfinfo](../auditoria/H24_Fase4_Correccion_Parser_Pdfinfo.md).

Evidencia F3: [Integracion local del expediente](../auditoria/H24_Fase3_Validacion_Integracion_Expediente_Docentes.md). Brave usa API y archivos reales sinteticos, con identidad de test; no constituye smoke Firebase ni validacion GCS.

Evidencia F2: [Frontend del expediente](../auditoria/H24_Fase2_Frontend_Expediente_Docentes.md). Esa fase no cambio backend/BD ni produccion; su pendiente de integracion local se verifica en F3.

Evidencia F1: [Modelo y backend](../auditoria/H24_Fase1_Modelo_Backend_Expediente_Docentes.md). La decision de implementar F1 es posterior al cierre documental F0; no autoriza produccion.

Diseno complementario: [DISENO_TECNICO_H24_Expediente_Completo_Docentes.md](../diseno/DISENO_TECNICO_H24_Expediente_Completo_Docentes.md).

## 1. Objetivo

Ampliar Expediente Fiscal para administrar documentos personales y academicos del docente, conservando su constancia fiscal y los permisos por accion. Permitir seleccionar varios PDF juntos, consultarlos, descargarlos, reemplazarlos y eliminarlos definitivamente. Incorporar edicion del telefono operativo compartido con Directorio.

No crear otro directorio de docentes ni otra fuente de datos personales. El expediente siempre pertenece al UUID existente de `teachers`.

## 2. Situacion verificada al iniciar F0 (referencia historica)

- La ruta `/expediente-fiscal` usa `FiscalRecordsView.vue` y el listado de `teachers`.
- La constancia tiene carga individual, vista previa autenticada y descarga. Admite PDF, JPG y PNG; esta compatibilidad se conserva.
- `teacher_documents` almacena referencias privadas a archivos. Su indice `teacher_documents_one_current_constancia_idx` restringe a un vigente por docente/tipo, aunque su nombre mencione constancia.
- El reemplazo actual de constancia conserva referencias anteriores como no vigentes. H24 no autoriza una limpieza retroactiva de esos objetos.
- El modal fiscal modifica RFC, correo fiscal, tipo de pago y datos bancarios; no admite telefono actualmente.
- `teachers.phone` ya existe y es la fuente que utiliza Directorio.
- Los helpers actuales autorizan por permisos fiscales/documentales. No basta con reutilizarlos sin agregar la lista explicita de roles aprobada para este modulo.

Estas observaciones provienen de archivos locales, no de una inspeccion de infraestructura o datos productivos.

## 3. Decisiones humanas aprobadas

Ampliacion aprobada 2026-10-28: incorporar **C.P. fiscal y CURP opcionales** en
Datos fiscales del Expediente. Se capturan manualmente, sin OCR; C.P. como texto
de cinco digitos (conserva ceros), CURP normalizada a mayusculas con validacion
basica de estructura de 18 caracteres, no verificacion oficial. Los vacios no
bloquean archivos ni pagos y no cambian avance fiscal. Mismos roles/permisos de
lectura/edicion fiscal del expediente; no exponer en roles ajenos, exportables o
importaciones. Implementacion local/test con migracion aditiva 017, sin modificar
016 ni datos anteriores. Ver [auditoria C.P./CURP](../auditoria/H24_Ajuste_CP_CURP_Expediente.md).

Actualizacion local del 2026-10-28, posterior a F0/F2: el usuario aprobo reunir
RFC, correo fiscal, tipo de pago y banco/cuenta/CLABE dentro de Expediente, junto
con telefono y documentos adicionales. Constancia conserva solo acciones de
archivo: cargar/sustituir, vista previa y descarga. Tambien aprobo **borrar
fisicamente la constancia sustituida**, una vez publicada correctamente la nueva.
No se autoriza purgar constancias historicas que ya eran no vigentes antes del
nuevo flujo. La decision no permite tocar produccion ni desplegar.
Ver [ajuste local y validaciones](../auditoria/H24_Ajuste_Expediente_Fiscal_Constancia.md).

| Tema | Decision |
|---|---|
| Acceso | Admin, Finanzas y Recursos Humanos; Admin conserva acceso completo |
| Resto de roles | Sin acceso a Expediente Fiscal/completo por esta funcionalidad |
| Documentos adicionales | Solo PDF; seleccion multiple y carga por lote desde una sola seleccion |
| Multiplicidad | Varios PDF del mismo tipo por docente |
| Tipos iniciales | CURP, Acta de nacimiento, Cedula profesional, Titulo y Otro |
| Consulta | Vista previa al hacer clic y descarga desde esa vista |
| Actualizacion | Reemplazar un archivo y actualizar su clasificacion/nombre descriptivo |
| Retiro | Eliminar el archivo definitivamente; no conservar versiones documentales retiradas |
| Constancia | Mantener columna y flujo separados de los PDF adicionales |
| Entrada al expediente | Nueva columna con boton de ojo, nombre accesible y tooltip |
| Telefono | Editar `teachers.phone` solo con edicion fiscal vigente y dentro del alcance autorizado |
| Directorio | Mostrar el mismo telefono persistido; no duplicar campos ni sincronizar dos bases |

La lista de tipos no establece documentos obligatorios ni un criterio nuevo para autorizar pagos. `Otro` permite identificar documentos adicionales sin crear un catalogo editable en esta fase.

## 4. Autorizacion y alcance

La API es autoridad. Ocultar botones no sustituye las comprobaciones servidoras.

| Accion | Admin | Finanzas (`finanzas`) / RH (`rh`) | Otros roles |
|---|---|---|---|
| Entrar y consultar datos fiscales | Completo | `fiscal.view` o `fiscal.manage` | Denegado |
| Listar, previsualizar y descargar documentos | Completo | Acceso al modulo y `fiscal.document.view` o `fiscal.document.manage` | Denegado |
| Cargar, reemplazar, clasificar o eliminar PDF | Completo | Acceso al modulo y `fiscal.document.manage` | Denegado |
| Editar telefono | Completo | `fiscal.manage` | Denegado |
| Editar datos fiscales existentes | Completo | `fiscal.manage`, conservando sus validaciones | Denegado en este modulo |

Se conserva la excepcion de administrador protegido existente en el sistema. No se asignan permisos mediante SQL ni se otorgan permisos nuevos automaticamente a usuarios existentes.

Coordinador, Direccion/Subdireccion, Contador/Contabilidad y roles no aprobados no acceden al modulo ni a sus documentos, incluso con URL conocida. Esto no elimina sus capacidades independientes y vigentes en Directorio, Finanzas o Reportes.

Alcance actual observado: el helper de `teachers.ts`, con `allowFinance: true`, permite alcance global a actores autorizados por permisos fiscales/documentales. Para Finanzas/RH que cumplen la matriz se conserva ese alcance; no se introduce un filtro por `created_by` o coordinacion. Cada solicitud verifica docente, documento y accion. Admin mantiene alcance global.

## 5. Experiencia de usuario

### 5.1 Listado

Conservar la columna Constancia y su indicador. Agregar Expediente con boton de ojo que abra un panel amplio o modal adaptable con el nombre del docente. No mostrar UUID, rutas de almacenamiento ni tokens.

No alterar los filtros existentes, nombres por rol, exportables fiscales ni el calculo de avance fiscal. Un contador de documentos adicionales puede mostrarse separado; no se suma a la completitud fiscal.

### 5.2 Panel del docente

- Identidad visible en solo lectura; nombre, categoria, coordinacion y estatus siguen bajo las reglas actuales de Directorio.
- Datos fiscales dentro del panel, incluidos C.P. fiscal y CURP opcionales, con guardado explicito mediante el endpoint fiscal vigente y sin ampliar permisos. La columna Constancia ya no edita estos datos.
- Telefono operativo con guardado explicito e independiente de archivos y campos fiscales.
- Area de documentos adicionales con tipo, titulo/nombre, fecha de carga y acciones permitidas.
- Selector multiple de PDF, lista previa de archivos y clasificacion por archivo. Permitir asignar un tipo a varios seleccionados.
- Progreso y resultado individual: pendiente, cargando, disponible, fallo o eliminacion pendiente. Reintentar solo fallidos, sin duplicar los exitosos.
- Dos PDF distintos del mismo tipo/nombre no se sobrescriben automaticamente. Reemplazar exige seleccionar expresamente el documento destino.
- La vista previa ofrece descargar y cerrar. No debe depender de una URL publica permanente.
- Eliminacion con confirmacion que identifique el archivo y advierta que no puede recuperarse desde la aplicacion.

La carga multiple es una sola accion del usuario, aunque tecnicamente se transfieran archivos por separado. No prometer atomicidad de todo el lote: informar exitos parciales sin ocultar fallos.

### 5.3 Telefono compartido

Guardar exclusivamente el telefono, sin reenviar una ficha completa del docente ni un valor fiscal. Aplicar la validacion operativa actual: telefono opcional y, cuando contiene numero, entre 10 y 15 digitos con prefijo internacional opcional, conforme a la normalizacion vigente.

El resultado se refleja en Directorio al volver a consultar/actualizar su listado. Invalidar la cache local correspondiente cuando exista; no prometer sincronizacion en tiempo real de otras sesiones. Un conflicto concurrente debe solicitar recarga y no sobrescribir silenciosamente.

### 5.4 Accesibilidad y responsive

Validar 1440x900, 768x1024 y 390x844: filtros/acciones uniformes, tabla con scroll interno, modal utilizable sin overflow general, botones accesibles por teclado, foco visible y restaurado al cerrar, labels y mensajes legibles. El ojo debe tener nombre accesible, no depender solo del icono o color.

## 6. Eliminacion definitiva y reemplazo

La decision de negocio es eliminar los PDF adicionales retirados, no solo ocultarlos ni archivarlos. Conservar un evento de auditoria minimo sin contenido del PDF ni copia del archivo.

Un reemplazo valida y almacena primero el nuevo PDF; solo despues cambia la referencia y elimina el anterior. Un fallo no debe destruir la unica copia valida. Mientras la eliminacion fisica no se confirme, mostrar estado pendiente, no exito definitivo.

La garantia depende de la configuracion real del almacenamiento: retencion, versiones no actuales, soft delete y respaldos deben revisarse antes del despliegue. Si impiden borrar el archivo, resolver la incompatibilidad antes de habilitar esta funcion. No afirmar que una eliminacion logica reduce inmediatamente almacenamiento.

La aplicacion no puede retirar copias descargadas por usuarios ni prometer borrar respaldos externos ajenos a su control. No cambiar politicas del bucket fiscal compartido sin analisis/aprobacion; el diseno propone aislamiento para los documentos nuevos.

Esta politica no autoriza borrar constancias fiscales historicas, documentos de otros docentes ni registros de Nomina.

## 7. Seguridad y limites

- Archivos privados; autorizar cada consulta, descarga y mutacion con la matriz anterior.
- Verificar formato PDF real, tamano y nombre seguro; no confiar solo en extension/MIME declarado.
- No ejecutar contenido del PDF ni inyectar nombres como HTML. Preview aislado y respuesta sin cache compartida.
- No incluir bytes Base64, contenido documental, RFC, banco, tokens o URLs privadas en logs/auditoria general.
- Los documentos pueden contener informacion personal sensible: limitar acceso, no indexar su contenido, no hacer OCR ni extraer CURP/RFC automaticamente.
- Limites de tamano, cantidad por lote y concurrencia seran explicitos y uniformes cliente/servidor. Propuesta tecnica y gates en el diseno; no constituyen limites productivos ya instalados.
- No agregar documentos ni telefono a exportables existentes salvo autorizacion futura.

## 8. Fuera de alcance

No modificar calculos H01, Nomina, pagos, snapshots, corridas, incidencias, extras, responsables/`created_by`, coordinaciones, permisos fuera de este modulo ni reglas de importacion H22. No incorporar firma digital, OCR, expediente ZIP, documentos publicos, altas masivas de docentes o nuevos requisitos para pagar.

La fase F0 fue exclusivamente documental. F1 autorizo modelo/API y pruebas locales, incluida migracion aditiva 016 en test. F2 autoriza frontend y pruebas locales sin cambiar backend/BD. Ninguna de estas fases autoriza infraestructura productiva ni deploy. La aplicacion productiva de 016 requiere H05 y aprobacion independiente.

## 9. Criterios de aceptacion de implementacion futura

| Caso | Resultado requerido |
|---|---|
| Admin, Finanzas y RH | Acceso segun rol, permiso de accion y alcance; Admin completo |
| Rol excluido o sin sesion | Denegacion backend 403 o 401; sin menu ni contenido documental |
| Permiso insuficiente | Lectura no habilita telefono, carga, reemplazo o eliminacion |
| Varios PDF del mismo tipo | Todos conservados como documentos distintos |
| Lote con un archivo invalido | Error identificado; archivos validos no se duplican al reintentar |
| Preview y descarga | Mismo PDF, nombre seguro y autorizacion vigente |
| ID de documento de otro docente | Rechazo; no acceso cruzado por manipulacion de URL |
| Reemplazo falla | Documento anterior disponible; nuevo objeto huerfano recuperado/eliminado |
| Eliminacion falla en almacenamiento | Pendiente visible, reintento durable, sin falso exito |
| Eliminacion completa | Sin archivo/otras versiones retenidas en almacenamiento administrado; evidencia minima |
| Telefono editado | Un solo valor en `teachers.phone`, visible en Directorio tras recarga |
| Solicitud con campos adicionales | Rechazo; no se modifican fiscales, responsable ni campos ajenos |
| Constancia y avance fiscal | Comportamiento vigente conservado, separado del expediente adicional |
| Regresion | Nomina/H01, Finanzas, Directorio y roles ajenos sin cambios funcionales |

## 10. Fases propuestas y pendientes tecnicos

1. F0 completada: SPEC y diseno; decisiones funcionales cerradas.
2. F1 validada en local/test: modelo, migracion 016 y API con autorizacion, almacenamiento y reconciliacion de fallos; sin infraestructura productiva.
3. F2 implementada localmente: panel, carga multiple, telefono, preview y pruebas frontend con API simulada; responsive validado en Brave.
4. F3 validada con observaciones en local: API HTTP, PostgreSQL test, archivos PDF reales sinteticos, borrado/reemplazo fisico, telefono compartido, roles sinteticos y reintento idempotente. Pendientes sesiones Firebase autorizadas y storage GCS de prueba; no equivalencia automatica con produccion.
5. F4 preparada: checklist H13, revision de autenticacion/storage/seguridad y plan de release/rollback; autorizacion bloqueada por pendientes en el acta F4. Solo cambios documentales, sin recursos cloud.
6. F5 futura: cerrar bloqueantes, backup, aprobacion de infraestructura/migracion/deploy y smoke autenticado sin documentos personales reales de prueba.

Pendientes tecnicos: capacidad sostenida, autenticacion real, seguridad del visor nativo y escaneo PDF, provisionamiento del worker y configuracion GCS productiva de retencion/versionado/soft delete; la politica GCS aislada ya fue ensayada en PD-02. F3 valida relectura tras recarga y reintento idempotente en la misma visita; no persiste IDs de operaciones pendientes en navegador. Parser/reintentos backend existen en F1 y migracion 016 esta asignada; su habilitacion productiva sigue pendiente. No quedan pendientes las decisiones sobre roles, multiplicidad, telefono compartido o eliminacion definitiva.

No marcar esta funcionalidad como productiva ni actualizar manuales como si estuviera disponible. El cierre operativo exigira evidencia de permisos y eliminacion fisica, ademas de smoke aprobado.

## 11. Referencias

Seguimiento PD-04 (2026-10-28): recuperacion de documentos y constancias con GCS
aislado, programacion Windows temporal e idempotencia validadas. Worker reporta
backlog, antiguedad y fallos con canales independientes. Restitucion de BD test
sin diferencias y constancia B manual conservada. No modifica permisos, UI o H01.
PD-04 no cerrado: faltan job privado cloud y entrega externa de alertas; H24 NO-GO.
Ver [acta PD-04](../auditoria/H24_PD04_Validacion_Worker_Recuperacion_Alertas.md).

- [SDD consolidado](../sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md).
- [H05](../auditoria/H05_Control_Formal_Migraciones.md) y [H13](../auditoria/H13_Checklist_Productivo_Permanente.md).
- [H03 Fiscal/Finanzas](../auditoria/H02_H03_Fase4_Fiscal_Finanzas_Nomina_Preview.md).
- Implementacion revisada: `apps/api/src/routes/teachers.ts`, `apps/api/src/auth.ts`, `apps/api/src/app.ts`, `apps/web/src/views/FiscalRecordsView.vue`, `apps/web/src/stores/auth.ts`, `apps/web/src/router/index.ts`, `database/001_initial_schema.sql`.
