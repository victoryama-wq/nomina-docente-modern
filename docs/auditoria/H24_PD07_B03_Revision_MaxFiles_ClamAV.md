# H24 PD07-B03 - Revision de MaxFiles en PDF de muchas paginas

Fecha: 2026-10-31, America/Cancun. Base: `ac1df1a`.
Rama: `feature/h02-h03-user-coordinations-permissions`, limpia al inicio.
Alcance autorizado: diagnostico, propuesta y validacion Docker local.
**No se cambia todavia la politica operativa del scanner. H24 mantiene NO-GO.**

## 1. Causa y alcance

El inspector acepta como maximo 500 paginas, pero ClamAV limita la extraccion
interna a 100 archivos por documento. Son magnitudes diferentes: una pagina
puede contener varios streams/imagenes; contar paginas no determina el trabajo
antivirus. El PDF sintetico de 500 paginas vuelve a producir
`Heuristics.Limits.Exceeded.MaxFiles`, sin evidencia de malware real.

El wrapper actual responde `H24_UNAVAILABLE`/30, nunca `H24_AV_OK`; el cliente
API lo convierte en `DOCUMENT_SECURITY_UNAVAILABLE`/503. No hay bypass ni
publicacion de un archivo que alcanzo el limite. El fallo es de coherencia de
capacidad y diagnostico operativo, no un falso veredicto limpio.

Fuente primaria: [manual clamscan de ClamAV 1.5.4](https://raw.githubusercontent.com/Cisco-Talos/clamav/clamav-1.5.4/docs/man/clamscan.1.in),
opciones max-files, max-scansize, max-scantime y alert-exceeds-max. MaxFiles
limita extracciones internas de documentos/contenedores y protege contra DoS.
Su valor por defecto no constituye una recomendacion de capacidad para H24.

## 2. Propuesta segura sometida a ensayo

Comparar 100 (actual), 1000 y 2000 (candidatos), sin desactivar alertas ni usar
valores ilimitados. Cada candidato se genera en el tmpfs del contenedor como
copia del script real, sustituyendo exclusivamente `--max-files=100`.
`tools/validation/h24-pd03/scan-stdin.sh` permanece sin cambios.

Mantener simultaneamente:

- Admision 7.5 MiB; archivo interno 8 MiB; volumen analizado 32 MiB.
- Recursion 8; tiempo de analisis ClamAV 10000 ms; timeout externo 115 s.
- Firmas oficiales, antiguedad maxima 2 dias, alertas de cifrado y limites.
- Inspector/politica PDF antes de AV, veredicto/hash exactos y rechazo seguro.
- Una evaluacion por vez; sin incrementar memoria, CPU o PIDs del scanner.

**Recomendacion final: no aprobar aun el cambio de limite operativo.**
1000 es el menor candidato ensayado que supera MaxFiles para algunas muestras
de 500 paginas, pero no una solucion integral: la repeticion puede alcanzar otra
guarda. 2000 no se justifica solo por ser mayor. Primero acordar el tratamiento
de complejidad y medir cualquier politica final de tiempo con la carga completa.
No aumentar MaxScanTime ni recursos en esta fase para forzar aceptacion.

No prometer que todo PDF de hasta 500 paginas sera aceptado. Si excede trabajo,
tamano expandido, tiempo o politica, debe permanecer bloqueado. No reintentar
automaticamente con limites mayores, dividir para omitir partes, quitar AV ni
aprobar solo porque pdfinfo/qpdf lo aceptan.

## 3. Laboratorio reproducible

Harness: `services/document-security/scanner-maxfiles-local.mjs`, opt-in
`RUN_H24_MAXFILES_LAB=true`, imagenes locales por SHA inmutable, contexto Docker
`desktop-linux`. Sin instalacion de dependencias, imagen nueva ni push/deploy.

- Scanner local B02: `sha256:87e358377b80187b3291d4140db789d4dba3329155861994725adbe16d452b39`.
- Inspector local: `sha256:5f605d55b21a613d6f5d19475285c559932136a59a4ba330f7f057562b14ecef`.
- Scanner: usuario 100:101, tini, 4 GiB, 2 CPU, 64 PIDs, root read-only,
  cap-drop ALL, no-new-privileges, tmpfs 128 MiB; sin puertos publicados.
- El inspector del harness recibe tambien 4 GiB/2 CPU; su exito solo acredita
  validez del corpus, no capacidad bajo la configuracion cloud de 512 MiB/1 CPU.
- Todos los analisis usan red `none` y firmas montadas read-only.
- Bootstrap separado: copia desechable del volumen de firmas original, montado
  solo lectura. Unicamente la copia se actualiza con freshclam contra el CDN
  oficial. La copia inicial usa root con CHOWN/DAC_OVERRIDE para permisos de
  archivos; esos privilegios no se conceden al scanner ni al inspector.
- Ningun contenedor recibe credenciales cloud, BD, documentos reales o dumps.
- PDFKit ya instalado genera corpus sintetico: 1/500 paginas de texto,
  500 con imagenes RGB diminutas unicas, 500 con streams adicionales de contenido
  y 500 con mayor complejidad interna. No equivalen a escaneos institucionales.
- EICAR se ensambla solo dentro del tmpfs, nunca se ejecuta ni se escribe en host.
- El harness elimina su contenedor/volumen por nombre UUID y etiqueta verificada.

## 4. Resultados

Ejecucion final: 12 comprobaciones de seguridad/protocolo satisfactorias,
**no 12 cargas aceptadas**. Los cinco PDF pasan el inspector. No se ejecuta
API/BD/GCS ni se publica ningun archivo: pruebas de scanner/parser, no end-to-end.
Se invocan CLI y wrappers directamente; freshclam se ejecuta separadamente.
No es una repeticion del runner HTTP ni de su actualizacion automatica.

| Caso final | MaxFiles | Resultado | Tiempo s |
|---|---:|---|---:|
| Texto 500 paginas, ClamAV directo | 100 | MaxFiles, rc 1 | 18.554 |
| Texto 500 paginas, wrapper actual | 100 | H24_UNAVAILABLE, rc 30 | 18.424 |
| Texto 500 paginas, wrapper candidato | 1000 | H24_UNAVAILABLE, rc 30 | 27.645 |
| 500 paginas con imagen por pagina, directo | 1000 | Limpio, rc 0 | 25.874 |
| 500 paginas con stream adicional, directo | 1000 | MaxScanTime, rc 1 | 27.748 |
| Texto 500 paginas, wrapper candidato | 2000 | H24_UNAVAILABLE, rc 30 | 29.158 |
| 500 paginas con imagen por pagina, wrapper | 2000 | H24_AV_OK + SHA exacto, rc 0 | 28.893 |
| 500 paginas con stream adicional, wrapper | 2000 | H24_UNAVAILABLE, rc 30 | 26.211 |
| PDF pequeno, wrapper | 2000 | H24_AV_OK + SHA exacto, rc 0 | 16.034 |
| 500 paginas / cinco streams adicionales, directo | 2000 | MaxScanTime, rc 1 | 26.551 |
| Mismo documento complejo, wrapper | 2000 | H24_UNAVAILABLE, rc 30 | 26.590 |
| EICAR sintetico, wrapper | 2000 | H24_REJECTED, rc 20 | 16.130 |

Tiempo acumulado AV: 287.812 s. Incluye carga de firmas por cada clamscan;
MaxScanTime no representa el tiempo total del proceso. El raw confirma
MaxScanTime en los casos indicados; no se atribuye automaticamente cada rc 30
del wrapper a esa causa porque su salida esta saneada y no conserva diagnostico.
El limite temporal impidio alcanzar MaxFiles=2000 en el corpus complejo: **no se
demostro el umbral exacto de 2000 extracciones**. No se declara ese tope validado
como capacidad operativa ni se desactiva el tiempo para alcanzarlo.

Scanner final: exit 0, OOMKilled=false, pico cgroup memory.peak=1,031,213,056 bytes,
cero zombis al finalizar y cero directorios h24-scan residuales. Este ensayo
secuencial no sustituye una prueba concurrente con el candidato final.
Firmas actualizadas en copia: daily 28170, main 63, bytecode 339; ClamAV 1.5.4.
Volumen original preservado read-only; al terminar no quedan contenedores ni
volumenes nuevos. Docker Desktop queda iniciado, sin servicios del laboratorio.

### Exploraciones conservadas

Un primer bootstrap fallo por permisos de copia y autopoblacion del volumen;
se retiro ese volumen. Se corrigio solo el bootstrap: volume-nocopy y
CHOWN/DAC_OVERRIDE para la copia, nunca para el analisis.
La primera pasada AV reprodujo el defecto y aprobo texto con
1000. Una expectativa incorrecta del harness esperaba que las imagenes fallaran
con 1000, pero ClamAV retorno limpio; el ensayo termino con exit 1 y queda
conservado. No fue un error del scanner.

El corpus posterior evita reutilizar bytes de imagen y agrega streams de
contenido diferentes, sin asumir que una pagina equivale a una extraccion.
Los resultados exploratorios registran limpio completo o limite ClamAV
reconocido. Una segunda pasada termino exit 1 porque el contenido adicional
alcanzo MaxScanTime, no el MaxFiles esperado. Se conserva como hallazgo real.
El harness final separa la seguridad del protocolo de la aceptacion funcional:
`bounded` permite limpio con hash exacto o indisponibilidad, nunca asume que 30
es carga exitosa. Resultados raw solo aceptan limpio sin diagnosticos o heuristica
explicita de limites; errores ajenos a esos casos siguen haciendo fallar el ensayo.

El corpus equivalente se regenera en cada pasada (PDFKit agrega metadata); los
SHA por archivo estan en cada manifest. Dentro de una pasada todos los candidatos
reciben exactamente los mismos bytes. No se presenta la variacion entre pasadas
como una comparacion sobre hashes identicos.

### Evidencia local y regresion

Directorio ignorado `.cache/pd07-b03/`, subdirectorios:

- `c4c946c3-e780-49b0-b787-6a88c6c38577`: bootstrap fallido y cleanup.
- `a0ab4a79-d62b-4f7a-aba9-4c0a7d1c1a70`: expectativa incorrecta de MaxFiles.
- `b5f133ce-9325-4ed2-8a53-cd4355ea5026`: descubrimiento de MaxScanTime.
- `0d919333-fd57-40a8-aeb8-c8d38a4b87b2`: matriz final, scan.jsonl, manifest.json,
  freshclam.log, state.json y cleanup.json. Exit 0 del harness de seguridad.

Comandos adicionales:

- `node --check services/document-security/scanner-maxfiles-local.mjs`: OK.
- `node --test services/document-security/server.test.mjs`: 3/3.
- `npm --workspace apps/api run test -- src/test/document-security.test.ts src/test/document-cloud.test.ts`: 51/51, mocks sin BD/cloud.
- `git diff --check`: OK; avisos LF/CRLF de Git, sin errores de whitespace.
- Sin typecheck/build/integracion BD: solo harness independiente y documentacion;
  no cambios de aplicacion, imagen, SQL, dependencias ni politica operativa.

## 5. Mensaje operativo y alcance pendiente

Propuesta adicional, no implementada: distinguir un limite de complejidad
confirmado de una deteccion AV y de una indisponibilidad real. Un codigo estable
como `DOCUMENT_SCAN_LIMIT_EXCEEDED` permitiria informar que el analisis no pudo
completarse y pedir una version menos compleja, sin afirmar infeccion.
Requiere contrato scanner/API/UI y pruebas antes de reemplazar el 503 actual.
Solo una causa confirmada como MaxFiles/MaxScanSize debe mapearse al error
especifico de complejidad. No enviar diagnosticos internos completos al cliente.
Errores, firmas caducas, timeout o diagnosticos ambiguos deben seguir fail-closed
como indisponibilidad; la carga del host puede afectar el resultado temporal.
El wrapper es compartido por constancias PDF/JPG/PNG y documentos adicionales:
cualquier cambio operativo necesita regresion de ambos flujos, no solo PDF.

El resultado de este turno no sustituye carga end-to-end API/BD/GCS/Hosting,
ensayo con el artefacto final ni aceptacion de los restantes gates H24.
La aplicacion del candidato a los wrappers operativos y su validacion integrada
se separan de esta propuesta local. PD07-B03 no queda cerrado productivamente.

**Siguiente paso recomendado:** autorizar el error especifico de complejidad y
su mensaje, y decidir si el objetivo operativo exige aceptar documentos complejos
de 500 paginas o permite rechazarlos con explicacion. Si se exige aceptarlos,
autorizar otro ensayo de presupuesto temporal/capacidad completo antes de cambiar
MaxScanTime o MaxFiles. No dar por suficiente el aumento aislado a 1000/2000.

## 6. Confirmaciones

Sin acceso ni cambios en BD local/productiva, sin migraciones, sin produccion,
sin deploy, sin datos fiscales/personales, sin cambios H01, Nomina o snapshots.
No se modifican dependencias, permisos ni limites de los servicios cloud.
No se ejecuta npm audit fix. Sin commit/push automaticos.
