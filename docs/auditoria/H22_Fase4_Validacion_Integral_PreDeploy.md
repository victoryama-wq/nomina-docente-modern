# H22-F4 - Validación integral predeploy de importación de docentes

**Fecha:** 2026-07-30
**Estado:** H22-F4 cerrado; validación técnica y smoke autenticado aprobados.
**Ambiente:** local/test y ensayo temporal aislado. Sin deploy ni escritura productiva.

## 1. Objetivo

Consolidar la preparación de H22 antes de su ventana productiva: corrección de
docentes legacy, hotfix visual del Preview, regresión completa, control H05,
ensayo temporal de `014`, manuales y plan H22-F5.

H22 no queda cerrado operativo en esta fase. La migración `014`, el deploy y
cualquier Apply institucional continúan pendientes.

## 2. Commits funcionales auditados

| Cambio | Commit completo | Archivos | Alcance |
|---|---|---|---|
| Nombres legacy | `9d7ccbab818d9b95730c2462d8a8cc8205e6f983` | `apps/api/src/lib/teacher-import.ts`; `apps/api/src/test/api-h22-teacher-import.integration.test.ts` | Conserva nombres legacy no desglosados y agrega regresión específica. |
| Filtros Preview | `51d8814c935551124728421500ea2b2b9da244b3` | `apps/web/src/components/catalogs/TeacherImportPanel.vue`; prueba del panel; evidencia del hotfix | Ajuste exclusivamente visual y responsive. |

Los commits son atómicos, no fueron reescritos y no contienen cambios ajenos a
sus objetivos.

## 3. Corrección de nombres legacy

La implementación distingue:

- **Sin cambio nominal:** conserva `full_name` y `normalized_name`; no deriva un
  nombre vacío ni actualiza componentes legacy.
- **Cambio operativo:** conserva el nombre vigente y modifica solo los campos
  operativos autorizados.
- **Cambio nominal explícito:** usa los componentes efectivos, reconstruye
  `full_name`, recalcula `normalized_name`, muestra before/after y conserva las
  validaciones de unicidad y riesgo.

La regresión cubre una plantilla que vuelve a importar, sin cambios, un docente
existente cuyos componentes nominales legacy están vacíos.

## 4. Hotfix visual del Preview

`Resultado`, `Acción` y `Buscar` usan controles tematizados de 44 px, borde,
radio, padding y tipografía institucionales. El buscador conserva icono
alineado, foco visible, label, `aria-label` y placeholder móvil.

Validación técnica con estilos reales y datos ficticios:

| Resolución | Resultado |
|---|---|
| 1440 x 900 | Tres controles alineados; sin overflow general. |
| 768 x 1024 | Dos selects y buscador a ancho completo; sin overflow general. |
| 390 x 844 | Controles apilados y placeholder legible; sin overflow general. |

No se alteraron `v-model`, búsqueda, filtros, Preview, Apply, permisos ni
contratos API.

## 5. Smoke autenticado manual

**Estado: APROBADO POR CONFIRMACIÓN HUMANA EL 2026-07-30.**

El usuario confirmó que el smoke autenticado y responsive pasó
satisfactoriamente. La aprobación cubre:

- escritorio 1440 x 900;
- tableta 768 x 1024;
- teléfono 390 x 844;
- descargas, selector, Preview, filtros, before/after, advertencias, bloqueos,
  confirmaciones y limpieza final;
- pestaña oculta para Coordinador, Dirección y RH;
- backend `403` para roles no Admin;
- Apply de prueba únicamente contra `nomina_docente_test`;
- ausencia de datos fiscales, Base64, hashes, fingerprints y JSON interno.

No se ejecutó Apply institucional ni se usaron datos productivos o fiscales
durante la validación.

## 6. Validaciones técnicas

Ejecutadas después de ambos commits:

| Validación | Resultado |
|---|---|
| `npm run test:api` | 7 archivos, 27/27 pruebas, OK |
| `npm run test:web` | 16 archivos, 79/79 pruebas, OK |
| `npm run test:api:integration` | 14 archivos, 105/105 pruebas, OK |
| Prueba focal `TeacherImportPanel.test.ts` | 11/11, OK |
| `npm run typecheck` | API y web, OK |
| `npm run build` | API y web, OK |
| `npm audit` | 0 críticas; 21 high, 9 moderate y 1 low documentadas, sin fix |

La integración se ejecutó exclusivamente contra `nomina_docente_test` en
`127.0.0.1:5432`. Un intento previo a `55432` falló por conexión rechazada; no
representó una regresión funcional.

## 7. Estado H05

### Local/test

- 17 migraciones detectadas y registradas.
- 16 registros `baseline`.
- `014_h22_teacher_external_identifier_unique.sql` aplicada.
- `pending=0`.
- `checksum mismatch=0`.

La suite de integración reconstruye el esquema y limpia el control H05. Después
de la suite se restauró de forma segura el baseline 001-013 y se aplicó `014`
solo en `nomina_docente_test`.

### Producción read-only

La evidencia read-only obtenida durante el ensayo H22 registró:

- 17 archivos en filesystem;
- 16 migraciones registradas;
- 15 baseline y `013` aplicada;
- pendiente exclusivamente `014_h22_teacher_external_identifier_unique.sql`;
- `checksum mismatch=0`.

Esta comprobación no se repitió con secretos en el cierre documental. No se
ejecutaron `apply`, `baseline` ni `dry-run` productivos.

## 8. Ensayo temporal

La evidencia completa está en
`docs/auditoria/H22_Ensayo_Productivo_Temporal_Importacion_Docentes.md`.

Resultado:

- restauración aislada desde backup productivo exitoso;
- `014` aplicada mediante H05 solo en la instancia temporal;
- cero DML y cero cambios de filas;
- conteos y fingerprints operativos, fiscales, de nómina y snapshots idénticos;
- Preview de catálogo restaurado ejecutado con el fix legacy;
- resolución por UUID, cero altas accidentales y 184 filas `SIN_CAMBIOS`;
- instancia temporal eliminada; backup conservado.

## 9. Guías revisadas

Actualizadas:

- SPEC H22;
- diagnóstico H22;
- SDD consolidado;
- matriz formal de riesgos;
- checklist H13;
- README;
- Manual de Uso Markdown/DOCX;
- Manual de Entrega Markdown/DOCX.

Los DOCX se regeneraron con los scripts oficiales del repositorio y el Python
empaquetado del workspace. Word exportó los archivos finales a PDF con 35
páginas para el Manual de Uso y 20 para el Manual de Entrega. La revisión
visual completa y la comprobación focal de las páginas H22 confirmaron
tipografía, márgenes y continuidad correctos, sin columnas ni texto recortado.

Procedimiento ejecutado:

```powershell
& <python-empaquetado-del-workspace> tools/build_user_manual_docx.py
& <python-empaquetado-del-workspace> tools/build_delivery_manual_docx.py
```

Los documentos históricos se conservaron sin reescribir su estado pasado.

## 10. Plan exacto H22-F5

1. Confirmar rama, SHA y árbol limpio.
2. Confirmar smoke humano H22-F4 aprobado.
3. Repetir suite completa y verificar `npm audit` con 0 críticas.
4. Ejecutar H05 productivo read-only y confirmar pendiente exacta `014`.
5. Crear backup on-demand y esperar `SUCCESSFUL`.
6. Registrar conteos y fingerprints previos.
7. Aplicar `014` exclusivamente mediante H05.
8. Confirmar 17 registradas, `pending=0` y `checksum mismatch=0`.
9. Desplegar API Cloud Run conservando variables, secretos, CORS y service
   account.
10. Desplegar Firebase Hosting live.
11. Ejecutar healthchecks y revisar logs.
12. Ejecutar smoke autenticado Admin y smoke de ocultamiento/403 para roles no
    Admin.
13. Descargar las tres plantillas y ejecutar Preview.
14. No ejecutar Apply institucional.
15. Actualizar manuales de “preparada” a “disponible en producción”.
16. Documentar cierre operativo, commit y push.

Rollback:

- API: regresar tráfico a la revisión anterior.
- Hosting: restaurar el release anterior.
- Conservar el índice `014` si el incidente es solo de UI/API.
- No eliminar el índice de forma improvisada.
- Restaurar backup únicamente mediante procedimiento DBA aprobado.

## 11. Confirmaciones

- No se aplicó `014` en producción.
- No se hizo deploy.
- No se ejecutó Apply institucional.
- No se modificó H01.
- No se modificaron fórmulas, nómina, corridas o snapshots.
- No se tocaron datos fiscales.
- No se ampliaron permisos o roles.
- No se instalaron dependencias.
- No se usó `npm audit fix` ni `--force`.
