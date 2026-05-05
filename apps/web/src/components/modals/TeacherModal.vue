<script setup lang="ts">
import { X, Upload, Loader2, Save } from 'lucide-vue-next';
import type { TeacherPayload, CoordinationOption } from '../../api';

defineProps<{
  show: boolean;
  isEditing: boolean;
  saving: boolean;
  uploading: boolean;
  form: TeacherPayload;
  coordinations: CoordinationOption[];
  selectedConstancia: File | null;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'save'): void;
  (e: 'fileSelected', event: Event): void;
  (e: 'upload'): void;
}>();
</script>

<template>
  <div v-if="show" class="modal-backdrop" @click.self="$emit('close')">
    <form class="modal-card large" @submit.prevent="$emit('save')">
      <div class="modal-header">
        <div>
          <p class="eyebrow">{{ isEditing ? 'Edicion' : 'Alta' }}</p>
          <h3>{{ isEditing ? 'Actualizar docente' : 'Nuevo docente' }}</h3>
        </div>
        <button class="icon-button" type="button" title="Cerrar" @click="$emit('close')">
          <X :size="17" />
        </button>
      </div>

      <div class="form-grid">
        <label>
          <span>Nombre(s)</span>
          <input v-model.trim="form.firstNames" required />
        </label>
        <label>
          <span>Apellido paterno</span>
          <input v-model.trim="form.paternalLastName" required />
        </label>
        <label>
          <span>Apellido materno</span>
          <input v-model.trim="form.maternalLastName" />
        </label>
        <label>
          <span>Grado</span>
          <input v-model.trim="form.degree" />
        </label>
        <label>
          <span>Tipo de pago</span>
          <select v-model="form.paymentType" required>
            <option value="E">Efectivo</option>
            <option value="1">Santander</option>
            <option value="2">Banorte</option>
          </select>
        </label>
        <label>
          <span>Categoria</span>
          <select v-model="form.category" required>
            <option value="V">V - 35 h</option>
            <option value="M">M - 25 h</option>
            <option value="N">N - 15 h</option>
          </select>
        </label>
        <label>
          <span>Ubicacion</span>
          <input v-model.trim="form.location" />
        </label>
        <label>
          <span>Estatus</span>
          <select v-model="form.status">
            <option value="ACTIVO">ACTIVO</option>
            <option value="INACTIVO">INACTIVO</option>
          </select>
        </label>
        <label>
          <span>Coordinacion</span>
          <input v-model.trim="form.coordinationName" list="coordinations-list" />
          <datalist id="coordinations-list">
            <option v-for="coordination in coordinations" :key="coordination.id" :value="coordination.name" />
          </datalist>
        </label>
        <label>
          <span>Telefono</span>
          <input v-model.trim="form.phone" />
        </label>
        <label>
          <span>Correo</span>
          <input v-model.trim="form.email" type="email" />
        </label>
        <label>
          <span>RFC</span>
          <input v-model.trim="form.rfc" />
        </label>
        <label>
          <span>Identificador</span>
          <input v-model.trim="form.externalIdentifier" />
        </label>
        <label>
          <span>Banco / cuenta</span>
          <input v-model.trim="form.bankDetail" />
        </label>
        <label class="span-2">
          <span>Comentario</span>
          <input v-model.trim="form.comment" />
        </label>
        <label class="span-2">
          <span>Observacion</span>
          <textarea v-model.trim="form.observation" rows="3"></textarea>
        </label>
      </div>

      <div v-if="isEditing" class="upload-box">
        <div>
          <strong>Constancia fiscal</strong>
          <span>{{ selectedConstancia?.name || 'Sin archivo seleccionado' }}</span>
        </div>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" @change="$emit('fileSelected', $event)" />
        <button class="secondary-action" type="button" :disabled="uploading || !selectedConstancia" @click="$emit('upload')">
          <Upload :size="16" />
          {{ uploading ? 'Cargando...' : 'Cargar' }}
        </button>
      </div>

      <div class="modal-actions">
        <button class="secondary-action" type="button" @click="$emit('close')">Cancelar</button>
        <button class="primary-inline" type="submit" :disabled="saving">
          <Loader2 v-if="saving" class="spin" :size="18" />
          <Save v-else :size="18" />
          {{ isEditing ? 'Guardar cambios' : 'Guardar docente' }}
        </button>
      </div>
    </form>
  </div>
</template>
