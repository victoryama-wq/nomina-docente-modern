import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { clearTestActors, injectAs } from './auth-test-utils.js';
import { buildTestApp, closeTestApp } from './app-test-utils.js';
import { isTestDbExplicitlyConfigured, prepareTestDatabase } from './db/test-db-utils.js';
import {
  TEST_COORDINATIONS,
  accountantActor,
  adminActor,
  coordinatorActor,
  coordinatorWithoutCoordinationActor,
  financeActor,
  multiCoordinatorActor,
  rhActor
} from './fixtures/index.js';

const describeIntegration = isTestDbExplicitlyConfigured() ? describe : describe.skip;

const ids = {
  cycle: '30000000-0000-4000-8000-000000000003',
  calendarConfig: '30000000-0000-4000-8000-000000000004',
  teacherIdiomas: '40000000-0000-4000-8000-000000000001',
  teacherMulti: '40000000-0000-4000-8000-000000000002',
  scheduleMulti: '50000000-0000-4000-8000-000000000002',
  extraOwn: '60000000-0000-4000-8000-000000000001',
  payrollRun: '70000000-0000-4000-8000-000000000001',
  subject: '30000000-0000-4000-8000-000000000001',
  tabulator: '30000000-0000-4000-8000-000000000002'
} as const;

function scheduleBody(overrides: Record<string, unknown> = {}) {
  return {
    cycleId: ids.cycle,
    teacherId: ids.teacherMulti,
    coordinationId: TEST_COORDINATIONS.adetur.id,
    subjectId: ids.subject,
    groupCode: 'QA-MU-01',
    tabulatorId: ids.tabulator,
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

function extraBody(overrides: Record<string, unknown> = {}) {
  return {
    cycleId: ids.cycle,
    coordinationId: TEST_COORDINATIONS.idiomas.id,
    teacherId: ids.teacherIdiomas,
    hours: '2',
    tabulatorId: ids.tabulator,
    tabulatorAmount: '100.00',
    reason: 'Extra H04 integration',
    activityDate: '2026-05-20',
    reference: 'H04-INTEGRATION',
    observations: 'Dato sintetico de prueba',
    ...overrides
  };
}

function payrollInput() {
  return {
    calendarConfigId: ids.calendarConfig,
    cycleId: ids.cycle,
    periodLabel: 'H04 QA Mayo 15-28 2026',
    payrollStart: '2026-05-15',
    payrollEnd: '2026-05-28',
    module1Start: '2026-05-01',
    module1End: '2026-06-30',
    module2Start: '2026-07-01',
    module2End: '2026-08-31'
  };
}

describeIntegration('H04 API integration with PostgreSQL test database', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await prepareTestDatabase();
    app = await buildTestApp();
  });

  afterEach(() => {
    clearTestActors();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('serves health and rejects protected routes without a test actor', async () => {
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ ok: true, service: 'nomina-docente-api' });

    const session = await app.inject({ method: 'GET', url: '/api/auth/session' });
    expect(session.statusCode).toBe(401);
    expect(session.json()).toMatchObject({ error: 'AUTH_REQUIRED' });
  });

  it('allows a one-coordination coordinator to read operational context and blocks foreign schedule edits', async () => {
    const actor = coordinatorActor();
    const context = await injectAs(app, actor, { method: 'GET', url: '/api/schedules/context' });
    expect(context.statusCode).toBe(200);
    expect(context.json().coordinations).toEqual([
      { id: TEST_COORDINATIONS.idiomas.id, name: TEST_COORDINATIONS.idiomas.name }
    ]);

    const blocked = await injectAs(app, actor, {
      method: 'PATCH',
      url: `/api/schedules/${ids.scheduleMulti}`,
      payload: scheduleBody()
    });
    expect(blocked.statusCode).not.toBe(200);
    expect(blocked.json().message).toContain('Solo puedes editar');
  });

  it('serves schedule Admin selector as operational responsibles, not technical scopes', async () => {
    const context = await injectAs(app, adminActor(), { method: 'GET', url: '/api/schedules/context' });
    expect(context.statusCode).toBe(200);

    const names = context.json().responsibles.map((responsible: { name: string }) => responsible.name);
    expect(names).toContain('QA Coordinador Idiomas');
    expect(names).toContain('QA Coordinador Multi');
    expect(names).toContain('QA Coordinador Sin Coordinacion');
    expect(names).toContain('QA Direccion');
    expect(names).not.toContain('ADETUR');
    expect(names).not.toContain('ARQ');
  });

  it('allows a multi-coordination coordinator to edit an own operational record', async () => {
    const response = await injectAs(app, multiCoordinatorActor(), {
      method: 'PATCH',
      url: `/api/schedules/${ids.scheduleMulti}`,
      payload: scheduleBody({ hoursL: '2', hoursM: '2' })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().schedule.coordinationId).toBe(TEST_COORDINATIONS.adetur.id);
  });

  it('blocks operational capture for a coordinator without assigned coordination', async () => {
    const response = await injectAs(app, coordinatorWithoutCoordinationActor(), {
      method: 'POST',
      url: '/api/extras',
      payload: extraBody()
    });

    expect(response.statusCode).not.toBe(201);
    expect(response.json().message).toContain('ambito operativo');
  });

  it('enforces fiscal permissions for coordinator and RH', async () => {
    const coordinatorFiscal = await injectAs(app, coordinatorActor(), {
      method: 'PATCH',
      url: `/api/teachers/${ids.teacherIdiomas}/fiscal`,
      payload: {
        paymentType: '1',
        email: 'qa.fiscal@example.test',
        rfc: 'TEST010101AAA',
        bankDetail: 'BANCO QA'
      }
    });
    expect(coordinatorFiscal.statusCode).toBe(403);

    const coordinatorCreate = await injectAs(app, coordinatorActor(), {
      method: 'POST',
      url: '/api/teachers',
      payload: {
        firstNames: 'Docente Fiscal',
        paternalLastName: 'Bloqueado',
        maternalLastName: 'QA',
        category: 'N',
        coordinationId: TEST_COORDINATIONS.idiomas.id,
        paymentType: '1'
      }
    });
    expect(coordinatorCreate.statusCode).toBe(403);
    expect(coordinatorCreate.json().message).toContain('datos fiscales');

    const rhFiscal = await injectAs(app, rhActor(), {
      method: 'PATCH',
      url: `/api/teachers/${ids.teacherIdiomas}/fiscal`,
      payload: {
        paymentType: '1',
        email: 'qa.fiscal@example.test',
        rfc: 'TEST010101AAA',
        bankDetail: 'BANCO QA'
      }
    });
    expect(rhFiscal.statusCode).toBe(200);
    expect(rhFiscal.json().teacher.paymentType).toBe('1');
  });

  it('separates finance workflow permissions for accountant and finance roles', async () => {
    const accountant = await injectAs(app, accountantActor(), {
      method: 'PATCH',
      url: `/api/reports/finance/runs/${ids.payrollRun}/status`,
      payload: { status: 'EN_REVISION' }
    });
    expect(accountant.statusCode).toBe(403);

    const finance = await injectAs(app, financeActor(), {
      method: 'PATCH',
      url: `/api/reports/finance/runs/${ids.payrollRun}/status`,
      payload: { status: 'EN_REVISION' }
    });
    expect(finance.statusCode).toBe(200);
  });

  it('allows payroll preview but blocks payroll finalize for coordinator', async () => {
    const preview = await injectAs(app, coordinatorActor(), {
      method: 'POST',
      url: '/api/payroll/preview',
      payload: payrollInput()
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().summary).toBeDefined();

    const finalize = await injectAs(app, coordinatorActor(), {
      method: 'POST',
      url: '/api/payroll/runs',
      payload: payrollInput()
    });
    expect(finalize.statusCode).toBe(403);
  });

  it('allows extra owner edits and blocks edits by another coordinator', async () => {
    const owner = await injectAs(app, coordinatorActor(), {
      method: 'PATCH',
      url: `/api/extras/${ids.extraOwn}`,
      payload: extraBody({ hours: '2.5', observations: 'Editado por propietario QA' })
    });
    expect(owner.statusCode).toBe(200);

    const otherCoordinator = await injectAs(app, multiCoordinatorActor(), {
      method: 'PATCH',
      url: `/api/extras/${ids.extraOwn}`,
      payload: extraBody({ hours: '3', observations: 'Intento ajeno QA' })
    });
    expect(otherCoordinator.statusCode).not.toBe(200);
    expect(otherCoordinator.json().message).toMatch(/Solo la coordinaci.n que captur./);
  });
});
