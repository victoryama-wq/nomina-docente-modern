# Flujo de Trabajo H02/H03

Este documento establece el flujo obligatorio para implementar H02/H03 en Nómina Docente.

## 1. Rama de trabajo

Toda la implementación H02/H03 debe realizarse en la rama:

```text
feature/h02-h03-user-coordinations-permissions
```

No se debe trabajar directamente sobre `main` para estos cambios.

## 2. Commits por fase

Cada fase debe quedar registrada en commits separados, claros y revisables.

Formato sugerido:

```text
fase-1: migraciones y validaciones h02-h03
fase-2: auth context multi-coordinacion h02
fase-3: permisos operativos por coordinacion h02
fase-4: permisos fiscal finanzas nomina h03
fase-5: frontend permisos y multi-coordinacion h02-h03
fase-6: pruebas y ajustes h02-h03
```

No mezclar fases en un mismo commit salvo correcciones menores estrictamente necesarias y documentadas.

## 3. Deploy

No hacer deploy automático a producción.

Producción solo puede desplegarse cuando se cumpla todo lo siguiente:

- Admin aprueba la fase.
- Pruebas por rol pasan.
- No hay bloqueantes.
- Rollback está definido.
- Ambiente destino fue confirmado.

## 4. Entrega obligatoria después de cada fase

Después de cada fase se debe entregar:

- Archivos modificados.
- Resumen del cambio.
- Pruebas ejecutadas.
- Riesgos.
- Instrucciones de rollback.
- Indicar si requiere o no despliegue de revisión.

## 5. Reglas específicas para Fase 1

Fase 1 debe limitarse a:

- Crear migraciones.
- Crear seeds.
- Crear scripts o consultas de validación.
- Actualizar documentación técnica.

Fase 1 no debe:

- Desplegar producción.
- Activar modo estricto.
- Retirar fallback legacy.
- Cambiar reglas de negocio.
- Modificar flujo operativo activo.

## 6. Validaciones antes de cualquier despliegue

Antes de cualquier despliegue, incluso a revisión, se debe:

1. Ejecutar typecheck.
2. Ejecutar build.
3. Revisar diff.
4. Confirmar ambiente destino.
5. Confirmar rollback.

## 7. Condiciones para producción

Producción solo se despliega cuando:

- Admin aprueba la fase.
- Pruebas por rol pasan.
- No hay bloqueantes.
- Rollback está definido.

## 8. Reglas de seguridad H02/H03

Durante todas las fases:

- No retirar fallback legacy en la primera implementación.
- No activar modo estricto hasta validar datos y pruebas por rol.
- No crear coordinaciones automáticamente desde flujos operativos.
- No tratar `"Todas / Global"` como coordinación real.
- No tratar `"No requiere coordinación operativa"` como coordinación real.
- No permitir que `finance.view` habilite workflow.
- No permitir que `finance.view` habilite fiscal.
- No permitir que `teachers.manage` habilite fiscal.
- No permitir que Coordinador guarde nómina.
- No permitir que Coordinador edite fiscal.
- No permitir que Contador edite fiscal.
- No permitir que Dirección cambie estados financieros.

## 9. Registro de cierre por fase

Cada fase debe cerrar con un resumen operativo en formato:

```text
Fase:
Commit:
Archivos modificados:
Resumen:
Pruebas:
Riesgos:
Rollback:
Requiere despliegue de revisión:
Pendientes:
```

