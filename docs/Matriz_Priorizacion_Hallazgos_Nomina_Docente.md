# Matriz de Priorizacion de Hallazgos - Nomina Docente

Fecha de elaboracion: 2026-05-15

## Alcance

Esta matriz clasifica los hallazgos detectados durante la auditoria tecnica retrospectiva del sistema actual de Nomina Docente.

No contiene cambios de codigo. Su objetivo es apoyar la toma de decisiones antes del SDD, la matriz formal de riesgos y el plan de estabilizacion productiva.

## Criterios de prioridad

- **P0 Critico:** corregir inmediatamente.
- **P1 Alto:** corregir despues del SDD y matriz de riesgos.
- **P2 Medio:** planificar en backlog tecnico.
- **P3 Bajo:** documentacion o mejora futura.

## Matriz

| ID | Hallazgo | Area | Riesgo | Impacto | Probabilidad | Prioridad | Corregir ahora si/no | Justificacion | Pruebas necesarias |
|---|---|---|---|---|---|---|---|---|---|
| H01 | Precision monetaria con `number` en Node/API | Nomina / Finanzas | Diferencias de centavos en calculo formal de nomina | Alto | Media | P0 Critico | Si | Es nomina productiva. Aunque PostgreSQL usa `numeric`, la API convierte importes a `number` para calculo y respuesta. Puede generar diferencias pequenas pero sensibles. | Comparar corrida completa contra CSV legado validado; casos con decimales; extras; retardos; faltas; totales por docente, coordinacion y quincena. |
| H02 | Resolucion de coordinacion por `display_name` / `legacy_username` | Seguridad / Permisos | Usuario asociado a coordinacion incorrecta o sin coordinacion | Alto | Media | P1 Alto | No | Afecta restricciones de edicion en horarios, incidencias, extras y docentes. No parece roto actualmente, pero es fragil ante cambios de nombre. | Crear usuarios con nombres similares; cambiar nombre visible; usuario sin coordinacion; admin vs coordinador; RH; direccion. |
| H03 | Permisos `finance.view` y `fiscal.manage` con alcance de edicion fiscal | Roles / Seguridad | Finanzas podria editar datos fiscales o constancias si negocio no lo permite | Alto | Media | P1 Alto | No | El codigo permite a `finance.view` actualizar datos fiscales y constancias. Puede ser correcto, pero requiere confirmacion operativa. | Matriz rol-ruta-accion; pruebas con admin, finanzas, contador, RH, direccion y coordinador. |
| H04 | Falta de pruebas automatizadas | Calidad / Mantenibilidad | Regresiones no detectadas en nomina, permisos o exportables | Alto | Alta | P1 Alto | No | El sistema ya contiene reglas sensibles. `typecheck` valida tipos, pero no comportamiento de negocio. | Unitarias de calculo; integracion API; permisos por rol; snapshots de CSV/PDF criticos. |
| H05 | Migraciones SQL sin control formal de ejecucion | Base de datos / DevOps | Migraciones duplicadas, fuera de orden o incompletas | Alto | Media | P1 Alto | No | Existen SQL incrementales, pero no se detecto tabla o herramienta formal que registre migraciones aplicadas. Riesgo en produccion y trabajo colaborativo. | Validar DB limpia; DB existente; orden completo; idempotencia; respaldo previo; estrategia de rollback. |
| H06 | Coexistencia con Apps Script legado | Arquitectura | Confusion operativa, doble fuente de verdad o procesos paralelos | Alto | Media | P1 Alto | No | El legado sigue versionado y contiene logica importante. No se confirmo si sigue activo en operacion real o solo como respaldo historico. | Confirmar uso real; inventario de hojas vivas; validar que el sistema moderno sea fuente unica; plan de retiro o congelamiento del legado. |
| H07 | Provider Google con parametro `hd` comentado | Autenticacion / UX | Usuarios externos pueden intentar login antes de ser rechazados por backend | Medio | Media | P2 Medio | No | El backend valida dominio institucional, por lo que no parece una brecha critica. Aun asi mejora experiencia y reduce intentos invalidos. | Login con cuenta institucional; cuenta personal; cuenta de otro dominio; usuario institucional sin acceso. |
| H08 | Logica concentrada en archivos grandes | Backend / Frontend | Cambios lentos, mayor probabilidad de regresion y conflictos entre desarrolladores | Medio | Alta | P2 Medio | No | Archivos como `payroll.ts`, `reports.ts`, `schedules.ts` y vistas grandes concentran mucha responsabilidad. | Typecheck; pruebas de regresion por modulo; refactor incremental con snapshots antes/despues. |
| H09 | Estados de nomina no usados claramente: `BORRADOR`, `CERRADA` | Modelo / Flujo financiero | Ambiguedad en reportes, auditoria y operacion futura | Medio | Media | P2 Medio | No | El flujo observado usa principalmente `CALCULADA`, `EN_REVISION`, `APROBADA`, `PAGADA` y `CANCELADA`. Los otros estados requieren confirmacion. | Pruebas de transicion de estados; permisos por boton; visibilidad en Finanzas y Nomina. |
| H10 | Cierre de cuatrimestre moderno pendiente de confirmar | Ciclos / Historico | Operacion puede depender aun del legado o de un flujo no documentado | Medio | Media | P2 Medio | No | Existe tabla `quarter_closures`, pero no se detecto modulo moderno completo equivalente al proceso legacy de cierre. | Simular cierre de ciclo; validar horarios historicos; nuevo ciclo; quincenas nuevas; historial por docente y coordinacion. |
| H11 | Exportables CSV con posible diferencia de codificacion segun modulo | Reportes / Excel | Acentos o letra n con tilde pueden verse mal en Excel | Medio | Media | P2 Medio | No | Algunos exportables agregan BOM UTF-8 y otros requieren revision. Ya hubo antecedentes de CSV con problemas de acentuacion al abrir en Excel. | Abrir CSV en Excel Windows, Google Sheets y LibreOffice; validar nombres con acentos, letra n con tilde, RFC, textos largos. |
| H12 | Dependencia de nombres para catalogos, asignaturas y tabuladores historicos | Catalogos / Horarios | Cambios de catalogo podrian afectar interpretacion historica si no se preservan snapshots | Medio | Baja | P2 Medio | No | Nomina guarda snapshots, pero horarios vivos conservan referencias y texto. Conviene definir politica de inactivacion vs edicion. | Inactivar y renombrar asignatura usada; cambiar tabulador usado; revisar horarios, nomina guardada y reportes. |
| H13 | Variables reales de produccion no versionadas | Infraestructura | Dificulta auditoria exacta de Cloud Run, Hosting, CORS y buckets | Bajo | Media | P3 Bajo | No | Es correcto no versionar secretos, pero falta documentacion operativa de variables desplegadas. | Checklist de configuracion productiva; comparacion contra `.env.example`; validacion de CORS, dominio y bucket de constancias. |
| H14 | Legado Apps Script con logica extensa en `Codigo.gs` e `index.html` | Documentacion / Retiro legado | Dificil reconstruir reglas si se elimina sin inventario | Bajo | Media | P3 Bajo | No | Aunque no parece ser la app principal, conserva conocimiento historico y reglas de operacion anteriores. | Documentar equivalencias legacy vs moderno; definir archivo historico; decidir retiro, congelamiento o mantenimiento limitado. |

## Lectura ejecutiva

El unico hallazgo que conviene tratar como correccion inmediata es **H01 Precision monetaria con `number`**, porque impacta directamente el calculo formal de nomina.

Los hallazgos **H02 a H06** deben atenderse despues del SDD y la matriz formal de riesgos, ya que afectan permisos, continuidad operativa, datos productivos y gobierno tecnico.

Los hallazgos **H07 a H12** deben entrar al backlog tecnico con validaciones controladas.

Los hallazgos **H13 y H14** son principalmente de documentacion, operacion y mejora futura.
