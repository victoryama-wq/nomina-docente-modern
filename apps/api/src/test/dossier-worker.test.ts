import { describe, expect, it, vi } from 'vitest';
import { runDossierWorker, type WorkerBacklog } from '../lib/dossier-worker.js';

const empty: WorkerBacklog = { pending: 0, eligible: 0, oldestPendingSeconds: 0, failedLast24Hours: 0,
  constanciasPending: 0, constanciasStaging: 0, constanciasOldestPendingSeconds: 0 };
function dependencies() {
  return { reconcileDocuments: vi.fn(async (): Promise<{ state: string }[]> => []),
    reconcileCertificates: vi.fn(async () => ({ deleted: 0, pending: false })),
    readBacklog: vi.fn(async () => ({ ...empty })) };
}
describe('private dossier worker reporting', () => {
  it('reports success only for drained queues', async () => {
    expect(await runDossierWorker(dependencies())).toMatchObject({ exitCode: 0, severity: 'INFO', alerts: [], backlog: empty });
  });
  it('continues certificate recovery after document failure without exposing diagnostics', async () => {
    const d = dependencies(); d.reconcileDocuments.mockRejectedValue(new Error('secret /private/key teacher@example.test'));
    const result = await runDossierWorker(d);
    expect(d.reconcileCertificates).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ exitCode: 1, alerts: ['DOCUMENT_RECONCILIATION_FAILED'] });
    expect(JSON.stringify(result)).not.toMatch(/secret|private\/key|example.test/);
  });
  it('reports certificate failure and still reads both queue metrics', async () => {
    const d = dependencies(); d.reconcileCertificates.mockRejectedValue(new Error('private'));
    expect(await runDossierWorker(d)).toMatchObject({ exitCode: 1, alerts: ['CERTIFICATE_RECONCILIATION_FAILED'] });
    expect(d.readBacklog).toHaveBeenCalledOnce();
  });
  it('fails closed when metrics cannot be read', async () => {
    const d = dependencies(); d.readBacklog.mockRejectedValue(new Error('SQL password'));
    expect(await runDossierWorker(d)).toMatchObject({ exitCode: 1, backlog: null, alerts: ['BACKLOG_READ_FAILED'] });
  });
  it.each(['PREPARED', 'CLEANUP', 'ABORTING', 'FAILED'])('does not report %s as success', async state => {
    const d = dependencies(); d.reconcileDocuments.mockResolvedValue([{ state }]);
    expect((await runDossierWorker(d)).exitCode).toBe(1);
  });
  it('detects aged or unprocessed backlog even when the processed batch completes', async () => {
    const d = dependencies(); d.reconcileDocuments.mockResolvedValue([{ state: 'COMPLETE' }]);
    d.readBacklog.mockResolvedValue({ ...empty, pending: 26, eligible: 26, oldestPendingSeconds: 901 });
    expect(await runDossierWorker(d)).toMatchObject({ complete: 1, exitCode: 1,
      alerts: ['DOCUMENT_PENDING', 'BACKLOG_OVER_BATCH', 'BACKLOG_AGE_EXCEEDED'] });
  });
  it('reports historical recent aborts separately from pending physical cleanup', async () => {
    const d = dependencies(); d.readBacklog.mockResolvedValue({ ...empty, failedLast24Hours: 1 });
    expect(await runDossierWorker(d)).toMatchObject({ pending: 0, exitCode: 1, alerts: ['DOCUMENT_FAILED'] });
  });
  it('reports pending certificates even without additional-document backlog', async () => {
    const d = dependencies(); d.reconcileCertificates.mockResolvedValue({ deleted: 0, pending: true });
    expect(await runDossierWorker(d)).toMatchObject({ exitCode: 1, alerts: ['CERTIFICATE_PENDING'] });
  });
  it('reports fresh staging without deleting or flagging an active upload as abandoned', async () => {
    const d = dependencies(); d.readBacklog.mockResolvedValue({ ...empty, constanciasStaging: 1 });
    expect(await runDossierWorker(d)).toMatchObject({ exitCode: 0, backlog: { constanciasStaging: 1 } });
  });
  it('counts successful work and pending work independently', async () => {
    const d = dependencies(); d.reconcileDocuments.mockResolvedValue([{ state: 'COMPLETE' }, { state: 'FAILED' }, { state: 'CLEANUP' }]);
    expect(await runDossierWorker(d)).toMatchObject({ processed: 3, complete: 1, failed: 1, pending: 1, exitCode: 1 });
  });
});
