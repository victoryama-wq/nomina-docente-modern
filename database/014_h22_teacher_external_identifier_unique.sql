-- H22 - Integridad fisica del identificador institucional de docentes.
-- La clave canonica usa upper(btrim(...)) y excluye valores vacios legacy.

CREATE UNIQUE INDEX teachers_external_identifier_unique_idx
  ON teachers ((upper(btrim(external_identifier))))
  WHERE btrim(external_identifier) <> '';
