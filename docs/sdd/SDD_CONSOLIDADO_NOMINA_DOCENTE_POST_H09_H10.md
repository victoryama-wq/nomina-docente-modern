# SDD Consolidado Nomina Docente Post H09/H10

Fecha de consolidacion: 2026-06-02
Ultima actualizacion: 2026-10-27

Este documento consolida el estado vigente del sistema Nomina Docente despues del cierre operativo de H01, H02/H03, H04-F5, H05, H06/H14 y H09/H10. A partir de H11, Codex debe usar este documento como primera fuente documental, junto con la matriz formal de riesgos y los documentos especificos de la fase en curso.

## 1. Estado productivo actual

| Elemento | Estado vigente |
|---|---|
| Produccion | `https://nomina-docente-prod.web.app` |
| API Cloud Run publica | `https://nomina-api-443985127112.us-central1.run.app` |
| API via Hosting | `https://nomina-docente-prod.web.app/api/health` |
| Proyecto Firebase/GCP | `nomina-docente-prod` |
| Cloud Run | Servicio `nomina-api`, region `us-central1` |
| Revision Cloud Run vigente documentada | `nomina-api-00057-c7d` |
| Revision Cloud Run anterior / rollback inmediato | `nomina-api-00056-mll` |
| Imagen API vigente | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:finance-b3f40ce` |
| Digest API vigente | `sha256:a7d0de2196c5552d50cd75b8f01e15238dc90f701941b8656613bf6d1789196b` |
| Recursos Cloud Run | CPU `1`, memoria `512Mi`, concurrencia `80`, timeout `300 s`, min `0`, max `3` |
| Firebase Hosting | Sitio `nomina-docente-prod`, canal `live` |
| Firebase Hosting release vigente | `1793121624438000` |
| Firebase Hosting version vigente | `3f9ebc88c835a143` |
| Base activa | Cloud SQL PostgreSQL, base `nomina_docente` |
| Bucket constancias | `nomina-docente-prod-constancias` |
| Service account API | `nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com` |
| Fallback H02 | `LEGACY_COORDINATION_FALLBACK_ENABLED=true`, en monitoreo |
| Control H05 productivo | 18 registradas: 15 baseline y `013`/`014`/`015` aplicadas; `pending=0`; `checksum mismatch=0` |

Estado por H:

| H | Estado vigente |
|---|---|
| H01 | Cerrado. Precision monetaria protegida con `decimal.js`, strings decimales y pruebas de regresion. |
| H02 | Cerrado operativo; `user_coordinations` existe, pero el fallback legacy sigue activo en monitoreo. |
| H03 | Cerrado operativo, incluido el ajuste de comprobante consolidado y nombre docente desplegado en `nomina-api-00057-c7d` y Hosting live. Healthchecks OK; smoke autenticado del PDF y nombres por rol aprobado por el usuario. Ver `docs/auditoria/H03_Deploy_Finanzas_Comprobantes_Consolidados.md`. |
| H04 | Implementado hasta Fase 5; H04-F6 Playwright queda opcional posterior. |
| H05 | Cerrado con tablas de control; produccion conserva 15 baseline y migraciones `013`/`014`/`015` aplicadas, `pending=0` y `checksum mismatch=0`. |
| H06/H14 | Cerrado; `Codigo.gs` e `index.html` fueron retirados del repositorio. |
| H09/H10 | Desplegado en produccion el 2026-06-01; estados financieros seguros, `PLANEACION`, cierre controlado y frontend vigentes. |
| H11 | Cerrado operativo; exportables CSV criticos backend/frontend estandarizados con BOM UTF-8 y validados en Excel institucional. |
| H12 | Cerrado documental; politica operativa de catalogos historicos definida sin cambios tecnicos. |
| H13 | Cerrado documental; checklist productivo permanente de variables, secretos, CORS, healthchecks, deploy y rollback. |
| H15 | Desplegado en produccion; `browserSessionPersistence`, timeout 60 min, modal 5 min antes y logout por inactividad vigentes. |
| H17 | Normalizacion productiva ejecutada para 197 docentes; Directorio mantiene edicion por `teachers.created_by`; 12 remanentes documentados. |
| H18 | Cerrado operativo en `nomina-api-00056-mll` y Hosting live; quincena obligatoria, paridad temporal H23, sobrecarga real y consolidacion multicoordinacion disponibles. Smoke tecnico, autenticado y exportables aprobados. |
| H19 | Ejecutado de forma controlada; 36 docentes existentes actualizaron `created_by` y se registraron 3 altas minimas, con backup, preview y validacion sin duplicados. |
| H20 | Cerrado operativo; preview read-only de Coordinador resuelve docentes por `teachers.created_by` o carga en `actorCoordinations[]`, calcula su carga completa entre coordinaciones y fue validado productivamente. |
| H21 | Cerrado operativo; migracion `013`, conciliacion de cinco pares/8 horarios, API/Hosting y smoke autenticado Catalogos/Horarios aprobados. CSV institucional definitivo no aplicado. |
| H22 | Cerrado operativo; migracion `014`, API `nomina-api-00054-2ld`, Hosting live y smoke autenticado aprobados. Una ejecucion autorizada creo 14 docentes; HF1B muestra su responsable real desde `teachers.created_by` sin repetir Apply. |
| H23 | Cerrado operativo; `015` aplicada mediante H05, ciclo `27-1` configurado `2026-08-31` a `2026-12-12`, API/Hosting desplegados y smoke productivo aprobado. H01, Extras independientes, snapshots e historicos permanecen intactos. |
| H07 | Pendiente opcional; evaluar `hd` de Google como mejora UX, no como control de seguridad principal. |
| H08 | Pendiente; refactor gradual despues de preservar pruebas. |

Ultimos hitos productivos relevantes:

- H02/H03 deploy productivo: codigo y migracion 011 aplicados; no se importaron datos locales/revision a produccion en ese deploy.
- Datos oficiales mayo 2026: Directorio/Horarios/Datos oficiales migrados de forma controlada y conciliados.
- Nomina `2026-05-15 a 2026-05-28`: guardada correctamente por `$517,510.00`.
- H05 baseline productivo: migraciones `001` a `012` registradas como baseline sin reaplicar SQL historico.
- H09/H10 deploy productivo: revision `nomina-api-00045-v8h`, Hosting live confirmado, sin migracion 013 y sin modificacion de Cloud SQL salvo backup preventivo.
- H11-F5 deploy productivo: revision `nomina-api-00046-6ck`, Hosting live confirmado, sin migracion y sin cambios de datos; smoke CSV autorizado aprobado en Excel institucional.
- H15 deploy productivo: Hosting live confirmado el 2026-06-03 15:16:08, sin despliegue API, sin migracion y sin cambios de datos; smoke minimo de sesion/logout aprobado.
- H17 Directorio: se descarto correccion por coordinacion; se normalizaron 197 docentes en `teachers.created_by` con backup y mapping aprobado; quedan 12 remanentes documentados.
- H18 Reportes Operativos: deploy productivo API/Hosting ejecutado el 2026-07-08; API revision `nomina-api-00048-js8`, Hosting live `2026-07-08 12:33:41`, sin migraciones ni cambios de BD; smoke tecnico OK.
- H18-F6 Reportes Operativos: deploy productivo ejecutado el 2026-07-09; API revision `nomina-api-00049-2hn`, Hosting live `2026-07-09 13:11:55`, filtros con ciclos/quincenas legibles y busqueda general en vez de IDs tecnicos.
- H18 hotfix snapshot: deploy productivo API ejecutado el 2026-07-09; API revision `nomina-api-00050-zdm`, sin deploy Hosting, sin migraciones, sin cambios de BD; corrige `ped.line_key`; cierre operativo validado en Excel institucional.
- H18 ajuste post-H23: cerrado operativo el 2026-09-10 en `nomina-api-00056-mll` y Hosting release `1789068812732000`; exige quincena del ciclo activo, usa `source=auto`, calcula base neta con faltas y `0.5` horas por retardo, marca sobrecarga quincenal `70/50/30`, consolida carga semanal entre coordinaciones y limita ambas pestanas a Admin/Direccion/Coordinador. Sin migracion ni cambios de BD; smoke tecnico, autenticado y exportables aprobados.
- H19 Directorio Docentes: backup `1783642001652`, preview exacto en `ROLLBACK`, 36 UPDATE de `teachers.created_by` y 3 INSERT minimos; 7 de los 10 sin match nominal ya existian, 3 fueron nuevas altas y no se crearon duplicados.
- H20 Nomina compartida: deploy productivo ejecutado el 2026-07-16; API revision `nomina-api-00051-9s5`, Hosting release `1784228039752000`; smoke autenticado Coordinador/Admin aprobado, sin migracion, escritura de Nomina ni cambio H01.
- H21 Asignaturas: backup `1784582556252`, migracion `013` aplicada con H05, ocho horarios conciliados sin tocar snapshots y deploy `nomina-api-00052-xtm` / Hosting `1784583329978000`; smoke autenticado Catalogos/Horarios aprobado.
- H22 Importacion de docentes: backup `1785456525085`, migracion `014`
  aplicada por H05, deploy `nomina-api-00053-cjg` / Hosting
  `1785457082597000`, smoke autenticado Admin/no Admin y responsive aprobado;
  sin Apply ni CSV institucional aplicado.
- H22-HF1B Responsable operativo: deploy `nomina-api-00054-2ld` / Hosting
  `1785536172540000`; smoke autenticado confirmo los 14 responsables reales
  desde `teachers.created_by`, sin correcciones de BD, Apply, migracion ni
  exposicion fiscal.
- H23 vigencia temporal: backup `1787418742938`, migracion `015` aplicada por
  H05, ciclo `27-1` configurado `2026-08-31` a `2026-12-12`, deploy
  `nomina-api-00055-8wn` / Hosting `1787419305880000`; smoke de Calendario,
  Preview, Incidencias, Reporte vivo, H20 y responsive aprobado sin guardar
  Nomina ni capturar propedeuticos.

## 2. Arquitectura vigente

Arquitectura productiva:

- Frontend: Vue 3 + Vite + TypeScript, publicado en Firebase Hosting.
- Autenticacion: Firebase Auth con Google.
- Backend: Fastify + TypeScript, desplegado en Cloud Run.
- Base de datos: PostgreSQL en Cloud SQL.
- Storage: Cloud Storage para constancias fiscales.
- API: Firebase Hosting reescribe `/api/**` hacia Cloud Run `nomina-api`.
- Migraciones: H05 controla `database/*.sql` con `schema_migrations`, `schema_migration_runs` y `tools/migrate-db.ts`.
- Pruebas: H04 usa Vitest, `app.inject()`, PostgreSQL real de test y pruebas frontend con Vue Test Utils.

Principios vigentes:

- PostgreSQL/Cloud SQL es la fuente de verdad de datos operativos.
- Firebase Auth autentica; la autorizacion se resuelve en API con `app_users`, roles, permisos y alcance.
- La UI no sustituye validacion backend.
- No se debe ejecutar migracion productiva sin H05, backup y confirmacion manual.
- No se deben usar datos locales/test/seeds como fuente productiva salvo procedimiento de migracion aprobado.

## 3. Reglas funcionales vigentes

### 3.1 Nomina / H01

Reglas vigentes:

- `decimal.js` es la base para calculos monetarios criticos.
- Los importes criticos viajan como string decimal (`MoneyString`).
- PostgreSQL `numeric` debe conservarse como string en puntos criticos.
- No usar `number`, `parseFloat`, `Number()` ni `numeric::float8` para calculos oficiales de dinero.
- Redondeo: `ROUND_HALF_UP` cuando hay mas de dos decimales.
- Formula vigente: el total resulta de base neta mas extras, restando faltas y retardos segun reglas actuales.
- H01 no debe modificarse al tocar CSV, permisos, estados o UI.

Documentos vigentes:

- `docs/auditoria/H01_Cierre_Hotfix_Precision_Monetaria.md`
- `docs/auditoria/H04_Fase4_Pruebas_Negocio_Backend.md`

### 3.2 Usuarios, roles y coordinacion / H02

Reglas vigentes:

- La relacion formal de alcance operativo es `user_coordinations`.
- El contexto frontend/API debe exponer y usar `actorCoordinations[]` cuando aplique.
- `actorCoordination` singular queda solo como compatibilidad temporal si existe.
- No se deben crear coordinaciones automaticamente desde flujos operativos.
- El fallback legacy no crea coordinaciones y permanece instrumentado.
- El responsable operativo para Horarios/Extras es usuario/capturador operativo activo, no el nombre de catalogo de `coordinations`.
- Para usuarios no admin, el responsable operativo se muestra en modo solo lectura cuando corresponde.
- `created_by` y `captured_by` son relevantes para propiedad de registros.
- Docentes pueden estar relacionados operativamente con varios coordinadores por capturas, sin otorgar edicion global.
- En Directorio, `teachers.created_by` es la fuente tecnica de capturador para edicion por coordinador; no existe `teachers.captured_by` y no basta con pertenecer a la coordinacion.
- En Directorio, Coordinador puede consultar todos los docentes en modo lectura mediante detalle operativo, incluyendo datos de contacto como correo y telefono; la edicion sigue limitada al capturador y los datos fiscales siguen separados por permisos.
- En Extras, Direccion/Subdireccion puede ver listado y modificar solo extras capturados por el actor cuando backend lo permite.

Reglas de captura vigentes:

- Coordinador no debe crear/editar fuera de su alcance operativo.
- Admin conserva alcance global.
- Direccion/Subdireccion usa rol tecnico `direccion`.
- Contabilidad se comporta como Contador.

Documentos vigentes:

- `docs/auditoria/H02_H03_Deploy_Productivo_Resultado.md`
- `docs/auditoria/H02_H03_Migracion_Productiva_Datos_Oficiales_Mayo_2026.md`
- `docs/auditoria/H02_H03_Ajuste_Docentes_Compartidos.md`
- `docs/auditoria/H02_H03_Incidente_Login_Local_Firebase_UID_20260601.md`
- `docs/auditoria/H02_H03_Fase2_Auth_Context.md`
- `docs/auditoria/H02_H03_Fase3_Modulos_Operativos.md`
- `docs/auditoria/H02_H03_Fase5_Frontend_Permisos.md`
- `docs/auditoria/H17_Diagnostico_Directorio_Capturador_Docente.md`
- `docs/auditoria/H17_Plan_Normalizacion_CreatedBy_Directorio.md`
- `docs/auditoria/H17_Validacion_CSV_CreatedBy_Directorio.md`
- `docs/auditoria/H17_Normalizacion_CreatedBy_Directorio_Resultado.md`
- `docs/auditoria/H17_Ajuste_Directorio_Consulta_Coordinador.md`

### 3.3 Fiscal, Finanzas y Workflow / H03

Permisos vigentes:

| Permiso | Uso vigente |
|---|---|
| `fiscal.view` | Ver expediente fiscal y datos fiscales autorizados. |
| `fiscal.manage` | Editar RFC, correo fiscal, banco/datos bancarios y tipo de pago. |
| `fiscal.document.view` | Ver/descargar constancias/documentos fiscales. |
| `fiscal.document.manage` | Subir/reemplazar constancias/documentos fiscales. |
| `finance.view` | Consulta financiera. No habilita fiscal, export ni workflow. |
| `finance.export` | Exportaciones CSV/PDF financieras autorizadas. |
| `finance.workflow` | Aprobar, marcar pagada, cancelar y cambiar estados financieros permitidos. |
| `payroll.preview` | Calculo vivo/preview de nomina; tambien habilita contexto de Finanzas de solo lectura limitado a coordinaciones, sin export ni workflow. |
| `payroll.finalize` | Guardar corrida de nomina. |

Reglas por rol:

- Admin: acceso global, fiscal/documentos, finanzas, workflow y guardado de nomina.
- RH: fiscal/documentos; no workflow financiero.
- Finanzas: fiscal/documentos, finance view/export/workflow; no guarda nomina salvo permiso explicito `payroll.finalize`.
- Coordinador: preview de nomina por alcance operativo y Finanzas con nombres de las lineas de sus coordinaciones; no fiscal, constancias, finanzas global, export financiero, guardado ni workflow.
- Direccion/Subdireccion: Finanzas global con nombres y PDF por coordinaciones autorizado; reportes/detalle sin fiscal sensible; no fiscal manage ni workflow.
- Contador/Contabilidad: consulta con nombres y export financiero autorizado; no fiscal manage ni workflow.

Identidad y comprobantes en Finanzas, ajuste productivo 2026-10-27:

- Admin, Coordinador, Direccion/Subdireccion, Finanzas y Contador/Contabilidad ven el nombre docente dentro de su alcance; no se sustituye por RFC ni depende del permiso fiscal.
- La columna fiscal y sus datos conservan permisos separados. RH no accede al contexto financiero por disponer solo de permisos fiscales.
- Coordinador recibe las lineas de `actorCoordinations[]`; se conserva el fallback legacy vigente cuando corresponde y se excluyen corridas sin lineas visibles. No se amplian automaticamente al alcance compartido H20 del preview.
- PDF de efectivo: una salida por `teacher_id` dentro de una corrida/quincena guardada, filtrando `payment_type_snapshot = 'E'` y sumando los `total_amount` con los helpers decimales existentes. Los extras ya estan incluidos: no se suman dos veces ni se recalculan desde datos vivos.
- El comprobante elimina Coordinacion y conserva quincena, nombre, total consolidado, fecha de emision y firma; dos comprobantes por hoja carta. El contador de efectivo es por docente, no por linea.
- No se mezclan corridas ni tipos de pago; solo se consolida la presentacion/exportacion. H01, importes guardados, snapshots, workflow y reglas de cancelacion permanecen intactos. Descargar el PDF no registra el pago.
- `finance.export` y las restricciones de consulta global siguen controlando la descarga. Ver nombres no concede exportacion, fiscal, edicion ni cambios de estado.

Reglas sensibles:

- `paymentType`, RFC, correo fiscal y banco/datos bancarios son datos fiscal-financieros sensibles.
- `POST /teachers` y `PATCH /teachers` deben bloquear intentos de establecer datos fiscales si el actor no tiene `fiscal.manage`.
- `teachers.manage` no habilita fiscal.
- `reports.view` no habilita constancias.
- `finance.view` no habilita fiscal ni workflow.

Documentos vigentes:

- `docs/auditoria/H02_H03_Fase4_Fiscal_Finanzas_Nomina_Preview.md`
- `docs/auditoria/H02_H03_Fase5_Frontend_Permisos.md`
- `docs/auditoria/H02_H03_Deploy_Productivo_Resultado.md`
- `docs/auditoria/H03_Ajuste_Finanzas_Comprobantes_Efectivo_Nombre_Docente.md`
- `docs/auditoria/H03_Deploy_Finanzas_Comprobantes_Consolidados.md`

### 3.4 Pruebas / H04

Estado vigente:

- Vitest es el runner principal.
- API se prueba con Fastify `app.inject()`.
- Pruebas de integracion usan PostgreSQL real local/test: `nomina_docente_test`.
- No se usa Firebase real para pruebas unitarias/integracion.
- Existen fixtures de actores para Admin, Coordinador, RH, Finanzas, Direccion, Contador y Contabilidad.
- H04 cubre backend H01/H02/H03 y frontend de permisos/visibilidad hasta Fase 5.
- H04-F6 Playwright queda opcional posterior, no requerido para continuar H11.

Comandos relevantes:

```powershell
npm run test
npm run test:api
npm run test:api:integration
npm run test:web
npm run typecheck
npm run build
```

Documentos vigentes:

- `docs/auditoria/H04_Fase1_Infraestructura_Testing.md`
- `docs/auditoria/H04_Fase2_Fixtures_Seed_Testing.md`
- `docs/auditoria/H04_Fase3_API_PostgreSQL_Testing.md`
- `docs/auditoria/H04_Fase4_Pruebas_Negocio_Backend.md`
- `docs/auditoria/H04_Fase5_Pruebas_Frontend_Permisos.md`

### 3.5 Migraciones / H05

Estado vigente:

- Existen tablas administrativas:
  - `schema_migrations`
  - `schema_migration_runs`
- Produccion tiene baseline de 15 migraciones:
  - `001_initial_schema.sql` a `012_h05_schema_migrations.sql`
  - Baseline: 15
  - Pendientes: 0
  - Checksum mismatch: 0
- H05 usa como `version` el nombre completo del archivo sin extension.
- Duplicados historicos de prefijo `007`, `008` y `009` estan aceptados y documentados.
- Desde `013` en adelante queda prohibido repetir prefijos numericos.

Comandos:

- `npm run db:migrate:inspect`: lectura, sin DDL/DML, sin lock.
- `npm run db:migrate:status`: estado contra tablas H05.
- `npm run db:migrate:dry-run`: registra corrida dry-run si tablas existen, no ejecuta SQL funcional.
- `npm run db:migrate:baseline`: registra baseline sin ejecutar SQL funcional historico.
- `npm run db:migrate` / `apply`: ejecuta migraciones pendientes, solo con backup y confirmacion en produccion.

Reglas productivas:

- Siempre backup antes de apply productivo.
- No reaplicar migraciones historicas.
- No crear migraciones sin numeracion H05.
- No ejecutar H05 contra produccion sin variables de confirmacion apropiadas.
- No renombrar migraciones historicas porque afecta checksums y trazabilidad.

Documento vigente:

- `docs/auditoria/H05_Control_Formal_Migraciones.md`

### 3.6 Legacy / H06/H14

Estado vigente:

- `Codigo.gs` e `index.html` fueron retirados del repositorio.
- El sistema moderno Vue 3 + Firebase Auth + Cloud Run + PostgreSQL es la operacion vigente.
- Git conserva trazabilidad historica.
- Cualquier copia externa en Google Drive, respaldos o areas institucionales debe tratarse como historica/no operativa salvo decision formal nueva.
- Apps Script legacy no debe usarse como fuente para reglas actuales.

Documento vigente:

- `docs/auditoria/H06_H14_Cierre_AppsScript_Legacy.md`

### 3.7 Estados y cierre de ciclo / H09/H10

Reglas vigentes:

- `PAGADA` es estado financiero terminal.
- Una corrida `PAGADA` no puede cancelarse ni regresar a estados anteriores.
- `CANCELADA` conserva la logica actual solo antes de `PAGADA`.
- `payroll_runs.status = 'BORRADOR'` queda reservado/no operativo para ciclo borrador.
- `payroll_runs.status = 'CERRADA'` queda reservado/no operativo para cierre de cuatrimestre.
- `academic_cycles.status = 'PLANEACION'` representa el ciclo borrador operativo.
- No se agrego `BORRADOR` a `cycle_status`.
- Horarios estan permitidos en ciclo `PLANEACION`.
- Incidencias, Extras y Nomina estan bloqueados en ciclo `PLANEACION`.
- `academic_cycles.status = 'CERRADO'` es irreversible.
- El cierre controlado usa `quarter_closures` existente y evidencia adicional en `audit_log`.
- H09/H10 no requiere migracion 013.

Deploy vigente H09/H10:

- Produccion desplegada el 2026-06-01.
- Revision nueva: `nomina-api-00045-v8h`.
- Hosting live confirmado.
- No se ejecutaron migraciones, seeds, importaciones ni sincronizaciones de datos.
- No se ejecuto cierre real durante smoke test productivo.

Documentos vigentes:

- `docs/specs/SPEC_H09_H10_Estados_Cierre_Cuatrimestre.md`
- `docs/diseno/DISENO_TECNICO_H09_H10_Estados_Cierre_Cuatrimestre.md`
- `docs/auditoria/H09_H10_Fase1_Estados_Financieros_Seguros.md`
- `docs/auditoria/H09_H10_Fase2_Ciclo_Planeacion_Horarios.md`
- `docs/auditoria/H09_H10_Fase3_Cierre_Ciclo_Cuatrimestre.md`
- `docs/auditoria/H09_H10_Fase4_Frontend_Cierre_Ciclo.md`
- `docs/auditoria/H09_H10_PreDeploy_Check_20260601.md`
- `docs/auditoria/H09_H10_Deploy_Productivo_Resultado.md`

## 4. Modulos vigentes

| Modulo | Reglas vigentes | Documentos relevantes |
|---|---|---|
| Directorio | GET global para consulta; Coordinador puede ver detalle operativo de cualquier docente, incluido contacto; alta/edicion operativa por capturador/permisos; datos fiscales bloqueados sin `fiscal.manage`; responsable operativo no debe confundirse con catalogo de coordinaciones. | H02/H03 Fase 5, H03 Fase 4, SDD retrospectivo, ajuste H17 Directorio. |
| Horarios | Permitidos en ciclos `ACTIVO` y `PLANEACION`; bloqueados en `CERRADO`; coordinadores operan segun capturador/alcance; Admin global. | H02/H03 Fase 3, H09/H10 Fase 2, H09/H10 Fase 4. |
| Incidencias | Permitidas solo en ciclo operativo activo y ventana abierta; bloqueadas en `PLANEACION` y `CERRADO`; validacion por horario/coordinacion. | H02/H03 Fase 3, H09/H10 Fase 2. |
| Extras | Listado segun rol; edicion por propiedad/captured_by donde aplique; Direccion/Subdireccion solo modifica propios; bloqueados en `PLANEACION` y `CERRADO`. | H02/H03 Fase 3, H04 Fase 5, H09/H10 Fase 2. |
| Nomina | Preview con `payroll.preview`; guardar con `payroll.finalize`; H01 intocable; bloqueada en `PLANEACION` y `CERRADO`; `PAGADA` terminal. H20 permite al Coordinador consultar el calculo completo de docentes propios o con horario en sus coordinaciones, sin ampliar edicion, fiscal ni finalizacion. H23 aplica en produccion la interseccion temporal inclusiva de quincena, vigencia base y M1/M2 antes de H01; anula incidencias de horarios sin ocurrencias. Extras independientes, H01 e historicos permanecen intactos. | H01, H03 Fase 4, H09/H10 Fase 1, SPEC/auditoria H20 y cierre productivo H23. |
| Finanzas | `finance.view` consulta; `finance.export` exporta; `finance.workflow` cambia estados; no cancelar `PAGADA`; no usar `BORRADOR`/`CERRADA` como acciones. El comprobante de efectivo se consolida por docente usando los totales ya guardados y omite coordinacion. Coordinador consulta solo sus coordinaciones, sin exportacion, workflow ni fiscal; el nombre docente es operativo y no depende de permiso fiscal. | H03 Fase 4, H09/H10 Fase 1 y ajuste Finanzas 2026-10-27. |
| Expediente fiscal | Ver/editar/constancias separados por permisos fiscales y documentales; Coordinador/Direccion/Contador no gestionan fiscal. | H03 Fase 4, H02/H03 Fase 5. |
| Calendario | Ciclos `PLANEACION`, `ACTIVO`, `CERRADO`; cierre controlado Admin; activacion manual queda como compatibilidad administrativa/legacy. H23 agrega configuracion Admin de vigencia pagable inclusiva y exige M1/M2 contenidos; `27-1` opera con `2026-08-31` a `2026-12-12`. | H09/H10 Fase 3/Fase 4/deploy y cierre productivo H23. |
| Accesos | Roles y usuarios gestionados por Admin; no mostrar checkboxes manuales de coordinaciones como fuente operativa final; subdireccion usa `direccion`. | H02/H03 Fase 5, H04 Fase 5. |
| Auditoria | Export CSV y eventos; evidencia de cierre H10 via `audit_log`; no registrar secretos ni datos fiscales completos innecesarios. | H03 Fase 4, H09/H10 Fase 3, H11 inventario. |
| Catalogos | H12 mantiene la politica de inactivar y conservar historia. H21 agrega importacion CSV atomica y busqueda sin acentos; la plantilla usa activos por defecto y no permite altas por colision normalizada. Cinco duplicados legacy quedaron inactivos y sus ocho horarios apuntan a los canonicos. | SPEC/cierre H12, SPEC y acta productiva H21. |

## 5. Documentos fuente de verdad

Precedencia documental vigente:

1. Acta de deploy/cierre mas reciente para el estado puntual del release.
2. Este SDD consolidado para arquitectura, modulos y reglas vigentes.
3. Matriz formal de riesgos vigente.
4. SPEC aprobada de la fase o modulo.
5. Diseno tecnico aprobado.
6. Auditorias de implementacion y validacion.
7. Inventarios, dry-runs y documentos historicos.

Codex debe leer primero este SDD, la matriz y los documentos especificos de la fase nueva. Una referencia historica no sustituye el estado vigente aunque conserve valores correctos para su fecha.

| Area | Documento principal | Documentos historicos relacionados | Estado |
|---|---|---|---|
| Estado consolidado | `docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md` | SDD retrospectivo, README, matriz | Vigente principal |
| Riesgos | `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md` | Inventarios y analisis por H | Vigente, actualizada post H09/H10 |
| Cierre global matriz | `docs/auditoria/CIERRE_GLOBAL_MATRIZ_RIESGOS_NOMINA_DOCENTE_20260603.md` | Matriz formal, SDD, H05, H13 y cierres por H | Cierre ejecutivo/tecnico de riesgos principales; pendientes clasificados |
| H01 | `docs/auditoria/H01_Cierre_Hotfix_Precision_Monetaria.md` | H04 Fase 4 | Vigente para precision monetaria |
| H02/H03 | `docs/auditoria/H02_H03_Deploy_Productivo_Resultado.md` y `docs/auditoria/H02_H03_Migracion_Productiva_Datos_Oficiales_Mayo_2026.md` | SPEC, diseno, fases 1-6, revision documental | Cierres/deploy vigentes; SPEC/diseno historicos aprobados |
| Pruebas | `docs/auditoria/H04_Fase5_Pruebas_Frontend_Permisos.md` + Fases 1-4 | Inventarios H04 previos | Vigente hasta Fase 5 |
| Migraciones | `docs/auditoria/H05_Control_Formal_Migraciones.md` | Procedimientos F4/F5 dentro del mismo doc | Vigente |
| Legacy | `docs/auditoria/H06_H14_Cierre_AppsScript_Legacy.md` | SDD retrospectivo, README | Vigente |
| Estados/cierre | `docs/auditoria/H09_H10_Deploy_Productivo_Resultado.md` | SPEC, diseno, fases 1-4, predeploy | Deploy/cierre vigente; SPEC/diseno aprobados |
| CSV/codificacion | `docs/auditoria/H11_Cierre_CSV_UTF8_PostDeploy.md` | H11 Fase 1, Fase 2, Fase 3A, Fase 3B, Fase 4, deploy H11-F5 y cierre postdeploy | Cerrado operativo; exportables criticos estandarizados y validados en Excel institucional |
| Catalogos historicos | `docs/auditoria/H12_Cierre_Documental_Catalogos_Historicos.md` | SPEC H12 | Cerrado documental; politica operativa sin implementacion tecnica |
| Importacion de Asignaturas | `docs/auditoria/H21_Deploy_Productivo_Importacion_Asignaturas.md` y `docs/specs/SPEC_H21_Importacion_CSV_Asignaturas.md` | Diagnostico, plan y ensayo de conciliacion H21; H12/H05 | Cerrado operativo; `013`, conciliacion, deploy y smoke aprobados; CSV institucional definitivo no aplicado |
| Importacion de Docentes | `docs/auditoria/H22_Deploy_Productivo_Importacion_Docentes.md`, `docs/auditoria/H22_Hotfix_Responsable_Operativo_Altas_Masivas.md`, `docs/auditoria/H22_Hotfix_Responsable_Operativo_Deploy_Productivo.md` y `docs/specs/SPEC_H22_Importacion_CSV_Docentes.md` | Diagnostico, F1A-F4, ensayo temporal, H05/H13 y manuales | Cerrado operativo; `014`, API/Hosting y smoke aprobados; ejecucion autorizada de 14 altas y HF1B de proyeccion sin correccion de BD ni Apply repetido |
| Checklist productivo | `docs/auditoria/H13_Checklist_Productivo_Permanente.md` | Deploy H02/H03, H09/H10, H11 y H05 | Cerrado documental; usar antes de cada deploy productivo |
| Sesion/inactividad | `docs/auditoria/H15_Deploy_Productivo_Resultado.md` | H15 predeploy, H13, auth frontend | Desplegado productivamente; observar ciclo real completo si operacion lo requiere |
| Directorio capturador | `docs/auditoria/H17_Normalizacion_CreatedBy_Directorio_Resultado.md` | Diagnostico H17, plan H17 y validacion CSV H17 | Normalizacion ejecutada para 197 docentes; 12 remanentes documentados |
| Reportes operativos | `docs/specs/SPEC_H18_Reportes_Operativos.md`, `docs/auditoria/H18_Fase1_Backend_Reportes_Operativos.md`, `docs/auditoria/H18_Fase2_Frontend_Reportes_Operativos.md`, `docs/auditoria/H18_Fase3_Validacion_UI_Exportables_Reportes_Operativos.md`, `docs/auditoria/H18_Deploy_Productivo_Reportes_Operativos.md`, `docs/auditoria/H18_Fase6_UX_Filtros_Reportes_Operativos.md`, `docs/auditoria/H18_Hotfix_Reportes_Snapshot_LineKey.md`, `docs/auditoria/H18_Cierre_Operativo_Reportes_Operativos.md`, `docs/auditoria/H18_Ajuste_PostH23_Reportes_Operativos.md` y `docs/auditoria/H18_Deploy_PostH23_Reportes_Operativos.md` | SDD consolidado, matriz, H11, H17, H20, H23 y rutas operativas | Cerrado operativo; ajuste post-H23, smoke tecnico/autenticado y exportables aprobados |
| Nomina compartida Coordinador | `docs/specs/SPEC_H20_Alcance_Compartido_Nomina_Coordinadores.md`, `docs/auditoria/H20_Alcance_Compartido_Nomina_Coordinadores.md` y `docs/auditoria/H20_Deploy_Productivo_Alcance_Compartido_Nomina.md` | H02/H03 Fase 4/5, ajuste docentes compartidos y H04 Fase 4/5 | Cerrado operativo; revision `nomina-api-00051-9s5` y Hosting H20 activos, smoke autenticado satisfactorio |
| Vigencia temporal de Horarios en Nomina | `docs/auditoria/H23_Deploy_Productivo_Vigencia_Temporal_Nomina.md`, `docs/auditoria/H23_Diagnostico_Vigencia_Temporal_Nomina.md`, `docs/auditoria/H23_Fase1_Modelo_Vigencia_Base_Calendario.md`, `docs/auditoria/H23_Fase2_Elegibilidad_Temporal_Nomina.md`, `docs/auditoria/H23_Fase3_Validacion_Integral_PreDeploy.md`, `docs/auditoria/H23_Ensayo_Productivo_Temporal_Vigencia_Nomina.md` y `docs/specs/SPEC_H23_Vigencia_Temporal_Horarios_Nomina.md` | H01, H09/H10, H20, H05, esquema y motor vigente | Cerrado operativo; `015`, configuracion `27-1`, API/Hosting y smoke productivo aprobados sin cambios H01 ni historicos |
| Manuales | `docs/Manual_Entrega_Nomina_Docente.md` y `docs/Manual_Uso_Nomina_Docente.md` | DOCX generados desde ambas fuentes Markdown | Vigentes post-H23; Markdown es la fuente editable |
| Alineacion post-H20 | `docs/auditoria/ALINEACION_DOCUMENTAL_POST_H20.md` | README, H13, manuales y documentos historicos clasificados | Evidencia read-only de Git, Cloud Run, Hosting, Cloud SQL y H05 |

## 6. Documentos historicos / no usar como fuente primaria

| Documento | Motivo | Documento que lo reemplaza o complementa |
|---|---|---|
| `docs/auditoria/Inventario_Tecnico_Pre_Disenio_H02_H03.md` | Describe estado pre-implementacion H02/H03; ya fue superado por fases y deploy. | H02/H03 fases 2-5 y deploy productivo. |
| `docs/specs/SPEC_H02_H03_Usuario_Coordinacion_Permisos.md` | SPEC aprobada de implementacion; no refleja por si sola ajustes posteriores de produccion y capturador/responsable. | Deploy H02/H03, migracion datos oficiales y SDD consolidado. |
| `docs/diseno/DISENO_TECNICO_H02_H03_Usuario_Coordinacion_Permisos.md` | Diseno base; algunas decisiones quedaron ajustadas por fases posteriores y cierre operativo. | Fases H02/H03, ajuste docentes compartidos y SDD consolidado. |
| `docs/auditoria/H02_H03_Fase1_Validacion_DB_Permisos.md` | Validacion estructural inicial; no representa estado completo productivo. | Deploy H02/H03 y H04 pruebas. |
| `docs/auditoria/H02_H03_Fase2_Preparacion_Deploy_Revision.md` | Recurso de preparacion revision; recursos preview fueron eliminados. | Cierre controlado recursos revision y deploy productivo. |
| `docs/auditoria/H02_H03_Fase3_Deploy_Revision.md` | Resultado de entorno revision; no es fuente productiva actual. | Deploy productivo y migracion oficial. |
| `docs/auditoria/H02_H03_Dry_Run_Migracion_Datos_Oficiales_Mayo_2026.md` | Dry-run historico; no usar como estado final de datos. | Migracion productiva datos oficiales mayo 2026. |
| `docs/auditoria/H09_H10_Analisis_Estados_Cierre_Cuatrimestre.md` | Analisis previo; decisiones finales se cerraron despues. | SPEC/diseno H09/H10 y deploy productivo. |
| `docs/auditoria/H09_H10_Fase5_Pruebas_Locales_PreDeploy.md` | Evidencia local previa al deploy; no sustituye deploy productivo. | Predeploy y deploy H09/H10. |
| `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md` | Buen resumen historico, pero ya acumula informacion de varias etapas y no debe ser unica fuente futura. | SDD consolidado actual. |
| `Codigo.gs` / `index.html` historicos en Git | Legacy retirado; no representa reglas actuales. | H06/H14 y SDD consolidado. |

La regla de precedencia de esta seccion se aplica tambien a los documentos historicos listados arriba.

## 7. Riesgos pendientes

| Riesgo | Estado consolidado | Proxima accion recomendada |
|---|---|---|
| H07 | Pendiente opcional | Evaluar `hd` de Google como mejora UX; backend ya valida dominio. |
| H08 | Pendiente | Refactor gradual despues de mantener pruebas H04 verdes; no cambiar contratos. |
| H11 | Cerrado operativo | Mantener helper CSV central y pruebas; evaluar sanitizacion por exportable como mejora futura. |
| H12 | Cerrado documental / politica operativa | No intervenir tecnicamente mientras el sistema funcione correctamente; seguir politica si se requiere modificar catalogos. |
| H13 | Cerrado documental / checklist productivo permanente | Usar checklist H13 antes de cada deploy y actualizarlo solo si cambia infraestructura real. |
| H15 | Desplegado productivamente | Mantener observacion operativa del ciclo real de 60 minutos y reapertura de navegador si se requiere evidencia adicional. |
| H17 | Normalizacion ejecutada / monitoreo | Validar acceso real de coordinadoras y resolver 12 remanentes solo con nuevo mapping aprobado si operacion lo requiere. |
| H18 | Cerrado operativo / monitoreo | Mantener regresion por rol, quincena obligatoria, `source=auto`, paridad H23, consolidacion y ausencia fiscal. |
| H20 | Cerrado operativo | Mantener pruebas de regresion y confirmar en futuros cambios docente unico, desglose por coordinacion, totales sin duplicacion y ausencia fiscal. |
| H21 | Cerrado operativo | Mantener pruebas, H05 y preview previo a cualquier CSV institucional futuro; no aplicar archivos sin backup y autorizacion. |
| H22 | Cerrado operativo | Admin exclusivo; `014`, API/Hosting, plantillas, Preview, permisos, responsive y responsable real desde `teachers.created_by` aprobados. Mantener Apply como operacion futura separada con backup y autorizacion. |
| H23 | Cerrado operativo | Mantener pruebas de regresion, vigencia base por ciclo y paridad Preview/Guardar/Reporte vivo; la apertura de Extras propedeuticos sigue siendo una accion Admin separada. |
| Fallback legacy H02 | En monitoreo | Revisar logs de `LEGACY_COORDINATION_FALLBACK_USED` y definir fecha de retiro cuando no haya uso indebido. |
| H04-F6 | Opcional posterior | Playwright/e2e local si se requiere validar flujos visuales completos. |
| Copias externas Apps Script | Pendiente externo | Confirmar si existen en Google Drive/respaldos y marcarlas historicas/no operativas. |

## 8. Reglas para futuras fases Codex

### H24 - Expediente completo (local, no productivo)

H24-F1 agrega modelo/backend local para PDF adicionales del docente, separados de
Constancias, y telefono compartido con Directorio. Admin conserva acceso completo;
Finanzas/RH requieren permisos fiscales/documentales por accion. Otros roles no
obtienen acceso. Migracion 016 creada para pruebas locales; **no aplicada en
produccion**. No cambia el estado productivo H05 descrito en este documento.

Storage deshabilitado por defecto, validacion PDF, idempotencia y reconciliacion
durable implementados; F1 validada en local/test. F2 frontend implementado con panel,
carga multiple, telefono compartido y preview; pruebas con API simulada y Brave en
tres resoluciones. F3 valida API HTTP real, PostgreSQL test, archivos sinteticos en
storage local, reemplazo/borrado fisico, telefono compartido y roles sinteticos en
Brave. Correccion acotada: exponer Content-Disposition en la respuesta PDF para
descarga cross-origin. GCS de prueba fue validado posteriormente en PD-02;
autenticacion Firebase real se valido parcialmente despues en PD-05;
escaneo aprobado, worker programado y deploy siguen
pendientes. No cambia H01,
Nomina, Constancias historicas ni la completitud fiscal.

F4 preparo predeploy documental sin acceso productivo: **NO-GO**. Seguimiento
tecnico local **PD-01 cerrado**: imagen Linux de `95026bf` construida, pdfinfo 22.12.0
y 12/12 comprobaciones en build y runtime aislado, tambien como usuario node.
Digest/inventario en acta de correccion; no implica seguridad integral PDF ni deploy.
PD-02 tiene protocolo preparado en
`docs/auditoria/H24_PD02_Plan_Validacion_GCS_Aislado.md`. Seguimiento autorizado en
`docs/auditoria/H24_PD02_Copia_Local_Anonimizada_GCS.md`: copia local saneada en
127.0.0.1:55440, H05 test 19 registradas/pending=0/mismatch=0 tras 016. Proyecto
de pruebas creado. La cuota de facturacion se resolvio en una continuacion:
bucket privado `nomina-h24-test-234692275301-dossier`, IAM minimo y pruebas reales
GCS/API local satisfactorias (21 comprobaciones adaptador y 15 API/BD).
**PD-02 cerrado tecnicamente en local/test**, sin objetos/versiones residuales y
con recuperacion tras corte de proceso; 23 tablas ajenas al expediente intactas.
Ver `docs/auditoria/H24_PD02_Resultado_GCS_Aislado.md`. No modifica produccion.
RH/Contador sin actor local y Firebase real quedaron en PD-05 y se probaron
posteriormente; worker programado
permanece en PD-04. softDeleted=true devolvio 400, con evidencia alternativa de
borrado documentada, no una lista vacia.
PD-05: plan preparado en
`docs/auditoria/H24_PD05_Plan_Validacion_Firebase_Auth_Real.md`, con ejecucion parcial
posterior registrada en `docs/auditoria/H24_PD05_Resultado_Sesiones_Reales_Por_Rol.md`.
Utiliza Google Sign-In real en Firebase exclusivo H24, API loopback y BD/storage
de prueba, con autorizacion humana de provisionamiento y una identidad institucional
rotada secuencialmente en test. Admin/Finanzas/RH y rechazos de los cuatro roles
excluidos aprobados por UI/API; 72 solicitudes negativas y 36 operaciones COMPLETE.
Carga multiple UI, preview/descarga, telefono, GCS sin residuos y restitucion
comprobados. No cambia autenticacion ni permisos compartidos del sistema.
PD-05 parcial: negativos complementarios y sesiones avanzadas pendientes; AUTH-01
corregido localmente en seguimiento autorizado del 2026-10-28, no desplegado.
Bloqueantes restantes: cobertura Auth complementaria, control PDF
malicioso, worker/alertas, capacidad, triage npm y requisitos DBA/release/backup.
El ensayo H05/016 local ya realizado en PD-02 no se presenta como pendiente nuevo.
Continuacion PD-05: `docs/auditoria/H24_PD05_Validacion_Complementaria_Auth_Sesiones.md`.
Permisos reducidos Finanzas/RH, identidad local y retiro durante carga comprobados;
restitucion exacta de permisos, documentos/GCS sin residuos. AUTH-01 confirmado:
la API acepta token previo a revocacion/deshabilitacion Firebase; no hubo correccion
de codigo en ese ensayo del 2026-10-27. Seguimiento autorizado:
`docs/auditoria/H24_AUTH01_Correccion_Revocacion_Firebase.md`: authenticate ahora usa
verifyIdToken(token, true), manteniendo 401 INVALID_TOKEN y guardas locales;
rechazo real disabled/revoked validado en H24. Runtime de prueba con permiso minimo
firebaseauth.users.get aprobado, sin administrar usuarios ni IAM productivo.
No hay cache/fallback inseguro; Firebase no disponible deniega acceso. Nuevas
solicitudes se verifican; no se revocan bytes ya descargados ni solicitudes en curso.
AUTH-01 cerrado tecnicamente local/H24: token nuevo tras login real en Brave invitado
aceptado (200), identidad habilitada y solo last_login_at QA modificado. No se
atribuye ni declara corregido el cierre del perfil habitual del navegador.
PD-05 y H24 no cerrados; sesiones avanzadas y demas gates siguen pendientes.
Sesion QA local retenida a solicitud del usuario. Ajuste UX implementado localmente:
RFC, correo, tipo de pago y banco dentro de Expediente junto al telefono; Constancia
solo gestiona archivo. Borrado fisico de constancia sustituida aprobado el
2026-10-28; implementacion local con estados durables, sin purga historica.
Validacion GCS de constancias y worker pendientes; no equivale al cierre PD-02.
Ver `docs/auditoria/H24_Ajuste_Expediente_Fiscal_Constancia.md`. Sin deploy.
Audit npm F4: 0 criticas, 15 altas, 12 moderadas, 1 baja (arbol local completo;
no inventario de imagen productiva). No se aplicaron fixes ni excepciones.

Fuentes: `docs/specs/SPEC_H24_Expediente_Completo_Docentes.md`,
`docs/diseno/DISENO_TECNICO_H24_Expediente_Completo_Docentes.md` y
`docs/auditoria/H24_Fase1_Modelo_Backend_Expediente_Docentes.md` y
`docs/auditoria/H24_Fase2_Frontend_Expediente_Docentes.md` y
`docs/auditoria/H24_Fase3_Validacion_Integracion_Expediente_Docentes.md` y
`docs/auditoria/H24_Fase4_PreDeploy_Expediente_Docentes.md` y
`docs/auditoria/H24_Fase4_Correccion_Parser_Pdfinfo.md`.

### Reglas generales

Para cualquier fase posterior:

1. Leer primero `docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md`.
2. Leer despues `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md`.
3. Leer `docs/auditoria/H05_Control_Formal_Migraciones.md` antes de cualquier cambio SQL.
4. Leer documentos especificos de la H en curso.
5. No usar documentos historicos como fuente unica de decision.
6. No modificar reglas cerradas sin SPEC o decision humana explicita.
7. No tocar produccion sin backup, checklist y confirmacion manual.
8. No crear migraciones fuera de H05 ni repetir prefijos desde `013`.
9. No cambiar interfaz, permisos, roles, formula de nomina ni estados sin aprobacion.
10. No introducir datos locales/test/seeds en produccion.
11. En cambios frontend, backend sigue siendo autoridad de permisos.
12. En documentos con acentos o codificacion irregular, usar anclas estables y cambios acotados.

## 9. Proxima fase recomendada

Orden recomendado:

1. H23 operacion continua:
   - cerrado productivamente en `nomina-api-00055-8wn` con `015` y vigencia `27-1` activa;
   - mantener regresion de la quincena especial y no cambiar H01, Extras independientes o historicos;
   - abrir la ventana de Extras propedeuticos solo como accion Admin posterior, si operacion la requiere.
2. H07 Google Provider `hd`:
   - mejora UX opcional, no control principal.
3. H08 refactor gradual:
   - solo despues de cubrir con pruebas y sin cambiar reglas.
4. CSV injection:
   - evaluar sanitizacion por exportable solo con decision tecnica/funcional, porque puede transformar texto exportado.
5. H13 operativo continuo:
   - usar el checklist productivo permanente antes de cada despliegue y mantenerlo actualizado ante cambios reales de infraestructura.
6. H21 operacion futura:
   - aplicar un CSV institucional solo con archivo definitivo aprobado, preview sin bloqueantes, backup y autorizacion humana independiente.
7. H22 Importacion de docentes:
   - cerrado operativo; cualquier Apply institucional futuro requiere CSV
     aprobado, Preview sin bloqueantes, backup y autorizacion humana separada.
8. Cierre global de matriz:
   - usar `docs/auditoria/CIERRE_GLOBAL_MATRIZ_RIESGOS_NOMINA_DOCENTE_20260603.md` como evidencia ejecutiva del estado final de riesgos principales.

## 10. Confirmacion de alcance de esta consolidacion

Esta consolidacion documental:

- No modifico codigo funcional.
- No modifico base de datos.
- No ejecuto migraciones.
- No hizo deploy.
- No toco produccion.
- No cambio reglas de negocio.
- No cambio permisos.
- No cambio interfaces.
