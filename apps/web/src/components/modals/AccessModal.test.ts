import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { RoleOption, UserPayload } from '../../api';
import AccessModal from './AccessModal.vue';

const roles: RoleOption[] = [
  { id: 'role-admin', code: 'admin', name: 'Admin', description: 'Admin global' },
  { id: 'role-coordinador', code: 'coordinador', name: 'Coordinador', description: 'Captura operativa' },
  { id: 'role-direccion', code: 'direccion', name: 'Direccion/Subdireccion', description: 'Direccion' },
  { id: 'role-rh', code: 'rh', name: 'RH', description: 'Recursos Humanos' },
  { id: 'role-finanzas', code: 'finanzas', name: 'Finanzas', description: 'Finanzas' },
  { id: 'role-contador', code: 'contador', name: 'Contador', description: 'Contador' },
  { id: 'role-contabilidad', code: 'contabilidad', name: 'Contabilidad', description: 'Contabilidad' }
];

function userForm(overrides: Partial<UserPayload> = {}): UserPayload {
  return {
    email: 'qa.usuario@tecplayacar.edu.mx',
    displayName: 'Usuario QA',
    roleCode: 'coordinador',
    status: 'ACTIVO',
    notes: '',
    legacyUsername: '',
    coordinationIds: [],
    ...overrides
  };
}

function mountAccessModal(form: UserPayload = userForm()) {
  return mount(AccessModal, {
    props: {
      show: true,
      isEditing: false,
      saving: false,
      form,
      roles,
      coordinations: [
        { id: 'coord-idiomas', name: 'Idiomas' },
        { id: 'coord-adetur', name: 'ADETUR' }
      ]
    }
  });
}

describe('AccessModal role scope messaging', () => {
  it('does not render manual coordination checkboxes in the current role/capturer flow', () => {
    const wrapper = mountAccessModal();

    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0);
    expect(wrapper.text()).toContain('El alcance operativo se toma del usuario capturador.');
  });

  it('explains that global and non-operational roles do not require operational coordination', async () => {
    const wrapper = mountAccessModal(userForm({ roleCode: 'admin' }));
    expect(wrapper.text()).toContain('Admin conserva alcance global.');

    await wrapper.setProps({ form: userForm({ roleCode: 'finanzas' }) });
    expect(wrapper.text()).toContain('Este rol no requiere alcance operativo para capturar Horarios, Incidencias o Extras.');

    await wrapper.setProps({ form: userForm({ roleCode: 'direccion' }) });
    expect(wrapper.text()).toContain('Direccion/Subdireccion opera por rol y por registros propios cuando aplique.');
  });
});
