# SEC H21 - Triage npm audit previo a deploy

Fecha: 2026-07-20

Estado: triage historico atendido por SEC-H21; vulnerabilidad critica corregida
con `websocket-driver@0.7.5` y regresion completa aprobada el 2026-07-20.

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
La remediacion no se aplico durante este triage inicial. Posteriormente se
completo en la fase SEC-H21 documentada en
`docs/auditoria/SEC_H21_Correccion_Websocket_Driver.md`.

## 4. Resolucion SEC-H21

1. Se actualizo exclusivamente la resolucion transitiva a
   `websocket-driver@0.7.5`.
2. El unico diff de dependencias fue `package-lock.json`: version, URL e
   integrity del paquete corregido.
3. `firebase@11.10.0` y `firebase-admin@13.10.0` permanecieron sin cambio.
4. `npm audit --json` quedo en 0 critical y 15 vulnerabilidades no criticas.
5. API, web, integracion, typecheck y build aprobaron la regresion.
6. H21-F5 permanece bloqueado solo por las colisiones del preview
   institucional, no por este advisory.

## 5. Confirmaciones

- No se modifico ningun `package.json`.
- `package-lock.json` cambio unicamente para resolver
  `websocket-driver@0.7.5`.
- No se ejecuto `npm audit fix`.
- No se uso `--force`.
- No se hizo deploy.
- No se ejecuto migracion productiva.
- No se modifico H01.
