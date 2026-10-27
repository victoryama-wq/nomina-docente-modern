-- H24: additional private documents. No changes to constancias or teacher data.
BEGIN;

CREATE TABLE IF NOT EXISTS teacher_dossier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  document_type text NOT NULL CHECK (document_type IN ('CURP', 'ACTA_NACIMIENTO', 'CEDULA_PROFESIONAL', 'TITULO', 'OTRO')),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 180),
  original_file_name text NOT NULL CHECK (length(original_file_name) BETWEEN 1 AND 180),
  mime_type text NOT NULL DEFAULT 'application/pdf' CHECK (mime_type = 'application/pdf'),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 7864320),
  storage_key text,
  storage_generation text,
  storage_namespace text NOT NULL,
  state text NOT NULL CHECK (state IN ('UPLOADING', 'AVAILABLE', 'REPLACING', 'DELETING')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_users(id),
  updated_by uuid NOT NULL REFERENCES app_users(id),
  CHECK ((storage_key IS NULL) = (storage_generation IS NULL)),
  CHECK (state = 'UPLOADING' OR storage_key IS NOT NULL),
  UNIQUE (storage_namespace, storage_key)
);
CREATE INDEX IF NOT EXISTS teacher_dossier_documents_teacher_idx ON teacher_dossier_documents(teacher_id, state);

CREATE TABLE IF NOT EXISTS teacher_dossier_operations (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES app_users(id),
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  document_id uuid,
  action text NOT NULL CHECK (action IN ('UPLOAD', 'REPLACE', 'DELETE', 'METADATA', 'CONTACT')),
  request_hash text NOT NULL CHECK (length(request_hash) = 64),
  state text NOT NULL CHECK (state IN ('PREPARED', 'CLEANUP', 'ABORTING', 'COMPLETE', 'FAILED')),
  storage_namespace text NOT NULL,
  new_key text,
  new_generation text,
  old_key text,
  old_generation text,
  payload jsonb NOT NULL DEFAULT '{}',
  result jsonb NOT NULL DEFAULT '{}',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((old_key IS NULL) = (old_generation IS NULL)),
  CHECK (new_generation IS NULL OR new_key IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS teacher_dossier_operations_inflight_idx
  ON teacher_dossier_operations(document_id)
  WHERE state IN ('PREPARED', 'CLEANUP', 'ABORTING') AND document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS teacher_dossier_operations_pending_idx
  ON teacher_dossier_operations(updated_at) WHERE state IN ('PREPARED', 'CLEANUP', 'ABORTING');
CREATE INDEX IF NOT EXISTS teacher_dossier_operations_teacher_idx ON teacher_dossier_operations(teacher_id);

COMMIT;
