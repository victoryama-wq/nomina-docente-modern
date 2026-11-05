# H24 PD-06 - Cierre local de dependencias npm

Fecha: 2026-11-05. Base: `eddcb8d`. **PD-06 aprobado para el lockfile
validado en local; H24 mantiene NO-GO para produccion.** No se modificaron
rutas, vistas, modelos, permisos, operaciones de negocio, SQL ni formula H01.

## Audit y cambios

Consultas online a registry.npmjs.org con npm 10.9.4, sin audit fix ni force.
Conteos de nodos reportados, no de advisories independientes:

| Arbol | Criticas | Altas | Moderadas | Bajas |
|---|---:|---:|---:|---:|
| Completo, 03/11 (historico) | 0 | 0 | 20 | 1 |
| Completo, mismo lock antes de cambios, 05/11 | 0 | 0 | 15 | 1 |
| API sin dev, antes | 0 | 0 | 9 | 0 |
| Completo tras UUID y tsx, antes del ajuste de tooling | 0 | 0 | 6 | 0 |
| Completo final y API sin dev final (ambos exit 0) | 0 | 0 | 0 | 0 |
| Inspector independiente, omit=dev, sin cambios | 0 | 0 | 0 | 0 |

La diferencia inicial de 20 a 15 no es merito de esta correccion: con el
mismo lock, el registro ya informa minimatch >=7 y <11.0.1 para este aviso.
Las copias 3/5 de la cadena de ExcelJS no requieren este override.

| Consumidor | Correccion comprobada |
|---|---|
| ExcelJS y SDK Google | Cuatro copias UUID 8/9 pasan a una resolucion 11.1.1 (CJS y ESM). Se conservan Firebase Admin 13.10.0, Storage 7.19.0 y ExcelJS 4.4.0. |
| API, tooling TS | tsx 4.21.0 a 4.23.15; su esbuild 0.27.7 a 0.28.2. Vite 6.4.5 conserva esbuild 0.25.12, fuera del rango de este aviso. |
| Herramientas Vue | Overrides limitados a js-beautify 1.15.4 (glob 14.0.2), editorconfig 1.0.7 y @vue/language-core 2.2.12 (minimatch 11.0.1). glob 14 resuelve su propio minimatch 11.0.4. No se cambia la version de estos tres consumidores. |

No se aplico override global de glob/minimatch: archiver-utils conserva glob
7.2.3 y su interfaz CommonJS. Las advertencias de deprecacion de paquetes
legacy no son equivalentes a un audit fallido ni quedan resueltas por esta fase.
Revisar los overrides al actualizar cualquiera de sus consumidores.

Fuentes: [UUID](https://github.com/advisories/GHSA-w5hq-g745-h8pq),
[esbuild](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr),
[minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249),
[glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4).

## Regresion

Se genero el lock primero con manifiestos aislados, se instalo con npm ci y se
probo contra una copia Git del codigo vigente. Solo despues se incorporaron los
mismos manifiestos y lock al checkout y se repitieron ci, ambos audits y las
pruebas de consumidores. SHA-256 del lock ensayado:
`e965796a1c483a8e6ec5732a42a9c930ee80ed152069aa61240720fa01290640`.
Diff estructural del lock: 13 rutas incorporadas, 31 retiradas, 29 versiones
modificadas (incluidos los binarios multiplataforma de esbuild); la unica
entrada con igual version y metadata modificada es apps/api por tsx.

| Verificacion | Resultado |
|---|---|
| npm ci --ignore-scripts; npm ls uuid tsx esbuild glob minimatch --all | Instalacion reproducible, sin nodos invalidos |
| API / web | 417 aprobadas y 21 opt-in omitidas / 169 aprobadas |
| Integracion PostgreSQL, incluida Nomina, Finanzas, Reportes y permisos | 167/167, 21 archivos, 178 s |
| Typecheck y build API/web | OK |
| Imagen API Linux local | Build OK; pdfinfo 12/12; imports Firebase y UUID por consumidor comprobados sin red |
| Prueba focalizada de compatibilidad | 3/3 en laboratorio y checkout |

La prueba focalizada es reproducible desde la raiz con
`node --test tools/validation/h24-pd06/consumer-compatibility.test.mjs`.
Verifica escritura/lectura XLSX con acentos y numero, UUID v4 desde cada
consumidor, APIs de patrones de archivos y un lookup Auth y upload multipart
Storage de los SDK reales contra un servidor HTTP sintetico en loopback.
No es una prueba de IAM, credenciales, Firebase real ni GCS real.

PostgreSQL 18: contenedor exclusivo, puerto asignado en 127.0.0.1,
verificacion de etiqueta/ID, puerto y current_database=nomina_docente_test,
tmpfs de 2 GiB y sin volumen de datos compartido. Preparacion de esquema/seed
y resets solo alli; contenedor retirado tras las pruebas. La BD habitual no se uso.
Evidencia tecnica ignorada: `.cache/pd06-20261105/`. Imagen local:
`nomina-api:h24-pd06-residual-local-20261105` (ID `39842256ac4e`).

## Limites y decision

No se detectaron regresiones funcionales en el alcance probado. Ninguna excepcion
de seguridad solicitada ni aceptada. Cero avisos npm es evidencia del registro,
alcance y fecha indicados, no certificacion de binarios nativos ni de todo el sistema.
Repetir audit si cambia el lock y antes del release. PD-07 local del 03/11 sigue
siendo evidencia del artefacto anterior, no una medicion de capacidad de esta imagen.
Usar el candidato final en el ensayo aislado pendiente de PD-03/04/07; PD-05 y
PD-08 mantienen sus decisiones y validaciones pendientes. Sin produccion, servicios
cloud, migracion productiva, deploy, commit ni push en esta fase.
