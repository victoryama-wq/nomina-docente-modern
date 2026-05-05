# Base de datos de Nomina Docente

Base objetivo: `nomina_docente` en Cloud SQL PostgreSQL.

Ejecuta `001_initial_schema.sql` conectado a la base `nomina_docente`, no a la base administrativa `postgres`.

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
