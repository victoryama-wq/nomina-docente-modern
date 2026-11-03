# H24 PD-07: laboratorio integrado local

Harness opt-in, exclusivamente para un laboratorio desechable autorizado.
No es un script de despliegue ni una prueba contra la BD habitual.

Repeticion autorizada 2026-11-03 despues de B04: ejecutar el recorrido completo
sin H24_PD07_FOLLOWUP. El lote ahora representa una transferencia por panel y dos
clientes independientes, con diez PDF por cliente de tamano pequeno/1/4/7.5 MiB.
Se pausa ese cliente ante el primer fallo; no hay recuperacion asistida oculta.
Se exigen 30/30 completos al primer intento y menos de 55 s por carga del lote.
El resultado global invalido tambien hace fallar Vitest. Se registran por separado
HTTP/API, transporte HTTP de analizadores y sus veredictos, sin cuerpos/tokens.
Esto no acredita por si solo el limite Hosting para todo archivo o arranque frio.

## Alcance

- Rutas y servicios API actuales por HTTP real, PostgreSQL efimero y archivos locales.
- Inspector y scanner Docker reales; limites de archivo/proceso conservados,
  espera acotada de 30 s segun la correccion local de capacidad.
- Auth con actores sinteticos de test; identidad entre servicios inyectada solo
  en el harness. No acredita Firebase Auth, IAM, GCS ni Hosting.
- La imagen API runtime se construye, pero los casos HTTP se ejecutan desde
  la imagen de regresion con Vitest y adaptadores locales. No son smoke del
  comando runtime productivo ni pruebas de navegador.
- La constancia usa un adaptador local de archivos; adicionales usan
  LocalDossierStorage. No se simulan generaciones GCS como evidencia cloud.

## Requisitos y autorizacion

Docker desktop-linux, al menos 7.5 GiB / 4 CPU, puerto loopback 58328 libre,
imagen local `nomina-regression:h24-pd06-local-20261029`, `postgres:18` local
y volumen previo de firmas `h24-pd03-signatures-20261028`.
El lockfile de la imagen base debe coincidir con el del checkout.

Las firmas originales solo se montan read-only para copiarlas. El scanner
actualiza exclusivamente la copia y necesita salida de red para freshclam.
Los builds pueden consultar registros de imagenes; no se publican imagenes.
No se montan credenciales cloud, .env ni dumps reales.

Antes de ejecutar, revisar el plan aprobado y el presupuesto acumulado de la
sesion; no repetir el comando para ocultar fallos ni reiniciar el presupuesto.

```powershell
$env:H24_PD07_APPROVED='true'
node tools/validation/h24-pd07-e2e/run.mjs
```

Opcional: `H24_PD07_REGRESSION=true` ejecuta la suite PostgreSQL completa solo
si capacidad termina aprobada. Usa OTRO contenedor propio/efimero, sin puertos
publicados, con tmpfs de datos de 2 GiB y memoria de 3 GiB: el reset repetido de
public genera WAL y no cabe en los 256 MiB del ensayo de capacidad. No se elevan
los limites usados para aprobar capacidad. Son datasets sinteticos separados.
Resultados bajo `regression-<uuid>/` junto al manifest de capacidad.

Para repetir solo regresion despues de un fallo del laboratorio, sin repetir
carga ni ocultar el fallo anterior:

```powershell
$env:H24_PD07_APPROVED='true'
node tools/validation/h24-pd07-e2e/regression.mjs .cache/pd07-e2e/<uuid>/manifest.json
```

Requiere capacidad aprobada, imagen local inmutable y hashes vigentes iguales
al manifest. No admite una URL/BD externa ni usa credenciales cloud. Guarda
el intento anterior y limpia solo contenedores propios con etiqueta verificada.

Un 202 pendiente detiene el cliente del harness como criterio estricto de
capacidad sin asistencia; esto no representa todos los estados del navegador.
El proxy fuerza 61 s adicionales de demora para probar su corte a 60 s incluso
cuando una carga inmediata reutiliza su analisis dentro de la misma solicitud.

`H24_PD07_FOLLOWUP=true` es la reanudacion especifica del ensayo 2026-10-31:
omite serial/permisos y proxy, prepara una constancia sintetica inicial y
limita el helper a 43 envios. Sumados a los dos cuerpos lentos y los 15 envios
del intento interrumpido, el total de la sesion queda en 60.
No significa que los casos omitidos hayan pasado en esa ejecucion.

## Guardas y evidencia

Se crea un nuevo contenedor PostgreSQL sin volumen de datos compartido, con
DB exacta `nomina_docente_test`, tmpfs y puerto publicado solo en 127.0.0.1.
Bootstrap exige BD vacia: aplica el esquema anterior, fixtures sinteticos,
baseline H05 de 18 entradas y aplica 016/017. No ejecutar bootstrap fuera
del contenedor dedicado. No usa `test:db:prepare` sobre una BD existente.

El orquestador retira solo contenedores/volumen propios con etiqueta comprobada
en `finally`. Conserva imagenes locales y evidencia ignorada en
`.cache/pd07-e2e/<uuid>/`: manifest, builds, H05, dump sintetico, corpus,
resultados, metricas, estados, logs y comprobacion de limpieza.

Limites: 60 POST/PUT (58 por helper + dos cuerpos lentos; en followup 43 + dos),
300 analisis AV, 1500 requests,
120 minutos y watchdog de 15 minutos por caso. Los lotes B04 no reintentan.
El replay explicito del escenario proxy conserva su operationId y cuenta
dentro del cupo; no sustituye el resultado inicial 504.

Los cuerpos lentos se generan directamente con HTTP y se reportan aparte
del contador del helper. Un intento interrumpido no produce evidencia final
de integridad; preservar su log y no inferir PASS de un exit distinto de cero.

## Validacion sin ejecutar carga

```powershell
node --check tools/validation/h24-pd07-e2e/run.mjs
node --check tools/validation/h24-pd07-e2e/bootstrap.mjs
node node_modules/typescript/bin/tsc -p tools/validation/h24-pd07-e2e/tsconfig.json
```

Un fallo de capacidad se documenta, no se oculta relajando limites. El usuario
autorizo diagnostico y correcciones locales el 2026-11-03; H01, datos reales y
produccion permanecen fuera del alcance. Cambiar una dependencia o artefacto
requiere nueva regresion, no reutilizar la evidencia del anterior como aprobacion.
