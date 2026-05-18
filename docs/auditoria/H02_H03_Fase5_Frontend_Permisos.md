# H02/H03 Fase 5 - Frontend, Permisos Visibles y Ajustes Finales

## 1. Resumen

La Fase 5 alinea el frontend y contratos TypeScript con la separacion H02/H03 ya preparada en backend:

- `actorCoordinations[]` queda disponible en sesion y contratos.
- Control de Accesos permite ver y asignar multiples coordinaciones por usuario.
- Nomina permite preview de solo lectura para Coordinador y mantiene guardado solo con `payroll.finalize`.
- Fiscal, documentos fiscales, Finanzas, exportacion y workflow se separan visualmente por permisos explicitos.
- Alta/edicion operativa de docentes bloquea campos fiscales si el actor no tiene `fiscal.manage`.
- `/payroll/context` protege `recentRuns` para actores sin alcance global.

## 2. Cambios en api.ts

- Se agrego `ActorCoordination`.
- Se agrego `UserCoordinationAssignment`.
- `SessionUser` ahora incluye `actorCoordinations`.
- `AccessUser` ahora incluye `coordinations`.
- `fetchAccessUsers()` ahora espera `coordinations` del API.
- `TeacherPayload` permite omitir campos fiscales sensibles cuando el usuario no tiene `fiscal.manage`.
- Contextos operativos aceptan compatibilidad temporal con `actorCoordination` y `actorCoordinations`.

## 3. Cambios en auth store

Se agregaron helpers de permisos:

- `canPreviewPayroll`
- `canFinanceWorkflow`
- `canExportFinance`
- `canViewFiscal`
- `canManageFiscal`
- `canViewFiscalDocuments`
- `canManageFiscalDocuments`

Reglas aplicadas:

- `canManageFiscal` no depende de `finance.view`.
- `canFinanceWorkflow` no depende de `finance.view`.
- `canExportFinance` no depende de `reports.view`.
- `canPreviewPayroll` no habilita guardado.
- `canViewFiscalDocuments` no implica `canManageFiscalDocuments`.

## 4. Cambios en router

No se cambiaron rutas publicas.

Los guards siguen usando helpers del store, pero esos helpers ahora apuntan a permisos separados:

- Nomina: `payroll.view` o `payroll.preview`.
- Expediente Fiscal: `fiscal.view`.
- Finanzas: `finance.view`, `finance.global_view` o `finance.export`.

## 5. Cambios en AccessView

- Lista coordinaciones asignadas por usuario.
- Permite seleccionar multiples coordinaciones al crear/editar usuario.
- Exige coordinacion para Coordinador activo.
- No exige coordinacion operativa para Admin, Finanzas, RH, Contador o Contabilidad.
- No crea coordinaciones desde Control de Accesos.
- Subdireccion sigue usando el rol tecnico `direccion`.

## 6. Cambios en PayrollView

- Modo preview visible para usuario con `payroll.preview`.
- Coordinador ve una etiqueta de alcance con sus coordinaciones asignadas.
- Guardar nomina sigue visible solo con `payroll.finalize`.
- Exportacion desde Nomina requiere `payroll.finalize` o `finance.export`.
- No se cambio calculo, formula ni precision monetaria H01.

## 7. Cambios en FinanceReportsView

- Workflow financiero usa `finance.workflow`.
- Exportaciones CSV/PDF usan `finance.export`.
- `finance.view` queda como consulta visual.
- La pestana de pendientes fiscales se oculta si el usuario no tiene permiso fiscal.
- Datos RFC/correo/banco se omiten de busquedas y detalle visual si el usuario no tiene `fiscal.view`.
- Direccion/Subdireccion no recibe acciones de workflow financiero.
- Contador/Contabilidad no reciben acciones de workflow ni edicion fiscal desde la UI.

## 8. Cambios en FiscalRecordsView

- Vista fiscal usa `fiscal.view`.
- Edicion de RFC/correo/banco/tipo de pago usa `fiscal.manage`.
- Vista/descarga de constancias usa `fiscal.document.view`.
- Carga/reemplazo de constancias usa `fiscal.document.manage`.
- `finance.view` y `teachers.manage` ya no habilitan gestion fiscal visualmente.

## 9. Cambios en SchedulesView

- Usa lista de coordinaciones asignadas para validar seleccion visual.
- Si el usuario tiene una coordinacion, se preselecciona.
- Si tiene varias, puede seleccionar una de sus coordinaciones.
- No se crean coordinaciones desde modales.

## 10. Cambios en IncidencesView

No se cambiaron reglas funcionales de Incidencias en esta fase.

Incidencias mantiene la proteccion backend implementada en Fase 3 y respeta errores 403/validaciones del API.

## 11. Cambios en ExtrasView

- Si el usuario tiene varias coordinaciones, puede seleccionar una valida.
- La UI exige coordinacion seleccionada cuando corresponde.
- No se crean coordinaciones desde modales.
- Edicion/eliminacion sigue dependiendo de `canEdit` entregado por backend, que ya valida coordinacion y propiedad en Fase 3.

## 12. Cambios en TeachersView

- `GET /teachers` sigue global.
- Campos fiscales se ocultan si el usuario no tiene `fiscal.view`.
- Campos fiscales en alta/edicion se omiten si el usuario no tiene `fiscal.manage`.
- Carga de constancia requiere `fiscal.document.manage`.
- Vista/descarga de constancia requiere `fiscal.document.view`.
- `teachers.manage` no se interpreta como permiso fiscal.

## 13. Correccion O1: POST /teachers y paymentType

Decision aplicada:

- `paymentType`, `rfc`, `email` y `bankDetail` se tratan como datos fiscales/financieros sensibles.
- Si el actor no tiene `fiscal.manage` y envia cualquiera de esos campos en alta o edicion operativa, el backend responde `403`.
- No se ignoran silenciosamente.
- No se limpian silenciosamente.
- Usuarios autorizados: Admin, RH y Finanzas mediante permisos fiscales.
- Usuarios no autorizados: Coordinador, Direccion/Subdireccion, Contador/Contabilidad y cualquier usuario sin `fiscal.manage`.

## 14. Correccion O2: /payroll/context y recentRuns

Decision aplicada:

- Para actores con alcance global, `recentRuns` conserva su comportamiento.
- Para actores sin alcance global, `recentRuns` se filtra por corridas que tengan lineas en sus coordinaciones asignadas.
- Para actores sin alcance global, el resumen global embebido de `recentRuns` se sustituye por un resumen vacio normalizado.
- El detalle real debe consultarse con la ruta de corrida, que ya recalcula resumen desde lineas visibles por alcance.

## 15. Que NO se cambio

- No se toco H01.
- No se cambio formula de nomina.
- No se cambio precision monetaria.
- No se modifico calendario operativo.
- No se modifico Apps Script legacy.
- No se crearon migraciones nuevas.
- No se cambiaron seeds productivos.
- No se retiro fallback legacy.
- No se activo modo estricto.
- No se creo rol tecnico `subdireccion`.
- No se trato `"Todas / Global"` como coordinacion.
- No se trato `"No requiere coordinacion operativa"` como coordinacion.
- No se hizo deploy.

## 16. Riesgos pendientes

- Direccion/Subdireccion requiere pruebas manuales para confirmar el alcance operativo real de Directorio contra reglas de propiedad disponibles.
- Contabilidad debe validarse en ambiente con datos reales para confirmar que su experiencia de exportacion sea equivalente a Contador.
- La UI oculta acciones, pero el backend sigue siendo la autoridad; pruebas por rol deben confirmar 403 cuando se fuerzan acciones.

## 17. Validaciones ejecutadas

- `npm --workspace apps/api run typecheck`
- `npm --workspace apps/web run typecheck`
- `npm run typecheck`
- `npm run build`

Todas pasaron localmente antes del commit de Fase 5.

## 18. Proximo paso

Fase 6: pruebas integrales por rol, coordinacion, propiedad, fiscal/documental, workflow financiero, preview de nomina y fallback legacy.
