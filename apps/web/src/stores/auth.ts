import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { fetchSession, type SessionUser } from '../api';

export const useAuthStore = defineStore('auth', () => {
  const firebaseUser = ref<User | null>(null);
  const session = ref<SessionUser | null>(null);
  const loading = ref(true);
  const signingIn = ref(false);
  const error = ref('');

  const isAuthenticated = computed(() => !!session.value && !!firebaseUser.value);
  const isAdmin = computed(() => session.value?.role === 'admin' || session.value?.isProtectedSuperAdmin || false);
  const hasPermission = (permission: string) => session.value?.permissions?.includes(permission) || false;
  
  // Computed permissions helpers
  const canManageAccess = computed(() => hasPermission('access.manage'));
  const canManageTeachers = computed(() => hasPermission('teachers.manage'));
  const canManageSchedules = computed(() => hasPermission('schedules.manage'));
  const canManageIncidences = computed(() => hasPermission('incidences.manage'));
  const canManageExtras = computed(() => hasPermission('extras.manage'));
  const canPreviewPayroll = computed(() => isAdmin.value || hasPermission('payroll.preview') || hasPermission('payroll.calculate'));
  const canViewPayroll = computed(() => isAdmin.value || hasPermission('payroll.view') || canPreviewPayroll.value);
  const canCalculatePayroll = computed(() => hasPermission('payroll.calculate'));
  const canFinalizePayroll = computed(() => isAdmin.value || hasPermission('payroll.finalize'));
  const canManageCalendar = computed(() => hasPermission('calendar.manage'));
  const canManageCatalogs = computed(() => isAdmin.value);
  const canExportFinance = computed(() => isAdmin.value || hasPermission('finance.export'));
  const canFinanceWorkflow = computed(() => isAdmin.value || hasPermission('finance.workflow'));
  const canViewFinanceReports = computed(
    () =>
      isAdmin.value ||
      hasPermission('finance.view') ||
      hasPermission('finance.global_view') ||
      canExportFinance.value
  );
  const canViewFiscal = computed(() => isAdmin.value || hasPermission('fiscal.view') || hasPermission('fiscal.manage'));
  const canManageFiscal = computed(() => isAdmin.value || hasPermission('fiscal.manage'));
  const canViewFiscalDocuments = computed(
    () => isAdmin.value || hasPermission('fiscal.document.view') || hasPermission('fiscal.document.manage')
  );
  const canManageFiscalDocuments = computed(() => isAdmin.value || hasPermission('fiscal.document.manage'));
  const canViewFiscalRecords = computed(() => canViewFiscal.value);
  const canManageFiscalRecords = computed(() => canManageFiscal.value);
  const canExportTeacherHistory = computed(() => hasPermission('audit.view'));
  const canViewAudit = computed(
    () => session.value?.isProtectedSuperAdmin || hasPermission('audit.view')
  );
  const canViewTeachers = computed(() => 
    canManageTeachers.value || 
    canViewFiscal.value ||
    hasPermission('finance.view') ||
    hasPermission('finance.global_view')
  );

  async function loadProtectedData() {
    error.value = '';
    try {
      session.value = await fetchSession();
    } catch (err) {
      session.value = null;
      error.value = err instanceof Error ? err.message : 'No fue posible validar tu acceso.';
      throw err;
    }
  }

  async function login() {
    signingIn.value = true;
    error.value = '';
    try {
      await signInWithPopup(auth, googleProvider);
      await loadProtectedData();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'No fue posible iniciar sesión.';
      throw err;
    } finally {
      signingIn.value = false;
    }
  }

  async function logout() {
    await signOut(auth);
    session.value = null;
    firebaseUser.value = null;
  }

  let initPromise: Promise<void> | null = null;

  function initAuth() {
    if (initPromise) return initPromise;
    initPromise = new Promise<void>((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        firebaseUser.value = user;
        if (user) {
          try {
            await loadProtectedData();
          } catch (e) {
            // Error loading session, might be unauthorized email or disabled user
            await signOut(auth);
          }
        } else {
          session.value = null;
        }
        loading.value = false;
        resolve();
      });
      // Optionally handle unmounting but normally initAuth runs once globally
    });
    return initPromise;
  }

  return {
    firebaseUser,
    session,
    loading,
    signingIn,
    error,
    isAuthenticated,
    isAdmin,
    canManageAccess,
    canManageTeachers,
    canManageSchedules,
    canManageIncidences,
    canManageExtras,
    canPreviewPayroll,
    canViewPayroll,
    canCalculatePayroll,
    canFinalizePayroll,
    canManageCalendar,
    canManageCatalogs,
    canExportFinance,
    canFinanceWorkflow,
    canViewFinanceReports,
    canViewFiscal,
    canManageFiscal,
    canViewFiscalDocuments,
    canManageFiscalDocuments,
    canViewFiscalRecords,
    canManageFiscalRecords,
    canExportTeacherHistory,
    canViewAudit,
    canViewTeachers,
    login,
    logout,
    initAuth,
    loadProtectedData
  };
});
