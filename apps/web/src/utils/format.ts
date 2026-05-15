export function moneyLabel(value: number | string | null | undefined): string {
  const raw = value === null || value === undefined || value === '' ? '0' : String(value).trim();
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [integer = '0', decimal = ''] = unsigned.split('.');
  const safeInteger = integer.replace(/\D/g, '') || '0';
  const safeDecimal = decimal.replace(/\D/g, '').padEnd(2, '0').slice(0, 2);
  const grouped = safeInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${grouped}.${safeDecimal}`;
}
