# H19 - Validacion CSV Actualizacion Controlada de Docentes

Fecha: 2026-07-09

## 1. Contexto

H19 valida de forma controlada un CSV de Directorio Docentes para proponer, sin
ejecutar, una actualizacion limitada sobre docentes existentes.

Esta version reemplaza la validacion H19 previa porque el usuario actualizo el
archivo `docentes.csv` y pidio regenerar mapping, candidatos y SQL desde el CSV
normalizado. El SQL anterior H19 no debe usarse como base final de ejecucion.

Archivo fuente revisado:

```text
C:\Users\Admin\Downloads\docentes.csv
```

Objetivo funcional:

- Corregir `teachers.created_by` como capturador tecnico/responsable operativo
  del docente cuando exista match unico de docente y responsable.
- No crear, borrar ni reemplazar docentes.
- No tocar datos fiscales, nomina, finanzas ni snapshots.

Esta fase fue read-only respecto a base de datos: se consulto Cloud SQL solo para
cruzar nombres y usuarios; no se ejecuto `UPDATE`, `DELETE`, `INSERT`,
migracion, seed ni deploy.

## 2. Ambiente y fuente de datos

| Elemento | Valor |
|---|---|
| Rama | `feature/h02-h03-user-coordinations-permissions` |
| CSV | `C:\Users\Admin\Downloads\docentes.csv` |
| Encoding CSV | UTF-8 con BOM |
| Base consultada | Cloud SQL `nomina_docente` |
| Metodo | Cloud SQL Auth Proxy local, consultas read-only |
| Usuario DB | `app_nomina` para lectura productiva |
| Columnas fiscales exportadas para analisis | Ninguna |

Columnas no fiscales exportadas temporalmente para el cruce:

- `teachers.id`
- `teachers.full_name`
- `teachers.normalized_name`
- `teachers.external_identifier`
- `teachers.category`
- `teachers.location`
- `teachers.phone`
- `teachers.status`
- `teachers.created_by`
- correo/nombre del `created_by`
- `teachers.updated_by`
- `teachers.coordination_id`
- nombre de coordinacion
- `app_users.id`
- `app_users.email`
- `app_users.display_name`
- `app_users.legacy_username`
- `app_users.status`
- rol

No se exportaron ni usaron:

- RFC.
- Banco.
- Cuenta.
- CLABE.
- `payment_type`.
- Constancias.
- Documentos fiscales.
- Correo fiscal de `teachers.email`.

## 3. Validacion del CSV actualizado

Columnas detectadas:

| Columna |
|---|
| `responsable/creador` |
| `docente` |
| `identificador` |
| `correo` |
| `tipo_pago` |
| `categoria` |
| `telefono` |
| `ubicacion` |
| `estatus` |

Resumen:

| Metrica | Resultado |
|---|---:|
| Total filas CSV | 147 |
| Filas sin docente | 0 |
| Filas sin responsable/creador | 0 |
| Docentes duplicados en CSV | 0 |
| Responsables unicos | 6 |

Campos vacios detectados:

| Campo | Filas vacias |
|---|---:|
| `tipo_pago` | 21 |
| `categoria` | 21 |
| `telefono` | 22 |
| `ubicacion` | 22 |
| Otros campos obligatorios del cruce | 0 |

Conteo por responsable/creador:

| Responsable CSV | Filas |
|---|---:|
| Eslivet Aguilar Santos | 30 |
| Oriana Nah Rosado | 30 |
| Merit Berenice Bazan Garcia | 26 |
| Zulma Martinez Duque | 26 |
| Leonardo Sayas | 22 |
| Lidia Medina Lozano | 13 |

Comparacion contra la validacion H19 anterior versionada:

| Metrica | Validacion anterior | Regeneracion actual | Cambio |
|---|---:|---:|---|
| Total filas CSV | 147 | 147 | Sin cambio |
| Responsables unicos | 6 | 6 | Sin cambio |
| Docentes duplicados CSV | 0 | 0 | Sin cambio |
| Filas sin docente | 0 | 0 | Sin cambio |
| Filas sin responsable/creador | 0 | 0 | Sin cambio |

Los nombres de responsables ya se encuentran normalizados en el CSV actual y
resuelven como `MATCH_EXACTO`.

## 4. Mapping responsable CSV a `app_users`

Normalizacion usada:

- `trim`.
- Colapso de espacios multiples.
- Comparacion mayusculas/minusculas.
- Comparacion sin acentos.
- Remocion de prefijos como `Mtra.` y `Mtro.` si aparecen.
- Comparacion contra `display_name`, `email` y `legacy_username`.

Resultado:

| responsable_csv | filas | email | display_name | match_status | observacion |
|---|---:|---|---|---|---|
| Eslivet Aguilar Santos | 30 | `eslivet.aguilar@tecplayacar.edu.mx` | Eslivet Aguilar Santos | MATCH_EXACTO | nombre exacto |
| Oriana Nah Rosado | 30 | `oriana.nah@tecplayacar.edu.mx` | Oriana Nah Rosado | MATCH_EXACTO | nombre exacto |
| Merit Berenice Bazan Garcia | 26 | `merit.bazan@tecplayacar.edu.mx` | Merit Berenice Bazan Garcia | MATCH_EXACTO | nombre exacto |
| Zulma Martinez Duque | 26 | `zulma.martinez@tecplayacar.edu.mx` | Zulma Martinez Duque | MATCH_EXACTO | nombre exacto |
| Leonardo Sayas | 22 | `brian.sayas@tecplayacar.edu.mx` | Leonardo Sayas | MATCH_EXACTO | nombre exacto |
| Lidia Medina Lozano | 13 | `lidia.medina@tecplayacar.edu.mx` | Lidia Medina Lozano | MATCH_EXACTO | nombre exacto |

Estados de responsables:

| Estado | Conteo |
|---|---:|
| MATCH_EXACTO | 6 |
| MATCH_SIN_ACENTO | 0 |
| MATCH_NORMALIZADO | 0 |
| MATCH_MANUAL_REQUERIDO | 0 |
| COMPUESTO_REQUIERE_DECISION | 0 |
| SIN_MATCH | 0 |
| AMBIGUO | 0 |

## 5. Match de docentes CSV contra `teachers`

Cruce usado:

```text
CSV.docente -> teachers.full_name
```

Reglas:

- Match exacto normalizado.
- Match sin acentos.
- Espacios normalizados.
- Sin actualizar por posicion de fila.
- Sin crear docentes faltantes.

Resultado:

| estado_match_docente | Conteo |
|---|---:|
| MATCH_EXACTO | 133 |
| MATCH_SIN_ACENTO | 4 |
| SIN_MATCH | 10 |
| DUPLICADO_CSV | 0 |
| DUPLICADO_BD | 0 |
| AMBIGUO | 0 |

Docentes sin match exacto contra `teachers.full_name`:

| Linea CSV | Docente CSV | Responsable CSV | Observacion |
|---:|---|---|---|
| 55 | BEATRIZ ADRIANA LOPEZ OSORIO | Merit Berenice Bazan Garcia | Sin match exacto |
| 73 | LUZ ENEIDA GORDON PALACIOS | Oriana Nah Rosado | Sin match exacto |
| 74 | ANDREA PRADO HIGADERA | Leonardo Sayas | Sin match exacto |
| 77 | DANIEL PEREZ SAVEDRA | Leonardo Sayas | Posible typo; no se asume |
| 80 | FELIPE UC KUYOC | Leonardo Sayas | Posible variante; no se asume |
| 83 | JEANNIE ARANTXA BURGOS MAGAÑA | Leonardo Sayas | Posible orden distinto; no se asume |
| 84 | JORGE ALBERTO GUITIERREZ TRUEBA | Leonardo Sayas | Posible typo; no se asume |
| 85 | JOSE BEMJAMIN LUEVANO GONZALEZ | Leonardo Sayas | Posible typo; no se asume |
| 94 | SHANTAL PARICIA JASSO RODRIGUEZ | Leonardo Sayas | Posible typo; no se asume |
| 95 | VICTOR GONZALEZ CARDENAS | Leonardo Sayas | Posible variante; no se asume |

Estos 10 registros quedan omitidos. Requieren decision humana o correccion del
CSV antes de cualquier propuesta de escritura.

## 6. Esquema real de `teachers`

Campos reales relevantes detectados:

| Campo | Uso H19 |
|---|---|
| `created_by` | Campo candidato principal para capturador tecnico |
| `updated_by` | No se toca |
| `coordination_id` | No se toca |
| `phone` | Campo operativo existente, no incluido en SQL H19 |
| `location` | Campo operativo existente, no incluido en SQL H19 |
| `status` | Campo existente, no incluido en SQL H19 |
| `category` | Campo existente, no incluido en SQL H19 por impacto en horarios/reportes/nomina |
| `external_identifier` | Campo existente, no incluido en SQL H19 |
| `email` | Tratado como correo fiscal/sensible en H03, excluido |
| `payment_type` | Excluido aunque el CSV trae `tipo_pago` |
| `rfc` | Excluido |
| `bank_detail` | Excluido |

No existe un campo separado aprobado llamado `responsable_operativo` en
`teachers`. Para Directorio, la fuente tecnica vigente sigue siendo
`teachers.created_by`.

## 7. Propuesta read-only de actualizacion

Solo se propone `teachers.created_by`.

| accion_propuesta | Conteo |
|---|---:|
| UPDATE_CANDIDATO_CREATED_BY_DIFERENTE | 26 |
| UPDATE_CANDIDATO_CREATED_BY_NULL | 3 |
| OMITIR_SIN_CAMBIOS | 108 |
| OMITIR_DOCENTE_SIN_MATCH | 10 |
| OMITIR_RESPONSABLE_SIN_MATCH | 0 |
| OMITIR_RESPONSABLE_COMPUESTO | 0 |
| OMITIR_AMBIGUO | 0 |
| OMITIR_CAMPO_FISCAL_PROHIBIDO | `correo`, `tipo_pago` excluidos por regla |

Distribucion de candidatos por responsable destino:

| Responsable destino CSV | Candidatos |
|---|---:|
| Leonardo Sayas | 14 |
| Eslivet Aguilar Santos | 5 |
| Merit Berenice Bazan Garcia | 4 |
| Oriana Nah Rosado | 3 |
| Zulma Martinez Duque | 3 |
| Lidia Medina Lozano | 0 |
| **Total** | **29** |

Los 26 casos con `created_by` diferente requieren aprobacion humana explicita
porque reasignan propiedad operativa ya existente. Los 3 casos con
`created_by IS NULL` tambien requieren aprobacion y backup antes de cualquier
ejecucion.

## 8. SQL generado en modo seguro

Archivo creado:

```text
database/validation/h19_teachers_update_from_csv_APPROVAL_REQUIRED.sql
```

Propiedades:

- Comentario `NO EJECUTAR SIN BACKUP CLOUD SQL Y APROBACION HUMANA`.
- Guard de base exacta `nomina_docente`.
- Transaccion explicita.
- Tabla temporal `h19_teacher_created_by_mapping`.
- Mapea solo docentes con match unico y responsable resuelto.
- Actualiza solo `teachers.created_by`.
- Incluye `expected_current_created_by` para bloquear cambios si el propietario
  actual ya no coincide con la validacion.
- No toca `updated_by`.
- No toca `coordination_id`.
- No toca `updated_at`.
- No toca fiscales, pago, nomina ni snapshots.
- Termina en `ROLLBACK`.
- No contiene `COMMIT` operativo.

El SQL fue regenerado contra el CSV actualizado y no fue ejecutado.

Reporte nominal creado:

```text
docs/auditoria/H19_Candidatos_CreatedBy_Docentes.md
```

## 9. Decisiones humanas pendientes

Antes de cualquier ventana de escritura:

1. Aprobar o rechazar los 29 cambios candidatos de `created_by`.
2. Confirmar si se aceptan los 26 cambios donde ya existe un capturador distinto.
3. Corregir/decidir los 10 docentes sin match.
4. Definir si en otra fase se quiere revisar `phone`, `location`, `status` o
   `external_identifier`.
5. Mantener `category` fuera de esta ejecucion salvo SPEC/decision adicional,
   porque puede impactar reportes, horarios y nomina.
6. Mantener `correo` y `tipo_pago` fuera por H03: son fiscal/financiero.
7. Crear backup Cloud SQL antes de cualquier ejecucion con `COMMIT`.
8. Ejecutar primero preview con el SQL en `ROLLBACK`.

## 10. Confirmaciones

- No se ejecuto `UPDATE`.
- No se ejecuto `DELETE`.
- No se ejecuto `INSERT`.
- No se ejecuto migracion.
- No se ejecuto seed.
- No se hizo deploy.
- No se modifico base de datos productiva.
- No se modifico BD local.
- No se tocaron datos fiscales.
- No se toco RFC.
- No se toco banco, cuenta ni CLABE.
- No se toco `payment_type`.
- No se tocaron constancias.
- No se toco nomina.
- No se tocaron snapshots.
- No se toco `updated_by`.
- No se toco `coordination_id`.

## 11. Estado posterior a la aprobacion

La aprobacion humana posterior resolvio los 29 candidatos y autorizo revisar
los 10 docentes sin match nominal. El resultado fue:

- 7 docentes existentes bajo otra variante, detectados por correo unico;
- 3 nuevas contrataciones confirmadas;
- 0 ambiguos;
- 0 omitidos.

Despues de backup `1783642001652` y preview exacto en `ROLLBACK`, se ejecutaron
36 actualizaciones de `created_by` y 3 altas minimas. La evidencia final se
encuentra en:

```text
docs/auditoria/H19_Resultado_Actualizacion_y_Altas_Docentes.md
```
