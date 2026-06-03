# H15 - Sesion por inactividad y persistencia Firebase Auth

Fecha: 2026-06-03

## 1. Problema detectado

El sistema mantenia la sesion abierta aunque el usuario cerrara el navegador o dejara la cuenta abierta sin actividad. Para un sistema de nomina con datos fiscales, financieros y documentales, esto representa un riesgo operativo porque una sesion abandonada puede quedar disponible para terceros.

## 2. Riesgo

Riesgos mitigados:

- acceso no autorizado por equipo desatendido;
- exposicion accidental de datos fiscales/financieros;
- persistencia local indefinida de Firebase Auth;
- continuidad de vistas protegidas despues de inactividad prolongada.

## 3. Politica implementada

Politica aprobada:

- Tiempo maximo de inactividad: 60 minutos.
- Advertencia previa: 5 minutos antes del cierre.
- Modal de advertencia al minuto 55 de inactividad.
- Cierre automatico al minuto 60 de inactividad.

Eventos de actividad que reinician el temporizador:

- `mousemove`;
- `keydown`;
- `click`;
- `scroll`;
- `touchstart`;
- `focus`.

El modal permite:

- continuar sesion;
- cerrar sesion manualmente.

Al expirar la sesion por inactividad:

- se ejecuta logout Firebase;
- se limpia el store de autenticacion;
- se redirige a `/login`;
- se muestra el mensaje `La sesion se cerro por inactividad.`.

## 4. Persistencia Firebase usada

Se configuro Firebase Auth con:

```ts
browserSessionPersistence
```

Objetivo:

- conservar sesion durante la misma sesion del navegador;
- evitar persistencia local permanente;
- mantener refresh de pagina dentro de la misma sesion activa;
- requerir login nuevo al reabrir navegador cuando no se restaura sesion activa.

No se usa:

```ts
browserLocalPersistence
```

## 5. Archivos modificados

Frontend:

- `apps/web/src/firebase.ts`
- `apps/web/src/stores/auth.ts`
- `apps/web/src/components/layout/AppLayout.vue`
- `apps/web/src/components/modals/SessionTimeoutModal.vue`
- `apps/web/src/composables/useIdleTimeout.ts`
- `apps/web/src/utils/session.ts`
- `apps/web/src/stores/auth.test.ts`
- `apps/web/src/test/session-timeout.test.ts`

Documentacion:

- `docs/auditoria/H15_Sesion_Inactividad_Frontend.md`

## 6. Pruebas automatizadas

Pruebas agregadas:

- el temporizador inicia cuando hay usuario autenticado;
- no inicia timers ni listeners si no hay usuario;
- la actividad reinicia el temporizador;
- no se duplican listeners;
- el modal aparece al minuto 55;
- el modal muestra advertencia y cuenta regresiva;
- `Continuar sesion` cierra modal y reinicia temporizador;
- `Cerrar sesion` ejecuta logout;
- el cierre automatico ocurre al minuto 60;
- el logout por inactividad limpia estado y redirige a login;
- logout manual sigue funcionando;
- logout con mensaje conserva el mensaje de inactividad.

Se usaron timers falsos de Vitest.

## 7. Pruebas manuales

Prueba manual local recomendada antes de deploy:

1. Levantar API y frontend locales contra una base local/revision.
2. Iniciar sesion con usuario autorizado.
3. Confirmar que la sesion funciona en vistas protegidas.
4. Si se requiere validar rapido, usar timeout corto temporal solo en local sin commitearlo.
5. Confirmar que aparece el modal de advertencia.
6. Confirmar boton `Continuar sesion`.
7. Confirmar boton `Cerrar sesion`.
8. Confirmar cierre automatico por inactividad.
9. Confirmar redireccion a `/login`.
10. Cerrar navegador y reabrir.
11. Confirmar que requiere login nuevamente si el navegador no restaura la sesion activa.
12. Confirmar que refrescar pagina durante una sesion activa no rompe la sesion.

No usar produccion para pruebas destructivas.

## 8. Que NO se toco

Confirmado:

- No se modifico backend funcional.
- No se modifico base de datos.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se toco produccion.
- No se cambiaron roles.
- No se cambiaron permisos.
- No se cambio nomina.
- No se cambio H01/H02/H03/H05/H09/H10/H11/H12/H13.
- No se cambio CSV.
- No se cambio cierre de ciclo.
- No se cambiaron variables productivas.
- No se tocaron secretos.

## 9. Riesgos residuales

- La prueba de cerrar navegador y reabrir depende del comportamiento del navegador y de si restaura sesion/tabs.
- Si el usuario mantiene actividad simulada o automatizada en el navegador, el temporizador se reiniciara como actividad.
- El backend sigue confiando en tokens Firebase validos; H15 actua como control frontend de sesion e inactividad.
- Si se decide control de sesion mas estricto del lado servidor, se requeriria una fase nueva con SPEC.

## 10. Recomendacion para deploy

Antes de deploy:

1. Ejecutar suite completa:
   - `npm run test`;
   - `npm run test:web`;
   - `npm run test:api`;
   - `npm run test:api:integration`;
   - `npm --workspace apps/api run typecheck`;
   - `npm --workspace apps/web run typecheck`;
   - `npm run typecheck`;
   - `npm run build`.
2. Ejecutar prueba manual local con usuario autorizado.
3. Usar checklist H13 antes de cualquier deploy productivo.
4. No modificar variables productivas para H15; la politica queda en constantes internas:
   - `IDLE_TIMEOUT_MS = 60 * 60 * 1000`;
   - `IDLE_WARNING_MS = 5 * 60 * 1000`.

H15 queda listo para predeploy si las validaciones automatizadas y manuales pasan.
