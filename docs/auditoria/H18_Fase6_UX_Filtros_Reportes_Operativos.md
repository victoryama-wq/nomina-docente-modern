# H18-F6 - UX de filtros en Reportes Operativos

Fecha: 2026-07-09

## 1. Problema detectado

Durante la validacion visual posterior al deploy H18-F5 se detecto que el modulo `Reportes` mostraba filtros tecnicos por ID:

- `Ciclo ID`.
- `Quincena ID`.
- `Docente ID`.
- `Coordinacion ID`.
- `Capturador ID`.

La operacion no conoce esos IDs, por lo que los filtros no eran usables para consulta diaria.

## 2. Objetivo de H18-F6

Reemplazar filtros visibles por IDs con filtros amigables basados en nombres, listas desplegables y busqueda general, conservando los IDs solo como valores internos enviados al backend.

No se cambiaron reglas de seguridad, permisos, formula H01, datos fiscales, base de datos ni migraciones.

## 3. Filtros eliminados visualmente

### Pestana 1 - Horas base y extras

Se retiraron de la UI:

- `Docente ID`.
- `Coordinacion ID`.
- `Capturador ID`.
- `Desde`.
- `Hasta`.
- `Origen`.

`Origen` deja de ser una decision del usuario. La UI envia `source=auto` y el backend resuelve:

- `Nomina guardada` cuando hay snapshot/corrida no cancelada para la quincena.
- `Datos vivos` cuando no hay snapshot aplicable.

La tabla conserva una columna informativa de origen de datos.

### Pestana 2 - Horas base por categoria

Se retiraron de la UI:

- `Ciclo ID`.
- `Coordinacion ID`.
- `Docente ID`.

La pestana 2 no solicita quincena porque su calculo sigue siendo por ciclo/cuatrimestre con datos vivos de Horarios.

## 4. Filtros nuevos

### Ciclo / cuatrimestre

Se agrega lista desplegable alimentada por:

```text
GET /reports/operational/filters/cycles
```

La UI muestra labels legibles con ciclo, codigo y estado. Internamente conserva `cycleId`.

### Quincena guardada

Se agrega lista desplegable dependiente del ciclo en pestana 1:

```text
GET /reports/operational/filters/payroll-periods?cycleId=...
```

Solo lista quincenas/corridas guardadas no canceladas.

Si no se selecciona quincena, la pestana 1 permite consulta viva del ciclo cuando el backend la soporta.

### Busqueda general

Se agrega parametro `q` a los endpoints existentes:

```text
GET /reports/operational/base-extra
GET /reports/operational/base-extra/export
GET /reports/operational/category-hours
GET /reports/operational/category-hours/export
```

Pestana 1 busca por:

- docente;
- coordinacion;
- capturador de extra externo;
- responsable de incidencia.

Pestana 2 busca por:

- docente;
- coordinacion.

El parametro `q` tambien se aplica a export CSV/XLSX para que el archivo descargado corresponda a lo que el usuario consulta.

## 5. Backend

Se agregaron endpoints read-only de filtros H18:

| Endpoint | Uso | Permisos |
|---|---|---|
| `GET /reports/operational/filters/cycles` | Cargar ciclos legibles para filtros. | Roles con acceso a alguna pestana H18. |
| `GET /reports/operational/filters/payroll-periods?cycleId=...` | Cargar quincenas guardadas no canceladas para pestana 1. | Admin/Direccion, igual que `base-extra`. |

Los endpoints devuelven solo IDs y labels necesarios. No exponen RFC, banco, `paymentType`, constancias ni datos fiscales.

Los endpoints existentes se mantienen compatibles y siguen aceptando IDs internos.

## 6. Frontend

Se actualizo `ReportsView.vue`:

- Carga ciclos al entrar al modulo.
- Preselecciona el ciclo activo si existe.
- Carga quincenas guardadas cuando cambia el ciclo en pestana 1.
- Muestra selectores y busqueda general en lugar de inputs de ID.
- Mantiene filtros de categoria, tipo, estado y estatus docente.
- Exporta CSV/XLSX con los mismos filtros aplicados.
- Mantiene visibilidad por rol.

## 7. Exportables

No se agregaron columnas tecnicas visibles.

Los exportables siguen mostrando:

- labels de ciclo;
- periodo/quincena;
- docente;
- categoria;
- coordinacion;
- horas;
- capturador/responsable cuando aplica.

No incluyen:

- `teacherId`;
- `cycleId`;
- `calendarConfigId`;
- `coordinationId`;
- `capturedBy`;
- RFC;
- banco;
- `paymentType`;
- constancias.

## 8. Pruebas

Se actualizaron/agregaron pruebas:

- Frontend: ausencia de filtros por ID visibles.
- Frontend: ciclos/quincenas como selectores.
- Frontend: busqueda general en ambas pestanas.
- Frontend: export CSV/XLSX usa filtros actuales.
- Backend: endpoints de filtros respetan permisos.
- Backend: `q` filtra resultados JSON.
- Backend: export CSV respeta `q`.
- Backend: no se exponen datos fiscales.

## 9. Confirmaciones

Confirmado:

- No se hizo deploy.
- No se ejecutaron migraciones.
- No se ejecuto `db:migrate`.
- No se modifico base de datos.
- No se ejecutaron seeds.
- No se tocaron datos productivos.
- No se instalaron dependencias.
- No se ejecuto `npm audit fix`.
- No se cambiaron roles.
- No se cambiaron permisos productivos por SQL.
- No se cambio formula H01.
- No se expusieron datos fiscales.

## 10. Pendiente

H18-F6 queda pendiente de deploy controlado posterior y smoke manual con sesion real/Excel institucional.
