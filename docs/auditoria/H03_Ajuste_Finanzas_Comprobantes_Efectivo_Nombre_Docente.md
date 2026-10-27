# H03 - Ajuste de Finanzas: comprobantes de efectivo y nombre docente

Fecha: 2026-10-27

## 1. Objetivo

Corregir dos comportamientos de presentacion del modulo Finanzas sin modificar
el calculo de Nomina ni sus reglas operativas:

1. Generar un solo comprobante de efectivo por docente y quincena.
2. Mostrar el nombre del docente a los roles autorizados para consultar
   Finanzas, manteniendo separados los datos fiscales.

## 2. Comprobante de efectivo consolidado

El PDF anterior se generaba directamente desde cada linea de `payroll_lines`.
Un docente con carga en varias coordinaciones producia un comprobante por cada
linea.

El ajuste agrupa exclusivamente las lineas con `payment_type_snapshot = 'E'`
por `teacher_id` y suma sus `total_amount`. Por ello, el importe consolidado ya
incluye el total guardado de cada linea, incluidos los extras correspondientes,
sin recalcular componentes de Nomina.

El comprobante resultante:

- se genera una sola vez por docente y quincena;
- muestra el nombre del docente;
- muestra el monto total consolidado;
- conserva fecha de emision y firma de conformidad;
- elimina el campo Coordinacion porque deja de representar el alcance total del
  pago consolidado.

## 3. Nombre docente y permisos

La vista ocultaba por error la celda del nombre cuando el usuario no tenia
permiso fiscal, mientras la celda de RFC permanecia visible. La correccion
separa ambas responsabilidades:

- el nombre docente se muestra siempre dentro del alcance financiero autorizado;
- RFC, correo fiscal, datos bancarios y constancias siguen condicionados a
  permisos fiscales;
- Coordinador obtiene consulta financiera de solo lectura mediante su permiso
  vigente `payroll.preview`;
- Coordinador solo recibe lineas de sus coordinaciones activas en
  `actorCoordinations[]`;
- Coordinador no obtiene exportacion financiera, workflow, edicion, guardado ni
  datos fiscales;
- Admin, Direccion/Subdireccion, Finanzas, Contador y Contabilidad conservan su
  alcance previo y ahora ven correctamente el nombre docente.

Las corridas sin lineas dentro del alcance del Coordinador no se muestran.

## 4. Archivos tecnicos

- `apps/api/src/lib/cash-receipts.ts`
- `apps/api/src/routes/reports.ts`
- `apps/web/src/stores/auth.ts`
- `apps/web/src/views/FinanceReportsView.vue`
- pruebas API, frontend y del helper de consolidacion.

## 5. Controles de regresion

Las pruebas cubren:

- consolidacion de varias lineas de efectivo del mismo docente;
- exclusion defensiva de pagos no efectivos;
- consulta financiera de Coordinador limitada a su coordinacion;
- ausencia de RFC, correo y banco para Coordinador;
- visibilidad del nombre para Coordinador, Direccion, Finanzas y Contador;
- permanencia de permisos de exportacion y workflow.

Validaciones ejecutadas:

- API unitarias: 44/44.
- Web: 98/98.
- Integracion PostgreSQL: 131/131 sobre `nomina_docente_test` en
  `127.0.0.1:5432`.
- Typecheck API/Web: OK.
- Build API/Web: OK.
- `git diff --check`: OK.

Validacion manual comunicada por el usuario:

- smoke funcional satisfactorio;
- comprobante de efectivo consolidado sin incidencias visibles;
- nombre docente visible conforme al alcance autorizado;
- sin regresiones operativas reportadas en el modulo Finanzas.

Esta evidencia corresponde a la revision previa al commit. En esta fase no se
realizo deploy ni se modifico produccion.

## 6. Confirmaciones

- No se modifica H01.
- No se modifica `calculatePayroll()`.
- No se modifica ninguna formula monetaria.
- No se modifican snapshots ni corridas historicas.
- No se modifica la base de datos.
- No se crean migraciones.
- No se ejecuta deploy en esta fase.
- No se amplian permisos fiscales.
