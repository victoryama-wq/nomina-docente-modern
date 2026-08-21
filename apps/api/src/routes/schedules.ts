import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import {
  isOwnRecord,
  loadActorScope,
  selectCompatibleActorCoordination
} from '../actor-scope.js';
import { requirePermission } from '../auth.js';
import { query, withTransaction } from '../db.js';
import { addHours, formatHours as formatDecimalHours, hoursToApi, moneyToApi, moneyToDb, toHoursDecimal, toMoneyDecimal } from '../lib/decimal.js';
import type { ActorScope, SessionUser } from '../types.js';

type DecimalString = string;
type CycleStatus = 'PLANEACION' | 'ACTIVO' | 'CERRADO';
type TeacherStatus = 'ACTIVO' | 'INACTIVO';

interface CycleRow {
  id: string;
  periodLabel: string;
  quarterCode: string;
  baseHoursStartDate: string | null;
  baseHoursEndDate: string | null;
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

interface ScheduleResponsibleRow {
  id: string;
  name: string;
  email: string;
  responsibleUserId: string;
  primaryCoordinationId: string | null;
  primaryCoordinationName: string;
  hasTechnicalScope: boolean;
}

interface ScheduleResponsible {
  userId: string;
  primaryCoordinationId: string | null;
  primaryCoordinationName: string;
}

interface OptionRow {
  id: string;
  name: string;
}

interface TabulatorOptionRow extends OptionRow {
  amount: DecimalString;
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
  tabulatorAmount: DecimalString;
  hoursL: DecimalString;
  hoursM: DecimalString;
  hoursX: DecimalString;
  hoursJ: DecimalString;
  hoursV: DecimalString;
  hoursS1: DecimalString;
  hoursS2: DecimalString;
  weekHours: number;
  mod1Hours: number;
  mod2Hours: number;
  baseHours: number;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  createdByEmail: string;
  updatedByEmail: string;
  canEdit?: boolean;
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
  responsibleUserId: z.string().uuid().optional().nullable(),
  coordinationId: z.string().uuid().optional().nullable(),
  coordinationName: z.string().trim().max(120).optional().default(''),
  subjectId: z.string().uuid(),
  groupCode: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .transform((value) => normalizeUpper(value)),
  tabulatorId: z.preprocess((value) => (value === '' ? undefined : value), z.string().uuid().optional()),
  tabulatorName: z.string().trim().min(1).max(120),
  tabulatorAmount: z
    .union([z.string(), z.number()])
    .transform((value, ctx): string => {
      try {
        const decimal = toMoneyDecimal(value);
        if (decimal.lt(0) || decimal.gt(1_000_000)) throw new Error();
        return moneyToDb(decimal);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Captura un monto de tabulador valido.' });
        return '0.00';
      }
    }),
  hoursL: z.union([z.string(), z.number()]).optional().default(0).transform(decimalHourValue),
  hoursM: z.union([z.string(), z.number()]).optional().default(0).transform(decimalHourValue),
  hoursX: z.union([z.string(), z.number()]).optional().default(0).transform(decimalHourValue),
  hoursJ: z.union([z.string(), z.number()]).optional().default(0).transform(decimalHourValue),
  hoursV: z.union([z.string(), z.number()]).optional().default(0).transform(decimalHourValue),
  hoursS1: z.union([z.string(), z.number()]).optional().default(0).transform(decimalHourValue),
  hoursS2: z.union([z.string(), z.number()]).optional().default(0).transform(decimalHourValue)
});

type ScheduleBody = z.infer<typeof scheduleBodySchema>;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeUpper(value: string): string {
  return normalizeText(value).toUpperCase();
}

function sendValidation(reply: FastifyReply, error: z.ZodError): void {
  void reply.code(400).send({
    error: 'VALIDATION_ERROR',
    message: error.issues[0]?.message || 'Datos inválidos.'
  });
}

function isSystemAdmin(actor: SessionUser): boolean {
  return actor.role === 'admin' || actor.isProtectedSuperAdmin;
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

function decimalHourValue(value: string | number, ctx: z.RefinementCtx): string {
  try {
    const decimal = toHoursDecimal(value);
    if (decimal.lt(0) || decimal.gt(99)) throw new Error();
    return decimal.toString();
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Captura horas validas.' });
    return '0';
  }
}

function formatHours(value: string | number | { toString(): string }): string {
  return formatDecimalHours(value.toString());
}

function newLoad(body: ScheduleBody) {
  const weekHours = addHours(body.hoursL, body.hoursM, body.hoursX, body.hoursJ, body.hoursV);
  return {
    weekHours,
    s1Hours: toHoursDecimal(body.hoursS1),
    s2Hours: toHoursDecimal(body.hoursS2),
    mod1Hours: weekHours.plus(body.hoursS1),
    mod2Hours: weekHours.plus(body.hoursS2),
    baseHours: weekHours.plus(body.hoursS1).plus(body.hoursS2)
  };
}

function validateScheduleLoad(teacher: TeacherScheduleRow, existing: LoadRow, body: ScheduleBody): void {
  if (teacher.status !== 'ACTIVO') {
    throw new Error('Solo se pueden capturar horarios para docentes con estatus ACTIVO.');
  }

  const load = newLoad(body);
  if (load.baseHours.lte(0)) {
    throw new Error('Captura al menos una hora para guardar el horario.');
  }

  const category = categoryForMessage(teacher.category);
  const maxHours = categoryMaxHours(category);
  const weekFinal = toHoursDecimal(existing.weekHours).plus(load.weekHours);
  const mod1Final = weekFinal.plus(existing.s1Hours).plus(load.s1Hours);
  const mod2Final = weekFinal.plus(existing.s2Hours).plus(load.s2Hours);

  if (weekFinal.gt(maxHours)) {
    throw new Error(
      `EXCEDE LIMITE SEMANAL. El docente ${teacher.fullName} (${category}) tiene maximo de ${maxHours}h. Con este registro quedaria en ${formatHours(
        weekFinal
      )}h de L-V.`
    );
  }

  if (mod1Final.gt(maxHours)) {
    throw new Error(
      `EXCEDE LIMITE MOD 1. El docente ${teacher.fullName} (${category}) tiene maximo de ${maxHours}h. Con este registro quedaria en ${formatHours(
        mod1Final
      )}h para Mod 1.`
    );
  }

  if (mod2Final.gt(maxHours)) {
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
      base_hours_start_date::text AS "baseHoursStartDate",
      base_hours_end_date::text AS "baseHoursEndDate",
      module1_start::text AS "module1Start",
      module1_end::text AS "module1End",
      module2_start::text AS "module2Start",
      module2_end::text AS "module2End",
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
      s.tabulator_amount::text AS "tabulatorAmount",
      s.hours_l::text AS "hoursL",
      s.hours_m::text AS "hoursM",
      s.hours_x::text AS "hoursX",
      s.hours_j::text AS "hoursJ",
      s.hours_v::text AS "hoursV",
      s.hours_s1::text AS "hoursS1",
      s.hours_s2::text AS "hoursS2",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v)::float8 AS "weekHours",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v + s.hours_s1)::float8 AS "mod1Hours",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v + s.hours_s2)::float8 AS "mod2Hours",
      (s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v + s.hours_s1 + s.hours_s2)::float8 AS "baseHours",
      s.created_at AS "createdAt",
      s.updated_at AS "updatedAt",
      s.created_by AS "createdById",
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
    ${cycleSelectSql("WHERE status IN ('ACTIVO', 'PLANEACION')")}
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
      VALUES ($1, $2, $3, $4, $5, $6, 'PLANEACION', $7)
      ON CONFLICT (period_label, quarter_code) DO UPDATE
      SET status = academic_cycles.status
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

async function loadActiveCoordinationById(client: PoolClient, id: string): Promise<CoordinationRow | null> {
  const result = await client.query<CoordinationRow>(
    "SELECT id, name FROM coordinations WHERE id = $1 AND status = 'ACTIVO' LIMIT 1",
    [id]
  );
  return result.rows[0] || null;
}

async function loadActiveCoordinationByName(client: PoolClient, name: string): Promise<CoordinationRow | null> {
  const normalized = normalizeText(name);
  if (!normalized) return null;

  const result = await client.query<CoordinationRow>(
    "SELECT id, name FROM coordinations WHERE lower(name) = lower($1) AND status = 'ACTIVO' LIMIT 1",
    [normalized]
  );
  return result.rows[0] || null;
}

async function loadScheduleResponsible(
  client: PoolClient,
  actor: SessionUser,
  body: ScheduleBody
): Promise<ScheduleResponsible> {
  const scope = await loadActorScope(client, actor, { module: 'schedules.resolveScheduleCoordination' });

  if (!isSystemAdmin(actor) && actor.role !== 'direccion') {
    const actorCoordination = selectCompatibleActorCoordination(scope);
    return {
      userId: actor.id,
      primaryCoordinationId: actorCoordination?.id || null,
      primaryCoordinationName: actorCoordination?.name || ''
    };
  }

  if (!body.responsibleUserId) {
    return {
      userId: actor.id,
      primaryCoordinationId: null,
      primaryCoordinationName: ''
    };
  }

  const responsible = await client.query<ScheduleResponsible>(
    `
      SELECT
        u.id AS "userId",
        primary_scope.id AS "primaryCoordinationId",
        COALESCE(primary_scope.name, '') AS "primaryCoordinationName"
      FROM app_users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN LATERAL (
        SELECT c.id, c.name
        FROM user_coordinations uc
        JOIN coordinations c ON c.id = uc.coordination_id
        WHERE uc.user_id = u.id
          AND c.status = 'ACTIVO'
        ORDER BY uc.is_primary DESC, c.name ASC
        LIMIT 1
      ) primary_scope ON true
      WHERE u.id = $1
        AND u.status = 'ACTIVO'
        AND r.code IN ('coordinador', 'direccion')
      LIMIT 1
    `,
    [body.responsibleUserId]
  );

  if (!responsible.rows[0]) {
    throw new Error('Selecciona un responsable operativo activo.');
  }

  return responsible.rows[0];
}

async function resolveScheduleCoordination(
  client: PoolClient,
  actor: SessionUser,
  teacher: TeacherScheduleRow,
  body: ScheduleBody,
  responsible: ScheduleResponsible
): Promise<string> {
  const canChooseResponsible = isSystemAdmin(actor) || actor.role === 'direccion';

  if (!canChooseResponsible) {
    if (!responsible.primaryCoordinationId) {
      throw new Error('Tu usuario no tiene un ambito operativo tecnico para capturar horarios. Actualiza el usuario desde Control de Accesos.');
    }

    return responsible.primaryCoordinationId;
  }

  if (body.coordinationId) {
    const coordination = await loadActiveCoordinationById(client, body.coordinationId);
    if (!coordination) throw new Error('La coordinacion seleccionada no existe o no esta activa.');
    return coordination.id;
  }

  if (responsible.primaryCoordinationId) {
    return responsible.primaryCoordinationId;
  }

  if (teacher.coordinationId) {
    return teacher.coordinationId;
  }

  const coordinationByName = await loadActiveCoordinationByName(client, body.coordinationName || teacher.coordinationName || '');
  if (coordinationByName) {
    return coordinationByName.id;
  }

  throw new Error('Selecciona una coordinacion existente para registrar el horario.');
}

async function assertScheduleWritableByActor(
  client: PoolClient,
  actor: SessionUser,
  schedule: ScheduleRow
): Promise<void> {
  if (isSystemAdmin(actor)) return;

  const scope = await loadActorScope(client, actor, { module: 'schedules.assertScheduleWritableByActor' });
  if (actor.role === 'direccion') {
    if (isOwnRecord(scope, schedule.createdById)) return;
    throw new Error('Direccion solo puede editar o eliminar horarios propios.');
  }

  if (isOwnRecord(scope, schedule.createdById)) return;
  throw new Error('Solo puedes editar o eliminar horarios capturados por tu usuario.');
}
async function resolveSubject(
  client: PoolClient,
  subjectId: string,
  currentSubjectId: string | null = null
): Promise<{ id: string; name: string; status: 'ACTIVO' | 'INACTIVO' }> {
  const result = await client.query<{ id: string; name: string; status: 'ACTIVO' | 'INACTIVO' }>(
    'SELECT id, name, status FROM subjects WHERE id = $1 LIMIT 1',
    [subjectId]
  );
  const subject = result.rows[0];
  if (!subject) throw new Error('Selecciona una asignatura valida del catalogo.');
  if (subject.status !== 'ACTIVO' && subject.id !== currentSubjectId) {
    throw new Error('La asignatura seleccionada esta inactiva.');
  }
  return subject;
}

async function resolveTabulator(client: PoolClient, body: ScheduleBody): Promise<{ id: string; name: string; amount: DecimalString }> {
  const name = normalizeText(body.tabulatorName);
  const existing = await client.query<{ id: string; name: string; amount: DecimalString }>(
    `
      SELECT id, name, amount::text AS amount
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
    throw new Error('Selecciona un tabulador válido del catálogo.');
  }

  if (toMoneyDecimal(existing.rows[0].amount).lte(0)) {
    throw new Error('El tabulador seleccionado no tiene un monto válido.');
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
  const row = result.rows[0];
  return row ? normalizeScheduleRow(row) : null;
}

function normalizeScheduleRow(row: ScheduleRow): ScheduleRow {
  return {
    ...row,
    tabulatorAmount: moneyToApi(row.tabulatorAmount),
    hoursL: hoursToApi(row.hoursL),
    hoursM: hoursToApi(row.hoursM),
    hoursX: hoursToApi(row.hoursX),
    hoursJ: hoursToApi(row.hoursJ),
    hoursV: hoursToApi(row.hoursV),
    hoursS1: hoursToApi(row.hoursS1),
    hoursS2: hoursToApi(row.hoursS2)
  };
}

function applyScheduleEditability(
  rows: ScheduleRow[],
  actor: SessionUser,
  scope: ActorScope
): ScheduleRow[] {
  return rows.map((row) => ({
    ...normalizeScheduleRow(row),
    canEdit:
      row.cycleStatus !== 'CERRADO' &&
      (isSystemAdmin(actor) ||
        (actor.role === 'direccion'
          ? isOwnRecord(scope, row.createdById)
          : isOwnRecord(scope, row.createdById)))
  }));
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

async function listSchedules(cycleId: string, actor: SessionUser, scope: ActorScope): Promise<ScheduleRow[]> {
  const params: unknown[] = [cycleId];
  let visibility = '';

  if (!isSystemAdmin(actor)) {
    if (actor.role === 'direccion') {
      if (scope.coordinationIds.length > 0) {
        visibility = 'AND (s.coordination_id = ANY($2::uuid[]) OR s.created_by = $3)';
        params.push(scope.coordinationIds, actor.id);
      } else {
        visibility = 'AND s.created_by = $2';
        params.push(actor.id);
      }
    } else {
      visibility = 'AND s.created_by = $2';
      params.push(actor.id);
    }
  }

  const rows = await query<ScheduleRow>(
    `
      ${scheduleSelectSql(`WHERE s.cycle_id = $1 ${visibility}`)}
      ORDER BY c.name ASC, t.full_name ASC, s.group_code ASC, s.subject_name ASC
    `,
    params
  );
  return applyScheduleEditability(rows, actor, scope);
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

async function listScheduleResponsibleOptions(client: PoolClient): Promise<ScheduleResponsibleRow[]> {
  const responsibles = await client.query<ScheduleResponsibleRow>(
    `
      SELECT
        u.id,
        COALESCE(NULLIF(u.display_name, ''), u.email) AS name,
        u.email,
        u.id AS "responsibleUserId",
        primary_scope.id AS "primaryCoordinationId",
        COALESCE(primary_scope.name, '') AS "primaryCoordinationName",
        (primary_scope.id IS NOT NULL) AS "hasTechnicalScope"
      FROM app_users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN LATERAL (
        SELECT c.id, c.name
        FROM user_coordinations uc
        JOIN coordinations c ON c.id = uc.coordination_id
        WHERE uc.user_id = u.id
          AND c.status = 'ACTIVO'
        ORDER BY uc.is_primary DESC, c.name ASC
        LIMIT 1
      ) primary_scope ON true
      WHERE u.status = 'ACTIVO'
        AND r.code IN ('coordinador', 'direccion')
      ORDER BY name ASC
    `
  );

  return responsibles.rows;
}

async function listScheduleTechnicalCoordinations(client: PoolClient): Promise<CoordinationRow[]> {
  return client
    .query<CoordinationRow>("SELECT id, name FROM coordinations WHERE status = 'ACTIVO' ORDER BY name ASC")
    .then((result) => result.rows);
}

async function listContextOptions() {
  const [subjects, tabulators] = await Promise.all([
    query<OptionRow>("SELECT id, name FROM subjects WHERE status = 'ACTIVO' ORDER BY name ASC"),
    query<TabulatorOptionRow>(
      "SELECT id, name, amount::text AS amount, sort_order AS \"sortOrder\" FROM tabulators WHERE status = 'ACTIVO' ORDER BY sort_order ASC, name ASC"
    )
  ]);

  return { subjects, tabulators };
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
  const setup = await withTransaction(async (client) => {
    const scope = await loadActorScope(client, actor, { module: 'schedules.buildContext' });
    return {
      cycle: await ensureWorkingCycle(client, actor, preferredCycleId),
      scope,
      actorCoordination: selectCompatibleActorCoordination(scope),
      responsibleOptions:
        isSystemAdmin(actor) || actor.role === 'direccion' ? await listScheduleResponsibleOptions(client) : [],
      technicalCoordinations:
        isSystemAdmin(actor) || actor.role === 'direccion' ? await listScheduleTechnicalCoordinations(client) : []
    };
  });
  const [cycles, schedules, teachers, options] = await Promise.all([
    listCycles(),
    listSchedules(setup.cycle.id, actor, setup.scope),
    listScheduleTeachers(setup.cycle.id),
    listContextOptions()
  ]);
  const coordinations =
    isSystemAdmin(actor)
      ? setup.technicalCoordinations
      : actor.role === 'direccion'
        ? setup.technicalCoordinations
      : setup.actorCoordination
        ? [{ id: setup.actorCoordination.id, name: setup.actorCoordination.name }]
        : [];

  return {
    activeCycle: setup.cycle,
    cycles,
    schedules,
    teachers,
    coordinations,
    responsibles: setup.responsibleOptions,
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

      const responsible = await loadScheduleResponsible(client, actor, parsed.data);
      const coordinationId = await resolveScheduleCoordination(client, actor, teacher, parsed.data, responsible);
      const subject = await resolveSubject(client, parsed.data.subjectId);
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
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING id
        `,
        [
          cycle.id,
          coordinationId,
          teacher.id,
          subject.id,
          subject.name,
          parsed.data.groupCode,
          tabulator.id,
          tabulator.name,
          moneyToDb(tabulator.amount),
          hoursToApi(parsed.data.hoursL),
          hoursToApi(parsed.data.hoursM),
          hoursToApi(parsed.data.hoursX),
          hoursToApi(parsed.data.hoursJ),
          hoursToApi(parsed.data.hoursV),
          hoursToApi(parsed.data.hoursS1),
          hoursToApi(parsed.data.hoursS2),
          responsible.userId,
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
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Horario inválido.' });
      return;
    }
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const schedule = await withTransaction(async (client) => {
      const before = await loadScheduleById(client, params.data.id);
      if (!before) throw new Error('No se encontró el horario.');
      await assertScheduleWritableByActor(client, actor, before);

      const cycle = await ensureWritableCycle(client, actor, parsed.data.cycleId || before.cycleId);
      const teacher = await loadTeacherForSchedule(client, parsed.data.teacherId, cycle.id);
      if (!teacher) throw new Error('El docente seleccionado no existe.');

      const existing = await loadExistingTeacherLoad(client, cycle.id, teacher.id, before.id);
      validateScheduleLoad(teacher, existing, parsed.data);

      const responsible = await loadScheduleResponsible(client, actor, {
        ...parsed.data,
        responsibleUserId: parsed.data.responsibleUserId || before.createdById
      });
      const coordinationId = await resolveScheduleCoordination(client, actor, teacher, parsed.data, responsible);
      const subject = await resolveSubject(client, parsed.data.subjectId, before.subjectId);
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
            created_by = $17,
            updated_at = now(),
            updated_by = $18
          WHERE id = $19
        `,
        [
          cycle.id,
          coordinationId,
          teacher.id,
          subject.id,
          subject.name,
          parsed.data.groupCode,
          tabulator.id,
          tabulator.name,
          moneyToDb(tabulator.amount),
          hoursToApi(parsed.data.hoursL),
          hoursToApi(parsed.data.hoursM),
          hoursToApi(parsed.data.hoursX),
          hoursToApi(parsed.data.hoursJ),
          hoursToApi(parsed.data.hoursV),
          hoursToApi(parsed.data.hoursS1),
          hoursToApi(parsed.data.hoursS2),
          responsible.userId,
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
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Horario inválido.' });
      return;
    }

    const actor = request.user!;
    const deleted = await withTransaction(async (client) => {
      const before = await loadScheduleById(client, params.data.id);
      if (!before) throw new Error('No se encontró el horario.');
      if (before.cycleStatus === 'CERRADO') throw new Error('No se pueden modificar horarios de un ciclo cerrado.');
      await assertScheduleWritableByActor(client, actor, before);

      await auditSchedule(client, actor, 'SCHEDULE_DELETED', before.id, before, null);
      await client.query('DELETE FROM schedules WHERE id = $1', [before.id]);
      return before;
    });

    return { schedule: deleted, message: 'Horario eliminado correctamente.' };
  });
}
