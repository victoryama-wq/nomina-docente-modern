import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activateAcademicCycle,
  closeAcademicCycle,
  createAcademicCycle,
  createCalendarPeriod,
  deleteCalendarPeriod,
  fetchCalendarContext,
  updateAcademicCycle,
  updateCalendarPeriod,
  updateCycleModuleDates,
  type CycleOption
} from '../api';
import { useAuthStore } from '../stores/auth';
import { adminSession } from '../test/fixtures/session-users';
import CalendarView from './CalendarView.vue';

vi.mock('../api', () => ({
  activateAcademicCycle: vi.fn(),
  closeAcademicCycle: vi.fn(),
  createAcademicCycle: vi.fn(),
  createCalendarPeriod: vi.fn(),
  deleteCalendarPeriod: vi.fn(),
  fetchCalendarContext: vi.fn(),
  updateAcademicCycle: vi.fn(),
  updateCalendarPeriod: vi.fn(),
  updateCycleModuleDates: vi.fn()
}));

const h23Cycle: CycleOption = {
  id: '30000000-0000-4000-8000-000000000032',
  periodLabel: 'Septiembre - Diciembre 2026',
  quarterCode: '27-1',
  baseHoursStartDate: '2026-08-31',
  baseHoursEndDate: '2026-12-12',
  module1Start: '2026-08-31',
  module1End: '2026-09-17',
  module2Start: '2026-10-24',
  module2End: '2026-12-05',
  status: 'PLANEACION',
  scheduleCount: 0,
  calendarPeriodCount: 0
};

function mountCalendar() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.session = {
    ...adminSession(),
    permissions: [...adminSession().permissions, 'calendar.manage']
  };
  auth.firebaseUser = { uid: 'qa-firebase-user' } as typeof auth.firebaseUser;

  return mount(CalendarView, { global: { plugins: [pinia] } });
}

describe('CalendarView H23 base-hours configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCalendarContext).mockResolvedValue({
      activeCycle: h23Cycle,
      cycles: [h23Cycle],
      periods: []
    });
    vi.mocked(updateCycleModuleDates).mockResolvedValue({
      activeCycle: h23Cycle,
      message: 'Vigencia pagable y fechas modulares actualizadas correctamente.'
    });
    vi.mocked(createAcademicCycle).mockResolvedValue({ cycle: h23Cycle, message: 'Ciclo creado.' });
    vi.mocked(updateAcademicCycle).mockResolvedValue({ cycle: h23Cycle, message: 'Ciclo actualizado.' });
    vi.mocked(activateAcademicCycle).mockResolvedValue({ activeCycle: h23Cycle, message: 'Ciclo activado.' });
    vi.mocked(closeAcademicCycle).mockResolvedValue({} as never);
    vi.mocked(createCalendarPeriod).mockResolvedValue({} as never);
    vi.mocked(updateCalendarPeriod).mockResolvedValue({} as never);
    vi.mocked(deleteCalendarPeriod).mockResolvedValue({} as never);
  });

  it('shows the dedicated labels, help text and existing dates', async () => {
    const wrapper = mountCalendar();
    await flushPromises();

    expect(wrapper.text()).toContain('Vigencia pagable de horas base');
    expect(wrapper.text()).toContain('Inicio de horas base');
    expect(wrapper.text()).toContain('Fin de horas base');
    expect(wrapper.text()).toContain('Define el periodo inclusivo');
    expect(wrapper.text()).toContain('M1 y M2 deben quedar dentro de esta vigencia.');
    expect((wrapper.get('[data-testid="module-base-hours-start"]').element as HTMLInputElement).value).toBe('2026-08-31');
    expect((wrapper.get('[data-testid="module-base-hours-end"]').element as HTMLInputElement).value).toBe('2026-12-12');
  });

  it('saves base-hours dates and modular dates through the existing Calendar endpoint', async () => {
    const wrapper = mountCalendar();
    await flushPromises();

    await wrapper.get('[data-testid="module-base-hours-start"]').setValue('2026-08-30');
    await wrapper.get('[data-testid="module-base-hours-end"]').setValue('2026-12-13');
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Guardar módulos'))!;
    await saveButton.trigger('click');
    await flushPromises();

    expect(updateCycleModuleDates).toHaveBeenCalledWith(h23Cycle.id, {
      baseHoursStartDate: '2026-08-30',
      baseHoursEndDate: '2026-12-13',
      module1Start: '2026-08-31',
      module1End: '2026-09-17',
      module2Start: '2026-10-24',
      module2End: '2026-12-05'
    });
  });

  it('shows a specific error when base-hours dates are inverted', async () => {
    const wrapper = mountCalendar();
    await flushPromises();

    await wrapper.get('[data-testid="module-base-hours-start"]').setValue('2026-12-13');
    await wrapper.get('[data-testid="module-base-hours-end"]').setValue('2026-12-12');
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Guardar módulos'))!;
    await saveButton.trigger('click');

    expect(wrapper.text()).toContain('El inicio de horas base debe ser menor o igual al fin.');
    expect(updateCycleModuleDates).not.toHaveBeenCalled();
  });

  it.each([
    ['module1Start', '2026-08-30', null, null, 'El módulo 1 debe quedar completamente dentro'],
    ['module1End', '2026-12-13', 'module2End', '2026-12-13', 'El módulo 1 debe quedar completamente dentro'],
    ['module2Start', '2026-08-30', null, null, 'El módulo 2 debe quedar completamente dentro'],
    ['module2End', '2026-12-13', null, null, 'El módulo 2 debe quedar completamente dentro']
  ])('validates %s against the base-hours period', async (field, value, companionField, companionValue, message) => {
    const wrapper = mountCalendar();
    await flushPromises();

    const inputs = wrapper.findAll('[data-testid="active-cycle-base-hours-section"] ~ .calendar-form-section input');
    const inputIndex: Record<string, number> = { module1Start: 0, module1End: 1, module2Start: 2, module2End: 3 };
    await inputs[inputIndex[field]].setValue(value);
    if (companionField && companionValue) {
      await inputs[inputIndex[companionField]].setValue(companionValue);
    }
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Guardar módulos'))!;
    await saveButton.trigger('click');

    expect(wrapper.text()).toContain(message);
    expect(updateCycleModuleDates).not.toHaveBeenCalled();
  });

  it('keeps base-hours, modules and capture windows as separate visual sections at target widths', async () => {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844]
    ]) {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
      const wrapper = mountCalendar();
      await flushPromises();

      expect(wrapper.find('[data-testid="active-cycle-base-hours-section"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Fechas modulares');
      expect(wrapper.text()).toContain('Ventanas de captura');
      wrapper.unmount();
    }
  });
});
