# H23 - Deploy productivo de vigencia temporal de Nomina

Fecha de deploy: 2026-08-22
Fecha de cierre del smoke manual: 2026-09-01
Estado final: **H23 cerrado operativo**

## 1. Objetivo

Aplicar en produccion la vigencia pagable general de horas base por ciclo, configurar el ciclo `27-1`, desplegar API y Hosting y validar que la elegibilidad temporal se resuelva antes del calculo monetario H01.

H23 no cambia tabuladores, redondeo, `decimal.js`, importes, formula H01, snapshots ni corridas historicas. M1 y M2 conservan su semantica para S1/S2 y los Extras independientes conservan su regla por fecha, quincena y ventana administrativa.

## 2. Version desplegada

| Elemento | Valor |
|---|---|
| Rama | `feature/h02-h03-user-coordinations-permissions` |
| SHA funcional/documental desplegado | `9268d429c3c8cb69f47d9ee55e8f3a8eda4a7c02` |
| Cloud Build | `4ddadeb3-4f51-4988-8824-b91e5a546863` |
| Imagen | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h23-prod-9268d42` |
| Digest | `sha256:2e6dcf48aa54669c12a3efbf738737297434a528ba9e8040d9b7fa8638130e92` |
| Revision anterior | `nomina-api-00054-2ld` |
| Revision vigente | `nomina-api-00055-8wn` |
| Trafico | 100% a `nomina-api-00055-8wn` |
| Hosting release anterior | `1785536172540000` |
| Hosting version anterior | `91ba12f3159468b8` |
| Hosting release vigente | `1787419305880000` |
| Hosting version vigente | `07924eeeb7713f30` |

## 3. Regresion final

| Validacion | Resultado |
|---|---|
| API | 8 archivos, 42/42 pruebas |
| Integracion PostgreSQL | 16 archivos, 127/127 pruebas |
| Base de integracion | Exclusivamente `nomina_docente_test` |
| Web | 19 archivos, 91/91 pruebas |
| Typecheck | OK |
| Build | OK |
| npm audit | 0 critical, 9 high, 10 moderate, 1 low |

No se ejecuto `npm audit fix` ni `--force`.

## 4. H05 antes del apply

La inspeccion productiva se realizo por Cloud SQL Auth Proxy contra:

- proyecto `nomina-docente-prod`;
- instancia `nomina-docente-web`;
- base `nomina_docente`;
- usuario aplicativo `app_nomina`.

Resultado previo:

- 18 archivos SQL en filesystem;
- 17 migraciones registradas;
- pendiente unica `015_h23_cycle_base_hours_dates.sql`;
- `checksum mismatch=0`.

## 5. Baseline productivo fresco

La lectura se realizo dentro de una transaccion `READ ONLY`. No se uso el conteo del backup temporal de H23-F3 porque produccion siguio operando.

| Entidad | Conteo |
|---|---:|
| Docentes | 240 |
| Horarios totales | 1,110 |
| Horarios del ciclo 27-1 | 515 |
| Docentes con horario en 27-1 | 109 |
| Quincenas/configuraciones | 8 |
| Incidencias | 0 |
| Extras | 0 |
| Corridas | 11 |
| Lineas de Nomina | 2,460 |
| Snapshots de horarios | 6,522 |
| Snapshots de extras | 672 |
| Documentos docentes | 15 |

Para la quincena especial `2026-08-10` a `2026-08-22` se confirmaron cero incidencias, cero Extras, cero corridas no canceladas y cero snapshots asociados.

Fingerprints previos registrados:

| Proyeccion | Fingerprint |
|---|---|
| Ciclos, excluyendo los nuevos campos H23 | `de27365e709d9c9cc9d60861c0522522` |
| Calendario | `9dad74da3f5fa012111cee35b8b8e983` |
| Dias inhabiles | `d41d8cd98f00b204e9800998ecf8427e` |
| Horarios | `45e69974e3a7a5f9ea63314023ea3ede` |
| Incidencias | `d41d8cd98f00b204e9800998ecf8427e` |
| Extras | `d41d8cd98f00b204e9800998ecf8427e` |
| Corridas | `8904f8b83e848c0d5a6428471fe0bcea` |
| Lineas | `e8ed9ec63931ee9094c5d7e0fb28b848` |
| Snapshots horarios | `254bd38297337774e385099fdd6ba886` |
| Snapshots extras | `ef027060470ac4d32f75345c767b0623` |
| Proyeccion fiscal anonimizada | `e6ed6e86ec399bfb6244bb2592ded491` |
| Documentos docentes | `5f1e057950858f7d5f067f780427b245` |

Durante la ventana hubo actividad normal de usuarios sobre Horarios. Se registraron eventos `SCHEDULE_UPDATED` ajenos a las rutas H23; por ello el fingerprint de Horarios evoluciono sin cambio de conteo atribuible al deploy. H23 no llamo endpoints de escritura de Horarios.

## 6. Backup Cloud SQL

| Elemento | Valor |
|---|---|
| Backup ID | `1787418742938` |
| Tipo | On-demand |
| Estado | `SUCCESSFUL` |
| Proyecto | `nomina-docente-prod` |
| Instancia | `nomina-docente-web` |
| Inicio UTC | `2026-08-22T17:12:22.945Z` |
| Fin UTC | `2026-08-22T17:13:54.250Z` |

## 7. Migracion 015

La migracion se aplico exclusivamente mediante el comando oficial H05. No se ejecuto el SQL de forma directa.

| Elemento | Resultado |
|---|---|
| Version | `015_h23_cycle_base_hours_dates` |
| Checksum SHA-256 | `7072838d32963a7f8e0aaaea4c82b147ad3179d3ecd4e9b6aebfba078686f7a6` |
| Run H05 | 96 |
| Estado | `success` / `applied` |
| Duracion registrada | 233 ms |

Resultado H05 posterior:

- 18 registradas;
- 15 baseline;
- `013`, `014` y `015` aplicadas;
- `pending=0`;
- `checksum mismatch=0`.

Se confirmaron las columnas `base_hours_start_date` y `base_hours_end_date`, y los constraints:

- `academic_cycles_base_hours_dates_pair_chk`;
- `academic_cycles_modules_within_base_hours_chk`.

La migracion no hizo backfill ni modifico ciclos historicos, Horarios, Incidencias, Extras, Nomina o snapshots.

## 8. Configuracion del ciclo 27-1

Antes del deploy se uso la ruta Admin vigente de Calendario y se obtuvo HTTP 200.

| Campo | Valor productivo |
|---|---|
| Ciclo | `27-1` |
| Estado | `ACTIVO` |
| Inicio horas base | `2026-08-31` |
| Fin horas base | `2026-12-12` |
| M1 | `2026-08-31` a `2026-09-17` |
| M2 | `2026-10-24` a `2026-12-05` |

M1/M2 quedaron completamente contenidos, no cambiaron sus valores y ningun otro ciclo recibio fechas H23. La evidencia quedo en `audit_log` con `CYCLE_MODULE_DATES_UPDATED`.

## 9. Deploy y healthchecks

La configuracion de Cloud Run se conservo: service account, Cloud SQL, variables, secreto, CORS, CPU 1, memoria 512 MiB, concurrencia 80, timeout 300 s, min 0, max 3, ingress y acceso sin autenticacion a nivel infraestructura con autorizacion aplicada por la API.

Resultados:

- Cloud Run directo `/api/health`: HTTP 200;
- Hosting `/api/health`: HTTP 200;
- raiz Hosting: HTTP 200;
- `/api/payroll/preview` sin sesion: HTTP 401 esperado;
- contexto de Incidencias sin sesion: HTTP 401 esperado;
- logs `severity>=ERROR` de `nomina-api-00055-8wn`: 0.

No fue necesario rollback. La revision `nomina-api-00054-2ld` y el release Hosting anterior se conservan como recursos de rollback.

## 10. Smoke autenticado

### 10.1 Calendario Admin

El usuario confirmo manualmente:

- bloque `Vigencia pagable de horas base` visible;
- inicio `31/08/2026` y fin `12/12/2026` correctos;
- M1/M2 sin cambios;
- ayuda y validaciones visibles;
- comportamiento responsive correcto.

No se volvio a guardar el ciclo durante el smoke manual.

### 10.2 Preview 10/08/2026 a 22/08/2026

El smoke autenticado de solo lectura obtuvo HTTP 200 y:

| Concepto | Resultado |
|---|---:|
| L-V | 0 |
| M1 | 0 |
| M2 | 0 |
| Base | 0 |
| Faltas | 0 |
| Retardos | 0 |
| Extra de incidencia | 0 |
| Extra independiente existente | 0 |
| Total | 0 |

La respuesta contenia 155 lineas y 515 detalles de horario, todos anulados temporalmente. Solo se ejecuto Preview; no se uso `Guardar nomina`.

### 10.3 Incidencias

- 97 filas visibles quedaron `Fuera de vigencia`;
- cero filas editables;
- backend y UI conservaron el bloqueo;
- no se creo ni modifico ninguna incidencia.

### 10.4 Reporte Operativo vivo

- JSON HTTP 200;
- 155 filas con horas base e incidencia en cero;
- CSV HTTP 200, 26,351 bytes;
- XLSX HTTP 200, 13,630 bytes;
- sin encabezados RFC, banco, CLABE, `paymentType` o constancias;
- paridad con Preview confirmada.

No se modificaron reportes snapshot.

### 10.5 Quincena dentro de vigencia

Para el periodo de smoke `2026-09-07` a `2026-09-18`:

- L-V continuo operativo;
- M1 aporto cuando correspondia;
- M2 no aporto fuera de su rango;
- 1,691 horas L-V;
- 280.5 horas M1;
- 1,971.5 horas base totales;
- total calculado `$255,507.50`;
- H01 permanecio sin cambios.

No se guardo la corrida.

### 10.6 Regresion H20

Admin y Coordinador obtuvieron el mismo agregado por docente autorizado para ocurrencias, horas base, extras y total. El Coordinador conservo solo su alcance read-only; no obtuvo finalizacion ni datos fiscales.

### 10.7 Responsive

El usuario aprobo Calendario e Incidencias en:

- 1440 x 900;
- 768 x 1024;
- 390 x 844.

No se observaron overflow global, controles inutilizables ni mensajes ocultos.

## 11. Validacion posterior

Se confirmo por lectura:

- ciclo `27-1` con las dos fechas aprobadas y sin fechas parciales;
- ningun otro ciclo configurado por H23;
- mismos conteos de docentes, calendario, Incidencias, Extras, corridas, lineas, snapshots y documentos;
- cero corridas y snapshots para la quincena especial;
- ninguna corrida creada desde el 2026-08-14;
- ninguna escritura de Extras;
- unicamente la configuracion H23 y su auditoria como cambios de esta fase.

La operacion productiva de Horarios continuo durante la ventana y se documento separadamente de H23. No se imprimieron datos personales ni fiscales en la evidencia.

## 12. Extras propedeuticos

La ventana de Extras `2026-08-10` a `2026-08-22` **no fue abierta automaticamente** y no se capturaron propedeuticos durante el deploy.

Su reapertura, si operacion la requiere, es una accion administrativa posterior de Admin desde Calendario. Los Extras independientes permanecen permitidos por su fecha/quincena/ventana y no por la vigencia general de horas base.

## 13. Rollback

- API: regresar trafico a `nomina-api-00054-2ld`.
- Hosting: restaurar release `1785536172540000`, version `91ba12f3159468b8`.
- Base: conservar columnas, constraints y fechas; el codigo anterior las ignora.
- Corrupcion: detener operacion y restaurar solo mediante procedimiento DBA aprobado usando backup `1787418742938`.

No se improvisara SQL inverso ni se eliminaran columnas H23.

## 14. Confirmaciones finales

- H23 queda cerrado operativo.
- Migracion `015` aplicada exclusivamente mediante H05.
- Vigencia productiva `27-1`: `2026-08-31` a `2026-12-12`.
- Quincena especial con base e incidencias en cero.
- H01 intacto.
- Cancelar/restaurar permanece protegido por regresion automatizada; no se cancelo una corrida productiva durante el smoke.
- Extras independientes preservados.
- Snapshots y corridas historicas intactos.
- Sin Guardar Nomina durante el smoke.
- Sin captura de propedeuticos.
- Sin cambios fiscales.
- Sin rollback.
