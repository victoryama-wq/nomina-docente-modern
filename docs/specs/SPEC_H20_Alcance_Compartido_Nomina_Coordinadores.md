# SPEC H20 - Alcance compartido de Nomina para Coordinadores

## 1. Objetivo

Permitir que un Coordinador consulte en el preview de Nomina el calculo completo de los docentes bajo su responsabilidad o que imparten al menos un horario en alguna de sus coordinaciones asignadas.

H20 es exclusivamente de lectura. No modifica captura, propiedad, edicion, formula de Nomina ni workflow financiero.

## 2. Problema anterior

El backend resolvia el alcance no global filtrando directamente:

- `schedules.coordination_id` antes de calcular horarios e incidencias;
- `extra_hours.coordination_id` antes de calcular extras externos;
- las tablas snapshot por `coordination_id` al consultar una corrida guardada.

Ese filtro mezclaba dos conceptos distintos: la elegibilidad del docente y las filas necesarias para calcularlo. Como resultado, un docente visible para el Coordinador perdia la carga de otras coordinaciones.

## 3. Regla de elegibilidad aprobada

Para un actor con rol tecnico `coordinador`, un docente pertenece al alcance read-only del preview cuando se cumple al menos una condicion:

```sql
teachers.created_by = actor.id
OR EXISTS (
  SELECT 1
  FROM schedules s_scope
  WHERE s_scope.teacher_id = teachers.id
    AND s_scope.cycle_id = :cycleId
    AND s_scope.coordination_id = ANY(:actorCoordinationIds)
)
```

La autorizacion usa UUID de `user_coordinations`/`actorCoordinations[]`; no usa nombres de coordinacion ni el valor singular legacy.

## 4. Calculo completo posterior a la elegibilidad

Una vez autorizado el docente, el calculo considera todas sus filas validas del ciclo y periodo:

- horarios base;
- faltas y retardos;
- extras registrados en incidencias;
- extras externos;
- coordinaciones de origen.

El conjunto autorizado se aplica por `teacher_id`. No se vuelve a recortar por la coordinacion del actor. Las formulas, redondeos y decimales H01 permanecen sin cambios.

## 5. Respuesta y presentacion

La API conserva las lineas internas por docente y coordinacion para no alterar H01 ni los snapshots. Para Coordinador tambien entrega `teacherSummaries`, una proyeccion agregada por docente que:

- muestra al docente una sola vez;
- suma exactamente sus lineas autorizadas;
- conserva `coordinationIds` y `coordinationNames`;
- informa si es docente bajo responsabilidad del actor;
- informa si imparte en una coordinacion del actor;
- informa si tiene carga compartida con otras coordinaciones.

El detalle de horarios, incidencias y extras conserva la coordinacion de origen.

## 6. Seguridad

H20 no concede al Coordinador:

- `payroll.finalize`;
- guardado de corridas;
- exportaciones financieras;
- workflow financiero;
- permisos fiscales o documentales;
- edicion de horarios, incidencias, extras o docentes ajenos;
- cambio de estados de Nomina.

El payload read-only para actores sin permiso fiscal omite `paymentType` y alertas de faltantes fiscales. No expone RFC, banco, cuenta, CLABE, correo fiscal ni constancias.

## 7. Roles no modificados

- Admin conserva alcance global.
- Direccion, RH, Finanzas, Contador y Contabilidad conservan el comportamiento previo segun sus permisos y alcance.
- Los endpoints de guardado y exportacion conservan sus guardas vigentes.

## 8. Frontend

Para Coordinador, `PayrollView` usa `teacherSummaries` como lista principal y mantiene modo solo lectura. El detalle agrupa todas las filas del docente y muestra la coordinacion en cada horario y extra.

Etiquetas visuales aprobadas:

- `Docente bajo mi responsabilidad`.
- `Imparte en mi coordinación`.
- `Carga compartida con otras coordinaciones`.

No se agregan controles de edicion ni finalizacion.

## 9. Persistencia y migraciones

- No hay cambios de esquema.
- No hay migraciones.
- No hay escritura de datos por H20.
- No se modifican snapshots existentes.
- No se cambia la estructura de guardado de Nomina.

## 10. Criterios de aceptacion

1. Docente creado por Coordinador A con carga en A y B aparece una sola vez y suma ambas coordinaciones.
2. Docente creado por otro usuario, pero con horario en A, aparece para Coordinador A con carga completa.
3. Docente ajeno sin horario en A no aparece.
4. Coordinador sigue recibiendo 403 al intentar guardar/finalizar.
5. Payload de Coordinador no contiene campos fiscales ni `paymentType`.
6. Admin conserva alcance global.
7. Totales agregados por docente coinciden con el total autorizado sin duplicacion.

## 11. Fuera de alcance

- Cambiar H01.
- Cambiar precision monetaria.
- Cambiar propiedad o edicion en Directorio, Horarios, Incidencias o Extras.
- Agregar permisos o roles.
- Ejecutar migraciones o deploy.

## 12. Estado de implementacion y cierre

Estado: **cerrado operativo**.

- Commit funcional: `56553f4 feat(h20): expand coordinator payroll preview scope`.
- Revision Cloud Run vigente: `nomina-api-00051-9s5`.
- Firebase Hosting H20 activo: release `1784228039752000`, version `41bf160c7c3595b6`.
- Pruebas API 22/22, Web 58/58 e integracion PostgreSQL 60/60 aprobadas.
- Smoke autenticado Coordinador/Admin satisfactorio.
- Criterios de aceptacion cumplidos sin cambios H01, migraciones, escrituras de Nomina, permisos nuevos ni exposicion fiscal.

Evidencia: `docs/auditoria/H20_Deploy_Productivo_Alcance_Compartido_Nomina.md`.
