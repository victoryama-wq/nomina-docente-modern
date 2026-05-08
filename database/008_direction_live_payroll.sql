-- Actualiza la descripcion del rol de Direccion/Subdireccion
-- para reflejar consulta global de nomina viva.

BEGIN;

UPDATE roles
SET description = 'Consulta ejecutiva global de nomina viva y finanzas sin acciones operativas.'
WHERE code = 'direccion';

COMMIT;
