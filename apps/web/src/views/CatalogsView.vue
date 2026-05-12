<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  BookOpen,
  DollarSign,
  Edit3,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Tags,
  X
} from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import {
  createCatalogSubject,
  createCatalogTabulator,
  fetchCatalogsContext,
  updateCatalogSubject,
  updateCatalogTabulator,
  type CatalogSubject,
  type CatalogSummary,
  type CatalogTabulator,
  type SubjectPayload,
  type TabulatorPayload
} from '../api';
import { moneyLabel } from '../utils/format';

type CatalogTab = 'subjects' | 'tabulators';
type StatusFilter = 'TODOS' | 'ACTIVO' | 'INACTIVO';

const authStore = useAuthStore();

const activeTab = ref<CatalogTab>('subjects');
const subjects = ref<CatalogSubject[]>([]);
const tabulators = ref<CatalogTabulator[]>([]);
const summary = ref<CatalogSummary>({
  subjects: { total: 0, active: 0, inactive: 0, usedInWorkingCycles: 0 },
  tabulators: { total: 0, active: 0, inactive: 0, usedInWorkingCycles: 0 }
});
const searchText = ref('');
const statusFilter = ref<StatusFilter>('ACTIVO');
const pageBusy = ref(false);
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

const subjectModalOpen = ref(false);
const subjectSaving = ref(false);
const editingSubjectId = ref<string | null>(null);
const subjectForm = ref<SubjectPayload>({ name: '', status: 'ACTIVO' });

const tabulatorModalOpen = ref(false);
const tabulatorSaving = ref(false);
const editingTabulatorId = ref<string | null>(null);
const tabulatorForm = ref<TabulatorPayload>({
  name: '',
  amount: 0,
  status: 'ACTIVO',
  sortOrder: 100
});

const filteredSubjects = computed(() => {
  const text = searchText.value.trim().toLowerCase();
  return subjects.value.filter((subject) => {
    const matchesStatus = statusFilter.value === 'TODOS' || subject.status === statusFilter.value;
    const haystack = [subject.name, subject.status, subject.scheduleCount, subject.activeScheduleCount].join(' ').toLowerCase();
    return matchesStatus && (!text || haystack.includes(text));
  });
});

const filteredTabulators = computed(() => {
  const text = searchText.value.trim().toLowerCase();
  return tabulators.value.filter((tabulator) => {
    const matchesStatus = statusFilter.value === 'TODOS' || tabulator.status === statusFilter.value;
    const haystack = [
      tabulator.name,
      tabulator.status,
      tabulator.amount,
      tabulator.scheduleCount,
      tabulator.activeScheduleCount
    ]
      .join(' ')
      .toLowerCase();
    return matchesStatus && (!text || haystack.includes(text));
  });
});

function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
  window.setTimeout(() => {
    notice.value = null;
  }, 3200);
}

function clearNotice() {
  notice.value = null;
}

async function loadCatalogs() {
  if (!authStore.canManageCatalogs) {
    setNotice('error', 'Solo un administrador puede gestionar catálogos.');
    return;
  }

  pageBusy.value = true;
  clearNotice();
  try {
    const data = await fetchCatalogsContext();
    subjects.value = data.subjects;
    tabulators.value = data.tabulators;
    summary.value = data.summary;
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar catálogos.');
  } finally {
    pageBusy.value = false;
  }
}

function newSubject() {
  editingSubjectId.value = null;
  subjectForm.value = { name: '', status: 'ACTIVO' };
  subjectModalOpen.value = true;
  clearNotice();
}

function editSubject(subject: CatalogSubject) {
  editingSubjectId.value = subject.id;
  subjectForm.value = {
    name: subject.name,
    status: subject.status
  };
  subjectModalOpen.value = true;
  clearNotice();
}

function closeSubjectModal() {
  if (subjectSaving.value) return;
  subjectModalOpen.value = false;
  editingSubjectId.value = null;
  subjectForm.value = { name: '', status: 'ACTIVO' };
}

async function saveSubject() {
  if (!authStore.canManageCatalogs) return;
  subjectSaving.value = true;
  clearNotice();
  try {
    const payload = {
      name: subjectForm.value.name.trim(),
      status: subjectForm.value.status
    };
    const response = editingSubjectId.value
      ? await updateCatalogSubject(editingSubjectId.value, payload)
      : await createCatalogSubject(payload);
    setNotice('ok', response.message);
    closeSubjectModal();
    await loadCatalogs();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar la asignatura.');
  } finally {
    subjectSaving.value = false;
  }
}

function nextSortOrder() {
  const maxOrder = Math.max(0, ...tabulators.value.map((tabulator) => tabulator.sortOrder || 0));
  return maxOrder + 10;
}

function newTabulator() {
  editingTabulatorId.value = null;
  tabulatorForm.value = {
    name: '',
    amount: 0,
    status: 'ACTIVO',
    sortOrder: nextSortOrder()
  };
  tabulatorModalOpen.value = true;
  clearNotice();
}

function editTabulator(tabulator: CatalogTabulator) {
  editingTabulatorId.value = tabulator.id;
  tabulatorForm.value = {
    name: tabulator.name,
    amount: tabulator.amount,
    status: tabulator.status,
    sortOrder: tabulator.sortOrder
  };
  tabulatorModalOpen.value = true;
  clearNotice();
}

function closeTabulatorModal() {
  if (tabulatorSaving.value) return;
  tabulatorModalOpen.value = false;
  editingTabulatorId.value = null;
  tabulatorForm.value = { name: '', amount: 0, status: 'ACTIVO', sortOrder: 100 };
}

async function saveTabulator() {
  if (!authStore.canManageCatalogs) return;
  tabulatorSaving.value = true;
  clearNotice();
  try {
    const payload = {
      name: tabulatorForm.value.name.trim(),
      amount: Number(tabulatorForm.value.amount || 0),
      status: tabulatorForm.value.status,
      sortOrder: Number(tabulatorForm.value.sortOrder || 100)
    };
    const response = editingTabulatorId.value
      ? await updateCatalogTabulator(editingTabulatorId.value, payload)
      : await createCatalogTabulator(payload);
    setNotice('ok', response.message);
    closeTabulatorModal();
    await loadCatalogs();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar el tabulador.');
  } finally {
    tabulatorSaving.value = false;
  }
}

onMounted(() => {
  loadCatalogs();
});
</script>

<template>
  <div class="view-stack">
    <div v-if="notice" class="notice" :class="notice.type">
      {{ notice.text }}
    </div>

    <section class="toolbar-card">
      <div>
        <p class="eyebrow">Catálogos administrativos</p>
        <h3>Asignaturas y tabuladores</h3>
      </div>
      <div class="toolbar-actions">
        <button class="secondary-action" type="button" @click="loadCatalogs">
          <RefreshCw :size="17" :class="{ spin: pageBusy }" />
          Actualizar
        </button>
        <button v-if="activeTab === 'subjects'" class="primary-inline" type="button" @click="newSubject">
          <Plus :size="17" />
          Nueva asignatura
        </button>
        <button v-else class="primary-inline" type="button" @click="newTabulator">
          <Plus :size="17" />
          Nuevo tabulador
        </button>
      </div>
    </section>

    <section class="metric-grid compact">
      <article class="metric-card mini">
        <p>Asignaturas</p>
        <strong>{{ summary.subjects.total }}</strong>
        <small>{{ summary.subjects.active }} activas</small>
      </article>
      <article class="metric-card mini">
        <p>En uso</p>
        <strong>{{ summary.subjects.usedInWorkingCycles }}</strong>
        <small>Asignaturas en ciclo operativo</small>
      </article>
      <article class="metric-card mini">
        <p>Tabuladores</p>
        <strong>{{ summary.tabulators.total }}</strong>
        <small>{{ summary.tabulators.active }} activos</small>
      </article>
      <article class="metric-card mini">
        <p>Con horarios</p>
        <strong>{{ summary.tabulators.usedInWorkingCycles }}</strong>
        <small>Tabuladores en ciclo operativo</small>
      </article>
    </section>

    <section class="data-panel">
      <div class="catalog-header">
        <div class="segmented-control">
          <button type="button" :class="{ active: activeTab === 'subjects' }" @click="activeTab = 'subjects'">
            <BookOpen :size="15" />
            Asignaturas
          </button>
          <button type="button" :class="{ active: activeTab === 'tabulators' }" @click="activeTab = 'tabulators'">
            <Tags :size="15" />
            Tabuladores
          </button>
        </div>
        <div class="catalog-note">
          <ShieldCheck :size="16" />
          <span>Los cambios no modifican nóminas históricas ya guardadas.</span>
        </div>
      </div>

      <div class="filters-row catalogs">
        <label class="search-box">
          <Search :size="17" />
          <input v-model="searchText" placeholder="Buscar por nombre, estatus o uso" />
        </label>
        <select v-model="statusFilter">
          <option value="TODOS">Todos</option>
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
        </select>
      </div>

      <div v-if="activeTab === 'subjects'" class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Asignatura</th>
              <th>Estatus</th>
              <th>Uso operativo</th>
              <th>Histórico</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filteredSubjects.length">
              <td colspan="5" class="empty-cell">No hay asignaturas con el filtro actual.</td>
            </tr>
            <tr v-for="subject in filteredSubjects" :key="subject.id">
              <td>
                <strong>{{ subject.name }}</strong>
                <span>Catálogo de captura para horarios</span>
              </td>
              <td>
                <span class="badge" :class="subject.status === 'ACTIVO' ? 'ok' : 'muted'">{{ subject.status }}</span>
              </td>
              <td>
                <strong>{{ subject.activeScheduleCount }}</strong>
                <small>Horarios en ciclo activo o planeación</small>
              </td>
              <td>
                <strong>{{ subject.scheduleCount }}</strong>
                <small>Horarios totales</small>
              </td>
              <td class="row-actions">
                <button class="icon-button" type="button" title="Editar asignatura" @click="editSubject(subject)">
                  <Edit3 :size="16" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Tabulador</th>
              <th>Monto</th>
              <th>Estatus</th>
              <th>Orden</th>
              <th>Uso operativo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filteredTabulators.length">
              <td colspan="6" class="empty-cell">No hay tabuladores con el filtro actual.</td>
            </tr>
            <tr v-for="tabulator in filteredTabulators" :key="tabulator.id">
              <td>
                <strong>{{ tabulator.name }}</strong>
                <span>Catálogo de pago por hora</span>
              </td>
              <td>
                <strong>{{ moneyLabel(tabulator.amount) }}</strong>
                <small>Por hora</small>
              </td>
              <td>
                <span class="badge" :class="tabulator.status === 'ACTIVO' ? 'ok' : 'muted'">{{ tabulator.status }}</span>
              </td>
              <td>
                <strong>{{ tabulator.sortOrder }}</strong>
                <small>Orden de lista</small>
              </td>
              <td>
                <strong>{{ tabulator.activeScheduleCount }}</strong>
                <small>{{ tabulator.scheduleCount }} históricos</small>
              </td>
              <td class="row-actions">
                <button class="icon-button" type="button" title="Editar tabulador" @click="editTabulator(tabulator)">
                  <Edit3 :size="16" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="subjectModalOpen" class="modal-backdrop" @click.self="closeSubjectModal">
      <form class="modal-card" @submit.prevent="saveSubject">
        <div class="modal-header">
          <div>
            <p class="eyebrow">{{ editingSubjectId ? 'Edición' : 'Alta' }}</p>
            <h3>{{ editingSubjectId ? 'Actualizar asignatura' : 'Nueva asignatura' }}</h3>
          </div>
          <button class="icon-button" type="button" title="Cerrar" :disabled="subjectSaving" @click="closeSubjectModal">
            <X :size="17" />
          </button>
        </div>

        <div class="form-grid one">
          <label>
            <span>Nombre</span>
            <input v-model.trim="subjectForm.name" maxlength="160" required placeholder="Nombre de la asignatura" />
          </label>
          <label>
            <span>Estatus</span>
            <select v-model="subjectForm.status">
              <option value="ACTIVO">ACTIVO</option>
              <option value="INACTIVO">INACTIVO</option>
            </select>
          </label>
        </div>

        <div class="security-box">
          <ShieldCheck :size="18" />
          <span>Inactivar una asignatura la oculta de nuevas capturas, pero conserva horarios históricos.</span>
        </div>

        <div class="modal-actions">
          <button class="secondary-action" type="button" :disabled="subjectSaving" @click="closeSubjectModal">Cancelar</button>
          <button class="primary-inline" type="submit" :disabled="subjectSaving">
            <Save :size="16" />
            {{ subjectSaving ? 'Guardando...' : 'Guardar asignatura' }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="tabulatorModalOpen" class="modal-backdrop" @click.self="closeTabulatorModal">
      <form class="modal-card" @submit.prevent="saveTabulator">
        <div class="modal-header">
          <div>
            <p class="eyebrow">{{ editingTabulatorId ? 'Edición' : 'Alta' }}</p>
            <h3>{{ editingTabulatorId ? 'Actualizar tabulador' : 'Nuevo tabulador' }}</h3>
          </div>
          <button class="icon-button" type="button" title="Cerrar" :disabled="tabulatorSaving" @click="closeTabulatorModal">
            <X :size="17" />
          </button>
        </div>

        <div class="form-grid">
          <label>
            <span>Nombre</span>
            <input v-model.trim="tabulatorForm.name" maxlength="120" required placeholder="LIC-LIC" />
          </label>
          <label>
            <span>Monto por hora</span>
            <input v-model.number="tabulatorForm.amount" type="number" min="0.01" step="0.01" required />
          </label>
          <label>
            <span>Estatus</span>
            <select v-model="tabulatorForm.status">
              <option value="ACTIVO">ACTIVO</option>
              <option value="INACTIVO">INACTIVO</option>
            </select>
          </label>
          <label>
            <span>Orden</span>
            <input v-model.number="tabulatorForm.sortOrder" type="number" min="0" step="1" required />
          </label>
        </div>

        <div class="security-box">
          <DollarSign :size="18" />
          <span>El nuevo monto aplica a nuevas capturas. Las nóminas guardadas conservan el monto histórico calculado.</span>
        </div>

        <div class="modal-actions">
          <button class="secondary-action" type="button" :disabled="tabulatorSaving" @click="closeTabulatorModal">Cancelar</button>
          <button class="primary-inline" type="submit" :disabled="tabulatorSaving">
            <Save :size="16" />
            {{ tabulatorSaving ? 'Guardando...' : 'Guardar tabulador' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
