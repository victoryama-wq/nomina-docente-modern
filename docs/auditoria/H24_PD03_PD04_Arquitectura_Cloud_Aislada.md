# H24 PD-03 / PD-04 - Arquitectura cloud aislada

Fecha: 2026-10-29. Rama: `feature/h02-h03-user-coordinations-permissions`.
Base Git: `ab3f5c31af570fd33eddf7efa63ea6bb8f8f5c51`; cambios locales posteriores
sin commit en esta entrega. H24 permanece **NO-GO productivo**.

## 1. Autorizacion y limites

El usuario autorizo servicios privados de analisis/recuperacion, programacion y
alertas en `nomina-h24-test-20261027`, con costos de prueba acotados y destinatario
propuesto `victor.yama@tecplayacar.edu.mx`. Autorizo despues PostgreSQL efimero
`nomina_docente_test` dentro del job, solo datos sinteticos y eliminacion final.

No se consulto ni modifico produccion. No hubo deploy API/Hosting productivo,
Cloud SQL, carga de documentos personales ni cambios H01. SI se desplegaron los
servicios de ensayo en H24. No afirmar ausencia de cambios cloud o de toda BD:
el job creo y retiro su BD efimera, con fixtures sinteticos y DDL local.
El cluster local de test existente no se arranco, restauro ni reinicio.

## 2. Implementacion

`document-cloud.ts` agrega transporte explicito Cloud Run, ID token de metadata
con audiencia exacta, sin claves, redirecciones ni fallback; respuestas acotadas,
correlacion y validaciones de hash/politica/AV existentes. El modo Docker permanece.
`services/document-security` contiene wrappers e imagenes separadas inspector/AV,
usuario no root, procesos/temporales por solicitud y limites de tiempo/tamano.
El cambio en los scripts locales solo permite TMPDIR privado; no relaja politica.

7.5 MiB, concurrencia 1 por servicio, min 0/max 1, inspector 1 CPU/512 MiB,
scanner 2 CPU/4 GiB. Firmas oficiales actualizadas antes del primer analisis y
tras seis horas de uso; edad maxima vigente de dos dias y error cerrado.
No se agregaron dependencias funcionales por el transporte. Las correcciones npm
posteriores se separan en el acta PD-06 y no se atribuyen a estas imagenes.

## 3. Recursos H24

Proyecto `nomina-h24-test-20261027` (234692275301), region `us-central1`.
Registro `h24-document-security`. APIs Run, Artifact Registry y Scheduler
habilitadas exclusivamente alli. Cuentas inspector/scanner sin grants de proyecto
para BD/GCS; runtime H24 con Invoker en ambos servicios. IAM privado comprobado.

| Recurso | Evidencia |
|---|---|
| Inspector | `h24-document-inspector-00002-dt2`, 100% |
| Imagen inspector | `sha256:5f605d55b21a613d6f5d19475285c559932136a59a4ba330f7f057562b14ecef` |
| Scanner | `h24-document-scanner-00002-qdv`, 100% |
| Imagen scanner | `sha256:be67cc35d05364cb9a5f7034a966e1908cf7484fceb9d6e6ef32753741799268` |
| Job de ensayo | `h24-recovery-rehearsal`, 1 tarea, retry 0, 900 s, 1 CPU/1 GiB |
| Imagen ensayo | `sha256:5fa61fd15f9be34f12920a18ecdacf034c4a5c787ebe184639bb38005618a2ed` |
| Scheduler | `h24-recovery-validation`; identidad propia, Invoker solo en job |
| Canal email | `projects/nomina-h24-test-20261027/notificationChannels/283109636557524101` |
| Politica ERROR | `projects/nomina-h24-test-20261027/alertPolicies/15678085590047417550` |

URLs privadas por IAM: `https://h24-document-inspector-234692275301.us-central1.run.app`
y `https://h24-document-scanner-234692275301.us-central1.run.app`.
Ingress all NO significa acceso anonimo habilitado. No hay permisos allUsers.

## 4. Pruebas de seguridad y transporte

- Wrapper Node: 3/3 grupos (rutas/modos, limites/headers, concurrencia y errores).
- API, antes de PD-06: 306 aprobadas, 15 omitidas; 51 casos enfocados cloud/politica.
- Web 158/158, typecheck y build aprobados.
- HTTP Linux Docker: 8 comprobaciones sinteticas; PDF/JPG/PNG, AV y rechazos.
- Smoke cloud ampliado: 13 comprobaciones, mas rechazo de MIME no admitido.
- Sin token 403 en ambos servicios; runtime autorizado 200; identidad valida sin
  Invoker 403; audiencia incorrecta 401.
- PDF limpio aceptado; JavaScript inerte y PDF truncado rechazados. PNG/JPEG
  sinteticos decodificados y analizados. No se envio malware real a cloud.
- Pipeline cloud PDF 14 917/15 743 ms, PNG 14 653 ms, JPEG 15 104 ms en muestra
  pequena; primer ensayo frio PDF 25 173 ms. NO equivalen a capacidad PD-07.

## 5. Recuperacion real en job

La BD efimera usa 127.0.0.1:55441, sin Cloud SQL ni exposicion de PostgreSQL.
El esquema minimo sintetico utiliza DDL 016 inalterado como fixture; no es un
apply H05 sobre una BD existente ni prueba de migracion productiva.
Se ejecuta el entrypoint real `apps/api/dist/dossier-reconcile.js` en procesos nuevos.

| Escenario | Resultado |
|---|---|
| Upload GCS seguido de interrupcion sintetica | PREPARED recuperado a COMPLETE, hash y lectura correctos |
| Worker repetido | 0 procesados, sin duplicar, exit 0 |
| Delete storage interrumpido | CLEANUP recuperado; objeto eliminado |
| Constancia A reemplazada por B con delete interrumpido | Worker elimina A, una current B |
| Estado final del worker | Backlog 0, sin fallos, exit 0 |
| Limpieza | Tres objetos sinteticos retirados y PostgreSQL/temporales destruidos |

Ejecucion directa `h24-recovery-rehearsal-qdq7q`: inicio
2026-10-29T18:27:15.551340Z, final 18:30:21.387094Z, Completed=True.
Scheduler Run Now: HTTP 200 a jobs API a 18:31:27.264487417Z; ejecucion
`h24-recovery-rehearsal-qrr5j` inicio 18:31:27.451379Z, final 18:33:50.091915Z,
Completed=True. No confundir aceptacion HTTP con finalizacion del worker.
Se comprobo disparo desde Scheduler; no se esperaron multiples cadencias cron.
Scheduler queda PAUSED, sin ejecuciones periodicas; cron anual placeholder, retry 0.

## 6. Alertas y restitucion

Evento ERROR sintetico `h24_recovery_test_alert` emitido a 18:30:18.129817Z.
Politica limitada a servicios/job H24, rate limit de notificacion 3600 s y
autocierre 1800 s. Canal configurado hacia el correo institucional autorizado.
**Recepcion externa pendiente de confirmacion del usuario**: configurar canal,
generar log y crear politica NO prueban entrega al buzon. No leer correo privado.

Inventario con generaciones/CRC/tamano antes/despues y metadatos de buckets:
**sin diferencias**. Dossier: 0 objetos. Constancias: 1 objeto previo conservado.
No se borro la constancia B del ensayo manual anterior. Politicas de buckets sin
cambios. Evidencias privadas en
`%LOCALAPPDATA%/NominaDocente/H24-PD05-20261027/pd-cloud-20261029/`;
no versionar tokens, dumps ni inventarios nominales.

## 7. Incidencias controladas

`/healthz` dio 404 en la plataforma antes del handler; `/health` autenticado se
comprobo tras reconstruir las imagenes. Un nombre local `path` que ocultaba el
import fue corregido durante pruebas Linux. Las ejecuciones `f9x7k` y `h2zh6`
fallaron en guard antes de BD/GCS por variable de entorno mal separada en
PowerShell. Se verificaron dos variables separadas, sin relajar guardas, y luego
pasaron los dos ensayos. Los ERROR anteriores pueden disparar la misma alerta.

## 8. Pendientes y siguiente ventana

- PD-04: confirmar recepcion externa, cadencia/alerta de ausencia de ejecucion,
  parametros y conectividad del destino final. El job efimero NO es productivo.
- PD-03: Cloud Run privado no equivale a red denegada/read-only-root del laboratorio
  Docker; falta resolver/aceptar aislamiento de salida y riesgo residual del visor.
- PD-06: correccion compatible parcial; Zod y cadena gRPC/Firebase pendientes.
- PD-07: carga multiple, archivos maximos, latencia, memoria y concurrencia reales.
- PD-08: ensayo completo H05 016/017 y restauracion; este fixture no lo sustituye.
- PD-05: cuentas complementarias siguen pendientes por decision humana, no
  aceptadas automaticamente como excepcion productiva.

Objetivo operativo: resolver gates y congelar evidencia el viernes 30; sabado 31
solo ejecutar backup/migraciones/API/Hosting si existe GO explicito y autorizacion
de la ventana productiva. La fecha objetivo no justifica omitir un control.
No se declara H24 cerrado ni listo para deploy con esta evidencia parcial.
