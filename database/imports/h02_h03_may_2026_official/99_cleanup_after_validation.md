# Limpieza posterior a migracion validada

No ejecutar esta limpieza hasta que:

- Produccion tenga Directorio, Horarios, Incidencias y Extras oficiales.
- La nomina `2026-05-15 a 2026-05-28` calcule `$517,510.00`.
- Admin confirme que ya no se requiere comparar contra la base de revision.
- Exista backup reciente de produccion.

## Recursos de revision a eliminar

### Cloud Run revision service

```powershell
$gcloud = (Get-Command gcloud.cmd).Source
& $gcloud run services delete nomina-api-h02h03-review `
  --project=nomina-docente-prod `
  --region=us-central1 `
  --quiet
```

### Firebase Hosting preview channel

```powershell
$firebase = (Get-Command firebase.cmd).Source
& $firebase hosting:channel:delete h02-h03-review `
  --project nomina-docente-prod `
  --force
```

### Base Cloud SQL de revision

```powershell
$gcloud = (Get-Command gcloud.cmd).Source
& $gcloud sql databases delete nomina_docente_h02h03_review `
  --instance=nomina-docente-web `
  --project=nomina-docente-prod `
  --quiet
```

## Regla final

Despues de esta limpieza debe quedar una sola base operativa:

```text
nomina_docente
```

La base `postgres` puede seguir existiendo porque es base de sistema de PostgreSQL.
