import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCsv, csvBlob, csvEscape, downloadCsvFile, sanitizeCsvFormula, withUtf8Bom } from './csv';

describe('frontend csv helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('adds UTF-8 BOM when requested', () => {
    expect(withUtf8Bom('Nombre')).toBe('\uFEFFNombre');
    expect(buildCsv(['Nombre'], [['Álvarez']], { includeBom: true })).toBe('\uFEFFNombre\r\nÁlvarez');
  });

  it('preserves accented text and requested column order', () => {
    const csv = buildCsv(['Responsable', 'Coordinación'], [['Eslivet Aguilar', 'Coordinación General']], {
      includeBom: false,
      quoteAll: true
    });

    expect(csv).toBe('"Responsable","Coordinación"\r\n"Eslivet Aguilar","Coordinación General"');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(csvEscape('ADETUR, ARQ')).toBe('"ADETUR, ARQ"');
    expect(csvEscape('Docente "VIP"')).toBe('"Docente ""VIP"""');
    expect(csvEscape('Linea 1\nLinea 2')).toBe('"Linea 1\nLinea 2"');
  });

  it('serializes empty cells and money strings without changing format', () => {
    expect(buildCsv(['A', 'B'], [[null, undefined]], { includeBom: false })).toBe('A,B\r\n,');
    expect(buildCsv(['Total'], [['517510.00']], { includeBom: false })).toBe('Total\r\n517510.00');
  });

  it('can preserve a trailing CRLF for legacy browser exports', () => {
    expect(buildCsv(['Nombre'], [['García']], { includeBom: false, quoteAll: true, trailingLineEnding: true })).toBe(
      '"Nombre"\r\n"García"\r\n'
    );
  });

  it('sanitizes spreadsheet formulas only when requested', () => {
    expect(csvEscape('=SUM(A1:A2)')).toBe('=SUM(A1:A2)');
    expect(csvEscape('=SUM(A1:A2)', { sanitizeFormulaValues: true })).toBe("'=SUM(A1:A2)");
    expect(sanitizeCsvFormula('@usuario')).toBe("'@usuario");
  });

  it('creates a utf-8 CSV blob', async () => {
    const blob = csvBlob(['Nombre'], [['Muñoz']], { includeBom: true });
    const bytes = [...new Uint8Array(await blob.arrayBuffer())];

    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(bytes.slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('downloads a CSV file through a browser blob URL', () => {
    vi.useFakeTimers();
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv-test');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadCsvFile('reporte.csv', ['Nombre'], [['García']], { includeBom: false });

    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);

    vi.runAllTimers();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:csv-test');
  });
});
