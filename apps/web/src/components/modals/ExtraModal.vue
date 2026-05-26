<script setup lang="ts">
import { X, AlertTriangle, Loader2, Save, Search } from 'lucide-vue-next';
import type { CoordinationOption, CycleOption, ExtraPayload, ExtraTeacher, TabulatorOption } from '../../api';
import { moneyLabel } from '../../utils/format';

defineProps<{
  show: boolean;
  isEditing: boolean;
  saving: boolean;
  isAdmin: boolean;
  form: ExtraPayload;
  teacherSearchText: string;
  teacherPickerOpen: boolean;
  filteredTeacherOptions: ExtraTeacher[];
  coordinations: CoordinationOption[];
  currentCoordinatorName: string;
  cycles: CycleOption[];
  activeCycle: CycleOption | null;
  tabulators: TabulatorOption[];
  selectedTeacher: ExtraTeacher | null;
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
  (e: 'selectTeacher', teacher: ExtraTeacher): void;
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
          <h3>{{ isEditing ? 'Actualizar extra' : 'Nuevo extra' }}</h3>
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
              autocomplete="off"
              placeholder="Buscar por nombre, categoria o responsable"
              required
              @focus="$emit('focusTeacherSearch')"
              @input="$emit('update:teacherSearchText', ($event.target as HTMLInputElement).value); $emit('inputTeacherSearch')"
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
          <select v-if="isAdmin" v-model="form.coordinationId">
            <option value="" disabled>Selecciona responsable/ambito</option>
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
          <span>Fecha actividad</span>
          <input v-model="form.activityDate" type="date" />
        </label>
        <label>
          <span>Horas extra</span>
          <input v-model.number="form.hours" type="number" min="0.5" step="0.5" required />
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
        <label class="span-2">
          <span>Motivo</span>
          <input v-model.trim="form.reason" maxlength="180" required />
        </label>
        <label>
          <span>Referencia</span>
          <input v-model.trim="form.reference" maxlength="120" />
        </label>
        <label>
          <span>Total</span>
          <input :value="moneyLabel((form.hours || 0) * (form.tabulatorAmount || 0))" disabled />
        </label>
        <label class="span-2">
          <span>Observaciones</span>
          <textarea v-model.trim="form.observations" rows="3" maxlength="250"></textarea>
        </label>
      </div>

      <div v-if="selectedTeacher" class="schedule-load-strip" :class="overallLoadClass">
        <div>
          <strong>{{ selectedTeacher.fullName }}</strong>
          <span>
            {{ categoryLimitLabel(selectedTeacher.category) }} / Inc
            {{ formatHours(selectedTeacher.incidenceExtraHours) }} h / Extras
            {{ formatHours(selectedTeacher.loggedExtraHours) }} h
          </span>
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
        <AlertTriangle v-if="overallLoadClass === 'danger'" :size="18" />
      </div>

      <div v-if="overallLoadClass === 'danger'" class="warning-box wide">
        Advertencia: la carga global rebasa el máximo por categoría considerando horarios, incidencias y extras. El
        registro se puede guardar para que quede evidencia en nómina.
      </div>

      <div v-if="formError" class="error-box wide">{{ formError }}</div>

      <div class="modal-actions">
        <button class="secondary-action" type="button" @click="$emit('close')">Cancelar</button>
        <button class="primary-inline" type="submit" :disabled="saving || !selectedTeacher">
          <Loader2 v-if="saving" class="spin" :size="18" />
          <Save v-else :size="18" />
          {{ isEditing ? 'Guardar cambios' : 'Guardar extra' }}
        </button>
      </div>
    </form>
  </div>
</template>
