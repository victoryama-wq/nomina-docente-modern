# Cierre Global Matriz de Riesgos Nomina Docente - 2026-06-03

Estado documental: **histórico**.

Fuente vigente:
`docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md`.

Este cierre conserva el estado real del 2026-06-03; las fases H15-H20 posteriores se consolidan en la matriz y el SDD vigentes.

## 1. Resumen ejecutivo

La matriz de riesgos del sistema Nomina Docente queda cerrada operativamente para los riesgos principales identificados.

Los riesgos criticos y altos fueron atendidos mediante correcciones tecnicas, documentacion, pruebas automatizadas, despliegues controlados, controles de migracion o politicas operativas. Esta fase de cierre global es exclusivamente documental y no introduce cambios tecnicos.

Resultado ejecutivo:

- H01, H02, H03, H05, H06, H09, H10, H11, H12, H13 y H14 quedan cerrados o cerrados operativamente/documentalmente segun su naturaleza.
- H04 queda implementado hasta Fase 5, con H04-F6 Playwright como opcion posterior no bloqueante.
- H07, H08, CSV injection, fallback legacy H02 y copias externas Apps Script quedan clasificados como monitoreo, mejora futura u opcion institucional.
- No hay bloqueantes tecnicos para la operacion actual.
- No se realizaron cambios de codigo, base de datos, produccion, variables, secretos, permisos, UI ni reglas de negocio en esta fase.

## 2. Estado productivo vigente

| Elemento | Estado |
|---|---|
| Frontend produccion | `https://nomina-docente-prod.web.app` |
| API Cloud Run directa | `https://nomina-api-443985127112.us-central1.run.app` |
| API via Firebase Hosting | `https://nomina-docente-prod.web.app/api/health` |
| Proyecto Firebase/GCP | `nomina-docente-prod` |
| Cloud Run | Servicio `nomina-api`, region `us-central1` |
| Revision Cloud Run vigente documentada | `nomina-api-00046-6ck` |
| Firebase Hosting live | Sitio `nomina-docente-prod`, canal `live` |
| Base productiva | Cloud SQL PostgreSQL, base `nomina_docente` |
| Bucket constancias | `nomina-docente-prod-constancias` |
| Service account API | `nomina-api-sa@nomina-docente-prod.iam.gserviceaccount.com` |
| H05 baseline | 15 migraciones registradas, `pending=0`, `checksum mismatch=0` |
| Ultimos deploys relevantes | H02/H03, H09/H10, H11-F5 |
| H13 checklist productivo permanente | Creado y vigente en `docs/auditoria/H13_Checklist_Productivo_Permanente.md` |

## 3. Estado final por riesgo

| H | Riesgo | Estado final | Tipo de cierre | Riesgo residual | Observacion |
|---|---|---|---|---|---|
| H01 | Precision monetaria | Cerrado | Tecnico/operativo | Bajo | `decimal.js`, strings decimales y pruebas de regresion protegen calculos monetarios. |
| H02 | Coordinacion, alcance operativo y fallback legacy | Cerrado operativo / fallback en monitoreo | Operativo con monitoreo | Medio mientras fallback siga activo | `user_coordinations` y `actorCoordinations[]` son fuente formal; fallback no crea coordinaciones. |
| H03 | Fiscal, documentos, finanzas, workflow y payroll preview | Cerrado operativo | Seguridad/permisos | Bajo a medio por regresion futura | Permisos separados: fiscal, documentos, finance export/workflow y payroll preview/finalize. |
| H04 | Pruebas automatizadas de negocio | Implementado hasta Fase 5 | Calidad / regresion | Medio-bajo | H04-F6 Playwright queda opcional posterior. |
| H05 | Control formal de migraciones SQL | Cerrado | DevOps / base de datos | Bajo | Baseline productivo 001 a 012, 0 pendientes y 0 checksum mismatch. |
| H06 | Coexistencia Apps Script legacy | Cerrado | Documental / repositorio | Bajo | Legacy retirado del repositorio; copias externas quedan como pendiente institucional. |
| H07 | Google Provider `hd` | Mejora UX opcional / mitigado por backend | Mejora futura | Medio-bajo | Backend ya valida dominio institucional; `hd` no es control principal. |
| H08 | Archivos grandes / mantenibilidad | Mejora tecnica futura | Refactor planificado | Medio | No bloquea operacion; refactor solo con pruebas verdes y sin cambiar contratos. |
| H09 | Estados `BORRADOR` y `CERRADA` ambiguos | Cerrado/desplegado | Tecnico/operativo | Bajo | `PAGADA` terminal; `BORRADOR`/`CERRADA` de payroll quedan reservados/no operativos. |
| H10 | Cierre moderno de cuatrimestre/ciclo | Cerrado/desplegado / cierre real con checklist | Operativo con aprobacion | Medio-bajo | Cierre real es irreversible y requiere aprobacion, precondiciones y checklist. |
| H11 | CSV, acentos, BOM UTF-8 y Excel | Cerrado operativo | Reportes / compatibilidad | Bajo | CSV criticos validados en Excel institucional; sanitizacion CSV injection queda futura. |
| H12 | Catalogos/tabuladores historicos | Cerrado documental / politica operativa | Gobierno documental | Bajo si se sigue politica | No intervenir tecnicamente; inactivar antes que borrar y conservar historicos. |
| H13 | Variables productivas, secretos, CORS, deploy y rollback | Cerrado documental / checklist permanente | Gobierno DevOps | Bajo | Checklist obligatorio antes de deploy productivo. |
| H14 | Apps Script legacy extenso | Cerrado | Documental / retiro legacy | Bajo | `Codigo.gs` e `index.html` retirados; Git conserva trazabilidad historica. |

## 4. Riesgos cerrados

### H01

Precision monetaria cerrada tecnica y operativamente.

El sistema usa `decimal.js`, conserva importes monetarios como string decimal y evita calculos oficiales de dinero con `number`, `parseFloat`, `Number()` o conversiones flotantes de PostgreSQL. H01 no debe modificarse sin SPEC, pruebas y aprobacion formal.

### H02/H03

Permisos, coordinacion, fiscal, finanzas y workflow quedan cerrados operativamente.

H02:

- `user_coordinations` existe como fuente formal.
- `actorCoordinations[]` representa el alcance del actor.
- No se crean coordinaciones automaticamente.
- Docentes compartidos pueden existir sin otorgar edicion global.
- Propiedad/capturador protege Horarios/Extras donde aplica.
- Fallback legacy queda activo solo como contingencia temporal en monitoreo.

H03:

- `fiscal.view`, `fiscal.manage`, `fiscal.document.view`, `fiscal.document.manage`.
- `finance.view`, `finance.export`, `finance.workflow`.
- `payroll.preview`, `payroll.finalize`.
- `finance.view` no habilita workflow ni fiscal.
- `teachers.manage` no habilita fiscal.
- Coordinador no gestiona fiscal, finanzas globales ni guardado de nomina.

### H05

Control formal de migraciones cerrado.

Produccion cuenta con tablas `schema_migrations` y `schema_migration_runs`, baseline 001 a 012, 15 registros, `pending=0` y `checksum mismatch=0`. Futuras migraciones deben iniciar desde 013, sin repetir prefijos, con backup, H05 y confirmacion manual.

### H06/H14

Apps Script legacy cerrado.

`Codigo.gs` e `index.html` fueron retirados del repositorio porque ya no son fuente operativa ni referencia funcional valida. La trazabilidad historica queda en Git y en la documentacion.

### H09/H10

Estados financieros y cierre de ciclo cerrados/desplegados.

- `PAGADA` es terminal.
- `CANCELADA` solo funciona antes de `PAGADA`.
- `BORRADOR` y `CERRADA` de `payroll_runs` quedan reservados/no operativos.
- `PLANEACION` representa ciclo borrador operativo.
- Horarios se permiten en `PLANEACION`.
- Incidencias, Extras y Nomina se bloquean en `PLANEACION`.
- Ciclo `CERRADO` es irreversible.
- Cierre controlado usa `quarter_closures` y evidencia en `audit_log`.
- No hubo migracion 013 para H09/H10.

### H11

CSV UTF-8, acentos y Excel cerrado operativo.

Los exportables CSV criticos backend/frontend fueron estandarizados con BOM UTF-8 y validados en Excel institucional. Quedan como observaciones futuras Google Sheets/LibreOffice si se vuelven consumidores operativos y sanitizacion CSV injection por exportable.

### H12

Catalogos historicos cerrado documentalmente.

La decision humana fue no intervenir tecnicamente porque el sistema funciona correctamente. Queda politica operativa:

- inactivar antes que borrar;
- no modificar importes historicos usados;
- no borrar registros usados;
- crear nuevo registro si cambia significado;
- excepciones solo con respaldo, analisis, aprobacion y auditoria.

### H13

Checklist productivo permanente cerrado documentalmente.

H13 documenta estado productivo vigente, variables no secretas, secretos, CORS, Cloud Run, Firebase Hosting, Cloud SQL/H05, Cloud Storage, predeploy, deploy, postdeploy, rollback y prohibiciones permanentes.

## 5. Riesgos en monitoreo

### Fallback legacy H02

- Estado: activo en monitoreo.
- Accion: revisar logs de `LEGACY_COORDINATION_FALLBACK_USED`.
- Criterio futuro: una quincena operativa sin errores de acceso ni uso indebido.
- Resultado esperado: preparar retiro posterior solo con decision humana y pruebas.

### H10 cierre real de ciclo

- Estado: funcionalidad desplegada.
- Accion: no ejecutar cierre real sin aprobacion operativa, backup si aplica, precondiciones y checklist.
- Riesgo: irreversible.
- Control: H13 + evidencia en `quarter_closures` y `audit_log`.

### H04-F6 Playwright

- Estado: opcional posterior.
- Accion: ejecutar solo si se decide validar e2e navegador.
- No bloquea operacion actual porque H04 cubre unitarias, integracion API/PostgreSQL y frontend de permisos hasta Fase 5.

## 6. Mejoras futuras no bloqueantes

### H07 Google Provider `hd`

- Estado: mejora UX opcional.
- Backend ya valida dominio institucional.
- No es control principal de seguridad.
- Puede evaluarse con Admin Google si se desea mejorar experiencia de seleccion de cuenta.

### H08 refactor gradual

- Estado: mejora tecnica planificada.
- No bloquea operacion.
- Debe ejecutarse solo con pruebas verdes, cambios incrementales y sin cambiar contratos ni reglas de negocio.

### CSV injection

- Estado: mejora futura por exportable.
- El helper CSV ya soporta sanitizacion opcional.
- No se activo en H11 para no transformar datos exportados.
- Requiere decision por exportable y validacion con usuarios consumidores.

### Copias externas Apps Script

- Estado: pendiente externo/institucional.
- Si existen copias en Google Drive, respaldos o areas administrativas, deben marcarse como historicas/no operativas.
- No afectan el repositorio actual.

## 7. Barreras permanentes de control

Quedan como controles permanentes:

- H04: pruebas automatizadas.
- H05: control formal de migraciones.
- H13: checklist productivo permanente.
- SDD consolidado como fuente documental principal.
- Matriz formal de riesgos.
- Documentos de cierre/deploy por fase.
- No produccion sin backup, checklist y confirmacion cuando aplique.
- No migraciones fuera de H05.
- No cambios a reglas cerradas sin SPEC o decision humana formal.
- No uso de datos locales/test/seeds como fuente productiva sin plan aprobado.

## 8. Reglas para futuras fases

1. Leer primero `docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md`.
2. Leer matriz formal vigente.
3. Leer `docs/auditoria/H05_Control_Formal_Migraciones.md` si hay SQL.
4. Leer `docs/auditoria/H13_Checklist_Productivo_Permanente.md` antes de deploy.
5. No tocar produccion sin backup, checklist y confirmacion manual cuando aplique.
6. No usar datos locales/test como fuente productiva.
7. No cambiar H01/H02/H03/H05/H09/H10/H11/H12/H13 sin SPEC o decision formal.
8. Todo cambio debe pasar por pruebas y checklist correspondiente.
9. No imprimir secretos ni registrar datos fiscales sensibles innecesarios.
10. No reabrir riesgos cerrados salvo decision humana nueva y documentada.

## 9. Estado final de la matriz

La matriz de riesgos queda cerrada para los riesgos principales.

Pendientes restantes:

- monitoreo del fallback legacy H02;
- disciplina operativa para cierre real H10;
- H04-F6 Playwright opcional;
- H07/H08 como mejoras futuras;
- CSV injection como decision futura por exportable;
- copias externas Apps Script como revision institucional externa.

No hay bloqueantes tecnicos para la operacion actual. El sistema queda documentado, probado, desplegado y con controles de release/migracion.

## 10. Recomendacion final

- No reabrir H01/H02/H03/H05/H09/H10/H11/H12/H13 salvo nueva decision formal.
- Mantener monitoreo del fallback legacy H02.
- Usar checklist H13 antes de cualquier deploy.
- Mantener pruebas H04 verdes.
- Planificar H07/H08 solo como mejoras futuras.
- Mantener H05 como unica via para migraciones SQL.
- Cerrar la revision de matriz para entrega del viernes.

## 11. Confirmaciones de alcance

Confirmado en esta fase documental:

- No se modifico codigo.
- No se modifico BD.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se toco produccion.
- No se cambiaron reglas de negocio.
- No se cambiaron permisos.
- No se cambiaron interfaces.
- No se cambiaron rutas.
- No se cambiaron variables productivas.
- No se tocaron secretos.
