import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../api';
import { fiscalFields, fiscalRequestError, validateFiscalFields } from './fiscalValidation';
const valid = { rfc: '', email: '', fiscalPostalCode: '00123', curp: '', paymentType: 'E', bankDetail: '' };
describe('Fiscal validation uses existing format rules only', () => {
  it('allows optional blanks, normalizable text and leading zero postal code', () => {
    expect(validateFiscalFields(valid)).toEqual({});
    expect(validateFiscalFields({ ...valid, rfc: ' test010101aaa ', curp: ' test010101hqrxxx09 ', email: ' qa@example.invalid ' })).toEqual({});
  });
  it.each(fiscalFields)('rejects malformed %s with local guidance', field => {
    expect(validateFiscalFields({ ...valid, [field]: field === 'bankDetail' ? 'x'.repeat(141) : 'INVALIDO' })[field]).toBeTruthy();
  });
  it('checks email and bank maximum lengths', () => {
    expect(validateFiscalFields({ ...valid, email: `${'a'.repeat(151)}@domain.mx` }).email).toBeTruthy();
    expect(validateFiscalFields({ ...valid, bankDetail: 'x'.repeat(140) })).toEqual({});
  });
  it.each([null, [], 'SQL', { rfc: 'SQL' }])('never displays arbitrary field errors %j', fields => {
    expect(fiscalRequestError(new ApiRequestError('private', 400, 'VALIDATION_ERROR', fields)).fields).toEqual({});
  });
  it.each([401, 403, 409, 429, 500])('uses bounded messages for %s', status => {
    expect(fiscalRequestError(new ApiRequestError('private', status, 'ERROR')).message).not.toContain('private');
  });
});
