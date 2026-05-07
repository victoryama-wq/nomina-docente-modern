<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle, Info, Loader2, Save, Trash2, X } from 'lucide-vue-next';

type ConfirmTone = 'danger' | 'warning' | 'primary';
type ConfirmIcon = 'trash' | 'save' | 'warning' | 'info';

const props = withDefaults(
  defineProps<{
    show: boolean;
    eyebrow?: string;
    title: string;
    subject?: string;
    message: string;
    details?: string[];
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
    icon?: ConfirmIcon;
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    eyebrow: 'Confirmacion',
    subject: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    tone: 'primary',
    icon: 'info',
    loading: false,
    disabled: false,
    details: () => []
  }
);

defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();

const iconComponent = computed(() => {
  if (props.loading) return Loader2;
  if (props.icon === 'trash') return Trash2;
  if (props.icon === 'save') return Save;
  if (props.icon === 'warning') return AlertTriangle;
  return Info;
});
</script>

<template>
  <div v-if="show" class="modal-backdrop confirmation-backdrop" @click.self="!loading && $emit('close')">
    <section class="modal-card confirmation-card" :class="`confirmation-${tone}`" role="dialog" aria-modal="true">
      <div class="confirmation-topline">
        <div class="confirmation-icon">
          <component :is="iconComponent" :size="23" :class="{ spin: loading }" />
        </div>
        <button class="icon-button" type="button" title="Cerrar" :disabled="loading" @click="$emit('close')">
          <X :size="17" />
        </button>
      </div>

      <div class="confirmation-body">
        <p class="eyebrow">{{ eyebrow }}</p>
        <h3>{{ title }}</h3>
        <strong v-if="subject" class="confirmation-subject">{{ subject }}</strong>
        <p class="confirmation-copy">{{ message }}</p>
        <ul v-if="details.length" class="confirmation-details">
          <li v-for="detail in details" :key="detail">{{ detail }}</li>
        </ul>
      </div>

      <div class="modal-actions">
        <button class="secondary-action" type="button" :disabled="loading" @click="$emit('close')">
          {{ cancelLabel }}
        </button>
        <button
          class="primary-inline"
          :class="{ 'danger-action': tone === 'danger', 'warning-action': tone === 'warning' }"
          type="button"
          :disabled="loading || disabled"
          @click="$emit('confirm')"
        >
          <component :is="iconComponent" :size="17" :class="{ spin: loading }" />
          {{ confirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>
