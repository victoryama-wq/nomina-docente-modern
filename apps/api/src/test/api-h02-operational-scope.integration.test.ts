import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectAs } from './auth-test-utils.js';
import {
  TEST_IDS,
  cleanupTestApp,
  describeIntegration,
  extraBody,
  freshTestApp,
  incidenceBody,
  scheduleBody
} from './api-integration-helpers.js';
import { connectTestDb } from './db/test-db-utils.js';
import {
  TEST_COORDINATIONS,
  TEST_USER_IDS,
  adminActor,
  coordinatorActor,
  coordinatorWithoutCoordinationActor,
  directionActor,
  multiCoordinatorActor
} from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

describeIfDb('H02 operational scope business integration coverage', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  it('keeps admin global and defaults coordinator-created schedules to the actor coordination', async () => {
    const adminCreate = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/schedules',
      payload: scheduleBody({
        coordinationId: TEST_COORDINATIONS.arq.id,
        groupCode: 'QA-ADMIN-ARQ',
        hoursL: '1',
        hoursM: '1',
        hoursX: '0',
        hoursJ: '0',
        hoursV: '0'
      })
    });
    expect(adminCreate.statusCode).toBe(201);
    expect(adminCreate.json().schedule.coordinationId).toBe(TEST_COORDINATIONS.arq.id);

    const coordinatorCreate = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/schedules',
      payload: scheduleBody({
        teacherId: TEST_IDS.teacherMulti,
        coordinationId: TEST_COORDINATIONS.adetur.id,
        groupCode: 'QA-COORD-DEFAULT',
        hoursL: '1',
        hoursM: '1',
        hoursX: '0',
        hoursJ: '0',
        hoursV: '0'
      })
    });
    expect(coordinatorCreate.statusCode).toBe(201);
    expect(coordinatorCreate.json().schedule.coordinationId).toBe(TEST_COORDINATIONS.idiomas.id);
  });

  it('allows multi-coordinator own schedule edits and blocks foreign schedule edits', async () => {
    const allowed = await injectAs(app!, multiCoordinatorActor(), {
      method: 'PATCH',
      url: `/api/schedules/${TEST_IDS.scheduleMulti}`,
      payload: scheduleBody({ hoursL: '2', hoursM: '2' })
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().schedule.coordinationId).toBe(TEST_COORDINATIONS.adetur.id);

    const blocked = await injectAs(app!, multiCoordinatorActor(), {
      method: 'PATCH',
      url: `/api/schedules/${TEST_IDS.scheduleIdiomas}`,
      payload: scheduleBody({
        teacherId: TEST_IDS.teacherIdiomas,
        coordinationId: TEST_COORDINATIONS.idiomas.id,
        groupCode: 'QA-ID-01'
      })
    });
    expect(blocked.statusCode).not.toBe(200);
    expect(blocked.json().message).toContain('Solo puedes editar');
  });

  it('blocks operational capture for coordinator without assigned coordination', async () => {
    const schedule = await injectAs(app!, coordinatorWithoutCoordinationActor(), {
      method: 'POST',
      url: '/api/schedules',
      payload: scheduleBody({
        teacherId: TEST_IDS.teacherIdiomas,
        hoursL: '1',
        hoursM: '0',
        hoursX: '0',
        hoursJ: '0',
        hoursV: '0'
      })
    });
    expect(schedule.statusCode).not.toBe(201);
    expect(schedule.json().message).toContain('ambito operativo');

    const extra = await injectAs(app!, coordinatorWithoutCoordinationActor(), {
      method: 'POST',
      url: '/api/extras',
      payload: extraBody()
    });
    expect(extra.statusCode).not.toBe(201);
    expect(extra.json().message).toContain('ambito operativo');
  });

  it('validates incidences by schedule owner and does not treat updated_by as original authorship', async () => {
    const ownIncidence = await injectAs(app!, coordinatorActor(), {
      method: 'PATCH',
      url: `/api/incidences/${TEST_IDS.scheduleIdiomas}`,
      payload: incidenceBody({ absences: '2', delays: '0', extraHoursInSchedule: '1' })
    });
    expect(ownIncidence.statusCode).toBe(200);
    expect(ownIncidence.json().schedule.absences).toBe('2');

    const client = await connectTestDb();
    try {
      await client.query(
        'UPDATE schedule_incidences SET updated_by = $1 WHERE schedule_id = $2 AND calendar_config_id = $3',
        [TEST_USER_IDS.coordinator, TEST_IDS.scheduleMulti, TEST_IDS.calendarConfig]
      );
    } finally {
      await client.end();
    }

    const blocked = await injectAs(app!, coordinatorActor(), {
      method: 'PATCH',
      url: `/api/incidences/${TEST_IDS.scheduleMulti}`,
      payload: incidenceBody({ absences: '1', delays: '1', extraHoursInSchedule: '1' })
    });
    expect(blocked.statusCode).not.toBe(200);
    expect(blocked.json().message).toContain('capturo este horario');
  });

  it('keeps extras editable only by the capturing actor while allowing shared teachers', async () => {
    const created = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/extras',
      payload: extraBody({
        teacherId: TEST_IDS.teacherMulti,
        coordinationId: TEST_COORDINATIONS.adetur.id,
        reference: 'H04-SHARED-TEACHER'
      })
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().extra.teacherId).toBe(TEST_IDS.teacherMulti);
    expect(created.json().extra.coordinationId).toBe(TEST_COORDINATIONS.idiomas.id);

    const editOwn = await injectAs(app!, coordinatorActor(), {
      method: 'PATCH',
      url: `/api/extras/${created.json().extra.id}`,
      payload: extraBody({
        teacherId: TEST_IDS.teacherMulti,
        hours: '2.5',
        reference: 'H04-SHARED-TEACHER-EDIT'
      })
    });
    expect(editOwn.statusCode).toBe(200);

    const editOther = await injectAs(app!, multiCoordinatorActor(), {
      method: 'PATCH',
      url: `/api/extras/${created.json().extra.id}`,
      payload: extraBody({ teacherId: TEST_IDS.teacherMulti, hours: '3' })
    });
    expect(editOther.statusCode).not.toBe(200);
    expect(editOther.json().message).toMatch(/Solo la coordinaci.n que captur./);
  });

  it('lets direccion view extras but edit only extras captured by direccion', async () => {
    const created = await injectAs(app!, directionActor(), {
      method: 'POST',
      url: '/api/extras',
      payload: extraBody({
        teacherId: TEST_IDS.teacherMulti,
        coordinationId: TEST_COORDINATIONS.arq.id,
        reference: 'H04-DIR-OWN',
        observations: 'Extra propio de direccion'
      })
    });
    expect(created.statusCode).toBe(201);

    const context = await injectAs(app!, directionActor(), {
      method: 'GET',
      url: '/api/extras/context'
    });
    expect(context.statusCode).toBe(200);
    const extras = context.json().extras as Array<{ id: string; canEdit: boolean }>;
    expect(extras.some((extra) => extra.id === TEST_IDS.extraOwn && extra.canEdit === false)).toBe(true);
    expect(extras.some((extra) => extra.id === created.json().extra.id && extra.canEdit === true)).toBe(true);

    const editOwn = await injectAs(app!, directionActor(), {
      method: 'PATCH',
      url: `/api/extras/${created.json().extra.id}`,
      payload: extraBody({
        teacherId: TEST_IDS.teacherMulti,
        coordinationId: TEST_COORDINATIONS.arq.id,
        hours: '2.5',
        reference: 'H04-DIR-OWN-EDIT'
      })
    });
    expect(editOwn.statusCode).toBe(200);

    const editOther = await injectAs(app!, directionActor(), {
      method: 'PATCH',
      url: `/api/extras/${TEST_IDS.extraOwn}`,
      payload: extraBody({ hours: '3' })
    });
    expect(editOther.statusCode).not.toBe(200);
    expect(editOther.json().message).toMatch(/Solo la coordinaci.n que captur./);
  });
});
