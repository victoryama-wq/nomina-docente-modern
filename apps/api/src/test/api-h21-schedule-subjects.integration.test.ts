import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import {
  TEST_IDS,
  cleanupTestApp,
  describeIntegration,
  freshTestApp,
  scheduleBody
} from './api-integration-helpers.js';
import { connectTestDb } from './db/test-db-utils.js';
import { adminActor, multiCoordinatorActor } from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

describeIfDb('H21 schedules use the Subjects catalog as source of truth', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('requires subjectId and never creates a subject from free text', async () => {
    const beforeDb = await connectTestDb();
    const before = await beforeDb.query<{ total: number }>('SELECT count(*)::int AS total FROM subjects');
    await beforeDb.end();

    const response = await injectAs(app!, multiCoordinatorActor(), {
      method: 'POST',
      url: '/api/schedules',
      payload: { ...scheduleBody(), subjectId: undefined, subjectName: 'Asignatura inventada' }
    });
    expect(response.statusCode).toBe(400);

    const afterDb = await connectTestDb();
    const after = await afterDb.query<{ total: number }>('SELECT count(*)::int AS total FROM subjects');
    await afterDb.end();
    expect(after.rows[0].total).toBe(before.rows[0].total);
  });

  it('stores the canonical catalog name and ignores a tampered subjectName', async () => {
    const response = await injectAs(app!, multiCoordinatorActor(), {
      method: 'POST',
      url: '/api/schedules',
      payload: scheduleBody({ subjectName: 'Nombre manipulado por cliente', groupCode: 'H21-CANONICO' })
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().schedule).toMatchObject({
      subjectId: TEST_IDS.subject,
      subjectName: 'H04 QA Materia Base'
    });
  });

  it('rejects unknown or inactive subjects for new schedules', async () => {
    const db = await connectTestDb();
    await db.query("UPDATE subjects SET status = 'INACTIVO' WHERE id = $1", [TEST_IDS.subject]);
    await db.end();

    const inactive = await injectAs(app!, multiCoordinatorActor(), {
      method: 'POST',
      url: '/api/schedules',
      payload: scheduleBody({ groupCode: 'H21-INACTIVA' })
    });
    expect(inactive.statusCode).toBe(400);
    expect(inactive.json().message).toContain('inactiva');

    const unknown = await injectAs(app!, multiCoordinatorActor(), {
      method: 'POST',
      url: '/api/schedules',
      payload: scheduleBody({
        subjectId: '30000000-0000-4000-8000-000000000099',
        groupCode: 'H21-INEXISTENTE'
      })
    });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json().message).toContain('catalogo');
  });

  it('allows an existing schedule to retain its same inactive subject', async () => {
    const db = await connectTestDb();
    await db.query("UPDATE subjects SET status = 'INACTIVO' WHERE id = $1", [TEST_IDS.subject]);
    await db.end();

    const response = await injectAs(app!, multiCoordinatorActor(), {
      method: 'PATCH',
      url: `/api/schedules/${TEST_IDS.scheduleMulti}`,
      payload: scheduleBody({ hoursL: '2', hoursM: '2' })
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().schedule).toMatchObject({
      subjectId: TEST_IDS.subject,
      subjectName: 'H04 QA Materia Base'
    });
  });

  it('does not allow switching an existing schedule to another inactive subject', async () => {
    const db = await connectTestDb();
    await db.query(`
      INSERT INTO subjects (id, official_code, name, status)
      VALUES ('30000000-0000-4000-8000-000000000098', 'H21-INACTIVA', 'H21 Inactiva', 'INACTIVO')
    `);
    await db.end();

    const response = await injectAs(app!, adminActor(), {
      method: 'PATCH',
      url: `/api/schedules/${TEST_IDS.scheduleMulti}`,
      payload: scheduleBody({ subjectId: '30000000-0000-4000-8000-000000000098' })
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('inactiva');
  });
});
