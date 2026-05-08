<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CalendarDays, CheckCircle2, Edit3, Plus, RefreshCw, Save, Trash2, X } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import {
  createCalendarPeriod,
  createAcademicCycle,
  activateAcademicCycle,
  deleteCalendarPeriod,
  fetchCalendarContext,
  updateAcademicCycle,
  updateCalendarPeriod,
  updateCycleModuleDates,
  type AcademicCyclePayload,
  type CalendarPeriod,
  type CalendarPeriodPayload,
  type CycleModuleDatesPayload,
  type CycleOption
} from '../api';
import ConfirmModal from '../components/modals/ConfirmModal.vue';

const authStore = useAuthStore();

const cycles = ref<CycleOption[]>([]);
const activeCycle = ref<CycleOption | null>(null);
const selectedCycleId = ref('');
const periods = ref<CalendarPeriod[]>([]);
const editingId = ref<string | null>(null);
const editingCycleId = ref<string | null>(null);
const pageBusy = ref(false);
const saving = ref(false);
const savingModules = ref(false);
const savingCycle = ref(false);
const activatingCycle = ref(false);
const deletingPeriod = ref(false);
const pendingDeletePeriod = ref<CalendarPeriod | null>(null);
const pendingActivateCycle = ref<CycleOption | null>(null);
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);
const formError = ref('');
const moduleError = ref('');
const cycleError = ref('');
const blackoutDraft = ref({ blackoutDate: '', reason: '' });

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function toDatetimeLocal(value: string | Date | null | undefined) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string | null | undefined) {
  return value ? `${value}:00-05:00` : `${toDatetimeLocal(new Date())}:00-05:00`;
}

function currentFortnight() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const startDay = today.getDate() <= 15 ? 1 : 16;
  const endDay = today.getDate() <= 15 ? 15 : new Date(year, month + 1, 0).getDate();
  return {
    payrollStart: dateKey(new Date(Date.UTC(year, month, startDay))),
    payrollEnd: dateKey(new Date(Date.UTC(year, month, endDay)))
  };
}

function cycleDefaultsFromCode(code: string) {
  const match = code.match(/^(\d{2,4})-(1|2|3)$/);
  const rawYear = match ? Number(match[1]) : new Date().getFullYear() + 1;
  const codeYear = rawYear < 100 ? 2000 + rawYear : rawYear;
  const quarter = match ? Number(match[2]) : 1;
  const calendarYear = quarter === 1 ? codeYear - 1 : codeYear;
  if (quarter === 1) {
    return {
      periodLabel: `Septiembre - Diciembre ${calendarYear}`,
      module1Start: `${calendarYear}-09-01`,
      module1End: `${calendarYear}-10-31`,
      module2Start: `${calendarYear}-11-01`,
      module2End: `${calendarYear}-12-31`
    };
  }
  if (quarter === 2) {
    return {
      periodLabel: `Enero - Abril ${calendarYear}`,
      module1Start: `${calendarYear}-01-01`,
      module1End: `${calendarYear}-02-28`,
      module2Start: `${calendarYear}-03-01`,
      module2End: `${calendarYear}-04-30`
    };
  }
  return {
    periodLabel: `Mayo - Agosto ${calendarYear}`,
    module1Start: `${calendarYear}-05-01`,
    module1End: `${calendarYear}-06-30`,
    module2Start: `${calendarYear}-07-01`,
    module2End: `${calendarYear}-08-31`
  };
}

function suggestNextQuarterCode() {
  const code = activeCycle.value?.quarterCode || '';
  const match = code.match(/^(\d{2,4})-(1|2|3)$/);
  if (!match) return `${String(new Date().getFullYear() + 1).slice(-2)}-1`;
  const rawYear = Number(match[1]);
  const quarter = Number(match[2]);
  const nextQuarter = quarter === 3 ? 1 : quarter + 1;
  const nextYear = quarter === 3 ? rawYear + 1 : rawYear;
  return `${String(nextYear).slice(-2)}-${nextQuarter}`;
}

function blankCycleForm(): AcademicCyclePayload {
  const quarterCode = suggestNextQuarterCode();
  const defaults = cycleDefaultsFromCode(quarterCode);
  return {
    quarterCode,
    ...defaults
  };
}

function blankForm(): CalendarPeriodPayload {
  const fortnight = currentFortnight();
  const cycle = activeCycle.value;
  return {
    cycleId: selectedCycleId.value || cycle?.id || '',
    periodLabel: `${fortnight.payrollStart} a ${fortnight.payrollEnd}`,
    payrollStart: fortnight.payrollStart,
    payrollEnd: fortnight.payrollEnd,
    module1Start: dateOnly(cycle?.module1Start) || fortnight.payrollStart,
    module1End: dateOnly(cycle?.module1End) || fortnight.payrollEnd,
    module2Start: dateOnly(cycle?.module2Start) || fortnight.payrollStart,
    module2End: dateOnly(cycle?.module2End) || fortnight.payrollEnd,
    incidencesAccessStartAt: toDatetimeLocal(new Date()),
    incidencesAccessDays: 5,
    extrasAccessStartAt: toDatetimeLocal(new Date()),
    extrasAccessDays: 5,
    blackoutDates: []
  };
}

const form = ref<CalendarPeriodPayload>(blankForm());
const moduleForm = ref<CycleModuleDatesPayload>({
  module1Start: '',
  module1End: '',
  module2Start: '',
  module2End: ''
});
const cycleForm = ref<AcademicCyclePayload>(blankCycleForm());

const summary = computed(() => {
  const blackoutTotal = periods.value.reduce((sum, period) => sum + period.blackoutDates.length, 0);
  return {
    periods: periods.value.length,
    blackoutTotal,
    nextPeriod: periods.value[0]?.periodLabel || 'Sin quincenas'
  };
});

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const [year, month, day] = dateOnly(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
  setTimeout(() => clearNotice(), 3200);
}

function clearNotice() {
  notice.value = null;
}

function refreshPeriodLabel() {
  if (!form.value.payrollStart || !form.value.payrollEnd) return;
  form.value.periodLabel = `${form.value.payrollStart} a ${form.value.payrollEnd}`;
}

function syncModuleForm(cycle: CycleOption | null) {
  moduleForm.value = {
    module1Start: dateOnly(cycle?.module1Start),
    module1End: dateOnly(cycle?.module1End),
    module2Start: dateOnly(cycle?.module2Start),
    module2End: dateOnly(cycle?.module2End)
  };
  moduleError.value = '';
}

function cycleStatusClass(status: CycleOption['status']) {
  if (status === 'ACTIVO') return 'ok';
  if (status === 'PLANEACION') return 'warning';
  return 'muted';
}

function newCycle() {
  editingCycleId.value = null;
  cycleForm.value = blankCycleForm();
  cycleError.value = '';
  clearNotice();
}

function editCycle(cycle: CycleOption) {
  if (cycle.status === 'CERRADO') return;
  editingCycleId.value = cycle.id;
  cycleForm.value = {
    periodLabel: cycle.periodLabel,
    quarterCode: cycle.quarterCode,
    module1Start: dateOnly(cycle.module1Start),
    module1End: dateOnly(cycle.module1End),
    module2Start: dateOnly(cycle.module2Start),
    module2End: dateOnly(cycle.module2End)
  };
  cycleError.value = '';
  clearNotice();
}

function validateCycleForm() {
  const cycle = cycleForm.value;
  if (!cycle.periodLabel.trim()) return 'Captura el periodo del ciclo.';
  if (!cycle.quarterCode.trim()) return 'Captura el código del ciclo.';
  if (!cycle.module1Start || !cycle.module1End || !cycle.module2Start || !cycle.module2End) {
    return 'Captura inicio y cierre de ambos módulos.';
  }
  if (cycle.module1Start > cycle.module1End) return 'El módulo 1 tiene fechas invertidas.';
  if (cycle.module2Start > cycle.module2End) return 'El módulo 2 tiene fechas invertidas.';
  if (cycle.module1End > cycle.module2End) return 'El cierre de módulo 1 no puede ser posterior al cierre de módulo 2.';
  return '';
}

async function saveCycle() {
  cycleError.value = validateCycleForm();
  if (cycleError.value) return;
  savingCycle.value = true;
  clearNotice();
  try {
    const payload = {
      ...cycleForm.value,
      periodLabel: cycleForm.value.periodLabel.trim(),
      quarterCode: cycleForm.value.quarterCode.trim().toUpperCase()
    };
    const response = editingCycleId.value
      ? await updateAcademicCycle(editingCycleId.value, payload)
      : await createAcademicCycle(payload);
    editingCycleId.value = response.cycle.id;
    await loadCalendar(response.cycle.id);
    setNotice('ok', response.message);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar el ciclo.');
  } finally {
    savingCycle.value = false;
  }
}

function requestActivateCycle(cycle: CycleOption) {
  pendingActivateCycle.value = cycle;
  clearNotice();
}

function closeActivateCycleModal() {
  if (activatingCycle.value) return;
  pendingActivateCycle.value = null;
}

async function confirmActivateCycle() {
  const cycle = pendingActivateCycle.value;
  if (!cycle) return;
  activatingCycle.value = true;
  clearNotice();
  try {
    const response = await activateAcademicCycle(cycle.id);
    pendingActivateCycle.value = null;
    editingCycleId.value = null;
    await loadCalendar(response.activeCycle.id);
    setNotice('ok', response.message);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible activar el ciclo.');
  } finally {
    activatingCycle.value = false;
  }
}

async function loadCalendar(cycleId = selectedCycleId.value || undefined) {
  if (!authStore.canManageCalendar) return;
  pageBusy.value = true;
  clearNotice();
  try {
    const data = await fetchCalendarContext(cycleId);
    activeCycle.value = data.activeCycle;
    selectedCycleId.value = data.activeCycle.id;
    cycles.value = data.cycles;
    syncModuleForm(data.activeCycle);
    periods.value = data.periods.map((period) => ({
      ...period,
      payrollStart: dateOnly(period.payrollStart),
      payrollEnd: dateOnly(period.payrollEnd),
      module1Start: dateOnly(period.module1Start),
      module1End: dateOnly(period.module1End),
      module2Start: dateOnly(period.module2Start),
      module2End: dateOnly(period.module2End),
      incidencesAccessStartAt: period.incidencesAccessStartAt,
      incidencesAccessEndAt: period.incidencesAccessEndAt,
      extrasAccessStartAt: period.extrasAccessStartAt,
      extrasAccessEndAt: period.extrasAccessEndAt,
      blackoutDates: period.blackoutDates.map((blackout) => ({
        ...blackout,
        blackoutDate: dateOnly(blackout.blackoutDate)
      }))
    }));
    if (!editingId.value) form.value = blankForm();
    if (!editingCycleId.value) cycleForm.value = blankCycleForm();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar calendario.');
  } finally {
    pageBusy.value = false;
  }
}

function newPeriod() {
  editingId.value = null;
  form.value = blankForm();
  blackoutDraft.value = { blackoutDate: '', reason: '' };
  formError.value = '';
  clearNotice();
}

function editPeriod(period: CalendarPeriod) {
  editingId.value = period.id;
  form.value = {
    cycleId: period.cycleId,
    periodLabel: period.periodLabel,
    payrollStart: dateOnly(period.payrollStart),
    payrollEnd: dateOnly(period.payrollEnd),
    module1Start: dateOnly(period.module1Start),
    module1End: dateOnly(period.module1End),
    module2Start: dateOnly(period.module2Start),
    module2End: dateOnly(period.module2End),
    incidencesAccessStartAt: toDatetimeLocal(period.incidencesAccessStartAt),
    incidencesAccessDays: period.incidencesAccessDays,
    extrasAccessStartAt: toDatetimeLocal(period.extrasAccessStartAt),
    extrasAccessDays: period.extrasAccessDays,
    blackoutDates: period.blackoutDates.map((blackout) => ({
      blackoutDate: dateOnly(blackout.blackoutDate),
      reason: blackout.reason
    }))
  };
  blackoutDraft.value = { blackoutDate: '', reason: '' };
  formError.value = '';
  clearNotice();
}

function addBlackout() {
  formError.value = '';
  if (!blackoutDraft.value.blackoutDate) {
    formError.value = 'Selecciona la fecha inhábil.';
    return;
  }
  if (
    blackoutDraft.value.blackoutDate < form.value.payrollStart ||
    blackoutDraft.value.blackoutDate > form.value.payrollEnd
  ) {
    formError.value = 'El día inhábil debe estar dentro de la quincena.';
    return;
  }
  const next = form.value.blackoutDates.filter((blackout) => blackout.blackoutDate !== blackoutDraft.value.blackoutDate);
  next.push({
    blackoutDate: blackoutDraft.value.blackoutDate,
    reason: blackoutDraft.value.reason.trim() || 'Día inhábil'
  });
  form.value.blackoutDates = next.sort((left, right) => left.blackoutDate.localeCompare(right.blackoutDate));
  blackoutDraft.value = { blackoutDate: '', reason: '' };
}

function removeBlackout(date: string) {
  form.value.blackoutDates = form.value.blackoutDates.filter((blackout) => blackout.blackoutDate !== date);
}

function validateForm() {
  if (!form.value.payrollStart || !form.value.payrollEnd) return 'Captura inicio y cierre de quincena.';
  if (form.value.payrollStart > form.value.payrollEnd) return 'La quincena tiene fechas invertidas.';
  if (!form.value.incidencesAccessStartAt) return 'Captura la apertura de incidencias.';
  if (!form.value.extrasAccessStartAt) return 'Captura la apertura de extras.';
  const incidenceDate = form.value.incidencesAccessStartAt.slice(0, 10);
  if (incidenceDate < form.value.payrollStart || incidenceDate > form.value.payrollEnd) {
    return 'La apertura de incidencias debe estar dentro de la quincena.';
  }
  const extraDate = form.value.extrasAccessStartAt.slice(0, 10);
  if (extraDate < form.value.payrollStart || extraDate > form.value.payrollEnd) {
    return 'La apertura de extras debe estar dentro de la quincena.';
  }
  return '';
}

function validateModuleForm() {
  const modules = moduleForm.value;
  if (!modules.module1Start || !modules.module1End || !modules.module2Start || !modules.module2End) {
    return 'Captura inicio y cierre de ambos módulos.';
  }
  if (modules.module1Start > modules.module1End) return 'El módulo 1 tiene fechas invertidas.';
  if (modules.module2Start > modules.module2End) return 'El módulo 2 tiene fechas invertidas.';
  if (modules.module1End > modules.module2End) return 'El cierre de módulo 1 no puede ser posterior al cierre de módulo 2.';
  return '';
}

async function saveModuleDates() {
  if (!activeCycle.value) return;
  moduleError.value = validateModuleForm();
  if (moduleError.value) return;
  savingModules.value = true;
  clearNotice();
  try {
    const response = await updateCycleModuleDates(activeCycle.value.id, {
      module1Start: dateOnly(moduleForm.value.module1Start),
      module1End: dateOnly(moduleForm.value.module1End),
      module2Start: dateOnly(moduleForm.value.module2Start),
      module2End: dateOnly(moduleForm.value.module2End)
    });
    await loadCalendar(response.activeCycle.id);
    setNotice('ok', response.message);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar las fechas modulares.');
  } finally {
    savingModules.value = false;
  }
}

async function savePeriod() {
  formError.value = validateForm();
  if (formError.value) return;
  saving.value = true;
  clearNotice();
  try {
    const payload = {
      ...form.value,
      cycleId: selectedCycleId.value || activeCycle.value?.id,
      periodLabel: form.value.periodLabel.trim() || `${form.value.payrollStart} a ${form.value.payrollEnd}`,
      module1Start: dateOnly(activeCycle.value?.module1Start) || form.value.module1Start,
      module1End: dateOnly(activeCycle.value?.module1End) || form.value.module1End,
      module2Start: dateOnly(activeCycle.value?.module2Start) || form.value.module2Start,
      module2End: dateOnly(activeCycle.value?.module2End) || form.value.module2End,
      incidencesAccessStartAt: fromDatetimeLocal(form.value.incidencesAccessStartAt),
      extrasAccessStartAt: fromDatetimeLocal(form.value.extrasAccessStartAt)
    };
    const response = editingId.value
      ? await updateCalendarPeriod(editingId.value, payload)
      : await createCalendarPeriod(payload);
    editingId.value = null;
    await loadCalendar(payload.cycleId);
    setNotice('ok', response.message);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar la quincena.');
  } finally {
    saving.value = false;
  }
}

function requestRemovePeriod(period: CalendarPeriod) {
  pendingDeletePeriod.value = period;
  clearNotice();
}

function closeDeleteModal() {
  if (deletingPeriod.value) return;
  pendingDeletePeriod.value = null;
}

async function confirmRemovePeriod() {
  const period = pendingDeletePeriod.value;
  if (!period) return;

  deletingPeriod.value = true;
  clearNotice();
  try {
    const response = await deleteCalendarPeriod(period.id);
    pendingDeletePeriod.value = null;
    if (editingId.value === period.id) {
      editingId.value = null;
      form.value = blankForm();
      blackoutDraft.value = { blackoutDate: '', reason: '' };
      formError.value = '';
    }
    await loadCalendar(selectedCycleId.value);
    setNotice('ok', response.message);
  } catch (err) {
    pendingDeletePeriod.value = null;
    setNotice('error', err instanceof Error ? err.message : 'No fue posible eliminar la quincena.');
  } finally {
    deletingPeriod.value = false;
  }
}

onMounted(() => {
  loadCalendar();
});
</script>

<template>
  <div class="view-stack">
    <div v-if="notice" class="notice" :class="notice.type" style="margin-bottom: 1rem;">
      {{ notice.text }}
    </div>

    <section class="toolbar-card">
      <div>
        <p class="eyebrow">Calendario Operativo</p>
        <h3>Quincenas, módulos y días inhábiles</h3>
      </div>
      <div class="toolbar-actions">
        <select v-if="cycles.length" v-model="selectedCycleId" @change="loadCalendar(selectedCycleId)">
          <option v-for="cycle in cycles" :key="cycle.id" :value="cycle.id">
            {{ cycle.periodLabel }} - {{ cycle.quarterCode }} / {{ cycle.status }}
          </option>
        </select>
        <button class="secondary-action" type="button" @click="loadCalendar(selectedCycleId)">
          <RefreshCw :size="17" :class="{ spin: pageBusy }" />
          Actualizar
        </button>
        <button class="primary-inline" type="button" :disabled="activeCycle?.status === 'CERRADO'" @click="newPeriod">
          <Plus :size="17" />
          Nueva quincena
        </button>
      </div>
    </section>

    <section class="metric-grid compact">
      <article class="metric-card mini"><p>Quincenas</p><strong>{{ summary.periods }}</strong><small>{{ activeCycle?.periodLabel || 'Ciclo operativo' }}</small></article>
      <article class="metric-card mini"><p>Días inhábiles</p><strong>{{ summary.blackoutTotal }}</strong><small>Dentro de quincenas</small></article>
      <article class="metric-card mini"><p>Próxima base</p><strong>{{ summary.nextPeriod }}</strong><small>Fuente para Nómina</small></article>
      <article class="metric-card mini"><p>Acceso</p><strong>Admin</strong><small>Calendario centralizado</small></article>
    </section>

    <section class="split-grid calendar">
      <div class="editor-panel">
        <div class="section-title compact">
          <div>
            <p class="eyebrow">{{ editingCycleId ? 'Editar ciclo' : 'Nuevo ciclo' }}</p>
            <h3>Apertura de ciclo escolar</h3>
          </div>
          <CalendarDays :size="22" />
        </div>

        <div class="form-grid">
          <label>
            <span>Periodo</span>
            <input v-model="cycleForm.periodLabel" placeholder="Septiembre - Diciembre 2026" />
          </label>
          <label>
            <span>Código</span>
            <input v-model="cycleForm.quarterCode" placeholder="27-1" />
          </label>
          <label>
            <span>Inicio módulo 1</span>
            <input v-model="cycleForm.module1Start" type="date" />
          </label>
          <label>
            <span>Cierre módulo 1</span>
            <input v-model="cycleForm.module1End" type="date" />
          </label>
          <label>
            <span>Inicio módulo 2</span>
            <input v-model="cycleForm.module2Start" type="date" />
          </label>
          <label>
            <span>Cierre módulo 2</span>
            <input v-model="cycleForm.module2End" type="date" />
          </label>
        </div>

        <div class="module-period-note editable">
          <strong>Planeación limpia</strong>
          <span>El ciclo nuevo se crea sin horarios; cada coordinación captura su carga desde cero.</span>
        </div>

        <div v-if="cycleError" class="error-box wide">{{ cycleError }}</div>

        <div class="form-actions">
          <button class="secondary-action" type="button" :disabled="savingCycle" @click="newCycle">Nuevo ciclo</button>
          <button class="primary-inline" type="button" :disabled="savingCycle" @click="saveCycle">
            <Save :size="17" />
            {{ editingCycleId ? 'Actualizar ciclo' : 'Crear en planeación' }}
          </button>
        </div>
      </div>

      <div class="data-panel full">
        <div class="section-title compact">
          <div>
            <p class="eyebrow">Ciclos escolares</p>
            <h3>Operación actual y planeación</h3>
          </div>
        </div>

        <div class="table-shell">
          <table class="calendar-table">
            <thead>
              <tr>
                <th>Ciclo</th>
                <th>Estado</th>
                <th>Módulos</th>
                <th>Preparación</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cycle in cycles" :key="cycle.id">
                <td>
                  <strong>{{ cycle.periodLabel }}</strong>
                  <span>{{ cycle.quarterCode }}</span>
                </td>
                <td>
                  <span class="badge" :class="cycleStatusClass(cycle.status)">{{ cycle.status }}</span>
                </td>
                <td>
                  <strong>M1 {{ formatDate(cycle.module1Start) }} - {{ formatDate(cycle.module1End) }}</strong>
                  <span>M2 {{ formatDate(cycle.module2Start) }} - {{ formatDate(cycle.module2End) }}</span>
                </td>
                <td>
                  <strong>{{ cycle.scheduleCount || 0 }} horarios</strong>
                  <span>{{ cycle.calendarPeriodCount || 0 }} quincenas</span>
                </td>
                <td class="row-actions">
                  <button
                    class="icon-button"
                    type="button"
                    title="Editar ciclo"
                    :disabled="cycle.status === 'CERRADO'"
                    @click="editCycle(cycle)"
                  >
                    <Edit3 :size="16" />
                  </button>
                  <button
                    v-if="cycle.status === 'PLANEACION'"
                    class="icon-button ok"
                    type="button"
                    title="Activar ciclo"
                    @click="requestActivateCycle(cycle)"
                  >
                    <CheckCircle2 :size="16" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="data-panel module-editor-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Cuatrimestre</p>
          <h3>Fechas modulares</h3>
        </div>
        <CalendarDays :size="22" />
      </div>

      <div class="form-grid">
        <label>
          <span>Inicio módulo 1</span>
          <input v-model="moduleForm.module1Start" type="date" />
        </label>
        <label>
          <span>Cierre módulo 1</span>
          <input v-model="moduleForm.module1End" type="date" />
        </label>
        <label>
          <span>Inicio módulo 2</span>
          <input v-model="moduleForm.module2Start" type="date" />
        </label>
        <label>
          <span>Cierre módulo 2</span>
          <input v-model="moduleForm.module2End" type="date" />
        </label>
      </div>

      <div class="module-period-note editable">
        <strong>{{ activeCycle?.periodLabel || 'Ciclo operativo' }}</strong>
        <span>Estas fechas aplican a todas las quincenas del cuatrimestre seleccionado.</span>
      </div>

      <div v-if="moduleError" class="error-box wide">{{ moduleError }}</div>

      <div class="form-actions">
        <button class="secondary-action" type="button" :disabled="savingModules" @click="syncModuleForm(activeCycle)">
          Descartar
        </button>
        <button class="primary-inline" type="button" :disabled="savingModules || !activeCycle || activeCycle.status === 'CERRADO'" @click="saveModuleDates">
          <Save :size="17" />
          Guardar módulos
        </button>
      </div>
    </section>

    <section class="split-grid calendar">
      <div class="editor-panel">
        <div class="section-title compact">
          <div>
            <p class="eyebrow">{{ editingId ? 'Editar quincena' : 'Nueva quincena' }}</p>
            <h3>Parámetros de cálculo</h3>
          </div>
          <CalendarDays :size="22" />
        </div>

        <div class="form-grid one">
          <label>
            <span>Etiqueta</span>
            <input v-model="form.periodLabel" placeholder="2026-05-01 a 2026-05-15" />
          </label>
        </div>

        <div class="form-grid">
          <label>
            <span>Inicio quincena</span>
            <input v-model="form.payrollStart" type="date" @change="refreshPeriodLabel" />
          </label>
          <label>
            <span>Cierre quincena</span>
            <input v-model="form.payrollEnd" type="date" @change="refreshPeriodLabel" />
          </label>
          <label>
            <span>Apertura incidencias</span>
            <input v-model="form.incidencesAccessStartAt" type="datetime-local" />
          </label>
          <label>
            <span>Días acceso incidencias</span>
            <input v-model.number="form.incidencesAccessDays" type="number" min="0" max="31" />
          </label>
          <label>
            <span>Apertura extras</span>
            <input v-model="form.extrasAccessStartAt" type="datetime-local" />
          </label>
          <label>
            <span>Días acceso extras</span>
            <input v-model.number="form.extrasAccessDays" type="number" min="0" max="31" />
          </label>
        </div>

        <div class="module-period-note">
          <strong>Fechas modulares del cuatrimestre</strong>
          <span>M1 {{ formatDate(activeCycle?.module1Start) }} - {{ formatDate(activeCycle?.module1End) }}</span>
          <span>M2 {{ formatDate(activeCycle?.module2Start) }} - {{ formatDate(activeCycle?.module2End) }}</span>
        </div>

        <div class="blackout-editor">
          <strong>Días inhábiles de la quincena</strong>
          <div class="blackout-inputs">
            <input v-model="blackoutDraft.blackoutDate" type="date" />
            <input v-model="blackoutDraft.reason" placeholder="Motivo" />
            <button class="secondary-action" type="button" @click="addBlackout">
              <Plus :size="16" />
              Agregar
            </button>
          </div>
          <div v-if="form.blackoutDates.length" class="blackout-list">
            <span v-for="blackout in form.blackoutDates" :key="blackout.blackoutDate">
              {{ formatDate(blackout.blackoutDate) }} / {{ blackout.reason || 'Día inhábil' }}
              <button type="button" title="Quitar" @click="removeBlackout(blackout.blackoutDate)">
                <X :size="13" />
              </button>
            </span>
          </div>
          <p v-else>Sin días inhábiles capturados.</p>
        </div>

        <div v-if="formError" class="error-box wide">{{ formError }}</div>

        <div class="form-actions">
          <button class="secondary-action" type="button" @click="newPeriod">Limpiar</button>
          <button class="primary-inline" type="button" :disabled="saving || activeCycle?.status === 'CERRADO'" @click="savePeriod">
            <Save :size="17" />
            {{ editingId ? 'Actualizar' : 'Guardar' }}
          </button>
        </div>
      </div>

      <div class="data-panel full">
        <div class="section-title compact">
          <div>
            <p class="eyebrow">Quincenas guardadas</p>
            <h3>Fuente para cálculo de nómina</h3>
          </div>
        </div>

        <div class="table-shell">
          <table class="calendar-table">
            <thead>
              <tr>
                <th>Quincena</th>
                <th>Módulos</th>
                <th>Inhábiles</th>
                <th>Acceso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!periods.length">
                <td colspan="5" class="empty-cell">No hay quincenas capturadas para este ciclo.</td>
              </tr>
              <tr v-for="period in periods" :key="period.id">
                <td>
                  <strong>{{ period.periodLabel }}</strong>
                  <span>{{ formatDate(period.payrollStart) }} - {{ formatDate(period.payrollEnd) }}</span>
                </td>
                <td>
                  <strong>M1 {{ formatDate(period.module1Start) }} - {{ formatDate(period.module1End) }}</strong>
                  <span>M2 {{ formatDate(period.module2Start) }} - {{ formatDate(period.module2End) }}</span>
                </td>
                <td>
                  <span class="badge" :class="period.blackoutDates.length ? 'warning' : 'ok'">
                    {{ period.blackoutDates.length }} dia{{ period.blackoutDates.length === 1 ? '' : 's' }}
                  </span>
                  <small v-for="blackout in period.blackoutDates.slice(0, 2)" :key="blackout.id || blackout.blackoutDate">
                    {{ formatDate(blackout.blackoutDate) }} / {{ blackout.reason }}
                  </small>
                </td>
                <td>
                  <strong>Inc {{ period.incidencesAccessDays }} días</strong>
                  <span>{{ formatDateTime(period.incidencesAccessStartAt) }} - {{ formatDateTime(period.incidencesAccessEndAt) }}</span>
                  <strong>Extras {{ period.extrasAccessDays }} días</strong>
                  <span>{{ formatDateTime(period.extrasAccessStartAt) }} - {{ formatDateTime(period.extrasAccessEndAt) }}</span>
                </td>
                <td class="row-actions">
                  <button class="icon-button" type="button" title="Editar" :disabled="activeCycle?.status === 'CERRADO'" @click="editPeriod(period)">
                    <Edit3 :size="16" />
                  </button>
                  <button class="icon-button danger" type="button" title="Eliminar" :disabled="activeCycle?.status === 'CERRADO'" @click="requestRemovePeriod(period)">
                    <Trash2 :size="16" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <ConfirmModal
      :show="!!pendingDeletePeriod"
      eyebrow="Calendario operativo"
      title="Eliminar quincena"
      :subject="pendingDeletePeriod?.periodLabel"
      message="Esta quincena saldrá de la fuente de cálculo de nómina. No debe eliminarse si ya forma parte de una revisión real o de una corrida guardada."
      :details="pendingDeletePeriod ? [
        `${formatDate(pendingDeletePeriod.payrollStart)} - ${formatDate(pendingDeletePeriod.payrollEnd)}`,
        `${pendingDeletePeriod.blackoutDates.length} día${pendingDeletePeriod.blackoutDates.length === 1 ? '' : 's'} inhábil${pendingDeletePeriod.blackoutDates.length === 1 ? '' : 'es'}`,
        `Acceso incidencias: ${pendingDeletePeriod.incidencesAccessDays} días / Extras: ${pendingDeletePeriod.extrasAccessDays} días`
      ] : []"
      confirm-label="Eliminar quincena"
      cancel-label="Conservar quincena"
      tone="danger"
      icon="trash"
      :loading="deletingPeriod"
      @close="closeDeleteModal"
      @confirm="confirmRemovePeriod"
    />

    <ConfirmModal
      :show="!!pendingActivateCycle"
      eyebrow="Ciclo escolar"
      title="Activar nuevo ciclo"
      :subject="pendingActivateCycle ? `${pendingActivateCycle.periodLabel} - ${pendingActivateCycle.quarterCode}` : ''"
      message="Este ciclo quedará como activo. El ciclo activo anterior se cerrará y Capturar Horarios mostrará el nuevo ciclo por defecto."
      :details="pendingActivateCycle ? [
        `${pendingActivateCycle.scheduleCount || 0} horarios capturados en el nuevo ciclo`,
        `${pendingActivateCycle.calendarPeriodCount || 0} quincenas configuradas`,
        'Los horarios del ciclo anterior no se eliminan; quedan asociados a su ciclo histórico.'
      ] : []"
      confirm-label="Activar ciclo"
      cancel-label="Conservar planeación"
      tone="warning"
      icon="warning"
      :loading="activatingCycle"
      @close="closeActivateCycleModal"
      @confirm="confirmActivateCycle"
    />
  </div>
</template>
