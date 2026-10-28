# H24 PD-03 A3 - Controles locales PDF y ClamAV

Fecha: 2026-10-28.
Base: `9f0278e9984e6deb90f4b7f0ca03910b2a42ef5e`.
Rama: `feature/h02-h03-user-coordinations-permissions`.
Estado: **A3 implementado y probado sin BD/nube. PD-03 abierto; H24 NO-GO.**

## 1. Autorizacion y alcance

El usuario autorizo implementar controles PDF/ClamAV locales en constancias y
documentos adicionales. No autoriza A4 con escrituras en test/GCS, un adaptador
productivo, IAM, migraciones, release ni aceptacion del riesgo del visor.
Se reutilizaron las imagenes y firmas del laboratorio A1/A2. No se consulto ni
modifico ninguna BD, Firebase, GCS o recurso productivo. Los servicios locales
existentes no se reiniciaron ni se reconfiguraron. Docker ejecuto herramientas de
analisis, no la API ni trabajos de recuperacion. No hubo commit/push automaticos.

## 2. Implementacion

- `document-security.ts`: rechazo 422, indisponibilidad 503 y capacidad ocupada
  429. Mensajes publicos sin salidas crudas, rutas, tokens ni contenido. Aprobacion
  exige codigo 0, stdout exacto con SHA-256 de los mismos bytes y stderr vacio.
  No persiste veredictos en BD ni reutiliza resultados viejos.
- PDF: firma, maximo 7.5 MiB, parser real aislado, EOF, maximo 500 paginas,
  rechazo de cifrado/JavaScript detectado; despues ClamAV con firmas oficiales.
- Constancias: extension/MIME admitidos, nombre sin rutas/control, Base64 canonico;
  autorizacion antes del analisis y otra vez antes de publicar. Rechazo antes de
  staging o retiro de la version anterior. Bytes copiados para evitar mutaciones.
- JPG/PNG siguen admitidos con firma/envoltura y antivirus. **Decodificacion acotada
  y limites de pixeles pendientes:** no se declara paridad estructural completa.
- `document-admission.ts` comparte dos cargas por proceso y plazo de recepcion
  de 30 s, autenticando antes de parsear el cuerpo. El analizador admite hasta dos
  validaciones simultaneas por proceso, incluyendo lecturas.
- Documentos adicionales recuperados se revalidan antes de publicar. Rechazo
  definitivo usa ABORTING y limpia solo el candidato, conservando el anterior.
  Indisponibilidad deja PREPARED/DOSSIER_RETRY_REQUIRED, sin publicar ni borrar.
- Lecturas de ambos tipos se analizan y comprueban vigencia despues del analisis.
  Un historico rechazado no se sirve ni se borra. Es defensa local, no aprobacion
  de politica productiva retroactiva.
- Timeout, senales y exceso de salida de pdfinfo se clasifican como no disponible,
  no como documento invalido. Dos expectativas antiguas de tests se ajustaron por
  ese cambio deliberado, que evita una limpieza por fallo de infraestructura.

No cambian roles, permisos, campos fiscales, telefono/C.P./CURP, H01 ni calculos.
No hay esquema nuevo para veredictos ni cambios de SQL H05.

## 3. Aislamiento y configuracion local

Unico modo: `DOCUMENT_SECURITY_MODE=docker-local`, `DB_NAME=nomina_docente_test`,
DB_HOST loopback, Firebase H24 y NODE_ENV no productivo. Sin esas condiciones
falla cerrado, sin fallback al parser host o al antivirus omitido. **No desplegar
este codigo tal cual a Cloud Run:** no existe transporte cloud aprobado y las
cargas/lecturas fallarian con 503. Variables solo del proceso local:

| Variable | Valor del ensayo |
|---|---|
| FIREBASE_PROJECT_ID | nomina-h24-test-20261027 |
| DOCUMENT_SECURITY_PARSER_IMAGE | sha256:c885c43198cc4f38453d79c787ff8dc03902e290e14a67eea3cd6d26335412e8 |
| DOCUMENT_SECURITY_SCANNER_IMAGE | sha256:5e14fd90d6a4d35b87dcde8ce555627061904288e42fb15c28084b018afd8360 |
| DOCUMENT_SECURITY_SIGNATURE_VOLUME | h24-pd03-signatures-20261028 |

IDs inmutables, `--pull never`, contexto desktop-linux. Contenedores desechables,
sin red, puertos, credenciales, bind mounts o socket Docker; usuario no root,
rootfs read-only, cap-drop ALL, no-new-privileges, tmpfs 128 MiB, 2 CPU, 64 PID.
Parser: 512 MiB/35 s. Antivirus: 4 GiB/125 s. El host elimina el contenedor aun
si mata el CLI. La cuenta local con acceso Docker es de confianza, no un modelo cloud.

ClamAV 1.5.4, base oficial fijada por digest; firmas A1/A2 daily 28167.
official-db-only, edad maxima 2 dias, max-filesize 8M, max-scansize 32M, recursion
8, 100 archivos, max-scantime 10000 ms, timeout externo 115 s. Errores, limites,
escaneos omitidos o firmas vencidas no son limpios. Sin actualizacion automatica
de firmas desde el contenedor sin red. La operacion futura de firmas es pendiente.

Parser: base PD-01 `nomina-api:h24-pdfinfo-local`, digest
`sha256:34658533a39f07a1e20e6a6c46c4aa8dded3a4a0e19bf5c9c14aabaf85ffa36a`,
pdfinfo 22.12.0. Copia el adaptador puro compilado actual, sin inicializar servicios.
Dockerfile-specific ignore limita contexto a ese JS y wrapper (16.02 kB observados),
sin secretos, node_modules host o archivos personales. Ver instrucciones en
`tools/validation/h24-pd03/README.md`.

## 4. Entrega y vista previa

Constancias: private/no-store, nosniff, CSP sandbox/default-src none, filename
ASCII/UTF-8 escapado y exposicion de Content-Disposition sin ampliar CORS.
Frontend comprueba MIME, firma/tamano, rechaza HTML/SVG y crea Blob explicito.
Iframe de constancia agrega referrerpolicy=no-referrer.

No se agrego visor ni iframe sandbox que rompa el visor nativo. La CSP HTTP no
se hereda automaticamente al Blob. No se abrieron adversos en Brave ni se hizo
smoke visual en esta fase. Aceptacion del visor y comprobaciones de ausencia de
navegacion/peticiones externas permanecen pendientes.

## 5. Pruebas y resultados

| Comando / evidencia | Resultado |
|---|---|
| npm run test:api | 278 passed, 13 skipped; 22 archivos aprobados y 1 omitido |
| npm run test:web | 153 passed, 23 archivos |
| npm run typecheck | API/web OK |
| npm run build | API/web OK; solo build local |
| document-security.docker.test.ts con opt-in | 5/5 reales; 12.97 s de tests |
| verify-adapter.sh dentro del contenedor aislado | 4/4: limpio, EICAR, vacio, exceso de bytes; aislamiento PASS |
| git diff --check | OK |

De los 13 skipped ordinarios, 5 son Docker opt-in ejecutados y aprobados aparte;
8 son pdfinfo real del host sin ruta configurada, no declarados aprobados. El
corpus Linux nuevo acredita PDF benigno, JS inerte, cifrado, malformado y 501 paginas.

Unitarias: veredictos incompletos/hash diferente/stderr, entorno, timeout/cleanup,
nombres/extensiones/encoding, 401/403, 422/429/503, cabeceras, constancia retirada
durante lectura, historico rechazado, recuperacion PREPARED y preservacion del
anterior. SQL/storage simulados; no equivalen a integracion PostgreSQL/GCS.

EICAR solo se genero dentro de tmpfs, nunca en host, BD, GCS o navegador. Wrapper:
H24_REJECTED/20; vacio/exceso: H24_INVALID/10. Primer lanzamiento por pipeline
PowerShell anadio CR al final y termino en error pese a completar casos; repetido
via stdin de Node sin CR, termino con salida 0. Sin evadir antivirus. El ensayo
A1/A2 de EICAR embebido es historico; A3 probo el wrapper nuevo con marcador simple,
no todo el flujo HTTP con EICAR. Deteccion no acredita eficacia antimalware universal.

No se ejecuto test:api:integration: requiere escrituras propias de A4. No cambiaron
.env, credenciales, package.json o lockfile. Imagenes y volumen de firmas locales
conservados; no quedaron contenedores h24-security ni del ensayo.

## 6. Pendientes y siguiente paso

1. Autorizar A4: respaldo/restitucion de nomina_docente_test y storage H24; cargas
   multiples, reemplazos, recuperacion y lectura con este pipeline real.
2. Decodificador JPG/PNG y limites de dimensiones; revision/aprobacion antes de
   instalar una dependencia.
3. Politica/corpus Launch, XFA, adjuntos, enlaces/formularios y firmas; historicos
   y riesgo residual del visor. No se aplico CDR ni se transformaron originales.
4. PD-07: latencia de clamscan por archivo y repeticion en carga/publicacion/lectura.
   Dos scanners de hasta 4 GiB por proceso no son dimensionamiento cloud. Lecturas
   completas de storage previas al analisis requieren evaluar limites de memoria
   y transferencia; la cota del contenedor no acota la descarga en el proceso API.
5. Transporte cloud aislado, firmas/monitoreo, identidad, presupuesto, timeouts y
   backlog; no montar socket Docker en un servicio productivo.

A3 no cierra PD-03, PD-04 cloud, pendientes PD-05 u otros gates H24. Sin migracion,
BD, produccion, deploy, datos reales, cambios H01 o dependencias instaladas.
