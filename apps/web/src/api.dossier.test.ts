import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDossierDocumentBlob, fetchDossierOperation, fetchTeacherDossier, mutateTeacherDossier, type DossierMutation } from './api';

vi.mock('./firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'local-mocked-token' } } }));
vi.mock('./config', () => ({ apiBaseUrl: 'http://localhost:8080' }));
const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => vi.unstubAllGlobals());

describe('H24 authenticated API contracts', () => {
  it.each([
    ['upload', 'POST', '/documents', { title: 'CURP', documentType: 'CURP', fileName: 'curp.pdf', mimeType: 'application/pdf', base64Data: 'JVBERg==' }],
    ['replace', 'PUT', '/documents/doc/content', { expectedRevision: 2, fileName: 'curp.pdf', mimeType: 'application/pdf', base64Data: 'JVBERg==' }],
    ['metadata', 'PATCH', '/documents/doc', { expectedRevision: 2, title: 'Acta', documentType: 'ACTA_NACIMIENTO' }],
    ['delete', 'DELETE', '/documents/doc', { expectedRevision: 2 }],
    ['contact', 'PATCH', '/contact', { expectedVersion: 'opaque', phone: '9981234567' }]
  ])('sends %s to the F1 route with strict payload and idempotency key', async (action, method, suffix, payload) => {
    const operation = { state: 'PREPARED', operationId: 'op', documentId: 'doc', errorCode: null, result: {} };
    fetchMock.mockResolvedValue({ ok: true, status: 202, json: async () => operation });
    const mutation = { action, payload, ...(['replace', 'metadata', 'delete'].includes(String(action)) ? { documentId: 'doc' } : {}) } as DossierMutation;
    expect(await mutateTeacherDossier('teacher', 'op', mutation)).toEqual(operation);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://localhost:8080/teachers/teacher/dossier${suffix}`);
    expect(options.method).toBe(method);
    expect(options.headers).toEqual({ Authorization: 'Bearer local-mocked-token', 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({ ...payload as object, operationId: 'op' });
  });
  it('reads dossier and operation without writes', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await fetchTeacherDossier('teacher'); await fetchDossierOperation('teacher', 'op');
    expect(fetchMock.mock.calls.map(c => c[0])).toEqual(['http://localhost:8080/teachers/teacher/dossier', 'http://localhost:8080/teachers/teacher/dossier/operations/op']);
    expect(fetchMock.mock.calls.every(c => !c[1].body)).toBe(true);
  });
  it('validates PDF MIME/signature and preserves UTF8 filename for download', async () => {
    fetchMock.mockResolvedValue({ ok: true, headers: new Headers({ 'Content-Type': 'application/pdf', 'Content-Disposition': "attachment; filename=\"titulo.pdf\"; filename*=UTF-8''T%C3%ADtulo.pdf" }), blob: async () => new NodeBlob(['%PDF-1.4 synthetic']) });
    const file = await fetchDossierDocumentBlob('teacher', 'doc', true);
    expect(file.fileName).toBe('Título.pdf');
    expect(file.blob.type).toBe('application/pdf');
    expect(fetchMock.mock.calls[0][0]).toContain('/documents/doc/content?download=true');
    expect(fetchMock.mock.calls[0][1].cache).toBe('no-store');
  });
  it.each([
    ['text/html', '<script>unsafe</script>'],
    ['application/pdf', '<html>not a PDF</html>']
  ])('rejects non PDF bytes or content type (%s), never creating a preview URL', async (mime, body) => {
    fetchMock.mockResolvedValue({ ok: true, headers: new Headers({ 'Content-Type': mime }), blob: async () => new NodeBlob([body]) });
    await expect(fetchDossierDocumentBlob('teacher', 'doc')).rejects.toThrow();
  });
  it('preserves controlled error status for mutation handling', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'STALE_VERSION', message: 'Recarga.' }) });
    await expect(mutateTeacherDossier('teacher', 'op', { action: 'contact', payload: { phone: '', expectedVersion: 'v' } })).rejects.toMatchObject({ status: 409, code: 'STALE_VERSION' });
  });
});
