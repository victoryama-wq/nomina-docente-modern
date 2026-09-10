# H18 - Ajuste post-H23 de Reportes Operativos

Fecha: 2026-09-10

Estado: implementado y validado en local/test; pendiente de validacion manual predeploy y despliegue controlado.

## 1. Contexto

La incorporacion de la vigencia temporal H23 hizo necesario alinear los reportes operativos con la misma fuente de verdad temporal usada por Nomina. El ajuste evita presentar como horas pagables aquellas que quedan fuera de la interseccion entre la quincena seleccionada y la vigencia de horas base del ciclo.

Este cambio no modifica H01, importes, tabuladores, redondeos, corridas historicas ni snapshots existentes.

## 2. Decisiones funcionales aplicadas

- `Horas base y extras` requiere ciclo ACTIVO y una quincena seleccionada.
- La lista contiene todas las quincenas configuradas del ciclo activo, tengan o no corrida guardada.
- `source=auto` usa snapshot cuando existe una corrida no cancelada para la quincena; de lo contrario calcula datos vivos con H23.
- La columna principal se denomina `Horas base de la quincena`.
- El dato vivo se calcula para la quincena seleccionada; ya no existe una consulta ambigua de todo el ciclo.
- La carga quincenal real descuenta faltas y `0.5` horas por cada retardo, conforme a H01.
- Los extras de incidencia y los extras externos se muestran separados y tambien forman parte del total real informativo.
- Los limites quincenales aprobados son `V=70`, `M=50` y `N=30`; el reporte marca la sobrecarga cuando el total real los excede.
- `Horas base por categoria` conserva naturaleza semanal y consolida primero toda la carga del docente entre coordinaciones antes de compararla una sola vez contra `V=35`, `M=25` o `N=15`.
- Las coordinaciones se muestran como desglose informativo, sin repetir el umbral por cada coordinacion.
- Admin, Direccion/Subdireccion y Coordinador tienen acceso global de solo lectura a ambas pestanas.
- RH, Finanzas, Contador y Contabilidad no tienen acceso al modulo H18.
- Se excluyen docentes inactivos y docentes sin horarios.

## 3. Calculo de Horas base y extras

Para cada docente y quincena:

```text
horas_base_brutas = ocurrencias pagables H23 de los horarios
descuento_retardos = numero_de_retardos * 0.5
horas_base_netas = max(horas_base_brutas - faltas - descuento_retardos, 0)
total_real_quincena = horas_base_netas + extras_incidencia + extras_externos
```

La clasificacion informativa compara `total_real_quincena` contra el limite de la categoria:

| Categoria | Limite quincenal |
|---|---:|
| VIP (`V`) | 70 |
| Medio tiempo (`M`) | 50 |
| Nuevo ingreso (`N`) | 30 |

La interfaz y los exportables muestran horas brutas, faltas, retardos, descuento por retardos, horas base netas, extras por origen, total real, limite y estado de sobrecarga.

## 4. Fuentes de datos

### Datos vivos

- Horas base: horarios y elegibilidad temporal H23 para la quincena.
- Responsable de horario: usuario creador del horario disponible en el modelo actual.
- Faltas, retardos y extras de incidencia: `schedule_incidences`.
- Extras externos: `extra_hours`, limitados por fecha a la quincena seleccionada.

### Snapshot

Cuando existe una corrida no cancelada, se conservan como fuente los detalles guardados de Nomina. No se recalcula ni reescribe la corrida historica.

El snapshot no guarda una copia independiente del responsable del horario; para presentarlo, el reporte resuelve la relacion actual del detalle de horario con `schedules.created_by`. Esta limitacion de trazabilidad debe considerarse si en el futuro se requiere un responsable historico inmutable.

## 5. Horas base por categoria

El calculo permanece semanal y usa datos vivos del ciclo:

```text
horas_lv = suma global L-V del docente entre coordinaciones
horas_modulo_1 = horas_lv + suma global S1
horas_modulo_2 = horas_lv + suma global S2
horas_asignadas = mayor(horas_lv, horas_modulo_1, horas_modulo_2)
horas_restantes = horas_esperadas_categoria - horas_asignadas
```

El resultado contiene una fila por docente y un desglose de coordinaciones. Un docente compartido no duplica su umbral ni su total.

## 6. Permisos

| Rol | Horas base y extras | Horas base por categoria | Alcance |
|---|---|---|---|
| Admin | Permitido | Permitido | Global, solo lectura |
| Direccion/Subdireccion | Permitido | Permitido | Global, solo lectura |
| Coordinador | Permitido | Permitido | Global, solo lectura |
| RH | Denegado | Denegado | Sin acceso H18 |
| Finanzas | Denegado | Denegado | Sin acceso H18 |
| Contador/Contabilidad | Denegado | Denegado | Sin acceso H18 |

Las guardas backend siguen siendo la autoridad; la ocultacion frontend no sustituye la autorizacion del API.

## 7. Exportables

CSV y XLSX reciben exactamente los filtros aplicados en pantalla. No incluyen UUID tecnicos como columnas operativas ni datos fiscales. CSV conserva el helper H11 y XLSX se genera en el API mediante `exceljs`.

## 8. Pruebas ejecutadas

- `npm run test:api`: 42/42 pruebas aprobadas.
- `npm run test:web`: 92/92 pruebas aprobadas.
- `npm run test:api:integration` contra `nomina_docente_test`: 130/130 pruebas aprobadas.
- Integracion H18 enfocada contra `nomina_docente_test`: 15/15 aprobadas.
- Integracion H01 enfocada contra `nomina_docente_test`: 5/5 aprobadas.
- Una ejecucion completa previa aprobo 129 de 130 pruebas y presento un timeout transitorio durante el reset de la base. La repeticion enfocada de H01 aprobo 5/5 y la segunda ejecucion integral aprobo 130/130, confirmando ausencia de regresion funcional.
- Typecheck de API y Web: aprobado.
- Build de API y Web: aprobado.

La evidencia cubre quincena obligatoria, listado de periodos sin corrida, calculo vivo H23, descuentos de faltas/retardos, sobrecarga, snapshot, consolidacion global por docente, exclusion de inactivos y permisos por rol.

## 9. Pendientes antes de deploy

- Ejecutar validacion manual de la UI con sesiones Admin, Direccion y Coordinador.
- Abrir CSV/XLSX de ambas pestanas en Excel institucional.
- Ejecutar checklist predeploy.
- Desplegar API y Hosting solo mediante una fase productiva autorizada.

## 10. Confirmaciones

- No se accedio ni modifico produccion.
- No se hizo deploy.
- No se creo ni ejecuto migracion.
- No se modifico la base productiva.
- No se modifico H01 ni su matematica monetaria.
- No se modificaron snapshots ni corridas historicas.
- No se expusieron datos fiscales.
