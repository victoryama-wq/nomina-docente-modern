import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requirePermission } from '../auth.js';
import { withTransaction } from '../db.js';
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
  incidencesAccessDays: number;
  extrasAccessDays: number;
  createdAt: string;
  updatedAt: string;
  blackoutDates: BlackoutDateRow[];
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
    incidencesAccessDays: z.coerce.number().int().min(0).max(31).optional().default(5),
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
  });

type CalendarPeriodBody = z.infer<typeof calendarPeriodBodySchema>;

const cycleModuleDatesBodySchema = z
  .object({
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

function sendValidation(reply: FastifyReply, error: z.ZodError): void {
  void reply.code(400).send({
    error: 'VALIDATION_ERROR',
    message: error.issues[0]?.message || 'Datos inválidos.'
  });
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
        pcc.incidences_access_days AS "incidencesAccessDays",
        pcc.extras_access_days AS "extrasAccessDays",
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
        pcc.incidences_access_days AS "incidencesAccessDays",
        pcc.extras_access_days AS "extrasAccessDays",
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
        incidences_access_days,
        extras_access_days
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      body.incidencesAccessDays,
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
        incidences_access_days = $9,
        extras_access_days = $10,
        updated_at = now()
      WHERE id = $11
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
      body.incidencesAccessDays,
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

  const updated = await client.query<CycleRow>(
    `
      UPDATE academic_cycles
      SET
        module1_start = $1,
        module1_end = $2,
        module2_start = $3,
        module2_end = $4
      WHERE id = $5
      RETURNING
        id,
        period_label AS "periodLabel",
        quarter_code AS "quarterCode",
        module1_start::text AS "module1Start",
        module1_end::text AS "module1End",
        module2_start::text AS "module2Start",
        module2_end::text AS "module2End",
        status
    `,
    [body.module1Start, body.module1End, body.module2Start, body.module2End, cycleId]
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
    [body.module1Start, body.module1End, body.module2Start, body.module2End, cycleId]
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
        module1_start,
        module1_end,
        module2_start,
        module2_end,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'PLANEACION', $7)
      RETURNING id
    `,
    [
      body.periodLabel,
      body.quarterCode,
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

  const updated = await client.query<{ id: string }>(
    `
      UPDATE academic_cycles
      SET
        period_label = $1,
        quarter_code = $2,
        module1_start = $3,
        module1_end = $4,
        module2_start = $5,
        module2_end = $6
      WHERE id = $7
      RETURNING id
    `,
    [
      body.periodLabel,
      body.quarterCode,
      body.module1Start,
      body.module1End,
      body.module2Start,
      body.module2End,
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
    [body.module1Start, body.module1End, body.module2Start, body.module2End, cycleId]
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
      throw error;
    }
  });

  app.post('/calendar/cycles/:id/activate', { preHandler: requirePermission('calendar.manage') }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params as CalendarParams);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Ciclo inválido.' });
      return;
    }

    const cycle = await withTransaction((client) =>
      activateAcademicCycle(client, request.user!.id, request.user!.email, params.data.id)
    );

    return {
      activeCycle: cycle,
      message: 'Ciclo activado correctamente. El ciclo activo anterior quedó cerrado.'
    };
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

    const cycle = await withTransaction((client) =>
      updateCycleModuleDates(client, request.user!.id, request.user!.email, params.data.id, parsed.data)
    );

    return { activeCycle: cycle, message: 'Fechas modulares actualizadas correctamente.' };
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
