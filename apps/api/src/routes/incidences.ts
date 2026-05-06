import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requirePermission } from '../auth.js';
import { query, withTransaction } from '../db.js';
import type { SessionUser } from '../types.js';
import {
  ensureWorkingCycle,
  listCycles,
  loadActorCoordination,
  type CoordinationRow,
  type CycleRow
} from './academic-context.js';

interface IncidenceScheduleRow {
  id: string;
  cycleId: string;
  periodLabel: string;
  quarterCode: string;
  cycleStatus: CycleRow['status'];
  calendarConfigId: string;
  calendarPeriodLabel: string;
  payrollLocked: boolean;
  coordinationId: string;
  coordinationName: string;
  teacherId: string;
  teacherName: string;
  teacherCategory: string;
  subjectName: string;
  groupCode: string;
  tabulatorName: string;
  tabulatorAmount: number;
  weekHours: number;
  mod1Hours: number;
  mod2Hours: number;
  baseHours: number;
  absences: number;
  delays: number;
  extraHoursInSchedule: number;
  incidenceUpdatedAt: string | null;
  incidenceUpdatedByEmail: string;
  canEdit: boolean;
}

interface IncidenceCalendarPeriodRow {
  id: string;
  cycleId: string;
  periodLabel: string;
  payrollStart: string;
  payrollEnd: string;
  hasPayrollRun: boolean;
}

const contextQuerySchema = z.object({
  cycleId: z.string().uuid().optional(),
  calendarConfigId: z.string().uuid().optional()
});

const incidenceParamsSchema = z.object({
  scheduleId: z.string().uuid()
});

const incidencePayloadSchema = z.object({
  scheduleId: z.string().uuid().optional(),
  calendarConfigId: z.string().uuid(),
  absences: z.coerce.number().min(0).max(999).default(0),
  delays: z.coerce.number().min(0).max(999).default(0),
  extraHoursInSchedule: z.coerce.number().min(0).max(999).default(0)
});

const incidenceBatchSchema = z.object({
  rows: z.array(incidencePayloadSchema.extend({ scheduleId: z.string().uuid() })).min(1).max(500)
});

type IncidencePayload = z.infer<typeof incidencePayloadSchema>;

function sendValidation(reply: FastifyReply, error: z.ZodError): void {
  void reply.code(400).send({
    error: 'VALIDATION_ERROR',
    message: error.issues[0]?.message || 'Datos invalidos.'
  });
}

function isSystemAdmin(actor: SessionUser): boolean {
  return actor.role === 'admin' || actor.isProtectedSuperAdmin;
}

function incidenceSelectSql(whereClause = ''): string {
  return `
    SELECT
      s.id,
      s.cycle_id AS "cycleId",
      ac.period_label AS "periodLabel",
      ac.quarter_code AS "quarterCode",
      ac.status AS "cycleStatus",
      pcc.id AS "calendarConfigId",
      pcc.period_label AS "calendarPeriodLabel",
      EXISTS (
        SELECT 1
        FROM payroll_runs pr
        WHERE pr.cycle_id = pcc.cycle_id
          AND pr.period_label = pcc.period_label
          AND pr.status <> 'CANCELADA'
      ) AS "payrollLocked",
      s.coordination_id AS "coordinationId",
      c.name AS "coordinationName",
      s.teacher_id AS "teacherId",
      t.full_name AS "teacherName",
      t.category AS "teacherCategory",
      s.subject_name AS "subjectName",
      s.group_code AS "groupCode",
      s.tabulator_name AS "tabulatorName",
      s.tabulator_amount::float8 AS "tabulatorAmount",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v)::float8 AS "weekHours",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v + s.hours_s1)::float8 AS "mod1Hours",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v + s.hours_s1 + s.hours_s2)::float8 AS "baseHours",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v + s.hours_s2)::float8 AS "mod2Hours",
      COALESCE(si.absences, 0)::float8 AS absences,
      COALESCE(si.delays, 0)::float8 AS delays,
      COALESCE(si.extra_hours_in_schedule, 0)::float8 AS "extraHoursInSchedule",
      si.updated_at AS "incidenceUpdatedAt",
      COALESCE(updated.email, '') AS "incidenceUpdatedByEmail"
    FROM schedules s
    JOIN academic_cycles ac ON ac.id = s.cycle_id
    JOIN payroll_calendar_config pcc ON pcc.id = $2 AND pcc.cycle_id = s.cycle_id
    JOIN coordinations c ON c.id = s.coordination_id
    JOIN teachers t ON t.id = s.teacher_id
    LEFT JOIN schedule_incidences si ON si.schedule_id = s.id AND si.calendar_config_id = pcc.id
    LEFT JOIN app_users updated ON updated.id = si.updated_by
    ${whereClause}
  `;
}

function applyEditability(
  rows: Omit<IncidenceScheduleRow, 'canEdit'>[],
  actor: SessionUser,
  actorCoordination: CoordinationRow | null
): IncidenceScheduleRow[] {
  return rows.map((row) => ({
    ...row,
    canEdit:
      !row.payrollLocked &&
      row.cycleStatus !== 'CERRADO' &&
      (isSystemAdmin(actor) || (!!actorCoordination && actorCoordination.id === row.coordinationId))
  }));
}

async function listIncidenceCalendarPeriods(cycleId: string): Promise<IncidenceCalendarPeriodRow[]> {
  return query<IncidenceCalendarPeriodRow>(
    `
      SELECT
        pcc.id,
        pcc.cycle_id AS "cycleId",
        pcc.period_label AS "periodLabel",
        pcc.payroll_start::text AS "payrollStart",
        pcc.payroll_end::text AS "payrollEnd",
        EXISTS (
          SELECT 1
          FROM payroll_runs pr
          WHERE pr.cycle_id = pcc.cycle_id
            AND pr.period_label = pcc.period_label
            AND pr.status <> 'CANCELADA'
        ) AS "hasPayrollRun"
      FROM payroll_calendar_config pcc
      WHERE pcc.cycle_id = $1
      ORDER BY pcc.payroll_start DESC, pcc.created_at DESC
    `,
    [cycleId]
  );
}

async function listIncidenceSchedules(
  cycleId: string,
  calendarConfigId: string,
  actor: SessionUser,
  actorCoordination: CoordinationRow | null
): Promise<IncidenceScheduleRow[]> {
  const rows = await query<Omit<IncidenceScheduleRow, 'canEdit'>>(
    `
      ${incidenceSelectSql('WHERE s.cycle_id = $1')}
      ORDER BY t.full_name ASC, c.name ASC, s.subject_name ASC, s.group_code ASC
    `,
    [cycleId, calendarConfigId]
  );
  return applyEditability(rows, actor, actorCoordination);
}

async function loadIncidenceScheduleById(
  client: PoolClient,
  scheduleId: string,
  calendarConfigId: string,
  actor: SessionUser,
  actorCoordination: CoordinationRow | null
): Promise<IncidenceScheduleRow | null> {
  const result = await client.query<Omit<IncidenceScheduleRow, 'canEdit'>>(
    `${incidenceSelectSql('WHERE s.id = $1')} LIMIT 1`,
    [scheduleId, calendarConfigId]
  );
  const row = result.rows[0];
  return row ? applyEditability([row], actor, actorCoordination)[0] : null;
}

async function auditIncidence(
  client: PoolClient,
  actor: SessionUser,
  action: string,
  entityId: string,
  beforeData: unknown,
  afterData: unknown
): Promise<void> {
  await client.query(
    `
      INSERT INTO audit_log (actor_user_id, actor_email, action, entity_type, entity_id, before_data, after_data)
      VALUES ($1, $2, $3, 'schedule_incidence', $4, $5::jsonb, $6::jsonb)
    `,
    [actor.id, actor.email, action, entityId, JSON.stringify(beforeData || null), JSON.stringify(afterData || null)]
  );
}

async function saveIncidenceRow(
  client: PoolClient,
  actor: SessionUser,
  actorCoordination: CoordinationRow | null,
  scheduleId: string,
  payload: IncidencePayload
): Promise<IncidenceScheduleRow> {
  const before = await loadIncidenceScheduleById(client, scheduleId, payload.calendarConfigId, actor, actorCoordination);
  if (!before) throw new Error('No se encontro el horario seleccionado.');
  if (before.cycleStatus === 'CERRADO') throw new Error('No se pueden modificar incidencias de un ciclo cerrado.');
  if (before.payrollLocked) throw new Error('Esta quincena ya tiene nomina guardada. Las incidencias quedaron cerradas.');
  if (!before.canEdit) throw new Error('Solo la coordinacion que capturo este horario puede editar sus incidencias.');

  await client.query(
    `
      INSERT INTO schedule_incidences (
        schedule_id,
        calendar_config_id,
        absences,
        delays,
        extra_hours_in_schedule,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (schedule_id, calendar_config_id) DO UPDATE
      SET absences = EXCLUDED.absences,
          delays = EXCLUDED.delays,
          extra_hours_in_schedule = EXCLUDED.extra_hours_in_schedule,
          updated_at = now(),
          updated_by = EXCLUDED.updated_by
    `,
    [scheduleId, payload.calendarConfigId, payload.absences, payload.delays, payload.extraHoursInSchedule, actor.id]
  );

  const after = await loadIncidenceScheduleById(client, scheduleId, payload.calendarConfigId, actor, actorCoordination);
  await auditIncidence(client, actor, 'INCIDENCE_UPDATED', `${scheduleId}:${payload.calendarConfigId}`, before, after);
  if (!after) throw new Error('No fue posible leer la incidencia actualizada.');
  return after;
}

function buildSummary(rows: IncidenceScheduleRow[]) {
  const teachers = new Set(rows.map((row) => row.teacherId));
  return {
    total: rows.length,
    teachers: teachers.size,
    editable: rows.filter((row) => row.canEdit).length,
    withIncidences: rows.filter((row) => row.absences > 0 || row.delays > 0 || row.extraHoursInSchedule > 0).length,
    absences: rows.reduce((sum, row) => sum + row.absences, 0),
    delays: rows.reduce((sum, row) => sum + row.delays, 0),
    extraHoursInSchedule: rows.reduce((sum, row) => sum + row.extraHoursInSchedule, 0)
  };
}

async function buildContext(actor: SessionUser, preferredCycleId?: string, preferredCalendarConfigId?: string) {
  const setup = await withTransaction(async (client) => ({
    cycle: await ensureWorkingCycle(client, actor, preferredCycleId),
    actorCoordination: await loadActorCoordination(client, actor, false)
  }));

  const calendarPeriods = await listIncidenceCalendarPeriods(setup.cycle.id);
  const activeCalendarPeriod =
    calendarPeriods.find((period) => period.id === preferredCalendarConfigId) || calendarPeriods[0] || null;

  const [cycles, schedules] = await Promise.all([
    listCycles(),
    activeCalendarPeriod
      ? listIncidenceSchedules(setup.cycle.id, activeCalendarPeriod.id, actor, setup.actorCoordination)
      : Promise.resolve([])
  ]);

  return {
    activeCycle: setup.cycle,
    cycles,
    calendarPeriods,
    activeCalendarPeriod,
    actorCoordination: setup.actorCoordination,
    schedules,
    summary: buildSummary(schedules)
  };
}

export async function registerIncidenceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/incidences/context', { preHandler: requirePermission('incidences.manage') }, async (request, reply) => {
    const parsed = contextQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    return buildContext(request.user!, parsed.data.cycleId, parsed.data.calendarConfigId);
  });

  app.patch(
    '/incidences/:scheduleId',
    { preHandler: requirePermission('incidences.manage') },
    async (request, reply) => {
      const params = incidenceParamsSchema.safeParse(request.params);
      const parsed = incidencePayloadSchema.safeParse(request.body);
      if (!params.success) {
        await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Horario invalido.' });
        return;
      }
      if (!parsed.success) {
        sendValidation(reply, parsed.error);
        return;
      }

      const actor = request.user!;
      const schedule = await withTransaction(async (client) => {
        const actorCoordination = await loadActorCoordination(client, actor, false);
        return saveIncidenceRow(client, actor, actorCoordination, params.data.scheduleId, parsed.data);
      });

      return { schedule, message: 'Incidencia guardada correctamente.' };
    }
  );

  app.patch('/incidences', { preHandler: requirePermission('incidences.manage') }, async (request, reply) => {
    const parsed = incidenceBatchSchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const schedules = await withTransaction(async (client) => {
      const actorCoordination = await loadActorCoordination(client, actor, false);
      const updated: IncidenceScheduleRow[] = [];
      for (const row of parsed.data.rows) {
        updated.push(await saveIncidenceRow(client, actor, actorCoordination, row.scheduleId, row));
      }
      return updated;
    });

    return {
      schedules,
      message: `Se guardaron ${schedules.length} fila${schedules.length === 1 ? '' : 's'} de incidencias.`
    };
  });
}
