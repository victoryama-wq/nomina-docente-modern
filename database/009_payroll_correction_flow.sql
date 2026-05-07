-- Nomina Docente - flujo de correccion de nomina guardada.
-- Permite cancelar una corrida para correccion y guardar una nueva corrida
-- para la misma quincena sin perder el historial cancelado.

ALTER TABLE payroll_runs
  DROP CONSTRAINT IF EXISTS payroll_runs_cycle_id_period_label_key;

CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_cycle_period_active_idx
  ON payroll_runs(cycle_id, period_label)
  WHERE status <> 'CANCELADA';
