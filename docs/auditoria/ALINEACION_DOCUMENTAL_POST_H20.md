# Alineacion documental integral post-H20

Fecha: 2026-07-18

Estado: alineacion documental y verificacion read-only completadas.

## 1. Objetivo

Alinear las fuentes documentales vigentes con el estado real posterior a H20,
sin reescribir la cronologia de releases ni alterar codigo, SQL, datos,
infraestructura, permisos o reglas de negocio.

Fuente de verdad inicial para el release vigente:

- `docs/auditoria/H20_Deploy_Productivo_Alcance_Compartido_Nomina.md`.

## 2. Metodo y alcance

Se revisaron 93 archivos Markdown, dos manuales DOCX generados, los recursos
visuales de manuales, Git y la infraestructura productiva autorizada.

La verificacion de infraestructura fue exclusivamente read-only:

- Git: rama, HEAD, upstream y working tree.
- Cloud Run: `describe` de servicio/revision y listado de revisiones.
- Firebase Hosting: sitio y canal `live` mediante Firebase CLI.
- Cloud SQL: metadatos de instancia mediante Cloud SQL Admin API.
- H05: `npm run db:migrate:inspect` mediante Cloud SQL Auth Proxy.

La sesion institucional de `gcloud` se renovo con el flujo oficial abierto en
Brave. No se capturaron, imprimieron ni documentaron tokens, contrasenas o
valores de secretos.

## 3. Inventario y clasificacion de vigencia

Los patrones de la tabla clasifican todos los archivos que coinciden con ellos;
las excepciones se enumeran expresamente.

| Documento o familia | Clasificacion | Uso vigente |
|---|---|---|
| `README.md` | `VIGENTE_PRINCIPAL` | Entrada al repositorio y estado productivo resumido. |
| `docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md` | `VIGENTE_PRINCIPAL` | Arquitectura, reglas, modulos y precedencia documental. |
| `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md` | `VIGENTE_PRINCIPAL` | Riesgos y estado H01-H20. |
| `docs/auditoria/H13_Checklist_Productivo_Permanente.md` | `VIGENTE_PRINCIPAL` | Precheck, deploy, healthcheck y rollback. |
| `docs/Manual_Entrega_Nomina_Docente.md` | `VIGENTE_PRINCIPAL` | Fuente editable del manual tecnico-operativo. |
| `docs/Manual_Uso_Nomina_Docente.md` | `VIGENTE_PRINCIPAL` | Fuente editable del manual de usuario. |
| `docs/auditoria/H20_Deploy_Productivo_Alcance_Compartido_Nomina.md` | `VIGENTE_PRINCIPAL` | Acta del release productivo mas reciente. |
| `docs/Manual_Entrega_Nomina_Docente.docx`, `docs/Manual_Uso_Nomina_Docente.docx` | `VIGENTE_COMPLEMENTARIO` | Artefactos generados desde Markdown; no son fuente editable. |
| `docs/auditoria/H01_Cierre_Hotfix_Precision_Monetaria.md` | `VIGENTE_COMPLEMENTARIO` | Regla monetaria H01 y evidencia de cierre. |
| `docs/auditoria/H02_H03_Deploy_Productivo_Resultado.md`, `H02_H03_Migracion_Productiva_Datos_Oficiales_Mayo_2026.md`, `H02_H03_Ajuste_Docentes_Compartidos.md`, `H02_H03_Incidente_Login_Local_Firebase_UID_20260601.md` | `VIGENTE_COMPLEMENTARIO` | Cierre, datos oficiales y ajustes operativos H02/H03. |
| `docs/auditoria/H04_Fase1_Infraestructura_Testing.md` a `H04_Fase5_Pruebas_Frontend_Permisos.md`, `H04_Audit_Dependencias_Firebase_20260528.md` | `VIGENTE_COMPLEMENTARIO` | Infraestructura y cobertura de pruebas vigente. |
| `docs/auditoria/H05_Control_Formal_Migraciones.md` | `VIGENTE_COMPLEMENTARIO` | Unica guia vigente de migraciones y baseline. |
| `docs/auditoria/H06_H14_Cierre_AppsScript_Legacy.md` | `VIGENTE_COMPLEMENTARIO` | Cierre formal del legacy Apps Script. |
| `docs/specs/SPEC_H09_H10_Estados_Cierre_Cuatrimestre.md`, `docs/diseno/DISENO_TECNICO_H09_H10_Estados_Cierre_Cuatrimestre.md`, `docs/auditoria/H09_H10_Fase1_Estados_Financieros_Seguros.md` a `H09_H10_Fase4_Frontend_Cierre_Ciclo.md`, `H09_H10_Deploy_Productivo_Resultado.md` | `VIGENTE_COMPLEMENTARIO` | Reglas y cierre desplegado H09/H10. |
| `docs/auditoria/H11_Fase1_Helper_CSV_Central.md`, `H11_Fase2_Finanzas_Nomina_CSV_UTF8.md`, `H11_Fase3A_RH_Docentes_Auditoria_CSV_UTF8.md`, `H11_Fase3B_Frontend_CSV_UTF8.md`, `H11_Cierre_CSV_UTF8_PostDeploy.md` | `VIGENTE_COMPLEMENTARIO` | Implementacion y cierre CSV UTF-8. |
| `docs/specs/SPEC_H12_Catalogos_Historicos.md`, `docs/auditoria/H12_Cierre_Documental_Catalogos_Historicos.md` | `VIGENTE_COMPLEMENTARIO` | Politica operativa de catalogos. |
| `docs/auditoria/H15_Sesion_Inactividad_Frontend.md`, `H15_PreDeploy_Sesion_Inactividad.md`, `H15_Deploy_Productivo_Resultado.md` | `VIGENTE_COMPLEMENTARIO` | Politica y evidencia de sesion H15. |
| `docs/auditoria/H16_Metadata_Favicon_WebApp.md`, `H16_Deploy_Productivo_Metadata_Favicon.md` | `VIGENTE_COMPLEMENTARIO` | Metadata publica y deploy Hosting H16. |
| `docs/auditoria/H17_Diagnostico_Directorio_Capturador_Docente.md`, `H17_Normalizacion_CreatedBy_Directorio_Resultado.md`, `H17_Ajuste_Directorio_Consulta_Coordinador.md` | `VIGENTE_COMPLEMENTARIO` | Regla actual de Directorio y resultado productivo. |
| `docs/specs/SPEC_H18_Reportes_Operativos.md`, `docs/auditoria/H18_Fase1_Backend_Reportes_Operativos.md`, `H18_Fase2_Frontend_Reportes_Operativos.md`, `H18_Fase6_UX_Filtros_Reportes_Operativos.md`, `H18_Hotfix_Reportes_Snapshot_LineKey.md`, `H18_Cierre_Operativo_Reportes_Operativos.md`, `H18_Audit_Dependencias_ExcelJS_20260708.md` | `VIGENTE_COMPLEMENTARIO` | Modulo H18, seguridad npm y cierre operativo. |
| `docs/auditoria/H19_Resultado_Actualizacion_y_Altas_Docentes.md` | `VIGENTE_COMPLEMENTARIO` | Resultado controlado H19. |
| `docs/specs/SPEC_H20_Alcance_Compartido_Nomina_Coordinadores.md`, `docs/auditoria/H20_Alcance_Compartido_Nomina_Coordinadores.md` | `VIGENTE_COMPLEMENTARIO` | Regla, pruebas y seguridad H20. |
| `docs/specs/SPEC_H02_H03_Usuario_Coordinacion_Permisos.md`, `docs/diseno/DISENO_TECNICO_H02_H03_Usuario_Coordinacion_Permisos.md`, `docs/diseno/FLUJO_TRABAJO_H02_H03.md`, `docs/auditoria/Decisiones_H02_H03_Usuario_Coordinacion_Permisos.md` | `HISTORICO` | Diseno aprobado base; consultar SDD para ajustes posteriores. |
| Resto de `docs/auditoria/H02_H03_*.md` no listado como vigente | `HISTORICO` | Fases, preview, dry-run, conciliacion y preparacion de deploy. |
| `docs/auditoria/H09_H10_Analisis_Estados_Cierre_Cuatrimestre.md`, `H09_H10_Fase5_Pruebas_Locales_PreDeploy.md`, `H09_H10_PreDeploy_Check_20260601.md` | `HISTORICO` | Analisis y evidencia predeploy. |
| `docs/auditoria/H11_Inventario_CSV_Acentos_Codificacion.md`, `H11_Fase4_Validacion_Excel_Sheets_CSV.md`, `H11_Deploy_Productivo_Resultado.md` | `HISTORICO` | Inventario, validacion y acta previa al cierre H11. |
| `docs/auditoria/H17_Plan_Normalizacion_CreatedBy_Directorio.md`, `H17_Mapping_Normalizacion_CreatedBy_Directorio.md`, `H17_Validacion_CSV_CreatedBy_Directorio.md` | `HISTORICO` | Mapping y aprobaciones previas a ejecucion. |
| `docs/auditoria/H18_Deploy_Productivo_Reportes_Operativos.md`, `H18_Fase3_Validacion_UI_Exportables_Reportes_Operativos.md` | `HISTORICO` | Cronologia de deploy/validacion; cierre H18 prevalece. |
| `docs/auditoria/H19_Validacion_CSV_Actualizacion_Docentes.md`, `H19_Candidatos_CreatedBy_Docentes.md`, `H19_Validacion_10_Docentes_Nueva_Contratacion.md` | `HISTORICO` | Validaciones y candidatos previos a ejecucion H19. |
| `docs/auditoria/CIERRE_GLOBAL_MATRIZ_RIESGOS_NOMINA_DOCENTE_20260603.md` | `HISTORICO` | Cierre real al 2026-06-03; matriz vigente incluye H15-H20. |
| `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md` | `HISTORICO` | Estado posterior a H02/H03; sustituido por SDD consolidado. |
| `database/cloud_setup.md` | `HISTORICO` | Evidencia de preparacion inicial de infraestructura. |
| `docs/auditoria/Inventario_Tecnico_Pre_Disenio_H02_H03.md`, `docs/Matriz_Priorizacion_Hallazgos_Nomina_Docente.md`, `database/README.md` | `SUPERADO` | Inventarios o instrucciones iniciales sustituidos por SDD, matriz y H05. |
| `database/import_legacy_data.md` | `NO_OPERATIVO` | Procedimiento legacy retirado; no ejecutar en produccion. |
| `docs/screenshots/01-dashboard.png` a `11-auditoria.png` | `REQUIERE_REVISION` | Evidencia visual valida para modulos originales; falta captura de Reportes H18. No bloquea reglas ni operacion. |
| Documentos clasificados como `DUPLICADO` | `DUPLICADO` | Ninguno requiere eliminacion; los DOCX son artefactos derivados identificados. |

## 4. Estado real verificado

### 4.1 Git

| Concepto | Resultado |
|---|---|
| Rama | `feature/h02-h03-user-coordinations-permissions` |
| HEAD previo a esta alineacion | `74c660c docs(sdd): align production state after H20` |
| Upstream | `origin/feature/h02-h03-user-coordinations-permissions` |
| Sincronizacion inicial | 0 ahead / 0 behind |
| Working tree inicial | Limpio |

### 4.2 Cloud Run

| Concepto | Valor verificado read-only |
|---|---|
| Proyecto | `nomina-docente-prod` |
| Servicio / region | `nomina-api` / `us-central1` |
| Revision vigente | `nomina-api-00051-9s5` |
| Revision anterior | `nomina-api-00050-zdm` |
| Trafico | 100% a `nomina-api-00051-9s5` |
| Imagen | `us-central1-docker.pkg.dev/nomina-docente-prod/nomina/nomina-api:h20-prod-56553f4` |
| Digest | `sha256:3773e95e35836acb5ba30382d0465a800accd38491092abd625a07b4719839ac` |
| CPU / memoria | `1` / `512Mi` |
| Concurrencia / timeout | `80` / `300 s` |
| Instancias min / max | `0` / `3` |
| Service account | `nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com` |
| Cloud SQL montado | `nomina-docente-prod:us-central1:nomina-docente-web` |

Nombres de variables observadas, sin publicar valores: `NODE_ENV`,
`FIREBASE_PROJECT_ID`, `GCP_PROJECT_ID`, `ALLOWED_EMAIL_DOMAIN`,
`CORS_ORIGINS`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
`INSTANCE_CONNECTION_NAME`, `CONSTANCIAS_BUCKET` y
`LEGACY_COORDINATION_FALLBACK_ENABLED`. `DB_PASSWORD` permanece referenciado
desde Secret Manager; su valor no fue mostrado.

### 4.3 Firebase Hosting

| Concepto | Valor verificado read-only |
|---|---|
| Sitio / canal | `nomina-docente-prod` / `live` |
| URL | `https://nomina-docente-prod.web.app` |
| Release | `1784228039752000` |
| Version | `41bf160c7c3595b6` (`FINALIZED`) |
| Rewrite | `/api/**` -> Cloud Run `nomina-api`, `us-central1` |
| Publicacion | 2026-07-16T18:53:59.752Z |

### 4.4 Cloud SQL y H05

| Concepto | Valor verificado read-only |
|---|---|
| Instancia / region | `nomina-docente-web` / `us-central1` |
| Motor / estado | PostgreSQL 18 / `RUNNABLE` |
| Tier / disponibilidad | `db-g1-small` / `ZONAL` |
| Backups / PITR | Habilitados / habilitado |
| Base inspeccionada | `nomina_docente` |
| Tablas H05 | `schema_migrations` y `schema_migration_runs` existentes |
| Baseline | 15 |
| Pendientes | 0 |
| Checksum mismatch | 0 |

Solo se ejecuto `db:migrate:inspect`. No se ejecutaron `status`, `dry-run`,
`baseline`, `apply` ni SQL de migracion.

## 5. Matriz de consistencia

| Concepto | Valor real | README | SDD | H13 | Matriz | Manual | Accion |
|---|---|---|---|---|---|---|---|
| Revision Cloud Run vigente | `nomina-api-00051-9s5` | OK | OK | OK | OK H20 | Actualizado | Alineado |
| Imagen/digest API | `h20-prod-56553f4` / `3773e9...` | Actualizado | Actualizado | Actualizado | Referencia H20 | Actualizado | Alineado |
| Revision anterior | `nomina-api-00050-zdm` | Historica | Actualizado | Actualizado | N/A | N/A | Preservada como rollback |
| Hosting | release `1784228039752000`, version `41bf160c7c3595b6` | OK | OK | OK | H20 activo | Actualizado | Alineado |
| Base productiva | `nomina_docente` | OK | OK | OK | OK | OK | Sin cambio |
| Service account | `nomina-api-sa@...` | Deploy | OK | OK | N/A | OK | Sin secreto |
| Recursos Cloud Run | min 0, max 3, CPU 1, 512Mi, concurrencia 80, timeout 300 s | Actualizado | Actualizado | Actualizado | N/A | Actualizado | Verificado en vivo |
| H05 | baseline 15, pending 0, mismatch 0 | OK | OK | Checklist | OK | Actualizado | Inspect read-only |
| Fallback H02 | habilitado y en monitoreo | OK | OK | OK | H02 monitoreo | Regla vigente | Sin retiro |
| Permisos fiscales | Separados de operacion/preview | Resumen | OK | Checklist | H03 bajo monitoreo | Actualizado | Sin ampliacion |
| Coordinador H20 | Docente propio o compartido; carga completa read-only; sin fiscal/finalize | OK | OK | Evidencia | H20 cerrado | Actualizado | Sin regla nueva |
| Apps Script | Retirado/no operativo | OK | OK | OK | H06/H14 cerrado | Actualizado | Import legacy marcado no operativo |
| Deploy / rollback | H13 + acta mas reciente | OK | Precedencia | Actualizado | N/A | Actualizado | Cronologia preservada |

Estados consolidados: H01 cerrado; H02/H03 cerrados en monitoreo de fallback;
H04 implementado hasta F5; H05 cerrado; H06/H14 cerrado; H07 opcional; H08
pendiente; H09/H10 cerrado/desplegado; H11 cerrado operativo; H12/H13
cerrados documentales; H15/H16 desplegados; H17 ejecutado; H18 cerrado
operativo; H19 ejecutado y H20 cerrado operativo.

## 6. Inconsistencias y correcciones

1. H13 no contenia los despliegues H18 inicial, H18-F6, hotfix H18 y H20.
2. Digest, concurrencia y timeout reales no estaban consolidados.
3. Los manuales no describian Reportes H18, mantenimiento H19 ni alcance H20.
4. El alcance de Directorio/preview en manuales conservaba reglas previas a H17/H20.
5. README presentaba la importacion legacy como comando util operativo.
6. `database/README.md` podia inducir a reaplicar `001_initial_schema.sql`.
7. `database/cloud_setup.md` solo enumeraba migraciones 001/002 sin marcar su fecha historica.
8. La SPEC H09/H10 aun presentaba como estado actual que no habia implementacion.
9. SDD retrospectivo, matriz inicial y cierre global no indicaban de forma visible que fueron superados por fuentes posteriores.
10. Los manuales mostraban conteos preoperativos sin calificarlos como snapshot historico.
11. Existian rutas locales con perfil `C:\Users\...`; se hicieron portables o se anonimizaron sin cambiar la evidencia funcional.
12. La precedencia documental del SDD no colocaba SDD/matriz en el orden aprobado post-H20.

## 7. Historia preservada

Se conservaron sin reemplazo global:

- `nomina-api-00050-zdm` como revision H18, revision anterior H20 y rollback.
- Las revisiones 00043 a 00049 en sus actas originales.
- Los releases Hosting anteriores y sus fechas.
- Backups, resultados de pruebas, dry-runs y migraciones reales de cada fase.
- Los 15 nombres historicos de migracion, incluidos prefijos duplicados 007/008/009.
- El estado H18 inicial dentro de su cronologia, con referencia explicita al cierre posterior.
- El snapshot preoperativo de mayo 2026, ahora marcado como historico.

## 8. Pendientes documentales reales

- Actualizar capturas visuales si se requiere incorporar la ruta `/reports` al manual ilustrado.
- Mantener sincronizados los DOCX regenerados con sus fuentes Markdown.
- Los generadores DOCX conservan metadata de portada hardcodeada de mayo 2026; en esta alineacion la portada se ajusto durante la regeneracion sin modificar los scripts. Una fase futura puede parametrizar esa metadata.
- Revisar H13 cuando cambie infraestructura real o se ejecute un nuevo deploy.
- No retirar el fallback H02 ni reabrir reglas cerradas sin fase y decision humana.

Ninguno de estos pendientes bloquea la operacion productiva actual.

## 9. Confirmaciones

- Solo se modifico documentacion y artefactos documentales generados.
- No se modifico codigo funcional ni tests.
- No se modifico SQL.
- No se modifico base de datos.
- No se ejecutaron migraciones, seeds, importaciones ni escrituras.
- No se hizo deploy.
- No se cambiaron variables, secretos, CORS o infraestructura.
- No se cambiaron permisos, roles, reglas de negocio ni H01.
- No se publicaron secretos.

## 10. Validaciones documentales

- Los DOCX regenerados superaron validacion estructural: contenedor ZIP valido,
  contenido legible, tablas presentes, textos post-H20 esperados y sin mojibake
  detectado.
- La renderizacion visual automatizada de los DOCX no pudo ejecutarse porque
  LibreOffice/`soffice` no esta instalado en el equipo. Esta limitacion no
  afecta el contenido fuente Markdown, pero la revision visual de paginacion
  queda como observacion documental no bloqueante.
- Se verifico que el diff se limite a README, Markdown y los dos DOCX.
- Se verifico que no queden rutas absolutas del perfil local en la
  documentacion versionada; las menciones genericas `C:\Users\...` solo
  describen el hallazgo corregido.
