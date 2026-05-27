import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { closeDatabase } from './db.js';

let app: FastifyInstance | null = null;

afterEach(async () => {
  if (app) {
    await app.close();
    app = null;
  }
});

afterAll(async () => {
  await closeDatabase();
});

describe('buildApp', () => {
  it('registers API routes without listening on a port', async () => {
    app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/session'
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'AUTH_REQUIRED' });
  });
});
