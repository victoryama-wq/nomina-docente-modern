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
  const isAdmin = computed(() => session.value?.role === 'admin');
  
  // Computed permissions helpers
  const canManageAccess = computed(() => session.value?.permissions?.includes('access.manage') || false);
  const canManageTeachers = computed(() => session.value?.permissions?.includes('teachers.manage') || false);
  const canManageSchedules = computed(() => session.value?.permissions?.includes('schedules.manage') || false);
  const canManageIncidences = computed(() => session.value?.permissions?.includes('incidences.manage') || false);
  const canManageExtras = computed(() => session.value?.permissions?.includes('extras.manage') || false);
  const canViewPayroll = computed(() => session.value?.permissions?.includes('payroll.view') || false);
  const canCalculatePayroll = computed(() => session.value?.permissions?.includes('payroll.calculate') || false);
  const canManageCalendar = computed(() => session.value?.permissions?.includes('calendar.manage') || false);
  const canExportTeacherHistory = computed(() => session.value?.permissions?.includes('audit.view') || false);
  const canViewTeachers = computed(() => 
    canManageTeachers.value || 
    session.value?.permissions?.includes('finance.view') || 
    session.value?.permissions?.includes('reports.view') || 
    false
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
      error.value = err instanceof Error ? err.message : 'No fue posible iniciar sesion.';
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
    canViewPayroll,
    canCalculatePayroll,
    canManageCalendar,
    canExportTeacherHistory,
    canViewTeachers,
    login,
    logout,
    initAuth,
    loadProtectedData
  };
});
