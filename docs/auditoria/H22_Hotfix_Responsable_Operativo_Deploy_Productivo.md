# H22-HF1B - Deploy productivo del responsable operativo

Fecha de deploy: 2026-07-31

Fecha de cierre documental: 2026-08-20

Estado: cerrado operativo

Clasificacion corregida: `READ_PROJECTION_DEFECT`

## 1. Objetivo

Cerrar el hotfix de lectura de Directorio para que `Responsable operativo`
muestre el usuario real resuelto desde `teachers.created_by`, sin usar
`coordinationName` como sustituto y sin corregir datos en Cloud SQL.

## 2. Infraestructura desplegada

| Elemento | Resultado |
|---|---|
| Cloud Build | `c28d8f81-c011-48f7-a970-de2d5338a7da` |
| Imagen | `h22-hf1-081532d` |
| Digest | `sha256:24ea3e66d89ed6f581bbb0ad464decc8531a6738ed9cfaf0094007633b6e471b` |
| Cloud Run anterior | `nomina-api-00053-cjg` |
| Cloud Run vigente | `nomina-api-00054-2ld` |
| Trafico | 100% a `nomina-api-00054-2ld` |
| Hosting release | `1785536172540000` |
| Hosting version | `91ba12f3159468b8` |
| Healthchecks | HTTP 200 directo y via Hosting |
| `/api/teachers` sin sesion | HTTP 401 esperado |

La configuracion operativa de Cloud Run conservo su fingerprint. No se
cambiaron variables, secretos, service account, Cloud SQL attachment, CORS ni
recursos del servicio.

## 3. Estado H05 y dependencias

- H05: 17 migraciones registradas.
- Pendientes: 0.
- Checksum mismatch: 0.
- No se ejecuto migracion, `db:migrate`, seed ni script de conciliacion.
- `npm audit`: 0 criticas, 8 high, 10 moderate y 1 low.
- No se ejecuto `npm audit fix` ni se modificaron dependencias.

## 4. Logs finales

La revision `nomina-api-00054-2ld` figura `Ready` y `Active`, con 100% del
trafico y la imagen/digest esperados.

| Control | Resultado |
|---|---|
| Logs `severity=ERROR` | 0 |
| Errores criticos del hotfix | 0 |
| Health Cloud Run | 200 |
| Health Hosting | 200 |

Se observo un `POST /api/schedules` HTTP 400 el 2026-08-20, clasificado como
evento operativo ajeno a Directorio y a H22-HF1B. No existe evidencia de error
de proyeccion de responsables en la revision vigente.

## 5. Smoke autenticado aprobado

El usuario confirmo manualmente:

- los 14 docentes creados por la ejecucion H22 muestran el responsable real
  derivado de `teachers.created_by`;
- ninguno muestra `Sin responsable`;
- ninguno usa `coordinationName` como sustituto;
- el caso que antes mostraba una coordinacion ahora muestra al usuario real;
- nombre y correo del responsable se presentan correctamente;
- no se muestran UUID tecnicos;
- un docente legacy real con `created_by IS NULL` conserva `Sin responsable`;
- Directorio sigue operativo para Admin, Coordinador, Direccion y RH conforme
  a sus permisos vigentes;
- no se ampliaron permisos de edicion;
- no se expusieron datos fiscales;
- no se modifico ningun docente durante el smoke.

## 6. Validacion productiva read-only posterior

La verificacion se realizo contra `nomina_docente` mediante Cloud SQL Auth
Proxy y transaccion `READ ONLY`. El proxy se apago al terminar.

Para los 14 UUID exactos de la ejecucion H22:

| Control | Resultado |
|---|---:|
| `created_by IS NULL` | 0 |
| Responsable inexistente | 0 |
| Responsable inactivo | 0 |
| Rol no permitido | 0 |
| Diferencia contra `TEACHER_CREATED` | 0 |
| Fingerprint actual de los 14 `created_by` | `6811053b631e47acba898011771a5768` |

Por tanto, los 14 `created_by` permanecen identicos a la evidencia de
auditoria de su alta. No fue necesaria ninguna correccion de BD.

Fingerprints globales read-only capturados el 2026-08-20:

| Conjunto | Filas | Fingerprint |
|---|---:|---|
| `teachers_created_by` | 239 | `f84e059326f97916a34afa12ac5b9a12` |
| `teachers_operational` | 239 | `a28ad916c320f5baa1f0d13fef1aa08b` |
| `teachers_fiscal` | 239 | `22791f90e857bd7146a2965401a5cf3a` |
| `teacher_documents` | 15 | `e5a1b72c4b88022a146bcd4a513b9d7e` |
| `payroll_runs` | 11 | `100e678d44a9cc1472993ddd60dc36a3` |
| `payroll_lines` | 2460 | `ddd34049883511288f00af936707259d` |
| `payroll_schedule_details` | 6522 | `194beb4106ad3d16111619a7bb23a47a` |
| `payroll_extra_details` | 672 | `2adf028301dce27e5476c784ec74890b` |

Los fingerprints globales no se comparan como igualdad contra el predeploy
porque transcurrieron veinte dias de operacion normal. La auditoria separo esa
actividad: no hubo escrituras de docentes, Nomina o snapshots en la ventana del
deploy/smoke; la primera escritura posterior registrada fue el
2026-08-06T20:59:08.126854Z, casi seis dias despues. Los cambios globales
posteriores corresponden a operacion productiva ajena al hotfix.

## 7. Plantilla vacia

La plantilla vacia contiene unicamente encabezados. No agrega una fila de
trabajo, datos de ejemplo ni informacion fiscal.

## 8. Resultado y seguridad

- `READ_PROJECTION_DEFECT`: corregido.
- Cero correcciones de BD.
- SQL preventivo no ejecutado.
- Ningun Apply repetido.
- Ninguna migracion.
- Ningun cambio H01.
- Ningun cambio en Nomina, corridas o snapshots atribuible al hotfix.
- Ninguna exposicion o modificacion fiscal.
- No fue necesario rollback.

H22-HF1B queda cerrado operativo con `nomina-api-00054-2ld` y Hosting release
`1785536172540000` vigentes.
