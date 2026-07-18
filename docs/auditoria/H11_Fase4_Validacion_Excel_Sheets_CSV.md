# H11-F4 - Validacion Excel/Sheets de CSV UTF-8

## 1. Ambiente de validacion

- Rama: `feature/h02-h03-user-coordinations-permissions`.
- Commit validado: `d2a7a90 fix(h11): standardize frontend csv exports`.
- Fecha de validacion local: 2026-06-03.
- Base usada: `nomina_docente_test`.
- Origen de CSV: rutas backend invocadas con `app.inject()` y actores de prueba H04, mas helpers frontend H11-F3B.
- Carpeta temporal de evidencia: `%TEMP%\nomina-h11-f4-csv-1780498870152` (ruta local temporal, ya no operativa).
- Herramientas usadas:
  - Excel Windows via COM: disponible, version `16.0`.
  - Parser tecnico Node: BOM, CRLF, headers, columnas, comillas, comas, saltos internos y mojibake.
  - Google Sheets: no ejecutado en esta corrida; no se subieron archivos a servicios externos.
  - LibreOffice/Calc: no disponible en rutas locales comunes.
- Confirmacion de seguridad:
  - No se uso produccion.
  - No se uso `nomina_docente`.
  - No se hizo deploy.
  - No se ejecutaron migraciones.
  - No se modifico base productiva.
  - `nomina_docente_test` se regenero y se alimento solo con datos sinteticos para esta validacion.

## 2. CSV validados

| CSV | Origen | Excel | Sheets | LibreOffice | Acentos OK | Columnas OK | Montos OK | Observaciones |
|---|---|---|---|---|---|---|---|---|
| `finanzas-h04-qa-mayo-15-28-2026-pagos.csv` | `GET /reports/finance/export/payments` | OK | Pendiente | No disponible | OK | OK, 5 columnas | OK, raw CSV conserva `2200.00`; Excel lo interpreta como numero `2200` | BOM UTF-8 y CRLF presentes. |
| `finanzas-h04-qa-mayo-15-28-2026-pendientes-fiscales.csv` | `GET /reports/finance/export/fiscal` | OK | Pendiente | No disponible | OK | OK, 16 columnas | OK, raw CSV conserva `2200.00` | Sin mojibake en Excel. |
| `finanzas-h04-qa-mayo-15-28-2026-coordinaciones.csv` | `GET /reports/finance/export/coordinations` | OK | Pendiente | No disponible | OK en headers | OK, 9 columnas | OK, raw CSV conserva `2200.00` | No contiene acentos de muestra en filas, pero headers UTF-8 correctos. |
| `nomina-h04-qa-mayo-15-28-2026-resumen.csv` | `GET /payroll/runs/:id/export/summary` | OK | Pendiente | No disponible | OK | OK, 23 columnas | OK, raw CSV conserva `100.00` y `2200.00` | Sin filas rotas. |
| `nomina-h04-qa-mayo-15-28-2026-horarios.csv` | `GET /payroll/runs/:id/export/schedules` | OK | Pendiente | No disponible | OK | OK, 22 columnas | OK, raw CSV conserva `100.00` | Valida `Administración Turística` con acentos en Excel. |
| `nomina-h04-qa-mayo-15-28-2026-extras.csv` | `GET /payroll/runs/:id/export/extras` | OK | Pendiente | No disponible | OK | OK, 10 columnas | OK, raw CSV conserva `100.00` | Campo de observacion con salto interno no rompe filas. |
| `docentes-activos.csv` | `GET /teachers/export/active` | OK | Pendiente | No disponible | OK | OK, 24 columnas | No aplica | Valida `Alvarez`, `Munoz`, `Garcia`, coma, comillas y salto interno. |
| `docentes-completo-historial.csv` | `GET /teachers/export/history` | OK | Pendiente | No disponible | OK | OK, 27 columnas | No aplica | Historial/JSON no rompe columnas. |
| `auditoria-bitacora.csv` | `GET /audit/export` | OK | Pendiente | No disponible | OK | OK, 9 columnas | No aplica | JSON/metadata con acentos, comas y comillas abre correctamente. |
| `nomina-h11-f4-detalle-docente.csv` | PayrollView Detalle CSV | OK | Pendiente | No disponible | OK | OK, 10 columnas | OK, raw CSV conserva `850.50`, `250.00`, `1100.50` | Frontend conserva BOM UTF-8, `quoteAll` y CRLF final. |
| `cumpleaños-docentes.csv` | FiscalRecordsView Cumpleaños CSV | OK | Pendiente | No disponible | OK | OK, 9 columnas | No aplica | Nombre validado localmente con `ñ`. |

## 3. Hallazgos

- Todos los archivos empiezan con BOM UTF-8 (`EF BB BF`).
- Todos los archivos usan CRLF como separador de filas.
- No se detectaron marcadores de mojibake (`Ã`, `Â`, `�`) en bytes parseados ni en apertura Excel.
- El parseo CSV no detecto filas malformadas ni columnas extra/faltantes.
- Las comas, comillas dobles y saltos de linea internos se mantienen dentro de la celda correspondiente.
- Los importes permanecen en el CSV como cadenas decimales esperadas (`100.00`, `250.00`, `850.50`, `1100.50`, `2200.00`, segun el exportable).
- Excel Windows abre los CSV sin mojibake. Como comportamiento propio de Excel, algunos importes se interpretan como numeros y pueden mostrarse sin ceros finales en formato General; el valor no cambia y el CSV conserva los decimales.
- Google Sheets no se valido en esta corrida porque no se subieron archivos sinteticos a servicios externos.
- LibreOffice/Calc no se valido porque no esta instalado en la estacion local.

## 4. Resultado

**Aprobado con observaciones.**

La validacion tecnica y Excel Windows pasaron para los 11 exportables criticos. Quedan observaciones no bloqueantes por herramientas no ejecutadas en esta estacion:

- Google Sheets pendiente de validacion manual por usuario autorizado si es consumidor operativo.
- LibreOffice/Calc pendiente solo si la institucion lo usa.

## 5. Riesgos pendientes

- Decision formal por exportable sobre sanitizacion de formulas CSV (`=`, `+`, `-`, `@`). El helper ya la soporta, pero H11-F2/F3A/F3B no la activaron para no cambiar semantica de datos.
- Validacion final con usuarios Finanzas/RH en su flujo real de descarga y apertura.
- Deploy H11 pendiente.

## 6. Recomendacion

Se recomienda pasar a **H11-F5 deploy controlado** para publicar la estandarizacion CSV, con estas condiciones:

- Mantener backup/rollback de deploy como en fases previas.
- No ejecutar migraciones.
- No modificar datos.
- Pedir a Finanzas/RH una validacion operativa posterior en Excel institucional.
- Si Google Sheets es consumidor obligatorio, subir manualmente archivos sinteticos o de revision autorizada y registrar resultado antes del cierre total de H11.

## 7. Validaciones automatizadas

Ejecutadas correctamente:

- `npm run test`: OK.
- `npm run test:api`: OK.
- `npm run test:api:integration`: OK, usando `TEST_DB_NAME=nomina_docente_test`.
- `npm run test:web`: OK.
- `npm --workspace apps/api run typecheck`: OK.
- `npm --workspace apps/web run typecheck`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
