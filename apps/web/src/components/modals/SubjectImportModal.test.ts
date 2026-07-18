import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubjectImportModal from './SubjectImportModal.vue';

const apiMocks = vi.hoisted(() => ({
  previewSubjectImport: vi.fn(),
  applySubjectImport: vi.fn(),
  downloadSubjectImportTemplate: vi.fn()
}));

vi.mock('../../api', () => apiMocks);

function preview(blocking: boolean) {
  return {
    fileSha256: 'a'.repeat(64),
    catalogFingerprint: 'b'.repeat(64),
    totalRows: 1,
    summary: {
      NUEVA: blocking ? 0 : 1,
      ACTUALIZAR_CLAVE: 0,
      ACTUALIZAR_NOMBRE: 0,
      ACTUALIZAR_ESTATUS: 0,
      ACTUALIZAR_MULTIPLE: 0,
      SIN_CAMBIOS: 0,
      INACTIVAR: 0,
      DUPLICADO_CLAVE_CSV: 0,
      DUPLICADO_NOMBRE_CSV: 0,
      POSIBLE_DUPLICADO_NOMBRE: 0,
      ID_NO_EXISTE: 0,
      ID_CLAVE_INCOMPATIBLE: 0,
      CLAVE_EXISTENTE_NOMBRE_INCOMPATIBLE: 0,
      INACTIVACION_CON_USO_OPERATIVO: 0,
      CAMPO_OBLIGATORIO_FALTANTE: blocking ? 1 : 0,
      ESTATUS_INVALIDO: 0,
      ERROR: 0
    },
    hasBlockingErrors: blocking,
    rows: [
      {
        line: 2,
        id: null,
        officialCode: 'QA-01',
        name: blocking ? '' : 'Ética Profesional',
        status: blocking ? null : 'ACTIVO',
        classification: blocking ? 'CAMPO_OBLIGATORIO_FALTANTE' : 'NUEVA',
        blocking,
        existingSubjectId: null,
        expectedCurrent: null,
        changes: blocking ? [] : ['officialCode', 'name', 'status'],
        message: blocking ? 'Nombre faltante.' : 'Alta nueva lista para aplicar.'
      }
    ]
  };
}

async function chooseCsv(wrapper: ReturnType<typeof mount>) {
  const file = new File(['id,clave,nombre,estatus\n,QA-01,Ética Profesional,ACTIVO'], 'asignaturas.csv', {
    type: 'text/csv'
  });
  Object.defineProperty(file, 'arrayBuffer', {
    value: vi.fn().mockResolvedValue(new TextEncoder().encode('id,clave,nombre,estatus').buffer)
  });
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
}

function buttonByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find((button) => button.text().includes(text))!;
}

describe('SubjectImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads both templates and blocks Apply when preview has errors', async () => {
    apiMocks.previewSubjectImport.mockResolvedValue({ preview: preview(true) });
    const wrapper = mount(SubjectImportModal, { props: { show: true } });

    await buttonByText(wrapper, 'Plantilla vacia').trigger('click');
    await buttonByText(wrapper, 'Catalogo actual').trigger('click');
    expect(apiMocks.downloadSubjectImportTemplate).toHaveBeenNthCalledWith(1, 'blank');
    expect(apiMocks.downloadSubjectImportTemplate).toHaveBeenNthCalledWith(2, 'catalog');

    await chooseCsv(wrapper);
    await buttonByText(wrapper, 'Validar archivo').trigger('click');
    await vi.waitFor(() => expect(wrapper.text()).toContain('CAMPO_OBLIGATORIO_FALTANTE'));
    expect(buttonByText(wrapper, 'Aplicar importacion').attributes('disabled')).toBeDefined();
    expect(apiMocks.applySubjectImport).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation, applies the original hashes and emits result', async () => {
    apiMocks.previewSubjectImport.mockResolvedValue({ preview: preview(false) });
    apiMocks.applySubjectImport.mockResolvedValue({
      result: { inserted: 1, updated: 0, unchanged: 0, total: 1 },
      message: 'OK'
    });
    const wrapper = mount(SubjectImportModal, { props: { show: true } });
    await chooseCsv(wrapper);
    await buttonByText(wrapper, 'Validar archivo').trigger('click');
    await vi.waitFor(() => expect(wrapper.text()).toContain('Preview listo'));

    const applyButton = buttonByText(wrapper, 'Aplicar importacion');
    expect(applyButton.attributes('disabled')).toBeDefined();
    await wrapper.find('input[type="checkbox"]').setValue(true);
    expect(applyButton.attributes('disabled')).toBeUndefined();
    await applyButton.trigger('click');

    await vi.waitFor(() => expect(apiMocks.applySubjectImport).toHaveBeenCalledTimes(1));
    expect(apiMocks.applySubjectImport.mock.calls[0][0]).toMatchObject({
      fileName: 'asignaturas.csv',
      fileSha256: 'a'.repeat(64),
      catalogFingerprint: 'b'.repeat(64),
      confirmed: true
    });
    expect(wrapper.emitted('applied')?.[0]?.[0]).toEqual({ inserted: 1, updated: 0, unchanged: 0, total: 1 });
  });
});
