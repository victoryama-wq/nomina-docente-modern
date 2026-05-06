<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RefreshCw, Search, Clock3, Save, RotateCcw, Building2 } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import {
  fetchIncidencesContext,
  updateIncidence,
  updateIncidencesBatch,
  type IncidenceCalendarPeriod,
  type CycleOption,
  type IncidencePayload,
  type IncidenceSchedule,
  type IncidenceSummary
} from '../api';

const authStore = useAuthStore();
type IncidenceFilter = 'TODOS' | 'CON' | 'SIN';
type VisibilityFilter = 'TODOS' | 'EDITABLES' | 'BLOQUEADOS';
type ChangeFilter = 'TODOS' | 'MODIFICADOS' | 'SIN_CAMBIOS';
type IncidenceField = 'absences' | 'delays' | 'extraHoursInSchedule';
type IncidenceDraft = Required<Pick<IncidencePayload, IncidenceField>>;

const schedules = ref<IncidenceSchedule[]>([]);
const cycles = ref<CycleOption[]>([]);
const calendarPeriods = ref<IncidenceCalendarPeriod[]>([]);
const activeCycle = ref<CycleOption | null>(null);
const activeCalendarPeriod = ref<IncidenceCalendarPeriod | null>(null);
const selectedCycleId = ref('');
const selectedCalendarConfigId = ref('');
const summary = ref<IncidenceSummary>({
  total: 0,
  teachers: 0,
  editable: 0,
  withIncidences: 0,
  absences: 0,
  delays: 0,
  extraHoursInSchedule: 0
});
const searchText = ref('');
const incidenceFilter = ref<IncidenceFilter>('TODOS');
const visibilityFilter = ref<VisibilityFilter>('TODOS');
const changeFilter = ref<ChangeFilter>('TODOS');
const edits = ref<Record<string, IncidenceDraft>>({});
const savingRows = ref<Record<string, boolean>>({});
const savingBatch = ref(false);
const pageBusy = ref(false);
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

const filteredSchedules = computed(() => {
  const text = searchText.value.toLowerCase().trim();
  return schedules.value.filter((schedule) => {
    const hasIncidence = rowHasIncidences(schedule);
    const modified = rowIsModified(schedule);
    const haystack = [
      schedule.teacherName,
      schedule.teacherCategory,
      schedule.coordinationName,
      schedule.subjectName,
      schedule.groupCode,
      schedule.tabulatorName,
      schedule.periodLabel,
      schedule.quarterCode
    ]
      .join(' ')
      .toLowerCase();

    const matchesText = !text || haystack.includes(text);
    const matchesIncidence =
      incidenceFilter.value === 'TODOS' ||
      (incidenceFilter.value === 'CON' && hasIncidence) ||
      (incidenceFilter.value === 'SIN' && !hasIncidence);
    const matchesVisibility =
      visibilityFilter.value === 'TODOS' ||
      (visibilityFilter.value === 'EDITABLES' && schedule.canEdit) ||
      (visibilityFilter.value === 'BLOQUEADOS' && !schedule.canEdit);
    const matchesChange =
      changeFilter.value === 'TODOS' ||
      (changeFilter.value === 'MODIFICADOS' && modified) ||
      (changeFilter.value === 'SIN_CAMBIOS' && !modified);

    return matchesText && matchesIncidence && matchesVisibility && matchesChange;
  });
});

const visiblePendingRows = computed(() =>
  filteredSchedules.value.filter((schedule) => schedule.canEdit && rowIsModified(schedule))
);
const allPendingRows = computed(() => schedules.value.filter((schedule) => schedule.canEdit && rowIsModified(schedule)));

function numberValue(value: number | string | null | undefined) {
  return Number(value) || 0;
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

function categoryLimitLabel(category: string) {
  if (category === 'V') return 'VIP 35 h';
  if (category === 'M') return 'Medio tiempo 25 h';
  return 'Nuevo ingreso 15 h';
}

function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
  setTimeout(() => clearNotice(), 3200);
}

function clearNotice() {
  notice.value = null;
}

function baseDraft(schedule: IncidenceSchedule): IncidenceDraft {
  return {
    absences: numberValue(schedule.absences),
    delays: numberValue(schedule.delays),
    extraHoursInSchedule: numberValue(schedule.extraHoursInSchedule)
  };
}

function draftFor(schedule: IncidenceSchedule): IncidenceDraft {
  return edits.value[schedule.id] || baseDraft(schedule);
}

function currentValue(schedule: IncidenceSchedule, field: IncidenceField) {
  return draftFor(schedule)[field];
}

function setValue(schedule: IncidenceSchedule, field: IncidenceField, rawValue: string) {
  const numeric = rawValue === '' ? 0 : Math.max(0, Number(rawValue) || 0);
  const draft = { ...draftFor(schedule), [field]: numeric };
  edits.value = { ...edits.value, [schedule.id]: draft };
  if (!rowIsModified(schedule)) {
    const next = { ...edits.value };
    delete next[schedule.id];
    edits.value = next;
  }
  refreshSummary();
}

function rowIsModified(schedule: IncidenceSchedule) {
  const draft = edits.value[schedule.id];
  if (!draft) return false;
  const base = baseDraft(schedule);
  return (
    numberValue(draft.absences) !== numberValue(base.absences) ||
    numberValue(draft.delays) !== numberValue(base.delays) ||
    numberValue(draft.extraHoursInSchedule) !== numberValue(base.extraHoursInSchedule)
  );
}

function rowHasIncidences(schedule: IncidenceSchedule) {
  const draft = draftFor(schedule);
  return draft.absences > 0 || draft.delays > 0 || draft.extraHoursInSchedule > 0;
}

function rowBadge(schedule: IncidenceSchedule) {
  if (schedule.payrollLocked) return { label: 'Nomina guardada', className: 'muted' };
  if (!schedule.canEdit) return { label: 'Bloqueado', className: 'muted' };
  if (rowIsModified(schedule)) return { label: 'Sin guardar', className: 'warning' };
  if (rowHasIncidences(schedule)) return { label: 'Con incidencia', className: 'danger' };
  return { label: 'Sin novedad', className: 'ok' };
}

function buildSummary(rows: IncidenceSchedule[]): IncidenceSummary {
  const teachers = new Set(rows.map((schedule) => schedule.teacherId));
  return {
    total: rows.length,
    teachers: teachers.size,
    editable: rows.filter((schedule) => schedule.canEdit).length,
    withIncidences: rows.filter((schedule) => rowHasIncidences(schedule)).length,
    absences: rows.reduce((sum, schedule) => sum + numberValue(draftFor(schedule).absences), 0),
    delays: rows.reduce((sum, schedule) => sum + numberValue(draftFor(schedule).delays), 0),
    extraHoursInSchedule: rows.reduce((sum, schedule) => sum + numberValue(draftFor(schedule).extraHoursInSchedule), 0)
  };
}

function refreshSummary() {
  summary.value = buildSummary(schedules.value);
}

function mergeSchedules(updated: IncidenceSchedule[]) {
  const updatedById = new Map(updated.map((schedule) => [schedule.id, schedule]));
  schedules.value = schedules.value.map((schedule) => updatedById.get(schedule.id) || schedule);
  refreshSummary();
}

async function loadIncidences(cycleId = selectedCycleId.value || undefined, calendarConfigId = selectedCalendarConfigId.value || undefined) {
  if (!authStore.canManageIncidences) return;
  pageBusy.value = true;
  clearNotice();
  try {
    const data = await fetchIncidencesContext(cycleId, calendarConfigId);
    activeCycle.value = data.activeCycle;
    selectedCycleId.value = data.activeCycle.id;
    cycles.value = data.cycles;
    calendarPeriods.value = data.calendarPeriods;
    activeCalendarPeriod.value = data.activeCalendarPeriod;
    selectedCalendarConfigId.value = data.activeCalendarPeriod?.id || '';
    schedules.value = data.schedules;
    summary.value = data.summary;
    edits.value = {};
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar incidencias.');
  } finally {
    pageBusy.value = false;
  }
}

function loadSelectedCycle() {
  selectedCalendarConfigId.value = '';
  return loadIncidences(selectedCycleId.value, undefined);
}

function loadSelectedCalendar() {
  return loadIncidences(selectedCycleId.value, selectedCalendarConfigId.value);
}

async function saveRow(schedule: IncidenceSchedule) {
  if (!schedule.canEdit || !rowIsModified(schedule)) return;
  if (!selectedCalendarConfigId.value) {
    setNotice('error', 'Selecciona una quincena de calendario antes de guardar incidencias.');
    return;
  }
  savingRows.value = { ...savingRows.value, [schedule.id]: true };
  clearNotice();
  try {
    const response = await updateIncidence(schedule.id, {
      ...draftFor(schedule),
      calendarConfigId: selectedCalendarConfigId.value
    });
    mergeSchedules([response.schedule]);
    const next = { ...edits.value };
    delete next[schedule.id];
    edits.value = next;
    setNotice('ok', response.message);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar la incidencia.');
  } finally {
    const next = { ...savingRows.value };
    delete next[schedule.id];
    savingRows.value = next;
  }
}

async function saveRows(rowsToSave: IncidenceSchedule[]) {
  if (!selectedCalendarConfigId.value) {
    setNotice('error', 'Selecciona una quincena de calendario antes de guardar incidencias.');
    return;
  }
  const rows = rowsToSave.map((schedule) => ({
    scheduleId: schedule.id,
    calendarConfigId: selectedCalendarConfigId.value,
    ...draftFor(schedule)
  }));
  if (!rows.length) return;

  savingBatch.value = true;
  clearNotice();
  try {
    const response = await updateIncidencesBatch(rows);
    mergeSchedules(response.schedules);
    const savedIds = new Set(response.schedules.map((schedule) => schedule.id));
    const next = { ...edits.value };
    savedIds.forEach((id) => delete next[id]);
    edits.value = next;
    setNotice('ok', response.message);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar los cambios.');
  } finally {
    savingBatch.value = false;
  }
}

function saveVisibleRows() {
  return saveRows(visiblePendingRows.value);
}

function saveAllPendingRows() {
  return saveRows(allPendingRows.value);
}

function discardRow(schedule: IncidenceSchedule) {
  const next = { ...edits.value };
  delete next[schedule.id];
  edits.value = next;
  refreshSummary();
}

function discardPendingRows() {
  const next = { ...edits.value };
  visiblePendingRows.value.forEach((schedule) => delete next[schedule.id]);
  edits.value = next;
  refreshSummary();
}

onMounted(() => {
  loadIncidences();
});
</script>

<template>
  <div class="view-stack">
    <div v-if="notice" class="notice" :class="notice.type" style="margin-bottom: 1rem;">
      {{ notice.text }}
    </div>

    <section class="toolbar-card">
      <div>
        <p class="eyebrow">Capturar Incidencias</p>
        <h3>Faltas, retardos y extras por horario</h3>
      </div>
      <div class="toolbar-actions">
        <select v-if="cycles.length" v-model="selectedCycleId" @change="loadSelectedCycle">
          <option v-for="cycle in cycles" :key="cycle.id" :value="cycle.id">
            {{ cycle.periodLabel }} - {{ cycle.quarterCode }} / {{ cycle.status }}
          </option>
        </select>
        <select v-if="calendarPeriods.length" v-model="selectedCalendarConfigId" @change="loadSelectedCalendar">
          <option v-for="period in calendarPeriods" :key="period.id" :value="period.id">
            {{ period.periodLabel }} / {{ period.hasPayrollRun ? 'Nomina guardada' : 'Abierta' }}
          </option>
        </select>
        <button class="secondary-action" type="button" @click="loadIncidences(selectedCycleId, selectedCalendarConfigId)">
          <RefreshCw :size="17" :class="{ spin: pageBusy }" />
          Actualizar
        </button>
        <button
          class="primary-inline"
          type="button"
          :disabled="!selectedCalendarConfigId || !allPendingRows.length || savingBatch"
          @click="saveAllPendingRows"
        >
          <Save :size="17" />
          Guardar todo
        </button>
      </div>
    </section>

    <div v-if="activeCalendarPeriod?.hasPayrollRun" class="notice warning" style="margin-bottom: 1rem;">
      Esta quincena ya tiene nomina guardada. Las incidencias estan cerradas y solo se muestran para consulta.
    </div>

    <section class="metric-grid compact">
      <article class="metric-card mini"><p>Registros</p><strong>{{ summary.total }}</strong></article>
      <article class="metric-card mini"><p>Editables</p><strong>{{ summary.editable }}</strong></article>
      <article class="metric-card mini"><p>Faltas</p><strong>{{ formatHours(summary.absences) }}</strong></article>
      <article class="metric-card mini"><p>Extras horario</p><strong>{{ formatHours(summary.extraHoursInSchedule) }}</strong></article>
    </section>

    <section class="single-grid">
      <div class="data-panel full">
        <div class="filters-row incidences">
          <label class="search-box">
            <Search :size="17" />
            <input v-model="searchText" placeholder="Buscar docente, asignatura, grupo o coordinacion" />
          </label>
          <select v-model="incidenceFilter">
            <option value="TODOS">Todas</option>
            <option value="CON">Con incidencia</option>
            <option value="SIN">Sin incidencia</option>
          </select>
          <select v-model="visibilityFilter">
            <option value="TODOS">Todos los permisos</option>
            <option value="EDITABLES">Editables</option>
            <option value="BLOQUEADOS">Bloqueados</option>
          </select>
          <select v-model="changeFilter">
            <option value="TODOS">Todos los cambios</option>
            <option value="MODIFICADOS">Sin guardar</option>
            <option value="SIN_CAMBIOS">Guardados</option>
          </select>
          <span class="subtle-pill">
            <Clock3 :size="16" />
            {{ activeCalendarPeriod?.periodLabel || activeCycle?.periodLabel || 'Quincena operativa' }}
          </span>
        </div>

        <div v-if="allPendingRows.length" class="pending-strip">
          <strong>
            {{ allPendingRows.length }} edicion{{ allPendingRows.length === 1 ? '' : 'es' }} pendiente{{ allPendingRows.length === 1 ? '' : 's' }}
            <span v-if="visiblePendingRows.length !== allPendingRows.length">/ {{ visiblePendingRows.length }} visible{{ visiblePendingRows.length === 1 ? '' : 's' }}</span>
          </strong>
          <div class="pending-actions">
            <button class="primary-inline" type="button" :disabled="!selectedCalendarConfigId || savingBatch" @click="saveAllPendingRows">
              <Save :size="16" />
              Guardar todo
            </button>
            <button
              class="secondary-action"
              type="button"
              :disabled="!selectedCalendarConfigId || !visiblePendingRows.length"
              @click="saveVisibleRows"
            >
              <Save :size="16" />
              Guardar visibles
            </button>
            <button class="secondary-action" type="button" :disabled="!visiblePendingRows.length" @click="discardPendingRows">
              <RotateCcw :size="16" />
              Descartar visibles
            </button>
          </div>
        </div>

        <div class="table-shell">
          <table class="incidence-table">
            <colgroup>
              <col class="col-teacher" />
              <col class="col-subject" />
              <col class="col-load" />
              <col class="col-input" />
              <col class="col-input" />
              <col class="col-input" />
              <col class="col-status" />
              <col class="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Docente</th>
                <th>Asignatura</th>
                <th>Carga</th>
                <th>Faltas</th>
                <th>Retardos</th>
                <th>Extras</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredSchedules.length">
                <td colspan="8" class="empty-cell">No hay registros con el filtro actual.</td>
              </tr>
              <tr v-for="schedule in filteredSchedules" :key="schedule.id" :class="{ 'edited-row': rowIsModified(schedule) }">
                <td>
                  <strong>{{ schedule.teacherName }}</strong>
                  <span><Building2 :size="13" /> {{ schedule.coordinationName }}</span>
                  <small>{{ categoryLimitLabel(schedule.teacherCategory) }}</small>
                </td>
                <td>
                  <strong>{{ schedule.subjectName }}</strong>
                  <span>Grupo {{ schedule.groupCode }}</span>
                  <small>{{ schedule.periodLabel }} - {{ schedule.quarterCode }}</small>
                </td>
                <td>
                  <div class="load-summary compact">
                    <span>Sem {{ formatHours(schedule.weekHours) }}</span>
                    <span>M1 {{ formatHours(schedule.mod1Hours) }}</span>
                    <span>M2 {{ formatHours(schedule.mod2Hours) }}</span>
                  </div>
                  <small>{{ schedule.tabulatorName }} / {{ moneyLabel(schedule.tabulatorAmount) }}</small>
                </td>
                <td>
                  <input
                    class="inline-number"
                    :value="currentValue(schedule, 'absences')"
                    type="number"
                    min="0"
                    step="0.5"
                    :disabled="!schedule.canEdit"
                    @input="setValue(schedule, 'absences', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <input
                    class="inline-number"
                    :value="currentValue(schedule, 'delays')"
                    type="number"
                    min="0"
                    step="0.5"
                    :disabled="!schedule.canEdit"
                    @input="setValue(schedule, 'delays', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <input
                    class="inline-number"
                    :value="currentValue(schedule, 'extraHoursInSchedule')"
                    type="number"
                    min="0"
                    step="0.5"
                    :disabled="!schedule.canEdit"
                    @input="setValue(schedule, 'extraHoursInSchedule', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <span class="badge" :class="rowBadge(schedule).className">{{ rowBadge(schedule).label }}</span>
                  <small v-if="schedule.incidenceUpdatedByEmail">{{ schedule.incidenceUpdatedByEmail }}</small>
                </td>
                <td class="row-actions">
                  <button
                    class="icon-button"
                    type="button"
                    :disabled="!schedule.canEdit || !rowIsModified(schedule) || savingRows[schedule.id]"
                    :title="schedule.payrollLocked ? 'La quincena ya tiene nomina guardada' : 'Guardar'"
                    @click="saveRow(schedule)"
                  >
                    <Save :size="16" />
                  </button>
                  <button
                    class="icon-button"
                    type="button"
                    :disabled="!rowIsModified(schedule)"
                    title="Descartar"
                    @click="discardRow(schedule)"
                  >
                    <RotateCcw :size="16" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>
