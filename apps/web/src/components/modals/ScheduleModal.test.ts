import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type {
  CycleOption,
  SchedulePayload,
  ScheduleResponsibleOption,
  ScheduleTeacher,
  SubjectOption,
  TabulatorOption
} from '../../api';
import ScheduleModal from './ScheduleModal.vue';

const activeCycle: CycleOption = {
  id: 'cycle-qa',
  periodLabel: 'H02H03 QA',
  quarterCode: 'QA',
  baseHoursStartDate: '2026-05-01',
  baseHoursEndDate: '2026-06-30',
  module1Start: '2026-05-01',
  module1End: '2026-05-31',
  module2Start: '2026-06-01',
  module2End: '2026-06-30',
  status: 'ACTIVO'
};

const responsibles: ScheduleResponsibleOption[] = [
  {
    id: 'user-coord-idiomas',
    name: 'QA Coordinador Idiomas',
    email: 'qa.coordinador.idiomas@tecplayacar.edu.mx',
    responsibleUserId: 'user-coord-idiomas',
    primaryCoordinationId: 'coord-idiomas',
    primaryCoordinationName: 'Idiomas',
    hasTechnicalScope: true
  },
  {
    id: 'user-coord-no-scope',
    name: 'QA Coordinador Sin Coordinacion',
    email: 'qa.coordinador.sin.coordinacion@tecplayacar.edu.mx',
    responsibleUserId: 'user-coord-no-scope',
    primaryCoordinationId: null,
    primaryCoordinationName: '',
    hasTechnicalScope: false
  }
];

const teacher: ScheduleTeacher = {
  id: 'teacher-qa',
  fullName: 'Docente QA',
  category: 'N',
  status: 'ACTIVO',
  coordinationId: 'coord-idiomas',
  coordinationName: 'Idiomas',
  maxHours: 15,
  currentWeekHours: 4,
  currentS1Hours: 0,
  currentS2Hours: 0,
  currentMod1Hours: 4,
  currentMod2Hours: 0
};

const subjects: SubjectOption[] = [{ id: 'subject-qa', officialCode: 'QA-01', name: 'Asignatura QA', status: 'ACTIVO' }];
const tabulators: TabulatorOption[] = [{ id: 'tab-qa', name: 'Tabulador QA', amount: '100.00', sortOrder: 1 }];

function scheduleForm(): SchedulePayload {
  return {
    cycleId: activeCycle.id,
    teacherId: teacher.id,
    responsibleUserId: 'user-coord-idiomas',
    coordinationId: 'coord-idiomas',
    coordinationName: 'Idiomas',
    subjectId: 'subject-qa',
    groupCode: 'QA-1',
    tabulatorId: 'tab-qa',
    tabulatorName: 'Tabulador QA',
    tabulatorAmount: 100,
    hoursL: 1,
    hoursM: 1,
    hoursX: 1,
    hoursJ: 1,
    hoursV: 0,
    hoursS1: 0,
    hoursS2: 0
  };
}

function mountScheduleModal(isAdmin: boolean) {
  return mount(ScheduleModal, {
    props: {
      show: true,
      isEditing: false,
      saving: false,
      isAdmin,
      form: scheduleForm(),
      teacherSearchText: 'Docente QA',
      teacherPickerOpen: false,
      subjectSearchText: 'Asignatura QA / QA-01',
      subjectPickerOpen: false,
      filteredTeacherOptions: [teacher],
      responsibles,
      currentCoordinatorName: 'Idiomas',
      cycles: [activeCycle],
      activeCycle,
      subjects,
      tabulators,
      selectedTeacher: teacher,
      projection: { weekFinal: 8, mod1Final: 8, mod2Final: 0, maxHours: 15, exceeds: false },
      overallLoadClass: 'ok',
      formError: ''
    }
  });
}

describe('ScheduleModal coordination visibility', () => {
  it('shows a coordination selector for Admin but read-only operational owner for non-admin users', () => {
    const admin = mountScheduleModal(true);
    expect(admin.find('select[required]').exists()).toBe(true);
    expect(admin.text()).toContain('Selecciona responsable operativo');
    expect(admin.text()).toContain('QA Coordinador Idiomas');
    expect(admin.text()).toContain('QA Coordinador Sin Coordinacion');
    expect(admin.text()).not.toContain('ADETUR');

    const coordinator = mountScheduleModal(false);
    const disabledInputs = coordinator.findAll('input[disabled]');
    expect(coordinator.text()).toContain('Responsable operativo');
    expect(disabledInputs.some((input) => (input.element as HTMLInputElement).value === 'Idiomas')).toBe(true);
  });

  it('uses a catalog picker and emits the selected subject instead of accepting a free catalog name', async () => {
    const wrapper = mountScheduleModal(false);
    const inputs = wrapper.findAll('input');
    const subjectInput = inputs.find((input) => input.attributes('placeholder') === 'Buscar asignatura por nombre o clave');
    expect(subjectInput).toBeDefined();
    expect(wrapper.find('datalist#schedule-subjects').exists()).toBe(false);

    await subjectInput!.trigger('focus');
    expect(wrapper.emitted('focusSubjectSearch')).toHaveLength(1);
  });
});
