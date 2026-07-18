# Importacion legacy: Directorio y Usuarios/Roles

Estado documental: **histórico y no operativo**.

No ejecutar este procedimiento contra producción. El legacy Apps Script fue retirado en H06/H14 y las cargas productivas posteriores usan validación nominal, backup, preview en `ROLLBACK`, aprobación humana y H05. Fuente vigente: `docs/sdd/SDD_CONSOLIDADO_NOMINA_DOCENTE_POST_H09_H10.md`.

La app moderna ya tiene tablas y pantallas para `Directorio Docente` y `Control de Accesos`.

## Hojas origen

Exporta estas hojas desde el Spreadsheet legacy como CSV:

```text
Directorio
Coord. Academicos
```

Guarda los archivos en una carpeta local, por ejemplo:

```text
database/imports/Directorio.csv
database/imports/Coord_Academicos.csv
```

## Generar SQL de importacion

```powershell
npm run legacy:csv-to-sql -- --directorio database/imports/Directorio.csv --usuarios database/imports/Coord_Academicos.csv --out database/imports/legacy_import.sql
```

El script:

- importa docentes usando `normalized_name` para evitar duplicados;
- crea coordinaciones si no existen;
- importa usuarios solo si `Usuario` es un correo `@tecplayacar.edu.mx`;
- no migra contrasenas legacy, porque el login nuevo usa Google/Firebase Auth;
- conserva el usuario legacy en `legacy_username`;
- mantiene `ACTIVO` / `INACTIVO`;
- acepta roles `admin`, `coordinador`, `finanzas`, `contador`, `contabilidad`.

## Importar a Cloud SQL

Revisa primero `database/imports/legacy_import.sql`. Despues:

```powershell
$gcloud = (Get-Command gcloud.cmd).Source
& $gcloud storage cp database/imports/legacy_import.sql gs://nomina-docente-prod-sql-imports/legacy_import.sql --project=nomina-docente-prod
& $gcloud sql import sql nomina-docente-web gs://nomina-docente-prod-sql-imports/legacy_import.sql --database=nomina_docente --project=nomina-docente-prod --quiet
```

Despues de importar, entra a:

```text
https://nomina-docente-prod.web.app
```

y valida `Directorio` y `Accesos`.
