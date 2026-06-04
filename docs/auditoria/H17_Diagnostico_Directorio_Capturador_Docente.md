# H17 - Diagnostico Directorio por capturador docente

Fecha: 2026-06-04

## 1. Contexto

Se reviso un incidente real en produccion/verificacion: coordinadoras como Zulma,
Eslivet y Merit pueden ingresar al Directorio y ver docentes, pero el sistema no
les permite editar algunos registros que operativamente aparecen bajo su
responsabilidad.

La decision funcional vigente corregida por decision humana es:

- Coordinador/coordinadora puede editar datos operativos unicamente de docentes
  capturados por el/ella.
- Coordinador/coordinadora no puede editar docentes capturados por otro usuario.
- Coordinador/coordinadora no puede editar datos fiscales.
- La edicion de Directorio no debe basarse solo en coordinacion asignada.

Esta revision fue read-only. No se ejecutaron escrituras, migraciones ni deploy.

## 2. Precheck

| Elemento | Resultado |
|---|---|
| Rama | `feature/h02-h03-user-coordinations-permissions` |
| Estado local | Working tree limpio al inicio; rama `ahead 1` contra origin |
| Commit local relevante | `086abe5 fix(h02): allow coordinators to edit operational teacher data` |
| Estado de `086abe5` | Commit local no subido a origin durante este diagnostico y no desplegado por esta revision |
| Revert posterior | `bce2180 revert(h17): restore teacher edit ownership by capturer` restaura regla por capturador |
| Uso de produccion | Solo consultas `SELECT` en transaccion `READ ONLY` |
| Escrituras | No `UPDATE`, no `DELETE`, no `INSERT` |
| Migraciones | No ejecutadas |
| Deploy | No ejecutado |

Nota importante: el commit local `086abe5` implementaba una regla por
coordinacion asignada. Esa hipotesis quedo descartada por la decision humana
actual y fue revertida mediante `bce2180`.

## 3. Documentos revisados

- `docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md`
- `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md`
- `docs/auditoria/H17_Correccion_Directorio_Coordinador_Edita_Docentes.md`
  (documento local eliminado por el revert por contener la hipotesis descartada)
- `docs/auditoria/H02_H03_Fase3_Modulos_Operativos.md`
- `docs/auditoria/H02_H03_Fase4_Fiscal_Finanzas_Nomina_Preview.md`
- `docs/auditoria/H02_H03_Fase5_Frontend_Permisos.md`

El SDD consolidado y la matriz mantienen como criterio que los registros
operativos respetan propiedad por capturador donde aplica y que Directorio no
debe confundirse con el catalogo de coordinaciones. H03 mantiene que
`teachers.manage` no habilita fiscal.

## 4. Resultado de revision de codigo

### Backend desplegable/origin

En `origin/feature/h02-h03-user-coordinations-permissions`,
`apps/api/src/routes/teachers.ts` usa como fuente tecnica:

- `teachers.created_by`, expuesto como `createdById`.
- `createdByEmail`, obtenido por join contra `app_users`.
- No existe en `teachers` un campo separado `captured_by`.

La funcion de autorizacion operativa de Directorio para coordinador/direccion
revisa autoria directa:

- Si el actor es `admin`, alcance global.
- Si el actor es `coordinador` o `direccion`, solo permite si
  `teacher.createdById` coincide con el `app_users.id` del actor.
- Si no coincide, rechaza con mensaje equivalente a "Solo puedes modificar
  docentes capturados por tu usuario."

Las rutas fiscales siguen protegidas por permisos H03:

- `PATCH /teachers/:id/fiscal` requiere `fiscal.manage`.
- Carga/descarga de constancias requiere permisos documentales fiscales.
- `POST /teachers` y `PATCH /teachers/:id` bloquean campos fiscales cuando el
  actor no tiene `fiscal.manage`.

### Frontend desplegable/origin

En `origin/feature/h02-h03-user-coordinations-permissions`,
`apps/web/src/views/TeachersView.vue` habilita Editar con:

- `authStore.isAdmin`, o
- `teacher.createdById === authStore.session?.id`.

Por tanto, frontend y backend usan la misma fuente de verdad tecnica:
`teachers.created_by` / `Teacher.createdById`.

### Commit local `086abe5`

El commit local `086abe5` cambio el backend y frontend para permitir edicion de
coordinador por `coordination_id` dentro de `actorCoordinations`. Esa regla
contradice la decision actual: "no debe basarse solo en coordinacion asignada".

Recomendacion inmediata: no desplegar ni subir ese commit como correccion final
de H17. Debe revertirse o reemplazarse por un cambio alineado a capturador
tecnico si se implementa H17 funcional.

## 5. Resultado de consultas read-only

Se ejecuto una conexion controlada mediante Cloud SQL Auth Proxy local en puerto
`15432` contra la base productiva `nomina_docente`. Todas las consultas se
ejecutaron dentro de `BEGIN READ ONLY`.

Validacion de conexion:

| Campo | Resultado |
|---|---|
| Base | `nomina_docente` |
| Usuario DB | `app_nomina` |
| Modo | `SELECT` read-only |

### 5.1 Esquema relevante

La tabla `teachers` contiene:

- `id`
- `coordination_id`
- `created_by`
- `updated_by`
- campos operativos/fiscales del docente

No se encontro columna `captured_by` ni un campo tecnico alternativo de
capturador en `teachers`.

### 5.2 Muestra agregada por coordinadora

No se listaron docentes ni datos sensibles. Se usaron agregados por usuario.

| Coordinadora | Rol | Status | Coordinaciones asignadas | Docentes en sus coordinaciones | Docentes en esas coordinaciones creados por ella | Docentes en esas coordinaciones NO creados por ella | Docentes creados por ella | Docentes actualizados por ella |
|---|---|---|---:|---:|---:|---:|---:|---:|
| `eslivet.aguilar@tecplayacar.edu.mx` | `coordinador` | `ACTIVO` | 1 | 39 | 0 | 39 | 0 | 0 |
| `merit.bazan@tecplayacar.edu.mx` | `coordinador` | `ACTIVO` | 1 | 8 | 0 | 8 | 0 | 0 |
| `zulma.martinez@tecplayacar.edu.mx` | `coordinador` | `ACTIVO` | 1 | 30 | 0 | 30 | 0 | 0 |

Agregado global de Directorio:

| Metrica | Valor |
|---|---:|
| Docentes totales | 212 |
| Docentes sin `created_by` | 209 |
| Docentes creados por las coordinadoras revisadas | 0 |

Distribucion de `created_by`:

| `created_by` | Docentes |
|---|---:|
| `NULL` | 209 |
| `victor.yama@tecplayacar.edu.mx` | 3 |

Distribucion de `updated_by`:

| `updated_by` | Docentes |
|---|---:|
| `victor.yama@tecplayacar.edu.mx` | 212 |

## 6. Respuestas del diagnostico

### Que campo usa backend para autorizar edicion del coordinador

En el codigo desplegable/origin, backend usa `teachers.created_by` comparado
contra el `app_users.id` del actor autenticado.

### Que campo usa frontend para habilitar Editar

En el codigo desplegable/origin, frontend usa `Teacher.createdById` comparado
contra `authStore.session.id`.

### Que campo usa la UI para mostrar "capturado por"

En el contrato de Directorio existen `createdById`, `createdByEmail` y
`updatedByEmail`. No existe `capturedBy` para docentes. Si una pantalla o
exportable muestra una atribucion visual, debe confirmarse si proviene de
`createdByEmail`, `updatedByEmail` o `coordinationName`.

Con los datos actuales, `updatedByEmail` apunta masivamente a Admin y
`createdByEmail` es mayoritariamente nulo, por lo que no hay evidencia de que
exista una fuente tecnica confiable distinta de `created_by`.

### `teachers.created_by` apunta a Zulma/Eslivet/Merit

No. Para las tres coordinadoras revisadas, `teachers.created_by` no apunta a su
`app_users.id` en ningun docente.

### La carga masiva explica el problema

Si. La evidencia apunta a que la carga/migracion productiva dejo la mayoria de
docentes con `created_by = NULL` y `updated_by` con Admin. Como frontend y
backend usan `created_by` para autorizar, las coordinadoras quedan bloqueadas
aunque los docentes pertenezcan a su coordinacion operativa.

### Existe otro campo que conserve capturador operativo real

No se encontro en `teachers`. Solo existe `created_by` y `updated_by`. En otros
modulos existen campos de captura especificos, por ejemplo `extra_hours.captured_by`,
pero Directorio no tiene un `captured_by` separado.

### Hay docentes visualmente atribuidos pero `created_by` no coincide

La consulta agregada confirma que existen docentes dentro de las coordinaciones
de las coordinadoras revisadas, pero no fueron creados tecnicamente por ellas.
Si la UI los presenta como bajo su responsabilidad, esa atribucion proviene del
alcance operativo/coordinacion, no de `teachers.created_by`.

## 7. Causa raiz probable

La causa raiz es de datos, no de permiso fiscal ni de Firebase Auth:

1. La autorizacion correcta vigente usa `teachers.created_by`.
2. La migracion/carga oficial dejo `created_by` vacio para 209 de 212 docentes.
3. Las coordinadoras revisadas tienen docentes en sus coordinaciones, pero cero
   docentes con `created_by` igual a su usuario.
4. Por eso el boton Editar queda bloqueado y el backend tambien debe rechazar
   el `PATCH /teachers/:id`.

Esto corresponde al Caso B/C del planteamiento:

- Caso B si operacion decide que una fuente visual/coordinacion representa al
  capturador operativo.
- Caso C si no existe un campo tecnico confiable de capturador y se requiere
  normalizacion formal.

## 8. Riesgo

| Riesgo | Nivel | Comentario |
|---|---|---|
| Desplegar regla por coordinacion | Alto | Permitiria editar docentes no capturados por el actor, contrario a decision humana actual. |
| Normalizar `created_by` sin trazabilidad | Alto | Cambiaria propiedad historica de registros productivos sin plan formal. |
| Mantener datos como estan | Medio | Coordinadoras no podran editar docentes cargados masivamente aunque sean responsables operativas. |
| Usar `updated_by` como capturador | Alto | En produccion todos los docentes aparecen actualizados por Admin, no representa autoria original. |

## 9. Recomendacion

No cambiar a ciegas la regla funcional por coordinacion.

Recomendacion antes de entrega:

1. Mantener revertido el commit local `086abe5`.
2. Definir si `teachers.created_by` debe normalizarse como capturador operativo
   real para docentes cargados masivamente.
3. Si se decide normalizar datos, preparar un plan formal separado:
   - backup productivo;
   - queries read-only de propuesta;
   - mapping aprobado por usuario/coordinadora;
   - ejecucion via H05 o procedimiento DBA controlado;
   - auditoria antes/despues;
   - sin tocar campos fiscales.
4. Si no se puede reconstruir capturador real, no inventar autoria. En ese caso
   se requiere una decision humana nueva: mantener bloqueo por `created_by`, o
   introducir un campo/relacion explicita de responsabilidad operativa futura.
5. Si se implementa correccion de codigo, debe preservar que:
   - Coordinador edita solo docentes con `created_by` igual a su usuario;
   - Coordinador no edita fiscal;
   - Admin conserva alcance global;
   - datos cargados con `created_by = NULL` siguen bloqueados hasta
     normalizacion o decision explicita.

## 10. Plan seguro de correccion

### Ruta recomendada: datos + proteccion actual

1. Mantener la hipotesis local `086abe5` revertida.
2. Mantener frontend/backend autorizando por `created_by`.
3. Preparar diagnostico de docentes con `created_by IS NULL` por coordinacion.
4. Solicitar a operacion una decision de asignacion de capturador por docente o
   por lote.
5. Ejecutar normalizacion solo si hay aprobacion y backup.
6. Documentar resultado y validar con coordinadoras reales.

### Ruta alternativa: cambio funcional futuro

Si operacion decide que "responsable operativo" no equivale a capturador
historico, se debe abrir SPEC nueva. Ese cambio no corresponde a este
diagnostico porque alteraria la regla aprobada.

## 11. Confirmaciones

- No se ejecuto `UPDATE`.
- No se ejecuto `DELETE`.
- No se ejecuto `INSERT`.
- No se ejecutaron migraciones.
- No se modifico produccion.
- No se hizo deploy.
- No se tocaron nomina, finanzas, CSV, cierre de ciclo ni datos fiscales.
- No se cambiaron permisos.
- No se cambio codigo funcional en este diagnostico.

## 12. Estado posterior

H17 queda en estado:

- diagnostico completado;
- correccion por codigo basada en coordinacion descartada;
- regla por `created_by` restaurada;
- normalizacion de `teachers.created_by` pendiente de aprobacion mediante
  `docs/auditoria/H17_Plan_Normalizacion_CreatedBy_Directorio.md`.
