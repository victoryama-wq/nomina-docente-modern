import type { PayrollExtraDetail, PayrollLine } from '../api';
import { downloadCsvFile } from './csv';

export const PAYROLL_DETAIL_CSV_HEADERS = [
  'Nombre del docente',
  'Coordinación',
  'Total de horas base con descuento',
  'Total de horas extra',
  'Motivo del extra',
  'Faltas',
  'Retardos',
  'Monto base con descuento',
  'Monto extra',
  'Total a pagar'
];

function numberValue(value: number | string | null | undefined) {
  return Number(value) || 0;
}

function formatHours(value: number | string | null | undefined) {
  const numeric = numberValue(value);
  return Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function buildPayrollDetailCsvRows(lines: readonly PayrollLine[], extraDetails: readonly PayrollExtraDetail[]): unknown[][] {
  const extraReasonsByLine = new Map<string, string[]>();
  for (const detail of extraDetails) {
    const reason = detail.reason.trim();
    if (!reason) continue;
    const current = extraReasonsByLine.get(detail.lineKey) || [];
    current.push(`${reason} (${formatHours(detail.hours)} h)`);
    extraReasonsByLine.set(detail.lineKey, current);
  }

  return lines.map((line) => [
    line.teacherName,
    line.coordinationName,
    numberValue(line.baseHours) - numberValue(line.absences) - numberValue(line.delayDiscountHours),
    line.totalExtraHours,
    (extraReasonsByLine.get(line.key) || []).join(' | '),
    line.absences,
    line.delays,
    line.baseNetAmount,
    line.totalExtraAmount,
    line.totalAmount
  ]);
}

export function downloadPayrollDetailCsv(filename: string, rows: readonly (readonly unknown[])[]): void {
  downloadCsvFile(filename, PAYROLL_DETAIL_CSV_HEADERS, rows, { quoteAll: true, trailingLineEnding: true });
}
