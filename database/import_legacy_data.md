# Importacion legacy: Directorio y Usuarios/Roles

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
$gcloud = 'C:\Users\Admin\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
& $gcloud storage cp database/imports/legacy_import.sql gs://nomina-docente-prod-sql-imports/legacy_import.sql --project=nomina-docente-prod
& $gcloud sql import sql nomina-docente-web gs://nomina-docente-prod-sql-imports/legacy_import.sql --database=nomina_docente --project=nomina-docente-prod --quiet
```

Despues de importar, entra a:

```text
https://nomina-docente-prod.web.app
```

y valida `Directorio` y `Accesos`.
