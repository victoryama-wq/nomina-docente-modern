# H11 Fase 3B - Frontend CSV UTF-8

## 1. Objetivo

Se aplico el helper CSV frontend de H11-F1 a los exportables generados en navegador, manteniendo sin cambios el funcionamiento del sistema.

Esta fase no modifica backend, rutas API, permisos, columnas, filtros, nombres de archivo, datos exportados ni UX.

## 2. Exportables migrados

### Nomina detalle por docente

- Archivo: `apps/web/src/views/PayrollView.vue`
- Exportable: boton `Detalle CSV`
- Archivo conservado: `nomina-<ciclo>-<periodo>-detalle-docente.csv`
- Helper aplicado: `apps/web/src/utils/payrollDetailCsv.ts`

### Cumpleanos docentes

- Archivo: `apps/web/src/views/FiscalRecordsView.vue`
- Exportable: boton `Cumpleanos CSV`
- Archivo conservado: `cumpleaños-docentes.csv`
- Helper aplicado: `apps/web/src/utils/fiscalBirthdaysCsv.ts`

## 3. Correccion tecnica

- CSV generado con helper central frontend `apps/web/src/utils/csv.ts`.
- BOM UTF-8.
- Blob type `text/csv;charset=utf-8`.
- Separador coma.
- Saltos CRLF.
- Se conserva CRLF final que ya generaban los CSV frontend.
- Escape consistente de comillas dobles.
- `quoteAll: true` para conservar el comportamiento previo de celdas entrecomilladas.
- Importes conservados como strings; no se aplico `Number()` a montos.
- No se activo sanitizacion de formulas CSV para no cambiar contenido sin decision por exportable.

## 4. Sin cambios funcionales

No se cambiaron:

- columnas exportadas;
- orden de columnas;
- nombres de headers;
- filtros;
- permisos;
- condiciones de visibilidad;
- nombres de archivo;
- datos exportados;
- botones;
- UX;
- rutas API;
- backend;
- formula de nomina;
- montos;
- redondeo;
- base de datos;
- migraciones;
- produccion.

## 5. Pruebas agregadas

Se agregaron:

- `apps/web/src/utils/payrollDetailCsv.test.ts`
- `apps/web/src/utils/fiscalBirthdaysCsv.test.ts`

Las pruebas cubren:

- headers y orden de columnas;
- nombre de archivo esperado;
- BOM UTF-8 por bytes `EF BB BF`;
- Blob type UTF-8;
- CRLF y CRLF final;
- acentos;
- comas y comillas dobles;
- importes como strings en detalle de nomina;
- ordenamiento vigente de cumpleaños.

## 6. Riesgos pendientes

- H11-F4 debe validar apertura real en Excel Windows, Google Sheets y LibreOffice.
- La sanitizacion contra CSV formula injection sigue disponible en el helper, pero requiere decision por exportable antes de activarse.
- Importadores legacy/locales quedan fuera de esta fase.

## 7. Proximo paso

H11-F4: validacion manual/controlada de apertura en herramientas de hoja de calculo y cierre de riesgos de codificacion.
