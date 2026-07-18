# H21-F3 - Horarios vinculados al catalogo de Asignaturas

Fecha: 2026-07-18

Estado: implementada y validada en local/test; sin deploy.

## 1. Cambio funcional acotado

Horarios deja de crear asignaturas a partir de texto libre. Crear o editar un
horario exige un `subjectId` existente y el backend obtiene `subject_name`
directamente de `subjects.name`.

## 2. Reglas

- alta de Horario: solo asignatura `ACTIVO`;
- edicion: puede conservar la misma asignatura si fue inactivada despues;
- cambio de asignatura: el nuevo destino debe estar activo;
- ID inexistente: error controlado;
- `subjectName` enviado por el cliente no sustituye al catalogo;
- no se modifica la formula ni la precision H01.

## 3. Integridad historica

No se modifican Horarios existentes, snapshots ni lineas de nomina. La columna
snapshot/texto de Horarios sigue guardando el nombre canonico del catalogo en
el momento de la captura o edicion.

## 4. Interfaz

El modal de Horarios reemplaza el datalist de texto libre por un buscador que
consulta el endpoint normalizado. El usuario selecciona un resultado por UUID;
se muestra el nombre oficial y, cuando existe, la clave institucional. Cambiar
el texto de busqueda limpia la seleccion, por lo que no puede enviarse como una
alta implicita.

## 5. Pruebas

La prueba de integracion cubre:

- `subjectId` obligatorio y cero auto-altas;
- nombre canonico aun con texto manipulado;
- rechazo de ID inexistente;
- rechazo de asignatura inactiva en altas;
- conservacion de la misma inactiva al editar;
- rechazo al cambiar hacia otra inactiva.

## 6. Confirmaciones

- Sin produccion.
- Sin deploy.
- Sin migracion adicional.
- Sin cambios de BD fuera del reset de `nomina_docente_test`.
- Sin cambios H01.
