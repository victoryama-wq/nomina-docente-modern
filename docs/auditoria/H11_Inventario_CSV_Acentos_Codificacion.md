# H11 - Inventario CSV, acentos y codificación

Fecha: 2026-06-02

## 1. Resumen ejecutivo

Se inventariaron los exportables CSV del sistema Nómina Docente sin modificar código, base de datos, permisos, rutas, columnas, filtros, interfaz ni lógica funcional.

Resultado del inventario:

- Exportables CSV productivos detectados: **11**.
- Generados en backend: **9**.
- Generados en frontend: **2**.
- Herramientas legacy/locales de importación CSV detectadas: **3**.
- Módulos críticos con CSV: Finanzas, Nómina, Directorio/RH y Auditoría.
- Módulos revisados sin CSV productivo directo: Usuarios, Calendario, Catálogos, Extras, Incidencias y Horarios.
- No existe carpeta `scripts/` en el repositorio actual.

Exportables críticos:

- Finanzas: pagos, pendientes fiscales y resumen por coordinaciones.
- Nómina: resumen, horarios, extras y detalle por docente.
- Directorio/RH: docentes activos, historial completo y cumpleaños.
- Auditoría: bitácora.

Campos con alto riesgo de acentos o texto libre:

- Docentes, coordinaciones, asignaturas, motivos de extra, observaciones, comentarios, acciones de auditoría, módulos, nombres de archivo y datos serializados.
- Ejemplos operativos: `Coordinación General`, `Administración Turística`, `Álvarez`, `Muñoz`, `García`.

Riesgos generales:

- Mojibake si Excel Windows interpreta UTF-8 sin BOM como ANSI.
- Inconsistencia entre exportables: Finanzas no agrega BOM actualmente, mientras Nómina, Directorio, Auditoría y los CSV frontend sí lo agregan.
- Implementaciones duplicadas de `csvValue`/`buildCsv`/`downloadCsv`.
- Sin política central contra CSV injection.
- Posible impacto si se corrigen CSV modificando columnas, permisos, filtros o montos. H11 no debe hacer eso.

## 2. Inventario de exportables

| ID | Módulo | Ruta/API o Vista | Archivo generado | Backend/Frontend | Contiene acentos | Consumidor probable | Riesgo |
|---|---|---|---|---|---|---|---|
| FIN-CSV-01 | Finanzas | `GET /reports/finance/export/payments` | `finanzas-<periodo>-pagos.csv` | Backend | Sí | Finanzas/Contabilidad/Contador | Crítico: importes, RFC, tipo de pago, Excel sin BOM. |
| FIN-CSV-02 | Finanzas | `GET /reports/finance/export/fiscal` | `finanzas-<periodo>-pendientes-fiscales.csv` | Backend | Sí | Finanzas/RH/Admin autorizado | Crítico: datos fiscales/financieros sensibles, Excel sin BOM. |
| FIN-CSV-03 | Finanzas | `GET /reports/finance/export/coordinations` | `finanzas-<periodo>-coordinaciones.csv` | Backend | Sí | Finanzas/Dirección autorizada | Alto: coordinaciones, importes y pendientes. |
| NOM-CSV-01 | Nómina | `GET /payroll/runs/:id/export/summary` | `nomina-<periodo>-resumen.csv` | Backend | Sí | Admin/Finanzas | Crítico: totales de nómina y H01. |
| NOM-CSV-02 | Nómina | `GET /payroll/runs/:id/export/schedules` | `nomina-<periodo>-horarios.csv` | Backend | Sí | Admin/Finanzas | Crítico: horarios considerados en corrida. |
| NOM-CSV-03 | Nómina | `GET /payroll/runs/:id/export/extras` | `nomina-<periodo>-extras.csv` | Backend | Sí | Admin/Finanzas | Crítico: extras considerados en pago. |
| NOM-CSV-04 | Nómina | `PayrollView.vue` botón `Detalle CSV` | `nomina-<ciclo>-<periodo>-detalle-docente.csv` | Frontend | Sí | Admin/Finanzas autorizado | Alto: CSV generado en navegador con datos de preview/corrida. |
| DIR-CSV-01 | Directorio/RH | `GET /teachers/export/active` | `docentes-activos.csv` | Backend | Sí | RH/Admin autorizado | Crítico: datos docentes y fiscales según permiso. |
| DIR-CSV-02 | Directorio/RH | `GET /teachers/export/history` | `docentes-completo-historial.csv` | Backend | Sí | Auditoría/Admin autorizado | Crítico: historial, datos antes/después, fiscales y comentarios. |
| RH-CSV-01 | Expediente Fiscal | `FiscalRecordsView.vue` botón `Cumpleaños CSV` | `cumpleaños-docentes.csv` | Frontend | Sí | RH/Finanzas/Admin autorizado | Alto: RFC, correo, cumpleaños y nombres con acentos. |
| AUD-CSV-01 | Auditoría | `GET /audit/export` | `auditoria-bitacora.csv` | Backend | Sí | Admin/Auditoría | Alto: trazabilidad, JSON, acciones y metadata. |
| LEG-CSV-01 | Legacy/importación | `tools/legacy-csv-to-sql.mjs` | No genera CSV; lee CSV | Herramienta local | Sí | Dev/DBA | Medio: BOM de entrada, acentos, formato histórico. |
| LEG-CSV-02 | Legacy/importación | `tools/legacy-schedules-csv-to-sql.mjs` | No genera CSV; lee CSV | Herramienta local | Sí | Dev/DBA | Medio: responsables, horarios y coordinaciones históricas. |
| LEG-CSV-03 | Legacy/importación | `tools/legacy-extras-csv-to-sql.mjs` | No genera CSV; lee CSV | Herramienta local | Sí | Dev/DBA | Medio: fechas, observaciones, actividades y texto libre. |

No se detectaron CSV productivos directos en:

- `apps/api/src/routes/users.ts`
- `apps/api/src/routes/calendar.ts`
- `apps/api/src/routes/catalogs.ts`
- `apps/api/src/routes/extras.ts`
- `apps/api/src/routes/incidences.ts`
- `apps/api/src/routes/schedules.ts`

## 3. Implementación actual por exportable

### FIN-CSV-01 / FIN-CSV-02 / FIN-CSV-03 - Finanzas

- Archivo: `apps/api/src/routes/reports.ts`.
- Ruta: `GET /reports/finance/export/:kind`.
- Kinds: `payments`, `fiscal`, `coordinations`.
- Permiso: `finance.export`.
- Control adicional: `fiscal` exige permiso fiscal sensible mediante `canViewFiscalSensitive(actor)`.
- Content-Type: `text/csv; charset=utf-8`.
- Content-Disposition: `attachment; filename="<archivo>"`.
- BOM: **No agrega BOM actualmente**.
- Separador: coma.
- Escaping: todos los valores se envuelven en comillas; comillas dobles se escapan como `""`.
- Comas: quedan protegidas por comillas.
- Saltos de línea dentro de campos: quedan dentro de comillas, pero no hay pruebas documentadas.
- Line ending: `CRLF` entre filas; no agrega CRLF final explícito.
- Generación: backend.
- Datos sensibles: sí, especialmente en pagos/fiscal.
- Depende de permisos H02/H03: sí, `finance.export` y fiscal sensible.
- Riesgo principal: CSV financiero crítico sin BOM, posible mojibake en Excel.

### NOM-CSV-01 / NOM-CSV-02 / NOM-CSV-03 - Nómina backend

- Archivo: `apps/api/src/routes/payroll.ts`.
- Ruta: `GET /payroll/runs/:id/export/:kind`.
- Kinds: `summary`, `schedules`, `extras`.
- Permiso: `payroll.finalize` o `finance.export`.
- Control adicional: Dirección/Subdirección global read-only no exporta CSV desde este módulo.
- Content-Type: `text/csv; charset=utf-8`.
- Content-Disposition: `attachment; filename="<archivo>"`.
- BOM: sí, agrega `\uFEFF`.
- Separador: coma.
- Escaping: todos los valores se envuelven en comillas; comillas dobles se escapan como `""`.
- Comas: quedan protegidas por comillas.
- Saltos de línea dentro de campos: quedan dentro de comillas, pero no hay pruebas documentadas.
- Line ending: `CRLF` y CRLF final.
- Generación: backend.
- Datos sensibles: sí, importes de nómina y detalle operativo.
- Depende de permisos H02/H03: sí, permisos de nómina/export y alcance por actor.
- Riesgo principal: no debe tocar H01 ni modificar montos/columnas al estandarizar.

### NOM-CSV-04 - Nómina detalle por docente frontend

- Archivo: `apps/web/src/views/PayrollView.vue`.
- Vista: botón `Detalle CSV`.
- Funciones: `csvValue`, `downloadCsv`, `detailExportHeaders`, `detailExportRows`, `exportDetailCsv`.
- Content-Type Blob: `text/csv;charset=utf-8;`.
- Content-Disposition: no aplica; descarga por `link.download`.
- BOM: sí, agrega `\uFEFF`.
- Separador: coma.
- Escaping: todos los valores se envuelven en comillas; comillas dobles se escapan como `""`.
- Comas: quedan protegidas por comillas.
- Saltos de línea dentro de campos: quedan dentro de comillas, pero no hay pruebas documentadas.
- Line ending: `CRLF` y CRLF final.
- Generación: frontend.
- Datos sensibles: sí, importes de nómina y detalle por docente.
- Depende de permisos H02/H03: sí, se muestra con `canExportPayrollRun`.
- Riesgo principal: exportable crítico generado fuera del backend; cualquier helper central debe considerar frontend o mover política al backend sin cambiar UX/columnas.

### DIR-CSV-01 / DIR-CSV-02 - Directorio/RH

- Archivo: `apps/api/src/routes/teachers.ts`.
- Rutas:
  - `GET /teachers/export/active`.
  - `GET /teachers/export/history`.
- Permisos:
  - Activos: `fiscal.view`.
  - Historial: `audit.view`.
- Content-Type: `text/csv; charset=utf-8`.
- Content-Disposition: `attachment; filename="<archivo>"`.
- BOM: sí, agrega `\uFEFF`.
- Separador: coma.
- Escaping: todos los valores se envuelven en comillas; comillas dobles se escapan como `""`.
- Comas: quedan protegidas por comillas.
- Saltos de línea dentro de campos: quedan dentro de comillas, pero no hay pruebas documentadas.
- Line ending: `CRLF` y CRLF final.
- Generación: backend.
- Datos sensibles: sí, RFC, banco/datos bancarios, correo, constancia y datos de auditoría.
- Depende de permisos H02/H03: sí, permisos fiscales/auditoría.
- Riesgo principal: alto por datos fiscales y campos libres (`comentario`, `observación`, JSON de historial).

### RH-CSV-01 - Cumpleaños docentes

- Archivo: `apps/web/src/views/FiscalRecordsView.vue`.
- Vista: botón `Cumpleaños CSV`.
- Funciones: `csvValue`, `downloadCsv`, `exportBirthdays`.
- Content-Type Blob: `text/csv;charset=utf-8`.
- Content-Disposition: no aplica; descarga por `link.download`.
- BOM: sí, agrega `\uFEFF`.
- Separador: coma.
- Escaping: todos los valores se envuelven en comillas; comillas dobles se escapan como `""`.
- Comas: quedan protegidas por comillas.
- Saltos de línea dentro de campos: quedan dentro de comillas, pero no hay pruebas documentadas.
- Line ending: `CRLF` y CRLF final.
- Generación: frontend.
- Datos sensibles: sí, RFC, correo, fecha de nacimiento/cumpleaños.
- Depende de permisos H02/H03: sí, vista fiscal/documental.
- Riesgo principal: datos fiscales/RH generados en navegador; requiere pruebas de permisos y codificación.

### AUD-CSV-01 - Auditoría

- Archivo: `apps/api/src/routes/audit.ts`.
- Ruta: `GET /audit/export`.
- Permiso: `audit.view`.
- Content-Type: `text/csv; charset=utf-8`.
- Content-Disposition: `attachment; filename="auditoria-bitacora.csv"`.
- BOM: sí, agrega `\uFEFF` en `sendCsv`.
- Separador: coma.
- Escaping: valores no nulos se envuelven en comillas; comillas dobles se escapan como `""`.
- Comas: quedan protegidas por comillas.
- Saltos de línea dentro de campos: quedan dentro de comillas, pero no hay pruebas documentadas.
- Line ending: `CRLF`; no agrega CRLF final explícito.
- Generación: backend.
- Datos sensibles: puede contener metadata, antes/después y trazabilidad operativa.
- Depende de permisos H02/H03: indirectamente; solo `audit.view`.
- Riesgo principal: JSON/metadata con comas, comillas, saltos de línea y posible texto con acentos.

### LEG-CSV-01 / LEG-CSV-02 / LEG-CSV-03 - Importadores legacy/locales

- Archivos:
  - `tools/legacy-csv-to-sql.mjs`
  - `tools/legacy-schedules-csv-to-sql.mjs`
  - `tools/legacy-extras-csv-to-sql.mjs`
- Lectura: `fs.readFileSync(filePath, 'utf8')`.
- Generación CSV: no generan CSV; generan SQL a partir de CSV.
- BOM de entrada: no se documenta normalización explícita.
- Separador: parser local CSV.
- Riesgo: archivos de origen pueden venir de Excel/Sheets con BOM, acentos, comas, saltos o columnas históricas.
- Alcance H11: no tocar todavía salvo que una fase posterior apruebe revisar importadores.

## 4. Riesgos detectados

- Mojibake por falta de BOM en exportables financieros.
- Excel Windows puede interpretar UTF-8 sin BOM como ANSI.
- Separador coma puede no coincidir con configuraciones regionales que esperan punto y coma.
- Comas dentro de nombres, asignaturas, coordinaciones, actividades o observaciones.
- Saltos de línea en observaciones, comentarios, metadata o JSON.
- CSV injection si valores exportados empiezan con `=`, `+`, `-`, `@`, tab o retorno.
- Nombres con `Ñ`, `Á`, `É`, `Í`, `Ó`, `Ú`.
- Nombres como `Coordinación General`.
- Nombres como `Administración Turística`.
- Exportables generados en frontend con `Blob`; aunque hoy agregan BOM, duplican lógica CSV.
- Inconsistencia entre backend y frontend.
- Inconsistencia entre módulos backend.
- Riesgo de alterar columnas, filtros, permisos o montos si se corrige sin helper central y pruebas.
- Documentos/código leídos en consola pueden mostrar `CoordinaciÃ³n` o `CategorÃ­a`; H11 debe validar bytes reales descargados, no solo salida de terminal.

## 5. Política estándar propuesta

Sin implementar todavía, se propone:

- CSV UTF-8 con BOM para exportables orientados a Excel.
- `Content-Type: text/csv; charset=utf-8`.
- `Content-Disposition: attachment; filename="..."`.
- Separador:
  - mantener coma si ya se usa consistentemente;
  - evaluar punto y coma solo si Finanzas/operación lo pide explícitamente por Excel regional.
- Escape RFC 4180:
  - valores entre comillas cuando contengan coma, comilla, salto de línea o separador;
  - conservar la opción de entrecomillar todos los valores si se decide como estándar;
  - comillas dobles escapadas como `""`.
- CRLF como salto de línea para priorizar compatibilidad Excel.
- Sanitización contra CSV injection en serialización, sin cambiar datos de BD ni JSON.
- Helper central para evitar implementaciones distintas.
- No cambiar columnas, filtros, permisos, orden funcional ni nombres de botones sin aprobación explícita.

## 6. Pruebas recomendadas

Pruebas H04/H11 recomendadas:

- Archivo empieza con BOM cuando aplique.
- Headers correctos.
- `Content-Type` correcto.
- `Content-Disposition` correcto.
- Nombres con acentos se preservan:
  - `Álvarez`
  - `Muñoz`
  - `García`
  - `Coordinación General`
  - `Administración Turística`
- Comillas y comas se escapan correctamente.
- Saltos de línea no rompen filas.
- Line endings compatibles con Excel.
- No CSV injection.
- No se alteran columnas.
- No se alteran filtros.
- No se alteran permisos.
- No se alteran datos monetarios.
- Los CSV frontend y backend producen reglas equivalentes donde aplique.
- Excel Windows, Google Sheets y LibreOffice abren exportables críticos sin mojibake.

Pruebas por endpoint/vista:

- Finanzas `payments`, `fiscal`, `coordinations`.
- Nómina `summary`, `schedules`, `extras`.
- Nómina `Detalle CSV` frontend.
- Directorio `active`, `history`.
- Expediente Fiscal `Cumpleaños CSV`.
- Auditoría `audit/export`.

## 7. Clasificación de prioridad

| Exportable | Prioridad | Motivo | Acción recomendada |
|---|---|---|---|
| Finanzas pagos | P0 | CSV financiero crítico, sin BOM actual, contiene importes/RFC/tipo de pago. | Estandarizar primero con helper y pruebas de Excel. |
| Finanzas fiscal | P0 | Datos fiscales sensibles y sin BOM actual. | Estandarizar primero; confirmar permisos y columnas sin cambios. |
| Nómina resumen/horarios/extras | P0 | Protege H01 y conciliación de pagos. | Migrar con pruebas de no alteración de importes/columnas. |
| Nómina detalle frontend | P1 | Exportable con importes generado en navegador. | Definir si helper frontend o backend; no cambiar UX ni columnas. |
| Directorio activos/historial | P1 | Datos personales/fiscales e historial. | Migrado en H11-F3A backend; validar en Excel/Sheets y mantener pruebas de datos sensibles. |
| Cumpleaños docentes | P1 | Datos RH/fiscales generados en frontend. | Estandarizar helper frontend y permisos visuales. |
| Auditoría bitácora | P1 | Evidencia técnica con JSON y metadata. | Migrado en H11-F3A backend; validar JSON, saltos y acentos en Excel/Sheets. |
| Importadores legacy | P2 | Uso controlado/local, no exportables productivos. | Revisar solo si se vuelven a usar para migraciones/importaciones. |

## 8. Recomendación técnica

Conviene:

- Crear helper central `apps/api/src/lib/csv.ts`.
- Migrar todos los CSV backend al helper único sin cambiar contenido funcional.
- Crear helper frontend equivalente si se mantienen CSV generados en navegador.
- Evaluar si los CSV frontend críticos deben moverse a backend solo con SPEC/aprobación posterior.
- Agregar pruebas unitarias para el helper.
- Agregar pruebas de integración para endpoints críticos.
- Agregar pruebas frontend para `downloadCsv` si se conserva en vistas.
- Aplicar cambios por fases.
- No tocar importadores legacy salvo riesgo evidente o uso próximo aprobado.

No conviene:

- Cambiar separador a punto y coma sin validación de Finanzas/Operación.
- Cambiar columnas, orden, filtros, permisos o nombres visibles durante H11 técnico.
- Mezclar H11 con H01/H02/H03/H05/H09/H10.

## 9. Propuesta de fases H11

### H11-F0 Inventario

Esta fase. Documento de inventario, riesgos y estrategia sin cambios funcionales.

### H11-F1 Helper central CSV + pruebas

Crear helper backend y pruebas unitarias. Definir BOM, CRLF, escaping, CSV injection y headers HTTP. Crear helper frontend solo si se decide mantener CSV en navegador.

### H11-F2 Exportables financieros/nómina

Aplicar helper a Finanzas y Nómina. No cambiar columnas, filtros, permisos, montos ni fórmula H01.

### H11-F3A Exportables backend RH/Docentes/Auditoría

Aplicar helper a Directorio/RH y Auditoría backend. Validar datos sensibles, permisos, JSON, saltos y acentos.

### H11-F3B Exportables frontend restantes

Aplicar helper frontend a CSV generados en navegador que sigan vigentes, por ejemplo Cumpleaños CSV, sin cambiar columnas, permisos visuales ni UX.

### H11-F4 Validación Excel/Sheets

Prueba manual de apertura en Excel, Google Sheets y LibreOffice si aplica. Validar acentos, montos, RFC, teléfonos, identificadores y saltos de línea.

### H11-F5 Deploy controlado

Solo después de pruebas. Sin migraciones salvo que una SPEC futura diga lo contrario. Backup preventivo si se despliega a producción.

## 10. Qué NO se debe hacer

Confirmación de alcance H11-F0:

- No se modificó código.
- No se cambió interfaz.
- No se cambiaron permisos.
- No se cambiaron roles.
- No se cambió alcance por coordinación.
- No se cambiaron columnas.
- No se cambiaron filtros.
- No se cambiaron rutas.
- No se cambiaron nombres visibles de botones.
- No se cambiaron estados financieros.
- No se cambió cierre de ciclo.
- No se cambió lógica de negocio.
- No se cambió fórmula de nómina.
- No se cambió precisión monetaria H01.
- No se tocó producción.
- No se hizo deploy.
- No se modificó base de datos.
- No se ejecutaron migraciones.
