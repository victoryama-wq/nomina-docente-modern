# SEC H21 - Correccion de websocket-driver

Fecha: 2026-07-20

Estado: vulnerabilidad critica corregida y regresion aprobada; sin deploy.

## 1. Objetivo

Corregir exclusivamente `GHSA-xv26-6w52-cph6` mediante la version parcheada
de `websocket-driver`, sin actualizar Firebase, Firebase Admin ni paquetes no
relacionados.

## 2. Cadena transitiva

Antes de la correccion, `npm explain websocket-driver` mostro una sola
resolucion `0.7.4` usada por:

```text
firebase@11.10.0 / firebase-admin@13.10.0
  -> @firebase/database / @firebase/database-compat
  -> faye-websocket@0.11.4
  -> websocket-driver@0.7.4
```

`faye-websocket@0.11.4` declara `websocket-driver >=0.5.1`, por lo que la
version parcheada `0.7.5` satisface el contrato transitivo existente.

## 3. Estrategia aplicada

Se eligio actualizar solo la resolucion transitiva del lockfile:

```text
npm update websocket-driver --package-lock-only --ignore-scripts
npm install --ignore-scripts
```

No se agrego `websocket-driver` como dependencia directa y no fue necesario
usar `overrides`. Esta estrategia conserva la resolucion reproducible mediante
`package-lock.json` y evita alterar los manifiestos de los workspaces.

## 4. Diff de dependencias

El unico cambio de dependencias fue el bloque de `websocket-driver` en
`package-lock.json`:

| Campo | Antes | Despues |
|---|---|---|
| version | `0.7.4` | `0.7.5` |
| resolved | paquete npm `0.7.4` | paquete npm `0.7.5` |
| integrity | hash de `0.7.4` | hash de `0.7.5` |

El diff fue de tres lineas sustituidas. No cambiaron `package.json`,
`apps/api/package.json` ni `apps/web/package.json`. Se conservaron:

- `firebase@11.10.0`;
- `firebase-admin@13.10.0`;
- `faye-websocket@0.11.4`;
- el resto del arbol sin actualizaciones no relacionadas.

## 5. Validacion de seguridad

Resultados posteriores:

| Validacion | Resultado |
|---|---|
| `npm explain websocket-driver` | unica resolucion `0.7.5` |
| `npm ls websocket-driver --all` | unica resolucion `0.7.5` |
| `npm audit --json` critical | `0` |
| `GHSA-xv26-6w52-cph6` | ausente |
| Vulnerabilidades restantes | 1 low, 10 moderate, 4 high; 15 total |

Las vulnerabilidades restantes no se corrigieron automaticamente y conservan
su seguimiento independiente. No se ejecuto `npm audit fix` ni se uso
`--force`.

## 6. Regresion

| Validacion | Resultado |
|---|---|
| `npm run test:api` | 22/22, 5 archivos |
| `npm run test:web` | 61/61, 14 archivos |
| `npm run test:api:integration` | 79/79, 11 archivos; solo `nomina_docente_test` |
| `npm run typecheck` | API y web OK |
| `npm run build` | API y web OK |
| `git diff --check` | OK |

## 7. Impacto en H21

El bloqueo SEC por vulnerabilidad critica queda resuelto. H21-F5 no queda
autorizado automaticamente: permanece bloqueado por las diez filas del preview
de asignaturas, correspondientes a cinco colisiones normalizadas que requieren
decision humana y un nuevo preview sin bloqueantes no aprobados.

## 8. Confirmaciones

- Sin cambios de codigo funcional.
- Sin cambios SQL.
- Sin migraciones.
- Sin modificacion de base de datos.
- Sin deploy.
- Sin cambios H01.
- Sin `npm audit fix`.
- Sin `--force`.
