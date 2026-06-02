import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PayrollExtraDetail, PayrollLine } from '../api';
import { buildPayrollDetailCsvRows, downloadPayrollDetailCsv, PAYROLL_DETAIL_CSV_HEADERS } from './payrollDetailCsv';

function payrollLine(overrides: Partial<PayrollLine> = {}): PayrollLine {
  return {
    key: 'line-1',
    teacherId: 'teacher-1',
    coordinationId: 'coord-1',
    teacherName: 'María "VIP", García',
    coordinationName: 'Administración Turística',
    paymentType: '1',
    category: 'V',
    baseHours: 10,
    absences: 1,
    delays: 1,
    delayDiscountHours: 0.5,
    grossBaseAmount: '1000.00',
    absenceDiscountAmount: '100.00',
    delayDiscountAmount: '50.00',
    baseNetAmount: '850.50',
    scheduleExtraHours: 0,
    scheduleExtraAmount: '0.00',
    loggedExtraHours: 2.5,
    loggedExtraAmount: '250.00',
    totalExtraHours: 2.5,
    totalExtraAmount: '250.00',
    totalAmount: '1100.50',
    alerts: [],
    scheduleCount: 1,
    loggedExtraCount: 1,
    ...overrides
  };
}

function payrollExtra(overrides: Partial<PayrollExtraDetail> = {}): PayrollExtraDetail {
  return {
    lineKey: 'line-1',
    extraId: 'extra-1',
    teacherId: 'teacher-1',
    coordinationId: 'coord-1',
    teacherName: 'María "VIP", García',
    coordinationName: 'Administración Turística',
    reason: 'Clase, "extra"',
    activityDate: '2026-05-20',
    hours: 2.5,
    tabulatorAmount: '100.00',
    totalAmount: '250.00',
    ...overrides
  };
}

async function blobBytesAndText(blob: Blob): Promise<{ bytes: number[]; text: string }> {
  const bytes = [...new Uint8Array(await blob.arrayBuffer())];
  return {
    bytes,
    text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(new Uint8Array(bytes))
  };
}

function quotedHeader(headers: readonly string[]): string {
  return headers.map((header) => `"${header}"`).join(',');
}

describe('payroll detail CSV export helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps payroll detail columns, order and money strings', () => {
    const rows = buildPayrollDetailCsvRows([payrollLine()], [payrollExtra()]);

    expect(rows[0]).toEqual([
      'María "VIP", García',
      'Administración Turística',
      8.5,
      2.5,
      'Clase, "extra" (2.5 h)',
      1,
      1,
      '850.50',
      '250.00',
      '1100.50'
    ]);
  });

  it('downloads payroll detail CSV with UTF-8 BOM, CRLF, escaping and the existing filename', async () => {
    vi.useFakeTimers();
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:payroll-detail');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const appendChild = vi.spyOn(document.body, 'appendChild');

    downloadPayrollDetailCsv('nomina-h11-qa-detalle-docente.csv', buildPayrollDetailCsvRows([payrollLine()], [payrollExtra()]));

    const link = appendChild.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(link.download).toBe('nomina-h11-qa-detalle-docente.csv');
    expect(click).toHaveBeenCalledTimes(1);

    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const { bytes, text: csv } = await blobBytesAndText(blob);
    expect(bytes.slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\r\n')[0]).toBe(quotedHeader(PAYROLL_DETAIL_CSV_HEADERS));
    expect(csv).toContain('"María ""VIP"", García"');
    expect(csv).toContain('"Administración Turística"');
    expect(csv).toContain('"Clase, ""extra"" (2.5 h)"');
    expect(csv).toContain('"850.50"');
    expect(csv.endsWith('\r\n')).toBe(true);

    vi.runAllTimers();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:payroll-detail');
  });
});
