# H11 - Inventario CSV, acentos y codificacion

## 1. Resumen ejecutivo

H11 se inicia como una fase de inventario y estandarizacion tecnica para los exportables CSV del sistema Nomina Docente. El objetivo es prevenir problemas de acentos, mojibake, compatibilidad con Excel/Google Sheets y riesgos de seguridad de CSV sin cambiar todavia el comportamiento funcional.

El sistema ya cuenta con exportables productivos en backend para Nomina, Finanzas, Directorio docente y Auditoria. El frontend no genera CSV propio; descarga los archivos que entrega la API como `Blob`.

Hallazgos principales:

- Se detectaron 9 exportables CSV productivos.
- Se detectaron 3 herramientas legacy/locales de importacion CSV a SQL.
- Los modulos usan helpers CSV duplicados en lugar de una politica central.
- Nomina, Directorio y Auditoria entregan BOM UTF-8; Finanzas no lo agrega actualmente.
- Todos los exportables revisados declaran `text/csv; charset=utf-8`.
- Los valores se encapsulan en comillas y escapan comillas dobles, pero no hay una defensa estandar contra CSV formula injection.
- Hay riesgo de mojibake al abrir con Excel o al leer archivos UTF-8 con herramientas Windows sin configuracion explicita.
- H11 no requiere migracion de base de datos para esta fase de inventario.

Este documento no autoriza cambios funcionales. La recomendacion es implementar H11 por fases, empezando por un helper CSV central y pruebas automatizadas antes de ajustar exportables productivos.

## 2. Exportables CSV detectados

| Modulo | Ruta / origen | Archivo esperado | Permiso / control actual | Criticidad | Observacion |
|---|---|---|---|---|---|
| Nomina | `GET /payroll/runs/:id/export/summary` | `nomina-<periodo>-resumen.csv` | `payroll.finalize` o `finance.export` | Alta | Resumen de corrida con importes de nomina. |
| Nomina | `GET /payroll/runs/:id/export/schedules` | `nomina-<periodo>-horarios.csv` | `payroll.finalize` o `finance.export` | Alta | Detalle de horarios pagados. |
| Nomina | `GET /payroll/runs/:id/export/extras` | `nomina-<periodo>-extras.csv` | `payroll.finalize` o `finance.export` | Alta | Detalle de extras de nomina. |
| Finanzas | `GET /reports/finance/export/payments` | `finanzas-<periodo>-pagos.csv` | `finance.export` | Critica | Incluye docente, RFC, tipo de pago, horas e importe. |
| Finanzas | `GET /reports/finance/export/fiscal` | `finanzas-<periodo>-fiscal.csv` | `finance.export` + permiso fiscal sensible | Critica | Incluye datos fiscales/financieros sensibles si el actor tiene permiso. |
| Finanzas | `GET /reports/finance/export/coordinations` | `finanzas-<periodo>-coordinaciones.csv` | `finance.export` | Alta | Resumen por coordinacion con importes y pendientes. |
| Directorio | `GET /teachers/export/active` | `docentes-activos.csv` | `fiscal.view` | Critica | Exporta datos de docentes activos, incluyendo fiscales si el permiso lo permite. |
| Directorio | `GET /teachers/export/history` | `docentes-completo-historial.csv` | `audit.view` | Critica | Exporta historial completo con campos fiscales y trazabilidad. |
| Auditoria | `GET /audit/export` | `auditoria-bitacora.csv` | `audit.view` | Alta | Exporta `before_data`, `after_data` y metadata serializada. |

No se detectaron exportables CSV productivos directos en:

- Usuarios / Control de accesos.
- Catalogos.
- Calendario.
- Horarios.
- Incidencias.
- Extras.

Tambien existen herramientas locales/legacy de importacion CSV:

| Herramienta | Tipo | Uso | Riesgo |
|---|---|---|---|
| `tools/legacy-csv-to-sql.mjs` | Importacion CSV a SQL | Directorio/docentes legacy | Debe manejar BOM, acentos y columnas historicas con cuidado. |
| `tools/legacy-schedules-csv-to-sql.mjs` | Importacion CSV a SQL | Horarios legacy | Riesgo de nombres/responsables con acentos o cambios de formato. |
| `tools/legacy-extras-csv-to-sql.mjs` | Importacion CSV a SQL | Extras legacy | Riesgo de observaciones, actividades y fechas capturadas como texto. |

Estas herramientas no son exportables productivos, pero forman parte del riesgo H11 porque leen CSV con `utf8` y parsers locales.

## 3. Exportables criticos

Los exportables mas criticos son:

| Exportable | Motivo |
|---|---|
| Finanzas pagos | Se usa para pago o validacion financiera; combina docentes, horas, RFC/tipo de pago e importes. |
| Finanzas fiscal | Puede exponer pendientes fiscales o datos sensibles si el actor esta autorizado. |
| Nomina resumen/horarios/extras | Protege H01: cualquier alteracion de formato o lectura Excel puede provocar conciliaciones incorrectas. |
| Directorio activos/historial | Contiene datos personales y fiscales; requiere compatibilidad y controles de acceso estrictos. |
| Auditoria bitacora | Es evidencia tecnica; si se corrompen acentos o JSON se reduce trazabilidad. |

H11 debe tratar estos archivos como exportables institucionales, no como simples descargas tecnicas.

## 4. Implementacion actual

### Backend

La API arma CSV en cada modulo:

- `apps/api/src/routes/payroll.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/teachers.ts`
- `apps/api/src/routes/audit.ts`

Patron comun detectado:

- Se usa separador coma.
- Se usan saltos `CRLF` en la mayoria de builders.
- Se declara `Content-Type: text/csv; charset=utf-8`.
- Se envia `Content-Disposition: attachment; filename="..."`.
- Los valores se convierten a texto, se encapsulan en comillas y se escapan comillas dobles.

Diferencias relevantes:

| Modulo | BOM UTF-8 | Builder central | Observacion |
|---|---:|---:|---|
| Nomina | Si | No | Agrega `\uFEFF` y finaliza con CRLF. |
| Finanzas | No | No | Exportable critico sin BOM; mayor riesgo Excel. |
| Directorio | Si | No | Agrega `\uFEFF` y finaliza con CRLF. |
| Auditoria | Si | No | Agrega BOM en `sendCsv`; JSON se serializa dentro de columnas. |

### Frontend

El frontend descarga los CSV como blobs desde:

- `apps/web/src/api.ts` -> `downloadTeacherExport`
- `apps/web/src/api.ts` -> `downloadPayrollExport`
- `apps/web/src/api.ts` -> `downloadFinanceExport`
- `apps/web/src/api.ts` -> `downloadAuditExport`

No se detecto generacion de CSV en navegador para estos exportables. Por lo tanto, la politica H11 debe vivir principalmente en backend.

## 5. Riesgos de codificacion y acentos

Riesgos detectados:

- Excel en Windows puede interpretar CSV UTF-8 sin BOM como ANSI, provocando textos como `CoordinaciÃ³n`, `CategorÃ­a`, `MÃ³dulo`.
- Finanzas no agrega BOM actualmente, aunque es de los exportables mas importantes.
- Hay helpers CSV duplicados; un modulo puede corregirse y otro quedar con comportamiento distinto.
- Los encabezados y datos con acentos dependen de que toda la cadena se mantenga en UTF-8.
- Los nombres oficiales requieren acentos correctos: `Coordinación General`, `Administración`, `García`, `Muñoz`, `Álvarez`.
- Comentarios, observaciones y metadata pueden contener saltos de linea, comas, comillas y signos especiales.
- Las herramientas legacy de importacion leen como UTF-8, pero deben verificarse con archivos con BOM y sin BOM.

Este inventario no concluye que todos los mojibakes esten en codigo fuente; parte del riesgo puede aparecer por consola, editor o Excel. H11 debe validar bytes reales del archivo descargado y apertura en Excel/Sheets.

## 6. Riesgos Excel y Google Sheets

Riesgos de compatibilidad:

- Separador coma puede ser interpretado distinto en configuraciones regionales que esperan punto y coma.
- Excel puede transformar RFC, identificadores, telefonos o codigos en formatos no deseados.
- Valores como `00123` pueden perder ceros iniciales.
- Montos con punto decimal pueden ser reinterpretados segun configuracion regional.
- Campos largos o JSON de auditoria pueden verse cortados o dificiles de leer.
- Nombres de archivo solo usan `filename="..."`; no hay `filename*` RFC 5987 para nombres con caracteres no ASCII.

Decision recomendada para primera estandarizacion:

- Mantener coma para no romper contratos actuales.
- Mantener `charset=utf-8`.
- Agregar BOM UTF-8 de forma consistente a todos los CSV orientados a Excel.
- Mantener nombres de archivo ASCII mientras no haya necesidad de nombres con acentos.
- Documentar que Google Sheets debe importar como UTF-8 cuando se use importacion manual.

## 7. Riesgos de datos y seguridad

Riesgos no funcionales:

- CSV formula injection: valores iniciados con `=`, `+`, `-`, `@`, tab o retorno pueden ejecutarse como formulas en Excel.
- Campos sensibles: RFC, banco, tipo de pago, correo fiscal, historial docente y metadata de auditoria.
- Exportables financieros deben conservar permisos H03: `finance.export`, fiscal sensible y `audit.view`.
- No debe usarse H11 para ampliar visibilidad de datos.
- No debe alterarse H01: importes, redondeos y precision monetaria deben permanecer intactos.

Politica recomendada:

- Sanitizar formula injection solo al serializar CSV, sin modificar valores en base de datos ni respuestas JSON.
- Mantener permisos existentes por endpoint.
- Agregar pruebas de que un usuario sin permiso no puede descargar exportables sensibles.
- No incluir secretos, tokens, constancias ni documentos fiscales en CSV.

## 8. Estrategia estandar propuesta

Crear en una fase posterior un helper central, por ejemplo:

- `apps/api/src/lib/csv.ts`

Responsabilidades sugeridas:

- `toCsvValue(value, options)`.
- Escapar comillas dobles.
- Preservar saltos de linea dentro de campos entrecomillados.
- Aplicar defensa contra CSV formula injection.
- Usar `CRLF`.
- Agregar BOM UTF-8 cuando el archivo sea orientado a Excel.
- Generar `Content-Type: text/csv; charset=utf-8`.
- Generar `Content-Disposition` consistente.
- Mantener separador coma por compatibilidad inicial.

Reglas de alcance:

- No cambiar columnas sin autorizacion.
- No cambiar nombres de archivo salvo que se documente.
- No cambiar permisos.
- No cambiar montos ni formula de nomina.
- No cambiar filtros H02/H03.
- No tocar migraciones ni base de datos.

## 9. Pruebas recomendadas

Pruebas unitarias para el helper CSV:

- Acentos: `Coordinación General`, `García`, `Muñoz`, `Álvarez`.
- Comillas: `Docente "Especial"`.
- Comas: `ADETUR, ARQ`.
- Saltos de linea en observaciones.
- Valores nulos y vacios.
- Formula injection: `=SUMA(1,1)`, `+cmd`, `-10+20`, `@usuario`.
- Montos como string: `517510.00`, `0.30`, `62.68`.
- BOM presente cuando corresponde.
- `CRLF` consistente.

Pruebas de integracion API:

- Cada endpoint CSV responde `200` con permiso correcto.
- Cada endpoint CSV responde `403` o equivalente sin permiso.
- `Content-Type` incluye `charset=utf-8`.
- `Content-Disposition` contiene nombre esperado.
- El primer byte esperado corresponde a BOM en exportables Excel.
- No se modifica el calculo de H01.

Pruebas manuales controladas:

- Abrir Finanzas, Nomina, Directorio y Auditoria en Excel Windows.
- Abrir los mismos archivos en Google Sheets.
- Confirmar acentos correctos.
- Confirmar que montos y horas no se reinterpretan incorrectamente.
- Confirmar que RFC/telefonos/identificadores no pierden formato cuando aplique.

## 10. Plan propuesto por fases

| Fase | Objetivo | Alcance |
|---|---|---|
| H11-F0 | Inventario | Documento actual; sin cambios funcionales. |
| H11-F1 | Helper CSV central | Crear helper, pruebas unitarias y politica UTF-8/BOM/formula injection. |
| H11-F2 | Nomina y Finanzas | Migrar exportables criticos al helper central sin cambiar columnas ni permisos. |
| H11-F3 | Directorio y Auditoria | Migrar exportables sensibles restantes y validar datos fiscales/auditoria. |
| H11-F4 | Importadores legacy/locales | Revisar parsers CSV, BOM de entrada y documentar uso controlado. |
| H11-F5 | Validacion Excel/Sheets | Pruebas manuales y automatizadas de bytes/headers antes de deploy. |

Recomendacion tecnica:

- Iniciar H11-F1 antes de tocar exportables productivos.
- Priorizar Finanzas por no tener BOM actualmente.
- Mantener los cambios pequenos y verificables por modulo.
- No mezclar H11 con cambios de reglas H01/H02/H03/H05/H09/H10.

## 11. Confirmacion de alcance H11-F0

En esta fase:

- No se modifico codigo funcional.
- No se modifico base de datos.
- No se creo migracion.
- No se tocaron permisos.
- No se tocaron roles.
- No se tocaron reglas de H01/H02/H03/H05/H09/H10.
- No se ejecuto deploy.
- No se conecto a produccion.

