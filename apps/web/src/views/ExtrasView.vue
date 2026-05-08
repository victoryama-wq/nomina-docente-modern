<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { BadgePlus, Building2, Clock3, Edit3, RefreshCw, Search, Trash2 } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import {
  createExtra,
  deleteExtra,
  fetchExtrasContext,
  updateExtra,
  type CoordinationOption,
  type CycleOption,
  type ExtraAccessPeriod,
  type ExtraPayload,
  type ExtraRecord,
  type ExtraSummary,
  type ExtraTeacher,
  type TabulatorOption
} from '../api';
import ExtraModal from '../components/modals/ExtraModal.vue';
import ConfirmModal from '../components/modals/ConfirmModal.vue';

const authStore = useAuthStore();
type LoadStatusFilter = 'TODOS' | ExtraTeacher['loadStatus'];

const extras = ref<ExtraRecord[]>([]);
const teachers = ref<ExtraTeacher[]>([]);
const cycles = ref<CycleOption[]>([]);
const activeCycle = ref<CycleOption | null>(null);
const selectedCycleId = ref('');
const coordinations = ref<CoordinationOption[]>([]);
const actorCoordination = ref<CoordinationOption | null>(null);
const tabulators = ref<TabulatorOption[]>([]);
const extraAccessPeriods = ref<ExtraAccessPeriod[]>([]);
const activeExtraAccessPeriod = ref<ExtraAccessPeriod | null>(null);
const summary = ref<ExtraSummary>({
  total: 0,
  hours: 0,
  amount: 0,
  impactedTeachers: 0,
  overloadedTeachers: 0
});
const searchText = ref('');
const loadStatusFilter = ref<LoadStatusFilter>('TODOS');
const onlyEditable = ref(false);
const modalOpen = ref(false);
const saving = ref(false);
const formError = ref('');
const editingExtraId = ref<string | null>(null);
const pendingDeleteExtra = ref<ExtraRecord | null>(null);
const deletingExtra = ref(false);
const teacherSearchText = ref('');
const teacherPickerOpen = ref(false);
const pageBusy = ref(false);
const notice = ref<{ type: 'ok' | 'error' | 'warning'; text: string } | null>(null);
const nowMs = ref(Date.now());
let clockTimer: number | undefined;

const blankExtra = (): ExtraPayload => ({
  teacherId: '',
  coordinationId: '',
  hours: 0,
  tabulatorId: '',
  tabulatorAmount: 0,
  reason: '',
  activityDate: new Date().toISOString().slice(0, 10),
  reference: '',
  observations: ''
});

const form = ref<ExtraPayload>(blankExtra());

const selectedTeacher = computed(() => teachers.value.find((teacher) => teacher.id === form.value.teacherId) || null);
const editingExtra = computed(() => extras.value.find((extra) => extra.id === editingExtraId.value) || null);

const filteredTeacherOptions = computed(() => {
  const text = teacherSearchText.value.toLowerCase().trim();
  const selectedId = form.value.teacherId;
  return teachers.value
    .filter((teacher) => {
      if (!text) return true;
      return [teacher.fullName, teacher.category, teacher.coordinationName].join(' ').toLowerCase().includes(text);
    })
    .sort((left, right) => {
      if (left.id === selectedId) return -1;
      if (right.id === selectedId) return 1;
      return left.fullName.localeCompare(right.fullName);
    })
    .slice(0, 12);
});

const filteredExtras = computed(() => {
  const text = searchText.value.toLowerCase().trim();
  return extras.value.filter((extra) => {
    const teacher = teacherForExtra(extra);
    const status = teacher?.loadStatus || 'DISPONIBLE';
    const haystack = [
      extra.teacherName,
      extra.teacherCategory,
      extra.coordinationName,
      extra.reason,
      extra.reference,
      extra.observations,
      extra.periodLabel,
      extra.quarterCode
    ]
      .join(' ')
      .toLowerCase();
    const matchesText = !text || haystack.includes(text);
    const matchesStatus = loadStatusFilter.value === 'TODOS' || status === loadStatusFilter.value;
    const matchesEditable = !onlyEditable.value || canEditExtra(extra);
    return matchesText && matchesStatus && matchesEditable;
  });
});

const extraAccessStatus = computed(() => {
  const period = activeExtraAccessPeriod.value;
  if (!period) return 'SIN_QUINCENA';
  if (period.hasPayrollRun) return 'NOMINA';
  const start = new Date(period.accessStartAt).getTime();
  const end = new Date(period.accessEndAt).getTime();
  if (nowMs.value < start) return 'PENDIENTE';
  if (nowMs.value <= end) return 'ABIERTO';
  return 'CERRADO';
});

const canCaptureExtras = computed(() => activeCycle.value?.status !== 'CERRADO' && extraAccessStatus.value === 'ABIERTO');

const extraAccessStatusLabel = computed(() => {
  const period = activeExtraAccessPeriod.value;
  if (!period) return 'Sin quincena configurada';
  if (extraAccessStatus.value === 'NOMINA') return 'Nómina guardada';
  if (extraAccessStatus.value === 'PENDIENTE') return `Abre ${formatDateTime(period.accessStartAt)}`;
  if (extraAccessStatus.value === 'ABIERTO') return `Cierra en ${formatRemaining(new Date(period.accessEndAt).getTime() - nowMs.value)}`;
  return `Cerró ${formatDateTime(period.accessEndAt)}`;
});

const projection = computed(() => {
  const teacher = selectedTeacher.value;
  const edited = editingExtra.value;
  const hoursNew = numberValue(form.value.hours);
  let existingExtras = teacher?.extraHours || 0;
  if (teacher && edited && edited.teacherId === teacher.id) {
    existingExtras = Math.max(0, existingExtras - edited.hours);
  }

  const maxHours = teacher?.maxHours || 0;
  const projectedExtras = existingExtras + hoursNew;
  const weekFinal = (teacher?.scheduleWeekHours || 0) + projectedExtras;
  const mod1Final = (teacher?.scheduleMod1Hours || 0) + projectedExtras;
  const mod2Final = (teacher?.scheduleMod2Hours || 0) + projectedExtras;

  return {
    hoursNew,
    projectedExtras,
    weekFinal,
    mod1Final,
    mod2Final,
    maxHours,
    exceeds: !!teacher && (weekFinal > maxHours || mod1Final > maxHours || mod2Final > maxHours)
  };
});

const overallLoadClass = computed(() => {
  if (!selectedTeacher.value) return '';
  const current = projection.value;
  const highest = Math.max(current.weekFinal, current.mod1Final, current.mod2Final);
  if (highest > current.maxHours) return 'danger';
  if (highest >= current.maxHours) return 'limit';
  if (highest >= current.maxHours * 0.8) return 'warning';
  return 'ok';
});

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

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const text = value.slice(0, 10);
  const [year, month, day] = text.split('-');
  if (!year || !month || !day) return text;
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function formatRemaining(ms: number) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function canEditExtra(extra: ExtraRecord) {
  if (!extra.canEdit || !extra.accessStartAt || !extra.accessEndAt) return false;
  const start = new Date(extra.accessStartAt).getTime();
  const end = new Date(extra.accessEndAt).getTime();
  return nowMs.value >= start && nowMs.value <= end;
}

function setNotice(type: 'ok' | 'error' | 'warning', text: string) {
  notice.value = { type, text };
  setTimeout(() => clearNotice(), 3200);
}

function clearNotice() {
  notice.value = null;
}

function loadStatusClass(status: ExtraTeacher['loadStatus']) {
  if (status === 'EXCEDE') return 'danger';
  if (status === 'LIMITE') return 'limit';
  if (status === 'CERCA') return 'warning';
  return 'ok';
}

function loadStatusLabel(status: ExtraTeacher['loadStatus']) {
  if (status === 'EXCEDE') return 'Excede límite';
  if (status === 'LIMITE') return 'Al límite';
  if (status === 'CERCA') return 'Cerca del límite';
  return 'Disponible';
}

function teacherForExtra(extra: ExtraRecord) {
  return teachers.value.find((teacher) => teacher.id === extra.teacherId) || null;
}

function projectionWarningText() {
  const current = projection.value;
  const teacher = selectedTeacher.value;
  if (!teacher || !current.exceeds) return '';
  const dimensions = [
    { label: 'Semana', value: current.weekFinal },
    { label: 'Mod 1', value: current.mod1Final },
    { label: 'Mod 2', value: current.mod2Final }
  ].sort((left, right) => right.value - left.value);
  const highest = dimensions[0];
  return `Advertencia: ${teacher.fullName} queda en ${formatHours(highest.value)}/${formatHours(
    current.maxHours
  )} h en ${highest.label}, por arriba del máximo de su categoría.`;
}

async function loadExtras(cycleId = selectedCycleId.value || undefined) {
  if (!authStore.canManageExtras) return;
  pageBusy.value = true;
  clearNotice();
  try {
    const data = await fetchExtrasContext(cycleId);
    activeCycle.value = data.activeCycle;
    selectedCycleId.value = data.activeCycle.id;
    cycles.value = data.cycles;
    actorCoordination.value = data.actorCoordination;
    coordinations.value = data.coordinations;
    teachers.value = data.teachers;
    extras.value = data.extras;
    extraAccessPeriods.value = data.extraAccessPeriods;
    activeExtraAccessPeriod.value = data.activeExtraAccessPeriod;
    tabulators.value = data.tabulators;
    summary.value = data.summary;
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar extras.');
  } finally {
    pageBusy.value = false;
  }
}

function closeModal() {
  modalOpen.value = false;
  editingExtraId.value = null;
  form.value = blankExtra();
  teacherSearchText.value = '';
  teacherPickerOpen.value = false;
  formError.value = '';
}

function newExtra() {
  if (!canCaptureExtras.value) {
    setNotice('error', `La captura de extras no está abierta. ${extraAccessStatusLabel.value}.`);
    return;
  }
  editingExtraId.value = null;
  form.value = {
    ...blankExtra(),
    cycleId: selectedCycleId.value || activeCycle.value?.id,
    coordinationId: authStore.isAdmin ? actorCoordination.value?.id || '' : ''
  };
  teacherSearchText.value = '';
  teacherPickerOpen.value = false;
  formError.value = '';
  modalOpen.value = true;
  clearNotice();
}

function selectTeacher(teacher: ExtraTeacher) {
  form.value.teacherId = teacher.id;
  teacherSearchText.value = `${teacher.fullName} / ${categoryLimitLabel(teacher.category)}`;
  teacherPickerOpen.value = false;
  formError.value = '';

  if (!form.value.tabulatorId && teacher.suggestedTabulatorAmount) {
    const suggested = tabulators.value.find((tabulator) => tabulator.amount === teacher.suggestedTabulatorAmount);
    if (suggested) {
      form.value.tabulatorId = suggested.id;
      form.value.tabulatorAmount = suggested.amount;
    } else {
      form.value.tabulatorAmount = teacher.suggestedTabulatorAmount;
    }
  }
}

function onTeacherSearchInput() {
  teacherPickerOpen.value = true;
  const selected = selectedTeacher.value;
  if (!selected) return;
  const expected = `${selected.fullName} / ${categoryLimitLabel(selected.category)}`.toLowerCase();
  if (teacherSearchText.value.toLowerCase() !== expected) {
    form.value.teacherId = '';
  }
}

function applyTabulator() {
  const selected = tabulators.value.find((tabulator) => tabulator.id === form.value.tabulatorId);
  form.value.tabulatorAmount = selected?.amount || 0;
}

function editExtra(extra: ExtraRecord) {
  if (!canEditExtra(extra)) {
    setNotice('error', extra.canEdit ? 'La ventana de captura de este extra no está abierta.' : 'Solo la coordinación que capturó este extra puede editarlo.');
    return;
  }

  editingExtraId.value = extra.id;
  form.value = {
    cycleId: extra.cycleId,
    coordinationId: authStore.isAdmin ? extra.coordinationId : '',
    teacherId: extra.teacherId,
    hours: extra.hours,
    tabulatorId: tabulators.value.find((tabulator) => tabulator.amount === extra.tabulatorAmount)?.id || '',
    tabulatorAmount: extra.tabulatorAmount,
    reason: extra.reason,
    activityDate: extra.activityDate?.slice(0, 10) || '',
    reference: extra.reference,
    observations: extra.observations
  };
  teacherSearchText.value = `${extra.teacherName} / ${categoryLimitLabel(extra.teacherCategory)}`;
  teacherPickerOpen.value = false;
  formError.value = '';
  modalOpen.value = true;
  clearNotice();
}

async function saveExtra() {
  if (!authStore.canManageExtras) return;
  formError.value = '';
  if (!selectedTeacher.value) {
    formError.value = 'Selecciona un docente activo desde el buscador.';
    return;
  }
  if (!form.value.tabulatorId) {
    formError.value = 'Selecciona un tabulador del catálogo.';
    return;
  }
  if (!(numberValue(form.value.hours) > 0)) {
    formError.value = 'Las horas extra deben ser mayores a 0.';
    return;
  }
  if (!form.value.reason.trim()) {
    formError.value = 'Captura el motivo del extra.';
    return;
  }

  saving.value = true;
  clearNotice();
  try {
    const warningText = projectionWarningText();
    const payload = {
      ...form.value,
      cycleId: form.value.cycleId || selectedCycleId.value || activeCycle.value?.id,
      coordinationId: authStore.isAdmin ? form.value.coordinationId : undefined
    };
    const response = editingExtraId.value
      ? await updateExtra(editingExtraId.value, payload)
      : await createExtra(payload);
    closeModal();
    await loadExtras(payload.cycleId);
    setNotice(warningText ? 'warning' : 'ok', warningText ? `${response.message} ${warningText}` : response.message);
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'No fue posible guardar el extra.';
  } finally {
    saving.value = false;
  }
}

function requestRemoveExtra(extra: ExtraRecord) {
  if (!canEditExtra(extra)) {
    setNotice('error', extra.canEdit ? 'La ventana de captura de este extra no está abierta.' : 'Solo la coordinación que capturó este extra puede eliminarlo.');
    return;
  }
  pendingDeleteExtra.value = extra;
  clearNotice();
}

function closeDeleteExtraModal() {
  if (deletingExtra.value) return;
  pendingDeleteExtra.value = null;
}

async function confirmRemoveExtra() {
  const extra = pendingDeleteExtra.value;
  if (!extra) return;

  deletingExtra.value = true;
  clearNotice();
  try {
    const response = await deleteExtra(extra.id);
    pendingDeleteExtra.value = null;
    setNotice('ok', response.message);
    if (editingExtraId.value === extra.id) closeModal();
    await loadExtras(selectedCycleId.value);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible eliminar el extra.');
  } finally {
    deletingExtra.value = false;
  }
}

onMounted(() => {
  clockTimer = window.setInterval(() => {
    nowMs.value = Date.now();
  }, 60_000);
  loadExtras();
});

onUnmounted(() => {
  if (clockTimer) window.clearInterval(clockTimer);
});
</script>

<template>
  <div class="view-stack">
    <div v-if="notice" class="notice" :class="notice.type" style="margin-bottom: 1rem;">
      {{ notice.text }}
    </div>

    <section class="toolbar-card">
      <div>
        <p class="eyebrow">Capturar Extras</p>
        <h3>Horas extra y carga global docente</h3>
      </div>
      <div class="toolbar-actions">
        <select v-if="cycles.length" v-model="selectedCycleId" @change="loadExtras(selectedCycleId)">
          <option v-for="cycle in cycles" :key="cycle.id" :value="cycle.id">
            {{ cycle.periodLabel }} - {{ cycle.quarterCode }} / {{ cycle.status }}
          </option>
        </select>
        <button class="secondary-action" type="button" @click="loadExtras(selectedCycleId)">
          <RefreshCw :size="17" :class="{ spin: pageBusy }" />
          Actualizar
        </button>
        <button class="primary-inline" type="button" :disabled="!canCaptureExtras" @click="newExtra">
          <BadgePlus :size="17" />
          Nuevo extra
        </button>
      </div>
    </section>

    <div v-if="activeExtraAccessPeriod && extraAccessStatus !== 'ABIERTO'" class="notice warning" style="margin-bottom: 1rem;">
      {{ extraAccessStatusLabel }}. La captura de extras queda en modo consulta hasta que la ventana esté abierta.
    </div>

    <section class="metric-grid compact">
      <article class="metric-card mini"><p>Registros</p><strong>{{ summary.total }}</strong></article>
      <article class="metric-card mini"><p>Horas extra</p><strong>{{ formatHours(summary.hours) }}</strong></article>
      <article class="metric-card mini"><p>Monto</p><strong>{{ moneyLabel(summary.amount) }}</strong></article>
      <article class="metric-card mini"><p>Sobrecarga</p><strong>{{ summary.overloadedTeachers }}</strong></article>
    </section>

    <section class="single-grid">
      <div class="data-panel full">
        <div class="filters-row extras">
          <label class="search-box">
            <Search :size="17" />
            <input v-model="searchText" placeholder="Buscar docente, motivo, referencia o coordinación" />
          </label>
          <select v-model="loadStatusFilter">
            <option value="TODOS">Todos los estados</option>
            <option value="DISPONIBLE">Disponible</option>
            <option value="CERCA">Cerca del límite</option>
            <option value="LIMITE">Al límite</option>
            <option value="EXCEDE">Excede límite</option>
          </select>
          <label v-if="!authStore.isAdmin" class="toggle-filter">
            <input v-model="onlyEditable" type="checkbox" />
            <span>Solo editables</span>
          </label>
          <span class="subtle-pill">
            <Clock3 :size="16" />
            {{ activeExtraAccessPeriod?.periodLabel || activeCycle?.periodLabel || 'Ciclo operativo' }} / {{ extraAccessStatusLabel }}
          </span>
        </div>

        <div class="table-shell">
          <table class="extras-table">
            <colgroup>
              <col class="col-teacher" />
              <col class="col-status" />
              <col class="col-extra" />
              <col class="col-money" />
              <col class="col-meta" />
              <col class="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Docente</th>
                <th>Estado carga</th>
                <th>Extra</th>
                <th>Importe</th>
                <th>Registro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredExtras.length">
                <td colspan="6" class="empty-cell">No hay extras con el filtro actual.</td>
              </tr>
              <tr v-for="extra in filteredExtras" :key="extra.id">
                <td>
                  <strong>{{ extra.teacherName }}</strong>
                  <span><Building2 :size="13" /> {{ extra.coordinationName }}</span>
                  <small>{{ categoryLimitLabel(extra.teacherCategory) }}</small>
                </td>
                <td>
                  <template v-if="teacherForExtra(extra)">
                    <span class="badge" :class="loadStatusClass(teacherForExtra(extra)!.loadStatus)">
                      {{ loadStatusLabel(teacherForExtra(extra)!.loadStatus) }}
                    </span>
                    <div class="load-summary compact">
                      <span>Sem {{ formatHours(teacherForExtra(extra)!.totalWeekHours) }}</span>
                      <span>M1 {{ formatHours(teacherForExtra(extra)!.totalMod1Hours) }}</span>
                      <span>M2 {{ formatHours(teacherForExtra(extra)!.totalMod2Hours) }}</span>
                    </div>
                    <small>
                      Inc {{ formatHours(teacherForExtra(extra)!.incidenceExtraHours) }} h / Extras
                      {{ formatHours(teacherForExtra(extra)!.loggedExtraHours) }} h
                    </small>
                  </template>
                  <span v-else class="badge muted">Sin carga</span>
                </td>
                <td>
                  <strong>{{ extra.reason }}</strong>
                  <span>{{ formatDate(extra.activityDate) }}</span>
                  <small v-if="extra.reference">{{ extra.reference }}</small>
                </td>
                <td>
                  <strong>{{ formatHours(extra.hours) }} h</strong>
                  <span>{{ moneyLabel(extra.tabulatorAmount) }}</span>
                  <small>{{ moneyLabel(extra.totalAmount) }}</small>
                </td>
                <td>
                  <span>{{ formatDate(extra.capturedAt) }}</span>
                  <small>{{ extra.capturedByEmail || 'Sin usuario' }}</small>
                  <span v-if="!canEditExtra(extra)" class="badge muted">Bloqueado</span>
                </td>
                <td class="row-actions">
                  <button
                    class="icon-button"
                    type="button"
                    :disabled="!canEditExtra(extra)"
                    :title="canEditExtra(extra) ? 'Editar' : 'Solo editable durante la ventana de captura correspondiente'"
                    @click="editExtra(extra)"
                  >
                    <Edit3 :size="16" />
                  </button>
                  <button
                    class="icon-button danger"
                    type="button"
                    :disabled="!canEditExtra(extra)"
                    :title="canEditExtra(extra) ? 'Eliminar' : 'Solo eliminable durante la ventana de captura correspondiente'"
                    @click="requestRemoveExtra(extra)"
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

    <ExtraModal
      :show="modalOpen"
      :is-editing="!!editingExtraId"
      :saving="saving"
      :is-admin="authStore.isAdmin"
      :form="form"
      v-model:teacher-search-text="teacherSearchText"
      :teacher-picker-open="teacherPickerOpen"
      :filtered-teacher-options="filteredTeacherOptions"
      :coordinations="coordinations"
      :cycles="cycles"
      :active-cycle="activeCycle"
      :tabulators="tabulators"
      :selected-teacher="selectedTeacher"
      :projection="projection"
      :overall-load-class="overallLoadClass"
      :form-error="formError"
      @close="closeModal"
      @save="saveExtra"
      @focus-teacher-search="teacherPickerOpen = true"
      @input-teacher-search="onTeacherSearchInput"
      @escape-teacher-search="teacherPickerOpen = false"
      @select-teacher="selectTeacher"
      @apply-tabulator="applyTabulator"
    />

    <ConfirmModal
      :show="!!pendingDeleteExtra"
      eyebrow="Capturar extras"
      title="Eliminar hora extra"
      :subject="pendingDeleteExtra?.teacherName"
      message="Este registro dejará de sumarse a la carga y al cálculo de nómina del ciclo activo. Confirma que se trata de una captura incorrecta antes de continuar."
      :details="pendingDeleteExtra ? [
        `${formatHours(pendingDeleteExtra.hours)} h / ${moneyLabel(pendingDeleteExtra.totalAmount)}`,
        pendingDeleteExtra.reason,
        `Fecha: ${formatDate(pendingDeleteExtra.activityDate)}`
      ] : []"
      confirm-label="Eliminar extra"
      cancel-label="Conservar extra"
      tone="danger"
      icon="trash"
      :loading="deletingExtra"
      @close="closeDeleteExtraModal"
      @confirm="confirmRemoveExtra"
    />
  </div>
</template>
