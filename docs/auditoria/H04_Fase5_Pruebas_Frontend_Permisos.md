# H04 Fase 5 - Pruebas Frontend de Permisos y Visibilidad

## 1. Resumen

La Fase 5 de H04 agrega pruebas automatizadas frontend para proteger reglas H02/H03 desde la UI.

Esta fase no cambia reglas funcionales. Solo agrega fixtures, helpers de prueba, pruebas de componentes y documentacion.

## 2. Pruebas agregadas

Archivos agregados:

- `apps/web/src/stores/auth.test.ts`
- `apps/web/src/test/fixtures/session-users.ts`
- `apps/web/src/test/permission-visibility.ts`
- `apps/web/src/test/permission-visibility.test.ts`
- `apps/web/src/components/modals/TeacherModal.test.ts`
- `apps/web/src/components/modals/AccessModal.test.ts`
- `apps/web/src/components/modals/ScheduleModal.test.ts`
- `apps/web/src/components/modals/ExtraModal.test.ts`

## 3. Auth store cubierto

Se agregaron pruebas sobre los helpers reales del store:

- `canPreviewPayroll`
- `canFinanceWorkflow`
- `canExportFinance`
- `canViewFiscal`
- `canManageFiscal`
- `canViewFiscalDocuments`
- `canManageFiscalDocuments`
- `canFinalizePayroll`

Roles cubiertos:

- Coordinador
- RH
- Finanzas
- Direccion/Subdireccion
- Contador
- Contabilidad

## 4. Fixtures frontend creados

Se agregaron sesiones sinteticas en:

- `apps/web/src/test/fixtures/session-users.ts`

Incluyen:

- Admin
- Coordinador con una coordinacion
- Coordinador con multiples coordinaciones
- Coordinador sin coordinacion
- RH
- Finanzas
- Direccion
- Contador
- Contabilidad

Los fixtures no usan Firebase real, no llaman API real y no contienen datos fiscales reales.

## 5. Componentes cubiertos

### TeacherModal

Se valida que:

- usuarios sin `fiscal.manage` no ven `paymentType`, correo fiscal, RFC ni banco;
- usuarios con `fiscal.manage` si ven campos fiscales;
- usuarios sin permiso fiscal ven el mensaje de restriccion;
- la carga de constancia solo aparece en edicion con `fiscal.document.manage`;
- el responsable operativo se muestra en modo solo lectura para capturas no admin.

### AccessModal

El estado actual de la aplicacion ya no muestra una lista manual de coordinaciones con checkboxes. La UI informa el alcance operativo por rol/capturador.

Se valida que:

- no se rendericen checkboxes manuales de coordinacion;
- Coordinador vea mensaje de alcance por usuario capturador;
- Admin conserve alcance global;
- Finanzas/RH/Contador/Contabilidad no requieran alcance operativo;
- Direccion/Subdireccion use rol `direccion` y reglas por rol/propiedad.

### ScheduleModal

Se valida que:

- Admin vea selector de responsable operativo;
- usuario no admin vea responsable operativo en modo solo lectura.

### ExtraModal

Se valida que:

- Admin vea selector de responsable operativo;
- usuario no admin vea responsable operativo en modo solo lectura.

## 6. Helpers de visibilidad cubiertos

Se agregaron helpers de prueba en:

- `apps/web/src/test/permission-visibility.ts`

Cubren:

- Nomina preview solo lectura;
- boton Guardar nomina solo con `payroll.finalize`;
- separacion de `finance.view`, `finance.export` y `finance.workflow`;
- ocultamiento de datos fiscales sensibles en Finanzas si no hay permiso fiscal;
- separacion de `fiscal.view`, `fiscal.manage`, `fiscal.document.view` y `fiscal.document.manage`;
- estado de coordinaciones operativas: una, multiples y sin coordinacion;
- edicion de Extras solo cuando backend marca `canEdit` y la ventana esta abierta.

## 7. Que quedo pendiente

Queda pendiente para fases posteriores:

- pruebas e2e con navegador real, si se aprueba Playwright;
- montar vistas completas `PayrollView`, `FinanceReportsView` y `FiscalRecordsView` con mocks completos de API;
- validar visualmente flujos completos con router, layout y navegacion;
- pruebas de accesibilidad y responsive de modales complejos.

## 8. Como ejecutar

Suite frontend:

```bash
npm run test:web
```

Suite completa:

```bash
npm run test
```

Pruebas de integracion API con PostgreSQL:

```powershell
$env:TEST_DB_HOST='localhost'
$env:TEST_DB_PORT='55432'
$env:TEST_DB_NAME='nomina_docente_test'
$env:TEST_DB_USER='app_nomina'
$env:TEST_DB_PASSWORD='local_nomina_dev'
npm run test:api:integration
```

## 9. Riesgos

- Las vistas grandes siguen requiriendo e2e o mocks mas completos para validar DOM final de cada pantalla.
- Las pruebas de visibilidad son unitarias y no sustituyen pruebas manuales o e2e de flujo completo.
- La UI depende de que backend siga enviando `canEdit`, permisos y `actorCoordinations` correctamente.

## 10. Siguiente fase recomendada

H04 Fase 6:

1. Evaluar Playwright para e2e local sin produccion.
2. Crear pruebas de navegacion por rol.
3. Cubrir flujos reales de UI: login mockeado, captura, fiscal, finanzas y preview.
4. Mantener pruebas unitarias/integracion como primera barrera antes del e2e.

## 11. Confirmaciones

- No se toco produccion.
- No se uso Firebase real.
- No se llamo API real.
- No se hizo deploy.
- No se cambio H01 funcional.
- No se cambio H02 funcional.
- No se cambio H03 funcional.
- No se cambiaron reglas de negocio.
