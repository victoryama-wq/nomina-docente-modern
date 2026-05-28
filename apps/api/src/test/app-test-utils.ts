import type { FastifyInstance } from 'fastify';
import { applyTestDbEnvironment } from './db/test-db-utils.js';

export async function buildTestApp(): Promise<FastifyInstance> {
  applyTestDbEnvironment();
  const { buildApp } = await import('../app.js');
  return buildApp();
}

export async function closeTestApp(app: FastifyInstance): Promise<void> {
  const { closeDatabase } = await import('../db.js');
  await app.close();
  await closeDatabase();
}
