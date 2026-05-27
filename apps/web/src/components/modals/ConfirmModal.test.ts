import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ConfirmModal from './ConfirmModal.vue';

describe('ConfirmModal', () => {
  it('renders confirmation content and emits confirm', async () => {
    const wrapper = mount(ConfirmModal, {
      props: {
        show: true,
        title: 'Guardar nomina',
        message: 'Confirma la accion.',
        confirmLabel: 'Guardar'
      }
    });

    expect(wrapper.text()).toContain('Guardar nomina');
    expect(wrapper.text()).toContain('Confirma la accion.');

    await wrapper.find('button.primary-inline').trigger('click');

    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });
});
