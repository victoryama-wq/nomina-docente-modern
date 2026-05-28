# H04 Fase 4 - Pruebas Automatizadas de Negocio Backend

## 1. Resumen

La Fase 4 de H04 amplia la suite automatizada del backend para cubrir reglas criticas de negocio H01, H02 y H03 con PostgreSQL real de test y `app.inject()`.

Esta fase no cambia logica funcional. Solo agrega pruebas, utilidades de test y documentacion.

## 2. Infraestructura usada

Se reutiliza la infraestructura de H04 Fase 3:

- base local/test `nomina_docente_test`;
- migraciones `database/*.sql`;
- seed sintetico `apps/api/src/test/db/seed-h04-minimal.sql`;
- `app.inject()`;
- actores fixture sin Firebase real;
- mock de auth exclusivo para `NODE_ENV=test`.

La suite de integracion se ejecuta con:

```powershell
$env:TEST_DB_HOST='localhost'
$env:TEST_DB_PORT='55432'
$env:TEST_DB_NAME='nomina_docente_test'
$env:TEST_DB_USER='app_nomina'
$env:TEST_DB_PASSWORD='local_nomina_dev'
npm run test:api:integration
```

## 3. Pruebas H01 agregadas

Archivo:

- `apps/api/src/lib/decimal.test.ts`
- `apps/api/src/test/api-h01-payroll.integration.test.ts`

Cobertura agregada:

- redondeo decimal `ROUND_HALF_UP`;
- casos `10.50`, `10.40`, `10.43`, `10.435`, `10.434`, `62.675`, `62.674`;
- suma `0.10 + 0.20 = 0.30`;
- multiplicacion sin drift flotante;
- preview de nomina con totales esperados;
- faltas descontadas correctamente;
- retardos descontados como `0.5` horas por retardo;
- extras de incidencia sumados correctamente;
- extras externos sumados correctamente;
- `totalAmount = baseNetAmount + totalExtraAmount`;
- importes expuestos como strings decimales.

Resultado esperado del seed H04 para preview global:

```text
totalAmount = 3850.00
grossBaseAmount = 3200.00
discountAmount = 250.00
totalExtraAmount = 900.00
```

## 4. Pruebas H02 agregadas

Archivo:

- `apps/api/src/test/api-h02-operational-scope.integration.test.ts`

Cobertura agregada:

- Admin puede crear horarios con alcance global.
- Coordinador crea horarios usando su coordinacion asignada.
- Coordinador multiple puede editar horario capturado por su usuario.
- Coordinador multiple no edita horario ajeno.
- Coordinador sin coordinacion recibe error controlado en captura operativa.
- Incidencias se validan por el horario capturado.
- `schedule_incidences.updated_by` no se trata como autoria original.
- Coordinador puede capturar extras para docente compartido.
- Extras se asignan al actor capturador y solo ese actor puede editarlos.
- Direccion/Subdireccion puede ver listado de extras, pero solo edita los capturados por su usuario.

## 5. Pruebas H03 agregadas

Archivo:

- `apps/api/src/test/api-h03-permissions.integration.test.ts`

Cobertura agregada:

- Coordinador no puede editar fiscal.
- Direccion/Subdireccion no puede editar fiscal.
- Contador no puede editar fiscal.
- RH puede editar fiscal.
- Finanzas puede editar fiscal.
- Usuarios sin `fiscal.manage` no pueden crear docente con campos fiscales.
- Usuarios sin `fiscal.document.view` no descargan constancia.
- Usuarios sin `fiscal.document.manage` no suben constancia.
- RH llega hasta validacion de datos para descarga de constancia sin tocar Storage si no hay documento.
- `finance.view` permite consulta, pero no exportacion ni workflow.
- `finance.export` permite exportar sin workflow.
- `finance.workflow` permite pasar por estados `EN_REVISION`, `APROBADA`, `PAGADA` y `CANCELADA`.
- Direccion/Subdireccion no ejecuta workflow financiero.
- Finanzas no guarda nomina si no tiene `payroll.finalize`.
- Coordinador con `payroll.preview` no guarda nomina.

## 6. Ajustes de test agregados

Se agrego:

- `apps/api/src/test/api-integration-helpers.ts`
- `apps/api/src/test/integration-teardown.ts`

Motivo:

- compartir IDs y payloads del seed H04;
- reconstruir `nomina_docente_test` de forma segura;
- cerrar el pool PostgreSQL una sola vez al final de la suite de integracion.

## 7. Que queda pendiente

Pendientes para fases posteriores:

- pruebas frontend de stores y visibilidad de botones por permiso;
- pruebas e2e con navegador, si se aprueba Playwright;
- pruebas completas de exportables CSV/PDF;
- pruebas de documentos fiscales con Storage mockeado;
- casos adicionales de limites semanales por categoria `V`, `M` y `N`;
- pruebas de fallback legacy instrumentado;
- pruebas de reportes financieros con lineas reales guardadas por `payroll_lines`.

## 8. Riesgos

- Las pruebas de integracion reconstruyen `nomina_docente_test`; no deben ejecutarse contra otra base.
- La cobertura usa datos sinteticos, no sustituye validaciones operativas con dataset real controlado.
- Los documentos fiscales solo se prueban hasta permisos/prehandler y ausencia de documento; no se toca Storage real.
- Aun falta cobertura frontend para evitar regresiones visuales o de UX.

## 9. Siguiente fase recomendada

H04 Fase 5 debe enfocarse en frontend:

1. store de auth/permisos;
2. visibilidad de acciones por rol;
3. modo solo lectura de nomina preview;
4. bloqueo visual de fiscal/documentos/workflow;
5. formularios de Horarios, Incidencias y Extras con coordinacion/propiedad.

## 10. Confirmaciones

- No se toco produccion.
- No se uso Firebase real.
- No se hizo deploy.
- No se cambio H01 funcional.
- No se cambio H02 funcional.
- No se cambio H03 funcional.
- No se cambiaron reglas de negocio.
- No se crearon migraciones productivas.
