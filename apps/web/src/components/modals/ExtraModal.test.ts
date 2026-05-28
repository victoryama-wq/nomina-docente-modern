import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { CoordinationOption, CycleOption, ExtraPayload, ExtraTeacher, TabulatorOption } from '../../api';
import ExtraModal from './ExtraModal.vue';

const activeCycle: CycleOption = {
  id: 'cycle-qa',
  periodLabel: 'H02H03 QA',
  quarterCode: 'QA',
  module1Start: '2026-05-01',
  module1End: '2026-05-31',
  module2Start: '2026-06-01',
  module2End: '2026-06-30',
  status: 'ACTIVO'
};

const coordinations: CoordinationOption[] = [
  { id: 'coord-idiomas', name: 'Idiomas' },
  { id: 'coord-adetur', name: 'ADETUR' }
];

const teacher: ExtraTeacher = {
  id: 'teacher-qa',
  fullName: 'Docente QA',
  category: 'N',
  status: 'ACTIVO',
  coordinationId: 'coord-idiomas',
  coordinationName: 'Idiomas',
  maxHours: 15,
  suggestedTabulatorAmount: '100.00',
  scheduleWeekHours: 4,
  scheduleMod1Hours: 4,
  scheduleMod2Hours: 0,
  incidenceExtraHours: 0,
  loggedExtraHours: 0,
  extraHours: 0,
  totalWeekHours: 4,
  totalMod1Hours: 4,
  totalMod2Hours: 0,
  loadStatus: 'DISPONIBLE'
};

const tabulators: TabulatorOption[] = [{ id: 'tab-qa', name: 'Tabulador QA', amount: '100.00', sortOrder: 1 }];

function extraForm(): ExtraPayload {
  return {
    cycleId: activeCycle.id,
    coordinationId: 'coord-idiomas',
    teacherId: teacher.id,
    hours: 1,
    tabulatorId: 'tab-qa',
    tabulatorAmount: 100,
    reason: 'Actividad QA',
    activityDate: '2026-05-20',
    reference: 'QA',
    observations: ''
  };
}

function mountExtraModal(isAdmin: boolean) {
  return mount(ExtraModal, {
    props: {
      show: true,
      isEditing: false,
      saving: false,
      isAdmin,
      form: extraForm(),
      teacherSearchText: 'Docente QA',
      teacherPickerOpen: false,
      filteredTeacherOptions: [teacher],
      coordinations,
      currentCoordinatorName: 'Idiomas',
      cycles: [activeCycle],
      activeCycle,
      tabulators,
      selectedTeacher: teacher,
      projection: { weekFinal: 5, mod1Final: 5, mod2Final: 0, maxHours: 15 },
      overallLoadClass: 'ok',
      formError: ''
    }
  });
}

describe('ExtraModal coordination visibility', () => {
  it('shows a coordination selector for Admin but read-only operational owner for non-admin users', () => {
    const admin = mountExtraModal(true);
    expect(admin.text()).toContain('Selecciona responsable/ambito');

    const coordinator = mountExtraModal(false);
    const disabledInputs = coordinator.findAll('input[disabled]');
    expect(coordinator.text()).toContain('Responsable operativo');
    expect(disabledInputs.some((input) => (input.element as HTMLInputElement).value === 'Idiomas')).toBe(true);
  });
});
