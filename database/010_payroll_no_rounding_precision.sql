-- Nomina Docente - precision de calculo sin redondeo
-- Evita que PostgreSQL fuerce escala fija de 2 decimales en importes y horas de nomina.

ALTER TABLE IF EXISTS tabulators
  ALTER COLUMN amount TYPE numeric USING amount::numeric;

ALTER TABLE IF EXISTS schedules
  ALTER COLUMN tabulator_amount TYPE numeric USING tabulator_amount::numeric,
  ALTER COLUMN hours_l TYPE numeric USING hours_l::numeric,
  ALTER COLUMN hours_m TYPE numeric USING hours_m::numeric,
  ALTER COLUMN hours_x TYPE numeric USING hours_x::numeric,
  ALTER COLUMN hours_j TYPE numeric USING hours_j::numeric,
  ALTER COLUMN hours_v TYPE numeric USING hours_v::numeric,
  ALTER COLUMN hours_s1 TYPE numeric USING hours_s1::numeric,
  ALTER COLUMN hours_s2 TYPE numeric USING hours_s2::numeric;

ALTER TABLE IF EXISTS schedule_incidences
  ALTER COLUMN absences TYPE numeric USING absences::numeric,
  ALTER COLUMN delays TYPE numeric USING delays::numeric,
  ALTER COLUMN extra_hours_in_schedule TYPE numeric USING extra_hours_in_schedule::numeric;

ALTER TABLE IF EXISTS extra_hours
  ALTER COLUMN hours TYPE numeric USING hours::numeric,
  ALTER COLUMN tabulator_amount TYPE numeric USING tabulator_amount::numeric;

ALTER TABLE IF EXISTS payroll_lines
  ALTER COLUMN base_hours TYPE numeric USING base_hours::numeric,
  ALTER COLUMN absences TYPE numeric USING absences::numeric,
  ALTER COLUMN delays TYPE numeric USING delays::numeric,
  ALTER COLUMN delay_discount_hours TYPE numeric USING delay_discount_hours::numeric,
  ALTER COLUMN gross_base_amount TYPE numeric USING gross_base_amount::numeric,
  ALTER COLUMN absence_discount_amount TYPE numeric USING absence_discount_amount::numeric,
  ALTER COLUMN delay_discount_amount TYPE numeric USING delay_discount_amount::numeric,
  ALTER COLUMN base_net_amount TYPE numeric USING base_net_amount::numeric,
  ALTER COLUMN schedule_extra_hours TYPE numeric USING schedule_extra_hours::numeric,
  ALTER COLUMN schedule_extra_amount TYPE numeric USING schedule_extra_amount::numeric,
  ALTER COLUMN logged_extra_hours TYPE numeric USING logged_extra_hours::numeric,
  ALTER COLUMN logged_extra_amount TYPE numeric USING logged_extra_amount::numeric,
  ALTER COLUMN total_extra_hours TYPE numeric USING total_extra_hours::numeric,
  ALTER COLUMN total_extra_amount TYPE numeric USING total_extra_amount::numeric,
  ALTER COLUMN total_amount TYPE numeric USING total_amount::numeric;

ALTER TABLE IF EXISTS payroll_schedule_details
  ALTER COLUMN tabulator_amount TYPE numeric USING tabulator_amount::numeric,
  ALTER COLUMN weekday_hours TYPE numeric USING weekday_hours::numeric,
  ALTER COLUMN module1_hours TYPE numeric USING module1_hours::numeric,
  ALTER COLUMN module2_hours TYPE numeric USING module2_hours::numeric,
  ALTER COLUMN base_hours TYPE numeric USING base_hours::numeric,
  ALTER COLUMN gross_base_amount TYPE numeric USING gross_base_amount::numeric,
  ALTER COLUMN absences TYPE numeric USING absences::numeric,
  ALTER COLUMN delays TYPE numeric USING delays::numeric,
  ALTER COLUMN delay_discount_hours TYPE numeric USING delay_discount_hours::numeric,
  ALTER COLUMN absence_discount_amount TYPE numeric USING absence_discount_amount::numeric,
  ALTER COLUMN delay_discount_amount TYPE numeric USING delay_discount_amount::numeric,
  ALTER COLUMN schedule_extra_hours TYPE numeric USING schedule_extra_hours::numeric,
  ALTER COLUMN schedule_extra_amount TYPE numeric USING schedule_extra_amount::numeric,
  ALTER COLUMN base_net_amount TYPE numeric USING base_net_amount::numeric;

ALTER TABLE IF EXISTS payroll_extra_details
  ALTER COLUMN hours TYPE numeric USING hours::numeric,
  ALTER COLUMN tabulator_amount TYPE numeric USING tabulator_amount::numeric,
  ALTER COLUMN total_amount TYPE numeric USING total_amount::numeric;
