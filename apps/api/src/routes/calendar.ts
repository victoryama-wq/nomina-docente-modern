import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requirePermission } from '../auth.js';
import { withTransaction } from '../db.js';
import type { SessionUser } from '../types.js';
import {
  ensureWorkingCycle,
  cycleSelectSql,
  loadCycleById,
  listCycles,
  type CycleRow
} from './academic-context.js';

interface CalendarContextQuery {
  cycleId?: string;
}

interface CalendarParams {
  id: string;
}

interface BlackoutDateRow {
  id: string;
  configId: string;
  blackoutDate: string;
  reason: string;
}

interface CalendarPeriodRow {
  id: string;
  cycleId: string;
  periodLabel: string;
  payrollStart: string;
  payrollEnd: string;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  incidencesAccessStartAt: string;
  incidencesAccessDays: number;
  incidencesAccessEndAt: string;
  extrasAccessStartAt: string;
  extrasAccessDays: number;
  extrasAccessEndAt: string;
  createdAt: string;
  updatedAt: string;
  blackoutDates: BlackoutDateRow[];
}

interface ClosurePeriodRow {
  id: string;
  periodLabel: string;
  payrollStart: string;
  payrollEnd: string;
}

interface ClosurePayrollRunRow {
  id: string;
  periodLabel: string;
  status: string;
}

interface ClosureCountersRow {
  schedulesArchived: number;
  extrasArchived: number;
  affectedTeachers: number;
  affectedCoordinations: number;
}

interface QuarterClosureRow {
  id: string;
  executedAt: string;
}

const contextQuerySchema = z.object({
  cycleId: z.string().uuid().optional()
});

const paramsSchema = z.object({
  id: z.string().uuid()
});

const blackoutDateSchema = z.object({
  blackoutDate: z.string().date(),
  reason: z.string().trim().max(160).optional().default('')
});

const accessStartSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || undefined;
}, z.string().datetime({ offset: true }).optional());

type CycleDateValidationCode =
  | 'BASE_HOURS_DATES_INCOMPLETE'
  | 'BASE_HOURS_DATES_INVALID'
  | 'MODULE1_OUTSIDE_BASE_HOURS_PERIOD'
  | 'MODULE2_OUTSIDE_BASE_HOURS_PERIOD';

interface CycleDateFields {
  baseHoursStartDate?: string | null;
  baseHoursEndDate?: string | null;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
}

interface CycleDateValidationError {
  code: CycleDateValidationCode;
  message: string;
}

function validateCycleDates(body: CycleDateFields): CycleDateValidationError | null {
  const hasStart = typeof body.baseHoursStartDate === 'string';
  const hasEnd = typeof body.baseHoursEndDate === 'string';

  if (hasStart !== hasEnd) {
    return {
      code: 'BASE_HOURS_DATES_INCOMPLETE',
      message: 'Captura inicio y fin de horas base, o deja ambos campos vacíos.'
    };
  }
  if (!hasStart || !hasEnd) return null;

  const baseStart = body.baseHoursStartDate!;
  const baseEnd = body.baseHoursEndDate!;
  if (baseStart > baseEnd) {
    return {
      code: 'BASE_HOURS_DATES_INVALID',
      message: 'El inicio de horas base debe ser menor o igual al fin.'
    };
  }
  if (body.module1Start < baseStart || body.module1End > baseEnd) {
    return {
      code: 'MODULE1_OUTSIDE_BASE_HOURS_PERIOD',
      message: 'El módulo 1 debe quedar completamente dentro de la vigencia pagable de horas base.'
    };
  }
  if (body.module2Start < baseStart || body.module2End > baseEnd) {
    return {
      code: 'MODULE2_OUTSIDE_BASE_HOURS_PERIOD',
      message: 'El módulo 2 debe quedar completamente dentro de la vigencia pagable de horas base.'
    };
  }
  return null;
}

function addCycleDateIssue(body: CycleDateFields, ctx: z.RefinementCtx): void {
  const error = validateCycleDates(body);
  if (!error) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: error.message,
    params: { errorCode: error.code }
  });
}

const calendarPeriodBodySchema = z
  .object({
    cycleId: z.string().uuid().optional(),
    periodLabel: z.string().trim().max(120).optional().default(''),
    payrollStart: z.string().date(),
    payrollEnd: z.string().date(),
    module1Start: z.string().date().optional(),
    module1End: z.string().date().optional(),
    module2Start: z.string().date().optional(),
    module2End: z.string().date().optional(),
    incidencesAccessStartAt: accessStartSchema,
    incidencesAccessDays: z.coerce.number().int().min(0).max(31).optional().default(5),
    extrasAccessStartAt: accessStartSchema,
    extrasAccessDays: z.coerce.number().int().min(0).max(31).optional().default(5),
    blackoutDates: z.array(blackoutDateSchema).max(40).optional().default([])
  })
  .superRefine((body, ctx) => {
    if (body.payrollStart > body.payrollEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La fecha inicial de quincena debe ser menor o igual al cierre.' });
    }
    for (const blackout of body.blackoutDates) {
      if (blackout.blackoutDate < body.payrollStart || blackout.blackoutDate > body.payrollEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Los días inhábiles deben estar dentro del rango de la quincena.'
        });
      }
    }
    const incidenceStartDate = body.incidencesAccessStartAt?.slice(0, 10);
    if (incidenceStartDate && (incidenceStartDate < body.payrollStart || incidenceStartDate > body.payrollEnd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La apertura de incidencias debe estar dentro del rango de la quincena.'
      });
    }
    const extrasStartDate = body.extrasAccessStartAt?.slice(0, 10);
    if (extrasStartDate && (extrasStartDate < body.payrollStart || extrasStartDate > body.payrollEnd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La apertura de extras debe estar dentro del rango de la quincena.'
      });
    }
  });

type CalendarPeriodBody = z.infer<typeof calendarPeriodBodySchema>;

const cycleModuleDatesBodySchema = z
  .object({
    baseHoursStartDate: z.string().date().nullable().optional(),
    baseHoursEndDate: z.string().date().nullable().optional(),
    module1Start: z.string().date(),
    module1End: z.string().date(),
    module2Start: z.string().date(),
    module2End: z.string().date()
  })
  .superRefine((body, ctx) => {
    if (body.module1Start > body.module1End) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El inicio de módulo 1 debe ser menor o igual al cierre.' });
    }
    if (body.module2Start > body.module2End) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El inicio de módulo 2 debe ser menor o igual al cierre.' });
    }
    if (body.module1End > body.module2End) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El cierre de módulo 1 no puede ser posterior al cierre de módulo 2.' });
    }
    addCycleDateIssue(body, ctx);
  });

type CycleModuleDatesBody = z.infer<typeof cycleModuleDatesBodySchema>;

const academicCycleBodySchema = cycleModuleDatesBodySchema.and(
  z.object({
    periodLabel: z.string().trim().min(3).max(120),
    quarterCode: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .transform((value) => value.toUpperCase())
  })
);

type AcademicCycleBody = z.infer<typeof academicCycleBodySchema>;

const closeCycleBodySchema = z.object({
  nextCycleId: z.string().uuid(),
  observation: z.string().trim().max(1000).optional().default('')
});

type CloseCycleBody = z.infer<typeof closeCycleBodySchema>;

function sendValidation(reply: FastifyReply, error: z.ZodError): void {
  const issue = error.issues[0] as z.ZodIssue & { params?: { errorCode?: string } };
  void reply.code(400).send({
    error: issue?.params?.errorCode || 'VALIDATION_ERROR',
    message: issue?.message || 'Datos inválidos.'
  });
}

type CalendarRequestError = Error & { statusCode: number; calendarErrorCode?: string };

function requestError(message: string, statusCode = 400, calendarErrorCode?: string): CalendarRequestError {
  const error = new Error(message) as CalendarRequestError;
  error.statusCode = statusCode;
  error.calendarErrorCode = calendarErrorCode;
  return error;
}

function isCalendarRequestError(error: unknown): error is CalendarRequestError {
  return error instanceof Error && 'statusCode' in error && 'calendarErrorCode' in error;
}

async function sendCalendarRequestError(reply: FastifyReply, error: CalendarRequestError): Promise<void> {
  await reply.code(error.statusCode).send({
    error: error.calendarErrorCode || 'REQUEST_ERROR',
    message: error.message
  });
}

function throwIfCycleDatesInvalid(body: CycleDateFields): void {
  const error = validateCycleDates(body);
  if (error) throw requestError(error.message, 400, error.code);
}

function assertCycleCanActivate(cycle: CycleRow): void {
  if (cycle.baseHoursStartDate && cycle.baseHoursEndDate) return;
  throw requestError(
    'Configura inicio y fin de horas base antes de activar el ciclo.',
    400,
    'BASE_HOURS_DATES_INCOMPLETE'
  );
}

function resolveCycleDateFields(before: CycleRow, body: CycleModuleDatesBody): CycleDateFields {
  const baseDatesProvided = body.baseHoursStartDate !== undefined || body.baseHoursEndDate !== undefined;
  return {
    module1Start: body.module1Start,
    module1End: body.module1End,
    module2Start: body.module2Start,
    module2End: body.module2End,
    baseHoursStartDate: baseDatesProvided ? body.baseHoursStartDate ?? null : before.baseHoursStartDate,
    baseHoursEndDate: baseDatesProvided ? body.baseHoursEndDate ?? null : before.baseHoursEndDate
  };
}

function assertCycleClosureAdmin(actor: SessionUser): void {
  if (actor.role === 'admin' || actor.isProtectedSuperAdmin) return;
  throw requestError('Solo Admin puede ejecutar el cierre controlado de ciclo.', 403);
}

function periodLabel(body: CalendarPeriodBody): string {
  return body.periodLabel || `${body.payrollStart} a ${body.payrollEnd}`;
}

async function listBlackouts(client: PoolClient, configIds: string[]): Promise<Map<string, BlackoutDateRow[]>> {
  const byConfig = new Map<string, BlackoutDateRow[]>();
  if (!configIds.length) return byConfig;

  const result = await client.query<BlackoutDateRow>(
    `
      SELECT
        id,
        config_id AS "configId",
        blackout_date AS "blackoutDate",
        reason
      FROM calendar_blackout_dates
      WHERE config_id = ANY($1::uuid[])
      ORDER BY blackout_date ASC
    `,
    [configIds]
  );

  for (const row of result.rows) {
    const current = byConfig.get(row.configId) || [];
    current.push(row);
    byConfig.set(row.configId, current);
  }
  return byConfig;
}

async function listCalendarPeriods(client: PoolClient, cycleId: string): Promise<CalendarPeriodRow[]> {
  const result = await client.query<Omit<CalendarPeriodRow, 'blackoutDates'>>(
    `
      SELECT
        pcc.id,
        pcc.cycle_id AS "cycleId",
        pcc.period_label AS "periodLabel",
        pcc.payroll_start::text AS "payrollStart",
        pcc.payroll_end::text AS "payrollEnd",
        ac.module1_start::text AS "module1Start",
        ac.module1_end::text AS "module1End",
        ac.module2_start::text AS "module2Start",
        ac.module2_end::text AS "module2End",
        pcc.incidences_access_start_at AS "incidencesAccessStartAt",
        pcc.incidences_access_days AS "incidencesAccessDays",
        (pcc.incidences_access_start_at + make_interval(days => pcc.incidences_access_days)) AS "incidencesAccessEndAt",
        pcc.extras_access_start_at AS "extrasAccessStartAt",
        pcc.extras_access_days AS "extrasAccessDays",
        (pcc.extras_access_start_at + make_interval(days => pcc.extras_access_days)) AS "extrasAccessEndAt",
        pcc.created_at AS "createdAt",
        pcc.updated_at AS "updatedAt"
      FROM payroll_calendar_config pcc
      JOIN academic_cycles ac ON ac.id = pcc.cycle_id
      WHERE pcc.cycle_id = $1
      ORDER BY pcc.payroll_start DESC, pcc.created_at DESC
    `,
    [cycleId]
  );

  const blackouts = await listBlackouts(client, result.rows.map((period) => period.id));
  return result.rows.map((period) => ({
    ...period,
    blackoutDates: blackouts.get(period.id) || []
  }));
}

async function loadCalendarPeriod(client: PoolClient, id: string): Promise<CalendarPeriodRow | null> {
  const result = await client.query<Omit<CalendarPeriodRow, 'blackoutDates'>>(
    `
      SELECT
        pcc.id,
        pcc.cycle_id AS "cycleId",
        pcc.period_label AS "periodLabel",
        pcc.payroll_start::text AS "payrollStart",
        pcc.payroll_end::text AS "payrollEnd",
        ac.module1_start::text AS "module1Start",
        ac.module1_end::text AS "module1End",
        ac.module2_start::text AS "module2Start",
        ac.module2_end::text AS "module2End",
        pcc.incidences_access_start_at AS "incidencesAccessStartAt",
        pcc.incidences_access_days AS "incidencesAccessDays",
        (pcc.incidences_access_start_at + make_interval(days => pcc.incidences_access_days)) AS "incidencesAccessEndAt",
        pcc.extras_access_start_at AS "extrasAccessStartAt",
        pcc.extras_access_days AS "extrasAccessDays",
        (pcc.extras_access_start_at + make_interval(days => pcc.extras_access_days)) AS "extrasAccessEndAt",
        pcc.created_at AS "createdAt",
        pcc.updated_at AS "updatedAt"
      FROM payroll_calendar_config pcc
      JOIN academic_cycles ac ON ac.id = pcc.cycle_id
      WHERE pcc.id = $1
      LIMIT 1
    `,
    [id]
  );
  const period = result.rows[0];
  if (!period) return null;
  const blackouts = await listBlackouts(client, [id]);
  return { ...period, blackoutDates: blackouts.get(id) || [] };
}

async function replaceBlackouts(client: PoolClient, configId: string, blackouts: CalendarPeriodBody['blackoutDates']): Promise<void> {
  await client.query('DELETE FROM calendar_blackout_dates WHERE config_id = $1', [configId]);

  const uniqueBlackouts = [...new Map(blackouts.map((blackout) => [blackout.blackoutDate, blackout])).values()];
  for (const blackout of uniqueBlackouts) {
    await client.query(
      `
        INSERT INTO calendar_blackout_dates (config_id, blackout_date, reason)
        VALUES ($1, $2, $3)
      `,
      [configId, blackout.blackoutDate, blackout.reason || 'Día inhábil']
    );
  }
}

function accessStart(value: string | undefined): string {
  return value || new Date().toISOString();
}

async function createPeriod(client: PoolClient, cycle: CycleRow, body: CalendarPeriodBody): Promise<CalendarPeriodRow> {
  const created = await client.query<{ id: string }>(
    `
      INSERT INTO payroll_calendar_config (
        cycle_id,
        period_label,
        payroll_start,
        payroll_end,
        module1_start,
        module1_end,
        module2_start,
        module2_end,
        incidences_access_start_at,
        incidences_access_days,
        extras_access_start_at,
        extras_access_days
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `,
    [
      cycle.id,
      periodLabel(body),
      body.payrollStart,
      body.payrollEnd,
      cycle.module1Start,
      cycle.module1End,
      cycle.module2Start,
      cycle.module2End,
      accessStart(body.incidencesAccessStartAt),
      body.incidencesAccessDays,
      accessStart(body.extrasAccessStartAt),
      body.extrasAccessDays
    ]
  );

  await replaceBlackouts(client, created.rows[0].id, body.blackoutDates);
  const period = await loadCalendarPeriod(client, created.rows[0].id);
  if (!period) throw new Error('No fue posible leer la quincena creada.');
  return period;
}

async function updatePeriod(
  client: PoolClient,
  id: string,
  cycle: CycleRow,
  body: CalendarPeriodBody
): Promise<CalendarPeriodRow> {
  const updated = await client.query<{ id: string }>(
    `
      UPDATE payroll_calendar_config
      SET
        cycle_id = $1,
        period_label = $2,
        payroll_start = $3,
        payroll_end = $4,
        module1_start = $5,
        module1_end = $6,
        module2_start = $7,
        module2_end = $8,
        incidences_access_start_at = $9,
        incidences_access_days = $10,
        extras_access_start_at = $11,
        extras_access_days = $12,
        updated_at = now()
      WHERE id = $13
      RETURNING id
    `,
    [
      cycle.id,
      periodLabel(body),
      body.payrollStart,
      body.payrollEnd,
      cycle.module1Start,
      cycle.module1End,
      cycle.module2Start,
      cycle.module2End,
      accessStart(body.incidencesAccessStartAt),
      body.incidencesAccessDays,
      accessStart(body.extrasAccessStartAt),
      body.extrasAccessDays,
      id
    ]
  );

  if (!updated.rows[0]) throw new Error('No se encontró la quincena seleccionada.');
  await replaceBlackouts(client, id, body.blackoutDates);
  const period = await loadCalendarPeriod(client, id);
  if (!period) throw new Error('No fue posible leer la quincena actualizada.');
  return period;
}

async function periodHasPayrollRun(client: PoolClient, period: CalendarPeriodRow): Promise<boolean> {
  const result = await client.query<{ total: string }>(
    `
      SELECT count(*)::text AS total
      FROM payroll_runs
      WHERE cycle_id = $1
        AND period_label = $2
    `,
    [period.cycleId, period.periodLabel]
  );
  return Number(result.rows[0]?.total || 0) > 0;
}

async function updateCycleModuleDates(
  client: PoolClient,
  actorId: string,
  actorEmail: string,
  cycleId: string,
  body: CycleModuleDatesBody
): Promise<CycleRow> {
  const before = await loadCycleById(client, cycleId);
  if (!before) throw new Error('El ciclo seleccionado no existe.');
  if (before.status === 'CERRADO') throw new Error('No se pueden modificar fechas modulares de un ciclo cerrado.');
  const dates = resolveCycleDateFields(before, body);
  throwIfCycleDatesInvalid(dates);

  const updated = await client.query<CycleRow>(
    `
      UPDATE academic_cycles
      SET
        base_hours_start_date = $1,
        base_hours_end_date = $2,
        module1_start = $3,
        module1_end = $4,
        module2_start = $5,
        module2_end = $6
      WHERE id = $7
      RETURNING
        id,
        period_label AS "periodLabel",
        quarter_code AS "quarterCode",
        base_hours_start_date::text AS "baseHoursStartDate",
        base_hours_end_date::text AS "baseHoursEndDate",
        module1_start::text AS "module1Start",
        module1_end::text AS "module1End",
        module2_start::text AS "module2Start",
        module2_end::text AS "module2End",
        status
    `,
    [
      dates.baseHoursStartDate,
      dates.baseHoursEndDate,
      dates.module1Start,
      dates.module1End,
      dates.module2Start,
      dates.module2End,
      cycleId
    ]
  );

  const cycle = updated.rows[0];
  if (!cycle) throw new Error('No fue posible actualizar las fechas modulares.');

  await client.query(
    `
      UPDATE payroll_calendar_config
      SET
        module1_start = $1,
        module1_end = $2,
        module2_start = $3,
        module2_end = $4,
        updated_at = now()
      WHERE cycle_id = $5
    `,
    [dates.module1Start, dates.module1End, dates.module2Start, dates.module2End, cycleId]
  );

  await client.query(
    `
      INSERT INTO audit_log (actor_user_id, actor_email, action, entity_type, entity_id, before_data, after_data)
      VALUES ($1, $2, 'CYCLE_MODULE_DATES_UPDATED', 'academic_cycle', $3, $4::jsonb, $5::jsonb)
    `,
    [actorId, actorEmail, cycle.id, JSON.stringify(before), JSON.stringify(cycle)]
  );

  return cycle;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

async function createAcademicCycle(
  client: PoolClient,
  actorId: string,
  actorEmail: string,
  body: AcademicCycleBody
): Promise<CycleRow> {
  const created = await client.query<{ id: string }>(
    `
      INSERT INTO academic_cycles (
        period_label,
        quarter_code,
        base_hours_start_date,
        base_hours_end_date,
        module1_start,
        module1_end,
        module2_start,
        module2_end,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PLANEACION', $9)
      RETURNING id
    `,
    [
      body.periodLabel,
      body.quarterCode,
      body.baseHoursStartDate ?? null,
      body.baseHoursEndDate ?? null,
      body.module1Start,
      body.module1End,
      body.module2Start,
      body.module2End,
      actorId
    ]
  );

  const cycle = await loadCycleById(client, created.rows[0].id);
  if (!cycle) throw new Error('No fue posible leer el ciclo creado.');

  await client.query(
    `
      INSERT INTO audit_log (actor_user_id, actor_email, action, entity_type, entity_id, before_data, after_data)
      VALUES ($1, $2, 'CYCLE_CREATED', 'academic_cycle', $3, NULL, $4::jsonb)
    `,
    [actorId, actorEmail, cycle.id, JSON.stringify(cycle)]
  );

  return cycle;
}

async function updateAcademicCycle(
  client: PoolClient,
  actorId: string,
  actorEmail: string,
  cycleId: string,
  body: AcademicCycleBody
): Promise<CycleRow> {
  const before = await loadCycleById(client, cycleId);
  if (!before) throw new Error('El ciclo seleccionado no existe.');
  if (before.status === 'CERRADO') throw new Error('No se puede editar un ciclo cerrado.');
  const dates = resolveCycleDateFields(before, body);
  throwIfCycleDatesInvalid(dates);

  const updated = await client.query<{ id: string }>(
    `
      UPDATE academic_cycles
      SET
        period_label = $1,
        quarter_code = $2,
        base_hours_start_date = $3,
        base_hours_end_date = $4,
        module1_start = $5,
        module1_end = $6,
        module2_start = $7,
        module2_end = $8
      WHERE id = $9
      RETURNING id
    `,
    [
      body.periodLabel,
      body.quarterCode,
      dates.baseHoursStartDate,
      dates.baseHoursEndDate,
      dates.module1Start,
      dates.module1End,
      dates.module2Start,
      dates.module2End,
      cycleId
    ]
  );
  if (!updated.rows[0]) throw new Error('No fue posible actualizar el ciclo.');

  await client.query(
    `
      UPDATE payroll_calendar_config
      SET
        module1_start = $1,
        module1_end = $2,
        module2_start = $3,
        module2_end = $4,
        updated_at = now()
      WHERE cycle_id = $5
    `,
    [dates.module1Start, dates.module1End, dates.module2Start, dates.module2End, cycleId]
  );

  const cycle = await loadCycleById(client, cycleId);
  if (!cycle) throw new Error('No fue posible leer el ciclo actualizado.');

  await client.query(
    `
      INSERT INTO audit_log (actor_user_id, actor_email, action, entity_type, entity_id, before_data, after_data)
      VALUES ($1, $2, 'CYCLE_UPDATED', 'academic_cycle', $3, $4::jsonb, $5::jsonb)
    `,
    [actorId, actorEmail, cycle.id, JSON.stringify(before), JSON.stringify(cycle)]
  );

  return cycle;
}

async function activateAcademicCycle(
  client: PoolClient,
  actorId: string,
  actorEmail: string,
  cycleId: string
): Promise<CycleRow> {
  const before = await loadCycleById(client, cycleId);
  if (!before) throw new Error('El ciclo seleccionado no existe.');
  if (before.status === 'CERRADO') throw new Error('No se puede activar un ciclo cerrado.');
  assertCycleCanActivate(before);

  const activeBefore = await client.query<CycleRow>(
    `
      ${cycleSelectSql("WHERE ac.status = 'ACTIVO'")}
      ORDER BY ac.created_at DESC
    `
  );

  await client.query(
    `
      UPDATE academic_cycles
      SET
        status = 'CERRADO',
        closed_at = now(),
        closed_by = $1
      WHERE status = 'ACTIVO'
        AND id <> $2
    `,
    [actorId, cycleId]
  );

  await client.query(
    `
      UPDATE academic_cycles
      SET
        status = 'ACTIVO',
        closed_at = NULL,
        closed_by = NULL
      WHERE id = $1
    `,
    [cycleId]
  );

  const after = await loadCycleById(client, cycleId);
  if (!after) throw new Error('No fue posible activar el ciclo.');

  await client.query(
    `
      INSERT INTO audit_log (actor_user_id, actor_email, action, entity_type, entity_id, before_data, after_data)
      VALUES ($1, $2, 'CYCLE_ACTIVATED', 'academic_cycle', $3, $4::jsonb, $5::jsonb)
    `,
    [
      actorId,
      actorEmail,
      after.id,
      JSON.stringify({ target: before, activeBefore: activeBefore.rows }),
      JSON.stringify(after)
    ]
  );

  return after;
}

async function loadCycleByIdForUpdate(client: PoolClient, id: string): Promise<CycleRow | null> {
  const result = await client.query<CycleRow>(`${cycleSelectSql('WHERE ac.id = $1')} FOR UPDATE OF ac`, [id]);
  return result.rows[0] || null;
}

async function listClosurePeriods(client: PoolClient, cycleId: string): Promise<ClosurePeriodRow[]> {
  const result = await client.query<ClosurePeriodRow>(
    `
      SELECT
        id,
        period_label AS "periodLabel",
        payroll_start::text AS "payrollStart",
        payroll_end::text AS "payrollEnd"
      FROM payroll_calendar_config
      WHERE cycle_id = $1
      ORDER BY payroll_start ASC, created_at ASC
    `,
    [cycleId]
  );
  return result.rows;
}

async function listMissingPaidPeriods(client: PoolClient, cycleId: string): Promise<ClosurePeriodRow[]> {
  const result = await client.query<ClosurePeriodRow>(
    `
      SELECT
        pcc.id,
        pcc.period_label AS "periodLabel",
        pcc.payroll_start::text AS "payrollStart",
        pcc.payroll_end::text AS "payrollEnd"
      FROM payroll_calendar_config pcc
      WHERE pcc.cycle_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM payroll_runs pr
          WHERE pr.cycle_id = pcc.cycle_id
            AND pr.period_label = pcc.period_label
            AND pr.status = 'PAGADA'
        )
      ORDER BY pcc.payroll_start ASC, pcc.created_at ASC
    `,
    [cycleId]
  );
  return result.rows;
}

async function listPendingClosureRuns(client: PoolClient, cycleId: string): Promise<ClosurePayrollRunRow[]> {
  const result = await client.query<ClosurePayrollRunRow>(
    `
      SELECT
        id,
        period_label AS "periodLabel",
        status::text AS status
      FROM payroll_runs
      WHERE cycle_id = $1
        AND status IN ('BORRADOR', 'CALCULADA', 'EN_REVISION', 'APROBADA', 'CERRADA')
      ORDER BY period_label ASC, calculated_at DESC NULLS LAST, created_at DESC
    `,
    [cycleId]
  );
  return result.rows;
}

async function listPaidClosureRuns(client: PoolClient, cycleId: string): Promise<ClosurePayrollRunRow[]> {
  const result = await client.query<ClosurePayrollRunRow>(
    `
      SELECT
        id,
        period_label AS "periodLabel",
        status::text AS status
      FROM payroll_runs
      WHERE cycle_id = $1
        AND status = 'PAGADA'
      ORDER BY period_label ASC, status_updated_at DESC NULLS LAST, calculated_at DESC NULLS LAST
    `,
    [cycleId]
  );
  return result.rows;
}

async function loadClosureCounters(client: PoolClient, cycleId: string): Promise<ClosureCountersRow> {
  const result = await client.query<ClosureCountersRow>(
    `
      SELECT
        (SELECT count(*)::int FROM schedules WHERE cycle_id = $1) AS "schedulesArchived",
        (SELECT count(*)::int FROM extra_hours WHERE cycle_id = $1) AS "extrasArchived",
        (
          SELECT count(DISTINCT teacher_id)::int
          FROM (
            SELECT teacher_id FROM schedules WHERE cycle_id = $1
            UNION
            SELECT teacher_id FROM extra_hours WHERE cycle_id = $1
          ) affected_teachers
        ) AS "affectedTeachers",
        (
          SELECT count(DISTINCT coordination_id)::int
          FROM (
            SELECT coordination_id FROM schedules WHERE cycle_id = $1
            UNION
            SELECT coordination_id FROM extra_hours WHERE cycle_id = $1
          ) affected_coordinations
        ) AS "affectedCoordinations"
    `,
    [cycleId]
  );

  return (
    result.rows[0] || {
      schedulesArchived: 0,
      extrasArchived: 0,
      affectedTeachers: 0,
      affectedCoordinations: 0
    }
  );
}

async function countSchedulesForCycle(client: PoolClient, cycleId: string): Promise<number> {
  const result = await client.query<{ total: number }>('SELECT count(*)::int AS total FROM schedules WHERE cycle_id = $1', [
    cycleId
  ]);
  return result.rows[0]?.total || 0;
}

async function closeAcademicCycle(
  client: PoolClient,
  actor: SessionUser,
  cycleId: string,
  body: CloseCycleBody
) {
  assertCycleClosureAdmin(actor);

  if (cycleId === body.nextCycleId) {
    throw requestError('El ciclo a cerrar y el ciclo siguiente deben ser distintos.');
  }

  const currentCycle = await loadCycleByIdForUpdate(client, cycleId);
  if (!currentCycle) throw requestError('El ciclo seleccionado no existe.');
  if (currentCycle.status !== 'ACTIVO') {
    throw requestError('Solo se puede cerrar un ciclo ACTIVO.');
  }

  const nextCycle = await loadCycleByIdForUpdate(client, body.nextCycleId);
  if (!nextCycle) throw requestError('El ciclo siguiente no existe.');
  if (nextCycle.status !== 'PLANEACION') {
    throw requestError('El ciclo siguiente debe estar en PLANEACION.');
  }
  assertCycleCanActivate(nextCycle);

  const scheduleCountNextCycle = await countSchedulesForCycle(client, nextCycle.id);
  if (scheduleCountNextCycle <= 0) {
    throw requestError('El ciclo siguiente debe tener horarios capturados antes de activarse.');
  }

  const periods = await listClosurePeriods(client, currentCycle.id);
  if (periods.length === 0) {
    throw requestError('El ciclo actual no tiene quincenas configuradas.');
  }

  const missingPaidPeriods = await listMissingPaidPeriods(client, currentCycle.id);
  if (missingPaidPeriods.length > 0) {
    throw requestError(
      `No se puede cerrar el ciclo. Faltan quincenas PAGADA: ${missingPaidPeriods
        .map((period) => period.periodLabel)
        .join(', ')}.`
    );
  }

  const pendingRuns = await listPendingClosureRuns(client, currentCycle.id);
  if (pendingRuns.length > 0) {
    throw requestError(
      `No se puede cerrar el ciclo. Existen corridas pendientes: ${pendingRuns
        .map((run) => `${run.periodLabel} (${run.status})`)
        .join(', ')}.`
    );
  }

  const paidRuns = await listPaidClosureRuns(client, currentCycle.id);
  const counters = await loadClosureCounters(client, currentCycle.id);
  const observation = [
    body.observation || 'Cierre controlado H09/H10',
    `nextCycleId=${nextCycle.id}`,
    `paidPeriods=${periods.length}`,
    `paidRuns=${paidRuns.length}`
  ].join(' | ');

  const closure = await client.query<QuarterClosureRow>(
    `
      INSERT INTO quarter_closures (
        cycle_id,
        action,
        observation,
        schedules_archived,
        extras_archived,
        affected_teachers,
        affected_coordinations,
        executed_by
      )
      VALUES ($1, 'CYCLE_CLOSED_AND_NEXT_ACTIVATED', $2, $3, $4, $5, $6, $7)
      RETURNING id, executed_at AS "executedAt"
    `,
    [
      currentCycle.id,
      observation,
      counters.schedulesArchived,
      counters.extrasArchived,
      counters.affectedTeachers,
      counters.affectedCoordinations,
      actor.id
    ]
  );

  await client.query(
    `
      UPDATE academic_cycles
      SET status = 'CERRADO',
          closed_at = now(),
          closed_by = $1
      WHERE id = $2
    `,
    [actor.id, currentCycle.id]
  );

  await client.query(
    `
      UPDATE academic_cycles
      SET status = 'ACTIVO',
          closed_at = NULL,
          closed_by = NULL
      WHERE id = $1
    `,
    [nextCycle.id]
  );

  const closedCycle = await loadCycleById(client, currentCycle.id);
  const activeCycle = await loadCycleById(client, nextCycle.id);
  if (!closedCycle || !activeCycle) throw requestError('No fue posible leer los ciclos despues del cierre.');

  const validation = {
    periodCount: periods.length,
    paidPeriods: periods.map((period) => period.periodLabel),
    payrollRunIds: paidRuns.map((run) => run.id),
    pendingRuns: pendingRuns.length,
    missingPaidPeriods: missingPaidPeriods.length,
    scheduleCountNextCycle
  };

  await client.query(
    `
      INSERT INTO audit_log (actor_user_id, actor_email, action, entity_type, entity_id, before_data, after_data)
      VALUES ($1, $2, 'CYCLE_CLOSED_AND_NEXT_ACTIVATED', 'academic_cycle', $3, $4::jsonb, $5::jsonb)
    `,
    [
      actor.id,
      actor.email,
      currentCycle.id,
      JSON.stringify({
        currentCycle,
        nextCycle,
        periods,
        paidRuns,
        counters
      }),
      JSON.stringify({
        closedCycleId: closedCycle.id,
        activatedCycleId: activeCycle.id,
        quarterClosureId: closure.rows[0].id,
        paidPeriods: validation.paidPeriods,
        payrollRunIds: validation.payrollRunIds,
        scheduleCountNextCycle,
        irreversible: true,
        closedCycle,
        activeCycle
      })
    ]
  );

  return {
    closedCycle,
    activeCycle,
    quarterClosure: closure.rows[0],
    validation,
    message: 'Ciclo cerrado y ciclo siguiente activado correctamente.'
  };
}

export async function registerCalendarRoutes(app: FastifyInstance): Promise<void> {
  app.get('/calendar/context', { preHandler: requirePermission('calendar.manage') }, async (request, reply) => {
    const parsed = contextQuerySchema.safeParse(request.query as CalendarContextQuery);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const context = await withTransaction(async (client) => {
      const cycle = await ensureWorkingCycle(client, actor, parsed.data.cycleId);
      const periods = await listCalendarPeriods(client, cycle.id);
      return { cycle, periods };
    });
    const cycles = await listCycles();

    return {
      activeCycle: context.cycle,
      cycles,
      periods: context.periods
    };
  });

  app.post('/calendar/cycles', { preHandler: requirePermission('calendar.manage') }, async (request, reply) => {
    const parsed = academicCycleBodySchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    try {
      const cycle = await withTransaction((client) =>
        createAcademicCycle(client, request.user!.id, request.user!.email, parsed.data)
      );
      await reply.code(201).send({ cycle, message: 'Ciclo escolar creado en planeación.' });
    } catch (error) {
      if (isUniqueViolation(error)) {
        await reply.code(409).send({
          error: 'CYCLE_EXISTS',
          message: 'Ya existe un ciclo con ese periodo y código.'
        });
        return;
      }
      if (isCalendarRequestError(error)) {
        await sendCalendarRequestError(reply, error);
        return;
      }
      throw error;
    }
  });

  app.patch('/calendar/cycles/:id', { preHandler: requirePermission('calendar.manage') }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params as CalendarParams);
    const parsed = academicCycleBodySchema.safeParse(request.body);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Ciclo inválido.' });
      return;
    }
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    try {
      const cycle = await withTransaction((client) =>
        updateAcademicCycle(client, request.user!.id, request.user!.email, params.data.id, parsed.data)
      );
      return { cycle, message: 'Ciclo escolar actualizado correctamente.' };
    } catch (error) {
      if (isUniqueViolation(error)) {
        await reply.code(409).send({
          error: 'CYCLE_EXISTS',
          message: 'Ya existe un ciclo con ese periodo y código.'
        });
        return;
      }
      if (isCalendarRequestError(error)) {
        await sendCalendarRequestError(reply, error);
        return;
      }
      throw error;
    }
  });

  app.post('/calendar/cycles/:id/activate', { preHandler: requirePermission('calendar.manage') }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params as CalendarParams);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Ciclo inválido.' });
      return;
    }

    let cycle: CycleRow;
    try {
      cycle = await withTransaction((client) =>
        activateAcademicCycle(client, request.user!.id, request.user!.email, params.data.id)
      );
    } catch (error) {
      if (isCalendarRequestError(error)) {
        await sendCalendarRequestError(reply, error);
        return;
      }
      throw error;
    }

    return {
      activeCycle: cycle,
      message: 'Ciclo activado correctamente. El ciclo activo anterior quedó cerrado.'
    };
  });

  app.post('/calendar/cycles/:id/close', { preHandler: requirePermission('calendar.manage') }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params as CalendarParams);
    const parsed = closeCycleBodySchema.safeParse(request.body);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Ciclo invalido.' });
      return;
    }
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    try {
      return await withTransaction((client) => closeAcademicCycle(client, request.user!, params.data.id, parsed.data));
    } catch (error) {
      if (isCalendarRequestError(error)) {
        await sendCalendarRequestError(reply, error);
        return;
      }
      throw error;
    }
  });

  app.patch('/calendar/cycles/:id/modules', { preHandler: requirePermission('calendar.manage') }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params as CalendarParams);
    const parsed = cycleModuleDatesBodySchema.safeParse(request.body);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Ciclo inválido.' });
      return;
    }
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    let cycle: CycleRow;
    try {
      cycle = await withTransaction((client) =>
        updateCycleModuleDates(client, request.user!.id, request.user!.email, params.data.id, parsed.data)
      );
    } catch (error) {
      if (isCalendarRequestError(error)) {
        await sendCalendarRequestError(reply, error);
        return;
      }
      throw error;
    }

    return { activeCycle: cycle, message: 'Vigencia pagable y fechas modulares actualizadas correctamente.' };
  });

  app.post('/calendar/periods', { preHandler: requirePermission('calendar.manage') }, async (request, reply) => {
    const parsed = calendarPeriodBodySchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    try {
      const period = await withTransaction(async (client) => {
        const cycle = await ensureWorkingCycle(client, request.user!, parsed.data.cycleId);
        if (cycle.status === 'CERRADO') throw new Error('No se pueden crear quincenas en un ciclo cerrado.');
        return createPeriod(client, cycle, parsed.data);
      });

      await reply.code(201).send({ period, message: 'Quincena de calendario creada correctamente.' });
    } catch (error) {
      if (isUniqueViolation(error)) {
        await reply.code(409).send({
          error: 'PERIOD_EXISTS',
          message: 'Ya existe una quincena con esa etiqueta en el ciclo seleccionado.'
        });
        return;
      }
      throw error;
    }
  });

  app.patch('/calendar/periods/:id', { preHandler: requirePermission('calendar.manage') }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params as CalendarParams);
    const parsed = calendarPeriodBodySchema.safeParse(request.body);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Quincena inválida.' });
      return;
    }
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    try {
      const period = await withTransaction(async (client) => {
        const cycle = await ensureWorkingCycle(client, request.user!, parsed.data.cycleId);
        if (cycle.status === 'CERRADO') throw new Error('No se pueden modificar quincenas de un ciclo cerrado.');
        return updatePeriod(client, params.data.id, cycle, parsed.data);
      });
      return { period, message: 'Quincena de calendario actualizada correctamente.' };
    } catch (error) {
      if (isUniqueViolation(error)) {
        await reply.code(409).send({
          error: 'PERIOD_EXISTS',
          message: 'Ya existe una quincena con esa etiqueta en el ciclo seleccionado.'
        });
        return;
      }
      throw error;
    }
  });

  app.delete('/calendar/periods/:id', { preHandler: requirePermission('calendar.manage') }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params as CalendarParams);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Quincena inválida.' });
      return;
    }

    const deleted = await withTransaction(async (client) => {
      const period = await loadCalendarPeriod(client, params.data.id);
      if (!period) throw new Error('No se encontró la quincena seleccionada.');
      const cycle = await loadCycleById(client, period.cycleId);
      if (cycle?.status === 'CERRADO') throw new Error('No se pueden eliminar quincenas de un ciclo cerrado.');
      if (await periodHasPayrollRun(client, period)) {
        throw new Error('Esta quincena ya tiene nómina calculada y no puede eliminarse.');
      }
      await client.query('DELETE FROM payroll_calendar_config WHERE id = $1', [period.id]);
      return period;
    });

    return { period: deleted, message: 'Quincena de calendario eliminada correctamente.' };
  });
}
