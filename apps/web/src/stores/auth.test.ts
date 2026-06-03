import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signOut } from 'firebase/auth';
import {
  accountingSession,
  accountantSession,
  coordinatorSession,
  directionSession,
  financeSession,
  rhSession
} from '../test/fixtures/session-users';
import { useAuthStore } from './auth';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn()
}));

vi.mock('../firebase', () => ({
  auth: {},
  authPersistenceReady: Promise.resolve(),
  googleProvider: {}
}));

vi.mock('../api', () => ({
  fetchSession: vi.fn()
}));

describe('auth store permission helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    vi.mocked(signOut).mockResolvedValue(undefined);
  });

  it('keeps Coordinador in payroll preview without fiscal, finance workflow, export or finalize permissions', () => {
    const auth = useAuthStore();
    auth.session = coordinatorSession();

    expect(auth.canPreviewPayroll).toBe(true);
    expect(auth.canManageFiscal).toBe(false);
    expect(auth.canFinanceWorkflow).toBe(false);
    expect(auth.canExportFinance).toBe(false);
    expect(auth.canFinalizePayroll).toBe(false);
  });

  it('allows RH fiscal and document management without financial workflow', () => {
    const auth = useAuthStore();
    auth.session = rhSession();

    expect(auth.canViewFiscal).toBe(true);
    expect(auth.canManageFiscal).toBe(true);
    expect(auth.canViewFiscalDocuments).toBe(true);
    expect(auth.canManageFiscalDocuments).toBe(true);
    expect(auth.canFinanceWorkflow).toBe(false);
  });

  it('allows Finanzas fiscal, export and workflow permissions', () => {
    const auth = useAuthStore();
    auth.session = financeSession();

    expect(auth.canViewFiscal).toBe(true);
    expect(auth.canManageFiscal).toBe(true);
    expect(auth.canExportFinance).toBe(true);
    expect(auth.canFinanceWorkflow).toBe(true);
  });

  it('keeps Direccion in preview/reporting without fiscal manage or financial workflow', () => {
    const auth = useAuthStore();
    auth.session = directionSession();

    expect(auth.canPreviewPayroll).toBe(true);
    expect(auth.canManageFiscal).toBe(false);
    expect(auth.canFinanceWorkflow).toBe(false);
  });

  it('keeps Contador and Contabilidad limited to export without workflow or fiscal management', () => {
    const accountant = useAuthStore();
    accountant.session = accountantSession();

    expect(accountant.canExportFinance).toBe(true);
    expect(accountant.canFinanceWorkflow).toBe(false);
    expect(accountant.canManageFiscal).toBe(false);

    setActivePinia(createPinia());
    const accounting = useAuthStore();
    accounting.session = accountingSession();

    expect(accounting.canExportFinance).toBe(true);
    expect(accounting.canFinanceWorkflow).toBe(false);
    expect(accounting.canManageFiscal).toBe(false);
  });

  it('keeps manual logout working and clears auth state', async () => {
    const auth = useAuthStore();
    auth.session = coordinatorSession();
    auth.firebaseUser = { uid: 'firebase-user' } as typeof auth.firebaseUser;

    await auth.logout();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(auth.session).toBeNull();
    expect(auth.firebaseUser).toBeNull();
    expect(auth.error).toBe('');
  });

  it('stores an inactivity logout message while clearing auth state', async () => {
    const auth = useAuthStore();
    auth.session = coordinatorSession();
    auth.firebaseUser = { uid: 'firebase-user' } as typeof auth.firebaseUser;

    await auth.logout('La sesion se cerro por inactividad.');

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(auth.session).toBeNull();
    expect(auth.firebaseUser).toBeNull();
    expect(auth.error).toBe('La sesion se cerro por inactividad.');
  });
});
