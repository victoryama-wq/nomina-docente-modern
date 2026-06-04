# H17 - Mapping de normalizacion `created_by` en Directorio

Fecha: 2026-06-04

## 1. Contexto

H17 diagnostico que `teachers.created_by` esta `NULL` en 209 de 212 docentes.
El sistema usa `teachers.created_by` como fuente tecnica de capturador para
autorizar la edicion operativa de Directorio.

Regla funcional vigente:

- Coordinador/coordinadora edita solo docentes capturados por el/ella.
- No basta con estar en la coordinacion.
- Coordinador/coordinadora no edita datos fiscales.

Este documento prepara un mapping read-only para normalizar `created_by` en una
ventana futura. No ejecuta cambios de datos.

## 2. Alcance

Alcance de esta revision:

- Consultas `SELECT` contra produccion en transaccion `BEGIN READ ONLY`.
- Agregados por usuario/coordinacion.
- Sin listar docentes.
- Sin exponer RFC, banco, correo fiscal, constancias ni documentos.
- Sin `UPDATE`, `DELETE`, `INSERT`, migraciones ni deploy.

Conexion validada:

| Campo | Resultado |
|---|---|
| Base | `nomina_docente` |
| Usuario DB | `app_nomina` |
| Modo | `BEGIN READ ONLY` + `ROLLBACK` |

## 3. Coordinadores activos detectados

Se detectaron 13 usuarios activos con rol `coordinador`.

| Email | Nombre | Coordinacion asignada primaria |
|---|---|---|
| `cristhian.alvarado@tecplayacar.edu.mx` | Cristhian Alvarado | Cristhian Alvarado |
| `eslivet.aguilar@tecplayacar.edu.mx` | Eslivet Aguilar Santos | Eslivet Aguilar Santos |
| `jesus.aguilar@tecplayacar.edu.mx` | Jesus Aguilar | Jesus Aguilar |
| `josue.delgado@tecplayacar.edu.mx` | Josue Delgado | Josue Delgado |
| `leonardo.sayas@tecplayacar.edu.mx` | Leonardo Sayas | Leonardo Sayas |
| `lidia.medina@tecplayacar.edu.mx` | Lidia Medina | Lidia Medina |
| `maricarmen.martinez@tecplayacar.edu.mx` | Maricarmen Martínez Martínez | Maricarmen Martínez Martínez |
| `mario.medina@tecplayacar.edu.mx` | Mario Manuel Medina Ake | Mario Manuel Medina Ake |
| `merit.bazan@tecplayacar.edu.mx` | Merit Berenice Bazan Garcia | Merit Berenice Bazan Garcia |
| `oriana.nah@tecplayacar.edu.mx` | Oriana Nah Rosado | Oriana Nah Rosado |
| `roxana.landero@tecplayacar.edu.mx` | Roxana Landero Ramirez | Roxana Landero Ramirez |
| `noreply@tecplayacar.edu.mx` | Usarip prueba coordinador | Usarip prueba coordinador |
| `zulma.martinez@tecplayacar.edu.mx` | Zulma Martinez Duque | Zulma Martinez Duque |

Observacion: Mario Manuel Medina Ake tiene dos coordinaciones asignadas en
`user_coordinations`: `Mario Manuel Medina Ake` como primaria y `Mario Manuel
Medina Aké` como secundaria.

## 4. Docentes sin `created_by` por coordinacion

Total pendiente: 209 docentes.

| coordination_id | coordination_name | teachers_without_created_by |
|---|---|---:|
| `62e685f3-c92a-411f-bf86-48c540f5ae21` | Cristhian Alvarado Valencia | 1 |
| `b67c9bce-c1b1-43bd-abeb-9ca8b1ff79ea` | Elsa Garcia Vallejo | 15 |
| `444f60ec-e89a-484b-a628-ddcd5d70e246` | Eslivet Aguilar Santos | 39 |
| `2583793d-b20a-439c-b3f9-46f7d58bea91` | Josue Delgado | 11 |
| `60d7cf93-7298-455c-a771-4561ebde7645` | Lidia Medina | 12 |
| `db24459f-34df-4fe0-86c8-19ea41fb4ff8` | Maricarmen Martínez Martínez | 26 |
| `df832a2a-bd60-4bc9-b4f6-c4632778fc92` | Maricarmen Martínez Martínez/Eslivet Aguilar Santos | 5 |
| `2737085d-f312-4d40-a4e4-7ccee339b50e` | Maricarmen Martínez Martínez/Eslivet Aguilar Santos/Elsa García Vallejo | 1 |
| `02f2dd38-5e97-48ca-991d-c8f33c928ce5` | Maricarmen Martínez Martínez/Lidia Medina | 1 |
| `b7fbd778-dff3-4fca-b81d-2b8a0581dc85` | Mario Manuel Medina Aké | 1 |
| `e8aaaa99-ab9c-40eb-b7d3-fbd6d74006ff` | Mario Medina | 2 |
| `48e41353-7d8a-4784-b5b1-91c92bd539cd` | Merit Berenice Bazan Garcia | 8 |
| `2175ade9-8f38-446f-965e-cfa5b8743f89` | Oriana Nah Rosado | 37 |
| `6d3886a0-b161-4766-9831-41aa06e8ef07` | Simulación Clinica | 2 |
| `c0075dbd-26bc-4e5f-acc6-6e21e0ddcf20` | Zulma Martinez Duque | 30 |
| `df81caf0-9a8c-4af5-9409-f095529c9cdf` | Zulma Martinez Duque/Eslivet Aguilar Santos | 7 |
| `83aa8250-00a8-4f58-8d43-ba3d55ab25cb` | Zulma Martinez Duque/Eslivet Aguilar Santos/Lidia Medina | 2 |
| `daa13687-d2c2-42eb-8042-e7011ba20678` | Zulma Martinez Duque/Eslivet Aguilar Santos/Oriana Nah Rosado | 1 |
| `1b0116fc-37db-4a7f-82c6-b99de45fe57e` | Zulma Martinez Duque/Maricarmen Martínez Martínez | 3 |
| `NULL` | Sin coordinacion | 5 |

## 5. Mapping propuesto

Estados usados:

- `APROBABLE_1A1`: una coordinacion con un coordinador activo exacto.
- `EXCEPCION_MARICARMEN_A_MERIT`: decision funcional indicada por usuario;
  requiere aprobacion explicita.
- `REQUIERE_DECISION_COMPARTIDA`: coordinacion compuesta sin mapping exacto en
  `user_coordinations`; requiere decision humana.
- `SIN_COORDINADOR_ACTIVO`: no hay coordinador activo exacto para esa
  coordinacion.
- `SIN_COORDINACION`: docente sin `coordination_id`.

| coordination_id | coordination_name | coordinator_email | coordinator_name | teachers_to_update | mapping_status | observacion |
|---|---|---|---|---:|---|---|
| `444f60ec-e89a-484b-a628-ddcd5d70e246` | Eslivet Aguilar Santos | `eslivet.aguilar@tecplayacar.edu.mx` | Eslivet Aguilar Santos | 39 | `APROBABLE_1A1` | Mapping exacto por `user_coordinations`. |
| `2583793d-b20a-439c-b3f9-46f7d58bea91` | Josue Delgado | `josue.delgado@tecplayacar.edu.mx` | Josue Delgado | 11 | `APROBABLE_1A1` | Mapping exacto por `user_coordinations`. |
| `60d7cf93-7298-455c-a771-4561ebde7645` | Lidia Medina | `lidia.medina@tecplayacar.edu.mx` | Lidia Medina | 12 | `APROBABLE_1A1` | Mapping exacto por `user_coordinations`. |
| `b7fbd778-dff3-4fca-b81d-2b8a0581dc85` | Mario Manuel Medina Aké | `mario.medina@tecplayacar.edu.mx` | Mario Manuel Medina Ake | 1 | `APROBABLE_1A1` | Mapping exacto por coordinacion secundaria. |
| `48e41353-7d8a-4784-b5b1-91c92bd539cd` | Merit Berenice Bazan Garcia | `merit.bazan@tecplayacar.edu.mx` | Merit Berenice Bazan Garcia | 8 | `APROBABLE_1A1` | Mapping exacto por `user_coordinations`. |
| `2175ade9-8f38-446f-965e-cfa5b8743f89` | Oriana Nah Rosado | `oriana.nah@tecplayacar.edu.mx` | Oriana Nah Rosado | 37 | `APROBABLE_1A1` | Mapping exacto por `user_coordinations`. |
| `c0075dbd-26bc-4e5f-acc6-6e21e0ddcf20` | Zulma Martinez Duque | `zulma.martinez@tecplayacar.edu.mx` | Zulma Martinez Duque | 30 | `APROBABLE_1A1` | Mapping exacto por `user_coordinations`. |
| `db24459f-34df-4fe0-86c8-19ea41fb4ff8` | Maricarmen Martínez Martínez | `merit.bazan@tecplayacar.edu.mx` | Merit Berenice Bazan Garcia | 26 | `EXCEPCION_MARICARMEN_A_MERIT` | Requiere aprobacion explicita. |
| `df832a2a-bd60-4bc9-b4f6-c4632778fc92` | Maricarmen Martínez Martínez/Eslivet Aguilar Santos | `merit.bazan@tecplayacar.edu.mx` | Merit Berenice Bazan Garcia | 5 | `EXCEPCION_MARICARMEN_A_MERIT` | Requiere aprobacion explicita; coordinacion compuesta. |
| `2737085d-f312-4d40-a4e4-7ccee339b50e` | Maricarmen Martínez Martínez/Eslivet Aguilar Santos/Elsa García Vallejo | `merit.bazan@tecplayacar.edu.mx` | Merit Berenice Bazan Garcia | 1 | `EXCEPCION_MARICARMEN_A_MERIT` | Requiere aprobacion explicita; coordinacion compuesta. |
| `02f2dd38-5e97-48ca-991d-c8f33c928ce5` | Maricarmen Martínez Martínez/Lidia Medina | `merit.bazan@tecplayacar.edu.mx` | Merit Berenice Bazan Garcia | 1 | `EXCEPCION_MARICARMEN_A_MERIT` | Requiere aprobacion explicita; coordinacion compuesta. |
| `1b0116fc-37db-4a7f-82c6-b99de45fe57e` | Zulma Martinez Duque/Maricarmen Martínez Martínez | `merit.bazan@tecplayacar.edu.mx` | Merit Berenice Bazan Garcia | 3 | `EXCEPCION_MARICARMEN_A_MERIT` | Requiere aprobacion explicita; coordinacion compuesta. |
| `df81caf0-9a8c-4af5-9409-f095529c9cdf` | Zulma Martinez Duque/Eslivet Aguilar Santos | Pendiente | Pendiente | 7 | `REQUIERE_DECISION_COMPARTIDA` | Elegir capturador correcto. |
| `83aa8250-00a8-4f58-8d43-ba3d55ab25cb` | Zulma Martinez Duque/Eslivet Aguilar Santos/Lidia Medina | Pendiente | Pendiente | 2 | `REQUIERE_DECISION_COMPARTIDA` | Elegir capturador correcto. |
| `daa13687-d2c2-42eb-8042-e7011ba20678` | Zulma Martinez Duque/Eslivet Aguilar Santos/Oriana Nah Rosado | Pendiente | Pendiente | 1 | `REQUIERE_DECISION_COMPARTIDA` | Elegir capturador correcto. |
| `62e685f3-c92a-411f-bf86-48c540f5ae21` | Cristhian Alvarado Valencia | Pendiente | Pendiente | 1 | `SIN_COORDINADOR_ACTIVO` | Existe Cristhian Alvarado activo, pero no mapping exacto a esta coordinacion. |
| `b67c9bce-c1b1-43bd-abeb-9ca8b1ff79ea` | Elsa Garcia Vallejo | Pendiente | Pendiente | 15 | `SIN_COORDINADOR_ACTIVO` | No se detecto coordinador activo exacto. |
| `e8aaaa99-ab9c-40eb-b7d3-fbd6d74006ff` | Mario Medina | Pendiente | Pendiente | 2 | `SIN_COORDINADOR_ACTIVO` | Existe Mario Manuel Medina Ake activo, pero no mapping exacto a esta coordinacion. |
| `6d3886a0-b161-4766-9831-41aa06e8ef07` | Simulación Clinica | Pendiente | Pendiente | 2 | `SIN_COORDINADOR_ACTIVO` | Requiere decision humana. |
| `NULL` | Sin coordinacion | Pendiente | Pendiente | 5 | `SIN_COORDINACION` | Requiere normalizar coordinacion antes de capturador. |

Resumen por estado:

| Estado | Docentes |
|---|---:|
| `APROBABLE_1A1` | 138 |
| `EXCEPCION_MARICARMEN_A_MERIT` | 36 |
| `REQUIERE_DECISION_COMPARTIDA` | 10 |
| `SIN_COORDINADOR_ACTIVO` | 20 |
| `SIN_COORDINACION` | 5 |
| **Total** | **209** |

## 6. Caso Maricarmen -> Merit

Hallazgo:

- Existe usuario activo `maricarmen.martinez@tecplayacar.edu.mx`.
- Existe coordinacion `Maricarmen Martínez Martínez` con 26 docentes sin
  `created_by`.
- Existen coordinaciones compuestas que contienen `Maricarmen Martínez Martínez`
  con 10 docentes adicionales sin `created_by`.
- Por decision funcional indicada por el usuario, esos docentes deben quedar
  bajo `merit.bazan@tecplayacar.edu.mx`.

Mapping propuesto:

| Alcance | Docentes | Coordinador propuesto | Estado |
|---|---:|---|---|
| Maricarmen exacto | 26 | `merit.bazan@tecplayacar.edu.mx` | Requiere aprobacion explicita |
| Maricarmen en coordinaciones compuestas | 10 | `merit.bazan@tecplayacar.edu.mx` | Requiere aprobacion explicita por cada grupo |
| **Total potencial Maricarmen -> Merit** | **36** | `merit.bazan@tecplayacar.edu.mx` | Pendiente aprobacion |

Advertencia: aunque este mapping fue indicado funcionalmente, debe aprobarse
explicitamente antes de cualquier `UPDATE`, porque reasigna propiedad tecnica de
docentes desde `NULL` hacia Merit.

## 7. Ambiguedades y pendientes

| Caso | Docentes | Observacion |
|---|---:|---|
| Coordinaciones compartidas sin Maricarmen | 10 | Requieren decision humana de capturador. |
| Coordinaciones sin coordinador activo exacto | 20 | Requieren confirmar si se deben mapear a usuario existente o corregir catalogo. |
| Docentes sin coordinacion | 5 | No se puede asignar capturador por coordinacion; requiere analisis previo. |

No se detectaron coordinaciones con mas de un coordinador activo exacto en
`user_coordinations` y docentes pendientes. Las ambiguedades provienen de
nombres compuestos o coordinaciones sin mapping exacto.

## 8. Riesgos

- Mapping incorrecto puede permitir edicion indebida en Directorio.
- Normalizar sin auditoria cambia propiedad tecnica historica.
- Coordinaciones compuestas requieren criterio humano; no deben resolverse
  automaticamente.
- El caso Maricarmen -> Merit es una excepcion funcional y debe quedar aprobado
  antes de ejecutar.
- No debe tocarse ningun campo fiscal, ni `updated_by`, ni `coordination_id`.

## 9. SQL UPDATE propuesto, NO ejecutar

Plantilla por mapping aprobado:

```sql
-- NO EJECUTAR SIN BACKUP Y APROBACION
UPDATE teachers
SET created_by = '<coordinator_user_id>'
WHERE created_by IS NULL
  AND coordination_id = '<coordination_id>';
```

Ejemplo para un mapping 1:1 aprobable:

```sql
-- NO EJECUTAR SIN BACKUP Y APROBACION
UPDATE teachers
SET created_by = '61744d7e-6f64-4bfe-82b0-d4c056aad239'
WHERE created_by IS NULL
  AND coordination_id = '444f60ec-e89a-484b-a628-ddcd5d70e246';
```

Ejemplo para la excepcion Maricarmen -> Merit:

```sql
-- NO EJECUTAR SIN BACKUP Y APROBACION EXPLICITA
UPDATE teachers
SET created_by = '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'
WHERE created_by IS NULL
  AND coordination_id = 'db24459f-34df-4fe0-86c8-19ea41fb4ff8';
```

Para coordinaciones compuestas, generar un `UPDATE` por cada grupo aprobado.

## 10. Proximo paso

1. Usuario revisa este mapping.
2. Usuario aprueba, corrige o descarta cada grupo.
3. Para grupos aprobados, preparar ejecucion controlada:
   - backup Cloud SQL;
   - script SQL final con conteos antes/despues;
   - transaccion controlada;
   - validacion por coordinadoras;
   - documento de resultado.
4. No se requiere deploy si solo se normaliza `created_by`.

## 11. Confirmaciones

- No se ejecuto `UPDATE`.
- No se ejecuto `DELETE`.
- No se ejecuto `INSERT`.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se modifico produccion.
- No se expusieron RFC, bancos, constancias, documentos fiscales ni datos de
  nomina.

