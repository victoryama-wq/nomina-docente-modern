# H19 - Validacion de 10 docentes sin match nominal

Fecha: 2026-07-09

## 1. Alcance

Se revisaron en modo read-only los 10 registros que no coincidieron por
`teachers.full_name` durante la validacion H19 anterior. La busqueda se hizo en
Cloud SQL `nomina_docente` mediante Cloud SQL Auth Proxy y transacciones de solo
lectura.

Orden de deteccion aplicado:

1. `external_identifier` exacto.
2. Correo exacto, usado solo internamente y sin mostrarlo.
3. `normalized_name` y nombre sin acentos.
4. Similitud de nombre para detectar posibles duplicados.

No se consultaron ni mostraron RFC, banco, cuenta, CLABE, `payment_type`,
constancias, nomina ni snapshots.

## 2. Resultado individual

| docente_csv | identificador_csv | responsable_csv | resultado | teacher_id_existente | nombre_bd | created_by_actual | accion_propuesta | observacion |
|---|---|---|---|---|---|---|---|---|
| BEATRIZ ADRIANA LOPEZ OSORIO | `tup-d1719` | Merit Berenice Bazan Garcia | NO_EXISTE_CONFIRMADO |  |  |  | INSERT_NUEVA_CONTRATACION | Sin match por identificador, correo, nombre normalizado ni similitud alta. |
| LUZ ENEIDA GORDON PALACIOS | `tup-d1546` | Oriana Nah Rosado | NO_EXISTE_CONFIRMADO |  |  |  | INSERT_NUEVA_CONTRATACION | Sin match por identificador, correo, nombre normalizado ni similitud alta. |
| ANDREA PRADO HIGADERA | `tup-d1752` | Leonardo Sayas | EXISTE_POR_CORREO | `49c5c5b4-c49f-462e-b904-d1bbd207a1a4` | PRADO HIGAREDA ANDREA | NULL | UPDATE_CREATED_BY_EXISTENTE | Coincidencia unica por correo; no se corrige el nombre. |
| DANIEL PEREZ SAVEDRA | `tup-d1524` | Leonardo Sayas | EXISTE_POR_CORREO | `b8ec1975-5da6-429a-a0c7-1adf6e25e8f9` | DANIEL PEREZ SAAVEDRA | `merit.bazan@tecplayacar.edu.mx` | UPDATE_CREATED_BY_EXISTENTE | Coincidencia unica por correo; se conserva el nombre de BD. |
| FELIPE UC KUYOC | `tup-d1026` | Leonardo Sayas | NO_EXISTE_CONFIRMADO |  |  |  | INSERT_NUEVA_CONTRATACION | Sin match por identificador, correo, nombre normalizado ni similitud alta. |
| JEANNIE ARANTXA BURGOS MAGAÑA | `tup-d1394` | Leonardo Sayas | EXISTE_POR_CORREO | `742ce060-f325-43b6-815a-4de1c8500005` | ARANTXA JEANNIE BURGOS MAGAÑA | NULL | UPDATE_CREATED_BY_EXISTENTE | Coincidencia unica por correo; no se corrige el orden del nombre. |
| JORGE ALBERTO GUITIERREZ TRUEBA | `tup-d1803` | Leonardo Sayas | EXISTE_POR_CORREO | `ae3d917c-4c2d-499c-b27b-5a1d325e667a` | JORGE ALBERTO GUTIERREZ TRUEBA | `merit.bazan@tecplayacar.edu.mx` | UPDATE_CREATED_BY_EXISTENTE | Coincidencia unica por correo; no se corrige el typo del CSV. |
| JOSE BEMJAMIN LUEVANO GONZALEZ | `tup-d1718` | Leonardo Sayas | EXISTE_POR_CORREO | `1bd3e2f7-a5a2-499a-97c6-60f8b74b68ee` | JOSE BENJAMIN LUEVANO GONZALEZ | `eslivet.aguilar@tecplayacar.edu.mx` | UPDATE_CREATED_BY_EXISTENTE | Coincidencia unica por correo; no se corrige el typo del CSV. |
| SHANTAL PARICIA JASSO RODRIGUEZ | `tup-d1156` | Leonardo Sayas | EXISTE_POR_CORREO | `80f219e9-f899-4476-8dd2-9aef1dafaf68` | SHANTAL PATRICIA JASSO RODRIGUEZ | `eslivet.aguilar@tecplayacar.edu.mx` | UPDATE_CREATED_BY_EXISTENTE | Coincidencia unica por correo; no se corrige el typo del CSV. |
| VICTOR GONZALEZ CARDENAS | `tup-d1034` | Leonardo Sayas | EXISTE_POR_CORREO | `b2e84d8b-e512-4e54-a960-f58be7f398f1` | VÍCTOR MANUEL GONZÁLEZ CÁRDENAS | `eslivet.aguilar@tecplayacar.edu.mx` | UPDATE_CREATED_BY_EXISTENTE | Coincidencia unica por correo; se conserva el nombre completo de BD. |

## 3. Conteo previo

| Resultado | Conteo |
|---|---:|
| Docentes existentes detectados | 7 |
| Nuevas contrataciones confirmadas | 3 |
| Ambiguos | 0 |
| Datos obligatorios insuficientes | 0 |
| Omitidos | 0 |

Los tres docentes nuevos tienen nombre, identificador institucional, estatus
`ACTIVO` valido y responsable resuelto. El esquema real permite omitir el resto
de campos porque tienen defaults seguros. No se inventan categoria, telefono,
ubicacion, correo ni datos fiscales.

## 4. Accion propuesta consolidada

| Accion | Conteo |
|---|---:|
| UPDATE `created_by` originales aprobados | 29 |
| UPDATE `created_by` existentes detectados entre los 10 | 7 |
| INSERT altas minimas | 3 |
| Total de filas operativas previstas | 39 |

Distribucion de los 36 UPDATE previstos:

| Responsable destino | Originales | Adicionales | Total UPDATE |
|---|---:|---:|---:|
| Leonardo Sayas | 14 | 7 | 21 |
| Eslivet Aguilar Santos | 5 | 0 | 5 |
| Merit Berenice Bazan Garcia | 4 | 0 | 4 |
| Oriana Nah Rosado | 3 | 0 | 3 |
| Zulma Martinez Duque | 3 | 0 | 3 |

Distribucion de las tres altas:

| Responsable destino | INSERT |
|---|---:|
| Leonardo Sayas | 1 |
| Merit Berenice Bazan Garcia | 1 |
| Oriana Nah Rosado | 1 |

## 5. SQL seguro

Se preparo:

```text
database/validation/h19_teachers_update_and_new_hires_APPROVAL_REQUIRED.sql
```

El archivo conserva el SQL H19 anterior como evidencia y agrega guardas para:

- base exacta `nomina_docente`;
- 29 candidatos originales y 7 existentes adicionales;
- `expected_current_created_by`;
- responsables destino activos;
- duplicados por identificador, nombre normalizado y hash de correo;
- conteos exactos de 36 UPDATE y 3 INSERT;
- insercion limitada a cinco campos autorizados;
- `ROLLBACK` obligatorio en el archivo versionado.

## 6. Estado

Esta validacion se documento antes de backup, preview y escritura. En este punto
no se habia ejecutado `UPDATE`, `INSERT`, `DELETE`, migracion, seed ni deploy.
