import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, moneyToApi, multiplyMoney } from './decimal.js';

describe('money helpers', () => {
  it('rounds API money values with two decimals', () => {
    expect(moneyToApi('10.005')).toBe('10.01');
    expect(moneyToApi('10.004')).toBe('10.00');
    expect(moneyToApi('10.50')).toBe('10.50');
    expect(moneyToApi('10.40')).toBe('10.40');
    expect(moneyToApi('10.43')).toBe('10.43');
    expect(moneyToApi('10.435')).toBe('10.44');
    expect(moneyToApi('10.434')).toBe('10.43');
    expect(moneyToApi('62.675')).toBe('62.68');
    expect(moneyToApi('62.674')).toBe('62.67');
  });

  it('avoids native floating point drift in additions and multiplications', () => {
    expect(moneyToApi(addMoney('0.10', '0.20'))).toBe('0.30');
    expect(moneyToApi(multiplyMoney('125.00', '12'))).toBe('1500.00');
    expect(moneyToApi(multiplyMoney('10.10', '3'))).toBe('30.30');
    expect(moneyToApi(multiplyMoney('62.675', '2'))).toBe('125.35');
    expect(formatMoney('517510')).toBe('$517,510.00');
  });
});
