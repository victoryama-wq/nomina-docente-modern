import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requirePermission } from '../auth.js';
import { query, withTransaction } from '../db.js';
import type { SessionUser } from '../types.js';
import {
  categoryMaxHours,
  ensureWorkingCycle,
  ensureWritableCycle,
  listActiveCoordinations,
  listCycles,
  loadActorCoordination,
  normalizeText,
  type CoordinationRow,
  type CycleRow
} from './academic-context.js';

interface TabulatorRow {
  id: string;
  name: string;
  amount: number;
  sortOrder: number;
}

interface ExtraTeacherRow {
  id: string;
  fullName: string;
  category: string;
  status: 'ACTIVO' | 'INACTIVO';
  coordinationId: string | null;
  coordinationName: string;
  maxHours: number;
  suggestedTabulatorAmount: number;
  scheduleWeekHours: number;
  scheduleMod1Hours: number;
  scheduleMod2Hours: number;
  incidenceExtraHours: number;
  loggedExtraHours: number;
  extraHours: number;
  totalWeekHours: number;
  totalMod1Hours: number;
  totalMod2Hours: number;
  loadStatus: 'DISPONIBLE' | 'CERCA' | 'LIMITE' | 'EXCEDE';
}

interface ExtraRow {
  id: string;
  cycleId: string;
  periodLabel: string;
  quarterCode: string;
  cycleStatus: CycleRow['status'];
  coordinationId: string;
  coordinationName: string;
  teacherId: string;
  teacherName: string;
  teacherCategory: string;
  hours: number;
  tabulatorAmount: number;
  totalAmount: number;
  reason: string;
  activityDate: string | null;
  reference: string;
  observations: string;
  capturedAt: string;
  capturedByEmail: string;
  updatedAt: string;
  updatedByEmail: string;
  canEdit: boolean;
}

interface ExtraDependencyRow {
  payrollLines: string;
}

const contextQuerySchema = z.object({
  cycleId: z.string().uuid().optional()
});

const extraParamsSchema = z.object({
  id: z.string().uuid()
});

const nullableUuid = z.preprocess((value) => (value === '' ? undefined : value), z.string().uuid().optional());

const extraBodySchema = z.object({
  cycleId: z.string().uuid().optional(),
  coordinationId: nullableUuid,
  teacherId: z.string().uuid(),
  hours: z.coerce.number().positive().max(999),
  tabulatorId: nullableUuid,
  tabulatorAmount: z.coerce.number().positive().max(1_000_000),
  reason: z.string().trim().min(1).max(180),
  activityDate: z.preprocess((value) => (value === '' ? undefined : value), z.string().date().optional()),
  reference: z.string().trim().max(120).optional().default(''),
  observations: z.string().trim().max(250).optional().default('')
});

type ExtraBody = z.infer<typeof extraBodySchema>;

function sendValidation(reply: FastifyReply, error: z.ZodError): void {
  void reply.code(400).send({
    error: 'VALIDATION_ERROR',
    message: error.issues[0]?.message || 'Datos invalidos.'
  });
}

function dateOnly(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function loadStatus(week: number, mod1: number, mod2: number, maxHours: number): ExtraTeacherRow['loadStatus'] {
  const highest = Math.max(week, mod1, mod2);
  if (highest > maxHours) return 'EXCEDE';
  if (highest >= maxHours) return 'LIMITE';
  if (highest >= maxHours * 0.8) return 'CERCA';
  return 'DISPONIBLE';
}

function isSystemAdmin(actor: SessionUser): boolean {
  return actor.role === 'admin' || actor.isProtectedSuperAdmin;
}

async function resolveTabulatorAmount(client: PoolClient, body: ExtraBody): Promise<number> {
  if (!body.tabulatorId) return body.tabulatorAmount;

  const result = await client.query<{ amount: number }>(
    "SELECT amount::float8 AS amount FROM tabulators WHERE id = $1 AND status = 'ACTIVO' LIMIT 1",
    [body.tabulatorId]
  );
  if (!result.rows[0]) throw new Error('Selecciona un tabulador valido del catalogo.');
  return result.rows[0].amount;
}

async function loadTeacherForExtra(client: PoolClient, teacherId: string): Promise<ExtraTeacherRow | null> {
  const result = await client.query<ExtraTeacherRow>(
    `
      SELECT
        t.id,
        t.full_name AS "fullName",
        t.category,
        t.status,
        t.coordination_id AS "coordinationId",
        COALESCE(c.name, '') AS "coordinationName",
        CASE t.category WHEN 'V' THEN 35 WHEN 'M' THEN 25 ELSE 15 END::float8 AS "maxHours",
        0::float8 AS "suggestedTabulatorAmount",
        0::float8 AS "scheduleWeekHours",
        0::float8 AS "scheduleMod1Hours",
        0::float8 AS "scheduleMod2Hours",
        0::float8 AS "incidenceExtraHours",
        0::float8 AS "loggedExtraHours",
        0::float8 AS "extraHours",
        0::float8 AS "totalWeekHours",
        0::float8 AS "totalMod1Hours",
        0::float8 AS "totalMod2Hours",
        'DISPONIBLE'::text AS "loadStatus"
      FROM teachers t
      LEFT JOIN coordinations c ON c.id = t.coordination_id
      WHERE t.id = $1
      FOR UPDATE OF t
    `,
    [teacherId]
  );

  return result.rows[0] || null;
}

async function resolveExtraCoordination(
  client: PoolClient,
  actor: SessionUser,
  body: ExtraBody,
  teacher: ExtraTeacherRow
): Promise<string> {
  if (!isSystemAdmin(actor)) {
    const actorCoordination = await loadActorCoordination(client, actor, true);
    if (!actorCoordination) throw new Error('No se pudo resolver la coordinacion del usuario logeado.');
    return actorCoordination.id;
  }

  if (body.coordinationId) return body.coordinationId;
  if (teacher.coordinationId) return teacher.coordinationId;

  const actorCoordination = await loadActorCoordination(client, actor, false);
  if (actorCoordination) return actorCoordination.id;

  const created = await client.query<CoordinationRow>(
    'INSERT INTO coordinations (name, status) VALUES ($1, $2) RETURNING id, name',
    [actor.displayName || actor.email, 'ACTIVO']
  );
  return created.rows[0].id;
}

function extraSelectSql(whereClause = ''): string {
  return `
    SELECT
      eh.id,
      eh.cycle_id AS "cycleId",
      ac.period_label AS "periodLabel",
      ac.quarter_code AS "quarterCode",
      ac.status AS "cycleStatus",
      eh.coordination_id AS "coordinationId",
      c.name AS "coordinationName",
      eh.teacher_id AS "teacherId",
      t.full_name AS "teacherName",
      t.category AS "teacherCategory",
      eh.hours::float8 AS hours,
      eh.tabulator_amount::float8 AS "tabulatorAmount",
      (eh.hours * eh.tabulator_amount)::float8 AS "totalAmount",
      eh.reason,
      eh.activity_date::text AS "activityDate",
      eh.reference,
      eh.observations,
      eh.captured_at AS "capturedAt",
      COALESCE(captured.email, '') AS "capturedByEmail",
      eh.updated_at AS "updatedAt",
      COALESCE(updated.email, '') AS "updatedByEmail"
    FROM extra_hours eh
    JOIN academic_cycles ac ON ac.id = eh.cycle_id
    JOIN coordinations c ON c.id = eh.coordination_id
    JOIN teachers t ON t.id = eh.teacher_id
    LEFT JOIN app_users captured ON captured.id = eh.captured_by
    LEFT JOIN app_users updated ON updated.id = eh.updated_by
    ${whereClause}
  `;
}

function applyExtraEditability(
  rows: Omit<ExtraRow, 'canEdit'>[],
  actor: SessionUser,
  actorCoordination: CoordinationRow | null
): ExtraRow[] {
  return rows.map((row) => ({
    ...row,
    canEdit: isSystemAdmin(actor) || (!!actorCoordination && actorCoordination.id === row.coordinationId)
  }));
}

async function listExtraRows(cycleId: string, actor: SessionUser, actorCoordination: CoordinationRow | null): Promise<ExtraRow[]> {
  const params: unknown[] = [cycleId];
  const visibility = isSystemAdmin(actor) ? '' : 'AND eh.coordination_id = $2';
  if (visibility) params.push(actorCoordination?.id || null);

  const rows = await query<Omit<ExtraRow, 'canEdit'>>(
    `
      ${extraSelectSql(`WHERE eh.cycle_id = $1 ${visibility}`)}
      ORDER BY eh.captured_at DESC, t.full_name ASC
    `,
    params
  );

  return applyExtraEditability(rows, actor, actorCoordination);
}

async function loadExtraById(
  client: PoolClient,
  id: string,
  actor: SessionUser,
  actorCoordination: CoordinationRow | null
): Promise<ExtraRow | null> {
  const result = await client.query<Omit<ExtraRow, 'canEdit'>>(`${extraSelectSql('WHERE eh.id = $1')} LIMIT 1`, [id]);
  const row = result.rows[0];
  return row ? applyExtraEditability([row], actor, actorCoordination)[0] : null;
}

async function listExtraTeachers(cycleId: string): Promise<ExtraTeacherRow[]> {
  const rows = await query<
    Omit<ExtraTeacherRow, 'maxHours' | 'totalWeekHours' | 'totalMod1Hours' | 'totalMod2Hours' | 'loadStatus'>
  >(
    `
      WITH schedule_load AS (
        SELECT
          teacher_id,
          COALESCE(SUM(hours_l + hours_m + hours_x + hours_j + hours_v), 0)::float8 AS week_hours,
          COALESCE(SUM(hours_l + hours_m + hours_x + hours_j + hours_v + hours_s1), 0)::float8 AS mod1_hours,
          COALESCE(SUM(hours_l + hours_m + hours_x + hours_j + hours_v + hours_s2), 0)::float8 AS mod2_hours
        FROM schedules
        WHERE cycle_id = $1
        GROUP BY teacher_id
      ),
      extras_load AS (
        SELECT
          teacher_id,
          COALESCE(SUM(hours), 0)::float8 AS logged_extra_hours
        FROM extra_hours
        WHERE cycle_id = $1
        GROUP BY teacher_id
      ),
      incidence_load AS (
        SELECT
          s.teacher_id,
          COALESCE(SUM(si.extra_hours_in_schedule), 0)::float8 AS incidence_extra_hours
        FROM schedules s
        JOIN schedule_incidences si ON si.schedule_id = s.id
        JOIN payroll_calendar_config pcc ON pcc.id = si.calendar_config_id
        WHERE s.cycle_id = $1
          AND NOT EXISTS (
            SELECT 1
            FROM payroll_runs pr
            WHERE pr.cycle_id = pcc.cycle_id
              AND pr.period_label = pcc.period_label
              AND pr.status <> 'CANCELADA'
          )
        GROUP BY s.teacher_id
      ),
      suggested AS (
        SELECT DISTINCT ON (teacher_id)
          teacher_id,
          tabulator_amount::float8 AS tabulator_amount
        FROM schedules
        WHERE cycle_id = $1
          AND tabulator_amount > 0
        ORDER BY teacher_id, updated_at DESC
      )
      SELECT
        t.id,
        t.full_name AS "fullName",
        t.category,
        t.status,
        t.coordination_id AS "coordinationId",
        COALESCE(c.name, '') AS "coordinationName",
        COALESCE(suggested.tabulator_amount, 0)::float8 AS "suggestedTabulatorAmount",
        COALESCE(sl.week_hours, 0)::float8 AS "scheduleWeekHours",
        COALESCE(sl.mod1_hours, 0)::float8 AS "scheduleMod1Hours",
        COALESCE(sl.mod2_hours, 0)::float8 AS "scheduleMod2Hours",
        COALESCE(il.incidence_extra_hours, 0)::float8 AS "incidenceExtraHours",
        COALESCE(el.logged_extra_hours, 0)::float8 AS "loggedExtraHours",
        (COALESCE(il.incidence_extra_hours, 0) + COALESCE(el.logged_extra_hours, 0))::float8 AS "extraHours"
      FROM teachers t
      LEFT JOIN coordinations c ON c.id = t.coordination_id
      LEFT JOIN schedule_load sl ON sl.teacher_id = t.id
      LEFT JOIN extras_load el ON el.teacher_id = t.id
      LEFT JOIN incidence_load il ON il.teacher_id = t.id
      LEFT JOIN suggested ON suggested.teacher_id = t.id
      WHERE t.status = 'ACTIVO'
      ORDER BY t.full_name ASC
    `,
    [cycleId]
  );

  return rows.map((row) => {
    const maxHours = categoryMaxHours(row.category);
    const totalWeekHours = row.scheduleWeekHours + row.extraHours;
    const totalMod1Hours = row.scheduleMod1Hours + row.extraHours;
    const totalMod2Hours = row.scheduleMod2Hours + row.extraHours;
    return {
      ...row,
      maxHours,
      totalWeekHours,
      totalMod1Hours,
      totalMod2Hours,
      loadStatus: loadStatus(totalWeekHours, totalMod1Hours, totalMod2Hours, maxHours)
    };
  });
}

async function listTabulators(): Promise<TabulatorRow[]> {
  return query<TabulatorRow>(
    "SELECT id, name, amount::float8 AS amount, sort_order AS \"sortOrder\" FROM tabulators WHERE status = 'ACTIVO' ORDER BY sort_order ASC, name ASC"
  );
}

async function auditExtra(
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
      VALUES ($1, $2, $3, 'extra_hour', $4, $5::jsonb, $6::jsonb)
    `,
    [actor.id, actor.email, action, entityId, JSON.stringify(beforeData || null), JSON.stringify(afterData || null)]
  );
}

function buildSummary(extras: ExtraRow[], teachers: ExtraTeacherRow[]) {
  const impactedTeachers = new Set(extras.map((extra) => extra.teacherId));
  return {
    total: extras.length,
    hours: extras.reduce((sum, extra) => sum + extra.hours, 0),
    amount: extras.reduce((sum, extra) => sum + extra.totalAmount, 0),
    impactedTeachers: impactedTeachers.size,
    overloadedTeachers: teachers.filter((teacher) => teacher.loadStatus === 'EXCEDE').length
  };
}

async function buildContext(actor: SessionUser, preferredCycleId?: string) {
  const setup = await withTransaction(async (client) => ({
    cycle: await ensureWorkingCycle(client, actor, preferredCycleId),
    actorCoordination: await loadActorCoordination(client, actor, false)
  }));

  const [cycles, coordinations, teachers, extras, tabulators] = await Promise.all([
    listCycles(),
    listActiveCoordinations(),
    listExtraTeachers(setup.cycle.id),
    listExtraRows(setup.cycle.id, actor, setup.actorCoordination),
    listTabulators()
  ]);

  return {
    activeCycle: setup.cycle,
    cycles,
    actorCoordination: setup.actorCoordination,
    coordinations: isSystemAdmin(actor) ? coordinations : setup.actorCoordination ? [setup.actorCoordination] : [],
    teachers,
    extras,
    tabulators,
    summary: buildSummary(extras, teachers)
  };
}

async function ensureNoPayrollDependency(client: PoolClient, extraId: string): Promise<void> {
  const result = await client.query<ExtraDependencyRow>(
    `
      SELECT count(*)::text AS "payrollLines"
      FROM payroll_lines
      WHERE logged_extra_hours > 0
        AND alerts::text LIKE $1
    `,
    [`%${extraId}%`]
  );
  if (Number(result.rows[0]?.payrollLines || 0) > 0) {
    throw new Error('Este extra ya fue considerado en nomina. No se puede eliminar.');
  }
}

async function assertExtraPeriodOpen(client: PoolClient, cycleId: string, activityDate?: string | null): Promise<void> {
  const result = await client.query<{ periodLabel: string }>(
    `
      SELECT pcc.period_label AS "periodLabel"
      FROM payroll_calendar_config pcc
      WHERE pcc.cycle_id = $1
        AND COALESCE($2::date, CURRENT_DATE) BETWEEN pcc.payroll_start AND pcc.payroll_end
        AND EXISTS (
          SELECT 1
          FROM payroll_runs pr
          WHERE pr.cycle_id = pcc.cycle_id
            AND pr.period_label = pcc.period_label
            AND pr.status <> 'CANCELADA'
        )
      LIMIT 1
    `,
    [cycleId, activityDate || null]
  );

  const lockedPeriod = result.rows[0];
  if (lockedPeriod) {
    throw new Error(`La quincena ${lockedPeriod.periodLabel} ya tiene nomina guardada. No se pueden capturar ni modificar extras.`);
  }
}

export async function registerExtraRoutes(app: FastifyInstance): Promise<void> {
  app.get('/extras/context', { preHandler: requirePermission('extras.manage') }, async (request, reply) => {
    const parsed = contextQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    return buildContext(request.user!, parsed.data.cycleId);
  });

  app.post('/extras', { preHandler: requirePermission('extras.manage') }, async (request, reply) => {
    const parsed = extraBodySchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const extra = await withTransaction(async (client) => {
      const cycle = await ensureWritableCycle(client, actor, parsed.data.cycleId);
      const teacher = await loadTeacherForExtra(client, parsed.data.teacherId);
      if (!teacher) throw new Error('El docente seleccionado no existe.');
      if (teacher.status !== 'ACTIVO') throw new Error('Solo se pueden capturar extras para docentes ACTIVO.');

      const coordinationId = await resolveExtraCoordination(client, actor, parsed.data, teacher);
      const tabulatorAmount = await resolveTabulatorAmount(client, parsed.data);
      await assertExtraPeriodOpen(client, cycle.id, parsed.data.activityDate || null);
      const created = await client.query<{ id: string }>(
        `
          INSERT INTO extra_hours (
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
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
          RETURNING id
        `,
        [
          cycle.id,
          coordinationId,
          teacher.id,
          parsed.data.hours,
          tabulatorAmount,
          normalizeText(parsed.data.reason),
          parsed.data.activityDate || null,
          parsed.data.reference,
          parsed.data.observations,
          actor.id
        ]
      );

      const actorCoordination = await loadActorCoordination(client, actor, false);
      const after = await loadExtraById(client, created.rows[0].id, actor, actorCoordination);
      await auditExtra(client, actor, 'EXTRA_CREATED', created.rows[0].id, null, after);
      return after;
    });

    await reply.code(201).send({ extra, message: 'Hora extra registrada correctamente.' });
  });

  app.patch('/extras/:id', { preHandler: requirePermission('extras.manage') }, async (request, reply) => {
    const params = extraParamsSchema.safeParse(request.params);
    const parsed = extraBodySchema.safeParse(request.body);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Extra invalido.' });
      return;
    }
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const extra = await withTransaction(async (client) => {
      const actorCoordination = await loadActorCoordination(client, actor, false);
      const before = await loadExtraById(client, params.data.id, actor, actorCoordination);
      if (!before) throw new Error('No se encontro el registro de extra.');
      if (before.cycleStatus === 'CERRADO') throw new Error('No se pueden modificar extras de un ciclo cerrado.');
      if (!before.canEdit) throw new Error('Solo la coordinacion que capturo este extra puede editarlo.');

      const cycle = await ensureWritableCycle(client, actor, parsed.data.cycleId || before.cycleId);
      const teacher = await loadTeacherForExtra(client, parsed.data.teacherId);
      if (!teacher) throw new Error('El docente seleccionado no existe.');
      if (teacher.status !== 'ACTIVO') throw new Error('Solo se pueden capturar extras para docentes ACTIVO.');

      const coordinationId = await resolveExtraCoordination(client, actor, parsed.data, teacher);
      const tabulatorAmount = await resolveTabulatorAmount(client, parsed.data);
      await assertExtraPeriodOpen(
        client,
        cycle.id,
        parsed.data.activityDate || dateOnly(before.activityDate) || dateOnly(before.capturedAt)
      );

      await client.query(
        `
          UPDATE extra_hours
          SET cycle_id = $1,
              coordination_id = $2,
              teacher_id = $3,
              hours = $4,
              tabulator_amount = $5,
              reason = $6,
              activity_date = $7,
              reference = $8,
              observations = $9,
              updated_at = now(),
              updated_by = $10
          WHERE id = $11
        `,
        [
          cycle.id,
          coordinationId,
          teacher.id,
          parsed.data.hours,
          tabulatorAmount,
          normalizeText(parsed.data.reason),
          parsed.data.activityDate || null,
          parsed.data.reference,
          parsed.data.observations,
          actor.id,
          before.id
        ]
      );

      const after = await loadExtraById(client, before.id, actor, actorCoordination);
      await auditExtra(client, actor, 'EXTRA_UPDATED', before.id, before, after);
      return after;
    });

    return { extra, message: 'Hora extra actualizada correctamente.' };
  });

  app.delete('/extras/:id', { preHandler: requirePermission('extras.manage') }, async (request, reply) => {
    const params = extraParamsSchema.safeParse(request.params);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Extra invalido.' });
      return;
    }

    const actor = request.user!;
    const deleted = await withTransaction(async (client) => {
      const actorCoordination = await loadActorCoordination(client, actor, false);
      const before = await loadExtraById(client, params.data.id, actor, actorCoordination);
      if (!before) throw new Error('No se encontro el registro de extra.');
      if (before.cycleStatus === 'CERRADO') throw new Error('No se pueden eliminar extras de un ciclo cerrado.');
      if (!before.canEdit) throw new Error('Solo la coordinacion que capturo este extra puede eliminarlo.');

      await assertExtraPeriodOpen(client, before.cycleId, dateOnly(before.activityDate) || dateOnly(before.capturedAt));
      await ensureNoPayrollDependency(client, before.id);
      await auditExtra(client, actor, 'EXTRA_DELETED', before.id, before, null);
      await client.query('DELETE FROM extra_hours WHERE id = $1', [before.id]);
      return before;
    });

    return { extra: deleted, message: 'Hora extra eliminada correctamente.' };
  });
}
