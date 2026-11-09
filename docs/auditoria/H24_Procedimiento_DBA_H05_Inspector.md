# H24 | Cuenta temporal de lectura para la inspección H05

**Propuesta para revisión, no ejecutada.** La autorización anterior cubría
`inspect`, no la creación de cuentas, cambios de permisos ni terminación de sesiones.
Antes de ejecutar, aprobar por separado el alta, la duración y la retirada del
rol. No crear otro respaldo: la referencia de la ventana anterior es
`1793913186499`. No cambiar la cuenta de la aplicación, IAM, permisos de
`PUBLIC` ni reglas compartidas para que pase esta comprobación.

## 1. Preparar el puesto del DBA

1. Confirmar en Cloud SQL el proyecto `nomina-docente-prod`, instancia
   `nomina-docente-web`, región `us-central1`, RUNNABLE y horario de encendido.
2. Usar el canal institucional autorizado y su puerto local verificado. En
   Windows, **PowerShell** abre el programa; **psql** recibe los bloques SQL
   y los comandos que empiezan por barra invertida. No pegarlos en PowerShell.
3. Con el proxy autorizado escuchando en 127.0.0.1:15432, un ejemplo de
   apertura en PowerShell es `psql -X -h 127.0.0.1 -p 15432 -d nomina_docente -U postgres -W`.
   Usar esa identidad administrativa solo si está autorizada y dispone de
   CREATEROLE y del derecho a conceder los permisos sobre esos objetos. Introducir
   su contraseña PostgreSQL únicamente en el prompt oculto. No usar la contraseña
   de Google ni extraer la credencial de `app_nomina`. Si falta acceso, detener.
4. El alta propuesta es por SQL nativo en psql, **no** «Agregar usuario» en Cloud
   SQL con los valores predeterminados: un usuario integrado creado allí sin
   roles explícitos puede recibir `cloudsqlsuperuser`.
   [Usuarios y roles de Cloud SQL](https://docs.cloud.google.com/sql/docs/postgres/users).

## 2. Precheck en psql (sin escrituras)

```sql
SELECT current_database(), current_user,
       to_regclass('public.schema_migrations') AS historial,
       to_regclass('public.schema_migration_runs') AS ejecuciones,
       to_regrole('h05_inspector') AS rol_preexistente;
```

Esperar `nomina_docente`, identidad DBA correcta, ambas tablas presentes y rol
preexistente **NULL**. Si ya existe, no asumir su propiedad, no cambiar su clave
ni reutilizarlo: detener. Confirmar que las tablas son ordinarias y no tienen
seguridad por fila (RLS) que pueda ocultar historial:

```sql
SELECT relname, relkind, relrowsecurity, relforcerowsecurity
FROM pg_catalog.pg_class
WHERE oid IN ('public.schema_migrations'::regclass, 'public.schema_migration_runs'::regclass);
```

Esperar dos filas, tipo `r`, ambos indicadores falsos. No desactivar RLS.

## 3. Preparar el rol sin acceso de login

**Solo después de la aprobación.** En la sesión administrativa, ejecutar:

```sql
BEGIN;
CREATE ROLE h05_inspector NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE CONNECTION LIMIT 1;
GRANT CONNECT ON DATABASE nomina_docente TO h05_inspector;
GRANT USAGE ON SCHEMA public TO h05_inspector;
GRANT SELECT ON TABLE public.schema_migrations, public.schema_migration_runs TO h05_inspector;
ALTER ROLE h05_inspector IN DATABASE nomina_docente SET search_path = pg_catalog, public;
ALTER ROLE h05_inspector IN DATABASE nomina_docente SET default_transaction_read_only = on;
```

**No confirmar todavía.** Hacer las comprobaciones siguientes en **la misma sesión y
transacción**. Si alguna no pasa o no sabes interpretar el resultado, ejecutar
`ROLLBACK;` y detenerse. No conceder `pg_read_all_data`, privilegios sobre
«todas las tablas», permisos por defecto, membresías ni grant options.

## 4. Verificar permisos efectivos sin leer expedientes ni probar escrituras

**Atributos y membresías.** Se esperan todos los booleanos falsos (incluido
login en esta etapa), límite 1 y cero filas en la segunda consulta. Sin
membresías directas tampoco hay una cadena indirecta que el inspector pueda
activar con SET ROLE. NOINHERIT por sí solo no sería prueba suficiente.

```sql
SELECT rolcanlogin, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
       rolreplication, rolbypassrls, rolconnlimit
FROM pg_roles WHERE rolname = 'h05_inspector';
SELECT roleid::regrole AS rol_concedido
FROM pg_auth_members WHERE member = 'h05_inspector'::regrole;
```

**Acceso positivo.** Las primeras cuatro columnas deben ser verdaderas y las
dos últimas falsas:

```sql
SELECT has_database_privilege('h05_inspector',current_database(),'CONNECT') AS conecta,
       has_schema_privilege('h05_inspector','public','USAGE') AS usa_esquema,
       has_table_privilege('h05_inspector','public.schema_migrations','SELECT') AS lee_historial,
       has_table_privilege('h05_inspector','public.schema_migration_runs','SELECT') AS lee_ejecuciones,
       has_table_privilege('h05_inspector','public.schema_migrations','SELECT WITH GRANT OPTION') AS delega_historial,
       has_table_privilege('h05_inspector','public.schema_migration_runs','SELECT WITH GRANT OPTION') AS delega_ejecuciones;
```

**Acceso negativo.** Se esperan **cero filas**. Incluye permisos por columna,
vistas, particiones y tablas externas, no solo GRANT directos al usuario. Se
consultan catálogos y ACL, **no** datos de los objetos listados.

```sql
WITH objetos AS (
  SELECT c.oid, n.nspname, c.relname,
         c.oid IN ('public.schema_migrations'::regclass,
                   'public.schema_migration_runs'::regclass) AS permitido
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','p','v','m','f')
    AND n.nspname NOT IN ('pg_catalog','information_schema')
    AND n.nspname !~ '^pg_(toast|temp)'
)
SELECT nspname, relname FROM objetos
WHERE (NOT permitido AND has_any_column_privilege('h05_inspector',oid,'SELECT'))
   OR has_table_privilege('h05_inspector',oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
   OR has_any_column_privilege('h05_inspector',oid,'INSERT,UPDATE,REFERENCES')
ORDER BY 1,2;

SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='S' AND has_sequence_privilege('h05_inspector',c.oid,'USAGE,SELECT,UPDATE');
```

**Privilegios ambientales.** Revisar también los siguientes resultados.
Los derechos otorgados a `PUBLIC` existen aunque el rol no tenga membresías.
Un REVOKE solo al inspector no anula un derecho que recibe de PUBLIC.
[Privilegios](https://www.postgresql.org/docs/18/ddl-priv.html) y
[funciones de comprobación](https://www.postgresql.org/docs/18/functions-info.html).

```sql
SELECT datname, has_database_privilege('h05_inspector',oid,'CONNECT') AS conecta,
       has_database_privilege('h05_inspector',oid,'CREATE') AS crea_esquema,
       has_database_privilege('h05_inspector',oid,'TEMP') AS crea_temporales
FROM pg_database WHERE datallowconn ORDER BY datname;
SELECT nspname FROM pg_namespace
WHERE has_schema_privilege('h05_inspector',oid,'CREATE');
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS argumentos
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prosecdef AND has_schema_privilege('h05_inspector',n.oid,'USAGE')
  AND has_function_privilege('h05_inspector',p.oid,'EXECUTE');
```

No aceptar CREATE en esquemas/bases. TEMP suele existir por PUBLIC: no permite
escribir en las tablas H05, pero **sí** permite crear objetos temporales; no
certificar «sin escrituras» si está presente. CONNECT a otra base no prueba
lectura allí, pero impide afirmar aislamiento a una sola base. Si aparecen
TEMP, acceso a otras bases no previsto o rutinas SECURITY DEFINER sin revisar,
detener y someter a revisión antes de habilitar login. No ejecutar esas rutinas.
Los catálogos de sistema visibles por diseño no son datos de Nómina. Una
configuración `default_transaction_read_only` es una defensa complementaria
que el cliente puede modificar; **no sustituye** la revisión de privilegios.

## 5. Habilitar por una ventana breve y comprobar una sesión real

Solo tras pasar todos los controles: ejecutar `COMMIT;` para conservar el rol
**todavía NOLOGIN**. Fijar con el DBA la hora de vencimiento; el ejemplo siguiente
limita la contraseña a 30 minutos y nunca más allá del apagado previsto
(finalizar antes si cambia la ventana). No usar tras el horario de encendido.
En **psql**, una línea cada vez:

```text
SET password_encryption = 'scram-sha-256';
\password h05_inspector
SELECT LEAST(now()+interval '30 minutes', ((now() AT TIME ZONE 'America/Cancun')::date + time '22:00') AT TIME ZONE 'America/Cancun') AS vence \gset
ALTER ROLE h05_inspector LOGIN VALID UNTIL :'vence';
```

Usar un secreto temporal único en el gestor institucional. El comando
[\password de psql](https://www.postgresql.org/docs/18/app-psql.html)
solicita el secreto sin ponerlo en una sentencia en claro. No entregarlo por
chat, archivo, ticket o captura. VALID UNTIL limita la autenticación por
contraseña; **no expulsa** sesiones ya abiertas.

En otra ventana PowerShell, usar el mismo canal DBA y puerto verificados:
`psql -X -h 127.0.0.1 -p 15432 -d nomina_docente -U h05_inspector -W`.
En esa sesión nueva de psql:

```sql
SELECT current_user, session_user, current_database(),
       current_setting('transaction_read_only') AS solo_lectura;
SELECT version,filename,checksum_sha256,status FROM public.schema_migrations LIMIT 0;
SELECT 1 FROM public.schema_migration_runs LIMIT 0;
```

Esperar dos identidades `h05_inspector`, base correcta, `on` y ambas lecturas
sin error. No devolver filas ni probar UPDATE/DELETE siquiera «con rollback».
Salir con `\q` antes de abrir el runner (límite de una conexión). Solo en la
ventana de inspección autorizada, usar este perfil, no el del DBA, para
`npm run db:migrate:inspect` desde `3284a12`. Ver [entrega H05](H24_Ventana_Respaldo_Cloud_SQL_Inspeccion_H05_20261105.md).

## 6. Retirar el acceso

En la sesión administrativa, tras confirmar que el inspector terminó, bloquear
nuevos logins e invalidar la contraseña. **Confirmar antes de revisar sesiones**:

```sql
BEGIN;
ALTER ROLE h05_inspector NOLOGIN PASSWORD NULL;
COMMIT;
SELECT pid,datname FROM pg_stat_activity WHERE usesysid='h05_inspector'::regrole;
```

Esperar cero filas. Si queda una sesión, pedir al operador que la cierre. Si
no responde, **solo con autorización para desconectarla**, terminar únicamente
el PID verificado de esta cuenta y volver a comprobar. No terminar sesiones de
otros usuarios. Cuando ya no haya ninguna:

```sql
BEGIN;
REVOKE SELECT ON TABLE public.schema_migrations, public.schema_migration_runs FROM h05_inspector;
REVOKE USAGE ON SCHEMA public FROM h05_inspector;
REVOKE CONNECT ON DATABASE nomina_docente FROM h05_inspector;
DROP ROLE h05_inspector;
COMMIT;
SELECT to_regrole('h05_inspector') IS NULL AS retirado;
```

Esperar `retirado = true`. Si DROP falla por dependencias, ejecutar
`ROLLBACK;` si la transacción sigue abierta: el NOLOGIN anterior queda
confirmado. Investigar sin usar DROP OWNED, CASCADE ni cambiar objetos H05.
Eliminar el secreto temporal del gestor según procedimiento; cerrar el proxy propio.

**Evidencia mínima:** fecha/hora UTC, destino, resultado de los controles
positivos/negativos, excepciones PUBLIC (o su ausencia), vencimiento, cero
sesiones al retirar y comprobación final. No registrar contraseñas, tokens,
cadenas de conexión, listas de personal ni datos funcionales. Este procedimiento
no prueba que H05 haya pasado ni autoriza migraciones o un nuevo respaldo.
