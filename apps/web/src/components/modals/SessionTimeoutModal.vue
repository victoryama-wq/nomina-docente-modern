<script setup lang="ts">
import { Clock, LogOut, ShieldCheck } from 'lucide-vue-next';

defineProps<{
  show: boolean;
  remainingLabel: string;
}>();

defineEmits<{
  (e: 'continue'): void;
  (e: 'logout'): void;
}>();
</script>

<template>
  <div v-if="show" class="modal-backdrop session-timeout-backdrop">
    <section class="modal-card session-timeout-card" role="dialog" aria-modal="true" aria-labelledby="session-timeout-title">
      <div class="session-timeout-icon">
        <Clock :size="28" />
      </div>

      <div class="session-timeout-body">
        <p class="eyebrow">Seguridad de sesion</p>
        <h3 id="session-timeout-title">Sesion por expirar</h3>
        <p>
          Tu sesion se cerrara por inactividad en 5 minutos.
        </p>
        <p>
          Guarda tus cambios antes de que termine el tiempo. Los datos no guardados se perderan.
        </p>
        <strong class="session-timeout-countdown">Tiempo restante: {{ remainingLabel }}</strong>
      </div>

      <div class="modal-actions">
        <button class="secondary-action" type="button" @click="$emit('logout')">
          <LogOut :size="17" />
          Cerrar sesion
        </button>
        <button class="primary-inline" type="button" @click="$emit('continue')">
          <ShieldCheck :size="17" />
          Continuar sesion
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.session-timeout-backdrop {
  z-index: 80;
}

.session-timeout-card {
  max-width: 430px;
  text-align: center;
}

.session-timeout-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: #0f766e;
  background: #ccfbf1;
}

.session-timeout-body {
  display: grid;
  gap: 10px;
}

.session-timeout-body h3 {
  margin: 0;
  font-size: 1.5rem;
}

.session-timeout-body p {
  margin: 0;
  color: #475569;
}

.session-timeout-countdown {
  display: inline-flex;
  justify-content: center;
  margin-top: 4px;
  color: #0f172a;
}

.modal-actions {
  justify-content: center;
}
</style>
