# H24 PD-06 - Zod, gRPC y regresion aislada

Fecha: 2026-10-29. Base: `613c2f3`.
Rama: `feature/h02-h03-user-coordinations-permissions`.
Estado: **Zod/gRPC corregidos y validados localmente; PD-06 no cerrado globalmente.
No autoriza deploy H24**.

## 1. Autorizacion y limites

El usuario aprobo Zod 4, el ensayo de resolucion puntual gRPC y regresion con
PostgreSQL efimero, sin alterar H01 ni la BD local actual. Posteriormente aprobo
fijar npm 10.9.4 en el proceso local/CI y la construccion futura de API, al
demostrarse el problema de overrides en workspaces con npm 11.11.0.

No se usaron credenciales cloud, Firebase real, GCS ni datos personales. No hubo
deploy, push de imagen, audit fix, force ni instalacion de nuevas dependencias
funcionales. Los SDK Firebase mantienen sus versiones. No se ejecuto H05 contra
produccion ni contra la BD local compartida. La suite reconstruye el esquema
solo en el contenedor PostgreSQL sintetico autorizado.

## 2. Resolucion final

| Componente | Antes | Despues |
|---|---|---|
| Zod API | 3.25.76 / rango ^3.24.1 | 4.6.7 exacta |
| gRPC Firestore web | 1.9.16 | 1.14.7 |
| gRPC google-gax / Firebase Admin | 1.14.7 anidada | 1.14.7 compartida |
| proto-loader interno de gRPC | 0.8.0 anidado en google-gax | 0.8.1 anidado en gRPC |
| Firebase JS | 11.10.0 | Sin cambio |
| Firebase Admin | 13.10.0 | Sin cambio |
| Decimal / ExcelJS | 10.6.0 / 4.4.0 | Sin cambio |
| npm de instalacion | 11.11.0 | 10.9.4 fijado |

Override raiz exacto: `"@grpc/grpc-js": "1.14.7"`. No se agrego gRPC como
dependencia directa. El rango `~1.9.0` de Firestore no admite por si mismo la
version corregida; el override es deliberado y requiere conservar esta regresion.
No se instalaron versiones mayores de Firebase para ocultar el advisory.

### Ensayos descartados y reproducibilidad

- npm 11.11.0 retenia 1.9.16; al invalidar entradas en una copia del lock,
  llegaba a omitir nodos. Una resolucion limpia instalaba 1.14.7 pero `npm ls`
  la consideraba invalid y una actualizacion podia volver a ignorar el override.
- Un proyecto minimo sin workspaces reconocia el override; npm 10.9.4 tambien
  lo reconoce en los workspaces reales. La reproduccion concuerda con los
  reportes upstream, sin atribuir a Firebase una falla de autenticacion.
- Se rechazo un lock regenerado completo por cambiar paquetes ajenos.
- El lock aceptado se genero mediante npm 10.9.4 y actualizacion puntual de
  gRPC, partiendo del lock anterior con Zod actualizado. No se retuvo el
  trasplante experimental de entradas ni se inventaron integridades.
- `npm ci` y `npm ls --all --json` terminan 0 en Windows con npm 10.9.4.
  El build Linux instala desde el mismo lock. No quedan copias gRPC 1.9.16.
- `packageManager`, `engines.npm` y `.npmrc` documentan/exigen npm 10.9.4 para
  instalaciones. No se sustituyo globalmente el npm del equipo: se uso
  `npx --yes --package=npm@10.9.4 npm ...`. Un CI futuro debe usar esa version;
  no existe workflow remoto en el repositorio ni se ejecuto CI remoto.

Diff lock: 56 inserciones / 84 eliminaciones. Ademas de las versiones/rutas
indicadas, 42 entradas cambian solo metadatos: manifiestos raiz/API, marcas peer
de binarios esbuild, libc de binarios Rollup y optional de ordered-map al quedar
alcanzable desde la dependencia web no opcional. Se mantienen versiones,
integridades y paquetes no relacionados; no se eliminaron binarios de plataforma.

SHA-256 lock Windows y copia Linux identicos:
`2fe9d136048c46dc967126f422897cf1cc3ccf67a7ac2fb18c545231f76a3ed5`.

## 3. Compatibilidad Zod y H01

Zod 4 hace mas estricta la validacion UUID. La API anterior admitia la forma
hexadecimal 8-4-4-4-12 sin exigir bits RFC de version/variante. Se usa
`.guid('Invalid uuid')` en los mismos puntos de entrada para conservar esa
aceptacion y mensaje, sin cambiar autorizacion ni crear nuevas identidades.
Se prueba el contrato real del expediente, incluyendo UUID legacy, mayusculas,
normalizacion a minusculas, rechazo de valores malformados y campos estrictos.

No se retuvo el motor `zod/v3` como atajo. No fue necesario cambiar defaults,
transformaciones de horas, superRefine, flatten o logica de negocio. Los nuevos
tests verifican horas omitidas cero, horas explicitas decimales, incidencias,
preprocesamiento de Preview y su resumen/lineas monetarias, y la envoltura de
error de Reportes. Los textos genericos internos de Zod 4 pueden diferir;
no se promete equivalencia literal de todo mensaje interno no contractual.

La prueba de seguridad usa solo 501 elementos sinteticos: un array max(500)
se rechaza antes de visitar sus elementos y produce un unico issue. No es una
prueba de carga ni acredita proteccion ilimitada: arrays sin max explicito y
capacidad/rate limiting requieren analisis independiente, sin inventar nuevos
limites de negocio en esta fase.

H01 conserva Decimal, redondeo y formulas. La suite existente verifica, entre
otros, total 3850.00, 250.00 de descuentos y 900.00 de extras del fixture;
Preview/Guardar, cancelacion/restauracion y snapshots se prueban en datos
sinteticos. Los diffs de payroll/incidences/schedules solo adaptan validadores
de identificadores; no se modifica el motor monetario ni SQL versionado.

## 4. Laboratorio y referencia anterior

PostgreSQL 18.6, contenedor exclusivo `h24-pd06-postgres-20261029`, etiqueta
`purpose=h24-pd06-ephemeral`, BD `nomina_docente_test` y credenciales sinteticas.
Windows se conecta solo por `127.0.0.1:58307`; no por el puerto de la BD compartida.
No se montaron carpetas/volumenes de la BD local actual. Antes de ejecutar la
suite se comprobo `current_database()` y el binding Docker; el runner local
rechaza otro nombre, etiqueta, direccion o puerto.

Al finalizar Windows/Linux se detuvo y elimino exclusivamente ese contenedor
y su volumen anonimo, comprobando etiqueta, nombre y montaje antes de retirarlo.
Se verifico que ambos dejaron de existir. No se elimino el volumen de firmas
ClamAV ni ningun recurso de la BD local habitual; las imagenes de ensayo locales
se conservaron. Los datos sinteticos de esta regresion no quedan en una BD activa.

Referencia con Zod 3: API 306 aprobadas/15 omitidas. Primera integracion:
faltaba pdfinfo y 28 casos fallaron. Con pdfinfo suministrado: 161/162 aprobados.
El caso restante era un test SQL preexistente con bytes `%PDF synthetic` que
invocaba el inspector externo. Ahora declara explicitamente su validador
simulado y comprueba bytes/MIME; no cambia el validador de produccion. Ese caso
paso tambien con Zod 3. Seguridad real se ejecuta separadamente con Docker.

Al habilitar pruebas reales pdfinfo y el gate de imagen se detectaron expectativas
antiguas: exceso de salida y timeout se clasifican actualmente como
`DOSSIER_PDF_VALIDATOR_UNAVAILABLE`, no INVALID. Se corrigieron solo los tests
para exigir ese codigo, rechazo y limpieza. No se modifico dossier-storage.
Los primeros dos fallos de los nuevos tests PD-06 fueron fixtures incorrectos
(horario con cero horas y ORDER BY id donde no existe id); se corrigieron las
pruebas respetando la regla y la llave reales, sin modificar backend.

## 5. Validaciones

Resolucion, instalacion reproducible e imagen Linux ejecutadas con npm 10.9.4.
El runner PowerShell de integracion invoca el npm del host solo para ejecutar
scripts, sin resolver ni instalar dependencias; el ensayo Linux repite la suite
con npm 10.9.4. El npm global del equipo permanece sin modificar.

| Validacion | Resultado local |
|---|---|
| npm ci / npm ls completo | Exit 0, sin invalid/missing |
| npm run test:api con pdfinfo | 325 aprobadas; 7 opt-in omitidas en esa invocacion |
| Suite document-security.docker.test.ts opt-in | 7/7, ejecutadas aparte |
| npm run test:web | 158/158 |
| npm run test:api:integration | 167/167, BD efimera exclusivamente |
| npm run typecheck | API/web OK |
| npm run build | API/web OK |
| pd06-dependency-smoke.mjs | 3/3: rutas transitivas, inicializacion Auth, gRPC unary/streaming loopback |
| Servicios document-security/server.test.mjs | 3/3 |
| Docker API / gate pdfinfo Linux | Build OK; 12/12 comprobaciones |
| Suite completa Linux adicional | Exit 0: API 325/7 opt-in omitidas, web 158/158, integracion 167/167, typecheck/build OK |

Los siete casos Docker usan imagenes locales parser/policy y AV previamente
validadas y volumen de firmas montado solo lectura, sin GCS. No se refrescaron
firmas ni se debilito la guarda de antiguedad. API/BD local compartida no se
arrancaron ni reiniciaron.

Imagen API solo local: `nomina-api:h24-pd06-local-20261029`.
Manifest list: `sha256:82afc0761407a06954f543187c6ad90de1211722d96d9f608a89089288c4b901`.
Node dentro de la imagen: 24.22.2 (tag Node 24-slim ya existente); host: 24.14.1.
No se cambia la mayor Node ni engines.node; npm dentro de imagen: 10.9.4.
El Dockerfile usa npm ci y un allowlist de contexto que excluye .env, cache,
dumps y documentos locales. El rehearsal de recuperacion fija el mismo npm;
no se ejecuto ni desplego el job cloud en esta fase.

La imagen adicional `nomina-regression:h24-pd06-local-20261029` repitio npm ci
incluyendo dependencias dev y las cinco tareas con npm 10.9.4. Su contenedor
compartio solo la red del PostgreSQL efimero, sin credenciales cloud ni montajes
del host. Marcador final `PD06_LINUX_ALL_PASS`; contenedor eliminado por --rm.
Las siete pruebas Docker opt-in se ejecutaron aparte desde el host, no dentro
de este contenedor. El primer intento del laboratorio no incluia dependencias
dev debido a NODE_ENV=production heredado; se corrigio solo su Dockerfile
temporal con --include=dev antes de repetir exitosamente la suite completa.

La inicializacion Auth es offline, no un login institucional ni una prueba de
tokens reales. Las pruebas de autorizacion/sesion mock y API pasan; PD-05 no se
reabre ni se da por cerrado un caso real pendiente.

## 6. Audit y pendientes

| Severidad | Antes | Despues |
|---|---:|---:|
| Critica | 0 | 0 |
| Alta | 5 | 0 |
| Moderada | 9 | 9 |
| Baja | 1 | 1 |

Ausentes GHSA-mrhx-c7xc-m3w5 y los advisories gRPC GHSA-m9gg-hp2v-232j /
GHSA-f596-whhp-79r4. npm audit termina 1 por los restantes, no es audit limpio.
Moderadas: uuid y propagacion a ExcelJS, Firebase Admin, Storage/Firestore,
gaxios, google-gax, retry-request y teeny-request. Baja: esbuild.
No se corrigieron automaticamente ni se acepto una excepcion productiva.

Pendientes: triage/correccion o aceptacion formal por alcance de esos hallazgos,
smoke Auth real cuando se programe el ensayo final, y gates restantes de H24
(cloud/alertas/capacidad/H05/rollback). No confundir esta BD efimera con un ensayo
de migracion productiva. No se aplicaron cambios sobre datos reales.

## 7. Confirmaciones

- Sin produccion, deploy, push de imagen o cambios IAM/cloud.
- Sin alteracion de la BD local actual; solo esquema/fixtures del contenedor.
- Sin SQL nuevo o modificado, ni migracion productiva.
- Sin cambios de formulas H01, permisos, datos fiscales o historicos reales.
- Sin audit fix, force ni actualizacion mayor de Firebase/Admin.
- Cambios locales pendientes de versionado; no se hizo commit ni push en esta fase.

Fuentes tecnicas:
[Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[migracion Zod 4](https://zod.dev/v4/changelog),
[gRPC advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j),
[npm workspaces/overrides](https://github.com/npm/cli/issues/9514).
Evidencia local ignorada: `.cache/pd06-approved-20261029/`; no contiene tokens
ni documentos institucionales. Los logs de integracion contienen solo fixtures.
