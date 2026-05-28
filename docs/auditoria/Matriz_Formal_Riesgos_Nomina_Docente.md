# Matriz Formal de Riesgos - Nomina Docente

Actualizacion: 2026-05-28

## 1. Contexto

Esta matriz formaliza el estado de riesgos del proyecto Nomina Docente despues de:

- Cierre tecnico/operativo H01.
- Implementacion y deploy productivo H02/H03.
- Migracion productiva de datos oficiales de mayo 2026.
- Conciliacion de nomina `2026-05-15 a 2026-05-28` por `$517,510.00`.
- Limpieza productiva de docentes duplicados por formato de nombre.
- Cierre controlado de recursos preview/dry-run.
- Cierre H06/H14 con retiro controlado de archivos Apps Script legacy del repositorio.

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
| H04 | Falta de pruebas automatizadas de negocio | Calidad / Nomina / Finanzas / Permisos | Pendiente | Alto: regresiones pueden pasar con solo typecheck/build | P1 Alto | Crear suite automatizada minima de calculo, permisos y reportes criticos | Pruebas automatizadas cubren nomina, faltas, retardos, extras, H01, H02/H03 y workflow | Si: Operacion/Finanzas deben aprobar casos esperados |
| H05 | Migraciones SQL sin control formal de ejecucion | Base de datos / DevOps | Mitigado parcialmente | Medio: scripts existen, pero falta registro formal con checksum | P1 Alto | Implementar tabla/herramienta de control de migraciones | BD registra migraciones aplicadas, orden, checksum, fecha y rollback | Si: DevOps/Admin aprueba proceso |
| H06 | Coexistencia con Apps Script legado | Arquitectura / Operacion / Gobierno de datos | Cerrado | Bajo: queda solo riesgo de copias externas no controladas | P1 cerrado | Mantener Git como respaldo historico y evitar reintroducir Apps Script como fuente operativa | Documento H06/H14 de cierre y archivos retirados | No para repo; si para inventario externo |
| H07 | Provider Google con `hd` comentado | Auth / UX / Seguridad preventiva | Pendiente | Medio-bajo: backend ya valida dominio | P2 Medio | Evaluar `hd` como mejora UX, no como control principal | Pruebas con cuenta institucional y externa documentadas | Opcional con Admin Google |
| H08 | Logica concentrada en archivos grandes | Mantenibilidad / Backend / Frontend | Pendiente | Medio: cambios futuros tienen mayor riesgo | P2 Medio | Refactor incremental despues de tener pruebas automatizadas | Servicios/componentes separados sin cambiar contratos ni reglas | No al inicio; si para priorizar modulos |
| H09 | Estados `BORRADOR` y `CERRADA` no usados claramente | Modelo / Flujo financiero | Pendiente | Medio: ambiguedad futura de reportes/workflow | P2 Medio | Documentar maquina de estados oficial | Diagrama aprobado de transiciones, permisos y botones | Si: Finanzas/Direccion |
| H10 | Cierre de cuatrimestre moderno pendiente | Ciclos / Historicos / Operacion academica | Pendiente | Medio: expectativas operativas pueden diferir del cierre de ciclo actual | P2 Medio | Validar proceso real de cierre con operacion | Cierre probado con nuevo ciclo/quincena/historicos | Si: Coordinacion/Direccion |
| H11 | CSV y acentos/codificacion | Reportes / Excel / Importaciones | Pendiente | Medio: reprocesos por acentos/mojibake | P2 Medio | Estandarizar UTF-8/BOM y pruebas Excel por exportable | Exportables criticos abren bien en Excel/Sheets/LibreOffice | Si: Finanzas valida formato |
| H12 | Nombres de catalogos/tabuladores historicos | Catalogos / Horarios / Historicos | Pendiente | Medio-bajo: confusion historica si se renombra/borra | P2 Medio | Politica de inactivar en vez de borrar y conservar snapshots | Politica documentada y probada | Si: Operacion/Finanzas |
| H13 | Variables productivas no versionadas | Infraestructura / DevOps | Mitigado | Bajo: despliegues H02/H03 documentan variables no secretas | P3 Bajo | Consolidar checklist permanente de variables no secretas | README/manual operativo reflejan variables, secretos y healthchecks | No para documentar; si para propietarios de secretos |
| H14 | Apps Script legacy extenso | Documentacion / Retiro legado | Cerrado | Bajo: trazabilidad historica queda en Git | P3 cerrado | No usar legacy local como referencia funcional; consultar Git solo como historico | Documento H06/H14 de cierre | No |

## 4. Riesgos que ya no deben tratarse como pendientes

### H02

Cerrado operativamente:

- Existe `user_coordinations`.
- Se eliminaron recursos preview/dry-run.
- No se crean coordinaciones automaticamente desde flujos operativos.
- Horarios, Incidencias, Extras y Directorio respetan reglas por usuario capturador donde aplica.
- Docentes compartidos entre coordinadores se permiten sin otorgar edicion global.
- Fallback legacy queda solo como contingencia temporal.

Pendiente residual:

- Monitorear uso de fallback y retirarlo cuando se cumpla la condicion aprobada.

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

## 5. Siguiente fase recomendada

Orden recomendado:

1. **H04 - pruebas automatizadas.** Es el siguiente bloque mas importante porque H02/H03 ya estan productivos y deben protegerse de regresiones.
2. **H05 - control formal de migraciones.** Hay buenos scripts y backups, pero falta registrar migraciones aplicadas con checksum.
3. **H09/H10 - flujo financiero y cierre de cuatrimestre.** Requieren definicion operativa antes de codigo.
4. **H11/H12 - exportables y catalogos historicos.** Mejoras de estabilidad operativa.

## 6. Decisiones humanas pendientes

Pendientes reales despues de H02/H03:

- Definir fecha/condicion operativa final para retirar fallback legacy despues de estabilizacion.
- Confirmar si existen copias externas de Apps Script en Google Drive o respaldos institucionales y marcarlas como historicas/no operativas.
- Aprobar casos esperados para pruebas automatizadas de nomina/permisos.
- Aprobar herramienta/proceso formal de migraciones.
- Definir maquina de estados financiera si se usaran `BORRADOR` o `CERRADA`.
- Definir cierre de cuatrimestre moderno.
- Definir politica de catalogos historicos.
- Validar formato final de CSV/PDF para Finanzas.

## 7. Recomendacion final

No se recomienda reabrir H02/H03 mientras produccion siga estable.

El foco tecnico inmediato debe pasar a:

- proteger lo ya desplegado con pruebas automatizadas;
- formalizar migraciones;
- cerrar decisiones operativas pendientes de estados financieros y cierre de cuatrimestre.
