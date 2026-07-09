# H18 - Cierre Operativo Reportes Operativos

Fecha: 2026-07-09

## 1. Resumen

Se documenta la validacion post-hotfix de H18 Reportes Operativos despues de corregir el error productivo:

```text
column ped.line_key does not exist
```

Hotfix backend desplegado:

```text
c1e858b fix(h18): correct operational reports snapshot query
```

Revision Cloud Run vigente despues del hotfix:

```text
nomina-api-00050-zdm
```

H18 queda cerrado operativo porque las pestañas, filtros amigables, permisos y exportables criticos quedaron validados despues del hotfix.

## 2. Ambiente validado

| Elemento | Valor |
|---|---|
| Ambiente | Produccion |
| Frontend | Firebase Hosting live |
| API | Cloud Run `nomina-api` |
| Revision API | `nomina-api-00050-zdm` |
| Ruta | `/reports` |
| Base | Cloud SQL `nomina_docente` |
| Migraciones H18 | No aplica |

## 3. Pestaña Horas base y extras

Resultado: OK.

| Validacion | Resultado |
|---|---|
| Ciclo por lista desplegable | OK |
| Quincena guardada por lista desplegable | OK |
| Busqueda general | OK |
| Consulta con quincena guardada/snapshot | OK |
| Error `ped.line_key` | No se reproduce despues del hotfix |
| CSV | OK |
| XLSX | OK |
| Apertura en Excel institucional | OK |
| Datos fiscales | No expone RFC, banco, paymentType ni constancias |

La consulta snapshot usa la relacion corregida por `payroll_run_id`, `teacher_id` y `coordination_id`, sin columna `line_key`.

## 4. Pestaña Horas base por categoria

Resultado: OK.

| Validacion | Resultado |
|---|---|
| Ciclo por lista desplegable | OK |
| Busqueda general | OK |
| Consulta | OK |
| CSV | OK |
| XLSX | OK |
| Apertura en Excel institucional | OK |
| Datos fiscales | No expone RFC, banco, paymentType ni constancias |

Se mantiene la regla de horas oficiales:

| Categoria | Horas |
|---|---:|
| `V` / VIP | 35 |
| `M` / Medio tiempo | 25 |
| `N` / Nuevo ingreso | 15 |

## 5. Permisos validados

| Rol | Modulo Reportes | Horas base y extras | Horas base por categoria | Resultado |
|---|---|---|---|---|
| Admin | Visible | Visible | Visible | OK |
| Direccion/Subdireccion | Visible | Visible | Visible | OK |
| Coordinador | Visible | Oculta | Visible | OK |
| RH | Visible | Oculta | Visible | OK |
| Finanzas | Oculto / bloqueado | No aplica | No aplica | OK |
| Contador | Oculto / bloqueado | No aplica | No aplica | OK |
| Contabilidad | Oculto / bloqueado | No aplica | No aplica | OK |

El backend conserva las guardas por rol. La UI oculta pestañas no permitidas, pero la autorizacion real permanece en API.

## 6. Exportables

### CSV

- Descarga correcta.
- Abre en Excel institucional.
- Acentos correctos.
- Columnas esperadas.
- Sin filas rotas.
- Sin datos fiscales.
- Mantiene estandar H11: UTF-8 con BOM y CRLF.

### XLSX

- Descarga correcta.
- Abre en Excel institucional.
- Hoja esperada.
- Encabezados correctos.
- Datos legibles.
- Sin datos fiscales.
- Generado server-side con `exceljs`.

## 7. Resultado final

H18 queda cerrado operativo.

Criterios cumplidos:

- Backend H18 implementado.
- Frontend H18 implementado.
- CSV y XLSX disponibles.
- Filtros amigables H18-F6 desplegados.
- Hotfix snapshot `ped.line_key` corregido y desplegado.
- Validacion post-hotfix satisfactoria.
- Permisos por rol validados.
- Exportables validados en Excel institucional.

## 8. Confirmaciones

- No se modifico codigo en esta documentacion de cierre.
- No se modifico base de datos.
- No se ejecutaron migraciones.
- No se hizo deploy en esta fase documental.
- No se ejecutaron seeds.
- No se importaron datos.
- No se tocaron datos fiscales.
- No se cambio formula H01.
- No se cambiaron roles ni permisos productivos.

## 9. Pendientes futuros no bloqueantes

- Decidir si en el futuro se crean permisos formales especificos para reportes operativos; requeriria H05/migracion.
- Decidir si snapshots historicos deben conservar capturador externo cuando `payroll_extra_details` no tenga `captured_by`.
- Evaluar sanitizacion CSV injection por exportable si se convierte en requisito institucional.
