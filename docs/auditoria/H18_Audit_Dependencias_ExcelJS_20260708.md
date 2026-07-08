# H18 - Revision read-only npm audit despues de ExcelJS

Fecha: 2026-07-08

## 1. Contexto

Durante H18-F1 se instalo `exceljs` exclusivamente en el backend/API para generar exportables XLSX server-side del modulo `Reportes Operativos`.

La revision de seguridad se ejecuto en modo read-only despues de la instalacion.

No se aplicaron correcciones automaticas.
No se modificaron dependencias.
No se ejecuto deploy.
No se ejecutaron migraciones.

## 2. Comandos ejecutados

```text
npm audit
npm audit --json
npm list exceljs uuid firebase-admin @google-cloud/firestore @google-cloud/storage google-gax gaxios retry-request teeny-request protobufjs @grpc/grpc-js form-data undici vite esbuild --all
```

La salida JSON se uso solo como analisis local temporal y no se versiona.

## 3. Resultado general

`npm audit` reporto:

| Severidad | Total |
|---|---:|
| Low | 1 |
| Moderate | 10 |
| High | 4 |
| Critical | 0 |
| Total | 15 |

## 4. Paquetes afectados

| Paquete | Severidad | Ruta principal | Relacion con `exceljs` | Impacto estimado |
|---|---|---|---|---|
| `exceljs` | moderate | `apps/api -> exceljs -> uuid@8.3.2` | Si | Runtime backend H18 XLSX |
| `uuid` | moderate | `exceljs`, `google-gax`, `gaxios`, `teeny-request` | Parcial | Runtime backend/transitivo |
| `firebase-admin` | moderate | dependencia directa API | No | Runtime backend |
| `@google-cloud/firestore` | moderate | `firebase-admin -> firestore` | No | Runtime backend |
| `@google-cloud/storage` | moderate | `firebase-admin -> storage` | No | Runtime backend |
| `google-gax` | moderate | `firebase-admin -> firestore -> google-gax` | No | Runtime backend |
| `gaxios` | moderate | Google Cloud deps | No | Runtime backend |
| `retry-request` | moderate | Google Cloud deps | No | Runtime backend |
| `teeny-request` | moderate | Google Cloud deps | No | Runtime backend |
| `protobufjs` | moderate | Google Cloud / gRPC | No | Runtime backend |
| `@grpc/grpc-js` | high | Firebase/Admin/Firestore y Firebase web | No | Runtime/transitivo |
| `form-data` | high | Google Cloud deps via `retry-request` | No | Transitivo runtime |
| `undici` | high | `jsdom -> undici` | No | Dev/test |
| `vite` | high | dependencia directa web | No | Dev/build |
| `esbuild` | low | `tsx -> esbuild` | No | Dev/test |

## 5. Relacion especifica con ExcelJS

Si hay una vulnerabilidad relacionada con H18-F1:

- `exceljs@4.4.0` depende de `uuid@8.3.2`.
- `uuid < 11.1.1` aparece como vulnerabilidad `moderate`.
- `npm audit` propone resolver esa ruta con `npm audit fix --force`.
- La propuesta de `--force` instalaria `exceljs@3.4.0`.
- Eso implica downgrade/cambio mayor y se considera mas riesgoso que mantener la vulnerabilidad transitoria moderada hasta revision tecnica separada.

## 6. Comportamiento esperado de npm audit fix

No se ejecuto `npm audit fix`.

Interpretacion del reporte:

- `npm audit fix` sin `--force` podria corregir algunas dependencias transitivas compatibles, pero no resolveria todos los hallazgos.
- `npm audit fix --force` no es recomendable porque propone downgrade/cambio mayor para `exceljs`.
- Para `firebase-admin`, el reporte JSON sugiere una actualizacion mayor hacia `firebase-admin@14.1.0`, que requiere validacion tecnica separada.

## 7. Recomendacion

No mezclar esta correccion con H18-F1.

Recomendacion:

1. No ejecutar `npm audit fix --force`.
2. No hacer downgrade de `exceljs`.
3. Abrir una fase tecnica separada de seguridad/dependencias.
4. Evaluar actualizacion mayor de `firebase-admin` en rama separada.
5. Revisar si `exceljs` publica version que actualice `uuid` sin downgrade.
6. Ejecutar `npm audit fix --dry-run` solo en una fase autorizada.
7. Correr pruebas completas antes de cualquier commit de seguridad.

Estado recomendado: diferir hasta despues de H18-F1 y atender como trabajo tecnico independiente.

## 8. Confirmaciones

- No se ejecuto `npm audit fix`.
- No se ejecuto `npm audit fix --force`.
- No se modifico `package.json`.
- No se modifico `package-lock.json`.
- No se instalaron ni actualizaron dependencias.
- No se modifico codigo.
- No se hizo commit.
- No se hizo deploy.
- No se ejecutaron migraciones.
- No se toco produccion.
