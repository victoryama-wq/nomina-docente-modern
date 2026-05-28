# H06/H14 - Cierre Apps Script Legacy

Fecha: 2026-05-28

## 1. Contexto

El sistema moderno Nomina Docente opera con Vue 3, Firebase Auth, Cloud Run y PostgreSQL/Cloud SQL. H01 precision monetaria, H02/H03 permisos/coordinacion y H05 control formal de migraciones ya fueron trabajados y validados en produccion.

La operacion actual del sistema moderno contiene reglas, permisos, flujos y controles que no existian originalmente en el legacy Apps Script.

## 2. Decision humana

La decision humana aprobada es retirar del repositorio los archivos Apps Script legacy:

- `Codigo.gs`
- `index.html`

Estos archivos ya no se usan operativamente y dejaron de ser referencia valida para entender la operacion actual.

## 3. Archivos retirados

- `Codigo.gs`
- `index.html`

## 4. Motivo del retiro

- Ya no se usan operativamente.
- El sistema moderno supero la funcionalidad legacy.
- El legacy ya no representa las reglas actuales implementadas en H01, H02, H03 y H05.
- Mantenerlos en la raiz del repositorio podia generar confusion sobre la fuente de verdad.
- La trazabilidad historica permanece disponible en Git.

## 5. Alcance

El alcance de este cierre fue exclusivamente documental y de limpieza controlada del repositorio:

- eliminacion de archivos legacy locales;
- actualizacion de referencias vivas en README, SDD y matriz formal de riesgos;
- documentacion del cierre H06/H14.

## 6. Fuera de alcance

Confirmaciones:

- No se toco produccion.
- No se toco base de datos.
- No se toco nomina.
- No se tocaron permisos.
- No se toco Firebase/Cloud Run.
- No se modifico H01.
- No se modifico H02.
- No se modifico H03.
- No se modifico H04.
- No se modifico H05.

## 7. Validaciones

Validaciones ejecutadas para este cierre:

| Validacion | Resultado |
|---|---|
| `npm run test` | Paso |
| `npm run test:api` | Paso |
| `npm run test:api:integration` | Paso con PostgreSQL local/test `nomina_docente_test` |
| `npm run test:web` | Paso |
| `npm --workspace apps/api run typecheck` | Paso |
| `npm --workspace apps/web run typecheck` | Paso |
| `npm run typecheck` | Paso |
| `npm run build` | Paso |

## 8. Resultado

H06/H14 quedan cerrados como retiro documental/controlado del legacy Apps Script local en el repositorio.

El sistema moderno queda como fuente vigente de implementacion y operacion. Los archivos retirados no deben reintroducirse como referencia funcional.

## 9. Pendientes

- Confirmar si existen copias historicas externas en Google Drive o respaldos institucionales.
- Marcar cualquier copia externa como historica/no operativa.
- Conservar respaldo Git historico por trazabilidad.
