<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  RefreshCw, UserPlus, Search, Download, Building2, Mail, CreditCard,
  FileText, Edit3, Trash2, Loader2
} from 'lucide-vue-next';
import {
  fetchTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  uploadTeacherConstancia,
  openTeacherConstancia,
  downloadTeacherExport,
  type Teacher,
  type TeacherSummary,
  type TeacherPayload,
  type CoordinationOption
} from '../api';
import TeacherModal from '../components/modals/TeacherModal.vue';
import ConfirmModal from '../components/modals/ConfirmModal.vue';

const authStore = useAuthStore();

const teachers = ref<Teacher[]>([]);
const teacherSummary = ref<TeacherSummary>({
  total: 0,
  active: 0,
  inactive: 0,
  withRfc: 0,
  withBank: 0,
  withConstancia: 0,
  fiscalReady: 0
});
const coordinations = ref<CoordinationOption[]>([]);
const actorCoordination = ref<CoordinationOption | null>(null);
const teacherSearch = ref('');
const teacherStatusFilter = ref<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS');
const onlyEditableTeachers = ref(false);
const pageBusy = ref(false);
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

// Modal state
const teacherModalOpen = ref(false);
const teacherSaving = ref(false);
const teacherUploading = ref(false);
const teacherExporting = ref<'active' | 'history' | ''>('');
const editingTeacherId = ref<string | null>(null);
const selectedConstancia = ref<File | null>(null);
const pendingDeleteTeacher = ref<Teacher | null>(null);
const deletingTeacher = ref(false);

const blankTeacher = (): TeacherPayload => ({
  firstNames: '',
  paternalLastName: '',
  maternalLastName: '',
  degree: 'Licenciatura',
  paymentType: '1',
  category: 'N',
  location: 'Local',
  comment: 'Docente activo',
  observation: '',
  coordinationName: '',
  phone: '',
  email: '',
  rfc: '',
  externalIdentifier: '',
  bankDetail: '',
  status: 'ACTIVO'
});

const teacherForm = ref<TeacherPayload>(blankTeacher());

const filteredTeachers = computed(() => {
  const text = teacherSearch.value.toLowerCase().trim();
  return teachers.value.filter((teacher) => {
    const matchesStatus = teacherStatusFilter.value === 'TODOS' || teacher.status === teacherStatusFilter.value;
    const matchesEditable = !onlyEditableTeachers.value || canEditTeacher(teacher);
    const haystack = [
      teacher.fullName,
      teacher.rfc,
      teacher.email,
      teacher.phone,
      teacher.externalIdentifier,
      teacher.bankDetail,
      teacher.coordinationName,
      teacher.documentName
    ]
      .join(' ')
      .toLowerCase();
    return matchesStatus && matchesEditable && (!text || haystack.includes(text));
  });
});

function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
  setTimeout(() => clearNotice(), 3000);
}

function clearNotice() {
  notice.value = null;
}

function paymentLabel(value: string) {
  if (value === 'E') return 'Efectivo';
  if (value === '1') return 'Santander';
  if (value === '2') return 'Banorte';
  return 'Sin definir';
}

function fiscalPercent(teacher: Teacher) {
  const checks = [teacher.rfc, teacher.bankDetail, teacher.email, teacher.phone, teacher.externalIdentifier, teacher.documentId];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function canEditTeacher(teacher: Teacher) {
  if (authStore.isAdmin) return true;
  return !!actorCoordination.value?.id && teacher.coordinationId === actorCoordination.value.id;
}

function canAccessTeacherDocument(teacher: Teacher) {
  if (authStore.isAdmin || authStore.session?.permissions?.includes('finance.view')) return true;
  return canEditTeacher(teacher);
}

async function loadTeachers() {
  pageBusy.value = true;
  clearNotice();
  try {
    const data = await fetchTeachers();
    teachers.value = data.teachers;
    teacherSummary.value = data.summary;
    coordinations.value = data.coordinations;
    actorCoordination.value = data.actorCoordination;
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar docentes.');
  } finally {
    pageBusy.value = false;
  }
}

function newTeacher() {
  if (!authStore.isAdmin && !actorCoordination.value) {
    setNotice('error', 'Tu usuario no tiene una coordinación vinculada para capturar docentes.');
    return;
  }
  editingTeacherId.value = null;
  teacherForm.value = {
    ...blankTeacher(),
    coordinationName: authStore.isAdmin ? '' : actorCoordination.value?.name || ''
  };
  selectedConstancia.value = null;
  teacherModalOpen.value = true;
  clearNotice();
}

function closeTeacherModal() {
  teacherModalOpen.value = false;
  editingTeacherId.value = null;
  teacherForm.value = blankTeacher();
  selectedConstancia.value = null;
}

function editTeacher(teacher: Teacher) {
  if (!canEditTeacher(teacher)) {
    setNotice('error', 'Solo la coordinación responsable puede editar este docente.');
    return;
  }
  editingTeacherId.value = teacher.id;
  teacherForm.value = {
    firstNames: teacher.firstNames,
    paternalLastName: teacher.paternalLastName,
    maternalLastName: teacher.maternalLastName,
    degree: teacher.degree || 'Licenciatura',
    paymentType: teacher.paymentType === 'E' || teacher.paymentType === '1' || teacher.paymentType === '2' ? teacher.paymentType : '1',
    category: teacher.category === 'V' || teacher.category === 'M' || teacher.category === 'N' ? teacher.category : 'N',
    location: teacher.location || 'Local',
    comment: teacher.comment,
    observation: teacher.observation,
    coordinationName: teacher.coordinationName,
    phone: teacher.phone,
    email: teacher.email,
    rfc: teacher.rfc,
    externalIdentifier: teacher.externalIdentifier,
    bankDetail: teacher.bankDetail,
    status: teacher.status,
    legacyTeacherId: teacher.legacyTeacherId
  };
  selectedConstancia.value = null;
  teacherModalOpen.value = true;
  clearNotice();
}

async function saveTeacher() {
  if (!authStore.canManageTeachers) return;
  teacherSaving.value = true;
  clearNotice();
  try {
    if (!authStore.isAdmin && actorCoordination.value) {
      teacherForm.value.coordinationName = actorCoordination.value.name;
    }
    const response = editingTeacherId.value
      ? await updateTeacher(editingTeacherId.value, teacherForm.value)
      : await createTeacher(teacherForm.value);
    setNotice('ok', response.message);
    closeTeacherModal();
    await loadTeachers();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar el docente.');
  } finally {
    teacherSaving.value = false;
  }
}

function onConstanciaSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedConstancia.value = input.files?.[0] || null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result?.toString() || '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('No fue posible leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

async function uploadConstancia() {
  if (!editingTeacherId.value || !selectedConstancia.value) return;
  teacherUploading.value = true;
  clearNotice();
  try {
    const file = selectedConstancia.value;
    const base64Data = await readFileAsBase64(file);
    const response = await uploadTeacherConstancia(editingTeacherId.value, {
      fileName: file.name,
      mimeType: file.type,
      base64Data
    });
    setNotice('ok', response.message);
    editTeacher(response.teacher);
    await loadTeachers();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar la constancia.');
  } finally {
    teacherUploading.value = false;
  }
}

async function openConstancia(teacher: Teacher) {
  try {
    await openTeacherConstancia(teacher.id);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible abrir la constancia.');
  }
}

async function exportTeachers(kind: 'active' | 'history') {
  teacherExporting.value = kind;
  clearNotice();
  try {
    await downloadTeacherExport(kind);
    setNotice('ok', kind === 'active' ? 'Exportación de docentes activos generada.' : 'Exportación completa con historial generada.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible exportar docentes.');
  } finally {
    teacherExporting.value = '';
  }
}

function requestRemoveTeacher(teacher: Teacher) {
  if (!authStore.isAdmin) return;
  pendingDeleteTeacher.value = teacher;
  clearNotice();
}

function closeDeleteTeacherModal() {
  if (deletingTeacher.value) return;
  pendingDeleteTeacher.value = null;
}

async function confirmRemoveTeacher() {
  const teacher = pendingDeleteTeacher.value;
  if (!teacher || !authStore.isAdmin) return;

  deletingTeacher.value = true;
  clearNotice();
  try {
    const response = await deleteTeacher(teacher.id);
    pendingDeleteTeacher.value = null;
    setNotice('ok', response.message);
    if (editingTeacherId.value === teacher.id) closeTeacherModal();
    await loadTeachers();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible eliminar el docente.');
  } finally {
    deletingTeacher.value = false;
  }
}

onMounted(() => {
  if (authStore.canViewTeachers) {
    loadTeachers();
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
        <p class="eyebrow">Directorio Docente</p>
        <h3>Expedientes y estatus operativo</h3>
      </div>
      <div class="toolbar-actions">
        <button class="secondary-action" type="button" @click="loadTeachers">
          <RefreshCw :size="17" :class="{ spin: pageBusy }" />
          Actualizar
        </button>
        <button v-if="authStore.canManageTeachers" class="primary-inline" type="button" @click="newTeacher">
          <UserPlus :size="17" />
          Nuevo docente
        </button>
      </div>
    </section>

    <section class="metric-grid compact">
      <article class="metric-card mini"><p>Total</p><strong>{{ teacherSummary.total }}</strong></article>
      <article class="metric-card mini"><p>Activos</p><strong>{{ teacherSummary.active }}</strong></article>
      <article class="metric-card mini"><p>Con RFC</p><strong>{{ teacherSummary.withRfc }}</strong></article>
      <article class="metric-card mini"><p>Expediente fiscal</p><strong>{{ teacherSummary.fiscalReady }}</strong></article>
    </section>

    <section class="single-grid">
      <div class="data-panel full">
        <div class="filters-row with-actions">
          <label class="search-box">
            <Search :size="17" />
            <input v-model="teacherSearch" placeholder="Buscar docente, RFC, correo o coordinación" />
          </label>
          <select v-model="teacherStatusFilter">
            <option value="TODOS">Todos</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </select>
          <div class="export-actions">
            <label v-if="!authStore.isAdmin" class="toggle-filter">
              <input v-model="onlyEditableTeachers" type="checkbox" />
              Solo editables por mí
            </label>
            <button class="secondary-action" type="button" :disabled="teacherExporting === 'active'" @click="exportTeachers('active')">
              <Loader2 v-if="teacherExporting === 'active'" class="spin" :size="16" />
              <Download v-else :size="16" />
              Exportar activos
            </button>
            <button
              v-if="authStore.canExportTeacherHistory"
              class="secondary-action"
              type="button"
              :disabled="teacherExporting === 'history'"
              @click="exportTeachers('history')"
            >
              <Loader2 v-if="teacherExporting === 'history'" class="spin" :size="16" />
              <Download v-else :size="16" />
              Todo + historial
            </button>
          </div>
        </div>

        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Docente</th>
                <th>Fiscal</th>
                <th>Pago</th>
                <th>Estatus</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredTeachers.length">
                <td colspan="5" class="empty-cell">No hay docentes con el filtro actual.</td>
              </tr>
              <tr v-for="teacher in filteredTeachers" :key="teacher.id">
                <td>
                  <strong>{{ teacher.fullName }}</strong>
                  <span><Building2 :size="13" /> {{ teacher.coordinationName || 'Sin coordinación' }}</span>
                  <span><Mail :size="13" /> {{ teacher.email || 'Sin correo' }}</span>
                </td>
                <td>
                  <div class="progress-line">
                    <span :style="{ width: fiscalPercent(teacher) + '%' }"></span>
                  </div>
                  <small>{{ fiscalPercent(teacher) }}% completo</small>
                </td>
                <td>
                  <span class="badge neutral"><CreditCard :size="13" /> {{ paymentLabel(teacher.paymentType) }}</span>
                  <small>Categoría {{ teacher.category || '-' }}</small>
                </td>
                <td>
                  <span class="badge" :class="teacher.status === 'ACTIVO' ? 'ok' : 'muted'">{{ teacher.status }}</span>
                </td>
                <td class="row-actions">
                  <button
                    v-if="teacher.documentId"
                    class="icon-button"
                    type="button"
                    :disabled="!canAccessTeacherDocument(teacher)"
                    :title="canAccessTeacherDocument(teacher) ? 'Abrir constancia' : 'Constancia restringida a la coordinación responsable'"
                    @click="openConstancia(teacher)"
                  >
                    <FileText :size="16" />
                  </button>
                  <button
                    v-if="authStore.canManageTeachers"
                    class="icon-button"
                    type="button"
                    :disabled="!canEditTeacher(teacher)"
                    :title="canEditTeacher(teacher) ? 'Editar' : 'Solo editable por la coordinación responsable'"
                    @click="editTeacher(teacher)"
                  >
                    <Edit3 :size="16" />
                  </button>
                  <button v-if="authStore.isAdmin" class="icon-button danger" type="button" title="Eliminar" @click="requestRemoveTeacher(teacher)">
                    <Trash2 :size="16" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <TeacherModal
      :show="teacherModalOpen"
      :is-editing="!!editingTeacherId"
      :saving="teacherSaving"
      :uploading="teacherUploading"
      :form="teacherForm"
      :coordinations="coordinations"
      :can-choose-coordination="authStore.isAdmin"
      :current-coordinator-name="actorCoordination?.name || ''"
      :selected-constancia="selectedConstancia"
      @close="closeTeacherModal"
      @save="saveTeacher"
      @file-selected="onConstanciaSelected"
      @upload="uploadConstancia"
    />

    <ConfirmModal
      :show="!!pendingDeleteTeacher"
      eyebrow="Directorio docente"
      title="Eliminar docente"
      :subject="pendingDeleteTeacher?.fullName"
      message="Se intentará retirar este registro del directorio. Si el docente ya tiene horarios, incidencias, extras o historial operativo, la base de datos protegerá la información y no permitirá eliminarlo."
      :details="[
        'Acción exclusiva para administradores.',
        'El cambio queda sujeto a las reglas de integridad del sistema.'
      ]"
      confirm-label="Eliminar docente"
      cancel-label="Conservar registro"
      tone="danger"
      icon="trash"
      :loading="deletingTeacher"
      @close="closeDeleteTeacherModal"
      @confirm="confirmRemoveTeacher"
    />
  </div>
</template>
