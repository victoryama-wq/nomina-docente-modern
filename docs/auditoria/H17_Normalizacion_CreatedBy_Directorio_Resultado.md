# H17 - Resultado normalizacion `teachers.created_by` en Directorio

Fecha: 2026-06-04

## 1. Contexto

H17 tenia como objetivo normalizar el capturador tecnico de docentes cargados
masivamente en Directorio. La regla funcional vigente se conserva:

- Coordinador/coordinadora edita solo docentes capturados por el/ella.
- No basta con pertenecer a la misma coordinacion.
- La fuente tecnica para Directorio es `teachers.created_by`.
- Coordinador/coordinadora no edita datos fiscales.

La normalizacion se ejecuto solo sobre docentes aprobados en el CSV/mapping H17
y solo cuando `teachers.created_by IS NULL`.

## 2. Backup productivo

Backup Cloud SQL creado antes de la escritura:

| Campo | Valor |
|---|---|
| Proyecto | `nomina-docente-prod` |
| Instancia | `nomina-docente-web` |
| Base protegida | `nomina_docente` |
| Backup ID | `1780616275581` |
| Tipo | `ON_DEMAND` |
| Estado | `SUCCESSFUL` |
| Inicio UTC | `2026-06-04T23:37:55.594Z` |
| Fin UTC | `2026-06-04T23:38:46.352Z` |

No se continuo hasta confirmar backup exitoso.

## 3. SQL ejecutado

Archivo versionado usado para preview:

- `database/validation/h17_created_by_from_csv_APPROVAL_REQUIRED.sql`

Propiedades del archivo versionado:

- Guard de base exacta `nomina_docente`.
- Transaccion explicita.
- Tabla temporal de mapping con 197 filas.
- `UPDATE` limitado a `teachers.created_by`.
- Condicion `teachers.created_by IS NULL`.
- Conteos antes/despues.
- Termina en `ROLLBACK` por defecto.

Para la ventana productiva se genero una copia temporal local con el mismo
contenido y cambio controlado del cierre de transaccion a `COMMIT`:

- `%TEMP%\h17_created_by_from_csv_COMMIT_EXECUTION.sql` (copia temporal usada durante la ejecución)

La copia temporal no forma parte del repositorio.

## 4. Preview con ROLLBACK

Resultado del preview productivo con el SQL versionado:

| Metrica | Resultado |
|---|---:|
| Filas en mapping temporal | 197 |
| Targets con `created_by IS NULL` antes | 197 |
| Targets con `created_by` existente | 0 |
| Filas que habrian sido actualizadas | 197 |
| Targets aun `NULL` dentro de transaccion | 0 |

El preview termino en `ROLLBACK`.

## 5. Ejecucion con COMMIT

Resultado de la ejecucion productiva controlada:

| Metrica | Resultado |
|---|---:|
| Filas en mapping temporal | 197 |
| Targets con `created_by IS NULL` antes | 197 |
| Targets con `created_by` existente | 0 |
| Filas actualizadas | 197 |
| Targets aun `NULL` despues del `UPDATE` | 0 |

Distribucion por capturador tecnico:

| Capturador tecnico | Docentes actualizados |
|---|---:|
| `elsa.garcia@tecplayacar.edu.mx` | 14 |
| `eslivet.aguilar@tecplayacar.edu.mx` | 46 |
| `josue.delgado@tecplayacar.edu.mx` | 11 |
| `lidia.medina@tecplayacar.edu.mx` | 13 |
| `mario.medina@tecplayacar.edu.mx` | 2 |
| `merit.bazan@tecplayacar.edu.mx` | 38 |
| `oriana.nah@tecplayacar.edu.mx` | 34 |
| `zulma.martinez@tecplayacar.edu.mx` | 39 |
| **Total** | **197** |

Decisiones humanas aplicadas:

- Elsa Garcia Vallejo/Elsa con acento se asigno a
  `elsa.garcia@tecplayacar.edu.mx`.
- Mario Medina/Mario Manuel Medina Ake se asigno a
  `mario.medina@tecplayacar.edu.mx`.
- Maricarmen/Maricarmen en coordinaciones compuestas queda bajo
  `merit.bazan@tecplayacar.edu.mx` cuando el CSV aprobado lo indico.

## 6. Validacion posterior

Validacion read-only posterior al `COMMIT`:

| Metrica | Resultado |
|---|---:|
| Filas del mapping esperado | 197 |
| Filas con `created_by` esperado | 197 |
| Filas del mapping aun `NULL` | 0 |
| Filas del mapping con `created_by` inesperado | 0 |
| Docentes globales aun con `created_by IS NULL` | 12 |

Docentes remanentes con `created_by IS NULL` por coordinacion/nombre operativo:

| Coordinacion / nombre operativo | Docentes remanentes |
|---|---:|
| Cristhian Alvarado Valencia | 1 |
| Elsa Garcia Vallejo | 1 |
| Eslivet Aguilar Santos | 1 |
| Maricarmen Martinez Martinez | 2 |
| Mario Medina | 1 |
| Oriana Nah Rosado | 3 |
| Simulacion Clinica | 2 |
| Sin coordinacion | 1 |
| **Total** | **12** |

Estos 12 registros no fueron parte del lote aprobado para escritura o requieren
decision adicional de operacion.

## 7. Alcance ejecutado

Se ejecuto una unica modificacion permanente:

- `UPDATE teachers SET created_by = <app_users.id>` para 197 docentes aprobados.

No se modifico:

- `teachers.updated_by`.
- `teachers.coordination_id`.
- Datos fiscales.
- Datos bancarios.
- Constancias o documentos fiscales.
- Nomina.
- Finanzas.
- CSV productivos.
- Snapshots.
- Horarios.
- Incidencias.
- Extras.
- Usuarios, roles o permisos.

No se crearon ni eliminaron docentes.

Nota tecnica: el SQL usa una tabla temporal de mapping dentro de la sesion de
psql. No hubo `INSERT` permanente en tablas funcionales.

## 8. Validacion funcional pendiente

Queda recomendada la validacion con usuarios reales autorizados:

- Zulma: puede editar docentes normalizados bajo su capturador.
- Eslivet: puede editar docentes normalizados bajo su capturador.
- Merit: puede editar docentes normalizados bajo su capturador.
- Elsa/Mario: validar si operacion requiere acceso real a esos docentes.
- Coordinador no puede editar datos fiscales.
- Coordinador no puede editar docentes de otro capturador.
- Admin conserva edicion global.

## 9. Confirmaciones

- No se ejecutaron migraciones.
- No se ejecuto `db:migrate`, `apply` ni `baseline`.
- No se hizo deploy.
- No se modifico codigo.
- No se modifico frontend.
- No se modifico backend.
- No se tocaron datos fiscales.
- No se toco nomina.
- No se tocaron finanzas.
- No se tocaron snapshots.
- No se toco `updated_by`.
- No se toco `coordination_id`.
- No se modificaron docentes con `created_by IS NOT NULL`.
