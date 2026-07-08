# H18-F2 - Frontend Reportes Operativos

Fecha: 2026-07-08

## 1. Resumen

Se implemento el frontend del modulo `Reportes Operativos` para consumir los endpoints backend H18-F1.

La fase agrega una vista de consulta y descarga para:

- `Horas base y extras`.
- `Horas base por categoria`.

La implementacion es frontend, sin deploy, sin migraciones, sin cambios de base de datos, sin backend funcional adicional y sin cambios a formula de nomina H01.

## 2. Vista y ruta

Se creo:

- `apps/web/src/views/ReportsView.vue`

Se agrego ruta protegida:

- `/reports`

Se agrego entrada de menu:

- `Reportes`

El menu solo se muestra si el usuario tiene al menos una pestana disponible.

## 3. Pestanas implementadas

### Horas base y extras

Visible solo para:

- `admin`
- `direccion`

Oculta para:

- `coordinador`
- `rh`
- `finanzas`
- `contador`
- `contabilidad`
- otros roles no autorizados

Columnas visibles:

- Origen.
- Ciclo.
- Periodo.
- Docente.
- Categoria.
- Coordinacion.
- Horas base.
- Extras incidencia.
- Extras externos.
- Total extras.
- Capturador extra externo.
- Responsable incidencia.
- Motivo / referencia.
- Fecha actividad.

La columna de responsable de incidencia conserva la nota `updated_by registrado`.

### Horas base por categoria

Visible para:

- `admin`
- `direccion`
- `coordinador`
- `rh`

Oculta para:

- `finanzas`
- `contador`
- `contabilidad`
- otros roles no autorizados

Columnas visibles:

- Ciclo.
- Docente.
- Categoria.
- Horas esperadas.
- Horas asignadas.
- Horas restantes.
- Estado.
- Horas L-V.
- Horas modulo 1.
- Horas modulo 2.
- Coordinacion.

`cycleId` es obligatorio para consultar y exportar esta pestana.

## 4. Filtros implementados

### Horas base y extras

- `cycleId`.
- `calendarConfigId`.
- `teacherId`.
- `coordinationId`.
- `category`.
- `capturedBy`.
- `dateFrom`.
- `dateTo`.
- `type`.
- `source`.

### Horas base por categoria

- `cycleId`.
- `coordinationId`.
- `teacherId`.
- `category`.
- `status`.
- `teacherStatus`.

Los filtros usan entradas directas de ID cuando no existe catalogo frontend reutilizable. Esto conserva el alcance de H18-F2 sin crear endpoints nuevos.

## 5. Descargas CSV/XLSX

Se agregaron funciones frontend en `apps/web/src/api.ts` para:

- `fetchOperationalBaseExtraReport`.
- `downloadOperationalBaseExtraReport`.
- `fetchOperationalCategoryHoursReport`.
- `downloadOperationalCategoryHoursReport`.

Las descargas:

- llaman al backend con `format=csv` o `format=xlsx`;
- respetan `Content-Disposition` cuando existe;
- descargan blob;
- no parsean XLSX en frontend;
- no construyen XLSX en frontend;
- no instalan dependencias frontend.

CSV sigue cubierto por H11 como respaldo y XLSX se genera server-side desde API con `exceljs`.

## 6. Permisos UI

Se agregaron helpers en `apps/web/src/stores/auth.ts`:

- `canViewOperationalBaseExtraReports`.
- `canViewOperationalCategoryHoursReports`.
- `canViewReportsModule`.

Reglas:

| Rol | Modulo | Horas base y extras | Horas base por categoria |
|---|---|---|---|
| Admin | Si | Si | Si |
| Direccion/Subdireccion | Si | Si | Si |
| Coordinador | Si | No | Si |
| RH | Si | No | Si |
| Finanzas | No | No | No |
| Contador | No | No | No |
| Contabilidad | No | No | No |

El backend sigue siendo autoridad. La UI solo oculta modulo/pestanas no autorizadas.

## 7. Pruebas ejecutadas

Se agregaron pruebas frontend para:

- Visibilidad del modulo por rol.
- Visibilidad de pestanas por rol.
- Acceso denegado a Finanzas, Contador y Contabilidad.
- Consulta de `Horas base y extras`.
- Descarga CSV/XLSX de `Horas base y extras`.
- Validacion de `cycleId` requerido en `Horas base por categoria`.
- Consulta de `Horas base por categoria`.
- Descarga CSV/XLSX de `Horas base por categoria`.
- Helpers de auth H18.
- Helper puro de visibilidad H18.

Archivos de prueba:

- `apps/web/src/views/ReportsView.test.ts`
- `apps/web/src/stores/auth.test.ts`
- `apps/web/src/test/permission-visibility.test.ts`
- `apps/web/src/test/permission-visibility.ts`

## 8. Pendientes

- Validacion manual/controlada de CSV/XLSX descargados desde UI.
- Deploy controlado H18-F5.
- Auditoria npm separada SEC-01 para vulnerabilidades transitivas detectadas despues de instalar `exceljs`.
- Evaluar en fase futura si se crean permisos formales H18 bajo H05.
- Evaluar si snapshots historicos deben conservar capturadores de extras externos/incidencias.

## 9. Confirmaciones

- No se ejecuto deploy.
- No se tocaron datos productivos.
- No se modifico base de datos.
- No se ejecutaron migraciones.
- No se instalaron dependencias.
- No se modifico backend funcional.
- No se cambio formula H01.
- No se modifico Finanzas/Nomina.
- No se expusieron datos fiscales.
- No se cambiaron roles ni permisos productivos mediante SQL.
