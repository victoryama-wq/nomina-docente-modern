# H24 PD07-B01 - Correccion Base64 para archivos grandes

Fecha: 2026-10-30, America/Cancun.
Base Git: `00b1506`; rama `feature/h02-h03-user-coordinations-permissions`,
limpia y sincronizada segun tracking al inicio.

## 1. Alcance y resultado

Usuario autorizo corregir PD07-B01 y agregar pruebas para constancias y documentos
adicionales, sin produccion ni deploy. **PD07-B01 corregido y validado localmente
en Windows y Linux.** No equivale a cerrar PD-07 ni aprobar H24 para despliegue.
PD07-B02 (procesos del scanner), PD07-B03 (limite MaxFiles AV), capacidad completa
con artefacto final y restantes gates conservan su estado pendiente.

## 2. Causa y cambio

`decodeDossierPdf()` en `apps/api/src/lib/dossier-contract.ts` validaba toda la
cadena con una expresion regular de grupos repetidos. Archivos de 4 y 7.5 MiB
agotaban la pila V8 aunque estuvieran dentro del limite. Las pruebas nuevas,
ejecutadas antes de la correccion, reprodujeron 22 fallos de 84 casos:
RangeError en decoder, 500 en ruta constancia y 503 en documentos adicionales.
Son respuestas del harness Fastify local, no una nueva consulta productiva.

Se sustituyo el patron por longitud multiplo de cuatro y recorrido iterativo
del alfabeto Base64, admitiendo como maximo dos signos `=` finales. Se conserva
el round-trip `Buffer -> Base64` para rechazar bits de padding no canonicos.
No se normalizan ni reparan entradas incorrectas. Validacion O(n), pila O(1);
los buffers/cadenas de decodificacion siguen consumiendo memoria O(n).

Se mantienen sin cambios:

- Limite de 7,864,320 bytes (7.5 MiB) y 10,485,760 caracteres Base64.
- Contratos, nombres, MIME, guardas de acceso y admision HTTP de 12 MiB.
- Rechazo de vacios, whitespace, data URI, alfabeto URL-safe, Unicode,
  padding intermedio/excesivo, longitud incompleta y codificacion no canonica.
- Errores del decoder INVALID_PDF/422 y FILE_TOO_LARGE/413.
- Semantica preexistente de schemas: exceso de Base64 devuelve 400 en
  constancia y 413 en documentos adicionales; no se unificaron contratos.
- Validacion PDF/JPG/PNG, politica de contenido, ClamAV, almacenamiento privado,
  idempotencia, autorizacion y recuperacion. No se redujo el limite para evitar el fallo.

## 3. Regresion agregada

| Archivo | Cobertura |
|---|---|
| dossier-base64.test.ts | 34 casos: 1/2/4/7.5 MiB, padding de uno/dos bytes cerca del limite, bytes exactos, entradas no canonicas, caracter invalido al final de cadena grande y exceso |
| constancia-route.test.ts | 36 casos totales, incluidos 12 nuevos de PDF/JPG/PNG por tamano; error de codificacion grande y exceso antes de reemplazar; guardas existentes |
| dossier-large-file.test.ts | 14 casos: POST/PUT con 1/2/4/7.5 MiB, entrada invalida/exceso y denegacion del validador antes de persistir |

Se usa `app.inject()` sobre rutas reales; documentos adicionales ejecutan tambien
el servicio y decoder reales hasta la frontera de persistencia. DB/transaccion,
almacenamiento y validador son dobles de prueba, sin escrituras externas.
La transaccion simulada devuelve COMPLETE; ese 200 no acredita persistencia real.
Constancia conserva el doble de `replaceConstancia`: se verifica la entrega exacta
de bytes/MIME a esa frontera, no una carga real al bucket. Sus pruebas existentes
de reemplazo y recuperacion tambien pasan en la suite completa.

Los buffers grandes son corpus sintetico de codificacion, no PDF/imagenes
estructuralmente validos ni veredictos antivirus. Las pruebas verifican que el
validador no se omita y que sus rechazos/indisponibilidad detengan el servicio.
No se afirma un nuevo smoke con parser/ClamAV/GCS/BD reales ni con navegador.

## 4. Ejecuciones

| Validacion | Resultado |
|---|---|
| Nuevas pruebas antes del fix, Windows Node 24.14.1 | 62 pasan / 22 fallan, reproduccion controlada |
| Mismos tres archivos despues del fix, Windows | 84/84, exit 0 |
| Mismos tres archivos en Docker Linux | 84/84, exit 0 |
| npm run test:api | 379 pasan, 15 omitidas opt-in Docker, 26 archivos pasan / 1 omitido, exit 0 |
| npm run test:web | 158/158, 23 archivos, exit 0 |
| npm run typecheck | API/web OK, exit 0 |
| npm run build | API/web OK, exit 0; sin publicacion |
| git diff --check | OK |

Comando enfocado:

```text
npm --workspace apps/api run test -- src/test/dossier-base64.test.ts src/test/dossier-large-file.test.ts src/test/constancia-route.test.ts
```

Docker reutilizo `nomina-regression:h24-pd06-local-20261029`, ID
`sha256:4a41988b3091ff732a5f61dbc9086d6b9bb3ec571940b43315f83623a974a473`,
con `apps/api/src` actual montado read-only en `/app/apps/api/src`.
No se construyo ni publico imagen API final. Contenedor
`h24-pd07-b01-regression`, `--rm --pull never --network none`, 2 GiB, 2 CPU,
128 PIDs, sin capacidades, `no-new-privileges`, sin credenciales ni volumen DB.
Se retiro automaticamente; inventario por etiqueta vacio al finalizar.
Docker Desktop requirio inicio local. Sin recursos cloud.

No se ejecuto test:api:integration: esta regresion se resuelve sin BD y no
reconstruye ni utiliza nomina_docente_test. Las 15 pruebas de parser/AV Docker
opt-in no se habilitaron en esta fase; no se contabilizan como aprobadas.

## 5. Confirmaciones y siguiente paso

Un solo archivo funcional modificado: el decoder compartido. Sin cambios a
frontend, dependencias, SQL, BD local/productiva, migraciones, H01, formulas,
datos fiscales, Nomina, corridas o snapshots. Sin conexiones cloud, deploy,
commit o push en esta fase.

Atender por separado PD07-B02/B03 y repetir capacidad end-to-end con el artefacto
final. Esta correccion no acepta riesgos restantes ni modifica su politica.
**H24 conserva NO-GO.**
