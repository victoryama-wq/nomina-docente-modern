import config from '../../../apps/api/vitest.integration.config.ts';

// Run only inside the owned disposable lab, after capacity fingerprints are saved.
if (process.env.H24_PD07_E2E !== 'approved-local' || process.env.TEST_DB_NAME !== 'nomina_docente_test' ||
    process.env.TEST_DB_HOST !== '127.0.0.1') throw Error('ISOLATED_INTEGRATION_REQUIRED');
export default { ...config, root: '/app/apps/api', cacheDir: '/tmp/pd07-integration-vite' };
