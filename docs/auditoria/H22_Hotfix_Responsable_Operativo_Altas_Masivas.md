# H22-HF1A - Hotfix de responsable operativo en altas masivas

Fecha: 2026-07-31

Estado: cerrado operativo; deploy y smoke autenticado aprobados

Clasificacion: `READ_PROJECTION_DEFECT`

## 1. Sintoma y alcance

Tras un Apply CSV H22 autorizado, Directorio mostraba `Sin responsable` para
docentes cuyo archivo incluia `responsable_operativo_email`. La regla vigente
es:

```text
responsable_operativo_email
  -> app_users.email
  -> app_users.id
  -> teachers.created_by
```

El Admin que ejecuta Apply permanece como actor de auditoria y como
`updated_by`; no sustituye al responsable operativo indicado en el CSV.

## 2. Reproduccion controlada

La reproduccion se realizo exclusivamente en `nomina_docente_test`, despues de
reconstruirla mediante `test:db:prepare`.

Se probaron altas ficticias con responsables activos de rol `admin`,
`coordinador` y `direccion`. Preview resolvio correo, nombre y UUID; Apply
persistio:

- `teachers.created_by`: UUID del responsable propuesto;
- `teachers.updated_by`: UUID del Admin ejecutor;
- `audit_log.actor_user_id`: UUID del Admin ejecutor;
- `TEACHER_CREATED.after_data`: responsable operativo propuesto, sin datos
  fiscales.

La consulta directa y `GET /api/teachers` confirmaron la persistencia correcta.
Los casos bloqueantes de responsable RH, inactivo, inexistente o ausente y la
atomicidad de Apply permanecen cubiertos por la suite H22 existente.

## 3. Diagnostico productivo read-only

La conexion productiva se realizo mediante Cloud SQL Auth Proxy y una
transaccion iniciada con `BEGIN READ ONLY`:

| Control | Resultado |
|---|---|
| Base | `nomina_docente` |
| Usuario DB | `app_nomina` |
| `transaction_read_only` | `on` |
| Auditoria de Apply | UUID identificado, sin datos personales en este documento |
| Fecha UTC | `2026-07-31T20:29:04.342Z` |
| SHA-256 auditado | `3113dbce07fd46fd077a4b280326e9bba878c340217ba1882ccdcd3929a1255a` |
| Filas | 14 |
| Altas | 14 |
| Actualizaciones | 0 |
| Eventos `TEACHER_CREATED` correlacionados | 14 |

La evidencia nominal no se copio al repositorio. La verificacion por los 14
UUID exactos obtuvo:

| Clasificacion | Conteo |
|---|---:|
| `CREATED_BY_VALID` | 14 |
| `CREATED_BY_NULL` | 0 |
| `CREATED_BY_MISSING_USER` | 0 |
| `CREATED_BY_INVALID_ROLE` | 0 |
| Diferencia contra responsable conservado en auditoria | 0 |

Los 14 responsables existen, estan activos y tienen rol permitido. En 13 altas
`coordination_id` es nulo, por lo que la proyeccion anterior mostraba
literalmente `Sin responsable`. La alta restante tambien se proyectaba desde
`coordinationName`, que no es la fuente oficial del responsable. Por ello las
14 filas importadas estaban expuestas a una representacion semantica incorrecta,
aunque ninguna requeria correccion de datos.

La transaccion termino con `ROLLBACK`. No hubo DDL ni DML.

## 4. Disponibilidad del archivo original

El CSV local legible revisado tiene SHA-256
`382bd99ddf9c9a7f31ea2e4e2458124c7d60c7225e2b4c1c1358905d1a4accfc`,
que no coincide con la ejecucion auditada; por tanto no se uso como fuente.

La fuente equivalente valida fue el evento `TEACHER_CREATED` de cada UUID. Su
`responsibleEmail` resolvio inequivocamente al mismo `app_users.id` ya guardado
en `teachers.created_by` para las 14 filas. No se infirio ningun responsable por
nombre, coordinacion, actor ni posicion de fila.

## 5. Causa raiz

La rama `NUEVO` de `apps/api/src/lib/teacher-import.ts` ya inserta
`row.responsibleUserId` en `teachers.created_by` y `actor.id` en
`teachers.updated_by`; no existe defecto de escritura.

El defecto estaba en la proyeccion de Directorio:

- `GET /teachers` exponia `createdById` y `createdByEmail`, pero no el nombre
  visible del usuario creador;
- `TeachersView.vue` etiquetaba `coordinationName` como `Responsable operativo`;
- `coordination_id` es una referencia tecnica/legacy y no sustituye a
  `teachers.created_by`.

## 6. Correccion aplicada

- API agrega `createdByName` mediante join de `teachers.created_by` con
  `app_users`.
- El tipo frontend `Teacher` incorpora `createdByName`.
- Directorio usa nombre del usuario responsable, luego correo operativo como
  fallback y solo muestra `Sin responsable` cuando `created_by` no resuelve.
- La busqueda de Directorio incluye nombre y correo del responsable.
- No se reescribio `teachers.created_by` porque las 14 altas ya son correctas.

## 7. Conciliacion productiva

Se preparo
`database/validation/h22_reconcile_imported_teacher_responsibles_APPROVAL_REQUIRED.sql`
con los 14 pares UUID docente-responsable obtenidos de auditoria.

El archivo:

- verifica base exacta `nomina_docente`;
- comprueba el UUID y SHA de la ejecucion;
- valida responsables activos y roles permitidos;
- compara `teachers.created_by` con la evidencia `TEACHER_CREATED`;
- espera 14 correctos y 0 candidatos;
- no contiene `UPDATE`, `DELETE` ni escritura persistente;
- termina en `ROLLBACK` y no contiene `COMMIT` operativo.

No se ejecuto el script contra produccion porque el alcance prohibe DML y el
preview read-only ya demostro que hay cero filas por conciliar. El resultado
equivalente esperado es: 14 mapeadas, 14 correctas, 0 `NULL`, 0 candidatas, 0
auditorias nuevas.

## 8. Plantilla vacia

El backend devuelve cero filas de datos para `scope=blank`; la plantilla vacia
contiene unicamente encabezados. Se corrigio el Manual de Uso, que indicaba
erroneamente una fila vacia de trabajo. La SPEC ya describia el contrato
correcto y no requirio cambios.

`docs/Manual_Uso_Nomina_Docente.docx` se regenero con el script oficial. La
verificacion estructural con `python-docx` confirmo 745 parrafos, 38 tablas, una
seccion, presencia de la frase corregida y ausencia de la frase obsoleta. El
renderizador visual canonico no pudo ejecutarse porque LibreOffice no esta
instalado; el intento alterno de exportacion con Word no concluyo y se detuvo
sin modificar el DOCX. Esta limitacion de render no afecta las pruebas de
codigo ni la validacion estructural del artefacto.

## 9. Validaciones

| Validacion | Resultado |
|---|---|
| `npm run test:api` | 27/27 |
| `npm run test:api:integration` | 105/105, solo `nomina_docente_test` |
| `npm run test:web` | 82/82 |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `git diff --check` | OK |

Las regresiones agregadas validan responsables Admin, Coordinador y Direccion,
persistencia de `created_by`, actor Admin en `updated_by` y auditoria, respuesta
de Directorio, ausencia de datos fiscales y helper visual de fallback.

## 10. Estado y confirmaciones

- Produccion conserva los 14 `created_by` correctos.
- La correccion fue desplegada en `nomina-api-00054-2ld` y Hosting release
  `1785536172540000`.
- El smoke autenticado confirmo nombre/correo del responsable real, ausencia de
  UUID tecnicos y fallback `Sin responsable` solo para legacy con
  `created_by IS NULL`.
- La evidencia productiva posterior esta en
  `docs/auditoria/H22_Hotfix_Responsable_Operativo_Deploy_Productivo.md`.
- No se repitio Apply.
- No se ejecutaron migraciones.
- No se modifico Cloud SQL.
- No se cambiaron datos fiscales.
- No se modificaron H01, Nomina, corridas ni snapshots.
- No se ampliaron roles o permisos.
