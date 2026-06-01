<script setup lang="ts">
import { X, AlertTriangle, Loader2, Save, Search } from 'lucide-vue-next';
import type {
  SchedulePayload,
  ScheduleTeacher,
  CycleOption,
  CoordinationOption,
  SubjectOption,
  TabulatorOption
} from '../../api';
import { moneyLabel } from '../../utils/format';

defineProps<{
  show: boolean;
  isEditing: boolean;
  saving: boolean;
  isAdmin: boolean;
  form: SchedulePayload;
  teacherSearchText: string;
  teacherPickerOpen: boolean;
  filteredTeacherOptions: ScheduleTeacher[];
  coordinations: CoordinationOption[];
  currentCoordinatorName: string;
  cycles: CycleOption[];
  activeCycle: CycleOption | null;
  subjects: SubjectOption[];
  tabulators: TabulatorOption[];
  selectedTeacher: ScheduleTeacher | null;
  projection: any;
  overallLoadClass: string;
  formError: string;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'save'): void;
  (e: 'update:teacherSearchText', value: string): void;
  (e: 'focusTeacherSearch'): void;
  (e: 'inputTeacherSearch'): void;
  (e: 'escapeTeacherSearch'): void;
  (e: 'selectTeacher', teacher: ScheduleTeacher): void;
  (e: 'applyTabulator'): void;
}>();

function formatHours(value: number | string | null | undefined) {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function categoryLimitLabel(category: string) {
  if (category === 'V') return 'VIP 35 h';
  if (category === 'M') return 'Medio tiempo 25 h';
  return 'Nuevo ingreso 15 h';
}

function loadLevelClass(value: number, maxHours: number) {
  if (!maxHours) return 'ok';
  if (value > maxHours) return 'danger';
  if (value >= maxHours) return 'limit';
  if (value >= maxHours * 0.8) return 'warning';
  return 'ok';
}

function remainingHoursLabel(value: number, maxHours: number) {
  const remaining = maxHours - value;
  if (remaining < 0) return `Excede ${formatHours(Math.abs(remaining))} h`;
  if (remaining === 0) return 'Al tope';
  return `Faltan ${formatHours(remaining)} h`;
}
</script>

<template>
  <div v-if="show" class="modal-backdrop" @click.self="$emit('close')">
    <form class="modal-card large" @submit.prevent="$emit('save')">
      <div class="modal-header">
        <div>
          <p class="eyebrow">{{ isEditing ? 'Edicion' : 'Alta' }}</p>
          <h3>{{ isEditing ? 'Actualizar horario' : 'Nuevo horario' }}</h3>
        </div>
        <button class="icon-button" type="button" title="Cerrar" @click="$emit('close')">
          <X :size="17" />
        </button>
      </div>

      <div class="form-grid">
        <label class="span-2 teacher-picker-field">
          <span>Docente activo</span>
          <div class="combo-box">
            <Search :size="17" />
            <input
              :value="teacherSearchText"
              @input="$emit('update:teacherSearchText', ($event.target as HTMLInputElement).value); $emit('inputTeacherSearch')"
              autocomplete="off"
              placeholder="Buscar por nombre, categoria o responsable"
              required
              @focus="$emit('focusTeacherSearch')"
              @keydown.escape="$emit('escapeTeacherSearch')"
            />
            <div v-if="teacherPickerOpen" class="combo-list">
              <button
                v-for="teacher in filteredTeacherOptions"
                :key="teacher.id"
                type="button"
                @mousedown.prevent="$emit('selectTeacher', teacher)"
              >
                <strong>{{ teacher.fullName }}</strong>
                <span>{{ categoryLimitLabel(teacher.category) }} / {{ teacher.coordinationName || 'Sin responsable' }}</span>
              </button>
              <p v-if="!filteredTeacherOptions.length">Sin coincidencias.</p>
            </div>
          </div>
        </label>
        <label>
          <span>Responsable operativo</span>
          <select v-if="isAdmin" v-model="form.coordinationId" required>
            <option :value="null" disabled>Selecciona responsable operativo</option>
            <option v-for="coordination in coordinations" :key="coordination.id" :value="coordination.id">
              {{ coordination.name }}
            </option>
          </select>
          <input v-else :value="currentCoordinatorName" disabled />
        </label>
        <label>
          <span>Ciclo</span>
          <select v-model="form.cycleId" disabled>
            <option v-for="cycle in cycles" :key="cycle.id" :value="cycle.id">
              {{ cycle.periodLabel }} - {{ cycle.quarterCode }}
            </option>
          </select>
        </label>
        <label>
          <span>Asignatura</span>
          <input v-model.trim="form.subjectName" list="schedule-subjects" required />
          <datalist id="schedule-subjects">
            <option v-for="subject in subjects" :key="subject.id" :value="subject.name" />
          </datalist>
        </label>
        <label>
          <span>Grupo</span>
          <input v-model.trim="form.groupCode" required />
        </label>
        <label>
          <span>Tabulador</span>
          <select v-model="form.tabulatorId" required @change="$emit('applyTabulator')">
            <option disabled value="">Selecciona tabulador</option>
            <option v-for="tabulator in tabulators" :key="tabulator.id" :value="tabulator.id">
              {{ tabulator.name }} - {{ moneyLabel(tabulator.amount) }}
            </option>
          </select>
        </label>
        <label>
          <span>Monto</span>
          <input :value="moneyLabel(form.tabulatorAmount)" disabled />
        </label>
        <label>
          <span>Lunes</span>
          <input v-model.number="form.hoursL" type="number" min="0" step="0.25" />
        </label>
        <label>
          <span>Martes</span>
          <input v-model.number="form.hoursM" type="number" min="0" step="0.25" />
        </label>
        <label>
          <span>Miercoles</span>
          <input v-model.number="form.hoursX" type="number" min="0" step="0.25" />
        </label>
        <label>
          <span>Jueves</span>
          <input v-model.number="form.hoursJ" type="number" min="0" step="0.25" />
        </label>
        <label>
          <span>Viernes</span>
          <input v-model.number="form.hoursV" type="number" min="0" step="0.25" />
        </label>
        <label>
          <span>S1</span>
          <input v-model.number="form.hoursS1" type="number" min="0" step="0.25" />
        </label>
        <label>
          <span>S2</span>
          <input v-model.number="form.hoursS2" type="number" min="0" step="0.25" />
        </label>
      </div>

      <div v-if="selectedTeacher" class="schedule-load-strip" :class="overallLoadClass">
        <div>
          <strong>{{ selectedTeacher.fullName }}</strong>
          <span>{{ categoryLimitLabel(selectedTeacher.category) }}</span>
        </div>
        <span class="load-card" :class="loadLevelClass(projection.weekFinal, projection.maxHours)">
          <strong>Semana</strong>
          <b>{{ formatHours(projection.weekFinal) }} / {{ formatHours(projection.maxHours) }} h</b>
          <small>{{ remainingHoursLabel(projection.weekFinal, projection.maxHours) }}</small>
        </span>
        <span class="load-card" :class="loadLevelClass(projection.mod1Final, projection.maxHours)">
          <strong>Mod 1</strong>
          <b>{{ formatHours(projection.mod1Final) }} / {{ formatHours(projection.maxHours) }} h</b>
          <small>{{ remainingHoursLabel(projection.mod1Final, projection.maxHours) }}</small>
        </span>
        <span class="load-card" :class="loadLevelClass(projection.mod2Final, projection.maxHours)">
          <strong>Mod 2</strong>
          <b>{{ formatHours(projection.mod2Final) }} / {{ formatHours(projection.maxHours) }} h</b>
          <small>{{ remainingHoursLabel(projection.mod2Final, projection.maxHours) }}</small>
        </span>
        <AlertTriangle v-if="projection.exceeds" :size="18" />
      </div>

      <div v-if="formError" class="error-box wide">{{ formError }}</div>

      <div class="modal-actions">
        <button class="secondary-action" type="button" @click="$emit('close')">Cancelar</button>
        <button class="primary-inline" type="submit" :disabled="saving || !selectedTeacher">
          <Loader2 v-if="saving" class="spin" :size="18" />
          <Save v-else :size="18" />
          {{ isEditing ? 'Guardar cambios' : 'Guardar horario' }}
        </button>
      </div>
    </form>
  </div>
</template>
