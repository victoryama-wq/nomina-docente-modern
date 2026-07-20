# H21 - Validacion CSV institucional previa a deploy

Fecha: 2026-07-20

Estado: preview inicial conservado como evidencia; conciliacion aprobada y
ensayada posteriormente; apply CSV no ejecutado.

## 1. Fuente validada

No se encontro en los archivos suministrados un CSV H21 externo con encabezado
exacto `id,clave,nombre,estatus`. Para no inventar ni transformar un archivo
institucional, se uso como baseline la plantilla `scope=catalog` generada por
la API desde las 281 asignaturas de la copia temporal restaurada de produccion.

El archivo se mantuvo en memoria durante `app.inject()`: no se versiono, no se
copio al repositorio y no se incluyo su contenido en esta evidencia.

## 2. Operacion ejecutada

1. `GET /api/catalogs/subjects/import/template?scope=catalog` como Admin de test.
2. `POST /api/catalogs/subjects/import/preview` con la plantilla recibida.
3. No se llamo `POST /api/catalogs/subjects/import/apply`.

La plantilla tuvo 21,433 bytes y el preview devolvio HTTP 200.

## 3. Conteos del preview

| Clasificacion | Conteo |
|---|---:|
| Nuevas | 0 |
| Actualizacion de clave | 0 |
| Actualizacion de nombre | 0 |
| Actualizacion de estatus | 0 |
| Actualizacion multiple | 0 |
| Sin cambios | 271 |
| Inactivaciones | 0 |
| Posibles duplicados por nombre | 0 |
| Duplicado de nombre normalizado en CSV | 10 |
| Otros errores | 0 |
| Total | 281 |

Resultado:

- cinco grupos normalizados de dos filas cada uno permanecen separados;
- las 10 filas se clasifican `DUPLICADO_NOMBRE_CSV`;
- `hasBlockingErrors = true`;
- filas bloqueantes: 10;
- apply no debe ejecutarse mientras permanezcan estos bloqueantes.

## 4. Interpretacion

La prueba confirma que la API no fusiona automaticamente las cinco colisiones
legacy y que el preview detiene una aplicacion insegura. Tambien evidencia que
la plantilla completa del catalogo no puede aplicarse sin una decision humana
sobre esos grupos y sus claves oficiales.

Sigue pendiente recibir o preparar, fuera del repositorio, el CSV institucional
editado con claves aprobadas. Ese archivo debera pasar nuevamente por preview;
no se debe inferir una solucion para las 10 filas a partir del nombre.

## 5. Bloqueantes del preview inicial

1. Resolver humanamente las cinco colisiones normalizadas mediante `id`, sin
   merge ni DELETE. **Resuelto:** se aprobaron cinco UUID canonicos.
2. Validar el CSV institucional final con encabezado H21 exacto.
3. Resolver el hallazgo critico npm documentado en
   `SEC_H21_Triage_Npm_Audit_PreDeploy.md`. **Resuelto:**
   `websocket-driver@0.7.5`, cero critical.
4. Repetir H05/H13 antes de cualquier ventana productiva.

## 6. Resultado posterior a la conciliacion temporal

Sobre la restauracion temporal `h21-reconcile-20260720` se aplico `013` y la
conciliacion aprobada. La plantilla activa generada despues tuvo:

| Clasificacion | Conteo |
|---|---:|
| Sin cambios | 276 |
| Duplicado de nombre normalizado en CSV | 0 |
| Posible duplicado por nombre | 0 |
| Filas bloqueantes | 0 |
| Total | 276 |

`hasBlockingErrors = false`. No se invoco apply CSV. El detalle se conserva en
`H21_Ensayo_Conciliacion_Duplicados_Temporal.md`.

Queda pendiente preparar el CSV institucional con claves oficiales aprobadas y
repetir su preview durante la ventana productiva. La plantilla activa ya no
arrastra los cinco duplicados inactivos.

## 7. Confirmaciones

- El preview CSV inicial y el posterior fueron solamente lectura; sin apply.
- La conciliacion con COMMIT ocurrio solo en la instancia temporal eliminada.
- Sin archivo institucional versionado.
- Sin contenido completo del CSV en documentacion.
- Sin migracion productiva.
- Sin deploy.
- Sin cambios H01.
- Sin borrado ni fusion de asignaturas.
