<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Download, Eye, FileText, Pencil, RefreshCw, Save, Trash2, Upload, X } from 'lucide-vue-next';
import { fetchTeacherDossier, fetchDossierDocumentBlob, type DossierDocument, type DossierDocumentType, type TeacherDossier } from '../api';
import { dossierError, useDossierOperations } from '../composables/useDossierOperations';
import { dossierFilePayload, MAX_DOSSIER_SELECTION, validateDossierFile } from '../utils/dossierFiles';

const props = defineProps<{ teacherId: string; teacherName: string; show: boolean }>();
const emit = defineEmits<{ close: []; phoneSaved: [phone: string]; working: [busy: boolean] }>();
const dossier = ref<TeacherDossier | null>(null);
const phone = ref('');
const loading = ref(false);
const error = ref('');
const forbidden = ref(false);
const panel = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
let returnFocus: HTMLElement | null = null;
let disposed = false;
let loadVersion = 0;
let previewRequest = 0;
let previewTrigger: HTMLElement | null = null;
let contentBusy = false;
const preview = ref<{ url: string; fileName: string; documentId: string } | null>(null);
const previewBusy = ref(false);
const previewSection = ref<HTMLElement | null>(null);
const previewClose = ref<HTMLButtonElement | null>(null);
const confirmation = ref<{ kind: 'delete'; document: DossierDocument } | { kind: 'close' } | null>(null);
const edit = ref<{ document: DossierDocument; title: string; documentType: DossierDocumentType } | null>(null);
const replaceTarget = ref<DossierDocument | null>(null);
const replacement = ref<HTMLInputElement | null>(null);
const commonType = ref<DossierDocumentType>('OTRO');
const selected = ref<{ key: string; file: File; title: string; documentType: DossierDocumentType; error: string }[]>([]);
const types: { value: DossierDocumentType; label: string }[] = [
  { value: 'CURP', label: 'CURP' }, { value: 'ACTA_NACIMIENTO', label: 'Acta de nacimiento' },
  { value: 'CEDULA_PROFESIONAL', label: 'Cédula profesional' }, { value: 'TITULO', label: 'Título' }, { value: 'OTRO', label: 'Otro' }
];
const typeLabel = (value: DossierDocumentType) => types.find(t => t.value === value)?.label || value;
const dateLabel = (value: string) => new Date(value).toLocaleDateString('es-MX');
const phoneDirty = computed(() => !!dossier.value && phone.value !== dossier.value.teacher.phone);
const canManage = computed(() => !forbidden.value && !!dossier.value?.capabilities.manageDocuments);

async function load(resetPhone = false) {
  if (disposed) return;
  const version = ++loadVersion;
  loading.value = true;
  error.value = '';
  const dirty = phoneDirty.value;
  try {
    const data = await fetchTeacherDossier(props.teacherId);
    if (disposed || version !== loadVersion) return;
    dossier.value = data;
    if (!dirty || resetPhone) phone.value = data.teacher.phone || '';
    if (resetPhone) emit('phoneSaved', data.teacher.phone);
  } catch (err) {
    if (disposed || version !== loadVersion) return;
    error.value = dossierError(err);
    if ((err as { status?: number }).status === 403 || (err as { status?: number }).status === 401) deny();
  } finally { if (version === loadVersion) loading.value = false; }
}

function deny() {
  forbidden.value = true;
  dossier.value = null;
  selected.value = [];
  phone.value = '';
  edit.value = null;
  closePreview();
}
const { tasks, inFlight, unsettled, enqueue, retry, retryFailedUpload, refresh } = useDossierOperations(props.teacherId, async mutation => {
  await load(mutation?.action === 'contact');
}, deny);
const occupied = computed(() => unsettled.value || !!selected.value.length || phoneDirty.value || !!edit.value);
watch(occupied, value => emit('working', value), { immediate: true });

function chooseFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  error.value = '';
  if (!canManage.value || unsettled.value) return;
  if (selected.value.length + files.length > MAX_DOSSIER_SELECTION) {
    error.value = 'Selecciona como máximo 10 PDF por lote.';
    return;
  }
  selected.value.push(...files.map(file => ({ key: crypto.randomUUID(), file: markRaw(file), title: file.name.replace(/\.pdf$/i, ''), documentType: commonType.value, error: validateDossierFile(file) })));
}

function startUpload() {
  if (!canManage.value || unsettled.value) return;
  const valid = selected.value.filter(item => !item.error && item.title.trim() && item.title.trim().length <= 180);
  if (!valid.length) { error.value = 'Revisa los archivos y sus títulos antes de cargar.'; return; }
  selected.value = selected.value.filter(item => !valid.includes(item));
  for (const item of valid) {
    const title = item.title.trim();
    const documentType = item.documentType;
    enqueue(`Cargar: ${item.file.name}`, async () => ({ action: 'upload', payload: { ...await dossierFilePayload(item.file), title, documentType } }));
  }
}

function savePhone() {
  if (!dossier.value?.capabilities.editPhone || forbidden.value || unsettled.value || loading.value) return;
  const value = phone.value.trim();
  if (value && (!/^[\d+\s().-]+$/.test(value) || !/^\+?\d{10,15}$/.test(value.replace(/[\s().-]/g, '')))) {
    error.value = 'Escribe de 10 a 15 dígitos, con prefijo + opcional.';
    return;
  }
  const payload = { phone: value, expectedVersion: dossier.value.teacher.version };
  error.value = '';
  enqueue('Guardar teléfono', async () => ({ action: 'contact', payload }));
}

function saveMetadata() {
  if (!edit.value || !canManage.value || unsettled.value) return;
  const { document, title, documentType } = edit.value;
  if (!title.trim()) { error.value = 'Escribe un título para el documento.'; return; }
  enqueue(`Clasificar: ${document.fileName}`, async () => ({ action: 'metadata', documentId: document.id, payload: { title: title.trim(), documentType, expectedRevision: document.revision } }));
  edit.value = null;
}

function chooseReplacement(document: DossierDocument) {
  replaceTarget.value = document;
  replacement.value?.click();
}
function replaceFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const target = replaceTarget.value;
  input.value = '';
  replaceTarget.value = null;
  if (!file || !target || !canManage.value || unsettled.value) return;
  error.value = validateDossierFile(file);
  if (error.value) return;
  closePreview();
  enqueue(`Reemplazar: ${target.fileName}`, async () => ({ action: 'replace', documentId: target.id, payload: { ...await dossierFilePayload(file), expectedRevision: target.revision } }));
}
function confirmAction() {
  const action = confirmation.value;
  confirmation.value = null;
  if (action?.kind === 'close') { hide(); return; }
  if (action?.kind !== 'delete' || !canManage.value || unsettled.value) return;
  const target = action.document;
  closePreview();
  enqueue(`Eliminar: ${target.fileName}`, async () => ({ action: 'delete', documentId: target.id, payload: { expectedRevision: target.revision } }));
}

function closePreview() {
  previewRequest++;
  const wasOpen = !!preview.value;
  if (preview.value) URL.revokeObjectURL(preview.value.url);
  preview.value = null;
  if (wasOpen) void nextTick(() => { if (props.show && previewTrigger?.isConnected) previewTrigger.focus(); });
}
async function showPreview(doc: DossierDocument) {
  if (contentBusy || !dossier.value?.capabilities.readDocuments) return;
  closePreview();
  previewTrigger = document.activeElement as HTMLElement;
  const request = previewRequest;
  contentBusy = true;
  previewBusy.value = true;
  try {
    const file = await fetchDossierDocumentBlob(props.teacherId, doc.id);
    if (disposed || request !== previewRequest || !props.show) return;
    preview.value = { url: URL.createObjectURL(file.blob), fileName: file.fileName, documentId: doc.id };
    await nextTick();
    previewSection.value?.scrollIntoView?.({ block: 'start' });
    previewClose.value?.focus();
  } catch (err) { error.value = dossierError(err); }
  finally { contentBusy = false; previewBusy.value = false; }
}
async function downloadPreview() {
  if (!preview.value || contentBusy) return;
  const id = preview.value.documentId;
  const request = previewRequest;
  contentBusy = true;
  previewBusy.value = true;
  try {
    // Reauthorize the download; never bypass the endpoint with a persistent public URL.
    const file = await fetchDossierDocumentBlob(props.teacherId, id, true);
    if (disposed || request !== previewRequest || !props.show) return;
    const url = URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) { error.value = dossierError(err); }
  finally { contentBusy = false; previewBusy.value = false; }
}

function requestClose() {
  if (occupied.value) confirmation.value = { kind: 'close' };
  else hide();
}
function hide() {
  closePreview();
  emit('close');
  void nextTick(() => returnFocus?.focus());
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (occupied.value) { event.preventDefault(); event.returnValue = ''; }
}
function containFocus(event: FocusEvent) {
  if (props.show && panel.value && event.target instanceof Node && !panel.value.contains(event.target)) closeButton.value?.focus();
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (confirmation.value) confirmation.value = null;
    else if (preview.value) closePreview();
    else requestClose();
  }
  if (event.key === 'Tab') {
    const elements = Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), iframe, [tabindex="0"]') || []).filter(el => el.getClientRects().length);
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
}
watch(() => props.show, async visible => {
  if (visible) {
    returnFocus = document.activeElement as HTMLElement;
    await nextTick();
    closeButton.value?.focus();
  } else closePreview();
}, { immediate: true });
watch(confirmation, () => { void nextTick(() => { if (props.show) closeButton.value?.focus(); }); });
onMounted(() => { void load(); window.addEventListener('beforeunload', beforeUnload); document.addEventListener('focusin', containFocus); });
onBeforeUnmount(() => { disposed = true; closePreview(); window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('focusin', containFocus); });
</script>

<template>
  <div v-show="show" class="modal-backdrop dossier-backdrop" @click.self="requestClose" @keydown="keydown">
    <section ref="panel" class="modal-card dossier-panel" role="dialog" aria-modal="true" aria-labelledby="dossier-title">
      <header class="modal-header">
        <div><p class="eyebrow">Expediente docente</p><h3 id="dossier-title">{{ teacherName }}</h3></div>
        <button ref="closeButton" class="icon-button" type="button" aria-label="Cerrar expediente" title="Cerrar expediente" @click="requestClose"><X :size="20" /></button>
      </header>
      <div v-if="confirmation" class="dossier-confirm" role="alertdialog" aria-label="Confirmación">
        <h4>{{ confirmation.kind === 'delete' ? 'Eliminar definitivamente' : 'Cerrar expediente' }}</h4>
        <p v-if="confirmation.kind === 'delete'">{{ confirmation.document.fileName }} no podrá recuperarse desde la aplicación.</p>
        <p v-else>Hay cambios o cargas pendientes. Al cerrar este panel se conservan durante esta visita. Las operaciones aceptadas seguirán en el servidor; cerrar no las cancela. No recargues la página hasta confirmar su resultado.</p>
        <div class="dossier-actions"><button class="secondary-action" @click="confirmation = null">Volver</button><button class="primary-inline" @click="confirmAction">{{ confirmation.kind === 'delete' ? 'Eliminar definitivamente' : 'Cerrar panel' }}</button></div>
      </div>
      <template v-else>
        <p v-if="error" class="notice error" role="alert">{{ error }}</p>
        <p v-if="loading" role="status">Cargando expediente…</p>
        <div class="dossier-actions"><button class="secondary-action" :disabled="loading || inFlight > 0 || forbidden" @click="load()"><RefreshCw :size="16" /> Actualizar expediente</button></div>
        <template v-if="dossier && !forbidden">
          <form class="dossier-section dossier-contact" @submit.prevent="savePhone">
            <label>Teléfono operativo<input v-model="phone" type="tel" maxlength="20" autocomplete="off" :readonly="!dossier.capabilities.editPhone" :disabled="unsettled || loading" /></label>
            <button v-if="dossier.capabilities.editPhone" class="primary-inline" :disabled="!phoneDirty || unsettled || loading"><Save :size="16" /> Guardar teléfono</button>
            <small>Compartido con Directorio. Se actualiza allí al volver a consultar.</small>
          </form>
          <section class="dossier-section">
            <h4>Documentos adicionales <span class="badge neutral">{{ dossier.documents.length }}</span></h4>
            <p v-if="!dossier.capabilities.readDocuments">No tienes permiso para consultar documentos.</p>
            <template v-else>
              <p v-if="!dossier.documents.length">No hay documentos adicionales.</p>
              <ul class="dossier-documents">
                <li v-for="doc in dossier.documents" :key="doc.id">
                  <div class="dossier-document-name"><FileText :size="19" /><div><strong>{{ doc.title }}</strong><small>{{ doc.fileName }}</small><small>{{ typeLabel(doc.documentType) }} · {{ dateLabel(doc.createdAt) }} · {{ (doc.sizeBytes / 1024).toFixed(0) }} KiB</small><small v-if="doc.state !== 'AVAILABLE'">{{ doc.state === 'DELETING' ? 'Eliminación pendiente' : doc.state === 'REPLACING' ? 'Reemplazo pendiente' : 'Carga pendiente' }}</small></div></div>
                  <div class="dossier-actions">
                    <button class="icon-button" :disabled="previewBusy || !['AVAILABLE', 'REPLACING'].includes(doc.state)" :aria-label="`Ver ${doc.title}`" :title="`Ver ${doc.title}`" @click="showPreview(doc)"><Eye :size="18" /></button>
                    <template v-if="canManage">
                      <button class="icon-button" :disabled="unsettled || doc.state !== 'AVAILABLE'" :aria-label="`Clasificar ${doc.title}`" title="Editar título y tipo" @click="edit = { document: doc, title: doc.title, documentType: doc.documentType }"><Pencil :size="18" /></button>
                      <button class="icon-button" :disabled="unsettled || doc.state !== 'AVAILABLE'" :aria-label="`Reemplazar ${doc.title}`" title="Reemplazar PDF" @click="chooseReplacement(doc)"><Upload :size="18" /></button>
                      <button class="icon-button" :disabled="unsettled || doc.state !== 'AVAILABLE'" :aria-label="`Eliminar ${doc.title}`" title="Eliminar definitivamente" @click="confirmation = { kind: 'delete', document: doc }"><Trash2 :size="18" /></button>
                    </template>
                  </div>
                </li>
              </ul>
            </template>
            <input ref="replacement" class="dossier-hidden" type="file" accept="application/pdf,.pdf" aria-label="PDF de reemplazo" @change="replaceFile" />
            <form v-if="edit && canManage" class="dossier-edit" @submit.prevent="saveMetadata">
              <label>Título<input v-model="edit.title" maxlength="180" required /></label>
              <label>Tipo<select v-model="edit.documentType"><option v-for="type in types" :key="type.value" :value="type.value">{{ type.label }}</option></select></label>
              <div class="dossier-actions"><button type="button" class="secondary-action" @click="edit = null">Cancelar</button><button class="primary-inline" :disabled="unsettled"><Save :size="16" /> Guardar clasificación</button></div>
            </form>
          </section>
          <section v-if="canManage" class="dossier-section">
            <h4>Cargar PDF</h4>
            <p class="dossier-hint">Hasta 10 archivos por lote, 7.5 MiB por archivo. Se admiten varios documentos del mismo tipo.</p>
            <div class="dossier-upload-controls">
              <label>Tipo para la selección<select v-model="commonType" :disabled="unsettled"><option v-for="type in types" :key="type.value" :value="type.value">{{ type.label }}</option></select></label>
              <label>Seleccionar PDF<input type="file" multiple accept="application/pdf,.pdf" :disabled="unsettled" @change="chooseFiles" /></label>
            </div>
            <ul class="dossier-selection">
              <li v-for="item in selected" :key="item.key">
                <strong>{{ item.file.name }}</strong><p v-if="item.error" class="notice error" role="alert">{{ item.error }}</p>
                <div class="dossier-edit"><label>Título<input v-model="item.title" maxlength="180" :disabled="unsettled" /></label><label>Tipo<select v-model="item.documentType" :disabled="unsettled"><option v-for="type in types" :key="type.value" :value="type.value">{{ type.label }}</option></select></label><button class="icon-button" :disabled="unsettled" :aria-label="`Retirar ${item.file.name} de la selección`" title="Retirar de la selección" @click="selected = selected.filter(row => row.key !== item.key)"><X :size="18" /></button></div>
              </li>
            </ul>
            <button v-if="selected.length" class="primary-inline" :disabled="unsettled" @click="startUpload"><Upload :size="17" /> Cargar archivos válidos</button>
          </section>
        </template>
        <section v-if="tasks.length && !forbidden" class="dossier-section" aria-label="Resultado de operaciones" aria-live="polite">
          <h4>Operaciones</h4>
          <ul class="dossier-operations">
            <li v-for="task in tasks" :key="task.id">
              <div><strong>{{ task.label }}</strong><span>{{ task.message }}</span></div>
              <button v-if="['uncertain', 'retry'].includes(task.state)" class="secondary-action" @click="retry(task)"><RefreshCw :size="16" /> Reintentar misma operación</button>
              <button v-if="task.state === 'pending'" class="secondary-action" @click="refresh(task)"><RefreshCw :size="16" /> Consultar estado</button>
              <button v-if="task.state === 'failed' && task.action === 'upload' && canManage" class="secondary-action" :disabled="unsettled" @click="retryFailedUpload(task)"><Upload :size="16" /> Nuevo intento de este archivo</button>
            </li>
          </ul>
        </section>
        <section v-if="preview" ref="previewSection" class="dossier-section dossier-preview" aria-label="Vista previa PDF">
          <div class="dossier-preview-header"><h4>{{ preview.fileName }}</h4><div class="dossier-actions"><button class="secondary-action" :disabled="previewBusy" @click="downloadPreview"><Download :size="17" /> Descargar</button><button ref="previewClose" class="icon-button" aria-label="Cerrar vista previa" title="Cerrar vista previa" @click="closePreview"><X :size="18" /></button></div></div>
          <!-- Native PDF viewers reject sandboxed frames. Only verified PDF blobs reach this frame; never HTML or remote URLs. -->
          <iframe :src="preview.url" title="Vista previa del documento PDF" referrerpolicy="no-referrer"></iframe>
        </section>
      </template>
    </section>
  </div>
</template>

<style scoped>
.dossier-backdrop { z-index: 100; padding: 20px; }
.dossier-panel { width: min(980px, 100%); max-width: 100%; max-height: calc(100dvh - 40px); overflow-y: auto; box-sizing: border-box; }
.dossier-panel h3, .dossier-panel h4, .dossier-panel strong, .dossier-panel small, .dossier-panel p { overflow-wrap: anywhere; }
.dossier-panel h4 { margin: 0 0 12px; font-size: 17px; }
.dossier-panel .modal-header > div { min-width: 0; }
.dossier-section { border-top: 1px solid #d8e1e8; padding-top: 20px; margin-top: 20px; }
.dossier-panel label { display: flex; flex-direction: column; gap: 7px; min-width: 0; color: #46546b; font-size: 13px; font-weight: 700; }
.dossier-panel input, .dossier-panel select { min-width: 0; width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #bac9d8; border-radius: 6px; background: #fff; color: #18243a; font: inherit; font-weight: 400; box-sizing: border-box; }
.dossier-panel input[type=file] { padding: 8px; }
.dossier-panel :focus-visible { outline: 3px solid #167d9a; outline-offset: 2px; }
.dossier-panel :disabled { opacity: .65; cursor: not-allowed; }
.dossier-contact { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 12px; }
.dossier-contact small { grid-column: 1 / -1; color: #526176; }
.dossier-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.dossier-panel .icon-button { width: 40px; height: 40px; flex: 0 0 40px; }
.dossier-panel button { white-space: normal; }
.dossier-documents, .dossier-selection, .dossier-operations { padding: 0; margin: 12px 0; list-style: none; }
.dossier-documents li, .dossier-operations li { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid #e1e7ed; }
.dossier-document-name { display: flex; min-width: 0; gap: 10px; }
.dossier-document-name > svg { flex-shrink: 0; }
.dossier-document-name small, .dossier-operations span { display: block; color: #526176; margin-top: 4px; }
.dossier-edit, .dossier-upload-controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; margin: 12px 0; align-items: end; }
.dossier-selection li { padding: 14px 0; border-bottom: 1px solid #e1e7ed; }
.dossier-selection .dossier-edit { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; }
.dossier-hint { color: #526176; font-size: 14px; }
.dossier-hidden { display: none; }
.dossier-preview-header { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.dossier-preview iframe { display: block; width: 100%; height: min(65dvh, 620px); min-height: 250px; border: 1px solid #bac9d8; margin-top: 12px; }
.dossier-confirm { padding: 20px 0; }
@media (max-width: 700px) {
  .dossier-contact, .dossier-edit, .dossier-upload-controls, .dossier-selection .dossier-edit { grid-template-columns: minmax(0, 1fr); }
  .dossier-documents li, .dossier-operations li { flex-direction: column; gap: 10px; }
}
@media (max-width: 450px) {
  .dossier-backdrop { padding: 8px; }
  .dossier-panel { padding: 16px; max-height: calc(100dvh - 16px); }
}
</style>
