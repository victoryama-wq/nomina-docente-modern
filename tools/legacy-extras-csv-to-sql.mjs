import fs from 'node:fs';
import path from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const extrasPath = args.get('--extras') || 'database/imports/Extras.csv';
const outPath = args.get('--out') || 'database/imports/extras_import.sql';
const reportPath = args.get('--report') || 'database/imports/extras_import_report.md';
const sourceSheetName = args.get('--sheet-name') || path.basename(extrasPath, path.extname(extrasPath));
const forcedQuarterCode = args.get('--quarter-code') || '';
const targetStart = args.get('--target-start') || '';
const targetEnd = args.get('--target-end') || '';
const activityDateMode = args.get('--activity-date-mode') || 'csv';

if ((targetStart && !targetEnd) || (!targetStart && targetEnd)) {
  console.error('Para filtrar por quincena usa ambos parametros: --target-start YYYY-MM-DD --target-end YYYY-MM-DD.');
  process.exit(1);
}

if (!['csv', 'target-start'].includes(activityDateMode)) {
  console.error('Modo de fecha invalido. Usa --activity-date-mode csv o --activity-date-mode target-start.');
  process.exit(1);
}

if (activityDateMode === 'target-start' && !targetStart) {
  console.error('Para usar --activity-date-mode target-start indica --target-start y --target-end.');
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

function numberSql(value) {
  const numeric = Number(value) || 0;
  return numeric.toFixed(2);
}

function dateSql(value) {
  return textSql(value);
}

function nullableTimestampSql(value) {
  return value ? `${textSql(value)}::timestamptz` : 'now()';
}

function parseNumber(value) {
  const normalized = normalizeText(value).replace(/\$/g, '').replace(/,/g, '');
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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

function parseDate(value) {
  const normalized = normalizeText(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (iso) return normalized;

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalized);
  if (slash) {
    const [, day, month, year] = slash;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return '';
}

function parseDateTime(value) {
  const normalized = normalizeText(value);
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(normalized);
  if (!match) return '';
  const [, day, month, year, hour, minute, second = '00'] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute}:${second}-05`;
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

const warnings = [];
const rows = [];

for (const row of tableFromCsv(extrasPath)) {
  const coordination = normalizeText(row.get('COORDINADOR'));
  const teacher = normalizeUpper(row.get('DOCENTE'));
  const teacherNormalized = normalizeComparable(teacher);
  const hours = parseNumber(row.get('HORAS'));
  const tabulatorAmount = parseNumber(row.get('TABULADOR'));
  const reason = normalizeText(row.get('MOTIVO')) || 'Extra importado';
  const csvActivityDate = parseDate(row.get('FECHA ACTIVIDAD'));
  const activityDate = activityDateMode === 'target-start' ? targetStart : csvActivityDate;
  const capturedAt = parseDateTime(row.get('FECHA REGISTRO'));
  const updatedAt = parseDateTime(row.get('FECHA ACTUALIZACION')) || capturedAt;
  const capturedBy = normalizeText(row.get('CAPTURADO POR')).toLowerCase();
  const updatedBy = normalizeText(row.get('ACTUALIZADO POR')).toLowerCase() || capturedBy;
  const reference = normalizeText(row.get('REFERENCIA'));
  const observations = normalizeText(row.get('OBSERVACIONES'));
  const periodLabel = normalizeText(row.get('PERIODO'));
  const parsedPeriod = parsePeriod(periodLabel);

  if (!coordination || !teacher || !hours || !tabulatorAmount || !periodLabel || !activityDate) {
    warnings.push(`Fila ${row.sourceRow} omitida: requiere coordinador, docente, horas, tabulador, periodo y fecha efectiva de actividad.`);
    continue;
  }

  if (!parsedPeriod) {
    warnings.push(`Fila ${row.sourceRow} omitida: periodo invalido "${periodLabel}".`);
    continue;
  }

  if (targetStart && activityDateMode === 'csv' && (activityDate < targetStart || activityDate > targetEnd)) {
    warnings.push(`Fila ${row.sourceRow} omitida: fecha de actividad ${activityDate} fuera de quincena destino ${targetStart} a ${targetEnd}.`);
    continue;
  }

  const rawQuarterCode = normalizeText(row.get('CUATRIMESTRE'));
  const quarterCode = forcedQuarterCode || normalizeQuarterCode(rawQuarterCode, parsedPeriod);
  if (quarterCode !== rawQuarterCode) {
    warnings.push(`Fila ${row.sourceRow}: cuatrimestre "${rawQuarterCode}" normalizado a "${quarterCode}".`);
  }

  rows.push({
    sourceRow: row.sourceRow,
    coordination,
    teacher,
    teacherNormalized,
    hours,
    tabulatorAmount,
    reason,
    activityDate,
    capturedAt,
    updatedAt,
    capturedBy,
    updatedBy,
    reference,
    observations,
    periodLabel,
    quarterCode
  });
}

const output = [
  '-- Import Extras generated by tools/legacy-extras-csv-to-sql.mjs',
  `-- Source: ${extrasPath}`,
  targetStart ? `-- Target payroll window: ${targetStart} a ${targetEnd}` : '-- Target payroll window: all dates with calendar config',
  `-- Activity date mode: ${activityDateMode}`,
  'BEGIN;',
  '',
  "ALTER TABLE extra_hours ADD COLUMN IF NOT EXISTS legacy_sheet_name text NOT NULL DEFAULT '';",
  '',
  `CREATE UNIQUE INDEX IF NOT EXISTS extra_hours_legacy_source_idx
  ON extra_hours (cycle_id, legacy_sheet_name, legacy_row_number)
  WHERE legacy_sheet_name <> '' AND legacy_row_number IS NOT NULL;`,
  '',
  `CREATE TEMP TABLE legacy_extra_import (
  source_row integer PRIMARY KEY,
  coordination text NOT NULL,
  teacher_name text NOT NULL,
  teacher_normalized text NOT NULL,
  hours numeric(6, 2) NOT NULL,
  tabulator_amount numeric(12, 2) NOT NULL,
  reason text NOT NULL,
  activity_date date NOT NULL,
  reference text NOT NULL,
  observations text NOT NULL,
  captured_at timestamptz NOT NULL,
  captured_by text NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text NOT NULL,
  period_label text NOT NULL,
  quarter_code text NOT NULL
);`
];

if (rows.length) {
  output.push(
    '',
    `INSERT INTO legacy_extra_import (
  source_row,
  coordination,
  teacher_name,
  teacher_normalized,
  hours,
  tabulator_amount,
  reason,
  activity_date,
  reference,
  observations,
  captured_at,
  captured_by,
  updated_at,
  updated_by,
  period_label,
  quarter_code
) VALUES`
  );

  output.push(
    rows
      .map((row) => `(
  ${row.sourceRow},
  ${textSql(row.coordination)},
  ${textSql(row.teacher)},
  ${textSql(row.teacherNormalized)},
  ${numberSql(row.hours)},
  ${numberSql(row.tabulatorAmount)},
  ${textSql(row.reason)},
  ${dateSql(row.activityDate)}::date,
  ${textSql(row.reference)},
  ${textSql(row.observations)},
  ${nullableTimestampSql(row.capturedAt)},
  ${textSql(row.capturedBy)},
  ${nullableTimestampSql(row.updatedAt)},
  ${textSql(row.updatedBy)},
  ${textSql(row.periodLabel)},
  ${textSql(row.quarterCode)}
)`)
      .join(',\n') + ';'
  );
}

output.push(
  '',
  `INSERT INTO coordinations (name, status)
SELECT DISTINCT coordination, 'ACTIVO'::user_status
FROM legacy_extra_import
ON CONFLICT (name) DO UPDATE SET status = 'ACTIVO';`,
  '',
  `DO $$
DECLARE
  error_message text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM legacy_extra_import i
    WHERE NOT EXISTS (
      SELECT 1
      FROM academic_cycles ac
      WHERE ac.period_label = i.period_label
        AND ac.quarter_code = i.quarter_code
    )
  ) THEN
    SELECT format('Fila %s: no existe el ciclo "%s" / "%s".', source_row, period_label, quarter_code)
    INTO error_message
    FROM legacy_extra_import i
    WHERE NOT EXISTS (
      SELECT 1
      FROM academic_cycles ac
      WHERE ac.period_label = i.period_label
        AND ac.quarter_code = i.quarter_code
    )
    ORDER BY source_row
    LIMIT 1;

    RAISE EXCEPTION '%', error_message;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM legacy_extra_import i
    WHERE NOT EXISTS (
      SELECT 1
      FROM teachers t
      WHERE t.normalized_name = i.teacher_normalized
        AND t.status = 'ACTIVO'
    )
  ) THEN
    SELECT format('Fila %s: el docente "%s" no existe o no esta ACTIVO.', source_row, teacher_name)
    INTO error_message
    FROM legacy_extra_import i
    WHERE NOT EXISTS (
      SELECT 1
      FROM teachers t
      WHERE t.normalized_name = i.teacher_normalized
        AND t.status = 'ACTIVO'
    )
    ORDER BY source_row
    LIMIT 1;

    RAISE EXCEPTION '%', error_message;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM legacy_extra_import i
    JOIN academic_cycles ac
      ON ac.period_label = i.period_label
      AND ac.quarter_code = i.quarter_code
    WHERE NOT EXISTS (
      SELECT 1
      FROM payroll_calendar_config pcc
      WHERE pcc.cycle_id = ac.id
        AND i.activity_date BETWEEN pcc.payroll_start AND pcc.payroll_end
    )
  ) THEN
    RAISE EXCEPTION 'Hay extras con fecha de actividad sin quincena configurada.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM legacy_extra_import i
    JOIN academic_cycles ac
      ON ac.period_label = i.period_label
      AND ac.quarter_code = i.quarter_code
    JOIN payroll_calendar_config pcc
      ON pcc.cycle_id = ac.id
      AND i.activity_date BETWEEN pcc.payroll_start AND pcc.payroll_end
    JOIN payroll_runs pr
      ON pr.cycle_id = pcc.cycle_id
      AND pr.period_label = pcc.period_label
      AND pr.status <> 'CANCELADA'
  ) THEN
    RAISE EXCEPTION 'La quincena destino ya tiene nomina guardada. No se importaron extras.';
  END IF;
END $$;`,
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
    COALESCE(captured.id, (SELECT id FROM import_actor)) AS captured_by_id,
    COALESCE(updated.id, captured.id, (SELECT id FROM import_actor)) AS updated_by_id
  FROM legacy_extra_import i
  JOIN academic_cycles ac
    ON ac.period_label = i.period_label
    AND ac.quarter_code = i.quarter_code
  JOIN coordinations c ON lower(c.name) = lower(i.coordination)
  JOIN teachers t
    ON t.normalized_name = i.teacher_normalized
    AND t.status = 'ACTIVO'
  LEFT JOIN LATERAL (
    SELECT id
    FROM app_users u
    WHERE lower(u.legacy_username) = lower(i.captured_by)
      OR lower(split_part(u.email, '@', 1)) = lower(i.captured_by)
      OR lower(u.email) = lower(i.captured_by)
    ORDER BY u.updated_at DESC
    LIMIT 1
  ) captured ON true
  LEFT JOIN LATERAL (
    SELECT id
    FROM app_users u
    WHERE lower(u.legacy_username) = lower(i.updated_by)
      OR lower(split_part(u.email, '@', 1)) = lower(i.updated_by)
      OR lower(u.email) = lower(i.updated_by)
    ORDER BY u.updated_at DESC
    LIMIT 1
  ) updated ON true
),
upserted AS (
  INSERT INTO extra_hours (
    legacy_sheet_name,
    legacy_row_number,
    cycle_id,
    coordination_id,
    teacher_id,
    hours,
    tabulator_amount,
    reason,
    activity_date,
    reference,
    observations,
    captured_at,
    captured_by,
    updated_at,
    updated_by
  )
  SELECT
    ${textSql(sourceSheetName)},
    source_row,
    cycle_id,
    coordination_id,
    teacher_id,
    hours,
    tabulator_amount,
    reason,
    activity_date,
    reference,
    observations,
    captured_at,
    captured_by_id,
    updated_at,
    updated_by_id
  FROM valid_rows
  ON CONFLICT (cycle_id, legacy_sheet_name, legacy_row_number)
    WHERE legacy_sheet_name <> '' AND legacy_row_number IS NOT NULL
  DO UPDATE SET
    coordination_id = EXCLUDED.coordination_id,
    teacher_id = EXCLUDED.teacher_id,
    hours = EXCLUDED.hours,
    tabulator_amount = EXCLUDED.tabulator_amount,
    reason = EXCLUDED.reason,
    activity_date = EXCLUDED.activity_date,
    reference = EXCLUDED.reference,
    observations = EXCLUDED.observations,
    captured_at = EXCLUDED.captured_at,
    captured_by = EXCLUDED.captured_by,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by
  RETURNING id
)
SELECT count(*) AS imported_extras
FROM upserted;`,
  '',
  'COMMIT;'
);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${output.join('\n')}\n`, 'utf8');

const uniqueTeachers = new Set(rows.map((row) => row.teacherNormalized)).size;
const uniqueCoordinations = new Set(rows.map((row) => row.coordination.toLowerCase())).size;
const totalHours = rows.reduce((sum, row) => sum + row.hours, 0);
const totalAmount = rows.reduce((sum, row) => sum + row.hours * row.tabulatorAmount, 0);
const report = [
  '# Extras import report',
  '',
  `- CSV: \`${extrasPath}\``,
  `- SQL generado: \`${outPath}\``,
  `- Filas validas para staging: ${rows.length}`,
  `- Docentes unicos en CSV: ${uniqueTeachers}`,
  `- Coordinaciones unicas en CSV: ${uniqueCoordinations}`,
  `- Total horas: ${totalHours.toFixed(2)}`,
  `- Total importe: ${totalAmount.toFixed(2)}`,
  targetStart ? `- Quincena destino: ${targetStart} a ${targetEnd}` : '- Quincena destino: segun fecha de actividad',
  `- Modo fecha efectiva: ${activityDateMode === 'target-start' ? 'inicio de quincena configurada' : 'fecha de actividad del CSV'}`,
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
