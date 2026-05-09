import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

type RoutePermission =
  | 'canViewTeachers'
  | 'canViewFiscalRecords'
  | 'canManageSchedules'
  | 'canManageIncidences'
  | 'canManageExtras'
  | 'canViewPayroll'
  | 'canViewFinanceReports'
  | 'canManageCalendar'
  | 'canManageCatalogs'
  | 'canManageAccess'
  | 'canViewAudit';

function hasRoutePermission(authStore: ReturnType<typeof useAuthStore>, permission: RoutePermission) {
  return Boolean(authStore[permission]);
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresGuest: true }
    },
    {
      path: '/',
      component: () => import('../components/layout/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('../views/DashboardView.vue')
        },
        // We will create these views later. Pointing to dummy for now or App.vue
        {
          path: 'docentes',
          name: 'teachers',
          component: () => import('../views/TeachersView.vue'),
          meta: { permission: 'canViewTeachers' }
        },
        {
          path: 'expediente-fiscal',
          name: 'fiscalRecords',
          component: () => import('../views/FiscalRecordsView.vue'),
          meta: { permission: 'canViewFiscalRecords' }
        },
        {
          path: 'horarios',
          name: 'schedules',
          component: () => import('../views/SchedulesView.vue'),
          meta: { permission: 'canManageSchedules' }
        },
        {
          path: 'incidencias',
          name: 'incidences',
          component: () => import('../views/IncidencesView.vue'),
          meta: { permission: 'canManageIncidences' }
        },
        {
          path: 'extras',
          name: 'extras',
          component: () => import('../views/ExtrasView.vue'),
          meta: { permission: 'canManageExtras' }
        },
        {
          path: 'nomina',
          name: 'payroll',
          component: () => import('../views/PayrollView.vue'),
          meta: { permission: 'canViewPayroll' }
        },
        {
          path: 'finanzas',
          name: 'financeReports',
          component: () => import('../views/FinanceReportsView.vue'),
          meta: { permission: 'canViewFinanceReports' }
        },
        {
          path: 'calendario',
          name: 'calendar',
          component: () => import('../views/CalendarView.vue'),
          meta: { permission: 'canManageCalendar' }
        },
        {
          path: 'catalogos',
          name: 'catalogs',
          component: () => import('../views/CatalogsView.vue'),
          meta: { permission: 'canManageCatalogs' }
        },
        {
          path: 'accesos',
          name: 'access',
          component: () => import('../views/AccessView.vue'),
          meta: { permission: 'canManageAccess' }
        },
        {
          path: 'auditoria',
          name: 'audit',
          component: () => import('../views/AuditView.vue'),
          meta: { permission: 'canViewAudit' }
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'dashboard' }
    }
  ]
});

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();
  
  // Wait for auth init if refreshing page
  if (authStore.loading) {
    await authStore.initAuth();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login' });
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next({ name: 'dashboard' });
  } else {
    const requiredPermission = to.matched
      .map((record) => record.meta.permission)
      .find(Boolean) as RoutePermission | undefined;

    if (requiredPermission && !hasRoutePermission(authStore, requiredPermission)) {
      next({ name: 'dashboard' });
      return;
    }

    next();
  }
});

export default router;
