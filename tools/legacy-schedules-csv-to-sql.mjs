import fs from 'node:fs';
import path from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const horariosPath = args.get('--horarios') || 'database/imports/Horarios Doc.csv';
const directorioPath = args.get('--directorio') || 'database/imports/Directorio.csv';
const outPath = args.get('--out') || 'database/imports/horarios_doc_import.sql';
const reportPath = args.get('--report') || 'database/imports/horarios_doc_import_report.md';
const importMode = args.get('--mode') || 'upsert';
const sourceSheetName = args.get('--sheet-name') || path.basename(horariosPath, path.extname(horariosPath));
const forcedQuarterCode = args.get('--quarter-code') || '';
const incidencesPeriodLabel = args.get('--incidences-period-label') || '';
const incidencesStart = args.get('--incidences-start') || '';
const incidencesEnd = args.get('--incidences-end') || '';
const importIncidences = Boolean(incidencesPeriodLabel || (incidencesStart && incidencesEnd));
const backupSuffix = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

if (!['upsert', 'replace-cycle'].includes(importMode)) {
  console.error('Modo invalido. Usa --mode upsert o --mode replace-cycle.');
  process.exit(1);
}

if ((incidencesStart && !incidencesEnd) || (!incidencesStart && incidencesEnd)) {
  console.error('Para importar incidencias por fechas usa ambos parametros: --incidences-start YYYY-MM-DD --incidences-end YYYY-MM-DD.');
  process.exit(1);
}

if (incidencesPeriodLabel && (incidencesStart || incidencesEnd)) {
  console.error('Usa solo una forma de seleccionar quincena: --incidences-period-label o --incidences-start/--incidences-end.');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }

  row.push(value);
  rows.push(row);
  return rows.filter((current) => current.some((cell) => cell.trim()));
}

function normalizeHeader(value) {
  return (value || '')
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9$]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return (value || '').toString().replace(/\s+/g, ' ').trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeComparable(value) {
  return normalizeUpper(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textSql(value) {
  return `'${(value ?? '').toString().replace(/'/g, "''")}'`;
}

function nullableTextSql(value) {
  const normalized = normalizeText(value);
  return normalized ? textSql(normalized) : 'NULL';
}

function numberSql(value) {
  const numeric = Number(value) || 0;
  return numeric.toFixed(2);
}

function parseNumber(value) {
  const normalized = normalizeText(value).replace(/\$/g, '').replace(/,/g, '');
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMoney(value) {
  return parseNumber(value);
}

function tableFromCsv(filePath) {
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((cells, index) => ({
    sourceRow: index + 2,
    get(name) {
      const idx = headers.indexOf(normalizeHeader(name));
      return idx >= 0 ? normalizeText(cells[idx] || '') : '';
    }
  }));
}

function dateSql(value) {
  return textSql(value);
}

function parsePeriod(period) {
  const match = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+al\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(period);
  if (!match) return null;
  const [, d1, m1, y1, d2, m2, y2] = match;
  return {
    start: `${y1}-${m1.padStart(2, '0')}-${d1.padStart(2, '0')}`,
    end: `${y2}-${m2.padStart(2, '0')}-${d2.padStart(2, '0')}`
  };
}

function inferQuarterCode(parsedPeriod) {
  const year = Number(parsedPeriod.start.slice(0, 4));
  const month = Number(parsedPeriod.start.slice(5, 7));
  if (month >= 9) return `${year + 1}-1`;
  if (month <= 4) return `${year}-2`;
  return `${year}-3`;
}

function normalizeQuarterCode(value, parsedPeriod) {
  const normalized = normalizeText(value);
  const match = /\b(20\d{2}|\d{2})\s*[-/]\s*([123])\b/.exec(normalized);
  if (match) {
    const year = match[1].length === 2 ? `20${match[1]}` : match[1];
    return `${year}-${match[2]}`;
  }
  return inferQuarterCode(parsedPeriod);
}

function loadDirectory(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const result = new Map();
  for (const row of tableFromCsv(filePath)) {
    const fullName = normalizeUpper(row.get('DOCENTE') || [row.get('NOMBRES'), row.get('APELLIDO PATERNO'), row.get('APELLIDO MATERNO')].filter(Boolean).join(' '));
    if (!fullName) continue;
    result.set(normalizeComparable(fullName), {
      fullName,
      status: normalizeUpper(row.get('ESTATUS')) === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO'
    });
  }
  return result;
}

const tabulators = new Map([
  ['LIC-LIC', 125],
  ['MAE-LIC', 135],
  ['DOC-LIC', 135],
  ['DOC-MAES', 220],
  ['MAE-MAE', 180],
  ['DOC-DOC', 190],
  ['ESP-ESP', 220],
  ['ESP-INGLES', 180]
]);

const directory = loadDirectory(directorioPath);
const warnings = [];
const rows = [];

for (const row of tableFromCsv(horariosPath)) {
  const coordination = normalizeText(row.get('COORDINADOR'));
  const subject = normalizeUpper(row.get('ASIGNATURA'));
  const teacher = normalizeUpper(row.get('DOCENTE'));
  const teacherNormalized = normalizeComparable(teacher);
  const groupCode = normalizeUpper(row.get('GRUPO'));
  const tabulator = normalizeUpper(row.get('TABULADOR'));
  const tabAmount = parseMoney(row.get('TAB $$'));
  const periodLabel = normalizeText(row.get('PERIODO'));
  const rawQuarterCode = normalizeText(row.get('CUATRIMESTRE'));
  const parsedPeriod = parsePeriod(periodLabel);
  const weekHours =
    parseNumber(row.get('L')) +
    parseNumber(row.get('M')) +
    parseNumber(row.get('X')) +
    parseNumber(row.get('J')) +
    parseNumber(row.get('V'));
  const baseHours = weekHours + parseNumber(row.get('S MOD1')) + parseNumber(row.get('S MOD2'));

  if (!coordination || !subject || !teacher || !groupCode || !tabulator || !periodLabel) {
    warnings.push(`Fila ${row.sourceRow} omitida: faltan datos obligatorios.`);
    continue;
  }

  if (!parsedPeriod) {
    warnings.push(`Fila ${row.sourceRow} omitida: periodo invalido "${periodLabel}".`);
    continue;
  }

  const quarterCode = forcedQuarterCode || normalizeQuarterCode(rawQuarterCode, parsedPeriod);
  if (quarterCode !== rawQuarterCode) {
    warnings.push(`Fila ${row.sourceRow}: cuatrimestre "${rawQuarterCode}" normalizado a "${quarterCode}".`);
  }

  if (baseHours <= 0) {
    warnings.push(`Fila ${row.sourceRow} omitida: no contiene horas capturadas.`);
    continue;
  }

  const expectedAmount = tabulators.get(tabulator);
  if (!expectedAmount) {
    warnings.push(`Fila ${row.sourceRow}: tabulador no reconocido "${tabulator}". La BD lo omitira si no existe.`);
  } else if (tabAmount && Math.round(tabAmount * 100) !== Math.round(expectedAmount * 100)) {
    warnings.push(`Fila ${row.sourceRow}: monto ${tabAmount} no coincide con catalogo ${tabulator}=${expectedAmount}. Se usara el monto de BD.`);
  }

  const directoryTeacher = directory.get(teacherNormalized);
  if (!directoryTeacher) {
    warnings.push(`Fila ${row.sourceRow}: docente no encontrado en Directorio.csv: ${teacher}. La BD lo omitira si no existe.`);
  } else if (directoryTeacher.status !== 'ACTIVO') {
    warnings.push(`Fila ${row.sourceRow}: docente INACTIVO en Directorio.csv: ${teacher}. La BD lo omitira si esta inactivo.`);
  }

  rows.push({
    sourceRow: row.sourceRow,
    coordination,
    subject,
    teacher,
    teacherNormalized,
    groupCode,
    tabulator,
    tabAmount,
    hoursL: parseNumber(row.get('L')),
    hoursM: parseNumber(row.get('M')),
    hoursX: parseNumber(row.get('X')),
    hoursJ: parseNumber(row.get('J')),
    hoursV: parseNumber(row.get('V')),
    hoursS1: parseNumber(row.get('S MOD1')),
    hoursS2: parseNumber(row.get('S MOD2')),
    absences: parseNumber(row.get('Faltas')),
    delays: parseNumber(row.get('Retardos')),
    extras: parseNumber(row.get('Extras')),
    periodLabel,
    quarterCode,
    periodStart: parsedPeriod.start,
    periodEnd: parsedPeriod.end
  });
}

const output = [
  '-- Import Horarios Doc generated by tools/legacy-schedules-csv-to-sql.mjs',
  `-- Source: ${horariosPath}`,
  `-- Mode: ${importMode}`,
  importIncidences
    ? '-- Incluye carga de Faltas, Retardos y Extras hacia schedule_incidences.'
    : '-- No importa incidencias. Para importarlas indica --incidences-period-label o --incidences-start/--incidences-end.',
  importMode === 'replace-cycle'
    ? '-- Reemplaza horarios operativos de los ciclos importados. Crea respaldo import_backup_* antes de borrar.'
    : '-- Safe to re-run: schedules are upserted by legacy_sheet_name + legacy_row_number.',
  'BEGIN;',
  '',
  'ALTER TABLE tabulators ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;',
  '',
  `INSERT INTO tabulators (name, amount, status, sort_order) VALUES
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
    sort_order = EXCLUDED.sort_order;`,
  '',
  `CREATE UNIQUE INDEX IF NOT EXISTS schedules_legacy_source_idx
  ON schedules (legacy_sheet_name, legacy_row_number)
  WHERE legacy_sheet_name <> '' AND legacy_row_number IS NOT NULL;`,
  '',
  `CREATE TEMP TABLE legacy_schedule_import (
  source_row integer PRIMARY KEY,
  coordination text NOT NULL,
  subject_name text NOT NULL,
  teacher_name text NOT NULL,
  teacher_normalized text NOT NULL,
  group_code text NOT NULL,
  tabulator_name text NOT NULL,
  tabulator_amount numeric(12, 2) NOT NULL DEFAULT 0,
  hours_l numeric(6, 2) NOT NULL DEFAULT 0,
  hours_m numeric(6, 2) NOT NULL DEFAULT 0,
  hours_x numeric(6, 2) NOT NULL DEFAULT 0,
  hours_j numeric(6, 2) NOT NULL DEFAULT 0,
  hours_v numeric(6, 2) NOT NULL DEFAULT 0,
  hours_s1 numeric(6, 2) NOT NULL DEFAULT 0,
  hours_s2 numeric(6, 2) NOT NULL DEFAULT 0,
  absences numeric(6, 2) NOT NULL DEFAULT 0,
  delays numeric(6, 2) NOT NULL DEFAULT 0,
  extras numeric(6, 2) NOT NULL DEFAULT 0,
  period_label text NOT NULL,
  quarter_code text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL
);`
];

if (rows.length) {
  output.push(
    '',
    `INSERT INTO legacy_schedule_import (
  source_row,
  coordination,
  subject_name,
  teacher_name,
  teacher_normalized,
  group_code,
  tabulator_name,
  tabulator_amount,
  hours_l,
  hours_m,
  hours_x,
  hours_j,
  hours_v,
  hours_s1,
  hours_s2,
  absences,
  delays,
  extras,
  period_label,
  quarter_code,
  period_start,
  period_end
) VALUES`
  );

  output.push(
    rows
      .map((row) => `(
  ${row.sourceRow},
  ${textSql(row.coordination)},
  ${textSql(row.subject)},
  ${textSql(row.teacher)},
  ${textSql(row.teacherNormalized)},
  ${textSql(row.groupCode)},
  ${textSql(row.tabulator)},
  ${numberSql(row.tabAmount)},
  ${numberSql(row.hoursL)},
  ${numberSql(row.hoursM)},
  ${numberSql(row.hoursX)},
  ${numberSql(row.hoursJ)},
  ${numberSql(row.hoursV)},
  ${numberSql(row.hoursS1)},
  ${numberSql(row.hoursS2)},
  ${numberSql(row.absences)},
  ${numberSql(row.delays)},
  ${numberSql(row.extras)},
  ${textSql(row.periodLabel)},
  ${textSql(row.quarterCode)},
  ${dateSql(row.periodStart)}::date,
  ${dateSql(row.periodEnd)}::date
)`)
      .join(',\n') + ';'
  );
}

output.push(
  '',
  `INSERT INTO coordinations (name, status)
SELECT DISTINCT coordination, 'ACTIVO'::user_status
FROM legacy_schedule_import
ON CONFLICT (name) DO UPDATE SET status = 'ACTIVO';`,
  '',
  `INSERT INTO subjects (name, status)
SELECT DISTINCT subject_name, 'ACTIVO'::user_status
FROM legacy_schedule_import
ON CONFLICT (name) DO UPDATE SET status = 'ACTIVO';`,
  '',
  `UPDATE academic_cycles
SET status = 'PLANEACION'
WHERE period_label = 'CICLO INICIAL'
  AND quarter_code = 'ACTUAL';`,
  '',
  `WITH cycle_rows AS (
  SELECT DISTINCT period_label, quarter_code, period_start, period_end
  FROM legacy_schedule_import
)
INSERT INTO academic_cycles (
  period_label,
  quarter_code,
  module1_start,
  module1_end,
  module2_start,
  module2_end,
  status
)
SELECT
  period_label,
  quarter_code,
  period_start,
  period_start + FLOOR((period_end - period_start) / 2.0)::int,
  LEAST(period_start + FLOOR((period_end - period_start) / 2.0)::int + 1, period_end),
  period_end,
  'ACTIVO'::cycle_status
FROM cycle_rows
ON CONFLICT (period_label, quarter_code) DO UPDATE
SET module1_start = EXCLUDED.module1_start,
    module1_end = EXCLUDED.module1_end,
    module2_start = EXCLUDED.module2_start,
    module2_end = EXCLUDED.module2_end,
    status = 'ACTIVO';`,
  '',
  importMode === 'replace-cycle'
    ? `CREATE TABLE IF NOT EXISTS import_backup_schedules_${backupSuffix} AS
SELECT s.*
FROM schedules s
JOIN academic_cycles ac ON ac.id = s.cycle_id
JOIN (
  SELECT DISTINCT period_label, quarter_code
  FROM legacy_schedule_import
) imported_cycles
  ON imported_cycles.period_label = ac.period_label
  AND imported_cycles.quarter_code = ac.quarter_code;

CREATE TABLE IF NOT EXISTS import_backup_schedule_incidences_${backupSuffix} AS
SELECT si.*
FROM schedule_incidences si
JOIN schedules s ON s.id = si.schedule_id
JOIN academic_cycles ac ON ac.id = s.cycle_id
JOIN (
  SELECT DISTINCT period_label, quarter_code
  FROM legacy_schedule_import
) imported_cycles
  ON imported_cycles.period_label = ac.period_label
  AND imported_cycles.quarter_code = ac.quarter_code;

DELETE FROM schedules s
USING academic_cycles ac,
(
  SELECT DISTINCT period_label, quarter_code
  FROM legacy_schedule_import
) imported_cycles
WHERE ac.id = s.cycle_id
  AND imported_cycles.period_label = ac.period_label
  AND imported_cycles.quarter_code = ac.quarter_code;`
    : '',
  '',
  `WITH import_actor AS (
  SELECT id FROM app_users WHERE email = 'victor.yama@tecplayacar.edu.mx' LIMIT 1
),
valid_rows AS (
  SELECT
    i.*,
    ac.id AS cycle_id,
    c.id AS coordination_id,
    t.id AS teacher_id,
    s.id AS subject_id,
    tab.id AS tabulator_id,
    tab.name AS tabulator_name_db,
    tab.amount AS tabulator_amount_db
  FROM legacy_schedule_import i
  JOIN academic_cycles ac
    ON ac.period_label = i.period_label
    AND ac.quarter_code = i.quarter_code
  JOIN coordinations c ON lower(c.name) = lower(i.coordination)
  JOIN teachers t
    ON t.normalized_name = i.teacher_normalized
    AND t.status = 'ACTIVO'
  JOIN subjects s ON lower(s.name) = lower(i.subject_name)
  JOIN tabulators tab
    ON lower(tab.name) = lower(i.tabulator_name)
    AND tab.status = 'ACTIVO'
),
upserted AS (
  INSERT INTO schedules (
    legacy_sheet_name,
    legacy_row_number,
    cycle_id,
    coordination_id,
    teacher_id,
    subject_id,
    subject_name,
    group_code,
    tabulator_id,
    tabulator_name,
    tabulator_amount,
    hours_l,
    hours_m,
    hours_x,
    hours_j,
    hours_v,
    hours_s1,
    hours_s2,
    created_by,
    updated_by,
    updated_at
  )
  SELECT
    ${textSql(sourceSheetName)},
    source_row,
    cycle_id,
    coordination_id,
    teacher_id,
    subject_id,
    subject_name,
    group_code,
    tabulator_id,
    tabulator_name_db,
    tabulator_amount_db,
    hours_l,
    hours_m,
    hours_x,
    hours_j,
    hours_v,
    hours_s1,
    hours_s2,
    (SELECT id FROM import_actor),
    (SELECT id FROM import_actor),
    now()
  FROM valid_rows
  ON CONFLICT (legacy_sheet_name, legacy_row_number)
    WHERE legacy_sheet_name <> '' AND legacy_row_number IS NOT NULL
  DO UPDATE SET
    cycle_id = EXCLUDED.cycle_id,
    coordination_id = EXCLUDED.coordination_id,
    teacher_id = EXCLUDED.teacher_id,
    subject_id = EXCLUDED.subject_id,
    subject_name = EXCLUDED.subject_name,
    group_code = EXCLUDED.group_code,
    tabulator_id = EXCLUDED.tabulator_id,
    tabulator_name = EXCLUDED.tabulator_name,
    tabulator_amount = EXCLUDED.tabulator_amount,
    hours_l = EXCLUDED.hours_l,
    hours_m = EXCLUDED.hours_m,
    hours_x = EXCLUDED.hours_x,
    hours_j = EXCLUDED.hours_j,
    hours_v = EXCLUDED.hours_v,
    hours_s1 = EXCLUDED.hours_s1,
    hours_s2 = EXCLUDED.hours_s2,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING id, legacy_row_number
)
SELECT count(*) AS imported_schedules
FROM upserted;`,
  ''
);

if (importIncidences) {
  const targetWhere = incidencesPeriodLabel
    ? `pcc.period_label = ${textSql(incidencesPeriodLabel)}`
    : `pcc.payroll_start = ${dateSql(incidencesStart)}::date
        AND pcc.payroll_end = ${dateSql(incidencesEnd)}::date`;

  output.push(
    `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM payroll_calendar_config pcc
    JOIN academic_cycles ac ON ac.id = pcc.cycle_id
    JOIN (
      SELECT DISTINCT period_label, quarter_code
      FROM legacy_schedule_import
    ) imported_cycles
      ON imported_cycles.period_label = ac.period_label
      AND imported_cycles.quarter_code = ac.quarter_code
    WHERE ${targetWhere}
  ) THEN
    RAISE EXCEPTION 'No se encontro la quincena destino para importar incidencias.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM payroll_calendar_config pcc
    JOIN academic_cycles ac ON ac.id = pcc.cycle_id
    JOIN payroll_runs pr
      ON pr.cycle_id = pcc.cycle_id
      AND pr.period_label = pcc.period_label
      AND pr.status <> 'CANCELADA'
    JOIN (
      SELECT DISTINCT period_label, quarter_code
      FROM legacy_schedule_import
    ) imported_cycles
      ON imported_cycles.period_label = ac.period_label
      AND imported_cycles.quarter_code = ac.quarter_code
    WHERE ${targetWhere}
  ) THEN
    RAISE EXCEPTION 'La quincena destino ya tiene nomina guardada. No se importaron incidencias.';
  END IF;
END $$;`,
    '',
    `WITH import_actor AS (
  SELECT id FROM app_users WHERE email = 'victor.yama@tecplayacar.edu.mx' LIMIT 1
),
target_calendar AS (
  SELECT pcc.id, pcc.cycle_id
  FROM payroll_calendar_config pcc
  JOIN academic_cycles ac ON ac.id = pcc.cycle_id
  JOIN (
    SELECT DISTINCT period_label, quarter_code
    FROM legacy_schedule_import
  ) imported_cycles
    ON imported_cycles.period_label = ac.period_label
    AND imported_cycles.quarter_code = ac.quarter_code
  WHERE ${targetWhere}
),
incidence_rows AS (
  SELECT
    s.id AS schedule_id,
    tc.id AS calendar_config_id,
    i.absences,
    i.delays,
    i.extras
  FROM legacy_schedule_import i
  JOIN academic_cycles ac
    ON ac.period_label = i.period_label
    AND ac.quarter_code = i.quarter_code
  JOIN target_calendar tc ON tc.cycle_id = ac.id
  JOIN schedules s
    ON s.legacy_sheet_name = ${textSql(sourceSheetName)}
    AND s.legacy_row_number = i.source_row
    AND s.cycle_id = ac.id
  WHERE i.absences > 0 OR i.delays > 0 OR i.extras > 0
),
upserted_incidences AS (
  INSERT INTO schedule_incidences (
    schedule_id,
    calendar_config_id,
    absences,
    delays,
    extra_hours_in_schedule,
    updated_by
  )
  SELECT
    schedule_id,
    calendar_config_id,
    absences,
    delays,
    extras,
    (SELECT id FROM import_actor)
  FROM incidence_rows
  ON CONFLICT (schedule_id, calendar_config_id) DO UPDATE
  SET absences = EXCLUDED.absences,
      delays = EXCLUDED.delays,
      extra_hours_in_schedule = EXCLUDED.extra_hours_in_schedule,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by
  RETURNING schedule_id
)
SELECT count(*) AS imported_incidences
FROM upserted_incidences;`,
    ''
  );
}

output.push('COMMIT;');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${output.join('\n')}\n`, 'utf8');

const uniqueTeachers = new Set(rows.map((row) => row.teacherNormalized)).size;
const uniqueCoordinations = new Set(rows.map((row) => row.coordination.toLowerCase())).size;
const uniqueCycles = new Set(rows.map((row) => `${row.periodLabel}||${row.quarterCode}`)).size;
const incidenceRows = rows.filter((row) => row.absences > 0 || row.delays > 0 || row.extras > 0);
const report = [
  '# Horarios Doc import report',
  '',
  `- CSV: \`${horariosPath}\``,
  `- SQL generado: \`${outPath}\``,
  `- Filas validas para staging: ${rows.length}`,
  `- Docentes unicos en CSV: ${uniqueTeachers}`,
  `- Coordinaciones unicas en CSV: ${uniqueCoordinations}`,
  `- Ciclos unicos en CSV: ${uniqueCycles}`,
  `- Incidencias detectadas en CSV: ${incidenceRows.length}`,
  `- Total faltas: ${incidenceRows.reduce((sum, row) => sum + row.absences, 0).toFixed(2)}`,
  `- Total retardos: ${incidenceRows.reduce((sum, row) => sum + row.delays, 0).toFixed(2)}`,
  `- Total extras en incidencias: ${incidenceRows.reduce((sum, row) => sum + row.extras, 0).toFixed(2)}`,
  `- Importar incidencias: ${importIncidences ? 'Si' : 'No'}`,
  importIncidences
    ? `- Quincena destino incidencias: ${incidencesPeriodLabel || `${incidencesStart} a ${incidencesEnd}`}`
    : '- Quincena destino incidencias: no configurada',
  `- Advertencias: ${warnings.length}`,
  '',
  '## Advertencias',
  '',
  ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- Sin advertencias de archivo.'])
];

fs.writeFileSync(reportPath, `${report.join('\n')}\n`, 'utf8');

console.log(`SQL generado: ${outPath}`);
console.log(`Reporte generado: ${reportPath}`);
console.log(`Filas validas para staging: ${rows.length}`);
console.log(`Advertencias: ${warnings.length}`);
