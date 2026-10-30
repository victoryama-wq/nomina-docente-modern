# H24 PD-06 - Triage residual de UUID y esbuild

Fecha: 2026-10-30, America/Cancun.
Base inspeccionada: `51fc585`.
Rama: `feature/h02-h03-user-coordinations-permissions`, inicialmente limpia.
Estado: **propuesta; sin correcciones ni excepciones aprobadas en esta revision**.
H24 conserva NO-GO hasta resolver los gates pendientes; esto no autoriza deploy.

## 1. Alcance y resultado

Revision de lock, paquetes instalados, consumidores, Dockerfile, avisos upstream
y metadata del registro npm. No se instalaron ni actualizaron dependencias,
ni se cambiaron codigo funcional, permisos, SQL, BD o recursos cloud.

| Audit online con npm 10.9.4 | Criticas | Altas | Moderadas | Bajas | Exit |
|---|---:|---:|---:|---:|---:|
| Arbol completo | 0 | 0 | 9 | 1 | 1 |
| API, include-workspace-root, omit=dev | 0 | 0 | 9 | 0 | 1 |

Los nueve moderados son nodos afectados por propagacion de **un advisory de
uuid**, no nueve vulnerabilidades independientes. El bajo es un segundo
advisory, de esbuild. No se declara que estos sean todos los riesgos de la
imagen o de los binarios nativos: npm audit no los cubre.

Comandos relevantes:

```powershell
npx --yes --package=npm@10.9.4 npm audit --json
npx --yes --package=npm@10.9.4 npm audit --offline=false --workspace apps/api --include-workspace-root --omit=dev --json
npx --offline --package=npm@10.9.4 npm explain uuid esbuild
npx --offline --package=npm@10.9.4 npm ls uuid --workspace apps/api --omit=dev
```

Precaucion de evidencia: dos ensayos de audit mediante `npx --offline`
devolvieron cero hallazgos. Se descartaron: el modo offline se hereda y no
acredita consulta vigente de advisories. La repeticion con `--offline=false`
confirmo los nueve moderados de API. Explain/ls offline si sirven para inspeccionar
el arbol instalado, no para declarar un audit limpio.

## 2. R-01 - UUID y propagacion moderada

Advisory: `GHSA-w5hq-g745-h8pq`, CVE-2026-41907.
El problema afecta a v3/v5/v6 con buffer de salida y limites incorrectos;
v4 no es el metodo afectado. La rama corregida propuesta es 11.1.1.
Fuente: [aviso UUID](https://github.com/advisories/GHSA-w5hq-g745-h8pq) y
[backport 11.1.1](https://github.com/uuidjs/uuid/releases/tag/v11.1.1).

| Nodo reportado | Version instalada | Ruta / causa | Alcance observado |
|---|---|---|---|
| uuid | 8.3.2; tres copias 9.0.1 | ExcelJS y consumidores Google | Dependencia runtime; ver llamadas debajo |
| exceljs | 4.4.0 | API -> ExcelJS -> uuid 8.3.2 | Exportables XLSX server-side |
| @google-cloud/storage | 7.19.0 | Firebase Admin -> Storage -> uuid/teeny/retry | GCS de constancias y expediente, usado realmente |
| gaxios | 6.7.1 | Storage/google-auth-library -> gaxios -> uuid 9.0.1 | Transporte; crea boundary con v4 |
| google-gax | 4.6.1 | Firestore -> google-gax -> uuid/retry | No se encontro consulta Firestore de negocio en src |
| teeny-request | 9.0.0 | Storage/retry -> teeny -> uuid 9.0.1 | Transporte; crea boundary con v4 |
| retry-request | 7.0.2 | Storage/google-gax -> retry -> teeny | Metavulnerabilidad propagada |
| @google-cloud/firestore | 7.11.6 | Firebase Admin -> Firestore -> google-gax | Instalado; sin uso directo de negocio encontrado |
| firebase-admin | 13.10.0 | Firestore propaga aviso al paquete Admin | Auth y Storage SI se usan; no eliminar Admin |

`gaxios@7.1.4` tambien esta instalado en otras rutas, pero no es el nodo
reportado por este audit. El marcador optional de paquetes Google no significa
que esten ausentes ni que Storage sea prescindible.

### Evidencia de alcanzabilidad

Consumidores instalados revisados, en el arbol correspondiente al lock:

- `node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js:1,43,77`:
  importa v4 como uuidv4; llamadas sin buffer/offset. Se usa para IDs de formato
  condicional. El helper propio no configura ese formato.
- `node_modules/@google-cloud/storage/build/cjs/src/resumable-upload.js:94,463,659,758`:
  v4 sin argumentos para IDs de invocacion. Tambien v4 en
  `nodejs-common/service.js:185` y `util.js:684`; equivalentes ESM revisados.
- `node_modules/gaxios/build/src/gaxios.js:417` y
  `node_modules/teeny-request/build/src/index.js:135`: v4 sin argumentos.
- `node_modules/google-gax/build/src/util.js:108`: v4 sin argumentos.
- No se encontraron importaciones directas de uuid ni llamadas Firestore en
  codigo de aplicacion/servicios/herramientas inspeccionados. Los identificadores
  propios H24 usan `node:crypto.randomUUID`, por ejemplo
  `apps/api/src/lib/teacher-dossier.ts:201` y `constancia-replacement.ts:56`.
- `apps/api/src/lib/xlsx.ts:30,48` crea el workbook y escribe el buffer;
  `apps/api/src/auth.ts:141` usa Firebase Auth;
  `apps/api/src/lib/constancia-storage.ts:10` y `dossier-storage.ts:212` usan GCS.

Conclusión tecnica: **no se identifico una ruta alcanzable al metodo vulnerable
en los consumidores revisados**. No equivale a inexistencia del paquete, ausencia
universal de explotabilidad ni aceptacion de riesgo. No se hicieron ensayos con
datos o credenciales reales ni se invocaron metodos vulnerables en produccion.

### Correccion recomendada, pendiente de autorizacion

Ensayar con npm 10.9.4 un override exacto `uuid: 11.1.1` que cubra las cuatro
copias vulnerables. Esa version tiene exports CommonJS y ESM segun metadata npm,
lo que permite evaluar los consumidores require/import existentes. No agregar
una dependencia funcional directa ni seleccionar latest sin revision.

Es un salto mayor de la dependencia transitiva desde 8/9: **compatibilidad aun
no demostrada**. Inspeccionar exports, tipos, v4, rutas resueltas y diff del lock;
validar instalacion limpia, XLSX, Auth y transporte GCS. Si aparecen consumidores
incompatibles, detener; no ampliar cambios automaticamente.

No seguir las propuestas automaticas del audit que implican Firebase Admin 14.5.0
o retroceder ExcelJS a 3.4.0. Tampoco quitar Storage/Firestore optional en bloque:
Storage es funcional y estas decisiones requieren analisis independiente.

## 3. R-02 - esbuild bajo

Advisory: `GHSA-g7r4-m6w7-qqqr`. Lectura fuera de servedir en el servidor de
desarrollo de esbuild sobre Windows; rango afectado >=0.27.3 <0.28.1.
Fuente: [aviso esbuild](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) y
[correccion 0.28.1](https://github.com/evanw/esbuild/releases/tag/v0.28.1).

- Ruta afectada: API devDependency tsx 4.21.0 -> esbuild 0.27.7.
- Vite 6.4.5 usa otra copia, esbuild 0.25.12, fuera del rango de ESTE advisory.
  Esto no acredita por si solo la ausencia de otros advisories.
- tsx inspeccionado usa transform/transformSync; no se encontro servedir/serve
  en su distribucion ni invocacion del servidor esbuild en el codigo propio.
- `apps/api/package.json` ejecuta tsx watch en desarrollo y node dist/server.js
  en start; Hosting publica archivos compilados, no el servidor esbuild.
- `apps/web/package.json` usa Vite con host 0.0.0.0. No confundir ese servidor
  con esbuild serve ni declarar que el proyecto limita todos los devservers a
  loopback. Para ensayos futuros, fijar loopback explicitamente.
- `apps/api/Dockerfile:7,29` instala y copia node_modules incluyendo dev;
  NODE_ENV=production posterior no los elimina. Por tanto no se justifica
  aceptacion diciendo que esbuild no esta empaquetado. El runtime definido es
  Linux/node, no esbuild serve Windows (`Dockerfile:33`).

La inspeccion ejecutable de la imagen local no pudo repetirse: Docker Desktop
no estaba disponible. No se arranco ni se modifico para esta revision. La
conclusion de empaquetado es estatica, no un inventario productivo actualizado.

### Correccion recomendada, pendiente de autorizacion

Actualizar puntualmente tsx a **4.23.15** (misma mayor 4), metadata consultada
2026-10-30: depende de esbuild `~0.28.0`, compatible con una resolucion >=0.28.1.
Exigir que el lock final use una version corregida y que el diff solo incluya
tsx/esbuild y sus binarios transitivos explicados. No basta con que ~0.28.0
permita la correccion: tambien admite 0.28.0, que se debe rechazar.

Preferir actualizar el consumidor antes que forzar un override global esbuild
que cambie tambien el usado por Vite. Probar ejecucion TS, tests, typecheck,
build y Docker Linux; revisar cualquier comportamiento nuevo de tsx.

Separar como hardening futuro la exclusion de devDependencies de la imagen
runtime. No es necesaria para demostrar que este advisory exige Windows/serve,
ni se implementa ahora: el gate pdfinfo y la construccion deben seguir pasando.

## 4. Alternativa de aceptacion temporal

Solo si el ensayo puntual no es compatible o no cabe en la ventana operativa,
proponer una excepcion explicita, no silenciosa:

| Item | Justificacion candidata | Condiciones y caducidad propuesta |
|---|---|---|
| R-01 uuid | No se encontro uso v3/v5/v6 con buffer; consumidores revisados usan v4 | Responsable tecnico y responsable de release por designar; aceptar explicitamente los nueve nodos y lock exacto; corregir/revisar antes del 2026-11-13 |
| R-02 esbuild | No se identifico esbuild serve; runtime previsto Linux/node, desarrollo usa transform | Prohibir esbuild serve con esta version; loopback para pruebas y sin archivos reales/secretos; corregir/revisar antes del 2026-11-06 |

La excepcion debe citar version, advisory, evidencia, alcance, responsable,
fecha de aprobacion y vencimiento. Reabrir si cambia el lock, se agrega otro
consumidor UUID, aparecen buffers externos, se habilita esbuild serve o hay
nueva evidencia. Mantener los hallazgos visibles en audit; no bajar su severidad
oficial ni afirmar audit=0. No se acepto ninguna excepcion en esta fase.

La autenticacion institucional o que los archivos sean escaneados no sustituye
este analisis: estos avisos tratan de librerias/servidor de desarrollo, no de la
procedencia de los PDF. Una excepcion PD-06 no cierra los otros gates H24.

## 5. Autorizaciones solicitadas y secuencia

1. **UUID local:** override exacto 11.1.1, cambios acotados de manifiesto/lock,
   pruebas de compatibilidad; sin actualizar Firebase/Admin/ExcelJS ni H01.
2. **tsx local:** actualizacion puntual 4.23.15 y resolucion esbuild corregida,
   sin npm audit fix, force, cambios mayores de Vite o override global esbuild.
3. **Regresion aislada:** arrancar Docker local, npm ci e imagen API; PostgreSQL
   efimero sintetico `nomina_docente_test`, puerto exclusivo, borrado del laboratorio
   al terminar, sin alterar la BD local actual. API/web/integracion/typecheck/build,
   XLSX legible, imports CJS/ESM y mocks de Storage/Auth. No usar H05 productivo.

Las tres son autorizaciones para corregir y ensayar, NO para aceptar riesgo ni
desplegar. Si hiciera falta confirmar GCS/Auth reales tras el cambio, solicitar
autorizacion acotada al bucket/Firebase H24, documentos sinteticos y restitucion;
no reutilizar implicitamente credenciales o permisos productivos.

Orden recomendado: ensayar UUID y luego tsx, revisar cada diff, repetir audit
online completo y de API, instalacion reproducible y regresion. Meta: cero
hallazgos de estos dos advisories, sin prometer cero hallazgos futuros del registro.
Si falla la compatibilidad, presentar resultado y excepcion candidata antes de
alterar otra dependencia. Deploy, commit y push requieren su fase/autorizacion.

## 6. Evidencia y confirmaciones

- `npm explain uuid esbuild` y `npm ls uuid --workspace apps/api --omit=dev`: OK.
- Metadata UUID 11.1.1: exports require/import; tsx 4.23.15: esbuild ~0.28.0,
  Node >=18; esbuild 0.28.1: Node >=18. Consultas, no instalaciones.
- Audit online completo y API registrados localmente en
  `.cache/pd06-approved-20261029/residual-audit*-20261030.json` (ignorados).
- Docker no disponible: no se ejecutaron contenedores, suites, build o DB.
- No se modificaron manifiestos, lock, node_modules, codigo, SQL, BD ni H01.
- Sin produccion, deploy, cambios IAM, migraciones, seeds o datos personales.
- Solo se crea este informe y se enlaza desde el predeploy; sin commit/push.
- Validacion documental de cierre: `git diff --check` y `git status`.

Referencias de codigo de dependencias corresponden a versiones instaladas en
`51fc585`; no son archivos a versionar. El resultado no certifica una imagen
productiva distinta de este lock ni convierte las pruebas anteriores en nuevas.
