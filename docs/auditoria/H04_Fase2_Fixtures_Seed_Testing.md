# H04 Fase 2 - Fixtures y Seed Minimo de Testing

Fecha: 2026-05-28

## 1. Resumen

Esta fase prepara fixtures reutilizables para escribir pruebas automatizadas de negocio que protejan H01, H02 y H03.

No se implementa todavia la matriz completa de pruebas de negocio. La entrega deja una base estable para construir pruebas por rol, permiso, coordinacion, propiedad del registro y calculo de nomina en fases posteriores.

## 2. Fixtures creados

Se agregaron fixtures de API en:

- `apps/api/src/test/fixtures/permissions.ts`
- `apps/api/src/test/fixtures/actors.ts`
- `apps/api/src/test/fixtures/scopes.ts`
- `apps/api/src/test/fixtures/index.ts`

Estos fixtures:

- no importan Firebase real;
- no se conectan a base de datos;
- no contienen datos fiscales reales;
- no contienen RFC reales;
- no contienen datos bancarios;
- no ejecutan fallback legacy;
- no activan modo estricto;
- no cambian reglas H01/H02/H03.

## 3. Actores cubiertos

Actores disponibles:

| Fixture | Rol | Objetivo |
|---|---|---|
| `adminActor()` / `adminScope()` | `admin` | Acceso global y permisos completos para pruebas |
| `coordinatorActor()` / `coordinatorScope()` | `coordinador` | Coordinador con una coordinacion: Idiomas |
| `multiCoordinatorActor()` / `multiCoordinatorScope()` | `coordinador` | Coordinador con ADETUR, ARQ, SISCOM y DIGRAF |
| `coordinatorWithoutCoordinationActor()` / `coordinatorWithoutCoordinationScope()` | `coordinador` | Bloqueo operativo por falta de coordinacion |
| `rhActor()` / `rhScope()` | `rh` | Gestion fiscal/documental sin workflow financiero |
| `financeActor()` / `financeScope()` | `finanzas` | Fiscal, exportacion y workflow financiero |
| `directionActor()` / `directionScope()` | `direccion` | Vista ejecutiva sin fiscal manage ni workflow |
| `accountantActor()` / `accountantScope()` | `contador` | Exportacion financiera sin fiscal ni workflow |
| `accountingActor()` / `accountingScope()` | `contabilidad` | Equivalente a contador |

## 4. Permisos modelados

Se agrego la constante `PERMISSIONS` con permisos usados por H01/H02/H03 y pruebas futuras:

- `dashboard.view`
- `teachers.manage`
- `schedules.manage`
- `incidences.manage`
- `extras.manage`
- `payroll.preview`
- `payroll.view`
- `payroll.calculate`
- `payroll.finalize`
- `reports.view`
- `statistics.view`
- `finance.view`
- `finance.global_view`
- `finance.export`
- `finance.workflow`
- `fiscal.view`
- `fiscal.manage`
- `fiscal.document.view`
- `fiscal.document.manage`
- `calendar.manage`
- `closures.manage`
- `access.manage`
- `audit.view`

Tambien se agregaron arreglos por rol para que las pruebas futuras no repitan listas manuales de permisos.

## 5. Coordinaciones sinteticas

Coordinaciones fixture:

| Nombre | Uso |
|---|---|
| Idiomas | Coordinador con una coordinacion |
| ADETUR | Coordinador multiple, primaria |
| ARQ | Coordinador multiple |
| SISCOM | Coordinador multiple |
| DIGRAF | Coordinador multiple |

Los IDs son UUIDs estables de prueba, no IDs productivos.

## 6. Seed minimo para DB test

Se agrego:

- `apps/api/src/test/db/seed-h04-minimal.sql`

Uso previsto:

```bash
psql -h localhost -p 5432 -U app_nomina -d nomina_docente_test -v ON_ERROR_STOP=1 -f apps/api/src/test/db/seed-h04-minimal.sql
```

El seed tiene guard de seguridad:

- solo puede ejecutarse si `current_database() = 'nomina_docente_test'`.

Datos incluidos:

- roles;
- permisos;
- `role_permissions`;
- usuarios QA;
- coordinaciones QA;
- `user_coordinations`;
- ciclo activo QA;
- quincena QA;
- docentes ficticios;
- materia ficticia;
- tabulador sintetico de `100.00`;
- horarios;
- incidencias;
- extras propios y ajenos.

Datos excluidos:

- RFC reales;
- bancos reales;
- constancias reales;
- documentos fiscales reales;
- datos productivos oficiales;
- emails de operacion real.

Emails QA incluidos:

- `qa.admin@tecplayacar.edu.mx`
- `qa.coordinador.idiomas@tecplayacar.edu.mx`
- `qa.coordinador.multi@tecplayacar.edu.mx`
- `qa.coordinador.sin.coordinacion@tecplayacar.edu.mx`
- `qa.rh@tecplayacar.edu.mx`
- `qa.finanzas@tecplayacar.edu.mx`
- `qa.direccion@tecplayacar.edu.mx`
- `qa.contador@tecplayacar.edu.mx`
- `qa.contabilidad@tecplayacar.edu.mx`

## 7. Pruebas smoke agregadas

Se agrego:

- `apps/api/src/test/fixtures/fixtures.test.ts`

Casos cubiertos:

- Admin tiene permisos esperados.
- Coordinador con una coordinacion tiene una sola coordinacion.
- Coordinador multiple tiene varias coordinaciones.
- Coordinador sin coordinacion tiene lista vacia.
- Finanzas tiene `finance.workflow`.
- Contador y Contabilidad no tienen `finance.workflow`.
- RH tiene `fiscal.manage`.
- Coordinador no tiene `fiscal.manage`.
- Coordinador no tiene `payroll.finalize`.
- Direccion no tiene `finance.workflow`.

Estas pruebas no usan Firebase real ni base de datos.

## 8. Como se usara en H04 Fase 3

Uso recomendado:

1. Crear base `nomina_docente_test`.
2. Aplicar migraciones `database/*.sql` en orden.
3. Ejecutar `apps/api/src/test/db/seed-h04-minimal.sql`.
4. Crear pruebas API con `app.inject()`.
5. Construir requests con actores fixture sin Firebase real.
6. Validar permisos H02/H03 y calculos H01 contra datos controlados.

Advertencia para Firebase Auth real:

- El seed H04 usa `firebase_uid` sinteticos para fixtures y pruebas automatizadas.
- Esos UIDs no deben mezclarse con login interactivo usando Firebase Auth real.
- Si se desea usar una cuenta real contra `nomina_docente_test`, el registro debe tener `firebase_uid = NULL` antes del primer login real.
- Incidente documentado: `noreply@tecplayacar.edu.mx` fallo en local porque tenia `firebase_uid = 'qa-fixture-rh'`; limpiar el UID permitio vincular el UID real de Firebase.

## 9. Que NO se probo todavia

No se implementaron todavia:

- pruebas completas de calculo de nomina;
- pruebas de maximo de horas por categoria;
- pruebas de rutas API con PostgreSQL real;
- pruebas completas de fiscal/documentos;
- pruebas de workflow financiero;
- pruebas de fallback legacy;
- pruebas de frontend por visibilidad de permisos;
- pruebas E2E con navegador.

## 10. Riesgos

Riesgos pendientes:

- El seed aun no se ejecuta automaticamente desde Vitest.
- Las pruebas de rutas necesitaran una estrategia de setup/teardown para PostgreSQL real.
- Las pruebas con `app.inject()` deberan mockear sesion/actor sin Firebase real.
- H01/H02/H03 siguen necesitando pruebas de negocio profundas, no solo smoke tests.

## 11. Siguiente fase recomendada

H04 Fase 3:

1. Crear setup de PostgreSQL de test.
2. Aplicar migraciones y seed minimo de forma controlada.
3. Probar rutas API criticas con `app.inject()`.
4. Empezar por reglas H02/H03:
   - coordinador una coordinacion;
   - coordinador multiples coordinaciones;
   - coordinador sin coordinacion;
   - fiscal/documentos;
   - finance.workflow;
   - payroll.preview.
5. Agregar despues pruebas H01 de calculo de nomina con dataset controlado.

## 12. Confirmacion de alcance

Se confirma:

- No se toco produccion.
- No se hizo deploy.
- No se uso Firebase real.
- No se cambio H01 funcional.
- No se cambio H02 funcional.
- No se cambio H03 funcional.
- No se cambiaron reglas de negocio.
- No se crearon migraciones productivas.
- No se modifico Cloud SQL.
