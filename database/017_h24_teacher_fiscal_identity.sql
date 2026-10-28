-- H24: optional fiscal address and identity. No backfill or payment rule changes.
BEGIN;

ALTER TABLE teachers
  ADD COLUMN fiscal_postal_code text NOT NULL DEFAULT '',
  ADD COLUMN curp text NOT NULL DEFAULT '',
  ADD CONSTRAINT teachers_fiscal_postal_code_format_check
    CHECK (fiscal_postal_code = '' OR fiscal_postal_code ~ '^[0-9]{5}$'),
  ADD CONSTRAINT teachers_curp_format_check
    CHECK (curp = '' OR curp ~ '^[A-Z]{4}[0-9]{6}[A-Z]{6}[A-Z0-9][0-9]$');

COMMIT;
