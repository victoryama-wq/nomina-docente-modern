<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CheckCircle2, Download, FileSearch, FileUp, Loader2, ShieldAlert, X } from 'lucide-vue-next';
import {
  applySubjectImport,
  downloadSubjectImportTemplate,
  previewSubjectImport,
  type SubjectImportApplyResult,
  type SubjectImportClassification,
  type SubjectImportPreview
} from '../../api';

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'applied', result: SubjectImportApplyResult): void;
}>();

const file = ref<File | null>(null);
const base64Data = ref('');
const preview = ref<SubjectImportPreview | null>(null);
const classificationFilter = ref<'TODOS' | SubjectImportClassification>('TODOS');
const confirmed = ref(false);
const busy = ref(false);
const error = ref('');

const filteredRows = computed(() => {
  if (!preview.value) return [];
  return classificationFilter.value === 'TODOS'
    ? preview.value.rows
    : preview.value.rows.filter((row) => row.classification === classificationFilter.value);
});

const classifications = computed(() => {
  if (!preview.value) return [];
  return Object.entries(preview.value.summary)
    .filter(([, count]) => count > 0)
    .map(([name]) => name as SubjectImportClassification);
});

const canApply = computed(
  () => Boolean(preview.value && !preview.value.hasBlockingErrors && confirmed.value && !busy.value)
);

const updateCount = computed(() => {
  if (!preview.value) return 0;
  return (
    preview.value.summary.ACTUALIZAR_CLAVE +
    preview.value.summary.ACTUALIZAR_NOMBRE +
    preview.value.summary.ACTUALIZAR_ESTATUS +
    preview.value.summary.ACTUALIZAR_MULTIPLE +
    preview.value.summary.INACTIVAR
  );
});

function reset() {
  file.value = null;
  base64Data.value = '';
  preview.value = null;
  classificationFilter.value = 'TODOS';
  confirmed.value = false;
  busy.value = false;
  error.value = '';
}

watch(
  () => props.show,
  (show) => {
    if (!show) reset();
  }
);

function close() {
  if (busy.value) return;
  emit('close');
}

async function fileToBase64(selected: File): Promise<string> {
  const bytes = new Uint8Array(await selected.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0] || null;
  reset();
  file.value = selected;
  if (!selected) return;
  if (!selected.name.toLowerCase().endsWith('.csv')) {
    error.value = 'Selecciona un archivo con extension .csv.';
    return;
  }
  base64Data.value = await fileToBase64(selected);
}

async function validateFile() {
  if (!file.value || !base64Data.value) {
    error.value = 'Selecciona un CSV antes de validar.';
    return;
  }
  busy.value = true;
  error.value = '';
  confirmed.value = false;
  try {
    preview.value = (
      await previewSubjectImport({ fileName: file.value.name, base64Data: base64Data.value })
    ).preview;
  } catch (caught) {
    preview.value = null;
    error.value = caught instanceof Error ? caught.message : 'No fue posible validar el CSV.';
  } finally {
    busy.value = false;
  }
}

async function applyImport() {
  if (!file.value || !preview.value || !canApply.value) return;
  busy.value = true;
  error.value = '';
  try {
    const response = await applySubjectImport({
      fileName: file.value.name,
      base64Data: base64Data.value,
      fileSha256: preview.value.fileSha256,
      catalogFingerprint: preview.value.catalogFingerprint,
      confirmed: true
    });
    emit('applied', response.result);
    emit('close');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible aplicar la importacion.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="show" class="modal-backdrop" @click.self="close">
    <section class="modal-card import-modal" role="dialog" aria-modal="true" aria-labelledby="subject-import-title">
      <div class="modal-header">
        <div>
          <p class="eyebrow">Carga controlada</p>
          <h3 id="subject-import-title">Importar asignaturas</h3>
        </div>
        <button class="icon-button" type="button" title="Cerrar" :disabled="busy" @click="close">
          <X :size="18" />
        </button>
      </div>

      <div class="import-toolbar">
        <button class="secondary-action" type="button" @click="downloadSubjectImportTemplate('blank')">
          <Download :size="16" /> Plantilla vacia
        </button>
        <button class="secondary-action" type="button" @click="downloadSubjectImportTemplate('catalog')">
          <Download :size="16" /> Catalogo actual
        </button>
      </div>

      <div class="security-box">
        <FileUp :size="18" />
        <span>CSV UTF-8, maximo 512 KiB y 5,000 filas. Encabezados: id, clave, nombre, estatus.</span>
      </div>

      <label class="file-field">
        <span>Archivo CSV</span>
        <input type="file" accept=".csv,text/csv" :disabled="busy" @change="selectFile" />
      </label>

      <div class="import-toolbar">
        <button class="primary-inline" type="button" :disabled="!file || busy" @click="validateFile">
          <Loader2 v-if="busy" :size="16" class="spin" />
          <FileSearch v-else :size="16" />
          {{ busy ? 'Validando...' : 'Validar archivo' }}
        </button>
        <span v-if="file" class="file-name">{{ file.name }}</span>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>

      <template v-if="preview">
        <div class="preview-metrics">
          <div><span>Filas</span><strong>{{ preview.totalRows }}</strong></div>
          <div><span>Nuevas</span><strong>{{ preview.summary.NUEVA }}</strong></div>
          <div><span>Actualizar</span><strong>{{ updateCount }}</strong></div>
          <div><span>Sin cambios</span><strong>{{ preview.summary.SIN_CAMBIOS }}</strong></div>
        </div>

        <div class="preview-status" :class="preview.hasBlockingErrors ? 'blocked' : 'ready'">
          <ShieldAlert v-if="preview.hasBlockingErrors" :size="18" />
          <CheckCircle2 v-else :size="18" />
          <span>
            {{
              preview.hasBlockingErrors
                ? 'Hay errores bloqueantes. Corrige el CSV y vuelve a validarlo.'
                : 'Preview listo. Ningun cambio se ha aplicado todavia.'
            }}
          </span>
        </div>

        <label class="preview-filter">
          <span>Filtrar resultado</span>
          <select v-model="classificationFilter">
            <option value="TODOS">Todos</option>
            <option v-for="classification in classifications" :key="classification" :value="classification">
              {{ classification }}
            </option>
          </select>
        </label>

        <div class="table-shell preview-table">
          <table>
            <thead>
              <tr>
                <th>Fila</th>
                <th>Clave</th>
                <th>Nombre propuesto</th>
                <th>Antes</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredRows" :key="row.line">
                <td>{{ row.line }}</td>
                <td>{{ row.officialCode || 'Sin clave' }}</td>
                <td><strong>{{ row.name || 'Sin nombre' }}</strong><small>{{ row.status || 'Estatus invalido' }}</small></td>
                <td>
                  <span v-if="row.expectedCurrent">{{ row.expectedCurrent.name }}</span>
                  <span v-else>Nueva</span>
                </td>
                <td>
                  <span class="badge" :class="row.blocking ? 'danger' : 'ok'">{{ row.classification }}</span>
                  <small>{{ row.message }}</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <label class="confirmation-row" :class="{ disabled: preview.hasBlockingErrors }">
          <input v-model="confirmed" type="checkbox" :disabled="preview.hasBlockingErrors || busy" />
          <span>Confirmo aplicar el archivo completo con los cambios mostrados en este preview.</span>
        </label>
      </template>

      <div class="modal-actions">
        <button class="secondary-action" type="button" :disabled="busy" @click="close">Cancelar</button>
        <button class="primary-inline" type="button" :disabled="!canApply" @click="applyImport">
          <Loader2 v-if="busy" :size="16" class="spin" />
          <FileUp v-else :size="16" />
          Aplicar importacion
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.import-modal { width: min(1120px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; }
.import-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.file-field { display: grid; gap: 7px; }
.file-name { color: var(--muted, #526174); font-size: 0.9rem; overflow-wrap: anywhere; }
.preview-metrics { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px; }
.preview-metrics div { border: 1px solid #d8e1eb; padding: 12px; border-radius: 6px; display: grid; gap: 4px; }
.preview-metrics span, .preview-table small { color: #5c6878; font-size: 0.78rem; }
.preview-metrics strong { font-size: 1.35rem; }
.preview-status { display: flex; align-items: center; gap: 9px; padding: 11px 13px; border-left: 4px solid; }
.preview-status.ready { background: #effaf6; border-color: #087f6d; }
.preview-status.blocked { background: #fff4f2; border-color: #b42318; }
.preview-filter { display: flex; align-items: center; gap: 10px; }
.preview-filter select { min-width: 240px; }
.preview-table { max-height: 330px; overflow: auto; }
.preview-table td { vertical-align: top; }
.preview-table td strong, .preview-table td small { display: block; }
.confirmation-row { display: flex; align-items: flex-start; gap: 10px; }
.confirmation-row input { width: 18px; height: 18px; flex: 0 0 auto; }
.confirmation-row.disabled { color: #7a8492; }
@media (max-width: 720px) {
  .preview-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .import-modal { width: calc(100vw - 16px); max-height: calc(100vh - 16px); }
}
</style>
