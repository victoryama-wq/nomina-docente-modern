import { config } from './config.js';
import { closeDatabase } from './db.js';
import { createDossierService } from './lib/dossier-runtime.js';

// One-shot worker: schedule separately after storage/security approval. No public HTTP trigger.
async function main() {
  if (config.NODE_ENV === 'production' && process.env.ALLOW_DOSSIER_RECONCILE !== 'true') {
    throw new Error('Explicit worker authorization is required.');
  }
  if (config.NODE_ENV !== 'production' && (config.DB_NAME !== 'nomina_docente_test'
    || !['localhost', '127.0.0.1', '::1'].includes(config.DB_HOST || ''))) {
    throw new Error('Local worker requires the loopback nomina_docente_test database.');
  }
  const results = await createDossierService().reconcile();
  console.log(JSON.stringify({ processed: results.length,
    complete: results.filter((r) => r.state === 'COMPLETE').length,
    failed: results.filter((r) => r.state === 'FAILED').length,
    pending: results.filter((r) => !['COMPLETE', 'FAILED'].includes(r.state)).length }));
}

main().catch(() => { console.error('Dossier reconciliation failed; inspect pending operation codes.'); process.exitCode = 1; })
  .finally(closeDatabase);
