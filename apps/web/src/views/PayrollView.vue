<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { AlertTriangle, Clock3, Eye, History, RefreshCw, Save, Search } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import {
  fetchPayrollContext,
  fetchPayrollRun,
  previewPayroll,
  savePayrollRun,
  type CalendarPeriod,
  type CycleOption,
  type PayrollInput,
  type PayrollLine,
  type PayrollPreview,
  type PayrollRun,
  type PayrollSummary
} from '../api';

type AlertFilter = 'TODOS' | 'CON_ALERTAS' | 'SIN_ALERTAS';

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
const pageBusy = ref(false);
const calculating = ref(false);
const saving = ref(false);
const loadingRunId = ref('');
const selectedRunId = ref('');
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

const summary = computed(() => currentPreview.value?.summary || zeroSummary());
const selectedCalendarPeriod = computed(
  () => calendarPeriods.value.find((period) => period.id === form.value.calendarConfigId) || null
);

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

const calendarLabel = computed(() => {
  const calendar = currentPreview.value?.calendar;
  if (!calendar) return 'Sin calculo';
  const dayCounts = calendar.dayCounts;
  return `L${dayCounts.L} M${dayCounts.M} X${dayCounts.X} J${dayCounts.J} V${dayCounts.V} / M1 ${calendar.module1Saturdays} sab / M2 ${calendar.module2Saturdays} sab / ${calendar.blackoutDates.length} inhabiles`;
});

const canSaveRun = computed(
  () =>
    authStore.canFinalizePayroll &&
    !!form.value.payrollStart &&
    !!form.value.payrollEnd &&
    !!form.value.module1Start &&
    !!form.value.module1End &&
    !!form.value.module2Start &&
    !!form.value.module2End &&
    !saving.value
);

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

function moneyLabel(value: number | string | null | undefined) {
  return numberValue(value).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN'
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function categoryLabel(category: string) {
  if (category === 'V') return 'VIP';
  if (category === 'M') return 'Medio tiempo';
  if (category === 'N') return 'Nuevo ingreso';
  return 'Sin categoria';
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

function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
  setTimeout(() => clearNotice(), 3400);
}

function clearNotice() {
  notice.value = null;
}

function defaultPeriodLabel() {
  if (!form.value.payrollStart || !form.value.payrollEnd) return '';
  return `${dateOnly(form.value.payrollStart)} a ${dateOnly(form.value.payrollEnd)}`;
}

function payloadFromForm(): PayrollInput {
  return {
    ...form.value,
    cycleId: selectedCycleId.value || form.value.cycleId,
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
  calendarPeriods.value = data.calendarPeriods.map((period) => ({
    ...period,
    payrollStart: dateOnly(period.payrollStart),
    payrollEnd: dateOnly(period.payrollEnd),
    module1Start: dateOnly(period.module1Start),
    module1End: dateOnly(period.module1End),
    module2Start: dateOnly(period.module2Start),
    module2End: dateOnly(period.module2End),
    blackoutDates: period.blackoutDates.map((blackout) => ({
      ...blackout,
      blackoutDate: dateOnly(blackout.blackoutDate)
    }))
  }));
  recentRuns.value = data.recentRuns;
  form.value = {
    ...data.defaults,
    cycleId: data.activeCycle.id
  };
  form.value.payrollStart = dateOnly(form.value.payrollStart);
  form.value.payrollEnd = dateOnly(form.value.payrollEnd);
  form.value.module1Start = dateOnly(form.value.module1Start);
  form.value.module1End = dateOnly(form.value.module1End);
  form.value.module2Start = dateOnly(form.value.module2Start);
  form.value.module2End = dateOnly(form.value.module2End);
  selectedRunId.value = '';
  currentPreview.value = null;
}

async function applyCalendarPeriod() {
  const period = selectedCalendarPeriod.value;
  if (!period) return;
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
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar nomina.');
  } finally {
    pageBusy.value = false;
  }
}

async function calculatePreview(silent = false) {
  if (!form.value.payrollStart || !form.value.payrollEnd) return;
  calculating.value = true;
  if (!silent) clearNotice();
  try {
    currentPreview.value = await previewPayroll(payloadFromForm());
    selectedRunId.value = '';
    if (!silent) setNotice('ok', 'Vista previa de nomina actualizada.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible calcular la nomina.');
  } finally {
    calculating.value = false;
  }
}

async function refreshPreview() {
  await calculatePreview(false);
}

async function saveCurrentRun() {
  if (!canSaveRun.value) return;
  const confirmed = window.confirm(
    'Guardar la nomina definitiva de esta quincena? Esta accion conserva el historico y libera incidencias/extras operativos para la siguiente quincena.'
  );
  if (!confirmed) return;
  saving.value = true;
  clearNotice();
  try {
    const result = await savePayrollRun(payloadFromForm());
    currentPreview.value = result;
    selectedRunId.value = result.run.id;
    recentRuns.value = [result.run, ...recentRuns.value.filter((run) => run.id !== result.run.id)].slice(0, 12);
    setNotice('ok', result.message || 'Nomina guardada correctamente.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar la nomina.');
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
        <p class="eyebrow">Nomina</p>
        <h3>Calculo quincenal docente</h3>
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
              {{ period.periodLabel }} / {{ period.blackoutDates.length }} inhabiles
            </option>
          </select>
        </label>
        <label>
          <span>Etiqueta</span>
          <input
            v-model="form.periodLabel"
            :disabled="!!selectedCalendarPeriod"
            :placeholder="defaultPeriodLabel() || 'Periodo de nomina'"
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
          <span>Inicio modulo 1</span>
          <input v-model="form.module1Start" type="date" :disabled="!!selectedCalendarPeriod" />
        </label>
        <label>
          <span>Cierre modulo 1</span>
          <input v-model="form.module1End" type="date" :disabled="!!selectedCalendarPeriod" />
        </label>
        <label>
          <span>Inicio modulo 2</span>
          <input v-model="form.module2Start" type="date" :disabled="!!selectedCalendarPeriod" />
        </label>
        <label>
          <span>Cierre modulo 2</span>
          <input v-model="form.module2End" type="date" :disabled="!!selectedCalendarPeriod" />
        </label>
        <div class="payroll-actions">
          <button class="secondary-action" type="button" :disabled="calculating" @click="refreshPreview">
            <RefreshCw :size="17" :class="{ spin: calculating }" />
            Actualizar calculo
          </button>
          <button
            v-if="authStore.canFinalizePayroll"
            class="primary-inline"
            type="button"
            :disabled="!canSaveRun"
            @click="saveCurrentRun"
          >
            <Save :size="17" />
            Guardar nomina
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
          <h3>Corridas recientes</h3>
        </div>
        <span class="subtle-pill"><History :size="16" /> {{ recentRuns.length }} guardadas</span>
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
            <input v-model="searchText" placeholder="Buscar docente, coordinacion o alerta" />
          </label>
          <select v-model="alertFilter">
            <option value="TODOS">Todas las lineas</option>
            <option value="CON_ALERTAS">Con alertas</option>
            <option value="SIN_ALERTAS">Sin alertas</option>
          </select>
          <span class="subtle-pill">
            <Clock3 :size="16" />
            {{ calendarLabel }}
          </span>
        </div>

        <div class="table-shell">
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
                <th>Coordinacion</th>
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
                  {{ currentPreview ? 'No hay lineas con el filtro actual.' : 'Selecciona una quincena para ver la nomina.' }}
                </td>
              </tr>
              <tr v-for="line in filteredLines" :key="line.key">
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
      </div>
    </section>
  </div>
</template>
