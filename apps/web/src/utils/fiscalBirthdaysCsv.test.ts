import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildFiscalBirthdaysCsvRows,
  downloadFiscalBirthdaysCsv,
  FISCAL_BIRTHDAYS_CSV_HEADERS,
  type BirthdayCsvRecord
} from './fiscalBirthdaysCsv';

function birthdayRecord(overrides: Partial<BirthdayCsvRecord> = {}): BirthdayCsvRecord {
  return {
    teacher: {
      fullName: 'Ana "RH", Muñoz',
      coordinationName: 'Coordinación General',
      rfc: 'TEST010101AAA',
      email: 'ana.munoz@tecplayacar.edu.mx',
      status: 'ACTIVO'
    },
    birthDate: new Date(1990, 0, 1),
    birthDateLabel: '01/01/1990',
    birthdayLabel: '01 ene',
    age: 36,
    daysUntilBirthday: 12,
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

describe('fiscal birthdays CSV export helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps birthday columns, order and current sorting behavior', () => {
    const noBirthDate = birthdayRecord({
      teacher: {
        fullName: 'Sin RFC',
        coordinationName: 'Idiomas',
        rfc: '',
        email: '',
        status: 'ACTIVO'
      },
      birthDate: null,
      birthDateLabel: 'No detectada',
      birthdayLabel: '-',
      age: null,
      daysUntilBirthday: null
    });
    const rows = buildFiscalBirthdaysCsvRows([noBirthDate, birthdayRecord()]);

    expect(rows[0]).toEqual([
      'Ana "RH", Muñoz',
      'Coordinación General',
      'TEST010101AAA',
      '01/01/1990',
      '01 ene',
      36,
      12,
      'ana.munoz@tecplayacar.edu.mx',
      'ACTIVO'
    ]);
    expect(rows[1]).toEqual(['Sin RFC', 'Idiomas', '', '', '', '', '', '', 'ACTIVO']);
  });

  it('downloads birthdays CSV with UTF-8 BOM, CRLF, escaping and the existing filename', async () => {
    vi.useFakeTimers();
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fiscal-birthdays');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const appendChild = vi.spyOn(document.body, 'appendChild');

    downloadFiscalBirthdaysCsv(buildFiscalBirthdaysCsvRows([birthdayRecord()]));

    const link = appendChild.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(link.download).toBe('cumpleaños-docentes.csv');
    expect(click).toHaveBeenCalledTimes(1);

    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const { bytes, text: csv } = await blobBytesAndText(blob);
    expect(bytes.slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\r\n')[0]).toBe(quotedHeader(FISCAL_BIRTHDAYS_CSV_HEADERS));
    expect(csv).toContain('"Ana ""RH"", Muñoz"');
    expect(csv).toContain('"Coordinación General"');
    expect(csv).toContain('"TEST010101AAA"');
    expect(csv.endsWith('\r\n')).toBe(true);

    vi.runAllTimers();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:fiscal-birthdays');
  });
});
