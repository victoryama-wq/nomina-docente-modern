import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchIncidencesContext,
  updateIncidence,
  updateIncidencesBatch,
  type CycleOption,
  type IncidenceSchedule
} from '../api';
import { useAuthStore } from '../stores/auth';
import { coordinatorSession, WEB_COORDINATIONS } from '../test/fixtures/session-users';
import IncidencesView from './IncidencesView.vue';

vi.mock('../api', () => ({
  fetchIncidencesContext: vi.fn(),
  updateIncidence: vi.fn(),
  updateIncidencesBatch: vi.fn()
}));

const cycle: CycleOption = {
  id: '30000000-0000-4000-8000-000000000032',
  periodLabel: 'Septiembre - Diciembre 2026',
  quarterCode: '27-1',
  baseHoursStartDate: '2026-08-31',
  baseHoursEndDate: '2026-12-12',
  module1Start: '2026-08-31',
  module1End: '2026-09-17',
  module2Start: '2026-10-24',
  module2End: '2026-12-05',
  status: 'ACTIVO'
};

const schedule: IncidenceSchedule = {
  id: '50000000-0000-4000-8000-000000000032',
  cycleId: cycle.id,
  periodLabel: cycle.periodLabel,
  quarterCode: cycle.quarterCode,
  cycleStatus: 'ACTIVO',
  calendarConfigId: '30000000-0000-4000-8000-000000000034',
  calendarPeriodLabel: 'H23 Propedeutico Ago 10-22',
  payrollLocked: false,
  accessStartAt: new Date(Date.now() - 86_400_000).toISOString(),
  accessEndAt: new Date(Date.now() + 86_400_000).toISOString(),
  accessStatus: 'ABIERTO',
  accessOpen: true,
  coordinationId: WEB_COORDINATIONS.idiomas.id,
  coordinationName: WEB_COORDINATIONS.idiomas.name,
  teacherId: '40000000-0000-4000-8000-000000000001',
  teacherName: 'Docente QA Idiomas Uno',
  teacherCategory: 'N',
  subjectName: 'H23 QA Vigencia Temporal',
  groupCode: 'H23-27-1',
  tabulatorName: 'H04 QA Tabulador 100',
  tabulatorAmount: '100.00',
  weekHours: 3,
  mod1Hours: 6,
  mod2Hours: 10,
  baseHours: 10,
  absences: 1,
  delays: 2,
  extraHoursInSchedule: 3,
  incidenceUpdatedAt: null,
  incidenceUpdatedByEmail: '',
  hasEligibleOccurrences: false,
  eligibilityMessage: 'Este horario no tiene clases pagables dentro de la quincena seleccionada.',
  canEdit: false
};

function mountView() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.session = coordinatorSession();
  auth.firebaseUser = { uid: 'qa-firebase-user' } as typeof auth.firebaseUser;
  return mount(IncidencesView, { global: { plugins: [pinia] } });
}

describe('IncidencesView H23 temporal eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchIncidencesContext).mockResolvedValue({
      activeCycle: cycle,
      cycles: [cycle],
      calendarPeriods: [
        {
          id: schedule.calendarConfigId,
          cycleId: cycle.id,
          periodLabel: schedule.calendarPeriodLabel,
          payrollStart: '2026-08-10',
          payrollEnd: '2026-08-22',
          accessStartAt: schedule.accessStartAt,
          accessEndAt: schedule.accessEndAt,
          accessStatus: 'ABIERTO',
          accessOpen: true,
          hasPayrollRun: false
        }
      ],
      activeCalendarPeriod: {
        id: schedule.calendarConfigId,
        cycleId: cycle.id,
        periodLabel: schedule.calendarPeriodLabel,
        payrollStart: '2026-08-10',
        payrollEnd: '2026-08-22',
        accessStartAt: schedule.accessStartAt,
        accessEndAt: schedule.accessEndAt,
        accessStatus: 'ABIERTO',
        accessOpen: true,
        hasPayrollRun: false
      },
      actorCoordination: WEB_COORDINATIONS.idiomas,
      schedules: [schedule],
      summary: {
        total: 1,
        teachers: 1,
        editable: 0,
        withIncidences: 1,
        absences: 1,
        delays: 2,
        extraHoursInSchedule: 3
      }
    });
  });

  it('keeps an ineligible row visible, explains the block and disables all incidence inputs', async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Docente QA Idiomas Uno');
    expect(wrapper.text()).toContain('Fuera de vigencia');
    expect(wrapper.text()).toContain('Este horario no tiene clases pagables dentro de la quincena seleccionada.');
    const inputs = wrapper.findAll('.incidence-table .inline-number');
    expect(inputs).toHaveLength(3);
    expect(inputs.every((input) => input.attributes('disabled') !== undefined)).toBe(true);
    expect(updateIncidence).not.toHaveBeenCalled();
    expect(updateIncidencesBatch).not.toHaveBeenCalled();
  });
});
