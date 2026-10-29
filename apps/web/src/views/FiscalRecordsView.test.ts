import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTeachers, fetchTeacherConstanciaBlob, updateTeacherFiscal, uploadTeacherConstancia, type SessionUser } from '../api';
import { useAuthStore } from '../stores/auth';
import { createSessionUser } from '../test/fixtures/session-users';
import FiscalRecordsView from './FiscalRecordsView.vue';

vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }));
vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), fetchTeachers: vi.fn(), fetchTeacherConstanciaBlob: vi.fn(), updateTeacherFiscal: vi.fn(), uploadTeacherConstancia: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchTeachers).mockResolvedValue({ teachers: [{ id: 'teacher', fullName: 'Docente QA', status: 'ACTIVO', phone: '9981234567', rfc: '', email: '', bankDetail: '', documentId: null, paymentType: '1' }], summary: { total: 1, active: 1, inactive: 0, withRfc: 0, withBank: 0, withConstancia: 0, fiscalReady: 0 } } as Awaited<ReturnType<typeof fetchTeachers>>);
});

describe('H24 constancia preview lifecycle', () => {
  const file = { blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }), fileName: 'synthetic.pdf', mimeType: 'application/pdf' };
  function deferred() {
    let resolve!: (value: typeof file) => void;
    const promise = new Promise<typeof file>(r => { resolve = r; });
    return { promise, resolve };
  }
  async function ready() {
    const data = await vi.mocked(fetchTeachers).getMockImplementation()!();
    data.teachers[0].documentId = 'doc-a';
    data.teachers.push({ ...data.teachers[0], id: 'teacher-b', fullName: 'Docente QB', documentId: 'doc-b' });
    vi.mocked(fetchTeachers).mockResolvedValue(data);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const wrapper = open('admin'); await flushPromises();
    return wrapper;
  }
  it.each(['unmount', 'logout', 'permission', 'identity'] as const)('ignores a late PDF after %s', async event => {
    const wrapper = await ready();
    const pending = deferred(); vi.mocked(fetchTeacherConstanciaBlob).mockReturnValue(pending.promise);
    await wrapper.findAll('button').find(b => b.text() === 'Vista previa')!.trigger('click');
    if (event === 'unmount') wrapper.unmount();
    else if (event === 'logout') useAuthStore().session = null;
    else if (event === 'permission') useAuthStore().session = createSessionUser({ role: 'rh', permissions: ['fiscal.view'] });
    else useAuthStore().session = createSessionUser({ role: 'admin', id: 'other-admin' });
    await flushPromises();
    pending.resolve(file); await flushPromises();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    if (event !== 'unmount') wrapper.unmount();
  });
  it('ignores an older response and revokes the current Blob when closed', async () => {
    const wrapper = await ready();
    const older = deferred(); const newer = deferred();
    vi.mocked(fetchTeacherConstanciaBlob).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const buttons = wrapper.findAll('button').filter(b => b.text() === 'Vista previa');
    await buttons[0].trigger('click'); await buttons[1].trigger('click');
    newer.resolve(file); await flushPromises();
    expect(wrapper.get('.fiscal-preview-modal').text()).toContain('Docente QB');
    older.resolve(file); await flushPromises();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(wrapper.get('.fiscal-preview-modal').text()).toContain('Docente QB');
    await wrapper.get('.fiscal-preview-modal button[title="Cerrar"]').trigger('click');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic');
    expect(wrapper.find('iframe').exists()).toBe(false);
    wrapper.unmount();
  });
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
