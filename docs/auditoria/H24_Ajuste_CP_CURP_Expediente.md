# H24 - C.P. fiscal y CURP en Expediente docente

Fecha: 2026-10-28.
Estado: implementado y probado en local/test; no desplegado. H24 mantiene NO-GO.

## 1. Decision humana y alcance

El usuario aprobo agregar C.P. y CURP al panel Expediente docente, y confirmo:
C.P. corresponde al domicilio fiscal; ambos campos son opcionales. No se extraen
datos de PDF ni se valida identidad contra RENAPO o domicilio contra SAT/SEPOMEX.

Se conserva la columna Constancia exclusivamente para gestion de archivo. El
guardado de estos campos no requiere cargar o sustituir una constancia. No cambia
la completitud fiscal, requisitos para pagar, H01 ni calculos de Nomina.

## 2. Modelo y contrato

- Migracion nueva `017_h24_teacher_fiscal_identity.sql`; 016 no se modifica.
- `teachers.fiscal_postal_code` y `teachers.curp`: text NOT NULL DEFAULT ''.
- CHECK `teachers_fiscal_postal_code_format_check`: vacio o cinco digitos ASCII.
- CHECK `teachers_curp_format_check`: vacio o estructura basica de 18 caracteres
  (cuatro letras, seis digitos, seis letras, alfanumerico y digito).
- CURP se recorta y normaliza a mayusculas; C.P. se recorta y conserva ceros iniciales.
- No se comprueba existencia, fecha interna, entidad ni digito verificador de CURP;
  tampoco existencia del C.P. Es validacion de formato, no certificacion oficial.
- Sin backfill, inferencias, unicidad nueva ni cambio de datos historicos.

`PATCH /teachers/:id/fiscal` incorpora `fiscalPostalCode?: string` y `curp?: string`.
Campo omitido conserva valor existente; cadena vacia lo limpia; null/tipos o
formatos invalidos devuelven 400. El resto del contrato fiscal se conserva.
Listado y respuestas autorizadas devuelven los campos; la UI usa el resultado
canonico y renueva la version para la edicion independiente de telefono.

## 3. Autorizacion y privacidad

Admin/protegido activo conserva acceso; Finanzas/RH requieren permisos fiscales
vigentes. Lectura no concede edicion: la mutacion conserva `requireDossier('contact')`
y `fiscal.manage`. Coordinador, Direccion, Contador/Contabilidad y otros no obtienen
los valores nuevos, incluso si cuentan con permisos fiscales para otros flujos.
Su proyeccion del listado entrega cadenas vacias en estos dos campos.

No se incorporan a CSV, importacion H22, reportes, PDF de pagos ni snapshots.
La auditoria de docentes omite los valores nuevos: registra presencia y nombres
de campos cambiados, conservando actor/accion/docente y los controles anteriores.
No se agregan datos personales a logs ni se comparte evidencia con servicios externos.

## 4. Migracion exclusivamente local

Destino verificado: `nomina_docente_test`, `127.0.0.1:55440`.
Backup pg_dump formato custom exitoso antes de aplicar; evidencia privada:
`%LOCALAPPDATA%/NominaDocente/H24-Fiscal-Identity-20261028/`.
Archivo: `before-017-1793211864065.dump`. No se presenta como restauracion ensayada.

Se ejecuto el runner H05 `apply` tras comprobar exactamente 19 registros previos,
cero mismatch y un unico pendiente: 017. No se ejecuto reset, seed o baseline.
Resultado UTC 2026-10-28T18:24:25.703Z:

- 20 migraciones registradas; pending=0; checksum mismatch=0.
- 271 docentes conservados, campos nuevos vacios en todos.
- Fingerprints identicos de 24 tablas funcionales, excluyendo solo las columnas
  nuevas de la comparacion de teachers. Cambios administrativos H05 esperados.
- Sin consultas ni cambios en produccion, GCS o Firebase.

El futuro release H24 debe contemplar 016 y 017, no solo 016; inspeccionar el destino
en la ventana autorizada y abortar ante pendientes/checksums inesperados. Este
backend requiere 017 antes de servir consultas de docentes. No desplegarlo sin esquema.

## 5. Validaciones

| Validacion | Resultado |
|---|---|
| API granular de identidad fiscal | 18/18 |
| Componente TeacherDossierPanel | 31/31 |
| Integracion PostgreSQL granular | 2/2 |
| npm run test:api | 235/235 |
| npm run test:web | 149/149 |
| npm run typecheck | OK |
| npm run build | OK, build local sin publicar |
| Brave headless 1440x900, 768x1024, 390x844 | OK; seis controles alineados, sin overflow horizontal, modal dentro del viewport |
| git diff --check | OK |

Integracion: rutas Fastify reales y SQL real con identidad sintetica de test;
tablas temporales que ocultan las publicas, transaccion ROLLBACK y fingerprint
public.teachers sin cambios. Prueba DDL exacta de 017, restricciones, lectura,
persistencia, omision, borrado explicito, normalizacion, permisos y auditoria sin
valores. No se ejecuto la suite de integracion completa que resetea el dataset QA.

UI: navegador Brave headless en contexto nuevo, API simulada con datos sinteticos,
red externa bloqueada; guardado mock normalizado y Constancia sin campos fiscales.
Capturas privadas `.cache/h24-fiscal-identity-{1440,768,390}.png` inspeccionadas.
No equivale a smoke manual con sesion Firebase real; queda pendiente revision del usuario.

## 6. Continuidad y confirmaciones

Conservar evidencias anteriores PD-01/02/04/05; este cambio no cierra identidades
complementarias, seguridad PDF, dependencias, capacidad ni worker cloud. PD-08
debe incorporar 017 y actualizar la lista de pendientes esperados del release.

Sin produccion, deploy, cambios H01, Nomina, corridas, snapshots, importacion CSV,
permisos productivos, dependencias o npm audit fix. No se cargaron datos personales
nuevos ni archivos a GCS. Cambios pendientes de revision/versionado; sin commit/push automatico.
