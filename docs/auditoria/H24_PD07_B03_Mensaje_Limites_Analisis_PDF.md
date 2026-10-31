# H24 PD07-B03 - Mensaje especifico para limites de analisis PDF

Fecha: 2026-10-31, America/Cancun. Base: `0ac95ff`.
Rama: `feature/h02-h03-user-coordinations-permissions`, limpia al inicio.
Resultado: **mensaje implementado y validado localmente; H24 mantiene NO-GO**.
No se promete aceptar todos los PDF de 500 paginas. No se realizo deploy.

## 1. Cambio autorizado

El diagnostico anterior identifico que MaxFiles limita extracciones internas,
no paginas. Un PDF valido para el inspector puede exceder el presupuesto AV.
Antes se respondia indisponibilidad generica incluso ante un limite confirmado.
Se distingue ese rechazo sin aceptar bytes cuyo analisis no se completo.

Mensaje publico, igual para constancias y documentos adicionales:

> El PDF excede los limites de analisis de seguridad. Usa un archivo menos complejo o divide el PDF en documentos mas pequenos. No se pudo completar su validacion.

Dividir es una accion manual del usuario: cada nuevo archivo debe pasar todas
las validaciones. No se omiten paginas, no se reintenta con limites mayores y
no se trata este diagnostico como prueba de que el archivo esta limpio o infectado.

## 2. Contrato y defensa en profundidad

El wrapper conserva MaxFiles=100, MaxFileSize=8M, MaxScanSize=32M,
MaxRecursion=8, MaxScanTime=10000 ms, timeout externo 115 s, admision 7.5 MiB,
firmas oficiales recientes y alertas de cifrado/limites.

Solo rc=1, resumen de un archivo/una deteccion y una unica linea exacta de
MaxFiles, MaxScanSize, MaxFileSize o MaxRecursion sobre el archivo analizado
permiten `H24_SCAN_LIMIT <sha256>`, exit 40. No se permiten advertencias,
errores, detecciones mezcladas, lineas duplicadas o contradictorias.

API requiere kind=av, MIME PDF, stderr vacio y hash exacto de los bytes.
Devuelve HTTP 422 `DOCUMENT_SCAN_LIMIT_EXCEEDED`, sin diagnosticos internos,
rutas, firmas, nombres de objetos ni contenido del archivo. El transporte HTTP
conserva requestId y validaciones de tamano/protocolo. El servidor del scanner
acepta el nuevo protocolo solo en modo scanner.

MaxScanTime, timeout, errores de motor/firmas, limites desconocidos, respuestas
ambiguas y hashes incorrectos siguen fallando cerrados como 503. Un code 40
para JPG/PNG tampoco se convierte en el mensaje especifico PDF: permanece 503.
Los veredictos de malware mantienen el rechazo previo.

## 3. Flujos y archivos

- Scanner compartido: `tools/validation/h24-pd03/scan-stdin.sh` y
  `services/document-security/server.mjs`.
- API: `apps/api/src/lib/document-security.ts` y `document-cloud.ts`.
- UI/cliente: `apps/web/src/composables/useDossierOperations.ts` y `api.ts`.
- Pruebas API: document-security, document-cloud, constancia-route,
  constancia-replacement, dossier-large-file, dossier-recovery y el nuevo
  `document-scan-limit.docker.test.ts`.
- Pruebas web: TeacherDossierPanel, FiscalRecordsView y api.dossier.
- Pruebas del servicio: server.test.mjs y scanner-limit-protocol.test.mjs.

No se modificaron rutas, SQL, permisos, formularios fiscales ni el motor monetario.
En carga/reemplazo, el rechazo previo a staging no invoca put/remove ni DML.
El reemplazo rechazado conserva el documento anterior. En recuperacion se
mantiene el flujo existente: abortar, limpiar solo el candidato y conservar
el anterior; el codigo nuevo queda como causa terminal. Una lectura rechazada
no devuelve bytes ni elimina el documento. La UI no crea URL/iframe ni
reintenta automaticamente un 422; muestra el mensaje tambien en FAILED recuperado.

## 4. Laboratorio Docker

Imagenes locales, sin publicar:

| Imagen | ID local inmutable |
|---|---|
| Scanner HTTP construido | `sha256:f03c028ea5df310fd316cf86e7b31723635668e6fd776b8a96a1f35bad724605` |
| Scanner CLI construido | `sha256:1859a2a377775c3863326f516b66486344853fb08cd6b3a1fe5bbb1859fd5f37` |
| Inspector CLI existente | `sha256:d9147e0cb6ee7f3d0feb9a3d7d4a82021c2d9890dbcaf53233dd9f8a0bc5454e` |

El ensayo usa PDFKit existente: PDF sintetico pequeno y otro de 500 paginas.
El parser y ClamAV son reales dentro de Linux; rutas Fastify y servicios de
constancia/expediente son reales mediante app.inject. Auth, Firebase, BD y
almacenamiento estan simulados; solo se permiten SELECT en la frontera mock.
No es una validacion end-to-end PostgreSQL/GCS/Hosting ni un smoke de navegador.

Analisis sin red, root read-only, no-new-privileges, cap-drop ALL, no root,
64 PIDs, 2 CPU, tmpfs 128 MiB noexec; AV 4 GiB, inspector 512 MiB.
Firmas originales `h24-pd03-signatures-20261028` montadas solo lectura para
copiar a `h24-pd03-signatures-b03-message-20261031`. Solo esa copia se refresco
contra CDN oficial: daily 28170, main 63, bytecode 339. No credenciales cloud.
Analisis con firmas read-only. Bootstrap separado con CHOWN/DAC_OVERRIDE;
no se conceden esas capacidades a los analizadores.

El test de clasificacion inyecta salidas sinteticas de clamscan en el wrapper
real de la imagen Linux: 16 casos. No se atribuyen esos 16 casos a escaneos AV
reales. Su tmpfs ejecutable sirve exclusivamente al stub; los escaneos reales
mantienen noexec. Los primeros intentos del harness fallaron por el stub sin
permiso exec del tmpfs y un cierre de funcion faltante en el test TypeScript;
se corrigieron los harness sin relajar el scanner. Las repeticiones finales
aprobaron; no se presentan los intentos fallidos como evidencia de exito.

## 5. Resultados

| Validacion | Resultado |
|---|---|
| Docker clasificador shell | 16/16 casos: 4 limites, limpio, malware, 10 errores/ambiguedades |
| Docker real parser/AV + rutas/servicios | 6/6, 162.55 s total |
| PDF pequeno | Aceptado por inspector y antivirus |
| Constancia carga/reemplazo, mismo endpoint | 422 especifico; sin put/remove ni DML |
| PDF adicional carga y reemplazo | Ambos 422 especifico; sin put/remove ni DML |
| Constancia y PDF adicional, lectura | Ambos 422 especifico; sin bytes ni borrado |
| `node --test services/document-security/server.test.mjs` | 4/4; HTTP con runner simulado |
| API enfocada (6 archivos) | 136/136 |
| `npm run test:api` | 396 aprobadas; 21 omitidas opt-in Docker |
| `npm run test:web` | 166/166, 23 archivos |
| `npm run typecheck` | API/web OK |
| `npm run build` | API/web OK, solo artefactos locales |
| `git diff --check` | OK, avisos habituales LF/CRLF sin error |

De las 21 omitidas del comando API normal, las 6 nuevas se ejecutaron aparte
con Docker real y aprobaron; las 15 del laboratorio Docker previo no se
repitieron en esta fase. No se ejecuto test:api:integration ni se conecto BD.
No se afirman pruebas reales de los cuatro limites: el corpus real reproduce
MaxFiles; los otros codigos se validan con diagnosticos sinteticos controlados.

Comandos para repetir tras construir imagenes y preparar copia de firmas:

```powershell
$env:RUN_H24_LIMIT_PROTOCOL='true'
$env:H24_LIMIT_PROTOCOL_IMAGE=(docker --context desktop-linux image inspect h24-cloud-scanner:pd07-b03-message-local --format '{{.Id}}')
node --test services/document-security/scanner-limit-protocol.test.mjs

$env:RUN_H24_SCAN_LIMIT_FLOWS='true'
$env:H24_LIMIT_PARSER_IMAGE=(docker --context desktop-linux image inspect h24-pd03-policy:local --format '{{.Id}}')
$env:H24_LIMIT_AV_IMAGE=(docker --context desktop-linux image inspect h24-pd03-av:pd07-b03-message-local --format '{{.Id}}')
$env:H24_LIMIT_SIGNATURE_VOLUME='h24-pd03-signatures-b03-message-20261031'
npm --workspace apps/api run test -- src/test/document-scan-limit.docker.test.ts
```

Al terminar: cero contenedores del ensayo, copia temporal de firmas eliminada
tras verificar etiqueta purpose; volumen original conservado. Imagenes locales
retenidas, no subidas a registro. No servicios ni puertos nuevos abiertos.

## 6. Estado y confirmaciones

La entrega acotada del mensaje esta completa en local. PD07-B03/capacidad y
H24 no quedan autorizados productivamente. Sigue pendiente el ensayo del
artefacto final por API/BD/GCS/Hosting, presupuestos temporales/cold start,
concurrencia y las decisiones de capacidad; ademas de los restantes gates H24.
El HTTP real con runner scanner y su refresh integrado no se repitio aqui.

Sin produccion, deploy, BD local/productiva, migraciones, datos reales,
permisos nuevos, cambios H01/Nomina/snapshots, dependencias ni npm audit fix.
Sin commit ni push en esta fase; cambios disponibles para revision/versionado.
