# H24 PD-07: laboratorio integrado local

Harness opt-in, exclusivamente para un laboratorio desechable autorizado.
No es un script de despliegue ni una prueba contra la BD habitual.

## Alcance

- Rutas y servicios API actuales por HTTP real, PostgreSQL efimero y archivos locales.
- Inspector y scanner Docker reales, sin cambiar sus limites.
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
120 minutos y watchdog de 15 minutos por caso. Los reintentos asistidos son
maximo dos por archivo, separados diez segundos y dentro del mismo cupo.
Los resultados iniciales no se sustituyen por el resultado de los reintentos.

Los cuerpos lentos se generan directamente con HTTP y se reportan aparte
del contador del helper. Un intento interrumpido no produce evidencia final
de integridad; preservar su log y no inferir PASS de un exit distinto de cero.

## Validacion sin ejecutar carga

```powershell
node --check tools/validation/h24-pd07-e2e/run.mjs
node --check tools/validation/h24-pd07-e2e/bootstrap.mjs
node node_modules/typescript/bin/tsc -p tools/validation/h24-pd07-e2e/tsconfig.json
```

Un fallo de capacidad se documenta; no autoriza cambios en API, frontend,
politicas antivirus, H01, dependencias o infraestructura cloud.
