import { describe, expect, it } from 'vitest';
import { decodeDossierPdf, DOSSIER_MAX_BYTES, DossierError } from '../lib/dossier-contract.js';

describe('PD07-B01 bounded canonical Base64 decoding', () => {
  it.each([1, 2, 4, 7.5])('preserves every byte at %s MiB without exhausting the stack', mib => {
    const bytes = Buffer.alloc(mib * 1024 * 1024, 0xfb);
    expect(decodeDossierPdf(bytes.toString('base64')).equals(bytes)).toBe(true);
  });

  it.each([1, 2, 3, 4, 5, 255, 256, 257, DOSSIER_MAX_BYTES - 2, DOSSIER_MAX_BYTES - 1])(
    'accepts canonical padding for %i bytes', size => {
      const bytes = Buffer.alloc(size, 0xff);
      expect(decodeDossierPdf(bytes.toString('base64')).equals(bytes)).toBe(true);
    });

  it.each([
    '', 'abc', '====', '=AAA', 'AA=A', 'A===', 'AA==AAAA', 'AAAA====',
    '!!!!', 'AA-_', 'AAAA\n', 'AA A', 'AA\tA', 'AA\0A', '\u00c1AAA',
    'ZE==', 'AAB=', 'data:application/pdf;base64,AAAA'
  ])('rejects noncanonical input %j with the existing controlled error', input => {
    expect(() => decodeDossierPdf(input)).toThrow(DossierError);
    expect(() => decodeDossierPdf(input)).toThrow(expect.objectContaining({ code: 'INVALID_PDF', statusCode: 422 }));
  });

  it('rejects a bad character at the end of a large input without exhausting the stack', () => {
    const encoded = Buffer.alloc(DOSSIER_MAX_BYTES, 65).toString('base64');
    expect(() => decodeDossierPdf(`${encoded.slice(0, -1)}!`)).toThrow(
      expect.objectContaining({ code: 'INVALID_PDF', statusCode: 422 }));
  });

  it('rejects oversize input before decoding with the existing 413 error', () => {
    const encoded = Buffer.alloc(DOSSIER_MAX_BYTES + 1).toString('base64');
    expect(() => decodeDossierPdf(encoded)).toThrow(
      expect.objectContaining({ code: 'FILE_TOO_LARGE', statusCode: 413 }));
  });
});
