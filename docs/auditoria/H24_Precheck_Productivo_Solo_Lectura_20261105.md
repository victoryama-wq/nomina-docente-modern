# H24: precheck productivo de solo lectura

Seguimiento documental 2026-11-09: el [acta de respaldo e inspección H05](H24_Ventana_Respaldo_Cloud_SQL_Inspeccion_H05_20261105.md)
registra cierre favorable aportado desde Cloud Shell: 20 archivos, 18 registradas,
solo 016/017 pendientes y mismatch 0. El backup 1793913186499 continúa SUCCESSFUL,
con restauración no ensayada. El [plan de infraestructura](H24_Plan_Infraestructura_Productiva_20261109.md)
separa los siguientes permisos y ventanas. La tabla siguiente conserva la
observación del **5 de noviembre**, no una inspección actual ni un GO de release.

2026-11-05, 21:06–21:08 UTC. Proyecto activo `nomina-docente-prod` (`443985127112`).
Candidata funcional: `3284a12af189baeaff51335401d13e9923d9d51d`.
[Cierre de PD-DEST-01 en GCS aislado](H24_PD_DEST_01_Constancias_Recuperables.md):
`9f06dc73399242477565ceb6b96fb7c5836d2544`. Ese cierre no constituye un smoke productivo.

| Requisito | Esperado | Observado | Pendiente |
|---|---|---|---|
| Constancias | Bucket autorizado; borrado recuperable 604800 s y versionado ausente o desactivado | La revisión servida apunta a `nomina-docente-prod-constancias`; proyecto correcto, US-CENTRAL1, metageneración 2, 604800 s, versionado omitido | Compatible con la guarda candidata. Releer en la ventana; no cambiar la política. |
| Privacidad y retenciones | UBLA, PAP enforced, sin acceso público ni retención adicional | UBLA activo, PAP enforced, cero bindings públicos directos; sin retentionPolicy, objectRetention ni hold predeterminado | No se inspeccionaron holds de objetos individuales. La guarda por generación sigue siendo necesaria. |
| IAM de la API | Leer metadata del bucket, crear/leer/retirar objetos; restauración reservada a personal autorizado | Binding directo sin condición de `roles/storage.objectAdmin` para `nomina-api-sa`: el rol incluye `storage.objects.restore`, pero no `storage.buckets.get`. Los bindings directos de proyecto de esa cuenta son Cloud SQL Client y Secret Accessor. | Revisar permisos efectivos (Policy Troubleshooter devolvió 403), separar restauración del runtime y garantizar lectura de metadata. No se concedió ni probó ningún permiso con objetos. |
| Documentos adicionales | Destino privado separado, versionado explícitamente false, soft delete explícitamente 0, sin retenciones ni holds incompatibles | Sin `DOSSIER_BUCKET` ni `DOSSIER_STORAGE_MODE` en la revisión. Inventario completo del proyecto: cuatro buckets, de constancias, importaciones SQL, Cloud Build y fuentes Run; sin designación comprobada de adicionales. | **Designación pendiente.** No certificar borrado definitivo ni reutilizar constancias. Comprobar metadata, IAM y compatibilidad con el adaptador al designar. |
| API y rollback | Revisión servida Ready y digest disponible para volver desde H24 | `nomina-api-00057-c7d`, Ready, tráfico 100 %, concurrencia 80, máximo 3 instancias. Digest `sha256:a7d0de2196c5552d50cd75b8f01e15238dc90f701941b8656613bf6d1789196b` presente en Artifact Registry y coincidente con el ensayado en PD-08. `00056-mll` es la revisión histórica anterior, no el primer destino de rollback de H24. | Preservar 00057 y fijar imágenes candidatas. No modificar tráfico ni extrapolar capacidad del ensayo. |
| Hosting y rollback | Release live identificable; rewrite a la API correcta | Release `1793121624438000`, versión `3f9ebc88c835a143`, FINALIZED; `/api/**` a `nomina-api`, us-central1. Anterior: `1789068812732000`, versión `c29c9b5b84133c9a`. | Conservar la versión live actual como retorno desde H24; revalidar al abrir ventana. |
| Analizadores | Inspector y ClamAV privados, acceso autenticado y fallo cerrado | En us-central1 solo figura el servicio Run `nomina-api`; sin `DOCUMENT_SECURITY_MODE` en la revisión activa | Designar/provisionar destinos privados, imágenes, IAM invocador, firmas vigentes, límites y capacidad; verificar rechazo seguro. No se hicieron invocaciones. |
| Limpieza | Job privado con los mismos destinos y guardas, Scheduler autenticado y reintentos idempotentes | Cero jobs de Cloud Run en us-central1; los dos jobs Scheduler regionales son de encendido/apagado de Cloud SQL | Preparar worker, identidad mínima, programación, responsable y evidencia de ejecución. Coordinar con los horarios de Cloud SQL. |
| Alertas | Avisos por error documental y ausencia de limpieza exitosa | Sin políticas ni canales de notificación en Cloud Monitoring del proyecto consultado | Crear y probar ambos avisos, umbral acorde a cadencia y receptor confirmado. La prueba H24 no acredita entrega productiva. |
| Respaldo y H05 | Instancia disponible; respaldo bajo demanda SUCCESSFUL y H05 sin divergencias antes de aplicar | `nomina-docente-web`, POSTGRES_18, RUNNABLE, us-central1; backups automáticos y PITR habilitados. No se creó respaldo ni se leyó el ledger. | En **otra ventana autorizada**, registrar backup ID/UTC/estado y evidencia de restaurabilidad; comprobar en modo inspección 18 registradas hasta 015, solo 016/017 pendientes y cero discrepancias de checksum. Son criterios, no resultados actuales. |

**Dictamen:** se puede pasar a solicitar una ventana DBA independiente, limitada
a respaldo y verificación H05 sin apply. Los pendientes de almacenamiento, IAM
y operación no impiden ese paso preparatorio, pero **no hay GO para migrar,
desplegar ni habilitar H24**. Si la ventana propuesta incluye aplicación de
016/017 o habilitación, diferirla. Un backup automático habilitado no sustituye
un backup preventivo confirmado para el release.

Fuentes: metadata de Cloud Resource Manager, GCS e IAM, revisiones/servicios/jobs
Run y Scheduler en us-central1, Artifact Registry, Firebase Hosting live,
Monitoring y SQL Admin. No se listaron objetos, leyeron expedientes, filas o
valores de secretos, ni se crearon recursos, backups o migraciones.
