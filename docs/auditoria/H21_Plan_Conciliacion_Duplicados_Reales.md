# H21 - Plan de conciliacion de duplicados reales de Asignaturas

Fecha: 2026-07-20

Estado: decision humana aprobada, implementacion y ensayo temporal completados;
ejecucion productiva pendiente de H05/H13, backup y autorizacion expresa.

## 1. Objetivo

Conciliar cinco pares legacy confirmados como duplicados reales sin eliminar
asignaturas ni reescribir historicos. El UUID acentuado se conserva como
canonico; los horarios vivos del UUID duplicado se reasignan al canonico y el
duplicado queda `INACTIVO`.

## 2. Mapping aprobado

| Grupo | UUID duplicado | UUID canonico | Nombre canonico | Horarios a mover |
|---:|---|---|---|---:|
| 1 | `dc73b77d-ff7d-4ff2-a122-f9593b401220` | `adac657f-5ebd-41f7-b925-a442fee2c9ef` | DERECHOS HUMANOS Y GARANTIAS, con acento en GARANTIAS | 1 |
| 2 | `984f875a-4739-4ded-870f-cd73ed2a939d` | `1aca811f-b8d6-45e1-b0df-f65687711824` | ENFERMERIA COMUNITARIA I, con acento en ENFERMERIA | 1 |
| 3 | `66102312-ae9b-4fd1-bc8e-eb55aae814b2` | `670cc3e4-a4bb-420e-a4b5-706951450da6` | ESTUDIO DE MERCADO E INVERSION, con acento en INVERSION | 1 |
| 4 | `8517e7b4-de56-4314-8ede-748b5f0827d8` | `51d2e1cb-634e-4c88-ade3-08bd1f91bd5e` | EVALUACION DEL DESEMPENO LABORAL, con ortografia acentuada | 1 |
| 5 | `e16b3ec3-8e55-40b2-956a-1827e6f3b00e` | `968b2a44-f431-4f8e-946d-de0472c094c9` | PLANEACION Y CONTROL DE PRESUPUESTOS, con acento en PLANEACION | 4 |
| **Total** | | | | **8** |

Los nombres de la tabla se describen en ASCII para compatibilidad documental;
el SQL conserva los nombres UTF-8 exactos aprobados.

## 3. Estado real observado

- Los cinco UUID duplicados estaban `ACTIVO`.
- Cuatro UUID canonicos estaban `ACTIVO`.
- El canonico del grupo 3 estaba `INACTIVO` y debia activarse.
- Por tanto, el resultado esperado es cinco canonicos `ACTIVO` y cinco
  duplicados `INACTIVO`.

Esta evidencia sustituye cualquier supuesto previo de que el duplicado del
grupo 3 ya estuviera inactivo.

## 4. Estrategia SQL

Archivo:

`database/validation/h21_reconcile_duplicate_subjects_APPROVAL_REQUIRED.sql`

El SQL:

- valida base exacta `nomina_docente`;
- valida los diez UUID, nombres, estados y conteos por grupo;
- bloquea las diez asignaturas y los ocho horarios objetivo;
- actualiza solo `schedules.subject_id` y `schedules.subject_name`;
- activa el canonico del grupo 3;
- inactiva los cinco UUID duplicados;
- conserva los ocho IDs y todas las demas columnas de horario;
- no cambia ni reasigna snapshots de Nomina;
- no ejecuta `DELETE`;
- registra 11 eventos de auditoria;
- termina en `ROLLBACK`.

Una ejecucion aprobada debe usar una copia temporal y cambiar exclusivamente la
ultima sentencia por `COMMIT`. El archivo versionado nunca contiene un commit
operativo.

## 5. Ajuste de importacion H21

- La plantilla de catalogo incluye solo asignaturas `ACTIVO` por defecto.
- `includeInactive=true` queda como opcion administrativa explicita.
- Un canonico identificado por UUID puede actualizarse aunque exista una
  variante historica inactiva con el mismo nombre normalizado.
- Una fila nueva que colisione por nombre sigue bloqueada.
- Dos filas activas del mismo nombre normalizado siguen bloqueadas.
- El sistema no fusiona ni reactiva duplicados por inferencia.
- La busqueda operativa de Horarios conserva solo asignaturas activas.

## 6. Guardas previas a produccion

1. Ejecutar H13 y confirmar proyecto, instancia, servicio y rollback.
2. Crear backup Cloud SQL on-demand y esperar `SUCCESSFUL`.
3. Confirmar H05 con `pending=1` solo para `013` y `checksum mismatch=0`.
4. Aplicar `013` mediante H05.
5. Ejecutar el SQL versionado con `ROLLBACK` y comparar conteos.
6. Solicitar autorizacion humana final.
7. Ejecutar copia temporal con unicamente `COMMIT` final.
8. Validar fingerprints, catalogo activo, preview, API, UI y Horarios.
9. Detener y hacer rollback operativo si cualquier conteo difiere.

## 7. Confirmaciones

- No se ejecuto la conciliacion en produccion.
- No se aplico `013` en produccion.
- No se modificaron snapshots, Nomina ni H01.
- No se eliminaron asignaturas.
- No se hizo deploy.
