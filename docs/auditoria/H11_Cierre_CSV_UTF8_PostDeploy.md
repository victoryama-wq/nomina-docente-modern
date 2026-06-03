# H11 - Cierre CSV UTF-8 postdeploy

## 1. Estado general

Estado al 2026-06-03: **H11 cerrado operativo**.

H11-F5 ya fue desplegado a produccion y los healthchecks posteriores fueron correctos. Posteriormente, un usuario autorizado Admin/Finanzas/RH confirmo manualmente en produccion la descarga y apertura de los CSV requeridos.

Con esa validacion manual autorizada, H11 queda cerrado operativamente para los exportables CSV criticos backend/frontend incluidos en el alcance.

## 2. Ambiente y despliegue relacionado

- Rama: `feature/h02-h03-user-coordinations-permissions`.
- Commit H11 desplegado: `4e0c214 docs(h11): add spreadsheet validation results for csv exports`.
- Commit documental deploy H11-F5: `18b5c7b docs(h11): record production csv deploy result`.
- API Cloud Run: `nomina-api`.
- Revision Cloud Run H11-F5: `nomina-api-00046-6ck`.
- Firebase Hosting: `https://nomina-docente-prod.web.app`, canal `live`.
- Backup preventivo H11-F5: `1780499832076`.
- Base productiva protegida: `nomina_docente`.

Confirmado en H11-F5:

- No hubo migracion H11.
- No existe migracion `013` asociada a H11.
- No se importaron datos.
- No se sincronizaron datos locales/test.
- No se modificaron permisos, columnas, filtros, rutas, nombres de archivo, montos ni UX.

## 3. Usuario/rol usado

Validacion confirmada manualmente por usuario autorizado en produccion.

Rol usado:

- Admin/Finanzas/RH autorizado.

Controles:

- No se documento token.
- No se expusieron credenciales.
- No se registraron datos fiscales sensibles en esta evidencia.
- La evidencia se limita al resultado funcional de descarga y apertura.

## 4. Resultado de smoke CSV autorizado

Fecha: 2026-06-03.

Ambiente: produccion.

Rol usado: Admin/Finanzas/RH autorizado.

Resultado:

| CSV | Origen | Resultado |
|---|---|---|
| Finanzas pagos | Backend `/api/reports/finance/export/payments` | OK |
| Nomina resumen | Backend `/api/payroll/runs/:id/export/summary` | OK |
| Docentes activos | Backend `/api/teachers/export/active` | OK |
| Auditoria | Backend `/api/audit/export` | OK |
| PayrollView Detalle CSV | Frontend `PayrollView` | OK |
| FiscalRecordsView Cumpleanos CSV | Frontend `FiscalRecordsView` | OK |

Validaciones confirmadas:

- Descarga correcta.
- Apertura correcta en Excel institucional.
- Acentos OK.
- Columnas OK.
- Montos OK cuando aplica.
- Nombre de archivo OK.
- Sin mojibake.
- Sin filas rotas.
- Sin errores visibles durante la validacion manual.

## 5. Resultado en Excel institucional

Los CSV validados abrieron en Excel institucional con:

- Acentos OK.
- Columnas OK.
- Montos OK.
- Nombre de archivo OK.
- Sin mojibake.
- Sin filas rotas.
- Sin columnas extra o faltantes.
- Sin alteracion de importes.

La validacion local previa H11-F4 ya comprobo con Excel Windows 16.0, sobre CSV sinteticos, que:

- El BOM UTF-8 esta presente.
- CRLF se conserva.
- No hay mojibake en acentos.
- Comas, comillas y saltos de linea no rompen filas.
- Columnas y orden se mantienen.
- Montos se conservan en el CSV.

## 6. Observaciones no bloqueantes

- Google Sheets queda pendiente solo si se usara como consumidor operativo regular.
- LibreOffice/Calc queda pendiente solo si se usara institucionalmente.
- Sanitizacion contra CSV injection queda como decision futura por exportable. El helper ya soporta la opcion, pero H11 no la activo para no cambiar la semantica de datos exportados.
- Excel puede mostrar algunos importes como numero bajo formato General, aunque el CSV conserve el valor decimal.

## 7. Confirmaciones de seguridad de esta documentacion

En esta documentacion de cierre:

- No se modifico codigo.
- No se modifico produccion.
- No se modifico base de datos.
- No se ejecuto migracion.
- No se ejecuto `db:migrate`.
- No se ejecuto `db:migrate:apply`.
- No se ejecuto `db:migrate:baseline`.
- No se importaron datos.
- No se cambiaron datos productivos.
- No se cambio logica funcional.
- No se cambiaron permisos, rutas, columnas, filtros, montos ni UX.
- No se hizo deploy.

## 8. Criterio de cierre operativo cumplido

H11 se marca como cerrado operativo porque un usuario autorizado confirmo:

1. CSV descargados:
   - Finanzas pagos.
   - Nomina resumen.
   - Docentes activos.
   - Auditoria.
   - PayrollView Detalle CSV.
   - FiscalRecordsView Cumpleanos CSV.
2. Apertura en Excel institucional sin mojibake.
3. Columnas, montos, nombres de archivo y filas correctos.
4. Sin cambios de datos ni acciones operativas distintas a descarga.

## 9. Resultado

Resultado actual: **H11 cerrado operativo**.

H11-F5 queda publicado, validado y cerrado operativamente.

## 10. Pendientes futuros

- Decidir sanitizacion contra CSV injection por exportable solo si se requiere como mejora futura.
- Validar Google Sheets si se convierte en consumidor operativo regular.
- Validar LibreOffice/Calc si se usa institucionalmente.

Commit de cierre:

```text
docs(h11): close csv utf8 postdeploy validation
```
