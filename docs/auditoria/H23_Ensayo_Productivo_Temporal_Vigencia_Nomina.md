# H23 - Ensayo productivo temporal de vigencia de Nomina

Fecha: 2026-08-22

Estado: **Ensayo aprobado; instancia temporal eliminada.**

## 1. Aislamiento y backup

Se creo un backup on-demand antes del ensayo:

| Elemento | Valor |
|---|---|
| Proyecto | `nomina-docente-prod` |
| Instancia origen | `nomina-docente-web` |
| Base protegida | `nomina_docente` |
| Backup ID | `1787413358689` |
| Descripcion | `H23-F3 rehearsal predeploy 2026-08-22` |
| Inicio UTC | `2026-08-22T15:42:38.697Z` |
| Fin UTC | `2026-08-22T15:44:10.001Z` |
| Estado | `SUCCESSFUL` |
| Operacion | `b3295d36-f539-4f8f-ad47-fbe000000032` |

La restauracion se realizo en `h23-rehearsal-20260822`, PostgreSQL 18, `us-central1-a`, sin redes autorizadas y mediante Cloud SQL Auth Proxy local. La operacion de restauracion `ca5e88ce-cf97-487a-bde3-df2f00000032` finalizo `DONE` a `2026-08-22T16:04:19.43Z`.

Antes de escribir se confirmo la base restaurada, el usuario y el proxy `127.0.0.1:25440`. No se reutilizo la conexion productiva.

## 2. Evidencia productiva previa read-only

- Ciclo `27-1`: UUID `aece7cdb-c99a-4655-9adb-bf21b36de987`, estado `ACTIVO`.
- M1: 2026-08-31..2026-09-17.
- M2: 2026-10-24..2026-12-05.
- Quincena especial: UUID `3d73953c-555d-459f-89c4-fd32e46bd4e2`, 2026-08-10..2026-08-22.
- En el punto del backup: 1,086 horarios totales, 491 del ciclo y 106 docentes con horario.
- Quincena especial: 0 incidencias, 0 Extras independientes, 0 blackouts, 0 corridas no canceladas y 0 snapshots relacionados.
- Las columnas `base_hours_start_date` y `base_hours_end_date` no existian.

Solo se registraron conteos y hashes; no se expusieron identidades ni datos fiscales.

## 3. Fingerprints previos

| Entidad/proyeccion | Filas | MD5 |
|---|---:|---|
| `academic_cycles` | 2 | `7cf49a099d77cab4171400c8d039f635` |
| `payroll_calendar_config` | 8 | `ce33278a064bff0f4560e38f932625c7` |
| `calendar_blackout_dates` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `schedules` | 1086 | `34156411e80c30b1dfabdea5ab8adcae` |
| `schedule_incidences` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `extra_hours` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `payroll_runs` | 11 | `041fde6ea445e65670c6e583fd8ef532` |
| `payroll_lines` | 2460 | `9cd7187c0b0a5fb36e4b2e3f096988e1` |
| `payroll_schedule_details` | 6522 | `26bc8e767d7a2a31f9f1d1969594068e` |
| `payroll_extra_details` | 672 | `3c7bd689e1e4c63a4c6104613f2699b9` |
| Proyeccion fiscal anonimizada de `teachers` | 239 | `d4933f154a25d3c71e21d2428a7ebd4d` |
| `teacher_documents` | 15 | `517c8350a9273f3bad43252187863a22` |

## 4. Migracion 015 en temporal

La migracion se aplico exclusivamente mediante H05. Checksum SHA-256:

`7072838D32963A7F8E0AAAEA4C82B147AD3179D3ECD4E9B6AEBFBA078686F7A6`

Resultado:

- 18 migraciones registradas;
- 15 baseline y 3 aplicadas (`013`, `014`, `015`);
- pending=0;
- checksum mismatch=0;
- columnas `date` nullable creadas;
- constraints `academic_cycles_base_hours_dates_pair_chk` y `academic_cycles_modules_within_base_hours_chk` presentes;
- cero DML y cero filas de ciclo modificadas por la migracion;
- fingerprints funcionales existentes sin cambios.

## 5. Configuracion temporal 27-1

La configuracion se envio por la ruta real Admin `PATCH /api/calendar/cycles/:id/modules`:

```text
base_hours_start_date = 2026-08-31
base_hours_end_date   = 2026-12-12
```

La API respondio 200. M1, M2 y `status=ACTIVO` permanecieron iguales. La unica diferencia funcional intencional fue la vigencia base del ciclo.

## 6. Pruebas de calculo

| Periodo/caso | L-V | M1 | M2 | Base | Resultado |
|---|---:|---:|---:|---:|---|
| 2026-08-10..2026-08-22 | 0 | 0 | 0 | 0 | Caso obligatorio aprobado |
| 2026-08-24..2026-09-04 | 818.5 | 0 | 0 | 818.5 | Inicio inclusivo desde 31/08 |
| 2026-09-07..2026-09-18 | 1637 | 259.5 | 0 | 1896.5 | Periodo dentro/M1 |
| 2026-12-07..2026-12-18 | 818.5 | 0 | 0 | 818.5 | Fin inclusivo hasta 12/12 |
| M2 2026-10-19..2026-10-30 | 1637 | 0 | 209.5 | 1846.5 | M2 independiente |
| 2026-09-10..2026-11-02 | 6215.5 | 259.5 | 419 | 6894 | M1 y M2 suman independientemente |

En el periodo especial hubo 141 lineas y 491 detalles, todos con `grossBaseAmount=0`, faltas=0, retardos=0 y extra de incidencia=0.

El Extra independiente controlado de 2 horas a tarifa 125 produjo exactamente `$250.00`: base 0, extra 250 y total 250. El fixture se elimino al terminar.

## 7. Flujos relacionados

- Incidencias sin ocurrencias: API 400 `SCHEDULE_OUTSIDE_BASE_HOURS_PERIOD`; UI no editable.
- Incidencias parciales: captura agregada vigente permitida.
- Preview=Guardar: confirmado con fixture controlado.
- Cancelar: restauro 1 falta, 1 retardo, 0.5 h de incidencia y 1.5 h/$187.50 de Extra independiente.
- Recalcular: igual al Preview original.
- H20 Admin/Coordinador: 153 detalles equivalentes y mismos totales.
- Reporte vivo: igual a Preview dentro y fuera de vigencia.
- CSV/XLSX: respuestas 200, formatos correctos y sin campos fiscales.

## 8. Integridad posterior

Excluyendo los IDs controlados del ensayo, se conservaron exactamente:

- `payroll_runs`: 11 / `041fde6ea445e65670c6e583fd8ef532`;
- `payroll_lines`: 2460 / `9cd7187c0b0a5fb36e4b2e3f096988e1`;
- `payroll_schedule_details`: 6522 / `26bc8e767d7a2a31f9f1d1969594068e`;
- `payroll_extra_details`: 672 / `3c7bd689e1e4c63a4c6104613f2699b9`;
- `schedules`: 1086 / `34156411e80c30b1dfabdea5ab8adcae`;
- proyeccion fiscal anonimizada: 239 / `d4933f154a25d3c71e21d2428a7ebd4d`;
- documentos: 15 / `517c8350a9273f3bad43252187863a22`.

El fingerprint completo de calendario cambio por `updated_at` y fixtures controlados; su proyeccion funcional, excluyendo metadatos temporales, coincidio con produccion. Durante el ensayo la operacion productiva continuo: una lectura posterior mostro 1,112 horarios y 240 docentes, frente a 1,086/239 del backup. Esta diferencia es posterior al backup y no fue causada por H23.

## 9. Limpieza

- API local, web local y ambos Auth Proxy fueron detenidos.
- Puertos 25439, 25440, 8081 y 5174 quedaron cerrados.
- El arnes temporal no permanece en Git.
- La instancia `h23-rehearsal-20260822` fue eliminada.
- No se almacenaron dumps ni datos productivos en el repositorio.

## 10. Conclusion

El ensayo confirma que H23 produce base e incidencias cero antes de la vigencia, conserva Extras independientes, prorratea correctamente en fronteras inclusivas, mantiene Preview=Guardar/Cancelar/Recalcular y no altera H01 ni historia. La migracion y el deploy productivos siguen pendientes de H23-F4.
