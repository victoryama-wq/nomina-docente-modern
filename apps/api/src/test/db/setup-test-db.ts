import { prepareTestDatabase } from './test-db-utils.js';

try {
  await prepareTestDatabase();
  console.log(process.env.H24_TEST_SCHEMA_SNAPSHOT
    ? 'nomina_docente_test efimera preparada desde snapshot de esquema sintetico y seed H04; sin ejecutar migraciones.'
    : 'nomina_docente_test preparada con migraciones y seed H04.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
