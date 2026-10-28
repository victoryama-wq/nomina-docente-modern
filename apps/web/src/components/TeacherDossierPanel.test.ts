import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, fetchDossierDocumentBlob, fetchDossierOperation, fetchTeacherDossier, mutateTeacherDossier, updateTeacherFiscal, type Teacher, type TeacherDossier } from '../api';
import TeacherDossierPanel from './TeacherDossierPanel.vue';

vi.mock('../api', async importOriginal => ({
  ...await importOriginal<typeof import('../api')>(),
  fetchTeacherDossier: vi.fn(), mutateTeacherDossier: vi.fn(), fetchDossierOperation: vi.fn(), fetchDossierDocumentBlob: vi.fn(), updateTeacherFiscal: vi.fn()
}));
vi.mock('../utils/dossierFiles', async importOriginal => ({
  ...await importOriginal<typeof import('../utils/dossierFiles')>(),
  dossierFilePayload: vi.fn(async (file: File) => ({ fileName: file.name, mimeType: 'application/pdf', base64Data: 'JVBERi0xLjQ=' }))
}));

const data = (): TeacherDossier => ({
  teacher: { id: 'teacher-1', fullName: 'Docente Sintético', phone: '9981234567', version: 'opaque-version' },
  capabilities: { readDocuments: true, manageDocuments: true, editPhone: true },
  documents: [{ id: 'doc-1', documentType: 'CURP', title: 'Identidad', fileName: 'identidad.pdf', mimeType: 'application/pdf', sizeBytes: 1024, state: 'AVAILABLE', revision: 2, createdAt: '2026-10-27', updatedAt: '2026-10-27' }]
});
const complete = { operationId: 'op', documentId: 'doc-1', state: 'COMPLETE' as const, errorCode: null, result: {} };
const pdf = (name = 'archivo.pdf') => new File(['%PDF-1.4'], name, { type: 'application/pdf' });
let wrapper: VueWrapper;
async function open() {
  wrapper = mount(TeacherDossierPanel, { props: { teacherId: 'teacher-1', teacherName: 'Docente Sintético', show: true }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}
function button(text: string) { return wrapper.findAll('button').find(node => node.text().includes(text))!; }
async function select(files: File[], selector = 'input[multiple]') {
  const input = wrapper.get(selector);
  Object.defineProperty(input.element, 'files', { configurable: true, value: files });
  await input.trigger('change');
}

describe('H24 dossier panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchTeacherDossier).mockResolvedValue(data());
    vi.mocked(mutateTeacherDossier).mockResolvedValue(complete);
    vi.mocked(fetchDossierOperation).mockResolvedValue(complete);
    vi.mocked(fetchDossierDocumentBlob).mockResolvedValue({ blob: new Blob(['%PDF'], { type: 'application/pdf' }), fileName: 'identidad.pdf' });
    URL.createObjectURL = vi.fn(() => 'blob:synthetic');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.useRealTimers(); });

  it('shows identity, shared phone and documents without fiscal data or storage references', async () => {
    await open();
    expect(wrapper.text()).toContain('Docente Sintético');
    expect(wrapper.text()).toContain('Compartido con Directorio');
    expect(wrapper.find('input[type=tel]').element).toHaveProperty('value', '9981234567');
    expect(wrapper.text()).not.toMatch(/RFC|CLABE|Base64|opaque-version|teacher-1/);
  });
  it('saves phone independently with opaque version and emits the canonical phone', async () => {
    await open();
    await wrapper.get('input[type=tel]').setValue('+52 998 111 2233');
    vi.mocked(fetchTeacherDossier).mockResolvedValue({ ...data(), teacher: { ...data().teacher, phone: '+529981112233', version: 'new' } });
    await button('Guardar teléfono').trigger('click');
    await flushPromises();
    expect(mutateTeacherDossier).toHaveBeenCalledWith('teacher-1', expect.any(String), { action: 'contact', payload: { phone: '+52 998 111 2233', expectedVersion: 'opaque-version' } });
    expect(wrapper.emitted('phoneSaved')).toEqual([['+529981112233']]);
  });
  it('rejects invalid phone before calling API', async () => {
    await open();
    await wrapper.get('input[type=tel]').setValue('123ext');
    await button('Guardar teléfono').trigger('click');
    expect(mutateTeacherDossier).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('10 a 15 dígitos');
  });
  it('groups fiscal fields in the dossier, saves through the existing endpoint and renews the phone version', async () => {
    await open();
    const teacher = { id: 'teacher-1', rfc: 'TEST010101AAA', email: 'synthetic@example.invalid', paymentType: 'E', bankDetail: '' } as Teacher;
    await wrapper.setProps({ fiscalTeacher: teacher, canEditFiscal: true });
    expect(wrapper.text()).toContain('Datos fiscales');
    expect(wrapper.get('input[placeholder="RFC del docente"]').element).toHaveProperty('value', teacher.rfc);
    await wrapper.get('input[type=tel]').setValue('9981112233');
    await wrapper.get('input[type=email]').setValue('updated@example.invalid');
    vi.mocked(updateTeacherFiscal).mockResolvedValue({ teacher: { ...teacher, email: 'updated@example.invalid' }, message: 'Guardado' });
    vi.mocked(fetchTeacherDossier).mockResolvedValue({ ...data(), teacher: { ...data().teacher, version: 'after-fiscal' } });
    await wrapper.get('fieldset').element.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(updateTeacherFiscal).toHaveBeenCalledWith('teacher-1', { rfc: teacher.rfc, email: 'updated@example.invalid', paymentType: 'E', bankDetail: '', fiscalPostalCode: '', curp: '' });
    expect(wrapper.emitted('fiscalSaved')).toHaveLength(1);
    expect(wrapper.get('input[type=tel]').element).toHaveProperty('value', '9981112233');
    await button('Guardar teléfono').trigger('click'); await flushPromises();
    expect(mutateTeacherDossier).toHaveBeenCalledWith('teacher-1', expect.any(String), { action: 'contact', payload: { phone: '9981112233', expectedVersion: 'after-fiscal' } });
  });
  it('does not grant fiscal write through document or phone capabilities', async () => {
    await open(); await wrapper.setProps({ fiscalTeacher: { id: 'teacher-1', paymentType: 'E' } as Teacher, canEditFiscal: false });
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined();
    expect(button('Guardar datos fiscales')).toBeUndefined();
    await wrapper.findAll('form')[0].trigger('submit');
    expect(updateTeacherFiscal).not.toHaveBeenCalled();
  });
  it('loads optional fiscal identity, normalizes CURP, preserves leading zero and saves without document upload', async () => {
    await open();
    const teacher = { id: 'teacher-1', paymentType: 'E', fiscalPostalCode: '01234', curp: 'TEST010101HQRXXX09' } as Teacher;
    await wrapper.setProps({ fiscalTeacher: teacher, canEditFiscal: true });
    expect(wrapper.get('input[name=fiscalPostalCode]').element).toHaveProperty('value', '01234');
    expect(wrapper.get('input[name=curp]').element).toHaveProperty('value', teacher.curp);
    await wrapper.get('input[name=curp]').setValue('test010101hqrxxx09');
    vi.mocked(updateTeacherFiscal).mockResolvedValue({ teacher, message: 'Guardado' });
    await wrapper.findAll('form')[0].trigger('submit'); await flushPromises();
    expect(updateTeacherFiscal).toHaveBeenCalledWith('teacher-1', expect.objectContaining({ fiscalPostalCode: '01234', curp: teacher.curp }));
    expect(mutateTeacherDossier).not.toHaveBeenCalled();
    expect(wrapper.get('input[name=curp]').element).toHaveProperty('value', teacher.curp);
  });
  it.each([
    ['fiscalPostalCode', '1234', 'cinco dígitos'],
    ['fiscalPostalCode', '12A45', 'cinco dígitos'],
    ['curp', 'INVALIDA', '18 caracteres']
  ])('rejects invalid %s before calling fiscal API', async (field, value, message) => {
    await open(); await wrapper.setProps({ fiscalTeacher: { id: 'teacher-1', paymentType: 'E' } as Teacher, canEditFiscal: true });
    await wrapper.get(`input[name=${field}]`).setValue(value);
    await wrapper.findAll('form')[0].trigger('submit'); await flushPromises();
    expect(updateTeacherFiscal).not.toHaveBeenCalled();
    expect(wrapper.get('[role=alert]').text()).toContain(message);
  });
  it('allows explicit clearing of optional fiscal identity fields', async () => {
    await open();
    const teacher = { id: 'teacher-1', paymentType: 'E', fiscalPostalCode: '01234', curp: 'TEST010101HQRXXX09' } as Teacher;
    await wrapper.setProps({ fiscalTeacher: teacher, canEditFiscal: true });
    await wrapper.get('input[name=fiscalPostalCode]').setValue('');
    await wrapper.get('input[name=curp]').setValue('');
    vi.mocked(updateTeacherFiscal).mockResolvedValue({ teacher: { ...teacher, fiscalPostalCode: '', curp: '' }, message: 'Guardado' });
    await wrapper.findAll('form')[0].trigger('submit'); await flushPromises();
    expect(updateTeacherFiscal).toHaveBeenCalledWith('teacher-1', expect.objectContaining({ fiscalPostalCode: '', curp: '' }));
  });
  it('tracks unsaved fiscal fields and hides them after a forbidden fiscal mutation', async () => {
    await open(); await wrapper.setProps({ fiscalTeacher: { id: 'teacher-1', paymentType: 'E' } as Teacher, canEditFiscal: true });
    await wrapper.get('input[type=email]').setValue('test@example.invalid');
    expect(wrapper.emitted('working')?.at(-1)).toEqual([true]);
    vi.mocked(updateTeacherFiscal).mockRejectedValue(new ApiRequestError('Denegado', 403, 'FORBIDDEN'));
    await wrapper.findAll('form')[0].trigger('submit'); await flushPromises();
    expect(wrapper.find('input[type=email]').exists()).toBe(false);
  });
  it('honors per-action capabilities without granting write from read', async () => {
    vi.mocked(fetchTeacherDossier).mockResolvedValue({ ...data(), capabilities: { readDocuments: true, manageDocuments: false, editPhone: false } });
    await open();
    expect(wrapper.find('input[multiple]').exists()).toBe(false);
    expect(wrapper.find('button[title="Eliminar definitivamente"]').exists()).toBe(false);
    expect(wrapper.get('input[type=tel]').attributes('readonly')).toBeDefined();
    expect(wrapper.find('button[title="Ver Identidad"]').exists()).toBe(true);
  });
  it('hides document section actions when only phone permission exists', async () => {
    vi.mocked(fetchTeacherDossier).mockResolvedValue({ ...data(), documents: [], capabilities: { readDocuments: false, manageDocuments: false, editPhone: true } });
    await open();
    expect(wrapper.text()).toContain('No tienes permiso para consultar documentos');
    expect(wrapper.find('input[multiple]').exists()).toBe(false);
  });
  it('sends same-type files separately, at most two in flight, without duplicating successful files', async () => {
    const resolve: ((value: typeof complete) => void)[] = [];
    vi.mocked(mutateTeacherDossier).mockImplementation(() => new Promise(done => resolve.push(done)));
    await open();
    await select([pdf('uno.pdf'), pdf('dos.pdf'), pdf('tres.pdf')]);
    await button('Cargar archivos válidos').trigger('click');
    await flushPromises();
    expect(mutateTeacherDossier).toHaveBeenCalledTimes(2);
    resolve[0](complete);
    await flushPromises();
    expect(mutateTeacherDossier).toHaveBeenCalledTimes(3);
    resolve[1](complete); resolve[2](complete);
    await flushPromises();
    expect(new Set(vi.mocked(mutateTeacherDossier).mock.calls.map(c => c[1])).size).toBe(3);
    expect(vi.mocked(mutateTeacherDossier).mock.calls.every(c => c[2].action === 'upload' && c[2].payload.documentType === 'OTRO')).toBe(true);
    expect(wrapper.findAll('input[multiple]')).toHaveLength(1);
  });
  it('keeps invalid selection visible and uploads only valid files', async () => {
    await open();
    await select([pdf(), new File(['bad'], 'invalid.jpg', { type: 'image/jpeg' })]);
    expect(wrapper.text()).toContain('Solo se admiten archivos PDF');
    await button('Cargar archivos válidos').trigger('click');
    await flushPromises();
    expect(mutateTeacherDossier).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('invalid.jpg');
  });
  it('rejects eleven files, empty PDF and oversize before network', async () => {
    await open();
    await select(Array.from({ length: 11 }, () => pdf()));
    expect(wrapper.text()).toContain('máximo 10 PDF');
    const large = pdf('grande.pdf');
    Object.defineProperty(large, 'size', { value: 8 * 1024 * 1024 });
    await select([large, new File([], 'vacio.pdf', { type: 'application/pdf' })]);
    expect(wrapper.text()).toContain('7.5 MiB');
    expect(wrapper.text()).toContain('está vacío');
    expect(mutateTeacherDossier).not.toHaveBeenCalled();
  });
  it('retries uncertain transport with the identical operation id and payload', async () => {
    vi.mocked(mutateTeacherDossier).mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(complete);
    await open(); await select([pdf()]); await button('Cargar archivos válidos').trigger('click'); await flushPromises();
    const first = vi.mocked(mutateTeacherDossier).mock.calls[0];
    await button('Reintentar misma operación').trigger('click'); await flushPromises();
    expect(vi.mocked(mutateTeacherDossier).mock.calls[1]).toEqual(first);
    expect(wrapper.text()).toContain('Completado');
  });
  it('treats HTTP200 FAILED as failure, not success', async () => {
    vi.mocked(mutateTeacherDossier).mockResolvedValue({ ...complete, state: 'FAILED', errorCode: 'STORAGE_FAILURE' });
    await open(); await select([pdf()]); await button('Cargar archivos válidos').trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('No se completó');
    expect(wrapper.text()).not.toContain('Completado');
    expect(wrapper.text()).not.toContain('STORAGE_FAILURE');
  });
  it('starts a new id only for a terminal failed upload, leaving successful files alone', async () => {
    vi.mocked(mutateTeacherDossier).mockResolvedValueOnce(complete).mockResolvedValueOnce({ ...complete, state: 'FAILED' }).mockResolvedValue(complete);
    await open(); await select([pdf('bien.pdf'), pdf('fallo.pdf')]);
    await button('Cargar archivos válidos').trigger('click'); await flushPromises();
    const calls = vi.mocked(mutateTeacherDossier).mock.calls;
    const failedId = calls[1][1];
    await button('Nuevo intento de este archivo').trigger('click'); await flushPromises();
    expect(calls).toHaveLength(3);
    expect(calls[2][1]).not.toBe(failedId);
    expect(calls[2][2]).toEqual(calls[1][2]);
    expect(calls[0][2]).not.toEqual(calls[2][2]);
  });
  it('bounds polling to twenty read-only checks and does not start another mutation', async () => {
    vi.useFakeTimers();
    vi.mocked(mutateTeacherDossier).mockResolvedValue({ ...complete, state: 'PREPARED' });
    vi.mocked(fetchDossierOperation).mockResolvedValue({ ...complete, state: 'CLEANUP' });
    await open(); await select([pdf()]); await button('Cargar archivos válidos').trigger('click'); await flushPromises();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(fetchDossierOperation).toHaveBeenCalledTimes(20);
    expect(mutateTeacherDossier).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Consultar estado');
  });
  it('does not expose a late PDF response after closing the panel', async () => {
    let resolve!: (value: { blob: Blob; fileName: string }) => void;
    vi.mocked(fetchDossierDocumentBlob).mockImplementation(() => new Promise(done => { resolve = done; }));
    await open(); await wrapper.get('[aria-label="Ver Identidad"]').trigger('click');
    await wrapper.setProps({ show: false });
    resolve({ blob: new Blob(['%PDF']), fileName: 'late.pdf' }); await flushPromises();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(wrapper.find('iframe').exists()).toBe(false);
  });
  it('does not start queued writes after leaving the component', async () => {
    const resolve: ((value: typeof complete) => void)[] = [];
    vi.mocked(mutateTeacherDossier).mockImplementation(() => new Promise(done => resolve.push(done)));
    await open(); await select([pdf('one.pdf'), pdf('two.pdf'), pdf('three.pdf')]);
    await button('Cargar archivos válidos').trigger('click'); await flushPromises();
    wrapper.unmount(); resolve.forEach(done => done(complete)); await flushPromises();
    expect(mutateTeacherDossier).toHaveBeenCalledTimes(2);
  });
  it('requires delete confirmation and keeps cleanup pending until read-only status completes', async () => {
    vi.mocked(mutateTeacherDossier).mockResolvedValue({ ...complete, state: 'CLEANUP' });
    await open();
    await wrapper.get('[aria-label="Eliminar Identidad"]').trigger('click');
    expect(mutateTeacherDossier).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('no podrá recuperarse');
    await button('Eliminar definitivamente').trigger('click'); await flushPromises();
    expect(vi.mocked(mutateTeacherDossier).mock.calls[0][2]).toEqual({ action: 'delete', documentId: 'doc-1', payload: { expectedRevision: 2 } });
    expect(wrapper.text()).toContain('aún no finaliza');
    await button('Consultar estado').trigger('click'); await flushPromises();
    expect(fetchDossierOperation).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Completado');
    expect(mutateTeacherDossier).toHaveBeenCalledTimes(1);
  });
  it('updates metadata with revision and replaces only the expressly selected document', async () => {
    await open();
    await wrapper.get('[aria-label="Clasificar Identidad"]').trigger('click');
    await wrapper.get('form.dossier-edit input').setValue('Título actualizado');
    await wrapper.get('form.dossier-edit').trigger('submit'); await flushPromises();
    expect(vi.mocked(mutateTeacherDossier).mock.calls[0][2]).toEqual({ action: 'metadata', documentId: 'doc-1', payload: { expectedRevision: 2, title: 'Título actualizado', documentType: 'CURP' } });
    await wrapper.get('[aria-label="Reemplazar Identidad"]').trigger('click');
    await select([pdf('nuevo.pdf')], '[aria-label="PDF de reemplazo"]'); await flushPromises();
    expect(vi.mocked(mutateTeacherDossier).mock.calls[1][2]).toEqual({ action: 'replace', documentId: 'doc-1', payload: { expectedRevision: 2, fileName: 'nuevo.pdf', mimeType: 'application/pdf', base64Data: 'JVBERi0xLjQ=' } });
  });
  it('uses authenticated preview/download and revokes the object URL on close', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await open(); await wrapper.get('[aria-label="Ver Identidad"]').trigger('click'); await flushPromises();
    expect(wrapper.get('iframe').attributes('src')).toBe('blob:synthetic');
    expect(wrapper.get('iframe').attributes('referrerpolicy')).toBe('no-referrer');
    await button('Descargar').trigger('click'); await flushPromises();
    expect(fetchDossierDocumentBlob).toHaveBeenLastCalledWith('teacher-1', 'doc-1', true);
    await wrapper.get('[aria-label="Cerrar vista previa"]').trigger('click');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic');
    expect(wrapper.find('iframe').exists()).toBe(false);
  });
  it('warns when closing pending work and retains its state while hidden', async () => {
    vi.mocked(mutateTeacherDossier).mockResolvedValue({ ...complete, state: 'PREPARED' });
    await open(); await select([pdf()]); await button('Cargar archivos válidos').trigger('click'); await flushPromises();
    await wrapper.get('[aria-label="Cerrar expediente"]').trigger('click');
    expect(wrapper.emitted('close')).toBeUndefined();
    expect(wrapper.text()).toContain('cerrar no las cancela');
    await button('Cerrar panel').trigger('click');
    await wrapper.setProps({ show: false }); await wrapper.setProps({ show: true });
    expect(wrapper.text()).toContain('pendiente de confirmación');
  });
  it.each([403, 409, 429, 503])('handles %s without claiming success or leaking diagnostics', async status => {
    vi.mocked(mutateTeacherDossier).mockRejectedValue(new ApiRequestError('PRIVATE_SQL_BUCKET', status, 'INTERNAL'));
    await open(); await select([pdf()]); await button('Cargar archivos válidos').trigger('click'); await flushPromises();
    expect(wrapper.text()).not.toContain('Completado');
    expect(wrapper.text()).not.toContain('PRIVATE_SQL_BUCKET');
    if (status === 403) expect(wrapper.find('input[multiple]').exists()).toBe(false);
    if (status === 409) expect(wrapper.text()).toContain('Recarga');
    if (status === 429 || status === 503) expect(button('Reintentar misma operación')).toBeDefined();
  });
  it('reports disabled backend honestly', async () => {
    vi.mocked(fetchTeacherDossier).mockRejectedValue(new ApiRequestError('internal path', 503, 'DOSSIER_DISABLED'));
    await open();
    expect(wrapper.text()).toContain('servicio documental no está disponible');
    expect(wrapper.find('input[multiple]').exists()).toBe(false);
  });
});
