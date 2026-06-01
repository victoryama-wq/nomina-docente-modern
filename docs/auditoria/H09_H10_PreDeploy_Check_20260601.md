# H09/H10 - PreDeploy Check 2026-06-01

## 1. Estado Git

- Rama esperada: `feature/h02-h03-user-coordinations-permissions`.
- Rama actual verificada: `feature/h02-h03-user-coordinations-permissions`.
- Working tree: limpio antes de crear este reporte.
- Archivos sin seguimiento: ninguno.
- Sin migracion `013`.
- Documentos H09/H10 versionados:
  - `docs/auditoria/H09_H10_Analisis_Estados_Cierre_Cuatrimestre.md`
  - `docs/specs/SPEC_H09_H10_Estados_Cierre_Cuatrimestre.md`
  - `docs/diseno/DISENO_TECNICO_H09_H10_Estados_Cierre_Cuatrimestre.md`
  - `docs/auditoria/H09_H10_Fase1_Estados_Financieros_Seguros.md`
  - `docs/auditoria/H09_H10_Fase2_Ciclo_Planeacion_Horarios.md`
  - `docs/auditoria/H09_H10_Fase3_Cierre_Ciclo_Cuatrimestre.md`
  - `docs/auditoria/H09_H10_Fase4_Frontend_Cierre_Ciclo.md`

Observacion: al iniciar esta verificacion, la rama local estaba `ahead 4` respecto a `origin/feature/h02-h03-user-coordinations-permissions`. Para deploy controlado, la rama debe subirse y quedar sincronizada antes de construir desde remoto.

Ultimos commits verificados:

```text
baeac80 docs(h02-h03): document local firebase uid login incident
a682c1e fix(h02): list active operational users for schedule responsibles
a914d48 fix(h02): align schedule operational responsible selector
c7dc400 test(h09-h10): document local predeploy validation
8f2e955 feat(h09-h10): add cycle closure frontend controls
b785fd9 docs(h09-h10): add states and cycle closure specifications
a694f73 feat(h09-h10): add controlled cycle closure backend
5f0144d feat(h09-h10): allow schedules in planning cycles
224a21e test(h09-h10): enforce terminal paid payroll status
723c64b test(h04): stabilize operational capture windows
```

## 2. Validaciones ejecutadas

Todas las validaciones se ejecutaron localmente. Para integracion API se preparo y uso exclusivamente `nomina_docente_test`.

| Comando | Resultado |
|---|---|
| `npm run test` | Paso. API 4 archivos / 14 pruebas; Web 7 archivos / 23 pruebas. |
| `npm run test:api` | Paso. 4 archivos / 14 pruebas. |
| `npm run test:db:prepare` | Paso. `nomina_docente_test` preparada con migraciones y seed H04. |
| `npm run test:api:integration` con `TEST_DB_NAME=nomina_docente_test` | Paso. 5 archivos / 43 pruebas. |
| `npm run test:web` | Paso. 7 archivos / 23 pruebas. |
| `npm --workspace apps/api run typecheck` | Paso. |
| `npm --workspace apps/web run typecheck` | Paso. |
| `npm run typecheck` | Paso. |
| `npm run build` | Paso. Build API y build Web correctos. |

Nota: una ejecucion inicial de `npm run test:api:integration` quedo en `skipped` porque no estaba definido explicitamente `TEST_DB_NAME=nomina_docente_test`. Se preparo la base de test y se repitio con variables de test; la suite paso completa con 43 pruebas.

Variables usadas para integracion:

```text
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=nomina_docente_test
TEST_DB_USER=app_nomina
TEST_DB_PASSWORD=********
```

## 3. Resultado funcional confirmado

### Finanzas

- `PAGADA` queda como estado terminal financiero.
- `PAGADA -> CANCELADA` se bloquea.
- `PAGADA -> EN_REVISION`, `PAGADA -> APROBADA` y otros retrocesos quedan bloqueados.
- `CANCELADA` conserva la logica actual solo antes de `PAGADA`.
- `BORRADOR` y `CERRADA` no se usan como acciones financieras operativas.
- Frontend no muestra cancelacion para corridas `PAGADA`.

### Ciclo `PLANEACION`

- Horarios permitidos para preparacion de ciclo.
- Incidencias bloqueadas.
- Extras bloqueados.
- Nomina preview/guardado bloqueados.

### Ciclo `CERRADO`

- Horarios bloqueados.
- Incidencias bloqueadas.
- Extras bloqueados.
- Nomina bloqueada.
- Estado tratado como historico/irreversible.

### Cierre controlado

Validado por pruebas de integracion:

- Admin puede cerrar ciclo `ACTIVO` cuando existe ciclo siguiente `PLANEACION` con horarios.
- No Admin no puede cerrar.
- Falla si faltan quincenas con corrida `PAGADA`.
- Falla si hay corridas pendientes.
- Falla si el ciclo siguiente no esta en `PLANEACION`.
- Falla si el ciclo siguiente no tiene horarios.
- Registra `quarter_closures`.
- Registra evidencia en `audit_log`.
- Ciclo actual queda `CERRADO`.
- Ciclo siguiente queda `ACTIVO`.

### Frontend

- `CalendarView` incluye panel de cierre controlado.
- Muestra confirmacion de cierre irreversible.
- `SchedulesView` permite trabajo en `PLANEACION`.
- `IncidencesView`, `ExtrasView` y `PayrollView` bloquean `PLANEACION` y `CERRADO`.
- `FinanceReportsView` no muestra cancelar para `PAGADA`.

## 4. Confirmacion de no migracion

- H09/H10 no requiere migracion para la primera implementacion.
- No existe `database/013*.sql`.
- No se modificaron tablas funcionales.
- No se ejecuto ninguna migracion.
- No se modifico Cloud SQL.
- No se modifico base productiva.

La decision tecnica vigente es:

- ciclo borrador = `academic_cycles.status = 'PLANEACION'`;
- no se agrega `BORRADOR` a `cycle_status`;
- no se usa `payroll_runs.status = 'BORRADOR'` para ciclos;
- no se usa `payroll_runs.status = 'CERRADA'` para cierre de cuatrimestre;
- `quarter_closures` se usa como esta;
- evidencia detallada se apoya en `audit_log`.

## 5. Predeploy tecnico

- No hay migraciones nuevas.
- No hay cambios de BD requeridos para H09/H10.
- H05 baseline productivo esta documentado con `pending = 0` y `checksum mismatch = 0`.
- No se tocaron variables de Cloud Run.
- CORS no requiere cambios.
- Firebase Hosting no requiere cambios de configuracion.
- Se recomienda backup previo a deploy productivo aunque no exista migracion, por disciplina de release.

## 6. Riesgos

| Riesgo | Severidad | Mitigacion |
|---|---|---|
| Rama local no sincronizada con origin al iniciar precheck. | Media | Subir commits pendientes antes del deploy. |
| Cierre de ciclo es irreversible en operacion normal. | Alta | Ejecutar smoke test con Admin y confirmar ciclo actual/siguiente antes de cerrar. |
| Ruta administrativa legacy de activacion manual sigue existiendo como compatibilidad. | Media | Usar cierre controlado como flujo operativo; documentar activacion manual como recurso administrativo excepcional. |
| Produccion puede tener ciclos/quincenas con datos historicos no equivalentes al seed de test. | Media | Hacer backup, healthcheck y smoke test por rol despues del deploy. |
| Si se construye desde rama local sin push, CI/revision remota no vera el ultimo estado. | Media | Requisito: `git push` antes de deploy. |

## 7. Plan de deploy controlado

1. Sincronizar rama con `origin`.
2. Crear backup Cloud SQL previo.
3. Confirmar que no hay migraciones pendientes ni `013`.
4. Ejecutar build desde commit aprobado.
5. Desplegar API Cloud Run.
6. Desplegar Firebase Hosting.
7. Ejecutar healthcheck:
   - `/health` debe responder 200.
   - `/auth/session` sin token debe responder 401 esperado.
8. Smoke test por rol:
   - Admin: CalendarView, cierre visible, finanzas, nomina.
   - Coordinador: Horarios/Incidencias/Extras respetando permisos H02.
   - Finanzas: workflow financiero sin cancelar `PAGADA`.
   - Direccion: consulta sin workflow indebido.
9. Smoke test H09/H10:
   - `PLANEACION`: Horarios si, Incidencias/Extras/Nomina no.
   - `CERRADO`: todo operativo bloqueado.
   - `PAGADA`: sin cancelar.

## 8. Plan de rollback

- Rollback API: redeploy de la revision anterior de Cloud Run.
- Rollback frontend: redeploy de version anterior de Firebase Hosting o rollback del release.
- Base de datos: no hay migracion H09/H10 que revertir.
- Si ocurre incidente operativo de ciclo, detener cierre manual y revisar `audit_log`/`quarter_closures` antes de nuevas acciones.

## 9. Recomendacion final

Resultado tecnico: H09/H10 esta listo para deploy controlado desde el punto de vista de pruebas automatizadas, typecheck y build.

Condicion previa obligatoria antes de ejecutar deploy: subir la rama y confirmar sincronizacion con `origin`.

Recomendacion: deploy autorizado con condiciones:

1. `git push` de commits pendientes.
2. backup Cloud SQL previo.
3. healthcheck posterior.
4. smoke test por rol y por estado de ciclo.

## 10. Confirmaciones

- No se hizo deploy.
- No se toco produccion.
- No se uso `nomina_docente` productiva.
- No se ejecutaron migraciones.
- No se modifico BD productiva.
- No se modificaron reglas de negocio.
- No se tocaron H01/H02/H03/H05.
