# H17 - Validacion CSV para normalizar `teachers.created_by`

Fecha: 2026-06-04

## 1. Contexto

El usuario compartio un CSV aprobado para normalizar `teachers.created_by` en
Directorio. La columna H `COORDINADOR` contiene el usuario/capturador operativo
correcto para cada docente.

La regla funcional vigente se mantiene:

- Coordinador/coordinadora edita solo docentes capturados por el/ella.
- No basta con estar en la coordinacion.
- Coordinador/coordinadora no edita datos fiscales.
- La fuente tecnica es `teachers.created_by`.

Esta fase valido el CSV y preparo una propuesta SQL en modo seguro. En una
ventana posterior aprobada, esa propuesta fue ejecutada de forma controlada
solo para el lote aprobado.

## 2. Validacion del CSV

Archivo local validado:

- `C:\Users\Admin\Downloads\Hoja de cálculo sin título - Hoja 1.csv`

Columnas detectadas:

- `Docente`
- `GRADO`
- `Tipo de Pago`
- `Categoría`
- `COMENTARIO`
- `UBICACIÓN`
- `OBSERVACIÓN`
- `COORDINADOR`

Resultado:

| Metrica | Resultado |
|---|---:|
| Bytes | 19207 |
| UTF-8 valido | Si |
| BOM UTF-8 | No |
| Total filas CSV | 213 |
| Filas validas | 213 |
| Filas sin docente | 0 |
| Filas sin coordinador | 0 |
| Encabezados repetidos ignorados | 0 |
| Coordinadores unicos en columna H | 14 |
| Grupos duplicados de docente en CSV | 0 |
| Filas duplicadas por docente | 0 |

Nota: el archivo es UTF-8 valido sin BOM. La ausencia de BOM no bloquea esta
validacion porque el archivo fue leido correctamente como UTF-8 y no es un
exportable operativo final.

## 3. Conteo por coordinador en CSV

| COORDINADOR | Filas |
|---|---:|
| Cristhian Alvarado Valencia | 1 |
| Elsa Garcia Vallejo | 8 |
| Elsa García Vallejo | 7 |
| Eslivet Aguilar Santos | 47 |
| Josue Delgado | 13 |
| Lidia Medina | 13 |
| Mario Manuel Medina Aké | 1 |
| Mario Medina | 2 |
| Merit Berenice Bazan Garcia | 40 |
| Noadia Gonzales | 1 |
| Oriana Nah Rosado | 38 |
| Simulación Clinica | 2 |
| Victor Yama | 1 |
| Zulma Martinez Duque | 39 |

## 4. Mapping coordinador CSV -> `app_users`

| coordinador_csv | filas | app_user_email | app_user_display_name | match_status | observacion |
|---|---:|---|---|---|---|
| Cristhian Alvarado Valencia | 1 | Pendiente | Pendiente | `SIN_MATCH` | No se encontro app_user activo equivalente exacto. |
| Elsa Garcia Vallejo | 8 | `elsa.garcia@tecplayacar.edu.mx` | Elsa Garcia Vallejo | `MATCH_MANUAL_APROBADO` | Decision humana aprobada: Elsa con/sin acento se asigna a Elsa, aunque rol actual sea `direccion`. |
| Elsa García Vallejo | 7 | `elsa.garcia@tecplayacar.edu.mx` | Elsa Garcia Vallejo | `MATCH_MANUAL_APROBADO` | Decision humana aprobada: Elsa con/sin acento se asigna a Elsa, aunque rol actual sea `direccion`. |
| Eslivet Aguilar Santos | 47 | `eslivet.aguilar@tecplayacar.edu.mx` | Eslivet Aguilar Santos | `MATCH_EXACTO` | Rol `coordinador`. |
| Josue Delgado | 13 | `josue.delgado@tecplayacar.edu.mx` | Josue Delgado | `MATCH_EXACTO` | Rol `coordinador`. |
| Lidia Medina | 13 | `lidia.medina@tecplayacar.edu.mx` | Lidia Medina | `MATCH_EXACTO` | Rol `coordinador`. |
| Mario Manuel Medina Aké | 1 | `mario.medina@tecplayacar.edu.mx` | Mario Manuel Medina Ake | `MATCH_MANUAL_APROBADO` | Decision humana aprobada: Mario Medina y Mario Manuel Medina Aké se asignan a `mario.medina@tecplayacar.edu.mx`. |
| Mario Medina | 2 | `mario.medina@tecplayacar.edu.mx` | Mario Manuel Medina Ake | `MATCH_MANUAL_APROBADO` | Decision humana aprobada: Mario Medina y Mario Manuel Medina Aké se asignan a `mario.medina@tecplayacar.edu.mx`. |
| Merit Berenice Bazan Garcia | 40 | `merit.bazan@tecplayacar.edu.mx` | Merit Berenice Bazan Garcia | `MATCH_EXACTO` | Rol `coordinador`. |
| Noadia Gonzales | 1 | Pendiente | Pendiente | `SIN_MATCH` | No se encontro app_user activo equivalente exacto con ese texto. |
| Oriana Nah Rosado | 38 | `oriana.nah@tecplayacar.edu.mx` | Oriana Nah Rosado | `MATCH_EXACTO` | Rol `coordinador`. |
| Simulación Clinica | 2 | Pendiente | Pendiente | `SIN_MATCH` | No se encontro app_user activo equivalente. |
| Victor Yama | 1 | `victor.yama@tecplayacar.edu.mx` | Victor Yama | `MATCH_EXACTO` | Usuario activo encontrado; rol actual `admin`. |
| Zulma Martinez Duque | 39 | `zulma.martinez@tecplayacar.edu.mx` | Zulma Martinez Duque | `MATCH_EXACTO` | Rol `coordinador`. |

## 5. Caso Maricarmen -> Merit

El CSV aprobado ya refleja la decision funcional:

- No aparece `Maricarmen Martínez Martínez` como valor en la columna
  `COORDINADOR`.
- Los docentes que antes se habian identificado bajo Maricarmen quedan
  absorbidos en el grupo `Merit Berenice Bazan Garcia`.
- El usuario destino es `merit.bazan@tecplayacar.edu.mx`.

Confirmacion de decision humana:

- Maricarmen se cambia por `merit.bazan@tecplayacar.edu.mx`.
- Coordinaciones compuestas por Maricarmen quedan compuestas, pero con
  `merit.bazan@tecplayacar.edu.mx` como capturador tecnico propuesto cuando el
  CSV lo indique.

## 6. Match docente CSV -> `teachers`

Cruce realizado contra produccion con datos minimos:

- `teachers.id`
- `teachers.full_name`
- `teachers.created_by`

No se consultaron ni expusieron RFC, banco, correo fiscal, constancias,
documentos, nomina ni importes.

| estado_match_docente | conteo |
|---|---:|
| `MATCH_EXACTO` | 204 |
| `SIN_MATCH` | 9 |

No hubo duplicados de docente en CSV ni duplicados de BD detectados por la llave
normalizada usada en esta validacion.

## 7. Propuesta de normalizacion

La propuesta solo incluye filas donde:

- el docente del CSV tiene match unico en `teachers`;
- el coordinador del CSV tiene match unico en `app_users`;
- `teachers.created_by IS NULL`;
- solo se propone tocar `teachers.created_by`.

Resumen:

| estado_update | conteo |
|---|---:|
| `UPDATE_PROPUESTO` | 197 |
| `OMITIR_CREATED_BY_EXISTENTE` | 3 |
| `OMITIR_DOCENTE_SIN_MATCH` | 9 |
| `OMITIR_COORDINADOR_SIN_MATCH` | 4 |

Propuesta por usuario destino:

| coordinator_email | teachers_to_update |
|---|---:|
| `elsa.garcia@tecplayacar.edu.mx` | 14 |
| `eslivet.aguilar@tecplayacar.edu.mx` | 46 |
| `josue.delgado@tecplayacar.edu.mx` | 11 |
| `lidia.medina@tecplayacar.edu.mx` | 13 |
| `mario.medina@tecplayacar.edu.mx` | 2 |
| `merit.bazan@tecplayacar.edu.mx` | 38 |
| `oriana.nah@tecplayacar.edu.mx` | 34 |
| `zulma.martinez@tecplayacar.edu.mx` | 39 |
| **Total** | **197** |

Decision humana aplicada: `elsa.garcia@tecplayacar.edu.mx` queda aprobado como
capturador tecnico para las filas de Elsa Garcia Vallejo/Elsa García Vallejo,
aunque su rol actual sea `direccion`.

Decision humana aplicada: `mario.medina@tecplayacar.edu.mx` queda aprobado como
capturador tecnico para Mario Medina y Mario Manuel Medina Aké.

## 8. Casos omitidos

| Caso omitido | Conteo | Comentario |
|---|---:|---|
| `OMITIR_CREATED_BY_EXISTENTE` | 3 | No se tocaran docentes que ya tienen capturador tecnico. |
| `OMITIR_DOCENTE_SIN_MATCH` | 9 | Requieren revision de nombre o existencia en Directorio. |
| `OMITIR_COORDINADOR_SIN_MATCH` | 4 | Requieren mapping manual o correccion de usuario/capturador. |

Los valores de coordinador sin match fueron:

- Cristhian Alvarado Valencia.
- Noadia Gonzales.
- Simulación Clinica.

## 9. SQL propuesto y ejecucion controlada

Se genero el archivo:

- `database/validation/h17_created_by_from_csv_APPROVAL_REQUIRED.sql`

Propiedades:

- Guard de base exacta `nomina_docente`.
- Comentario `NO EJECUTAR SIN BACKUP Y APROBACION`.
- Transaccion explicita.
- Tabla temporal de mapping con 197 filas.
- `UPDATE` limitado a `teachers.created_by` y solo cuando esta `NULL`.
- Conteos antes/despues.
- `ROLLBACK` por defecto.

El archivo versionado permanece en `ROLLBACK`. Para la ejecucion productiva
aprobada se genero una copia temporal local con cierre `COMMIT`; no se modifico
el archivo versionado.

Resultado de ejecucion:

| Metrica | Resultado |
|---|---:|
| Filas actualizadas en `teachers.created_by` | 197 |
| Filas del mapping con capturador esperado | 197 |
| Filas del mapping aun `NULL` | 0 |
| Filas del mapping con capturador inesperado | 0 |
| Docentes globales aun `created_by IS NULL` | 12 |

Documento de resultado:

- `docs/auditoria/H17_Normalizacion_CreatedBy_Directorio_Resultado.md`

## 10. Confirmaciones

- Se ejecuto `UPDATE` productivo controlado solo para 197 filas aprobadas de
  `teachers.created_by`.
- No se ejecuto `DELETE`.
- No hubo `INSERT` permanente en tablas funcionales; solo se uso una tabla
  temporal de mapping en la sesion SQL.
- No se modifico produccion fuera del lote aprobado de `teachers.created_by`.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se tocaron fiscales.
- No se tocaron nomina, snapshots, finanzas, CSV productivos ni cierre de ciclo.
