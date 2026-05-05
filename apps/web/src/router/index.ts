import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

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
          component: () => import('../views/TeachersView.vue')
        },
        {
          path: 'horarios',
          name: 'schedules',
          component: () => import('../views/SchedulesView.vue')
        },
        {
          path: 'incidencias',
          name: 'incidences',
          component: () => import('../views/IncidencesView.vue')
        },
        {
          path: 'extras',
          name: 'extras',
          component: () => import('../views/ExtrasView.vue')
        },
        {
          path: 'nomina',
          name: 'payroll',
          component: () => import('../views/PayrollView.vue')
        },
        {
          path: 'calendario',
          name: 'calendar',
          component: () => import('../views/CalendarView.vue')
        },
        {
          path: 'accesos',
          name: 'access',
          component: () => import('../views/AccessView.vue')
        }
      ]
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
    next();
  }
});

export default router;
