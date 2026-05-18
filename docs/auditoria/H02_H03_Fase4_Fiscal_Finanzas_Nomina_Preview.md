# H02/H03 Fase 4 - Fiscal, Finanzas y Nomina Preview

## 1. Que se implemento

La Fase 4 separo en backend los permisos de consulta, preview, fiscal, documentos fiscales, exportacion financiera y workflow financiero.

Permisos objetivo aplicados:

- `payroll.preview`: calculo vivo de nomina sin guardar.
- `payroll.finalize`: guardado de corrida de nomina.
- `fiscal.view`: consulta de datos fiscales.
- `fiscal.manage`: edicion de RFC, correo, banco y tipo de pago.
- `fiscal.document.view`: descarga o vista de constancia fiscal.
- `fiscal.document.manage`: carga o reemplazo de constancia fiscal.
- `finance.view`: consulta financiera.
- `finance.export`: exportacion CSV/PDF financiera.
- `finance.workflow`: aprobar, marcar pagada, cancelar y cambiar estados financieros.

## 2. Cambios en `payroll.ts`

- `/payroll/context` ahora permite `payroll.view`, `payroll.preview` o compatibilidad temporal con `payroll.calculate`.
- `/payroll/preview` ahora requiere `payroll.preview` o compatibilidad temporal con `payroll.calculate`.
- `/payroll/runs` conserva `payroll.finalize` para guardar nomina.
- `/payroll/runs/:id` conserva consulta y permite `payroll.preview` para lectura relacionada con preview.
- `/payroll/runs/:id/export/:kind` ahora requiere `payroll.finalize` o `finance.export`.
- El calculo vivo usa `loadActorScope` y filtra por todas las coordinaciones del actor cuando no tiene alcance global.
- Las consultas de lineas, horarios y extras guardados soportan lista de coordinaciones mediante `ANY($n::uuid[])`.

No se modifico formula de nomina ni reglas de precision monetaria H01.

## 3. Cambios en `reports.ts`

- `finance.view` queda para consulta financiera.
- `finance.export` controla PDFs y CSV financieros.
- `finance.workflow` controla cambios de estado: enviar a revision, aprobar, marcar pagada y cancelar.
- `finance.view` ya no habilita workflow financiero.
- `payroll.finalize` ya no se usa para workflow financiero desde reportes.
- `finance.export` permite lectura minima necesaria para construir exportables.
- Export de pendientes fiscales exige ademas permiso fiscal de lectura.
- Las lineas financieras se sanitizan para usuarios sin permiso fiscal: se ocultan RFC, correo, banco, constancia y detalle de pendientes fiscales en la respuesta.

## 4. Cambios en `teachers.ts`

- `GET /teachers` sigue siendo global, como fue aprobado, pero enmascara datos fiscales para usuarios sin permiso fiscal.
- La busqueda global por RFC/correo solo se activa si el actor tiene permiso fiscal.
- `/teachers/export/active` requiere `fiscal.view` porque el CSV contiene datos fiscales.
- `/teachers/:id/fiscal` requiere `fiscal.manage`.
- `POST /teachers/:id/documents/constancia` requiere `fiscal.document.manage`.
- `GET /teachers/:id/documents/current` requiere `fiscal.document.view`.
- `teachers.manage` ya no habilita rutas fiscales ni documentales.
- `finance.view` ya no habilita edicion fiscal ni gestion documental.
- En alta/edicion operativa de docentes, usuarios sin `fiscal.manage` no pueden modificar RFC, correo, banco ni datos fiscales existentes.

## 5. Permisos por ruta

| Ruta | Permiso aplicado |
|---|---|
| `GET /payroll/context` | `payroll.view`, `payroll.preview` o compatibilidad `payroll.calculate` |
| `POST /payroll/preview` | `payroll.preview` o compatibilidad `payroll.calculate` |
| `POST /payroll/runs` | `payroll.finalize` |
| `GET /payroll/runs/:id` | `payroll.view`, `payroll.preview` o compatibilidad `payroll.calculate` |
| `GET /payroll/runs/:id/export/:kind` | `payroll.finalize` o `finance.export` |
| `GET /reports/finance/context` | `finance.view` o `finance.global_view` |
| `PATCH /reports/finance/runs/:id/status` | `finance.workflow` |
| `GET /reports/finance/runs/:id/summary-pdf` | `finance.export` |
| `GET /reports/finance/runs/:id/coordinations-pdf` | `finance.export` |
| `GET /reports/finance/runs/:id/cash-receipts` | `finance.export` |
| `GET /reports/finance/export/:kind` | `finance.export`; para `fiscal`, tambien permiso fiscal de lectura |
| `GET /teachers` | `teachers.manage`, `finance.view`, `reports.view` o `fiscal.view`, con sanitizacion fiscal |
| `GET /teachers/export/active` | `fiscal.view` |
| `PATCH /teachers/:id/fiscal` | `fiscal.manage` |
| `POST /teachers/:id/documents/constancia` | `fiscal.document.manage` |
| `GET /teachers/:id/documents/current` | `fiscal.document.view` |

## 6. Compatibilidad temporal restante

- `payroll.calculate` se mantiene temporalmente para no romper clientes que todavia no migran a `payroll.preview`.
- `actorCoordination` singular sigue existiendo en respuestas heredadas hasta Fase 5.
- `finance.global_view` se conserva para Direccion/Subdireccion en consulta global agregada.
- El fallback legacy de coordinacion se mantiene activo desde Fase 2.

## 7. Que NO se cambio

- No se modifico H01.
- No se modifico formula de nomina.
- No se modifico precision monetaria.
- No se modifico frontend.
- No se modificaron Horarios, Incidencias ni Extras.
- No se modifico calendario operativo.
- No se modifico Apps Script legacy.
- No se retiro fallback legacy.
- No se activo modo estricto.
- No se hizo deploy.

## 8. Riesgos pendientes

- Fase 5 debe actualizar frontend para ocultar botones y vistas segun permisos nuevos.
- La sanitizacion backend protege respuestas, pero la UI aun puede intentar acciones que ahora recibiran 403.
- `payroll.calculate` debe retirarse en una fase posterior cuando el frontend use `payroll.preview`.
- La lectura minima de Contador/Contabilidad debe validarse con usuarios reales antes de despliegue productivo.
- Direccion/Subdireccion requiere validacion visual para confirmar que no recibe datos fiscales sensibles en detalle.

## 9. Proximo paso

Fase 5: actualizar frontend, store de autenticacion, router y vistas para usar:

- `payroll.preview`
- `finance.export`
- `finance.workflow`
- `fiscal.view`
- `fiscal.manage`
- `fiscal.document.view`
- `fiscal.document.manage`

Tambien debe ajustar la UI para no mostrar acciones que el backend ya bloquea.
