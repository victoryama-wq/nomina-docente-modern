# H15 - Predeploy sesion por inactividad

Fecha: 2026-06-03

## 1. Commit validado

Commit base H15:

```text
788818b feat(auth): add idle session timeout
```

Durante este predeploy se detecto una discrepancia menor contra el checklist manual aprobado: el modal de advertencia no mostraba aun la leyenda de perdida de datos no guardados. Se corrigio en frontend antes de cerrar el predeploy:

```text
Guarda tus cambios antes de que termine el tiempo. Los datos no guardados se perderan.
```

Alcance de la correccion:

- frontend solamente;
- modal H15;
- prueba automatizada del texto;
- sin backend;
- sin base de datos;
- sin migraciones;
- sin produccion.

## 2. Validaciones automatizadas

| Validacion | Resultado | Observacion |
|---|---|---|
| `npm run test` | OK | API: 5 archivos, 22 pruebas. Web: 11 archivos, 46 pruebas. |
| `npm run test:web` | OK | 11 archivos, 46 pruebas. Incluye H15 con timers falsos. |
| `npm run test:api` | OK | 5 archivos, 22 pruebas. |
| `npm run test:api:integration` | Skipped por configuracion | 7 archivos y 47 pruebas skipped cuando `TEST_DB_NAME` no esta definido explicitamente. |
| `TEST_DB_NAME=nomina_docente_test npm run test:api:integration` | No ejecutable en esta corrida | Intento seguro contra `nomina_docente_test`; fallo por `ECONNREFUSED localhost:55432` porque PostgreSQL local/test no estaba disponible. No se uso produccion. |
| `npm --workspace apps/api run typecheck` | OK | Sin errores TypeScript API. |
| `npm --workspace apps/web run typecheck` | OK | Sin errores Vue/TypeScript. |
| `npm run typecheck` | OK | API + Web. |
| `npm run build` | OK | API + Web; build Vite correcto. |

Interpretacion de integracion API:

- La suite de integracion esta protegida para no correr si `TEST_DB_NAME` no es exactamente `nomina_docente_test`.
- Al definir `TEST_DB_NAME=nomina_docente_test`, la suite intento correr contra base local/test y fallo por conexion rechazada en `localhost:55432`.
- El fallo es de ambiente local apagado/no disponible, no de H15.
- H15 no modifica backend ni rutas API; la cobertura principal esta en pruebas frontend.

## 3. Resultado de prueba manual local

Prueba manual con usuario autorizado en navegador local: **parcial satisfactoria**.

Ambiente:

- Ambiente: local.
- Usuario: autorizado.
- Produccion: no utilizada.

Resultado confirmado por usuario:

| Punto validado | Resultado | Observacion |
|---|---|---|
| Modal de advertencia | OK | El usuario confirmo visualmente que el sistema manda el modal/mensaje de aviso de cierre. |
| Mensaje de aviso de cierre | OK | Confirmado en navegador real local. |
| Advertencia previa al cierre | OK | Confirmada por aparicion del aviso antes del cierre. |
| Texto de datos no guardados | Cubierto por prueba automatizada | No se registro confirmacion visual separada; `session-timeout.test.ts` valida que el texto se renderiza. |
| Continuar sesion | Pendiente manual | Cubierto por prueba automatizada con timers falsos. |
| Cerrar sesion | Pendiente manual | Cubierto por prueba automatizada. |
| Cierre automatico al minuto 60 | Pendiente manual | No se espero el ciclo completo; cubierto por prueba automatizada. |
| Redireccion a login | Pendiente manual | Cubierto por prueba automatizada de logout por inactividad. |
| Persistencia al cerrar/reabrir navegador | Pendiente manual | Depende del navegador y queda para smoke postdeploy o prueba manual ampliada. |

Interpretacion:

- La validacion manual parcial es satisfactoria para el comportamiento visual principal del aviso.
- Las pruebas automatizadas cubren modal, texto de datos no guardados, continuar sesion, cerrar sesion y cierre automatico.
- Los puntos manuales no ejecutados deben revisarse como smoke postdeploy H15 o en una prueba manual ampliada si operacion lo exige.

Cobertura automatizada ya disponible:

- timer inicia con usuario autenticado;
- no inicia en login/sin usuario;
- actividad reinicia temporizador;
- no duplica listeners;
- modal aparece al minuto 55;
- modal muestra advertencia de cierre por inactividad;
- modal muestra advertencia de datos no guardados;
- `Continuar sesion` mantiene sesion y reinicia timer;
- `Cerrar sesion` ejecuta logout;
- al minuto 60 ejecuta logout automatico;
- logout por inactividad limpia estado y redirige a login;
- logout manual sigue funcionando;
- permisos/visibilidad por rol no fueron alterados.

Prueba manual requerida antes de deploy productivo:

1. Levantar API local contra base local/revision.
2. Levantar frontend local.
3. Iniciar sesion con usuario autorizado.
4. Confirmar que refresh mantiene sesion dentro de la misma sesion de navegador.
5. Usar timeout corto temporal local no commiteado, o validar con herramientas de test.
6. Confirmar modal de advertencia.
7. Confirmar texto:
   - `Tu sesion se cerrara por inactividad en 5 minutos.`
   - `Guarda tus cambios antes de que termine el tiempo. Los datos no guardados se perderan.`
8. Confirmar `Continuar sesion`.
9. Confirmar `Cerrar sesion`.
10. Confirmar cierre automatico.
11. Confirmar redireccion a `/login`.
12. Confirmar que cerrar/reabrir navegador requiere login si la sesion de navegador no se restaura.
13. Confirmar que logout manual sigue funcionando.
14. Confirmar que permisos y vistas por rol no cambian.

Estado despues de la validacion del usuario:

- La prueba manual local minima de aviso/modal queda cumplida.
- La prueba manual completa queda recomendada, pero no bloqueante si se acepta cobertura automatizada + smoke postdeploy.

## 4. Resultado de persistencia de sesion

Implementacion validada por codigo y build:

- Firebase Auth usa `browserSessionPersistence`.
- No se usa `browserLocalPersistence`.
- `login()` espera la configuracion de persistencia antes de `signInWithPopup`.
- `initAuth()` espera la configuracion de persistencia antes de escuchar `onAuthStateChanged`.

Pendiente manual:

- cerrar navegador y reabrir para confirmar comportamiento real del navegador usado por operacion.

## 5. Confirmacion de perdida de datos no guardados

El modal H15 muestra advertencia explicita:

```text
Guarda tus cambios antes de que termine el tiempo. Los datos no guardados se perderan.
```

La prueba frontend `session-timeout.test.ts` valida que el texto se renderiza.

## 6. Confirmacion de no backend/BD/migraciones

Confirmado:

- No se modifico backend funcional.
- No se modifico base de datos.
- No se ejecutaron migraciones.
- No se tocaron permisos.
- No se cambiaron roles.
- No se cambiaron reglas de negocio.
- No se cambio nomina.
- No se cambio CSV.
- No se cambio cierre de ciclo.
- No se cambiaron variables productivas.
- No se tocaron secretos.
- No se toco produccion.
- No se hizo deploy.

## 7. Riesgos residuales

| Riesgo | Estado | Mitigacion |
|---|---|---|
| Prueba manual completa pendiente | No bloqueante si se acepta cobertura automatizada + smoke postdeploy | Ejecutar smoke postdeploy H15 con usuario autorizado despues del deploy controlado. |
| PostgreSQL local/test no disponible | No bloqueante para H15 frontend, pero impide repetir integracion API completa | Levantar `nomina_docente_test` si se requiere repetir integracion antes de deploy. |
| Cierre/reapertura del navegador depende del navegador | Pendiente manual | Validar en el navegador institucional usado por operacion. |
| Datos no guardados pueden perderse al expirar sesion | Riesgo esperado y advertido | Modal muestra advertencia explicita antes del cierre. |

## 8. Recomendacion

Recomendacion actual: **deploy controlado autorizado con smoke postdeploy H15**.

Motivo:

- Validaciones automatizadas principales pasan.
- H15 frontend esta construido y probado.
- El usuario valido en navegador local real el aviso/modal de cierre por inactividad.
- La validacion manual fue parcial, pero el resto del flujo critico esta cubierto por pruebas automatizadas.
- La integracion API explicita contra `nomina_docente_test` no pudo repetirse porque PostgreSQL local/test no estaba disponible.

Condicion para deploy controlado:

1. Usar H13 antes del deploy productivo.
2. No ejecutar migraciones.
3. No modificar backend, BD, permisos, reglas ni variables productivas.
4. Ejecutar smoke postdeploy H15:
   - login;
   - modal de inactividad;
   - continuar sesion;
   - cerrar sesion;
   - cierre automatico si se valida con timeout corto de revision o espera controlada;
   - logout manual;
   - permisos y vistas por rol sin cambios.
