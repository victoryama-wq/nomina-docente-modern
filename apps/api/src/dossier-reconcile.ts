import { config } from './config.js';
import { closeDatabase, query, withTransaction } from './db.js';
import { createDossierService } from './lib/dossier-runtime.js';
import { reconcileConstancias } from './lib/constancia-replacement.js';
import { constanciaStorage } from './lib/constancia-storage.js';
import { readDossierBacklog, runDossierWorker } from './lib/dossier-worker.js';

// One-shot worker: schedule separately after storage/security approval. No public HTTP trigger.
async function main() {
  if (config.NODE_ENV === 'production' && process.env.ALLOW_DOSSIER_RECONCILE !== 'true') {
    throw new Error('Explicit worker authorization is required.');
  }
  if (config.NODE_ENV !== 'production' && (config.DB_NAME !== 'nomina_docente_test'
    || !['localhost', '127.0.0.1', '::1'].includes(config.DB_HOST || ''))) {
    throw new Error('Local worker requires the loopback nomina_docente_test database.');
  }
  const summary = await runDossierWorker({
    reconcileDocuments: () => createDossierService().reconcile(),
    reconcileCertificates: () => reconcileConstancias(withTransaction, constanciaStorage(config.CONSTANCIAS_BUCKET)),
    readBacklog: () => readDossierBacklog(query, createDossierService().namespace)
  });
  console.log(JSON.stringify(summary));
  process.exitCode = summary.exitCode;
}

main().catch(() => {
  console.error(JSON.stringify({ event: 'dossier_reconcile', severity: 'ERROR', alerts: ['WORKER_START_FAILED'], exitCode: 1 }));
  process.exitCode = 1;
})
  .finally(closeDatabase);
