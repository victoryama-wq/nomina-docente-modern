import { describe, expect, it } from 'vitest';
import {
  getBaseHoursOccurrenceCounts,
  getEffectiveModulePayrollDateRange,
  getEffectivePayrollBaseDateRange,
  hasEligibleScheduleOccurrences,
  isDateWithinBaseHoursPeriod
} from './base-hours-eligibility.js';

const basePeriod = {
  baseHoursStart: '2026-08-31',
  baseHoursEnd: '2026-12-12'
};

describe('H23 base hours eligibility date ranges', () => {
  it.each([
    ['totally before', '2026-08-10', '2026-08-22', null, null, false],
    ['crosses start', '2026-08-24', '2026-09-04', '2026-08-31', '2026-09-04', true],
    ['inside', '2026-09-07', '2026-09-18', '2026-09-07', '2026-09-18', true],
    ['crosses end', '2026-12-07', '2026-12-18', '2026-12-07', '2026-12-12', true],
    ['totally after', '2026-12-14', '2026-12-26', null, null, false],
    ['single inclusive date', '2026-08-31', '2026-08-31', '2026-08-31', '2026-08-31', true]
  ])('resolves a payroll period %s', (_label, payrollStart, payrollEnd, start, end, hasEligibleDates) => {
    expect(getEffectivePayrollBaseDateRange({ payrollStart, payrollEnd, ...basePeriod })).toEqual({
      intersectionStart: start,
      intersectionEnd: end,
      hasEligibleDates
    });
  });

  it('treats both base period limits as inclusive', () => {
    expect(isDateWithinBaseHoursPeriod('2026-08-31', basePeriod.baseHoursStart, basePeriod.baseHoursEnd)).toBe(true);
    expect(isDateWithinBaseHoursPeriod('2026-12-12', basePeriod.baseHoursStart, basePeriod.baseHoursEnd)).toBe(true);
    expect(isDateWithinBaseHoursPeriod('2026-08-30', basePeriod.baseHoursStart, basePeriod.baseHoursEnd)).toBe(false);
  });

  it.each([
    ['module outside', '2026-08-10', '2026-08-22', '2026-08-31', '2026-09-17', null, null, false],
    ['module partial', '2026-08-24', '2026-09-04', '2026-08-31', '2026-09-17', '2026-08-31', '2026-09-04', true],
    ['module inside', '2026-09-01', '2026-09-10', '2026-08-31', '2026-09-17', '2026-09-01', '2026-09-10', true]
  ])('intersects payroll, base and %s ranges', (_label, payrollStart, payrollEnd, moduleStart, moduleEnd, start, end, hasEligibleDates) => {
    expect(
      getEffectiveModulePayrollDateRange({
        payrollStart,
        payrollEnd,
        ...basePeriod,
        moduleStart,
        moduleEnd
      })
    ).toEqual({ intersectionStart: start, intersectionEnd: end, hasEligibleDates });
  });

  it('lets M1 and M2 contribute independently when one payroll period intersects both', () => {
    const input = { payrollStart: '2026-09-10', payrollEnd: '2026-11-02', ...basePeriod };
    const module1 = getEffectiveModulePayrollDateRange({
      ...input,
      moduleStart: '2026-08-31',
      moduleEnd: '2026-09-17'
    });
    const module2 = getEffectiveModulePayrollDateRange({
      ...input,
      moduleStart: '2026-10-24',
      moduleEnd: '2026-12-05'
    });

    expect(module1).toEqual({
      intersectionStart: '2026-09-10',
      intersectionEnd: '2026-09-17',
      hasEligibleDates: true
    });
    expect(module2).toEqual({
      intersectionStart: '2026-10-24',
      intersectionEnd: '2026-11-02',
      hasEligibleDates: true
    });
  });

  it('rejects an inverted input range instead of correcting it', () => {
    expect(() =>
      getEffectivePayrollBaseDateRange({
        payrollStart: '2026-09-15',
        payrollEnd: '2026-09-01',
        ...basePeriod
      })
    ).toThrow('Rango de fechas invalido');
  });

  it('counts only eligible weekdays and modular Saturdays after blackouts', () => {
    const counts = getBaseHoursOccurrenceCounts({
      payrollStart: '2026-09-07',
      payrollEnd: '2026-09-18',
      ...basePeriod,
      module1Start: '2026-08-31',
      module1End: '2026-09-17',
      module2Start: '2026-10-24',
      module2End: '2026-12-05',
      blackoutDates: ['2026-09-07']
    });

    expect(counts).toEqual({
      weekdays: { L: 1, M: 2, X: 2, J: 2, V: 2 },
      module1Saturdays: 1,
      module2Saturdays: 0,
      hasEligibleDates: true
    });
  });

  it('keeps M1 and M2 independent when both intersect the payroll period', () => {
    const counts = getBaseHoursOccurrenceCounts({
      payrollStart: '2026-09-10',
      payrollEnd: '2026-11-02',
      ...basePeriod,
      module1Start: '2026-08-31',
      module1End: '2026-09-17',
      module2Start: '2026-10-24',
      module2End: '2026-12-05'
    });

    expect(counts.module1Saturdays).toBe(1);
    expect(counts.module2Saturdays).toBe(2);
  });

  it('detects schedule-level eligibility instead of relying only on a non-empty date intersection', () => {
    const counts = getBaseHoursOccurrenceCounts({
      payrollStart: '2026-08-31',
      payrollEnd: '2026-08-31',
      ...basePeriod,
      module1Start: '2026-08-31',
      module1End: '2026-09-17',
      module2Start: '2026-10-24',
      module2End: '2026-12-05'
    });

    expect(
      hasEligibleScheduleOccurrences(
        { hoursL: 0, hoursM: 1, hoursX: 0, hoursJ: 0, hoursV: 0, hoursS1: 0, hoursS2: 0 },
        counts
      )
    ).toBe(false);
    expect(
      hasEligibleScheduleOccurrences(
        { hoursL: 1, hoursM: 0, hoursX: 0, hoursJ: 0, hoursV: 0, hoursS1: 0, hoursS2: 0 },
        counts
      )
    ).toBe(true);
  });
});
