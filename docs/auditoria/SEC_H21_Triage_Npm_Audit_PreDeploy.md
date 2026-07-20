# SEC H21 - Triage npm audit previo a deploy

Fecha: 2026-07-20

Estado: `REQUIERE_ACTUALIZACION_CONTROLADA`; H21-F5 bloqueado hasta resolver
la vulnerabilidad critica en una fase SEC separada.

## 1. Alcance

Se ejecuto `npm audit --json`, `npm explain websocket-driver` y una revision
read-only de los manifiestos y lockfile. No se ejecuto `npm audit fix`, no se
uso `--force` y no se modificaron dependencias.

## 2. Hallazgo critico

| Campo | Resultado |
|---|---|
| Paquete | `websocket-driver` |
| Advisory / CVE | `GHSA-xv26-6w52-cph6` / `CVE-2026-54466` |
| Severidad | Critical, CVSS 9.2 |
| Directo o transitivo | Transitivo |
| Workspace afectado | API y web, por cadenas Firebase |
| Produccion o desarrollo | Dependencia del arbol runtime, aunque la funcionalidad vulnerable no se usa directamente |
| Ruta de dependencia | `firebase` o `firebase-admin` -> `@firebase/database(-compat)` -> `faye-websocket` -> `websocket-driver` |
| Funcionalidad que lo usa | Soporte de Firebase Realtime Database/WebSocket; el proyecto usa Firebase Auth y no contiene imports de Realtime Database |
| Version instalada | `0.7.4` |
| Version corregida | `0.7.5` |
| Breaking change esperado | Bajo: parche puntual; `faye-websocket` admite `websocket-driver >=0.5.1` |
| Explotable en este proyecto | Explotabilidad directa baja segun el uso observado, porque no se inicializa Realtime Database ni un servidor WebSocket; el paquete vulnerable permanece en runtime |
| Decision de release | `REQUIERE_ACTUALIZACION_CONTROLADA`; no autorizar H21-F5 hasta corregir y repetir pruebas completas |

El advisory describe corrupcion de mensajes por abuso de cabeceras de longitud
del protocolo WebSocket. Afecta versiones anteriores a `0.7.5`, no documenta
workaround y recomienda actualizar:

- https://github.com/advisories/GHSA-xv26-6w52-cph6
- https://github.com/advisories/GHSA-mp7j-qc5w-4988

## 3. Evidencia npm

Resumen de `npm audit --json`:

- 1 low;
- 10 moderate;
- 4 high;
- 1 critical;
- 16 total.

`npm explain websocket-driver` resolvio:

```text
websocket-driver@0.7.4
faye-websocket@0.11.4
@firebase/database@1.0.20 / @firebase/database-compat@2.0.11
firebase@11.10.0 / firebase-admin@13.10.0
```

El lockfile declara `faye-websocket` con rango
`websocket-driver >=0.5.1`, por lo que `0.7.5` es compatible con ese contrato.
La remediacion no se aplica en esta fase porque requiere cambio controlado de
lockfile, instalacion reproducible y regresion API/web/integracion.

## 4. Recomendacion SEC separada

1. Crear commit independiente de seguridad.
2. Actualizar exclusivamente la resolucion transitiva a `websocket-driver
   0.7.5`, sin `--force` y sin cambios mayores.
3. Confirmar el diff de `package-lock.json` y que no cambien paquetes no
   relacionados.
4. Ejecutar `npm run test:api`, `npm run test:web`,
   `npm run test:api:integration`, `npm run typecheck` y `npm run build`.
5. Repetir `npm audit --json` y confirmar la eliminacion del hallazgo critico.
6. Solo entonces reabrir la decision de H21-F5.

## 5. Confirmaciones

- No se modificaron `package.json` ni `package-lock.json`.
- No se instalaron ni actualizaron dependencias.
- No se ejecuto `npm audit fix`.
- No se uso `--force`.
- No se hizo deploy.
- No se ejecuto migracion productiva.
- No se modifico H01.
