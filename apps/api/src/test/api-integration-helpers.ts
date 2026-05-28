import type { FastifyInstance } from 'fastify';
import { clearTestActors } from './auth-test-utils.js';
import { buildTestApp, closeTestApp } from './app-test-utils.js';
import { isTestDbExplicitlyConfigured, prepareTestDatabase } from './db/test-db-utils.js';
import { TEST_COORDINATIONS } from './fixtures/index.js';

export const describeIntegration = isTestDbExplicitlyConfigured();

export const TEST_IDS = {
  cycle: '30000000-0000-4000-8000-000000000003',
  calendarConfig: '30000000-0000-4000-8000-000000000004',
  teacherIdiomas: '40000000-0000-4000-8000-000000000001',
  teacherMulti: '40000000-0000-4000-8000-000000000002',
  scheduleIdiomas: '50000000-0000-4000-8000-000000000001',
  scheduleMulti: '50000000-0000-4000-8000-000000000002',
  extraOwn: '60000000-0000-4000-8000-000000000001',
  extraOther: '60000000-0000-4000-8000-000000000002',
  extraMulti: '60000000-0000-4000-8000-000000000003',
  payrollRun: '70000000-0000-4000-8000-000000000001',
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
    subjectName: 'H04 QA Materia Base',
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
