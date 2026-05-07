<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CalendarDays, Edit3, Plus, RefreshCw, Save, Trash2, X } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import {
  createCalendarPeriod,
  deleteCalendarPeriod,
  fetchCalendarContext,
  updateCalendarPeriod,
  updateCycleModuleDates,
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
const pageBusy = ref(false);
const saving = ref(false);
const savingModules = ref(false);
const deletingPeriod = ref(false);
const pendingDeletePeriod = ref<CalendarPeriod | null>(null);
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);
const formError = ref('');
const moduleError = ref('');
const blackoutDraft = ref({ blackoutDate: '', reason: '' });

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
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
    incidencesAccessDays: 5,
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
      blackoutDates: period.blackoutDates.map((blackout) => ({
        ...blackout,
        blackoutDate: dateOnly(blackout.blackoutDate)
      }))
    }));
    if (!editingId.value) form.value = blankForm();
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
    incidencesAccessDays: period.incidencesAccessDays,
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
    formError.value = 'Selecciona la fecha inhabil.';
    return;
  }
  if (
    blackoutDraft.value.blackoutDate < form.value.payrollStart ||
    blackoutDraft.value.blackoutDate > form.value.payrollEnd
  ) {
    formError.value = 'El dia inhabil debe estar dentro de la quincena.';
    return;
  }
  const next = form.value.blackoutDates.filter((blackout) => blackout.blackoutDate !== blackoutDraft.value.blackoutDate);
  next.push({
    blackoutDate: blackoutDraft.value.blackoutDate,
    reason: blackoutDraft.value.reason.trim() || 'Dia inhabil'
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
  return '';
}

function validateModuleForm() {
  const modules = moduleForm.value;
  if (!modules.module1Start || !modules.module1End || !modules.module2Start || !modules.module2End) {
    return 'Captura inicio y cierre de ambos modulos.';
  }
  if (modules.module1Start > modules.module1End) return 'El modulo 1 tiene fechas invertidas.';
  if (modules.module2Start > modules.module2End) return 'El modulo 2 tiene fechas invertidas.';
  if (modules.module1End > modules.module2End) return 'El cierre de modulo 1 no puede ser posterior al cierre de modulo 2.';
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
      module2End: dateOnly(activeCycle.value?.module2End) || form.value.module2End
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
        <h3>Quincenas, modulos y dias inhabiles</h3>
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
        <button class="primary-inline" type="button" @click="newPeriod">
          <Plus :size="17" />
          Nueva quincena
        </button>
      </div>
    </section>

    <section class="metric-grid compact">
      <article class="metric-card mini"><p>Quincenas</p><strong>{{ summary.periods }}</strong><small>{{ activeCycle?.periodLabel || 'Ciclo operativo' }}</small></article>
      <article class="metric-card mini"><p>Dias inhabiles</p><strong>{{ summary.blackoutTotal }}</strong><small>Dentro de quincenas</small></article>
      <article class="metric-card mini"><p>Proxima base</p><strong>{{ summary.nextPeriod }}</strong><small>Fuente para Nomina</small></article>
      <article class="metric-card mini"><p>Acceso</p><strong>Admin</strong><small>Calendario centralizado</small></article>
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
          <span>Inicio modulo 1</span>
          <input v-model="moduleForm.module1Start" type="date" />
        </label>
        <label>
          <span>Cierre modulo 1</span>
          <input v-model="moduleForm.module1End" type="date" />
        </label>
        <label>
          <span>Inicio modulo 2</span>
          <input v-model="moduleForm.module2Start" type="date" />
        </label>
        <label>
          <span>Cierre modulo 2</span>
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
        <button class="primary-inline" type="button" :disabled="savingModules || !activeCycle" @click="saveModuleDates">
          <Save :size="17" />
          Guardar modulos
        </button>
      </div>
    </section>

    <section class="split-grid calendar">
      <div class="editor-panel">
        <div class="section-title compact">
          <div>
            <p class="eyebrow">{{ editingId ? 'Editar quincena' : 'Nueva quincena' }}</p>
            <h3>Parametros de calculo</h3>
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
            <span>Dias acceso incidencias</span>
            <input v-model.number="form.incidencesAccessDays" type="number" min="0" max="31" />
          </label>
          <label>
            <span>Dias acceso extras</span>
            <input v-model.number="form.extrasAccessDays" type="number" min="0" max="31" />
          </label>
        </div>

        <div class="module-period-note">
          <strong>Fechas modulares del cuatrimestre</strong>
          <span>M1 {{ formatDate(activeCycle?.module1Start) }} - {{ formatDate(activeCycle?.module1End) }}</span>
          <span>M2 {{ formatDate(activeCycle?.module2Start) }} - {{ formatDate(activeCycle?.module2End) }}</span>
        </div>

        <div class="blackout-editor">
          <strong>Dias inhabiles de la quincena</strong>
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
              {{ formatDate(blackout.blackoutDate) }} / {{ blackout.reason || 'Dia inhabil' }}
              <button type="button" title="Quitar" @click="removeBlackout(blackout.blackoutDate)">
                <X :size="13" />
              </button>
            </span>
          </div>
          <p v-else>Sin dias inhabiles capturados.</p>
        </div>

        <div v-if="formError" class="error-box wide">{{ formError }}</div>

        <div class="form-actions">
          <button class="secondary-action" type="button" @click="newPeriod">Limpiar</button>
          <button class="primary-inline" type="button" :disabled="saving" @click="savePeriod">
            <Save :size="17" />
            {{ editingId ? 'Actualizar' : 'Guardar' }}
          </button>
        </div>
      </div>

      <div class="data-panel full">
        <div class="section-title compact">
          <div>
            <p class="eyebrow">Quincenas guardadas</p>
            <h3>Fuente para calculo de nomina</h3>
          </div>
        </div>

        <div class="table-shell">
          <table class="calendar-table">
            <thead>
              <tr>
                <th>Quincena</th>
                <th>Modulos</th>
                <th>Inhabiles</th>
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
                  <strong>Inc {{ period.incidencesAccessDays }} dias</strong>
                  <span>Extras {{ period.extrasAccessDays }} dias</span>
                </td>
                <td class="row-actions">
                  <button class="icon-button" type="button" title="Editar" @click="editPeriod(period)">
                    <Edit3 :size="16" />
                  </button>
                  <button class="icon-button danger" type="button" title="Eliminar" @click="requestRemovePeriod(period)">
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
      message="Esta quincena saldra de la fuente de calculo de nomina. No debe eliminarse si ya forma parte de una revision real o de una corrida guardada."
      :details="pendingDeletePeriod ? [
        `${formatDate(pendingDeletePeriod.payrollStart)} - ${formatDate(pendingDeletePeriod.payrollEnd)}`,
        `${pendingDeletePeriod.blackoutDates.length} dia${pendingDeletePeriod.blackoutDates.length === 1 ? '' : 's'} inhabil${pendingDeletePeriod.blackoutDates.length === 1 ? '' : 'es'}`,
        `Acceso incidencias: ${pendingDeletePeriod.incidencesAccessDays} dias / Extras: ${pendingDeletePeriod.extrasAccessDays} dias`
      ] : []"
      confirm-label="Eliminar quincena"
      cancel-label="Conservar quincena"
      tone="danger"
      icon="trash"
      :loading="deletingPeriod"
      @close="closeDeleteModal"
      @confirm="confirmRemovePeriod"
    />
  </div>
</template>
