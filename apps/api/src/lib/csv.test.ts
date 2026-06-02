import { describe, expect, it } from 'vitest';
import { buildCsv, csvAttachmentHeaders, csvContentType, csvEscape, sanitizeCsvFormula, withUtf8Bom } from './csv.js';

describe('csv helpers', () => {
  it('uses UTF-8 CSV content type and optional BOM for Excel compatibility', () => {
    expect(csvContentType()).toBe('text/csv; charset=utf-8');
    expect(withUtf8Bom('Nombre')).toBe('\uFEFFNombre');
    expect(withUtf8Bom('\uFEFFNombre')).toBe('\uFEFFNombre');
    expect(buildCsv(['Nombre'], [['Álvarez']], { includeBom: true })).toBe('\uFEFFNombre\r\nÁlvarez');
  });

  it('preserves accents and institutional names without normalization', () => {
    const csv = buildCsv(
      ['Nombre'],
      [['Álvarez'], ['Muñoz'], ['García'], ['Coordinación General'], ['Administración Turística']],
      { includeBom: false, quoteAll: true }
    );

    expect(csv).toContain('"Álvarez"');
    expect(csv).toContain('"Muñoz"');
    expect(csv).toContain('"García"');
    expect(csv).toContain('"Coordinación General"');
    expect(csv).toContain('"Administración Turística"');
  });

  it('quotes commas, double quotes and line breaks safely', () => {
    expect(csvEscape('Administración, Turismo')).toBe('"Administración, Turismo"');
    expect(csvEscape('Docente "Especial"')).toBe('"Docente ""Especial"""');
    expect(csvEscape('Linea 1\nLinea 2')).toBe('"Linea 1\nLinea 2"');
  });

  it('uses CRLF line endings and keeps column order exactly as requested', () => {
    expect(buildCsv(['B', 'A'], [[2, 1], [4, 3]], { includeBom: false })).toBe('B,A\r\n2,1\r\n4,3');
  });

  it('serializes null and undefined as empty cells', () => {
    expect(buildCsv(['A', 'B'], [[null, undefined]], { includeBom: false })).toBe('A,B\r\n,');
    expect(buildCsv(['A', 'B'], [[null, undefined]], { includeBom: false, quoteAll: true })).toBe('"A","B"\r\n"",""');
  });

  it('preserves money values as provided strings instead of formatting them', () => {
    expect(buildCsv(['Total'], [['517510.00']], { includeBom: false })).toBe('Total\r\n517510.00');
  });

  it('sanitizes spreadsheet formula injection only when explicitly enabled', () => {
    expect(csvEscape('=SUM(A1:A2)')).toBe('=SUM(A1:A2)');
    expect(csvEscape('=SUM(A1:A2)', { sanitizeFormulaValues: true })).toBe("'=SUM(A1:A2)");
    expect(sanitizeCsvFormula('+cmd')).toBe("'+cmd");
    expect(sanitizeCsvFormula('-1+2')).toBe("'-1+2");
    expect(sanitizeCsvFormula('@usuario')).toBe("'@usuario");
  });

  it('builds attachment headers without leaking unsafe filename characters', () => {
    expect(csvAttachmentHeaders('reporte.csv')).toEqual({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="reporte.csv"'
    });
    expect(csvAttachmentHeaders('reporte"\r\n.csv')['Content-Disposition']).toBe('attachment; filename="reporte.csv"');
  });
});
