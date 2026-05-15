import { Decimal } from 'decimal.js';

export type DecimalLike = Decimal.Value | null | undefined;

export function toMoneyDecimal(value: DecimalLike): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  const decimal = new Decimal(value);
  if (!decimal.isFinite()) throw new Error('Importe monetario invalido.');
  return decimal;
}

export function toHoursDecimal(value: DecimalLike): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  const decimal = new Decimal(value);
  if (!decimal.isFinite()) throw new Error('Valor de horas invalido.');
  return decimal;
}

export function moneyToDb(value: DecimalLike): string {
  return toMoneyDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function moneyToApi(value: DecimalLike): string {
  return moneyToDb(value);
}

export function moneyForDisplay(value: DecimalLike): string {
  return moneyToDb(value);
}

export function hoursToApi(value: DecimalLike): string {
  return toHoursDecimal(value).toString();
}

export function addMoney(...values: DecimalLike[]): Decimal {
  let total = new Decimal(0);
  for (const value of values) total = total.plus(toMoneyDecimal(value));
  return total;
}

export function subtractMoney(a: DecimalLike, b: DecimalLike): Decimal {
  return toMoneyDecimal(a).minus(toMoneyDecimal(b));
}

export function multiplyMoney(a: DecimalLike, b: DecimalLike): Decimal {
  return toMoneyDecimal(a).mul(toMoneyDecimal(b));
}

export function addHours(...values: DecimalLike[]): Decimal {
  let total = new Decimal(0);
  for (const value of values) total = total.plus(toHoursDecimal(value));
  return total;
}

export function multiplyHours(a: DecimalLike, b: DecimalLike): Decimal {
  return toHoursDecimal(a).mul(toHoursDecimal(b));
}

export function decimalInputSchemaValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '0';
  return new Decimal(value as Decimal.Value).toString();
}

export function formatMoney(value: DecimalLike): string {
  const [integerPart, decimalPart] = moneyForDisplay(value).split('.');
  const sign = integerPart.startsWith('-') ? '-' : '';
  const digits = sign ? integerPart.slice(1) : integerPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${grouped}.${decimalPart || '00'}`;
}

export function formatHours(value: DecimalLike): string {
  const text = hoursToApi(value);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}
