# H21 - Revision de colisiones normalizadas de Asignaturas

Fecha: 2026-07-20

Estado: diagnostico productivo read-only completado; decisiones humanas
pendientes; sin escrituras.

## 1. Objetivo y fuente

Se revisaron los cinco grupos detectados por el preview H21 al normalizar
acentos, mayusculas, puntuacion y espacios. La consulta se ejecuto contra
`nomina_docente` mediante Cloud SQL Auth Proxy con:

- usuario aplicativo `app_nomina`;
- `default_transaction_read_only=on`;
- transaccion confirmada con `transaction_read_only=on`;
- sin DDL, DML, funciones temporales ni migraciones.

Produccion conserva el esquema 001-012. Por ello `subjects` aun no tiene
`official_code` ni `normalized_name`; el nombre normalizado se calculo en
memoria con la regla canonica propuesta por H21. No se expusieron datos
personales, fiscales ni financieros.

## 2. Metodo de conteo

- Horarios: relacion real `schedules.subject_id -> subjects.id`.
- Estado operativo: `schedules.cycle_id -> academic_cycles.status`.
- Snapshot por relacion: `payroll_schedule_details.schedule_id` resuelve un
  horario cuyo `subject_id` corresponde al UUID.
- Snapshot por nombre: coincidencia exacta con
  `payroll_schedule_details.subject_name_snapshot`.
- Snapshot asociado: union sin duplicados de ambas evidencias.

Los snapshots no tienen FK directa a `subjects`. El conteo por nombre es
evidencia historica, no una prueba de identidad academica entre UUID.

## 3. Diagnostico nominal

| Grupo | normalized_name | subject_id | Nombre actual | Estatus | Horarios total | ACTIVO | PLANEACION | CERRADO | Snapshots asociados | Clasificacion propuesta |
|---:|---|---|---|---|---:|---:|---:|---:|---:|---|
| 1 | `derechos humanos y garantias` | `dc73b77d-ff7d-4ff2-a122-f9593b401220` | DERECHOS HUMANOS Y GARANTIAS | ACTIVO | 1 | 1 | 0 | 0 | 8 | `POSIBLE_DUPLICADO_REQUIERE_CONCILIACION` |
| 1 | `derechos humanos y garantias` | `adac657f-5ebd-41f7-b925-a442fee2c9ef` | DERECHOS HUMANOS Y GARANTÍAS | ACTIVO | 2 | 2 | 0 | 0 | 16 | `POSIBLE_DUPLICADO_REQUIERE_CONCILIACION` |
| 2 | `enfermeria comunitaria i` | `984f875a-4739-4ded-870f-cd73ed2a939d` | ENFERMERIA COMUNITARIA I | ACTIVO | 1 | 1 | 0 | 0 | 8 | `POSIBLE_DUPLICADO_REQUIERE_CONCILIACION` |
| 2 | `enfermeria comunitaria i` | `1aca811f-b8d6-45e1-b0df-f65687711824` | ENFERMERÍA COMUNITARIA I | ACTIVO | 1 | 1 | 0 | 0 | 8 | `POSIBLE_DUPLICADO_REQUIERE_CONCILIACION` |
| 3 | `estudio de mercado e inversion` | `66102312-ae9b-4fd1-bc8e-eb55aae814b2` | ESTUDIO DE MERCADO E INVERSION | ACTIVO | 1 | 1 | 0 | 0 | 7 | `VARIANTE_ORTOGRAFICA_REQUIERE_DECISION` |
| 3 | `estudio de mercado e inversion` | `670cc3e4-a4bb-420e-a4b5-706951450da6` | ESTUDIO DE MERCADO E INVERSIÓN | INACTIVO | 0 | 0 | 0 | 0 | 0 | `REGISTRO_SIN_USO_REQUIERE_DECISION` |
| 4 | `evaluacion del desempeno laboral` | `8517e7b4-de56-4314-8ede-748b5f0827d8` | EVALUACION DEL DESEMPEÑO LABORAL | ACTIVO | 1 | 1 | 0 | 0 | 8 | `POSIBLE_DUPLICADO_REQUIERE_CONCILIACION` |
| 4 | `evaluacion del desempeno laboral` | `51d2e1cb-634e-4c88-ade3-08bd1f91bd5e` | EVALUACIÓN DEL DESEMPEÑO LABORAL | ACTIVO | 1 | 1 | 0 | 0 | 8 | `POSIBLE_DUPLICADO_REQUIERE_CONCILIACION` |
| 5 | `planeacion y control de presupuestos` | `e16b3ec3-8e55-40b2-956a-1827e6f3b00e` | PLANEACION Y CONTROL DE PRESUPUESTOS | ACTIVO | 4 | 4 | 0 | 0 | 32 | `POSIBLE_DUPLICADO_REQUIERE_CONCILIACION` |
| 5 | `planeacion y control de presupuestos` | `968b2a44-f431-4f8e-946d-de0472c094c9` | PLANEACIÓN Y CONTROL DE PRESUPUESTOS | ACTIVO | 2 | 2 | 0 | 0 | 16 | `POSIBLE_DUPLICADO_REQUIERE_CONCILIACION` |

`official_code`: no disponible para los diez registros porque la columna se
agrega con la migracion 013, aun no aplicada en produccion.

## 4. Evidencia de snapshots

| subject_id | Por `schedule_id` | Por nombre exacto | Union asociada |
|---|---:|---:|---:|
| `dc73b77d-ff7d-4ff2-a122-f9593b401220` | 6 | 8 | 8 |
| `adac657f-5ebd-41f7-b925-a442fee2c9ef` | 12 | 16 | 16 |
| `984f875a-4739-4ded-870f-cd73ed2a939d` | 6 | 8 | 8 |
| `1aca811f-b8d6-45e1-b0df-f65687711824` | 6 | 8 | 8 |
| `66102312-ae9b-4fd1-bc8e-eb55aae814b2` | 5 | 7 | 7 |
| `670cc3e4-a4bb-420e-a4b5-706951450da6` | 0 | 0 | 0 |
| `8517e7b4-de56-4314-8ede-748b5f0827d8` | 6 | 8 | 8 |
| `51d2e1cb-634e-4c88-ade3-08bd1f91bd5e` | 6 | 8 | 8 |
| `e16b3ec3-8e55-40b2-956a-1827e6f3b00e` | 24 | 32 | 32 |
| `968b2a44-f431-4f8e-946d-de0472c094c9` | 12 | 16 | 16 |

## 5. Analisis por grupo

### Grupo 1 - Derechos humanos y garantias

- Diferencia exacta: solo el acento de `GARANTÍAS`.
- Ambos UUID estan activos y tienen horarios en el ciclo ACTIVO.
- Ambos tienen snapshots asociados.
- No hay evidencia semantica para afirmar que sean materias distintas.
- Recomendacion: no fusionar en H21. Confirmar con Control Escolar si son
  asignaturas distintas por plan/carrera. Si lo son, asignar claves oficiales
  unicas a ambos UUID; si no, abrir conciliacion separada.

### Grupo 2 - Enfermeria comunitaria I

- Diferencia exacta: solo el acento de `ENFERMERÍA`.
- Ambos UUID estan activos, cada uno con un horario ACTIVO y snapshots.
- La utilizacion paralela impide elegir automaticamente un registro canonico.
- Recomendacion: misma decision que el grupo 1, preservando ambos UUID hasta
  contar con evidencia institucional.

### Grupo 3 - Estudio de mercado e inversion

- Diferencia exacta: solo el acento de `INVERSIÓN`.
- El UUID sin acento esta ACTIVO, tiene un horario ACTIVO y siete snapshots.
- El UUID acentuado esta INACTIVO, sin horarios ni snapshots.
- `audit_log` registra para el UUID inactivo `SUBJECT_CREATED` el
  2026-06-09T14:05:27Z y `SUBJECT_UPDATED` hasta
  2026-06-09T16:45:44Z. Los demas UUID legacy no tienen auditoria directa de
  asignatura disponible.
- Recomendacion: es el candidato mas fuerte a duplicado sin uso, pero no debe
  eliminarse ni reutilizarse sin decision humana. Si se confirma duplicado,
  tratarlo en conciliacion separada.

### Grupo 4 - Evaluacion del desempeno laboral

- Diferencia exacta: el acento de `EVALUACIÓN`; ambas variantes conservan la
  `Ñ` de `DESEMPEÑO`.
- Ambos UUID estan activos, usados en horarios ACTIVO y con snapshots.
- Recomendacion: no fusionar. Validar plan/carrera y asignar claves unicas si
  representan asignaturas distintas.

### Grupo 5 - Planeacion y control de presupuestos

- Diferencia exacta: solo el acento de `PLANEACIÓN`.
- Ambos UUID estan activos; tienen cuatro y dos horarios ACTIVO,
  respectivamente, ademas de 32 y 16 snapshots.
- Es el grupo con mayor uso historico y mayor riesgo de una conciliacion
  incorrecta.
- Recomendacion: conservar ambos UUID hasta que Control Escolar determine si
  son planes/asignaturas distintas. Cualquier merge requeriria un plan propio
  con inventario de horarios y snapshots.

## 6. Evidencia temporal disponible

`subjects` no tiene `created_at` ni `updated_at` en el esquema productivo. Para
nueve UUID solo existe evidencia indirecta por horarios: la primera fecha
observada fue 2026-05-26T19:32:02Z, excepto `ESTUDIO DE MERCADO E INVERSION`,
cuyo primer horario fue 2026-06-09T14:08:37Z. El UUID inactivo del grupo 3 si
tiene los eventos de auditoria descritos arriba.

Esta evidencia temporal no determina por si sola si dos UUID representan la
misma asignatura.

## 7. Decisiones humanas pendientes

Para cada grupo se requiere elegir una de estas rutas:

1. **Asignaturas distintas:** conservar ambos UUID, aprobar dos claves
   oficiales unicas y permitir que H21 resuelva cada fila por `id`, sin
   bloquearla solo por compartir `normalized_name`.
2. **Duplicado real:** no resolver en la importacion H21; abrir una conciliacion
   separada que preserve horarios y snapshots y defina el UUID canonico.
3. **Informacion insuficiente:** mantener el bloqueo
   `DUPLICADO_NOMBRE_CSV` y no ejecutar apply.

No se propone automaticamente `DISTINTAS_CONSERVAR_SEPARADAS` porque los cinco
pares solo difieren ortograficamente. La identidad academica puede depender de
plan, carrera o clave institucional, datos que no estan presentes en
`subjects`.

## 8. Regla propuesta para H21 despues de la decision

Cuando Control Escolar confirme que un par es legitimamente distinto, el
preview podra dejar de bloquearlo por nombre normalizado solo si:

1. ambas filas incluyen UUID validos y diferentes;
2. cada UUID resuelve exactamente su registro;
3. ambas claves oficiales son diferentes y unicas;
4. ninguna fila sustituye, fusiona o inactiva el otro UUID;
5. la decision humana queda vinculada a esta evidencia.

Esto requiere un ajuste posterior de codigo y pruebas; no se implemento en
esta fase documental.

## 9. Riesgos

- Fusionar por nombre perderia la distincion historica entre UUID.
- Elegir un UUID por cantidad de uso no prueba identidad academica.
- Los snapshots por nombre no deben reasignarse automaticamente.
- Asignar la misma clave a ambos registros crearia una ambiguedad funcional.
- Desbloquear el preview sin decision registrada permitiria cambios inseguros.

## 10. Confirmaciones

- Consultas productivas exclusivamente read-only.
- Conexion productiva cerrada al terminar.
- Sin UPDATE, INSERT ni DELETE.
- Sin fusiones ni inactivaciones.
- Sin migraciones.
- Sin modificacion de base de datos.
- Sin deploy.
- Sin cambios de codigo.
- Sin exposicion de datos personales, fiscales o financieros.
