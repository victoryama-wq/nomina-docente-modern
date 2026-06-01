# H02/H03 Fase 6 - Pruebas Integrales por Rol

## 1. Ambiente de prueba usado

Rama:

- `feature/h02-h03-user-coordinations-permissions`

Base local/revision:

- host: `localhost`
- port: `55432`
- database: `nomina_docente_h02h03`
- user: `app_nomina`

Archivos base usados:

- `docs/specs/SPEC_H02_H03_Usuario_Coordinacion_Permisos.md`
- `docs/diseno/DISENO_TECNICO_H02_H03_Usuario_Coordinacion_Permisos.md`
- `docs/auditoria/Inventario_Tecnico_Pre_Disenio_H02_H03.md`
- `docs/auditoria/H02_H03_Fase1_Validacion_DB_Permisos.md`
- `docs/auditoria/H02_H03_Fase2_Auth_Context.md`
- `docs/auditoria/H02_H03_Fase3_Modulos_Operativos.md`
- `docs/auditoria/H02_H03_Fase4_Fiscal_Finanzas_Nomina_Preview.md`
- `docs/auditoria/H02_H03_Fase5_Frontend_Permisos.md`
- `docs/auditoria/Decisiones_H02_H03_Usuario_Coordinacion_Permisos.md`
- `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md`

Restricciones respetadas:

- No se ejecuto nada contra produccion.
- No se hizo deploy.
- No se modifico H01.
- No se cambio formula de nomina.
- No se cambio precision monetaria.
- No se retiro fallback legacy.
- No se activo modo estricto.

## 2. Datos/seed usados

Seed local/revision usado como referencia:

- `database/validation/h02_h03_local_review_seed.sql`

Validacion SQL ejecutada:

- `database/validation/h02_h03_phase1_validation.sql`

Resultado resumido de datos locales:

| Validacion | Resultado |
|---|---:|
| Usuarios en `app_users` | 17 |
| Roles tecnicos | 7 |
| Coordinaciones en catalogo | 24 |
| Filas en `user_coordinations` | 24 |
| Coordinadores sin coordinacion formal | 0 |
| Extras sin `captured_by` | 0 |
| Horarios sin `created_by` | 0 |
| Coordinacion reservada `"Todas / Global"` | 0 |
| Coordinacion reservada `"No requiere coordinacion operativa"` | 0 |
| Rol tecnico `subdireccion` | 0 |

Observacion de datos:

- La validacion SQL fue corregida para usar `Coordinación General` con acento, que es la grafia aprobada para el catalogo local y la asignacion de `mario.medina@tecplayacar.edu.mx`.

## 3. Validaciones tecnicas ejecutadas

| Prueba | Resultado | Evidencia |
|---|---|---|
| `npm --workspace apps/api run typecheck` | Paso | TypeScript API sin errores |
| `npm --workspace apps/web run typecheck` | Paso | Vue/TypeScript web sin errores |
| `npm run typecheck` | Paso | Typecheck global sin errores |
| `npm run build` | Paso | Build API y Web exitoso |
| SQL Fase 1 contra BD local | Paso | Estructura, permisos y seeds presentes |
| API local `/health` contra BD local | Paso | HTTP 200, `service=nomina-docente-api`, `tables=22` |
| API local `/auth/session` sin token | Paso | HTTP 401 esperado |
| Busqueda de suite automatizada | Observacion | No se detectaron tests `test/spec/vitest/jest/cypress/playwright` en el repo |

## 3.1 Conciliacion de nomina mayo 2026

Durante la validacion local con los CSV de Horarios y Extras se calculo la quincena `2026-05-15` a `2026-05-28`.

Resultado:

- Total calculado por sistema nuevo: `$517,510.00`.
- Total reportado por programa anterior: `$515,920.00`.
- Diferencia: `$1,590.00`.

La diferencia quedo conciliada contra dos registros del CSV de Extras que el programa anterior no contemplo:

| Fila CSV | Coordinacion | Docente | Importe |
|---:|---|---|---:|
| 50 | Oriana Nah Rosado | LUCIANO COCOM UHH | `$1,500.00` |
| 55 | Merit Berenice Bazan Garcia | PEDRO ANTONIO RUIZ MARTINEZ | `$90.00` |

La evidencia detallada queda documentada en:

- `docs/auditoria/H02_H03_Conciliacion_Nomina_Mayo_2026.md`

## 4. Matriz de pruebas por rol

Leyenda:

- `Paso`: validado con build, SQL, lectura estatica o health local.
- `Pendiente`: requiere sesion/token Firebase real por rol o datos operativos adicionales.
- `No aplica`: no corresponde al rol o al ambiente.
- `Bloqueado`: no puede aprobarse Fase 6 sin ejecutar esta prueba.

| Rol / Area | Prueba | Resultado | Evidencia resumida |
|---|---|---|---|
| Admin | Usuario existe, rol `admin`, super admin protegido | Paso | `victor.yama@tecplayacar.edu.mx`, `is_protected_super_admin=true` |
| Admin | Tiene permisos nuevos | Paso | `finance.export`, `finance.workflow`, `fiscal.document.*`, `fiscal.view`, `payroll.preview` |
| Admin | No requiere `user_coordinations` para alcance global | Paso | 0 filas en `user_coordinations`, esperado |
| Admin | Asignar multiples coordinaciones en UI/API | Pendiente | Requiere sesion Admin y prueba en `AccessView`/`/users` |
| Admin | Gestion fiscal/documental/workflow/guardar nomina | Pendiente | Requiere sesion Admin y datos operativos |
| Coordinador una coordinacion | Coordinadores tienen al menos una UC | Paso | 12 coordinadores con filas formales |
| Coordinador una coordinacion | Crear/editar/eliminar horario dentro de UC | Pendiente | Requiere token de coordinador y datos de calendario/ciclo |
| Coordinador una coordinacion | Bloquear horario fuera de UC | Pendiente | Requiere request autenticado forzado |
| Coordinador una coordinacion | Crear incidencia sobre horario de UC | Pendiente | Requiere horario local y token |
| Coordinador una coordinacion | Bloquear incidencia fuera de UC | Pendiente | Requiere request autenticado forzado |
| Coordinador una coordinacion | Crear extra en UC | Pendiente | Requiere ciclo/quincena/docente/tabulador |
| Coordinador una coordinacion | Editar/eliminar extra propio y bloquear ajeno | Pendiente | Requiere datos de extra con `captured_by` propio/ajeno |
| Coordinador una coordinacion | No fiscal, no constancias, no finanzas global, no workflow | Pendiente | Requiere sesion/token de coordinador |
| Coordinador multiple | Usuario con varias UC existe | Paso | Eslivet, Leonardo, Merit, Oriana y Zulma tienen multiples UC |
| Coordinador multiple | Backend debe usar lista y no solo primera UC | Pendiente | Requiere requests autenticados a horarios/extras/payroll preview |
| Coordinador multiple | UI permite seleccionar UC valida y bloquea ajena | Pendiente | Requiere sesion web |
| Coordinador sin coordinacion | Caso de prueba preparado | Pendiente | Seed actual no incluye coordinador sin UC; crear caso local controlado antes de probar |
| RH | Usuario existe y tiene permisos fiscales/documentales | Paso | `zuly.carrillo@tecplayacar.edu.mx` con `fiscal.view/manage/document.*` |
| RH | Editar RFC/correo/banco/paymentType | Pendiente | Requiere sesion RH y docente local |
| RH | Subir/descargar constancia | Pendiente | Requiere sesion RH y storage/emulacion/documento |
| RH | No workflow financiero | Pendiente | Requiere request autenticado forzado |
| Finanzas | Usuario existe y tiene `finance.workflow`/`finance.export`/fiscal | Paso | `david.velazquez@tecplayacar.edu.mx` con permisos nuevos |
| Finanzas | Aprobar, marcar pagada, cancelar | Pendiente | Requiere corrida local y token Finanzas |
| Finanzas | No guardar nomina sin `payroll.finalize` | Pendiente | Requiere request autenticado a `POST /payroll/runs` |
| Direccion/Subdireccion | `direccion` existe; no existe rol tecnico `subdireccion` | Paso | SQL devuelve 0 filas para `subdireccion` |
| Direccion/Subdireccion | Subdireccion usa rol `direccion` | Paso | `elsa.garcia@tecplayacar.edu.mx` con rol `direccion` |
| Direccion/Subdireccion | Detalle docente sin fiscal sensible | Pendiente | Requiere sesion Direccion y datos financieros |
| Direccion/Subdireccion | No workflow, no fiscal manage | Pendiente | Requiere requests autenticados forzados |
| Contador | Tiene `finance.export` | Paso | Seed local asigna `finance.export` |
| Contador | No fiscal manage ni workflow | Paso a nivel permisos | No aparece `fiscal.manage` ni `finance.workflow` en rol |
| Contador | Exportar y bloquear workflow/fiscal en backend | Pendiente | Requiere token contador |
| Contabilidad | Tiene tratamiento equivalente a Contador | Paso a nivel permisos | Ambos tienen `finance.export`, `finance.view`, `payroll.view`, `reports.view`, `statistics.view` |
| Contabilidad | Bloquear workflow/fiscal/documentos | Pendiente | Requiere token contabilidad; no hay usuario contabilidad en seed local |

## 5. Fiscal/documentos

| Caso | Resultado | Evidencia |
|---|---|---|
| `fiscal.view` existe | Paso | SQL devuelve permiso |
| `fiscal.manage` existe y se asigna a RH/Finanzas/Admin | Paso | SQL de rol-permiso |
| `fiscal.document.view` existe | Paso | SQL devuelve permiso |
| `fiscal.document.manage` existe | Paso | SQL devuelve permiso |
| `POST /teachers` bloquea campos sensibles sin `fiscal.manage` | Pendiente | Requiere token de rol sin permiso; codigo contiene bloqueo, pero no se ejecuto request autenticado |
| `PATCH /teachers/:id/fiscal` requiere `fiscal.manage` | Paso por lectura estatica | Ruta protegida con `requirePermission('fiscal.manage')` |
| Subir constancia requiere `fiscal.document.manage` | Paso por lectura estatica | Ruta protegida con `requirePermission('fiscal.document.manage')` |
| Descargar constancia requiere `fiscal.document.view` | Paso por lectura estatica | Ruta protegida con `requirePermission('fiscal.document.view')` |

## 6. Finanzas/workflow

| Caso | Resultado | Evidencia |
|---|---|---|
| `finance.view` consulta | Paso por lectura estatica | Rutas de contexto usan `finance.view`/`finance.global_view` |
| `finance.export` controla CSV/PDF | Paso por lectura estatica | Exportes usan `requireAnyPermission(['finance.export'])` |
| `finance.workflow` controla cambio de estado | Paso por lectura estatica | Cambio de estado usa `requireAnyPermission(['finance.workflow'])` |
| Usuario sin `finance.workflow` recibe 403 al cambiar estado | Pendiente | Requiere token de Contador/Direccion/Coordinador |
| Usuario sin `finance.export` no exporta | Pendiente | Requiere request autenticado |

## 7. Nomina preview

| Caso | Resultado | Evidencia |
|---|---|---|
| `payroll.preview` existe | Paso | SQL devuelve permiso |
| `payroll.preview` permite preview/cContexto | Paso por lectura estatica | `/payroll/context` y `/payroll/preview` aceptan `payroll.preview` |
| `payroll.preview` no guarda nomina | Paso por lectura estatica | `POST /payroll/runs` requiere `payroll.finalize` |
| Coordinador no tiene `payroll.finalize` | Paso | SQL de rol-permiso |
| `recentRuns` se filtra para no global | Paso por lectura estatica | Fase 5 documento y codigo aplican filtro por alcance no global |
| Coordinador fuerza guardado y recibe 403 | Pendiente | Requiere token de coordinador |
| Preview por UC con datos reales | Pendiente | Requiere calendario/docentes/horarios/incidencias/extras locales |

## 8. Propiedad del registro

| Caso | Resultado | Evidencia |
|---|---|---|
| Extras tienen `captured_by` | Paso | SQL de autoria detecta columna |
| Extras sin `captured_by` | Paso | 0 filas |
| Horarios tienen `created_by` | Paso | SQL de autoria detecta columna |
| Horarios sin `created_by` | Paso | 0 filas |
| `schedule_incidences` no usa `updated_by` como autoria original | Paso por documentacion/codigo | Fase 3 documenta que se valida por coordinacion del horario |
| Extra propio/ajeno en backend | Pendiente | Requiere datos de extras y requests autenticados |
| Direccion edita propios vs ajenos | Pendiente | Requiere datos con `created_by` y token Direccion |

## 9. Fallback legacy

| Caso | Resultado | Evidencia |
|---|---|---|
| Feature flag existe | Paso por lectura estatica | `LEGACY_COORDINATION_FALLBACK_ENABLED` en `actor-scope.ts` |
| Usuario con UC no usa fallback | Pendiente | Requiere request autenticado y revision de logs |
| Usuario sin UC con fallback activo genera log | Pendiente | Requiere token de usuario sin UC |
| Usuario sin UC con fallback inactivo queda bloqueado | Pendiente | Requiere ejecutar API con flag desactivado y token |
| Fallback no crea coordinaciones | Paso por lectura estatica | Fase 2/3 eliminan creacion automatica en runtime |
| No se activo modo estricto | Paso | No se modifico flag/configuracion; no se retiro fallback |

## 10. Intentos manuales/forzados contra backend

No se pudieron ejecutar los intentos forzados por rol porque el entorno local no cuenta con tokens Firebase validos para cada rol ni con bypass de autenticacion local. La API responde `401` sin token, lo cual confirma que la barrera de autenticacion esta activa, pero no sustituye la prueba de autorizacion `403` por rol.

Casos pendientes:

| Caso forzado | Estado |
|---|---|
| Coordinador intenta `POST /teachers` con `paymentType` | Pendiente |
| Coordinador intenta `PATCH /teachers/:id/fiscal` | Pendiente |
| Coordinador intenta subir constancia | Pendiente |
| Coordinador intenta guardar nomina | Pendiente |
| Contador intenta cambiar estado financiero | Pendiente |
| Direccion intenta cambiar estado financiero | Pendiente |
| Usuario sin `finance.export` intenta exportar | Pendiente |
| Usuario sin `finance.workflow` intenta cancelar | Pendiente |

## 11. Bloqueantes encontrados

Bloqueantes para aprobar Fase 6 completa y pasar a deploy controlado:

1. No se ejecutaron pruebas autenticadas por rol porque no hay tokens/sesiones Firebase locales por cada rol.
2. No hay suite automatizada existente para cubrir matriz rol-ruta-accion.
3. La BD local contiene usuarios/coordinaciones, pero no datos operativos suficientes para CRUD completo de horarios, incidencias, extras, docentes, corridas, documentos y workflow.
4. La validacion de coordinaciones ya usa `Coordinación General` con acento. Mantener esta grafia como fuente esperada durante migracion real.

Estos bloqueantes no indican falla confirmada de codigo; indican que la validacion integral requerida aun no puede considerarse completa.

## 12. Observaciones no bloqueantes

- Typecheck y build pasaron.
- La API local levanto correctamente contra la BD local y `/health` respondio 200.
- La estructura de `user_coordinations`, permisos nuevos y seeds por rol estan presentes.
- No se detecto rol tecnico `subdireccion`.
- No se crearon coordinaciones reservadas `"Todas / Global"` ni `"No requiere coordinacion operativa"`.
- `contabilidad` y `contador` estan alineados en permisos base de exportacion/lectura.
- Las pruebas UI reales quedan pendientes para Fase 6 operativa con sesiones validas.

## 13. Recomendacion

Recomendacion actual:

- No pasar todavia a deploy controlado de produccion.
- Preparar ambiente local/revision con autenticacion real o tokens de prueba por rol.
- Cargar datos operativos minimos no sensibles para:
  - docentes;
  - horarios;
  - incidencias;
  - extras propios y ajenos;
  - corrida de nomina de prueba;
  - documentos fiscales de prueba o storage/emulacion;
  - usuario coordinador sin coordinacion.
- Repetir esta matriz y exigir que los casos pendientes pasen con evidencia de `403`/permitido segun corresponda.

Estado de Fase 6:

- Validacion tecnica automatizable: Paso con observaciones.
- Validacion integral por rol: Pendiente/Bloqueada por falta de sesiones autenticadas y datos operativos.
- Recomendacion final: corregir/preparar ambiente de pruebas y repetir Fase 6 antes de deploy controlado.

## 14. Plan de cierre con sesiones reales Firebase Auth

### Recomendacion sobre `noreply@tecplayacar.edu.mx`

No se recomienda usar `noreply@tecplayacar.edu.mx` como usuario Coordinador de pruebas.

Motivos:

- Normalmente `noreply` es una cuenta tecnica/no interactiva.
- Puede no tener login Google/Firebase habilitado.
- Puede estar asociada a automatizaciones, notificaciones o alias.
- Si inicia sesion y vincula `firebase_uid`, puede contaminar una identidad tecnica con permisos operativos.
- No representa comportamiento real de un usuario Coordinador.

Recomendacion:

- Usar una cuenta real de prueba institucional, por ejemplo `qa.coordinador@tecplayacar.edu.mx`, si existe y puede iniciar sesion.
- Si no hay cuenta QA, usar temporalmente una cuenta real de Coordinador ya aprobada por operacion y registrada en `app_users` local.
- Mantener la validacion contra BD local para no tocar datos productivos.

### Usuarios recomendados para pruebas

| Rol | Email recomendado | Motivo | Requiere login real |
|---|---|---|---|
| admin | `victor.yama@tecplayacar.edu.mx` o cuenta admin QA institucional | Valida acceso global, Control de Accesos, fiscal, finanzas y guardado | Si |
| coordinador una coordinacion | `lidia.medina@tecplayacar.edu.mx` o cuenta QA equivalente | Tiene una sola coordinacion (`Idiomas`) en seed local; ideal para validacion simple | Si |
| coordinador multiples coordinaciones | `eslivet.aguilar@tecplayacar.edu.mx` o cuenta QA equivalente | Tiene varias coordinaciones (`ADETUR`, `ARQ`, `SISCOM`, `DIGRAF`) | Si |
| rh | `zuly.carrillo@tecplayacar.edu.mx` o cuenta RH QA | Valida fiscal/documentos sin workflow financiero | Si |
| finanzas | `david.velazquez@tecplayacar.edu.mx` o cuenta Finanzas QA | Valida fiscal, export y `finance.workflow` | Si |
| direccion | `noadia.gonzalez@tecplayacar.edu.mx` o `elsa.garcia@tecplayacar.edu.mx` | Valida rol tecnico `direccion` y detalle sin fiscal sensible | Si |
| contador/contabilidad | cuenta real institucional de contador/contabilidad por definir | El seed local no tiene usuario de este rol; se requiere cuenta real para cerrar UI/API | Si |

### Dataset sintetico local preparado

Archivos preparados:

- `database/validation/h02_h03_synthetic_operational_seed.sql`
- `database/validation/h02_h03_synthetic_dataset_validation.sql`

El seed sintetico local crea:

- ciclo activo `H02H03 QA Local 2026`;
- quincena `QA Mayo 1-15 2026`;
- materia sintetica;
- tabulador sintetico `100.00`;
- docentes ficticios sin RFC, banco, correo fiscal ni constancias;
- horarios en `Idiomas`, `ADETUR`, `ARQ` y `CINTER`;
- incidencias ficticias;
- extras propios y ajenos;
- datos suficientes para preview de nomina local.

No crea:

- RFC reales;
- bancos/cuentas;
- constancias;
- documentos fiscales;
- datos monetarios reales sensibles;
- coordinaciones reservadas `"Todas / Global"` o `"No requiere coordinacion operativa"`.

### Comandos de seed y validacion

Aplicar seed local:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' `
  -h localhost `
  -p 55432 `
  -U app_nomina `
  -d nomina_docente_h02h03 `
  -v ON_ERROR_STOP=1 `
  -f database/validation/h02_h03_synthetic_operational_seed.sql
```

Validar dataset sintetico:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' `
  -h localhost `
  -p 55432 `
  -U app_nomina `
  -d nomina_docente_h02h03 `
  -v ON_ERROR_STOP=1 `
  -f database/validation/h02_h03_synthetic_dataset_validation.sql
```

Revalidar estructura/permisos:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' `
  -h localhost `
  -p 55432 `
  -U app_nomina `
  -d nomina_docente_h02h03 `
  -v ON_ERROR_STOP=1 `
  -f database/validation/h02_h03_phase1_validation.sql
```

### Comandos de arranque local

API local:

```powershell
$env:NODE_ENV='development'
$env:PORT='8080'
$env:DB_HOST='localhost'
$env:DB_PORT='55432'
$env:DB_NAME='nomina_docente_h02h03'
$env:DB_USER='app_nomina'
$env:FIREBASE_PROJECT_ID='nomina-docente-prod'
$env:ALLOWED_EMAIL_DOMAIN='tecplayacar.edu.mx'
$env:CORS_ORIGINS='http://localhost:5173'
$env:CONSTANCIAS_BUCKET='nomina-docente-prod-constancias'

npm --workspace apps/api run dev
```

Frontend local:

```powershell
$env:VITE_API_BASE_URL='http://localhost:8080'
$env:VITE_FIREBASE_PROJECT_ID='nomina-docente-prod'
$env:VITE_FIREBASE_AUTH_DOMAIN='nomina-docente-prod.firebaseapp.com'

npm --workspace apps/web run dev
```

Abrir:

```text
http://localhost:5173
```

### Checklist UI obligatorio

Coordinador una coordinacion:

- [ ] Login correcto.
- [ ] Menu sin Fiscal ni Finanzas global.
- [ ] Horarios muestra/permite registros capturados por el usuario.
- [ ] Horarios no muestra asignaturas capturadas por otros coordinadores para el mismo docente.
- [ ] Incidencias sobre horarios capturados por el usuario.
- [ ] Extras muestra registros capturados por el usuario; solo propios editables.
- [ ] Nomina preview visible en solo lectura.
- [ ] Guardar nomina no visible/no usable.

Coordinador con docentes compartidos:

- [ ] Login correcto.
- [ ] Puede seleccionar cualquier docente activo.
- [ ] No puede seleccionar manualmente nombres/combinaciones de coordinadores como alcance operativo.
- [ ] Preview incluye registros capturados por el usuario.
- [ ] Guardar/aprobar/pagar/cancelar bloqueado.

RH:

- [ ] Expediente Fiscal visible.
- [ ] Edicion fiscal permitida.
- [ ] Subida/descarga documental permitida.
- [ ] Workflow financiero bloqueado.

Finanzas:

- [ ] Finanzas visible.
- [ ] Export visible.
- [ ] Fiscal/documentos permitido.
- [ ] `finance.workflow` permite aprobar, pagar y cancelar en corrida local.
- [ ] Guardar nomina bloqueado si no tiene `payroll.finalize`.

Direccion:

- [ ] Reportes agregados visibles.
- [ ] Detalle docente sin RFC/banco/constancias.
- [ ] Workflow financiero bloqueado.
- [ ] Fiscal bloqueado.

Contador/Contabilidad:

- [ ] Export permitido.
- [ ] Fiscal bloqueado.
- [ ] Workflow bloqueado.

### Pruebas API forzadas con token real

Obtener token Firebase desde DevTools del frontend o desde una utilidad temporal externa sin modificar codigo.

```powershell
$token='PEGAR_ID_TOKEN'
$headers=@{
  Authorization="Bearer $token"
  'Content-Type'='application/json'
}
```

Coordinador intenta crear docente con `paymentType`:

```powershell
Invoke-WebRequest -Method Post `
  -Uri 'http://localhost:8080/teachers' `
  -Headers $headers `
  -Body '{"fullName":"QA Docente Bloqueo Fiscal","category":"V","coordinationId":"COORD_ID","paymentType":"1"}'
```

Esperado: `403`.

Coordinador intenta editar fiscal:

```powershell
Invoke-WebRequest -Method Patch `
  -Uri 'http://localhost:8080/teachers/TEACHER_ID/fiscal' `
  -Headers $headers `
  -Body '{"rfc":"TEST010101AAA","email":"qa@example.invalid","paymentType":"1","bankDetail":"NO USAR"}'
```

Esperado: `403`.

Coordinador intenta subir constancia:

```powershell
Invoke-WebRequest -Method Post `
  -Uri 'http://localhost:8080/teachers/TEACHER_ID/documents/constancia' `
  -Headers @{ Authorization="Bearer $token" } `
  -Form @{ file = Get-Item '.\docs\auditoria\H02_H03_Fase6_Pruebas_Integrales.md' }
```

Esperado: `403`.

Coordinador intenta guardar nomina:

```powershell
Invoke-WebRequest -Method Post `
  -Uri 'http://localhost:8080/payroll/runs' `
  -Headers $headers `
  -Body '{}'
```

Esperado: `403`.

Coordinador intenta cambiar estado financiero:

```powershell
Invoke-WebRequest -Method Patch `
  -Uri 'http://localhost:8080/reports/finance/runs/RUN_ID/status' `
  -Headers $headers `
  -Body '{"status":"APROBADA"}'
```

Esperado: `403`.

Coordinador intenta exportar finanzas:

```powershell
Invoke-WebRequest -Method Get `
  -Uri 'http://localhost:8080/reports/finance/export/payments?runId=RUN_ID' `
  -Headers @{ Authorization="Bearer $token" }
```

Esperado: `403`.

Finanzas cambia estado financiero:

```powershell
Invoke-WebRequest -Method Patch `
  -Uri 'http://localhost:8080/reports/finance/runs/RUN_ID/status' `
  -Headers $headers `
  -Body '{"status":"EN_REVISION"}'
```

Esperado con token Finanzas: permitido si `RUN_ID` existe y la transicion es valida.

Contador cambia estado financiero:

```powershell
Invoke-WebRequest -Method Patch `
  -Uri 'http://localhost:8080/reports/finance/runs/RUN_ID/status' `
  -Headers $headers `
  -Body '{"status":"APROBADA"}'
```

Esperado con token Contador: `403`.

RH edita fiscal:

```powershell
Invoke-WebRequest -Method Patch `
  -Uri 'http://localhost:8080/teachers/TEACHER_ID/fiscal' `
  -Headers $headers `
  -Body '{"rfc":"TEST010101AAA","email":"qa@example.invalid","paymentType":"1","bankDetail":"CUENTA QA"}'
```

Esperado con token RH: permitido sobre dato local sintetico.

### Criterio de cierre

Fase 6 se puede cerrar solo si:

- Las validaciones SQL pasan.
- Login real funciona para cada rol disponible.
- Las pruebas UI pasan.
- Los requests forzados devuelven `403` o permitido segun matriz.
- No hay cambios de datos fuera de la BD local.
- No hay deploy.
- No se toca H01.

## 15. Ejecucion local con API/Web y Firebase Auth real

Fecha de ejecucion local: 2026-05-18.

### Correccion previa

Se corrigio la grafia de la coordinacion en validaciones locales:

- Antes: `Coordinacion General`
- Despues: `Coordinación General`

Archivos locales actualizados:

- `database/validation/h02_h03_phase1_validation.sql`
- `docs/auditoria/H02_H03_Fase6_Pruebas_Integrales.md`

Resultado:

- `database/validation/h02_h03_phase1_validation.sql` ya no reporta `Coordinacion General` sin acento como coordinacion faltante.

### Validacion SQL ejecutada

Comandos ejecutados contra BD local:

- `database/validation/h02_h03_synthetic_dataset_validation.sql`
- `database/validation/h02_h03_phase1_validation.sql`

Ambiente:

- host: `localhost`
- port: `55432`
- database: `nomina_docente_h02h03`
- user: `app_nomina`

Resultados relevantes:

| Validacion | Resultado |
|---|---|
| Ciclo activo sintetico | OK |
| Quincena sintetica | OK |
| Asignatura sintetica | OK |
| Tabulador sintetico `100.00` | OK |
| Docentes ficticios | 4, OK |
| Docentes con RFC/banco/email/payment type | 0, OK |
| Horarios sinteticos | 4, OK |
| Incidencias sinteticas | 4, OK |
| Extras sinteticos | 5, OK |
| Extra propio/ajeno | OK |
| Coordinador una coordinacion | `lidia.medina@tecplayacar.edu.mx`, `Idiomas`, OK |
| Coordinador multiples coordinaciones | `eslivet.aguilar@tecplayacar.edu.mx`, `ADETUR`, `ARQ`, `DIGRAF`, `SISCOM`, OK |
| Datos suficientes para preview | OK |
| Coordinaciones reservadas | 0, OK |
| Permisos nuevos | 6, OK |
| Coordinadores sin coordinacion | 0, OK |
| Horarios sin `created_by` | 0, OK |
| Extras sin `captured_by` | 0, OK |
| Rol tecnico `subdireccion` | 0, OK |

### API local

API local levantada con:

- URL: `http://localhost:8080`
- DB: `nomina_docente_h02h03`
- Firebase project: `nomina-docente-prod`
- CORS: `http://localhost:5173`

Validaciones ejecutadas:

| Endpoint | Resultado |
|---|---|
| `GET /health` | HTTP 200 |
| `GET /auth/session` sin token | HTTP 401 esperado |

No se observaron errores criticos iniciales en logs de arranque.

### Frontend local

Frontend local levantado con:

- URL: `http://localhost:5173`
- API base: `http://localhost:8080`
- Firebase Auth: proyecto real `nomina-docente-prod`

Validaciones ejecutadas:

| Validacion | Resultado |
|---|---|
| Servidor Vite en puerto 5173 | OK |
| `GET http://localhost:5173` | HTTP 200 |

### Pruebas UI con sesion real

Estado:

- Pendientes de ejecutar por usuario humano con credenciales reales.
- El agente no cuenta con credenciales ni token Firebase real para iniciar sesion como cada rol.

Usuarios iniciales recomendados:

| Caso | Email |
|---|---|
| Coordinador una coordinacion | `lidia.medina@tecplayacar.edu.mx` |
| Coordinador multiples coordinaciones | `eslivet.aguilar@tecplayacar.edu.mx` |
| Admin | `victor.yama@tecplayacar.edu.mx` |
| RH | `zuly.carrillo@tecplayacar.edu.mx` |
| Finanzas | `david.velazquez@tecplayacar.edu.mx` |
| Direccion/Subdireccion | `noadia.gonzalez@tecplayacar.edu.mx` o `elsa.garcia@tecplayacar.edu.mx` |

### Pruebas API forzadas con token real

Estado:

- Pendientes de ejecutar hasta obtener ID token real de Firebase desde una sesion local.

Casos pendientes:

| Caso | Esperado |
|---|---|
| Coordinador `PATCH /teachers/:id/fiscal` | 403 |
| Coordinador `POST /teachers` con `paymentType` | 403 |
| Coordinador subir constancia | 403 |
| Coordinador `POST /payroll/runs` | 403 |
| Coordinador cambio estado financiero | 403 |
| Coordinador export financiero global | 403 |
| Finanzas cambio estado financiero | Permitido con `RUN_ID` valido y transicion valida |
| Contador cambio estado financiero | 403 |
| RH edicion fiscal | Permitido sobre docente sintetico |

### Estado de cierre

Resultado actual:

- Dataset local: listo.
- API local: lista.
- Frontend local: listo.
- Pruebas UI/API autenticadas: pendientes por sesion real.

Recomendacion:

- Continuar con login humano real en `http://localhost:5173`.
- No pasar a deploy controlado hasta documentar resultados UI/API autenticados por rol.

## 16. Correcciones aplicadas durante pruebas locales

Fecha de registro: 2026-05-19.

Durante la validacion local con API, frontend y BD de revision se detectaron ajustes necesarios para mantener H02/H03 alineado con las reglas aprobadas. Estos cambios se aplicaron solo en rama local, sin deploy y sin tocar produccion.

| Area | Cambio realizado | Evidencia tecnica | Riesgo mitigado |
|---|---|---|---|
| Usuarios / Admin | Se ajusto CORS para permitir metodos `PATCH` y `DELETE` desde el frontend local. | `apps/api/src/server.ts` | Evita `failed to fetch` al modificar o eliminar usuarios desde Control de Accesos. |
| Incidencias | La auditoria de incidencias dejo de guardar un valor compuesto en `audit_log.entity_id`; ahora conserva el UUID del horario y manda `calendarConfigId` en metadata. | `apps/api/src/routes/incidences.ts` | Corrige `invalid input syntax for type uuid` al editar/guardar incidencias. |
| Control de Accesos | Se retiro el selector manual de coordinaciones asignadas para alta/edicion de usuarios; el alcance operativo de Coordinador se basa en rol y usuario capturador. | `apps/api/src/routes/users.ts`, `apps/web/src/components/modals/AccessModal.vue`, `apps/web/src/views/AccessView.vue` | Evita que Admin tenga que elegir nombres de personas o combinaciones legacy como si fueran permisos operativos. |
| Directorio / Docentes | El alta/edicion de docente para Coordinador muestra responsable operativo automatico y valida edicion por `teachers.created_by`. | `apps/api/src/routes/teachers.ts`, `apps/web/src/api.ts`, `apps/web/src/views/TeachersView.vue`, `apps/web/src/components/modals/TeacherModal.vue` | Evita que Coordinador cree o modifique docentes bajo responsables ajenos; conserva docente compartido por captura. |
| Directorio / UI | Para Coordinador, el modal ya no permite elegir coordinaciones/nombres de coordinadores; muestra al usuario capturador como responsable operativo. | `apps/web/src/views/TeachersView.vue`, `apps/web/src/components/modals/TeacherModal.vue` | Alinea el flujo original: el coordinador captura docentes bajo su propio usuario. |
| Horarios | Coordinador puede seleccionar cualquier docente activo; visibilidad y edicion/eliminacion se limitan a horarios capturados por su usuario (`schedules.created_by`). | `apps/api/src/routes/schedules.ts`, `apps/web/src/views/SchedulesView.vue`, `apps/web/src/components/modals/ScheduleModal.vue` | Permite docentes compartidos sin exponer asignaturas capturadas por otros coordinadores. |
| Horarios / UI predeploy | El selector Admin/Direccion de `Responsable operativo` debe mostrar nombres de usuarios responsables, no ambitos tecnicos de `coordinations`. Para Coordinador/no-admin debe ser solo lectura con el usuario conectado. | `apps/api/src/routes/schedules.ts`, `apps/web/src/views/SchedulesView.vue`, `apps/web/src/components/modals/ScheduleModal.vue` | Evita que valores como `ADETUR`, `ARQ`, `DIGRAF`, `Idiomas` o `SISCOM` se interpreten como personas responsables. |
| Incidencias | Coordinador solo ve/edita incidencias de horarios capturados por su usuario. | `apps/api/src/routes/incidences.ts` | Evita usar la coordinacion legacy como permiso cuando el docente es compartido. |
| Extras | Coordinador ve/modifica extras capturados por su usuario; Direccion/Subdireccion puede ver listado amplio, pero edita/elimina solo propios. | `apps/api/src/routes/extras.ts`, `apps/web/src/views/ExtrasView.vue`, `apps/web/src/components/modals/ExtraModal.vue` | Respeta la regla de propiedad por `captured_by` para docentes compartidos. |
| Extras / Direccion | Direccion/Subdireccion puede ver el listado de Extras, pero la edicion/eliminacion sigue limitada a registros capturados por el propio usuario. | `apps/api/src/routes/extras.ts` | Respeta la decision aprobada: vista amplia operativa, modificacion solo propia. |
| Validacion local | La validacion de asignaciones usa `Coordinación General` con acento. | `database/validation/h02_h03_phase1_validation.sql` | Evita falso positivo de coordinacion faltante por diferencia de acento. |
| Dataset sintetico | Se agregaron seed y validacion sintetica local para ciclo, quincena, docentes, horarios, incidencias, extras propios/ajenos y preview. | `database/validation/h02_h03_synthetic_operational_seed.sql`, `database/validation/h02_h03_synthetic_dataset_validation.sql` | Permite repetir Fase 6 sin importar datos fiscales, monetarios reales ni documentos. |

### Validacion posterior a correcciones

| Validacion | Resultado |
|---|---|
| `database/validation/h02_h03_synthetic_dataset_validation.sql` | Paso en BD local `nomina_docente_h02h03` |
| `database/validation/h02_h03_phase1_validation.sql` | Paso en BD local; ya no reporta `Coordinacion General` sin acento como faltante |
| `npm --workspace apps/api run typecheck` | Paso |
| `npm --workspace apps/web run typecheck` | Paso |
| `npm run build` | Paso |

### Estado de cierre actualizado

- No se ejecuto nada contra produccion.
- No se hizo deploy.
- No se modifico H01.
- No se cambio formula de nomina.
- No se cambio precision monetaria.
- No se retiro fallback legacy.
- No se activo modo estricto.
- Quedan pendientes las pruebas autenticadas por rol con token Firebase real para aprobar deploy controlado.
