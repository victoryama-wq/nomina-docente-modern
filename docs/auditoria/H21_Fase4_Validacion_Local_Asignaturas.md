# H21-F4 - Validacion local de importacion y consumo de Asignaturas

Fecha: 2026-07-18

Estado: implementado y validado en local/test; pendiente de migracion y deploy productivo.

## 1. Ambiente

- rama: `feature/h02-h03-user-coordinations-permissions`;
- API y frontend locales;
- PostgreSQL: exclusivamente `nomina_docente_test` en `localhost:5432`;
- Firebase real: no requerido por pruebas automatizadas;
- produccion: no utilizada.

## 2. Catalogos

La pestaña Asignaturas incorpora:

- descarga de plantilla vacia o catalogo actual;
- selector de archivo CSV;
- preview separado de apply;
- conteos de nuevas, actualizaciones y sin cambios;
- tabla por numero de fila con before/after y estado;
- filtro de resultados;
- mensajes bloqueantes;
- confirmacion explicita;
- recarga del catalogo al terminar.

El boton Apply permanece deshabilitado si existe cualquier fila bloqueante o
si Admin no confirma expresamente el preview.

## 3. Busqueda y Horarios

- la busqueda de catalogo usa PostgreSQL y tokens normalizados;
- el selector de Horarios busca por nombre o clave;
- no existe alta por texto libre;
- el payload usa `subjectId`;
- el nombre guardado proviene del catalogo;
- una asignatura inactiva solo puede conservarse en su mismo horario existente.

## 4. Seguridad e integridad

- template/preview/apply: solo Admin;
- listado activo: actores con `schedules.manage`;
- SHA-256 de archivo y fingerprint del catalogo;
- advisory lock y transaccion unica;
- sin aplicacion parcial;
- sin `DELETE`, merge, UPSERT ciego ni propagacion a Horarios/snapshots;
- sin datos fiscales;
- sin cambios H01.

## 5. Pruebas

Se cubren migracion, API, importacion, busqueda, permisos, limites, UTF-8,
CSV con comas/comillas/saltos, concurrencia, rollback atomico, auditoria,
Horarios estrictos y componentes frontend.

Resultados finales:

| Validacion | Resultado |
|---|---|
| `npm run test:api` | 22/22 pruebas, 5 archivos |
| `npm run test:web` | 61/61 pruebas, 14 archivos |
| `npm run test:api:integration` | 79/79 pruebas, 11 archivos; solo `nomina_docente_test` |
| `npm run typecheck` | API y web OK |
| `npm run build` | API y web OK |

Las pruebas H21 especificas cubren esquema, importacion, busqueda, permisos,
rollback atomico, Horarios estrictos y componentes frontend.

## 6. Evidencia npm audit

`npm audit` se ejecuto solo como evidencia y termino con codigo distinto de
cero por vulnerabilidades registradas en el arbol actual:

- 1 low;
- 10 moderate;
- 4 high;
- 1 critical;
- 16 total.

Entre los paquetes reportados se encuentran dependencias directas o
transitivas ya presentes como `exceljs`, `firebase-admin`, `vite`,
`websocket-driver`, `undici` y componentes Google Cloud. No se ejecuto
`npm audit fix`, no se uso `--force` y no se actualizaron dependencias como
parte del cierre H21-F4. La remediacion debe tratarse en una fase de seguridad
separada y con pruebas de regresion.

## 7. Riesgos pendientes

- aplicar `013` en produccion requiere H05, backup y aprobacion humana;
- validar un CSV institucional real en ambiente controlado;
- ejecutar smoke por Admin y Coordinador despues de un deploy autorizado;
- mantener monitoreo de vulnerabilidades npm sin ejecutar fixes automaticos.

Validacion posterior de predeploy del 2026-07-20:

- ensayo `013` satisfactorio en restauracion temporal, con fingerprints
  estables y cinco grupos normalizados preservados;
- preview de la plantilla institucional base: 271 sin cambios y 10 bloqueantes
  por cinco colisiones normalizadas; sin apply;
- vulnerabilidad critica transitiva `websocket-driver@0.7.4` pendiente de fase
  SEC controlada;
- H21-F5 permanece bloqueado.

Evidencias:

- `docs/auditoria/SEC_H21_Triage_Npm_Audit_PreDeploy.md`;
- `docs/auditoria/H21_Ensayo_Migracion_013_Datos_Productivos_Temporales.md`;
- `docs/auditoria/H21_Validacion_CSV_Institucional_PreDeploy.md`.

## 8. Confirmaciones

- Sin produccion.
- Sin deploy.
- Sin migracion productiva.
- Sin datos productivos modificados.
- Sin perdida de Horarios o snapshots.
- Sin cambios H01.
