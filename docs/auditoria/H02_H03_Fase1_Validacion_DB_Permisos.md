# H02/H03 Fase 1 - Validacion DB y Permisos

## 1. Que se implemento

La Fase 1 prepara la base de datos, permisos y validaciones para H02/H03 sin activar todavia el nuevo comportamiento funcional.

Se implemento:

- migracion para crear `user_coordinations`;
- seed idempotente de permisos nuevos;
- seed inicial por rol para permisos nuevos o existentes requeridos;
- archivo SQL de validacion de solo lectura;
- documentacion de validacion y cierre de fase.

Esta fase no migra relaciones usuario-coordinacion productivas. La carga de asignaciones queda condicionada a validar usuarios y catalogo real.

## 2. Migracion creada

Archivo:

- `database/011_h02_h03_user_coordinations_permissions.sql`

La migracion crea:

```sql
user_coordinations
```

Columnas:

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
coordination_id uuid NOT NULL REFERENCES coordinations(id) ON DELETE RESTRICT,
is_primary boolean NOT NULL DEFAULT false,
created_at timestamptz NOT NULL DEFAULT now(),
created_by_user_id uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
updated_at timestamptz NULL,
updated_by_user_id uuid NULL REFERENCES app_users(id) ON DELETE SET NULL
```

Restriccion:

```sql
UNIQUE (user_id, coordination_id)
```

Indices:

```sql
idx_user_coordinations_user_id
idx_user_coordinations_coordination_id
idx_user_coordinations_one_primary_per_user
```

La migracion es idempotente en el estilo actual del proyecto: usa `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` e `INSERT ... ON CONFLICT`.

## 3. Permisos agregados

Se preparan estos permisos:

| Permiso | Descripcion |
|---|---|
| `fiscal.view` | Ver expediente fiscal |
| `fiscal.document.view` | Ver o descargar constancias fiscales |
| `fiscal.document.manage` | Subir o reemplazar constancias fiscales |
| `finance.export` | Exportar reportes financieros |
| `finance.workflow` | Aprobar, marcar pagada, cancelar y cambiar estados financieros |
| `payroll.preview` | Ver calculo vivo de nomina sin guardar |

No se eliminan ni se modifican destructivamente permisos existentes:

- `finance.view`
- `fiscal.manage`
- `reports.view`
- `teachers.manage`
- `payroll.view`
- `payroll.calculate`
- `payroll.finalize`

## 4. Seeds por rol

La migracion deja preparados estos seeds:

| Rol | Permisos asignados/preparados |
|---|---|
| `admin` | `fiscal.view`, `fiscal.document.view`, `fiscal.document.manage`, `finance.export`, `finance.workflow`, `payroll.preview` |
| `rh` | `fiscal.view`, `fiscal.manage`, `fiscal.document.view`, `fiscal.document.manage` |
| `finanzas` | `fiscal.view`, `fiscal.manage`, `fiscal.document.view`, `fiscal.document.manage`, `finance.view`, `finance.export`, `finance.workflow`, `payroll.view`, `payroll.preview` |
| `contador` | `finance.export` |
| `contabilidad` | `finance.export` |
| `coordinador` | `payroll.preview` |
| `direccion` | `payroll.preview` |

Notas:

- `coordinador` no recibe permisos fiscales, documentales, `finance.export`, `finance.workflow` ni `payroll.finalize`.
- `direccion` no recibe `fiscal.manage`, `fiscal.document.manage`, `finance.workflow` ni `payroll.finalize`.
- No se crea rol tecnico `subdireccion`; Subdireccion usa `direccion`.
- Contabilidad se mantiene equivalente a Contador en el alcance de exportacion.

## 5. Consultas de validacion

Archivo:

- `database/validation/h02_h03_phase1_validation.sql`

El SQL de validacion revisa:

1. Usuarios actuales.
2. Roles actuales.
3. Permisos actuales por rol.
4. Coordinaciones existentes.
5. Coordinaciones duplicadas por `lower(name)`.
6. Coordinaciones de asignacion inicial que no existen en catalogo.
7. Coordinadores sin coordinacion formal.
8. Extras sin `captured_by`.
9. Horarios sin `created_by`.
10. Existencia de `user_coordinations`.
11. Permisos nuevos creados.
12. Permisos nuevos asignados por rol.
13. Que no exista coordinacion llamada `"Todas / Global"`.
14. Que no exista coordinacion llamada `"No requiere coordinacion operativa"`.
15. Usuarios de la tabla operativa contra `app_users.email`.
16. Que no exista rol tecnico `subdireccion`.
17. Que `contabilidad` tenga tratamiento equivalente a `contador`.

## 6. Plantilla normalizada para asignaciones

Formato objetivo:

```text
email,rol_tecnico,coordination_name,scope_type,requiere_revision,observaciones
```

Valores validos para `scope_type`:

- `global`
- `coordination`
- `no_operational_coordination`

Reglas aplicadas:

- `"Todas / Global"` es alcance global por rol, no una coordinacion.
- `"No requiere coordinacion operativa"` no se inserta como coordinacion.
- Coordinaciones separadas por coma se normalizan a una fila por coordinacion.
- Cada `coordination_name` debe validarse contra `coordinations.name`.
- Si una coordinacion no existe, se marca para revision.
- No se crean coordinaciones automaticamente.
- No se insertan filas invalidas.
- Coordinadores requieren al menos una fila valida en `user_coordinations` antes de activar modo estricto.
- Admin global no requiere `user_coordinations`.
- Direccion global no requiere `user_coordinations` para reportes globales.
- Finanzas no requiere coordinacion operativa.
- RH no requiere coordinacion operativa salvo decision futura.

## 7. Que NO se activo todavia

No se activo:

- modo estricto;
- uso funcional de `user_coordinations`;
- retiro de fallback legacy;
- migracion de asignaciones usuario-coordinacion;
- cambios de rutas operativas;
- cambios funcionales de frontend;
- cambios de Auth/context;
- cambios de Horarios;
- cambios de Incidencias;
- cambios de Extras;
- cambios de Teachers;
- cambios de Payroll;
- cambios de Reports;
- cambios de calendario;
- cambios de Apps Script legacy;
- cambios en formula de nomina;
- cambios en H01.

No se hizo deploy.

No se ejecutaron migraciones contra produccion.

No se eliminaron permisos existentes.

No se eliminaron columnas existentes.

## 8. Riesgos pendientes

- La tabla `user_coordinations` existe pero no se usa funcionalmente hasta Fase 2.
- Los permisos nuevos quedan preparados, pero las rutas todavia usan permisos actuales.
- Los nombres de coordinacion pueden diferir del catalogo real por acentos, abreviaturas o mayusculas.
- Puede haber horarios sin `created_by` o extras sin `captured_by`; eso debe revisarse antes de activar reglas de propiedad.
- `contabilidad` debe mantenerse equivalente a `contador` cuando se apliquen permisos nuevos.
- Si se aplica la migracion en produccion antes de actualizar rutas, los permisos nuevos no deberian cambiar comportamiento porque todavia no son consumidos por codigo funcional.

## 9. Como validar en ambiente de revision

1. Confirmar que el ambiente no es produccion.
2. Respaldar base de datos o trabajar sobre copia controlada.
3. Aplicar `database/011_h02_h03_user_coordinations_permissions.sql`.
4. Ejecutar `database/validation/h02_h03_phase1_validation.sql`.
5. Revisar usuarios faltantes o con rol diferente.
6. Revisar coordinaciones inexistentes o duplicadas.
7. Confirmar que no existe rol `subdireccion`.
8. Confirmar que no existen coordinaciones reservadas como catalogo real.
9. Revisar extras sin `captured_by`.
10. Revisar horarios sin `created_by`.
11. Confirmar que `contador` y `contabilidad` tienen tratamiento equivalente.

## 10. Proximo paso

El siguiente paso es Fase 2: `Auth/context multi-coordinacion`.

Antes de iniciar Fase 2:

- Admin debe revisar el resultado de validaciones.
- Deben resolverse diferencias de catalogo.
- Deben revisarse usuarios sin relacion formal.
- Debe confirmarse que no se aplicara modo estricto hasta que backend/frontend soporten `user_coordinations`.

## 11. Rollback

Si la migracion no fue aplicada:

1. Revertir el commit de Fase 1.

Si la migracion fue aplicada en ambiente de revision:

1. Confirmar que no existan datos operativos en `user_coordinations`.
2. Remover asignaciones de `role_permissions` de permisos nuevos.
3. Remover permisos nuevos si no fueron usados por otra fase.
4. Eliminar `user_coordinations` solo si no contiene relaciones operativas.

No se requiere restaurar datos de nomina porque esta fase no modifica datos operativos.
