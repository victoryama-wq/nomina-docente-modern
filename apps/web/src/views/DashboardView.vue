<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchDashboardOverview, fetchHealth, type DashboardMetrics } from '../api';
import {
  BadgeCheck,
  GraduationCap,
  CalendarClock,
  Activity,
  ShieldCheck,
  FolderLock,
  UserCog,
  PlusCircle,
  CircleDollarSign,
  FileSpreadsheet
} from 'lucide-vue-next';

type ModuleStatus = 'Disponible' | 'Preparando' | 'Migracion';

interface ModuleItem {
  name: string;
  description: string;
  status: ModuleStatus;
  icon: unknown;
  accent: string;
}

const modules: ModuleItem[] = [
  {
    name: 'Directorio Docente',
    description: 'Expediente, estatus, datos fiscales y coordinacion.',
    status: 'Disponible',
    icon: GraduationCap,
    accent: 'teal'
  },
  {
    name: 'Control de Accesos',
    description: 'Usuarios autorizados, roles y super admin protegido.',
    status: 'Disponible',
    icon: UserCog,
    accent: 'blue'
  },
  {
    name: 'Horarios',
    description: 'Carga por ciclo con docentes activos.',
    status: 'Disponible',
    icon: CalendarClock,
    accent: 'amber'
  },
  {
    name: 'Extras',
    description: 'Horas adicionales solo para docentes activos.',
    status: 'Disponible',
    icon: PlusCircle,
    accent: 'emerald'
  },
  {
    name: 'Nomina',
    description: 'Motor de calculo y comparacion contra legacy.',
    status: 'Disponible',
    icon: CircleDollarSign,
    accent: 'indigo'
  },
  {
    name: 'Reportes',
    description: 'Exportaciones, historicos y vista financiera.',
    status: 'Disponible',
    icon: FileSpreadsheet,
    accent: 'cyan'
  }
];

const metrics = ref<DashboardMetrics>({
  teachers: 0,
  activeTeachers: 0,
  schedules: 0,
  extraHoursRecords: 0,
  activeUsers: 0
});
const health = ref<{ ok: boolean; tables: number; timestamp: string } | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const [overview, healthData] = await Promise.all([
      fetchDashboardOverview(),
      fetchHealth()
    ]);
    metrics.value = overview.metrics;
    health.value = healthData;
  } catch (e) {
    console.error('Error loading dashboard data', e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="view-stack">
    <section class="executive-strip">
      <div>
        <p class="eyebrow">Estado de plataforma</p>
        <h3>Base moderna lista para migracion controlada</h3>
        <p>
          Autenticacion con Google, roles desde PostgreSQL y estructura preparada para migrar datos desde Apps Script.
        </p>
      </div>
      <div class="status-pill">
        <BadgeCheck :size="18" />
        Acceso validado
      </div>
    </section>

    <section class="metric-grid">
      <article class="metric-card">
        <span class="metric-icon teal"><GraduationCap :size="20" /></span>
        <p>Docentes activos</p>
        <strong>{{ metrics.activeTeachers }}</strong>
        <small>{{ metrics.teachers }} docentes totales</small>
      </article>
      <article class="metric-card">
        <span class="metric-icon blue"><CalendarClock :size="20" /></span>
        <p>Horarios migrados</p>
        <strong>{{ metrics.schedules }}</strong>
        <small>Registros en base moderna</small>
      </article>
      <article class="metric-card">
        <span class="metric-icon emerald"><Activity :size="20" /></span>
        <p>Extras registrados</p>
        <strong>{{ metrics.extraHoursRecords }}</strong>
        <small>Bitacora nueva</small>
      </article>
      <article class="metric-card">
        <span class="metric-icon indigo"><ShieldCheck :size="20" /></span>
        <p>Usuarios activos</p>
        <strong>{{ metrics.activeUsers }}</strong>
        <small>{{ health?.tables || 0 }} tablas operativas</small>
      </article>
    </section>

    <section class="main-grid">
      <div class="module-board">
        <div class="section-title">
          <div>
            <p class="eyebrow">Mapa funcional</p>
            <h3>Modulos prioritarios</h3>
          </div>
          <span class="subtle-pill">Fase base</span>
        </div>

        <div class="module-grid">
          <article v-for="item in modules" :key="item.name" class="module-card" :class="item.accent">
            <component :is="item.icon" :size="22" />
            <div>
              <strong>{{ item.name }}</strong>
              <p>{{ item.description }}</p>
            </div>
            <span>{{ item.status }}</span>
          </article>
        </div>
      </div>

      <aside class="readiness-panel">
        <div class="section-title compact">
          <div>
            <p class="eyebrow">Ruta inmediata</p>
            <h3>Migracion activa</h3>
          </div>
        </div>

        <ol class="timeline">
          <li>
            <span></span>
            <div>
              <strong>Directorio y accesos</strong>
              <p>CRUD moderno con auditoria y reglas de dominio institucional.</p>
            </div>
          </li>
          <li>
            <span></span>
            <div>
              <strong>Importacion desde Sheets</strong>
              <p>CSV de Directorio y Coord. Academicos hacia PostgreSQL.</p>
            </div>
          </li>
          <li>
            <span></span>
            <div>
              <strong>Horarios</strong>
              <p>Solo docentes con estatus ACTIVO participaran en captura.</p>
            </div>
          </li>
        </ol>

        <div class="security-box">
          <FolderLock :size="20" />
          <div>
            <strong>Super admin protegido</strong>
            <p>victor.yama@tecplayacar.edu.mx no puede ser eliminado ni degradado.</p>
          </div>
        </div>
      </aside>
    </section>
  </div>
</template>
