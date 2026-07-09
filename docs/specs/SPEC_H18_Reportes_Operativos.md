# SPEC H18 - Modulo Reportes Operativos

Fecha: 2026-07-08

Estado: H18-F1 backend implementado, H18-F2 frontend implementado, H18-F3 prevalidacion local automatizada documentada, H18-F5 deploy productivo ejecutado y H18-F6 UX de filtros desplegado productivamente. Queda pendiente validacion manual con sesion real/Excel para cierre operativo.

## 1. Resumen ejecutivo

H18 propone un nuevo modulo llamado `Reportes` para consulta operativa no financiera. El modulo tendra dos pestanas:

- `Horas base y extras`.
- `Horas base por categoria`.

El objetivo es dar visibilidad operativa sobre horas base, horas extra, capturadores, categorias, ciclos, quincenas y coordinaciones sin modificar la formula de nomina, sin cambiar permisos productivos y sin alterar reportes financieros o CSV existentes.

H18-F1 implementa backend, CSV y XLSX real server-side. H18-F2 implementa la vista frontend, ruta `/reports`, menu, pestanas, filtros, tablas, resumenes, descarga CSV/XLSX y pruebas de visibilidad. H18-F5 despliega backend/frontend a produccion sin migraciones ni cambios de base de datos. H18-F6 mejora filtros visibles para usar ciclos/quincenas legibles y busqueda general, conservando IDs solo internamente. No modifica permisos productivos, roles, datos reales ni H01.

## 2. Alcance

Incluye:

- Diseno funcional del modulo `Reportes`.
- Definicion de pestanas, filtros, columnas y exportables.
- Identificacion de fuentes de datos actuales.
- Reglas de permisos propuestas por rol.
- Riesgos y pendientes tecnicos restantes antes de implementar.
- Plan de implementacion por fases.

No incluye:

- Migraciones SQL.
- Nuevos permisos productivos.
- Cambios a roles.
- Cambios a formula H01.
- Cambios a Finanzas, Nomina, CSV existentes, cierre de ciclo o catalogos.
- Cambios de datos en produccion.
- Consultas con bypass de permisos productivos.

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
- Permitido: Admin como soporte global.

Denegados:

- Coordinador.
- RH.
- Finanzas.
- Contador.
- Contabilidad.
- Otros roles no autorizados.

Backend debe validar la regla. Ocultar la pestana en frontend no es suficiente.

Decision funcional cerrada: Admin y Direccion/Subdireccion pueden consultar `Horas base y extras`; Coordinador, RH, Finanzas, Contador y Contabilidad no deben verla.

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

### Filtros aprobados H18-F6

La UI no debe mostrar IDs tecnicos como filtros principales.

Filtros visibles:

- `Ciclo / cuatrimestre`: lista desplegable con nombre, codigo y estado.
- `Quincena guardada`: lista dependiente del ciclo, solo para corridas no canceladas; si queda vacia se consulta dato vivo del ciclo cuando aplica.
- `Busqueda general`: busca por docente, coordinacion, capturador de extra externo y responsable de incidencia.
- `Categoria`: `Todas`, `VIP`, `Medio tiempo`, `Nuevo ingreso`.
- `Tipo`: `Todos`, `Con extras`, `Sin extras`.

No mostrar como filtros visibles:

- `Docente ID`.
- `Coordinacion ID`.
- `Capturador ID`.
- `Desde`.
- `Hasta`.
- `Origen`.

El backend resuelve `source=auto`; la tabla puede mostrar etiqueta informativa `Datos vivos` o `Nomina guardada`.

### Filtros tecnicos soportados por API

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

Decision aprobada:

- Si existe corrida de nomina no cancelada para el periodo, mostrar datos de snapshot para preservar historia.
- Si no existe corrida guardada, mostrar datos vivos.
- Documentar claramente en UI si el origen es `vivo` o `snapshot`.
- Recordar que al cerrar una quincena, las incidencias y extras capturados pueden retirarse de los modulos vivos; por eso los historicos deben consultar snapshots cuando existan.

### Reglas de calculo

- No cambiar H01.
- No recalcular montos financieros.
- Horas base por periodo deben seguir la misma logica ya usada por Nomina si se selecciona quincena.
- Horas base semanales pueden mostrarse como metrica operativa separada si se requiere.
- Horas extra externas vienen de `extra_hours`.
- Horas extra de incidencia vienen de `schedule_incidences.extra_hours_in_schedule`.
- No mezclar horas extra externas con horas base.
- No usar `updated_by` como capturador original de extras externos cuando existe `extra_hours.captured_by`.

### Capturador de incidencias

Decision funcional cerrada:

- Para extras externos, el capturador correcto es `extra_hours.captured_by`.
- Para extras/incidencias de `schedule_incidences.extra_hours_in_schedule`, usar `schedule_incidences.updated_by` como capturador/responsable operativo disponible en el modelo actual.
- La precision semantica debe mostrarse o documentarse: en incidencias, `updated_by` representa el usuario registrado como capturador/responsable operativo disponible actualmente, no un nuevo campo de autoria historica.
- No agregar nuevo campo en esta fase.


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
| Categoria legible | Mapeo UI | `V=VIP`, `M=Medio tiempo`, `N=Nuevo ingreso`. |
| Horas base esperadas | Regla oficial H18 | `V=35`, `M=25`, `N=15`. |
| Horas base asignadas | Suma viva de `schedules` por docente/ciclo | Ver formula aprobada abajo. |
| Horas restantes | Esperadas - asignadas | Si negativo, estado `excedido`. |
| Coordinacion | `coordinations.name` | Segun registro o capturador. |
| Ciclo | `academic_cycles` | Filtro requerido. |
| Periodo/quincena | `payroll_calendar_config`, si aplica | Si se requiere por periodo. |
| Estado | Derivado | `completo`, `faltante`, `excedido`. |

### Filtros aprobados H18-F6

Filtros visibles:

- `Ciclo / cuatrimestre`: lista desplegable obligatoria.
- `Busqueda general`: busca por docente o coordinacion.
- `Categoria`: `Todas`, `VIP`, `Medio tiempo`, `Nuevo ingreso`.
- `Estado`: `Todos`, `Completo`, `Faltante`, `Excedido`.
- `Estatus docente`: `Todos`, `Activo`, `Inactivo`.

No debe pedir quincena. La pestana 2 se calcula por ciclo/cuatrimestre con datos vivos de Horarios.

No mostrar como filtros visibles:

- `Ciclo ID`.
- `Coordinacion ID`.
- `Docente ID`.

### Filtros tecnicos soportados por API

- ciclo academico;
- coordinacion;
- categoria;
- docente;
- estado:
  - completo;
  - faltante;
  - excedido;
- docente activo/inactivo.

### Regla oficial de horas esperadas por categoria

Decision funcional cerrada:

- H18 usara como fuente oficial la misma regla tecnica vigente de Horarios/Extras.
- `V` = VIP = 35 horas.
- `M` = Medio tiempo = 25 horas.
- `N` = Nuevo ingreso = 15 horas.
- Cualquier fallback debe documentarse y no debe crear categorias nuevas.

La regla esta reflejada actualmente en:

- `apps/api/src/routes/academic-context.ts`.
- `apps/api/src/routes/schedules.ts`.
- `apps/api/src/routes/extras.ts`.

| Categoria tecnica | Nombre operativo sugerido | Horas maximas vigentes |
|---|---|---:|
| `V` | VIP | 35 |
| `M` | Medio tiempo | 25 |
| `N` | Nuevo ingreso | 15 |

Tambien se detecto que:

- `teachers.category` contiene la categoria tecnica.
- `tabulators` define montos/tabuladores, no horas esperadas.
- La logica de nomina calcula horas base reales desde `schedules` y calendario.
- H01 no debe modificarse.

### Formula aprobada de horas base asignadas

La pestana `Horas base por categoria` se calcula por cuatrimestre/ciclo academico y toma datos vivos del modulo Horarios.

Si se actualiza un horario en Horarios, el reporte debe reflejarlo porque no usa snapshot para esta pestana.

Para cada docente y ciclo:

```sql
horas_l_v = SUM(hours_l + hours_m + hours_x + hours_j + hours_v)
horas_modulo_1 = horas_l_v + SUM(hours_s1)
horas_modulo_2 = horas_l_v + SUM(hours_s2)
horas_base_asignadas = GREATEST(horas_l_v, horas_modulo_1, horas_modulo_2)
horas_restantes = horas_esperadas_categoria - horas_base_asignadas
```

Esta comparacion sigue la logica vigente del modulo Horarios, donde la carga se valida contra semana, modulo 1 y modulo 2.

Estados:

- `completo`: `horas_base_asignadas = horas_esperadas_categoria`.
- `faltante`: `horas_base_asignadas < horas_esperadas_categoria`.
- `excedido`: `horas_base_asignadas > horas_esperadas_categoria`.

El reporte puede mostrar tambien, como columnas de apoyo, `horas_l_v`, `horas_modulo_1` y `horas_modulo_2` para explicar el estado.

No se calcula por una sola quincena y no debe usar calendario de nomina para esta comparacion.

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
| Capturador/responsable de incidencia | `schedule_incidences.updated_by` -> `app_users` | Decision H18: representa el responsable operativo disponible en el modelo actual. |
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
| Admin | Permitido | Permitido | Soporte global aprobado para H18. |
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
GET /reports/operational/filters/cycles
GET /reports/operational/filters/payroll-periods?cycleId=...
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
- `format=xlsx` aprobado para H18-F1 con `exceljs` en backend/API.

Ubicacion tecnica sugerida:

- Backend: `apps/api/src/routes/reports.ts` o archivo nuevo `operational-reports.ts` registrado desde la app principal.
- Mantener separacion de Finanzas para no mezclar `finance.view` con H18.

Guardas propuestas:

- `requireOperationalBaseExtraReport`: roles `admin` y `direccion`.
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
- Boton Excel para consumir XLSX real generado server-side por API.

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

Decision funcional y tecnica cerrada:

- La preferencia funcional es exportar XLSX real.
- `exceljs` queda aprobado para H18 y se instala solo en `apps/api`.
- XLSX se genera server-side desde la API; el frontend solo consumira la descarga.
- CSV H11 se mantiene como respaldo obligatorio.

Revision tecnica H18-F0:

- `package.json` raiz: no contiene dependencia XLSX.
- `apps/api/package.json`: H18-F1 agrega `exceljs`; no se instala `xlsx`.
- `apps/web/package.json`: no contiene `exceljs` ni `xlsx`.
- `package-lock.json`: H18-F1 registra `exceljs` y sus dependencias transitivas.
- H18-F1 agrega helper server-side para workbook XLSX.

Recomendacion tecnica:

- Mantener `exceljs` solo en API.
- No construir XLSX en frontend.
- No usar `xlsx`.
- Mantener CSV H11 como respaldo obligatorio.

## 10. Riesgos

| Riesgo | Impacto | Mitigacion propuesta |
|---|---|---|
| Calculo incorrecto de horas base | Alto | Reusar logica actual de Horarios/Nomina y cubrir con pruebas H04. |
| Confundir horas base con horas extra | Alto | Columnas separadas y definicion clara de fuentes. |
| Usar capturador incorrecto | Alto | Usar `extra_hours.captured_by` para extras externos y `schedule_incidences.updated_by` para responsable operativo de incidencia. |
| Exponer Tab 1 fuera de Direccion/Subdireccion | Alto | Guard backend por rol. |
| Exponer Tab 2 a Finanzas/Contador/Contabilidad | Alto | Guard backend por rol y pruebas. |
| Usar `finance.view` o `reports.view` indebidamente | Alto | No reutilizar permisos amplios sin validar exclusiones. |
| Mezclar datos vivos con snapshots | Medio | Priorizar snapshots si existe nomina guardada; indicar origen. |
| Cambiar H01 accidentalmente | Alto | No tocar formula; solo leer datos y probar regresion. |
| Exponer datos fiscales | Alto | Excluir RFC, banco, paymentType, constancias y datos fiscales. |
| Excel real requiere dependencia nueva | Medio-bajo | H18-F1 instala `exceljs` en API con aprobacion explicita; revisar auditoria npm antes de deploy. |

## 11. Decisiones funcionales aprobadas y pendientes tecnicos

### Decisiones funcionales aprobadas

- Admin puede ver `Horas base y extras` como soporte global.
- Direccion/Subdireccion puede ver `Horas base y extras`.
- Coordinador, RH, Finanzas, Contador y Contabilidad no ven `Horas base y extras`.
- `Horas base por categoria` esta disponible para Admin, Direccion/Subdireccion, Coordinador y RH.
- `Horas base por categoria` excluye Finanzas, Contador y Contabilidad.
- Horas oficiales por categoria:
  - VIP: 35.
  - Medio tiempo: 25.
  - Nuevo ingreso: 15.
- Equivalencias tecnicas:
  - `V`: VIP.
  - `M`: Medio tiempo.
  - `N`: Nuevo ingreso.
- Pestana 2 se calcula por cuatrimestre/ciclo academico con datos vivos de Horarios.
- Pestana 2 no se calcula por una sola quincena.
- Si existe nomina/corrida guardada no cancelada para una quincena o periodo, reportes historicos usan snapshots.
- Si no existe snapshot/corrida guardada, se usan datos vivos.
- Extras externos usan `extra_hours.captured_by`.
- Incidencias/extras de `schedule_incidences.extra_hours_in_schedule` usan `updated_by` como capturador/responsable operativo disponible.
- XLSX real queda aprobado e implementado server-side en H18-F1 con `exceljs`; CSV H11 se mantiene como respaldo obligatorio.

### Pendientes tecnicos restantes

- Validar manualmente descargas CSV/XLSX desde la UI con sesion real/autorizada y Excel institucional.
- Ejecutar smoke manual por rol para cerrar H18 operativo sin observaciones.
- Definir si en una fase futura se crean permisos formales nuevos; no se hizo en H18-F1/F2 para evitar migracion H05.
- Definir si los snapshots historicos deben exponer capturador de extra externo cuando `payroll_extra_details` no conserva `captured_by`.
- Decidir si roles financieros futuros similares a Direccion Financiera deben quedar excluidos de pestana 2 por regla general.

## 12. Plan de implementacion propuesto

### H18-F0 SPEC

Esta fase. Documenta alcance, fuentes, permisos, riesgos y decisiones.

### H18-F1 Backend

- Implementado.
- Crea endpoints JSON y exportables.
- Crea queries vivas/snapshot para horas base y extras.
- Implementa guardas por rol sin migracion ni permisos nuevos.
- Reusa helper CSV H11.
- Genera XLSX real con `exceljs` desde API.
- Agrega pruebas API con `app.inject()`.
- No cambia H01.

### H18-F2 Frontend

- Implementado.
- Crea `ReportsView.vue`.
- Agrega ruta `/reports` y menu `Reportes`.
- Agrega pestanas, filtros, tablas y resumenes.
- Oculta modulo/pestanas no permitidas por rol.
- Consume exportacion CSV y Excel/XLSX generada por API.
- Agrega pruebas frontend de visibilidad, consulta y descarga.

### H18-F3 Exportables

- CSV H11 y XLSX real ya quedan disponibles desde backend H18-F1.
- Prevalidacion local automatizada documentada en `docs/auditoria/H18_Fase3_Validacion_UI_Exportables_Reportes_Operativos.md`.
- Queda pendiente validacion manual/controlada de archivos descargados desde UI con sesion real y Excel institucional.
- Pruebas de BOM, CRLF y acentos deben cerrarse con evidencia manual antes de deploy si operacion lo exige.

### H18-F4 Pruebas

- Pruebas backend por rol.
- Pruebas frontend de visibilidad.
- Pruebas de calculo de horas contra fixtures.
- Pruebas de export CSV.

### H18-F5 Deploy controlado

- Ejecutado en produccion el 2026-07-08.
- Se uso checklist H13, revision H05 `pending=0` y `checksum mismatch=0`.
- Se desplego API Cloud Run revision `nomina-api-00048-js8`.
- Se desplego Firebase Hosting live.
- Healthchecks publicos aprobados.
- Smoke tecnico aprobado.
- Smoke manual por rol y validacion Excel institucional quedan pendientes para cierre operativo.

### H18-F6 UX filtros amigables

- Implementado y desplegado productivamente el 2026-07-09.
- Reemplaza filtros visibles por ID con selectores de ciclo/quincena y busqueda general.
- Agrega endpoints read-only de filtros H18.
- Agrega parametro `q` a consultas y exportaciones.
- Mantiene contratos existentes y IDs internos para compatibilidad.
- Revision Cloud Run: `nomina-api-00049-2hn`.
- Hosting live: `2026-07-09 13:11:55`.

## 13. Que NO se hizo

Confirmado hasta H18-F5:

- No se modifico base de datos.
- No se ejecutaron migraciones.
- Se hizo deploy controlado de API/Hosting; no se modifico produccion fuera del despliegue de codigo.
- No se instalaron dependencias frontend.
- No se cambiaron permisos productivos.
- No se cambiaron roles.
- No se cambio nomina.
- No se cambio finanzas.
- No se cambiaron CSV existentes fuera de los nuevos exportables H18.
- No se cambio cierre de ciclo.
- No se cambio H01/H02/H03/H05/H09/H10/H11/H12/H13/H15/H16/H17 funcional.
