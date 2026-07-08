# H18-F1 - Backend Reportes Operativos

Fecha: 2026-07-08

## 1. Resumen

Se implemento la primera fase backend del modulo `Reportes Operativos` sin frontend y sin deploy.

La fase agrega endpoints de consulta y exportacion para:

- `Horas base y extras`.
- `Horas base por categoria`.

La implementacion es de solo lectura sobre datos existentes y no modifica formula de nomina H01, datos fiscales, finanzas, nomina, permisos productivos, roles, migraciones ni base de datos.

## 2. Dependencia instalada

Se instalo `exceljs` exclusivamente en el workspace backend/API:

```text
npm install exceljs --workspace apps/api
```

Archivos afectados:

- `apps/api/package.json`
- `package-lock.json`

No se instalo `xlsx`.
No se instalo dependencia XLSX en frontend.

Observacion: `npm install` reporto vulnerabilidades npm existentes/transitivas. No se aplico `npm audit fix` en esta fase porque el alcance era funcional H18-F1 y cualquier correccion de dependencias debe tratarse en commit separado.

## 3. Endpoints implementados

Se agregaron rutas bajo `reports/operational`:

| Endpoint | Resultado | Descripcion |
|---|---|---|
| `GET /reports/operational/base-extra` | JSON | Reporte de horas base y extras por ciclo/quincena/docente. |
| `GET /reports/operational/base-extra/export` | CSV/XLSX | Exporta el reporte de horas base y extras. |
| `GET /reports/operational/category-hours` | JSON | Reporte de horas base asignadas por categoria contra horas oficiales del ciclo. |
| `GET /reports/operational/category-hours/export` | CSV/XLSX | Exporta el reporte de horas base por categoria. |

La ruta se implemento en:

- `apps/api/src/routes/operational-reports.ts`

Y se registro desde:

- `apps/api/src/routes.ts`

## 4. Guardas por rol

### Horas base y extras

Permitidos:

- `admin`
- `direccion`

Denegados:

- `coordinador`
- `rh`
- `finanzas`
- `contador`
- `contabilidad`
- otros roles no autorizados

### Horas base por categoria

Permitidos:

- `admin`
- `direccion`
- `coordinador`
- `rh`

Denegados:

- `finanzas`
- `contador`
- `contabilidad`
- otros roles no autorizados

Para `coordinador`, la pestaña de horas por categoria queda limitada a `actorCoordinations[]`. Si el coordinador solicita una coordinacion fuera de su alcance, backend responde 403.

No se uso `finance.view`.
No se uso `reports.view`.
No se crearon permisos nuevos.
No se creo migracion H05.

## 5. Fuentes de datos

### Horas base y extras

Modo `source=auto`:

- Si existe corrida de nomina no cancelada para `calendarConfigId`, se usa snapshot.
- Si no existe corrida guardada, se usan datos vivos.

Modo `source=live`:

- `schedules`
- `schedule_incidences`
- `extra_hours`
- `teachers`
- `coordinations`
- `app_users`

Modo `source=snapshot`:

- `payroll_runs`
- `payroll_lines`
- `payroll_extra_details`

Limitacion documentada: los snapshots existentes no conservan capturador historico de extra externo ni responsable historico de incidencia. En ese caso el reporte snapshot devuelve esas columnas como nulas y conserva el origen `snapshot`.

### Horas base por categoria

Usa datos vivos de:

- `schedules`
- `teachers`
- `coordinations`
- `academic_cycles`

No usa calendario de nomina.
No usa snapshots.

## 6. Reglas de calculo

Horas oficiales H18:

| Categoria | Etiqueta | Horas esperadas |
|---|---|---:|
| `V` | VIP | 35 |
| `M` | Medio tiempo | 25 |
| `N` | Nuevo ingreso | 15 |

Calculo por docente/ciclo:

```text
hours_lv = SUM(hours_l + hours_m + hours_x + hours_j + hours_v)
hours_module_1 = hours_lv + SUM(hours_s1)
hours_module_2 = hours_lv + SUM(hours_s2)
assigned_hours = GREATEST(hours_lv, hours_module_1, hours_module_2)
remaining_hours = expected_hours - assigned_hours
```

Estados:

- `completo`: asignadas = esperadas.
- `faltante`: asignadas < esperadas.
- `excedido`: asignadas > esperadas.

La base de datos vigente restringe categorias de docentes a valores validos, por lo que no se agregaron categorias nuevas.

## 7. Export CSV

CSV usa el helper H11:

- BOM UTF-8.
- CRLF.
- `Content-Type: text/csv; charset=utf-8`.
- `Content-Disposition` estable.

No se tocaron exportables CSV existentes.

## 8. Export XLSX

XLSX se genera server-side desde API con `exceljs`.

Helper agregado:

- `apps/api/src/lib/xlsx.ts`

Caracteristicas:

- workbook server-side;
- hoja con encabezados en español;
- primera fila congelada;
- anchos de columna razonables;
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
- `Content-Disposition` estable.

Nombres usados:

- `reporte-horas-base-extras-<periodo>.xlsx`
- `reporte-horas-base-categoria-<ciclo>.xlsx`

## 9. Pruebas ejecutadas

Prueba granular H18:

```text
npm --workspace apps/api run test:integration -- api-h18-operational-reports.integration.test.ts
```

Resultado:

- 7 tests pasados.

Cobertura:

- permisos de `base-extra`;
- permisos de `category-hours`;
- alcance de coordinador por `actorCoordinations[]`;
- `cycleId` requerido;
- categorias `V`, `M`, `N`;
- estados `completo`, `faltante`, `excedido`;
- `GREATEST` entre horas L-V, modulo 1 y modulo 2;
- CSV con BOM/CRLF;
- XLSX legible por `exceljs`;
- ausencia de encabezados/datos fiscales en exportables.

## 10. Confirmaciones

- No se hizo deploy.
- No se ejecutaron migraciones.
- No se creo migracion.
- No se modifico base de datos productiva.
- No se toco produccion.
- No se modifico formula H01.
- No se modifico Finanzas/Nomina.
- No se tocaron datos fiscales.
- No se instalaron dependencias frontend.
- No se uso Firebase real en pruebas.

## 11. Pendientes

- H18-F2 frontend: vista `Reportes`, pestañas, filtros, tablas y descarga.
- Validacion manual CSV/XLSX en Excel/Sheets si se requiere antes de deploy.
- Decidir en fase futura si se crean permisos formales bajo H05; H18-F1 usa guardas por rol para evitar migracion.
- Revisar auditoria npm de dependencias transitivas antes de deploy productivo.
