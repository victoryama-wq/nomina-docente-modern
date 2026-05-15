<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  FileSpreadsheet,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  WalletCards,
  X
} from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import {
  downloadFinanceExport,
  downloadFinancePdf,
  downloadCashReceipts,
  fetchFinanceContext,
  updateFinanceRunStatus,
  type CycleOption,
  type FinanceContext,
  type FinanceLine,
  type FinanceRun
} from '../api';
import ConfirmModal from '../components/modals/ConfirmModal.vue';
import { moneyLabel } from '../utils/format';

type FinanceTab = 'PAGOS' | 'COORDINACIONES' | 'FISCALES' | 'HISTORICO';
type PaymentFilter = 'TODOS' | 'LISTO' | 'PENDIENTE';
type PaymentTypeFilter = 'TODOS' | 'E' | '1' | '2';
type ExportKind = 'payments' | 'fiscal' | 'coordinations';
type PdfExportKind = 'summary' | 'coordinations';
type CoordinationRow = FinanceContext['coordinationSummary'][number];
type WorkflowTargetStatus = 'EN_REVISION' | 'APROBADA' | 'PAGADA' | 'CANCELADA';
type RunStatusFilter = 'TODOS' | FinanceRun['status'];

interface WorkflowAction {
  status: WorkflowTargetStatus;
  label: string;
  title: string;
  message: string;
}

const authStore = useAuthStore();

const cycles = ref<CycleOption[]>([]);
const activeCycle = ref<CycleOption | null>(null);
const runs = ref<FinanceRun[]>([]);
const selectedRun = ref<FinanceRun | null>(null);
const lines = ref<FinanceLine[]>([]);
const coordinationSummary = ref<FinanceContext['coordinationSummary']>([]);
const scheduleDetails = ref<FinanceContext['scheduleDetails']>([]);
const extraDetails = ref<FinanceContext['extraDetails']>([]);
const selectedCycleId = ref('');
const selectedRunId = ref('');
const searchText = ref('');
const activeTab = ref<FinanceTab>('PAGOS');
const paymentFilter = ref<PaymentFilter>('TODOS');
const paymentTypeFilter = ref<PaymentTypeFilter>('TODOS');
const runStatusFilter = ref<RunStatusFilter>('TODOS');
const pageBusy = ref(false);
const exporting = ref<ExportKind | ''>('');
const exportingPdf = ref<PdfExportKind | ''>('');
const exportingReceipts = ref(false);
const updatingStatus = ref(false);
const selectedLineId = ref('');
const selectedCoordinationId = ref('');
const pendingStatus = ref<WorkflowTargetStatus | null>(null);
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

const zeroSummary = (): FinanceContext['summary'] => ({
  lines: 0,
  teachers: 0,
  coordinations: 0,
  baseHours: 0,
  grossBaseAmount: '0.00',
  discountAmount: '0.00',
  totalExtraHours: 0,
  totalExtraAmount: '0.00',
  totalAmount: '0.00',
  alerts: 0,
  fiscalPending: 0,
  readyPayments: 0
});

const summary = ref(zeroSummary());

const pendingFiscalLines = computed(() => lines.value.filter((line) => line.paymentStatus === 'PENDIENTE'));
const selectedLine = computed(() => lines.value.find((line) => line.id === selectedLineId.value) || null);
const selectedCoordination = computed(
  () => coordinationSummary.value.find((coordination) => coordination.coordinationId === selectedCoordinationId.value) || null
);

const selectedLineScheduleDetails = computed(() =>
  selectedLine.value ? scheduleDetails.value.filter((detail) => detail.lineKey === selectedLine.value?.lineKey) : []
);

const selectedLineExtraDetails = computed(() =>
  selectedLine.value ? extraDetails.value.filter((detail) => detail.lineKey === selectedLine.value?.lineKey) : []
);

const selectedCoordinationLines = computed(() =>
  selectedCoordination.value ? lines.value.filter((line) => line.coordinationId === selectedCoordination.value?.coordinationId) : []
);

const selectedCoordinationScheduleDetails = computed(() =>
  selectedCoordination.value
    ? scheduleDetails.value.filter((detail) => detail.coordinationId === selectedCoordination.value?.coordinationId)
    : []
);

const selectedCoordinationExtraDetails = computed(() =>
  selectedCoordination.value
    ? extraDetails.value.filter((detail) => detail.coordinationId === selectedCoordination.value?.coordinationId)
    : []
);

const cashLines = computed(() => lines.value.filter((line) => line.paymentType === 'E'));

const cashAmount = computed(() => cashLines.value.reduce((sum, line) => moneyAdd(sum, line.totalAmount), '0.00'));

const canUseFinanceWorkflow = computed(
  () => authStore.isAdmin || authStore.canFinalizePayroll || authStore.session?.permissions?.includes('finance.view') || false
);

const isGlobalFinanceReadOnly = computed(
  () =>
    authStore.session?.permissions?.includes('finance.global_view') &&
    !authStore.isAdmin &&
    !authStore.session?.permissions?.includes('finance.view') &&
    !authStore.canFinalizePayroll
);

const canExportFinanceSummaryPdf = computed(() => !isGlobalFinanceReadOnly.value);
const canExportCoordinationPdf = computed(() => true);
const canExportCashReceipts = computed(() => !isGlobalFinanceReadOnly.value);
const canExportFinanceCsv = computed(() => !isGlobalFinanceReadOnly.value);

const canCancelForCorrection = computed(() => authStore.isAdmin || authStore.canFinalizePayroll);

const nextWorkflowAction = computed(() => {
  if (!canUseFinanceWorkflow.value) return null;
  if (!selectedRun.value) return null;
  if (selectedRun.value.status === 'CALCULADA') {
    return {
      status: 'EN_REVISION' as const,
      label: 'Enviar a revisión',
      title: 'Enviar nómina a revisión',
      message:
        'La nómina quedará marcada para revisión financiera sobre una corrida ya guardada. Si detectan un error operativo, se debe cancelar para corrección antes de aprobar.'
    };
  }
  if (selectedRun.value.status === 'EN_REVISION') {
    return {
      status: 'APROBADA' as const,
      label: 'Aprobar nómina',
      title: 'Aprobar nómina para pago',
      message: 'La nómina quedará aprobada para proceder al pago. Verifica que los pendientes fiscales y alertas hayan sido revisados.'
    };
  }
  if (selectedRun.value.status === 'APROBADA') {
    return {
      status: 'PAGADA' as const,
      label: 'Marcar pagada',
      title: 'Marcar nómina como pagada',
      message: 'La nómina quedará registrada como pagada. Esta acción debe hacerse cuando Finanzas confirme que los pagos fueron ejecutados.'
    };
  }
  return null;
});

const cancelWorkflowAction = computed<WorkflowAction | null>(() => {
  if (!canCancelForCorrection.value) return null;
  if (!selectedRun.value) return null;
  if (!['CALCULADA', 'EN_REVISION', 'APROBADA'].includes(selectedRun.value.status)) return null;
  return {
    status: 'CANCELADA',
    label: 'Cancelar para corrección',
    title: 'Cancelar nómina para corrección',
    message:
      'Se cancelará esta corrida, se restaurarán las incidencias y extras desde el histórico guardado y la quincena quedará abierta para corregir. Después deberás recalcular y guardar una nueva nómina.'
  };
});

const workflowActions = computed(() => [nextWorkflowAction.value, cancelWorkflowAction.value].filter(Boolean) as WorkflowAction[]);

const pendingWorkflowAction = computed(() =>
  pendingStatus.value ? workflowActions.value.find((action) => action.status === pendingStatus.value) || null : null
);

const workflowConfirmDetails = computed(() => {
  const details = [
    `Estado actual: ${selectedRun.value ? statusLabel(selectedRun.value.status) : '-'}`,
    `Total: ${moneyLabel(summary.value.totalAmount)}`,
    `Pendientes fiscales: ${summary.value.fiscalPending}`,
    `Pagos en efectivo: ${cashLines.value.length} / ${moneyLabel(cashAmount.value)}`
  ];

  if (pendingStatus.value === 'CANCELADA') {
    details.push('Se reabrirá la quincena para ajustar Incidencias y Extras.');
    details.push('La corrida cancelada permanecerá en histórico y auditoría.');
  }

  return details;
});

const readyAmount = computed(() =>
  lines.value
    .filter((line) => line.paymentStatus === 'LISTO')
    .reduce((sum, line) => moneyAdd(sum, line.totalAmount), '0.00')
);

const pendingAmount = computed(() =>
  lines.value
    .filter((line) => line.paymentStatus === 'PENDIENTE')
    .reduce((sum, line) => moneyAdd(sum, line.totalAmount), '0.00')
);

const searchPlaceholder = computed(() =>
  activeTab.value === 'HISTORICO'
    ? 'Buscar quincena, estado o usuario'
    : 'Buscar docente, coordinación, RFC o pendiente'
);

const paymentTypeSummary = computed(() => {
  const groups: Array<{
    code: Exclude<PaymentTypeFilter, 'TODOS'>;
    label: string;
    lines: number;
    teachers: number;
    totalAmount: string;
    ready: number;
    pending: number;
  }> = [
    { code: '1', label: paymentTypeLabel('1'), lines: 0, teachers: 0, totalAmount: '0.00', ready: 0, pending: 0 },
    { code: '2', label: paymentTypeLabel('2'), lines: 0, teachers: 0, totalAmount: '0.00', ready: 0, pending: 0 },
    { code: 'E', label: paymentTypeLabel('E'), lines: 0, teachers: 0, totalAmount: '0.00', ready: 0, pending: 0 }
  ];
  const teacherSets = new Map<string, Set<string>>(groups.map((group) => [group.code, new Set<string>()]));

  for (const line of lines.value) {
    const group = groups.find((item) => item.code === line.paymentType);
    if (!group) continue;
    group.lines += 1;
    group.totalAmount = moneyAdd(group.totalAmount, line.totalAmount);
    group.ready += line.paymentStatus === 'LISTO' ? 1 : 0;
    group.pending += line.paymentStatus === 'PENDIENTE' ? 1 : 0;
    teacherSets.get(group.code)?.add(line.teacherId);
  }

  return groups.map((group) => ({
    ...group,
    teachers: teacherSets.get(group.code)?.size || 0,
    totalAmount: moneyAdd(group.totalAmount)
  }));
});

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
    const matchesPaymentType = paymentTypeFilter.value === 'TODOS' || line.paymentType === paymentTypeFilter.value;
    return matchesText && matchesStatus && matchesPaymentType;
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

const runStatusOptions = computed(() => {
  const preferred: FinanceRun['status'][] = ['CALCULADA', 'EN_REVISION', 'APROBADA', 'PAGADA', 'CANCELADA', 'CERRADA'];
  const present = new Set(runs.value.map((run) => run.status));
  return preferred.filter((status) => present.has(status));
});

const filteredRuns = computed(() => {
  const text = searchText.value.toLowerCase().trim();
  return runs.value.filter((run) => {
    const matchesStatus = runStatusFilter.value === 'TODOS' || run.status === runStatusFilter.value;
    const haystack = [
      run.periodLabel,
      run.cycleLabel,
      run.status,
      statusLabel(run.status),
      run.calculatedByEmail,
      run.reviewedByEmail,
      run.approvedByEmail,
      run.paidByEmail,
      run.statusUpdatedByEmail
    ]
      .join(' ')
      .toLowerCase();
    return matchesStatus && (!text || haystack.includes(text));
  });
});

const historicalSummary = computed(() => {
  const visibleRuns = filteredRuns.value;
  const activeRuns = visibleRuns.filter((run) => run.status !== 'CANCELADA');
  return {
    totalRuns: visibleRuns.length,
    activeRuns: activeRuns.length,
    cancelledRuns: visibleRuns.filter((run) => run.status === 'CANCELADA').length,
    paidRuns: visibleRuns.filter((run) => run.status === 'PAGADA').length,
    totalAmount: activeRuns.reduce((sum, run) => moneyAdd(sum, run.summary.totalAmount), '0.00'),
    teachers: activeRuns.reduce((sum, run) => sum + Number(run.summary.teachers || 0), 0)
  };
});

function formatHours(value: number | string | null | undefined) {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function moneyCents(value: number | string | null | undefined): bigint {
  const raw = value === null || value === undefined || value === '' ? '0' : String(value).trim();
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [integer = '0', decimal = ''] = unsigned.split('.');
  const cents = BigInt((integer.replace(/\D/g, '') || '0')) * 100n + BigInt(decimal.replace(/\D/g, '').padEnd(2, '0').slice(0, 2) || '0');
  return negative ? -cents : cents;
}

function moneyFromCents(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const integer = absolute / 100n;
  const decimal = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${integer.toString()}.${decimal}`;
}

function moneyAdd(...values: Array<number | string | null | undefined>): string {
  return moneyFromCents(values.reduce((sum, value) => sum + moneyCents(value), 0n));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
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
  if (paymentType === 'E') return 'Efectivo';
  if (paymentType === '1') return 'Santander';
  if (paymentType === '2') return 'Banorte';
  return paymentType || '-';
}

function statusClass(run: FinanceRun) {
  if (run.status === 'PAGADA' || run.status === 'CERRADA') return 'ok';
  if (run.status === 'APROBADA') return 'neutral';
  if (run.status === 'EN_REVISION') return 'warning';
  if (run.status === 'CANCELADA') return 'danger';
  return 'neutral';
}

function statusLabel(status: FinanceRun['status']) {
  if (status === 'EN_REVISION') return 'EN REVISIÓN';
  if (status === 'PAGADA') return 'PAGADA';
  return status;
}

function runTraceLabel(run: FinanceRun) {
  if (run.status === 'PAGADA') return `Pagada ${formatDateTime(run.paidAt)}`;
  if (run.status === 'APROBADA') return `Aprobada ${formatDateTime(run.approvedAt)}`;
  if (run.status === 'EN_REVISION') return `En revisión ${formatDateTime(run.reviewedAt)}`;
  if (run.status === 'CANCELADA') return `Cancelada ${formatDateTime(run.statusUpdatedAt)}`;
  return `Calculada ${formatDateTime(run.calculatedAt || run.createdAt)}`;
}

function runTraceUser(run: FinanceRun) {
  if (run.status === 'PAGADA') return run.paidByEmail || run.statusUpdatedByEmail || 'Sistema';
  if (run.status === 'APROBADA') return run.approvedByEmail || run.statusUpdatedByEmail || 'Sistema';
  if (run.status === 'EN_REVISION') return run.reviewedByEmail || run.statusUpdatedByEmail || 'Sistema';
  if (run.status === 'CANCELADA') return run.statusUpdatedByEmail || 'Sistema';
  return run.calculatedByEmail || 'Sistema';
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
  scheduleDetails.value = data.scheduleDetails || [];
  extraDetails.value = data.extraDetails || [];
  if (!data.lines.some((line) => line.id === selectedLineId.value)) {
    selectedLineId.value = '';
  }
  if (!data.coordinationSummary.some((coordination) => coordination.coordinationId === selectedCoordinationId.value)) {
    selectedCoordinationId.value = '';
  }
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

function selectHistoricalRun(run: FinanceRun, tab: FinanceTab = 'PAGOS') {
  selectedRunId.value = run.id;
  activeTab.value = tab;
  return loadSelectedRun();
}

function selectPaymentTypeFilter(value: PaymentTypeFilter) {
  paymentTypeFilter.value = paymentTypeFilter.value === value ? 'TODOS' : value;
  activeTab.value = 'PAGOS';
}

function openLineDetail(line: FinanceLine) {
  selectedLineId.value = line.id;
}

function closeLineDetail() {
  selectedLineId.value = '';
}

function openCoordinationDetail(row: CoordinationRow) {
  selectedCoordinationId.value = row.coordinationId;
}

function closeCoordinationDetail() {
  selectedCoordinationId.value = '';
}

function openStatusConfirm(status?: WorkflowTargetStatus) {
  const targetStatus = status || nextWorkflowAction.value?.status;
  if (!targetStatus) return;
  pendingStatus.value = targetStatus;
  notice.value = null;
}

function closeStatusConfirm() {
  if (updatingStatus.value) return;
  pendingStatus.value = null;
}

async function confirmStatusChange() {
  if (!selectedRun.value || !pendingStatus.value) return;
  updatingStatus.value = true;
  notice.value = null;
  try {
    const response = await updateFinanceRunStatus(selectedRun.value.id, pendingStatus.value);
    pendingStatus.value = null;
    setNotice('ok', response.message);
    await loadFinance(selectedCycleId.value, selectedRunId.value);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible actualizar el estado de nómina.');
  } finally {
    updatingStatus.value = false;
  }
}

async function exportReport(kind: ExportKind) {
  if (!selectedRun.value || !canExportFinanceCsv.value) return;
  exporting.value = kind;
  notice.value = null;
  try {
    await downloadFinanceExport(kind, selectedRun.value.id, selectedCycleId.value);
    setNotice('ok', 'Exportación financiera generada.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible exportar el reporte.');
  } finally {
    exporting.value = '';
  }
}

async function exportPdf(kind: PdfExportKind) {
  if (!selectedRun.value) return;
  if (kind === 'summary' && !canExportFinanceSummaryPdf.value) return;
  if (kind === 'coordinations' && !canExportCoordinationPdf.value) return;
  exportingPdf.value = kind;
  notice.value = null;
  try {
    await downloadFinancePdf(kind, selectedRun.value.id);
    setNotice('ok', 'PDF financiero generado.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible generar el PDF financiero.');
  } finally {
    exportingPdf.value = '';
  }
}

async function exportCashReceipts() {
  if (!selectedRun.value || !canExportCashReceipts.value) return;
  exportingReceipts.value = true;
  notice.value = null;
  try {
    await downloadCashReceipts(selectedRun.value.id);
    setNotice('ok', 'Comprobantes de efectivo generados.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible generar comprobantes de efectivo.');
  } finally {
    exportingReceipts.value = false;
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
        <h3>Nóminas guardadas y pagos</h3>
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
        <p>Listo para pago</p>
        <strong>{{ moneyLabel(readyAmount) }}</strong>
        <small>{{ summary.readyPayments }} línea{{ summary.readyPayments === 1 ? '' : 's' }} completa{{ summary.readyPayments === 1 ? '' : 's' }}</small>
      </article>
      <article class="metric-card mini">
        <p>Pendiente revisión</p>
        <strong>{{ moneyLabel(pendingAmount) }}</strong>
        <small>{{ summary.fiscalPending }} pendiente{{ summary.fiscalPending === 1 ? '' : 's' }} fiscal{{ summary.fiscalPending === 1 ? '' : 'es' }}</small>
      </article>
      <article class="metric-card mini">
        <p>Extras</p>
        <strong>{{ formatHours(summary.totalExtraHours) }} h</strong>
        <small>{{ moneyLabel(summary.totalExtraAmount) }}</small>
      </article>
    </section>

    <section class="data-panel finance-header-panel">
      <div class="finance-run-summary">
        <div>
          <p class="eyebrow">Nómina seleccionada</p>
          <h3>{{ selectedRun?.periodLabel || 'Sin nómina guardada' }}</h3>
          <span>{{ selectedRun?.cycleLabel || activeCycle?.periodLabel || 'Ciclo operativo' }}</span>
        </div>
        <span v-if="selectedRun" class="badge" :class="statusClass(selectedRun)">{{ statusLabel(selectedRun.status) }}</span>
      </div>
      <div class="finance-actions-board">
        <div v-if="nextWorkflowAction || cancelWorkflowAction" class="finance-action-group workflow">
          <span>Flujo</span>
          <div class="finance-action-row">
            <button
              v-if="nextWorkflowAction"
              class="primary-inline"
              type="button"
              :disabled="updatingStatus"
              @click="openStatusConfirm()"
            >
              <CheckCircle2 :size="16" />
              {{ nextWorkflowAction.label }}
            </button>
            <button
              v-if="cancelWorkflowAction"
              class="primary-inline danger-action"
              type="button"
              :disabled="updatingStatus"
              @click="openStatusConfirm('CANCELADA')"
            >
              <AlertTriangle :size="16" />
              {{ cancelWorkflowAction.label }}
            </button>
          </div>
        </div>

        <div class="finance-action-group">
          <span>PDF</span>
          <div class="finance-action-row">
            <button
              v-if="canExportFinanceSummaryPdf"
              class="secondary-action"
              type="button"
              :disabled="!selectedRun || exportingPdf === 'summary'"
              @click="exportPdf('summary')"
            >
              <FileText :size="16" />
              Resumen
            </button>
            <button
              v-if="canExportCoordinationPdf"
              class="secondary-action"
              type="button"
              :disabled="!selectedRun || exportingPdf === 'coordinations'"
              @click="exportPdf('coordinations')"
            >
              <FileText :size="16" />
              Coordinaciones
            </button>
            <button
              v-if="canExportCashReceipts"
              class="secondary-action"
              type="button"
              :disabled="!selectedRun || !cashLines.length || exportingReceipts"
              @click="exportCashReceipts"
            >
              <FileText :size="16" />
              Efectivo
            </button>
          </div>
        </div>

        <div v-if="canExportFinanceCsv" class="finance-action-group">
          <span>CSV</span>
          <div class="finance-action-row">
            <button class="secondary-action" type="button" :disabled="!selectedRun || exporting === 'payments'" @click="exportReport('payments')">
              <FileSpreadsheet :size="16" />
              Pagos
            </button>
            <button class="secondary-action" type="button" :disabled="!selectedRun || exporting === 'fiscal'" @click="exportReport('fiscal')">
              <FileSpreadsheet :size="16" />
              Pendientes
            </button>
            <button
              class="secondary-action"
              type="button"
              :disabled="!selectedRun || exporting === 'coordinations'"
              @click="exportReport('coordinations')"
            >
              <FileSpreadsheet :size="16" />
              Coordinaciones
            </button>
          </div>
        </div>

        <div v-if="isGlobalFinanceReadOnly" class="finance-action-group readonly">
          <span>Solo consulta</span>
          <p>Puede revisar todas las coordinaciones y descargar el PDF por coordinaciones.</p>
        </div>
      </div>
    </section>

    <section v-if="selectedRun" class="finance-status-timeline">
      <article :class="{ done: !!selectedRun.calculatedAt }">
        <strong>Calculada</strong>
        <span>{{ formatDateTime(selectedRun.calculatedAt || selectedRun.createdAt) }}</span>
        <small>{{ selectedRun.calculatedByEmail || 'Sistema' }}</small>
      </article>
      <article :class="{ done: !!selectedRun.reviewedAt || ['EN_REVISION', 'APROBADA', 'PAGADA', 'CERRADA'].includes(selectedRun.status) }">
        <strong>En revisión</strong>
        <span>{{ formatDateTime(selectedRun.reviewedAt) }}</span>
        <small>{{ selectedRun.reviewedByEmail || 'Pendiente' }}</small>
      </article>
      <article :class="{ done: !!selectedRun.approvedAt || ['APROBADA', 'PAGADA', 'CERRADA'].includes(selectedRun.status) }">
        <strong>Aprobada</strong>
        <span>{{ formatDateTime(selectedRun.approvedAt) }}</span>
        <small>{{ selectedRun.approvedByEmail || 'Pendiente' }}</small>
      </article>
      <article :class="{ done: !!selectedRun.paidAt || selectedRun.status === 'PAGADA' }">
        <strong>Pagada</strong>
        <span>{{ formatDateTime(selectedRun.paidAt) }}</span>
        <small>{{ selectedRun.paidByEmail || 'Pendiente' }}</small>
      </article>
      <article class="cash-summary">
        <strong>Efectivo</strong>
        <span>{{ moneyLabel(cashAmount) }}</span>
        <small>{{ cashLines.length }} comprobante{{ cashLines.length === 1 ? '' : 's' }}</small>
      </article>
    </section>

    <section class="finance-payment-grid">
      <button
        v-for="group in paymentTypeSummary"
        :key="group.code"
        class="finance-payment-card"
        :class="{ active: paymentTypeFilter === group.code }"
        type="button"
        @click="selectPaymentTypeFilter(group.code)"
      >
        <span class="finance-payment-icon">
          <Banknote v-if="group.code === 'E'" :size="18" />
          <WalletCards v-else :size="18" />
        </span>
        <span>
          <strong>{{ group.label }}</strong>
          <small>{{ group.teachers }} docente{{ group.teachers === 1 ? '' : 's' }} / {{ group.lines }} línea{{ group.lines === 1 ? '' : 's' }}</small>
        </span>
        <b>{{ moneyLabel(group.totalAmount) }}</b>
        <em>{{ group.ready }} listo{{ group.ready === 1 ? '' : 's' }} / {{ group.pending }} pendiente{{ group.pending === 1 ? '' : 's' }}</em>
      </button>
    </section>

    <section class="single-grid">
      <div class="data-panel full">
        <div class="filters-row finance">
          <label class="search-box">
            <Search :size="17" />
            <input v-model="searchText" :placeholder="searchPlaceholder" />
          </label>
          <select v-if="activeTab === 'HISTORICO'" v-model="runStatusFilter">
            <option value="TODOS">Todos los estados</option>
            <option v-for="status in runStatusOptions" :key="status" :value="status">
              {{ statusLabel(status) }}
            </option>
          </select>
          <select v-else v-model="paymentFilter">
            <option value="TODOS">Todos</option>
            <option value="LISTO">Listos</option>
            <option value="PENDIENTE">Pendientes</option>
          </select>
          <select v-if="activeTab !== 'HISTORICO'" v-model="paymentTypeFilter">
            <option value="TODOS">Todos los pagos</option>
            <option value="1">Santander</option>
            <option value="2">Banorte</option>
            <option value="E">Efectivo</option>
          </select>
          <button
            v-else
            class="secondary-action"
            type="button"
            @click="searchText = ''; runStatusFilter = 'TODOS'"
          >
            <RefreshCw :size="16" />
            Limpiar
          </button>
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
              Histórico
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredLines.length">
                <td colspan="8" class="empty-cell">
                  {{ selectedRun ? 'No hay pagos con el filtro actual.' : 'No hay nóminas guardadas para mostrar.' }}
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
                  <strong>{{ moneyLabel(moneyAdd(line.absenceDiscountAmount, line.delayDiscountAmount)) }}</strong>
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
                <td class="row-actions">
                  <button class="icon-button" type="button" title="Ver detalle" @click="openLineDetail(line)">
                    <Eye :size="16" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="activeTab === 'COORDINACIONES'" class="table-shell">
          <table class="finance-coordination-table">
            <thead>
              <tr>
                <th>Coordinación</th>
                <th>Docentes</th>
                <th>Horas</th>
                <th>Descuentos</th>
                <th>Total</th>
                <th>Revisión</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!coordinationSummary.length">
                <td colspan="7" class="empty-cell">No hay coordinaciones en la nómina seleccionada.</td>
              </tr>
              <tr v-for="row in coordinationSummary" :key="row.coordinationId">
                <td>
                  <strong>{{ row.coordinationName }}</strong>
                  <span>{{ row.lines }} línea{{ row.lines === 1 ? '' : 's' }} de pago</span>
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
                <td class="row-actions">
                  <button class="icon-button" type="button" title="Ver detalle" @click="openCoordinationDetail(row)">
                    <Eye :size="16" />
                  </button>
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
                <th>Coordinación</th>
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

        <div v-else class="finance-history-view">
          <div class="finance-history-summary">
            <article>
              <span>Corridas visibles</span>
              <strong>{{ historicalSummary.totalRuns }}</strong>
              <small>{{ historicalSummary.activeRuns }} vigentes / {{ historicalSummary.cancelledRuns }} canceladas</small>
            </article>
            <article>
              <span>Total vigente</span>
              <strong>{{ moneyLabel(historicalSummary.totalAmount) }}</strong>
              <small>No incluye corridas canceladas</small>
            </article>
            <article>
              <span>Pagadas</span>
              <strong>{{ historicalSummary.paidRuns }}</strong>
              <small>{{ historicalSummary.teachers }} docentes acumulados</small>
            </article>
          </div>

          <div class="table-shell">
            <table class="finance-history-table">
              <thead>
                <tr>
                  <th>Quincena</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Alcance</th>
                  <th>Trazabilidad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!filteredRuns.length">
                  <td colspan="6" class="empty-cell">No hay nóminas con el filtro actual.</td>
                </tr>
                <tr v-for="run in filteredRuns" :key="run.id" :class="{ 'active-row': run.id === selectedRunId }">
                  <td>
                    <strong>{{ run.periodLabel }}</strong>
                    <span>{{ run.cycleLabel }}</span>
                    <small>Guardada {{ formatDateTime(run.calculatedAt || run.createdAt) }}</small>
                  </td>
                  <td>
                    <span class="badge" :class="statusClass(run)">{{ statusLabel(run.status) }}</span>
                    <small v-if="run.statusUpdatedAt">Movida {{ formatDateTime(run.statusUpdatedAt) }}</small>
                  </td>
                  <td>
                    <strong>{{ moneyLabel(run.summary.totalAmount) }}</strong>
                    <span>Base {{ moneyLabel(run.summary.grossBaseAmount) }}</span>
                    <small>Extras {{ moneyLabel(run.summary.totalExtraAmount) }}</small>
                  </td>
                  <td>
                    <strong>{{ run.summary.teachers }} docentes</strong>
                    <span>{{ run.summary.coordinations }} coordinaciones</span>
                    <small>{{ run.summary.lines }} línea{{ run.summary.lines === 1 ? '' : 's' }} / {{ run.summary.alerts }} alertas</small>
                  </td>
                  <td>
                    <strong>{{ runTraceLabel(run) }}</strong>
                    <span>{{ runTraceUser(run) }}</span>
                    <small>Calculada por {{ run.calculatedByEmail || 'Sistema' }}</small>
                  </td>
                  <td class="row-actions">
                    <button class="icon-button" type="button" title="Ver pagos" @click="selectHistoricalRun(run, 'PAGOS')">
                      <Eye :size="16" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <div v-if="selectedLine" class="modal-backdrop" @click.self="closeLineDetail">
      <section class="modal-card large finance-detail-modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Detalle financiero</p>
            <h3>{{ selectedLine.teacherName }}</h3>
            <span>{{ selectedLine.coordinationName }} / {{ categoryLabel(selectedLine.category) }}</span>
          </div>
          <button class="icon-button" type="button" title="Cerrar" @click="closeLineDetail">
            <X :size="17" />
          </button>
        </div>

        <div class="finance-detail-grid">
          <article class="finance-detail-card total">
            <span>Total neto</span>
            <strong>{{ moneyLabel(selectedLine.totalAmount) }}</strong>
            <small>{{ paymentTypeLabel(selectedLine.paymentType) }}</small>
          </article>
          <article class="finance-detail-card">
            <span>Base</span>
            <strong>{{ formatHours(selectedLine.baseHours) }} h</strong>
            <small>{{ moneyLabel(selectedLine.baseNetAmount) }}</small>
          </article>
          <article class="finance-detail-card">
            <span>Descuentos</span>
            <strong>{{ moneyLabel(moneyAdd(selectedLine.absenceDiscountAmount, selectedLine.delayDiscountAmount)) }}</strong>
            <small>F {{ formatHours(selectedLine.absences) }} h / R {{ formatHours(selectedLine.delays) }}</small>
          </article>
          <article class="finance-detail-card">
            <span>Extras</span>
            <strong>{{ formatHours(selectedLine.totalExtraHours) }} h</strong>
            <small>{{ moneyLabel(selectedLine.totalExtraAmount) }}</small>
          </article>
        </div>

        <div class="finance-detail-sections">
          <section class="finance-detail-section">
            <div class="section-title compact">
              <div>
                <p class="eyebrow">Expediente fiscal</p>
                <h3>Datos para pago</h3>
              </div>
              <span class="badge" :class="selectedLine.paymentStatus === 'LISTO' ? 'ok' : 'warning'">
                {{ selectedLine.paymentStatus === 'LISTO' ? 'Listo' : 'Pendiente' }}
              </span>
            </div>
            <div class="finance-fiscal-list">
              <span><b>RFC</b>{{ selectedLine.rfc || 'Pendiente' }}</span>
              <span><b>Correo</b>{{ selectedLine.email || 'Pendiente' }}</span>
              <span><b>Banco / cuenta</b>{{ selectedLine.bankDetail || 'Pendiente' }}</span>
              <span><b>Constancia fiscal</b>{{ selectedLine.hasConstancia ? 'Capturada' : 'Pendiente' }}</span>
            </div>
            <div v-if="selectedLine.fiscalMissing.length" class="alert-list">
              <span v-for="missing in selectedLine.fiscalMissing" :key="missing">
                <ShieldAlert :size="12" />
                {{ missing }}
              </span>
            </div>
          </section>

          <section class="finance-detail-section">
            <div class="section-title compact">
              <div>
                <p class="eyebrow">Revisión</p>
                <h3>Alertas de nómina</h3>
              </div>
            </div>
            <div v-if="selectedLine.alerts.length" class="alert-list">
              <span v-for="alert in selectedLine.alerts" :key="alert">
                <AlertTriangle :size="12" />
                {{ alert }}
              </span>
            </div>
            <p v-else class="finance-detail-muted">Sin alertas registradas para esta línea.</p>
          </section>
        </div>

        <div class="finance-detail-breakdown">
          <section class="finance-detail-section">
            <div class="section-title compact">
              <div>
                <p class="eyebrow">Horarios e incidencias</p>
                <h3>Base calculada</h3>
              </div>
            </div>
            <div class="table-shell compact">
              <table class="finance-breakdown-table">
                <thead>
                  <tr>
                    <th>Asignatura</th>
                    <th>Horas</th>
                    <th>Incidencias</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!selectedLineScheduleDetails.length">
                    <td colspan="4" class="empty-cell">Sin horarios base para esta línea.</td>
                  </tr>
                  <tr v-for="detail in selectedLineScheduleDetails" :key="`${detail.scheduleId}-${detail.subjectName}`">
                    <td>
                      <strong>{{ detail.subjectName }}</strong>
                      <span>Grupo {{ detail.groupCode }} / {{ detail.tabulatorName }} {{ moneyLabel(detail.tabulatorAmount) }}</span>
                    </td>
                    <td>
                      <strong>{{ formatHours(detail.baseHours) }} h</strong>
                      <span>L-V {{ formatHours(detail.weekdayHours) }} / M1 {{ formatHours(detail.module1Hours) }} / M2 {{ formatHours(detail.module2Hours) }}</span>
                    </td>
                    <td>
                      <strong>F {{ formatHours(detail.absences) }} h / R {{ formatHours(detail.delays) }}</strong>
                      <span>Extras incidencia {{ formatHours(detail.scheduleExtraHours) }} h</span>
                    </td>
                    <td>
                      <strong>{{ moneyLabel(detail.baseNetAmount) }}</strong>
                      <span>Bruto {{ moneyLabel(detail.grossBaseAmount) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="finance-detail-section">
            <div class="section-title compact">
              <div>
                <p class="eyebrow">Extras externos</p>
                <h3>Capturas adicionales</h3>
              </div>
            </div>
            <div class="table-shell compact">
              <table class="finance-breakdown-table extras">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Motivo</th>
                    <th>Horas</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!selectedLineExtraDetails.length">
                    <td colspan="4" class="empty-cell">Sin extras externos para esta línea.</td>
                  </tr>
                  <tr v-for="detail in selectedLineExtraDetails" :key="`${detail.extraId}-${detail.reason}`">
                    <td>{{ formatDate(detail.activityDate) }}</td>
                    <td>
                      <strong>{{ detail.reason }}</strong>
                      <span>{{ moneyLabel(detail.tabulatorAmount) }} por hora</span>
                    </td>
                    <td><strong>{{ formatHours(detail.hours) }} h</strong></td>
                    <td><strong>{{ moneyLabel(detail.totalAmount) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div class="modal-actions">
          <button class="secondary-action" type="button" @click="closeLineDetail">Cerrar detalle</button>
        </div>
      </section>
    </div>

    <div v-if="selectedCoordination" class="modal-backdrop" @click.self="closeCoordinationDetail">
      <section class="modal-card large finance-detail-modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Reporte por coordinación</p>
            <h3>{{ selectedCoordination.coordinationName }}</h3>
            <span>{{ selectedRun?.periodLabel || 'Nómina seleccionada' }}</span>
          </div>
          <button class="icon-button" type="button" title="Cerrar" @click="closeCoordinationDetail">
            <X :size="17" />
          </button>
        </div>

        <div class="finance-detail-grid">
          <article class="finance-detail-card total">
            <span>Total coordinación</span>
            <strong>{{ moneyLabel(selectedCoordination.totalAmount) }}</strong>
            <small>{{ selectedCoordination.teachers }} docente{{ selectedCoordination.teachers === 1 ? '' : 's' }}</small>
          </article>
          <article class="finance-detail-card">
            <span>Horas base</span>
            <strong>{{ formatHours(selectedCoordination.baseHours) }} h</strong>
            <small>{{ selectedCoordination.lines }} línea{{ selectedCoordination.lines === 1 ? '' : 's' }}</small>
          </article>
          <article class="finance-detail-card">
            <span>Descuentos</span>
            <strong>{{ moneyLabel(selectedCoordination.discountAmount) }}</strong>
            <small>Faltas y retardos</small>
          </article>
          <article class="finance-detail-card">
            <span>Extras</span>
            <strong>{{ formatHours(selectedCoordination.totalExtraHours) }} h</strong>
            <small>{{ selectedCoordination.fiscalPending }} pendiente{{ selectedCoordination.fiscalPending === 1 ? '' : 's' }}</small>
          </article>
        </div>

        <section class="finance-detail-section">
          <div class="section-title compact">
            <div>
              <p class="eyebrow">Docentes</p>
              <h3>Resumen de pago</h3>
            </div>
          </div>
          <div class="table-shell compact">
            <table class="finance-breakdown-table coordination-lines">
              <thead>
                <tr>
                  <th>Docente</th>
                  <th>Base</th>
                  <th>Descuentos</th>
                  <th>Extras</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in selectedCoordinationLines" :key="line.id">
                  <td>
                    <strong>{{ line.teacherName }}</strong>
                    <span>{{ categoryLabel(line.category) }} / {{ paymentTypeLabel(line.paymentType) }}</span>
                  </td>
                  <td>
                    <strong>{{ formatHours(line.baseHours) }} h</strong>
                    <span>{{ moneyLabel(line.baseNetAmount) }}</span>
                  </td>
                  <td>
                    <strong>{{ moneyLabel(moneyAdd(line.absenceDiscountAmount, line.delayDiscountAmount)) }}</strong>
                    <span>F {{ formatHours(line.absences) }} h / R {{ formatHours(line.delays) }}</span>
                  </td>
                  <td>
                    <strong>{{ formatHours(line.totalExtraHours) }} h</strong>
                    <span>{{ moneyLabel(line.totalExtraAmount) }}</span>
                  </td>
                  <td><strong>{{ moneyLabel(line.totalAmount) }}</strong></td>
                  <td>
                    <span class="badge" :class="line.paymentStatus === 'LISTO' ? 'ok' : 'warning'">
                      {{ line.paymentStatus === 'LISTO' ? 'Listo' : 'Pendiente' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="finance-detail-breakdown">
          <section class="finance-detail-section">
            <div class="section-title compact">
              <div>
                <p class="eyebrow">Materias y grupos</p>
                <h3>Horarios considerados</h3>
              </div>
            </div>
            <div class="table-shell compact">
              <table class="finance-breakdown-table coordination-schedules">
                <thead>
                  <tr>
                    <th>Docente</th>
                    <th>Asignatura</th>
                    <th>Horas</th>
                    <th>Incidencias</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!selectedCoordinationScheduleDetails.length">
                    <td colspan="5" class="empty-cell">Sin horarios base para esta coordinación.</td>
                  </tr>
                  <tr
                    v-for="(detail, index) in selectedCoordinationScheduleDetails"
                    :key="`${detail.scheduleId}-${detail.teacherId}-${index}`"
                  >
                    <td><strong>{{ detail.teacherName }}</strong></td>
                    <td>
                      <strong>{{ detail.subjectName }}</strong>
                      <span>Grupo {{ detail.groupCode }}</span>
                    </td>
                    <td>
                      <strong>{{ formatHours(detail.baseHours) }} h</strong>
                      <span>L-V {{ formatHours(detail.weekdayHours) }} / M1 {{ formatHours(detail.module1Hours) }} / M2 {{ formatHours(detail.module2Hours) }}</span>
                    </td>
                    <td>
                      <strong>F {{ formatHours(detail.absences) }} h / R {{ formatHours(detail.delays) }}</strong>
                      <span>Extra incidencia {{ formatHours(detail.scheduleExtraHours) }} h</span>
                    </td>
                    <td>
                      <strong>{{ moneyLabel(detail.baseNetAmount) }}</strong>
                      <span>{{ detail.tabulatorName }} / {{ moneyLabel(detail.tabulatorAmount) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="finance-detail-section">
            <div class="section-title compact">
              <div>
                <p class="eyebrow">Extras externos</p>
                <h3>Capturas consideradas</h3>
              </div>
            </div>
            <div class="table-shell compact">
              <table class="finance-breakdown-table extras">
                <thead>
                  <tr>
                    <th>Docente</th>
                    <th>Fecha</th>
                    <th>Motivo</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!selectedCoordinationExtraDetails.length">
                    <td colspan="4" class="empty-cell">Sin extras externos para esta coordinación.</td>
                  </tr>
                  <tr v-for="(detail, index) in selectedCoordinationExtraDetails" :key="`${detail.extraId}-${index}`">
                    <td><strong>{{ detail.teacherName }}</strong></td>
                    <td>{{ formatDate(detail.activityDate) }}</td>
                    <td>
                      <strong>{{ detail.reason }}</strong>
                      <span>{{ formatHours(detail.hours) }} h / {{ moneyLabel(detail.tabulatorAmount) }}</span>
                    </td>
                    <td><strong>{{ moneyLabel(detail.totalAmount) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div class="modal-actions">
          <button class="secondary-action" type="button" @click="closeCoordinationDetail">Cerrar reporte</button>
        </div>
      </section>
    </div>

    <ConfirmModal
      :show="!!pendingWorkflowAction"
      eyebrow="Flujo financiero"
      :title="pendingWorkflowAction?.title || 'Actualizar estado'"
      :subject="selectedRun?.periodLabel"
      :message="pendingWorkflowAction?.message || 'Confirma el cambio de estado de la nómina.'"
      :details="workflowConfirmDetails"
      :confirm-label="pendingWorkflowAction?.label || 'Confirmar'"
      cancel-label="Cancelar"
      :tone="pendingStatus === 'CANCELADA' ? 'danger' : pendingStatus === 'PAGADA' ? 'warning' : 'primary'"
      :icon="pendingStatus === 'CANCELADA' ? 'warning' : pendingStatus === 'PAGADA' ? 'save' : 'info'"
      :loading="updatingStatus"
      @close="closeStatusConfirm"
      @confirm="confirmStatusChange"
    />

    <section class="finance-signal-grid">
      <article class="data-panel">
        <FileSpreadsheet :size="22" />
        <div>
          <strong>{{ summary.lines }}</strong>
          <span>Líneas de pago</span>
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
          <span>Corridas históricas</span>
        </div>
      </article>
    </section>
  </div>
</template>
