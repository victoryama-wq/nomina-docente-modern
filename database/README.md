# Base de datos de Nomina Docente

Estado documental: **superado para ejecución sobre una base existente**.

Fuente vigente: `docs/auditoria/H05_Control_Formal_Migraciones.md` y
`docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md`.

Este archivo conserva el contexto de creación inicial. No se debe ejecutar
`001_initial_schema.sql` contra producción ni contra una base ya inicializada.

Base objetivo: `nomina_docente` en Cloud SQL PostgreSQL.

En una instalación nueva y expresamente aprobada, la preparación debe seguir H05 y aplicar las migraciones en orden. En producción existe baseline de 15 migraciones y no deben reaplicarse.

El script crea el esquema inicial, roles, permisos y el administrador general protegido:

```text
victor.yama@tecplayacar.edu.mx
```

Regla de acceso prevista para el backend:

1. Firebase Auth valida inicio de sesion con Google.
2. El backend rechaza correos fuera de `@tecplayacar.edu.mx`.
3. El backend busca el correo en `app_users`.
4. Solo usuarios `ACTIVO` pueden entrar.
5. Los permisos reales se toman de PostgreSQL.

No guardes contrasenas de Cloud SQL en archivos del proyecto. Deben vivir en Secret Manager.
