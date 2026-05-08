<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  Activity,
  AlertTriangle,
  Download,
  Eye,
  FileClock,
  FilterX,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X
} from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import {
  downloadAuditExport,
  fetchAuditLogs,
  type AuditActionGroup,
  type AuditContext,
  type AuditFilters,
  type AuditLogEntry,
  type AuditOption,
  type AuditSummary
} from '../api';

const authStore = useAuthStore();

const logs = ref<AuditLogEntry[]>([]);
const summary = ref<AuditSummary>({
  total: 0,
  creates: 0,
  updates: 0,
  deletions: 0,
  payrollEvents: 0,
  actors: 0
});
const options = ref<AuditContext['options']>({
  entityTypes: [],
  actions: [],
  actors: []
});
const pagination = ref({ limit: 100, offset: 0, returned: 0 });
const filters = ref<Required<AuditFilters>>({
  search: '',
  entityType: '',
  actionGroup: 'ALL',
  actorEmail: '',
  dateFrom: '',
  dateTo: '',
  limit: 100,
  offset: 0
});
const pageBusy = ref(false);
const exporting = ref(false);
const selectedLog = ref<AuditLogEntry | null>(null);
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

const actionGroups: Array<{ value: AuditActionGroup; label: string }> = [
  { value: 'ALL', label: 'Todos los eventos' },
  { value: 'CREATE', label: 'Altas' },
  { value: 'UPDATE', label: 'Ediciones' },
  { value: 'DELETE', label: 'Eliminaciones' },
  { value: 'PAYROLL', label: 'Nómina' },
  { value: 'ACCESS', label: 'Accesos' },
  { value: 'FISCAL', label: 'Fiscal' }
];

const entityLabels: Record<string, string> = {
  app_user: 'Accesos',
  teacher: 'Directorio',
  schedule: 'Horarios',
  schedule_incidence: 'Incidencias',
  extra_hour: 'Extras',
  payroll_run: 'Nómina',
  academic_cycle: 'Calendario',
  payroll_calendar_config: 'Calendario'
};

const actionLabels: Record<string, string> = {
  USER_CREATED: 'Usuario creado',
  USER_UPDATED: 'Usuario actualizado',
  USER_DELETED: 'Usuario eliminado',
  TEACHER_CREATED: 'Docente creado',
  TEACHER_UPDATED: 'Docente actualizado',
  TEACHER_FISCAL_UPDATED: 'Expediente fiscal actualizado',
  TEACHER_CONSTANCIA_UPLOADED: 'Constancia fiscal cargada',
  TEACHER_DELETED: 'Docente eliminado',
  SCHEDULE_CREATED: 'Horario creado',
  SCHEDULE_UPDATED: 'Horario actualizado',
  SCHEDULE_DELETED: 'Horario eliminado',
  INCIDENCE_UPDATED: 'Incidencia actualizada',
  EXTRA_CREATED: 'Extra creado',
  EXTRA_UPDATED: 'Extra actualizado',
  EXTRA_DELETED: 'Extra eliminado',
  CYCLE_MODULE_DATES_UPDATED: 'Fechas modulares actualizadas',
  CALENDAR_PERIOD_CREATED: 'Quincena creada',
  CALENDAR_PERIOD_UPDATED: 'Quincena actualizada',
  CALENDAR_PERIOD_DELETED: 'Quincena eliminada',
  PAYROLL_CALCULATED: 'Nómina guardada',
  PAYROLL_STATUS_UPDATED: 'Estado de nómina actualizado',
  PAYROLL_CANCELLED_FOR_CORRECTION: 'Nómina cancelada para corrección'
};

const canGoBack = computed(() => pagination.value.offset > 0);
const canGoNext = computed(() => pagination.value.offset + pagination.value.returned < summary.value.total);

const selectedChangedFields = computed(() => {
  if (!selectedLog.value) return [];
  return changedFields(selectedLog.value).slice(0, 18);
});

function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
  window.setTimeout(() => {
    if (notice.value?.text === text) notice.value = null;
  }, 3600);
}

function cleanFilters(resetOffset = true): AuditFilters {
  if (resetOffset) filters.value.offset = 0;
  filters.value.limit = Number(filters.value.limit || 100);
  filters.value.offset = Number(filters.value.offset || 0);
  return {
    search: filters.value.search.trim(),
    entityType: filters.value.entityType,
    actionGroup: filters.value.actionGroup,
    actorEmail: filters.value.actorEmail,
    dateFrom: filters.value.dateFrom,
    dateTo: filters.value.dateTo,
    limit: filters.value.limit,
    offset: filters.value.offset
  };
}

async function loadAudit(resetOffset = false) {
  if (!authStore.canViewAudit) return;
  pageBusy.value = true;
  notice.value = null;
  try {
    const data = await fetchAuditLogs(cleanFilters(resetOffset));
    logs.value = data.logs;
    summary.value = data.summary;
    options.value = data.options;
    pagination.value = data.pagination;
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar la bitácora.');
  } finally {
    pageBusy.value = false;
  }
}

async function exportAudit() {
  exporting.value = true;
  notice.value = null;
  try {
    await downloadAuditExport(cleanFilters(false));
    setNotice('ok', 'Bitácora exportada correctamente.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible exportar la bitácora.');
  } finally {
    exporting.value = false;
  }
}

function clearFilters() {
  filters.value = {
    search: '',
    entityType: '',
    actionGroup: 'ALL',
    actorEmail: '',
    dateFrom: '',
    dateTo: '',
    limit: filters.value.limit,
    offset: 0
  };
  void loadAudit(true);
}

function showDeletedOnly() {
  filters.value.actionGroup = 'DELETE';
  filters.value.offset = 0;
  void loadAudit(true);
}

function goBack() {
  if (!canGoBack.value) return;
  filters.value.offset = Math.max(0, pagination.value.offset - pagination.value.limit);
  void loadAudit(false);
}

function goNext() {
  if (!canGoNext.value) return;
  filters.value.offset = pagination.value.offset + pagination.value.limit;
  void loadAudit(false);
}

function optionLabel(option: AuditOption, map: Record<string, string> = {}) {
  return `${map[option.value] || option.value} (${option.total})`;
}

function entityLabel(entityType: string) {
  return entityLabels[entityType] || entityType;
}

function actionLabel(action: string) {
  return actionLabels[action] || action.replace(/_/g, ' ').toLowerCase();
}

function actionClass(action: string) {
  if (action.includes('DELETED') || action.includes('CANCELLED')) return 'danger';
  if (action.includes('CREATED') || action === 'PAYROLL_CALCULATED') return 'ok';
  if (action.includes('FISCAL') || action.includes('CONSTANCIA')) return 'neutral';
  if (action.includes('UPDATED') || action.includes('STATUS')) return 'warning';
  return 'muted';
}

function rowSummary(log: AuditLogEntry) {
  if (log.action.includes('DELETED')) return 'Registro retirado del flujo operativo.';
  if (log.action.includes('CREATED')) return 'Nuevo registro agregado.';
  if (log.action.includes('FISCAL') || log.action.includes('CONSTANCIA')) return 'Cambio en expediente fiscal.';
  if (log.entityType === 'payroll_run') return 'Movimiento dentro del flujo de nomina.';
  const fields = changedFields(log).slice(0, 3);
  if (!fields.length) return 'Evento registrado sin diferencias visibles.';
  return `Campos modificados: ${fields.join(', ')}`;
}

function recordLabel(log: AuditLogEntry) {
  return log.recordLabel || log.entityId || entityLabel(log.entityType);
}

function formatDateTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shortValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.length > 90 ? `${value.slice(0, 90)}...` : value;
  const text = JSON.stringify(value);
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

function dataRows(data: Record<string, unknown> | null) {
  if (!isPlainObject(data)) return [];
  return Object.entries(data).slice(0, 24);
}

function changedFields(log: AuditLogEntry) {
  const before = isPlainObject(log.beforeData) ? log.beforeData : {};
  const after = isPlainObject(log.afterData) ? log.afterData : {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

function formatJson(data: unknown) {
  if (data === null || data === undefined) return 'Sin datos';
  return JSON.stringify(data, null, 2);
}

function closeDetail() {
  selectedLog.value = null;
}

onMounted(() => {
  void loadAudit(true);
});
</script>

<template>
  <section v-if="!authStore.canViewAudit" class="data-panel">
    <p class="eyebrow">Acceso restringido</p>
    <h2>No tienes permisos para consultar auditoría.</h2>
  </section>

  <section v-else class="single-grid">
    <div v-if="notice" class="notice" :class="notice.type">{{ notice.text }}</div>

    <section class="toolbar-card">
      <div>
        <p class="eyebrow">Auditoría / Bitácora</p>
        <h2>Trazabilidad operativa del sistema</h2>
      </div>
      <div class="toolbar-actions">
        <button class="secondary-action" type="button" :disabled="pageBusy" @click="showDeletedOnly">
          <Trash2 :size="16" />
          Eliminados
        </button>
        <button class="secondary-action" type="button" :disabled="pageBusy" @click="loadAudit(false)">
          <RefreshCw :size="16" />
          Actualizar
        </button>
        <button class="primary-inline" type="button" :disabled="exporting || pageBusy" @click="exportAudit">
          <Download :size="16" />
          {{ exporting ? 'Exportando...' : 'Exportar CSV' }}
        </button>
      </div>
    </section>

    <section class="metric-grid compact">
      <article class="metric-card mini">
        <div class="metric-icon blue"><Activity :size="20" /></div>
        <p>Eventos</p>
        <strong>{{ summary.total }}</strong>
        <small>Segun filtros activos</small>
      </article>
      <article class="metric-card mini">
        <div class="metric-icon emerald"><ShieldCheck :size="20" /></div>
        <p>Altas / ediciones</p>
        <strong>{{ summary.creates + summary.updates }}</strong>
        <small>{{ summary.creates }} altas / {{ summary.updates }} ediciones</small>
      </article>
      <article class="metric-card mini">
        <div class="metric-icon teal"><FileClock :size="20" /></div>
        <p>Nómina</p>
        <strong>{{ summary.payrollEvents }}</strong>
        <small>Corridas y cambios de estado</small>
      </article>
      <article class="metric-card mini">
        <div class="metric-icon indigo"><UserRound :size="20" /></div>
        <p>Usuarios</p>
        <strong>{{ summary.actors }}</strong>
        <small>Con actividad registrada</small>
      </article>
    </section>

    <section class="data-panel full">
      <form class="filters-row audit" @submit.prevent="loadAudit(true)">
        <label class="search-box audit-search">
          <Search :size="17" />
          <input v-model="filters.search" placeholder="Buscar usuario, acción, docente, quincena o ID" />
        </label>
        <select v-model="filters.entityType" title="Modulo">
          <option value="">Todos los módulos</option>
          <option v-for="option in options.entityTypes" :key="option.value" :value="option.value">
            {{ optionLabel(option, entityLabels) }}
          </option>
        </select>
        <select v-model="filters.actionGroup" title="Tipo de evento">
          <option v-for="group in actionGroups" :key="group.value" :value="group.value">
            {{ group.label }}
          </option>
        </select>
        <select v-model="filters.actorEmail" title="Usuario">
          <option value="">Todos los usuarios</option>
          <option v-for="option in options.actors" :key="option.value" :value="option.value">
            {{ optionLabel(option) }}
          </option>
        </select>
        <input v-model="filters.dateFrom" type="date" title="Desde" />
        <input v-model="filters.dateTo" type="date" title="Hasta" />
        <button class="primary-inline" type="submit" :disabled="pageBusy">
          <Search :size="16" />
          Filtrar
        </button>
      </form>

      <div class="audit-subtoolbar">
        <button class="secondary-action" type="button" :disabled="pageBusy" @click="clearFilters">
          <FilterX :size="16" />
          Limpiar filtros
        </button>
        <label>
          <span>Mostrar</span>
          <select v-model.number="filters.limit" @change="loadAudit(true)">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="150">150</option>
            <option :value="200">200</option>
          </select>
        </label>
      </div>

      <div class="table-shell">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Evento</th>
              <th>Modulo</th>
              <th>Usuario</th>
              <th>Registro</th>
              <th>Cambio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pageBusy">
              <td colspan="7" class="empty-cell">Cargando bitácora...</td>
            </tr>
            <tr v-else-if="!logs.length">
              <td colspan="7" class="empty-cell">No hay eventos con los filtros seleccionados.</td>
            </tr>
            <template v-else>
              <tr v-for="log in logs" :key="log.id">
                <td>
                  <strong>{{ formatDateTime(log.createdAt) }}</strong>
                  <span>{{ log.entityId || 'Sin ID visible' }}</span>
                </td>
                <td>
                  <span class="badge" :class="actionClass(log.action)">{{ actionLabel(log.action) }}</span>
                </td>
                <td>
                  <strong>{{ entityLabel(log.entityType) }}</strong>
                  <span>{{ log.entityType }}</span>
                </td>
                <td>
                  <strong>{{ log.actorEmail || 'Sistema' }}</strong>
                </td>
                <td>
                  <strong>{{ recordLabel(log) }}</strong>
                </td>
                <td>
                  <span class="audit-change-text">{{ rowSummary(log) }}</span>
                </td>
                <td class="row-actions">
                  <button class="icon-button" type="button" title="Ver detalle" @click="selectedLog = log">
                    <Eye :size="17" />
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div class="audit-pagination">
        <span>
          Mostrando {{ pagination.offset + (logs.length ? 1 : 0) }} -
          {{ pagination.offset + logs.length }} de {{ summary.total }}
        </span>
        <div>
          <button class="secondary-action" type="button" :disabled="!canGoBack || pageBusy" @click="goBack">Anterior</button>
          <button class="secondary-action" type="button" :disabled="!canGoNext || pageBusy" @click="goNext">Siguiente</button>
        </div>
      </div>
    </section>

    <div v-if="selectedLog" class="modal-backdrop" @click.self="closeDetail">
      <section class="modal-card large audit-detail-modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Detalle de auditoría</p>
            <h3>{{ actionLabel(selectedLog.action) }}</h3>
            <span>{{ formatDateTime(selectedLog.createdAt) }} - {{ selectedLog.actorEmail || 'Sistema' }}</span>
          </div>
          <button class="icon-button" type="button" title="Cerrar" @click="closeDetail">
            <X :size="17" />
          </button>
        </div>

        <div class="audit-detail-header">
          <span class="badge" :class="actionClass(selectedLog.action)">{{ entityLabel(selectedLog.entityType) }}</span>
          <strong>{{ recordLabel(selectedLog) }}</strong>
          <small>{{ selectedLog.entityId || 'Sin ID visible' }}</small>
        </div>

        <div v-if="selectedChangedFields.length" class="audit-chips">
          <span v-for="field in selectedChangedFields" :key="field">{{ field }}</span>
        </div>
        <div v-else class="security-box audit-empty-diff">
          <AlertTriangle :size="18" />
          <span>No se detectaron diferencias simples entre el antes y despues. Revisa los datos crudos del evento.</span>
        </div>

        <div class="audit-detail-grid">
          <article class="audit-detail-panel">
            <h4>Antes</h4>
            <dl v-if="dataRows(selectedLog.beforeData).length">
              <template v-for="[key, value] in dataRows(selectedLog.beforeData)" :key="key">
                <dt>{{ key }}</dt>
                <dd>{{ shortValue(value) }}</dd>
              </template>
            </dl>
            <p v-else>Sin datos previos.</p>
          </article>
          <article class="audit-detail-panel">
            <h4>Despues</h4>
            <dl v-if="dataRows(selectedLog.afterData).length">
              <template v-for="[key, value] in dataRows(selectedLog.afterData)" :key="key">
                <dt>{{ key }}</dt>
                <dd>{{ shortValue(value) }}</dd>
              </template>
            </dl>
            <p v-else>Sin datos posteriores.</p>
          </article>
        </div>

        <details class="audit-json-details">
          <summary>Ver JSON técnico</summary>
          <div class="audit-json-grid">
            <pre>{{ formatJson(selectedLog.beforeData) }}</pre>
            <pre>{{ formatJson(selectedLog.afterData) }}</pre>
          </div>
        </details>
      </section>
    </div>
  </section>
</template>
