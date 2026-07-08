# H18-F3 - Validacion UI y exportables Reportes Operativos

Fecha: 2026-07-08

## 1. Resumen

Se ejecuto validacion local/controlada de H18-F3 para el modulo `Reportes Operativos` antes de cualquier deploy.

Resultado: **aprobado con observaciones**.

La validacion automatizada confirma:

- Contratos frontend para endpoints H18.
- Visibilidad del modulo `Reportes` por rol.
- Visibilidad de pestanas por rol.
- Consulta mockeada desde UI.
- Descarga CSV/XLSX delegada a API.
- Validacion de `cycleId` requerido para `Horas base por categoria`.
- Typecheck y build completos.

Queda pendiente la validacion manual con sesion real Firebase/local y apertura de archivos CSV/XLSX en Excel institucional antes de autorizar deploy H18-F5.

## 2. Ambiente usado

| Elemento | Valor |
|---|---|
| Rama | `feature/h02-h03-user-coordinations-permissions` |
| Commits H18 base | `72c244f feat(h18): add operational reports backend`; `76ce383 feat(h18): add operational reports frontend` |
| Commit SEC-01 | `59057c0 docs(sec-01): document exceljs npm audit evidence` |
| Entorno | Local / pruebas automatizadas |
| Produccion | No usada |
| Base de datos | No modificada |
| Migraciones | No ejecutadas |
| Deploy | No ejecutado |

Nota de alcance: no se levanto una sesion real de navegador con Firebase Auth porque el agente no cuenta con credenciales de usuario real ni existe un bypass local seguro para UI. Los actores de prueba H04 funcionan dentro de Vitest/API integration, pero no deben convertirse en bypass productivo o dev server.

## 3. Validaciones automaticas ejecutadas

| Comando | Resultado |
|---|---|
| `npm run test:api` | OK. 5 archivos, 22 pruebas. |
| `npm run test:web` | OK. 12 archivos, 53 pruebas. |
| `npm run typecheck` | OK. API `tsc --noEmit` y web `vue-tsc --noEmit`. |
| `npm run build` | OK. API build y web `vite build`. |

Validaciones especificas H18 cubiertas por `test:web`:

- `ReportsView.test.ts`: visibilidad de modulo/pestanas, consulta, empty/error controlado y delegacion de descargas CSV/XLSX.
- `auth.test.ts`: helpers H18 `canViewOperationalBaseExtraReports`, `canViewOperationalCategoryHoursReports`, `canViewReportsModule`.
- `permission-visibility.test.ts`: matriz de visibilidad por rol.

## 4. Matriz de permisos validada

| Rol | Menu Reportes | Horas base y extras | Horas base por categoria | Resultado |
|---|---|---|---|---|
| Admin | Si | Si | Si | OK por pruebas frontend. |
| Direccion/Subdireccion | Si | Si | Si | OK por pruebas frontend. |
| Coordinador | Si | No | Si | OK por pruebas frontend. |
| RH | Si | No | Si | OK por pruebas frontend. |
| Finanzas | No | No | No | OK por pruebas frontend. |
| Contador | No | No | No | OK por pruebas frontend. |
| Contabilidad | No | No | No | OK por pruebas frontend. |

Backend H18-F1 ya contiene pruebas de integracion para 403/200 por rol y exportables. En esta ejecucion H18-F3 no se corrio `test:api:integration` para respetar la restriccion de no modificar base de datos, porque esa suite prepara/siembra datos en `nomina_docente_test`.

## 5. Resultado pestana 1 - Horas base y extras

Validado por pruebas frontend:

- La pestana solo aparece para Admin y Direccion/Subdireccion.
- Coordinador, RH, Finanzas, Contador y Contabilidad no la ven.
- Boton `Consultar` llama `fetchOperationalBaseExtraReport`.
- Empty state se muestra cuando no hay filas.
- Tabla renderiza filas mockeadas con:
  - origen;
  - ciclo;
  - periodo;
  - docente;
  - categoria;
  - coordinacion;
  - horas base;
  - extras incidencia;
  - extras externos;
  - total extras;
  - capturador externo;
  - responsable incidencia;
  - motivo;
  - fecha.
- Resumen calcula registros, docentes, horas base y extras.
- Botones CSV/XLSX llaman `downloadOperationalBaseExtraReport`.

Pendiente manual:

- Ejecutar consulta con datos reales/locales desde navegador.
- Verificar loading visual en navegador.
- Verificar origen `vivo`/`snapshot` con datos reales.
- Verificar visualmente que no aparecen RFC, banco, paymentType ni constancias.
- Descargar y abrir CSV/XLSX en Excel institucional.

## 6. Resultado pestana 2 - Horas base por categoria

Validado por pruebas frontend:

- La pestana aparece para Admin, Direccion/Subdireccion, Coordinador y RH.
- Finanzas, Contador y Contabilidad no ven el modulo.
- `cycleId` es obligatorio para consultar/exportar.
- Boton `Consultar` llama `fetchOperationalCategoryHoursReport` cuando existe ciclo.
- Empty state se muestra sin datos.
- Tabla renderiza filas mockeadas con:
  - ciclo;
  - docente;
  - categoria;
  - horas esperadas;
  - horas asignadas;
  - horas restantes;
  - estado;
  - horas L-V;
  - horas modulo 1;
  - horas modulo 2;
  - coordinacion.
- Estados visuales `completo`, `faltante`, `excedido` quedan cubiertos por helpers y datos mockeados.
- Botones CSV/XLSX llaman `downloadOperationalCategoryHoursReport`.

Pendiente manual:

- Validar con dataset local que las categorias reflejen:
  - `V` / VIP = 35.
  - `M` / Medio tiempo = 25.
  - `N` / Nuevo ingreso = 15.
- Validar con datos reales/controlados la asignacion por `GREATEST(horas_l_v, modulo_1, modulo_2)`.
- Confirmar que Coordinador solo ve su alcance operativo desde backend con sesion real o suite integration aprobada.

## 7. Resultado CSV

Validado automaticamente:

- La UI llama endpoints de export con `format=csv`.
- La descarga se maneja como blob.
- El frontend respeta `Content-Disposition` si el backend lo envia.
- La UI no construye ni transforma CSV.
- H11 sigue siendo el respaldo de codificacion CSV.

Pendiente manual:

- Descargar CSV desde UI con usuario autorizado.
- Abrir en Excel institucional.
- Confirmar acentos.
- Confirmar columnas.
- Confirmar sin datos fiscales.
- Confirmar sin filas rotas.

## 8. Resultado XLSX

Validado automaticamente:

- La UI llama endpoints de export con `format=xlsx`.
- La descarga se maneja como blob.
- No se parsea XLSX en frontend.
- No se instalo dependencia Excel en frontend.
- XLSX se genera server-side con `exceljs` desde API.

Pendiente manual:

- Descargar XLSX desde UI con usuario autorizado.
- Abrir en Excel institucional.
- Confirmar hoja esperada.
- Confirmar encabezados.
- Confirmar datos legibles.
- Confirmar sin datos fiscales.

## 9. Incidencias encontradas

No se encontraron fallos de codigo en validaciones automatizadas.

Observacion no bloqueante:

- La validacion manual de navegador/Excel queda pendiente porque requiere sesion real/autorizada y archivos descargados desde UI.
- La auditoria npm SEC-01 posterior a `exceljs` esta documentada en `docs/auditoria/H18_Audit_Dependencias_ExcelJS_20260708.md`.

## 10. Correcciones realizadas

No se realizaron correcciones de codigo durante H18-F3.

Solo se genero esta documentacion de validacion.

## 11. Pendientes antes de deploy

Antes de H18-F5 se recomienda:

1. Levantar entorno local/revision con API y frontend.
2. Iniciar sesion con usuario autorizado:
   - Admin o Direccion para ambas pestanas.
   - Coordinador y RH para pestana 2.
3. Validar visualmente menu, ruta `/reports`, filtros, tablas, resumenes y empty state.
4. Descargar CSV/XLSX de ambas pestanas.
5. Abrir archivos en Excel institucional.
6. Confirmar backend 403 para roles no autorizados mediante `test:api:integration` o requests con token real, usando solo base local/test.
7. No avanzar a deploy si aparece dato fiscal, columna sensible o error de permisos.

## 12. Recomendacion

No autorizar deploy todavia si se exige evidencia manual de Excel institucional y sesion real.

Si el criterio de H18-F3 acepta validacion automatizada local como prevalidacion, el siguiente paso es ejecutar una ventana corta de smoke manual autorizado y despues preparar H18-F5 deploy controlado.

## 13. Confirmaciones

- No se hizo deploy.
- No se tocaron datos productivos.
- No se modifico base de datos.
- No se ejecutaron migraciones.
- No se instalaron dependencias.
- No se ejecuto `npm audit fix`.
- No se modifico codigo funcional.
- No se cambio H01.
- No se tocaron datos fiscales.
- No se modifico Finanzas/Nomina.
