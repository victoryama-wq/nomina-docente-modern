# Cierre Hotfix H01 - Precisión Monetaria

## 1. Resumen

El Hotfix H01 corrigió el manejo de importes monetarios en Nómina Docente para evitar pérdida de precisión por coma flotante. La corrección incorporó `decimal.js` en la API, mantuvo los valores `numeric` de PostgreSQL como string decimal en los puntos críticos y centralizó los cálculos monetarios con `Decimal`.

El frontend fue ajustado posteriormente en H01.1 para reflejar el nuevo contrato de importes monetarios como string decimal mediante `MoneyString`, manteniendo la interfaz como capa de visualización y evitando cálculos oficiales de dinero en Vue.

## 2. Motivo del hotfix

H01 fue clasificado como P0 Crítico por el riesgo de diferencias de centavos en una nómina formal. El sistema procesa importes de pago docente, descuentos, extras, reportes y comprobantes, por lo que cualquier cálculo con `number`, `float`, `parseFloat`, `Number()` o `numeric::float8` podía introducir diferencias pequeñas pero operativamente inaceptables.

El objetivo fue estabilizar la precisión monetaria sin cambiar reglas de negocio, permisos, calendario, roles ni estructura de base de datos.

## 3. Alcance aplicado

Archivos modificados en el hotfix:

- `apps/api/package.json`
- `package-lock.json`
- `apps/api/src/lib/decimal.ts`
- `apps/api/src/routes/catalogs.ts`
- `apps/api/src/routes/extras.ts`
- `apps/api/src/routes/incidences.ts`
- `apps/api/src/routes/payroll.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/schedules.ts`
- `apps/web/src/api.ts`
- `apps/web/src/utils/format.ts`
- `apps/web/src/views/PayrollView.vue`
- `apps/web/src/views/FinanceReportsView.vue`
- `apps/web/src/views/ExtrasView.vue`
- `apps/web/src/views/SchedulesView.vue`
- `apps/web/src/views/CatalogsView.vue`
- `apps/web/src/AppLegacy.vue`

Confirmación de alcance:

- No se modificaron permisos.
- No se modificaron roles.
- No se modificó el calendario operativo.
- No se modificó Apps Script legado.
- No se modificó la estructura de base de datos.
- No se modificaron reglas de negocio de nómina.
- No se atendieron H02-H14 en este hotfix.

## 4. Cambios principales

- Se agregó `decimal.js` como dependencia de la API.
- Se creó un helper decimal para separar dinero y horas.
- Se eliminó el uso de `numeric::float8` en importes monetarios críticos.
- Se eliminaron conversiones con `Number()` en cálculos monetarios críticos.
- Se reemplazaron validaciones monetarias con `z.coerce.number()` por validaciones decimales seguras.
- Se aplicó `ROUND_HALF_UP` a 2 decimales para importes monetarios cuando el cálculo genera más de 2 decimales.
- Los montos monetarios se guardan y exponen como string decimal con 2 decimales.
- Las horas se mantienen como decimal operativo y no se tratan como dinero.
- Se actualizó el contrato TypeScript del frontend con `MoneyString`.
- Se ajustó el formateo visual para mostrar importes recibidos como string decimal.

## 5. Validaciones técnicas

Validaciones ejecutadas antes del despliegue:

- Typecheck API: `npm --workspace apps/api run typecheck`
- Typecheck frontend: `npm --workspace apps/web run typecheck`
- Typecheck general: `npm run typecheck`
- Build API: `npm --workspace apps/api run build`
- Build frontend: `npm --workspace apps/web run build`
- Build general: `npm run build`

Despliegues ejecutados:

- API Fastify desplegada en Cloud Run.
- Frontend Vue 3 desplegado en Firebase Hosting.

Validación de salud:

- Endpoint: `https://nomina-docente-prod.web.app/api/health`
- Resultado: `200 OK`
- Respuesta confirmada: `{"ok":true,"service":"nomina-docente-api","tables":30,...}`

## 6. Validación operativa

Después del despliegue se validó el sistema en ambiente desplegado con una quincena real, en modo operativo.

Resultado confirmado por operación:

- El total global cuadró.
- Los totales por coordinación cuadraron.
- Los docentes con faltas cuadraron.
- Los docentes con retardos cuadraron.
- Los docentes con extras cuadraron.
- La vista de Nómina y Finanzas mostró los importes correctos.
- Los reportes/exportables aplicables quedaron consistentes con los importes calculados.

La validación fue realizada después de que API y Hosting quedaron desplegados con H01 + H01.1.

## 7. Resultado

H01 queda cerrado técnica y operativamente.

El sistema desplegado ya usa precisión decimal para importes monetarios críticos, mantiene los importes como string decimal en API/frontend y conserva la lógica de negocio original.

## 8. Pendientes relacionados

H02-H14 no fueron tocados y quedan para fases posteriores.

Pendientes recomendados:

- SDD retrospectivo formal.
- Matriz formal de riesgos.
- Auditoría de reglas de negocio.
- Auditoría de seguridad.
- Modelo PostgreSQL documentado.
- Skills.
- `AGENTS.md`.
- Workflow de mantenimiento.

## 9. Evidencia

Commit desplegado:

- `6269320b89188340b17ab86a370ff70b3b5ee98e`

Tag:

- `hotfix-h01-money-precision-6269320`

Fecha de despliegue:

- 2026-05-15

Cloud Run:

- Servicio: `nomina-api`
- Región: `us-central1`
- Revisión desplegada: `nomina-api-00043-p96`
- Tráfico: 100%
- Imagen: `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h01-6269320`
- Digest: `sha256:d27e746d08ad1756760b74be1f365d1bd719c078b2ab36816d221dd9d815757c`

Firebase Hosting:

- Sitio: `nomina-docente-prod`
- URL: `https://nomina-docente-prod.web.app`
- Versión Hosting: `ffa4489d79ffc477`
- Release live: `projects/nomina-docente-prod/sites/nomina-docente-prod/channels/live/releases/1778869712982000`
- Asset JS desplegado: `/assets/index-Dqi2usvi.js`

Rollback preparado:

- Canal Hosting: `rollback-pre-h01`
- URL: `https://nomina-docente-prod--rollback-pre-h01-rrn9b6xb.web.app`
- Revisión API previa disponible: `nomina-api-00042-r7f`

Verificación posterior:

- `/api/health` respondió `200 OK`.
- Logs iniciales de Cloud Run sin errores `ERROR`.
- El usuario confirmó que el sistema funciona correctamente después del despliegue.
