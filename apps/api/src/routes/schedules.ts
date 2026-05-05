import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requirePermission } from '../auth.js';
import { query, withTransaction } from '../db.js';
import type { SessionUser } from '../types.js';

type CycleStatus = 'PLANEACION' | 'ACTIVO' | 'CERRADO';
type TeacherStatus = 'ACTIVO' | 'INACTIVO';

interface CycleRow {
  id: string;
  periodLabel: string;
  quarterCode: string;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  status: CycleStatus;
}

interface CoordinationRow {
  id: string;
  name: string;
}

interface ActorCoordinationRow {
  id: string;
  name: string;
}

interface OptionRow {
  id: string;
  name: string;
}

interface TabulatorOptionRow extends OptionRow {
  amount: number;
  sortOrder: number;
}

interface TeacherScheduleRow {
  id: string;
  fullName: string;
  category: string;
  status: TeacherStatus;
  coordinationId: string | null;
  coordinationName: string;
  maxHours: number;
  currentWeekHours: number;
  currentS1Hours: number;
  currentS2Hours: number;
  currentMod1Hours: number;
  currentMod2Hours: number;
}

interface ScheduleRow {
  id: string;
  cycleId: string;
  periodLabel: string;
  quarterCode: string;
  cycleStatus: CycleStatus;
  coordinationId: string;
  coordinationName: string;
  teacherId: string;
  teacherName: string;
  teacherCategory: string;
  teacherStatus: TeacherStatus;
  subjectId: string | null;
  subjectName: string;
  groupCode: string;
  tabulatorId: string | null;
  tabulatorName: string;
  tabulatorAmount: number;
  hoursL: number;
  hoursM: number;
  hoursX: number;
  hoursJ: number;
  hoursV: number;
  hoursS1: number;
  hoursS2: number;
  weekHours: number;
  mod1Hours: number;
  mod2Hours: number;
  baseHours: number;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string;
  updatedByEmail: string;
}

interface LoadRow {
  weekHours: number;
  s1Hours: number;
  s2Hours: number;
}

const scheduleParamsSchema = z.object({
  id: z.string().uuid()
});

const contextQuerySchema = z.object({
  cycleId: z.string().uuid().optional()
});

const scheduleBodySchema = z.object({
  cycleId: z.string().uuid().optional(),
  teacherId: z.string().uuid(),
  coordinationId: z.string().uuid().optional().nullable(),
  coordinationName: z.string().trim().max(120).optional().default(''),
  subjectName: z.string().trim().min(1).max(160),
  groupCode: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .transform((value) => normalizeUpper(value)),
  tabulatorId: z.preprocess((value) => (value === '' ? undefined : value), z.string().uuid().optional()),
  tabulatorName: z.string().trim().min(1).max(120),
  tabulatorAmount: z.coerce.number().min(0).max(1_000_000),
  hoursL: z.coerce.number().min(0).max(99).default(0),
  hoursM: z.coerce.number().min(0).max(99).default(0),
  hoursX: z.coerce.number().min(0).max(99).default(0),
  hoursJ: z.coerce.number().min(0).max(99).default(0),
  hoursV: z.coerce.number().min(0).max(99).default(0),
  hoursS1: z.coerce.number().min(0).max(99).default(0),
  hoursS2: z.coerce.number().min(0).max(99).default(0)
});

type ScheduleBody = z.infer<typeof scheduleBodySchema>;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeUpper(value: string): string {
  return normalizeText(value).toUpperCase();
}

function normalizeComparable(value: string): string {
  return normalizeUpper(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sendValidation(reply: FastifyReply, error: z.ZodError): void {
  void reply.code(400).send({
    error: 'VALIDATION_ERROR',
    message: error.issues[0]?.message || 'Datos invalidos.'
  });
}

function categoryMaxHours(category: string): number {
  if (category === 'V') return 35;
  if (category === 'M') return 25;
  return 15;
}

function categoryForMessage(category: string): string {
  if (category === 'V' || category === 'M' || category === 'N') return category;
  return 'N';
}

function formatHours(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function newLoad(body: ScheduleBody) {
  const weekHours = body.hoursL + body.hoursM + body.hoursX + body.hoursJ + body.hoursV;
  return {
    weekHours,
    s1Hours: body.hoursS1,
    s2Hours: body.hoursS2,
    mod1Hours: weekHours + body.hoursS1,
    mod2Hours: weekHours + body.hoursS2,
    baseHours: weekHours + body.hoursS1 + body.hoursS2
  };
}

function validateScheduleLoad(teacher: TeacherScheduleRow, existing: LoadRow, body: ScheduleBody): void {
  if (teacher.status !== 'ACTIVO') {
    throw new Error('Solo se pueden capturar horarios para docentes con estatus ACTIVO.');
  }

  const load = newLoad(body);
  if (load.baseHours <= 0) {
    throw new Error('Captura al menos una hora para guardar el horario.');
  }

  const category = categoryForMessage(teacher.category);
  const maxHours = categoryMaxHours(category);
  const weekFinal = existing.weekHours + load.weekHours;
  const mod1Final = weekFinal + existing.s1Hours + load.s1Hours;
  const mod2Final = weekFinal + existing.s2Hours + load.s2Hours;

  if (weekFinal > maxHours) {
    throw new Error(
      `EXCEDE LIMITE SEMANAL. El docente ${teacher.fullName} (${category}) tiene maximo de ${maxHours}h. Con este registro quedaria en ${formatHours(
        weekFinal
      )}h de L-V.`
    );
  }

  if (mod1Final > maxHours) {
    throw new Error(
      `EXCEDE LIMITE MOD 1. El docente ${teacher.fullName} (${category}) tiene maximo de ${maxHours}h. Con este registro quedaria en ${formatHours(
        mod1Final
      )}h para Mod 1.`
    );
  }

  if (mod2Final > maxHours) {
    throw new Error(
      `EXCEDE LIMITE MOD 2. El docente ${teacher.fullName} (${category}) tiene maximo de ${maxHours}h. Con este registro quedaria en ${formatHours(
        mod2Final
      )}h para Mod 2.`
    );
  }
}

function cycleSelectSql(whereClause = ''): string {
  return `
    SELECT
      id,
      period_label AS "periodLabel",
      quarter_code AS "quarterCode",
      module1_start AS "module1Start",
      module1_end AS "module1End",
      module2_start AS "module2Start",
      module2_end AS "module2End",
      status
    FROM academic_cycles
    ${whereClause}
  `;
}

function scheduleSelectSql(whereClause = ''): string {
  return `
    SELECT
      s.id,
      s.cycle_id AS "cycleId",
      ac.period_label AS "periodLabel",
      ac.quarter_code AS "quarterCode",
      ac.status AS "cycleStatus",
      s.coordination_id AS "coordinationId",
      c.name AS "coordinationName",
      s.teacher_id AS "teacherId",
      t.full_name AS "teacherName",
      t.category AS "teacherCategory",
      t.status AS "teacherStatus",
      s.subject_id AS "subjectId",
      s.subject_name AS "subjectName",
      s.group_code AS "groupCode",
      s.tabulator_id AS "tabulatorId",
      s.tabulator_name AS "tabulatorName",
      s.tabulator_amount::float8 AS "tabulatorAmount",
      s.hours_l::float8 AS "hoursL",
      s.hours_m::float8 AS "hoursM",
      s.hours_x::float8 AS "hoursX",
      s.hours_j::float8 AS "hoursJ",
      s.hours_v::float8 AS "hoursV",
      s.hours_s1::float8 AS "hoursS1",
      s.hours_s2::float8 AS "hoursS2",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v)::float8 AS "weekHours",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v + s.hours_s1)::float8 AS "mod1Hours",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v + s.hours_s2)::float8 AS "mod2Hours",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v + s.hours_s1 + s.hours_s2)::float8 AS "baseHours",
      s.created_at AS "createdAt",
      s.updated_at AS "updatedAt",
      COALESCE(created.email, '') AS "createdByEmail",
      COALESCE(updated.email, '') AS "updatedByEmail"
    FROM schedules s
    JOIN academic_cycles ac ON ac.id = s.cycle_id
    JOIN coordinations c ON c.id = s.coordination_id
    JOIN teachers t ON t.id = s.teacher_id
    LEFT JOIN app_users created ON created.id = s.created_by
    LEFT JOIN app_users updated ON updated.id = s.updated_by
    ${whereClause}
  `;
}

async function listCycles(): Promise<CycleRow[]> {
  return query<CycleRow>(`
    ${cycleSelectSql()}
    ORDER BY
      CASE status
        WHEN 'ACTIVO' THEN 1
        WHEN 'PLANEACION' THEN 2
        ELSE 3
      END,
      created_at DESC
  `);
}

async function loadCycleById(client: PoolClient, id: string): Promise<CycleRow | null> {
  const result = await client.query<CycleRow>(`${cycleSelectSql('WHERE id = $1')} LIMIT 1`, [id]);
  return result.rows[0] || null;
}

async function ensureWorkingCycle(client: PoolClient, actor: SessionUser, preferredCycleId?: string): Promise<CycleRow> {
  if (preferredCycleId) {
    const cycle = await loadCycleById(client, preferredCycleId);
    if (!cycle) throw new Error('El ciclo seleccionado no existe.');
    return cycle;
  }

  const existing = await client.query<CycleRow>(
    `
      ${cycleSelectSql("WHERE status IN ('ACTIVO', 'PLANEACION')")}
      ORDER BY
        CASE status
          WHEN 'ACTIVO' THEN 1
          ELSE 2
        END,
        created_at DESC
      LIMIT 1
    `
  );
  if (existing.rows[0]) return existing.rows[0];

  const year = new Date().getFullYear();
  const created = await client.query<CycleRow>(
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
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', $7)
      ON CONFLICT (period_label, quarter_code) DO UPDATE
      SET status = 'ACTIVO',
          closed_at = NULL,
          closed_by = NULL
      RETURNING
        id,
        period_label AS "periodLabel",
        quarter_code AS "quarterCode",
        module1_start AS "module1Start",
        module1_end AS "module1End",
        module2_start AS "module2Start",
        module2_end AS "module2End",
        status
    `,
    [
      'CICLO INICIAL',
      'ACTUAL',
      `${year}-01-01`,
      `${year}-06-30`,
      `${year}-07-01`,
      `${year}-12-31`,
      actor.id
    ]
  );

  return created.rows[0];
}

async function ensureWritableCycle(client: PoolClient, actor: SessionUser, preferredCycleId?: string): Promise<CycleRow> {
  const cycle = await ensureWorkingCycle(client, actor, preferredCycleId);
  if (cycle.status === 'CERRADO') {
    throw new Error('No se pueden modificar horarios de un ciclo cerrado.');
  }
  return cycle;
}

async function getOrCreateCoordination(
  client: PoolClient,
  teacher: TeacherScheduleRow,
  body: ScheduleBody
): Promise<string> {
  if (body.coordinationId) return body.coordinationId;
  if (teacher.coordinationId) return teacher.coordinationId;

  const name = normalizeText(body.coordinationName || teacher.coordinationName || 'Sin coordinacion');
  const existing = await client.query<{ id: string }>('SELECT id FROM coordinations WHERE lower(name) = lower($1) LIMIT 1', [
    name
  ]);
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await client.query<{ id: string }>(
    'INSERT INTO coordinations (name, status) VALUES ($1, $2) RETURNING id',
    [name, 'ACTIVO']
  );
  return created.rows[0].id;
}

async function loadActorCoordination(
  client: PoolClient,
  actor: SessionUser,
  createIfMissing: boolean
): Promise<ActorCoordinationRow | null> {
  const user = await client.query<{ displayName: string; legacyUsername: string }>(
    `
      SELECT display_name AS "displayName", COALESCE(legacy_username, '') AS "legacyUsername"
      FROM app_users
      WHERE id = $1
      LIMIT 1
    `,
    [actor.id]
  );

  const candidates = [user.rows[0]?.displayName, user.rows[0]?.legacyUsername, actor.displayName]
    .map((value) => normalizeText(value || ''))
    .filter(Boolean);
  const uniqueCandidates = [...new Map(candidates.map((candidate) => [normalizeComparable(candidate), candidate])).values()];

  for (const candidate of uniqueCandidates) {
    const existing = await client.query<ActorCoordinationRow>(
      'SELECT id, name FROM coordinations WHERE lower(name) = lower($1) LIMIT 1',
      [candidate]
    );
    if (existing.rows[0]) return existing.rows[0];
  }

  if (!createIfMissing) return null;

  const name = uniqueCandidates[0] || actor.displayName || actor.email;
  const created = await client.query<ActorCoordinationRow>(
    'INSERT INTO coordinations (name, status) VALUES ($1, $2) RETURNING id, name',
    [name, 'ACTIVO']
  );
  return created.rows[0];
}

async function resolveScheduleCoordination(
  client: PoolClient,
  actor: SessionUser,
  teacher: TeacherScheduleRow,
  body: ScheduleBody
): Promise<string> {
  if (actor.role !== 'admin') {
    const actorCoordination = await loadActorCoordination(client, actor, true);
    if (!actorCoordination) throw new Error('No se pudo resolver la coordinacion del usuario logeado.');
    return actorCoordination.id;
  }

  return getOrCreateCoordination(client, teacher, body);
}

async function assertScheduleWritableByActor(
  client: PoolClient,
  actor: SessionUser,
  schedule: ScheduleRow
): Promise<void> {
  if (actor.role === 'admin') return;

  const actorCoordination = await loadActorCoordination(client, actor, false);
  if (!actorCoordination || actorCoordination.id !== schedule.coordinationId) {
    throw new Error('Solo la coordinacion que capturo este horario puede editarlo o eliminarlo.');
  }
}

async function getOrCreateSubject(client: PoolClient, subjectName: string): Promise<string | null> {
  const name = normalizeText(subjectName);
  if (!name) return null;

  const existing = await client.query<{ id: string }>('SELECT id FROM subjects WHERE lower(name) = lower($1) LIMIT 1', [
    name
  ]);
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await client.query<{ id: string }>(
    'INSERT INTO subjects (name, status) VALUES ($1, $2) RETURNING id',
    [name, 'ACTIVO']
  );
  return created.rows[0].id;
}

async function resolveTabulator(client: PoolClient, body: ScheduleBody): Promise<{ id: string; name: string; amount: number }> {
  const name = normalizeText(body.tabulatorName);
  const existing = await client.query<{ id: string; name: string; amount: number }>(
    `
      SELECT id, name, amount::float8 AS amount
      FROM tabulators
      WHERE status = 'ACTIVO'
        AND (
          ($1::uuid IS NOT NULL AND id = $1::uuid)
          OR ($1::uuid IS NULL AND lower(name) = lower($2))
        )
      ORDER BY CASE WHEN id = $1::uuid THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [body.tabulatorId || null, name]
  );

  if (!existing.rows[0]) {
    throw new Error('Selecciona un tabulador valido del catalogo.');
  }

  if (existing.rows[0].amount <= 0) {
    throw new Error('El tabulador seleccionado no tiene un monto valido.');
  }

  return existing.rows[0];
}

async function loadTeacherForSchedule(client: PoolClient, teacherId: string, cycleId: string): Promise<TeacherScheduleRow | null> {
  const result = await client.query<TeacherScheduleRow>(
    `
      WITH schedule_load AS (
        SELECT
          teacher_id,
          COALESCE(SUM(hours_l + hours_m + hours_x + hours_j + hours_v), 0)::float8 AS week_hours,
          COALESCE(SUM(hours_s1), 0)::float8 AS s1_hours,
          COALESCE(SUM(hours_s2), 0)::float8 AS s2_hours
        FROM schedules
        WHERE cycle_id = $2
        GROUP BY teacher_id
      )
      SELECT
        t.id,
        t.full_name AS "fullName",
        t.category,
        t.status,
        t.coordination_id AS "coordinationId",
        COALESCE(c.name, '') AS "coordinationName",
        CASE t.category WHEN 'V' THEN 35 WHEN 'M' THEN 25 ELSE 15 END::float8 AS "maxHours",
        COALESCE(sl.week_hours, 0)::float8 AS "currentWeekHours",
        COALESCE(sl.s1_hours, 0)::float8 AS "currentS1Hours",
        COALESCE(sl.s2_hours, 0)::float8 AS "currentS2Hours",
        (COALESCE(sl.week_hours, 0) + COALESCE(sl.s1_hours, 0))::float8 AS "currentMod1Hours",
        (COALESCE(sl.week_hours, 0) + COALESCE(sl.s2_hours, 0))::float8 AS "currentMod2Hours"
      FROM teachers t
      LEFT JOIN coordinations c ON c.id = t.coordination_id
      LEFT JOIN schedule_load sl ON sl.teacher_id = t.id
      WHERE t.id = $1
      FOR UPDATE OF t
    `,
    [teacherId, cycleId]
  );

  return result.rows[0] || null;
}

async function loadScheduleById(client: PoolClient, id: string): Promise<ScheduleRow | null> {
  const result = await client.query<ScheduleRow>(`${scheduleSelectSql('WHERE s.id = $1')} LIMIT 1`, [id]);
  return result.rows[0] || null;
}

async function loadExistingTeacherLoad(
  client: PoolClient,
  cycleId: string,
  teacherId: string,
  excludedScheduleId: string | null
): Promise<LoadRow> {
  const result = await client.query<LoadRow>(
    `
      SELECT
        COALESCE(SUM(hours_l + hours_m + hours_x + hours_j + hours_v), 0)::float8 AS "weekHours",
        COALESCE(SUM(hours_s1), 0)::float8 AS "s1Hours",
        COALESCE(SUM(hours_s2), 0)::float8 AS "s2Hours"
      FROM schedules
      WHERE cycle_id = $1
        AND teacher_id = $2
        AND ($3::uuid IS NULL OR id <> $3::uuid)
    `,
    [cycleId, teacherId, excludedScheduleId]
  );

  return result.rows[0] || { weekHours: 0, s1Hours: 0, s2Hours: 0 };
}

async function listSchedules(cycleId: string, coordinationId?: string | null): Promise<ScheduleRow[]> {
  const where = coordinationId ? 'WHERE s.cycle_id = $1 AND s.coordination_id = $2' : 'WHERE s.cycle_id = $1';
  const params = coordinationId ? [cycleId, coordinationId] : [cycleId];
  return query<ScheduleRow>(
    `
      ${scheduleSelectSql(where)}
      ORDER BY c.name ASC, t.full_name ASC, s.group_code ASC, s.subject_name ASC
    `,
    params
  );
}

async function listScheduleTeachers(cycleId: string): Promise<TeacherScheduleRow[]> {
  return query<TeacherScheduleRow>(
    `
      WITH schedule_load AS (
        SELECT
          teacher_id,
          COALESCE(SUM(hours_l + hours_m + hours_x + hours_j + hours_v), 0)::float8 AS week_hours,
          COALESCE(SUM(hours_s1), 0)::float8 AS s1_hours,
          COALESCE(SUM(hours_s2), 0)::float8 AS s2_hours
        FROM schedules
        WHERE cycle_id = $1
        GROUP BY teacher_id
      )
      SELECT
        t.id,
        t.full_name AS "fullName",
        t.category,
        t.status,
        t.coordination_id AS "coordinationId",
        COALESCE(c.name, '') AS "coordinationName",
        CASE t.category WHEN 'V' THEN 35 WHEN 'M' THEN 25 ELSE 15 END::float8 AS "maxHours",
        COALESCE(sl.week_hours, 0)::float8 AS "currentWeekHours",
        COALESCE(sl.s1_hours, 0)::float8 AS "currentS1Hours",
        COALESCE(sl.s2_hours, 0)::float8 AS "currentS2Hours",
        (COALESCE(sl.week_hours, 0) + COALESCE(sl.s1_hours, 0))::float8 AS "currentMod1Hours",
        (COALESCE(sl.week_hours, 0) + COALESCE(sl.s2_hours, 0))::float8 AS "currentMod2Hours"
      FROM teachers t
      LEFT JOIN coordinations c ON c.id = t.coordination_id
      LEFT JOIN schedule_load sl ON sl.teacher_id = t.id
      WHERE t.status = 'ACTIVO'
      ORDER BY t.full_name ASC
    `,
    [cycleId]
  );
}

async function listContextOptions() {
  const [coordinations, subjects, tabulators] = await Promise.all([
    query<CoordinationRow>("SELECT id, name FROM coordinations WHERE status = 'ACTIVO' ORDER BY name ASC"),
    query<OptionRow>("SELECT id, name FROM subjects WHERE status = 'ACTIVO' ORDER BY name ASC"),
    query<TabulatorOptionRow>(
      "SELECT id, name, amount::float8 AS amount, sort_order AS \"sortOrder\" FROM tabulators WHERE status = 'ACTIVO' ORDER BY sort_order ASC, name ASC"
    )
  ]);

  return { coordinations, subjects, tabulators };
}

function buildScheduleSummary(schedules: ScheduleRow[], teachers: TeacherScheduleRow[]) {
  return {
    total: schedules.length,
    activeTeachers: teachers.length,
    weekHours: schedules.reduce((sum, schedule) => sum + schedule.weekHours, 0),
    mod1Hours: schedules.reduce((sum, schedule) => sum + schedule.mod1Hours, 0),
    mod2Hours: schedules.reduce((sum, schedule) => sum + schedule.mod2Hours, 0),
    teachersAtLimit: teachers.filter(
      (teacher) =>
        teacher.currentWeekHours >= teacher.maxHours ||
        teacher.currentMod1Hours >= teacher.maxHours ||
        teacher.currentMod2Hours >= teacher.maxHours
    ).length
  };
}

async function buildContext(actor: SessionUser, preferredCycleId?: string) {
  const setup = await withTransaction(async (client) => ({
    cycle: await ensureWorkingCycle(client, actor, preferredCycleId),
    actorCoordination: await loadActorCoordination(client, actor, false)
  }));
  const [cycles, schedules, teachers, options] = await Promise.all([
    listCycles(),
    listSchedules(setup.cycle.id),
    listScheduleTeachers(setup.cycle.id),
    listContextOptions()
  ]);
  const coordinations =
    actor.role === 'admin'
      ? options.coordinations
      : setup.actorCoordination
        ? [setup.actorCoordination]
        : [];

  return {
    activeCycle: setup.cycle,
    cycles,
    schedules,
    teachers,
    coordinations,
    actorCoordination: setup.actorCoordination,
    subjects: options.subjects,
    tabulators: options.tabulators,
    summary: buildScheduleSummary(schedules, teachers)
  };
}

async function auditSchedule(
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
      VALUES ($1, $2, $3, 'schedule', $4, $5::jsonb, $6::jsonb)
    `,
    [actor.id, actor.email, action, entityId, JSON.stringify(beforeData || null), JSON.stringify(afterData || null)]
  );
}

export async function registerScheduleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/schedules/context', { preHandler: requirePermission('schedules.manage') }, async (request, reply) => {
    const parsed = contextQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    return buildContext(request.user!, parsed.data.cycleId);
  });

  app.post('/schedules', { preHandler: requirePermission('schedules.manage') }, async (request, reply) => {
    const parsed = scheduleBodySchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const schedule = await withTransaction(async (client) => {
      const cycle = await ensureWritableCycle(client, actor, parsed.data.cycleId);
      const teacher = await loadTeacherForSchedule(client, parsed.data.teacherId, cycle.id);
      if (!teacher) throw new Error('El docente seleccionado no existe.');

      const existing = await loadExistingTeacherLoad(client, cycle.id, teacher.id, null);
      validateScheduleLoad(teacher, existing, parsed.data);

      const coordinationId = await resolveScheduleCoordination(client, actor, teacher, parsed.data);
      const subjectId = await getOrCreateSubject(client, parsed.data.subjectName);
      const tabulator = await resolveTabulator(client, parsed.data);

      const created = await client.query<{ id: string }>(
        `
          INSERT INTO schedules (
            cycle_id,
            coordination_id,
            teacher_id,
            subject_id,
            subject_name,
            group_code,
            tabulator_id,
            tabulator_name,
            tabulator_amount,
            hours_l,
            hours_m,
            hours_x,
            hours_j,
            hours_v,
            hours_s1,
            hours_s2,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
          RETURNING id
        `,
        [
          cycle.id,
          coordinationId,
          teacher.id,
          subjectId,
          normalizeText(parsed.data.subjectName),
          parsed.data.groupCode,
          tabulator.id,
          tabulator.name,
          tabulator.amount,
          parsed.data.hoursL,
          parsed.data.hoursM,
          parsed.data.hoursX,
          parsed.data.hoursJ,
          parsed.data.hoursV,
          parsed.data.hoursS1,
          parsed.data.hoursS2,
          actor.id
        ]
      );

      const after = await loadScheduleById(client, created.rows[0].id);
      await auditSchedule(client, actor, 'SCHEDULE_CREATED', created.rows[0].id, null, after);
      return after;
    });

    await reply.code(201).send({ schedule, message: 'Horario registrado correctamente.' });
  });

  app.patch('/schedules/:id', { preHandler: requirePermission('schedules.manage') }, async (request, reply) => {
    const params = scheduleParamsSchema.safeParse(request.params);
    const parsed = scheduleBodySchema.safeParse(request.body);
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
      const before = await loadScheduleById(client, params.data.id);
      if (!before) throw new Error('No se encontro el horario.');
      await assertScheduleWritableByActor(client, actor, before);

      const cycle = await ensureWritableCycle(client, actor, parsed.data.cycleId || before.cycleId);
      const teacher = await loadTeacherForSchedule(client, parsed.data.teacherId, cycle.id);
      if (!teacher) throw new Error('El docente seleccionado no existe.');

      const existing = await loadExistingTeacherLoad(client, cycle.id, teacher.id, before.id);
      validateScheduleLoad(teacher, existing, parsed.data);

      const coordinationId = await resolveScheduleCoordination(client, actor, teacher, parsed.data);
      const subjectId = await getOrCreateSubject(client, parsed.data.subjectName);
      const tabulator = await resolveTabulator(client, parsed.data);

      await client.query(
        `
          UPDATE schedules
          SET
            cycle_id = $1,
            coordination_id = $2,
            teacher_id = $3,
            subject_id = $4,
            subject_name = $5,
            group_code = $6,
            tabulator_id = $7,
            tabulator_name = $8,
            tabulator_amount = $9,
            hours_l = $10,
            hours_m = $11,
            hours_x = $12,
            hours_j = $13,
            hours_v = $14,
            hours_s1 = $15,
            hours_s2 = $16,
            updated_at = now(),
            updated_by = $17
          WHERE id = $18
        `,
        [
          cycle.id,
          coordinationId,
          teacher.id,
          subjectId,
          normalizeText(parsed.data.subjectName),
          parsed.data.groupCode,
          tabulator.id,
          tabulator.name,
          tabulator.amount,
          parsed.data.hoursL,
          parsed.data.hoursM,
          parsed.data.hoursX,
          parsed.data.hoursJ,
          parsed.data.hoursV,
          parsed.data.hoursS1,
          parsed.data.hoursS2,
          actor.id,
          before.id
        ]
      );

      const after = await loadScheduleById(client, before.id);
      await auditSchedule(client, actor, 'SCHEDULE_UPDATED', before.id, before, after);
      return after;
    });

    return { schedule, message: 'Horario actualizado correctamente.' };
  });

  app.delete('/schedules/:id', { preHandler: requirePermission('schedules.manage') }, async (request, reply) => {
    const params = scheduleParamsSchema.safeParse(request.params);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Horario invalido.' });
      return;
    }

    const actor = request.user!;
    const deleted = await withTransaction(async (client) => {
      const before = await loadScheduleById(client, params.data.id);
      if (!before) throw new Error('No se encontro el horario.');
      if (before.cycleStatus === 'CERRADO') throw new Error('No se pueden modificar horarios de un ciclo cerrado.');
      await assertScheduleWritableByActor(client, actor, before);

      await auditSchedule(client, actor, 'SCHEDULE_DELETED', before.id, before, null);
      await client.query('DELETE FROM schedules WHERE id = $1', [before.id]);
      return before;
    });

    return { schedule: deleted, message: 'Horario eliminado correctamente.' };
  });
}
