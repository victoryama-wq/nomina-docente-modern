export interface InclusiveDateRange {
  start: string;
  end: string;
}

export interface EffectiveDateRange {
  intersectionStart: string | null;
  intersectionEnd: string | null;
  hasEligibleDates: boolean;
}

export interface PayrollBaseDateRangeInput {
  payrollStart: string;
  payrollEnd: string;
  baseHoursStart: string;
  baseHoursEnd: string;
}

export interface ModulePayrollDateRangeInput extends PayrollBaseDateRangeInput {
  moduleStart: string;
  moduleEnd: string;
}

function assertOrderedRange(range: InclusiveDateRange): void {
  if (range.start > range.end) {
    throw new Error(`Rango de fechas invalido: ${range.start} > ${range.end}.`);
  }
}

export function intersectInclusiveDateRanges(...ranges: InclusiveDateRange[]): EffectiveDateRange {
  if (ranges.length === 0) {
    return { intersectionStart: null, intersectionEnd: null, hasEligibleDates: false };
  }

  ranges.forEach(assertOrderedRange);
  const intersectionStart = ranges.reduce(
    (latest, range) => (range.start > latest ? range.start : latest),
    ranges[0].start
  );
  const intersectionEnd = ranges.reduce(
    (earliest, range) => (range.end < earliest ? range.end : earliest),
    ranges[0].end
  );

  if (intersectionStart > intersectionEnd) {
    return { intersectionStart: null, intersectionEnd: null, hasEligibleDates: false };
  }

  return { intersectionStart, intersectionEnd, hasEligibleDates: true };
}

export function isDateWithinBaseHoursPeriod(date: string, baseHoursStart: string, baseHoursEnd: string): boolean {
  assertOrderedRange({ start: baseHoursStart, end: baseHoursEnd });
  return date >= baseHoursStart && date <= baseHoursEnd;
}

export function getEffectivePayrollBaseDateRange(input: PayrollBaseDateRangeInput): EffectiveDateRange {
  return intersectInclusiveDateRanges(
    { start: input.payrollStart, end: input.payrollEnd },
    { start: input.baseHoursStart, end: input.baseHoursEnd }
  );
}

export function getEffectiveModulePayrollDateRange(input: ModulePayrollDateRangeInput): EffectiveDateRange {
  return intersectInclusiveDateRanges(
    { start: input.payrollStart, end: input.payrollEnd },
    { start: input.baseHoursStart, end: input.baseHoursEnd },
    { start: input.moduleStart, end: input.moduleEnd }
  );
}
