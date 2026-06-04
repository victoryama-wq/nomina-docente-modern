# H17 - Plan de normalizacion `created_by` en Directorio

Fecha: 2026-06-04

## 1. Contexto

El diagnostico H17 confirmo que los docentes cargados masivamente en Directorio
quedaron mayoritariamente con `teachers.created_by = NULL`.

El sistema usa `teachers.created_by` como fuente tecnica de "capturador" para
autorizar edicion operativa de docentes por coordinador/coordinadora. No existe
`teachers.captured_by`.

La regla funcional vigente es:

- Coordinador/coordinadora solo edita docentes capturados por el/ella.
- No basta con estar en la coordinacion.
- Coordinador/coordinadora no puede editar datos fiscales.

Por tanto, no se debe resolver H17 cambiando la autorizacion a
`coordination_id`. La correccion segura es normalizar `created_by` solo cuando
exista un mapping aprobado de capturador operativo.

## 2. Objetivo

Asignar `teachers.created_by` a los usuarios coordinadores correctos solo para
docentes cargados masivamente y solo cuando exista mapping aprobado por
operacion/administracion.

Este plan no ejecuta cambios de datos. Queda preparado para una ventana
posterior con backup, aprobacion y validacion.

## 3. Riesgos

| Riesgo | Impacto | Control |
|---|---|---|
| Asignar capturador incorrecto | Permite edicion indebida de Directorio | Mapping aprobado antes de cualquier `UPDATE` |
| Cambiar propiedad historica sin trazabilidad | Debilita auditoria de origen | Registrar antes/despues y conservar documento de aprobacion |
| Usar coordinacion como sustituto de capturador | Rompe la regla funcional vigente | No ejecutar updates sin validar caso por caso o por lote aprobado |
| Tocar campos fiscales por error | Riesgo H03 | Limitar SQL a `teachers.created_by` |
| Afectar nomina/snapshots | Riesgo operativo | No tocar payroll, lines, snapshots ni importes |

## 4. Reglas de normalizacion

1. Actualizar solo docentes con `created_by IS NULL`.
2. No tocar docentes que ya tienen `created_by`.
3. No tocar campos fiscales.
4. No tocar `updated_by`, salvo decision explicita separada.
5. No tocar nomina, snapshots, corridas, lineas ni importes.
6. No cambiar `coordination_id`.
7. No borrar ni crear docentes.
8. Registrar conteo antes/despues por coordinacion y usuario.
9. Ejecutar solo con backup Cloud SQL exitoso y aprobacion humana.
10. Si una coordinacion tiene mas de un coordinador activo, detener esa
    coordinacion y pedir decision humana.

## 5. Mapping requerido

El mapping debe aprobarse antes de cualquier escritura.

| coordination_name | coordinator_email | user_id | docentes_afectados | aprobado |
|---|---|---|---:|---|
| Zulma Martinez Duque | `zulma.martinez@tecplayacar.edu.mx` | Pendiente SELECT | 30 segun diagnostico H17 | Pendiente |
| Eslivet Aguilar Santos | `eslivet.aguilar@tecplayacar.edu.mx` | Pendiente SELECT | 39 segun diagnostico H17 | Pendiente |
| Merit Berenice Bazan Garcia | `merit.bazan@tecplayacar.edu.mx` | Pendiente SELECT | 8 segun diagnostico H17 | Pendiente |
| Otras coordinaciones | Pendiente | Pendiente | Pendiente | Pendiente |

Nota: los nombres de coordinacion deben validarse contra `coordinations.name`
en produccion antes de aprobar el mapping final.

## 6. SQL read-only de propuesta

Este SELECT genera candidatos para revisar. No modifica datos.

```sql
SELECT
  c.name AS coordination_name,
  u.email AS coordinator_email,
  u.id AS coordinator_user_id,
  count(t.id) AS teachers_to_assign
FROM teachers t
JOIN coordinations c ON c.id = t.coordination_id
JOIN user_coordinations uc ON uc.coordination_id = c.id
JOIN app_users u ON u.id = uc.user_id
JOIN roles r ON r.id = u.role_id
WHERE t.created_by IS NULL
  AND u.status = 'ACTIVO'
  AND r.code = 'coordinador'
GROUP BY c.name, u.email, u.id
ORDER BY c.name, u.email;
```

Consulta para detectar coordinaciones con mas de un coordinador activo:

```sql
SELECT
  c.id AS coordination_id,
  c.name AS coordination_name,
  count(DISTINCT u.id) AS active_coordinators,
  string_agg(u.email, ', ' ORDER BY u.email) AS coordinator_emails,
  count(DISTINCT t.id) FILTER (WHERE t.created_by IS NULL) AS teachers_without_created_by
FROM coordinations c
JOIN user_coordinations uc ON uc.coordination_id = c.id
JOIN app_users u ON u.id = uc.user_id
JOIN roles r ON r.id = u.role_id
LEFT JOIN teachers t ON t.coordination_id = c.id
WHERE u.status = 'ACTIVO'
  AND r.code = 'coordinador'
GROUP BY c.id, c.name
HAVING count(DISTINCT u.id) > 1
ORDER BY c.name;
```

## 7. SQL UPDATE propuesto, NO ejecutar

El siguiente SQL es solo plantilla. No debe ejecutarse sin backup y aprobacion.

```sql
-- NO EJECUTAR SIN BACKUP Y APROBACION
UPDATE teachers t
SET created_by = :coordinator_user_id
WHERE t.created_by IS NULL
  AND t.coordination_id = :coordination_id;
```

Version con conteo previo dentro de transaccion controlada:

```sql
-- NO EJECUTAR SIN BACKUP Y APROBACION
BEGIN;

SELECT count(*) AS teachers_to_update
FROM teachers
WHERE created_by IS NULL
  AND coordination_id = :coordination_id;

UPDATE teachers
SET created_by = :coordinator_user_id
WHERE created_by IS NULL
  AND coordination_id = :coordination_id;

SELECT count(*) AS teachers_remaining_without_created_by
FROM teachers
WHERE created_by IS NULL
  AND coordination_id = :coordination_id;

-- COMMIT solo con aprobacion en ventana controlada.
-- ROLLBACK si el conteo no coincide con el mapping aprobado.
ROLLBACK;
```

## 8. Validacion posterior esperada

Despues de una normalizacion aprobada:

- Zulma puede editar docentes cuyo `created_by` sea su `app_users.id`.
- Eslivet puede editar docentes cuyo `created_by` sea su `app_users.id`.
- Merit puede editar docentes cuyo `created_by` sea su `app_users.id`.
- No pueden editar datos fiscales.
- No pueden editar docentes de otros capturadores.
- Admin conserva edicion global.
- `teachers.created_by IS NULL` disminuye solo por los docentes aprobados.
- `updated_by` no cambia, salvo decision separada.

Validacion read-only sugerida:

```sql
SELECT
  u.email,
  count(t.id) AS teachers_created_by_user
FROM app_users u
LEFT JOIN teachers t ON t.created_by = u.id
WHERE lower(u.email) IN (
  'zulma.martinez@tecplayacar.edu.mx',
  'eslivet.aguilar@tecplayacar.edu.mx',
  'merit.bazan@tecplayacar.edu.mx'
)
GROUP BY u.email
ORDER BY u.email;
```

## 9. Procedimiento productivo futuro

1. Crear backup Cloud SQL.
2. Ejecutar preview read-only y generar mapping final.
3. Obtener aprobacion humana del mapping.
4. Ejecutar `UPDATE` controlado solo para coordinaciones aprobadas.
5. Validar conteos antes/despues.
6. Validar con usuarios coordinadores reales.
7. Documentar resultado.
8. No hacer deploy si solo se normalizan datos.

## 10. Estado

Plan preparado.

Sin ejecucion.

Pendiente aprobacion humana.

## 11. Mapping read-only preparado

Se creo el documento:

- `docs/auditoria/H17_Mapping_Normalizacion_CreatedBy_Directorio.md`

Resultado del mapping read-only:

- Total pendiente: 209 docentes con `created_by IS NULL`.
- 138 docentes quedan en grupos `APROBABLE_1A1`.
- 36 docentes quedan en decision aprobada `APROBADO_MARICARMEN_A_MERIT`.
- 10 docentes quedan en coordinaciones compartidas que requieren decision.
- 20 docentes quedan en coordinaciones sin coordinador activo exacto.
- 5 docentes no tienen coordinacion y requieren analisis previo.

El caso Maricarmen -> Merit queda documentado como excepcion funcional y requiere
aprobacion explicita antes de cualquier escritura.

## 12. Validacion CSV aprobada

Se creo el documento:

- `docs/auditoria/H17_Validacion_CSV_CreatedBy_Directorio.md`

Resultado de la validacion con el CSV aprobado por el usuario:

- 213 filas validas.
- 14 valores unicos en columna `COORDINADOR`.
- 204 docentes con match exacto en `teachers`.
- 9 docentes sin match.
- 197 updates propuestos para `teachers.created_by`.
- 3 docentes omitidos porque ya tenian `created_by`.
- 4 filas omitidas por coordinador sin match.
- SQL generado en `database/validation/h17_created_by_from_csv_APPROVAL_REQUIRED.sql`.
- El SQL queda en `ROLLBACK` por defecto y no fue ejecutado.

La decision Maricarmen -> Merit queda reflejada por el CSV aprobado: Maricarmen
no aparece como capturador en columna `COORDINADOR`; los registros aplicables
quedan bajo `merit.bazan@tecplayacar.edu.mx`.

Decisiones humanas adicionales aplicadas en el mapping:

- `Elsa Garcia Vallejo` y `Elsa García Vallejo` se asignan a
  `elsa.garcia@tecplayacar.edu.mx`, aunque el usuario tenga rol `direccion`.
- `Mario Medina` y `Mario Manuel Medina Aké` se asignan a
  `mario.medina@tecplayacar.edu.mx`.
- El SQL fue regenerado con 197 filas en la tabla temporal y sigue terminando
  en `ROLLBACK`.

Confirmaciones:

- No se ejecuto `UPDATE`.
- No se ejecuto `DELETE`.
- No se ejecuto `INSERT`.
- No se modifico produccion.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se tocaron datos fiscales, nomina, finanzas, CSV ni cierre de ciclo.
