# H24 / PD-DEST-01: reemplazo de constancia con siete días recuperables

**2026-11-05. Candidata local validada; PD-DEST-01 abierto. Sin GO productivo.**
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

## Criterio pendiente para cerrar PD-DEST-01

Solicitar **nueva ventana H24** para ejecutar la candidata identificada por SHA
e imagen, con PDFs sintéticos y un bucket de constancias privado con siete días;
mantener separado el bucket de adicionales. Autorizar el coste temporal de los
objetos recuperables y la inspección de metadata por una identidad de auditoría.
No otorgar restauración al runtime para esta prueba.

1. Registrar metadata del bucket, generar A/B con hashes conocidos y cargar A
   por Nómina; registrar clave y generación exactas de A.
2. Sustituir por B, verificar una única vigente, descargar por Nómina y comparar
   SHA-256. Completar limpieza y verificar que B sigue disponible.
3. Acreditar que A no tiene versión viva **y**, de forma independiente, que el
   listado GCS con `softDeleted=true` contiene la misma clave y generación,
   con `softDeleteTime` y `hardDeleteTime` separados por 604800 segundos.
   Un 404 ordinario, una política de bucket o un inventario vacío por sí solos
   no prueban recuperabilidad. Sin evidencia positiva, el bloqueo sigue abierto.
4. Retirar recursos según la nueva autorización, registrando la retención
   residual de los sintéticos; no bajar la política a cero para limpiarlos.

## Requisitos distintos para producción

Tras el ensayo, aún se requiere autorización independiente, fijar SHA/digests
API/web/worker y rollback; revalidar metadata, IAM y destinos separados, capacidad,
analizadores privados, job y alertas. Completar H13, backup Cloud SQL SUCCESSFUL,
H05 (solo 016/017 pendientes, sin discrepancias) y smoke del release en su ventana.
Esta adecuación no consulta expedientes reales, no cambia buckets ni ejecuta
migraciones productivas, deploy o merge a main.
