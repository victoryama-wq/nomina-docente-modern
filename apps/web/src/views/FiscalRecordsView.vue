<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CreditCard,
  Download,
  Edit3,
  Eye,
  FileText,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  X
} from 'lucide-vue-next';
import {
  downloadTeacherConstancia,
  fetchTeacherConstanciaBlob,
  fetchTeachers,
  updateTeacherFiscal,
  uploadTeacherConstancia,
  type CoordinationOption,
  type Teacher,
  type TeacherFiscalPayload,
  type TeacherSummary
} from '../api';
import { useAuthStore } from '../stores/auth';

type TeacherStatusFilter = 'TODOS' | 'ACTIVO' | 'INACTIVO';
type FiscalStatusFilter = 'TODOS' | 'COMPLETO' | 'INCOMPLETO' | 'SIN_CONSTANCIA' | 'SIN_RFC' | 'CUMPLEANOS';

interface FiscalRecord {
  teacher: Teacher;
  fiscalPercent: number;
  missing: string[];
  birthDate: Date | null;
  birthDateLabel: string;
  birthdayLabel: string;
  age: number | null;
  daysUntilBirthday: number | null;
}

interface ConstanciaPreview {
  teacher: Teacher;
  url: string;
  mimeType: string;
  fileName: string;
}

interface FiscalForm extends TeacherFiscalPayload {}

const authStore = useAuthStore();

const teachers = ref<Teacher[]>([]);
const actorCoordination = ref<CoordinationOption | null>(null);
const summary = ref<TeacherSummary>({
  total: 0,
  active: 0,
  inactive: 0,
  withRfc: 0,
  withBank: 0,
  withConstancia: 0,
  fiscalReady: 0
});
const searchText = ref('');
const statusFilter = ref<TeacherStatusFilter>('ACTIVO');
const fiscalFilter = ref<FiscalStatusFilter>('TODOS');
const pageBusy = ref(false);
const exportingBirthdays = ref(false);
const previewBusyId = ref('');
const downloadingId = ref('');
const fiscalSaving = ref(false);
const constanciaPreview = ref<ConstanciaPreview | null>(null);
const editingRecord = ref<FiscalRecord | null>(null);
const selectedConstancia = ref<File | null>(null);
const fiscalForm = ref<FiscalForm>({
  paymentType: '1',
  email: '',
  rfc: '',
  bankDetail: ''
});
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

const fiscalRecords = computed<FiscalRecord[]>(() =>
  teachers.value.map((teacher) => {
    const missing = fiscalMissing(teacher);
    const birthDate = birthDateFromRfc(teacher.rfc);
    return {
      teacher,
      fiscalPercent: Math.round(((4 - missing.length) / 4) * 100),
      missing,
      birthDate,
      birthDateLabel: birthDate ? formatDate(birthDate) : 'No detectada',
      birthdayLabel: birthDate ? formatBirthday(birthDate) : '-',
      age: birthDate ? ageFromBirthDate(birthDate) : null,
      daysUntilBirthday: birthDate ? daysUntilBirthday(birthDate) : null
    };
  })
);

const filteredRecords = computed(() => {
  const text = searchText.value.toLowerCase().trim();
  return fiscalRecords.value.filter((record) => {
    const teacher = record.teacher;
    const matchesStatus = statusFilter.value === 'TODOS' || teacher.status === statusFilter.value;
    const matchesFiscal =
      fiscalFilter.value === 'TODOS' ||
      (fiscalFilter.value === 'COMPLETO' && record.missing.length === 0) ||
      (fiscalFilter.value === 'INCOMPLETO' && record.missing.length > 0) ||
      (fiscalFilter.value === 'SIN_CONSTANCIA' && !teacher.documentId) ||
      (fiscalFilter.value === 'SIN_RFC' && !teacher.rfc) ||
      (fiscalFilter.value === 'CUMPLEANOS' &&
        record.daysUntilBirthday !== null &&
        record.daysUntilBirthday >= 0 &&
        record.daysUntilBirthday <= 30);
    const haystack = [
      teacher.fullName,
      teacher.rfc,
      teacher.email,
      teacher.bankDetail,
      teacher.coordinationName,
      teacher.documentName,
      record.birthDateLabel,
      record.birthdayLabel,
      record.missing.join(' ')
    ]
      .join(' ')
      .toLowerCase();
    return matchesStatus && matchesFiscal && (!text || haystack.includes(text));
  });
});

const fiscalMetrics = computed(() => {
  const records = fiscalRecords.value;
  return {
    total: records.length,
    complete: records.filter((record) => record.missing.length === 0).length,
    withConstancia: records.filter((record) => !!record.teacher.documentId).length,
    missingConstancia: records.filter((record) => !record.teacher.documentId).length,
    birthdays30: records.filter(
      (record) => record.daysUntilBirthday !== null && record.daysUntilBirthday >= 0 && record.daysUntilBirthday <= 30
    ).length
  };
});

function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
  window.setTimeout(() => {
    notice.value = null;
  }, 3200);
}

function fiscalPayloadFromTeacher(teacher: Teacher): FiscalForm {
  return {
    paymentType: teacher.paymentType === 'E' || teacher.paymentType === '1' || teacher.paymentType === '2' ? teacher.paymentType : '1',
    email: teacher.email || '',
    rfc: teacher.rfc || '',
    bankDetail: teacher.bankDetail || ''
  };
}

function canManageRecord(record: FiscalRecord) {
  if (!authStore.canManageFiscalRecords) return false;
  if (authStore.isAdmin || authStore.session?.permissions?.includes('finance.view')) return true;
  return !!actorCoordination.value?.id && record.teacher.coordinationId === actorCoordination.value.id;
}

function openFiscalEdit(record: FiscalRecord) {
  if (!canManageRecord(record)) {
    setNotice('error', 'Solo la coordinación responsable puede actualizar este expediente.');
    return;
  }
  editingRecord.value = record;
  fiscalForm.value = fiscalPayloadFromTeacher(record.teacher);
  selectedConstancia.value = null;
  notice.value = null;
}

function closeFiscalEdit(force = false) {
  if (fiscalSaving.value && !force) return;
  editingRecord.value = null;
  fiscalForm.value = {
    paymentType: '1',
    email: '',
    rfc: '',
    bankDetail: ''
  };
  selectedConstancia.value = null;
}

function fiscalMissing(teacher: Teacher) {
  const missing: string[] = [];
  if (!teacher.rfc) missing.push('RFC');
  if (!teacher.email) missing.push('Correo');
  if (!teacher.bankDetail) missing.push('Banco');
  if (!teacher.documentId) missing.push('Constancia');
  return missing;
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

function documentMimeType(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

async function saveFiscalEdit() {
  const record = editingRecord.value;
  if (!record || !authStore.canManageFiscalRecords) return;
  fiscalSaving.value = true;
  notice.value = null;
  try {
    let message = '';
    const response = await updateTeacherFiscal(record.teacher.id, {
      paymentType: fiscalForm.value.paymentType,
      email: fiscalForm.value.email,
      rfc: fiscalForm.value.rfc,
      bankDetail: fiscalForm.value.bankDetail
    });
    message = response.message;

    if (selectedConstancia.value) {
      const file = selectedConstancia.value;
      const base64Data = await readFileAsBase64(file);
      const uploadResponse = await uploadTeacherConstancia(record.teacher.id, {
        fileName: file.name,
        mimeType: documentMimeType(file),
        base64Data
      });
      message = `${message} ${uploadResponse.message}`;
    }

    closeFiscalEdit(true);
    await loadFiscalRecords();
    setNotice('ok', message.trim() || 'Expediente fiscal actualizado.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible actualizar el expediente fiscal.');
  } finally {
    fiscalSaving.value = false;
  }
}

function birthDateFromRfc(rfc: string): Date | null {
  const cleaned = (rfc || '').toUpperCase().replace(/[^A-Z0-9&]/g, '');
  const datePart = [cleaned.slice(4, 10), cleaned.slice(3, 9)].find((candidate) => /^\d{6}$/.test(candidate));
  if (!datePart) return null;

  const yy = Number(datePart.slice(0, 2));
  const month = Number(datePart.slice(2, 4));
  const day = Number(datePart.slice(4, 6));
  if (!Number.isInteger(yy) || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const today = new Date();
  const currentYY = today.getFullYear() % 100;
  let year = yy <= currentYY ? 2000 + yy : 1900 + yy;
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  if (ageFromBirthDate(candidate) < 18) {
    year -= 100;
  }

  const birthDate = new Date(year, month - 1, day);
  return birthDate.getFullYear() === year && birthDate.getMonth() === month - 1 && birthDate.getDate() === day ? birthDate : null;
}

function ageFromBirthDate(birthDate: Date) {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (today < birthdayThisYear) age -= 1;
  return age;
}

function daysUntilBirthday(birthDate: Date) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (next < todayStart) next = new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
  return Math.round((next.getTime() - todayStart.getTime()) / 86_400_000);
}

function formatDate(value: Date) {
  return value.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatBirthday(value: Date) {
  return value.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short'
  });
}

function paymentLabel(value: string) {
  if (value === 'E') return 'Efectivo';
  if (value === '1') return 'Santander';
  if (value === '2') return 'Banorte';
  return 'Sin definir';
}

function documentDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(fileName: string, headers: string[], rows: unknown[][]) {
  const content = `\uFEFF${[headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\r\n')}\r\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function exportBirthdays() {
  exportingBirthdays.value = true;
  try {
    const rows = [...filteredRecords.value]
      .sort((left, right) => {
        const leftKey = left.birthDate ? `${String(left.birthDate.getMonth() + 1).padStart(2, '0')}-${String(left.birthDate.getDate()).padStart(2, '0')}` : '99-99';
        const rightKey = right.birthDate ? `${String(right.birthDate.getMonth() + 1).padStart(2, '0')}-${String(right.birthDate.getDate()).padStart(2, '0')}` : '99-99';
        return leftKey.localeCompare(rightKey);
      })
      .map((record) => [
        record.teacher.fullName,
        record.teacher.coordinationName,
        record.teacher.rfc,
        record.birthDateLabel === 'No detectada' ? '' : record.birthDateLabel,
        record.birthdayLabel === '-' ? '' : record.birthdayLabel,
        record.age ?? '',
        record.daysUntilBirthday ?? '',
        record.teacher.email,
        record.teacher.status
      ]);

    downloadCsv(
      'cumpleaños-docentes.csv',
      ['Docente', 'Coordinación', 'RFC', 'Fecha nacimiento', 'Cumpleaños', 'Edad', 'Días para cumpleaños', 'Correo', 'Estatus'],
      rows
    );
    setNotice('ok', 'Listado de cumpleaños generado.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible generar el listado.');
  } finally {
    exportingBirthdays.value = false;
  }
}

function closePreview() {
  if (constanciaPreview.value?.url) URL.revokeObjectURL(constanciaPreview.value.url);
  constanciaPreview.value = null;
}

async function previewConstancia(record: FiscalRecord) {
  if (!record.teacher.documentId || !canManageRecord(record)) return;
  previewBusyId.value = record.teacher.id;
  try {
    closePreview();
    const document = await fetchTeacherConstanciaBlob(record.teacher.id);
    const url = URL.createObjectURL(document.blob);
    constanciaPreview.value = {
      teacher: record.teacher,
      url,
      mimeType: document.mimeType,
      fileName: document.fileName
    };
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible abrir la vista previa.');
  } finally {
    previewBusyId.value = '';
  }
}

async function downloadConstancia(record: FiscalRecord) {
  if (!record.teacher.documentId || !canManageRecord(record)) return;
  downloadingId.value = record.teacher.id;
  try {
    await downloadTeacherConstancia(record.teacher.id);
    setNotice('ok', 'Constancia descargada.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible descargar la constancia.');
  } finally {
    downloadingId.value = '';
  }
}

async function downloadPreviewConstancia() {
  if (!constanciaPreview.value) return;
  downloadingId.value = constanciaPreview.value.teacher.id;
  try {
    await downloadTeacherConstancia(constanciaPreview.value.teacher.id);
    setNotice('ok', 'Constancia descargada.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible descargar la constancia.');
  } finally {
    downloadingId.value = '';
  }
}

async function loadFiscalRecords() {
  if (!authStore.canViewFiscalRecords) return;
  pageBusy.value = true;
  notice.value = null;
  try {
    const data = await fetchTeachers();
    teachers.value = data.teachers;
    summary.value = data.summary;
    actorCoordination.value = data.actorCoordination;
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar expedientes fiscales.');
  } finally {
    pageBusy.value = false;
  }
}

onMounted(() => {
  loadFiscalRecords();
});

onUnmounted(() => {
  closePreview();
});
</script>

<template>
  <div class="view-stack">
    <div v-if="notice" class="notice" :class="notice.type">
      {{ notice.text }}
    </div>

    <section class="toolbar-card">
      <div>
        <p class="eyebrow">Expediente fiscal</p>
        <h3>Documentación y cumpleaños docentes</h3>
      </div>
      <div class="toolbar-actions">
        <button class="secondary-action" type="button" @click="loadFiscalRecords">
          <RefreshCw :size="17" :class="{ spin: pageBusy }" />
          Actualizar
        </button>
        <button class="primary-inline" type="button" :disabled="exportingBirthdays" @click="exportBirthdays">
          <Download :size="17" />
          Cumpleaños CSV
        </button>
      </div>
    </section>

    <section class="metric-grid compact">
      <article class="metric-card mini"><p>Docentes</p><strong>{{ fiscalMetrics.total }}</strong><small>{{ summary.active }} activos</small></article>
      <article class="metric-card mini"><p>Completos</p><strong>{{ fiscalMetrics.complete }}</strong><small>RFC, correo, banco y constancia</small></article>
      <article class="metric-card mini"><p>Constancias</p><strong>{{ fiscalMetrics.withConstancia }}</strong><small>{{ fiscalMetrics.missingConstancia }} pendientes</small></article>
      <article class="metric-card mini"><p>Cumpleaños</p><strong>{{ fiscalMetrics.birthdays30 }}</strong><small>Próximos 30 días</small></article>
    </section>

    <section class="single-grid">
      <div class="data-panel full">
        <div class="filters-row fiscal-records">
          <label class="search-box">
            <Search :size="17" />
            <input v-model="searchText" placeholder="Buscar docente, RFC, correo, banco o coordinación" />
          </label>
          <select v-model="statusFilter">
            <option value="TODOS">Todos</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </select>
          <select v-model="fiscalFilter">
            <option value="TODOS">Todo fiscal</option>
            <option value="COMPLETO">Completos</option>
            <option value="INCOMPLETO">Incompletos</option>
            <option value="SIN_CONSTANCIA">Sin constancia</option>
            <option value="SIN_RFC">Sin RFC</option>
            <option value="CUMPLEANOS">Cumpleaños 30 días</option>
          </select>
        </div>

        <div class="table-shell">
          <table class="fiscal-records-table">
            <thead>
              <tr>
                <th>Docente</th>
                <th>Expediente</th>
                <th>Nacimiento</th>
                <th>Pago</th>
                <th>Constancia</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredRecords.length">
                <td colspan="5" class="empty-cell">No hay expedientes con el filtro actual.</td>
              </tr>
              <tr v-for="record in filteredRecords" :key="record.teacher.id">
                <td>
                  <strong>{{ record.teacher.fullName }}</strong>
                  <span><Building2 :size="13" /> {{ record.teacher.coordinationName || 'Sin coordinación' }}</span>
                  <span><Mail :size="13" /> {{ record.teacher.email || 'Sin correo' }}</span>
                  <span class="badge" :class="record.teacher.status === 'ACTIVO' ? 'ok' : 'muted'">{{ record.teacher.status }}</span>
                </td>
                <td>
                  <div class="progress-line fiscal-progress">
                    <span :style="{ width: record.fiscalPercent + '%' }"></span>
                  </div>
                  <strong>{{ record.fiscalPercent }}% completo</strong>
                  <div class="fiscal-checks">
                    <span :class="{ ok: !!record.teacher.rfc }"><ShieldCheck :size="12" /> RFC</span>
                    <span :class="{ ok: !!record.teacher.email }"><ShieldCheck :size="12" /> Correo</span>
                    <span :class="{ ok: !!record.teacher.bankDetail }"><ShieldCheck :size="12" /> Banco</span>
                    <span :class="{ ok: !!record.teacher.documentId }"><ShieldCheck :size="12" /> Constancia</span>
                  </div>
                  <small v-if="record.missing.length">Pendiente: {{ record.missing.join(', ') }}</small>
                </td>
                <td>
                  <strong>{{ record.birthDateLabel }}</strong>
                  <span><CalendarDays :size="13" /> {{ record.birthdayLabel }}</span>
                  <small v-if="record.age !== null">{{ record.age }} años / {{ record.daysUntilBirthday }} días</small>
                  <small v-else>No disponible desde RFC</small>
                </td>
                <td>
                  <span class="badge neutral"><CreditCard :size="13" /> {{ paymentLabel(record.teacher.paymentType) }}</span>
                  <small>{{ record.teacher.bankDetail || 'Datos bancarios pendientes' }}</small>
                  <small>RFC {{ record.teacher.rfc || 'pendiente' }}</small>
                </td>
                <td>
                  <strong>{{ record.teacher.documentName || 'Sin constancia' }}</strong>
                  <span>{{ documentDate(record.teacher.documentUploadedAt) }}</span>
                  <div v-if="record.teacher.documentId && canManageRecord(record)" class="fiscal-document-actions">
                    <button
                      class="secondary-action"
                      type="button"
                      :disabled="previewBusyId === record.teacher.id"
                      @click="previewConstancia(record)"
                    >
                      <Eye :size="15" />
                      Vista previa
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      :disabled="downloadingId === record.teacher.id"
                      @click="downloadConstancia(record)"
                    >
                      <Download :size="15" />
                      Descargar
                    </button>
                  </div>
                  <span v-else-if="record.teacher.documentId" class="badge muted">Restringida</span>
                  <span v-else class="badge warning"><AlertTriangle :size="12" /> Pendiente</span>
                  <div v-if="authStore.canManageFiscalRecords" class="fiscal-document-actions">
                    <button
                      class="primary-inline fiscal-edit-button"
                      type="button"
                      :disabled="!canManageRecord(record)"
                      :title="canManageRecord(record) ? 'Actualizar fiscal' : 'Solo editable por la coordinación responsable'"
                      @click="openFiscalEdit(record)"
                    >
                      <Edit3 :size="15" />
                      Actualizar fiscal
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <div v-if="editingRecord" class="modal-backdrop" @click.self="closeFiscalEdit()">
      <form class="modal-card large" @submit.prevent="saveFiscalEdit">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Actualizacion fiscal</p>
            <h3>{{ editingRecord.teacher.fullName }}</h3>
            <span>{{ editingRecord.teacher.coordinationName || 'Sin coordinación' }}</span>
          </div>
          <button class="icon-button" type="button" title="Cerrar" :disabled="fiscalSaving" @click="closeFiscalEdit()">
            <X :size="17" />
          </button>
        </div>

        <div class="form-grid">
          <label>
            <span>RFC</span>
            <input v-model.trim="fiscalForm.rfc" maxlength="20" placeholder="RFC del docente" />
          </label>
          <label>
            <span>Correo</span>
            <input v-model.trim="fiscalForm.email" type="email" maxlength="160" placeholder="correo@dominio.mx" />
          </label>
          <label>
            <span>Tipo de pago</span>
            <select v-model="fiscalForm.paymentType">
              <option value="1">Santander</option>
              <option value="2">Banorte</option>
              <option value="E">Efectivo</option>
            </select>
          </label>
          <label>
            <span>Banco / cuenta / CLABE</span>
            <input v-model.trim="fiscalForm.bankDetail" maxlength="140" placeholder="Datos bancarios para pago" />
          </label>
        </div>

        <div class="upload-box fiscal-edit-upload">
          <FileText :size="22" />
          <div>
            <strong>Constancia fiscal</strong>
            <span>{{ selectedConstancia?.name || editingRecord.teacher.documentName || 'Selecciona PDF, JPG o PNG para cargar o reemplazar' }}</span>
          </div>
          <input type="file" accept="application/pdf,image/jpeg,image/png" @change="onConstanciaSelected" />
        </div>

        <div class="security-box fiscal-edit-note">
          <ShieldCheck :size="18" />
          <span>Esta ventana solo actualiza datos fiscales. Nombre, coordinación, categoría y estatus operativo se mantienen en Directorio.</span>
        </div>

        <div class="modal-actions">
          <button class="secondary-action" type="button" :disabled="fiscalSaving" @click="closeFiscalEdit()">Cancelar</button>
          <button class="primary-inline" type="submit" :disabled="fiscalSaving">
            <ShieldCheck :size="16" />
            {{ fiscalSaving ? 'Guardando...' : 'Guardar fiscal' }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="constanciaPreview" class="modal-backdrop" @click.self="closePreview">
      <section class="modal-card large fiscal-preview-modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Constancia fiscal</p>
            <h3>{{ constanciaPreview.teacher.fullName }}</h3>
            <span>{{ constanciaPreview.fileName }}</span>
          </div>
          <button class="icon-button" type="button" title="Cerrar" @click="closePreview">
            <X :size="17" />
          </button>
        </div>

        <div class="fiscal-preview-frame">
          <iframe
            v-if="constanciaPreview.mimeType.includes('pdf')"
            :src="constanciaPreview.url"
            title="Vista previa de constancia fiscal"
          ></iframe>
          <img v-else-if="constanciaPreview.mimeType.startsWith('image/')" :src="constanciaPreview.url" alt="Constancia fiscal" />
          <div v-else class="fiscal-preview-empty">
            <FileText :size="28" />
            <strong>Vista previa no disponible</strong>
            <span>{{ constanciaPreview.mimeType }}</span>
          </div>
        </div>

        <div class="modal-actions">
          <button class="secondary-action" type="button" :disabled="downloadingId === constanciaPreview.teacher.id" @click="downloadPreviewConstancia">
            <Download :size="16" />
            Descargar constancia
          </button>
          <button class="primary-inline" type="button" @click="closePreview">Cerrar</button>
        </div>
      </section>
    </div>
  </div>
</template>
