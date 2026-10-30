# Matriz Formal de Riesgos - Nomina Docente

Actualizacion: 2026-10-27

## 1. Contexto

Esta matriz formaliza el estado de riesgos del proyecto Nomina Docente despues de:

- Cierre tecnico/operativo H01.
- Implementacion y deploy productivo H02/H03.
- Migracion productiva de datos oficiales de mayo 2026.
- Conciliacion de nomina `2026-05-15 a 2026-05-28` por `$517,510.00`.
- Limpieza productiva de docentes duplicados por formato de nombre.
- Cierre controlado de recursos preview/dry-run.
- Cierre H06/H14 con retiro controlado de archivos Apps Script legacy del repositorio.
- Implementacion H04 de pruebas automatizadas hasta Fase 5.
- Cierre H05 con baseline productivo 001 a 012.
- Deploy productivo H09/H10 sin migracion 013.
- Inventario H11 de CSV, acentos y codificacion.
- H11-F1/F2/F3A/F3B con helper CSV central y exportables CSV criticos backend/frontend estandarizados.
- Deploy productivo H11-F5 ejecutado y smoke CSV autorizado aprobado en produccion.
- H12 cerrado como politica documental y gobierno operativo sin cambios tecnicos.
- H13 cerrado documentalmente con checklist productivo permanente de variables, secretos, CORS, healthchecks, deploy y rollback.
- H15 desplegado productivamente en Firebase Hosting live; sesion por inactividad y `browserSessionPersistence` quedan operativos.
- H17 ejecutado: Directorio usa `teachers.created_by` como capturador tecnico; correccion por coordinacion descartada y 197 docentes fueron normalizados con backup y mapping aprobado.
- H18 ajuste post-H23 cerrado operativo en `nomina-api-00056-mll` y Hosting live; smoke tecnico, autenticado por rol y exportables aprobados.
- H19 ejecutado de forma controlada: backup exitoso, preview en ROLLBACK, 36 actualizaciones de `teachers.created_by`, 3 altas minimas y validacion posterior sin duplicados.
- H20 cerrado operativo: preview compartido desplegado en `nomina-api-00051-9s5`, Hosting H20 activo y smoke autenticado Coordinador/Admin aprobado sin duplicacion ni exposicion fiscal.
- H21 cerrado operativo: migracion `013`, conciliacion de cinco pares/8 horarios, deploy `nomina-api-00052-xtm` y smoke autenticado Catalogos/Horarios aprobados; CSV institucional definitivo no aplicado.
- H22 cerrado operativo: migracion `014`, API `nomina-api-00054-2ld`, Hosting y smoke autenticado aprobados; una ejecucion autorizada creo 14 docentes y HF1B corrigio el `READ_PROJECTION_DEFECT` sin BD ni Apply repetido.
- H23 cerrado operativo: migracion `015` aplicada por H05, ciclo `27-1` configurado, revision `nomina-api-00055-8wn`, Hosting y smoke productivo aprobados sin cambios H01 ni historicos.
- Alineacion documental post-H20 verificada contra Cloud Run, Firebase Hosting y H05 en modo read-only; no cambia el estado ni la prioridad de los riesgos.
- Cierre global de matriz de riesgos documentado el 2026-06-03, con pendientes clasificados como monitoreo, mejora futura u opcionales.

Arquitectura vigente:

- Frontend: Vue 3 + TypeScript + Firebase Hosting.
- Backend: Fastify + TypeScript en Cloud Run.
- Auth: Firebase Auth.
- Base de datos: PostgreSQL / Cloud SQL.
- Archivos fiscales: Cloud Storage.

## 2. Criterios de prioridad

- **P0 Critico:** corregir inmediatamente.
- **P1 Alto:** corregir en la siguiente fase controlada.
- **P2 Medio:** planificar en backlog tecnico.
- **P3 Bajo:** documentacion, operacion o mejora futura.

## 3. Matriz actual

| ID | Riesgo | Area | Estado actual | Impacto residual | Prioridad actual | Recomendacion | Criterio de cierre restante | Requiere decision humana |
|---|---|---|---|---|---|---|---|---|
| H01 | Precision monetaria con `number` en Node/API | Nomina / Finanzas | Cerrado | Bajo; riesgo solo por regresion futura | P0 cerrado | Mantener pruebas/regresion en cada cambio de Nomina/Finanzas | Typecheck/build y pruebas de calculo pasan antes de deploy | No |
| H02 | Resolucion de coordinacion por `display_name` / `legacy_username` | Seguridad / Permisos / Datos operativos | Cerrado operativo; en monitoreo | Medio mientras fallback legacy siga habilitado | P1 monitoreo | Monitorear `LEGACY_COORDINATION_FALLBACK_USED` durante estabilizacion y preparar retiro posterior | Una quincena operativa sin errores de acceso ni uso de fallback indebido | Solo para fecha final de retiro del fallback |
| H03 | `finance.view` sobrecargado / fiscal y workflow mezclados | Roles / Seguridad / RH / Finanzas | Cerrado operativo, incluido ajuste de comprobante consolidado y nombre en `nomina-api-00057-c7d`; healthchecks OK y smoke autenticado aprobado por el usuario | Bajo a medio por regresion si futuras rutas vuelven a mezclar identidad operativa, fiscal, exportacion o workflow | P1 monitoreo | Mantener pruebas por rol; nombre docente visible sin fiscal; Coordinador limitado a `actorCoordinations[]`; comprobante de efectivo unico por docente | Cumplido: deploy, healthchecks y smoke del PDF/nombres por rol aprobados; mantener pruebas recurrentes | No, decisiones principales cerradas |
| H04 | Falta de pruebas automatizadas de negocio | Calidad / Nomina / Finanzas / Permisos | Implementado hasta Fase 5; H04-F6 Playwright opcional | Medio-bajo: aun faltan e2e visuales completos | P1 monitoreo | Mantener suite Vitest/API/PostgreSQL/frontend verde antes de cambios; evaluar Playwright si se requiere | Fase 6 e2e opcional aprobada o descartada formalmente | Solo si se decide invertir en e2e |
| H05 | Migraciones SQL sin control formal de ejecucion | Base de datos / DevOps | Cerrado con baseline productivo | Bajo: riesgo residual por disciplina futura de migraciones | P1 cerrado | Usar `inspect/status/dry-run/apply` y backup antes de cambios productivos; futuras migraciones desde 013 sin prefijos repetidos | Mantener `pending=0` y `checksum mismatch=0` antes de deploy | Si para cada apply productivo |
| H06 | Coexistencia con Apps Script legado | Arquitectura / Operacion / Gobierno de datos | Cerrado | Bajo: queda solo riesgo de copias externas no controladas | P1 cerrado | Mantener Git como respaldo historico y evitar reintroducir Apps Script como fuente operativa | Documento H06/H14 de cierre y archivos retirados | No para repo; si para inventario externo |
| H07 | Provider Google con `hd` comentado | Auth / UX / Seguridad preventiva | Pendiente | Medio-bajo: backend ya valida dominio | P2 Medio | Evaluar `hd` como mejora UX, no como control principal | Pruebas con cuenta institucional y externa documentadas | Opcional con Admin Google |
| H08 | Logica concentrada en archivos grandes | Mantenibilidad / Backend / Frontend | Pendiente | Medio: cambios futuros tienen mayor riesgo | P2 Medio | Refactor incremental despues de tener pruebas automatizadas | Servicios/componentes separados sin cambiar contratos ni reglas | No al inicio; si para priorizar modulos |
| H09 | Estados `BORRADOR` y `CERRADA` no usados claramente | Modelo / Flujo financiero | Cerrado/desplegado | Bajo: riesgo residual por regresion futura o confusion documental | P2 cerrado | Mantener `PAGADA` terminal; `BORRADOR`/`CERRADA` reservados no operativos | Pruebas H09/H10 y smoke post-deploy aprobados | No para reglas cerradas |
| H10 | Cierre de cuatrimestre moderno pendiente | Ciclos / Historicos / Operacion academica | Cerrado/desplegado | Medio-bajo: cierre real es irreversible y requiere disciplina operativa | P2 monitoreo | Usar cierre controlado con `quarter_closures` + `audit_log`; no cierre real sin aprobacion | Primer cierre real ejecutado con checklist operativo y backup | Si para cada cierre real |
| H11 | CSV y acentos/codificacion | Reportes / Excel / Importaciones | Cerrado operativo | Bajo: riesgo residual por regresion futura y sanitizacion pendiente por exportable | P2 cerrado | Mantener helper CSV central y pruebas; decidir sanitizacion CSV injection por exportable si se requiere | Cumplido con deploy H11-F5 y smoke CSV autorizado en Excel institucional | Solo para sanitizacion futura o nuevos exportables |
| H12 | Nombres de catalogos/tabuladores historicos | Catalogos / Horarios / Historicos | Cerrado documental / politica operativa | Bajo si se sigue la politica; sube solo ante cambios manuales sin procedimiento | P2 cerrado documental | Mantener politica de inactivar antes que borrar; no intervenir tecnicamente mientras el sistema funcione correctamente | Cumplido con SPEC y cierre documental; no hay implementacion inmediata requerida | Solo si se solicita excepcion o cambio futuro |
| H13 | Variables productivas no versionadas | Infraestructura / DevOps | Cerrado documental / checklist productivo permanente | Bajo si se usa el checklist antes de cada deploy | P3 cerrado documental | Usar checklist H13 para revisar variables, secretos, CORS, healthchecks y rollback antes de cada despliegue | Cumplido con documento H13 y referencias en SDD/README | Solo si se cambian propietarios de secretos o infraestructura real |
| H14 | Apps Script legacy extenso | Documentacion / Retiro legado | Cerrado | Bajo: trazabilidad historica queda en Git | P3 cerrado | No usar legacy local como referencia funcional; consultar Git solo como historico | Documento H06/H14 de cierre | No |
| H15 | Persistencia de sesion e inactividad | Seguridad frontend / Firebase Auth | Desplegado productivamente | Bajo: queda observacion operativa del ciclo real de 60 minutos y reapertura de navegador | P2 cerrado operativo | Mantener pruebas H15 y observar comportamiento en operacion normal | Cumplido con predeploy, deploy Hosting live y smoke postdeploy minimo | Solo si se cambia politica de tiempo o UX |
| H17 | `teachers.created_by` nulo por carga masiva | Directorio / Permisos operativos / Datos productivos | Normalizacion productiva ejecutada para 197 docentes; 12 remanentes documentados | Bajo-medio: queda validacion funcional por coordinadoras y decision futura sobre remanentes | P1 datos controlados / monitoreo | Mantener regla por capturador; validar acceso operativo y no tocar remanentes sin nuevo mapping aprobado | Validacion por coordinadoras y cierre/documentacion de los 12 remanentes si se decide atenderlos | Si, solo para remanentes o excepciones futuras |
| H18 | Modulo Reportes Operativos y ajuste post-H23 | Reportes / Permisos / Operacion academica | Cerrado operativo en `nomina-api-00056-mll` y Hosting live; smoke tecnico/autenticado y exportables aprobados | Bajo: riesgo residual de regresion futura en calculo, permisos o exportables | P1 cerrado / monitoreo | Mantener pruebas por rol, `source=auto`, H23, H01, consolidacion y ausencia fiscal | Cumplido con deploy, smoke por rol y CSV/XLSX aprobados | Solo para cambios funcionales futuros |
| H19 | Actualizacion controlada de Directorio desde CSV | Directorio / Datos productivos / Permisos operativos | Ejecutado y documentado: 36 `created_by` actualizados y 3 altas minimas, con backup y preview exacto | Bajo; riesgo residual solo ante futuras cargas manuales sin el mismo control | P1 cerrado / monitoreo | Repetir backup, matching nominal, preview y guardas de duplicidad para futuras cargas | Cumplido con validacion posterior, 0 discrepancias y 0 duplicados | Solo para futuras cargas o excepciones |
| H20 | Preview de Nomina incompleto para docentes compartidos | Nomina / Permisos / Coordinaciones | Cerrado operativo; deploy y smoke autenticado aprobados | Bajo: riesgo residual solo por regresion futura en alcance, agregacion o proyeccion fiscal | P1 cerrado operativo | Mantener elegibilidad por docente separada del calculo completo y pruebas de regresion; no reutilizar esta regla para editar modulos operativos | Cumplido con revision `nomina-api-00051-9s5`, Hosting H20, docente unico, carga completa, totales sin duplicacion y ausencia fiscal | No; solo ante cambios futuros de alcance |
| H21 | Importacion masiva y busqueda de Asignaturas | Catalogos / Horarios / Historicos / Seguridad de datos | Cerrado operativo; `013`, conciliacion, deploy y smoke autenticado aprobados | Bajo: riesgo residual por regresion o por aplicar en el futuro un CSV institucional sin control | P1 cerrado operativo | Mantener pruebas, H05/H13 y preview sin bloqueantes antes de cualquier Apply futuro | Cumplido con backup `1784582556252`, 277/277 sin cambios, cero bloqueantes y revision `nomina-api-00052-xtm` | Solo para Apply de un CSV institucional futuro |
| H22 | Importacion masiva de docentes operativos por CSV | Directorio / Permisos / Datos operativos / Seguridad | Cerrado operativo; `014`, API/Hosting, ejecucion autorizada de 14 altas, smoke y HF1B aprobados | Bajo: riesgo residual ante una futura carga real o regresion de permisos, atomicidad o proyeccion del responsable | P1 cerrado operativo | Mantener Admin exclusivo, Preview, fingerprints, backup, autorizacion independiente y proyeccion desde `teachers.created_by` | Cumplido con backup `1785456525085`, H05 sin pendientes, revision `nomina-api-00054-2ld`, Hosting y smoke por rol/responsable, sin Apply repetido | Solo para un Apply institucional futuro o cambios funcionales |
| H23 | Horarios sin vigencia temporal general en calculo de Nomina | Nomina / Calendario / Incidencias / Extras / Reportes | Cerrado operativo; `015`, configuracion `27-1`, API/Hosting y smoke productivo aprobados | Bajo: riesgo residual solo por regresion futura o configuracion incorrecta de un ciclo nuevo | P0 cerrado / monitoreo | Mantener vigencia base por ciclo, M1/M2 contenidos y pruebas de paridad Preview/Guardar/Reporte vivo; no cambiar H01 ni historicos | Cumplido con backup `1787418742938`, H05 `pending=0`, revision `nomina-api-00055-8wn` y smoke aprobado | Solo para configurar ciclos futuros o abrir ventanas operativas posteriores |

## 4. Riesgos que ya no deben tratarse como pendientes

### H02

Cerrado operativamente:

- Existe `user_coordinations`.
- Se eliminaron recursos preview/dry-run.
- No se crean coordinaciones automaticamente desde flujos operativos.
- Horarios, Incidencias, Extras y Directorio respetan reglas por usuario capturador donde aplica.
- Docentes compartidos entre coordinadores se permiten sin otorgar edicion global.
- H20 extiende solo el preview read-only de Nomina: un Coordinador puede consultar docentes propios o que impartan en sus coordinaciones, incluyendo su carga completa entre coordinaciones.
- La elegibilidad H20 no concede propiedad ni edicion sobre horarios, incidencias, extras o docentes de otras coordinaciones.
- Fallback legacy queda solo como contingencia temporal.
- H17 confirma que Directorio debe seguir usando `teachers.created_by` como capturador tecnico; la edicion por sola coordinacion queda descartada.

Pendiente residual:

- Monitorear uso de fallback y retirarlo cuando se cumpla la condicion aprobada.
- Validar funcionalmente H17 con coordinadoras y decidir si se atienden los 12 docentes remanentes con `created_by IS NULL`.

### H03

Cerrado operativamente:

- `fiscal.view`.
- `fiscal.manage`.
- `fiscal.document.view`.
- `fiscal.document.manage`.
- `finance.export`.
- `finance.workflow`.
- `payroll.preview`.

Reglas cerradas:

- `finance.view` no habilita workflow.
- `finance.view` no habilita fiscal.
- `teachers.manage` no habilita fiscal.
- Coordinador no guarda nomina ni edita fiscal.
- Finanzas aprueba, marca pagada y cancela con `finance.workflow`.
- Contador/Contabilidad solo exportan.

Pendiente residual:

- Agregar pruebas automatizadas que eviten regresion.

### H04

Implementado hasta Fase 5:

- Vitest como runner principal.
- Pruebas API con `app.inject()`.
- PostgreSQL local/test `nomina_docente_test`.
- Fixtures de actores/roles/permisos.
- Pruebas backend de H01/H02/H03.
- Pruebas frontend de permisos/visibilidad.

Pendiente opcional:

- H04-F6 Playwright/e2e local si se requiere validar flujos completos con navegador.

### H05

Cerrado:

- Tablas `schema_migrations` y `schema_migration_runs` creadas.
- `tools/migrate-db.ts` disponible con `inspect`, `status`, `dry-run`, `baseline` y `apply`.
- Produccion tiene 18 migraciones registradas: 15 baseline (001 a 012) y
  `013`/`014`/`015` aplicadas; `pending=0` y no existe checksum mismatch.
- Duplicados historicos `007`, `008`, `009` aceptados; desde `013` no se repiten prefijos.

### H09/H10

Cerrado/desplegado:

- `PAGADA` es terminal.
- `CANCELADA` solo antes de `PAGADA`.
- `BORRADOR` y `CERRADA` de `payroll_runs` quedan reservados/no operativos.
- `PLANEACION` es ciclo borrador operativo.
- Horarios permitidos en `PLANEACION`.
- Incidencias, Extras y Nomina bloqueados en `PLANEACION`.
- Ciclo `CERRADO` irreversible.
- Cierre controlado con `quarter_closures` actual y evidencia en `audit_log`.
- No hubo migracion 013 para H09/H10.

## 5. Siguiente fase recomendada

Orden recomendado:

1. **H23 monitoreo.** Cerrado operativo; mantener regresion temporal, H01, Extras independientes y snapshots, y abrir Extras propedeuticos solo mediante una accion Admin posterior aprobada.
2. **H07/H08 - mejoras opcionales.** Google `hd` como UX y refactor gradual protegido por pruebas.
3. **CSV injection.** Decidir sanitizacion por exportable si se requiere como mejora futura.
4. **H13 operativo continuo.** Usar el checklist permanente antes de cada deploy productivo y actualizarlo solo si cambia infraestructura real.
5. **H15 operativo.** Mantener smoke de sesion/inactividad si se ajusta la politica de tiempo o UX del modal.
6. **H17 monitoreo.** Validar acceso real de coordinadoras y resolver remanentes solo con nuevo mapping aprobado.
7. **H18 Reportes Operativos.** Cerrado operativo; mantener monitoreo y regresion por rol, snapshot/live, consolidacion, sobrecarga y exportables CSV/XLSX.
8. **H19 Directorio.** Cerrado controlado; monitorear Directorio y repetir el procedimiento solo ante una nueva carga aprobada.
9. **H20 Nomina compartida.** Cerrado operativo; mantener pruebas y monitoreo de alcance, totales y seguridad fiscal.
10. **H21 Asignaturas.** Cerrado operativo; cualquier CSV institucional futuro requiere preview, backup y autorizacion independiente.
11. **H22 Docentes.** Cerrado operativo; cualquier Apply institucional futuro
    exige CSV aprobado, Preview sin bloqueantes, backup y autorizacion humana
    independiente.

## 6. Decisiones humanas pendientes

Pendientes reales despues de H02/H03:

- Definir fecha/condicion operativa final para retirar fallback legacy despues de estabilizacion.
- Confirmar si existen copias externas de Apps Script en Google Drive o respaldos institucionales y marcarlas como historicas/no operativas.
- Decidir si H04-F6 Playwright/e2e se ejecuta o queda descartado.
- Aprobar cada cierre real de ciclo porque es irreversible.
- H12 solo requiere nueva decision humana si se quiere intervenir tecnicamente catalogos historicos.
- H13 solo requiere nueva decision humana si se cambian secretos, propietarios, CORS o infraestructura productiva.
- Decidir si se requiere sanitizacion CSV injection por exportable o si se mantiene sin transformar datos exportados.
- Validar H17 con usuarios autorizados y decidir si los 12 remanentes requieren una segunda ventana de datos.
- Para H18, decidir solo si en fases futuras se agregan permisos formales nuevos; `exceljs` ya fue aprobado e instalado en backend/API.
- Para futuras cargas tipo H19, exigir nueva aprobacion, backup, matching por identificador/correo/nombre y preview en ROLLBACK.
- H20 no tiene decisiones pendientes; cualquier ampliacion futura de alcance, escritura o permisos requiere nueva SPEC y aprobacion humana.
- H21 no tiene pendientes de implementacion o deploy. El CSV institucional
  definitivo no fue aplicado y conserva una decision humana independiente;
  SEC-H21 mantiene `websocket-driver@0.7.5` y cero vulnerabilidades criticas.
- H22 cerro el tratamiento nominal, migracion `014`, backend/frontend, deploy y
  smoke. HF1B corrigio el `READ_PROJECTION_DEFECT`: Directorio muestra el
  responsable desde `teachers.created_by`, sin correccion de BD, permisos
  nuevos, Apply repetido ni exposicion fiscal.
- H23 no tiene decisiones de implementacion o deploy pendientes. La vigencia
  `27-1`, migracion `015`, API/Hosting y smoke quedaron aprobados. La apertura
  de la ventana de Extras propedeuticos es una accion Admin posterior e
  independiente, no una deuda tecnica H23.

## 7. Recomendacion final

### Seguimiento H24 - Expediente completo

Ampliacion local 2026-10-28: C.P. fiscal y CURP opcionales, con validacion de formato
y permisos fiscales del expediente. 017 agrega dos columnas sin backfill; H05 test
20 registradas, pending=0/mismatch=0. Sin valores nuevos en auditoria general ni
exportables; sin cambios H01 o produccion. El release futuro debe incluir 016 y
017. No cierra PD-03 a PD-08 ni la cobertura parcial PD-05. Evidencia:
`H24_Ajuste_CP_CURP_Expediente.md`. H24 mantiene NO-GO.

H24-F1 modelo/backend implementados y validados en local/test; no cerrado operativo.
H24-F2 frontend implementado y probado con API simulada; panel, telefono y documentos
con responsive local. F3 valida integracion persistida via API HTTP, PostgreSQL y
storage local, borrado/reemplazo fisico, telefono y permisos con actores sinteticos.
No equivale a smoke Firebase autenticado ni validacion real de Cloud Storage.
La migracion 016 es exclusivamente local/test en esta fase, sin cambio del estado
productivo H05. Acceso aprobado: Admin, Finanzas y RH con permisos por accion.
No se amplian capacidades de otros roles ni se modifica H01.

Riesgos previos a release: tratamiento de PDF maliciosos, politica real de borrado
definitivo, capacidad y recuperacion durable entre PostgreSQL/storage. El adaptador
GCS solo tenia pruebas simuladas en F3; PD-02 posterior acredita ensayo real aislado.
El worker no esta provisionado en produccion.
Pendientes: completar negativos/sesiones avanzadas de PD-05, seguridad del visor PDF,
capacidad sostenida, worker e infraestructura aprobada y migracion/deploy
con H05/H13. Mantener storage deshabilitado hasta cumplir los gates.

F4: predeploy preparado, **NO-GO**, no cerrado operativo. Riesgo de habilitacion
alto hasta cerrar PD-03 a PD-08 del acta: cobertura Auth complementaria
pendiente, seguridad PDF, worker, capacidad y requisitos DBA/release restantes.
PD-01 cerrado localmente: imagen Linux de `95026bf` construida, pdfinfo 22.12.0,
inventario/digest registrados y 12/12 comprobaciones en build/runtime aislado,
tambien como usuario node. No cierra antivirus, vulnerabilidades ni capacidad.
Ver `H24_Fase4_Correccion_Parser_Pdfinfo.md`; riesgo de release no cerrado.
PD-02: plan `H24_PD02_Plan_Validacion_GCS_Aislado.md` y seguimiento autorizado en
`H24_PD02_Copia_Local_Anonimizada_GCS.md`. Copia local saneada preparada y 016
ensayada por H05 (19 registradas, 0 pendientes/mismatch), sin reparar cluster
antiguo. Cuota resuelta, facturacion vinculada y bucket aislado creado. PD-02
cerrado tecnicamente local/test: 21 comprobaciones GCS y 15 API/BD satisfactorias,
permisos efectivos minimos, borrado sin residuos y recuperacion tras corte real.
Ver `H24_PD02_Resultado_GCS_Aislado.md`. RH/Contador sin actor local y Firebase
real quedaron pendientes al cerrar PD-02; se probaron despues en PD-05.
Seguimiento PD-04 2026-10-28: recuperacion GCS real con fallos controlados,
liberacion de lock tras terminar proceso, dos disparos programados locales e
idempotencia aprobados; test restituido sin diferencias. Worker reforzado con
backlog/edad/FAILED y errores aislados por canal. PD-04 permanece parcial:
job privado cloud, alertas externas y configuracion de reintentos pendientes;
no equivale a provisionamiento productivo. Evidencia:
`H24_PD04_Validacion_Worker_Recuperacion_Alertas.md`. H24 sigue NO-GO.
La comprobacion de borrado usa politica 0 desde creacion, GET 404 e inventario
vacio; softDeleted=true devolvio 400, no una lista vacia. H24 sigue NO-GO.
Auditoria npm anterior a PD-06: 0 criticas, 15 altas, 12 moderadas, 1 baja.
Seguimiento compatible autorizado 2026-10-29: 0 criticas, 5 altas, 9 moderadas,
1 baja, sin audit fix. Seguimiento posterior autorizado: Zod 4.6.7 y gRPC 1.14.7,
npm 10.9.4 fijado, audit 0 criticas/0 altas/9 moderadas/1 baja. Regresion API/web,
PostgreSQL efimero, typecheck/build y gate de imagen Linux satisfactorios.
PD-06 sigue abierto por hallazgos restantes, sin excepcion productiva ni deploy.
Ver `H24_PD06_Correccion_Compatible_Dependencias.md` y
`H24_PD06_Zod_Grpc_Regresion_Aislada.md`.
Cloud PD-03/PD-04 autorizado y ensayado: servicios privados, worker efimero y
Scheduler exitosos, GCS restituido; recepcion email pendiente, Scheduler pausado.
Ver `H24_PD03_PD04_Arquitectura_Cloud_Aislada.md`. No cierra aislamiento, capacidad,
H05/rollback ni autorizacion de release. H24 conserva NO-GO.
AUTH-01 registro verificacion Firebase sin checkRevoked; el seguimiento autorizado
del 2026-10-28 activa checkRevoked=true localmente y conserva las guardas app_users.
Ver `H24_AUTH01_Correccion_Revocacion_Firebase.md`: rechazo real Firebase H24,
permiso runtime minimo aprobado, regresion API/web/typecheck/build. No desplegado.
AUTH-01 cerrado tecnicamente local/H24 con nuevo login 200 e integridad verificada;
riesgo de release: comprobar IAM/latencia del runtime destino con aprobacion futura.
El cierre de Brave en perfil habitual queda sin causa determinada; invitado funciono.

PD-05: plan `H24_PD05_Plan_Validacion_Firebase_Auth_Real.md` ejecutado parcialmente
con aprobacion humana, Firebase/Google exclusivo H24 y una identidad rotada solo en
test. Matriz vigente Admin/Finanzas/RH y rechazos Coordinador/Direccion/Contador/
Contabilidad satisfactorios; 72 solicitudes negativas y 36 operaciones COMPLETE.
UI de carga multiple/preview/descarga, telefono por API, limpieza GCS y restitucion validados.
Evidencia: `H24_PD05_Resultado_Sesiones_Reales_Por_Rol.md`. No cambia autorizacion
productiva ni permisos compartidos. Login escribe UID/timestamps y las pruebas
conservan auditoria local; no se presentan como read-only de BD test.
Seguimiento: `H24_PD05_Validacion_Complementaria_Auth_Sesiones.md` acredita diez
variantes de permisos reducidos, usuario local ausente/UID incompatible y retiro
de permiso durante carga, con restitucion. AUTH-01 confirmado en H24: token previo
a deshabilitacion/revocacion Firebase sigue obteniendo API 200; verificador estricto
lo rechaza. Esa evidencia es anterior al fix AUTH-01 del 2026-10-28; la correccion
y sus comprobaciones aisladas se registran en el acta nueva, no en produccion.
Seguimiento 2026-10-28: sesiones de navegador aprobadas por usuario en H24:
F5, logout manual, cierre/reapertura Invitado y H15 abreviado autorizado 90/120 s
(aviso, contador, Continuar, cierre automatico a login). Fuentes conservan 55/60
minutos; no se espero una hora real. Solo last_login_at QA cambio; instancia
temporal detenida. Usuario mantiene pendientes las identidades complementarias,
sin autorizar nuevos recursos ni aceptar formalmente cobertura limitada. Ver
`H24_PD05_Resultado_Persistencia_Inactividad.md`. PD-04 cloud pendiente.
H24 mantiene NO-GO,
sin cierre operativo ni deploy autorizado. QA ACTIVO solo para revision local
solicitada; no cambia permisos productivos.

Ajuste local de expediente/constancia aprobado el 2026-10-28: ficha fiscal reunida,
columna corregida y sustitucion con borrado fisico recuperable. Sin ampliar roles.
Evidencia: `H24_Ajuste_Expediente_Fiscal_Constancia.md`. Pendiente adicional:
bucket de constancias aislado sin retencion y ensayo real de borrado/recuperacion;
PD-02 de PDF adicionales no cubre constancias. H24 conserva NO-GO.

Evidencia: `H24_Fase1_Modelo_Backend_Expediente_Docentes.md`,
`H24_Fase2_Frontend_Expediente_Docentes.md`,
`H24_Fase3_Validacion_Integracion_Expediente_Docentes.md`,
`H24_Fase4_PreDeploy_Expediente_Docentes.md`, SPEC y diseno H24.

### Continuidad de la matriz principal

No se recomienda reabrir H02/H03 mientras produccion siga estable.

El foco tecnico inmediato debe pasar a:

- mantener H11 cerrado con helper CSV central y pruebas de regresion;
- conservar H04/H05 como barreras obligatorias antes de cambios;
- usar H13 como checklist permanente antes de despliegues productivos;
- mantener H23 cerrado con pruebas de regresion y no alterar H01, Extras independientes o snapshots;
- consultar el cierre global `docs/auditoria/CIERRE_GLOBAL_MATRIZ_RIESGOS_NOMINA_DOCENTE_20260603.md` como evidencia ejecutiva de estado de matriz;
- usar el SDD consolidado post H09/H10 como primera fuente documental.
