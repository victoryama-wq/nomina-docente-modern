import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, moneyToApi, multiplyMoney } from './decimal.js';

describe('money helpers', () => {
  it('rounds API money values with two decimals', () => {
    expect(moneyToApi('10.005')).toBe('10.01');
    expect(moneyToApi('10.004')).toBe('10.00');
  });

  it('avoids native floating point drift in additions and multiplications', () => {
    expect(moneyToApi(addMoney('0.10', '0.20'))).toBe('0.30');
    expect(moneyToApi(multiplyMoney('125.00', '12'))).toBe('1500.00');
    expect(formatMoney('517510')).toBe('$517,510.00');
  });
});
