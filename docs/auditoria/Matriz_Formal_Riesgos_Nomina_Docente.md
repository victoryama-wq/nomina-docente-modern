# Matriz Formal de Riesgos - Nomina Docente

Actualizacion: 2026-07-18

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
- H18 cerrado operativo: Reportes Operativos desplegado, filtros amigables H18-F6 vigentes, hotfix snapshot `ped.line_key` aplicado y CSV/XLSX validados en Excel institucional.
- H19 ejecutado de forma controlada: backup exitoso, preview en ROLLBACK, 36 actualizaciones de `teachers.created_by`, 3 altas minimas y validacion posterior sin duplicados.
- H20 cerrado operativo: preview compartido desplegado en `nomina-api-00051-9s5`, Hosting H20 activo y smoke autenticado Coordinador/Admin aprobado sin duplicacion ni exposicion fiscal.
- H21 implementado y validado en local/test con migracion `013`, importacion atomica, busqueda normalizada y Horarios por catalogo; produccion sin cambios.
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
| H03 | `finance.view` sobrecargado / fiscal y workflow mezclados | Roles / Seguridad / RH / Finanzas | Cerrado operativo | Bajo a medio por regresion si futuras rutas vuelven a mezclar permisos | P1 monitoreo | Mantener pruebas por rol y revisar nuevas rutas contra permisos explicitos | Pruebas recurrentes validan fiscal, documentos, export, workflow y preview | No, decisiones principales cerradas |
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
| H18 | Modulo Reportes Operativos desplegado con UX de filtros H18-F6 y hotfix snapshot | Reportes / Permisos / Operacion academica | Cerrado operativo | Bajo: riesgo residual por regresion futura o nuevas necesidades de snapshots historicos | P2 cerrado operativo | Mantener pruebas H18, guardas backend por rol y exportables CSV/XLSX; no crear permisos ni migraciones sin H05 | Cumplido con deploy H18-F5/F6, hotfix `ped.line_key` y validacion post-hotfix en Excel institucional | Solo si se agregan permisos nuevos o cambios de BD |
| H19 | Actualizacion controlada de Directorio desde CSV | Directorio / Datos productivos / Permisos operativos | Ejecutado y documentado: 36 `created_by` actualizados y 3 altas minimas, con backup y preview exacto | Bajo; riesgo residual solo ante futuras cargas manuales sin el mismo control | P1 cerrado / monitoreo | Repetir backup, matching nominal, preview y guardas de duplicidad para futuras cargas | Cumplido con validacion posterior, 0 discrepancias y 0 duplicados | Solo para futuras cargas o excepciones |
| H20 | Preview de Nomina incompleto para docentes compartidos | Nomina / Permisos / Coordinaciones | Cerrado operativo; deploy y smoke autenticado aprobados | Bajo: riesgo residual solo por regresion futura en alcance, agregacion o proyeccion fiscal | P1 cerrado operativo | Mantener elegibilidad por docente separada del calculo completo y pruebas de regresion; no reutilizar esta regla para editar modulos operativos | Cumplido con revision `nomina-api-00051-9s5`, Hosting H20, docente unico, carga completa, totales sin duplicacion y ausencia fiscal | No; solo ante cambios futuros de alcance |
| H21 | Importacion masiva y busqueda de Asignaturas | Catalogos / Horarios / Historicos / Seguridad de datos | Implementado y validado en local/test; pendiente de produccion | Medio hasta completar H05/H13 y smoke; bajo despues de validar CSV institucional | P1 release | Mantener preview/apply atomico, matching por ID/clave, bloqueo operativo y cero fusion por nombre | Suites API/web/integracion, migracion `013` controlada, backup, smoke Admin/Coordinador y export de evidencia | Si, antes de migracion/deploy productivo |

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
- Produccion tiene baseline 001 a 012 con `15` registros, `0` pendientes y `0` checksum mismatch.
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

1. **H21 Asignaturas.** Preparar migracion/deploy productivo controlado con H05/H13; la implementacion local/test ya esta completa.
2. **H07/H08 - mejoras opcionales.** Google `hd` como UX y refactor gradual protegido por pruebas.
3. **CSV injection.** Decidir sanitizacion por exportable si se requiere como mejora futura.
4. **H13 operativo continuo.** Usar el checklist permanente antes de cada deploy productivo y actualizarlo solo si cambia infraestructura real.
5. **H15 operativo.** Mantener smoke de sesion/inactividad si se ajusta la politica de tiempo o UX del modal.
6. **H17 monitoreo.** Validar acceso real de coordinadoras y resolver remanentes solo con nuevo mapping aprobado.
7. **H18 Reportes Operativos.** Cerrado operativo. Mantener pruebas/regresion, guardas por rol y monitoreo de exportables CSV/XLSX.
8. **H19 Directorio.** Cerrado controlado; monitorear Directorio y repetir el procedimiento solo ante una nueva carga aprobada.
9. **H20 Nomina compartida.** Cerrado operativo; mantener pruebas y monitoreo de alcance, totales y seguridad fiscal.

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
- H21 no tiene decisiones tecnicas pendientes para la implementacion local/test. El paso productivo requiere aprobacion humana de H05/H13, backup, migracion `013`, CSV institucional y smoke; no se ejecuta automaticamente.

## 7. Recomendacion final

No se recomienda reabrir H02/H03 mientras produccion siga estable.

El foco tecnico inmediato debe pasar a:

- mantener H11 cerrado con helper CSV central y pruebas de regresion;
- conservar H04/H05 como barreras obligatorias antes de cambios;
- usar H13 como checklist permanente antes de despliegues productivos;
- consultar el cierre global `docs/auditoria/CIERRE_GLOBAL_MATRIZ_RIESGOS_NOMINA_DOCENTE_20260603.md` como evidencia ejecutiva de estado de matriz;
- usar el SDD consolidado post H09/H10 como primera fuente documental.
