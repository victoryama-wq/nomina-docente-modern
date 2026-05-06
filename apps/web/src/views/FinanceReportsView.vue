<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  History,
  RefreshCw,
  Search,
  ShieldAlert
} from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import {
  downloadFinanceExport,
  fetchFinanceContext,
  type CycleOption,
  type FinanceContext,
  type FinanceLine,
  type FinanceRun
} from '../api';

type FinanceTab = 'PAGOS' | 'COORDINACIONES' | 'FISCALES' | 'HISTORICO';
type PaymentFilter = 'TODOS' | 'LISTO' | 'PENDIENTE';
type ExportKind = 'payments' | 'fiscal' | 'coordinations';

const authStore = useAuthStore();

const cycles = ref<CycleOption[]>([]);
const activeCycle = ref<CycleOption | null>(null);
const runs = ref<FinanceRun[]>([]);
const selectedRun = ref<FinanceRun | null>(null);
const lines = ref<FinanceLine[]>([]);
const coordinationSummary = ref<FinanceContext['coordinationSummary']>([]);
const selectedCycleId = ref('');
const selectedRunId = ref('');
const searchText = ref('');
const activeTab = ref<FinanceTab>('PAGOS');
const paymentFilter = ref<PaymentFilter>('TODOS');
const pageBusy = ref(false);
const exporting = ref<ExportKind | ''>('');
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

const zeroSummary = () => ({
  lines: 0,
  teachers: 0,
  coordinations: 0,
  baseHours: 0,
  grossBaseAmount: 0,
  discountAmount: 0,
  totalExtraHours: 0,
  totalExtraAmount: 0,
  totalAmount: 0,
  alerts: 0,
  fiscalPending: 0,
  readyPayments: 0
});

const summary = ref(zeroSummary());

const pendingFiscalLines = computed(() => lines.value.filter((line) => line.paymentStatus === 'PENDIENTE'));

const filteredLines = computed(() => {
  const text = searchText.value.toLowerCase().trim();
  return lines.value.filter((line) => {
    const haystack = [
      line.teacherName,
      line.coordinationName,
      line.rfc,
      line.email,
      line.bankDetail,
      line.paymentType,
      line.category,
      line.fiscalMissing.join(' '),
      line.alerts.join(' ')
    ]
      .join(' ')
      .toLowerCase();
    const matchesText = !text || haystack.includes(text);
    const matchesStatus = paymentFilter.value === 'TODOS' || line.paymentStatus === paymentFilter.value;
    return matchesText && matchesStatus;
  });
});

const filteredFiscalLines = computed(() => {
  const text = searchText.value.toLowerCase().trim();
  return pendingFiscalLines.value.filter((line) => {
    if (!text) return true;
    return [
      line.teacherName,
      line.coordinationName,
      line.rfc,
      line.email,
      line.bankDetail,
      line.fiscalMissing.join(' ')
    ]
      .join(' ')
      .toLowerCase()
      .includes(text);
  });
});

function moneyLabel(value: number | string | null | undefined) {
  return (Number(value) || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN'
  });
}

function formatHours(value: number | string | null | undefined) {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const text = value.slice(0, 10);
  const [year, month, day] = text.split('-');
  if (!year || !month || !day) return text;
  return `${day}/${month}/${year}`;
}

function categoryLabel(category: string) {
  if (category === 'V') return 'VIP';
  if (category === 'M') return 'Medio tiempo';
  if (category === 'N') return 'Nuevo ingreso';
  return category || '-';
}

function paymentTypeLabel(paymentType: string) {
  if (paymentType === 'E') return 'Esquema E';
  if (paymentType === '1') return 'Pago 1';
  if (paymentType === '2') return 'Pago 2';
  return paymentType || '-';
}

function statusClass(run: FinanceRun) {
  if (run.status === 'CERRADA' || run.status === 'APROBADA') return 'ok';
  if (run.status === 'CANCELADA') return 'danger';
  return 'neutral';
}

function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
  window.setTimeout(() => {
    notice.value = null;
  }, 3200);
}

function applyContext(data: FinanceContext) {
  activeCycle.value = data.activeCycle;
  selectedCycleId.value = data.activeCycle?.id || '';
  cycles.value = data.cycles;
  runs.value = data.runs;
  selectedRun.value = data.selectedRun;
  selectedRunId.value = data.selectedRun?.id || '';
  summary.value = data.summary;
  lines.value = data.lines;
  coordinationSummary.value = data.coordinationSummary;
}

async function loadFinance(cycleId = selectedCycleId.value || undefined, runId = selectedRunId.value || undefined) {
  if (!authStore.canViewFinanceReports) return;
  pageBusy.value = true;
  notice.value = null;
  try {
    const data = await fetchFinanceContext(cycleId, runId);
    applyContext(data);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar reportes financieros.');
  } finally {
    pageBusy.value = false;
  }
}

function loadSelectedCycle() {
  selectedRunId.value = '';
  return loadFinance(selectedCycleId.value, undefined);
}

function loadSelectedRun() {
  return loadFinance(selectedCycleId.value, selectedRunId.value);
}

async function exportReport(kind: ExportKind) {
  if (!selectedRun.value) return;
  exporting.value = kind;
  notice.value = null;
  try {
    await downloadFinanceExport(kind, selectedRun.value.id, selectedCycleId.value);
    setNotice('ok', 'Exportacion financiera generada.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible exportar el reporte.');
  } finally {
    exporting.value = '';
  }
}

onMounted(() => {
  loadFinance();
});
</script>

<template>
  <div class="view-stack">
    <div v-if="notice" class="notice" :class="notice.type">
      {{ notice.text }}
    </div>

    <section class="toolbar-card">
      <div>
        <p class="eyebrow">Reportes / Finanzas</p>
        <h3>Nominas guardadas y pagos</h3>
      </div>
      <div class="toolbar-actions">
        <select v-if="cycles.length" v-model="selectedCycleId" @change="loadSelectedCycle">
          <option v-for="cycle in cycles" :key="cycle.id" :value="cycle.id">
            {{ cycle.periodLabel }} - {{ cycle.quarterCode }} / {{ cycle.status }}
          </option>
        </select>
        <select v-if="runs.length" v-model="selectedRunId" @change="loadSelectedRun">
          <option v-for="run in runs" :key="run.id" :value="run.id">
            {{ run.periodLabel }} / {{ run.status }}
          </option>
        </select>
        <button class="secondary-action" type="button" @click="loadFinance(selectedCycleId, selectedRunId)">
          <RefreshCw :size="17" :class="{ spin: pageBusy }" />
          Actualizar
        </button>
      </div>
    </section>

    <section class="metric-grid compact">
      <article class="metric-card mini">
        <p>Total a pagar</p>
        <strong>{{ moneyLabel(summary.totalAmount) }}</strong>
        <small>{{ summary.teachers }} docentes / {{ summary.coordinations }} coordinaciones</small>
      </article>
      <article class="metric-card mini">
        <p>Base</p>
        <strong>{{ formatHours(summary.baseHours) }} h</strong>
        <small>{{ moneyLabel(summary.grossBaseAmount) }} bruto</small>
      </article>
      <article class="metric-card mini">
        <p>Extras</p>
        <strong>{{ formatHours(summary.totalExtraHours) }} h</strong>
        <small>{{ moneyLabel(summary.totalExtraAmount) }}</small>
      </article>
      <article class="metric-card mini">
        <p>Pendientes fiscales</p>
        <strong>{{ summary.fiscalPending }}</strong>
        <small>{{ summary.readyPayments }} listos para pago</small>
      </article>
    </section>

    <section class="data-panel finance-header-panel">
      <div class="finance-run-summary">
        <div>
          <p class="eyebrow">Nomina seleccionada</p>
          <h3>{{ selectedRun?.periodLabel || 'Sin nomina guardada' }}</h3>
          <span>{{ selectedRun?.cycleLabel || activeCycle?.periodLabel || 'Ciclo operativo' }}</span>
        </div>
        <span v-if="selectedRun" class="badge" :class="statusClass(selectedRun)">{{ selectedRun.status }}</span>
      </div>
      <div class="export-actions">
        <button class="secondary-action" type="button" :disabled="!selectedRun || exporting === 'payments'" @click="exportReport('payments')">
          <Download :size="16" />
          Pagos CSV
        </button>
        <button class="secondary-action" type="button" :disabled="!selectedRun || exporting === 'fiscal'" @click="exportReport('fiscal')">
          <Download :size="16" />
          Pendientes CSV
        </button>
        <button
          class="secondary-action"
          type="button"
          :disabled="!selectedRun || exporting === 'coordinations'"
          @click="exportReport('coordinations')"
        >
          <Download :size="16" />
          Coordinaciones CSV
        </button>
      </div>
    </section>

    <section class="single-grid">
      <div class="data-panel full">
        <div class="filters-row finance">
          <label class="search-box">
            <Search :size="17" />
            <input v-model="searchText" placeholder="Buscar docente, coordinacion, RFC o pendiente" />
          </label>
          <select v-model="paymentFilter">
            <option value="TODOS">Todos</option>
            <option value="LISTO">Listos</option>
            <option value="PENDIENTE">Pendientes</option>
          </select>
          <div class="segmented-control" aria-label="Vista financiera">
            <button type="button" :class="{ active: activeTab === 'PAGOS' }" @click="activeTab = 'PAGOS'">
              Pagos
            </button>
            <button type="button" :class="{ active: activeTab === 'COORDINACIONES' }" @click="activeTab = 'COORDINACIONES'">
              Coordinaciones
            </button>
            <button type="button" :class="{ active: activeTab === 'FISCALES' }" @click="activeTab = 'FISCALES'">
              Pendientes
            </button>
            <button type="button" :class="{ active: activeTab === 'HISTORICO' }" @click="activeTab = 'HISTORICO'">
              Historico
            </button>
          </div>
        </div>

        <div v-if="activeTab === 'PAGOS'" class="table-shell">
          <table class="finance-table">
            <thead>
              <tr>
                <th>Docente</th>
                <th>Fiscal</th>
                <th>Base</th>
                <th>Descuentos</th>
                <th>Extras</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredLines.length">
                <td colspan="7" class="empty-cell">
                  {{ selectedRun ? 'No hay pagos con el filtro actual.' : 'No hay nominas guardadas para mostrar.' }}
                </td>
              </tr>
              <tr v-for="line in filteredLines" :key="line.id">
                <td>
                  <strong>{{ line.teacherName }}</strong>
                  <span><Building2 :size="13" /> {{ line.coordinationName }}</span>
                  <small>{{ categoryLabel(line.category) }} / {{ paymentTypeLabel(line.paymentType) }}</small>
                </td>
                <td>
                  <strong>{{ line.rfc || 'RFC pendiente' }}</strong>
                  <span>{{ line.email || 'Correo pendiente' }}</span>
                  <small>{{ line.bankDetail || 'Datos bancarios pendientes' }}</small>
                </td>
                <td>
                  <strong>{{ formatHours(line.baseHours) }} h</strong>
                  <span>{{ moneyLabel(line.grossBaseAmount) }}</span>
                  <small>Neto base {{ moneyLabel(line.baseNetAmount) }}</small>
                </td>
                <td>
                  <strong>{{ moneyLabel(line.absenceDiscountAmount + line.delayDiscountAmount) }}</strong>
                  <span>F {{ formatHours(line.absences) }} h / R {{ formatHours(line.delays) }}</span>
                </td>
                <td>
                  <strong>{{ formatHours(line.totalExtraHours) }} h</strong>
                  <span>{{ moneyLabel(line.totalExtraAmount) }}</span>
                </td>
                <td>
                  <strong>{{ moneyLabel(line.totalAmount) }}</strong>
                  <small v-if="line.alerts.length">{{ line.alerts.length }} alerta{{ line.alerts.length === 1 ? '' : 's' }}</small>
                </td>
                <td>
                  <span class="badge" :class="line.paymentStatus === 'LISTO' ? 'ok' : 'warning'">
                    {{ line.paymentStatus === 'LISTO' ? 'Listo' : 'Pendiente' }}
                  </span>
                  <small v-if="line.fiscalMissing.length">{{ line.fiscalMissing.join(', ') }}</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="activeTab === 'COORDINACIONES'" class="table-shell">
          <table class="finance-coordination-table">
            <thead>
              <tr>
                <th>Coordinacion</th>
                <th>Docentes</th>
                <th>Horas</th>
                <th>Descuentos</th>
                <th>Total</th>
                <th>Revision</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!coordinationSummary.length">
                <td colspan="6" class="empty-cell">No hay coordinaciones en la nomina seleccionada.</td>
              </tr>
              <tr v-for="row in coordinationSummary" :key="row.coordinationId">
                <td>
                  <strong>{{ row.coordinationName }}</strong>
                  <span>{{ row.lines }} linea{{ row.lines === 1 ? '' : 's' }} de pago</span>
                </td>
                <td><strong>{{ row.teachers }}</strong></td>
                <td>
                  <strong>{{ formatHours(row.baseHours) }} h base</strong>
                  <span>{{ formatHours(row.totalExtraHours) }} h extras</span>
                </td>
                <td><strong>{{ moneyLabel(row.discountAmount) }}</strong></td>
                <td><strong>{{ moneyLabel(row.totalAmount) }}</strong></td>
                <td>
                  <span class="badge" :class="row.fiscalPending ? 'warning' : 'ok'">
                    {{ row.fiscalPending ? `${row.fiscalPending} pendientes` : 'Completa' }}
                  </span>
                  <small v-if="row.alerts">{{ row.alerts }} alerta{{ row.alerts === 1 ? '' : 's' }}</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="activeTab === 'FISCALES'" class="table-shell">
          <table class="finance-fiscal-table">
            <thead>
              <tr>
                <th>Docente</th>
                <th>Coordinacion</th>
                <th>Pendientes</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredFiscalLines.length">
                <td colspan="4" class="empty-cell">No hay pendientes fiscales con el filtro actual.</td>
              </tr>
              <tr v-for="line in filteredFiscalLines" :key="line.id">
                <td>
                  <strong>{{ line.teacherName }}</strong>
                  <span>{{ line.rfc || 'RFC pendiente' }}</span>
                  <small>{{ line.email || 'Correo pendiente' }}</small>
                </td>
                <td><strong>{{ line.coordinationName }}</strong></td>
                <td>
                  <div class="alert-list">
                    <span v-for="missing in line.fiscalMissing" :key="missing">
                      <ShieldAlert :size="12" />
                      {{ missing }}
                    </span>
                  </div>
                </td>
                <td><strong>{{ moneyLabel(line.totalAmount) }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="finance-history-grid">
          <button
            v-for="run in runs"
            :key="run.id"
            class="finance-run-card"
            :class="{ active: run.id === selectedRunId }"
            type="button"
            @click="selectedRunId = run.id; loadSelectedRun()"
          >
            <div>
              <p class="eyebrow">{{ run.status }}</p>
              <strong>{{ run.periodLabel }}</strong>
              <span>{{ formatDate(run.calculatedAt || run.createdAt) }} / {{ run.calculatedByEmail || 'Sin usuario' }}</span>
            </div>
            <div class="finance-run-card-total">
              <CircleDollarSign :size="18" />
              <b>{{ moneyLabel(run.summary.totalAmount) }}</b>
              <small>{{ run.summary.teachers }} docentes</small>
            </div>
          </button>
          <div v-if="!runs.length" class="empty-cell">No hay nominas guardadas en el ciclo seleccionado.</div>
        </div>
      </div>
    </section>

    <section class="finance-signal-grid">
      <article class="data-panel">
        <FileSpreadsheet :size="22" />
        <div>
          <strong>{{ summary.lines }}</strong>
          <span>Lineas de pago</span>
        </div>
      </article>
      <article class="data-panel">
        <CheckCircle2 :size="22" />
        <div>
          <strong>{{ summary.readyPayments }}</strong>
          <span>Pagos listos</span>
        </div>
      </article>
      <article class="data-panel">
        <ShieldAlert :size="22" />
        <div>
          <strong>{{ summary.alerts }}</strong>
          <span>Alertas registradas</span>
        </div>
      </article>
      <article class="data-panel">
        <History :size="22" />
        <div>
          <strong>{{ runs.length }}</strong>
          <span>Corridas historicas</span>
        </div>
      </article>
    </section>
  </div>
</template>
