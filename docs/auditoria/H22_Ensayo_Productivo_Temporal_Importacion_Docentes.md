# H22 - Ensayo temporal con datos productivos restaurados

**Fecha:** 2026-07-29
**Estado:** Completado y aprobado técnicamente.
**Alcance:** instancia temporal aislada; producción permaneció sin escrituras.

## 1. Objetivo

Validar la migración `014_h22_teacher_external_identifier_unique.sql` y el
Preview H22 sobre una restauración controlada de datos productivos, sin aplicar
la migración ni ejecutar importaciones en la base productiva.

## 2. Recursos

| Recurso | Evidencia |
|---|---|
| Backup on-demand | `1785342462476`, `SUCCESSFUL` |
| Inicio UTC | `2026-07-29T16:27:42.484Z` |
| Fin UTC | `2026-07-29T16:29:13.774Z` |
| Instancia protegida | `nomina-docente-web` |
| Instancia temporal | `h22-rehearsal-20260729` |
| Resultado final | Instancia temporal eliminada; ausencia verificada |

No se almacenaron credenciales, dumps o datos productivos en el repositorio.

## 3. Migración 014

La migración:

- crea exclusivamente el índice único parcial
  `teachers_external_identifier_unique_idx`;
- normaliza mediante `upper(btrim(external_identifier))`;
- excluye identificadores vacíos;
- no contiene `INSERT`, `UPDATE` ni `DELETE`;
- no modifica filas.

Se aplicó mediante H05 únicamente en la instancia temporal.

## 4. Integridad antes y después

Los conteos se conservaron:

- 217 docentes;
- 69 identificadores no vacíos;
- 148 identificadores vacíos;
- 7 docentes con `created_by IS NULL`;
- 0 grupos de identificadores duplicados.

Los fingerprints antes/después fueron idénticos para:

- docentes y responsables;
- horarios, incidencias y extras;
- documentos y datos fiscales;
- corridas, líneas y detalles de nómina;
- snapshots e históricos relacionados.

No hubo cambios de `created_by`, identificadores visibles, datos fiscales,
nómina o snapshots.

## 5. Preview posterior al fix legacy

El Preview se ejecutó sobre la restauración temporal con el código que incluye
el commit `9d7ccbab818d9b95730c2462d8a8cc8205e6f983`.

Resultado:

- plantilla de activos: 184 filas de datos;
- Preview: 184 `SIN_CAMBIOS`;
- 5 advertencias `RESPONSABLE_OPERATIVO_AUSENTE`;
- 0 bloqueantes;
- resolución de docentes existentes por UUID;
- 0 altas accidentales;
- docentes legacy no bloqueados incorrectamente por componentes nominales
  vacíos;
- 0 escrituras y 0 eventos de auditoría derivados del Preview.

Las plantillas conservaron BOM UTF-8, CRLF y diez columnas exactas. La apertura
automatizada con Excel institucional validó:

- plantilla vacía: 1 fila por 10 columnas;
- activos: 185 filas por 10 columnas, incluyendo encabezado;
- catálogo completo: 218 filas por 10 columnas, incluyendo encabezado;
- acentos correctos;
- cero mojibake.

## 6. Limpieza

- Se detuvieron conexiones/proxies del ensayo.
- Se eliminaron archivos temporales locales.
- Se eliminó `h22-rehearsal-20260729`.
- Se verificó que la instancia temporal ya no existe.
- El backup `1785342462476` se conserva como evidencia de recuperación.

## 7. Confirmaciones

- Producción fue consultada solo read-only para evidencia previa.
- No se aplicó `014` en producción.
- No se ejecutó Apply institucional.
- No hubo deploy.
- No se modificó H01.
- No se modificaron nómina, corridas o snapshots.
- No se tocaron datos fiscales.
- No se crearon docentes.
