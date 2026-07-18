import type { FastifyInstance } from 'fastify';
import { clearTestActors } from './auth-test-utils.js';
import { buildTestApp, closeTestApp } from './app-test-utils.js';
import { isTestDbExplicitlyConfigured, prepareTestDatabase } from './db/test-db-utils.js';
import { TEST_COORDINATIONS } from './fixtures/index.js';

export const describeIntegration = isTestDbExplicitlyConfigured();

export const TEST_IDS = {
  cycle: '30000000-0000-4000-8000-000000000003',
  calendarConfig: '30000000-0000-4000-8000-000000000004',
  planningCycle: '30000000-0000-4000-8000-000000000013',
  planningCalendarConfig: '30000000-0000-4000-8000-000000000014',
  closedCycle: '30000000-0000-4000-8000-000000000015',
  closableCycle: '30000000-0000-4000-8000-000000000021',
  closableCalendarConfigA: '30000000-0000-4000-8000-000000000022',
  closableCalendarConfigB: '30000000-0000-4000-8000-000000000023',
  closableNextCycle: '30000000-0000-4000-8000-000000000024',
  closableNextSchedule: '50000000-0000-4000-8000-000000000024',
  noScheduleNextCycle: '30000000-0000-4000-8000-000000000025',
  unpaidCycle: '30000000-0000-4000-8000-000000000026',
  unpaidCalendarConfig: '30000000-0000-4000-8000-000000000027',
  pendingCycle: '30000000-0000-4000-8000-000000000028',
  pendingCalendarConfig: '30000000-0000-4000-8000-000000000029',
  pendingPayrollRun: '70000000-0000-4000-8000-000000000028',
  cancelledOnlyCycle: '30000000-0000-4000-8000-000000000030',
  cancelledOnlyCalendarConfig: '30000000-0000-4000-8000-000000000031',
  cancelledOnlyPayrollRun: '70000000-0000-4000-8000-000000000030',
  teacherIdiomas: '40000000-0000-4000-8000-000000000001',
  teacherMulti: '40000000-0000-4000-8000-000000000002',
  scheduleIdiomas: '50000000-0000-4000-8000-000000000001',
  scheduleMulti: '50000000-0000-4000-8000-000000000002',
  planningScheduleIdiomas: '50000000-0000-4000-8000-000000000013',
  closedScheduleIdiomas: '50000000-0000-4000-8000-000000000015',
  closableScheduleIdiomas: '50000000-0000-4000-8000-000000000021',
  extraOwn: '60000000-0000-4000-8000-000000000001',
  extraOther: '60000000-0000-4000-8000-000000000002',
  extraMulti: '60000000-0000-4000-8000-000000000003',
  planningExtra: '60000000-0000-4000-8000-000000000013',
  closableExtra: '60000000-0000-4000-8000-000000000021',
  payrollRun: '70000000-0000-4000-8000-000000000001',
  closablePayrollRunA: '70000000-0000-4000-8000-000000000021',
  closablePayrollRunB: '70000000-0000-4000-8000-000000000022',
  subject: '30000000-0000-4000-8000-000000000001',
  tabulator: '30000000-0000-4000-8000-000000000002'
} as const;

export async function freshTestApp(): Promise<FastifyInstance> {
  await prepareTestDatabase();
  return buildTestApp();
}

export async function cleanupTestApp(app: FastifyInstance | null): Promise<void> {
  clearTestActors();
  if (app) await closeTestApp(app);
}

export function scheduleBody(overrides: Record<string, unknown> = {}) {
  return {
    cycleId: TEST_IDS.cycle,
    teacherId: TEST_IDS.teacherMulti,
    coordinationId: TEST_COORDINATIONS.adetur.id,
    subjectId: TEST_IDS.subject,
    groupCode: 'QA-MU-01',
    tabulatorId: TEST_IDS.tabulator,
    tabulatorName: 'H04 QA Tabulador 100',
    tabulatorAmount: '100.00',
    hoursL: '3',
    hoursM: '3',
    hoursX: '0',
    hoursJ: '0',
    hoursV: '0',
    hoursS1: '0',
    hoursS2: '0',
    ...overrides
  };
}

export function extraBody(overrides: Record<string, unknown> = {}) {
  return {
    cycleId: TEST_IDS.cycle,
    coordinationId: TEST_COORDINATIONS.idiomas.id,
    teacherId: TEST_IDS.teacherIdiomas,
    hours: '2',
    tabulatorId: TEST_IDS.tabulator,
    tabulatorAmount: '100.00',
    reason: 'Extra H04 integration',
    activityDate: '2026-05-20',
    reference: 'H04-INTEGRATION',
    observations: 'Dato sintetico de prueba',
    ...overrides
  };
}

export function incidenceBody(overrides: Record<string, unknown> = {}) {
  return {
    calendarConfigId: TEST_IDS.calendarConfig,
    absences: '1',
    delays: '1',
    extraHoursInSchedule: '1',
    ...overrides
  };
}

export function payrollInput(overrides: Record<string, unknown> = {}) {
  return {
    calendarConfigId: TEST_IDS.calendarConfig,
    cycleId: TEST_IDS.cycle,
    periodLabel: 'H04 QA Mayo 15-28 2026',
    payrollStart: '2026-05-15',
    payrollEnd: '2026-05-28',
    module1Start: '2026-05-01',
    module1End: '2026-06-30',
    module2Start: '2026-07-01',
    module2End: '2026-08-31',
    ...overrides
  };
}

export function expectDecimalString(value: unknown, expected?: string): void {
  if (typeof value !== 'string') {
    throw new Error(`Expected decimal string, got ${typeof value}`);
  }
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new Error(`Expected decimal string format, got ${value}`);
  }
  if (expected !== undefined && value !== expected) {
    throw new Error(`Expected ${expected}, got ${value}`);
  }
}
