# H04 Fase 1 - Infraestructura de Testing

## 1. Resumen

Esta fase agrega la infraestructura base para iniciar H04: pruebas automatizadas de negocio que protejan H01, H02 y H03.

El objetivo de esta entrega no es cubrir todavia toda la matriz de negocio, sino dejar el proyecto listo para escribir pruebas confiables sobre API Fastify, frontend Vue 3 y reglas que dependen de PostgreSQL local/test.

## 2. Que se instalo

Dependencias agregadas:

| Workspace | Dependencia | Uso |
|---|---|---|
| `apps/api` | `vitest` | Runner de pruebas API y helpers TypeScript |
| `apps/web` | `vitest` | Runner de pruebas frontend |
| `apps/web` | `@vue/test-utils` | Montaje de componentes Vue |
| `apps/web` | `jsdom` | Entorno DOM para pruebas de componentes |
| `apps/web` | `@pinia/testing@0.1.7` | Pruebas futuras de stores Pinia |

Nota: se uso `@pinia/testing@0.1.7` porque el proyecto usa Pinia 2.x; versiones recientes de `@pinia/testing` requieren Pinia 3.x.

## 3. Scripts agregados

Scripts raiz:

```bash
npm run test
npm run test:api
npm run test:web
```

Scripts API:

```bash
npm --workspace apps/api run test
npm --workspace apps/api run test:watch
```

Scripts web:

```bash
npm --workspace apps/web run test
npm --workspace apps/web run test:watch
```

## 4. Configuracion de Vitest

Se agregaron configuraciones por workspace:

- `apps/api/vitest.config.ts`
- `apps/web/vitest.config.ts`

API usa entorno `node`.

Web usa entorno `jsdom` y registra el plugin Vue de Vite.

## 5. Estrategia API

Se extrajo la construccion de Fastify a:

- `apps/api/src/app.ts`

La funcion exportada `buildApp()` permite construir la aplicacion para pruebas sin abrir puerto.

`apps/api/src/server.ts` conserva el comportamiento productivo:

- construye la app con `buildApp()`
- registra el cierre controlado de base de datos y Fastify
- ejecuta `listen()` en `0.0.0.0`

No se cambiaron rutas, middlewares, CORS, auth ni configuracion Cloud Run.

Pruebas smoke agregadas:

- `apps/api/src/app.test.ts`: valida `app.inject()` contra `/api/auth/session` sin token.
- `apps/api/src/lib/decimal.test.ts`: valida helpers monetarios H01 de forma pura.
- `apps/api/src/actor-scope.test.ts`: valida helpers basicos de alcance H02 multi-coordinacion.

## 6. Estrategia frontend

Se habilito Vitest para componentes Vue con `@vue/test-utils` y `jsdom`.

Prueba smoke agregada:

- `apps/web/src/components/modals/ConfirmModal.test.ts`

Esta prueba no depende de Firebase real, API, backend ni datos productivos.

## 7. Estrategia BD test

La estrategia recomendada para fases posteriores es usar PostgreSQL real local/test, no `pg-mem`.

Base sugerida:

```text
nomina_docente_test
```

Variables propuestas:

```text
TEST_DB_HOST
TEST_DB_PORT
TEST_DB_NAME
TEST_DB_USER
TEST_DB_PASSWORD
```

Flujo sugerido para futuras pruebas de integracion:

1. Crear base `nomina_docente_test`.
2. Aplicar migraciones `database/*.sql` en orden.
3. Aplicar seed minimo H04.
4. Ejecutar pruebas API con `app.inject()`.
5. Limpiar datos entre suites con transacciones o truncado controlado.

Esta fase no crea ni modifica bases de datos.

## 8. Estrategia mock de actor

Las pruebas futuras deben poder construir actores sin Firebase real para cubrir:

- admin
- coordinador con una coordinacion
- coordinador con multiples coordinaciones
- coordinador sin coordinacion
- rh
- finanzas
- direccion
- contador
- contabilidad

La recomendacion es crear fixtures de `SessionUser` y `ActorScope` en una fase posterior, aislados de produccion, para probar:

- permisos H03
- alcance por `user_coordinations`
- workflow financiero
- vista previa de nomina
- propiedad de registros
- fallback legacy

## 9. Que NO se probo todavia

No se implementaron todavia pruebas profundas de negocio para:

- calculo completo de nomina
- reglas de maximo de horas por docente
- permisos por rol completos
- fiscal/documentos
- workflow financiero
- filtros de preview por coordinacion
- importacion/migracion de datos oficiales
- pruebas E2E con navegador
- Firebase Auth real o emulador

## 10. Proximas fases H04

Fase recomendada siguiente:

1. Crear fixtures de actores y permisos H02/H03.
2. Crear seed minimo para `nomina_docente_test`.
3. Agregar pruebas API de permisos sin Firebase real.
4. Agregar pruebas de calculo H01 con dataset controlado.
5. Agregar pruebas Vue de visibilidad de acciones por permiso.
6. Evaluar Playwright solo cuando las pruebas unitarias/integracion esten estables.

## 11. Confirmaciones de alcance

- No se toco produccion.
- No se cambio H01 funcional.
- No se cambio H02/H03 funcional.
- No se cambiaron reglas de negocio.
- No se hicieron migraciones nuevas.
- No se hizo deploy.
