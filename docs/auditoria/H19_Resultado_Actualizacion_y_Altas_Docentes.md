# H19 - Resultado de actualizacion y altas de docentes

Fecha de ejecucion: 2026-07-09 (hora local America/Cancun)

## 1. Resumen

H19 se ejecuto de forma controlada sobre Cloud SQL `nomina_docente` para:

- actualizar `teachers.created_by` en 36 docentes existentes;
- insertar 3 docentes de nueva contratacion con campos operativos minimos;
- conservar sin cambios nombres y demas datos de los 7 docentes encontrados
  bajo otra variante;
- evitar duplicados por identificador, nombre normalizado y correo.

No se ejecuto `DELETE`, migracion, seed ni deploy.

## 2. Ambiente y backup

| Elemento | Resultado |
|---|---|
| Proyecto | `nomina-docente-prod` |
| Instancia | `nomina-docente-web` |
| Base | `nomina_docente` |
| Usuario DB | `app_nomina` |
| Conexion | Cloud SQL Auth Proxy `127.0.0.1:55433` |
| Backup ID | `1783642001652` |
| Descripcion | `H19 pre teacher created_by updates and new hires 2026-07-09` |
| Inicio UTC | `2026-07-10T00:06:41.667Z` |
| Fin UTC | `2026-07-10T00:08:13.031Z` |
| Estado | `SUCCESSFUL` |

## 3. Revision read-only de los 10

La revision individual esta documentada en:

```text
docs/auditoria/H19_Validacion_10_Docentes_Nueva_Contratacion.md
```

Resultado:

| Clasificacion | Conteo | Accion |
|---|---:|---|
| Existentes por correo unico | 7 | Solo actualizar `created_by` |
| No existen confirmados | 3 | Alta minima |
| Ambiguos | 0 | Ninguno |
| Datos obligatorios insuficientes | 0 | Ninguno |
| Omitidos | 0 | Ninguno |

Los correos se utilizaron unicamente para deteccion interna de duplicados. No
se incluyeron en las nuevas altas ni en el SQL como texto legible; la guarda de
correo usa SHA-256.

## 4. Preview con ROLLBACK

Archivo versionado:

```text
database/validation/h19_teachers_update_and_new_hires_APPROVAL_REQUIRED.sql
```

Resultado exacto del preview:

| Operacion simulada | Conteo |
|---|---:|
| UPDATE originales H19 | 29 |
| UPDATE existentes detectados entre los 10 | 7 |
| UPDATE total | 36 |
| INSERT altas minimas | 3 |

El preview valido responsables activos, estado esperado de `created_by`,
ausencia de duplicados y conteos exactos. Finalizo en `ROLLBACK`.

## 5. Ejecucion controlada

Se genero una copia temporal fuera del repositorio. La unica diferencia
confirmada contra el SQL versionado fue:

```text
ROLLBACK; -> COMMIT;
```

Resultado:

| Operacion | Filas |
|---|---:|
| UPDATE `teachers.created_by` | 36 |
| INSERT `teachers` | 3 |
| DELETE | 0 |

Distribucion de UPDATE:

| Responsable destino | Originales | Adicionales | Total |
|---|---:|---:|---:|
| Leonardo Sayas | 14 | 7 | 21 |
| Eslivet Aguilar Santos | 5 | 0 | 5 |
| Merit Berenice Bazan Garcia | 4 | 0 | 4 |
| Oriana Nah Rosado | 3 | 0 | 3 |
| Zulma Martinez Duque | 3 | 0 | 3 |

Distribucion de INSERT:

| Responsable destino | Altas |
|---|---:|
| Leonardo Sayas | 1 |
| Merit Berenice Bazan Garcia | 1 |
| Oriana Nah Rosado | 1 |

## 6. Validacion posterior

Consultas read-only confirmaron:

- 29/29 candidatos originales con `created_by` esperado;
- 7/7 docentes existentes adicionales con `created_by` esperado;
- 0 discrepancias;
- los 3 casos originales con `created_by IS NULL` ya tienen creador;
- 3/3 nuevas contrataciones presentes una sola vez;
- 0 nombres normalizados duplicados;
- 0 identificadores externos duplicados.

En las tres altas se confirmo:

- `status = ACTIVO`;
- `payment_type`, categoria, ubicacion, telefono, correo, RFC y banco vacios;
- `updated_by IS NULL`;
- `coordination_id IS NULL`;
- creador igual al responsable aprobado.

Los siete docentes encontrados conservaron su nombre y sus datos existentes;
el SQL aplicado solo hizo `SET created_by`.

## 7. Campos fuera de alcance

El SQL no contiene operaciones sobre:

- RFC, banco, cuenta o CLABE;
- `payment_type` o tipo de pago;
- correo de `teachers`;
- constancias o documentos fiscales;
- `updated_by`, `updated_at` o `coordination_id`;
- categoria, telefono o ubicacion;
- horarios, incidencias o extras;
- nomina, `payroll_lines` o snapshots.

## 8. Estado final

H19 queda ejecutado y documentado. El archivo SQL versionado conserva
`ROLLBACK` y el SQL H19 anterior permanece como evidencia historica de los 29
candidatos originales.

Confirmaciones:

- No se ejecuto `DELETE`.
- No se ejecutaron migraciones ni `db:migrate`.
- No se ejecutaron seeds.
- No se hizo deploy.
- No se tocaron datos fiscales.
- No se modificaron nomina ni snapshots.
- No se crearon duplicados.
