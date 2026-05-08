<script setup lang="ts">
import { useAuthStore } from './stores/auth';
import { Loader2 } from 'lucide-vue-next';

const authStore = useAuthStore();
authStore.initAuth();
</script>

<template>
  <main v-if="authStore.loading" class="app-shell">
    <section class="center-stage">
      <Loader2 class="spin" :size="34" />
      <p>Preparando Nómina Docente...</p>
    </section>
  </main>
  
  <router-view v-else></router-view>
</template>
