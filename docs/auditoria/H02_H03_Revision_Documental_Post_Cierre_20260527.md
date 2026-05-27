# Revision documental post-cierre H02/H03

Fecha: 2026-05-27

## 1. Objetivo

Contrastar SPEC, SDD, README y matriz formal de riesgos contra el estado real del sistema despues de H02/H03, migracion productiva de datos, conciliacion de nomina, limpieza de duplicados y cierre de recursos preview/dry-run.

## 2. Documentos revisados

| Documento | Resultado |
|---|---|
| `docs/specs/SPEC_H02_H03_Usuario_Coordinacion_Permisos.md` | Se conserva como SPEC historica/base aprobada de implementacion. No se modifica para no mezclar contrato original con cierre operativo. |
| `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md` | Actualizado con estado post H02/H03, deploy actual, reglas de permisos y riesgos vigentes. |
| `README.md` | Actualizado con estado productivo real, revision Cloud Run, base activa, documentos clave y comando de deploy alineado a variables actuales. |
| `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md` | Reescrita para marcar H02/H03 como cerrados operativamente y reordenar riesgos pendientes. |

## 3. Estado actual confirmado

| Area | Estado |
|---|---|
| Produccion | `https://nomina-docente-prod.web.app` |
| API productiva | `nomina-api`, revision `nomina-api-00044-pk9` |
| Base activa | `nomina_docente` |
| Canales Firebase | Solo `live` |
| Bases preview/dry-run | Eliminadas |
| Servicio API review | Eliminado |
| Nomina validada | `2026-05-15 a 2026-05-28` por `$517,510.00` |
| H01 | Cerrado |
| H02 | Cerrado operativo; fallback legacy en monitoreo |
| H03 | Cerrado operativo; permisos separados |

## 4. Contraste principal

### SPEC H02/H03

La SPEC fue correcta como guia de implementacion. Ahora queda como documento historico de requisitos y criterios de aceptacion.

No se edito porque:

- define la intencion aprobada antes de implementar;
- sirve como evidencia de que lo construido respeto decisiones humanas;
- los estados posteriores ya estan en SDD, matriz y auditorias de cierre.

### SDD

Antes:

- Estaba centrado en H01.
- Marcaba H02/H03 como pendientes.
- Referenciaba revision Cloud Run H01 `nomina-api-00043-p96`.

Ahora:

- Incluye estado post H02/H03.
- Referencia revision productiva actual `nomina-api-00044-pk9`.
- Documenta que H02/H03 estan implementados.
- Actualiza pendientes y recomendaciones.

### README

Antes:

- Tenia despliegue basico y comando de Cloud Run previo a H02/H03.

Ahora:

- Indica estado productivo actual.
- Documenta base activa unica `nomina_docente`.
- Agrega documentos clave de auditoria.
- Alinea `LEGACY_COORDINATION_FALLBACK_ENABLED=true` con el despliegue actual.

### Matriz formal de riesgos

Antes:

- H02 y H03 estaban como pendientes P1.

Ahora:

- H02 queda cerrado operativo con monitoreo de fallback.
- H03 queda cerrado operativo con recomendacion de pruebas automatizadas.
- El foco pasa a H04, H05 y H06 como siguientes riesgos importantes.

## 5. Que falta por corregir o mejorar

Pendientes reales sin afectar lo ya funcionando:

1. **H04 - Pruebas automatizadas de negocio.**
   - Prioridad: P1.
   - Cubrir calculo de nomina, H01, permisos H02/H03, docentes compartidos, extras propios/ajenos, fiscal/documentos y workflow financiero.

2. **H05 - Control formal de migraciones.**
   - Prioridad: P1.
   - Agregar tabla/herramienta de migraciones aplicadas con orden, checksum, fecha, ambiente y rollback.

3. **H06/H14 - Apps Script legacy.**
   - Prioridad: P1/P3.
   - Definir si queda congelado, consulta historica o retirado.

4. **Fallback legacy H02.**
   - Prioridad: monitoreo.
   - No retirarlo todavia. Observar logs durante estabilizacion y retirarlo solo cuando se cumpla la condicion aprobada.

5. **H09 - Maquina de estados financiera.**
   - Prioridad: P2.
   - Aclarar si `BORRADOR` y `CERRADA` seran usados o quedaran reservados.

6. **H10 - Cierre de cuatrimestre moderno.**
   - Prioridad: P2.
   - Confirmar proceso operativo antes de disenar cambios.

7. **H11 - CSV/acentos.**
   - Prioridad: P2.
   - Estandarizar codificacion y pruebas Excel.

8. **H12 - Catalogos historicos.**
   - Prioridad: P2.
   - Definir politica de inactivacion/renombrado.

## 6. Recomendacion

No reabrir H02/H03 mientras produccion siga estable.

La siguiente fase tecnica recomendada es crear pruebas automatizadas y control formal de migraciones. Eso protege lo ya validado sin alterar reglas operativas.

## 7. Archivos actualizados en esta revision

| Archivo | Cambio |
|---|---|
| `docs/sdd/SDD_Retrospectivo_Nomina_Docente.md` | Estado actual, despliegue H02/H03, reglas H02/H03, riesgos y recomendaciones. |
| `docs/auditoria/Matriz_Formal_Riesgos_Nomina_Docente.md` | Matriz actualizada post-cierre, H02/H03 cerrados, siguientes riesgos priorizados. |
| `README.md` | Estado productivo actual, documentos clave, variables de deploy y checklist minimo. |
| `docs/auditoria/H02_H03_Revision_Documental_Post_Cierre_20260527.md` | Este resumen de contraste documental. |
