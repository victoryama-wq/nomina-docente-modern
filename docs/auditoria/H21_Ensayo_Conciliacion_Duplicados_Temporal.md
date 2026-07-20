# H21 - Ensayo de conciliacion de duplicados en copia temporal

Fecha: 2026-07-20

Estado: satisfactorio; instancia temporal eliminada; produccion sin cambios.

## 1. Ambiente aislado

| Campo | Valor |
|---|---|
| Proyecto | `nomina-docente-prod` |
| Instancia origen | `nomina-docente-web` |
| Backup | `1784484000000`, `SUCCESSFUL` |
| Inicio / fin backup | `2026-07-19T20:16:23.138Z` / `2026-07-19T20:17:13.866Z` |
| Instancia temporal | `h21-reconcile-20260720` |
| Creacion | operacion `c0d6b577-2782-4257-a855-c50c00000032` |
| Restore | operacion `21060d95-ba94-4836-a753-354d00000032` |
| Conexion | Cloud SQL Auth Proxy `127.0.0.1:25435`, `--gcloud-auth` |
| Commit funcional | `1b449a1 fix(h21): reconcile legacy duplicate subjects` |

La instancia productiva se uso solo como origen del backup administrado. Todo
DDL y DML del ensayo ocurrio en la instancia temporal.

## 2. Estado inicial

| Conjunto | Filas | Fingerprint inicial |
|---|---:|---|
| `subjects` | 281 | `ab88a830c98298de78ccd237e63bc960` |
| `schedules` | 594 | `381730e61136ef7923070ae5a5f6d7c4` |
| `payroll_schedule_details` | 4,738 | `4c389ace4317ff2fe881fe7602d73113` |
| `payroll_extra_details` | 429 | `f5b91ac75707e98a400e93d3169a05df` |
| `payroll_runs` | 8 | `3a56666d0ffd19c5569af19ad14c18f3` |

Los conteos por grupo fueron `1, 1, 1, 1, 4`: ocho horarios a mover.

## 3. Migracion 013 en temporal

H05 reporto 16 archivos, 15 baseline, un pendiente (`013`) y cero checksum
mismatch. Se aplico exclusivamente `013_h21_subject_import_search.sql` a la
copia temporal. Produccion conservo baseline 001-012.

## 4. Preview SQL con ROLLBACK

El archivo versionado se ejecuto sin modificar su cierre:

- diez UUID y cinco mappings validados;
- ocho horarios bloqueados y reasignados dentro de la transaccion;
- cinco duplicados inactivos y cinco canonicos activos dentro del preview;
- cinco eventos canonicos, cinco de duplicado y uno resumen dentro del preview;
- cierre `ROLLBACK` satisfactorio.

Despues del rollback, los conteos y fingerprints iniciales coincidieron
exactamente. No quedo ningun cambio del preview.

## 5. Copia COMMIT temporal

Se genero fuera del repositorio una copia que cambio unicamente la ultima
sentencia `ROLLBACK` por `COMMIT`.

Resultado:

- ocho horarios reasignados;
- cinco UUID canonicos `ACTIVO`;
- cinco UUID duplicados `INACTIVO`;
- grupo 3: canonico activado correctamente;
- 281 asignaturas y 594 horarios, sin eliminaciones;
- cero horarios huerfanos;
- 11 eventos H21 en `audit_log`;
- los ocho IDs de horario y todas sus columnas distintas de
  `subject_id`/`subject_name` permanecieron iguales.

Los canonicos quedaron con 3, 2, 1, 2 y 6 horarios totales respectivamente,
incluyendo los horarios que ya poseian antes de la conciliacion.

## 6. Integridad historica posterior

| Conjunto protegido | Filas despues | Fingerprint despues | Resultado |
|---|---:|---|---|
| `payroll_schedule_details` | 4,738 | `4c389ace4317ff2fe881fe7602d73113` | Igual |
| `payroll_extra_details` | 429 | `f5b91ac75707e98a400e93d3169a05df` | Igual |
| `payroll_runs` | 8 | `3a56666d0ffd19c5569af19ad14c18f3` | Igual |

Los fingerprints completos de `subjects` y `schedules` cambiaron solo porque
esas son las tablas objetivo aprobadas. Las guardas SQL verificaron que ninguna
otra columna de los ocho horarios cambiara.

## 7. Plantilla y preview H21

Con `app.inject()` y actor Admin de test sobre la copia conciliada:

| Validacion | Resultado |
|---|---|
| Plantilla de catalogo activo | HTTP 200, 276 filas |
| Preview | HTTP 200, 276 filas |
| `SIN_CAMBIOS` | 276 |
| `DUPLICADO_NOMBRE_CSV` | 0 |
| `POSIBLE_DUPLICADO_NOMBRE` | 0 |
| Filas bloqueantes | 0 |
| Apply CSV | No ejecutado |

## 8. Regresion

- API: 22/22.
- Web: 61/61.
- Integracion PostgreSQL: 83/83, solo `nomina_docente_test`.
- Typecheck: OK.
- Build: OK.
- Prueba enfocada H21: 14/14.
- `npm audit`: 0 critical; vulnerabilidades residuales documentadas fuera de
  esta conciliacion, sin `npm audit fix` ni cambios de dependencias.

## 9. Limpieza

- Proxy local cerrado.
- Archivos temporales de ejecucion eliminados.
- Instancia `h21-reconcile-20260720` eliminada.
- Verificacion posterior: la instancia ya no aparece en Cloud SQL.
- Backup `1784484000000` conservado.

## 10. Conclusion

La conciliacion es tecnicamente reproducible y conserva la integridad
historica protegida. H21 queda prevalidado para una ventana productiva
controlada, pero no ejecutado ni desplegado en produccion.

## 11. Confirmaciones

- Sin migraciones productivas.
- Sin escrituras en `nomina-docente-web`.
- Sin DELETE ni fusion fisica de asignaturas.
- Sin cambios de snapshots, Nomina o H01.
- Sin deploy.
