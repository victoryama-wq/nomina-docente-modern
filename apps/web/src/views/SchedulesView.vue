<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  RefreshCw, CalendarClock, Search, Clock3, Building2,
  Edit3, Trash2
} from 'lucide-vue-next';
import {
  fetchSchedulesContext,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type Schedule,
  type ScheduleTeacher,
  type CycleOption,
  type CoordinationOption,
  type SubjectOption,
  type TabulatorOption,
  type ScheduleSummary,
  type SchedulePayload
} from '../api';
import ScheduleModal from '../components/modals/ScheduleModal.vue';
import ConfirmModal from '../components/modals/ConfirmModal.vue';
import { moneyLabel } from '../utils/format';

const authStore = useAuthStore();
type ScheduleLoadStatus = 'TODOS' | 'DISPONIBLE' | 'CERCA' | 'LIMITE' | 'EXCEDE';

const schedules = ref<Schedule[]>([]);
const scheduleTeachers = ref<ScheduleTeacher[]>([]);
const scheduleCycles = ref<CycleOption[]>([]);
const activeScheduleCycle = ref<CycleOption | null>(null);
const selectedScheduleCycleId = ref('');
const scheduleCoordinations = ref<CoordinationOption[]>([]);
const actorScheduleCoordination = ref<CoordinationOption | null>(null);
const scheduleSubjects = ref<SubjectOption[]>([]);
const scheduleTabulators = ref<TabulatorOption[]>([]);
const scheduleSummary = ref<ScheduleSummary>({
  total: 0,
  activeTeachers: 0,
  weekHours: 0,
  mod1Hours: 0,
  mod2Hours: 0,
  teachersAtLimit: 0
});
const scheduleSearch = ref('');
const scheduleStatusFilter = ref<ScheduleLoadStatus>('TODOS');
const onlyMyEditableSchedules = ref(false);
const scheduleTeacherSearch = ref('');
const scheduleTeacherPickerOpen = ref(false);
const scheduleModalOpen = ref(false);
const scheduleSaving = ref(false);
const scheduleFormError = ref('');
const editingScheduleId = ref<string | null>(null);
const pendingDeleteSchedule = ref<Schedule | null>(null);
const deletingSchedule = ref(false);
const pageBusy = ref(false);
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

const blankSchedule = (): SchedulePayload => ({
  teacherId: '',
  coordinationId: null,
  coordinationName: '',
  subjectName: '',
  groupCode: '',
  tabulatorId: '',
  tabulatorName: '',
  tabulatorAmount: 0,
  hoursL: 0,
  hoursM: 0,
  hoursX: 0,
  hoursJ: 0,
  hoursV: 0,
  hoursS1: 0,
  hoursS2: 0
});

const scheduleForm = ref<SchedulePayload>(blankSchedule());

const currentUserCoordination = computed(() => {
  if (actorScheduleCoordination.value) return actorScheduleCoordination.value;
  const currentName = normalizeMatch(authStore.session?.displayName || '');
  if (!currentName) return null;
  return scheduleCoordinations.value.find((coordination) => normalizeMatch(coordination.name) === currentName) || null;
});

const currentCoordinatorName = computed(
  () => currentUserCoordination.value?.name || authStore.session?.displayName || 'Coordinador conectado'
);

const editingSchedule = computed(
  () => schedules.value.find((schedule) => schedule.id === editingScheduleId.value) || null
);

const selectedScheduleTeacher = computed(
  () => scheduleTeachers.value.find((teacher) => teacher.id === scheduleForm.value.teacherId) || null
);

const scheduleFormProjection = computed(() => {
  const teacher = selectedScheduleTeacher.value;
  const edited = editingSchedule.value;
  const weekNew =
    numberValue(scheduleForm.value.hoursL) +
    numberValue(scheduleForm.value.hoursM) +
    numberValue(scheduleForm.value.hoursX) +
    numberValue(scheduleForm.value.hoursJ) +
    numberValue(scheduleForm.value.hoursV);
  const s1New = numberValue(scheduleForm.value.hoursS1);
  const s2New = numberValue(scheduleForm.value.hoursS2);
  let existingWeek = teacher?.currentWeekHours || 0;
  let existingS1 = teacher?.currentS1Hours || 0;
  let existingS2 = teacher?.currentS2Hours || 0;

  if (teacher && edited && edited.teacherId === teacher.id) {
    existingWeek -= edited.weekHours;
    existingS1 -= edited.hoursS1;
    existingS2 -= edited.hoursS2;
  }

  const maxHours = teacher?.maxHours || 0;
  const weekFinal = Math.max(0, existingWeek) + weekNew;
  const mod1Final = weekFinal + Math.max(0, existingS1) + s1New;
  const mod2Final = weekFinal + Math.max(0, existingS2) + s2New;

  return {
    weekNew,
    s1New,
    s2New,
    baseNew: weekNew + s1New + s2New,
    weekFinal,
    mod1Final,
    mod2Final,
    maxHours,
    remainingWeek: maxHours - weekFinal,
    remainingMod1: maxHours - mod1Final,
    remainingMod2: maxHours - mod2Final,
    exceeds: !!teacher && (weekFinal > maxHours || mod1Final > maxHours || mod2Final > maxHours)
  };
});

const scheduleOverallLoadClass = computed(() => {
  const projection = scheduleFormProjection.value;
  if (!selectedScheduleTeacher.value) return '';
  if (projection.exceeds) return 'danger';
  if (
    projection.weekFinal >= projection.maxHours ||
    projection.mod1Final >= projection.maxHours ||
    projection.mod2Final >= projection.maxHours
  ) {
    return 'limit';
  }
  if (
    projection.weekFinal >= projection.maxHours * 0.8 ||
    projection.mod1Final >= projection.maxHours * 0.8 ||
    projection.mod2Final >= projection.maxHours * 0.8
  ) {
    return 'warning';
  }
  return 'ok';
});

const filteredScheduleTeacherOptions = computed(() => {
  const text = scheduleTeacherSearch.value.toLowerCase().trim();
  const selectedId = scheduleForm.value.teacherId;
  const teachers = scheduleTeachers.value.filter((teacher) => {
    if (!text) return true;
    const haystack = [teacher.fullName, teacher.category, teacher.coordinationName].join(' ').toLowerCase();
    return haystack.includes(text);
  });

  return teachers
    .sort((left, right) => {
      if (left.id === selectedId) return -1;
      if (right.id === selectedId) return 1;
      return left.fullName.localeCompare(right.fullName);
    })
    .slice(0, 12);
});

const filteredSchedules = computed(() => {
  const text = scheduleSearch.value.toLowerCase().trim();
  return schedules.value.filter((schedule) => {
    const status = scheduleLoadStatus(schedule);
    const matchesStatus = scheduleStatusFilter.value === 'TODOS' || status.code === scheduleStatusFilter.value;
    const matchesEditable = !onlyMyEditableSchedules.value || canEditSchedule(schedule);
    const haystack = [
      schedule.teacherName,
      schedule.teacherCategory,
      schedule.coordinationName,
      schedule.subjectName,
      schedule.groupCode,
      schedule.tabulatorName,
      schedule.periodLabel,
      schedule.quarterCode,
      status.label
    ]
      .join(' ')
      .toLowerCase();
    return matchesStatus && matchesEditable && (!text || haystack.includes(text));
  });
});

function normalizeMatch(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numberValue(value: number | string | null | undefined) {
  return Number(value) || 0;
}

function formatHours(value: number | string | null | undefined) {
  const numeric = numberValue(value);
  return Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function scheduleDayLoads(schedule: Schedule) {
  return [
    { key: 'L', label: 'L', value: schedule.hoursL },
    { key: 'M', label: 'M', value: schedule.hoursM },
    { key: 'X', label: 'X', value: schedule.hoursX },
    { key: 'J', label: 'J', value: schedule.hoursJ },
    { key: 'V', label: 'V', value: schedule.hoursV },
    { key: 'S1', label: 'S1', value: schedule.hoursS1 },
    { key: 'S2', label: 'S2', value: schedule.hoursS2 }
  ];
}

function categoryLimitLabel(category: string) {
  if (category === 'V') return 'VIP 35 h';
  if (category === 'M') return 'Medio tiempo 25 h';
  return 'Nuevo ingreso 15 h';
}

function categoryMaxHours(category: string) {
  if (category === 'V') return 35;
  if (category === 'M') return 25;
  return 15;
}

function loadLevelClass(value: number, maxHours: number) {
  if (!maxHours) return 'ok';
  if (value > maxHours) return 'danger';
  if (value >= maxHours) return 'limit';
  if (value >= maxHours * 0.8) return 'warning';
  return 'ok';
}

function scheduleTeacherLoad(schedule: Schedule) {
  const teacher = scheduleTeachers.value.find((current) => current.id === schedule.teacherId);
  if (teacher) {
    return {
      maxHours: teacher.maxHours,
      weekHours: teacher.currentWeekHours,
      mod1Hours: teacher.currentMod1Hours,
      mod2Hours: teacher.currentMod2Hours
    };
  }

  const maxHours = categoryMaxHours(schedule.teacherCategory);
  return {
    maxHours,
    weekHours: schedule.weekHours,
    mod1Hours: schedule.mod1Hours,
    mod2Hours: schedule.mod2Hours
  };
}

function scheduleLoadStatus(schedule: Schedule): { code: ScheduleLoadStatus; label: string; className: string } {
  const load = scheduleTeacherLoad(schedule);
  const highestLoad = Math.max(load.weekHours, load.mod1Hours, load.mod2Hours);
  const className = loadLevelClass(highestLoad, load.maxHours);

  if (className === 'danger') return { code: 'EXCEDE', label: 'Excede el límite', className };
  if (className === 'limit') return { code: 'LIMITE', label: 'Al límite', className };
  if (className === 'warning') return { code: 'CERCA', label: 'Cerca del límite', className };
  return { code: 'DISPONIBLE', label: 'Disponible', className: 'ok' };
}

function canEditSchedule(schedule: Schedule) {
  if (authStore.isAdmin) return true;
  return !!currentUserCoordination.value && currentUserCoordination.value.id === schedule.coordinationId;
}



function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
  setTimeout(() => clearNotice(), 3000);
}

function clearNotice() {
  notice.value = null;
}

async function loadSchedules(cycleId = selectedScheduleCycleId.value || undefined) {
  pageBusy.value = true;
  clearNotice();
  try {
    const data = await fetchSchedulesContext(cycleId);
    activeScheduleCycle.value = data.activeCycle;
    selectedScheduleCycleId.value = data.activeCycle.id;
    scheduleCycles.value = data.cycles;
    schedules.value = data.schedules;
    scheduleTeachers.value = data.teachers;
    scheduleCoordinations.value = data.coordinations;
    actorScheduleCoordination.value = data.actorCoordination;
    scheduleSubjects.value = data.subjects;
    scheduleTabulators.value = data.tabulators;
    scheduleSummary.value = data.summary;
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar horarios.');
  } finally {
    pageBusy.value = false;
  }
}

function newSchedule() {
  editingScheduleId.value = null;
  scheduleTeacherSearch.value = '';
  scheduleTeacherPickerOpen.value = false;
  scheduleFormError.value = '';
  scheduleForm.value = {
    ...blankSchedule(),
    cycleId: selectedScheduleCycleId.value || activeScheduleCycle.value?.id,
    coordinationId: currentUserCoordination.value?.id || null,
    coordinationName: currentUserCoordination.value?.name || (!authStore.isAdmin ? currentCoordinatorName.value : '')
  };
  scheduleModalOpen.value = true;
  clearNotice();
}

function closeScheduleModal() {
  scheduleModalOpen.value = false;
  editingScheduleId.value = null;
  scheduleForm.value = blankSchedule();
  scheduleTeacherSearch.value = '';
  scheduleTeacherPickerOpen.value = false;
  scheduleFormError.value = '';
}

function applySelectedTeacherDefaults() {
  if (authStore.isAdmin) return;

  scheduleForm.value.coordinationId = currentUserCoordination.value?.id || null;
  scheduleForm.value.coordinationName = currentCoordinatorName.value;
}

function selectScheduleTeacher(teacher: ScheduleTeacher) {
  scheduleForm.value.teacherId = teacher.id;
  scheduleTeacherSearch.value = `${teacher.fullName} / ${categoryLimitLabel(teacher.category)}`;
  scheduleTeacherPickerOpen.value = false;
  scheduleFormError.value = '';
  applySelectedTeacherDefaults();
}

function onScheduleTeacherSearchInput() {
  scheduleTeacherPickerOpen.value = true;
  const selected = selectedScheduleTeacher.value;
  if (!selected) return;
  const expected = `${selected.fullName} / ${categoryLimitLabel(selected.category)}`.toLowerCase();
  if (scheduleTeacherSearch.value.toLowerCase() !== expected) {
    scheduleForm.value.teacherId = '';
  }
}

function applySelectedTabulator() {
  const selected = scheduleTabulators.value.find((tabulator) => tabulator.id === scheduleForm.value.tabulatorId);
  scheduleForm.value.tabulatorName = selected?.name || '';
  scheduleForm.value.tabulatorAmount = selected?.amount || 0;
}

function editSchedule(schedule: Schedule) {
  if (!canEditSchedule(schedule)) {
    setNotice('error', 'Solo la coordinación que capturó este horario puede editarlo.');
    return;
  }

  editingScheduleId.value = schedule.id;
  selectedScheduleCycleId.value = schedule.cycleId;
  activeScheduleCycle.value = {
    id: schedule.cycleId,
    periodLabel: schedule.periodLabel,
    quarterCode: schedule.quarterCode,
    module1Start: '',
    module1End: '',
    module2Start: '',
    module2End: '',
    status: schedule.cycleStatus
  };
  scheduleForm.value = {
    cycleId: schedule.cycleId,
    teacherId: schedule.teacherId,
    coordinationId: authStore.isAdmin ? schedule.coordinationId : currentUserCoordination.value?.id || null,
    coordinationName: authStore.isAdmin ? schedule.coordinationName : currentCoordinatorName.value,
    subjectName: schedule.subjectName,
    groupCode: schedule.groupCode,
    tabulatorId: schedule.tabulatorId || '',
    tabulatorName: schedule.tabulatorName,
    tabulatorAmount: schedule.tabulatorAmount,
    hoursL: schedule.hoursL,
    hoursM: schedule.hoursM,
    hoursX: schedule.hoursX,
    hoursJ: schedule.hoursJ,
    hoursV: schedule.hoursV,
    hoursS1: schedule.hoursS1,
    hoursS2: schedule.hoursS2
  };
  scheduleTeacherSearch.value = `${schedule.teacherName} / ${categoryLimitLabel(schedule.teacherCategory)}`;
  scheduleTeacherPickerOpen.value = false;
  scheduleFormError.value = '';
  scheduleModalOpen.value = true;
  clearNotice();
}

async function saveSchedule() {
  if (!authStore.canManageSchedules) return;
  scheduleFormError.value = '';
  if (!selectedScheduleTeacher.value) {
    scheduleFormError.value = 'Selecciona un docente activo desde el buscador.';
    return;
  }
  if (!scheduleForm.value.tabulatorId) {
    scheduleFormError.value = 'Selecciona un tabulador del catálogo.';
    return;
  }
  if (authStore.isAdmin && !scheduleForm.value.coordinationId) {
    scheduleFormError.value = 'Selecciona el coordinador responsable del horario.';
    return;
  }
  if (
    authStore.isAdmin &&
    !scheduleCoordinations.value.some((coordination) => coordination.id === scheduleForm.value.coordinationId)
  ) {
    scheduleFormError.value = 'Selecciona un coordinador con acceso activo al sistema.';
    return;
  }
  if (scheduleFormProjection.value.exceeds) {
    scheduleFormError.value = 'La carga proyectada excede el límite de la categoría docente.';
    return;
  }
  scheduleSaving.value = true;
  clearNotice();
  try {
    const payload = {
      ...scheduleForm.value,
      cycleId: scheduleForm.value.cycleId || selectedScheduleCycleId.value || activeScheduleCycle.value?.id,
      coordinationId: authStore.isAdmin ? scheduleForm.value.coordinationId : currentUserCoordination.value?.id || null,
      coordinationName: authStore.isAdmin ? scheduleForm.value.coordinationName : currentCoordinatorName.value
    };
    const response = editingScheduleId.value
      ? await updateSchedule(editingScheduleId.value, payload)
      : await createSchedule(payload);
    setNotice('ok', response.message);
    closeScheduleModal();
    await loadSchedules(payload.cycleId);
  } catch (err) {
    scheduleFormError.value = err instanceof Error ? err.message : 'No fue posible guardar el horario.';
  } finally {
    scheduleSaving.value = false;
  }
}

function requestRemoveSchedule(schedule: Schedule) {
  if (!authStore.canManageSchedules) return;
  if (!canEditSchedule(schedule)) {
    setNotice('error', 'Solo la coordinación que capturó este horario puede eliminarlo.');
    return;
  }
  pendingDeleteSchedule.value = schedule;
  clearNotice();
}

function closeDeleteScheduleModal() {
  if (deletingSchedule.value) return;
  pendingDeleteSchedule.value = null;
}

async function confirmRemoveSchedule() {
  const schedule = pendingDeleteSchedule.value;
  if (!schedule || !authStore.canManageSchedules) return;

  deletingSchedule.value = true;
  clearNotice();
  try {
    const response = await deleteSchedule(schedule.id);
    pendingDeleteSchedule.value = null;
    setNotice('ok', response.message);
    if (editingScheduleId.value === schedule.id) closeScheduleModal();
    await loadSchedules(selectedScheduleCycleId.value);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible eliminar el horario.');
  } finally {
    deletingSchedule.value = false;
  }
}

onMounted(() => {
  if (authStore.canManageSchedules) {
    loadSchedules();
  }
});
</script>

<template>
  <div class="view-stack">
    <div v-if="notice" class="notice" :class="notice.type" style="margin-bottom: 1rem;">
      {{ notice.text }}
    </div>

    <section class="toolbar-card">
      <div>
        <p class="eyebrow">Capturar Horarios</p>
        <h3>Carga semanal por categoría docente</h3>
      </div>
      <div class="toolbar-actions">
        <select v-if="scheduleCycles.length" v-model="selectedScheduleCycleId" @change="loadSchedules(selectedScheduleCycleId)">
          <option v-for="cycle in scheduleCycles" :key="cycle.id" :value="cycle.id">
            {{ cycle.periodLabel }} - {{ cycle.quarterCode }} / {{ cycle.status }}
          </option>
        </select>
        <button class="secondary-action" type="button" @click="loadSchedules(selectedScheduleCycleId)">
          <RefreshCw :size="17" :class="{ spin: pageBusy }" />
          Actualizar
        </button>
        <button class="primary-inline" type="button" :disabled="activeScheduleCycle?.status === 'CERRADO'" @click="newSchedule">
          <CalendarClock :size="17" />
          Nuevo horario
        </button>
      </div>
    </section>

    <section class="metric-grid compact">
      <article class="metric-card mini"><p>Registros</p><strong>{{ scheduleSummary.total }}</strong></article>
      <article class="metric-card mini"><p>Docentes activos</p><strong>{{ scheduleSummary.activeTeachers }}</strong></article>
      <article class="metric-card mini"><p>Horas L-V</p><strong>{{ formatHours(scheduleSummary.weekHours) }}</strong></article>
      <article class="metric-card mini"><p>Al límite</p><strong>{{ scheduleSummary.teachersAtLimit }}</strong></article>
    </section>

    <section class="single-grid">
      <div class="data-panel full">
        <div class="filters-row schedules">
          <label class="search-box">
            <Search :size="17" />
            <input v-model="scheduleSearch" placeholder="Buscar docente, asignatura, grupo o coordinación" />
          </label>
          <select v-model="scheduleStatusFilter">
            <option value="TODOS">Todos los estados</option>
            <option value="DISPONIBLE">Disponible</option>
            <option value="CERCA">Cerca del límite</option>
            <option value="LIMITE">Al límite</option>
            <option value="EXCEDE">Excede el límite</option>
          </select>
          <label v-if="!authStore.isAdmin" class="toggle-filter">
            <input v-model="onlyMyEditableSchedules" type="checkbox" />
            <span>Solo editables por mi</span>
          </label>
          <span class="subtle-pill">
            <Clock3 :size="16" />
            {{ activeScheduleCycle?.periodLabel || 'Ciclo operativo' }}
          </span>
        </div>

        <div class="table-shell">
          <table class="schedule-table">
            <colgroup>
              <col class="col-teacher" />
              <col class="col-status" />
              <col class="col-subject" />
              <col class="col-load" />
              <col class="col-tabulator" />
              <col class="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Docente</th>
                <th>Estado</th>
                <th>Asignatura</th>
                <th>Carga</th>
                <th>Tabulador</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredSchedules.length">
                <td colspan="6" class="empty-cell">No hay horarios con el filtro actual.</td>
              </tr>
              <tr v-for="schedule in filteredSchedules" :key="schedule.id">
                <td>
                  <strong>{{ schedule.teacherName }}</strong>
                  <span><Building2 :size="13" /> {{ schedule.coordinationName }}</span>
                  <small>{{ categoryLimitLabel(schedule.teacherCategory) }}</small>
                </td>
                <td>
                  <span class="badge" :class="scheduleLoadStatus(schedule).className">
                    {{ scheduleLoadStatus(schedule).label }}
                  </span>
                  <small>
                    Max {{ formatHours(scheduleTeacherLoad(schedule).maxHours) }} h / M1
                    {{ formatHours(scheduleTeacherLoad(schedule).mod1Hours) }} h / M2
                    {{ formatHours(scheduleTeacherLoad(schedule).mod2Hours) }} h
                  </small>
                </td>
                <td>
                  <strong>{{ schedule.subjectName }}</strong>
                  <span>Grupo {{ schedule.groupCode }}</span>
                  <small>{{ schedule.periodLabel }} - {{ schedule.quarterCode }}</small>
                </td>
                <td>
                  <div class="hours-grid">
                    <span
                      v-for="day in scheduleDayLoads(schedule)"
                      :key="day.key"
                      class="hour-cell"
                      :class="{ empty: numberValue(day.value) === 0 }"
                    >
                      <b>{{ day.label }}</b>
                      <em>{{ formatHours(day.value) }}</em>
                    </span>
                  </div>
                  <div class="load-summary">
                    <span>Sem {{ formatHours(schedule.weekHours) }}</span>
                    <span>M1 {{ formatHours(schedule.mod1Hours) }}</span>
                    <span>M2 {{ formatHours(schedule.mod2Hours) }}</span>
                  </div>
                </td>
                <td>
                  <span class="badge neutral">{{ schedule.tabulatorName }}</span>
                  <small>{{ moneyLabel(schedule.tabulatorAmount) }}</small>
                </td>
                <td class="row-actions">
                  <button
                    class="icon-button"
                    type="button"
                    :disabled="!canEditSchedule(schedule)"
                    :title="canEditSchedule(schedule) ? 'Editar' : 'Solo editable por la coordinación que lo capturó'"
                    @click="editSchedule(schedule)"
                  >
                    <Edit3 :size="16" />
                  </button>
                  <button
                    class="icon-button danger"
                    type="button"
                    :disabled="!canEditSchedule(schedule)"
                    :title="canEditSchedule(schedule) ? 'Eliminar' : 'Solo eliminable por la coordinación que lo capturó'"
                    @click="requestRemoveSchedule(schedule)"
                  >
                    <Trash2 :size="16" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <ScheduleModal
      :show="scheduleModalOpen"
      :is-editing="!!editingScheduleId"
      :saving="scheduleSaving"
      :is-admin="authStore.isAdmin"
      :form="scheduleForm"
      v-model:teacher-search-text="scheduleTeacherSearch"
      :teacher-picker-open="scheduleTeacherPickerOpen"
      :filtered-teacher-options="filteredScheduleTeacherOptions"
      :coordinations="scheduleCoordinations"
      :current-coordinator-name="currentCoordinatorName"
      :cycles="scheduleCycles"
      :active-cycle="activeScheduleCycle"
      :subjects="scheduleSubjects"
      :tabulators="scheduleTabulators"
      :selected-teacher="selectedScheduleTeacher"
      :projection="scheduleFormProjection"
      :overall-load-class="scheduleOverallLoadClass"
      :form-error="scheduleFormError"
      @close="closeScheduleModal"
      @save="saveSchedule"
      @focus-teacher-search="scheduleTeacherPickerOpen = true"
      @input-teacher-search="onScheduleTeacherSearchInput"
      @escape-teacher-search="scheduleTeacherPickerOpen = false"
      @select-teacher="selectScheduleTeacher"
      @apply-tabulator="applySelectedTabulator"
    />

    <ConfirmModal
      :show="!!pendingDeleteSchedule"
      eyebrow="Capturar horarios"
      title="Eliminar horario"
      :subject="pendingDeleteSchedule ? `${pendingDeleteSchedule.teacherName} / ${pendingDeleteSchedule.groupCode}` : ''"
      message="Este horario saldrá de la carga activa del ciclo seleccionado. Verifica que no forme parte de una revisión de nómina antes de continuar."
      :details="[
        pendingDeleteSchedule ? `Asignatura: ${pendingDeleteSchedule.subjectName}` : '',
        pendingDeleteSchedule ? `Coordinación: ${pendingDeleteSchedule.coordinationName}` : ''
      ].filter(Boolean)"
      confirm-label="Eliminar horario"
      cancel-label="Conservar horario"
      tone="danger"
      icon="trash"
      :loading="deletingSchedule"
      @close="closeDeleteScheduleModal"
      @confirm="confirmRemoveSchedule"
    />
  </div>
</template>
