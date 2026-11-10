# H24 - Diagnostico de permisos PostgreSQL y dictamen H05 favorable

Fecha: 2026-11-10. **Acceso existente verificado; H05 inspect favorable para
57c565a. Solo lectura. 016/017 NO aplicadas; H24 no queda habilitado para uso
productivo por este dictamen.**

## 1. Alcance y trazabilidad

- Candidata exacta: `57c565a6a6ed3b4c2dca21292289893b94fc6a5d`.
- Acta precedente: commit `7b0e9a4c89bfd16a0d2eda2c682a444ffa729805`,
  [ventana del 9 de noviembre](H24_Ventana_Respaldo_Migraciones_Worker_20261109.md).
- Rama: `feature/h02-h03-user-coordinations-permissions`.
- Destino: proyecto `nomina-docente-prod`, instancia `nomina-docente-web`,
  region `us-central1`, base `nomina_docente`. Instancia observada RUNNABLE.
- Diagnostico: 2026-11-10T17:29:33.159Z a 2026-11-10T17:29:52.205Z;
  12:29:33 a 12:29:52 en America/Cancun, dentro del horario 06:50-22:00.
- Backup de referencia: `1794261106620`, SUCCESSFUL en el acta anterior.
  No se genero otro respaldo ni se reconfirmo su vigencia/restaurabilidad aqui.

El usuario autorizo usar la credencial existente referenciada por
`db-app-nomina-password` exclusivamente para autenticar `app_nomina`, consultar
catalogos/permisos y ejecutar inspect si las tablas de control eran legibles.
La credencial se mantuvo en memoria, sin imprimirla, argumentos visibles ni
archivos de evidencia. No se cambio el secreto ni la configuracion de API.

El bloqueo del 9 de noviembre permanece como evidencia historica. Este resultado
posterior demuestra una ruta disponible sin restablecer contrasenas; no acredita
retroactivamente que se hubiese ejecutado H05 en aquella ventana.

## 2. Conexion protegida y metodo

Se utilizo Cloud SQL Auth Proxy propio, restringido a loopback, con las
credenciales Google Cloud ya renovadas. La identidad cloud permite el canal;
la autenticacion y los privilegios PostgreSQL se verificaron separadamente.

| Control confirmado antes de consultar permisos | Resultado |
|---|---|
| current_database | nomina_docente |
| session_user / current_user | app_nomina / app_nomina |
| transaction_read_only | on |
| default_transaction_read_only | on desde las opciones de conexion |
| statement_timeout | 15s |
| lock_timeout | 3s |
| idle_in_transaction_session_timeout | 15s |
| Timeout de conexion | 10s |
| Version del servidor | 18.6 |

Se consultaron pg_roles, pg_auth_members, pg_database, pg_namespace, pg_class,
pg_attribute, pg_attrdef, pg_depend y funciones de comprobacion de privilegios.
No se consultaron filas de docentes, expedientes, finanzas, Nomina o snapshots.
La transaccion de catalogos fue READ ONLY y termino en ROLLBACK.
No se ejecuto SET ROLE, nextval, DDL ni DML para probar capacidades.

## 3. Atributos, membresias y propietarios

`app_nomina` tiene LOGIN, INHERIT, CREATEROLE y CREATEDB; no tiene SUPERUSER,
REPLICATION ni BYPASSRLS. Su membresia directa en `cloudsqlsuperuser` tiene
inherit_option=true, set_option=true y admin_option=false.

Las comprobaciones MEMBER/USAGE/SET tambien resultaron positivas para
pg_checkpoint, pg_monitor, pg_read_all_settings, pg_read_all_stats,
pg_signal_backend y pg_stat_scan_tables a traves de las membresias existentes;
pg_database_owner resulto efectivo en esta base. No se utilizaron esas
capacidades para administrar sesiones, ejecutar checkpoints o leer datos.
CREATEROLE se comprobo como atributo del propio login, no se infirio por herencia.

| Objeto | Propietario | Autoridad comprobada de app_nomina |
|---|---|---|
| nomina_docente | cloudsqlsuperuser | Propiedad heredada; CONNECT y delegacion de CONNECT |
| public | pg_database_owner | Propiedad efectiva; CREATE, USAGE y delegacion de USAGE |
| teachers, app_users | cloudsqlsuperuser | Autoridad de propietario heredada; REFERENCES sobre id |
| schema_migrations, schema_migration_runs | app_nomina | Propiedad directa; SELECT e INSERT disponibles |
| schema_migration_runs_id_seq | app_nomina | Propiedad directa; USAGE y SELECT disponibles |
| teacher_documents, roles, permissions, role_permissions, audit_log | cloudsqlsuperuser | Propiedad heredada y permisos concedibles requeridos |

`teachers` no pertenece directamente a app_nomina, pero la autoridad del
propietario esta disponible mediante la membresia heredable comprobada.
La conclusion sobre ALTER TABLE no se basa en UPDATE ni ALL de tabla.
Las nueve tablas existentes inspeccionadas tienen RLS y FORCE RLS desactivados.

## 4. Capacidad para el worker

Se comprobaron como concedibles los permisos de la propuesta de
[infraestructura H24](../../ops/h24/README.md):

- CONNECT a la base y USAGE de public.
- SELECT de teacher_documents y UPDATE solo de su columna document_type.
- SELECT de app_users: id, status, is_protected_super_admin y role_id.
- SELECT de roles/permissions: id y code; role_permissions: role_id y permission_id.
- INSERT de audit_log: actor_user_id, action, entity_type, entity_id y metadata.

Las 18 comprobaciones por columna, incluidas las referencias de 016, resultaron
positivas. audit_log.id usa UUID con gen_random_uuid(), sin secuencia asociada;
la funcion existe y app_nomina tiene EXECUTE. El default de la secuencia del
ledger se leyo como metadata, sin invocar nextval.

`h24_dossier_worker` no existe. Tampoco existen teacher_dossier_documents ni
teacher_dossier_operations: sus concesiones no pueden validarse como permisos
actuales. Si 016 las crea bajo app_nomina, este tendra autoridad de propietario;
debera reconfirmarse despues de la aplicacion autorizada, antes de conceder
SELECT/UPDATE/DELETE segun la propuesta minima.

No hace falta delegar cloudsqlsuperuser al worker; app_nomina no tiene
admin_option sobre esa membresia y no se propone concederla. La capacidad de
crear/conceder no certifica aun el acceso efectivo minimo del futuro worker:
faltan su provision autorizada y verificacion de herencia/PUBLIC/credencial.
Los privilegios amplios de la cuenta de aplicacion son una observacion de
seguridad separada; no se redujeron ni ampliaron durante el diagnostico.

## 5. H05 inspect sobre la candidata exacta

Se extrajeron los 20 SQL raiz, tools/migrate-db.ts y package.json directamente
de los blobs de 57c565a a una carpeta local externa a Git. Se verifico igualdad
byte a byte y se registraron SHA-256; no hubo conversion LF/CRLF ni edicion SQL.
Se reutilizaron dependencias locales sin instalar y npm 10.9.4.

Se ejecuto exclusivamente `npm run db:migrate:inspect`, con opciones de sesion
read-only y tiempos acotados tambien para el runner. Su guarda general
ALLOW_PRODUCTION_MIGRATIONS se habilito solo en el proceso hijo para inspect;
no se habilitaron CONFIRM_PRODUCTION_APPLY ni CONFIRM_PRODUCTION_BASELINE.

| Criterio | Esperado | Observado | Resultado |
|---|---|---|---|
| public.schema_migrations | Presente y legible | Si | PASS |
| public.schema_migration_runs | Presente y legible | Si | PASS |
| Archivos de la candidata | 20 | 20 | PASS |
| Registradas | 18 | 18 | PASS |
| Baseline / aplicadas | 15 / 3 | 15 / 3 | PASS |
| Ultima aplicada | 015_h23_cycle_base_hours_dates | Coincide; 013 y 014 tambien applied | PASS |
| Pendientes | Solo 016 y 017 | 016_h24_teacher_dossier; 017_h24_teacher_fiscal_identity | PASS |
| Checksum mismatch | 0 | 0 | PASS |
| Codigo de salida | 0 | 0 | PASS |

Advertencias revisadas por identificador completo, sin renombrar ni reaplicar:

| Prefijo historico | Archivos distintos, ambos baseline |
|---|---|
| 007 | 007_direction_hr_roles.sql; 007_incidence_period_locking.sql |
| 008 | 008_direction_live_payroll.sql; 008_payroll_status_workflow.sql |
| 009 | 009_access_windows.sql; 009_payroll_correction_flow.sql |

La salida del runner recomienda dry-run automaticamente. No se siguio esa
recomendacion: dry-run escribe eventos y quedaba fuera de la autorizacion.

## 6. Tres dictamenes separados

| Pregunta | Dictamen y limite |
|---|---|
| Puede ejecutar inspect | Si, demostrado con ejecucion real y salida 0 |
| Tiene permisos para aplicar 016/017 | Si segun catalogos: CREATE, REFERENCES, funcion UUID, autoridad de propietario sobre teachers, ledger y secuencia. No se probo DDL ni garantiza ausencia de contencion o errores operativos |
| Puede crear el usuario y conceder permisos del worker | CREATEROLE y delegacion sobre objetos existentes comprobados. Las tablas nuevas y los permisos efectivos del usuario futuro requieren comprobacion posterior a 016 y provision autorizada |

No se identifico un permiso faltante de app_nomina para estas operaciones
previstas. No es necesario restablecer postgres para esta ruta. La autorizacion
de diagnostico no habilita escrituras: 016/017 y usuario dedicado siguen
pendientes de una ventana expresamente autorizada, con revision de vigencia del
backup existente y margen horario. No duplicar el respaldo por el bloqueo ya
resuelto. Su restauracion no se ensayo ni se declara probada.

## 7. Evidencia, cierre y separacion de alcance

Evidencia local sin credenciales en
`%LOCALAPPDATA%/NominaDocente/H24-Access-ReadOnly-20261110`:
result.json (permisos, hashes, tiempos, salida y limpieza), h05-inspect.txt
(salida con host de servidor omitido) y diagnostico/copia de fuente locales.
No se incorporan secretos, cadenas de conexion ni datos personales al repositorio.

Conexion de catalogos cerrada; runner terminado con salida 0; proxy propio
terminado y ausencia de listener local comprobada. No quedaron procesos propios
con la credencial. No se alteraron conexiones ajenas.

La verificacion manual del canal de alertas sigue siendo un asunto separado:
no se reabrio el formulario bloqueado ni se activo ninguna politica. El dictamen
no acredita entrega de alertas ni cierre de los demas requisitos de H24.

Confirmaciones: sin apply, dry-run, baseline, cambios de contrasena, usuarios,
grants, DDL/DML, respaldo nuevo, deploy, cambios H01 o modificacion de expedientes,
Nomina/snapshots. El cierre documental posterior no repite conexiones productivas.
Validacion documental: git diff --check y revision del diff/alcance; sin
tests/typecheck/build nuevos porque solo se modifica documentacion.
