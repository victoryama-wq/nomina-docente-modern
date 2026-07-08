# SPEC H18 - Modulo Reportes Operativos

Fecha: 2026-07-08

Estado: SPEC / diseno funcional. No implementado.

## 1. Resumen ejecutivo

H18 propone un nuevo modulo llamado `Reportes` para consulta operativa no financiera. El modulo tendra dos pestanas:

- `Horas base y extras`.
- `Horas base por categoria`.

El objetivo es dar visibilidad operativa sobre horas base, horas extra, capturadores, categorias, ciclos, quincenas y coordinaciones sin modificar la formula de nomina, sin cambiar permisos productivos y sin alterar reportes financieros o CSV existentes.

Esta fase es solo documental. No se modifica backend, frontend, base de datos, permisos productivos, roles, migraciones, deploy ni datos reales.

## 2. Alcance

Incluye:

- Diseno funcional del modulo `Reportes`.
- Definicion de pestanas, filtros, columnas y exportables.
- Identificacion de fuentes de datos actuales.
- Reglas de permisos propuestas por rol.
- Riesgos y decisiones humanas pendientes antes de implementar.
- Plan de implementacion por fases.

No incluye:

- Implementacion backend.
- Implementacion frontend.
- Migraciones SQL.
- Nuevos permisos productivos.
- Cambios a roles.
- Cambios a formula H01.
- Cambios a Finanzas, Nomina, CSV existentes, cierre de ciclo o catalogos.
- Deploy.
- Consultas o cambios en produccion.

## 3. Pestana 1 - Horas base y extras

Nombre sugerido:

```text
Horas base y extras
```

### Objetivo

Consultar docentes con horas base y horas extra relacionadas con un ciclo, periodo/quincena y coordinacion. Debe permitir identificar:

- docente;
- categoria;
- coordinacion;
- ciclo academico;
- quincena o periodo;
- horas base;
- horas extra de incidencia, si aplica;
- horas extra externas registradas en `extra_hours`;
- capturador de horas extra externas;
- motivo, referencia, actividad u observaciones cuando existan;
- totales por docente/coordinacion/periodo.

### Usuarios permitidos

Regla aprobada para diseno:

- Permitido: Direccion/Subdireccion.
- Admin: decision pendiente. Puede conservar acceso global solo si se confirma que el patron de soporte tecnico global aplica tambien a este reporte.

Denegados:

- Coordinador.
- RH.
- Finanzas.
- Contador.
- Contabilidad.
- Otros roles no autorizados.

Backend debe validar la regla. Ocultar la pestana en frontend no es suficiente.

### Columnas propuestas

| Columna | Fuente propuesta | Observacion |
|---|---|---|
| Ciclo | `academic_cycles.period_label`, `academic_cycles.quarter_code` | Seleccionable por filtro. |
| Periodo/quincena | `payroll_calendar_config.period_label`, fechas `payroll_start/payroll_end` | Necesario para calcular periodo o consultar snapshot. |
| Docente | `teachers.full_name` o snapshot | Para historico cerrado, preferir snapshot. |
| Categoria | `teachers.category` o `payroll_lines.category_snapshot` | Valores tecnicos: `V`, `M`, `N`. |
| Coordinacion | `coordinations.name` o snapshot | No usar nombres reservados como coordinacion operativa. |
| Horas base | `schedules` para vivo, `payroll_lines.base_hours` o `payroll_schedule_details.base_hours` para historico | No cambiar formula H01. |
| Extras de incidencia | `schedule_incidences.extra_hours_in_schedule` o snapshot `schedule_extra_hours` | No tiene capturador original dedicado. |
| Extras externos | `extra_hours.hours` o snapshot `payroll_extra_details.hours` | Captura operativa de extras. |
| Capturador extra externo | `extra_hours.captured_by` -> `app_users.email/display_name` | No usar `updated_by` como capturador original. |
| Motivo extra | `extra_hours.reason` o `payroll_extra_details.reason_snapshot` | Puede estar vacio en snapshot si no se guardo. |
| Fecha actividad | `extra_hours.activity_date` o snapshot | Rango de fechas opcional. |
| Observaciones/referencia | `extra_hours.observations`, `extra_hours.reference` | Solo para extras externos vivos. |
| Totales | Sumas derivadas | Usar helpers decimales existentes al implementar. |

### Filtros propuestos

- ciclo academico;
- quincena/periodo;
- docente;
- coordinacion;
- categoria;
- capturador de horas extra;
- rango de fechas, aplicado a `extra_hours.activity_date` o `captured_at` cuando corresponda;
- tipo:
  - con extras;
  - sin extras;
  - todos;
- estatus de docente, si aplica.

### Fuente de datos

Para reporte operativo actual:

- Horas base vivas desde `schedules`.
- Extras externos vivos desde `extra_hours`.
- Extras capturados en incidencias desde `schedule_incidences.extra_hours_in_schedule`.
- Periodos desde `payroll_calendar_config`.

Para periodos con nomina guardada:

- Preferir snapshots:
  - `payroll_lines`;
  - `payroll_schedule_details`;
  - `payroll_extra_details`.

Decision recomendada:

- Si existe corrida de nomina no cancelada para el periodo, mostrar datos de snapshot para preservar historia.
- Si no existe corrida guardada, mostrar datos vivos.
- Documentar claramente en UI si el origen es `vivo` o `snapshot`.

### Reglas de calculo

- No cambiar H01.
- No recalcular montos financieros.
- Horas base por periodo deben seguir la misma logica ya usada por Nomina si se selecciona quincena.
- Horas base semanales pueden mostrarse como metrica operativa separada si se requiere.
- Horas extra externas vienen de `extra_hours`.
- Horas extra de incidencia vienen de `schedule_incidences.extra_hours_in_schedule`.
- No mezclar horas extra externas con horas base.
- No usar `updated_by` como capturador original.

### Ambiguedad detectada

`schedule_incidences` no tiene campo de capturador original. Solo tiene `updated_by`, que ya fue documentado en H02/H03 como no apto para autoria original.

Por lo tanto:

- para `extra_hours`, el capturador debe ser `extra_hours.captured_by`;
- para extras de incidencia, el reporte debe mostrar `Sin capturador original` o solo `ultimo actualizador`, pero esto requiere decision humana antes de implementarse.

## 4. Pestana 2 - Horas base por categoria

Nombre sugerido:

```text
Horas base por categoria
```

### Objetivo

Consultar docentes con horas base asignadas contra la carga esperada por categoria:

- VIP;
- Medio tiempo;
- Nuevo ingreso.

La tabla debe permitir identificar docentes completos, incompletos o excedidos.

### Usuarios permitidos

Permitidos:

- Admin.
- Direccion/Subdireccion.
- Coordinador.
- RH.
- Otros roles operativos no financieros si existieran y se aprueban.

Denegados:

- Finanzas.
- Contador.
- Contabilidad.

Backend debe validar esta exclusion.

### Columnas propuestas

| Columna | Fuente propuesta | Observacion |
|---|---|---|
| Docente | `teachers.full_name` | Consultar global o por alcance segun decision H18-F1. |
| Categoria | `teachers.category` | `V`, `M`, `N`. |
| Categoria legible | Mapeo UI | `V=VIP`, `M=Medio tiempo`, `N=Nuevo ingreso`. Requiere confirmacion humana. |
| Horas base esperadas | Regla tecnica vigente `categoryMaxHours` | `V=35`, `M=25`, `N=15`; confirmar como fuente oficial del reporte. |
| Horas base asignadas | Suma de `schedules` por ciclo | Definir si usa L-V o maximo entre semana/modulos. |
| Horas restantes | Esperadas - asignadas | Si negativo, estado `excedido`. |
| Coordinacion | `coordinations.name` | Segun registro o capturador. |
| Ciclo | `academic_cycles` | Filtro requerido. |
| Periodo/quincena | `payroll_calendar_config`, si aplica | Si se requiere por periodo. |
| Estado | Derivado | `completo`, `faltante`, `excedido`. |

### Filtros propuestos

- ciclo academico;
- coordinacion;
- categoria;
- docente;
- estado:
  - completo;
  - faltante;
  - excedido;
- docente activo/inactivo.

### Regla de horas esperadas por categoria

Fuente tecnica detectada en codigo actual:

- `apps/api/src/routes/academic-context.ts`
- `apps/api/src/routes/schedules.ts`
- `apps/api/src/routes/extras.ts`

La regla vigente de maxima carga usada por Horarios/Extras es:

| Categoria tecnica | Nombre operativo sugerido | Horas maximas vigentes |
|---|---|---:|
| `V` | VIP | 35 |
| `M` | Medio tiempo | 25 |
| `N` u otro fallback | Nuevo ingreso | 15 |

Tambien se detecto que:

- `teachers.category` contiene la categoria tecnica.
- `tabulators` define montos/tabuladores, no horas esperadas.
- La logica de nomina calcula horas base reales desde `schedules` y calendario.
- H01 no debe modificarse.

Decision requerida antes de implementar:

- Confirmar que H18 debe usar `V=35`, `M=25`, `N=15` como horas esperadas oficiales para el reporte.
- Confirmar si las horas asignadas deben compararse contra:
  - horas L-V semanales;
  - modulo 1;
  - modulo 2;
  - maximo entre semana/modulo 1/modulo 2, como validacion actual de Horarios;
  - horas por quincena calculadas contra calendario.

No se deben inventar valores nuevos.

## 5. Fuentes de datos

| Dato | Tabla/campo fuente | Observacion |
|---|---|---|
| Docente | `teachers.id`, `teachers.full_name` | Snapshot en historico: `payroll_lines.teacher_name_snapshot`. |
| Categoria | `teachers.category` | Snapshot en historico: `payroll_lines.category_snapshot`. |
| Coordinacion | `schedules.coordination_id`, `extra_hours.coordination_id`, `coordinations.name` | Snapshot en historico: campos `coordination_name_snapshot`. |
| Ciclo | `academic_cycles.id`, `period_label`, `quarter_code`, `status` | `PLANEACION`, `ACTIVO`, `CERRADO`. |
| Quincena/periodo | `payroll_calendar_config.period_label`, `payroll_start`, `payroll_end` | Para filtros y calculo por periodo. |
| Horas base vivas | `schedules.hours_l`, `hours_m`, `hours_x`, `hours_j`, `hours_v`, `hours_s1`, `hours_s2` | No mezclar con extras. |
| Horas base snapshot | `payroll_lines.base_hours`, `payroll_schedule_details.base_hours` | Preferible en historicos guardados. |
| Extras de incidencia vivos | `schedule_incidences.extra_hours_in_schedule` | Sin capturador original dedicado. |
| Extras de incidencia snapshot | `payroll_lines.schedule_extra_hours`, `payroll_schedule_details.schedule_extra_hours` | Snapshot de nomina guardada. |
| Extras externos vivos | `extra_hours.hours` | Capturados en modulo Extras. |
| Capturador extra externo | `extra_hours.captured_by` -> `app_users` | Fuente correcta de capturador. |
| Extras externos snapshot | `payroll_lines.logged_extra_hours`, `payroll_extra_details.hours` | `payroll_extra_details` no conserva `captured_by`. |
| Motivo extra | `extra_hours.reason`, `payroll_extra_details.reason_snapshot` | Snapshot no incluye observaciones/referencia. |
| Fecha actividad extra | `extra_hours.activity_date`, `payroll_extra_details.activity_date` | Usar para rango de fechas. |
| Tabulador monto | `schedules.tabulator_amount`, `extra_hours.tabulator_amount` | No usar para horas esperadas por categoria. |
| Usuario capturador | `app_users.id/email/display_name` | Evitar datos sensibles innecesarios. |

## 6. Permisos y seguridad

### Regla propuesta sin migracion

Como no existe un permiso especifico para reportes operativos, H18-F1 puede implementar guardas backend por rol usando `SessionUser.role`, sin crear migracion.

Si se decide crear permisos formales como `operational.reports.base_extra` y `operational.reports.category_hours`, se requeriria migracion/seed futura bajo H05. No hacerlo en esta fase.

| Rol | Pestana 1 | Pestana 2 | Observacion |
|---|---|---|---|
| Admin | Pendiente decision | Permitido | Soporte global existente, pero Tab 1 pide exclusividad Direccion/Subdireccion. |
| Direccion/Subdireccion (`direccion`) | Permitido | Permitido | Rol tecnico vigente para Subdireccion. |
| Coordinador | Denegado | Permitido | Mantener alcance operativo si se decide filtrar por actor. |
| RH | Denegado | Permitido | No debe obtener datos financieros extra por este modulo. |
| Finanzas | Denegado | Denegado | Exclusion explicita de Tab 2. |
| Contador | Denegado | Denegado | Exclusion explicita de Tab 2. |
| Contabilidad | Denegado | Denegado | Equivalente a Contador. |
| Otros | Denegado por defecto | Pendiente | Definir si aparecen roles nuevos. |

Seguridad requerida:

- Backend debe negar acceso, no solo frontend.
- No exponer datos fiscales en H18.
- No exponer banco, RFC, paymentType ni constancias.
- No cambiar permisos financieros H03.
- No usar `finance.view` como acceso a H18.
- No usar `reports.view` de forma amplia si rompe exclusiones por rol.

## 7. API propuesta

Endpoints propuestos, sin implementar:

```text
GET /reports/operational/base-extra
GET /reports/operational/base-extra/export
GET /reports/operational/category-hours
GET /reports/operational/category-hours/export
```

Parametros sugeridos:

```text
cycleId
calendarConfigId
teacherId
coordinationId
category
capturedBy
dateFrom
dateTo
type
status
format
```

Formato export:

- `format=csv` por defecto.
- `format=xlsx` solo si se aprueba dependencia o infraestructura Excel real.

Ubicacion tecnica sugerida:

- Backend: `apps/api/src/routes/reports.ts` o archivo nuevo `operational-reports.ts` registrado desde la app principal.
- Mantener separacion de Finanzas para no mezclar `finance.view` con H18.

Guardas propuestas:

- `requireOperationalBaseExtraReport`: rol `direccion`; admin opcional segun decision.
- `requireOperationalCategoryHoursReport`: roles permitidos menos `finanzas`, `contador`, `contabilidad`.

## 8. Frontend propuesto

Crear vista nueva:

```text
apps/web/src/views/ReportsView.vue
```

Elementos:

- Modulo en menu: `Reportes`.
- Dos pestanas:
  - `Horas base y extras`;
  - `Horas base por categoria`.
- Filtros superiores.
- Tabla densa y escaneable.
- Resumen de totales.
- Boton CSV.
- Boton Excel solo si se aprueba.

Integracion:

- `apps/web/src/api.ts`: contratos y funciones de consulta/export.
- `apps/web/src/stores/auth.ts`: helper visual especifico si se implementa.
- `apps/web/src/router/index.ts`: ruta protegida.
- Menu/layout: visible solo si al menos una pestana esta permitida.

Regla UI:

- La UI debe ocultar pestanas no permitidas.
- Backend sigue siendo autoridad.
- Si un usuario no tiene ninguna pestana permitida, no debe ver el modulo.

## 9. Exportacion

CSV:

- Usar helper H11.
- UTF-8 con BOM.
- CRLF.
- `Content-Type: text/csv; charset=utf-8`.
- `Content-Disposition` con nombre estable.
- No alterar montos ni horas.
- No tocar CSV existentes.

Nombres sugeridos:

```text
reporte-horas-base-extras-<periodo>.csv
reporte-horas-base-categoria-<ciclo>.csv
```

Excel:

- Opcion A: CSV compatible con Excel, usando H11.
- Opcion B: `.xlsx` real.

Si se requiere `.xlsx` real:

- Revisar si ya existe dependencia aprobada.
- Si no existe, pedir aprobacion antes de agregar dependencia.
- No agregar dependencia en H18-F0.

## 10. Riesgos

| Riesgo | Impacto | Mitigacion propuesta |
|---|---|---|
| Calculo incorrecto de horas base | Alto | Reusar logica actual de Horarios/Nomina y cubrir con pruebas H04. |
| Confundir horas base con horas extra | Alto | Columnas separadas y definicion clara de fuentes. |
| Usar capturador incorrecto | Alto | Usar `extra_hours.captured_by`; no usar `updated_by` salvo decision explicita. |
| Exponer Tab 1 fuera de Direccion/Subdireccion | Alto | Guard backend por rol. |
| Exponer Tab 2 a Finanzas/Contador/Contabilidad | Alto | Guard backend por rol y pruebas. |
| Usar `finance.view` o `reports.view` indebidamente | Alto | No reutilizar permisos amplios sin validar exclusiones. |
| Mezclar datos vivos con snapshots | Medio | Priorizar snapshots si existe nomina guardada; indicar origen. |
| Cambiar H01 accidentalmente | Alto | No tocar formula; solo leer datos y probar regresion. |
| Exponer datos fiscales | Alto | Excluir RFC, banco, paymentType, constancias y datos fiscales. |
| Excel real requiere dependencia nueva | Medio | Documentar y pedir aprobacion antes de implementar. |

## 11. Decisiones humanas pendientes

- [ ] Admin podra ver pestana 1 como soporte global?
- [ ] H18 debe usar `V=35`, `M=25`, `N=15` como fuente oficial de horas esperadas por categoria?
- [ ] VIP cuantas horas debe tener para este reporte?
- [ ] Medio tiempo cuantas horas debe tener para este reporte?
- [ ] Nuevo ingreso cuantas horas debe tener para este reporte?
- [ ] Horas asignadas en pestana 2 se comparan contra semana, modulo 1, modulo 2, maximo entre modulos o periodo de nomina?
- [ ] Excel debe ser XLSX real o basta CSV compatible Excel?
- [ ] Reporte usa datos vivos, snapshots o regla mixta para periodos historicos?
- [ ] Como mostrar extras de incidencia sin capturador original?
- [ ] Pestana 2 excluye tambien roles financieros futuros similares a Direccion Financiera si aparecen?

## 12. Plan de implementacion propuesto

### H18-F0 SPEC

Esta fase. Documenta alcance, fuentes, permisos, riesgos y decisiones.

### H18-F1 Backend

- Crear endpoints.
- Crear queries vivas/snapshot.
- Implementar guardas por rol.
- Reusar helper CSV H11.
- Pruebas API con `app.inject()`.
- No cambiar H01.

### H18-F2 Frontend

- Crear `ReportsView.vue`.
- Agregar ruta y menu.
- Agregar pestanas, filtros y tablas.
- Ocultar pestanas no permitidas.
- Manejar exportacion CSV.

### H18-F3 Exportables

- CSV H11 para ambas pestanas.
- Evaluar XLSX real solo con aprobacion.
- Pruebas de BOM, CRLF y acentos.

### H18-F4 Pruebas

- Pruebas backend por rol.
- Pruebas frontend de visibilidad.
- Pruebas de calculo de horas contra fixtures.
- Pruebas de export CSV.

### H18-F5 Deploy controlado

- Solo con checklist H13.
- Confirmar sin migracion o, si se aprueban permisos nuevos, aplicar H05.
- Healthcheck y smoke por rol.

## 13. Que NO se hizo

Confirmado en H18-F0:

- No se modifico codigo.
- No se modifico backend.
- No se modifico frontend.
- No se modifico base de datos.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se toco produccion.
- No se cambiaron permisos productivos.
- No se cambiaron roles.
- No se cambio nomina.
- No se cambio finanzas.
- No se cambiaron CSV existentes.
- No se cambio cierre de ciclo.
- No se cambio H01/H02/H03/H05/H09/H10/H11/H12/H13/H15/H16/H17 funcional.

