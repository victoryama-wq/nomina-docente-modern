import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinanceContext, SessionUser } from '../api';
import {
  accountingSession,
  accountantSession,
  coordinatorSession,
  directionSession,
  financeSession
} from '../test/fixtures/session-users';
import { useAuthStore } from '../stores/auth';
import FinanceReportsView from './FinanceReportsView.vue';
import { fetchFinanceContext } from '../api';

vi.mock('../api', () => ({
  fetchFinanceContext: vi.fn(),
  downloadFinanceExport: vi.fn(),
  downloadFinancePdf: vi.fn(),
  downloadCashReceipts: vi.fn(),
  updateFinanceRunStatus: vi.fn()
}));

const context: FinanceContext = {
  activeCycle: {
    id: 'cycle-1',
    periodLabel: 'Septiembre - Diciembre 2026',
    quarterCode: '27-1',
    baseHoursStartDate: '2026-08-31',
    baseHoursEndDate: '2026-12-12',
    module1Start: '2026-08-31',
    module1End: '2026-09-17',
    module2Start: '2026-10-24',
    module2End: '2026-12-05',
    status: 'ACTIVO'
  },
  cycles: [],
  actorCoordination: { id: 'coord-1', name: 'Idiomas' },
  runs: [],
  selectedRun: {
    id: 'run-1',
    cycleId: 'cycle-1',
    cycleLabel: 'Septiembre - Diciembre 2026 - 27-1',
    periodLabel: '2026-10-14 a 2026-10-28',
    status: 'CALCULADA',
    summary: {
      lines: 1,
      teachers: 1,
      coordinations: 1,
      baseHours: 20,
      grossBaseAmount: '2430.00',
      discountAmount: '0.00',
      totalExtraHours: 2,
      totalExtraAmount: '200.00',
      totalAmount: '2630.00',
      alerts: 0,
      fiscalPending: 0,
      readyPayments: 1
    },
    calculatedAt: '2026-10-26T12:00:00.000Z',
    calculatedByEmail: 'admin@tecplayacar.edu.mx',
    reviewedAt: null,
    reviewedByEmail: '',
    approvedAt: null,
    approvedByEmail: '',
    paidAt: null,
    paidByEmail: '',
    statusUpdatedAt: null,
    statusUpdatedByEmail: '',
    createdAt: '2026-10-26T12:00:00.000Z'
  },
  summary: {
    lines: 1,
    teachers: 1,
    coordinations: 1,
    baseHours: 20,
    grossBaseAmount: '2430.00',
    discountAmount: '0.00',
    totalExtraHours: 2,
    totalExtraAmount: '200.00',
    totalAmount: '2630.00',
    alerts: 0,
    fiscalPending: 0,
    readyPayments: 1
  },
  lines: [
    {
      id: 'line-1',
      lineKey: 'teacher-1:coord-1',
      teacherId: 'teacher-1',
      coordinationId: 'coord-1',
      teacherName: 'ABRAHAM ARELLANA ROSALES',
      coordinationName: 'Idiomas',
      paymentType: 'E',
      category: 'N',
      rfc: '',
      email: '',
      bankDetail: '',
      hasConstancia: false,
      baseHours: 20,
      grossBaseAmount: '2430.00',
      absences: 0,
      delays: 0,
      absenceDiscountAmount: '0.00',
      delayDiscountAmount: '0.00',
      baseNetAmount: '2430.00',
      scheduleExtraHours: 1,
      scheduleExtraAmount: '100.00',
      loggedExtraHours: 1,
      loggedExtraAmount: '100.00',
      totalExtraHours: 2,
      totalExtraAmount: '200.00',
      totalAmount: '2630.00',
      alerts: [],
      fiscalMissing: [],
      paymentStatus: 'LISTO'
    }
  ],
  coordinationSummary: [],
  scheduleDetails: [],
  extraDetails: []
};

function mountFinance(session: SessionUser) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.session = session;
  auth.firebaseUser = { uid: 'qa-firebase-user' } as typeof auth.firebaseUser;
  return mount(FinanceReportsView, { global: { plugins: [pinia] } });
}

describe('FinanceReportsView teacher identity visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchFinanceContext).mockResolvedValue(context);
  });

  it.each([
    ['Coordinador', coordinatorSession()],
    ['Direccion', directionSession()],
    ['Finanzas', financeSession()],
    ['Contador', accountantSession()],
    ['Contabilidad', accountingSession()]
  ])('shows the teacher name to %s', async (_label, session) => {
    const wrapper = mountFinance(session);
    await flushPromises();

    expect(wrapper.get('[data-testid="finance-teacher-name"]').text()).toContain('ABRAHAM ARELLANA ROSALES');
  });

  it('keeps fiscal columns hidden for coordinator while preserving the teacher name', async () => {
    const wrapper = mountFinance(coordinatorSession());
    await flushPromises();

    expect(wrapper.text()).toContain('ABRAHAM ARELLANA ROSALES');
    expect(wrapper.findAll('th').map((header) => header.text())).not.toContain('Fiscal');
    expect(wrapper.text()).not.toContain('RFC pendiente');
  });
});
