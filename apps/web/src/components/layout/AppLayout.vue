<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import {
  WalletCards,
  X,
  LayoutDashboard,
  Users,
  UserCog,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  BadgePlus,
  CircleDollarSign,
  Database,
  Menu,
  LogOut
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const menuOpen = ref(false);

const initials = computed(() => {
  const base = authStore.session?.displayName || authStore.firebaseUser?.displayName || 'ND';
  const parts = base.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
});

const roleLabel = computed(() => {
  const role = authStore.session?.role;
  if (role === 'admin') return 'Administrador';
  if (role === 'finanzas') return 'Finanzas';
  if (role === 'contador') return 'Contador';
  if (role === 'contabilidad') return 'Contabilidad';
  return 'Coordinador';
});

const pageTitle = computed(() => {
  if (route.name === 'teachers') return 'Directorio Docente';
  if (route.name === 'schedules') return 'Capturar Horarios';
  if (route.name === 'incidences') return 'Capturar Incidencias';
  if (route.name === 'extras') return 'Capturar Extras';
  if (route.name === 'payroll') return 'Nomina';
  if (route.name === 'calendar') return 'Calendario Operativo';
  if (route.name === 'access') return 'Control de Accesos';
  return 'Centro de control';
});

async function handleLogout() {
  await authStore.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <section class="workspace">
    <div v-if="menuOpen" class="screen-scrim" @click="menuOpen = false"></div>
    <aside class="sidebar" :class="{ open: menuOpen }">
      <div class="sidebar-brand">
        <div class="sidebar-brand-main">
          <div class="brand-icon"><WalletCards :size="24" /></div>
          <div>
            <strong>Nomina Docente</strong>
            <span>Panel ejecutivo</span>
          </div>
        </div>
        <button class="sidebar-close" type="button" title="Cerrar menu" @click="menuOpen = false">
          <X :size="19" />
        </button>
      </div>

      <nav class="nav-list" aria-label="Modulos">
        <router-link
          :to="{ name: 'dashboard' }"
          class="nav-item"
          active-class="active"
          @click="menuOpen = false"
        >
          <LayoutDashboard :size="18" />
          Dashboard
        </router-link>
        
        <router-link
          v-if="authStore.canViewTeachers"
          :to="{ name: 'teachers' }"
          class="nav-item"
          active-class="active"
          @click="menuOpen = false"
        >
          <Users :size="18" />
          Directorio
        </router-link>
        
        <router-link
          v-if="authStore.canManageAccess"
          :to="{ name: 'access' }"
          class="nav-item"
          active-class="active"
          @click="menuOpen = false"
        >
          <UserCog :size="18" />
          Accesos
        </router-link>
        
        <router-link
          v-if="authStore.canManageSchedules"
          :to="{ name: 'schedules' }"
          class="nav-item"
          active-class="active"
          @click="menuOpen = false"
        >
          <CalendarClock :size="18" />
          Horarios
        </router-link>

        <router-link
          v-if="authStore.canManageIncidences"
          :to="{ name: 'incidences' }"
          class="nav-item"
          active-class="active"
          @click="menuOpen = false"
        >
          <ClipboardCheck :size="18" />
          Incidencias
        </router-link>

        <router-link
          v-if="authStore.canManageExtras"
          :to="{ name: 'extras' }"
          class="nav-item"
          active-class="active"
          @click="menuOpen = false"
        >
          <BadgePlus :size="18" />
          Extras
        </router-link>
        
        <router-link
          v-if="authStore.canViewPayroll"
          :to="{ name: 'payroll' }"
          class="nav-item"
          active-class="active"
          @click="menuOpen = false"
        >
          <CircleDollarSign :size="18" />
          Nomina
        </router-link>

        <router-link
          v-if="authStore.canManageCalendar"
          :to="{ name: 'calendar' }"
          class="nav-item"
          active-class="active"
          @click="menuOpen = false"
        >
          <CalendarDays :size="18" />
          Calendario
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <Database :size="17" />
        <span>Cloud SQL PostgreSQL</span>
      </div>
    </aside>

    <div class="content" @click="menuOpen = false">
      <header class="topbar">
        <div class="title-row">
          <button class="icon-button menu-button" type="button" title="Abrir menu" @click.stop="menuOpen = true">
            <Menu :size="20" />
          </button>
          <div>
            <p class="eyebrow">Operacion academica y financiera</p>
            <h2>{{ pageTitle }}</h2>
          </div>
        </div>
        <div class="user-menu" v-if="authStore.session">
          <div class="avatar">{{ initials }}</div>
          <div class="user-text">
            <strong>{{ authStore.session.displayName }}</strong>
            <span>{{ roleLabel }} - {{ authStore.session.email }}</span>
          </div>
          <button class="icon-button" type="button" title="Cerrar sesion" @click="handleLogout">
            <LogOut :size="18" />
          </button>
        </div>
      </header>

      <router-view></router-view>
      
    </div>
  </section>
</template>
