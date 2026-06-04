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
  scheduleBody,
  teacherBody
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

  it('allows schedule capture in planning cycles and blocks closed cycles', async () => {
    const adminPlanning = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/schedules',
      payload: scheduleBody({
        cycleId: TEST_IDS.planningCycle,
        teacherId: TEST_IDS.teacherMulti,
        coordinationId: TEST_COORDINATIONS.arq.id,
        groupCode: 'QA-PLAN-ADMIN',
        hoursL: '1',
        hoursM: '0',
        hoursX: '0',
        hoursJ: '0',
        hoursV: '0'
      })
    });
    expect(adminPlanning.statusCode).toBe(201);
    expect(adminPlanning.json().schedule.cycleId).toBe(TEST_IDS.planningCycle);
    expect(adminPlanning.json().schedule.coordinationId).toBe(TEST_COORDINATIONS.arq.id);

    const coordinatorPlanning = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/schedules',
      payload: scheduleBody({
        cycleId: TEST_IDS.planningCycle,
        teacherId: TEST_IDS.teacherMulti,
        coordinationId: TEST_COORDINATIONS.adetur.id,
        groupCode: 'QA-PLAN-COORD',
        hoursL: '1',
        hoursM: '0',
        hoursX: '0',
        hoursJ: '0',
        hoursV: '0'
      })
    });
    expect(coordinatorPlanning.statusCode).toBe(201);
    expect(coordinatorPlanning.json().schedule.cycleId).toBe(TEST_IDS.planningCycle);
    expect(coordinatorPlanning.json().schedule.coordinationId).toBe(TEST_COORDINATIONS.idiomas.id);

    const editPlanning = await injectAs(app!, coordinatorActor(), {
      method: 'PATCH',
      url: `/api/schedules/${TEST_IDS.planningScheduleIdiomas}`,
      payload: scheduleBody({
        cycleId: TEST_IDS.planningCycle,
        teacherId: TEST_IDS.teacherIdiomas,
        coordinationId: TEST_COORDINATIONS.idiomas.id,
        groupCode: 'QA-PLAN-ID-EDIT',
        hoursL: '1',
        hoursM: '1',
        hoursX: '0',
        hoursJ: '0',
        hoursV: '0'
      })
    });
    expect(editPlanning.statusCode).toBe(200);
    expect(editPlanning.json().schedule.cycleId).toBe(TEST_IDS.planningCycle);

    const closedCreate = await injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/schedules',
      payload: scheduleBody({
        cycleId: TEST_IDS.closedCycle,
        groupCode: 'QA-CLOSED-CREATE',
        hoursL: '1',
        hoursM: '0',
        hoursX: '0',
        hoursJ: '0',
        hoursV: '0'
      })
    });
    expect(closedCreate.statusCode).toBe(400);
    expect(closedCreate.json().message).toContain('ciclo cerrado');

    const closedEdit = await injectAs(app!, adminActor(), {
      method: 'PATCH',
      url: `/api/schedules/${TEST_IDS.closedScheduleIdiomas}`,
      payload: scheduleBody({
        cycleId: TEST_IDS.closedCycle,
        teacherId: TEST_IDS.teacherIdiomas,
        coordinationId: TEST_COORDINATIONS.idiomas.id,
        groupCode: 'QA-CLOSED-EDIT',
        hoursL: '1',
        hoursM: '0',
        hoursX: '0',
        hoursJ: '0',
        hoursV: '0'
      })
    });
    expect(closedEdit.statusCode).toBe(400);
    expect(closedEdit.json().message).toContain('ciclo cerrado');

    const closedDelete = await injectAs(app!, adminActor(), {
      method: 'DELETE',
      url: `/api/schedules/${TEST_IDS.closedScheduleIdiomas}`
    });
    expect(closedDelete.statusCode).toBe(400);
    expect(closedDelete.json().message).toContain('ciclo cerrado');
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

  it('allows coordinators to edit operational teacher data inside their assigned coordinations', async () => {
    const client = await connectTestDb();
    const sharedTeacherId = '40000000-0000-4000-8000-000000000017';
    try {
      await client.query(
        `
          INSERT INTO teachers (
            id,
            full_name,
            normalized_name,
            first_names,
            paternal_last_name,
            maternal_last_name,
            degree,
            payment_type,
            category,
            location,
            coordination_id,
            phone,
            external_identifier,
            status,
            created_by,
            updated_by
          )
          VALUES ($1, 'Docente QA H17 Compartido', 'docente qa h17 compartido', 'Docente QA', 'H17', 'Compartido',
            'Licenciatura', '', 'N', 'Local', $2, '', 'H17-SHARED', 'ACTIVO', $3, $3)
          ON CONFLICT (id) DO UPDATE
          SET coordination_id = EXCLUDED.coordination_id,
              created_by = EXCLUDED.created_by,
              updated_by = EXCLUDED.updated_by,
              phone = EXCLUDED.phone,
              external_identifier = EXCLUDED.external_identifier,
              updated_at = now()
        `,
        [sharedTeacherId, TEST_COORDINATIONS.idiomas.id, TEST_USER_IDS.multiCoordinator]
      );
    } finally {
      await client.end();
    }

    const allowed = await injectAs(app!, coordinatorActor(), {
      method: 'PATCH',
      url: `/api/teachers/${sharedTeacherId}`,
      payload: teacherBody({
        firstNames: 'Docente QA',
        paternalLastName: 'H17',
        maternalLastName: 'Editado',
        coordinationId: TEST_COORDINATIONS.idiomas.id,
        coordinationName: TEST_COORDINATIONS.idiomas.name,
        phone: '9847654321',
        externalIdentifier: 'H17-EDITADO'
      })
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().teacher.coordinationId).toBe(TEST_COORDINATIONS.idiomas.id);
    expect(allowed.json().teacher.phone).toBe('9847654321');
    expect(allowed.json().teacher.rfc).toBe('');
    expect(allowed.json().teacher.bankDetail).toBe('');

    const blocked = await injectAs(app!, coordinatorActor(), {
      method: 'PATCH',
      url: `/api/teachers/${TEST_IDS.teacherMulti}`,
      payload: teacherBody({
        firstNames: 'Docente QA',
        paternalLastName: 'Multi',
        maternalLastName: 'Bloqueado',
        coordinationId: TEST_COORDINATIONS.adetur.id,
        coordinationName: TEST_COORDINATIONS.adetur.name
      })
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().message).toContain('No tienes permiso para operar esta coordinacion');
  });

  it('allows multi-coordinators to edit assigned teacher coordinations and blocks foreign reassignment', async () => {
    const client = await connectTestDb();
    const arqTeacherId = '40000000-0000-4000-8000-000000000018';
    try {
      await client.query(
        `
          INSERT INTO teachers (
            id,
            full_name,
            normalized_name,
            first_names,
            paternal_last_name,
            maternal_last_name,
            degree,
            payment_type,
            category,
            location,
            coordination_id,
            phone,
            external_identifier,
            status,
            created_by,
            updated_by
          )
          VALUES ($1, 'Docente QA H17 ARQ', 'docente qa h17 arq', 'Docente QA', 'H17', 'ARQ',
            'Licenciatura', '', 'N', 'Local', $2, '', 'H17-ARQ', 'ACTIVO', $3, $3)
          ON CONFLICT (id) DO UPDATE
          SET coordination_id = EXCLUDED.coordination_id,
              created_by = EXCLUDED.created_by,
              updated_by = EXCLUDED.updated_by,
              phone = EXCLUDED.phone,
              external_identifier = EXCLUDED.external_identifier,
              updated_at = now()
        `,
        [arqTeacherId, TEST_COORDINATIONS.arq.id, TEST_USER_IDS.coordinator]
      );
    } finally {
      await client.end();
    }

    const allowed = await injectAs(app!, multiCoordinatorActor(), {
      method: 'PATCH',
      url: `/api/teachers/${arqTeacherId}`,
      payload: teacherBody({
        firstNames: 'Docente QA',
        paternalLastName: 'H17',
        maternalLastName: 'ARQ',
        coordinationId: TEST_COORDINATIONS.arq.id,
        coordinationName: TEST_COORDINATIONS.arq.name,
        phone: '9841112233',
        externalIdentifier: 'H17-ARQ-EDIT'
      })
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().teacher.coordinationId).toBe(TEST_COORDINATIONS.arq.id);

    const blockedReassignment = await injectAs(app!, multiCoordinatorActor(), {
      method: 'PATCH',
      url: `/api/teachers/${arqTeacherId}`,
      payload: teacherBody({
        firstNames: 'Docente QA',
        paternalLastName: 'H17',
        maternalLastName: 'Fuera',
        coordinationId: TEST_COORDINATIONS.idiomas.id,
        coordinationName: TEST_COORDINATIONS.idiomas.name
      })
    });
    expect(blockedReassignment.statusCode).toBe(403);
    expect(blockedReassignment.json().message).toContain('No tienes permiso para operar esta coordinacion');
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

  it('blocks incidences and extras while a planning cycle is not active', async () => {
    const incidence = await injectAs(app!, coordinatorActor(), {
      method: 'PATCH',
      url: `/api/incidences/${TEST_IDS.planningScheduleIdiomas}`,
      payload: incidenceBody({
        calendarConfigId: TEST_IDS.planningCalendarConfig,
        absences: '1',
        delays: '0',
        extraHoursInSchedule: '0'
      })
    });
    expect(incidence.statusCode).toBe(400);
    expect(incidence.json().message).toContain('incidencias solo pueden capturarse');

    const createExtra = await injectAs(app!, coordinatorActor(), {
      method: 'POST',
      url: '/api/extras',
      payload: extraBody({
        cycleId: TEST_IDS.planningCycle,
        teacherId: TEST_IDS.teacherIdiomas,
        activityDate: '2026-09-03'
      })
    });
    expect(createExtra.statusCode).toBe(400);
    expect(createExtra.json().message).toContain('extras solo pueden capturarse');

    const editExtraToPlanning = await injectAs(app!, coordinatorActor(), {
      method: 'PATCH',
      url: `/api/extras/${TEST_IDS.extraOwn}`,
      payload: extraBody({
        cycleId: TEST_IDS.planningCycle,
        teacherId: TEST_IDS.teacherIdiomas,
        activityDate: '2026-09-04'
      })
    });
    expect(editExtraToPlanning.statusCode).toBe(400);
    expect(editExtraToPlanning.json().message).toContain('extras solo pueden modificarse');

    const client = await connectTestDb();
    try {
      await client.query(
        `
          INSERT INTO extra_hours (
            id,
            cycle_id,
            coordination_id,
            teacher_id,
            hours,
            tabulator_amount,
            reason,
            activity_date,
            reference,
            observations,
            captured_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, 1, 100.00, 'Extra planeacion QA', '2026-09-05', 'H09-PLAN-EXTRA', 'Dato sintetico H09', $5, $5)
          ON CONFLICT (id) DO UPDATE
          SET cycle_id = EXCLUDED.cycle_id,
              activity_date = EXCLUDED.activity_date,
              captured_by = EXCLUDED.captured_by,
              updated_by = EXCLUDED.updated_by
        `,
        [
          TEST_IDS.planningExtra,
          TEST_IDS.planningCycle,
          TEST_COORDINATIONS.idiomas.id,
          TEST_IDS.teacherIdiomas,
          TEST_USER_IDS.coordinator
        ]
      );
    } finally {
      await client.end();
    }

    const deleteExtra = await injectAs(app!, coordinatorActor(), {
      method: 'DELETE',
      url: `/api/extras/${TEST_IDS.planningExtra}`
    });
    expect(deleteExtra.statusCode).toBe(400);
    expect(deleteExtra.json().message).toContain('extras solo pueden eliminarse');
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
