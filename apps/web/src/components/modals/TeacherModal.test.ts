import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { CoordinationOption, TeacherPayload } from '../../api';
import TeacherModal from './TeacherModal.vue';

function teacherForm(overrides: Partial<TeacherPayload> = {}): TeacherPayload {
  return {
    firstNames: 'Docente',
    paternalLastName: 'Prueba',
    maternalLastName: 'QA',
    degree: 'Licenciatura',
    paymentType: '',
    category: 'N',
    location: 'Local',
    comment: 'Docente activo',
    observation: '',
    coordinationId: 'coord-idiomas',
    coordinationName: 'Idiomas',
    phone: '',
    email: '',
    rfc: '',
    externalIdentifier: 'QA-001',
    bankDetail: '',
    status: 'ACTIVO',
    ...overrides
  };
}

const coordinations: CoordinationOption[] = [{ id: 'coord-idiomas', name: 'Idiomas' }];

function mountTeacherModal(props: Partial<InstanceType<typeof TeacherModal>['$props']> = {}) {
  return mount(TeacherModal, {
    props: {
      show: true,
      isEditing: false,
      saving: false,
      uploading: false,
      form: teacherForm(),
      coordinations,
      canChooseCoordination: false,
      currentCoordinatorName: 'Idiomas',
      canManageFiscal: false,
      canViewFiscalDocuments: false,
      canManageFiscalDocuments: false,
      selectedConstancia: null,
      ...props
    }
  });
}

describe('TeacherModal permission visibility', () => {
  it('hides fiscal and financial fields from users without fiscal.manage', () => {
    const wrapper = mountTeacherModal();
    const text = wrapper.text();

    expect(text).not.toContain('Tipo de pago');
    expect(text).not.toContain('RFC');
    expect(text).not.toContain('Banco / cuenta');
    expect(text).not.toContain('Correo');
    expect(text).toContain('Los datos fiscales y financieros son gestionados por RH, Finanzas o Admin.');
  });

  it('shows fiscal and financial fields to users with fiscal.manage', () => {
    const wrapper = mountTeacherModal({
      canManageFiscal: true,
      form: teacherForm({ paymentType: '1', email: 'qa.docente@tecplayacar.edu.mx' })
    });
    const text = wrapper.text();

    expect(text).toContain('Tipo de pago');
    expect(text).toContain('RFC');
    expect(text).toContain('Banco / cuenta');
    expect(text).toContain('Correo');
    expect(text).not.toContain('Los datos fiscales y financieros son gestionados por RH, Finanzas o Admin.');
  });

  it('assigns operational owner as read-only for non-admin captures', () => {
    const wrapper = mountTeacherModal({
      canChooseCoordination: false,
      currentCoordinatorName: 'ADETUR'
    });

    const responsibleInput = wrapper.find('input[disabled]');
    expect(wrapper.text()).toContain('Responsable operativo');
    expect(responsibleInput.exists()).toBe(true);
    expect((responsibleInput.element as HTMLInputElement).value).toBe('Idiomas');
    expect(wrapper.text()).toContain('Se asigna automaticamente al responsable operativo permitido.');
  });

  it('shows document upload only when editing and fiscal.document.manage is present', () => {
    const hidden = mountTeacherModal({
      isEditing: true,
      canManageFiscalDocuments: false
    });
    expect(hidden.text()).not.toContain('Constancia fiscal');

    const visible = mountTeacherModal({
      isEditing: true,
      canManageFiscalDocuments: true
    });
    expect(visible.text()).toContain('Constancia fiscal');
  });
});
