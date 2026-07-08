import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accountingSession,
  accountantSession,
  adminSession,
  coordinatorSession,
  directionSession,
  financeSession,
  rhSession
} from '../test/fixtures/session-users';
import { useAuthStore } from '../stores/auth';
import ReportsView from './ReportsView.vue';
import {
  downloadOperationalBaseExtraReport,
  downloadOperationalCategoryHoursReport,
  fetchOperationalBaseExtraReport,
  fetchOperationalCategoryHoursReport
} from '../api';
import type { SessionUser } from '../api';

vi.mock('../api', () => ({
  fetchOperationalBaseExtraReport: vi.fn(),
  downloadOperationalBaseExtraReport: vi.fn(),
  fetchOperationalCategoryHoursReport: vi.fn(),
  downloadOperationalCategoryHoursReport: vi.fn()
}));

function mountReports(session: SessionUser) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.session = session;
  auth.firebaseUser = { uid: 'qa-firebase-user' } as typeof auth.firebaseUser;

  return mount(ReportsView, {
    global: {
      plugins: [pinia]
    }
  });
}

describe('ReportsView H18 frontend permissions and interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOperationalBaseExtraReport).mockResolvedValue({
      meta: {
        source: 'live',
        cycleId: 'cycle-1',
        cycleLabel: '2026-3',
        calendarConfigId: 'calendar-1',
        periodLabel: 'Mayo 15-28'
      },
      rows: []
    });
    vi.mocked(fetchOperationalCategoryHoursReport).mockResolvedValue({
      meta: { cycleId: 'cycle-1', coordinatorScope: null },
      rows: []
    });
    vi.mocked(downloadOperationalBaseExtraReport).mockResolvedValue(undefined);
    vi.mocked(downloadOperationalCategoryHoursReport).mockResolvedValue(undefined);
  });

  it('shows both operational report tabs to Admin and Direccion', () => {
    const admin = mountReports(adminSession());
    expect(admin.find('[data-testid="tab-base-extra"]').exists()).toBe(true);
    expect(admin.find('[data-testid="tab-category-hours"]').exists()).toBe(true);

    const direction = mountReports(directionSession());
    expect(direction.find('[data-testid="tab-base-extra"]').exists()).toBe(true);
    expect(direction.find('[data-testid="tab-category-hours"]').exists()).toBe(true);
  });

  it('shows only category-hours to Coordinador and RH', () => {
    const coordinator = mountReports(coordinatorSession());
    expect(coordinator.find('[data-testid="tab-base-extra"]').exists()).toBe(false);
    expect(coordinator.find('[data-testid="tab-category-hours"]').exists()).toBe(true);
    expect(coordinator.find('[data-testid="category-hours-panel"]').exists()).toBe(true);

    const rh = mountReports(rhSession());
    expect(rh.find('[data-testid="tab-base-extra"]').exists()).toBe(false);
    expect(rh.find('[data-testid="tab-category-hours"]').exists()).toBe(true);
  });

  it('blocks Finanzas, Contador and Contabilidad from the operational reports module', () => {
    expect(mountReports(financeSession()).find('[data-testid="reports-denied"]').exists()).toBe(true);
    expect(mountReports(accountantSession()).find('[data-testid="reports-denied"]').exists()).toBe(true);
    expect(mountReports(accountingSession()).find('[data-testid="reports-denied"]').exists()).toBe(true);
  });

  it('loads base-extra rows and delegates CSV/XLSX downloads to the API', async () => {
    vi.mocked(fetchOperationalBaseExtraReport).mockResolvedValueOnce({
      meta: {
        source: 'live',
        cycleId: 'cycle-1',
        cycleLabel: '2026-3',
        calendarConfigId: 'calendar-1',
        periodLabel: 'Mayo 15-28'
      },
      rows: [
        {
          source: 'live',
          cycleId: 'cycle-1',
          cycleLabel: '2026-3',
          calendarConfigId: 'calendar-1',
          periodLabel: 'Mayo 15-28',
          teacherId: 'teacher-1',
          teacherName: 'Docente Alvarez',
          category: 'N',
          categoryLabel: 'Nuevo ingreso',
          coordinationId: 'coord-1',
          coordinationName: 'Idiomas',
          baseHours: '15.00',
          incidenceExtraHours: '1.00',
          externalExtraHours: '2.00',
          totalExtraHours: '3.00',
          externalExtraCapturedByEmail: 'captura@tecplayacar.edu.mx',
          externalExtraCapturedByName: 'Captura QA',
          incidenceUpdatedByEmail: 'incidencia@tecplayacar.edu.mx',
          incidenceUpdatedByName: 'Incidencia QA',
          reason: 'Actividad QA',
          activityDate: '2026-05-20'
        }
      ]
    });
    const wrapper = mountReports(adminSession());

    await wrapper.find('[data-testid="base-extra-query"]').trigger('click');
    await flushPromises();

    expect(fetchOperationalBaseExtraReport).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Docente Alvarez');
    expect(wrapper.text()).toContain('Actividad QA');

    await wrapper.find('[data-testid="base-extra-export-csv"]').trigger('click');
    await wrapper.find('[data-testid="base-extra-export-xlsx"]').trigger('click');

    expect(downloadOperationalBaseExtraReport).toHaveBeenCalledWith(expect.any(Object), 'csv');
    expect(downloadOperationalBaseExtraReport).toHaveBeenCalledWith(expect.any(Object), 'xlsx');
  });

  it('requires cycleId for category-hours and then loads rows with exports', async () => {
    vi.mocked(fetchOperationalCategoryHoursReport).mockResolvedValueOnce({
      meta: { cycleId: 'cycle-1', coordinatorScope: ['coord-1'] },
      rows: [
        {
          cycleId: 'cycle-1',
          cycleLabel: '2026-3',
          teacherId: 'teacher-2',
          teacherName: 'Docente Munoz',
          category: 'V',
          categoryLabel: 'VIP',
          expectedHours: '35.00',
          assignedHours: '30.00',
          remainingHours: '5.00',
          status: 'faltante',
          hoursLv: '25.00',
          hoursModule1: '30.00',
          hoursModule2: '25.00',
          coordinationId: 'coord-1',
          coordinationName: 'Idiomas'
        }
      ]
    });
    const wrapper = mountReports(coordinatorSession());

    await wrapper.find('[data-testid="category-hours-query"]').trigger('click');
    expect(wrapper.text()).toContain('Captura el ID del ciclo');

    await wrapper.find('[data-testid="category-cycle-id"]').setValue('cycle-1');
    await wrapper.find('[data-testid="category-hours-query"]').trigger('click');
    await flushPromises();

    expect(fetchOperationalCategoryHoursReport).toHaveBeenCalledWith(expect.objectContaining({ cycleId: 'cycle-1' }));
    expect(wrapper.text()).toContain('Docente Munoz');
    expect(wrapper.text()).toContain('Faltante');

    await wrapper.find('[data-testid="category-hours-export-csv"]').trigger('click');
    await wrapper.find('[data-testid="category-hours-export-xlsx"]').trigger('click');

    expect(downloadOperationalCategoryHoursReport).toHaveBeenCalledWith(expect.objectContaining({ cycleId: 'cycle-1' }), 'csv');
    expect(downloadOperationalCategoryHoursReport).toHaveBeenCalledWith(expect.objectContaining({ cycleId: 'cycle-1' }), 'xlsx');
  });
});
