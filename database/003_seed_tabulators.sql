-- Catalogo inicial de tabuladores para Capturar Horarios.

BEGIN;

ALTER TABLE tabulators
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;

INSERT INTO tabulators (name, amount, status, sort_order) VALUES
  ('LIC-LIC', 125.00, 'ACTIVO', 10),
  ('MAE-LIC', 135.00, 'ACTIVO', 20),
  ('DOC-LIC', 135.00, 'ACTIVO', 30),
  ('DOC-MAES', 220.00, 'ACTIVO', 40),
  ('MAE-MAE', 180.00, 'ACTIVO', 50),
  ('DOC-DOC', 190.00, 'ACTIVO', 60),
  ('ESP-ESP', 220.00, 'ACTIVO', 70),
  ('ESP-INGLES', 180.00, 'ACTIVO', 80)
ON CONFLICT (name) DO UPDATE
SET amount = EXCLUDED.amount,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order;

COMMIT;
