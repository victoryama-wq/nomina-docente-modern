import { prepareTestDatabase } from './test-db-utils.js';

try {
  await prepareTestDatabase();
  console.log('nomina_docente_test preparada con migraciones y seed H04.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
