# H24 PD-06 - Correccion compatible y acotada de dependencias

Fecha: 2026-10-29. Base Git: `ab3f5c3`.
Estado: **correccion parcial local validada; PD-06 no cerrado**.

## Autorizacion y alcance

El usuario autorizo actualizaciones puntuales compatibles, condicionadas a no
afectar el funcionamiento general de Nomina, sin audit fix ni saltos mayores
automaticos. Zod 4 quedo expresamente fuera, pendiente de revision especifica.
La regresion aprobada acredita los escenarios ejecutados, no garantiza ausencia
absoluta de regresiones ni sustituye smoke real/ensayo de integracion completo.

Este cambio de dependencias solo modifica `package-lock.json`, `package.json`
(overrides Vue) y `apps/web/package.json` (Vue 3.5.44). No modifica codigo de negocio,
permisos, SQL, H01, configuracion de BD ni despliega API/Hosting. El arbol de trabajo
incluye ademas el transporte/servicios H24 autorizado, documentado por separado.

## Estrategia reproducible

1. `npm audit --json` y `npm ls` antes de actualizar; salida local ignorada en .cache.
2. `npm update` con lista explicita: fastify, vue, vite, vitest, @fastify/busboy,
   @grpc/grpc-js, brace-expansion, fast-uri, find-my-way, form-data, nanoid, postcss,
   source-map-js, undici y protobufjs; primero package-lock-only/ignore-scripts.
3. Vue requirio alinear tambien sus compiladores/runtime/renderer. npm retenia
   peers antiguos; se fijo Vue 3.5.44 y overrides exactos vue/server-renderer en
   raiz. Se invalidaron mecanicamente solo sus entradas lock y npm las regenero.
   No se inventaron integridades ni URLs. Quedo una unica familia 3.5.44.
4. Se evaluo un override gRPC 1.14.7 fuera de `~1.9.0` fijado por Firestore web;
   no se retuvo: la resolucion no fue fiable y eliminaba nodos opcionales del lock.
   Se restituyeron esas entradas y npm recalculo dentro de rangos originales.
   No se acepta reducir audit a costa de omitir dependencias necesarias.
5. `npm ci --ignore-scripts --no-audit --no-fund` final paso; `npm ls --all --json`
   exit 0. Sin audit fix, force, actualizacion general ni degradacion de ExcelJS.

Lock final SHA-256:
`ad634084b2588a3db56984c24816c5c7ac8383f4ed3098871d17344c23fbb69d`.
Diff lock: 233 inserciones/202 eliminaciones; 48 rutas con cambio de version,
alta o retiro. Se revisaron como sigue, sin cambios masivos ajenos.

## Versiones y dependencias derivadas

| Familia | Antes | Despues | Alcance |
|---|---|---|---|
| Fastify | 5.8.5 | 5.12.7 | Runtime API, misma mayor |
| Vue y nueve paquetes @vue | 3.5.33 | 3.5.44 | Runtime/compilacion/tests, misma menor |
| Vite | 6.4.2 | 6.4.5 | Herramientas frontend |
| Vitest y siete paquetes @vitest | 4.1.7 | 4.1.12 | Tests |
| @fastify/busboy | 3.2.0 | 3.2.4 | Transitiva Firebase Admin |
| gRPC Firestore web | 1.9.15 | 1.9.16 | Correccion parcial, sigue vulnerable |
| gRPC google-gax | 1.14.3 | 1.14.7 | Transitiva backend |
| brace-expansion (tres copias 1.x) | 1.1.16 | 1.1.21 | Herramientas/ExcelJS |
| brace-expansion 2.x | 2.1.0 | 2.1.7 | Herramientas |
| fast-uri raiz | 3.1.2 | 3.1.9 | Serializacion/validacion |
| find-my-way | 9.5.0 | 9.10.0 | Router Fastify |
| form-data | 2.5.5 | 2.5.6 | Transitiva |
| nanoid | 3.3.12 | 3.3.20 | Herramientas |
| postcss | 8.5.13 | 8.5.32 | Compilacion |
| source-map-js | 1.2.1 | 1.2.2 | Compilacion |
| undici | 7.26.0 | 7.30.1 | Dev/jsdom |
| protobufjs | 7.6.1 | 7.6.6 | Transitiva gRPC |

Derivadas explicadas: Babel parser/types y helpers actualizados por compilador
Vue (7.29.12/7.29.11/7.29.11/7.29.7); chai 6.3.0 y tinyrainbow 3.2.0 por Vitest;
hasown 2.0.4 por form-data; process-warning 5.1.1, safe-regex2 5.1.2 y ret 0.5.1
por Fastify/router. Protobufjs retira @protobufjs/inquire. Fastify declara ahora
su propia dependencia fast-json-stringify ^7: nueva copia 7.2.0 y fast-uri 4.2.3
anidada, sin sustituir la copia 6.3.0 de su compilador ni el fast-uri 3.x de Ajv.
Son cambios internos exigidos por Fastify 5, no una subida mayor de API Fastify.

Sin cambios: Firebase 11.10.0, Firebase Admin 13.10.0, Zod 3.25.76, ExcelJS 4.4.0,
Decimal 10.6.0; no dependencias funcionales directas nuevas.

## Audit restante

| Severidad | Antes | Despues |
|---|---:|---:|
| Critica | 0 | 0 |
| Alta | 15 | 5 |
| Moderada | 12 | 9 |
| Baja | 1 | 1 |
| Total nodos reportados | 28 | 15 |

`npm audit --json` termina 1 porque siguen hallazgos; no es un audit limpio.
Las cinco altas son Zod y la cadena @grpc/grpc-js -> @firebase/firestore ->
@firebase/firestore-compat -> firebase. No representan cinco fallos independientes.
La version 1.9.16 corrige algunos avisos, no los que requieren >=1.13.6/1.14.5.
No hay uso directo de Firestore encontrado en src, pero no se declara riesgo cero.

Zod: GHSA-mrhx-c7xc-m3w5, <4.6.6; requiere evaluar salto 3 -> 4 aparte y contratos
de validacion. API admite hasta 12 MiB: no se usa ese limite como exencion de DoS.
Moderadas: uuid y propagacion a ExcelJS/gaxios/google-gax/teeny-request/retry-request,
Storage/Firestore/Firebase Admin. Baja: esbuild 0.27.x, corregida desde 0.28.1;
no forzar version fuera del rango del consumidor sin analisis.
No se aceptaron excepciones productivas automaticamente ni se actualizaron
Firebase a 14 o ExcelJS hacia atras para silenciar audit.

## Regresion ejecutada

- Instalacion limpia reproducible, npm ls sin invalid/missing: OK.
- `npm run test:api`: 306 aprobadas, 15 omitidas (7 opt-in Docker y 8 dependientes
  de pdfinfo local). No contar omitidas como aprobadas.
- `npm run test:web`: 158/158.
- `npm run typecheck`: API/web OK.
- `npm run build`: API/web OK.
- Wrapper de servicios: 3/3 grupos Node.
- `git diff --check`: OK al cierre documental.

No se ejecuto `test:api:integration` porque resetea la BD compartida. No se
sobrescribio `nomina_docente_test`. El ensayo cloud recuperacion uso imagen con
lock anterior: NO acredita el lock actualizado; repetir imagen/regresion Linux
y prueba de integracion aislada en el cierre PD-06/PD-08. Smoke institucional y
capacidad siguen pendientes. H01/cancelacion/snapshots no fueron editados.

## Decision

Conservar correccion compatible local; mantener PD-06 abierto. Siguiente accion:
analisis de alcance y alternativa de Zod/gRPC, seguido de aprobacion especifica
si requiere cambio mayor y de regresion aislada completa. No autoriza deploy.

Fuentes: salida local npm audit del 2026-10-29; metadatos npm verificados;
[Fastify releases](https://github.com/fastify/fastify/releases),
[Vue releases](https://github.com/vuejs/core/releases).
