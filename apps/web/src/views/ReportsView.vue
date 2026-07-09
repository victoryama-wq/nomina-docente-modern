<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert
} from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import {
  downloadOperationalBaseExtraReport,
  downloadOperationalCategoryHoursReport,
  fetchOperationalReportCycles,
  fetchOperationalReportPayrollPeriods,
  fetchOperationalBaseExtraReport,
  fetchOperationalCategoryHoursReport,
  type BaseExtraReportFilters,
  type BaseExtraReportRow,
  type BaseExtraReportTypeFilter,
  type CategoryHoursReportFilters,
  type CategoryHoursReportRow,
  type CategoryHoursStatusFilter,
  type ExportFormat,
  type OperationalReportCycleFilterOption,
  type OperationalReportPayrollPeriodOption,
  type OperationalReportSourceFilter
} from '../api';

type ReportTab = 'base-extra' | 'category-hours';

interface BaseExtraForm {
  cycleId: string;
  calendarConfigId: string;
  category: string;
  type: BaseExtraReportTypeFilter;
  q: string;
}

interface CategoryHoursForm {
  cycleId: string;
  category: string;
  status: CategoryHoursStatusFilter;
  teacherStatus: string;
  q: string;
}

const authStore = useAuthStore();

const activeTab = ref<ReportTab>('base-extra');
const loadingBaseExtra = ref(false);
const loadingCategoryHours = ref(false);
const loadingFilters = ref(false);
const exporting = ref('');
const errorMessage = ref('');
const noticeMessage = ref('');

const baseExtraRows = ref<BaseExtraReportRow[]>([]);
const categoryHoursRows = ref<CategoryHoursReportRow[]>([]);
const cycleOptions = ref<OperationalReportCycleFilterOption[]>([]);
const payrollPeriodOptions = ref<OperationalReportPayrollPeriodOption[]>([]);

const baseExtraFilters = reactive<BaseExtraForm>({
  cycleId: '',
  calendarConfigId: '',
  category: '',
  type: 'all',
  q: ''
});

const categoryHoursFilters = reactive<CategoryHoursForm>({
  cycleId: '',
  category: '',
  status: 'all',
  teacherStatus: '',
  q: ''
});

const canViewBaseExtra = computed(() => authStore.canViewOperationalBaseExtraReports);
const canViewCategoryHours = computed(() => authStore.canViewOperationalCategoryHoursReports);
const canViewAnyReport = computed(() => canViewBaseExtra.value || canViewCategoryHours.value);

const availableTabs = computed(() => {
  const tabs: Array<{ id: ReportTab; label: string; description: string }> = [];
  if (canViewBaseExtra.value) {
    tabs.push({
      id: 'base-extra',
      label: 'Horas base y extras',
      description: 'Base, extras de incidencia y extras externos por periodo.'
    });
  }
  if (canViewCategoryHours.value) {
    tabs.push({
      id: 'category-hours',
      label: 'Horas base por categoria',
      description: 'Carga asignada por docente contra horas oficiales del ciclo.'
    });
  }
  return tabs;
});

watch(
  availableTabs,
  (tabs) => {
    if (!tabs.some((tab) => tab.id === activeTab.value)) {
      activeTab.value = tabs[0]?.id || 'base-extra';
    }
  },
  { immediate: true }
);

const baseExtraSummary = computed(() => {
  const teacherIds = new Set(baseExtraRows.value.map((row) => row.teacherId));
  const incidenceExtras = sumHours(baseExtraRows.value.map((row) => row.incidenceExtraHours));
  const externalExtras = sumHours(baseExtraRows.value.map((row) => row.externalExtraHours));
  return {
    records: baseExtraRows.value.length,
    teachers: teacherIds.size,
    baseHours: sumHours(baseExtraRows.value.map((row) => row.baseHours)),
    incidenceExtras,
    externalExtras,
    totalExtras: incidenceExtras + externalExtras
  };
});

const categoryHoursSummary = computed(() => {
  const positiveRemaining = categoryHoursRows.value
    .map((row) => Number(row.remainingHours || 0))
    .filter((value) => value > 0)
    .reduce((sum, value) => sum + value, 0);
  const excess = categoryHoursRows.value
    .map((row) => Number(row.remainingHours || 0))
    .filter((value) => value < 0)
    .reduce((sum, value) => sum + Math.abs(value), 0);
  return {
    teachers: new Set(categoryHoursRows.value.map((row) => row.teacherId)).size,
    completo: categoryHoursRows.value.filter((row) => row.status === 'completo').length,
    faltante: categoryHoursRows.value.filter((row) => row.status === 'faltante').length,
    excedido: categoryHoursRows.value.filter((row) => row.status === 'excedido').length,
    remaining: positiveRemaining,
    excess
  };
});

function compactFilters<T extends Record<string, string>>(filters: T) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '')
  ) as Partial<T>;
}

function baseExtraPayload(): BaseExtraReportFilters {
  return {
    ...(compactFilters(baseExtraFilters) as BaseExtraReportFilters),
    source: 'auto' as OperationalReportSourceFilter
  };
}

function categoryHoursPayload(): CategoryHoursReportFilters {
  return compactFilters(categoryHoursFilters) as CategoryHoursReportFilters;
}

function sumHours(values: string[]) {
  return values.reduce((sum, value) => sum + Number(value || 0), 0);
}

function formatHours(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return amount.toLocaleString('es-MX', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function sourceLabel(source: string) {
  return source === 'snapshot' ? 'Nomina guardada' : 'Datos vivos';
}

function statusLabel(status: CategoryHoursReportRow['status']) {
  if (status === 'completo') return 'Completo';
  if (status === 'faltante') return 'Faltante';
  return 'Excedido';
}

function resetMessages() {
  errorMessage.value = '';
  noticeMessage.value = '';
}

async function loadBaseExtraReport() {
  resetMessages();
  loadingBaseExtra.value = true;
  try {
    const result = await fetchOperationalBaseExtraReport(baseExtraPayload());
    baseExtraRows.value = result.rows;
    noticeMessage.value = result.rows.length ? 'Reporte actualizado.' : '';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No fue posible consultar el reporte.';
  } finally {
    loadingBaseExtra.value = false;
  }
}

async function loadCategoryHoursReport() {
  resetMessages();
  if (!categoryHoursFilters.cycleId.trim()) {
    errorMessage.value = 'Selecciona un ciclo para consultar horas por categoria.';
    return;
  }
  loadingCategoryHours.value = true;
  try {
    const result = await fetchOperationalCategoryHoursReport(categoryHoursPayload());
    categoryHoursRows.value = result.rows;
    noticeMessage.value = result.rows.length ? 'Reporte actualizado.' : '';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No fue posible consultar el reporte.';
  } finally {
    loadingCategoryHours.value = false;
  }
}

async function exportBaseExtra(format: ExportFormat) {
  resetMessages();
  exporting.value = `base-extra-${format}`;
  try {
    await downloadOperationalBaseExtraReport(baseExtraPayload(), format);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No fue posible descargar el reporte.';
  } finally {
    exporting.value = '';
  }
}

async function exportCategoryHours(format: ExportFormat) {
  resetMessages();
  if (!categoryHoursFilters.cycleId.trim()) {
    errorMessage.value = 'Selecciona un ciclo antes de exportar.';
    return;
  }
  exporting.value = `category-hours-${format}`;
  try {
    await downloadOperationalCategoryHoursReport(categoryHoursPayload(), format);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No fue posible descargar el reporte.';
  } finally {
    exporting.value = '';
  }
}

function clearBaseExtraFilters() {
  Object.assign(baseExtraFilters, {
    cycleId: '',
    calendarConfigId: '',
    category: '',
    type: 'all',
    q: ''
  });
  payrollPeriodOptions.value = [];
  baseExtraRows.value = [];
  resetMessages();
}

function clearCategoryHoursFilters() {
  Object.assign(categoryHoursFilters, {
    cycleId: '',
    category: '',
    status: 'all',
    teacherStatus: '',
    q: ''
  });
  categoryHoursRows.value = [];
  resetMessages();
}

async function loadPayrollPeriodsForCycle(cycleId: string) {
  if (!cycleId || !canViewBaseExtra.value) {
    payrollPeriodOptions.value = [];
    return;
  }
  try {
    const result = await fetchOperationalReportPayrollPeriods(cycleId);
    payrollPeriodOptions.value = result.periods;
  } catch (error) {
    payrollPeriodOptions.value = [];
    errorMessage.value = error instanceof Error ? error.message : 'No fue posible cargar quincenas guardadas.';
  }
}

async function loadFilterOptions() {
  if (!canViewAnyReport.value) return;
  loadingFilters.value = true;
  try {
    const result = await fetchOperationalReportCycles();
    cycleOptions.value = result.cycles;
    const defaultCycle = result.cycles.find((cycle) => cycle.status === 'ACTIVO') || result.cycles[0] || null;
    if (defaultCycle) {
      if (!baseExtraFilters.cycleId) baseExtraFilters.cycleId = defaultCycle.id;
      if (!categoryHoursFilters.cycleId) categoryHoursFilters.cycleId = defaultCycle.id;
      if (canViewBaseExtra.value) await loadPayrollPeriodsForCycle(baseExtraFilters.cycleId);
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No fue posible cargar filtros de reportes.';
  } finally {
    loadingFilters.value = false;
  }
}

watch(
  () => baseExtraFilters.cycleId,
  async (cycleId, previousCycleId) => {
    if (cycleId === previousCycleId) return;
    baseExtraFilters.calendarConfigId = '';
    await loadPayrollPeriodsForCycle(cycleId);
  }
);

onMounted(() => {
  void loadFilterOptions();
});
</script>

<template>
  <div class="reports-view">
    <section class="reports-header">
      <div>
        <p class="eyebrow">Reportes operativos</p>
        <h1>Reportes</h1>
        <p>Consulta operativa de horas base, horas extra y carga por categoria.</p>
      </div>
      <div class="header-icon">
        <BarChart3 :size="26" />
      </div>
    </section>

    <section v-if="!canViewAnyReport" class="blocked-panel" data-testid="reports-denied">
      <ShieldAlert :size="30" />
      <div>
        <p class="eyebrow">Acceso restringido</p>
        <h2>No tienes reportes operativos disponibles.</h2>
        <span>El modulo Reportes solo se muestra a roles aprobados para H18.</span>
      </div>
    </section>

    <template v-else>
      <section class="tabs" aria-label="Pestanas de reportes">
        <button
          v-for="tab in availableTabs"
          :key="tab.id"
          type="button"
          class="tab-button"
          :class="{ active: activeTab === tab.id }"
          :data-testid="`tab-${tab.id}`"
          @click="activeTab = tab.id"
        >
          <strong>{{ tab.label }}</strong>
          <span>{{ tab.description }}</span>
        </button>
      </section>

      <div v-if="errorMessage" class="notice error" role="alert">
        <AlertTriangle :size="18" />
        {{ errorMessage }}
      </div>
      <div v-else-if="noticeMessage" class="notice ok" role="status">
        <Search :size="18" />
        {{ noticeMessage }}
      </div>

      <section v-if="activeTab === 'base-extra'" class="report-panel" data-testid="base-extra-panel">
        <div class="section-title">
          <div>
            <p class="eyebrow">Pestana 1</p>
            <h2>Horas base y extras</h2>
          </div>
          <span class="scope-badge">Admin / Direccion</span>
        </div>

        <div class="filter-grid">
          <label>
            Ciclo / cuatrimestre
            <select v-model="baseExtraFilters.cycleId" data-testid="base-extra-cycle-select" :disabled="loadingFilters">
              <option value="">Ciclo activo automatico</option>
              <option v-for="cycle in cycleOptions" :key="cycle.id" :value="cycle.id">
                {{ cycle.label }}
              </option>
            </select>
          </label>
          <label>
            Quincena guardada
            <select
              v-model="baseExtraFilters.calendarConfigId"
              data-testid="base-extra-period-select"
              :disabled="!baseExtraFilters.cycleId || loadingFilters"
            >
              <option value="">Consulta viva del ciclo</option>
              <option v-for="period in payrollPeriodOptions" :key="period.calendarConfigId" :value="period.calendarConfigId">
                {{ period.label }}
              </option>
            </select>
          </label>
          <label class="wide">
            Busqueda general
            <input
              v-model.trim="baseExtraFilters.q"
              data-testid="base-extra-search"
              placeholder="Buscar docente, coordinacion o capturador"
            />
          </label>
          <label>
            Categoria
            <select v-model="baseExtraFilters.category">
              <option value="">Todas</option>
              <option value="V">VIP</option>
              <option value="M">Medio tiempo</option>
              <option value="N">Nuevo ingreso</option>
            </select>
          </label>
          <label>
            Tipo
            <select v-model="baseExtraFilters.type">
              <option value="all">Todos</option>
              <option value="withExtras">Con extras</option>
              <option value="withoutExtras">Sin extras</option>
            </select>
          </label>
        </div>

        <div class="actions-row">
          <button
            type="button"
            class="secondary-action"
            data-testid="base-extra-query"
            :disabled="loadingBaseExtra"
            @click="loadBaseExtraReport"
          >
            <RefreshCw :size="17" />
            {{ loadingBaseExtra ? 'Consultando...' : 'Consultar' }}
          </button>
          <button type="button" class="ghost-action" @click="clearBaseExtraFilters">Limpiar filtros</button>
          <button
            type="button"
            class="export-action"
            data-testid="base-extra-export-csv"
            :disabled="!!exporting"
            @click="exportBaseExtra('csv')"
          >
            <Download :size="17" />
            CSV
          </button>
          <button
            type="button"
            class="export-action"
            data-testid="base-extra-export-xlsx"
            :disabled="!!exporting"
            @click="exportBaseExtra('xlsx')"
          >
            <FileSpreadsheet :size="17" />
            Excel
          </button>
        </div>

        <div class="summary-grid">
          <article>
            <span>Registros</span>
            <strong>{{ baseExtraSummary.records }}</strong>
            <small>{{ baseExtraSummary.teachers }} docentes</small>
          </article>
          <article>
            <span>Horas base</span>
            <strong>{{ formatHours(baseExtraSummary.baseHours) }}</strong>
          </article>
          <article>
            <span>Extras incidencia</span>
            <strong>{{ formatHours(baseExtraSummary.incidenceExtras) }}</strong>
          </article>
          <article>
            <span>Extras externos</span>
            <strong>{{ formatHours(baseExtraSummary.externalExtras) }}</strong>
          </article>
          <article>
            <span>Total extras</span>
            <strong>{{ formatHours(baseExtraSummary.totalExtras) }}</strong>
          </article>
        </div>

        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Origen</th>
                <th>Ciclo</th>
                <th>Periodo</th>
                <th>Docente</th>
                <th>Categoria</th>
                <th>Coordinacion</th>
                <th>Horas base</th>
                <th>Extras incidencia</th>
                <th>Extras externos</th>
                <th>Total extras</th>
                <th>Capturador extra externo</th>
                <th>Responsable incidencia</th>
                <th>Motivo / referencia</th>
                <th>Fecha actividad</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!loadingBaseExtra && !baseExtraRows.length">
                <td colspan="14" class="empty-cell">No hay datos con el filtro actual.</td>
              </tr>
              <tr v-for="row in baseExtraRows" :key="`${row.source}-${row.teacherId}-${row.coordinationId}-${row.reason}`">
                <td><span class="pill">{{ sourceLabel(row.source) }}</span></td>
                <td>{{ row.cycleLabel }}</td>
                <td>{{ row.periodLabel || '-' }}</td>
                <td><strong>{{ row.teacherName }}</strong></td>
                <td>{{ row.categoryLabel }}</td>
                <td>{{ row.coordinationName || '-' }}</td>
                <td>{{ formatHours(row.baseHours) }}</td>
                <td>{{ formatHours(row.incidenceExtraHours) }}</td>
                <td>{{ formatHours(row.externalExtraHours) }}</td>
                <td>{{ formatHours(row.totalExtraHours) }}</td>
                <td>{{ row.externalExtraCapturedByName || row.externalExtraCapturedByEmail || '-' }}</td>
                <td>
                  {{ row.incidenceUpdatedByName || row.incidenceUpdatedByEmail || '-' }}
                  <small v-if="row.incidenceUpdatedByName || row.incidenceUpdatedByEmail">updated_by registrado</small>
                </td>
                <td>{{ row.reason || '-' }}</td>
                <td>{{ row.activityDate || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="activeTab === 'category-hours'" class="report-panel" data-testid="category-hours-panel">
        <div class="section-title">
          <div>
            <p class="eyebrow">Pestana 2</p>
            <h2>Horas base por categoria</h2>
          </div>
          <span class="scope-badge">Admin / Direccion / Coordinador / RH</span>
        </div>

        <div class="filter-grid category">
          <label>
            Ciclo / cuatrimestre *
            <select v-model="categoryHoursFilters.cycleId" data-testid="category-cycle-select" :disabled="loadingFilters">
              <option value="">Selecciona ciclo</option>
              <option v-for="cycle in cycleOptions" :key="cycle.id" :value="cycle.id">
                {{ cycle.label }}
              </option>
            </select>
          </label>
          <label class="wide">
            Busqueda general
            <input
              v-model.trim="categoryHoursFilters.q"
              data-testid="category-hours-search"
              placeholder="Buscar docente o coordinacion"
            />
          </label>
          <label>
            Categoria
            <select v-model="categoryHoursFilters.category">
              <option value="">Todas</option>
              <option value="V">VIP</option>
              <option value="M">Medio tiempo</option>
              <option value="N">Nuevo ingreso</option>
            </select>
          </label>
          <label>
            Estado
            <select v-model="categoryHoursFilters.status">
              <option value="all">Todos</option>
              <option value="completo">Completo</option>
              <option value="faltante">Faltante</option>
              <option value="excedido">Excedido</option>
            </select>
          </label>
          <label>
            Estatus docente
            <select v-model="categoryHoursFilters.teacherStatus">
              <option value="">Todos</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </label>
        </div>

        <div class="actions-row">
          <button
            type="button"
            class="secondary-action"
            data-testid="category-hours-query"
            :disabled="loadingCategoryHours"
            @click="loadCategoryHoursReport"
          >
            <RefreshCw :size="17" />
            {{ loadingCategoryHours ? 'Consultando...' : 'Consultar' }}
          </button>
          <button type="button" class="ghost-action" @click="clearCategoryHoursFilters">Limpiar filtros</button>
          <button
            type="button"
            class="export-action"
            data-testid="category-hours-export-csv"
            :disabled="!!exporting"
            @click="exportCategoryHours('csv')"
          >
            <Download :size="17" />
            CSV
          </button>
          <button
            type="button"
            class="export-action"
            data-testid="category-hours-export-xlsx"
            :disabled="!!exporting"
            @click="exportCategoryHours('xlsx')"
          >
            <FileSpreadsheet :size="17" />
            Excel
          </button>
        </div>

        <div class="summary-grid">
          <article>
            <span>Docentes</span>
            <strong>{{ categoryHoursSummary.teachers }}</strong>
          </article>
          <article>
            <span>Completos</span>
            <strong>{{ categoryHoursSummary.completo }}</strong>
          </article>
          <article>
            <span>Faltantes</span>
            <strong>{{ categoryHoursSummary.faltante }}</strong>
          </article>
          <article>
            <span>Excedidos</span>
            <strong>{{ categoryHoursSummary.excedido }}</strong>
          </article>
          <article>
            <span>Horas restantes</span>
            <strong>{{ formatHours(categoryHoursSummary.remaining) }}</strong>
            <small>Excedente {{ formatHours(categoryHoursSummary.excess) }}</small>
          </article>
        </div>

        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Ciclo</th>
                <th>Docente</th>
                <th>Categoria</th>
                <th>Horas esperadas</th>
                <th>Horas asignadas</th>
                <th>Horas restantes</th>
                <th>Estado</th>
                <th>Horas L-V</th>
                <th>Horas modulo 1</th>
                <th>Horas modulo 2</th>
                <th>Coordinacion</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!loadingCategoryHours && !categoryHoursRows.length">
                <td colspan="11" class="empty-cell">Captura un ciclo y consulta el reporte.</td>
              </tr>
              <tr v-for="row in categoryHoursRows" :key="`${row.teacherId}-${row.coordinationId}`">
                <td>{{ row.cycleLabel }}</td>
                <td><strong>{{ row.teacherName }}</strong></td>
                <td>{{ row.categoryLabel }}</td>
                <td>{{ formatHours(row.expectedHours) }}</td>
                <td>{{ formatHours(row.assignedHours) }}</td>
                <td>{{ formatHours(row.remainingHours) }}</td>
                <td><span class="pill" :class="row.status">{{ statusLabel(row.status) }}</span></td>
                <td>{{ formatHours(row.hoursLv) }}</td>
                <td>{{ formatHours(row.hoursModule1) }}</td>
                <td>{{ formatHours(row.hoursModule2) }}</td>
                <td>{{ row.coordinationName || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="method-note">
        <Layers :size="19" />
        <div>
          <strong>Alcance H18</strong>
          <span>Los reportes no incluyen datos fiscales y las exportaciones Excel se generan en API. CSV H11 permanece como respaldo.</span>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.reports-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.reports-header,
.report-panel,
.blocked-panel,
.method-note {
  background: #ffffff;
  border: 1px solid #d7e0ee;
  border-radius: 8px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

.reports-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.35rem 1.5rem;
}

.reports-header h1,
.section-title h2,
.blocked-panel h2 {
  margin: 0;
  color: #081a3a;
}

.reports-header p {
  margin: 0.35rem 0 0;
  color: #53627a;
}

.eyebrow {
  margin: 0 0 0.3rem;
  color: #526987;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.header-icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  color: #075e78;
  background: #e2f5ff;
  border-radius: 8px;
}

.blocked-panel,
.method-note {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
}

.blocked-panel {
  color: #6b1d1d;
  background: #fff7f7;
}

.blocked-panel span,
.method-note span {
  display: block;
  color: #53627a;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.75rem;
}

.tab-button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  min-height: 5rem;
  padding: 1rem;
  color: #25324a;
  text-align: left;
  background: #ffffff;
  border: 1px solid #cad7e8;
  border-radius: 8px;
  cursor: pointer;
}

.tab-button.active {
  color: #053e53;
  border-color: #0c7c84;
  box-shadow: inset 0 0 0 1px #0c7c84;
}

.tab-button span {
  color: #607089;
  font-size: 0.88rem;
}

.notice {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  border-radius: 8px;
  font-weight: 700;
}

.notice.error {
  color: #7f1d1d;
  background: #fee2e2;
}

.notice.ok {
  color: #065f46;
  background: #d1fae5;
}

.report-panel {
  padding: 1.25rem;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.scope-badge,
.pill {
  display: inline-flex;
  align-items: center;
  min-height: 1.65rem;
  padding: 0.25rem 0.6rem;
  color: #0f3d56;
  font-size: 0.78rem;
  font-weight: 800;
  background: #eaf7fb;
  border-radius: 999px;
}

.pill.completo {
  color: #075985;
  background: #e0f2fe;
}

.pill.faltante {
  color: #92400e;
  background: #fef3c7;
}

.pill.excedido {
  color: #991b1b;
  background: #fee2e2;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0.85rem;
}

.filter-grid.category {
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
}

.filter-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: #334155;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
}

.filter-grid label.wide {
  grid-column: span 2;
}

.filter-grid input,
.filter-grid select {
  min-height: 2.75rem;
  width: 100%;
  padding: 0 0.75rem;
  color: #10213f;
  font: inherit;
  background: #ffffff;
  border: 1px solid #c9d6e8;
  border-radius: 8px;
  text-transform: none;
}

.actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin: 1rem 0;
}

.secondary-action,
.ghost-action,
.export-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.55rem;
  padding: 0 0.95rem;
  color: #10213f;
  font-weight: 800;
  background: #ffffff;
  border: 1px solid #c9d6e8;
  border-radius: 8px;
  cursor: pointer;
}

.secondary-action,
.export-action {
  color: #ffffff;
  background: #0f766e;
  border-color: #0f766e;
}

.ghost-action {
  background: #f8fafc;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.summary-grid article {
  min-height: 5.25rem;
  padding: 0.9rem;
  background: #f8fafc;
  border: 1px solid #dce5f2;
  border-radius: 8px;
}

.summary-grid span,
.summary-grid small {
  display: block;
  color: #607089;
  font-weight: 700;
}

.summary-grid strong {
  display: block;
  margin-top: 0.35rem;
  color: #071733;
  font-size: 1.65rem;
}

.table-shell {
  overflow: auto;
  border: 1px solid #d7e0ee;
  border-radius: 8px;
}

table {
  width: 100%;
  min-width: 1120px;
  border-collapse: collapse;
  background: #ffffff;
}

th,
td {
  padding: 0.8rem;
  color: #27364d;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

th {
  color: #32435c;
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
  background: #f8fafc;
}

td strong,
td small {
  display: block;
}

td small {
  margin-top: 0.25rem;
  color: #64748b;
}

.empty-cell {
  height: 5rem;
  color: #607089;
  font-weight: 800;
  text-align: center;
}

.method-note {
  color: #0f3d56;
  background: #f8fbff;
}

@media (max-width: 780px) {
  .reports-header,
  .section-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .actions-row button {
    flex: 1 1 46%;
  }

  .filter-grid label.wide {
    grid-column: span 1;
  }
}
</style>
