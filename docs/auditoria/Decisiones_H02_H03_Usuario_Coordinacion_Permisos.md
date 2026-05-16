# Decisiones H02/H03 - Usuario, Coordinación y Permisos

## 1. Contexto

Este documento consolida las decisiones humanas ya tomadas para corregir H02 y H03 en una futura SPEC de implementación.

H02 detectó que actualmente la coordinación del usuario se resuelve por coincidencia textual entre:

- `app_users.display_name`
- `app_users.legacy_username`
- `actor.displayName`

contra:

- `coordinations.name`

Esa resolución por texto debe dejar de ser la fuente principal de permisos. La coordinación debe resolverse mediante una relación formal en base de datos.

H03 detectó que `finance.view` está sobrecargado y actualmente permite más acciones que solo consulta financiera, incluyendo edición fiscal, gestión de constancias y flujo financiero de nómina.

Este documento no implementa cambios. Sirve como base aprobada para crear la futura SPEC H02/H03.

## 2. Decisiones finales H02

| Decisión | Decisión final aprobada | Impacto técnico | Requiere implementación |
|---|---|---|---|
| Definición oficial de coordinación | Una coordinación representa el área donde labora una persona usuaria del sistema coordinando carreras a su cargo. Las carreras no impactan directamente la nómina. | La coordinación se trata como unidad operativa de acceso y captura, no como nombre visible de usuario. | Sí |
| Uso de `user_coordinations` | `user_coordinations` será la fuente oficial de relación usuario-coordinación. | Se debe crear relación formal usuario-coordinación y dejar de depender de texto para permisos. | Sí |
| Coordinador en Horarios | Puede acceder, agregar, editar y eliminar horarios dentro de sus coordinaciones asignadas. | Rutas de Horarios deben filtrar y autorizar por `user_coordinations`. | Sí |
| Coordinador en Incidencias | Puede acceder, agregar, editar y eliminar incidencias dentro de sus coordinaciones asignadas. | Incidencias deben validar coordinación desde el horario y usuario-coordinación formal. | Sí |
| Coordinador en Extras | Puede agregar extras dentro de sus coordinaciones asignadas; solo puede editar o borrar extras capturados por el propio usuario. | Extras requieren control combinado por coordinación y propiedad del registro. | Sí |
| Coordinador en Nómina vigente / preview | Puede ver Nómina vigente en modo consulta para validar pagos de sus docentes antes del pago. | La vista preview debe ser solo lectura y filtrada por `user_coordinations`. | Sí |
| RH y expediente fiscal | RH puede ver y editar información fiscal, subir/descargar constancias y descargar CSV de cumpleaños desde Expediente Fiscal. | RH debe tener permisos fiscales explícitos, sin permisos de flujo financiero. | Sí |
| Dirección/Subdirección en operación académica | Dirección/Subdirección puede operar Horarios, Incidencias, Extras y Directorio. En edición/eliminación aplica propiedad del registro cuando corresponda. | Se debe distinguir entre alcance por coordinación y propiedad del registro. | Sí |
| Subdirección como rol técnico | Subdirección no será rol técnico independiente por ahora. Usará el rol técnico `direccion`. | No crear rol `subdireccion`. Documentar reglas equivalentes a Dirección. | Sí |
| Propiedad del registro | El campo oficial para propiedad/autoría será `created_by_user_id`. | Toda regla de "solo su propia información" debe validarse contra `created_by_user_id` o requerir agregarlo donde falte. | Sí |
| `legacy_username` histórico | `legacy_username` queda solo como referencia histórica y apoyo temporal de migración/fallback. | No debe ser fuente final de permisos. | Sí |
| Fallback temporal | Se conserva fallback por texto solo como contingencia/migración. Debe intentar primero `user_coordinations`. | El fallback debe ser controlado, auditable o visible para diagnóstico, y retirarse en una fase posterior si no rompe operación. | Sí |
| Usuarios sin coordinación asignada | Recomendación aprobada: bloquear captura operativa y mostrar mensaje para solicitar configuración al Admin. | Los módulos operativos deben manejar estado sin coordinación sin crear datos incorrectos. | Sí |
| Creación automática de coordinaciones | Recomendación aprobada: no crear coordinaciones automáticamente en flujos operativos. Crear/editar coordinaciones solo desde catálogo/control administrativo. | Deben retirarse creaciones automáticas de flujos como Horarios/Extras cuando exista modelo formal. | Sí |

## 3. Decisiones finales H03

La siguiente tabla rol-acción refleja las decisiones aprobadas y separa el alcance fiscal, financiero, operativo y de nómina.

Leyenda:

- `Sí`: permitido.
- `No`: no permitido.
- `UC`: limitado a coordinaciones asignadas en `user_coordinations`.
- `Propio`: limitado a registros cuya autoría sea `created_by_user_id`.
- `Agregado`: información consolidada o ejecutiva.
- `Sin fiscal`: detalle permitido sin RFC, banco, constancia u otros datos fiscales sensibles.

| Rol | Ver expediente fiscal | Editar RFC | Editar correo | Editar banco/tipo de pago | Subir constancia | Descargar constancia | Ver finanzas | Exportar finanzas | Cambiar estado financiero | Horarios agregar | Horarios editar | Horarios eliminar | Incidencias agregar | Incidencias editar | Incidencias eliminar | Extras agregar | Extras editar | Extras eliminar | Directorio agregar | Directorio editar | Directorio eliminar | Ver nómina vigente / preview | Ver resumen de nómina | Ver detalle por docente | Guardar nómina | Aprobar nómina | Marcar nómina pagada | Cancelar nómina |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `admin` | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí |
| `coordinador` | No fiscal | No | No | No | No | No | No global | No global | No | Sí UC | Sí UC | Sí UC | Sí UC | Sí UC | Sí UC | Sí UC | Sí UC + Propio | Sí UC + Propio | No | No | No | Sí UC, solo lectura | Sí UC | Sí UC | No | No | No | No |
| `direccion` | No fiscal | No | No | No | No | No | Sí Agregado | Sí Agregado | No | Sí | Sí Propio | Sí Propio | Sí | Sí Propio | Sí Propio | Sí | Sí Propio | Sí Propio | Sí | Sí | Sí Propio | Sí Agregado | Sí Agregado | Sí global, sin fiscal | No | No | No | No |
| `subdireccion` usa `direccion` | No fiscal | No | No | No | No | No | Sí Agregado | Sí Agregado | No | Sí | Sí Propio | Sí Propio | Sí | Sí Propio | Sí Propio | Sí | Sí Propio | Sí Propio | Sí | Sí | Sí Propio | Sí Agregado | Sí Agregado | Sí global, sin fiscal | No | No | No | No |
| `rh` | Sí | Sí | Sí | Sí | Sí | Sí | No financiero | No financiero | No | No | No | No | No | No | No | No | No | No | No académico | No académico | No académico | No | No | No | No | No | No | No |
| `finanzas` | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí con `finance.workflow` | No | No | No | No | No | No | No | No | No | No | No | No | Sí, consulta financiera | Sí | Sí | No | Sí con `finance.workflow` | Sí con `finance.workflow` | Sí con `finance.workflow` |
| `contador` | Lectura mínima | No | No | No | No | No | Lectura mínima | Sí | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No |
| `contabilidad` | Lectura mínima | No | No | No | No | No | Lectura mínima | Sí | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No |

Notas de decisión:

- Coordinadores solo capturan datos operativos. No gestionan expediente fiscal ni finanzas globales.
- Coordinadores pueden revisar Nómina vigente / preview únicamente en modo lectura, filtrada por `user_coordinations`.
- RH y Finanzas son dueños funcionales del expediente fiscal.
- Finanzas puede aprobar, marcar pagada y cancelar nómina mediante un permiso explícito de flujo financiero, recomendado `finance.workflow`.
- Contador solo exporta. Si requiere ver datos, debe ser lectura mínima necesaria para exportación.
- Contabilidad será equivalente a Contador.
- Dirección/Subdirección opera módulos académicos, pero en Finanzas solo consulta reportes agregados y detalle por docente sin datos fiscales sensibles.
- Subdirección usa el rol técnico `direccion`; no se creará un rol técnico independiente en esta fase.
- `GET /teachers` debe traer todos los docentes de todas las coordinaciones. Ver todos los docentes no implica permiso de editar todos los docentes.

## 4. Decisiones pendientes reales

Solo quedan pendientes las decisiones que no fueron cerradas en la aprobación humana:

- Admin debe aprobar la SPEC técnica H02/H03 antes de implementar.

Decisiones ya cerradas en esta actualización:

- Operación ya entregó las asignaciones concretas usuario-coordinación para migración.
- Ya se definió la condición final para retirar fallback legacy después de estabilizar los cambios.

Condición aprobada para retiro de fallback legacy:

1. Migrar todas las asignaciones usuario-coordinación.
2. Validar por al menos una quincena operativa completa sin errores de acceso.
3. Confirmar que no hubo usuarios bloqueados indebidamente.
4. Confirmar que no se usó fallback en logs durante el periodo de validación.

## Asignaciones iniciales usuario-coordinación para migración

La siguiente tabla fue entregada por Operación/Admin como fuente operativa inicial para preparar la migración hacia `user_coordinations`.

| Usuario | Rol | Coordinación asignada |
|---|---|---|
| victor.yama@tecplayacar.edu.mx | Admin | Todas / Global |
| alejandra.castellanos@tecplayacar.edu.mx | Coordinador | Rectoría |
| cristhian.alvarado@tecplayacar.edu.mx | Coordinador | Coordinación de Investigación |
| david.velazquez@tecplayacar.edu.mx | Finanzas | No requiere coordinación operativa |
| elsa.garcia@tecplayacar.edu.mx | Subdirección | Subdirección de vinculación y calidad |
| eslivet.aguilar@tecplayacar.edu.mx | Coordinador | ADETUR, ARQ, SISCOM, DIGRAF |
| jesus.aguilar@tecplayacar.edu.mx | Coordinador | Servicio Social |
| josue.delgado@tecplayacar.edu.mx | Coordinador | Prácticas profesionales |
| leonardo.sayas@tecplayacar.edu.mx | Coordinador | ADEM, CINTER, CONPUB |
| lidia.medina@tecplayacar.edu.mx | Coordinador | Idiomas |
| mario.medina@tecplayacar.edu.mx | Coordinador | Coordinación General |
| merit.bazan@tecplayacar.edu.mx | Coordinador | PED, MAESTRIAS |
| noadia.gonzalez@tecplayacar.edu.mx | Dirección | Todas / Global |
| oriana.nah@tecplayacar.edu.mx | Coordinador | ENF, NUT, ESPECIALIDAD, MDH |
| roxana.landero@tecplayacar.edu.mx | Coordinador | Simulación Clínica |
| zulma.martinez@tecplayacar.edu.mx | Coordinador | DE, CRIMI, MERC |
| zuly.carrillo@tecplayacar.edu.mx | RH | Recursos Humanos |

Reglas de interpretación aprobadas:

1. No crear una coordinación llamada "Todas / Global".
2. "Todas / Global" debe interpretarse como alcance global por rol/permisos.
3. Usuarios Admin no requieren registros en `user_coordinations` para operar globalmente.
4. Dirección usa rol técnico `direccion`.
5. Subdirección usa rol técnico `direccion`.
6. Finanzas usa rol técnico `finanzas`.
7. RH usa rol técnico `rh`.
8. Coordinadores sí requieren filas en `user_coordinations`.
9. Si una celda tiene varias coordinaciones separadas por coma, deben convertirse en una fila por coordinación.
10. "No requiere coordinación operativa" no debe insertarse como coordinación.
11. Los nombres de coordinación deben validarse contra el catálogo real `coordinations`.
12. Si una coordinación no existe en el catálogo, debe marcarse para revisión antes de migrar.

Nota técnica: esta tabla debe convertirse a formato normalizado antes de crear cualquier migración hacia `user_coordinations`.

Formato normalizado sugerido:

| email | rol_tecnico | coordination_name | scope_type | requiere_revision | observaciones |
|---|---|---|---|---|---|
| victor.yama@tecplayacar.edu.mx | admin |  | global | No | Alcance global por rol; no insertar coordinación "Todas / Global". |
| alejandra.castellanos@tecplayacar.edu.mx | coordinador | Rectoría | coordination | Sí | Validar existencia exacta en catálogo `coordinations`. |
| cristhian.alvarado@tecplayacar.edu.mx | coordinador | Coordinación de Investigación | coordination | Sí | Validar existencia exacta en catálogo `coordinations`. |
| david.velazquez@tecplayacar.edu.mx | finanzas |  | no_operational_coordination | No | No insertar coordinación operativa. |
| elsa.garcia@tecplayacar.edu.mx | direccion | Subdirección de vinculación y calidad | coordination | Sí | Subdirección usa rol técnico `direccion`; validar si requiere fila en `user_coordinations` por operación académica. |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | ADETUR | coordination | Sí | Fila derivada de lista múltiple. |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | ARQ | coordination | Sí | Fila derivada de lista múltiple. |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | SISCOM | coordination | Sí | Fila derivada de lista múltiple. |
| eslivet.aguilar@tecplayacar.edu.mx | coordinador | DIGRAF | coordination | Sí | Fila derivada de lista múltiple. |
| jesus.aguilar@tecplayacar.edu.mx | coordinador | Servicio Social | coordination | Sí | Validar existencia exacta en catálogo `coordinations`. |
| josue.delgado@tecplayacar.edu.mx | coordinador | Prácticas profesionales | coordination | Sí | Validar existencia exacta en catálogo `coordinations`. |
| leonardo.sayas@tecplayacar.edu.mx | coordinador | ADEM | coordination | Sí | Fila derivada de lista múltiple. |
| leonardo.sayas@tecplayacar.edu.mx | coordinador | CINTER | coordination | Sí | Fila derivada de lista múltiple. |
| leonardo.sayas@tecplayacar.edu.mx | coordinador | CONPUB | coordination | Sí | Fila derivada de lista múltiple. |
| lidia.medina@tecplayacar.edu.mx | coordinador | Idiomas | coordination | Sí | Validar existencia exacta en catálogo `coordinations`. |
| mario.medina@tecplayacar.edu.mx | coordinador | Coordinación General | coordination | Sí | Validar existencia exacta en catálogo `coordinations`. |
| merit.bazan@tecplayacar.edu.mx | coordinador | PED | coordination | Sí | Fila derivada de lista múltiple. |
| merit.bazan@tecplayacar.edu.mx | coordinador | MAESTRIAS | coordination | Sí | Fila derivada de lista múltiple. |
| noadia.gonzalez@tecplayacar.edu.mx | direccion |  | global | No | Dirección con alcance global por rol; no insertar coordinación "Todas / Global". |
| oriana.nah@tecplayacar.edu.mx | coordinador | ENF | coordination | Sí | Fila derivada de lista múltiple. |
| oriana.nah@tecplayacar.edu.mx | coordinador | NUT | coordination | Sí | Fila derivada de lista múltiple. |
| oriana.nah@tecplayacar.edu.mx | coordinador | ESPECIALIDAD | coordination | Sí | Fila derivada de lista múltiple. |
| oriana.nah@tecplayacar.edu.mx | coordinador | MDH | coordination | Sí | Fila derivada de lista múltiple. |
| roxana.landero@tecplayacar.edu.mx | coordinador | Simulación Clínica | coordination | Sí | Validar existencia exacta en catálogo `coordinations`. |
| zulma.martinez@tecplayacar.edu.mx | coordinador | DE | coordination | Sí | Fila derivada de lista múltiple. |
| zulma.martinez@tecplayacar.edu.mx | coordinador | CRIMI | coordination | Sí | Fila derivada de lista múltiple. |
| zulma.martinez@tecplayacar.edu.mx | coordinador | MERC | coordination | Sí | Fila derivada de lista múltiple. |
| zuly.carrillo@tecplayacar.edu.mx | rh | Recursos Humanos | coordination | Sí | Validar si RH requiere fila operativa o solo rol fiscal. |

## 5. Implicaciones técnicas

La futura implementación H02/H03 debe contemplar:

1. Crear tabla `user_coordinations`.
2. Normalizar la tabla operativa entregada por Operación/Admin hacia filas compatibles con `user_coordinations`.
3. Validar cada `coordination_name` contra el catálogo real `coordinations`.
4. Marcar para revisión cualquier coordinación inexistente antes de migrar.
5. Ajustar Control de Accesos para asignar una o varias coordinaciones a usuarios.
6. Resolver coordinación desde `user_coordinations`, no por texto.
7. Mantener fallback temporal por texto solo como contingencia.
8. El fallback debe usarse solo si no existe relación formal y está habilitado.
9. El uso del fallback debe quedar documentado y, si es viable, visible en logs o auditoría.
10. Retirar fallback legacy en fase posterior únicamente cuando se cumpla la condición aprobada: migración completa, una quincena operativa sin errores, sin usuarios bloqueados indebidamente y sin uso de fallback en logs.
11. Eliminar creación automática de coordinaciones en flujos operativos.
12. Separar permisos fiscales y financieros.
13. Crear permisos explícitos:
    - `fiscal.view`
    - `fiscal.manage`
    - `fiscal.document.view`
    - `fiscal.document.manage`
    - `finance.view`
    - `finance.export`
    - `finance.workflow`
14. Definir permisos para preview de nómina:
    - Crear `payroll.preview`; o
    - reutilizar `payroll.view` si se documenta claramente la diferencia entre ver preview y guardar.
15. Mantener `payroll.finalize` para guardar nómina según rol autorizado.
16. Asociar aprobación, marcar pagada y cancelación financiera a `finance.workflow`.
17. Distinguir filtros por:
    - `user_coordinations`
    - propiedad del registro vía `created_by_user_id`
    - rol global
    - permisos financieros
18. Mantener `GET /teachers` como endpoint global de consulta, pero controlar acciones sensibles por permisos.
19. Asegurar que Extras valide tanto coordinación como propiedad del registro para edición/eliminación.
20. Asegurar que Horarios e Incidencias usen coordinación formal.
21. Asegurar que Finanzas y RH tengan permisos separados para expediente fiscal.
22. Asegurar que Contador y Contabilidad no hereden permisos de edición por un permiso genérico.
23. No crear rol técnico `subdireccion`; usar `direccion` para ambos perfiles.
24. Si una tabla que requiere regla de propiedad no tiene `created_by_user_id`, la SPEC debe marcarlo como cambio requerido.
25. Dirección/Subdirección puede ver detalle por docente de todas las coordinaciones, pero el detalle debe excluir datos fiscales sensibles salvo permiso fiscal explícito.

## 6. Cambios que NO deben hacerse todavía

- No modificar código.
- No modificar permisos productivos.
- No crear migraciones.
- No cambiar rutas.
- No cambiar frontend.
- No cambiar backend.
- No retirar fallback legacy hasta tener migración controlada.
- No cambiar roles productivos hasta que exista SPEC aprobada.
- No crear el rol técnico `subdireccion`.
- No aplicar `finance.workflow` hasta que la SPEC esté aprobada.

## 7. Riesgos si se implementa incorrectamente

- Coordinador viendo nómina de coordinaciones no asignadas.
- Coordinador guardando nómina por error.
- Coordinador editando datos fiscales.
- Finanzas sin capacidad de gestionar expediente fiscal.
- Finanzas sin capacidad de aprobar, marcar pagada o cancelar nómina si `finance.workflow` no se asigna correctamente.
- Contador con capacidad de editar datos que solo debía exportar.
- Contabilidad con permisos distintos a Contador sin decisión formal.
- Dirección cambiando estados financieros indebidamente.
- Dirección/Subdirección perdiendo capacidad operativa en Horarios, Incidencias, Extras o Directorio.
- Dirección/Subdirección viendo datos fiscales sensibles en detalle por docente.
- Fallback legacy resolviendo permisos incorrectos.
- Usuario sin coordinación capturando datos.
- `GET /teachers` interpretado erróneamente como permiso de edición global.
- Extras editadas por usuarios que no son propietarios.
- Dirección/Subdirección editando registros ajenos por falta de `created_by_user_id`.
- RH recibiendo permisos financieros que no le corresponden.

## 8. Checklist de aprobación

[x] Dirección aprobó definición de coordinación.

[x] Se aprobó que la coordinación es unidad operativa de acceso y captura, no carrera para cálculo de nómina.

[x] Se aprobó usar `user_coordinations` como fuente oficial.

[x] Se aprobó que `display_name` no sea fuente principal de permisos.

[x] Se aprobó que `legacy_username` sea histórico/fallback temporal.

[x] Se aprobó conservar fallback temporal con ruta de retiro posterior.

[x] Se aprobó que Coordinador no gestione datos fiscales.

[x] Se aprobó que Coordinador pueda ver Nómina vigente / preview en solo lectura para sus coordinaciones.

[x] RH aprobó gestión de expediente fiscal.

[x] Finanzas aprobó gestión fiscal relacionada con pago y flujo financiero.

[x] Se aprobó que solo Admin y Finanzas cambien estados financieros de nómina.

[x] Se aprobó que Finanzas pueda aprobar, marcar pagada y cancelar nómina mediante `finance.workflow`.

[x] Se aprobó que Contador solo exporte.

[x] Se aprobó que Contabilidad sea equivalente a Contador.

[x] Se aprobó que Subdirección use el rol técnico `direccion`.

[x] Se aprobó que el campo oficial de propiedad sea `created_by_user_id`.

[x] Se aprobó que Dirección/Subdirección vea detalle por docente sin datos fiscales sensibles.

[x] Se aprobó que `GET /teachers` traiga todos los docentes.

[x] Operación entregó asignaciones concretas usuario-coordinación para migración.

[x] Se definió condición final para retiro del fallback legacy.

[ ] Admin debe aprobar SPEC técnica H02/H03 antes de implementar.

## 9. Base para SPEC H02/H03

La futura SPEC H02/H03 debe cubrir:

1. Modelo de datos objetivo.
2. Migración de relaciones usuario-coordinación.
3. Conversión de la tabla operativa inicial al formato normalizado `email`, `rol_tecnico`, `coordination_name`, `scope_type`, `requiere_revision`, `observaciones`.
4. Validación de nombres contra catálogo real `coordinations`.
5. Reglas para `scope_type`: `global`, `coordination`, `no_operational_coordination`.
6. Actualización de Control de Accesos.
7. Ajustes backend para resolver coordinación por `user_coordinations`.
8. Ajustes frontend para asignar coordinaciones.
9. Matriz rol-acción.
10. Separación de permisos fiscales y financieros.
11. Vista de Nómina vigente / preview para Coordinador.
12. Filtros por coordinación asignada.
13. Reglas de propiedad del registro con `created_by_user_id`.
14. Identificación de tablas que requieren agregar `created_by_user_id`.
15. Fallback legacy temporal.
16. Condición de retiro del fallback legacy.
17. Fase posterior para retirar fallback legacy.
18. Uso de `finance.workflow` para aprobar, marcar pagada y cancelar nómina.
19. Equivalencia técnica de Contabilidad con Contador.
20. Mapeo de Subdirección al rol técnico `direccion`.
21. Reportes agregados y detalle por docente para Dirección/Subdirección sin datos fiscales sensibles.
22. Pruebas por rol.
23. Pruebas por coordinación.
24. Pruebas por propiedad del registro.
25. Pruebas de nómina preview.
26. Pruebas de flujo financiero.
27. Plan de rollback.

La SPEC debe distinguir claramente entre:

- Cambios de modelo de datos.
- Cambios de permisos.
- Cambios de UI.
- Cambios de API.
- Migración de datos existentes.
- Validación operativa antes de despliegue.

## 10. Próximo paso

Crear la SPEC de implementación H02/H03 con alcance controlado, sin modificar todavía permisos productivos ni estructura de base de datos hasta que la SPEC sea revisada y aprobada.
