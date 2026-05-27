# Cierre controlado de recursos de revision H02/H03

Fecha: 2026-05-27

## 1. Objetivo

Eliminar recursos temporales creados para validacion H02/H03 despues de confirmar que:

- El deploy productivo esta operativo.
- La base productiva `nomina_docente` contiene los datos oficiales.
- La nomina de la segunda quincena de mayo fue validada y guardada correctamente.
- La limpieza de duplicados de docentes no afecto calculos ni disponibilidad.

## 2. Alcance

Se eliminaron unicamente recursos de revision/dry-run.

No se elimino ni modifico:

- base productiva `nomina_docente`
- servicio Cloud Run productivo `nomina-api`
- canal Firebase Hosting `live`
- backups en Cloud Storage
- codigo funcional
- permisos productivos
- H01 precision monetaria
- formula de nomina

## 3. Inventario previo

Antes del cierre existian:

### Cloud SQL

| Base | Estado previo |
|---|---|
| `postgres` | Administrativa |
| `nomina_docente` | Productiva |
| `nomina_docente_h02h03_review` | Revision H02/H03 |
| `nomina_docente_h02h03_data_dryrun` | Dry-run de migracion de datos |

### Cloud Run

| Servicio | Estado previo |
|---|---|
| `nomina-api` | Productivo |
| `nomina-api-h02h03-review` | Revision |

### Firebase Hosting

| Canal | Estado previo |
|---|---|
| `live` | Productivo |
| `h02-h03-review` | Revision |

## 4. Validacion previa de produccion

| Validacion | Resultado |
|---|---|
| Proyecto GCP activo | `nomina-docente-prod` |
| Rama Git limpia | Si |
| API productiva `/health` | 200 OK |
| Revision Cloud Run productiva | `nomina-api-00044-pk9` |
| Base productiva configurada en Cloud Run | `nomina_docente` |

## 5. Recursos eliminados

### Cloud SQL

| Recurso | Resultado |
|---|---|
| `nomina_docente_h02h03_review` | Eliminado |
| `nomina_docente_h02h03_data_dryrun` | Eliminado |

Nota: el primer intento de eliminar `nomina_docente_h02h03_review` recibio `409 Operation failed because another operation was already in progress`; se reintento despues de finalizar la eliminacion de dry-run y se completo correctamente.

### Cloud Run

| Recurso | Resultado |
|---|---|
| `nomina-api-h02h03-review` | Eliminado |

### Firebase Hosting

| Recurso | Resultado |
|---|---|
| Canal `h02-h03-review` | Eliminado |

## 6. Inventario posterior

### Cloud SQL

Despues del cierre solo quedan:

| Base |
|---|
| `postgres` |
| `nomina_docente` |

### Cloud Run

Despues del cierre solo queda:

| Servicio | Revision |
|---|---|
| `nomina-api` | `nomina-api-00044-pk9` |

### Firebase Hosting

Despues del cierre solo queda:

| Canal | URL |
|---|---|
| `live` | `https://nomina-docente-prod.web.app` |

## 7. Validacion posterior

| Validacion | Resultado |
|---|---|
| API productiva `/health` | 200 OK |
| Frontend live | 200 OK |
| Logs Cloud Run `severity>=ERROR` ultimos 30 min | Sin resultados |
| Logs Cloud Run `httpRequest.status>=500` ultimos 30 min | Sin resultados |
| `npm --workspace apps/api run typecheck` | Paso |
| `npm --workspace apps/web run typecheck` | Paso |
| `npm run typecheck` | Paso |
| `npm run build` | Paso |

## 8. Impacto

### Impacto esperado

- Se redujo superficie operativa al eliminar recursos temporales.
- Se evita confusion entre bases productivas, preview y dry-run.
- Se mantiene una sola base aplicativa activa: `nomina_docente`.

### Sin impacto detectado

- Produccion siguio respondiendo healthcheck.
- Frontend live siguio disponible.
- No hubo errores Cloud Run posteriores.
- No cambio revision productiva.
- No cambio configuracion productiva.
- No se tocaron datos productivos.

## 9. Riesgos residuales

| Riesgo | Estado |
|---|---|
| Necesitar comparar contra preview/dry-run despues del cierre | Mitigado por documentacion y backups existentes. |
| Fallback legacy H02 sigue habilitado | No bloqueante; sigue dentro de la condicion aprobada de estabilizacion. |
| Recursos locales de desarrollo | Fuera de alcance de este cierre. |

## 10. Resultado

Cierre controlado completado.

Estado final:

- Una sola base aplicativa en Cloud SQL: `nomina_docente`.
- Un solo servicio API en Cloud Run: `nomina-api`.
- Un solo canal Firebase Hosting: `live`.
- Produccion saludable.

No se hizo deploy, no se modifico codigo funcional y no se altero H01 ni la formula de nomina.
