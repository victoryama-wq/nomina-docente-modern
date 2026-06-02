# H11 Fase 1 - Helper CSV central

## 1. Objetivo

Se agrego infraestructura central para serializar CSV de forma consistente en backend y frontend, sin conectar todavia estos helpers a exportables productivos.

## 2. Helpers creados

- `apps/api/src/lib/csv.ts`
- `apps/web/src/utils/csv.ts`

El helper frontend se creo aislado porque el inventario H11 detecto exportaciones CSV generadas directamente en navegador. Esta fase solo deja preparada la utilidad; no cambia las vistas existentes.

## 3. Reglas cubiertas

- `Content-Type` UTF-8 para CSV.
- BOM UTF-8 opcional y activado por defecto al construir CSV.
- Separador configurable, por defecto coma.
- Saltos de linea CRLF por defecto.
- Escape de comillas dobles duplicandolas.
- Comillas cuando el valor contiene separador, comillas o saltos de linea.
- Soporte `quoteAll` para exportaciones que requieran celdas siempre entrecomilladas.
- `null` y `undefined` se serializan como celda vacia.
- Los importes se conservan como strings recibidos; el helper no formatea dinero.
- Sanitizacion de formulas CSV disponible solo con opcion explicita `sanitizeFormulaValues`.

## 4. Pruebas agregadas

- `apps/api/src/lib/csv.test.ts`
- `apps/web/src/utils/csv.test.ts`

Las pruebas cubren acentos, BOM, CRLF, comillas, comas, saltos de linea, celdas vacias, importes como texto, sanitizacion opcional de formulas y generacion de blob/descarga en frontend.

## 5. Lo que no se cambio

- No se modificaron rutas backend productivas.
- No se modificaron vistas frontend productivas.
- No se cambiaron columnas, filtros, nombres de archivo ni permisos.
- No se aplico el helper a `reports.ts`, `payroll.ts`, `teachers.ts` ni `audit.ts`.
- No se aplico el helper a `PayrollView.vue` ni `FiscalRecordsView.vue`.
- No se tocaron H01, H02, H03, H05, H09 ni H10.
- No se modifico base de datos.
- No se hizo deploy.

## 6. Uso esperado en fases posteriores

H11-F2/H11-F3 deben migrar cada exportable de forma gradual y con comparacion contra el CSV actual, validando que no cambien reglas de negocio, filtros ni columnas. Cualquier sanitizacion de formulas debe activarse conscientemente por exportable para evitar sorpresas operativas.

## 7. Riesgos pendientes

- Los exportables actuales siguen usando implementaciones locales hasta que se migren en fases posteriores.
- Debe validarse con usuarios de Excel/Google Sheets que el BOM y CRLF resuelven los casos de acentos en todos los equipos institucionales.
- Algunos exportables pueden requerir `quoteAll`; esa decision debe hacerse por modulo al migrarlos.

## 8. Resultado

H11-F1 queda como base tecnica de bajo riesgo: helper central y pruebas automatizadas, sin impacto funcional sobre exportaciones existentes.
