import { connectTestDb, resetTestDbSchema } from './test-db-utils.js';

const client = await connectTestDb();

try {
  await resetTestDbSchema(client);
  console.log('nomina_docente_test reiniciada de forma segura.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end();
}
