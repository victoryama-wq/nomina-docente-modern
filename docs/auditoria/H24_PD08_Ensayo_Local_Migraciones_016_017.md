# H24 PD-08 - Ensayo local de migraciones 016/017 y restauracion

Fecha: 2026-10-30. Base: `ecdf7d6`.
Resultado: **ensayo H05 y backup/restauracion local satisfactorio; no autoriza release**.
El rollback con imagen productiva exacta y la preparacion del destino siguen pendientes.

## 1. Aislamiento autorizado

Dos contenedores nuevos PostgreSQL 18.6:
`h24-pd78-main-20261030` y `h24-pd78-restore-20261030`.
Ambos con etiqueta purpose=h24-pd78-ephemeral, 512 MiB, 1 CPU, 128 PIDs y
almacenamiento tmpfs propio de 256 MiB. Sin mounts de la BD habitual.
Puertos exclusivos 127.0.0.1:58318 / 58319; ambas bases nomina_docente_test,
usuario/clave sinteticos. Se comprobaron identidad, puerto, etiqueta y
current_database antes de las operaciones. No se utilizaron dumps reales ni
el dump anonimizado previo; sin Cloud SQL Auth Proxy, ADC o consulta productiva.

## 2. Construccion del estado inicial

En BD vacia se aplicaron los SQL originales anteriores a H24 y el fixture H04
sintetico. Una copia intacta de tools/migrate-db.ts y de los 18 SQL hasta 015,
ubicados en carpeta de laboratorio, registro baseline mediante H05. No se
editaron SQL ni checksums, ni se hizo baseline contra una BD existente.

El H05 del checkout completo detecto exactamente:
- 20 archivos de migracion;
- 18 baseline;
- solo 016_h24_teacher_dossier y 017_h24_teacher_fiscal_identity pendientes;
- checksum mismatch=0.

Se hicieron dos ensayos completos: primero con el fixture H04; despues se repitio
desde cero, exclusivamente en los mismos destinos efimeros, agregando historicos
sinteticos para que la verificacion no dependiera de snapshots vacios.
Los resultados y hashes siguientes corresponden al segundo ensayo.

Dataset antes y despues de las migraciones:

| Tabla | Filas preservadas |
|---|---:|
| teachers | 2 |
| payroll_runs | 7 |
| payroll_lines | 2 |
| payroll_schedule_details | 7 |
| payroll_extra_details | 2 |

Los datos de historico se insertaron como fixtures de integridad, no mediante
Guardar/Finalizar una nomina ni modificando H01. No representan una corrida real.

## 3. Secuencia y resultado

1. Inspect con la herramienta H05 original: dos pendientes, cero mismatch.
2. pg_dump -Fc previo; restauracion con pg_restore --exit-on-error en el segundo
   contenedor. Comparacion de tablas, filas, columnas/defaults, constraints e indices.
3. H05 dry-run (escribe auditoria administrativa solo en el laboratorio).
4. H05 apply: ejecuto solo 016 y 017, en orden; duracion del proceso 308 ms.
5. Inspect final: 20 registradas = 18 baseline + 2 aplicadas; pending=0/mismatch=0.
6. Todas las tablas funcionales preexistentes conservaron fingerprints. En teachers
   se excluyeron de esa comparacion solo las dos columnas nuevas; sus valores
   iniciales fueron vacios para todas las filas, tal como define 017.
7. Rechazo SQL 23514 de C.P. y CURP sinteticos invalidos, en transacciones ROLLBACK.
   Constraints/indices/FKs de las tablas nuevas presentes y cotejados al restaurar.
8. pg_dump posterior y restauracion completa en el segundo contenedor; filas,
   esquema y H05 iguales al origen. No se reutilizo una BD del usuario como destino.
9. Segundo H05 apply sin pendientes: no reejecuto 016/017; permanecieron exactamente
   dos registros success en schema_migration_runs.

La migracion 017 no se presume idempotente al ejecutar el SQL crudo dos veces:
la proteccion demostrada es la herramienta H05 y su registro/checksum.

## 4. Backups verificados

Archivos locales exclusivamente sinteticos, en `.cache/pd78-20261030/`:

| Backup | SHA-256 | Dump/restauracion/comparaciones |
|---|---|---:|
| pre.dump | f4f2e9d0cbffa71b13f7c94f7aae08b435110d7b82aeb32de72a73d419e1ad72 | 1.854 s |
| post.dump | bb694aca9d8120ec48f57e572157c2b14dd85712432ee5b7308966c076b3eab6 | 1.726 s |

No son backups productivos ni tiempos de recuperacion de un dataset real.
No se definio RTO/RPO institucional a partir de estas muestras.

La primera comparacion textual encontro distinta agrupacion de parentesis en
payroll_calendar_access_days_chk al restaurar PostgreSQL. Se verifico la misma
conjuncion pura de cuatro limites (0..31 para ambos campos) y se normalizo solo
ese CHECK en el comparador. No se ignoran constraints genericos ni se altero SQL
para que pasara. El resto de estructura y datos se compara exactamente.

## 5. Compatibilidad de retorno de codigo

Se extrajo con git archive el codigo API de b3f40ce, referencia funcional anterior
a H24 registrada en SDD, y se ejecuto localmente contra el esquema restaurado
post016017. GET /api/health, /api/teachers y /api/teachers/export/active: 200.
Solo sesiones de test y filas sinteticas; no se escribieron docentes.

Limitacion importante: se usaron las dependencias locales validadas de PD-06,
no el digest productivo finance-b3f40ce. Por tanto, se acredita compatibilidad
parcial de consultas con esquema aditivo, no regresion completa de aquella imagen.
Un primer intento del harness incluyo /api/teachers/fiscal, ruta que no existe;
se retiro ese supuesto y se repitieron solo endpoints existentes. No hubo cambio API.

Plan de rollback permanece: conservar esquema aditivo y estados de recuperacion;
volver a artefactos aprobados solo tras verificar compatibilidad. No ejecutar DROP
ni restaurar toda la BD productiva automaticamente, pues perderia nuevas escrituras.
Revertir codigo no recupera PDF eliminados fisicamente ni revierte telefono/C.P./CURP.

## 6. Evidencia y limites

`.cache/pd78-20261030/pd08-results.json` contiene todos los conteos, hashes,
constraints, comandos H05 y tiempos; pd08-first-results.json conserva el ensayo
inicial. previous-read-results.json registra las tres consultas del codigo previo.
Los scripts/copias/dumps sinteticos quedan locales, ignorados por Git.

No se repitio la suite de integracion general, cuyo reset no forma parte de esta
verificacion. Se probaron directamente migraciones, restores y lectura API. No se
consulto la version ni el estado actual de Cloud SQL; PostgreSQL 18.6 local no
demuestra por si solo paridad con el destino real. Falta probar el artefacto exacto
de rollback y preparar backup/inspect/ventana productivos con autorizacion separada.

## 7. Limpieza y confirmaciones

Se retiraron los contenedores por nombre/etiqueta exactos y sus datos tmpfs;
cleanup-results.json confirma ausencia posterior. Backups sinteticos y evidencia
quedan locales para trazabilidad. La BD local habitual no se consulto, reinicio,
restauro ni modifico.

Solo 016/017 aplicadas por H05 en destinos efimeros, despues de construir el esquema
sintetico previo. Sin migraciones productivas, deploy, cambios SQL versionados,
codigo funcional, dependencias, H01, datos personales ni historicos reales.
No commit/push en esta fase. PD-08 avanza en su ensayo local; H24 sigue NO-GO por
los hallazgos PD-07 y demas gates pendientes.
