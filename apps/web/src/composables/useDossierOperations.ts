import { computed, onBeforeUnmount, ref } from 'vue';
import { ApiRequestError, fetchDossierOperation, mutateTeacherDossier, type DossierMutation, type DossierOperation } from '../api';

export type DossierTaskState = 'ready' | 'running' | 'pending' | 'uncertain' | 'retry' | 'complete' | 'failed' | 'rejected';
export interface DossierTask {
  id: string;
  label: string;
  state: DossierTaskState;
  message: string;
  prepare: () => Promise<DossierMutation>;
  mutation?: DossierMutation;
  polls: number;
  action?: DossierMutation['action'];
}

export function dossierError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.status === 403) return 'El acceso cambió. Vuelve a iniciar sesión o consulta al administrador.';
    if (error.status === 409) return 'El expediente cambió. Recarga y revisa los datos antes de volver a guardar.';
    if (error.status === 429) return 'Hay otras cargas en curso. Espera unos segundos y reintenta.';
    if (error.status === 503) return 'El servicio documental no está disponible. No se confirmó la operación.';
    if (error.status === 413) return 'El PDF excede 7.5 MiB.';
    if (error.status === 415 || error.status === 422) return 'El archivo no es un PDF permitido. Revisa el archivo.';
    if (error.status === 404) return 'El recurso no está disponible. Actualiza el expediente.';
    return 'No fue posible validar la solicitud. Revisa los datos y actualiza el expediente.';
  }
  return 'No se pudo confirmar la respuesta. Reintenta con la misma operación para evitar duplicados.';
}

export function useDossierOperations(teacherId: string, settled: (mutation?: DossierMutation) => Promise<void>, denied: () => void) {
  const tasks = ref<DossierTask[]>([]);
  const inFlight = ref(0);
  const unsettled = computed(() => tasks.value.some(t => ['ready', 'running', 'pending', 'uncertain', 'retry'].includes(t.state)));
  let disposed = false;
  let accessDenied = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refreshing = new Set<string>();

  async function accept(task: DossierTask, result: DossierOperation) {
    if (disposed || accessDenied || task.state === 'complete' || task.state === 'failed') return;
    if (result.state === 'COMPLETE' || result.state === 'FAILED') {
      task.state = result.state === 'COMPLETE' ? 'complete' : 'failed';
      task.message = result.state === 'COMPLETE' ? 'Completado' : 'No se completó. Revisa el expediente antes de iniciar un nuevo intento.';
      const mutation = task.mutation;
      task.mutation = undefined;
      if (result.state === 'COMPLETE' || task.action !== 'upload') {
        // Release File references and encoded bytes when no retry is needed.
        task.prepare = async () => { throw new Error('OPERATION_FINISHED'); };
      }
      await settled(mutation);
    } else {
      task.state = 'pending';
      task.message = result.state === 'CLEANUP' ? 'Limpieza del archivo anterior pendiente; aún no finaliza.' : 'Operación aceptada, pendiente de confirmación.';
      schedulePoll();
    }
  }

  function handleError(task: DossierTask, error: unknown, read = false) {
    if (disposed) return;
    task.message = dossierError(error);
    if (error instanceof ApiRequestError && [401, 403].includes(error.status)) { accessDenied = true; denied(); }
    if (read) return; // An unavailable status endpoint does not cancel an accepted operation.
    task.state = error instanceof ApiRequestError && error.status < 500
      ? error.status === 429 ? 'retry' : 'rejected' : 'uncertain';
  }

  async function run(task: DossierTask) {
    task.state = 'running';
    task.message = 'Enviando…';
    inFlight.value++;
    try {
      task.mutation ??= await task.prepare();
      task.action = task.mutation.action;
      if (disposed || accessDenied) return;
      const result = await mutateTeacherDossier(teacherId, task.id, task.mutation);
      await accept(task, result);
    } catch (error) { handleError(task, error); }
    finally { inFlight.value--; pump(); }
  }

  function pump() {
    if (disposed || accessDenied) return;
    for (const task of tasks.value) {
      if (inFlight.value >= 2) break;
      if (task.state === 'ready') void run(task);
    }
  }

  function enqueue(label: string, prepare: () => Promise<DossierMutation>) {
    if (disposed || accessDenied) return;
    tasks.value.push({ id: crypto.randomUUID(), label, prepare, state: 'ready', message: 'En espera', polls: 0 });
    pump();
  }

  function retry(task: DossierTask) {
    if (disposed || accessDenied || !['uncertain', 'retry'].includes(task.state)) return;
    task.state = 'ready';
    pump();
  }

  function retryFailedUpload(task: DossierTask) {
    if (disposed || accessDenied || unsettled.value || task.state !== 'failed' || task.action !== 'upload') return;
    const prepare = task.prepare;
    // FAILED is terminal: a deliberate new upload gets a new id, never replay a success.
    task.action = undefined;
    task.prepare = async () => { throw new Error('OPERATION_FINISHED'); };
    enqueue(task.label, prepare);
  }

  async function refresh(task: DossierTask) {
    if (disposed || accessDenied || task.state !== 'pending' || refreshing.has(task.id)) return;
    refreshing.add(task.id);
    task.polls++;
    try { await accept(task, await fetchDossierOperation(teacherId, task.id)); }
    catch (error) { handleError(task, error, true); }
    finally { refreshing.delete(task.id); }
  }

  function schedulePoll() {
    if (disposed || accessDenied || timer) return;
    timer = setTimeout(async () => {
      timer = undefined;
      // Read-only polling is bounded; the durable backend worker owns recovery.
      for (const task of tasks.value.filter(t => t.state === 'pending' && t.polls < 20)) await refresh(task);
      if (tasks.value.some(t => t.state === 'pending' && t.polls < 20)) schedulePoll();
    }, 3000);
  }

  onBeforeUnmount(() => { disposed = true; clearTimeout(timer); });
  return { tasks, inFlight, unsettled, enqueue, retry, retryFailedUpload, refresh };
}
