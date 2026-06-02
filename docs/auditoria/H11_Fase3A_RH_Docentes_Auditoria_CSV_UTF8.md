# H11 Fase 3A - RH, Docentes y Auditoria CSV UTF-8

## 1. Objetivo

Se aplico el helper CSV central de H11-F1 a los exportables backend de Directorio/RH y Auditoria, sin modificar reglas funcionales, filtros, permisos ni contratos de datos.

Esta fase cubre solamente backend. Los CSV generados desde frontend quedan fuera de alcance para una fase posterior.

## 2. Exportables migrados

### Directorio/RH

- `GET /teachers/export/active`
- Archivo conservado: `docentes-activos.csv`
- Permiso conservado: `fiscal.view`

### Historial de docentes

- `GET /teachers/export/history`
- Archivo conservado: `docentes-completo-historial.csv`
- Permiso conservado: `audit.view`

### Auditoria

- `GET /audit/export`
- Archivo conservado: `auditoria-bitacora.csv`
- Permiso conservado: `audit.view`

## 3. Correccion tecnica

- CSV generado con helper central `apps/api/src/lib/csv.ts`.
- BOM UTF-8 aplicado desde el helper central.
- `Content-Type: text/csv; charset=utf-8`.
- `Content-Disposition` generado con helper central.
- Separador coma.
- Saltos CRLF.
- Escape consistente de comillas dobles.
- `quoteAll: true` para conservar el comportamiento previo de los exportables.
- Se preservo el salto final que ya tenian los CSV de docentes.
- Auditoria conserva serializacion JSON previa antes de enviar las celdas al helper.

## 4. Sin cambios funcionales

No se cambiaron:

- columnas exportadas;
- orden de columnas;
- nombres de headers;
- rutas;
- nombres de archivo;
- permisos;
- filtros;
- informacion sensible autorizada en exports de RH/Docentes;
- logica de auditoria;
- formula de nomina;
- H01, H02, H03, H05, H09 o H10;
- frontend;
- base de datos;
- migraciones.

## 5. Pruebas agregadas

Se agrego:

- `apps/api/src/test/api-h11-directory-audit-csv.integration.test.ts`

La prueba cubre:

- BOM UTF-8;
- `Content-Type`;
- `Content-Disposition`;
- headers y orden de columnas;
- acentos en datos;
- escape de comas, comillas dobles y saltos de linea;
- permisos existentes de Directorio/RH y Auditoria;
- contrato de datos sensibles en export autorizado de docentes;
- JSON de auditoria escapado dentro del CSV.

## 6. Validacion local/test

La prueba de integracion se ejecuta contra `nomina_docente_test` usando datos sinteticos. No usa Firebase real ni produccion.

## 7. Riesgos pendientes

- Validar apertura de los CSV en Excel Windows, Google Sheets y LibreOffice durante H11-F4.
- Los CSV generados por frontend, como Cumpleanos/Fiscal si aplica, quedan pendientes de una fase posterior.
- La sanitizacion de formulas CSV sigue disponible en el helper, pero no se activo en esta fase para no cambiar contenido funcional sin decision por exportable.

## 8. Proximo paso

H11-F4: validacion manual/controlada de apertura en herramientas de hoja de calculo y cierre de riesgos de codificacion en estaciones Windows institucionales.
