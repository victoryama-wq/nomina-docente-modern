import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CatalogsView from './CatalogsView.vue';
import { useAuthStore } from '../stores/auth';
import {
  accountantSession,
  accountingSession,
  adminSession,
  coordinatorSession,
  directionSession,
  financeSession,
  rhSession,
  type createSessionUser
} from '../test/fixtures/session-users';

const apiMocks = vi.hoisted(() => ({
  createCatalogSubject: vi.fn(),
  createCatalogTabulator: vi.fn(),
  fetchCatalogSubjects: vi.fn(),
  fetchCatalogsContext: vi.fn(),
  updateCatalogSubject: vi.fn(),
  updateCatalogTabulator: vi.fn()
}));

vi.mock('../api', () => apiMocks);

function catalogContext() {
  return {
    subjects: [],
    tabulators: [],
    summary: {
      subjects: { total: 0, active: 0, inactive: 0, usedInWorkingCycles: 0 },
      tabulators: { total: 0, active: 0, inactive: 0, usedInWorkingCycles: 0 }
    }
  };
}

function mountCatalogs(session: ReturnType<typeof createSessionUser>) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const authStore = useAuthStore();
  authStore.session = session;
  return mount(CatalogsView, {
    global: {
      plugins: [pinia],
      stubs: {
        SubjectImportModal: true,
        TeacherImportPanel: { template: '<div data-testid="teacher-import-panel">Panel docentes</div>' }
      }
    }
  });
}

describe('CatalogsView H22 permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchCatalogsContext.mockResolvedValue(catalogContext());
    apiMocks.fetchCatalogSubjects.mockResolvedValue({
      subjects: [],
      pagination: { page: 1, pageSize: 25, total: 0 }
    });
  });

  it('Admin ve y puede abrir la pestaña Importación de docentes', async () => {
    const wrapper = mountCatalogs(adminSession());
    await flushPromises();
    const tab = wrapper.findAll('button').find((button) => button.text().includes('Importación de docentes'));
    expect(tab).toBeDefined();
    await tab!.trigger('click');
    expect(wrapper.find('[data-testid="teacher-import-panel"]').exists()).toBe(true);
  });

  it.each([
    ['Coordinador', coordinatorSession],
    ['Dirección', directionSession],
    ['RH', rhSession],
    ['Finanzas', financeSession],
    ['Contador', accountantSession],
    ['Contabilidad', accountingSession]
  ])('%s no ve la pestaña de importación', async (_role, sessionFactory) => {
    const wrapper = mountCatalogs(sessionFactory());
    await flushPromises();
    expect(wrapper.text()).not.toContain('Importación de docentes');
    expect(wrapper.find('[data-testid="teacher-import-panel"]').exists()).toBe(false);
  });
});
