# H04 - Audit de Dependencias Firebase

Fecha: 2026-05-28

## 1. Estado antes

El audit inicial reportaba:

- 9 vulnerabilidades `moderate`.
- El paquete directo afectado era `firebase-admin` en runtime productivo de `apps/api`.
- Las vulnerabilidades venian principalmente de dependencias transitivas de Google Cloud y `uuid`.

## 2. Accion aplicada

Se ejecuto:

```bash
npm audit fix
```

Reglas respetadas:

- No se uso `npm audit fix --force`.
- No se acepto downgrade de `firebase-admin`.
- No se modifico logica funcional.
- No se modificaron reglas H01/H02/H03.
- No se hizo deploy.
- No se ejecuto nada contra produccion.

## 3. Commit de correccion

Commit aplicado:

```text
a8a86ca chore(security): update firebase dependencies for audit fixes
```

Archivo modificado:

- `package-lock.json`

No se modificaron:

- `package.json`
- `apps/api/package.json`
- `apps/web/package.json`
- codigo funcional

## 4. Resultado

Versiones finales relevantes:

| Paquete | Version final |
|---|---:|
| `firebase-admin` | `13.10.0` |
| `protobufjs` | `7.6.1` |
| `@google-cloud/firestore` | `7.11.6` |
| `@google-cloud/storage` | `7.19.0` |
| `google-gax` | `4.6.1` |
| `gaxios` | `6.7.1` / `7.1.4` |
| `retry-request` | `7.0.2` |
| `teeny-request` | `9.0.0` |

Resultado de `npm audit` despues de la correccion segura:

- 8 vulnerabilidades `moderate` restantes.
- El riesgo residual se concentra en dependencias transitivas de Google Cloud y `uuid`.

## 5. Motivo para no usar `--force`

No se uso `npm audit fix --force` porque npm proponia una correccion con downgrade/cambio mayor hacia:

```text
firebase-admin@10.3.0
```

Esa accion se considera mas riesgosa que mantener temporalmente vulnerabilidades transitivas moderadas porque:

- implicaria retroceder desde `firebase-admin@13.10.0` a `10.3.0`;
- podria introducir incompatibilidades con Firebase Admin actual;
- podria afectar autenticacion, Storage o integraciones Cloud;
- no corresponde a un cambio menor controlado;
- requeriria SPEC o revision tecnica separada.

## 6. Validaciones ejecutadas

Validaciones ejecutadas despues del fix:

| Validacion | Resultado |
|---|---|
| `npm run test` | OK |
| `npm --workspace apps/api run typecheck` | OK |
| `npm --workspace apps/web run typecheck` | OK |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `/health` local | 200 OK |
| `/auth/session` sin token | 401 esperado |

Smoke local:

- API compilada levantada contra BD local.
- `/health` respondio correctamente.
- `/auth/session` sin token respondio `401`, comportamiento esperado.

## 7. Riesgo residual

Riesgo residual:

- 8 vulnerabilidades `moderate`.
- Dependencias transitivas afectadas:
  - `uuid`
  - `google-gax`
  - `gaxios`
  - `retry-request`
  - `teeny-request`
  - `@google-cloud/firestore`
  - `@google-cloud/storage`
- El origen operativo es el arbol de dependencias de Google Cloud/Firebase Admin.

Impacto estimado:

- Riesgo moderado.
- Afecta runtime productivo por estar bajo `firebase-admin`.
- No se identifico una correccion segura sin cambio mayor o downgrade.

## 8. Recomendacion

Recomendaciones:

1. Monitorear nuevas versiones de:
   - `firebase-admin`
   - `@google-cloud/firestore`
   - `@google-cloud/storage`
   - `google-gax`
2. Revisar `npm audit` antes de cada deploy productivo.
3. No aplicar `npm audit fix --force` sin SPEC o revision tecnica.
4. Reintentar `npm audit fix` normal cuando existan parches transitivos compatibles.
5. Mantener el resultado documentado como excepcion temporal controlada.

## 9. Confirmacion de alcance

Se confirma:

- No se toco logica funcional.
- No se modifico H01.
- No se modifico H02.
- No se modifico H03.
- No se cambio formula de nomina.
- No se cambiaron permisos productivos.
- No se ejecuto nada contra produccion.
- No se hizo deploy.
