# H04 Fase 3 - API Integration Testing con PostgreSQL

## 1. Resumen

La Fase 3 de H04 agrega infraestructura para ejecutar pruebas de integracion del backend Fastify contra una base PostgreSQL real de test, usando `app.inject()` y actores mockeados sin Firebase Auth real.

El objetivo no es cubrir toda la matriz de negocio, sino dejar probado que:

- la API puede levantarse en modo test sin escuchar un puerto;
- las migraciones se pueden aplicar sobre `nomina_docente_test`;
- el seed minimo H04 deja datos suficientes para pruebas H02/H03;
- la autenticacion se puede simular sin Firebase real;
- las reglas criticas iniciales de H02/H03 se pueden validar automaticamente.

No se cambio logica funcional de H01, H02 ni H03.

## 2. Archivos agregados o modificados

### Infraestructura de base de datos

- `apps/api/src/test/db/test-db-utils.ts`
- `apps/api/src/test/db/setup-test-db.ts`
- `apps/api/src/test/db/reset-test-db.ts`
- `apps/api/src/test/db/seed-h04-minimal.sql`

### Utilidades de pruebas API

- `apps/api/src/test/app-test-utils.ts`
- `apps/api/src/test/auth-test-utils.ts`
- `apps/api/vitest.integration.config.ts`
- `apps/api/src/test/api-h02-h03.integration.test.ts`

### Configuracion

- `apps/api/package.json`
- `package.json`
- `apps/api/vitest.config.ts`
- `apps/api/src/auth.ts`

## 3. Base PostgreSQL de test

La base esperada es:

```text
nomina_docente_test
```

Variables requeridas:

```powershell
$env:TEST_DB_HOST='localhost'
$env:TEST_DB_PORT='55432'
$env:TEST_DB_NAME='nomina_docente_test'
$env:TEST_DB_USER='app_nomina'
$env:TEST_DB_PASSWORD='local_nomina_dev'
```

La utilidad de setup valida que el nombre de la base conectada sea exactamente `nomina_docente_test`. Si el nombre no coincide, aborta antes de ejecutar limpieza, migraciones o seed.

El reset de esquema usa `DROP SCHEMA public CASCADE`, por lo que solo debe ejecutarse contra `nomina_docente_test`.

## 4. Preparacion de base

Comando manual:

```powershell
npm --workspace apps/api run test:db:prepare
```

Este comando:

1. valida `TEST_DB_NAME=nomina_docente_test`;
2. limpia el esquema `public`;
3. aplica las migraciones `database/*.sql` en orden;
4. aplica `apps/api/src/test/db/seed-h04-minimal.sql`.

Tambien existe:

```powershell
npm --workspace apps/api run test:db:reset
```

Este comando solo limpia el esquema `public` de `nomina_docente_test`.

## 5. Mock de autenticacion

Se agrego un mecanismo de autenticacion exclusivo para pruebas:

- usa tokens con prefijo `test-actor:`;
- solo se acepta si `NODE_ENV === 'test'`;
- los actores deben estar registrados en memoria desde las utilidades de test;
- no usa Firebase real;
- no acepta headers de actor en runtime normal.

La utilidad principal es:

```ts
injectAs(app, actor, options)
```

Esta funcion registra temporalmente un `SessionUser` de fixture y ejecuta `app.inject()` con un header `Authorization` de prueba.

## 6. Pruebas agregadas

La suite inicial vive en:

```text
apps/api/src/test/api-h02-h03.integration.test.ts
```

Cubre:

- `/api/health` responde correctamente;
- una ruta protegida sin token responde `401`;
- Coordinador con una coordinacion lee contexto operativo y no edita horarios ajenos;
- Coordinador con multiples coordinaciones edita un registro dentro de su alcance;
- Coordinador sin coordinacion no captura operacion;
- Coordinador no edita fiscal;
- Coordinador no crea docente con `paymentType`;
- RH si edita fiscal;
- Contador no cambia workflow financiero;
- Finanzas si cambia workflow financiero;
- Coordinador puede usar preview de nomina;
- Coordinador no guarda nomina;
- Extra propio se edita;
- Extra ajeno se bloquea.

## 7. Scripts

Scripts nuevos o relevantes:

```text
npm run test:api:integration
npm run test:db:prepare
npm --workspace apps/api run test:integration
npm --workspace apps/api run test:db:prepare
npm --workspace apps/api run test:db:reset
```

La suite normal de API (`npm run test:api`) excluye `*.integration.test.ts`, para que las pruebas unitarias/smoke no dependan de PostgreSQL.

## 8. Que no se probo todavia

No se implemento todavia la matriz completa H04:

- todos los casos de payroll H01;
- todos los limites de horas por categoria;
- todos los caminos de incidencias;
- todos los reportes financieros;
- todos los casos frontend;
- pruebas e2e con navegador;
- Firebase Auth real;
- Cloud Run o Cloud SQL productivos.

## 9. Riesgos y pendientes

- Las pruebas de integracion requieren PostgreSQL local y la base `nomina_docente_test` creada previamente.
- El setup de test reconstruye la base, por lo que no debe ejecutarse contra una base con datos valiosos.
- El mock de auth depende de `NODE_ENV=test`; debe mantenerse fuera de flujos dev/prod.
- El seed minimo es sintetico y no reemplaza pruebas con dataset operativo controlado.
- Aun falta ampliar cobertura a H01 y a la matriz completa H02/H03.

## 10. Siguiente fase recomendada

H04 Fase 4 debe agregar pruebas de negocio enfocadas en:

1. H01: calculos monetarios, redondeo, limites de categoria y regresiones de nomina.
2. H02: horarios, incidencias y extras con multiples coordinaciones y propiedad.
3. H03: fiscal/documentos, exportaciones y workflow financiero por rol.
4. Frontend: stores de permisos y renderizado condicional de acciones criticas.

## 11. Confirmaciones

- No se uso Firebase Auth real.
- No se uso produccion.
- No se hizo deploy.
- No se modifico Cloud SQL.
- No se crearon migraciones productivas.
- No se cambio H01 funcional.
- No se cambio H02/H03 funcional.
- No se cambiaron reglas de negocio.
