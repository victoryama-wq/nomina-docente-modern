export interface WorkerBacklog {
  pending: number;
  eligible: number;
  oldestPendingSeconds: number;
  failedLast24Hours: number;
  constanciasPending: number;
  constanciasStaging: number;
  constanciasOldestPendingSeconds: number;
}

export async function runDossierWorker(dependencies: {
  reconcileDocuments: () => Promise<{ state: string }[]>;
  reconcileCertificates: () => Promise<{ deleted: number; pending: boolean }>;
  readBacklog: () => Promise<WorkerBacklog>;
}) {
  const errors: string[] = [];
  let processed = 0, complete = 0, failed = 0, pending = 0;
  let constancias: { deleted: number; pending: boolean } | null = null;
  let backlog: WorkerBacklog | null = null;
  // Independent channels: a storage failure must not starve the other queue.
  try {
    const results = await dependencies.reconcileDocuments();
    processed = results.length;
    complete = results.filter(r => r.state === 'COMPLETE').length;
    failed = results.filter(r => r.state === 'FAILED').length;
    pending = processed - complete - failed;
  } catch { errors.push('DOCUMENT_RECONCILIATION_FAILED'); }
  try { constancias = await dependencies.reconcileCertificates(); }
  catch { errors.push('CERTIFICATE_RECONCILIATION_FAILED'); }
  try { backlog = await dependencies.readBacklog(); }
  catch { errors.push('BACKLOG_READ_FAILED'); }

  const alerts = [...errors];
  if (pending || backlog?.pending) alerts.push('DOCUMENT_PENDING');
  if (failed || backlog?.failedLast24Hours) alerts.push('DOCUMENT_FAILED');
  if (constancias?.pending || backlog?.constanciasPending) alerts.push('CERTIFICATE_PENDING');
  if (backlog && (backlog.pending > 25 || backlog.constanciasPending > 25)) alerts.push('BACKLOG_OVER_BATCH');
  if (backlog && (backlog.oldestPendingSeconds > 900 || backlog.constanciasOldestPendingSeconds > 900)) {
    alerts.push('BACKLOG_AGE_EXCEEDED');
  }
  return {
    event: 'dossier_reconcile', severity: alerts.length ? 'ERROR' : 'INFO',
    processed, complete, failed, pending, constancias, backlog, alerts,
    exitCode: alerts.length ? 1 : 0
  };
}

type Query = <T>(sql: string, params?: unknown[]) => Promise<T[]>;
export async function readDossierBacklog(query: Query, namespace: string): Promise<WorkerBacklog> {
  const [documents] = await query<Pick<WorkerBacklog, 'pending' | 'eligible' | 'oldestPendingSeconds' | 'failedLast24Hours'>>(`
    SELECT count(*) FILTER (WHERE state IN ('PREPARED','CLEANUP','ABORTING'))::int AS pending,
      count(*) FILTER (WHERE state IN ('PREPARED','CLEANUP','ABORTING')
        AND updated_at < now() - interval '5 minutes')::int AS eligible,
      COALESCE(EXTRACT(epoch FROM now() - min(created_at) FILTER
        (WHERE state IN ('PREPARED','CLEANUP','ABORTING'))),0)::float8 AS "oldestPendingSeconds",
      count(*) FILTER (WHERE state='FAILED' AND updated_at >= now() - interval '24 hours')::int AS "failedLast24Hours"
    FROM teacher_dossier_operations WHERE storage_namespace=$1`, [namespace]);
  // Match the certificate worker's queue, including foreign buckets that it must refuse safely.
  const [certificates] = await query<Pick<WorkerBacklog, 'constanciasPending' | 'constanciasStaging' | 'constanciasOldestPendingSeconds'>>(`
    SELECT count(*) FILTER (WHERE document_type='CONSTANCIA_FISCAL_DELETE_PENDING'
        OR uploaded_at < now() - interval '24 hours')::int AS "constanciasPending",
      count(*) FILTER (WHERE document_type='CONSTANCIA_FISCAL_STAGING')::int AS "constanciasStaging",
      COALESCE(EXTRACT(epoch FROM now() - min(CASE
        WHEN document_type='CONSTANCIA_FISCAL_STAGING' THEN uploaded_at + interval '24 hours'
        ELSE uploaded_at END) FILTER (WHERE document_type='CONSTANCIA_FISCAL_DELETE_PENDING'
          OR uploaded_at < now() - interval '24 hours')),0)::float8 AS "constanciasOldestPendingSeconds"
    FROM teacher_documents WHERE is_current=false
      AND document_type IN ('CONSTANCIA_FISCAL_DELETE_PENDING','CONSTANCIA_FISCAL_STAGING')`);
  return { ...documents, ...certificates };
}
