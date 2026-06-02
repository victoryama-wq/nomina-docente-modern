import type { Teacher } from '../api';
import { downloadCsvFile } from './csv';

export interface BirthdayCsvRecord {
  teacher: Pick<Teacher, 'fullName' | 'coordinationName' | 'rfc' | 'email' | 'status'>;
  birthDate: Date | null;
  birthDateLabel: string;
  birthdayLabel: string;
  age: number | null;
  daysUntilBirthday: number | null;
}

export const FISCAL_BIRTHDAYS_CSV_HEADERS = [
  'Docente',
  'Coordinación',
  'RFC',
  'Fecha nacimiento',
  'Cumpleaños',
  'Edad',
  'Días para cumpleaños',
  'Correo',
  'Estatus'
];

function birthdaySortKey(record: BirthdayCsvRecord): string {
  return record.birthDate
    ? `${String(record.birthDate.getMonth() + 1).padStart(2, '0')}-${String(record.birthDate.getDate()).padStart(2, '0')}`
    : '99-99';
}

export function buildFiscalBirthdaysCsvRows(records: readonly BirthdayCsvRecord[]): unknown[][] {
  return [...records]
    .sort((left, right) => birthdaySortKey(left).localeCompare(birthdaySortKey(right)))
    .map((record) => [
      record.teacher.fullName,
      record.teacher.coordinationName,
      record.teacher.rfc,
      record.birthDateLabel === 'No detectada' ? '' : record.birthDateLabel,
      record.birthdayLabel === '-' ? '' : record.birthdayLabel,
      record.age ?? '',
      record.daysUntilBirthday ?? '',
      record.teacher.email,
      record.teacher.status
    ]);
}

export function downloadFiscalBirthdaysCsv(rows: readonly (readonly unknown[])[]): void {
  downloadCsvFile('cumpleaños-docentes.csv', FISCAL_BIRTHDAYS_CSV_HEADERS, rows, {
    quoteAll: true,
    trailingLineEnding: true
  });
}
