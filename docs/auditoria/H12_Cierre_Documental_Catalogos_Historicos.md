# H12 - Cierre documental de catalogos historicos

## 1. Contexto

H12 nacio por el riesgo de catalogos/tabuladores historicos: si se renombran, eliminan, reutilizan o modifican registros que ya fueron usados por Horarios, Extras, Nomina, Finanzas, reportes o auditoria, se puede perder trazabilidad y romper la explicacion historica de pagos.

La revision documental H12-F0 dejo definida la politica general en:

```text
docs/specs/SPEC_H12_Catalogos_Historicos.md
```

Decision actual: el sistema productivo funciona correctamente y no se debe cambiar nada en absoluto. Por lo tanto, H12 no continuara como cambio tecnico. H12 se cierra como politica documental y de gobierno operativo.

## 2. Decision humana

Decision humana explicita:

- No se modifica codigo.
- No se modifica base de datos.
- No se modifica UI.
- No se modifican catalogos reales.
- No se inactivan registros.
- No se renombran registros.
- No se borran registros.
- No se implementa backend.
- No se implementa frontend.
- No se ejecutan migraciones.
- No se hace deploy.
- No se toca produccion.
- H12 se cierra como politica documental.

Implicacion:

- H12-F3 y H12-F4 no se implementan.
- No hay cambios funcionales pendientes aprobados.
- La politica queda como regla de gobierno operativo para futuras decisiones manuales o tecnicas.

## 3. Politica operativa vigente

Reglas de gobierno vigentes:

- Inactivar antes que borrar.
- No borrar registros usados historicamente.
- No modificar importes de tabuladores usados.
- Crear nuevo registro si cambia el significado operativo.
- No fusionar duplicados sin proceso especial.
- No renombrar catalogos historicos sin aprobacion.
- Conservar snapshots de nomina como fuente historica de lo pagado.
- Cualquier excepcion requiere respaldo, analisis, aprobacion y auditoria.

Esta politica aplica como guia operativa a:

- `tabulators`.
- `subjects`.
- `coordinations`.
- `academic_cycles`.
- `payroll_calendar_config`.
- `calendar_blackout_dates`.
- `teachers`.
- `roles` y `permissions` cuando aplique como catalogo tecnico.

## 4. Interpretacion de fases H12

| Fase | Interpretacion final | Resultado |
|---|---|---|
| H12-F0 | SPEC documental | Completada |
| H12-F1 | Inventario tecnico opcional/documental | No requerido para cambiar sistema; queda como referencia futura |
| H12-F2 | Diseno tecnico de no intervencion | Cierre documental |
| H12-F3 | Backend | No aplica |
| H12-F4 | Frontend | No aplica |
| H12-F5 | Deploy | No aplica |

## 5. Que hacer si se requiere cambiar un catalogo

Procedimiento operativo:

1. Identificar el catalogo.
2. Verificar si tiene uso historico.
3. Si tiene uso historico, no borrar.
4. Si cambia significado, crear nuevo registro.
5. Si solo deja de usarse, inactivar.
6. Si es correccion de acento/typo, documentar decision humana.
7. Si requiere base de datos, aplicar H05.
8. Si afecta interfaz o reglas, crear SPEC nueva.

Reglas adicionales:

- Si existe nomina guardada, conservar snapshots como fuente de verdad historica.
- Si existe duda entre correccion visual y cambio funcional, tratarlo como cambio funcional hasta que haya decision humana.
- Si una accion requiere tocar produccion, se requiere backup y checklist de release.

## 6. Riesgo residual

Riesgo residual: bajo si se sigue la politica.

El riesgo aumenta solo si alguien modifica catalogos manualmente sin procedimiento, especialmente:

- borrado de registros usados;
- cambio de importe de tabuladores usados;
- renombrado de catalogos historicos sin evidencia;
- fusion de docentes, asignaturas o coordinaciones sin analisis de dependencias;
- cambios directos en base de datos sin H05.

El mayor control para H12 es operativo/documental, no tecnico por ahora, porque la decision aprobada es no intervenir el sistema que ya funciona correctamente.

## 7. Criterio de cierre

H12 queda cerrado porque:

- La SPEC existe.
- La politica operativa queda documentada.
- La matriz se actualiza a cerrado documental.
- El SDD se actualiza a cerrado documental.
- No hay cambios tecnicos pendientes aprobados.
- No se requiere implementacion inmediata.

## 8. Confirmaciones

Confirmado:

- No se modifico codigo.
- No se modifico base de datos.
- No se hizo deploy.
- No se ejecutaron migraciones.
- No se cambiaron interfaces.
- No se cambiaron rutas.
- No se cambiaron permisos.
- No se cambiaron reglas de negocio.
- No se modificaron catalogos reales.
- No se inactivaron registros.
- No se renombraron registros.
- No se borraron registros.
- No se toco produccion.

## 9. Resultado

Resultado final:

```text
H12 cerrado documental / politica operativa
```

No se recomienda abrir H12 como implementacion tecnica mientras el sistema continue funcionando correctamente y no exista una decision humana nueva que apruebe cambios concretos.
