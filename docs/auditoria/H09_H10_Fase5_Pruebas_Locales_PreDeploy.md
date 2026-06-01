# H09/H10 Fase 5 - Pruebas locales predeploy

## 1. Ambiente usado

- Fecha local: 2026-06-01.
- Rama: `feature/h02-h03-user-coordinations-permissions`.
- Commit base probado: `8f2e955 feat(h09-h10): add cycle closure frontend controls`.
- API local: `http://localhost:8080`.
- Frontend local: `http://localhost:5173`.
- Base usada para pruebas automatizadas e inspeccion local: `nomina_docente_test`.
- Host/puerto DB local: `localhost:5432`.
- Usuario DB local: `app_nomina`.

Confirmaciones:

- No se uso `nomina_docente` productiva.
- No se conecto a Cloud SQL productivo.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se modifico base productiva.

## 2. Validaciones automatizadas

Resultado:

| Validacion | Resultado |
|---|---|
| `npm run test` | Paso |
| `npm run test:api` | Paso |
| `npm run test:api:integration` | Paso |
| `npm run test:web` | Paso |
| `npm --workspace apps/api run typecheck` | Paso |
| `npm --workspace apps/web run typecheck` | Paso |
| `npm run typecheck` | Paso |
| `npm run build` | Paso |

Detalle relevante:

- Suite API unitaria/smoke: 4 archivos, 14 pruebas, todas pasaron.
- Suite web: 7 archivos, 23 pruebas, todas pasaron.
- Suite API integracion con PostgreSQL local `nomina_docente_test`: 5 archivos, 42 pruebas, todas pasaron.
- La suite H09/H10 de integracion cubre cierre controlado exitoso, bloqueo sin ciclo siguiente valido, bloqueo con ciclo ya cerrado, bloqueo con faltantes `PAGADA`, bloqueo con corridas pendientes, ciclo cerrado irreversible y `PAGADA` terminal.

## 3. Validacion SQL de dataset local

La conexion SQL confirmo:

```text
current_database = nomina_docente_test
current_user     = app_nomina
server_port      = 5432
```

Estado de ciclos detectado:

| Ciclo | Codigo | Estado | Observacion |
|---|---|---|---|
| H04 QA Local 2026 | H04TEST | ACTIVO | Tiene datos operativos H04/H02/H03 y una corrida `EN_REVISION`; no es candidato limpio para cierre manual UI. |
| H09 QA Planeacion 2026 | H09PLAN | PLANEACION | Tiene horario para validar Horarios en planeacion. |
| H09 QA Cerrado 2026 | H09CLOSED | CERRADO | Tiene horario para validar bloqueo de ciclo cerrado. |
| H10 QA Cierre Pagado 2026 | H10CLOSE | PLANEACION | Escenario de cierre controlado usado por pruebas de integracion. |
| H10 QA Siguiente Planeacion 2026 | H10NEXT | PLANEACION | Escenario de siguiente ciclo con horarios. |
| H10 QA Planeacion Sin Horarios 2026 | H10NOSCHED | PLANEACION | Escenario negativo. |
| H10 QA Cierre Sin Pagada 2026 | H10UNPAID | PLANEACION | Escenario negativo. |
| H10 QA Cierre Pendiente 2026 | H10PENDING | PLANEACION | Escenario negativo con corrida pendiente. |
| H10 QA Cierre Solo Cancelada 2026 | H10CANCEL | PLANEACION | Escenario negativo con solo cancelada. |

Corridas detectadas:

| Estado | Total observado |
|---|---:|
| `PAGADA` | 3 |
| `CANCELADA` | 1 |
| `CALCULADA` | 1 |
| `EN_REVISION` | 1 |

Horarios por ciclo:

| Ciclo | Horarios |
|---|---:|
| H04 QA Local 2026 | 2 |
| H09 QA Planeacion 2026 | 1 |
| H09 QA Cerrado 2026 | 1 |
| H10 QA Cierre Pagado 2026 | 1 |
| H10 QA Siguiente Planeacion 2026 | 1 |

Post-cierre persistente:

- `quarter_closures`: 0 filas en la BD persistente inspeccionada.
- `audit_log` con acciones de ciclo/cierre: 0 filas en la BD persistente inspeccionada.

Esto es esperado para esta corrida porque el cierre controlado fue validado por pruebas de integracion con escenarios reseteados, no por una ejecucion manual persistente desde UI.

## 4. API local

La API local se levanto con:

- `NODE_ENV=development`.
- `PORT=8080`.
- `DB_NAME=nomina_docente_test`.
- `DB_HOST=localhost`.
- `DB_PORT=5432`.

Validaciones:

| Endpoint | Resultado |
|---|---|
| `GET http://localhost:8080/health` | 200 |
| `GET http://localhost:8080/api/health` | 200 |
| `GET http://localhost:8080/auth/session` sin token | 401 esperado |

La respuesta de `/health` reporto servicio `nomina-docente-api` y 24 tablas accesibles en la BD local.

## 5. Frontend local

El frontend local se levanto con:

- `VITE_API_BASE_URL=http://localhost:8080`.
- `VITE_FIREBASE_PROJECT_ID=nomina-docente-prod`.
- `VITE_FIREBASE_AUTH_DOMAIN=nomina-docente-prod.firebaseapp.com`.

Validaciones:

| URL | Resultado |
|---|---|
| `http://localhost:5173` | 200 |

La pantalla de login institucional cargo correctamente y no se observaron errores de consola en la carga inicial.

La prueba interactiva autenticada con Admin real queda pendiente de ejecucion humana porque requiere sesion Firebase real. No se forzo ni se simulo una sesion productiva desde esta validacion.

## 6. CalendarView y cierre controlado

Validado automaticamente por integracion:

- Admin puede cerrar un ciclo candidato con todas sus quincenas `PAGADA`.
- El ciclo cerrado pasa a `CERRADO`.
- El ciclo siguiente en `PLANEACION` pasa a `ACTIVO`.
- Se valida que el ciclo siguiente exista y este en `PLANEACION`.
- Se valida que el ciclo siguiente tenga horarios.
- Se registra evidencia de cierre en `quarter_closures` y `audit_log` dentro del escenario de prueba.
- Usuarios no admin no pueden ejecutar el cierre.
- Un ciclo ya `CERRADO` no puede cerrarse otra vez.

Pendiente manual UI:

- Ejecutar el cierre desde `CalendarView` con sesion Admin real sobre un escenario local preparado.
- El ciclo `ACTIVO` persistente actual (`H04 QA Local 2026`) no es candidato limpio de cierre porque tiene una corrida `EN_REVISION`.

## 7. Nuevo ciclo en PLANEACION

Validado automaticamente:

- Horarios permite crear y editar en ciclo `PLANEACION`.
- Incidencias bloquea captura en ciclo `PLANEACION`.
- Extras bloquea captura en ciclo `PLANEACION`.
- Nomina bloquea preview/guardado en ciclo `PLANEACION`.

Pendiente manual UI:

- Crear desde `CalendarView` un nuevo ciclo futuro `PLANEACION`.
- Configurar quincenas.
- Confirmar en `SchedulesView` que se puede preparar horario.

## 8. Ciclo CERRADO irreversible

Validado automaticamente:

- Horarios no permite crear en ciclo `CERRADO`.
- Horarios no permite editar en ciclo `CERRADO`.
- Horarios no permite eliminar en ciclo `CERRADO`.
- Incidencias no permite captura en ciclo `CERRADO`.
- Extras no permite captura/edicion/eliminacion en ciclo `CERRADO`.
- Nomina no permite preview ni guardado en ciclo `CERRADO`.

## 9. Finanzas y PAGADA terminal

Validado automaticamente:

- `PAGADA` es terminal.
- Una corrida `PAGADA` no puede cambiar a `CANCELADA`, `EN_REVISION` ni `APROBADA`.
- `CANCELADA` sigue funcionando antes de `PAGADA`.
- La UI de Finanzas no muestra cancelacion para corridas `PAGADA`.
- `BORRADOR` y `CERRADA` no aparecen como acciones de workflow financiero.

## 10. Bloqueantes

No hay bloqueantes automatizados: test, typecheck y build pasaron.

Bloqueante operativo para declarar la prueba manual UI como completa:

- Falta ejecutar la prueba con sesion Admin real en `http://localhost:5173`.
- El ciclo `ACTIVO` persistente actual tiene una corrida `EN_REVISION`; para una prueba manual de cierre se debe preparar o seleccionar un escenario local limpio con todas sus quincenas `PAGADA` y sin pendientes.

## 11. Observaciones

- La cobertura automatizada H09/H10 es la evidencia principal de negocio para cierre controlado y estados financieros.
- El servidor local y el frontend local quedaron disponibles para revision manual.
- No se hizo ningun cambio funcional durante esta validacion.
- No se modifico produccion ni Cloud SQL productivo.

## 11.1 Correccion predeploy detectada en Horarios

Durante la revision local posterior se detecto una regresion visual/contractual en el modal de Horarios:

- El campo `Responsable operativo` estaba mostrando ambitos tecnicos de `coordinations`, por ejemplo `ADETUR`, `ARQ`, `DIGRAF`, `Idiomas` y `SISCOM`.
- Esa lista no representa personas responsables y podia confundirse con una asignacion operativa manual.
- La regla aprobada en H02/H03 es que la operacion diaria se base en usuario capturador/propietario (`schedules.created_by`), mientras `coordinations` queda como referencia tecnica/legacy para reportes, nomina e importaciones.

Correccion aplicada en local:

- `GET /schedules/context` devuelve para Admin/Direccion opciones visibles de responsables operativos basadas en usuarios activos (`app_users.display_name` o email) vinculados a `user_coordinations`.
- El valor tecnico interno puede seguir usando la coordinacion primaria para compatibilidad con el esquema actual.
- Para Coordinador/no-admin, el modal muestra `Responsable operativo` en solo lectura con el nombre del usuario conectado.
- Se agrego prueba de integracion para asegurar que el selector Admin muestra responsables operativos y no ambitos tecnicos como `ADETUR` o `ARQ`.
- Se actualizo prueba frontend de `ScheduleModal` para proteger el texto visible.

Archivos impactados por esta correccion:

- `apps/api/src/routes/schedules.ts`
- `apps/api/src/test/api-h02-h03.integration.test.ts`
- `apps/web/src/views/SchedulesView.vue`
- `apps/web/src/components/modals/ScheduleModal.vue`
- `apps/web/src/components/modals/ScheduleModal.test.ts`
- `docs/specs/SPEC_H02_H03_Usuario_Coordinacion_Permisos.md`
- `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md`

Esta correccion debe incluirse en la fase de deploy controlado para evitar que la UI local vuelva a exponer catalogos tecnicos como si fueran nombres de coordinadores.

Validaciones posteriores a la correccion:

| Validacion | Resultado |
|---|---|
| `npm --workspace apps/web run test -- ScheduleModal` | Paso |
| `npm --workspace apps/api run test:integration -- api-h02-h03` | Paso |
| `npm run test` | Paso |
| `npm run test:api:integration` | Paso |
| `npm --workspace apps/api run typecheck` | Paso |
| `npm --workspace apps/web run typecheck` | Paso |
| `npm run typecheck` | Paso |
| `npm run build` | Paso |

## 12. Recomendacion

Recomendacion: repetir la prueba visual manual con Admin real antes de deploy Firebase/Cloud Run.

Desde el punto de vista automatizado, H09/H10 esta listo para una revision local manual final. Para autorizar deploy controlado, falta cerrar la evidencia interactiva UI con:

1. un ciclo local candidato en estado `ACTIVO`;
2. todas sus quincenas con corrida `PAGADA`;
3. un ciclo siguiente `PLANEACION` con horarios;
4. ejecucion del cierre desde `CalendarView`;
5. validacion SQL posterior de `academic_cycles`, `quarter_closures` y `audit_log`.
