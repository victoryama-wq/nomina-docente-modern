-- H21 - Importacion CSV y busqueda normalizada de Asignaturas.
-- Migracion aditiva: no modifica IDs, nombres, estatus, horarios ni snapshots.

BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS official_code text NULL,
  ADD COLUMN IF NOT EXISTS normalized_name text;

-- unaccent es STABLE, no IMMUTABLE. normalized_name se mantiene mediante
-- trigger para no declarar una volatilidad incorrecta en una columna generada.
CREATE OR REPLACE FUNCTION normalize_subject_search(input_value text)
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        lower(public.unaccent(coalesce(input_value, ''))),
        '[[:punct:]]+',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION set_subject_normalized_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_name := normalize_subject_search(NEW.name);
  RETURN NEW;
END;
$$;

UPDATE subjects
SET normalized_name = normalize_subject_search(name)
WHERE normalized_name IS DISTINCT FROM normalize_subject_search(name);

ALTER TABLE subjects
  ALTER COLUMN normalized_name SET NOT NULL;

DROP TRIGGER IF EXISTS subjects_normalized_name_trg ON subjects;

CREATE TRIGGER subjects_normalized_name_trg
BEFORE INSERT OR UPDATE OF name ON subjects
FOR EACH ROW
EXECUTE FUNCTION set_subject_normalized_name();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'subjects'::regclass
      AND conname = 'subjects_official_code_format_chk'
  ) THEN
    ALTER TABLE subjects
      ADD CONSTRAINT subjects_official_code_format_chk
      CHECK (
        official_code IS NULL
        OR (
          official_code = upper(btrim(official_code))
          AND char_length(official_code) BETWEEN 1 AND 50
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS subjects_official_code_unique_idx
  ON subjects (upper(btrim(official_code)))
  WHERE official_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS subjects_normalized_name_trgm_idx
  ON subjects USING gin (normalized_name gin_trgm_ops);

COMMIT;
