<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { RefreshCw, UserPlus, Search, FolderLock, Mail, Edit3, Trash2 } from 'lucide-vue-next';
import {
  fetchAccessUsers,
  createAccessUser,
  updateAccessUser,
  deleteAccessUser,
  type AccessUser,
  type AccessSummary,
  type CoordinationOption,
  type RoleOption,
  type UserPayload
} from '../api';
import AccessModal from '../components/modals/AccessModal.vue';
import ConfirmModal from '../components/modals/ConfirmModal.vue';

const authStore = useAuthStore();

const accessUsers = ref<AccessUser[]>([]);
const accessRoles = ref<RoleOption[]>([]);
const accessCoordinations = ref<CoordinationOption[]>([]);
const accessSummary = ref<AccessSummary>({ total: 0, active: 0, inactive: 0, admins: 0 });
const accessSearch = ref('');
const accessStatusFilter = ref<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS');
const pageBusy = ref(false);
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

// Modal state
const accessModalOpen = ref(false);
const accessSaving = ref(false);
const editingAccessId = ref<string | null>(null);
const pendingDeleteAccessUser = ref<AccessUser | null>(null);
const deletingAccessUser = ref(false);

const blankAccessUser = (): UserPayload => ({
  email: '',
  displayName: '',
  roleCode: 'coordinador',
  status: 'ACTIVO',
  notes: '',
  legacyUsername: '',
  coordinationIds: []
});

const accessForm = ref<UserPayload>(blankAccessUser());

const filteredAccessUsers = computed(() => {
  const text = accessSearch.value.toLowerCase().trim();
  return accessUsers.value.filter((user) => {
    const matchesStatus = accessStatusFilter.value === 'TODOS' || user.status === accessStatusFilter.value;
    const haystack = [
      user.displayName,
      user.email,
      user.roleName,
      user.role,
      user.notes,
      user.legacyUsername,
      user.coordinations.map((coordination) => coordination.name).join(' ')
    ]
      .join(' ')
      .toLowerCase();
    return matchesStatus && (!text || haystack.includes(text));
  });
});

function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
  setTimeout(() => clearNotice(), 3000);
}

function clearNotice() {
  notice.value = null;
}

async function loadAccessUsers() {
  pageBusy.value = true;
  clearNotice();
  try {
    const data = await fetchAccessUsers();
    accessUsers.value = data.users;
    accessRoles.value = data.roles;
    accessCoordinations.value = data.coordinations;
    accessSummary.value = data.summary;
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar usuarios.');
  } finally {
    pageBusy.value = false;
  }
}

function newAccessUser() {
  editingAccessId.value = null;
  accessForm.value = blankAccessUser();
  accessModalOpen.value = true;
  clearNotice();
}

function closeAccessModal() {
  accessModalOpen.value = false;
  editingAccessId.value = null;
  accessForm.value = blankAccessUser();
}

function editAccessUser(user: AccessUser) {
  editingAccessId.value = user.id;
  accessForm.value = {
    email: user.email,
    displayName: user.displayName,
    roleCode: user.role,
    status: user.status,
    notes: user.notes,
    legacyUsername: user.legacyUsername,
    coordinationIds: user.coordinations.map((coordination) => coordination.id)
  };
  accessModalOpen.value = true;
  clearNotice();
}

async function saveAccessUser() {
  if (!authStore.canManageAccess) return;
  accessSaving.value = true;
  clearNotice();
  try {
    const response = editingAccessId.value
      ? await updateAccessUser(editingAccessId.value, accessForm.value)
      : await createAccessUser(accessForm.value);
    setNotice('ok', response.message);
    closeAccessModal();
    await loadAccessUsers();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar el usuario.');
  } finally {
    accessSaving.value = false;
  }
}

function requestRemoveAccessUser(user: AccessUser) {
  if (!authStore.canManageAccess || user.isProtectedSuperAdmin) return;
  pendingDeleteAccessUser.value = user;
  clearNotice();
}

function closeDeleteAccessModal() {
  if (deletingAccessUser.value) return;
  pendingDeleteAccessUser.value = null;
}

async function confirmRemoveAccessUser() {
  const user = pendingDeleteAccessUser.value;
  if (!user || !authStore.canManageAccess || user.isProtectedSuperAdmin) return;

  deletingAccessUser.value = true;
  clearNotice();
  try {
    const response = await deleteAccessUser(user.id);
    pendingDeleteAccessUser.value = null;
    setNotice('ok', response.message);
    if (editingAccessId.value === user.id) closeAccessModal();
    await loadAccessUsers();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible eliminar el usuario.');
  } finally {
    deletingAccessUser.value = false;
  }
}

onMounted(() => {
  if (authStore.canManageAccess) {
    loadAccessUsers();
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
        <p class="eyebrow">Usuarios y roles</p>
        <h3>Accesos autorizados</h3>
      </div>
      <div class="toolbar-actions">
        <button class="secondary-action" type="button" @click="loadAccessUsers">
          <RefreshCw :size="17" :class="{ spin: pageBusy }" />
          Actualizar
        </button>
        <button class="primary-inline" type="button" @click="newAccessUser">
          <UserPlus :size="17" />
          Nuevo acceso
        </button>
      </div>
    </section>

    <section class="metric-grid compact">
      <article class="metric-card mini"><p>Total</p><strong>{{ accessSummary.total }}</strong></article>
      <article class="metric-card mini"><p>Activos</p><strong>{{ accessSummary.active }}</strong></article>
      <article class="metric-card mini"><p>Inactivos</p><strong>{{ accessSummary.inactive }}</strong></article>
      <article class="metric-card mini"><p>Admins</p><strong>{{ accessSummary.admins }}</strong></article>
    </section>

    <section class="single-grid">
      <div class="data-panel full">
        <div class="filters-row">
          <label class="search-box">
            <Search :size="17" />
            <input v-model="accessSearch" placeholder="Buscar usuario, correo o rol" />
          </label>
          <select v-model="accessStatusFilter">
            <option value="TODOS">Todos</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </select>
        </div>

        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Coordinaciones</th>
                <th>Estatus</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredAccessUsers.length">
                <td colspan="5" class="empty-cell">No hay usuarios con el filtro actual.</td>
              </tr>
              <tr v-for="user in filteredAccessUsers" :key="user.id">
                <td>
                  <strong>{{ user.displayName }}</strong>
                  <span><Mail :size="13" /> {{ user.email }}</span>
                  <span v-if="user.isProtectedSuperAdmin"><FolderLock :size="13" /> Super admin protegido</span>
                </td>
                <td>
                  <span class="badge neutral">{{ user.roleName }}</span>
                  <small>{{ user.legacyUsername || 'Sin usuario legacy' }}</small>
                </td>
                <td>
                  <span v-if="user.coordinations.length" class="inline-list">
                    {{ user.coordinations.map((coordination) => coordination.name).join(', ') }}
                  </span>
                  <small v-else-if="user.role === 'coordinador' && user.status === 'ACTIVO'" class="danger-text">
                    Requiere configuracion
                  </small>
                  <small v-else>Sin coordinacion operativa requerida</small>
                </td>
                <td>
                  <span class="badge" :class="user.status === 'ACTIVO' ? 'ok' : 'muted'">{{ user.status }}</span>
                </td>
                <td class="row-actions">
                  <button class="icon-button" type="button" title="Editar" @click="editAccessUser(user)">
                    <Edit3 :size="16" />
                  </button>
                  <button
                    class="icon-button danger"
                    type="button"
                    title="Eliminar"
                    :disabled="user.isProtectedSuperAdmin"
                    @click="requestRemoveAccessUser(user)"
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

    <AccessModal
      :show="accessModalOpen"
      :is-editing="!!editingAccessId"
      :saving="accessSaving"
      :form="accessForm"
      :roles="accessRoles"
      :coordinations="accessCoordinations"
      @close="closeAccessModal"
      @save="saveAccessUser"
    />

    <ConfirmModal
      :show="!!pendingDeleteAccessUser"
      eyebrow="Usuarios y roles"
      title="Eliminar acceso"
      :subject="pendingDeleteAccessUser?.displayName"
      message="La cuenta dejará de estar autorizada para ingresar a la Web App. El super admin protegido no puede eliminarse desde este flujo."
      :details="pendingDeleteAccessUser ? [
        pendingDeleteAccessUser.email,
        `Rol actual: ${pendingDeleteAccessUser.roleName}`,
        `Estatus: ${pendingDeleteAccessUser.status}`
      ] : []"
      confirm-label="Eliminar acceso"
      cancel-label="Conservar acceso"
      tone="danger"
      icon="trash"
      :loading="deletingAccessUser"
      @close="closeDeleteAccessModal"
      @confirm="confirmRemoveAccessUser"
    />
  </div>
</template>
