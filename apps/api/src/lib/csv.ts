export type CsvCell = string | number | boolean | bigint | null | undefined | Date;

export interface CsvSerializeOptions {
  separator?: string;
  lineEnding?: string;
  includeBom?: boolean;
  quoteAll?: boolean;
  sanitizeFormulaValues?: boolean;
}

export interface CsvAttachmentOptions {
  disposition?: 'attachment' | 'inline';
  contentType?: string;
}

const UTF8_BOM = '\uFEFF';
const DEFAULT_SEPARATOR = ',';
const DEFAULT_LINE_ENDING = '\r\n';
const FORMULA_PREFIXES = ['=', '+', '-', '@'];

export function csvContentType(): string {
  return 'text/csv; charset=utf-8';
}

export function withUtf8Bom(csv: string): string {
  return csv.startsWith(UTF8_BOM) ? csv : `${UTF8_BOM}${csv}`;
}

export function sanitizeCsvFormula(value: string): string {
  if (value === '') return value;
  const firstCharacter = value[0];
  if (FORMULA_PREFIXES.includes(firstCharacter) || firstCharacter === '\t' || firstCharacter === '\r' || firstCharacter === '\n') {
    return `'${value}`;
  }
  return value;
}

export function csvEscape(value: unknown, options: CsvSerializeOptions = {}): string {
  const separator = options.separator ?? DEFAULT_SEPARATOR;
  const quoteAll = options.quoteAll ?? false;

  let text = value === null || value === undefined ? '' : String(value);
  if (options.sanitizeFormulaValues && typeof value === 'string') {
    text = sanitizeCsvFormula(text);
  }

  const mustQuote = quoteAll || text.includes(separator) || text.includes('"') || text.includes('\r') || text.includes('\n');
  if (!mustQuote) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: readonly unknown[], rows: readonly (readonly unknown[])[], options: CsvSerializeOptions = {}): string {
  const separator = options.separator ?? DEFAULT_SEPARATOR;
  const lineEnding = options.lineEnding ?? DEFAULT_LINE_ENDING;
  const includeBom = options.includeBom ?? true;

  const serializeRow = (row: readonly unknown[]) => row.map((value) => csvEscape(value, options)).join(separator);
  const csv = [serializeRow(headers), ...rows.map(serializeRow)].join(lineEnding);
  return includeBom ? withUtf8Bom(csv) : csv;
}

export function csvAttachmentHeaders(filename: string, options: CsvAttachmentOptions = {}): Record<string, string> {
  const disposition = options.disposition ?? 'attachment';
  const contentType = options.contentType ?? csvContentType();
  const safeFilename = filename.replace(/[\r\n"]/g, '');

  return {
    'Content-Type': contentType,
    'Content-Disposition': `${disposition}; filename="${safeFilename}"`
  };
}
