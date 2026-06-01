# H02/H03 - Incidente local de login con Firebase UID sintetico

## 1. Resumen

El 2026-06-01 se reviso un fallo de acceso local para un usuario Coordinador creado para pruebas con Firebase Auth real.

Sintoma reportado:

- El usuario aparecia como `ACTIVO`.
- El login mostraba mensaje de usuario sin acceso activo.

Resultado:

- El problema quedo resuelto en la BD local de pruebas.
- No se modifico codigo.
- No se modifico produccion.
- No se hizo deploy.

## 2. Usuario revisado

Correo correcto:

- `noreply@tecplayacar.edu.mx`

Correo escrito durante el reporte:

- `noreply@tecplaaycar.edu.mx`

Observacion:

- `tecplaaycar.edu.mx` es un dominio incorrecto.
- El dominio permitido por backend es `tecplayacar.edu.mx`.
- Cualquier correo con el dominio mal escrito debe fallar por diseno.

## 3. Ambiente revisado

BD local/test consultada:

- host: `localhost`
- port: `5432`
- database: `nomina_docente_test`
- user: `app_nomina`

Tambien se intento consultar `nomina_docente_h02h03` en `localhost:55432`, pero ese servicio no estaba levantado al momento del diagnostico.

## 4. Causa raiz

El usuario local `noreply@tecplayacar.edu.mx` existia con:

- rol: `coordinador`
- status: `ACTIVO`
- coordinacion/asignacion operativa: `Usuario prueba`

Pero tenia `firebase_uid` precargado con un valor sintetico del seed H04:

- `qa-fixture-rh`

El flujo de autenticacion funciona asi:

1. Firebase Auth real emite un ID token.
2. Backend verifica el token con Firebase Admin.
3. Backend busca el correo en `app_users`.
4. Si `firebase_uid` esta vacio, lo vincula al primer login.
5. Si `firebase_uid` ya existe y no coincide con el UID real del token, rechaza el acceso.

Por eso el usuario podia estar `ACTIVO` y aun asi fallar: el UID sintetico no coincidia con Firebase real.

## 5. Correccion aplicada

Se limpio solo el `firebase_uid` del usuario local:

```sql
UPDATE app_users
SET firebase_uid = NULL
WHERE lower(email) = 'noreply@tecplayacar.edu.mx';
```

Resultado esperado:

- En el siguiente login real, el backend vincula automaticamente el UID real de Firebase.
- El usuario puede iniciar sesion si usa el correo correcto.

Resultado observado:

- El usuario pudo iniciar sesion correctamente.

## 6. Alcance

Se modifico solo la BD local/test `nomina_docente_test`.

No se modifico:

- produccion;
- Cloud SQL productivo;
- Cloud Run;
- Firebase Hosting;
- codigo funcional;
- migraciones;
- H01;
- H02/H03 funcional;
- H04 funcional;
- H05.

## 7. Revision complementaria

Durante el diagnostico se reviso en modo lectura:

- proyecto GCP/Firebase activo;
- servicio Cloud Run productivo;
- commit desplegado;
- estado de tablas administrativas H05;
- ultimos movimientos de usuarios productivos.

Hallazgos complementarios:

- Produccion estaba desplegada en imagen `h02h03-prod-6ff6516`.
- No habia alta reciente del usuario local en produccion.
- El incidente era local/test, no productivo.

## 8. Regla operativa para futuras pruebas locales

Cuando se use Firebase Auth real contra BD local/test:

1. El correo en `app_users.email` debe coincidir exactamente con el correo Google/Firebase.
2. El dominio debe ser `@tecplayacar.edu.mx`.
3. Si el usuario viene de un seed con UID sintetico, limpiar `firebase_uid` antes del login real.
4. No usar cuentas tecnicas como `noreply` para pruebas regulares salvo que se confirme que pueden iniciar sesion interactivamente.
5. Para pruebas automatizadas, usar actores mock o tokens de test; no mezclar `firebase_uid` sintetico con Firebase real.

## 9. Validacion recomendada

Consulta previa:

```sql
SELECT
  u.email,
  u.display_name,
  r.code AS role,
  u.status,
  u.firebase_uid IS NOT NULL AS has_firebase_uid,
  u.last_login_at
FROM app_users u
JOIN roles r ON r.id = u.role_id
WHERE lower(u.email) = lower('<correo>');
```

Si `has_firebase_uid = true` y el usuario no puede entrar con Firebase real, validar si el UID fue ligado a otra cuenta.

## 10. Resultado

Incidente cerrado para ambiente local/test.

El usuario `noreply@tecplayacar.edu.mx` pudo ingresar despues de limpiar el UID sintetico.
