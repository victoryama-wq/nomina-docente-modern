# H22 - Hotfix visual de filtros del Preview

**Fecha:** 2026-07-29
**Estado:** Validado localmente, pendiente de despliegue.

## 1. Causa

El bloque de filtros de la vista previa de importación usaba la clase local
`preview-filters`, mientras que los controles tematizados del resto del sistema
dependen principalmente de `filters-row`. Los `select` y el buscador solo
recibían reglas parciales, por lo que conservaban una apariencia cercana al
control HTML nativo.

## 2. Ajuste realizado

Se aplicaron estilos locales al bloque de Preview:

- grid responsive para `Resultado`, `Acción` y `Buscar`;
- controles de 44 px de altura, borde, radio, tipografía y padding consistentes;
- etiqueta visible para el buscador;
- icono de búsqueda alineado dentro del campo;
- placeholder breve en móvil y descripción completa mediante `aria-label`;
- estados hover y foco visible;
- distribución de tres columnas en escritorio;
- distribución de dos columnas más buscador completo en tableta;
- apilado de una columna en móvil.

No se modificaron los `v-model`, filtros, búsqueda, resumen, confirmaciones,
Preview, Apply, permisos ni contratos de API.

## 3. Archivos

- `apps/web/src/components/catalogs/TeacherImportPanel.vue`
- `apps/web/src/components/catalogs/TeacherImportPanel.test.ts`
- `docs/auditoria/H22_Hotfix_Visual_Filtros_Preview.md`

## 4. Validación visual

Se montó el marcado del componente con sus estilos reales y datos ficticios,
sin Firebase, API ni base de datos, y se inspeccionó con Brave en modo headless.

| Resolución | Distribución | Altura controles | Overflow |
|---|---|---:|---|
| 1440 x 900 | Tres controles alineados | 44 px | No |
| 768 x 1024 | Dos selects y buscador a todo el ancho | 44 px | No |
| 390 x 844 | Controles apilados | 44 px | No |

El placeholder del buscador permanece legible en móvil. La descripción completa
del alcance de búsqueda se conserva para tecnologías de asistencia.

## 5. Validaciones automáticas

- `npm --workspace apps/web run test`: 16 archivos, 79 pruebas, OK.
- `npm run test:web`: 16 archivos, 79 pruebas, OK.
- `npm run typecheck`: API y web, OK.
- `npm run build`: API y web, OK.
- Prueba focal `TeacherImportPanel.test.ts`: 11 pruebas, OK.
- `git diff --check`: requerido antes del commit.

## 6. Confirmaciones

- Solo se ajustó presentación frontend.
- No cambió la lógica funcional de H22.
- No cambió backend ni contratos de API.
- No se modificó la base de datos.
- No se ejecutaron migraciones.
- No se modificó H01 ni la fórmula de nómina.
- No se tocaron datos fiscales.
- No se hizo deploy.
