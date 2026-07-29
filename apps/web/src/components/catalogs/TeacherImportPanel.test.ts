import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeacherImportPanel from './TeacherImportPanel.vue';

const apiMocks = vi.hoisted(() => {
  class MockApiRequestError extends Error {
    constructor(
      message: string,
      public readonly status: number,
      public readonly code: string
    ) {
      super(message);
    }
  }
  return {
    ApiRequestError: MockApiRequestError,
    applyTeacherImport: vi.fn(),
    downloadTeacherImportTemplate: vi.fn(),
    previewTeacherImport: vi.fn()
  };
});

vi.mock('../../api', () => apiMocks);

type PreviewOptions = {
  blocking?: boolean;
  warning?: boolean;
  riskActions?: string[];
  action?: string;
};

function previewFixture(options: PreviewOptions = {}) {
  const action = options.action || 'ACTUALIZAR_NOMBRE';
  const current = {
    identifier: 'DOC-01',
    firstNames: 'Jose',
    paternalLastName: 'Alvarez',
    maternalLastName: '',
    derivedName: 'Jose Alvarez',
    responsibleEmail: options.warning ? '' : 'coordinador@tecplayacar.edu.mx',
    responsibleName: options.warning ? '' : 'Coordinador QA',
    category: 'N',
    phone: '',
    location: 'Local',
    status: 'ACTIVO'
  };
  const rows = [
    {
      rowNumber: 2,
      teacherId: '10000000-0000-4000-8000-000000000001',
      matchedBy: 'id',
      teacherName: 'José Álvarez',
      action,
      blocking: false,
      warnings: options.warning ? ['RESPONSABLE_OPERATIVO_AUSENTE'] : [],
      errors: [],
      current,
      proposed: { ...current, firstNames: 'José', derivedName: 'José Álvarez' },
      message: 'Cambio operativo listo.',
      changes: ['name']
    },
    ...(options.blocking
      ? [
          {
            rowNumber: 3,
            teacherId: '10000000-0000-4000-8000-000000000002',
            matchedBy: 'identificador',
            teacherName: 'Docente Bloqueado',
            action: 'INACTIVACION_CON_DEPENDENCIAS',
            blocking: true,
            warnings: [],
            errors: ['INACTIVACION_CON_DEPENDENCIAS'],
            current: { ...current, identifier: 'DOC-02', derivedName: 'Docente Bloqueado' },
            proposed: { ...current, identifier: 'DOC-02', derivedName: 'Docente Bloqueado', status: 'INACTIVO' },
            dependencies: { schedules: 2, incidences: 1, extras: 3, cycles: ['2026-Q3'] },
            message: 'El docente tiene dependencias operativas.',
            changes: ['status']
          }
        ]
      : []),
    ...(options.warning
      ? [
          {
            rowNumber: 4,
            teacherId: '10000000-0000-4000-8000-000000000003',
            matchedBy: 'id',
            teacherName: 'Legacy con cambios',
            action: 'RESPONSABLE_OPERATIVO_REQUERIDO',
            blocking: true,
            warnings: [],
            errors: ['RESPONSABLE_OPERATIVO_REQUERIDO'],
            current: { ...current, identifier: 'DOC-03', derivedName: 'Legacy con cambios' },
            proposed: null,
            message: 'Responsable requerido.',
            changes: ['contact']
          }
        ]
      : [])
  ];
  return {
    fileName: 'docentes.csv',
    fileSha256: 'a'.repeat(64),
    teachersFingerprint: 'b'.repeat(64),
    responsibleUsersFingerprint: 'c'.repeat(64),
    totalRows: rows.length,
    summary: { [action]: 1 },
    hasBlockingErrors: rows.some((row) => row.blocking),
    requiresSecondConfirmation: options.riskActions || ['ACTUALIZAR_NOMBRE'],
    rows
  };
}

function buttonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find((item) => item.text().includes(text));
  if (!button) throw new Error(`No se encontró el botón ${text}`);
  return button;
}

function buttonsByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').filter((item) => item.text().includes(text));
}

async function chooseFile(wrapper: ReturnType<typeof mount>, name = 'docentes.csv', content = 'id,identificador') {
  const file = new File([content], name, { type: name.endsWith('.csv') ? 'text/csv' : 'text/plain' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: vi.fn().mockResolvedValue(new TextEncoder().encode(content).buffer)
  });
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
  await flushPromises();
  return file;
}

async function loadPreview(wrapper: ReturnType<typeof mount>, fixture = previewFixture()) {
  apiMocks.previewTeacherImport.mockResolvedValueOnce({ preview: fixture });
  await chooseFile(wrapper);
  await buttonByText(wrapper, 'Generar vista previa').trigger('click');
  await flushPromises();
}

describe('TeacherImportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.downloadTeacherImportTemplate.mockResolvedValue(undefined);
  });

  it('descarga plantillas blank/active y confirma all sin permitir doble envío', async () => {
    let finishActive!: () => void;
    apiMocks.downloadTeacherImportTemplate.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishActive = resolve))
    );
    const wrapper = mount(TeacherImportPanel);

    await buttonByText(wrapper, 'Descargar docentes activos').trigger('click');
    await buttonByText(wrapper, 'Descargar docentes activos').trigger('click');
    expect(apiMocks.downloadTeacherImportTemplate).toHaveBeenCalledTimes(1);
    expect(apiMocks.downloadTeacherImportTemplate).toHaveBeenCalledWith('active');
    finishActive();
    await flushPromises();

    await buttonByText(wrapper, 'Descargar plantilla vacía').trigger('click');
    expect(apiMocks.downloadTeacherImportTemplate).toHaveBeenLastCalledWith('blank');

    await buttonByText(wrapper, 'Descargar todos los docentes').trigger('click');
    expect(wrapper.text()).toContain('incluirá docentes activos e inactivos');
    expect(apiMocks.downloadTeacherImportTemplate).not.toHaveBeenCalledWith('all');
    const confirmDownload = wrapper
      .find('.confirmation-card')
      .findAll('button')
      .find((button) => button.text().trim() === 'Descargar');
    expect(confirmDownload).toBeDefined();
    await confirmDownload!.trigger('click');
    await flushPromises();
    expect(apiMocks.downloadTeacherImportTemplate).toHaveBeenLastCalledWith('all');
  });

  it('muestra errores de descarga sin exponer detalles técnicos', async () => {
    apiMocks.downloadTeacherImportTemplate.mockRejectedValueOnce(new Error('stack SQL secreto'));
    const wrapper = mount(TeacherImportPanel);
    await buttonByText(wrapper, 'Descargar plantilla vacía').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('No fue posible descargar la plantilla de docentes');
    expect(wrapper.text()).not.toContain('stack SQL secreto');
  });

  it('valida extensión, muestra nombre/tamaño y no ejecuta Preview automáticamente', async () => {
    const wrapper = mount(TeacherImportPanel);
    expect(buttonByText(wrapper, 'Generar vista previa').attributes('disabled')).toBeDefined();

    await chooseFile(wrapper, 'docentes.txt');
    expect(wrapper.text()).toContain('extensión .csv');
    expect(apiMocks.previewTeacherImport).not.toHaveBeenCalled();

    await chooseFile(wrapper, 'docentes.csv', 'contenido');
    expect(wrapper.text()).toContain('docentes.csv');
    expect(wrapper.text()).toContain('9 B');
    expect(apiMocks.previewTeacherImport).not.toHaveBeenCalled();
    expect(buttonByText(wrapper, 'Generar vista previa').attributes('disabled')).toBeUndefined();
  });

  it('reemplazar el archivo limpia Preview y confirmaciones', async () => {
    const wrapper = mount(TeacherImportPanel);
    await loadPreview(wrapper);
    await wrapper.find('input[type="checkbox"]').setValue(true);
    expect(wrapper.text()).toContain('Vista previa lista');

    await chooseFile(wrapper, 'reemplazo.csv');
    expect(wrapper.text()).not.toContain('Vista previa lista');
    expect(wrapper.text()).toContain('reemplazo.csv');
    expect(buttonsByText(wrapper, 'Aplicar importación')).toHaveLength(0);
  });

  it('renderiza resumen, legacy, bloqueos, filtros sin acentos y detalle de dependencias', async () => {
    const wrapper = mount(TeacherImportPanel);
    await loadPreview(wrapper, previewFixture({ blocking: true, warning: true, riskActions: [] }));

    const filterFields = wrapper.findAll('.preview-filter-field');
    expect(filterFields).toHaveLength(3);
    expect(filterFields.map((field) => field.find('span').text())).toEqual(['Resultado', 'Acción', 'Buscar']);
    expect(wrapper.find('.preview-search-control input').exists()).toBe(true);

    expect(wrapper.text()).toContain('Errores bloqueantes');
    expect(wrapper.text()).toContain('este docente no tiene responsable operativo asignado');
    expect(wrapper.text()).toContain('Para modificar este docente debes asignar un responsable operativo válido');
    expect(wrapper.text()).toContain('José Álvarez');

    const search = wrapper.find('.preview-search-control input');
    expect(search.attributes('aria-label')).toBe('Buscar fila, docente, identificador o responsable');
    await search.setValue('jose alvarez');
    expect(wrapper.text()).toContain('Mostrando 1 de 3 filas');

    await search.setValue('');
    const selects = wrapper.findAll('select');
    await selects[0].setValue('BLOQUEANTES');
    expect(wrapper.text()).toContain('Mostrando 2 de 3 filas');

    await buttonsByText(wrapper, 'Ver cambios')[0].trigger('click');
    expect(wrapper.find('.detail-modal').exists()).toBe(true);
    expect(wrapper.text()).toContain('Horarios vigentes');
    expect(wrapper.text()).toContain('Incidencias operativas');
    expect(wrapper.text()).toContain('Extras vigentes');
    expect(wrapper.find('.import-preview-table').exists()).toBe(true);
  });

  it('exige confirmación general y cada riesgo antes de abrir el modal final', async () => {
    const wrapper = mount(TeacherImportPanel);
    await loadPreview(
      wrapper,
      previewFixture({ riskActions: ['ACTUALIZAR_NOMBRE', 'ACTUALIZAR_CATEGORIA'], action: 'ACTUALIZAR_MULTIPLE' })
    );

    const apply = buttonByText(wrapper, 'Aplicar importación');
    expect(apply.attributes('disabled')).toBeDefined();
    const checks = wrapper.findAll('input[type="checkbox"]');
    expect(checks).toHaveLength(3);
    await checks[0].setValue(true);
    await checks[1].setValue(true);
    expect(apply.attributes('disabled')).toBeDefined();
    await checks[2].setValue(true);
    expect(apply.attributes('disabled')).toBeUndefined();

    await apply.trigger('click');
    expect(apiMocks.applyTeacherImport).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No existe aplicación parcial');
  });

  it('Apply envía archivo y fingerprints, llama una vez y limpia el flujo al concluir', async () => {
    apiMocks.applyTeacherImport.mockResolvedValueOnce({
      result: {
        applied: true,
        fileSha256: 'a'.repeat(64),
        totalRows: 1,
        created: 0,
        updated: 1,
        unchanged: 0,
        inactivated: 0,
        reactivated: 0,
        responsibleAssigned: 0,
        responsibleReassigned: 0,
        warnings: 0
      },
      message: 'OK'
    });
    const wrapper = mount(TeacherImportPanel);
    await loadPreview(wrapper);
    const checks = wrapper.findAll('input[type="checkbox"]');
    await checks[0].setValue(true);
    await checks[1].setValue(true);
    await buttonByText(wrapper, 'Aplicar importación').trigger('click');
    const modalApply = buttonsByText(wrapper, 'Aplicar importación').at(-1)!;
    await modalApply.trigger('click');
    await modalApply.trigger('click');
    await flushPromises();

    expect(apiMocks.applyTeacherImport).toHaveBeenCalledTimes(1);
    expect(apiMocks.applyTeacherImport.mock.calls[0][0]).toEqual({
      fileName: 'docentes.csv',
      base64Data: expect.any(String),
      fileSha256: 'a'.repeat(64),
      teachersFingerprint: 'b'.repeat(64),
      responsibleUsersFingerprint: 'c'.repeat(64),
      confirmedRiskActions: ['ACTUALIZAR_NOMBRE']
    });
    expect(apiMocks.applyTeacherImport.mock.calls[0][0]).not.toHaveProperty('rows');
    expect(wrapper.text()).toContain('La importación fue aplicada correctamente');
    expect(wrapper.text()).not.toContain('Vista previa lista');
    expect(wrapper.text()).not.toContain('docentes.csv');
    expect(wrapper.emitted('applied')).toHaveLength(1);
  });

  it('un 409 obsoleto exige nuevo Preview, conserva el archivo y reinicia confirmaciones', async () => {
    apiMocks.applyTeacherImport.mockRejectedValueOnce(
      new apiMocks.ApiRequestError('detalle interno', 409, 'PREVIEW_OBSOLETO')
    );
    const wrapper = mount(TeacherImportPanel);
    await loadPreview(wrapper);
    const checks = wrapper.findAll('input[type="checkbox"]');
    await checks[0].setValue(true);
    await checks[1].setValue(true);
    await buttonByText(wrapper, 'Aplicar importación').trigger('click');
    await buttonsByText(wrapper, 'Aplicar importación').at(-1)!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Genera una nueva vista previa');
    expect(wrapper.text()).toContain('docentes.csv');
    expect(wrapper.text()).not.toContain('Vista previa lista');
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it.each([
    [403, 'FORBIDDEN', 'No tienes permisos para importar docentes.'],
    [500, 'ERROR', 'Ocurrió un error al procesar la importación.']
  ])('presenta error Apply %s de forma segura', async (status, code, message) => {
    apiMocks.applyTeacherImport.mockRejectedValueOnce(new apiMocks.ApiRequestError('query secreta', status, code));
    const wrapper = mount(TeacherImportPanel);
    await loadPreview(wrapper);
    const checks = wrapper.findAll('input[type="checkbox"]');
    await checks[0].setValue(true);
    await checks[1].setValue(true);
    await buttonByText(wrapper, 'Aplicar importación').trigger('click');
    await buttonsByText(wrapper, 'Aplicar importación').at(-1)!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain(message);
    expect(wrapper.text()).not.toContain('query secreta');
  });

  it('no renderiza datos fiscales ni artefactos internos del Preview', async () => {
    const wrapper = mount(TeacherImportPanel);
    await loadPreview(wrapper);
    const visible = wrapper.text().toLowerCase();
    expect(visible).not.toContain('rfc');
    expect(visible).not.toContain('clabe');
    expect(visible).not.toContain('payment_type');
    expect(visible).not.toContain('base64');
    expect(visible).not.toContain('fingerprint');
    expect(wrapper.find('.import-preview-table').attributes('class')).toContain('table-shell');
  });
});
