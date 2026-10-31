# H24 PD07-B04 - Correccion local de concurrencia de analizadores

Fecha: 2026-10-31. Rama: `feature/h02-h03-user-coordinations-permissions`.
Base: `2007b9ecb10ad1a68ce24e2f5d2288dc0d6fef5c`, mas cambios locales de esta fase.
Autorizacion: diagnostico instrumentado y correccion antes de repetir capacidad.
Estado: **correccion local validada; capacidad completa pendiente; H24 NO-GO**.

## 1. Causa y evidencia anterior

El ensayo end-to-end previo completo 5/10 archivos con una sesion y 5/20 con dos.
La UI lanzaba dos operaciones por panel y la API admitia dos por proceso; cada
analizador solo aceptaba una y rechazaba inmediatamente la concurrente con 429.
El cliente cloud convertia cualquier respuesta no 200 en indisponibilidad 503.
Los 429 de admision API y los 503 derivados del analizador son causas distintas.
La integridad preservada no demostraba capacidad; no se modifica esa evidencia.

## 2. Correccion

- `server.mjs`: maximo dos cuerpos admitidos, un analisis activo y una espera de
  cuerpo completo por instancia, hasta 20 s. Recepcion conserva limite 7.5 MiB y
  timeout 15 s. Un tercer request o espera expirada retorna 429; desconexion
  retira el pendiente sin analizar. Liberacion idempotente incluso ante error.
- Protocolo BUSY: requestId correlacionado, Retry-After 2. API solo reconoce ese
  envelope limitado a 1024 bytes; 429 malformado sigue siendo 503. Sin retry oculto.
- Constancias y adicionales propagan 429/Retry-After, incluso en lectura; nunca
  devuelven bytes ni publican un archivo sin veredictos positivos completos.
- UI: seleccion multiple conservada, una transferencia por panel. Estados retry
  o uncertain pausan pendientes hasta reintento explicito del mismo operationId
  y payload. Rechazo definitivo 422 no bloquea otros archivos validos.
- Operaciones adicionales ya PREPARED conservan la recuperacion existente; no
  se agrega una cola durable, worker nuevo ni equivalencia de idempotencia con
  constancias. No se incrementan procesos ClamAV, MaxFiles, memoria ni deadlines.
- Instrumentacion: eventos de admision con modo, tipo, resultado, motivo y
  espera. No nombres, contenido, hashes, request IDs, tokens ni datos personales.

Archivos funcionales: servidor de seguridad, cliente/validador documental API,
rutas teachers/teacher-dossier y useDossierOperations. Pruebas de esos contratos
y probe Docker aislado. Sin SQL, dependencias, formulas ni permisos modificados.

## 3. Diagnostico comparativo Docker sin BD

Probe reproducible: `tools/validation/h24-pd07-b04/probe.mjs`.
PDF sintetico de una pagina; volumen privado de firmas copiado desde el original
de solo lectura. Loopback, recursos limitados y limpieza por nombre/label.
No se ejecuta el harness completo API/BD ni se presenta como repeticion de capacidad.

| Caso | Baseline | Candidato local |
|---|---|---|
| Dos parser simultaneos | 200 / 429 | 200 / 200, codigo 0 |
| Dos AV simultaneos | 200 / 429 | 200 / 200, codigo 0 |
| Dos clientes, dos validaciones completas cada uno | Uno completo; otro indisponible | Ambos completos |
| Tiempo de clientes completos | 18.356 s para uno | 26.732 s / 35.573 s |
| Reintentos automaticos | Ninguno | Ninguno |

Baseline: `f3e3fa06-73d6-486b-8053-cce6923e5a16`. Reprodujo el fallo esperado;
salida del harness 1 por un problema de recoleccion final (`ps` ausente en
inspector), no por falta de reproduccion. Scanner/volumen fueron retirados;
inspector se retiro manualmente tras verificar su label. Se preservo evidencia
del fallo y se corrigio el recolector para que no interrumpa limpieza.

Candidato: `35779fbb-953b-40a9-87d7-b6c35ddc7d53`, exit 0, 12 requests internos
200 y seis analisis AV reales sin replay. Primer par AV frio: 13.406/22.146 s;
parser: 202/307 ms. Duracion registrada 67.185 s, antes de limpieza.

Imagenes locales candidatas:
- Scanner: `sha256:a84b9980bc75f869b49ca955fbc92fe41724254f75f7efb87dadac6bba2ae78f`.
- Inspector: `sha256:5c7299d2f6c34f0b06774c37d76dbfbbea64c3877df0ccb09f9b7f6b87f514bd`.

Memoria pico scanner 1228701696 bytes, inspector 191385600 bytes; cero OOM.
PIDs observados con recolector: 14/13, limite 64. No es serie temporal de carga.
Contenedores y volumen privado retirados; firmas originales conservadas.
Evidencia temporal ignorada: `.cache/pd07-b04/`, carpetas baseline/candidate con
los UUID anteriores. No publicar archivos privados ni asumir disponibilidad futura
de esa cache como sustituto del acta versionada.

## 4. Regresion

| Validacion | Resultado |
|---|---|
| npm run test:api | 407 PASS, 21 SKIP; 26 archivos PASS, 2 SKIP |
| npm run test:web | 169 PASS, 23 archivos |
| npm run typecheck | OK |
| npm run build | OK API/web |
| node --test servidor + protocolo limite + ciclo de procesos | 7 PASS, 4 SKIP opt-in Docker |
| Probe Docker candidato real | PASS, exit 0 |
| git diff --check | OK; avisos de conversion LF/CRLF, sin errores de whitespace |

Los opt-in omitidos no se cuentan como aprobados. No se ejecuto integracion
PostgreSQL ni carga completa. Tests nuevos cubren espera acotada, tercer request,
error de analizador, expiracion, desconexion, liberacion, BUSY correlacionado,
429 invalido fail-closed, ambas rutas sin publicacion/borrado, lectura bloqueada,
PREPARED recuperable, lote serial, pausa 429/503 y continuidad tras rechazo 422.

## 5. Pendientes y limites

Repetir despues la capacidad end-to-end con API, BD efimera y almacenamiento de
prueba segun autorizacion correspondiente. Debe representar una transferencia
por panel y medir por separado sobrecarga, 429 API, BUSY interno y 503 reales.
No ocultar rechazos mediante retries del harness. Incluir lotes grandes, dos
sesiones, recuperacion, integridad y proxy; UI real requiere su propia evidencia.

La cola es por instancia, no global entre replicas. Los servicios cloud aislados
con concurrencia 1 NO cambiaron; su scheduling requiere validacion independiente.
Deadlines existentes 40/230 s, actualizacion fria de firmas y espera pueden exceder
el presupuesto Hosting. Dos clientes con PDF simple bajo 55 s no prueban ese
presupuesto para todos los documentos. No se autoriza deploy ni se cierra PD-07.

## 6. Confirmaciones

Sin acceso a BD local/productiva, migraciones, datos reales, GCS, Firebase o cambios
cloud. Sin deploy, cambios H01, permisos, nomina, snapshots, dependencias ni relajacion
de controles PDF/AV. No se repitio capacidad completa. Cambios locales pendientes
de versionado; no se hizo commit ni push en esta fase.
