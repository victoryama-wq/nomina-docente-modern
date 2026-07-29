<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileSearch,
  FileUp,
  Info,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert
} from 'lucide-vue-next';
import {
  ApiRequestError,
  applyTeacherImport,
  downloadTeacherImportTemplate,
  previewTeacherImport,
  type TeacherImportAction,
  type TeacherImportApplyResult,
  type TeacherImportPreview,
  type TeacherImportPreviewRow,
  type TeacherImportRiskAction,
  type TeacherImportTemplateScope,
  type TeacherImportValues
} from '../../api';
import ConfirmModal from '../modals/ConfirmModal.vue';

type ResultFilter = 'TODOS' | 'NUEVOS' | 'ACTUALIZACIONES' | 'SIN_CAMBIOS' | 'ADVERTENCIAS' | 'BLOQUEANTES';

const emit = defineEmits<{
  (event: 'applied', result: TeacherImportApplyResult): void;
}>();

const MAX_FILE_BYTES = 1024 * 1024;
const headers =
  'id,identificador,nombres,apellido_paterno,apellido_materno,responsable_operativo_email,categoria,telefono,ubicacion,estatus';

const actionLabels: Record<TeacherImportAction, string> = {
  NUEVO: 'Nuevo',
  ACTUALIZAR_IDENTIFICADOR: 'Actualizar identificador',
  ACTUALIZAR_NOMBRE: 'Actualizar nombre',
  ACTUALIZAR_RESPONSABLE_OPERATIVO: 'Asignar responsable',
  REASIGNAR_RESPONSABLE_OPERATIVO: 'Reasignar responsable',
  ACTUALIZAR_CATEGORIA: 'Actualizar categoría',
  ACTUALIZAR_CONTACTO: 'Actualizar contacto',
  ACTUALIZAR_ESTATUS: 'Actualizar estatus',
  ACTUALIZAR_MULTIPLE: 'Actualización múltiple',
  INACTIVAR: 'Inactivar',
  REACTIVAR: 'Reactivar',
  SIN_CAMBIOS: 'Sin cambios',
  ID_NO_ENCONTRADO: 'ID no encontrado',
  ID_INVALIDO: 'ID inválido',
  ID_IDENTIFICADOR_INCOMPATIBLE: 'ID e identificador incompatibles',
  IDENTIFICADOR_DUPLICADO_CSV: 'Identificador duplicado en CSV',
  IDENTIFICADOR_DUPLICADO_BD: 'Identificador duplicado',
  DUPLICADO_NOMBRE_CSV: 'Nombre duplicado en CSV',
  POSIBLE_DUPLICADO_NOMBRE: 'Posible docente duplicado',
  RESPONSABLE_NO_ENCONTRADO: 'Responsable no encontrado',
  RESPONSABLE_INACTIVO: 'Responsable inactivo',
  RESPONSABLE_AMBIGUO: 'Responsable ambiguo',
  RESPONSABLE_NO_AUTORIZADO: 'Responsable no autorizado',
  RESPONSABLE_OPERATIVO_REQUERIDO: 'Responsable requerido',
  CATEGORIA_INVALIDA: 'Categoría inválida',
  ESTATUS_INVALIDO: 'Estatus inválido',
  CAMPO_OBLIGATORIO_FALTANTE: 'Campo obligatorio faltante',
  INACTIVACION_CON_DEPENDENCIAS: 'Inactivación bloqueada',
  ERROR: 'Error'
};

const riskLabels: Record<TeacherImportRiskAction, string> = {
  REASIGNAR_RESPONSABLE_OPERATIVO: 'Confirmo la reasignación de responsables operativos.',
  INACTIVAR: 'Confirmo la inactivación de los docentes indicados.',
  ACTUALIZAR_CATEGORIA: 'Confirmo los cambios de categoría.',
  ACTUALIZAR_NOMBRE: 'Confirmo las modificaciones de nombres y apellidos.',
  ACTUALIZAR_MULTIPLE: 'Confirmo las actualizaciones múltiples.'
};

const errorLabels: Record<string, string> = {
  ID_NO_ENCONTRADO: 'El ID indicado no corresponde a un docente.',
  ID_INVALIDO: 'El ID no tiene un formato válido.',
  ID_IDENTIFICADOR_INCOMPATIBLE: 'El ID y el identificador corresponden a docentes diferentes.',
  IDENTIFICADOR_DUPLICADO_CSV: 'El identificador aparece más de una vez en el CSV.',
  IDENTIFICADOR_DUPLICADO_BD: 'El identificador ya está asignado a otro docente.',
  DUPLICADO_NOMBRE_CSV: 'El nombre aparece más de una vez en el CSV.',
  POSIBLE_DUPLICADO_NOMBRE: 'Existe un posible docente con el mismo nombre.',
  RESPONSABLE_NO_ENCONTRADO: 'El responsable operativo no existe.',
  RESPONSABLE_INACTIVO: 'El responsable operativo está inactivo.',
  RESPONSABLE_AMBIGUO: 'El responsable operativo no puede resolverse de forma única.',
  RESPONSABLE_NO_AUTORIZADO: 'El usuario no tiene un rol autorizado como responsable operativo.',
  RESPONSABLE_OPERATIVO_REQUERIDO: 'Para modificar este docente debes asignar un responsable operativo válido en el CSV.',
  CATEGORIA_INVALIDA: 'La categoría debe ser V, M o N.',
  ESTATUS_INVALIDO: 'El estatus debe ser ACTIVO o INACTIVO.',
  CAMPO_OBLIGATORIO_FALTANTE: 'Falta un campo obligatorio.',
  INACTIVACION_CON_DEPENDENCIAS: 'El docente tiene actividad operativa y no puede inactivarse.',
  ARCHIVO_EXCEDE_LIMITE: 'El archivo supera el límite permitido de 1 MiB o 5,000 filas.',
  ENCABEZADO_INVALIDO: 'Los encabezados no coinciden con la plantilla oficial.',
  PREVIEW_OBSOLETO: 'Los datos cambiaron después de generar la vista previa. Genera una nueva vista previa antes de aplicar.',
  CONFIRMACION_INSUFICIENTE: 'Faltan confirmaciones de riesgo. Revisa y confirma cada categoría mostrada.',
  FORBIDDEN: 'No tienes permisos para importar docentes.',
  ERROR: 'No fue posible completar la importación.'
};

const detailFields: Array<{ key: keyof TeacherImportValues; label: string }> = [
  { key: 'identifier', label: 'Identificador' },
  { key: 'firstNames', label: 'Nombres' },
  { key: 'paternalLastName', label: 'Apellido paterno' },
  { key: 'maternalLastName', label: 'Apellido materno' },
  { key: 'derivedName', label: 'Nombre derivado' },
  { key: 'responsibleEmail', label: 'Correo del responsable' },
  { key: 'responsibleName', label: 'Responsable operativo' },
  { key: 'category', label: 'Categoría' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'location', label: 'Ubicación' },
  { key: 'status', label: 'Estatus' }
];

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const base64Data = ref('');
const preview = ref<TeacherImportPreview | null>(null);
const previewLoading = ref(false);
const applyLoading = ref(false);
const downloadLoading = ref<TeacherImportTemplateScope | null>(null);
const activeFilter = ref<ResultFilter>('TODOS');
const actionFilter = ref<'TODAS' | TeacherImportAction>('TODAS');
const searchTerm = ref('');
const generalConfirmed = ref(false);
const confirmedRiskActions = ref<TeacherImportRiskAction[]>([]);
const errorMessage = ref('');
const successResult = ref<TeacherImportApplyResult | null>(null);
const detailRow = ref<TeacherImportPreviewRow | null>(null);
const allTemplateConfirmationOpen = ref(false);
const applyConfirmationOpen = ref(false);

const operationsBusy = computed(
  () => previewLoading.value || applyLoading.value || downloadLoading.value !== null
);

const requiredRiskActions = computed(() => preview.value?.requiresSecondConfirmation || []);
const missingRiskActions = computed(() =>
  requiredRiskActions.value.filter((action) => !confirmedRiskActions.value.includes(action))
);
const blockingRows = computed(() => preview.value?.rows.filter((row) => row.blocking).length || 0);
const warningRows = computed(() => preview.value?.rows.filter((row) => row.warnings.length > 0).length || 0);

const canApply = computed(
  () =>
    Boolean(selectedFile.value && base64Data.value && preview.value) &&
    !preview.value?.hasBlockingErrors &&
    blockingRows.value === 0 &&
    generalConfirmed.value &&
    missingRiskActions.value.length === 0 &&
    !operationsBusy.value
);

const availableActions = computed(() => {
  if (!preview.value) return [];
  return [...new Set(preview.value.rows.map((row) => row.action))];
});

const filteredRows = computed(() => {
  if (!preview.value) return [];
  const query = normalizeSearch(searchTerm.value);
  return preview.value.rows.filter((row) => {
    const matchesResult =
      activeFilter.value === 'TODOS' ||
      (activeFilter.value === 'NUEVOS' && row.action === 'NUEVO') ||
      (activeFilter.value === 'ACTUALIZACIONES' && isUpdateAction(row.action)) ||
      (activeFilter.value === 'SIN_CAMBIOS' && row.action === 'SIN_CAMBIOS') ||
      (activeFilter.value === 'ADVERTENCIAS' && row.warnings.length > 0) ||
      (activeFilter.value === 'BLOQUEANTES' && row.blocking);
    const matchesAction = actionFilter.value === 'TODAS' || row.action === actionFilter.value;
    if (!matchesResult || !matchesAction) return false;
    if (!query) return true;
    return normalizeSearch(
      [
        row.rowNumber,
        row.teacherName,
        row.current?.identifier,
        row.proposed?.identifier,
        row.current?.responsibleEmail,
        row.proposed?.responsibleEmail,
        row.message,
        ...row.warnings,
        ...row.errors
      ].join(' ')
    ).includes(query);
  });
});

const summaryCards = computed(() => {
  const rows = preview.value?.rows || [];
  const count = (predicate: (row: TeacherImportPreviewRow) => boolean) => rows.filter(predicate).length;
  return [
    { label: 'Total de filas', value: preview.value?.totalRows || 0 },
    { label: 'Nuevos', value: count((row) => row.action === 'NUEVO') },
    { label: 'Actualizaciones', value: count((row) => isUpdateAction(row.action)) },
    { label: 'Sin cambios', value: count((row) => row.action === 'SIN_CAMBIOS') },
    { label: 'Reasignaciones', value: count((row) => row.action === 'REASIGNAR_RESPONSABLE_OPERATIVO') },
    { label: 'Inactivaciones', value: count((row) => row.action === 'INACTIVAR') },
    { label: 'Reactivaciones', value: count((row) => row.action === 'REACTIVAR') },
    { label: 'Advertencias', value: warningRows.value },
    { label: 'Errores bloqueantes', value: blockingRows.value }
  ];
});

const applyConfirmationDetails = computed(() => {
  const rows = preview.value?.rows || [];
  const count = (action: TeacherImportAction) => rows.filter((row) => row.action === action).length;
  return [
    `Archivo: ${selectedFile.value?.name || 'Sin archivo'}`,
    `Total de filas: ${preview.value?.totalRows || 0}`,
    `Nuevos: ${count('NUEVO')}`,
    `Actualizaciones: ${rows.filter((row) => isUpdateAction(row.action)).length}`,
    `Inactivaciones: ${count('INACTIVAR')}`,
    `Reactivaciones: ${count('REACTIVAR')}`,
    `Sin cambios: ${count('SIN_CAMBIOS')}`,
    `Advertencias: ${warningRows.value}`,
    `Riesgos confirmados: ${confirmedRiskActions.value.map((action) => actionLabels[action]).join(', ') || 'Ninguno'}`
  ];
});

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isUpdateAction(action: TeacherImportAction): boolean {
  return (
    action.startsWith('ACTUALIZAR_') ||
    action === 'REASIGNAR_RESPONSABLE_OPERATIVO' ||
    action === 'INACTIVAR' ||
    action === 'REACTIVAR'
  );
}

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 1024 * 100 ? 1 : 0)} KiB`;
}

function actionLabel(action: TeacherImportAction): string {
  return actionLabels[action] || action;
}

function rowStatus(row: TeacherImportPreviewRow): string {
  if (row.blocking) return 'Bloqueante';
  if (row.warnings.length > 0) return 'Advertencia';
  if (row.action === 'SIN_CAMBIOS') return 'Sin cambios';
  return 'Correcto';
}

function rowStatusClass(row: TeacherImportPreviewRow): string {
  if (row.blocking) return 'danger';
  if (row.warnings.length > 0) return 'warning';
  if (row.action === 'SIN_CAMBIOS') return 'muted';
  return 'ok';
}

function displayValue(value: string | undefined | null, key?: keyof TeacherImportValues): string {
  if (!value) return key === 'responsibleEmail' || key === 'responsibleName' ? 'Sin responsable' : 'Sin dato';
  return value;
}

function changed(row: TeacherImportPreviewRow, key: keyof TeacherImportValues): boolean {
  return (row.current?.[key] || '') !== (row.proposed?.[key] || '');
}

function resetPreviewState() {
  preview.value = null;
  activeFilter.value = 'TODOS';
  actionFilter.value = 'TODAS';
  searchTerm.value = '';
  generalConfirmed.value = false;
  confirmedRiskActions.value = [];
  detailRow.value = null;
  applyConfirmationOpen.value = false;
}

function resetFlow(keepSuccess = false) {
  selectedFile.value = null;
  base64Data.value = '';
  resetPreviewState();
  errorMessage.value = '';
  if (!keepSuccess) successResult.value = null;
  if (fileInput.value) fileInput.value.value = '';
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  resetFlow();
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    errorMessage.value = 'Selecciona un archivo con extensión .csv.';
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    errorMessage.value = 'El archivo supera el máximo orientativo de 1 MiB.';
    return;
  }
  selectedFile.value = file;
  try {
    base64Data.value = await fileToBase64(file);
  } catch {
    selectedFile.value = null;
    errorMessage.value = 'No fue posible leer el archivo seleccionado.';
  }
}

async function executeTemplateDownload(scope: TeacherImportTemplateScope) {
  if (downloadLoading.value) return;
  downloadLoading.value = scope;
  errorMessage.value = '';
  try {
    await downloadTeacherImportTemplate(scope);
  } catch (error) {
    errorMessage.value = errorText(error, 'No fue posible descargar la plantilla de docentes.');
  } finally {
    downloadLoading.value = null;
  }
}

function requestTemplate(scope: TeacherImportTemplateScope) {
  if (scope === 'all') {
    allTemplateConfirmationOpen.value = true;
    return;
  }
  void executeTemplateDownload(scope);
}

async function confirmAllTemplateDownload() {
  allTemplateConfirmationOpen.value = false;
  await executeTemplateDownload('all');
}

async function generatePreview() {
  if (!selectedFile.value || !base64Data.value || operationsBusy.value) return;
  previewLoading.value = true;
  errorMessage.value = '';
  successResult.value = null;
  resetPreviewState();
  try {
    preview.value = (
      await previewTeacherImport({
        fileName: selectedFile.value.name,
        base64Data: base64Data.value
      })
    ).preview;
  } catch (error) {
    errorMessage.value = errorText(error, 'No fue posible generar la vista previa.');
  } finally {
    previewLoading.value = false;
  }
}

function toggleRiskAction(action: TeacherImportRiskAction, checked: boolean) {
  confirmedRiskActions.value = checked
    ? [...new Set([...confirmedRiskActions.value, action])]
    : confirmedRiskActions.value.filter((item) => item !== action);
}

function openApplyConfirmation() {
  if (canApply.value) applyConfirmationOpen.value = true;
}

async function confirmApply() {
  if (!selectedFile.value || !preview.value || !canApply.value || applyLoading.value) return;
  applyLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await applyTeacherImport({
      fileName: selectedFile.value.name,
      base64Data: base64Data.value,
      fileSha256: preview.value.fileSha256,
      teachersFingerprint: preview.value.teachersFingerprint,
      responsibleUsersFingerprint: preview.value.responsibleUsersFingerprint,
      confirmedRiskActions: [...confirmedRiskActions.value]
    });
    applyConfirmationOpen.value = false;
    successResult.value = response.result;
    emit('applied', response.result);
    resetFlow(true);
  } catch (error) {
    applyConfirmationOpen.value = false;
    const code = error instanceof ApiRequestError ? error.code : 'ERROR';
    errorMessage.value = errorText(error, 'No fue posible aplicar la importación.');
    generalConfirmed.value = false;
    confirmedRiskActions.value = [];
    if (
      code === 'PREVIEW_OBSOLETO' ||
      code === 'IDENTIFICADOR_DUPLICADO' ||
      code === 'IDENTIFICADOR_DUPLICADO_BD' ||
      code === 'POSIBLE_DUPLICADO_NOMBRE'
    ) {
      preview.value = null;
    }
  } finally {
    applyLoading.value = false;
  }
}

function errorText(error: unknown, fallback: string): string {
  if (!(error instanceof ApiRequestError)) return fallback;
  if (error.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
  if (error.status === 403) return 'No tienes permisos para importar docentes.';
  if (error.status >= 500) return 'Ocurrió un error al procesar la importación. Intenta nuevamente.';
  return errorLabels[error.code] || error.message || fallback;
}
</script>

<template>
  <section class="teacher-import-panel" aria-labelledby="teacher-import-heading">
    <div class="import-intro">
      <div>
        <p class="eyebrow">Operación masiva controlada</p>
        <h3 id="teacher-import-heading">Importación de docentes</h3>
        <p>
          Actualiza o registra docentes mediante un archivo CSV controlado. Primero descarga una plantilla,
          modifica únicamente los campos necesarios y ejecuta una vista previa antes de aplicar los cambios.
        </p>
      </div>
      <div class="security-box import-security">
        <ShieldAlert :size="19" />
        <span>Solo maneja datos operativos. No contiene ni modifica datos fiscales.</span>
      </div>
    </div>

    <details class="import-help">
      <summary><Info :size="16" /> Reglas y columnas de la plantilla</summary>
      <div class="help-content">
        <ul>
          <li>No elimines filas para inactivar; usa <strong>estatus=INACTIVO</strong>.</li>
          <li>Una ausencia en el archivo no cambia al docente.</li>
          <li>Conserva <strong>id</strong> para editar y déjalo vacío para una nueva alta.</li>
          <li>Una celda vacía en un docente existente conserva el valor actual.</li>
          <li>Apply modifica todos los cambios válidos de forma atómica; no existe aplicación parcial.</li>
        </ul>
        <code>{{ headers }}</code>
        <dl>
          <div><dt>id</dt><dd>Conservar para editar; vacío para nueva alta.</dd></div>
          <div><dt>identificador</dt><dd>Identificador institucional.</dd></div>
          <div><dt>nombres</dt><dd>Nombres del docente.</dd></div>
          <div><dt>apellido_paterno</dt><dd>Obligatorio para alta.</dd></div>
          <div><dt>apellido_materno</dt><dd>Opcional.</dd></div>
          <div><dt>responsable_operativo_email</dt><dd>Usuario responsable autorizado.</dd></div>
          <div><dt>categoria</dt><dd>V, M o N.</dd></div>
          <div><dt>telefono / ubicacion</dt><dd>Datos operativos opcionales.</dd></div>
          <div><dt>estatus</dt><dd>ACTIVO o INACTIVO.</dd></div>
        </dl>
      </div>
    </details>

    <div class="template-actions" aria-label="Plantillas de importación">
      <button
        class="primary-inline"
        type="button"
        :disabled="operationsBusy"
        @click="requestTemplate('active')"
      >
        <Loader2 v-if="downloadLoading === 'active'" :size="17" class="spin" />
        <Download v-else :size="17" />
        Descargar docentes activos
      </button>
      <button class="secondary-action" type="button" :disabled="operationsBusy" @click="requestTemplate('blank')">
        <Loader2 v-if="downloadLoading === 'blank'" :size="17" class="spin" />
        <Download v-else :size="17" />
        Descargar plantilla vacía
      </button>
      <button class="secondary-action" type="button" :disabled="operationsBusy" @click="requestTemplate('all')">
        <Loader2 v-if="downloadLoading === 'all'" :size="17" class="spin" />
        <Download v-else :size="17" />
        Descargar todos los docentes
      </button>
    </div>

    <div class="file-workflow">
      <label class="file-field">
        <span>Seleccionar archivo CSV</span>
        <input
          ref="fileInput"
          type="file"
          accept=".csv,text/csv"
          :disabled="operationsBusy"
          @change="selectFile"
        />
      </label>
      <div v-if="selectedFile" class="selected-file" aria-live="polite">
        <FileUp :size="18" />
        <span><strong>{{ selectedFile.name }}</strong><small>{{ readableSize(selectedFile.size) }}</small></span>
      </div>
      <button
        class="primary-inline"
        type="button"
        :disabled="!selectedFile || !base64Data || operationsBusy"
        @click="generatePreview"
      >
        <Loader2 v-if="previewLoading" :size="17" class="spin" />
        <FileSearch v-else :size="17" />
        {{ previewLoading ? 'Generando vista previa...' : 'Generar vista previa' }}
      </button>
      <button
        v-if="selectedFile || preview || successResult"
        class="icon-button"
        type="button"
        title="Limpiar importación"
        :disabled="operationsBusy"
        @click="resetFlow()"
      >
        <RotateCcw :size="17" />
      </button>
    </div>

    <p v-if="errorMessage" class="form-error import-message" aria-live="assertive">{{ errorMessage }}</p>

    <section v-if="successResult" class="success-result" aria-live="polite">
      <CheckCircle2 :size="22" />
      <div>
        <h4>La importación fue aplicada correctamente.</h4>
        <p>
          {{ successResult.created }} creados, {{ successResult.updated }} actualizados,
          {{ successResult.unchanged }} sin cambios, {{ successResult.inactivated }} inactivados y
          {{ successResult.reactivated }} reactivados.
        </p>
        <p>
          Responsables asignados: {{ successResult.responsibleAssigned }}.
          Reasignados: {{ successResult.responsibleReassigned }}. Advertencias: {{ successResult.warnings }}.
        </p>
      </div>
      <button class="secondary-action" type="button" @click="successResult = null">Finalizar</button>
    </section>

    <template v-if="preview">
      <div class="summary-grid" aria-label="Resumen de vista previa">
        <article v-for="card in summaryCards" :key="card.label">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
        </article>
      </div>

      <div class="preview-status" :class="preview.hasBlockingErrors ? 'blocked' : 'ready'" aria-live="polite">
        <AlertTriangle v-if="preview.hasBlockingErrors" :size="19" />
        <CheckCircle2 v-else :size="19" />
        <span>
          {{
            preview.hasBlockingErrors
              ? 'Hay errores bloqueantes. Corrige el CSV y genera una nueva vista previa.'
              : 'Vista previa lista. Ningún cambio se ha aplicado todavía.'
          }}
        </span>
      </div>

      <div class="preview-filters">
        <label>
          <span>Resultado</span>
          <select v-model="activeFilter">
            <option value="TODOS">Todos</option>
            <option value="NUEVOS">Nuevos</option>
            <option value="ACTUALIZACIONES">Actualizaciones</option>
            <option value="SIN_CAMBIOS">Sin cambios</option>
            <option value="ADVERTENCIAS">Advertencias</option>
            <option value="BLOQUEANTES">Bloqueantes</option>
          </select>
        </label>
        <label>
          <span>Acción</span>
          <select v-model="actionFilter">
            <option value="TODAS">Todas</option>
            <option v-for="action in availableActions" :key="action" :value="action">
              {{ actionLabel(action) }}
            </option>
          </select>
        </label>
        <label class="search-box import-search">
          <Search :size="17" />
          <input
            v-model="searchTerm"
            placeholder="Buscar fila, docente, identificador o responsable"
          />
        </label>
      </div>
      <p class="result-count">Mostrando {{ filteredRows.length }} de {{ preview.rows.length }} filas</p>

      <div class="table-shell import-preview-table">
        <table>
          <thead>
            <tr>
              <th>Fila</th>
              <th>Docente</th>
              <th>Identificador</th>
              <th>Acción</th>
              <th>Estado</th>
              <th>Observación</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filteredRows.length">
              <td colspan="7" class="empty-cell">No hay filas con los filtros actuales.</td>
            </tr>
            <tr v-for="row in filteredRows" :key="row.rowNumber">
              <td>{{ row.rowNumber }}</td>
              <td><strong>{{ row.proposed?.derivedName || row.current?.derivedName || row.teacherName || 'Sin dato' }}</strong></td>
              <td>{{ row.proposed?.identifier || row.current?.identifier || 'Sin dato' }}</td>
              <td><span class="badge" :class="rowStatusClass(row)">{{ actionLabel(row.action) }}</span></td>
              <td><span class="status-text"><AlertTriangle v-if="row.blocking || row.warnings.length" :size="14" /><CheckCircle2 v-else :size="14" />{{ rowStatus(row) }}</span></td>
              <td>
                <span>{{ errorLabels[row.action] || row.message }}</span>
                <small v-if="row.warnings.includes('RESPONSABLE_OPERATIVO_AUSENTE')">
                  Advertencia: este docente no tiene responsable operativo asignado. La fila puede permanecer sin cambios.
                </small>
              </td>
              <td>
                <button class="secondary-action compact-action" type="button" @click="detailRow = row">
                  <Eye :size="15" /> Ver cambios
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="confirmation-section">
        <label class="confirmation-row" :class="{ disabled: preview.hasBlockingErrors }">
          <input
            v-model="generalConfirmed"
            type="checkbox"
            :disabled="preview.hasBlockingErrors || operationsBusy"
          />
          <span>Confirmo que revisé la vista previa y que los cambios mostrados corresponden al archivo seleccionado.</span>
        </label>
        <label v-for="risk in requiredRiskActions" :key="risk" class="confirmation-row">
          <input
            type="checkbox"
            :checked="confirmedRiskActions.includes(risk)"
            :disabled="preview.hasBlockingErrors || operationsBusy"
            @change="toggleRiskAction(risk, ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ riskLabels[risk] }}</span>
        </label>
      </div>

      <div class="apply-actions">
        <span v-if="missingRiskActions.length" class="pending-confirmations">
          Faltan {{ missingRiskActions.length }} confirmaciones de riesgo.
        </span>
        <button class="primary-inline" type="button" :disabled="!canApply" @click="openApplyConfirmation">
          <FileUp :size="17" />
          Aplicar importación
        </button>
      </div>
    </template>

    <div v-if="detailRow" class="modal-backdrop" @click.self="detailRow = null">
      <section class="modal-card large detail-modal" role="dialog" aria-modal="true" aria-labelledby="teacher-import-detail-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Fila {{ detailRow.rowNumber }}</p>
            <h3 id="teacher-import-detail-title">Cambios del docente</h3>
          </div>
          <button class="icon-button" type="button" title="Cerrar detalle" @click="detailRow = null">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div class="table-shell detail-table">
          <table>
            <thead><tr><th>Campo</th><th>Actual</th><th>Propuesto</th></tr></thead>
            <tbody>
              <tr v-for="field in detailFields" :key="field.key" :class="{ changed: changed(detailRow, field.key) }">
                <th>{{ field.label }}</th>
                <td>{{ displayValue(detailRow.current?.[field.key], field.key) }}</td>
                <td>{{ displayValue(detailRow.proposed?.[field.key], field.key) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="detailRow.dependencies" class="dependency-summary">
          <strong>Dependencias operativas</strong>
          <span>Horarios vigentes: {{ detailRow.dependencies.schedules }}</span>
          <span>Incidencias operativas: {{ detailRow.dependencies.incidences }}</span>
          <span>Extras vigentes: {{ detailRow.dependencies.extras }}</span>
          <span v-if="detailRow.dependencies.cycles.length">Ciclos: {{ detailRow.dependencies.cycles.join(', ') }}</span>
        </div>
        <div class="modal-actions">
          <button class="secondary-action" type="button" @click="detailRow = null">Cerrar</button>
        </div>
      </section>
    </div>

    <ConfirmModal
      :show="allTemplateConfirmationOpen"
      eyebrow="Descarga administrativa"
      title="Descargar todos los docentes"
      message="La plantilla completa incluirá docentes activos e inactivos. ¿Deseas continuar?"
      confirm-label="Descargar"
      icon="warning"
      tone="warning"
      :loading="downloadLoading === 'all'"
      @close="allTemplateConfirmationOpen = false"
      @confirm="confirmAllTemplateDownload"
    />

    <ConfirmModal
      :show="applyConfirmationOpen"
      eyebrow="Aplicación transaccional"
      title="Aplicar importación"
      :subject="selectedFile?.name || ''"
      message="Esta operación se aplicará de forma completa o no se aplicará. No existe aplicación parcial."
      :details="applyConfirmationDetails"
      confirm-label="Aplicar importación"
      icon="warning"
      tone="warning"
      :loading="applyLoading"
      :disabled="!canApply"
      @close="!applyLoading && (applyConfirmationOpen = false)"
      @confirm="confirmApply"
    />
  </section>
</template>

<style scoped>
.teacher-import-panel {
  display: grid;
  gap: 18px;
  min-width: 0;
}
.import-intro {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
}
.import-intro h3,
.success-result h4 {
  margin: 0 0 6px;
}
.import-intro p,
.success-result p {
  margin: 0;
  color: #526174;
}
.import-security {
  max-width: 360px;
  flex: 0 1 360px;
}
.import-help {
  border-top: 1px solid #d8e1eb;
  border-bottom: 1px solid #d8e1eb;
  padding: 12px 0;
}
.import-help summary {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 700;
}
.help-content {
  display: grid;
  gap: 12px;
  padding-top: 12px;
}
.help-content ul {
  margin: 0;
  padding-left: 20px;
}
.help-content code {
  display: block;
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 10px;
  background: #f5f7fa;
  border: 1px solid #e0e6ed;
}
.help-content dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 18px;
  margin: 0;
}
.help-content dl div {
  display: grid;
  grid-template-columns: minmax(130px, auto) 1fr;
  gap: 8px;
}
.help-content dt {
  font-weight: 700;
}
.help-content dd {
  margin: 0;
  color: #526174;
}
.template-actions,
.file-workflow,
.preview-filters,
.apply-actions {
  display: flex;
  align-items: end;
  gap: 10px;
  flex-wrap: wrap;
}
.file-workflow {
  padding: 14px 0;
}
.file-field {
  display: grid;
  gap: 6px;
  min-width: min(100%, 280px);
}
.selected-file {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.selected-file span {
  display: grid;
  min-width: 0;
}
.selected-file strong {
  overflow-wrap: anywhere;
}
.selected-file small,
.result-count,
.preview-table small {
  color: #5c6878;
}
.import-message {
  margin: 0;
}
.success-result {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: start;
  border-left: 4px solid #087f6d;
  background: #effaf6;
  padding: 14px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}
.summary-grid article {
  border: 1px solid #d8e1eb;
  border-radius: 6px;
  padding: 11px;
  display: grid;
  gap: 4px;
}
.summary-grid span {
  color: #5c6878;
  font-size: 0.78rem;
}
.summary-grid strong {
  font-size: 1.35rem;
}
.preview-status {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 13px;
  border-left: 4px solid;
}
.preview-status.ready {
  background: #effaf6;
  border-color: #087f6d;
}
.preview-status.blocked {
  background: #fff4f2;
  border-color: #b42318;
}
.preview-filters label:not(.search-box) {
  display: grid;
  gap: 5px;
}
.preview-filters select {
  min-width: 190px;
}
.import-search {
  flex: 1 1 300px;
}
.result-count {
  margin: -8px 0 0;
}
.import-preview-table {
  max-height: 460px;
  overflow: auto;
}
.import-preview-table td {
  vertical-align: top;
}
.import-preview-table td small {
  display: block;
  margin-top: 5px;
}
.status-text {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.compact-action {
  padding: 6px 9px;
  white-space: nowrap;
}
.confirmation-section {
  display: grid;
  gap: 10px;
}
.confirmation-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.confirmation-row input {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}
.confirmation-row.disabled {
  color: #7a8492;
}
.apply-actions {
  justify-content: flex-end;
}
.pending-confirmations {
  color: #8a5200;
}
.detail-modal {
  width: min(920px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow: auto;
}
.detail-table {
  overflow-x: auto;
}
.detail-table tr.changed {
  background: #fff9e9;
}
.dependency-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  border-left: 4px solid #b42318;
  background: #fff4f2;
  padding: 12px;
}
.dependency-summary strong {
  flex-basis: 100%;
}
@media (max-width: 720px) {
  .import-intro,
  .success-result {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
  .import-security {
    max-width: none;
    flex-basis: auto;
  }
  .template-actions > button,
  .file-workflow > button:not(.icon-button),
  .apply-actions > button {
    width: 100%;
    justify-content: center;
  }
  .help-content dl {
    grid-template-columns: 1fr;
  }
  .help-content dl div {
    grid-template-columns: 1fr;
  }
  .preview-filters {
    align-items: stretch;
  }
  .preview-filters label,
  .preview-filters select {
    width: 100%;
  }
  .detail-modal {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
  }
}
</style>
