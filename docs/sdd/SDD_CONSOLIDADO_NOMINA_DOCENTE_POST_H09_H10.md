# SDD Consolidado Nomina Docente Post H09/H10

Fecha de consolidacion: 2026-06-02

Este documento consolida el estado vigente del sistema Nomina Docente despues del cierre operativo de H01, H02/H03, H04-F5, H05, H06/H14 y H09/H10. A partir de H11, Codex debe usar este documento como primera fuente documental, junto con la matriz formal de riesgos y los documentos especificos de la fase en curso.

## 1. Estado productivo actual

| Elemento | Estado vigente |
|---|---|
| Produccion | `https://nomina-docente-prod.web.app` |
| API Cloud Run publica | `https://nomina-api-443985127112.us-central1.run.app` |
| API via Hosting | `https://nomina-docente-prod.web.app/api/health` |
| Proyecto Firebase/GCP | `nomina-docente-prod` |
| Cloud Run | Servicio `nomina-api`, region `us-central1` |
| Revision Cloud Run vigente documentada | `nomina-api-00045-v8h` |
| Firebase Hosting | Sitio `nomina-docente-prod`, canal `live` |
| Base activa | Cloud SQL PostgreSQL, base `nomina_docente` |
| Bucket constancias | `nomina-docente-prod-constancias` |
| Service account API | `nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com` |
| Fallback H02 | `LEGACY_COORDINATION_FALLBACK_ENABLED=true`, en monitoreo |

Estado por H:

| H | Estado vigente |
|---|---|
| H01 | Cerrado. Precision monetaria protegida con `decimal.js`, strings decimales y pruebas de regresion. |
| H02 | Cerrado operativo; `user_coordinations` existe, pero el fallback legacy sigue activo en monitoreo. |
| H03 | Cerrado operativo; permisos fiscales, documentales, financieros, workflow y preview separados. |
| H04 | Implementado hasta Fase 5; H04-F6 Playwright queda opcional posterior. |
| H05 | Cerrado con tablas de control y baseline productivo de 15 migraciones, 0 pendientes, 0 checksum mismatch. |
| H06/H14 | Cerrado; `Codigo.gs` e `index.html` fueron retirados del repositorio. |
| H09/H10 | Desplegado en produccion el 2026-06-01; estados financieros seguros, `PLANEACION`, cierre controlado y frontend vigentes. |
| H11 | En curso; inventario, helper CSV central y exportables CSV backend/frontend criticos estandarizados con BOM UTF-8. |
| H12 | Pendiente; politica de catalogos historicos por definir. |
| H13 | Mitigado documentalmente; requiere checklist permanente de variables no secretas y secretos. |
| H07 | Pendiente opcional; evaluar `hd` de Google como mejora UX, no como control de seguridad principal. |
| H08 | Pendiente; refactor gradual despues de preservar pruebas. |

Ultimos hitos productivos relevantes:

- H02/H03 deploy productivo: codigo y migracion 011 aplicados; no se importaron datos locales/revision a produccion en ese deploy.
- Datos oficiales mayo 2026: Directorio/Horarios/Datos oficiales migrados de forma controlada y conciliados.
- Nomina `2026-05-15 a 2026-05-28`: guardada correctamente por `$517,510.00`.
- H05 baseline productivo: migraciones `001` a `012` registradas como baseline sin reaplicar SQL historico.
- H09/H10 deploy productivo: revision `nomina-api-00045-v8h`, Hosting live confirmado, sin migracion 013 y sin modificacion de Cloud SQL salvo backup preventivo.

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
| Directorio | GET global para consulta; alta/edicion operativa por permisos; datos fiscales bloqueados sin `fiscal.manage`; responsable operativo no debe confundirse con catalogo de coordinaciones. | H02/H03 Fase 5, H03 Fase 4, SDD retrospectivo. |
| Horarios | Permitidos en ciclos `ACTIVO` y `PLANEACION`; bloqueados en `CERRADO`; coordinadores operan segun capturador/alcance; Admin global. | H02/H03 Fase 3, H09/H10 Fase 2, H09/H10 Fase 4. |
| Incidencias | Permitidas solo en ciclo operativo activo y ventana abierta; bloqueadas en `PLANEACION` y `CERRADO`; validacion por horario/coordinacion. | H02/H03 Fase 3, H09/H10 Fase 2. |
| Extras | Listado segun rol; edicion por propiedad/captured_by donde aplique; Direccion/Subdireccion solo modifica propios; bloqueados en `PLANEACION` y `CERRADO`. | H02/H03 Fase 3, H04 Fase 5, H09/H10 Fase 2. |
| Nomina | Preview con `payroll.preview`; guardar con `payroll.finalize`; H01 intocable; bloqueada en `PLANEACION` y `CERRADO`; `PAGADA` terminal. | H01, H03 Fase 4, H09/H10 Fase 1. |
| Finanzas | `finance.view` consulta; `finance.export` exporta; `finance.workflow` cambia estados; no cancelar `PAGADA`; no usar `BORRADOR`/`CERRADA` como acciones. | H03 Fase 4, H09/H10 Fase 1. |
| Expediente fiscal | Ver/editar/constancias separados por permisos fiscales y documentales; Coordinador/Direccion/Contador no gestionan fiscal. | H03 Fase 4, H02/H03 Fase 5. |
| Calendario | Ciclos `PLANEACION`, `ACTIVO`, `CERRADO`; cierre controlado Admin; activacion manual queda como compatibilidad administrativa/legacy. | H09/H10 Fase 3, Fase 4, deploy H09/H10. |
| Accesos | Roles y usuarios gestionados por Admin; no mostrar checkboxes manuales de coordinaciones como fuente operativa final; subdireccion usa `direccion`. | H02/H03 Fase 5, H04 Fase 5. |
| Auditoria | Export CSV y eventos; evidencia de cierre H10 via `audit_log`; no registrar secretos ni datos fiscales completos innecesarios. | H03 Fase 4, H09/H10 Fase 3, H11 inventario. |
| Catalogos | Pendiente H12; politica futura debe privilegiar inactivar y conservar historicos/snapshots. | Matriz formal H12. |

## 5. Documentos fuente de verdad

| Area | Documento principal | Documentos historicos relacionados | Estado |
|---|---|---|---|
| Estado consolidado | `docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md` | SDD retrospectivo, README, matriz | Vigente principal |
| Riesgos | `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md` | Inventarios y analisis por H | Vigente, actualizada post H09/H10 |
| H01 | `docs/auditoria/H01_Cierre_Hotfix_Precision_Monetaria.md` | H04 Fase 4 | Vigente para precision monetaria |
| H02/H03 | `docs/auditoria/H02_H03_Deploy_Productivo_Resultado.md` y `docs/auditoria/H02_H03_Migracion_Productiva_Datos_Oficiales_Mayo_2026.md` | SPEC, diseno, fases 1-6, revision documental | Cierres/deploy vigentes; SPEC/diseno historicos aprobados |
| Pruebas | `docs/auditoria/H04_Fase5_Pruebas_Frontend_Permisos.md` + Fases 1-4 | Inventarios H04 previos | Vigente hasta Fase 5 |
| Migraciones | `docs/auditoria/H05_Control_Formal_Migraciones.md` | Procedimientos F4/F5 dentro del mismo doc | Vigente |
| Legacy | `docs/auditoria/H06_H14_Cierre_AppsScript_Legacy.md` | SDD retrospectivo, README | Vigente |
| Estados/cierre | `docs/auditoria/H09_H10_Deploy_Productivo_Resultado.md` | SPEC, diseno, fases 1-4, predeploy | Deploy/cierre vigente; SPEC/diseno aprobados |
| CSV/codificacion | `docs/auditoria/H11_Inventario_CSV_Acentos_Codificacion.md` | H11 Fase 1, Fase 2, Fase 3A y Fase 3B | Vigente; exportables criticos estandarizados, pendiente validacion Excel/Sheets |

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

Regla de precedencia:

1. Documento de cierre/deploy mas reciente.
2. Diseno tecnico aprobado.
3. SPEC aprobada.
4. SDD retrospectivo.
5. Inventarios, dry-runs y documentos de fase antigua como referencia historica.

## 7. Riesgos pendientes

| Riesgo | Estado consolidado | Proxima accion recomendada |
|---|---|---|
| H07 | Pendiente opcional | Evaluar `hd` de Google como mejora UX; backend ya valida dominio. |
| H08 | Pendiente | Refactor gradual despues de mantener pruebas H04 verdes; no cambiar contratos. |
| H11 | En curso | Validar apertura en Excel/Sheets/LibreOffice y cerrar decision de sanitizacion por exportable. |
| H12 | Pendiente | Definir politica de catalogos/tabuladores historicos: inactivar, no borrar; conservar snapshots. |
| H13 | Mitigado, no cerrado formal permanente | Consolidar checklist permanente de variables productivas, secretos, CORS y healthchecks. |
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

1. H11 CSV/acentos/codificacion:
   - helper CSV central ya creado;
   - BOM UTF-8 consistente ya aplicado a Finanzas/Nomina, Directorio/RH/Auditoria y CSV frontend restantes;
   - defensa contra CSV formula injection;
   - pruebas por exportable critico;
   - validacion Excel/Google Sheets.
2. H12 catalogos historicos:
   - politica de inactivar/no borrar;
   - snapshots y trazabilidad.
3. H13 checklist productivo:
   - variables no secretas;
   - secretos;
   - CORS;
   - healthchecks;
   - rollback.
4. H07 Google Provider `hd`:
   - mejora UX opcional, no control principal.
5. H08 refactor gradual:
   - solo despues de cubrir con pruebas y sin cambiar reglas.

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
