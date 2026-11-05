# H24 / PD-DEST-01: reemplazo de constancia con siete días recuperables

**2026-11-05. PD-DEST-01 verificado y cerrado en GCS aislado para la candidata
`3284a12af189baeaff51335401d13e9923d9d51d`. No es un GO productivo.**
Punto de partida limpio: rama `feature/h02-h03-user-coordinations-permissions`,
candidato anterior `eb24250` y cierre documental `cb19e50`. La [ventana
anterior](H24_Ventana_Aislada_PreDeploy_20261105.md) terminó. Su rechazo de
la metadata del destino y su ensayo con retención cero son evidencia del
binario anterior, no del presente. No desactivar el borrado recuperable.

## Contrato

- Constancias: bucket autorizado, privado (UBLA y PAP), sin retención adicional
  ni holds. Exactamente 604800 segundos, como número o cadena decimal exacta;
  versionado omitido o explícitamente desactivado. Se rechaza metadata
  incompleta o incompatible antes de crear o borrar. La carga es create-only;
  la limpieza borra con precondición de generación.
- Antes de la publicación transaccional, un fallo conserva la referencia
  anterior. Desde la publicación solo B está disponible en Nómina, aunque A
  siga esperando limpieza. El worker reintenta sobre la referencia retirada,
  nunca sobre la vigente. El plazo comienza cuando GCS borra A, no al cargar B.
  Solo personal con permisos de restauración en Google Cloud puede recuperar
  la generación durante esos siete días. No hay acción de restauración en Nómina.
- Documentos adicionales: sin cambio de adaptador ni de política; exigen
  borrado definitivo. Sin purga retroactiva ni cambio a 016/017.

## Evidencia de la candidata

Prueba de reemplazo con dos PDF generados por PDFKit, en PostgreSQL 18 efímero
en Docker, loopback, `nomina_docente_test`, tablas temporales y rollback. Se
ejercitaron el servicio de reemplazo, el reconciliador, las consultas reales
de vigencia y el GET de Fastify. Identidad, almacenamiento y veredicto de
análisis sustituidos en este recorrido; no es un ensayo de IAM, AV ni GCS.

| Paso | Evidencia local |
|---|---|
| Cargar A y provocar fallo en la siguiente carga | GET devuelve A, nombre y SHA-256 coinciden. |
| Publicar B e interrumpir el borrado de A | Limpieza pendiente; una sola fila vigente (B). GET ya devuelve exclusivamente B. |
| Reintentar limpieza dos veces | Un retiro y después cero. Solo B en el almacén vivo simulado; GET de B conserva nombre y SHA-256. |

SHA-256 de los PDF sintéticos de referencia (comparados con los bytes HTTP en la prueba):

- A: `26acc10f67a0958f2cbaa75a0567181e92b2acd3c0f73d55b24d5a749f34a6ea`.
- B: `877860b4885b05169c1278c9e69baed6b609c46122cf7e5384b47551d55c17d2`.

| Regresión local | Resultado |
|---|---|
| API con pdfinfo, incluyendo guardas de ambos adaptadores, reemplazo, lectura y recuperación | 438 aprobadas, 13 omitidas |
| Integración PostgreSQL efímero | 167/167 aprobadas; contenedor retirado |
| Web | 169/169 aprobadas con el nuevo mensaje; la aserción anterior exigía borrado definitivo |
| Typecheck y build de API/web | Ambos correctos |

## Ventana GCS autorizada: resultado

Ventana independiente el 2026-11-05, desde el precheck 19:59 UTC hasta la
retirada de recursos a las 20:08 UTC; límite autorizado: dos horas y US$10
estimados. Dos objetos STANDARD (2531 bytes en total) durante siete días y
operaciones puntuales de GCS; estimación inferior a US$1, no importe facturado.
Sin cómputo cloud desplegado. El commit de los 14 archivos ya existía y el
árbol estaba limpio. Se compiló ese SHA en local, sin crear otro commit funcional.

**Destino comprobado antes de cargar:** proyecto `nomina-h24-test-20261027`
(`234692275301`), bucket exclusivo `nomina-h24-test-234692275301-cert7-3284a12-4b800383`,
US-CENTRAL1; inventario inicial vacío. Metadata: UBLA activo, PAP enforced,
sin miembros públicos directos en IAM, versionado omitido, soft delete
`604800`, sin retentionPolicy, objectRetention ni hold predeterminado.
Al runtime H24 se le concedió solo su rol `h24DossierRuntime` en el bucket
(leer metadata, crear, leer y borrar objetos; sin restauración).

**Recorrido:** Fastify local con inyección HTTP sobre las rutas registradas,
actor Admin sintético por el mecanismo de test (no login interactivo),
PostgreSQL 18 efímero en loopback con esquema de prueba preexistente,
inspector y ClamAV reales en Docker, adaptador candidato y GCS real. Un único
docente ficticio: `6f724182-14d3-4c6e-9edc-ebcbd9c480c9`. Ningún PDF real.
Los dos POST a `/api/teachers/:id/documents/constancia` respondieron 200
con `cleanupPending=false`. Antes del segundo POST se registraron clave y
generación de A y se descargó A por `GET /api/teachers/:id/documents/current`.

| PDF | Nombre de objeto dentro del bucket | Generación | Bytes |
|---|---|---|---:|
| A | `constancias/6f724182-14d3-4c6e-9edc-ebcbd9c480c9/98698247-9413-477f-9502-1be29c715a49` | `1793909248172839` | 1265 |
| B | `constancias/6f724182-14d3-4c6e-9edc-ebcbd9c480c9/9fed396e-70d5-4e0c-8c8e-bfbd57cad945` | `1793909268598911` | 1266 |

Tras el reemplazo, A quedó no vigente (`CONSTANCIA_FISCAL_DELETED`) y B fue
la única `CONSTANCIA_FISCAL` vigente en PostgreSQL. El GET ordinario de A en
GCS devolvió 404 y `versions=true` no mostró ninguna generación de su clave.
**Prueba positiva:** `objects.list(softDeleted=true)` devolvió exactamente
la clave y generación de A registradas antes del reemplazo:

| Generación de A | softDeleteTime (UTC) | hardDeleteTime (UTC) | Diferencia |
|---|---|---|---:|
| `1793909248172839` | `2026-11-05T20:07:49.086Z` | `2026-11-12T20:07:49.086Z` | **604800 s** |

El inventario vivo contenía únicamente B. Los dos GET de Nómina posteriores
al reemplazo (uno después de verificar A en GCS) devolvieron 200, nombre
`B.pdf` y SHA-256 `877860b4885b05169c1278c9e69baed6b609c46122cf7e5384b47551d55c17d2`,
idéntico al original. El SHA de la descarga previa de A también coincidió con
el original indicado arriba. No se restauró A ni se esperó al vencimiento.

**Incidencias previas, sin escrituras documentales:** el precheck local rechazó
firmas AV antiguas antes de crear un bucket. Se actualizó una copia temporal
con freshclam (daily 28174). En otro precheck, una cabecera local de proyecto
de cuota produjo 403; se retiró ese bucket vacío (sufijo `20ad3141`) y se
corrigió la configuración del cliente sin ampliar los permisos del proyecto.

**Retirada:** solo tras verificar B se retiró su generación exacta. GCS la
listó como recuperable desde `2026-11-05T20:08:11.350Z` hasta
`2026-11-12T20:08:11.350Z`. Antes de retirar el bucket había cero objetos
vivos y dos generaciones recuperables: A y B. Se conservó la política en
ambos buckets temporales. Su retirada devolvió 204; la consulta ordinaria
posterior devolvió 404 y el listado de buckets recuperables confirmó ambos.
Los sintéticos quedan sujetos a expiración normal, no a purga anticipada.
Se retiraron PostgreSQL efímero, contenedores de análisis y volumen temporal
de firmas. No se cambiaron los buckets H24 habituales ni su política.

## Requisitos distintos para producción

Tras el ensayo, aún se requiere autorización independiente, fijar SHA/digests
API/web/worker y rollback; revalidar metadata, IAM y destinos separados, capacidad,
analizadores privados, job y alertas. Completar H13, backup Cloud SQL SUCCESSFUL,
H05 (solo 016/017 pendientes, sin discrepancias) y smoke del release en su ventana.
Esta adecuación no consulta expedientes reales, no cambia buckets productivos ni ejecuta
migraciones productivas, deploy o merge a main.
