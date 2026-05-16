# Matriz Formal de Riesgos - Nómina Docente

## 1. Contexto

Esta matriz formaliza los riesgos pendientes del proyecto Nómina Docente con base en el SDD retrospectivo `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md`, la matriz de priorización previa y el cierre del Hotfix H01.

H01, correspondiente a precisión monetaria con `number` en Node/API, ya fue cerrado técnica y operativamente. El sistema desplegado usa `decimal.js`, mantiene importes PostgreSQL `numeric` como string decimal en la API y expone importes monetarios como `MoneyString` en frontend.

Esta matriz se enfoca únicamente en H02-H14. No propone cambios de código todavía. Mantiene como arquitectura real: Vue 3 + Firebase Auth + Cloud Run + Fastify + PostgreSQL.

## 2. Criterios de prioridad

- **P0 Crítico:** corregir inmediatamente.
- **P1 Alto:** corregir en la siguiente fase controlada.
- **P2 Medio:** planificar en backlog técnico.
- **P3 Bajo:** documentación, operación o mejora futura.

## 3. Matriz de riesgos

| ID | Riesgo | Área | Evidencia en SDD | Impacto | Probabilidad | Prioridad | Estado | Recomendación | Criterio de cierre | Requiere decisión humana |
|---|---|---|---|---|---|---|---|---|---|---|
| H02 | Resolución de coordinación por `display_name` / `legacy_username`. | Seguridad / Permisos / Datos operativos | Sección 10 indica que la resolución de coordinación por nombre es funcional pero frágil; sección 22 lo lista como deuda técnica. | Alto: un usuario podría quedar asociado a coordinación incorrecta, afectando edición de docentes, horarios, incidencias y extras. | Media | P1 Alto | Pendiente | Definir una relación explícita usuario-coordinación como fuente de verdad y documentar fallback solo para migración. | Existe modelo formal usuario-coordinación; rutas críticas usan ID de coordinación asignado; pruebas con nombres similares, cambios de nombre, usuario sin coordinación, admin, coordinador, RH y dirección pasan. | Sí: Operación debe confirmar fuente oficial de coordinación por usuario. |
| H03 | Alcance de `finance.view` y `fiscal.manage` sobre edición fiscal. | Roles / Seguridad / RH / Finanzas | Secciones 10 y 19 indican que `finance.view` y `fiscal.manage` permiten acciones sobre expedientes/constancias y requieren confirmación formal. | Alto: Finanzas podría editar RFC, correo, banco o constancia si operación espera solo lectura. | Media | P1 Alto | Pendiente | Construir matriz rol-ruta-acción y pedir aprobación formal de Admin, Finanzas, RH y Dirección. | Matriz de permisos aprobada; pruebas por rol validan consultar, editar, subir constancia, descargar y exportar según alcance aprobado. | Sí: Finanzas, RH y Dirección deben aprobar alcance. |
| H04 | Falta de pruebas automatizadas. | Calidad / Nómina / Finanzas / Permisos | Secciones 12 y 22 indican que no se detectó suite automatizada de negocio. | Alto: regresiones en nómina, permisos, exportables o estados pueden llegar a producción sin ser detectadas por typecheck. | Alta | P1 Alto | Pendiente | Crear suite mínima de pruebas de cálculo, permisos y exportables críticos antes de refactors grandes. | Existen pruebas automatizadas para cálculo de nómina, faltas, retardos, extras, permisos por rol, CSV/PDF básicos y regresión H01; se ejecutan en checklist de despliegue. | Sí: Operación debe validar casos de referencia y Finanzas debe aprobar totales esperados. |
| H05 | Migraciones SQL sin control formal. | Base de datos / DevOps | Secciones 8 y 22 indican que hay SQL incrementales, pero no se detectó tabla/herramienta formal que registre migraciones aplicadas. | Alto: riesgo de migraciones fuera de orden, duplicadas, incompletas o difíciles de auditar. | Media | P1 Alto | Pendiente | Formalizar herramienta o tabla de control de migraciones, con orden, checksum, rollback y respaldo previo. | Existe control de migraciones aplicado en BD; instalación limpia y actualización existente ejecutan la misma secuencia; hay evidencia de versión de esquema. | Sí: DevOps/Admin debe aprobar herramienta/proceso de migración. |
| H06 | Coexistencia con Apps Script legado. | Arquitectura / Operación / Gobierno de datos | Secciones 1 y 20 indican que Apps Script se conserva como referencia y está pendiente confirmar si sigue activo. | Alto: doble fuente de verdad, capturas paralelas, confusión operativa o uso de hojas no sincronizadas. | Media | P1 Alto | Pendiente | Definir estado oficial del legado: congelado, solo consulta, respaldo histórico o desactivado. | Existe acta/procedimiento de retiro o congelamiento; usuarios conocen fuente oficial; no hay capturas productivas paralelas fuera del sistema moderno. | Sí: Dirección y operación deben decidir continuidad o retiro del legado. |
| H07 | Provider Google con parámetro `hd` comentado. | Autenticación / UX / Seguridad preventiva | Sección 9 indica que `hd` está comentado y backend valida dominio institucional. | Medio: usuarios externos pueden intentar login antes de ser rechazados por backend; más ruido y peor experiencia. | Media | P2 Medio | Pendiente | Evaluar activar `hd` como mejora UX sin confiar seguridad al frontend; mantener validación backend. | Login institucional funciona; cuentas externas quedan filtradas desde selector y también rechazadas por backend; pruebas con cuenta personal y otro dominio documentadas. | No crítica; recomendable confirmar con Admin Google si hay cuentas alias externas válidas. |
| H08 | Lógica concentrada en archivos grandes. | Mantenibilidad / Backend / Frontend | Secciones 5 y 22 identifican archivos grandes: `payroll.ts`, `reports.ts`, `schedules.ts`, `FinanceReportsView.vue`, `PayrollView.vue`, entre otros. | Medio: mayor riesgo de conflictos, regresiones y lentitud al modificar módulos. | Alta | P2 Medio | Pendiente | Refactor incremental por servicios internos y componentes, después de pruebas base. | Módulos críticos separados por responsabilidad; pruebas de regresión pasan; no cambian contratos públicos ni reglas de negocio. | No para iniciar análisis técnico; sí para priorizar alcance de refactor por operación. |
| H09 | Estados `BORRADOR` y `CERRADA` no usados claramente. | Modelo / Flujo financiero | Secciones 17 y 23 indican que se usan principalmente `CALCULADA`, `EN_REVISION`, `APROBADA`, `PAGADA`, `CANCELADA`, y queda pendiente confirmar `BORRADOR`/`CERRADA`. | Medio: ambigüedad en reportes, auditoría y evolución del flujo financiero. | Media | P2 Medio | Pendiente | Documentar máquina de estados oficial de nómina y depurar semántica operativa antes de agregar flujos nuevos. | Diagrama de estados aprobado; cada estado tiene botones, permisos, reportes y reglas de transición definidos o queda marcado como reservado. | Sí: Finanzas/Dirección deben aprobar flujo financiero formal. |
| H10 | Cierre de cuatrimestre moderno pendiente. | Ciclos / Históricos / Operación académica | Secciones 7.8, 16 y 23 indican que activar ciclo cierra otros, pero queda pendiente confirmar si eso cubre cierre de cuatrimestre. | Medio: operación podría esperar archivado, limpieza o historial adicional no cubierto por el flujo actual. | Media | P2 Medio | Pendiente | Validar proceso real de cierre con operación antes de implementar un módulo adicional. | Cierre de ciclo documentado y probado: horarios históricos, nuevo ciclo, nuevas quincenas, incidencias/extras, nómina e histórico se comportan como operación requiere. | Sí: Coordinación académica y Dirección deben definir cierre esperado. |
| H11 | CSV con posible diferencia de codificación según módulo. | Reportes / Finanzas / Excel | Sección 23 menciona requerimientos de CSV/PDF para Excel, acentos y auditoría; matriz previa documenta antecedentes de problemas de acentuación. | Medio: nombres, coordinaciones o textos con acentos/ñ pueden verse mal en Excel y generar reprocesos. | Media | P2 Medio | Pendiente | Estandarizar generación CSV UTF-8 con BOM donde aplique y probar en Excel Windows. | Exportables críticos abren correctamente en Excel, Google Sheets y LibreOffice con acentos, ñ, RFC y textos largos. | Sí para validar formato esperado por Finanzas; no para la corrección técnica básica. |
| H12 | Dependencia de nombres para catálogos/tabuladores históricos. | Catálogos / Horarios / Históricos | Secciones 17 y 23 indican que nómina guarda snapshots, pero falta política de inactivación/renombrado de catálogos históricos. | Medio: cambios de asignaturas o tabuladores podrían confundir interpretación histórica o captura viva. | Baja | P2 Medio | Pendiente | Definir política: inactivar en vez de borrar, conservar snapshots y controlar edición de valores usados. | Política documentada; pruebas de cambio/inactivación de asignatura y tabulador no alteran nóminas guardadas ni rompen horarios vivos. | Sí: Operación académica y Finanzas deben definir política de catálogo. |
| H13 | Variables productivas no versionadas. | Infraestructura / DevOps / Auditoría | Sección 22 lo identifica como deuda; sección 3 documenta despliegue, pero variables reales no están formalizadas como checklist completo. | Bajo: dificulta reproducibilidad y auditoría exacta de Cloud Run, CORS, buckets y dominios. | Media | P3 Bajo | Pendiente | Crear inventario no secreto de configuración productiva y checklist de despliegue. | Documento operativo contiene variables no secretas, origen de secretos, servicios, buckets, dominios, CORS y verificación de health/logs. | No para documentar; sí para validar propietarios de secretos y servicios. |
| H14 | Legado Apps Script con lógica extensa. | Documentación / Retiro legado | Sección 20 confirma `Codigo.gs` e `index.html` y marca pendiente inventario/retiro; sección 22 lo lista como deuda. | Bajo a medio: pérdida de conocimiento si se elimina sin inventario o confusión si se mantiene sin estado oficial. | Media | P3 Bajo | Pendiente | Inventariar equivalencias legacy vs moderno y declarar estado del legado. | Documento de equivalencias y decisión de archivo histórico/congelamiento/retiro aprobado. | Sí: Dirección/operación deben decidir estado final del legado. |

## 4. Riesgos P1 recomendados para siguiente fase

Orden recomendado según urgencia real:

1. **H02 - Resolución de coordinación por `display_name` / `legacy_username`.**  
   Es el primer riesgo a atender porque afecta aislamiento operativo por coordinación. Si falla, puede permitir edición o captura asociada a una coordinación incorrecta.

2. **H03 - Alcance de `finance.view` y `fiscal.manage`.**  
   Debe resolverse junto con H02 porque define quién puede modificar expedientes fiscales y constancias.

3. **H04 - Falta de pruebas automatizadas.**  
   Debe entrar antes de refactors o cambios profundos para proteger nómina, permisos y reportes.

4. **H05 - Migraciones SQL sin control formal.**  
   Importante para gobierno de base de datos, colaboración y despliegues controlados.

5. **H06 - Coexistencia con Apps Script legado.**  
   Riesgo operativo relevante, pero requiere decisión institucional antes de cualquier acción técnica.

## 5. Decisiones humanas necesarias

Decisiones que deben confirmarse antes de corregir:

- **Operación académica:** fuente oficial para relación usuario-coordinación.
- **Dirección:** si Apps Script queda congelado, retirado o disponible solo como consulta histórica.
- **Finanzas:** si `finance.view` puede editar expedientes fiscales o solo consultarlos.
- **RH:** si `fiscal.manage` debe ser el permiso principal para edición de RFC, correo, banco y constancia fiscal.
- **Dirección/Finanzas:** flujo oficial de estados de nómina y significado de `BORRADOR` y `CERRADA`.
- **Operación académica:** proceso esperado de cierre de cuatrimestre y apertura de nuevo ciclo.
- **Finanzas:** formato definitivo de CSV/PDF para Excel, acentos, ñ y layout de reportes.
- **Operación académica y Finanzas:** política de edición, inactivación y conservación histórica de asignaturas/tabuladores.
- **DevOps/Admin:** herramienta o procedimiento oficial para controlar migraciones SQL.
- **Admin/Gobierno técnico:** política de retención de auditoría y documentación de variables productivas no secretas.

## 6. Plan de atención por fases

### Fase A: seguridad y permisos

Riesgos incluidos:

- H02
- H03
- H07
- H09 en su parte de permisos/flujo

Objetivo:

- Cerrar ambigüedades de coordinación, roles, permisos y login institucional.

Entregables:

- Matriz rol-ruta-acción.
- Definición de relación usuario-coordinación.
- Validación de permisos por rol.
- Decisión sobre `hd` en Google Provider.
- Diagrama de estados de nómina aprobado.

### Fase B: pruebas automatizadas

Riesgos incluidos:

- H04
- Cobertura de regresión para H01
- Cobertura parcial de H02/H03/H09/H11

Objetivo:

- Crear una base mínima de pruebas que permita modificar el sistema sin romper nómina, permisos ni reportes.

Entregables:

- Pruebas unitarias de cálculo.
- Pruebas de integración API para permisos por rol.
- Casos de nómina con faltas, retardos, extras de incidencia y extras externos.
- Pruebas de exportables críticos.

### Fase C: migraciones y DevOps

Riesgos incluidos:

- H05
- H13

Objetivo:

- Asegurar trazabilidad de esquema y configuración productiva.

Entregables:

- Control formal de migraciones.
- Checklist de despliegue.
- Inventario de variables no secretas.
- Procedimiento de rollback de base de datos y servicios.

### Fase D: retiro/congelamiento Apps Script

Riesgos incluidos:

- H06
- H14

Objetivo:

- Evitar doble operación y conservar conocimiento histórico del legado.

Entregables:

- Decisión formal de Dirección.
- Inventario de procesos legacy.
- Equivalencia legacy vs moderno.
- Plan de congelamiento, consulta histórica o retiro.

### Fase E: deuda técnica y documentación

Riesgos incluidos:

- H08
- H10
- H11
- H12
- H13 residual

Objetivo:

- Reducir complejidad, mejorar mantenimiento y cerrar documentación operativa.

Entregables:

- Refactor incremental con pruebas.
- Documento de cierre de cuatrimestre.
- Estándar de CSV/PDF.
- Política de catálogos históricos.
- Documentación de mantenimiento.

## 7. Recomendación final

El primer riesgo que debe atenderse es **H02 - resolución de coordinación por `display_name` / `legacy_username`**.

Motivo:

- Es un riesgo P1 de seguridad y operación diaria.
- Afecta directamente edición de horarios, incidencias, extras y docentes.
- Puede generar datos asociados a una coordinación incorrecta.
- Es prerequisito natural para cerrar correctamente la matriz de permisos de H03.

La siguiente fase debe iniciar con una validación funcional y humana de usuario-coordinación, seguida por la matriz rol-ruta-acción. Después de eso conviene implementar pruebas automatizadas mínimas antes de realizar correcciones estructurales o refactors.
