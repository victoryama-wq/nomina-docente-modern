# H11 Fase 2 - Finanzas y Nomina CSV UTF-8

## 1. Objetivo

Se aplico el helper CSV central de H11-F1 a los exportables criticos backend de Finanzas y Nomina, manteniendo sin cambios el funcionamiento del sistema.

## 2. Exportables migrados

### Finanzas

- `GET /reports/finance/export/payments`
- `GET /reports/finance/export/fiscal`
- `GET /reports/finance/export/coordinations`

Archivos resultantes conservados:

- `finanzas-<periodo>-pagos.csv`
- `finanzas-<periodo>-pendientes-fiscales.csv`
- `finanzas-<periodo>-coordinaciones.csv`

### Nomina

- `GET /payroll/runs/:id/export/summary`
- `GET /payroll/runs/:id/export/schedules`
- `GET /payroll/runs/:id/export/extras`

Archivos resultantes conservados:

- `nomina-<periodo>-resumen.csv`
- `nomina-<periodo>-horarios.csv`
- `nomina-<periodo>-extras.csv`

## 3. Correccion tecnica

- CSV generado con helper central `apps/api/src/lib/csv.ts`.
- BOM UTF-8 en exportables de Finanzas y Nomina.
- `Content-Type: text/csv; charset=utf-8`.
- `Content-Disposition` conservando nombres de archivo actuales.
- Separador coma.
- CRLF.
- Escape consistente de comillas dobles.
- Celdas entrecomilladas con `quoteAll: true` para preservar el comportamiento previo.
- Importes conservados como strings; no se aplico `Number()`.

## 4. Sin cambios funcionales

No se cambiaron:

- columnas exportadas;
- orden de columnas;
- nombres de headers;
- filtros;
- permisos;
- rutas;
- nombres de archivo;
- montos;
- formula de nomina;
- redondeo;
- alcance por coordinacion;
- estados financieros;
- cierre de ciclo;
- interfaz;
- base de datos;
- migraciones.

## 5. Pruebas agregadas

Se agrego:

- `apps/api/src/test/api-h11-csv.integration.test.ts`

La prueba cubre:

- BOM UTF-8;
- `Content-Type`;
- `Content-Disposition`;
- headers y orden de columnas;
- acentos en datos;
- escape de comas y comillas;
- importes como strings;
- permiso `finance.export`;
- proteccion fiscal sensible en export fiscal;
- permisos de exportacion de Nomina.

## 6. Riesgos pendientes

- H11-F3A migro backend Directorio/RH y Auditoria; quedan pendientes los CSV frontend.
- La validacion con Excel Windows, Google Sheets y LibreOffice queda para H11-F4.
- Esta fase no activa sanitizacion de formulas CSV para no cambiar contenido funcional sin decision por exportable.

## 7. Proximo paso

H11-F4: validar apertura en Excel/Sheets/LibreOffice y decidir sanitizacion de formulas por exportable.
