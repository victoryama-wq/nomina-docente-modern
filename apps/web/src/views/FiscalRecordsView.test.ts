import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTeachers, updateTeacherFiscal, uploadTeacherConstancia, type SessionUser } from '../api';
import { useAuthStore } from '../stores/auth';
import { createSessionUser } from '../test/fixtures/session-users';
import FiscalRecordsView from './FiscalRecordsView.vue';

vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }));
vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), fetchTeachers: vi.fn(), updateTeacherFiscal: vi.fn(), uploadTeacherConstancia: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchTeachers).mockResolvedValue({ teachers: [{ id: 'teacher', fullName: 'Docente QA', status: 'ACTIVO', phone: '9981234567', rfc: '', email: '', bankDetail: '', documentId: null, paymentType: '1' }], summary: { total: 1, active: 1, inactive: 0, withRfc: 0, withBank: 0, withConstancia: 0, fiscalReady: 0 } } as Awaited<ReturnType<typeof fetchTeachers>>);
});

function open(role: SessionUser['role']) {
  const pinia = createPinia(); setActivePinia(pinia);
  useAuthStore().session = createSessionUser({ role, permissions: ['fiscal.view', 'fiscal.manage', 'fiscal.document.manage'] });
  return mount(FiscalRecordsView, { global: { plugins: [pinia], stubs: { TeacherDossierPanel: { props: ['teacherId','teacherName','show'], emits: ['phoneSaved'], template: '<div data-test="dossier">{{ teacherName }}</div>' } } } });
}

describe('H24 fiscal module entry and regression', () => {
  it('keeps the constancia modal file-only and never calls the fiscal patch', async () => {
    const wrapper = open('admin'); await flushPromises();
    await wrapper.findAll('button').find(b => b.text() === 'Actualizar constancia')!.trigger('click');
    const form = wrapper.get('form');
    expect(form.find('input[type=email]').exists()).toBe(false);
    expect(form.find('select').exists()).toBe(false);
    expect(form.text()).toContain('elimina definitivamente');
    const file = form.get('input[type=file]');
    Object.defineProperty(file.element, 'files', { value: [new File(['%PDF'], 'test.pdf', { type: 'application/pdf' })] });
    await file.trigger('change');
    vi.mocked(uploadTeacherConstancia).mockResolvedValue({ teacher: {} as never, message: 'Constancia guardada' });
    await form.trigger('submit');
    await vi.waitFor(() => expect(uploadTeacherConstancia).toHaveBeenCalled());
    expect(updateTeacherFiscal).not.toHaveBeenCalled();
    expect(uploadTeacherConstancia).toHaveBeenCalledWith('teacher', expect.objectContaining({ fileName: 'test.pdf', mimeType: 'application/pdf' }));
    wrapper.unmount();
  });
  it('shows replacement only with document permission, not fiscal edit alone', async () => {
    const wrapper = open('rh');
    useAuthStore().session = createSessionUser({ role: 'rh', permissions: ['fiscal.view', 'fiscal.manage'] });
    await flushPromises();
    expect(wrapper.text()).not.toContain('Actualizar constancia');
    expect(wrapper.find('[aria-label="Abrir expediente de Docente QA"]').exists()).toBe(true);
    wrapper.unmount();
  });
  it.each(['admin', 'finanzas', 'rh'] as const)('%s opens the new eye panel without changing constancia or fiscal completion', async role => {
    const wrapper = open(role); await flushPromises();
    expect(wrapper.text()).toContain('0% completo');
    expect(wrapper.findAll('th').map(h => h.text())).toEqual(['Docente','Avance fiscal','Nacimiento','Pago','Constancia','Expediente']);
    await wrapper.get('[aria-label="Abrir expediente de Docente QA"]').trigger('click');
    expect(wrapper.get('[data-test=dossier]').text()).toBe('Docente QA');
    expect(wrapper.text()).toContain('Sin constancia');
    wrapper.unmount();
  });
  it.each(['coordinador', 'direccion', 'contador', 'contabilidad'] as const)('denies %s even with fiscal permissions and never requests teachers', async role => {
    const wrapper = open(role); await flushPromises();
    expect(wrapper.text()).toContain('No tienes acceso');
    expect(fetchTeachers).not.toHaveBeenCalled();
    expect(wrapper.find('table').exists()).toBe(false);
    wrapper.unmount();
  });
});
