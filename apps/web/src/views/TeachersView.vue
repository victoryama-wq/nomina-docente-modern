<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  RefreshCw, UserPlus, Search, Download, Building2, Mail, CreditCard,
  FileText, Edit3, Trash2, Loader2, Eye, Phone, IdCard, X
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
import { teacherResponsibleLabel } from '../utils/teacherResponsible';

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
const actorScopeCoordinations = ref<CoordinationOption[]>([]);
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
const selectedTeacherDetail = ref<Teacher | null>(null);
const selectedConstancia = ref<File | null>(null);
const pendingDeleteTeacher = ref<Teacher | null>(null);
const deletingTeacher = ref(false);
const canViewTeacherFiscal = computed(() => authStore.canViewFiscal);
const canManageTeacherFiscal = computed(() => authStore.canManageFiscal);
const canViewTeacherDocuments = computed(() => authStore.canViewFiscalDocuments);
const canManageTeacherDocuments = computed(() => authStore.canManageFiscalDocuments);
const canChooseTeacherCoordination = computed(() => authStore.isAdmin);
const assignableTeacherCoordinations = computed(() =>
  authStore.isAdmin ? coordinations.value : actorScopeCoordinations.value
);

const blankTeacher = (): TeacherPayload => ({
  firstNames: '',
  paternalLastName: '',
  maternalLastName: '',
  degree: 'Licenciatura',
  paymentType: canManageTeacherFiscal.value ? '1' : '',
  category: 'N',
  location: 'Local',
  comment: 'Docente activo',
  observation: '',
  coordinationId: null,
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
      canViewTeacherFiscal.value ? teacher.rfc : '',
      teacher.email,
      teacher.phone,
      teacher.externalIdentifier,
      canViewTeacherFiscal.value ? teacher.bankDetail : '',
      teacher.coordinationName,
      teacher.createdByName,
      teacher.createdByEmail,
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
  if (!canViewTeacherFiscal.value) return 0;
  const checks = [teacher.rfc, teacher.bankDetail, teacher.email, teacher.phone, teacher.externalIdentifier, teacher.documentId];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function canEditTeacher(teacher: Teacher) {
  if (authStore.isAdmin) return true;
  return teacher.createdById === authStore.session?.id;
}

function canAccessTeacherDocument(teacher: Teacher) {
  return canViewTeacherDocuments.value && !!teacher.documentId;
}

function viewTeacher(teacher: Teacher) {
  selectedTeacherDetail.value = teacher;
}

function closeTeacherDetail() {
  selectedTeacherDetail.value = null;
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
    actorScopeCoordinations.value =
      data.actorCoordinations ||
      authStore.session?.actorCoordinations ||
      (data.actorCoordination ? [data.actorCoordination] : []);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar docentes.');
  } finally {
    pageBusy.value = false;
  }
}

function newTeacher() {
  editingTeacherId.value = null;
  teacherForm.value = {
    ...blankTeacher(),
    coordinationId: null,
    coordinationName: authStore.isAdmin ? '' : authStore.session?.displayName || ''
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
    setNotice('error', 'Solo puedes editar docentes capturados por tu usuario.');
    return;
  }
  editingTeacherId.value = teacher.id;
  teacherForm.value = {
    firstNames: teacher.firstNames,
    paternalLastName: teacher.paternalLastName,
    maternalLastName: teacher.maternalLastName,
    degree: teacher.degree || 'Licenciatura',
    paymentType: canManageTeacherFiscal.value && (teacher.paymentType === 'E' || teacher.paymentType === '1' || teacher.paymentType === '2') ? teacher.paymentType : '',
    category: teacher.category === 'V' || teacher.category === 'M' || teacher.category === 'N' ? teacher.category : 'N',
    location: teacher.location || 'Local',
    comment: teacher.comment,
    observation: teacher.observation,
    coordinationId: teacher.coordinationId,
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
    if (!authStore.isAdmin) {
      teacherForm.value.coordinationId = null;
      teacherForm.value.coordinationName = authStore.session?.displayName || '';
    }
    const payload: TeacherPayload = { ...teacherForm.value };
    if (!canManageTeacherFiscal.value) {
      delete payload.paymentType;
      delete payload.email;
      delete payload.rfc;
      delete payload.bankDetail;
    }
    const response = editingTeacherId.value
      ? await updateTeacher(editingTeacherId.value, payload)
      : await createTeacher(payload);
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
  if (!editingTeacherId.value || !selectedConstancia.value || !canManageTeacherDocuments.value) return;
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
  if (!canAccessTeacherDocument(teacher)) return;
  try {
    await openTeacherConstancia(teacher.id);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible abrir la constancia.');
  }
}

async function exportTeachers(kind: 'active' | 'history') {
  if (kind === 'active' && !canViewTeacherFiscal.value) return;
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
      <article v-if="canViewTeacherFiscal" class="metric-card mini"><p>Con RFC</p><strong>{{ teacherSummary.withRfc }}</strong></article>
      <article v-if="canViewTeacherFiscal" class="metric-card mini"><p>Expediente fiscal</p><strong>{{ teacherSummary.fiscalReady }}</strong></article>
    </section>

    <section class="single-grid">
      <div class="data-panel full">
        <div class="filters-row with-actions">
          <label class="search-box">
            <Search :size="17" />
            <input
              v-model="teacherSearch"
              :placeholder="canViewTeacherFiscal ? 'Buscar docente, RFC, correo o coordinacion' : 'Buscar docente, telefono o coordinacion'"
            />
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
            <button
              v-if="canViewTeacherFiscal"
              class="secondary-action"
              type="button"
              :disabled="teacherExporting === 'active'"
              @click="exportTeachers('active')"
            >
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
                <th v-if="canViewTeacherFiscal">Fiscal</th>
                <th v-if="canViewTeacherFiscal">Pago</th>
                <th>Estatus</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredTeachers.length">
                <td :colspan="canViewTeacherFiscal ? 5 : 3" class="empty-cell">No hay docentes con el filtro actual.</td>
              </tr>
              <tr v-for="teacher in filteredTeachers" :key="teacher.id">
                <td>
                  <strong>{{ teacher.fullName }}</strong>
                  <span><Building2 :size="13" /> {{ teacherResponsibleLabel(teacher) }}</span>
                  <span v-if="canViewTeacherFiscal"><Mail :size="13" /> {{ teacher.email || 'Sin correo' }}</span>
                </td>
                <td v-if="canViewTeacherFiscal">
                  <div class="progress-line">
                    <span :style="{ width: fiscalPercent(teacher) + '%' }"></span>
                  </div>
                  <small>{{ fiscalPercent(teacher) }}% completo</small>
                </td>
                <td v-if="canViewTeacherFiscal">
                  <span class="badge neutral"><CreditCard :size="13" /> {{ paymentLabel(teacher.paymentType) }}</span>
                  <small>Categoría {{ teacher.category || '-' }}</small>
                </td>
                <td>
                  <span class="badge" :class="teacher.status === 'ACTIVO' ? 'ok' : 'muted'">{{ teacher.status }}</span>
                </td>
                <td class="row-actions">
                  <button
                    class="icon-button"
                    type="button"
                    title="Ver información"
                    @click="viewTeacher(teacher)"
                  >
                    <Eye :size="16" />
                  </button>
                  <button
                    v-if="teacher.documentId && canViewTeacherDocuments"
                    class="icon-button"
                    type="button"
                    :disabled="!canAccessTeacherDocument(teacher)"
                    :title="canAccessTeacherDocument(teacher) ? 'Abrir constancia' : 'Constancia fiscal restringida'"
                    @click="openConstancia(teacher)"
                  >
                    <FileText :size="16" />
                  </button>
                  <button
                    v-if="authStore.canManageTeachers"
                    class="icon-button"
                    type="button"
                    :disabled="!canEditTeacher(teacher)"
                    :title="canEditTeacher(teacher) ? 'Editar' : 'Solo editable por el usuario capturador'"
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
      :coordinations="assignableTeacherCoordinations"
      :can-choose-coordination="canChooseTeacherCoordination"
      :current-coordinator-name="authStore.session?.displayName || 'Usuario capturador'"
      :can-manage-fiscal="canManageTeacherFiscal"
      :can-view-fiscal-documents="canViewTeacherDocuments"
      :can-manage-fiscal-documents="canManageTeacherDocuments"
      :selected-constancia="selectedConstancia"
      @close="closeTeacherModal"
      @save="saveTeacher"
      @file-selected="onConstanciaSelected"
      @upload="uploadConstancia"
    />

    <div v-if="selectedTeacherDetail" class="modal-backdrop" @click.self="closeTeacherDetail">
      <section class="modal-card large teacher-detail-modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Directorio docente</p>
            <h3>{{ selectedTeacherDetail.fullName }}</h3>
          </div>
          <button class="icon-button" type="button" title="Cerrar" @click="closeTeacherDetail">
            <X :size="17" />
          </button>
        </div>

        <div class="teacher-detail-grid">
          <article class="teacher-detail-card">
            <span>Responsable operativo</span>
            <strong>{{ teacherResponsibleLabel(selectedTeacherDetail) }}</strong>
          </article>
          <article class="teacher-detail-card">
            <span>Estatus</span>
            <strong>{{ selectedTeacherDetail.status }}</strong>
          </article>
          <article class="teacher-detail-card">
            <span>Categoría</span>
            <strong>{{ selectedTeacherDetail.category || '-' }}</strong>
          </article>
          <article class="teacher-detail-card">
            <span>Ubicación</span>
            <strong>{{ selectedTeacherDetail.location || '-' }}</strong>
          </article>
        </div>

        <section class="teacher-detail-section">
          <h4>Contacto</h4>
          <dl>
            <dt><Phone :size="14" /> Teléfono</dt>
            <dd>{{ selectedTeacherDetail.phone || 'Sin teléfono' }}</dd>
            <dt><Mail :size="14" /> Correo</dt>
            <dd>{{ selectedTeacherDetail.email || 'Sin correo' }}</dd>
            <dt><IdCard :size="14" /> Identificador</dt>
            <dd>{{ selectedTeacherDetail.externalIdentifier || 'Sin identificador' }}</dd>
          </dl>
        </section>

        <section class="teacher-detail-section">
          <h4>Perfil operativo</h4>
          <dl>
            <dt>Grado</dt>
            <dd>{{ selectedTeacherDetail.degree || '-' }}</dd>
            <dt>Comentario</dt>
            <dd>{{ selectedTeacherDetail.comment || '-' }}</dd>
            <dt>Observación</dt>
            <dd>{{ selectedTeacherDetail.observation || '-' }}</dd>
          </dl>
        </section>

        <section v-if="canViewTeacherFiscal" class="teacher-detail-section">
          <h4>Fiscal</h4>
          <dl>
            <dt>RFC</dt>
            <dd>{{ selectedTeacherDetail.rfc || 'Sin RFC' }}</dd>
            <dt>Tipo de pago</dt>
            <dd>{{ paymentLabel(selectedTeacherDetail.paymentType) }}</dd>
            <dt>Banco / cuenta</dt>
            <dd>{{ selectedTeacherDetail.bankDetail || 'Sin datos bancarios' }}</dd>
          </dl>
        </section>

        <div class="modal-actions">
          <button class="secondary-action" type="button" @click="closeTeacherDetail">Cerrar</button>
        </div>
      </section>
    </div>

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
