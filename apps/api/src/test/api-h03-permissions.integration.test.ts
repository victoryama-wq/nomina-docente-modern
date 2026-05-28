import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import {
  TEST_IDS,
  cleanupTestApp,
  describeIntegration,
  freshTestApp,
  payrollInput
} from './api-integration-helpers.js';
import {
  PERMISSIONS,
  TEST_COORDINATIONS,
  accountantActor,
  coordinatorActor,
  createSessionUser,
  directionActor,
  financeActor,
  rhActor
} from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

describeIfDb('H03 permission separation business integration coverage', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('separates fiscal manage from operational roles', async () => {
    for (const actor of [coordinatorActor(), directionActor(), accountantActor()]) {
      const response = await injectAs(app!, actor, {
        method: 'PATCH',
        url: `/api/teachers/${TEST_IDS.teacherIdiomas}/fiscal`,
        payload: {
          paymentType: '1',
          email: 'qa.fiscal@example.test',
          rfc: 'TEST010101AAA',
          bankDetail: 'BANCO QA'
        }
      });
      expect(response.statusCode).toBe(403);
    }

    for (const actor of [rhActor(), financeActor()]) {
      const response = await injectAs(app!, actor, {
        method: 'PATCH',
        url: `/api/teachers/${TEST_IDS.teacherIdiomas}/fiscal`,
        payload: {
          paymentType: '1',
          email: `${actor.role}.fiscal@example.test`,
          rfc: 'TEST010101AAA',
          bankDetail: 'BANCO QA'
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().teacher.paymentType).toBe('1');
    }
  });

  it('blocks fiscal fields in teacher creation for users without fiscal.manage', async () => {
    const coordinator = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/teachers',
      payload: {
        firstNames: 'Docente Fiscal',
        paternalLastName: 'Bloqueado',
        maternalLastName: 'QA',
        category: 'N',
        coordinationId: TEST_COORDINATIONS.idiomas.id,
        paymentType: '1',
        rfc: 'TEST010101AAA',
        email: 'blocked@example.test',
        bankDetail: 'BANCO QA'
      }
    });
    expect(coordinator.statusCode).toBe(403);
    expect(coordinator.json().message).toContain('datos fiscales');

    const direction = await injectAs(app!, directionActor(), {
      method: 'POST',
      url: '/api/teachers',
      payload: {
        firstNames: 'Docente Fiscal',
        paternalLastName: 'Direccion',
        maternalLastName: 'QA',
        category: 'N',
        coordinationId: TEST_COORDINATIONS.adetur.id,
        paymentType: '1'
      }
    });
    expect(direction.statusCode).toBe(403);
  });

  it('enforces fiscal document permissions before touching Storage', async () => {
    const blockedDownload = await injectAs(app!, coordinatorActor(), {
      method: 'GET',
      url: `/api/teachers/${TEST_IDS.teacherIdiomas}/documents/current`
    });
    expect(blockedDownload.statusCode).toBe(403);

    const blockedUpload = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: `/api/teachers/${TEST_IDS.teacherIdiomas}/documents/constancia`,
      payload: {
        fileName: 'constancia.pdf',
        mimeType: 'application/pdf',
        base64Data: Buffer.from('qa').toString('base64')
      }
    });
    expect(blockedUpload.statusCode).toBe(403);

    const authorizedUntilData = await injectAs(app!, rhActor(), {
      method: 'GET',
      url: `/api/teachers/${TEST_IDS.teacherIdiomas}/documents/current`
    });
    expect(authorizedUntilData.statusCode).toBe(404);
  });

  it('keeps finance.view as read-only and finance.export as export-only', async () => {
    const financeViewOnly = createSessionUser({
      id: '20000000-0000-4000-8000-000000000106',
      firebaseUid: 'qa-fixture-finance-view-only',
      email: 'qa.finance.view.only@tecplayacar.edu.mx',
      displayName: 'QA Finance View Only',
      role: 'finanzas',
      permissions: [PERMISSIONS.financeView],
      actorCoordinations: []
    });

    const context = await injectAs(app!, financeViewOnly, {
      method: 'GET',
      url: '/api/reports/finance/context'
    });
    expect(context.statusCode).toBe(200);

    const exportAttempt = await injectAs(app!, financeViewOnly, {
      method: 'GET',
      url: '/api/reports/finance/export/payments'
    });
    expect(exportAttempt.statusCode).toBe(403);

    const workflowAttempt = await injectAs(app!, financeViewOnly, {
      method: 'PATCH',
      url: `/api/reports/finance/runs/${TEST_IDS.payrollRun}/status`,
      payload: { status: 'EN_REVISION' }
    });
    expect(workflowAttempt.statusCode).toBe(403);

    const accountantExport = await injectAs(app!, accountantActor(), {
      method: 'GET',
      url: '/api/reports/finance/export/payments'
    });
    expect(accountantExport.statusCode).toBe(200);
    expect(accountantExport.headers['content-type']).toContain('text/csv');

    const accountantWorkflow = await injectAs(app!, accountantActor(), {
      method: 'PATCH',
      url: `/api/reports/finance/runs/${TEST_IDS.payrollRun}/status`,
      payload: { status: 'EN_REVISION' }
    });
    expect(accountantWorkflow.statusCode).toBe(403);
  });

  it('allows finance.workflow to move payroll status through approved transitions', async () => {
    const review = await injectAs(app!, financeActor(), {
      method: 'PATCH',
      url: `/api/reports/finance/runs/${TEST_IDS.payrollRun}/status`,
      payload: { status: 'EN_REVISION' }
    });
    expect(review.statusCode).toBe(200);

    const approve = await injectAs(app!, financeActor(), {
      method: 'PATCH',
      url: `/api/reports/finance/runs/${TEST_IDS.payrollRun}/status`,
      payload: { status: 'APROBADA' }
    });
    expect(approve.statusCode).toBe(200);

    const paid = await injectAs(app!, financeActor(), {
      method: 'PATCH',
      url: `/api/reports/finance/runs/${TEST_IDS.payrollRun}/status`,
      payload: { status: 'PAGADA' }
    });
    expect(paid.statusCode).toBe(200);
  });

  it('allows finance.workflow cancellation and blocks direccion workflow', async () => {
    const directionWorkflow = await injectAs(app!, directionActor(), {
      method: 'PATCH',
      url: `/api/reports/finance/runs/${TEST_IDS.payrollRun}/status`,
      payload: { status: 'CANCELADA' }
    });
    expect(directionWorkflow.statusCode).toBe(403);

    const financeCancel = await injectAs(app!, financeActor(), {
      method: 'PATCH',
      url: `/api/reports/finance/runs/${TEST_IDS.payrollRun}/status`,
      payload: { status: 'CANCELADA' }
    });
    expect(financeCancel.statusCode).toBe(200);
  });

  it('keeps payroll.finalize separate from payroll.preview and finance workflow', async () => {
    const financeFinalize = await injectAs(app!, financeActor(), {
      method: 'POST',
      url: '/api/payroll/runs',
      payload: payrollInput()
    });
    expect(financeFinalize.statusCode).toBe(403);

    const coordinatorFinalize = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/payroll/runs',
      payload: payrollInput()
    });
    expect(coordinatorFinalize.statusCode).toBe(403);
  });
});
