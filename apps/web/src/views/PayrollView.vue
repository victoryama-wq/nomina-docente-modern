<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { AlertTriangle, Clock3, Download, Eye, History, RefreshCw, Save, Search } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import {
  downloadPayrollExport,
  fetchPayrollContext,
  fetchPayrollRun,
  previewPayroll,
  savePayrollRun,
  type CalendarPeriod,
  type CycleOption,
  type PayrollExtraDetail,
  type PayrollInput,
  type PayrollLine,
  type PayrollPreview,
  type PayrollRun,
  type PayrollScheduleDetail,
  type PayrollSummary
} from '../api';
import ConfirmModal from '../components/modals/ConfirmModal.vue';
import { moneyLabel } from '../utils/format';

type AlertFilter = 'TODOS' | 'CON_ALERTAS' | 'SIN_ALERTAS';
type PayrollViewMode = 'RESUMEN' | 'DETALLE';

const authStore = useAuthStore();

const zeroSummary = (): PayrollSummary => ({
  lines: 0,
  teachers: 0,
  coordinations: 0,
  baseHours: 0,
  grossBaseAmount: 0,
  absenceDiscountAmount: 0,
  delayDiscountAmount: 0,
  discountAmount: 0,
  scheduleExtraHours: 0,
  scheduleExtraAmount: 0,
  loggedExtraHours: 0,
  loggedExtraAmount: 0,
  totalExtraHours: 0,
  totalExtraAmount: 0,
  totalAmount: 0,
  alerts: 0
});

const blankInput = (): PayrollInput => ({
  calendarConfigId: '',
  cycleId: '',
  periodLabel: '',
  payrollStart: '',
  payrollEnd: '',
  module1Start: '',
  module1End: '',
  module2Start: '',
  module2End: ''
});

const cycles = ref<CycleOption[]>([]);
const activeCycle = ref<CycleOption | null>(null);
const selectedCycleId = ref('');
const calendarPeriods = ref<CalendarPeriod[]>([]);
const recentRuns = ref<PayrollRun[]>([]);
const currentPreview = ref<PayrollPreview | null>(null);
const form = ref<PayrollInput>(blankInput());
const searchText = ref('');
const alertFilter = ref<AlertFilter>('TODOS');
const viewMode = ref<PayrollViewMode>('RESUMEN');
const selectedLineKey = ref('');
const pageBusy = ref(false);
const calculating = ref(false);
const saving = ref(false);
const exporting = ref<'summary' | 'schedules' | 'extras' | 'detail' | ''>('');
const loadingRunId = ref('');
const selectedRunId = ref('');
const confirmSavePayrollOpen = ref(false);
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

const summary = computed(() => currentPreview.value?.summary || zeroSummary());
const selectedRun = computed(() => currentPreview.value?.run || recentRuns.value.find((run) => run.id === selectedRunId.value) || null);
const selectedCalendarPeriod = computed(
  () => calendarPeriods.value.find((period) => period.id === form.value.calendarConfigId) || null
);
const hasCalendarSelection = computed(() => !!form.value.calendarConfigId);

const filteredLines = computed(() => {
  const text = searchText.value.toLowerCase().trim();
  return (currentPreview.value?.lines || []).filter((line) => {
    const hasAlerts = line.alerts.length > 0;
    const haystack = [
      line.teacherName,
      line.coordinationName,
      line.category,
      line.paymentType,
      line.alerts.join(' ')
    ]
      .join(' ')
      .toLowerCase();
    const matchesText = !text || haystack.includes(text);
    const matchesAlert =
      alertFilter.value === 'TODOS' ||
      (alertFilter.value === 'CON_ALERTAS' && hasAlerts) ||
      (alertFilter.value === 'SIN_ALERTAS' && !hasAlerts);
    return matchesText && matchesAlert;
  });
});

const selectedLine = computed(() => {
  if (!filteredLines.value.length) return null;
  return filteredLines.value.find((line) => line.key === selectedLineKey.value) || filteredLines.value[0];
});

const selectedScheduleDetails = computed<PayrollScheduleDetail[]>(() => {
  const line = selectedLine.value;
  if (!line) return [];
  return (currentPreview.value?.details || []).filter((detail) => detail.lineKey === line.key);
});

const selectedExtraDetails = computed<PayrollExtraDetail[]>(() => {
  const line = selectedLine.value;
  if (!line) return [];
  return (currentPreview.value?.extraDetails || []).filter((detail) => detail.lineKey === line.key);
});

const selectedLineDetailTotals = computed(() => {
  const schedules = selectedScheduleDetails.value;
  const extras = selectedExtraDetails.value;
  return {
    schedules: schedules.length,
    extras: extras.length,
    scheduleBaseHours: schedules.reduce((sum, detail) => sum + numberValue(detail.baseHours), 0),
    scheduleBaseAmount: schedules.reduce((sum, detail) => sum + numberValue(detail.baseNetAmount), 0),
    extraHours: extras.reduce((sum, detail) => sum + numberValue(detail.hours), 0),
    extraAmount: extras.reduce((sum, detail) => sum + numberValue(detail.totalAmount), 0)
  };
});

const calendarLabel = computed(() => {
  const calendar = currentPreview.value?.calendar;
  if (!calendar) return 'Sin cálculo';
  const dayCounts = calendar.dayCounts;
  return `L${dayCounts.L} M${dayCounts.M} X${dayCounts.X} J${dayCounts.J} V${dayCounts.V} / M1 ${calendar.module1Saturdays} sab / M2 ${calendar.module2Saturdays} sab / ${calendar.blackoutDates.length} inhábiles`;
});

const canSaveRun = computed(
  () =>
    authStore.canFinalizePayroll &&
    !!form.value.calendarConfigId &&
    !!form.value.payrollStart &&
    !!form.value.payrollEnd &&
    !!form.value.module1Start &&
    !!form.value.module1End &&
    !!form.value.module2Start &&
    !!form.value.module2End &&
    !saving.value
);

const isGlobalPayrollReadOnly = computed(
  () =>
    authStore.session?.permissions?.includes('finance.global_view') &&
    !authStore.session?.permissions?.includes('finance.view') &&
    !authStore.canFinalizePayroll &&
    !authStore.isAdmin
);

const canExportPayrollRun = computed(() => !isGlobalPayrollReadOnly.value);

function numberValue(value: number | string | null | undefined) {
  return Number(value) || 0;
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function formatHours(value: number | string | null | undefined) {
  const numeric = numberValue(value);
  return Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const [year, month, day] = dateOnly(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function categoryLabel(category: string) {
  if (category === 'V') return 'VIP';
  if (category === 'M') return 'Medio tiempo';
  if (category === 'N') return 'Nuevo ingreso';
  return 'Sin categoría';
}

function paymentLabel(paymentType: string) {
  if (paymentType === 'E') return 'Efectivo';
  if (paymentType === '1') return 'Transferencia 1';
  if (paymentType === '2') return 'Transferencia 2';
  return 'Sin tipo';
}

function statusClass(run: PayrollRun) {
  if (run.status === 'CERRADA' || run.status === 'APROBADA') return 'ok';
  if (run.status === 'CANCELADA') return 'danger';
  return 'neutral';
}

function lineBadge(line: PayrollLine) {
  if (line.alerts.length) return { label: `${line.alerts.length} alerta${line.alerts.length === 1 ? '' : 's'}`, className: 'warning' };
  return { label: 'Completa', className: 'ok' };
}

function runSourceLabel() {
  if (selectedRun.value) return `Histórico guardado / ${selectedRun.value.status}`;
  return 'Vista previa viva';
}

function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
  setTimeout(() => clearNotice(), 3400);
}

function clearNotice() {
  notice.value = null;
}

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(fileName: string, headers: string[], rows: unknown[][]) {
  const content = `\uFEFF${[headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\r\n')}\r\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function safeFilePart(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function defaultPeriodLabel() {
  if (!form.value.payrollStart || !form.value.payrollEnd) return '';
  return `${dateOnly(form.value.payrollStart)} a ${dateOnly(form.value.payrollEnd)}`;
}

function payloadFromForm(): PayrollInput {
  return {
    ...form.value,
    calendarConfigId: form.value.calendarConfigId || undefined,
    cycleId: selectedCycleId.value || form.value.cycleId || undefined,
    periodLabel: form.value.periodLabel.trim() || defaultPeriodLabel(),
    payrollStart: dateOnly(form.value.payrollStart),
    payrollEnd: dateOnly(form.value.payrollEnd),
    module1Start: dateOnly(form.value.module1Start),
    module1End: dateOnly(form.value.module1End),
    module2Start: dateOnly(form.value.module2Start),
    module2End: dateOnly(form.value.module2End)
  };
}

function applyContext(data: {
  activeCycle: CycleOption;
  cycles: CycleOption[];
  defaults: PayrollInput;
  calendarPeriods: CalendarPeriod[];
  recentRuns: PayrollRun[];
}) {
  activeCycle.value = data.activeCycle;
  selectedCycleId.value = data.activeCycle.id;
  cycles.value = data.cycles;
  const normalizedPeriods = data.calendarPeriods.map((period) => ({
    ...period,
    payrollStart: dateOnly(period.payrollStart),
    payrollEnd: dateOnly(period.payrollEnd),
    module1Start: dateOnly(period.module1Start),
    module1End: dateOnly(period.module1End),
    module2Start: dateOnly(period.module2Start),
    module2End: dateOnly(period.module2End),
    blackoutDates: (period.blackoutDates as Array<CalendarPeriod['blackoutDates'][number] | string>).map((blackout) =>
      typeof blackout === 'string'
        ? { blackoutDate: dateOnly(blackout), reason: 'Día inhábil' }
        : {
            ...blackout,
            blackoutDate: dateOnly(blackout.blackoutDate)
          }
    )
  }));
  calendarPeriods.value = normalizedPeriods;
  recentRuns.value = data.recentRuns;
  const defaultPeriod =
    normalizedPeriods.find((period) => period.id === data.defaults.calendarConfigId) || normalizedPeriods[0] || null;
  form.value = defaultPeriod
    ? {
        calendarConfigId: defaultPeriod.id,
        cycleId: defaultPeriod.cycleId,
        periodLabel: defaultPeriod.periodLabel,
        payrollStart: defaultPeriod.payrollStart,
        payrollEnd: defaultPeriod.payrollEnd,
        module1Start: defaultPeriod.module1Start,
        module1End: defaultPeriod.module1End,
        module2Start: defaultPeriod.module2Start,
        module2End: defaultPeriod.module2End
      }
    : {
        ...data.defaults,
        calendarConfigId: data.defaults.calendarConfigId || '',
        cycleId: data.activeCycle.id
      };
  form.value.payrollStart = dateOnly(form.value.payrollStart);
  form.value.payrollEnd = dateOnly(form.value.payrollEnd);
  form.value.module1Start = dateOnly(form.value.module1Start);
  form.value.module1End = dateOnly(form.value.module1End);
  form.value.module2Start = dateOnly(form.value.module2Start);
  form.value.module2End = dateOnly(form.value.module2End);
  selectedRunId.value = '';
  selectedLineKey.value = '';
  currentPreview.value = null;
}

async function applyCalendarPeriod() {
  const period = selectedCalendarPeriod.value;
  if (!period) {
    currentPreview.value = null;
    selectedRunId.value = '';
    selectedLineKey.value = '';
    return;
  }
  form.value = {
    calendarConfigId: period.id,
    cycleId: period.cycleId,
    periodLabel: period.periodLabel,
    payrollStart: dateOnly(period.payrollStart),
    payrollEnd: dateOnly(period.payrollEnd),
    module1Start: dateOnly(period.module1Start),
    module1End: dateOnly(period.module1End),
    module2Start: dateOnly(period.module2Start),
    module2End: dateOnly(period.module2End)
  };
  currentPreview.value = null;
  selectedRunId.value = '';
  selectedLineKey.value = '';
  await calculatePreview(true);
}

async function loadContext(cycleId = selectedCycleId.value || undefined) {
  if (!authStore.canViewPayroll) return;
  pageBusy.value = true;
  clearNotice();
  try {
    const data = await fetchPayrollContext(cycleId);
    applyContext(data);
    await calculatePreview(true);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar nómina.');
  } finally {
    pageBusy.value = false;
  }
}

async function calculatePreview(silent = false) {
  if (!hasCalendarSelection.value) {
    currentPreview.value = null;
    if (!silent) setNotice('error', 'Selecciona una quincena del calendario para calcular la nómina.');
    return;
  }
  if (!form.value.payrollStart || !form.value.payrollEnd) return;
  calculating.value = true;
  if (!silent) clearNotice();
  try {
    currentPreview.value = await previewPayroll(payloadFromForm());
    selectedRunId.value = '';
    selectedLineKey.value = '';
    if (!silent) setNotice('ok', 'Vista previa de nómina actualizada.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible calcular la nómina.');
  } finally {
    calculating.value = false;
  }
}

async function refreshPreview() {
  await calculatePreview(false);
}

function requestSaveCurrentRun() {
  if (!canSaveRun.value) return;
  confirmSavePayrollOpen.value = true;
  clearNotice();
}

function closeSavePayrollModal() {
  if (saving.value) return;
  confirmSavePayrollOpen.value = false;
}

async function confirmSaveCurrentRun() {
  if (!canSaveRun.value) return;
  saving.value = true;
  clearNotice();
  try {
    const result = await savePayrollRun(payloadFromForm());
    confirmSavePayrollOpen.value = false;
    currentPreview.value = result;
    selectedRunId.value = result.run.id;
    selectedLineKey.value = '';
    recentRuns.value = [result.run, ...recentRuns.value.filter((run) => run.id !== result.run.id)].slice(0, 36);
    setNotice('ok', result.message || 'Nómina guardada correctamente.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar la nómina.');
  } finally {
    saving.value = false;
  }
}

async function loadRun(run: PayrollRun) {
  loadingRunId.value = run.id;
  clearNotice();
  try {
    const result = await fetchPayrollRun(run.id);
    currentPreview.value = result;
    selectedRunId.value = run.id;
    selectedLineKey.value = '';
    selectedCycleId.value = result.run.cycleId;
    form.value = {
      ...result.input,
      cycleId: result.run.cycleId,
      payrollStart: dateOnly(result.input.payrollStart),
      payrollEnd: dateOnly(result.input.payrollEnd),
      module1Start: dateOnly(result.input.module1Start),
      module1End: dateOnly(result.input.module1End),
      module2Start: dateOnly(result.input.module2Start),
      module2End: dateOnly(result.input.module2End)
    };
    setNotice('ok', 'Corrida historica cargada.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible abrir la corrida.');
  } finally {
    loadingRunId.value = '';
  }
}

function selectLine(line: PayrollLine) {
  selectedLineKey.value = line.key;
}

async function exportRun(kind: 'summary' | 'schedules' | 'extras') {
  const run = selectedRun.value;
  if (!run || !canExportPayrollRun.value) return;
  exporting.value = kind;
  clearNotice();
  try {
    await downloadPayrollExport(run.id, kind);
    setNotice('ok', 'Exportación de nómina generada.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible exportar la nómina.');
  } finally {
    exporting.value = '';
  }
}

function detailExportHeaders() {
  return [
    'Nombre del docente',
    'Coordinación',
    'Total de horas base con descuento',
    'Total de horas extra',
    'Faltas',
    'Retardos',
    'Monto base con descuento',
    'Monto extra',
    'Total a pagar'
  ];
}

function detailExportRows() {
  if (!currentPreview.value) return [];
  return filteredLines.value.map((line) => [
    line.teacherName,
    line.coordinationName,
    numberValue(line.baseHours) - numberValue(line.absences) - numberValue(line.delayDiscountHours),
    line.totalExtraHours,
    line.absences,
    line.delays,
    line.baseNetAmount,
    line.totalExtraAmount,
    line.totalAmount
  ]);
}

function exportDetailCsv() {
  if (!currentPreview.value || !canExportPayrollRun.value) return;
  const rows = detailExportRows();
  if (!rows.length) {
    setNotice('error', 'No hay detalle de nómina para exportar con los filtros actuales.');
    return;
  }
  exporting.value = 'detail';
  clearNotice();
  try {
    const period = safeFilePart(currentPreview.value.input.periodLabel || defaultPeriodLabel() || 'nomina');
    const cycle = safeFilePart(activeCycle.value?.quarterCode || 'ciclo');
    downloadCsv(`nomina-${cycle}-${period}-detalle-docente.csv`, detailExportHeaders(), rows);
    setNotice('ok', 'Detalle por docente exportado en CSV.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible exportar el detalle por docente.');
  } finally {
    exporting.value = '';
  }
}

onMounted(() => {
  loadContext();
});
</script>

<template>
  <div class="view-stack">
    <div v-if="notice" class="notice" :class="notice.type" style="margin-bottom: 1rem;">
      {{ notice.text }}
    </div>

    <section class="toolbar-card">
      <div>
        <p class="eyebrow">Nómina</p>
        <h3>Cálculo quincenal docente</h3>
      </div>
      <div class="toolbar-actions">
        <select v-if="cycles.length" v-model="selectedCycleId" @change="loadContext(selectedCycleId)">
          <option v-for="cycle in cycles" :key="cycle.id" :value="cycle.id">
            {{ cycle.periodLabel }} - {{ cycle.quarterCode }} / {{ cycle.status }}
          </option>
        </select>
        <button class="secondary-action" type="button" @click="loadContext(selectedCycleId)">
          <RefreshCw :size="17" :class="{ spin: pageBusy }" />
          Actualizar datos
        </button>
      </div>
    </section>

    <section class="data-panel payroll-controls">
      <div class="payroll-control-grid">
        <label>
          <span>Quincena calendario</span>
          <select v-model="form.calendarConfigId" @change="applyCalendarPeriod">
            <option value="">Seleccionar quincena</option>
            <option v-for="period in calendarPeriods" :key="period.id" :value="period.id">
              {{ period.periodLabel }} / {{ period.blackoutDates.length }} inhábiles
            </option>
          </select>
        </label>
        <label>
          <span>Etiqueta</span>
          <input
            v-model="form.periodLabel"
            :disabled="!!selectedCalendarPeriod"
            :placeholder="defaultPeriodLabel() || 'Periodo de nómina'"
          />
        </label>
        <label>
          <span>Inicio quincena</span>
          <input v-model="form.payrollStart" type="date" :disabled="!!selectedCalendarPeriod" />
        </label>
        <label>
          <span>Cierre quincena</span>
          <input v-model="form.payrollEnd" type="date" :disabled="!!selectedCalendarPeriod" />
        </label>
        <label>
          <span>Inicio módulo 1</span>
          <input v-model="form.module1Start" type="date" :disabled="!!selectedCalendarPeriod" />
        </label>
        <label>
          <span>Cierre módulo 1</span>
          <input v-model="form.module1End" type="date" :disabled="!!selectedCalendarPeriod" />
        </label>
        <label>
          <span>Inicio módulo 2</span>
          <input v-model="form.module2Start" type="date" :disabled="!!selectedCalendarPeriod" />
        </label>
        <label>
          <span>Cierre módulo 2</span>
          <input v-model="form.module2End" type="date" :disabled="!!selectedCalendarPeriod" />
        </label>
        <div class="payroll-actions">
          <button class="secondary-action" type="button" :disabled="calculating || !hasCalendarSelection" @click="refreshPreview">
            <RefreshCw :size="17" :class="{ spin: calculating }" />
            Actualizar cálculo
          </button>
          <button
            v-if="authStore.canFinalizePayroll"
            class="primary-inline"
            type="button"
            :disabled="!canSaveRun"
            @click="requestSaveCurrentRun"
          >
            <Save :size="17" />
            Guardar nómina
          </button>
        </div>
      </div>
    </section>

    <section class="metric-grid compact">
      <article class="metric-card mini"><p>Docentes</p><strong>{{ summary.teachers }}</strong><small>{{ summary.coordinations }} coordinaciones</small></article>
      <article class="metric-card mini"><p>Horas base</p><strong>{{ formatHours(summary.baseHours) }}</strong><small>{{ moneyLabel(summary.grossBaseAmount) }}</small></article>
      <article class="metric-card mini"><p>Extras</p><strong>{{ formatHours(summary.totalExtraHours) }}</strong><small>{{ moneyLabel(summary.totalExtraAmount) }}</small></article>
      <article class="metric-card mini"><p>Total</p><strong>{{ moneyLabel(summary.totalAmount) }}</strong><small>Desc. {{ moneyLabel(summary.discountAmount) }}</small></article>
    </section>

    <section v-if="recentRuns.length" class="data-panel payroll-history">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Historial</p>
          <h3>Nóminas guardadas</h3>
        </div>
        <div class="payroll-history-actions">
          <span class="subtle-pill"><History :size="16" /> {{ recentRuns.length }} guardadas</span>
          <button
            v-if="canExportPayrollRun"
            class="secondary-action"
            type="button"
            :disabled="!selectedRun || exporting === 'summary'"
            @click="exportRun('summary')"
          >
            <Download :size="16" />
            Resumen CSV
          </button>
          <button
            v-if="canExportPayrollRun"
            class="secondary-action"
            type="button"
            :disabled="!selectedRun || exporting === 'schedules'"
            @click="exportRun('schedules')"
          >
            <Download :size="16" />
            Horarios CSV
          </button>
          <button
            v-if="canExportPayrollRun"
            class="secondary-action"
            type="button"
            :disabled="!selectedRun || exporting === 'extras'"
            @click="exportRun('extras')"
          >
            <Download :size="16" />
            Extras CSV
          </button>
          <span v-if="isGlobalPayrollReadOnly" class="subtle-pill">Vista global de solo consulta</span>
        </div>
      </div>
      <div class="run-list">
        <button
          v-for="run in recentRuns"
          :key="run.id"
          class="run-chip"
          :class="{ active: selectedRunId === run.id }"
          type="button"
          :disabled="loadingRunId === run.id"
          @click="loadRun(run)"
        >
          <span class="badge" :class="statusClass(run)">{{ run.status }}</span>
          <strong>{{ run.periodLabel }}</strong>
          <small>{{ moneyLabel(run.summary?.totalAmount || 0) }} / {{ formatDateTime(run.calculatedAt || run.createdAt) }}</small>
          <Eye :size="16" />
        </button>
      </div>
    </section>

    <section class="single-grid">
      <div class="data-panel full">
        <div class="filters-row payroll">
          <label class="search-box">
            <Search :size="17" />
            <input v-model="searchText" placeholder="Buscar docente, coordinación o alerta" />
          </label>
          <select v-model="alertFilter">
            <option value="TODOS">Todas las líneas</option>
            <option value="CON_ALERTAS">Con alertas</option>
            <option value="SIN_ALERTAS">Sin alertas</option>
          </select>
          <span class="subtle-pill">
            <Clock3 :size="16" />
            {{ calendarLabel }}
          </span>
        </div>

        <div class="payroll-view-switch">
          <div class="segmented-control" aria-label="Vista de nómina">
            <button type="button" :class="{ active: viewMode === 'RESUMEN' }" @click="viewMode = 'RESUMEN'">
              Resumen
            </button>
            <button type="button" :class="{ active: viewMode === 'DETALLE' }" @click="viewMode = 'DETALLE'">
              Detalle por docente
            </button>
          </div>
          <div class="payroll-detail-actions">
            <button
              v-if="viewMode === 'DETALLE' && canExportPayrollRun"
              class="secondary-action"
              type="button"
              :disabled="!currentPreview || !filteredLines.length || exporting === 'detail'"
              @click="exportDetailCsv"
            >
              <Download :size="16" />
              Detalle CSV
            </button>
            <span class="subtle-pill">{{ runSourceLabel() }}</span>
          </div>
        </div>

        <div v-if="viewMode === 'RESUMEN'" class="table-shell">
          <table class="payroll-table">
            <colgroup>
              <col class="col-teacher" />
              <col class="col-coordination" />
              <col class="col-base" />
              <col class="col-discounts" />
              <col class="col-extras" />
              <col class="col-total" />
              <col class="col-alerts" />
            </colgroup>
            <thead>
              <tr>
                <th>Docente</th>
                <th>Coordinación</th>
                <th>Base</th>
                <th>Descuentos</th>
                <th>Extras</th>
                <th>Total</th>
                <th>Alertas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredLines.length">
                <td colspan="7" class="empty-cell">
                  {{ currentPreview ? 'No hay líneas con el filtro actual.' : 'Selecciona una quincena para ver la nómina.' }}
                </td>
              </tr>
              <tr
                v-for="line in filteredLines"
                :key="line.key"
                class="selectable-row"
                :class="{ active: selectedLine?.key === line.key }"
                @click="selectLine(line)"
              >
                <td>
                  <strong>{{ line.teacherName }}</strong>
                  <span>{{ categoryLabel(line.category) }}</span>
                  <small>{{ paymentLabel(line.paymentType) }}</small>
                </td>
                <td>
                  <strong>{{ line.coordinationName }}</strong>
                  <span>{{ line.scheduleCount }} horario{{ line.scheduleCount === 1 ? '' : 's' }}</span>
                  <small>{{ line.loggedExtraCount }} extra{{ line.loggedExtraCount === 1 ? '' : 's' }} externo{{ line.loggedExtraCount === 1 ? '' : 's' }}</small>
                </td>
                <td>
                  <strong>{{ formatHours(line.baseHours) }} h</strong>
                  <span>{{ moneyLabel(line.grossBaseAmount) }}</span>
                  <small>Neto base {{ moneyLabel(line.baseNetAmount) }}</small>
                </td>
                <td>
                  <strong>{{ moneyLabel(line.absenceDiscountAmount + line.delayDiscountAmount) }}</strong>
                  <span>Faltas {{ formatHours(line.absences) }} h</span>
                  <small>Retardos {{ formatHours(line.delays) }} / {{ formatHours(line.delayDiscountHours) }} h</small>
                </td>
                <td>
                  <strong>{{ formatHours(line.totalExtraHours) }} h</strong>
                  <span>Incidencias {{ formatHours(line.scheduleExtraHours) }} h / {{ moneyLabel(line.scheduleExtraAmount) }}</span>
                  <small>Extras {{ formatHours(line.loggedExtraHours) }} h / {{ moneyLabel(line.loggedExtraAmount) }}</small>
                </td>
                <td>
                  <strong>{{ moneyLabel(line.totalAmount) }}</strong>
                  <span>Total extras {{ moneyLabel(line.totalExtraAmount) }}</span>
                </td>
                <td>
                  <span class="badge" :class="lineBadge(line).className">{{ lineBadge(line).label }}</span>
                  <div v-if="line.alerts.length" class="alert-list">
                    <span v-for="alert in line.alerts" :key="alert">
                      <AlertTriangle :size="12" />
                      {{ alert }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="payroll-detail-grid">
          <div class="payroll-line-list">
            <button
              v-for="line in filteredLines"
              :key="line.key"
              class="payroll-line-card"
              :class="{ active: selectedLine?.key === line.key }"
              type="button"
              @click="selectLine(line)"
            >
              <strong>{{ line.teacherName }}</strong>
              <span>{{ line.coordinationName }}</span>
              <small>{{ formatHours(line.baseHours) }} h base / {{ formatHours(line.totalExtraHours) }} h extras</small>
              <em>{{ moneyLabel(line.totalAmount) }}</em>
            </button>
            <div v-if="!filteredLines.length" class="empty-cell">No hay líneas con el filtro actual.</div>
          </div>

          <div class="payroll-detail-panel" v-if="selectedLine">
            <div class="payroll-detail-header">
              <div>
                <p class="eyebrow">Detalle histórico</p>
                <h3>{{ selectedLine.teacherName }}</h3>
                <span>{{ selectedLine.coordinationName }} / {{ categoryLabel(selectedLine.category) }}</span>
              </div>
              <strong>{{ moneyLabel(selectedLine.totalAmount) }}</strong>
            </div>

            <div class="payroll-detail-metrics">
              <span><b>{{ selectedLineDetailTotals.schedules }}</b> horarios</span>
              <span><b>{{ formatHours(selectedLineDetailTotals.scheduleBaseHours) }}</b> h base</span>
              <span><b>{{ moneyLabel(selectedLineDetailTotals.scheduleBaseAmount) }}</b> neto base</span>
              <span><b>{{ selectedLineDetailTotals.extras }}</b> extras externos</span>
              <span><b>{{ formatHours(selectedLineDetailTotals.extraHours) }}</b> h extra</span>
              <span><b>{{ moneyLabel(selectedLineDetailTotals.extraAmount) }}</b> monto extra</span>
            </div>

            <div class="detail-subsection">
              <div class="section-title compact">
                <div>
                  <p class="eyebrow">Horarios e incidencias</p>
                  <h3>Base calculada</h3>
                </div>
              </div>
              <div class="table-shell compact">
                <table class="payroll-detail-table">
                  <thead>
                    <tr>
                      <th>Asignatura</th>
                      <th>Horas</th>
                      <th>Incidencias</th>
                      <th>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!selectedScheduleDetails.length">
                      <td colspan="4" class="empty-cell">Sin horarios base para esta línea.</td>
                    </tr>
                    <tr v-for="detail in selectedScheduleDetails" :key="detail.scheduleId">
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
            </div>

            <div class="detail-subsection">
              <div class="section-title compact">
                <div>
                  <p class="eyebrow">Extras externos</p>
                  <h3>Capturas adicionales</h3>
                </div>
              </div>
              <div class="table-shell compact">
                <table class="payroll-detail-table extras">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Motivo</th>
                      <th>Horas</th>
                      <th>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!selectedExtraDetails.length">
                      <td colspan="4" class="empty-cell">Sin extras externos para esta línea.</td>
                    </tr>
                    <tr v-for="detail in selectedExtraDetails" :key="detail.extraId">
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
            </div>
          </div>

          <div v-else class="payroll-detail-panel empty">
            <div class="empty-cell">Selecciona una línea de nómina para ver el detalle.</div>
          </div>
        </div>
      </div>
    </section>

    <ConfirmModal
      :show="confirmSavePayrollOpen"
      eyebrow="Nómina"
      title="Guardar nómina definitiva"
      :subject="form.periodLabel || defaultPeriodLabel()"
      message="Se conservará el histórico de esta quincena y se liberarán incidencias y extras operativos para continuar con la siguiente captura. Usa esta acción solo cuando Dirección autorice proceder al pago."
      :details="[
        `Docentes: ${summary.teachers}`,
        `Horas base: ${formatHours(summary.baseHours)}`,
        `Extras: ${formatHours(summary.totalExtraHours)} h`,
        `Total: ${moneyLabel(summary.totalAmount)}`
      ]"
      confirm-label="Guardar nómina"
      cancel-label="Seguir revisando"
      tone="warning"
      icon="save"
      :loading="saving"
      :disabled="!canSaveRun"
      @close="closeSavePayrollModal"
      @confirm="confirmSaveCurrentRun"
    />
  </div>
</template>
