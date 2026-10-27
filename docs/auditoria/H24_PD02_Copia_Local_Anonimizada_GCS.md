# H24-PD-02 - Copia local saneada y preparacion GCS

Fecha: 2026-10-27.
Rama: `feature/h02-h03-user-coordinations-permissions`.
Base de codigo: `be4646d`.
Resultado inicial: **BD local preparada; GCS bloqueado por cuota de facturacion. PD-02 abierto. H24 NO-GO.**

Continuacion 2026-10-27: cuota aprobada por el usuario, facturacion vinculada y
bucket aislado creado. Ensayos reales de adaptador, permisos, borrado y API/BD
local satisfactorios: **PD-02 cerrado tecnicamente en local/test; H24 sigue NO-GO**.
Ver [resultado GCS](H24_PD02_Resultado_GCS_Aislado.md), incluidos casos sin actor
RH/Contador, Firebase real pendiente y registros sinteticos conservados en la BD.
Este documento conserva la cronologia de exportacion/preparacion anterior; su
seccion 6 describe el bloqueo inicial, ya superado, no la facturacion vigente.

## 1. Autorizaciones y limites

El usuario autorizo exportacion productiva por lectura, restauracion y
anonimizacion local, preparacion de `nomina_docente_test` y bucket aislado H24,
sin modificar produccion ni desplegar. Luego confirmo proyecto exclusivo y
vinculacion de la cuenta de facturacion abierta terminada en `35CA7B`, region
`us-central1`, hasta 150 MiB de PDF sinteticos, sin prueba de carga.

La autorizacion no permite usar produccion como alternativa al proyecto de
pruebas, cambiar su IAM ni importar datos de vuelta. Se conservaron los cuatro
cambios documentales pendientes de la preparacion PD-02 anterior.

## 2. Exportacion de origen, solo lectura

Origen confirmado mediante Cloud SQL Admin describe y conexion PostgreSQL:

| Dato | Resultado |
|---|---|
| Proyecto origen | nomina-docente-prod |
| Instancia | nomina-docente-web, PostgreSQL 18, us-central1 |
| Base / usuario | nomina_docente / app_nomina |
| Conexion | Cloud SQL Auth Proxy 2.21.3, listener temporal 127.0.0.1:55441 |
| Guarda | current_database=nomina_docente; transaction_read_only=on |
| Herramienta | pg_dump 18 local, formato custom, sin owners/ACL/large objects |
| Opciones de sesion | default_transaction_read_only=on, statement_timeout=300000, lock_timeout=5000; espera de lock del dump 5 s |
| Fin de exportacion UTC | 2026-10-27T21:36:46.6177084Z |
| Tamano | 3,063,451 bytes |
| SHA-256 copia cruda | BFDD88C607DA6C560CC424EA6C4C96F800092C1E14BFCFA8A516E40A66D3339C |

Credencial existente obtenida en memoria desde Secret Manager, no impresa ni
guardada en un archivo del repositorio. No se crearon roles ni objetos en origen.
No se ejecuto H05 contra produccion. Proxy detenido al terminar la exportacion.
No se descargaron PDFs ni objetos de Constancias/GCS.

El dump es una copia logica consistente, no un nuevo backup administrado Cloud SQL
ni una prueba de restauracion de la instancia productiva.
[Comportamiento de pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html).

## 3. Cuarentena y saneamiento local

Se creo directorio fuera de Git, con herencia ACL desactivada y acceso limitado al
usuario Windows actual y SYSTEM:

`C:\Users\Admin\AppData\Local\NominaDocente\H24-PD02-20261027`.

Un cluster PostgreSQL nuevo con SCRAM, password aleatorio y escucha solo loopback
restauro la copia en `h24_pd02_quarantine`. CONNECT publico revocado; sin API/web,
sin identidades productivas conectadas. No se uso ni sobrescribio el PostgreSQL
previo en 5432, que tiene observacion de namespace/backup pendiente desde F3.

Saneamiento transaccional exclusivamente en cuarentena:

- UUID sustituidos aleatoriamente en todas las columnas UUID, manteniendo relaciones.
  Mapping temporal eliminado al terminar; no se publico correspondencia nominal.
- Docentes, usuarios, coordinaciones, asignaturas y tabuladores con nombres QA.
- RFC, banco, correo/telefono de docente, tipo de pago y campos libres vaciados;
  identificadores externos sinteticos, sin legacy identifiers.
- firebase_uid y legacy_username eliminados; correos de usuarios artificiales
  `h24.qa.<valor-aleatorio>@tecplayacar.edu.mx` para conservar el CHECK del esquema.
  No son cuentas de Firebase creadas ni destinatarios autorizados para enviar correo.
- Payloads JSON y alertas vaciados; nombres snapshot saneados; importes y horas
  historicas sustituidos por valores sinteticos, no utilizables para validar Nomina.
- Auditoria y referencias a constancias eliminadas de la copia; dos schemas de
  staging/backup y nueve tablas import_backup retirados solo localmente.
- Roles/codigos/permisos y estados se conservaron; UUID de sus relaciones remapeados.
  Registro H05 conserva versiones/checksums; actor/ambiente/database se identifican
  como copia test y sus intentos productivos no se conservan como ejecuciones locales.

La desactivacion transaccional de triggers durante remapeo solo ocurrio en la
cuarentena bajo superusuario local. Se restauraron controles y se recrearon/validaron
47 FK antes del commit; la restauracion limpia posterior tambien valido constraints.
Dos intentos previos se detuvieron sin commit: guarda de direccion (inet con /32)
y campo firebase_uid UNIQUE. El arnes local se corrigio, no el codigo de aplicacion.

Comprobacion interna, sin imprimir valores: cero coincidencias residuales con
valores origen no triviales de nombre, correo, telefono, RFC, banco, UID y nombre
de coordinacion. No es una certificacion matematica de anonimato: fechas,
categorias, estados y estructura de relaciones se conservan para QA; la copia
continua siendo restringida y no debe publicarse ni compartirse fuera del ensayo.

## 4. Base final disponible

Se exporto el resultado saneado, se detuvo cuarentena y se creo OTRO cluster limpio.
La BD final se restauro desde el dump saneado, no desde archivos fisicos crudos.

| Parametro | Valor |
|---|---|
| Host / puerto | 127.0.0.1:55440 |
| Base | nomina_docente_test |
| Usuario aplicacion | app_nomina, sin superusuario/CREATEDB/CREATEROLE/replicacion |
| Autenticacion | SCRAM con secreto local aleatorio, no documentado |
| API / frontend | No levantados en esta ejecucion |
| Cluster antiguo 5432 | Conservado sin modificaciones |

Resumen de conteos origen/final, no evidencia nominal:

| Tabla | Origen | Copia final |
|---|---:|---:|
| teachers | 271 | 271 |
| app_users | 21 | 21 |
| coordinations | 31 | 31 |
| subjects | 1087 | 1087 |
| academic_cycles | 2 | 2 |
| payroll_calendar_config | 12 | 12 |
| schedules | 1305 | 1305 |
| payroll_runs | 19 | 19 |
| payroll_lines | 4455 | 4455 |
| payroll_schedule_details | 12020 | 12020 |
| payroll_extra_details | 1058 | 1058 |
| teacher_documents | 15 | 0 |
| audit_log | 3693 | 0 |

Las filas de Nomina/snapshots locales son material saneado, no evidencia contable
ni historicos verdaderos. Las tablas productivas no fueron modificadas.

## 5. H05 exclusivamente local

`inspect` previo sobre 55440: 18 registradas, 1 pendiente (solo 016), mismatch=0.
El arnes rechazo cualquier pendiente/checksum diferente antes de ejecutar el runner.
Se aplico `016_h24_teacher_dossier.sql` mediante H05 solo en la copia test.
No se reaplicaron 001 a 015, ni se hizo baseline nuevo.

Resultado posterior:

- 19 registradas: 15 baseline, 4 applied; pending=0; checksum mismatch=0.
- teacher_dossier_documents y teacher_dossier_operations: creadas y vacias.
- Conteos y fingerprints de todas las tablas funcionales saneadas identicos antes
  y despues de 016; solo nuevas tablas y registro administrativo H05.
- Cero constraints sin validar y cero triggers de usuario deshabilitados.
- Cero campos sensibles residuales comprobados en teachers; cero UID Firebase.
- Advertencias historicas 007/008/009 sin cambios.

Backup final saneado: `nomina_docente_test_h24_sanitized.dump`, SHA-256
`530C007C09083BC596292A343D9FBE4AE731E8DE0C7A6C2D94EE151E2C18A1D4`.
Tambien se conserva `sanitized-pre-h24.dump`, cuya restauracion fue probada antes
de aplicar 016. El backup final post-016 se genero correctamente; no se hizo una
segunda restauracion de ese archivo final. No confundir los dos niveles de evidencia.

PD-08 obtiene evidencia de restauracion limpia y ensayo H05 local; no se da por
cerrado todo PD-08 ni se afirma reparado el cluster antiguo o aprobado backup de
release productivo. No correr test:db:prepare/test:api:integration indiscriminadamente
contra esta copia: el harness actual resetea datos y destruiria este dataset QA.

## 6. Proyecto GCS y bloqueo externo

Se creo exclusivamente el proyecto de pruebas:

- ID: `nomina-h24-test-20261027`.
- Numero: `234692275301`.
- Nombre: Nomina H24 pruebas aisladas.
- Creacion UTC: 2026-10-27T21:43:46.809Z.
- Labels: environment=test, purpose=h24-test.
- No se cambio el proyecto activo global de gcloud.

Se intento vincular la cuenta abierta autorizada con `gcloud billing projects link`.
Resultado: **FAILED_PRECONDITION / QuotaFailure: Cloud billing quota exceeded**.
Consulta posterior confirma billingEnabled=false y billingAccountName vacio.
No se creo bucket ni SA/roles/bindings adicionales de runtime/auditoria; no se
ejecutaron pruebas de carga, permisos, reemplazo o borrado en GCS real.
El alta de proyecto habilito Cloud APIs como parte del flujo de Google; no se
desplego API, Hosting, Cloud SQL, worker ni otros servicios de aplicacion.

No se intento eludir la cuota usando el proyecto productivo o otro proyecto sin
aprobacion. No se elimino el proyecto nuevo: queda reservado para continuar.
Accion humana necesaria: ampliar la cuota de vinculacion de proyectos en la cuenta
autorizada, o indicar/aprobar otra cuenta abierta. Despues verificar el vinculo y
provisionar bucket e IAM conforme al [plan PD-02](H24_PD02_Plan_Validacion_GCS_Aislado.md).

## 7. Custodia, limpieza y continuidad

A las 2026-10-27T21:48:30Z se verifico cuarentena detenida y se eliminaron sus
archivos fisicos, el dump crudo y el SQL de esquema privado. Rutas absolutas
comprobadas dentro del directorio autorizado; no borrado de cluster anterior.
Es eliminacion logica del filesystem, no garantia de borrado forense del disco.

El directorio restringido conserva dumps saneados, datos del cluster final,
credenciales locales y evidencia agregada:
export-manifest.json, anonymization-manifest.json, h05-local-evidence.json,
cleanup-manifest.json y logs locales. Nada de ello se agrega a Git.
Arneses temporales `.cache/h24-pd02-*.ps1` / `.mjs` ignorados, sin secretos embebidos.

El cluster test queda levantado solo en 127.0.0.1:55440. Para administrarlo usar
pg_ctl de PostgreSQL 18 con el data directory local `H24-PD02-20261027/test-data`;
no usar el servicio 5432 por omision. Conexion privada en
`test-connection-private.json`, fuera del repo; no pegarla en conversaciones.
No arrancar API con defaults productivos ni reutilizar credenciales de origen.
El ensayo GCS/Firebase real sigue pendiente, no se inventa una sesion autorizada.

## 8. Validaciones y confirmaciones

- Export read-only, restauracion en cuarentena, saneamiento transaccional,
  restauracion limpia, constraints y backup saneado: satisfactorios.
- H05 local 016 y comprobacion de fingerprints/inspect: satisfactorios.
- GCS real: NO ejecutado; bloqueo de facturacion documentado.
- Git diff --check, diff --name-only y status: revision documental.
- Tests/build de aplicacion no ejecutados: no hubo cambios funcionales ni se quiso
  disparar el reset de integracion sobre el dataset recien preparado.
- Sin escrituras productivas, migraciones productivas, deploy, descarga de PDFs
  reales, importacion hacia produccion ni cambios H01.
- Si hubo escrituras y migracion en la COPIA LOCAL autorizada y creacion de un
  proyecto cloud de pruebas. No afirmar que esta fase fue enteramente read-only.
- Sin commit/push automaticos. H24 y PD-02 no cerrados.
