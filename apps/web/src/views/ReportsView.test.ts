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
  fetchOperationalCategoryHoursReport,
  fetchOperationalReportCycles,
  fetchOperationalReportPayrollPeriods
} from '../api';
import type { SessionUser } from '../api';

vi.mock('../api', () => ({
  fetchOperationalBaseExtraReport: vi.fn(),
  downloadOperationalBaseExtraReport: vi.fn(),
  fetchOperationalCategoryHoursReport: vi.fn(),
  downloadOperationalCategoryHoursReport: vi.fn(),
  fetchOperationalReportCycles: vi.fn(),
  fetchOperationalReportPayrollPeriods: vi.fn()
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
    vi.mocked(fetchOperationalReportCycles).mockResolvedValue({
      cycles: [
        {
          id: 'cycle-1',
          label: 'Mayo - Agosto 2026 / ACTIVO',
          status: 'ACTIVO',
          quarterCode: '2026-3',
          periodLabel: 'Mayo - Agosto 2026'
        }
      ]
    });
    vi.mocked(fetchOperationalReportPayrollPeriods).mockResolvedValue({
      periods: [
        {
          calendarConfigId: 'calendar-1',
          payrollRunId: 'run-1',
          label: '2026-05-15 a 2026-05-28 - PAGADA',
          payrollStart: '2026-05-15',
          payrollEnd: '2026-05-28',
          status: 'PAGADA'
        }
      ]
    });
  });

  it('shows both operational report tabs to Admin and Direccion', () => {
    const admin = mountReports(adminSession());
    expect(admin.find('[data-testid="tab-base-extra"]').exists()).toBe(true);
    expect(admin.find('[data-testid="tab-category-hours"]').exists()).toBe(true);

    const direction = mountReports(directionSession());
    expect(direction.find('[data-testid="tab-base-extra"]').exists()).toBe(true);
    expect(direction.find('[data-testid="tab-category-hours"]').exists()).toBe(true);
  });

  it('shows both tabs to Coordinador and blocks RH', () => {
    const coordinator = mountReports(coordinatorSession());
    expect(coordinator.find('[data-testid="tab-base-extra"]').exists()).toBe(true);
    expect(coordinator.find('[data-testid="tab-category-hours"]').exists()).toBe(true);

    const rh = mountReports(rhSession());
    expect(rh.find('[data-testid="reports-denied"]').exists()).toBe(true);
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
          scheduleResponsibleEmail: 'responsable@tecplayacar.edu.mx',
          scheduleResponsibleName: 'Responsable QA',
          baseHours: '15.00',
          absences: '1.00',
          delays: '2.00',
          delayDiscountHours: '1.00',
          netBaseHours: '13.00',
          incidenceExtraHours: '1.00',
          externalExtraHours: '2.00',
          totalExtraHours: '3.00',
          teacherFortnightHours: '16.00',
          fortnightLimit: '30.00',
          overloadStatus: 'normal',
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
    await flushPromises();

    await wrapper.find('[data-testid="base-extra-period-select"]').setValue('calendar-1');
    await wrapper.find('[data-testid="base-extra-query"]').trigger('click');
    await flushPromises();

    expect(fetchOperationalBaseExtraReport).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: 'cycle-1',
      calendarConfigId: 'calendar-1',
      source: 'auto'
    }));
    expect(wrapper.text()).toContain('Docente Alvarez');
    expect(wrapper.text()).toContain('Actividad QA');
    expect(wrapper.text()).toContain('Responsable QA');
    expect(wrapper.text()).toContain('Horas base de la quincena');

    await wrapper.find('[data-testid="base-extra-export-csv"]').trigger('click');
    await wrapper.find('[data-testid="base-extra-export-xlsx"]').trigger('click');

    expect(downloadOperationalBaseExtraReport).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: 'cycle-1',
      calendarConfigId: 'calendar-1',
      source: 'auto'
    }), 'csv');
    expect(downloadOperationalBaseExtraReport).toHaveBeenCalledWith(expect.objectContaining({
      cycleId: 'cycle-1',
      calendarConfigId: 'calendar-1',
      source: 'auto'
    }), 'xlsx');
  });

  it('renders friendly filters instead of technical ID fields', async () => {
    const wrapper = mountReports(adminSession());
    await flushPromises();

    expect(wrapper.text()).toContain('Ciclo / cuatrimestre');
    expect(wrapper.text()).toContain('Quincena de nomina');
    expect(wrapper.text()).toContain('Busqueda general');
    expect(wrapper.text()).toContain('Mayo - Agosto 2026 / ACTIVO');
    const filterLabels = wrapper.findAll('.filter-grid label').map((label) => label.text()).join(' ');
    expect(filterLabels).not.toContain('Ciclo ID');
    expect(filterLabels).not.toContain('Docente ID');
    expect(filterLabels).not.toContain('Coordinacion ID');
    expect(filterLabels).not.toContain('Capturador ID');
    expect(filterLabels).not.toContain('Origen');
    expect(filterLabels).not.toContain('Desde');
    expect(filterLabels).not.toContain('Hasta');
    expect(wrapper.text()).not.toContain('Consulta viva del ciclo');
  });

  it('requires a payroll period for base-extra queries and exports', async () => {
    const wrapper = mountReports(adminSession());
    await flushPromises();

    await wrapper.find('[data-testid="base-extra-query"]').trigger('click');
    expect(wrapper.text()).toContain('Selecciona la quincena');
    expect(fetchOperationalBaseExtraReport).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="base-extra-export-csv"]').trigger('click');
    expect(downloadOperationalBaseExtraReport).not.toHaveBeenCalled();
  });

  it('applies general search to base-extra query and exports', async () => {
    const wrapper = mountReports(adminSession());
    await flushPromises();

    await wrapper.find('[data-testid="base-extra-period-select"]').setValue('calendar-1');
    await wrapper.find('[data-testid="base-extra-search"]').setValue('Idiomas');
    await wrapper.find('[data-testid="base-extra-query"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="base-extra-export-csv"]').trigger('click');

    expect(fetchOperationalBaseExtraReport).toHaveBeenCalledWith(expect.objectContaining({ q: 'Idiomas' }));
    expect(downloadOperationalBaseExtraReport).toHaveBeenCalledWith(expect.objectContaining({ q: 'Idiomas' }), 'csv');
  });

  it('requires cycle selection for category-hours and then loads rows with exports', async () => {
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
          coordinationName: 'Idiomas; Sistemas',
          coordinationBreakdown: 'Idiomas: 20.00 h; Sistemas: 10.00 h'
        }
      ]
    });
    const wrapper = mountReports(coordinatorSession());
    await flushPromises();
    await wrapper.find('[data-testid="tab-category-hours"]').trigger('click');
    await wrapper.find('[data-testid="category-cycle-select"]').setValue('');

    await wrapper.find('[data-testid="category-hours-query"]').trigger('click');
    expect(wrapper.text()).toContain('Selecciona un ciclo');

    await wrapper.find('[data-testid="category-cycle-select"]').setValue('cycle-1');
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
