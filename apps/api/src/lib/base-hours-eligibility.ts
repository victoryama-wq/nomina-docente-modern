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

export interface BaseHoursOccurrenceInput extends PayrollBaseDateRangeInput {
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  blackoutDates?: readonly string[];
}

export interface BaseHoursOccurrenceCounts {
  weekdays: {
    L: number;
    M: number;
    X: number;
    J: number;
    V: number;
  };
  module1Saturdays: number;
  module2Saturdays: number;
  hasEligibleDates: boolean;
}

export interface ScheduleHoursForEligibility {
  hoursL: string | number;
  hoursM: string | number;
  hoursX: string | number;
  hoursJ: string | number;
  hoursV: string | number;
  hoursS1: string | number;
  hoursS2: string | number;
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

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function countWeekday(range: EffectiveDateRange, weekday: number, blackouts: ReadonlySet<string>): number {
  if (!range.hasEligibleDates || !range.intersectionStart || !range.intersectionEnd) return 0;

  const end = parseDateKey(range.intersectionEnd).getTime();
  let total = 0;
  for (const cursor = parseDateKey(range.intersectionStart); cursor.getTime() <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const current = cursor.toISOString().slice(0, 10);
    if (cursor.getUTCDay() === weekday && !blackouts.has(current)) total += 1;
  }
  return total;
}

export function getBaseHoursOccurrenceCounts(input: BaseHoursOccurrenceInput): BaseHoursOccurrenceCounts {
  const baseRange = getEffectivePayrollBaseDateRange(input);
  const module1Range = getEffectiveModulePayrollDateRange({
    ...input,
    moduleStart: input.module1Start,
    moduleEnd: input.module1End
  });
  const module2Range = getEffectiveModulePayrollDateRange({
    ...input,
    moduleStart: input.module2Start,
    moduleEnd: input.module2End
  });
  const blackouts = new Set(input.blackoutDates ?? []);

  return {
    weekdays: {
      L: countWeekday(baseRange, 1, blackouts),
      M: countWeekday(baseRange, 2, blackouts),
      X: countWeekday(baseRange, 3, blackouts),
      J: countWeekday(baseRange, 4, blackouts),
      V: countWeekday(baseRange, 5, blackouts)
    },
    module1Saturdays: countWeekday(module1Range, 6, blackouts),
    module2Saturdays: countWeekday(module2Range, 6, blackouts),
    hasEligibleDates: baseRange.hasEligibleDates
  };
}

export function hasEligibleScheduleOccurrences(
  schedule: ScheduleHoursForEligibility,
  counts: BaseHoursOccurrenceCounts
): boolean {
  return (
    Number(schedule.hoursL) * counts.weekdays.L > 0 ||
    Number(schedule.hoursM) * counts.weekdays.M > 0 ||
    Number(schedule.hoursX) * counts.weekdays.X > 0 ||
    Number(schedule.hoursJ) * counts.weekdays.J > 0 ||
    Number(schedule.hoursV) * counts.weekdays.V > 0 ||
    Number(schedule.hoursS1) * counts.module1Saturdays > 0 ||
    Number(schedule.hoursS2) * counts.module2Saturdays > 0
  );
}
