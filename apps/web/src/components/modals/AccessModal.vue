<script setup lang="ts">
import { X, Loader2, Save } from 'lucide-vue-next';
import type { UserPayload, RoleOption } from '../../api';

defineProps<{
  show: boolean;
  isEditing: boolean;
  saving: boolean;
  form: UserPayload;
  roles: RoleOption[];
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'save'): void;
}>();
</script>

<template>
  <div v-if="show" class="modal-backdrop" @click.self="$emit('close')">
    <form class="modal-card" @submit.prevent="$emit('save')">
      <div class="modal-header">
        <div>
          <p class="eyebrow">{{ isEditing ? 'Edicion' : 'Alta' }}</p>
          <h3>{{ isEditing ? 'Actualizar acceso' : 'Autorizar usuario' }}</h3>
        </div>
        <button class="icon-button" type="button" title="Cerrar" @click="$emit('close')">
          <X :size="17" />
        </button>
      </div>

      <div class="form-grid one">
        <label>
          <span>Correo institucional</span>
          <input v-model.trim="form.email" type="email" required placeholder="usuario@tecplayacar.edu.mx" />
        </label>
        <label>
          <span>Nombre</span>
          <input v-model.trim="form.displayName" required />
        </label>
        <label>
          <span>Rol</span>
          <select v-model="form.roleCode">
            <option v-for="role in roles" :key="role.id" :value="role.code">{{ role.name }}</option>
          </select>
        </label>
        <label>
          <span>Estatus</span>
          <select v-model="form.status">
            <option value="ACTIVO">ACTIVO</option>
            <option value="INACTIVO">INACTIVO</option>
          </select>
        </label>
        <label>
          <span>Usuario legacy</span>
          <input v-model.trim="form.legacyUsername" />
        </label>
        <label>
          <span>Observacion</span>
          <textarea v-model.trim="form.notes" rows="3"></textarea>
        </label>
      </div>

      <div class="modal-actions">
        <button class="secondary-action" type="button" @click="$emit('close')">Cancelar</button>
        <button class="primary-inline" type="submit" :disabled="saving">
          <Loader2 v-if="saving" class="spin" :size="18" />
          <Save v-else :size="18" />
          {{ isEditing ? 'Guardar cambios' : 'Autorizar acceso' }}
        </button>
      </div>
    </form>
  </div>
</template>
