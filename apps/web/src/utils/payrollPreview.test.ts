import { describe, expect, it } from 'vitest';
import type { PayrollExtraDetail, PayrollLine, PayrollPreview, PayrollScheduleDetail } from '../api';
import {
  extraDetailsForPayrollLine,
  payrollDisplayLines,
  payrollTeacherScopeLabels,
  scheduleDetailsForPayrollLine
} from './payrollPreview';

function payrollLine(overrides: Partial<PayrollLine> = {}): PayrollLine {
  return {
    key: 'teacher:teacher-1',
    teacherId: 'teacher-1',
    coordinationId: 'coordination-1',
    teacherName: 'Docente Compartido',
    coordinationName: 'Idiomas, ARQ',
    category: 'N',
    baseHours: 20,
    absences: 0,
    delays: 0,
    delayDiscountHours: 0,
    grossBaseAmount: '2000.00',
    absenceDiscountAmount: '0.00',
    delayDiscountAmount: '0.00',
    baseNetAmount: '2000.00',
    scheduleExtraHours: 1,
    scheduleExtraAmount: '100.00',
    loggedExtraHours: 2,
    loggedExtraAmount: '200.00',
    totalExtraHours: 3,
    totalExtraAmount: '300.00',
    totalAmount: '2300.00',
    alerts: [],
    scheduleCount: 2,
    loggedExtraCount: 1,
    isTeacherAggregate: true,
    coordinationIds: ['coordination-1', 'coordination-2'],
    coordinationNames: ['Idiomas', 'ARQ'],
    scope: {
      ownedByActor: true,
      inActorCoordination: true,
      hasOtherCoordinations: true
    },
    ...overrides
  };
}

function scheduleDetail(lineKey: string, teacherId: string, coordinationId: string): PayrollScheduleDetail {
  return {
    lineKey,
    scheduleId: `${lineKey}:schedule`,
    teacherId,
    coordinationId,
    teacherName: 'Docente Compartido',
    coordinationName: coordinationId,
    subjectName: 'Materia QA',
    groupCode: 'QA',
    tabulatorName: 'QA 100',
    tabulatorAmount: '100.00',
    weekdayHours: 10,
    module1Hours: 0,
    module2Hours: 0,
    baseHours: 10,
    grossBaseAmount: '1000.00',
    absences: 0,
    delays: 0,
    delayDiscountHours: 0,
    absenceDiscountAmount: '0.00',
    delayDiscountAmount: '0.00',
    scheduleExtraHours: 0,
    scheduleExtraAmount: '0.00',
    baseNetAmount: '1000.00'
  };
}

function extraDetail(lineKey: string, teacherId: string, coordinationId: string): PayrollExtraDetail {
  return {
    lineKey,
    extraId: `${lineKey}:extra`,
    teacherId,
    coordinationId,
    teacherName: 'Docente Compartido',
    coordinationName: coordinationId,
    reason: 'Extra QA',
    activityDate: '2026-05-20',
    hours: 1,
    tabulatorAmount: '100.00',
    totalAmount: '100.00'
  };
}

describe('shared coordinator payroll preview helpers', () => {
  it('shows the coordinator teacher aggregate once instead of one row per coordination', () => {
    const aggregate = payrollLine();
    const preview = {
      lines: [
        payrollLine({ key: 'teacher-1:coordination-1', isTeacherAggregate: false }),
        payrollLine({ key: 'teacher-1:coordination-2', coordinationId: 'coordination-2', isTeacherAggregate: false })
      ],
      teacherSummaries: [aggregate]
    } as PayrollPreview;

    expect(payrollDisplayLines(preview)).toEqual([aggregate]);
  });

  it('keeps schedule and external-extra breakdowns from every coordination for an aggregate teacher', () => {
    const aggregate = payrollLine();
    const schedules = [
      scheduleDetail('teacher-1:coordination-1', 'teacher-1', 'Idiomas'),
      scheduleDetail('teacher-1:coordination-2', 'teacher-1', 'ARQ'),
      scheduleDetail('teacher-2:coordination-2', 'teacher-2', 'ARQ')
    ];
    const extras = [
      extraDetail('teacher-1:coordination-1', 'teacher-1', 'Idiomas'),
      extraDetail('teacher-1:coordination-2', 'teacher-1', 'ARQ'),
      extraDetail('teacher-2:coordination-2', 'teacher-2', 'ARQ')
    ];

    expect(scheduleDetailsForPayrollLine(aggregate, schedules).map((detail) => detail.coordinationName)).toEqual([
      'Idiomas',
      'ARQ'
    ]);
    expect(extraDetailsForPayrollLine(aggregate, extras).map((detail) => detail.coordinationName)).toEqual([
      'Idiomas',
      'ARQ'
    ]);
  });

  it('exposes the three approved read-only relationship labels', () => {
    expect(payrollTeacherScopeLabels(payrollLine())).toEqual([
      'Docente bajo mi responsabilidad',
      'Imparte en mi coordinación',
      'Carga compartida con otras coordinaciones'
    ]);
  });
});
