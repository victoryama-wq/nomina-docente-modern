# SDD Consolidado Nomina Docente Post H09/H10

Fecha de consolidacion: 2026-06-02
Ultima actualizacion: 2026-07-30

Este documento consolida el estado vigente del sistema Nomina Docente despues del cierre operativo de H01, H02/H03, H04-F5, H05, H06/H14 y H09/H10. A partir de H11, Codex debe usar este documento como primera fuente documental, junto con la matriz formal de riesgos y los documentos especificos de la fase en curso.

## 1. Estado productivo actual

| Elemento | Estado vigente |
|---|---|
| Produccion | `https://nomina-docente-prod.web.app` |
| API Cloud Run publica | `https://nomina-api-443985127112.us-central1.run.app` |
| API via Hosting | `https://nomina-docente-prod.web.app/api/health` |
| Proyecto Firebase/GCP | `nomina-docente-prod` |
| Cloud Run | Servicio `nomina-api`, region `us-central1` |
| Revision Cloud Run vigente documentada | `nomina-api-00052-xtm` |
| Revision Cloud Run anterior / rollback inmediato | `nomina-api-00051-9s5` |
| Imagen API vigente | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h21-prod-1b449a1` |
| Digest API vigente | `sha256:b087fd5b77771df23367dc630c06e7f59132e8c803f5809e1ed628e026bf839c` |
| Recursos Cloud Run | CPU `1`, memoria `512Mi`, concurrencia `80`, timeout `300 s`, min `0`, max `3` |
| Firebase Hosting | Sitio `nomina-docente-prod`, canal `live` |
| Firebase Hosting release vigente | `1784583329978000` |
| Firebase Hosting version vigente | `79673723ffe4f297` |
| Base activa | Cloud SQL PostgreSQL, base `nomina_docente` |
| Bucket constancias | `nomina-docente-prod-constancias` |
| Service account API | `nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com` |
| Fallback H02 | `LEGACY_COORDINATION_FALLBACK_ENABLED=true`, en monitoreo |
| Control H05 productivo | 16 registradas: 15 baseline y `013` aplicada; `014` creada/aplicada solo en test y pendiente de futura aprobacion productiva; 0 checksum mismatch |

Estado por H:

| H | Estado vigente |
|---|---|
| H01 | Cerrado. Precision monetaria protegida con `decimal.js`, strings decimales y pruebas de regresion. |
| H02 | Cerrado operativo; `user_coordinations` existe, pero el fallback legacy sigue activo en monitoreo. |
| H03 | Cerrado operativo; permisos fiscales, documentales, financieros, workflow y preview separados. |
| H04 | Implementado hasta Fase 5; H04-F6 Playwright queda opcional posterior. |
| H05 | Cerrado con tablas de control; produccion conserva 15 baseline y `013` aplicada. `014` H22 esta validada solo en test y pendiente de una fase productiva aprobada. |
| H06/H14 | Cerrado; `Codigo.gs` e `index.html` fueron retirados del repositorio. |
| H09/H10 | Desplegado en produccion el 2026-06-01; estados financieros seguros, `PLANEACION`, cierre controlado y frontend vigentes. |
| H11 | Cerrado operativo; exportables CSV criticos backend/frontend estandarizados con BOM UTF-8 y validados en Excel institucional. |
| H12 | Cerrado documental; politica operativa de catalogos historicos definida sin cambios tecnicos. |
| H13 | Cerrado documental; checklist productivo permanente de variables, secretos, CORS, healthchecks, deploy y rollback. |
| H15 | Desplegado en produccion; `browserSessionPersistence`, timeout 60 min, modal 5 min antes y logout por inactividad vigentes. |
| H17 | Normalizacion productiva ejecutada para 197 docentes; Directorio mantiene edicion por `teachers.created_by`; 12 remanentes documentados. |
| H18 | Cerrado operativo; Reportes Operativos desplegado, filtros amigables H18-F6 vigentes y hotfix snapshot `ped.line_key` aplicado en `nomina-api-00050-zdm`. |
| H19 | Ejecutado de forma controlada; 36 docentes existentes actualizaron `created_by` y se registraron 3 altas minimas, con backup, preview y validacion sin duplicados. |
| H20 | Cerrado operativo; preview read-only de Coordinador resuelve docentes por `teachers.created_by` o carga en `actorCoordinations[]`, calcula su carga completa entre coordinaciones y fue validado productivamente. |
| H21 | Cerrado operativo; migracion `013`, conciliacion de cinco pares/8 horarios, API/Hosting y smoke autenticado Catalogos/Horarios aprobados. CSV institucional definitivo no aplicado. |
| H22 | F4 cerrado: fixes legacy/visual, regresión 27/79/105, ensayo temporal, manuales y smoke autenticado humano aprobados. Listo para F5; `014`, deploy y Apply institucional no ejecutados. |
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
- H19 Directorio Docentes: backup `1783642001652`, preview exacto en `ROLLBACK`, 36 UPDATE de `teachers.created_by` y 3 INSERT minimos; 7 de los 10 sin match nominal ya existian, 3 fueron nuevas altas y no se crearon duplicados.
- H20 Nomina compartida: deploy productivo ejecutado el 2026-07-16; API revision `nomina-api-00051-9s5`, Hosting release `1784228039752000`; smoke autenticado Coordinador/Admin aprobado, sin migracion, escritura de Nomina ni cambio H01.
- H21 Asignaturas: backup `1784582556252`, migracion `013` aplicada con H05, ocho horarios conciliados sin tocar snapshots y deploy `nomina-api-00052-xtm` / Hosting `1784583329978000`; smoke autenticado Catalogos/Horarios aprobado.

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
| `payroll.preview` | Calculo vivo/preview de nomina, solo lectura segun alcance. |
| `payroll.finalize` | Guardar corrida de nomina. |

Reglas por rol:

- Admin: acceso global, fiscal/documentos, finanzas, workflow y guardado de nomina.
- RH: fiscal/documentos; no workflow financiero.
- Finanzas: fiscal/documentos, finance view/export/workflow; no guarda nomina salvo permiso explicito `payroll.finalize`.
- Coordinador: preview de nomina por alcance operativo; no fiscal, no constancias, no finanzas global, no guardado, no workflow.
- Direccion/Subdireccion: reportes/detalle sin fiscal sensible; no fiscal manage, no workflow.
- Contador/Contabilidad: export financiero autorizado; no fiscal manage, no workflow.

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
| Nomina | Preview con `payroll.preview`; guardar con `payroll.finalize`; H01 intocable; bloqueada en `PLANEACION` y `CERRADO`; `PAGADA` terminal. H20 permite al Coordinador consultar el calculo completo de docentes propios o con horario en sus coordinaciones, sin ampliar edicion, fiscal ni finalizacion. | H01, H03 Fase 4, H09/H10 Fase 1, SPEC y auditoria H20. |
| Finanzas | `finance.view` consulta; `finance.export` exporta; `finance.workflow` cambia estados; no cancelar `PAGADA`; no usar `BORRADOR`/`CERRADA` como acciones. | H03 Fase 4, H09/H10 Fase 1. |
| Expediente fiscal | Ver/editar/constancias separados por permisos fiscales y documentales; Coordinador/Direccion/Contador no gestionan fiscal. | H03 Fase 4, H02/H03 Fase 5. |
| Calendario | Ciclos `PLANEACION`, `ACTIVO`, `CERRADO`; cierre controlado Admin; activacion manual queda como compatibilidad administrativa/legacy. | H09/H10 Fase 3, Fase 4, deploy H09/H10. |
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
| Checklist productivo | `docs/auditoria/H13_Checklist_Productivo_Permanente.md` | Deploy H02/H03, H09/H10, H11 y H05 | Cerrado documental; usar antes de cada deploy productivo |
| Sesion/inactividad | `docs/auditoria/H15_Deploy_Productivo_Resultado.md` | H15 predeploy, H13, auth frontend | Desplegado productivamente; observar ciclo real completo si operacion lo requiere |
| Directorio capturador | `docs/auditoria/H17_Normalizacion_CreatedBy_Directorio_Resultado.md` | Diagnostico H17, plan H17 y validacion CSV H17 | Normalizacion ejecutada para 197 docentes; 12 remanentes documentados |
| Reportes operativos | `docs/specs/SPEC_H18_Reportes_Operativos.md`, `docs/auditoria/H18_Fase1_Backend_Reportes_Operativos.md`, `docs/auditoria/H18_Fase2_Frontend_Reportes_Operativos.md`, `docs/auditoria/H18_Fase3_Validacion_UI_Exportables_Reportes_Operativos.md`, `docs/auditoria/H18_Deploy_Productivo_Reportes_Operativos.md`, `docs/auditoria/H18_Fase6_UX_Filtros_Reportes_Operativos.md`, `docs/auditoria/H18_Hotfix_Reportes_Snapshot_LineKey.md` y `docs/auditoria/H18_Cierre_Operativo_Reportes_Operativos.md` | SDD consolidado, matriz, H11, H17 y rutas operativas | Cerrado operativo; H18-F1/F2/F5/F6 y hotfix snapshot desplegados; CSV/XLSX validados en Excel institucional |
| Nomina compartida Coordinador | `docs/specs/SPEC_H20_Alcance_Compartido_Nomina_Coordinadores.md`, `docs/auditoria/H20_Alcance_Compartido_Nomina_Coordinadores.md` y `docs/auditoria/H20_Deploy_Productivo_Alcance_Compartido_Nomina.md` | H02/H03 Fase 4/5, ajuste docentes compartidos y H04 Fase 4/5 | Cerrado operativo; revision `nomina-api-00051-9s5` y Hosting H20 activos, smoke autenticado satisfactorio |
| Manuales | `docs/Manual_Entrega_Nomina_Docente.md` y `docs/Manual_Uso_Nomina_Docente.md` | DOCX generados desde ambas fuentes Markdown | Vigentes post-H20; Markdown es la fuente editable |
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
| H18 | Cerrado operativo | Mantener pruebas y documentar cualquier cambio futuro de permisos/exportables; CSV H11 sigue como respaldo y XLSX server-side usa `exceljs`. |
| H20 | Cerrado operativo | Mantener pruebas de regresion y confirmar en futuros cambios docente unico, desglose por coordinacion, totales sin duplicacion y ausencia fiscal. |
| H21 | Cerrado operativo | Mantener pruebas, H05 y preview previo a cualquier CSV institucional futuro; no aplicar archivos sin backup y autorizacion. |
| H22 | F4 cerrado; listo para F5 | Admin exclusivo; fix legacy, hotfix visual, ensayo temporal sin DML y smoke humano aprobados; `014` solo en test. Migración productiva y deploy pendientes. |
| Fallback legacy H02 | En monitoreo | Revisar logs de `LEGACY_COORDINATION_FALLBACK_USED` y definir fecha de retiro cuando no haya uso indebido. |
| H04-F6 | Opcional posterior | Playwright/e2e local si se requiere validar flujos visuales completos. |
| Copias externas Apps Script | Pendiente externo | Confirmar si existen en Google Drive/respaldos y marcarlas historicas/no operativas. |

## 8. Reglas para futuras fases Codex

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

1. H07 Google Provider `hd`:
   - mejora UX opcional, no control principal.
2. H08 refactor gradual:
   - solo despues de cubrir con pruebas y sin cambiar reglas.
3. CSV injection:
   - evaluar sanitizacion por exportable solo con decision tecnica/funcional, porque puede transformar texto exportado.
4. H13 operativo continuo:
   - usar el checklist productivo permanente antes de cada despliegue y mantenerlo actualizado ante cambios reales de infraestructura.
5. H21 operacion futura:
   - aplicar un CSV institucional solo con archivo definitivo aprobado, preview sin bloqueantes, backup y autorizacion humana independiente.
6. H22 Importacion de docentes:
   - ejecutar H22-F5 con backup, H05, pendiente exacta `014`, deploy controlado
     y sin Apply institucional; F4 y su smoke autenticado ya están aprobados.
7. Cierre global de matriz:
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
