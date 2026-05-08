<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ShieldCheck, Loader2, LockKeyhole } from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();

async function handleLogin() {
  try {
    await authStore.login();
    router.push({ name: 'dashboard' });
  } catch (err) {
    // Error is handled and stored in authStore.error
  }
}
</script>

<template>
  <section class="login-page">
    <div class="login-panel">
      <div class="brand-mark">
        <ShieldCheck :size="34" />
      </div>
      <div>
        <p class="eyebrow">Tec Playacar</p>
        <h1>Nómina Docente</h1>
        <p class="login-copy">
          Acceso institucional para administrar docentes, roles, operación académica y control financiero.
        </p>
      </div>

      <button class="primary-action" type="button" :disabled="authStore.signingIn" @click="handleLogin">
        <Loader2 v-if="authStore.signingIn" class="spin" :size="18" />
        <LockKeyhole v-else :size="18" />
        Ingresar con Google institucional
      </button>

      <p class="policy-note">Solo correos autorizados de @tecplayacar.edu.mx pueden acceder.</p>

      <div v-if="authStore.error" class="error-box">{{ authStore.error }}</div>
    </div>
  </section>
</template>
