# H23-F3 - Validacion integral predeploy de vigencia temporal de Horarios

Fecha: 2026-08-22

Estado: **Aprobado para preparar H23-F4; migracion `015`, configuracion productiva y deploy pendientes.**

## 1. Objetivo y alcance

H23-F3 valido integralmente que la vigencia pagable del ciclo limita las ocurrencias de Horarios antes de la matematica H01. La validacion cubrio Nomina, Incidencias, Extras independientes, H20, Reportes Operativos, persistencia/cancelacion y UX.

No se aplico `015` en produccion, no se modifico la base productiva y no se hizo deploy. El ensayo con escrituras se ejecuto exclusivamente sobre una restauracion temporal aislada del backup productivo.

## 2. Git y componentes validados

- Rama: `feature/h02-h03-user-coordinations-permissions`.
- SHA funcional H23-F2: `83ef7a25fc9fa7765eff6f1619e722baa712bff3`.
- SHA documental H23-F2: `dde89e1efe55d80826702a8d70b2d11f02be2824`.
- H23-F0/F1/F2 estaban publicados y la rama estaba sincronizada al iniciar.
- Migracion prevista: `database/015_h23_cycle_base_hours_dates.sql`.

## 3. Regresion automatizada

| Validacion | Resultado |
|---|---|
| `npm run test:api` | OK, 8 archivos y 42/42 pruebas |
| `npm run test:api:integration` | OK, 16 archivos y 127/127 pruebas |
| Base de integracion | Solo `nomina_docente_test` en `localhost:5432` |
| `npm run test:web` | OK, 19 archivos y 91/91 pruebas |
| `npm run typecheck` | OK, API y web |
| `npm run build` | OK, API y web |
| `npm audit` | 0 critical, 9 high, 10 moderate, 1 low |
| `git diff --check` | OK |

No se ejecuto `npm audit fix`, no se uso `--force` y no se actualizaron dependencias.

## 4. H05

### Local/test

La suite de integracion reconstruye `nomina_docente_test` y no conserva el historial administrativo H05. Tras la suite se restablecio solo el baseline de test:

- 18 migraciones detectadas;
- 18 registradas como baseline de test;
- pendientes: 0;
- checksum mismatch: 0;
- `015` presente.

Este baseline no sustituye el ensayo real de `015`: la migracion se aplico mediante H05 sobre la restauracion productiva temporal y se verifico por separado.

### Produccion read-only

`inspect` y `status`, sin `dry-run`, confirmaron:

- 18 archivos en filesystem;
- 17 migraciones registradas en produccion;
- 15 baseline y `013`/`014` aplicadas;
- unica pendiente: `015_h23_cycle_base_hours_dates.sql`;
- checksum mismatch: 0.

La consulta se realizo en transaccion explicita read-only. Antes de `015`, produccion no tenia las columnas H23.

## 5. Resultado funcional

Configuracion ensayada para `27-1`:

```text
base_hours_start_date = 2026-08-31
base_hours_end_date   = 2026-12-12
M1                    = 2026-08-31 .. 2026-09-17
M2                    = 2026-10-24 .. 2026-12-05
```

| Caso | Resultado |
|---|---|
| Periodo especial 2026-08-10..2026-08-22 | L-V=0, S1=0, S2=0, base=0, faltas=0, retardos=0, extra de incidencia=0 |
| Extra independiente controlado | 2 h a 125 = 250; base=0 y total=250 |
| Cruce de inicio 2026-08-24..2026-09-04 | Solo ocurrencias desde 2026-08-31; 818.5 h base |
| Dentro 2026-09-07..2026-09-18 | L-V=1637, M1=259.5, base=1896.5 |
| Cruce de fin 2026-12-07..2026-12-18 | Elegible hasta 2026-12-12 inclusive; 818.5 h base |
| M1 | Aporto 259.5 h cuando intersecto |
| M2 | Aporto 209.5 h en su caso controlado |
| M1 y M2 en un mismo periodo | Ambos aportaron de forma independiente; no existe exclusion mutua |

La muestra F0 previa de 36 horas base y `$4,500.00` se conservo como evidencia historica; no fue necesario ejecutar otra vez codigo anterior.

## 6. Incidencias, persistencia y cancelacion

- Periodo sin ocurrencias: 491 filas fuera de vigencia, 0 editables y 1,473 controles deshabilitados.
- Backend: respuesta controlada `400 SCHEDULE_OUTSIDE_BASE_HOURS_PERIOD`.
- Periodo parcial: 202 filas elegibles y 606 controles editables; el modelo agregado vigente continuo operativo.
- Preview y Guardar produjeron resultados identicos en una corrida controlada temporal.
- Guardar limpio las fuentes controladas conforme al flujo vigente.
- Cancelar restauro exactamente la incidencia y el Extra independiente.
- Recalcular reprodujo el Preview con la misma vigencia.

H23 no modifica el modelo diario de Incidencias ni la semantica de cancelacion/restauracion.

## 7. H20, Reportes e historicos

- Admin y Coordinador autorizado obtuvieron 153 detalles equivalentes para la misma seleccion.
- Horas L-V, M1, M2, base y total fueron iguales; H20 solo cambio alcance/visibilidad.
- Reporte vivo y Preview coincidieron: base 0 fuera de vigencia y 1896.5 dentro.
- Export CSV: `200`, UTF-8/H11, sin encabezados fiscales.
- Export XLSX: `200`, MIME XLSX correcto, sin encabezados fiscales.
- Corridas, lineas y detalles historicos restaurados conservaron conteos y fingerprints al excluir los IDs controlados del ensayo.
- No se reescribieron snapshots.

## 8. H01 y seguridad

El diff y las regresiones confirman que permanecen intactos:

- `decimal.js` y `ROUND_HALF_UP`;
- strings monetarios y tabuladores;
- multiplicaciones y formulas de faltas, retardos y Extras;
- datos fiscales y documentos;
- permisos y rutas publicas.

H23 cambia exclusivamente la cantidad de ocurrencias temporales elegibles antes de H01.

## 9. UX local

### Calendario

- bloque `Vigencia pagable de horas base` visible;
- labels Inicio/Fin y ayuda visibles;
- M1/M2 permanecen en bloque separado;
- validaciones backend/frontend operativas;
- sin overflow global en 1440x900, 768x1024 y 390x844.

### Incidencias

- estado `Fuera de vigencia` claro y no editable;
- filas parcialmente elegibles conservan captura normal;
- tabla mantiene scroll interno;
- sin overflow global en las tres resoluciones.

Se detecto y corrigio un defecto responsive real en contenedores CSS que conservaban ancho minimo implicito. El commit tecnico `fix(h23): prevent eligibility views mobile overflow` no cambia reglas, datos ni permisos.

## 10. Plan seguro H23-F4

Orden obligatorio de la ventana productiva:

1. confirmar rama/SHA y suite verde;
2. confirmar `npm audit` con 0 critical;
3. confirmar H05 con pendiente exacta `015` y mismatch 0;
4. confirmar backup on-demand `SUCCESSFUL` y fingerprints previos;
5. aplicar `015` mediante H05;
6. confirmar 18 registradas, pendientes 0 y mismatch 0;
7. configurar inmediatamente `27-1` desde Calendario/procedimiento API aprobado con 2026-08-31..2026-12-12;
8. verificar constraints y M1/M2 sin cambios;
9. desplegar API y Hosting;
10. ejecutar healthchecks y smoke de Preview/Incidencias/Reporte vivo;
11. confirmar base 0 para 2026-08-10..2026-08-22;
12. abrir Extras solo cuando Admin lo decida y no guardar Nomina hasta validar su captura.

No debe desplegarse codigo H23 contra un ciclo `ACTIVO` con fechas base `NULL`.

## 11. Rollback preparado

- Si falla migracion/configuracion antes del deploy: no desplegar y no guardar la quincena especial.
- Si falla API/UI despues de configurar: volver API/Hosting a las revisiones anteriores; el codigo anterior ignora las columnas `015`.
- No eliminar columnas ni improvisar SQL inverso.
- Ante corrupcion inesperada: detener y restaurar mediante procedimiento DBA y backup aprobado.

## 12. Dictamen

**H23-F3 aprobado.** H23 esta validado integralmente y listo para una ventana H23-F4 controlada. Permanecen pendientes la autorizacion de la ventana, la aplicacion productiva de `015`, la configuracion productiva de `27-1`, el deploy y el smoke productivo.

Confirmaciones:

- sin migracion productiva;
- sin deploy;
- sin escritura productiva;
- sin cambios H01;
- sin modificacion de historicos ni snapshots;
- sin datos sensibles en Git.
