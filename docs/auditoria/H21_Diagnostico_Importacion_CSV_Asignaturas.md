# H21 - Diagnostico de importacion CSV de Asignaturas

Fecha: 2026-07-18

Estado: diagnostico y diseno; no implementado.

## 1. Resumen ejecutivo

El modulo actual permite a Admin listar, crear y editar asignaturas una por una.
No existe importacion CSV, clave oficial, busqueda sin acentos, paginacion ni
pruebas especificas del catalogo.

La base productiva confirma 281 asignaturas, cinco grupos que colisionan al
ignorar acentos y 594 horarios asociados. Por ello no es seguro usar el nombre
normalizado como llave de actualizacion.

Recomendacion: implementar H21 con una futura migracion `013` que agregue clave
oficial y busqueda normalizada indexada. El CSV debe identificar registros
legacy mediante `id` opcional y nunca fusionar por nombre.

## 2. Ambiente y metodo

| Concepto | Resultado |
|---|---|
| Rama | `feature/h02-h03-user-coordinations-permissions` |
| Estado Git inicial | Limpio y sincronizado con `origin` |
| Base inspeccionada | `nomina_docente` |
| Usuario DB | `app_nomina` |
| Modo SQL | `transaction_read_only=on` |
| PostgreSQL | 18.3 |
| Escrituras | Ninguna |

Se revisaron codigo Vue/TypeScript, Fastify, migraciones SQL, pruebas, SDD,
matriz, H05, H12 y H13. La inspeccion de Cloud SQL uso exclusivamente `SELECT`.
No se expusieron secretos.

## 3. Diagnostico del modulo actual

| Elemento | Implementacion real |
|---|---|
| Ruta frontend | `/catalogos`, route name `catalogs` |
| Vista principal | `apps/web/src/views/CatalogsView.vue` |
| Cliente API | `apps/web/src/api.ts` |
| Backend | `apps/api/src/routes/catalogs.ts` |
| Registro de rutas | `apps/api/src/routes.ts` |
| Listado/contexto | `GET /catalogs/context` |
| Alta | `POST /catalogs/subjects` |
| Actualizacion | `PATCH /catalogs/subjects/:id` |
| Inactivacion | No hay endpoint separado; se envia `status=INACTIVO` al PATCH |
| Eliminacion | No existe ruta DELETE de asignaturas |
| Frontend permission | `canManageCatalogs = isAdmin` |
| Backend guard | `requireCatalogAdmin`; Admin o superadmin protegido |
| Auditoria | `SUBJECT_CREATED` y `SUBJECT_UPDATED` en `audit_log` |

Columnas visibles:

- Asignatura;
- Estatus;
- Uso operativo;
- Historico;
- accion Editar.

Filtros actuales:

- texto por nombre, estatus y conteos de uso;
- estatus `TODOS`, `ACTIVO`, `INACTIVO`.

El backend devuelve todo el catalogo. La UI filtra en memoria con
`toLowerCase().includes()`, sin normalizacion de acentos ni indice de busqueda.

## 4. Esquema real de `subjects`

| Campo | Tipo | Nullable | Default | Unique | Uso actual |
|---|---|---:|---|---:|---|
| `id` | `uuid` | No | `gen_random_uuid()` | PK | Identificador tecnico y FK desde Horarios |
| `name` | `text` | No | Ninguno | Si, exacto | Nombre oficial visible |
| `status` | `user_status` | No | `ACTIVO` | No | `ACTIVO` / `INACTIVO` |

Indices:

- `subjects_pkey` B-tree por `id`;
- `subjects_name_key` B-tree unico por `name` exacto.

No existen:

- clave/codigo oficial;
- `normalized_name`;
- indice `unaccent` o trigram;
- `created_at`, `updated_at`, `created_by`, `updated_by` en `subjects`.

La auditoria existe fuera de la tabla en `audit_log`.

## 5. Evidencia productiva read-only

| Metrica | Resultado |
|---|---:|
| Asignaturas | 281 |
| Activas | 280 |
| Inactivas | 1 |
| Horarios | 594 |
| Horarios con `subject_id` | 594 |
| Horarios sin `subject_id` | 0 |
| Horarios en ciclo ACTIVO | 594 |
| Nombre de horario distinto al catalogo | 0 |
| Snapshots de asignatura en nomina | 4,738 |
| Duplicados ignorando solo case/espacios | 0 grupos |
| Posibles duplicados ignorando acentos/case/espacios | 5 grupos |
| Auditorias `SUBJECT_CREATED` | 6 |
| Auditorias `SUBJECT_UPDATED` | 2 |

Extensiones instaladas: `pgcrypto`, `plpgsql`.

Extensiones disponibles pero no instaladas: `unaccent` 1.1 y `pg_trgm` 1.6.

## 6. Dependencias e historicos

| Dependencia | Relacion | Efecto de renombrar | Efecto de inactivar |
|---|---|---|---|
| `schedules.subject_id` | FK a `subjects.id`, sin cascade | No actualiza `schedules.subject_name`; horarios existentes conservan el texto capturado | Horario sigue existiendo, pero la materia deja de aparecer en opciones activas |
| `schedules.subject_name` | Copia operativa del nombre | Conserva nombre anterior hasta editar el horario | Sigue visible en consultas del horario |
| `schedule_incidences` | Depende de `schedules` | Hereda el nombre mostrado por horario | No se elimina incidencia |
| `payroll_schedule_details.subject_name_snapshot` | Snapshot sin FK a `subjects` | No cambia | No cambia |
| Reportes vivos | Leen horario/catalogo segun ruta | Pueden conservar nombre capturado | Deben distinguir inactivo de borrado |
| Reportes historicos | Leen snapshot | No cambia | No cambia |

No hay DELETE de API. La FK de Horarios protege asignaturas usadas frente a un
borrado directo normal.

Riesgo operativo: el resolver de Horarios busca por `lower(name)` y crea una
asignatura nueva si no encuentra coincidencia. Una variante solo por acento
puede crear otro registro. Ademas, editar un horario cuya asignatura fue
inactivada puede fallar porque el resolver rechaza materias inactivas.

## 7. Diagnostico de busqueda y acentos

Implementacion actual:

- Catalogos: filtro frontend, `trim().toLowerCase()` y substring;
- unicidad API: `lower(name) = lower($1)`;
- Horarios: `lower(name) = lower($1)`;
- no `unaccent`;
- no columna normalizada;
- no indice funcional.

Resultado conceptual confirmado:

| Nombre almacenado | Busqueda | Resultado actual |
|---|---|---|
| `Administración de Empresas` | `administracion` | No encuentra |
| `Diseño Gráfico` | `diseno grafico` | No encuentra |
| `Introducción a la Programación` | `INTRODUCCION PROGRAMACION` | No encuentra |

La tercera busqueda tambien omite palabras intermedias. Para soportarla sin
quitar palabras del nombre, H21 debe normalizar y buscar todos los tokens.

## 8. Evaluacion de estrategias

### Opcion A - Reusar campo existente

No viable: no existe campo normalizado ni clave oficial.

### Opcion B - Normalizar cada consulta

Insuficiente como solucion final: sin indice degrada con crecimiento y no
resuelve la falta de clave estable para updates.

### Opcion C - Columna normalizada, clave e indices

Recomendada. Requiere futura migracion H05 `013`:

- `official_code` nullable para legado;
- `normalized_name` generado desde una funcion canonica;
- unicidad case-insensitive de clave;
- GIN trigram para busqueda;
- extensiones `unaccent` y `pg_trgm`.

No se creo la migracion durante este diagnostico.

## 9. Plantilla CSV propuesta

```csv
id,clave,nombre,estatus
```

`id` existe hoy y es necesario para asociar de manera inequivoca una clave a
una asignatura legacy. Para nuevas filas queda vacio. La clave sera obligatoria
para altas nuevas despues de aprobar la migracion.

La plantilla descargada debe poder incluir el catalogo actual para editarlo sin
copiar UUID manualmente. El archivo no debe incluir horarios, importes, nomina
ni otros datos.

Entrada: UTF-8 con/sin BOM, CRLF/LF, parser CSV real, 512 KiB y 5,000 filas como
limites iniciales propuestos. Columnas desconocidas y encabezados repetidos son
errores bloqueantes.

## 10. Reglas de matching

1. Resolver por `id` cuando se proporcione.
2. Resolver por clave oficial unica cuando ya exista.
3. Si ambos llegan, deben coincidir.
4. Un nombre parecido solo produce `POSIBLE_DUPLICADO_NOMBRE`.
5. No hacer update por nombre normalizado.
6. No usar UPSERT ciego.
7. No modificar una clave historica sin decision humana.

Los cinco grupos de colision normalizada detectados deben revisarse antes del
backfill de claves; no se fusionan automaticamente.

## 11. Riesgos principales

| Riesgo | Nivel | Control propuesto |
|---|---|---|
| Actualizar materia equivocada por nombre | Alto | Clave oficial + `id` de bootstrap; nombre solo advierte |
| Duplicados por acentos desde Horarios | Alto | Normalizador canonico y decision sobre auto-creacion |
| Inactivar materia usada en ciclo operativo | Alto | Estado bloqueante con conteo de horarios ACTIVO/PLANEACION |
| Preview obsoleto | Alto | Hash, fingerprint, lock, `FOR UPDATE` y revalidacion |
| Archivo manipulado | Medio-alto | Reparsear en apply; no confiar acciones del frontend |
| CSV mal parseado | Medio | Parser declarado; no `split(',')` |
| Perder historia por rename/delete | Alto | No DELETE; horarios y snapshots sin propagacion |
| Busqueda lenta | Medio | `normalized_name` + GIN trigram |
| Dependencia transitiva no declarada | Medio | Aprobar parser directo y auditar antes de instalar |

## 12. API y frontend propuestos

API:

```text
GET  /catalogs/subjects?q=&status=&page=&pageSize=
GET  /catalogs/subjects/import/template?scope=blank|catalog
POST /catalogs/subjects/import/preview
POST /catalogs/subjects/import/apply
```

El preview no escribe. Apply revalida el archivo, compara fingerprint, usa una
sola transaccion y registra auditoria. No se guarda el contenido completo del
CSV.

UI:

- Descargar plantilla;
- Importar CSV;
- selector y ayuda;
- preview con conteos y estados;
- tabla before/after y errores por fila;
- confirmacion explicita;
- progreso y resultado.

## 13. Permisos actuales y futuros

Permiso vigente efectivo: solo Admin.

- UI oculta Catalogos con `canManageCatalogs = isAdmin`.
- Router protege `/catalogos` con `canManageCatalogs`.
- API autentica y aplica `requireCatalogAdmin`.
- Direccion, Coordinador, RH, Finanzas, Contador y Contabilidad no gestionan
  Asignaturas.

H21 debe reutilizar exactamente estas guardas. No se propone permiso nuevo.

## 14. Pruebas propuestas

Cobertura minima:

- parser UTF-8/BOM/CRLF/LF/comillas/saltos;
- normalizacion de acentos/case/espacios/puntuacion;
- busqueda tokenizada;
- altas y cambios por clave;
- bootstrap legacy por `id`;
- colisiones de clave y nombre;
- correccion de acento vs cambio sustancial;
- inactivacion explicita y bloqueo por uso operativo;
- ausencia en CSV sin efecto;
- preview read-only;
- apply atomico y conflicto de concurrencia;
- Admin permitido, demas roles 403;
- horarios y snapshots sin eliminacion/cambio;
- limites y encabezados invalidos;
- auditoria sin CSV completo.

## 15. Decisiones humanas pendientes

- aprobar migracion `013` y extensiones;
- confirmar formato/longitud de clave institucional;
- aprobar `id` en la plantilla precargada;
- decidir si Horarios puede seguir creando materias libres sin clave;
- aprobar parser CSV directo tras revision npm;
- confirmar limites finales de archivo/filas.

## 16. Resultado

H21 queda en estado:

```text
Diagnostico y diseno; no implementado
```

## 17. Confirmaciones

- No se modifico codigo.
- No se modifico SQL.
- No se creo ni ejecuto migracion.
- No se modifico base de datos.
- Las consultas a Cloud SQL fueron read-only.
- No se instalaron dependencias.
- No se cambiaron permisos.
- No se hizo deploy.
- No se modifico H01.
