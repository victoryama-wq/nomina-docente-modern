import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { loadActorScope } from '../actor-scope.js';
import { requireAnyPermission, requirePermissionOrProtectedSuperAdmin } from '../auth.js';
import { withTransaction } from '../db.js';
import {
  addHours,
  addMoney,
  hoursToApi,
  moneyToApi,
  moneyToDb,
  multiplyHours,
  multiplyMoney,
  toHoursDecimal,
  toMoneyDecimal
} from '../lib/decimal.js';
import { buildCsv as serializeCsv, csvAttachmentHeaders } from '../lib/csv.js';
import {
  getBaseHoursOccurrenceCounts,
  hasEligibleScheduleOccurrences
} from '../lib/base-hours-eligibility.js';
import type { ActorScope, SessionUser } from '../types.js';
import {
  ensureWorkingCycle,
  listCycles,
  type CycleRow
} from './academic-context.js';

type DecimalString = string;
type CoordinationScope = string[] | null;

interface PayrollPreviewTeacherAccess {
  teacherId: string;
  ownedByActor: boolean;
  inActorCoordination: boolean;
}

interface PayrollReadScope {
  coordinationIds: CoordinationScope;
  teacherIds: string[] | null;
  teacherAccess: Map<string, PayrollPreviewTeacherAccess>;
  actorCoordinationIds: string[];
}

interface PayrollContextQuery {
  cycleId?: string;
}

interface PayrollRunParams {
  id: string;
}

interface PayrollExportParams {
  id: string;
  kind: 'summary' | 'schedules' | 'extras';
}

interface PayrollCalendarDefaults {
  calendarConfigId: string;
  periodLabel: string;
  payrollStart: string;
  payrollEnd: string;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  baseHoursStartDate: string;
  baseHoursEndDate: string;
}

interface PayrollRunRow {
  id: string;
  cycleId: string;
  cycleLabel: string;
  periodLabel: string;
  status: 'BORRADOR' | 'CALCULADA' | 'EN_REVISION' | 'APROBADA' | 'PAGADA' | 'CERRADA' | 'CANCELADA';
  weights: Record<string, unknown>;
  summary: PayrollSummary;
  calculatedAt: string | null;
  calculatedByEmail: string;
  createdAt: string;
}

interface PayrollScheduleRow {
  id: string;
  coordinationId: string;
  coordinationName: string;
  teacherId: string;
  teacherName: string;
  teacherPaymentType: string;
  teacherCategory: string;
  teacherRfc: string;
  teacherEmail: string;
  teacherBankDetail: string;
  hasConstancia: boolean;
  subjectName: string;
  groupCode: string;
  tabulatorName: string;
  tabulatorAmount: DecimalString;
  hoursL: DecimalString;
  hoursM: DecimalString;
  hoursX: DecimalString;
  hoursJ: DecimalString;
  hoursV: DecimalString;
  hoursS1: DecimalString;
  hoursS2: DecimalString;
  absences: DecimalString;
  delays: DecimalString;
  extraHoursInSchedule: DecimalString;
}

interface PayrollExtraRow {
  id: string;
  coordinationId: string;
  coordinationName: string;
  teacherId: string;
  teacherName: string;
  teacherPaymentType: string;
  teacherCategory: string;
  teacherRfc: string;
  teacherEmail: string;
  teacherBankDetail: string;
  hasConstancia: boolean;
  hours: DecimalString;
  tabulatorAmount: DecimalString;
  totalAmount: DecimalString;
  reason: string;
  activityDate: string | null;
}

interface PayrollDayCounts {
  L: number;
  M: number;
  X: number;
  J: number;
  V: number;
}

interface PayrollCalendar {
  dayCounts: PayrollDayCounts;
  module1Saturdays: number;
  module2Saturdays: number;
  blackoutDates: string[];
}

interface PayrollInput {
  calendarConfigId?: string;
  cycleId?: string;
  periodLabel: string;
  payrollStart: string;
  payrollEnd: string;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  baseHoursStartDate: string;
  baseHoursEndDate: string;
}

interface PayrollSummary {
  lines: number;
  teachers: number;
  coordinations: number;
  baseHours: DecimalString;
  grossBaseAmount: DecimalString;
  absenceDiscountAmount: DecimalString;
  delayDiscountAmount: DecimalString;
  discountAmount: DecimalString;
  scheduleExtraHours: DecimalString;
  scheduleExtraAmount: DecimalString;
  loggedExtraHours: DecimalString;
  loggedExtraAmount: DecimalString;
  totalExtraHours: DecimalString;
  totalExtraAmount: DecimalString;
  totalAmount: DecimalString;
  alerts: number;
}

interface PayrollLine {
  key: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  paymentType?: string;
  category: string;
  baseHours: DecimalString;
  absences: DecimalString;
  delays: DecimalString;
  delayDiscountHours: DecimalString;
  grossBaseAmount: DecimalString;
  absenceDiscountAmount: DecimalString;
  delayDiscountAmount: DecimalString;
  baseNetAmount: DecimalString;
  scheduleExtraHours: DecimalString;
  scheduleExtraAmount: DecimalString;
  loggedExtraHours: DecimalString;
  loggedExtraAmount: DecimalString;
  totalExtraHours: DecimalString;
  totalExtraAmount: DecimalString;
  totalAmount: DecimalString;
  alerts: string[];
  scheduleCount: number;
  loggedExtraCount: number;
}

interface PayrollTeacherSummary extends PayrollLine {
  isTeacherAggregate: true;
  coordinationIds: string[];
  coordinationNames: string[];
  scope: {
    ownedByActor: boolean;
    inActorCoordination: boolean;
    hasOtherCoordinations: boolean;
  };
}

interface InternalPayrollLine extends PayrollLine {
  storageAlerts: string[];
}

interface PayrollScheduleDetail {
  lineKey: string;
  scheduleId: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  subjectName: string;
  groupCode: string;
  tabulatorName: string;
  tabulatorAmount: DecimalString;
  weekdayHours: DecimalString;
  module1Hours: DecimalString;
  module2Hours: DecimalString;
  baseHours: DecimalString;
  grossBaseAmount: DecimalString;
  absences: DecimalString;
  delays: DecimalString;
  delayDiscountHours: DecimalString;
  absenceDiscountAmount: DecimalString;
  delayDiscountAmount: DecimalString;
  scheduleExtraHours: DecimalString;
  scheduleExtraAmount: DecimalString;
  baseNetAmount: DecimalString;
}

interface PayrollExtraDetail {
  lineKey: string;
  extraId: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  reason: string;
  activityDate: string | null;
  hours: DecimalString;
  tabulatorAmount: DecimalString;
  totalAmount: DecimalString;
}

interface PayrollCalculation {
  activeCycle: CycleRow;
  input: PayrollInput;
  calendar: PayrollCalendar;
  summary: PayrollSummary;
  lines: InternalPayrollLine[];
  details: PayrollScheduleDetail[];
  extraDetails: PayrollExtraDetail[];
  readScope: PayrollReadScope;
}

interface PayrollLineRow {
  id: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  paymentType: string;
  category: string;
  baseHours: DecimalString;
  absences: DecimalString;
  delays: DecimalString;
  delayDiscountHours: DecimalString;
  grossBaseAmount: DecimalString;
  absenceDiscountAmount: DecimalString;
  delayDiscountAmount: DecimalString;
  baseNetAmount: DecimalString;
  scheduleExtraHours: DecimalString;
  scheduleExtraAmount: DecimalString;
  loggedExtraHours: DecimalString;
  loggedExtraAmount: DecimalString;
  totalExtraHours: DecimalString;
  totalExtraAmount: DecimalString;
  totalAmount: DecimalString;
  alerts: unknown;
}

interface PayrollCalendarConfigRow {
  id: string;
  cycleId: string;
  periodLabel: string;
  payrollStart: string;
  payrollEnd: string;
  module1Start: string | null;
  module1End: string | null;
  module2Start: string | null;
  module2End: string | null;
  baseHoursStartDate: string | null;
  baseHoursEndDate: string | null;
  incidencesAccessDays: number;
  extrasAccessDays: number;
  createdAt: string;
  updatedAt: string;
  blackoutDates: string[];
}

const contextQuerySchema = z.object({
  cycleId: z.string().uuid().optional()
});

const runParamsSchema = z.object({
  id: z.string().uuid()
});

const exportParamsSchema = runParamsSchema.extend({
  kind: z.enum(['summary', 'schedules', 'extras'])
});

const dateSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 10);
}, z.string().date().optional());

const optionalUuidSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || undefined;
}, z.string().uuid().optional());

const payrollBodySchema = z
  .object({
    calendarConfigId: optionalUuidSchema,
    cycleId: optionalUuidSchema,
    periodLabel: z.string().trim().max(120).optional().default(''),
    payrollStart: dateSchema,
    payrollEnd: dateSchema,
    module1Start: dateSchema,
    module1End: dateSchema,
    module2Start: dateSchema,
    module2End: dateSchema
  })
  .superRefine((body, ctx) => {
    const requiredFields = [
      body.payrollStart,
      body.payrollEnd,
      body.module1Start,
      body.module1End,
      body.module2Start,
      body.module2End
    ];
    if (!body.calendarConfigId && requiredFields.some((value) => !value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona una quincena de calendario válida.' });
      return;
    }
    if (body.payrollStart && body.payrollEnd && compareDateStrings(body.payrollStart, body.payrollEnd) > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La fecha inicial de nómina debe ser menor o igual al cierre.' });
    }
    if (body.module1Start && body.module1End && compareDateStrings(body.module1Start, body.module1End) > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El inicio de módulo 1 debe ser menor o igual al cierre.' });
    }
    if (body.module2Start && body.module2End && compareDateStrings(body.module2Start, body.module2End) > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El inicio de módulo 2 debe ser menor o igual al cierre.' });
    }
  });

type PayrollBody = z.infer<typeof payrollBodySchema>;
type ResolvedPayrollBody = PayrollBody & {
  payrollStart: string;
  payrollEnd: string;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  baseHoursStartDate: string;
  baseHoursEndDate: string;
};

type PayrollEligibilityError = Error & { statusCode: number; eligibilityCode: string };

function payrollEligibilityError(message: string, eligibilityCode: string): PayrollEligibilityError {
  return Object.assign(new Error(message), { statusCode: 400, eligibilityCode });
}

function isPayrollEligibilityError(error: unknown): error is PayrollEligibilityError {
  return error instanceof Error && 'eligibilityCode' in error;
}

async function sendPayrollEligibilityError(reply: FastifyReply, error: PayrollEligibilityError): Promise<void> {
  await reply.code(error.statusCode).send({ error: error.eligibilityCode, message: error.message });
}

function sendValidation(reply: FastifyReply, error: z.ZodError): void {
  void reply.code(400).send({
    error: 'VALIDATION_ERROR',
    message: error.issues[0]?.message || 'Datos inválidos.'
  });
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateOnly(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return dateKey(value);
  return String(value).slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function compareDateStrings(left: string, right: string): number {
  return parseDateKey(left).getTime() - parseDateKey(right).getTime();
}

function buildPayrollCalendar(body: ResolvedPayrollBody, blackoutDatesList: string[]): PayrollCalendar {
  const counts = getBaseHoursOccurrenceCounts({
    payrollStart: body.payrollStart,
    payrollEnd: body.payrollEnd,
    baseHoursStart: body.baseHoursStartDate,
    baseHoursEnd: body.baseHoursEndDate,
    module1Start: body.module1Start,
    module1End: body.module1End,
    module2Start: body.module2Start,
    module2End: body.module2End,
    blackoutDates: blackoutDatesList
  });
  return {
    dayCounts: counts.weekdays,
    module1Saturdays: counts.module1Saturdays,
    module2Saturdays: counts.module2Saturdays,
    blackoutDates: blackoutDatesList
  };
}

function currentFortnightDefaults(cycle: CycleRow): PayrollCalendarDefaults {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  const startDay = day <= 15 ? 1 : 16;
  const endDay = day <= 15 ? 15 : new Date(year, month + 1, 0).getDate();
  const payrollStart = dateKey(new Date(Date.UTC(year, month, startDay)));
  const payrollEnd = dateKey(new Date(Date.UTC(year, month, endDay)));

  return {
    calendarConfigId: '',
    periodLabel: `${payrollStart} a ${payrollEnd}`,
    payrollStart,
    payrollEnd,
    module1Start: cycle.module1Start,
    module1End: cycle.module1End,
    module2Start: cycle.module2Start,
    module2End: cycle.module2End,
    baseHoursStartDate: cycle.baseHoursStartDate || '',
    baseHoursEndDate: cycle.baseHoursEndDate || ''
  };
}

function normalizePayrollInput(body: ResolvedPayrollBody, cycle: CycleRow): PayrollInput {
  const periodLabel = body.periodLabel || `${body.payrollStart} a ${body.payrollEnd}`;
  return {
    calendarConfigId: body.calendarConfigId,
    cycleId: body.cycleId || cycle.id,
    periodLabel,
    payrollStart: body.payrollStart,
    payrollEnd: body.payrollEnd,
    module1Start: body.module1Start,
    module1End: body.module1End,
    module2Start: body.module2Start,
    module2End: body.module2End,
    baseHoursStartDate: body.baseHoursStartDate,
    baseHoursEndDate: body.baseHoursEndDate
  };
}

function ensureResolvedBody(body: PayrollBody): ResolvedPayrollBody {
  if (
    !body.payrollStart ||
    !body.payrollEnd ||
    !body.module1Start ||
    !body.module1End ||
    !body.module2Start ||
    !body.module2End
  ) {
    throw new Error('Selecciona una quincena de calendario válida.');
  }
  return body as ResolvedPayrollBody;
}

function canViewAllPayroll(actor: SessionUser): boolean {
  return (
    actor.role === 'admin' ||
    actor.role === 'finanzas' ||
    actor.role === 'contador' ||
    actor.role === 'contabilidad' ||
    actor.permissions.includes('finance.view') ||
    actor.permissions.includes('finance.global_view')
  );
}

function isGlobalPayrollReadOnly(actor: SessionUser): boolean {
  return (
    actor.permissions.includes('finance.global_view') &&
    !actor.permissions.includes('finance.view') &&
    !actor.permissions.includes('payroll.finalize') &&
    actor.role !== 'admin'
  );
}

function payrollCoordinationScope(actor: SessionUser, scope: ActorScope): CoordinationScope {
  return canViewAllPayroll(actor) ? null : scope.coordinationIds;
}

async function resolvePayrollPreviewTeacherScope(
  client: PoolClient,
  actor: SessionUser,
  scope: ActorScope,
  cycleId: string
): Promise<PayrollReadScope> {
  if (actor.role !== 'coordinador') {
    return {
      coordinationIds: payrollCoordinationScope(actor, scope),
      teacherIds: null,
      teacherAccess: new Map(),
      actorCoordinationIds: scope.coordinationIds
    };
  }

  const result = await client.query<PayrollPreviewTeacherAccess>(
    `
      SELECT
        t.id AS "teacherId",
        (t.created_by = $1) AS "ownedByActor",
        EXISTS (
          SELECT 1
          FROM schedules s_scope
          WHERE s_scope.teacher_id = t.id
            AND s_scope.cycle_id = $2
            AND s_scope.coordination_id = ANY($3::uuid[])
        ) AS "inActorCoordination"
      FROM teachers t
      WHERE t.created_by = $1
         OR EXISTS (
           SELECT 1
           FROM schedules s_scope
           WHERE s_scope.teacher_id = t.id
             AND s_scope.cycle_id = $2
             AND s_scope.coordination_id = ANY($3::uuid[])
         )
      ORDER BY t.id
    `,
    [actor.id, cycleId, scope.coordinationIds]
  );

  return {
    coordinationIds: null,
    teacherIds: result.rows.map((row) => row.teacherId),
    teacherAccess: new Map(result.rows.map((row) => [row.teacherId, row])),
    actorCoordinationIds: scope.coordinationIds
  };
}

function publicAlerts(alerts: string[]): string[] {
  return alerts.filter((alert) => !alert.startsWith('extra:'));
}

const FISCAL_PAYROLL_ALERTS = new Set([
  'RFC pendiente',
  'Datos bancarios pendientes',
  'Correo pendiente',
  'Constancia fiscal pendiente'
]);

function canViewFiscalPayrollData(actor: SessionUser): boolean {
  return (
    actor.role === 'admin' ||
    actor.isProtectedSuperAdmin ||
    actor.permissions.includes('fiscal.view') ||
    actor.permissions.includes('fiscal.manage')
  );
}

function publicPayrollLines(lines: PayrollLine[], actor: SessionUser): PayrollLine[] {
  const canViewFiscal = canViewFiscalPayrollData(actor);
  return lines.map((line) => {
    const alerts = line.alerts.filter((alert) => canViewFiscal || !FISCAL_PAYROLL_ALERTS.has(alert));
    if (canViewFiscal) return { ...line, alerts };
    const { paymentType: _paymentType, ...publicLine } = line;
    return { ...publicLine, alerts };
  });
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  return `${serializeCsv(headers, rows, { quoteAll: true })}\r\n`;
}

function sendCsv(reply: FastifyReply, fileName: string, content: string): void {
  const headers = csvAttachmentHeaders(fileName);
  void reply
    .header('Content-Type', headers['Content-Type'])
    .header('Content-Disposition', headers['Content-Disposition'])
    .send(content);
}

function exportFileName(run: PayrollRunRow, suffix: string): string {
  const safePeriod = run.periodLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `nomina-${safePeriod || run.id}-${suffix}.csv`;
}

function apiHours(value: unknown): DecimalString {
  return hoursToApi(value as string | number | null | undefined);
}

function apiMoney(value: unknown): DecimalString {
  return moneyToApi(value as string | number | null | undefined);
}

function normalizePayrollSummary(summary: PayrollSummary | Record<string, unknown> | null | undefined): PayrollSummary {
  const source = summary || {};
  return {
    lines: Number(source.lines || 0),
    teachers: Number(source.teachers || 0),
    coordinations: Number(source.coordinations || 0),
    baseHours: apiHours(source.baseHours),
    grossBaseAmount: apiMoney(source.grossBaseAmount),
    absenceDiscountAmount: apiMoney(source.absenceDiscountAmount),
    delayDiscountAmount: apiMoney(source.delayDiscountAmount),
    discountAmount: apiMoney(source.discountAmount),
    scheduleExtraHours: apiHours(source.scheduleExtraHours),
    scheduleExtraAmount: apiMoney(source.scheduleExtraAmount),
    loggedExtraHours: apiHours(source.loggedExtraHours),
    loggedExtraAmount: apiMoney(source.loggedExtraAmount),
    totalExtraHours: apiHours(source.totalExtraHours),
    totalExtraAmount: apiMoney(source.totalExtraAmount),
    totalAmount: apiMoney(source.totalAmount),
    alerts: Number(source.alerts || 0)
  };
}

function lineKey(teacherId: string, coordinationId: string): string {
  return `${teacherId}:${coordinationId}`;
}

function addUniqueAlert(alerts: string[], alert: string): void {
  if (!alerts.includes(alert)) alerts.push(alert);
}

function addFiscalAlerts(line: InternalPayrollLine, row: PayrollScheduleRow | PayrollExtraRow): void {
  if (!row.teacherRfc) addUniqueAlert(line.storageAlerts, 'RFC pendiente');
  if (!row.teacherBankDetail) addUniqueAlert(line.storageAlerts, 'Datos bancarios pendientes');
  if (!row.teacherEmail) addUniqueAlert(line.storageAlerts, 'Correo pendiente');
  if (!row.hasConstancia) addUniqueAlert(line.storageAlerts, 'Constancia fiscal pendiente');
}

function emptyLine(row: PayrollScheduleRow | PayrollExtraRow): InternalPayrollLine {
  return {
    key: lineKey(row.teacherId, row.coordinationId),
    teacherId: row.teacherId,
    coordinationId: row.coordinationId,
    teacherName: row.teacherName,
    coordinationName: row.coordinationName,
    paymentType: row.teacherPaymentType || '',
    category: row.teacherCategory || '',
    baseHours: '0',
    absences: '0',
    delays: '0',
    delayDiscountHours: '0',
    grossBaseAmount: '0.00',
    absenceDiscountAmount: '0.00',
    delayDiscountAmount: '0.00',
    baseNetAmount: '0.00',
    scheduleExtraHours: '0',
    scheduleExtraAmount: '0.00',
    loggedExtraHours: '0',
    loggedExtraAmount: '0.00',
    totalExtraHours: '0',
    totalExtraAmount: '0.00',
    totalAmount: '0.00',
    alerts: [],
    storageAlerts: [],
    scheduleCount: 0,
    loggedExtraCount: 0
  };
}

function getLine(lineMap: Map<string, InternalPayrollLine>, row: PayrollScheduleRow | PayrollExtraRow): InternalPayrollLine {
  const key = lineKey(row.teacherId, row.coordinationId);
  const existing = lineMap.get(key);
  if (existing) return existing;

  const created = emptyLine(row);
  addFiscalAlerts(created, row);
  lineMap.set(key, created);
  return created;
}

async function listPayrollSchedules(
  client: PoolClient,
  cycleId: string,
  calendarConfigId: string | null,
  readScope: PayrollReadScope
): Promise<PayrollScheduleRow[]> {
  const params: unknown[] = [cycleId, calendarConfigId];
  let visibility = '';
  if (readScope.teacherIds) {
    if (readScope.teacherIds.length === 0) {
      visibility = 'AND false';
    } else {
      params.push(readScope.teacherIds);
      visibility = 'AND s.teacher_id = ANY($3::uuid[])';
    }
  } else if (readScope.coordinationIds) {
    if (readScope.coordinationIds.length === 0) {
      visibility = 'AND false';
    } else {
      params.push(readScope.coordinationIds);
      visibility = 'AND s.coordination_id = ANY($3::uuid[])';
    }
  }

  const result = await client.query<PayrollScheduleRow>(
    `
      SELECT
        s.id,
        s.coordination_id AS "coordinationId",
        c.name AS "coordinationName",
        s.teacher_id AS "teacherId",
        t.full_name AS "teacherName",
        COALESCE(t.payment_type, '') AS "teacherPaymentType",
        COALESCE(t.category, '') AS "teacherCategory",
        COALESCE(t.rfc, '') AS "teacherRfc",
        COALESCE(t.email, '') AS "teacherEmail",
        COALESCE(t.bank_detail, '') AS "teacherBankDetail",
        EXISTS (
          SELECT 1
          FROM teacher_documents d
          WHERE d.teacher_id = t.id
            AND d.document_type = 'CONSTANCIA_FISCAL'
            AND d.is_current = true
        ) AS "hasConstancia",
        s.subject_name AS "subjectName",
        s.group_code AS "groupCode",
        s.tabulator_name AS "tabulatorName",
        s.tabulator_amount::text AS "tabulatorAmount",
        s.hours_l::text AS "hoursL",
        s.hours_m::text AS "hoursM",
        s.hours_x::text AS "hoursX",
        s.hours_j::text AS "hoursJ",
        s.hours_v::text AS "hoursV",
        s.hours_s1::text AS "hoursS1",
        s.hours_s2::text AS "hoursS2",
        COALESCE(si.absences, 0)::text AS absences,
        COALESCE(si.delays, 0)::text AS delays,
        COALESCE(si.extra_hours_in_schedule, 0)::text AS "extraHoursInSchedule"
      FROM schedules s
      JOIN coordinations c ON c.id = s.coordination_id
      JOIN teachers t ON t.id = s.teacher_id
      LEFT JOIN schedule_incidences si ON si.schedule_id = s.id AND si.calendar_config_id = $2::uuid
      WHERE s.cycle_id = $1
        ${visibility}
      ORDER BY c.name ASC, t.full_name ASC, s.subject_name ASC, s.group_code ASC
    `,
    params
  );

  return result.rows.map((row) => ({
    ...row,
    tabulatorAmount: apiMoney(row.tabulatorAmount),
    hoursL: apiHours(row.hoursL),
    hoursM: apiHours(row.hoursM),
    hoursX: apiHours(row.hoursX),
    hoursJ: apiHours(row.hoursJ),
    hoursV: apiHours(row.hoursV),
    hoursS1: apiHours(row.hoursS1),
    hoursS2: apiHours(row.hoursS2),
    absences: apiHours(row.absences),
    delays: apiHours(row.delays),
    extraHoursInSchedule: apiHours(row.extraHoursInSchedule)
  }));
}

async function listPayrollExtras(
  client: PoolClient,
  cycleId: string,
  payrollStart: string,
  payrollEnd: string,
  readScope: PayrollReadScope
): Promise<PayrollExtraRow[]> {
  const params: unknown[] = [cycleId, payrollStart, payrollEnd];
  let visibility = '';
  if (readScope.teacherIds) {
    if (readScope.teacherIds.length === 0) {
      visibility = 'AND false';
    } else {
      params.push(readScope.teacherIds);
      visibility = 'AND eh.teacher_id = ANY($4::uuid[])';
    }
  } else if (readScope.coordinationIds) {
    if (readScope.coordinationIds.length === 0) {
      visibility = 'AND false';
    } else {
      params.push(readScope.coordinationIds);
      visibility = 'AND eh.coordination_id = ANY($4::uuid[])';
    }
  }

  const result = await client.query<PayrollExtraRow>(
    `
      SELECT
        eh.id,
        eh.coordination_id AS "coordinationId",
        c.name AS "coordinationName",
        eh.teacher_id AS "teacherId",
        t.full_name AS "teacherName",
        COALESCE(t.payment_type, '') AS "teacherPaymentType",
        COALESCE(t.category, '') AS "teacherCategory",
        COALESCE(t.rfc, '') AS "teacherRfc",
        COALESCE(t.email, '') AS "teacherEmail",
        COALESCE(t.bank_detail, '') AS "teacherBankDetail",
        EXISTS (
          SELECT 1
          FROM teacher_documents d
          WHERE d.teacher_id = t.id
            AND d.document_type = 'CONSTANCIA_FISCAL'
            AND d.is_current = true
        ) AS "hasConstancia",
        eh.hours::text AS hours,
        eh.tabulator_amount::text AS "tabulatorAmount",
        (eh.hours * eh.tabulator_amount)::text AS "totalAmount",
        eh.reason,
        eh.activity_date AS "activityDate"
      FROM extra_hours eh
      JOIN coordinations c ON c.id = eh.coordination_id
      JOIN teachers t ON t.id = eh.teacher_id
      WHERE eh.cycle_id = $1
        AND COALESCE(eh.activity_date, eh.captured_at::date) BETWEEN $2::date AND $3::date
        ${visibility}
      ORDER BY c.name ASC, t.full_name ASC, eh.activity_date ASC NULLS LAST, eh.captured_at ASC
    `,
    params
  );

  return result.rows.map((detail) => ({
    ...detail,
    hours: apiHours(detail.hours),
    tabulatorAmount: apiMoney(detail.tabulatorAmount),
    totalAmount: apiMoney(detail.totalAmount)
  }));
}

async function listCalendarConfigs(client: PoolClient, cycleId: string): Promise<PayrollCalendarConfigRow[]> {
  const result = await client.query<Omit<PayrollCalendarConfigRow, 'blackoutDates'>>(
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
        ac.base_hours_start_date::text AS "baseHoursStartDate",
        ac.base_hours_end_date::text AS "baseHoursEndDate",
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

  const configIds = result.rows.map((config) => config.id);
  const blackoutResult = configIds.length
    ? await client.query<{ configId: string; blackoutDate: string }>(
        `
          SELECT config_id AS "configId", blackout_date::text AS "blackoutDate"
          FROM calendar_blackout_dates
          WHERE config_id = ANY($1::uuid[])
          ORDER BY blackout_date ASC
        `,
        [configIds]
      )
    : { rows: [] };

  const blackoutsByConfig = new Map<string, string[]>();
  for (const row of blackoutResult.rows) {
    const current = blackoutsByConfig.get(row.configId) || [];
    current.push(row.blackoutDate);
    blackoutsByConfig.set(row.configId, current);
  }

  return result.rows.map((config) => ({
    ...config,
    blackoutDates: blackoutsByConfig.get(config.id) || []
  }));
}

async function loadCalendarConfig(client: PoolClient, id: string): Promise<PayrollCalendarConfigRow | null> {
  const result = await client.query<Omit<PayrollCalendarConfigRow, 'blackoutDates'>>(
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
        ac.base_hours_start_date::text AS "baseHoursStartDate",
        ac.base_hours_end_date::text AS "baseHoursEndDate",
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
  const config = result.rows[0];
  if (!config) return null;

  const blackouts = await client.query<{ blackoutDate: string }>(
    `
      SELECT blackout_date::text AS "blackoutDate"
      FROM calendar_blackout_dates
      WHERE config_id = $1
      ORDER BY blackout_date ASC
    `,
    [id]
  );

  return {
    ...config,
    blackoutDates: blackouts.rows.map((row) => row.blackoutDate)
  };
}

async function resolvePayrollBody(client: PoolClient, cycle: CycleRow, body: PayrollBody): Promise<{
  body: ResolvedPayrollBody;
  blackoutDates: string[];
}> {
  if (!cycle.baseHoursStartDate || !cycle.baseHoursEndDate) {
    throw payrollEligibilityError(
      'Configura inicio y fin de horas base en Calendario antes de calcular la nómina.',
      'BASE_HOURS_DATES_INCOMPLETE'
    );
  }
  if (!body.calendarConfigId) {
    return {
      body: {
        ...ensureResolvedBody(body),
        baseHoursStartDate: dateOnly(cycle.baseHoursStartDate),
        baseHoursEndDate: dateOnly(cycle.baseHoursEndDate)
      },
      blackoutDates: []
    };
  }

  const config = await loadCalendarConfig(client, body.calendarConfigId);
  if (!config) throw new Error('La quincena de calendario seleccionada no existe.');
  if (config.cycleId !== cycle.id) throw new Error('La quincena seleccionada no pertenece al ciclo activo.');

  return {
    body: {
      ...body,
      cycleId: cycle.id,
      periodLabel: config.periodLabel,
      payrollStart: dateOnly(config.payrollStart),
      payrollEnd: dateOnly(config.payrollEnd),
      module1Start: dateOnly(cycle.module1Start),
      module1End: dateOnly(cycle.module1End),
      module2Start: dateOnly(cycle.module2Start),
      module2End: dateOnly(cycle.module2End),
      baseHoursStartDate: dateOnly(cycle.baseHoursStartDate),
      baseHoursEndDate: dateOnly(cycle.baseHoursEndDate)
    },
    blackoutDates: config.blackoutDates.map((value) => dateOnly(value))
  };
}

function calculateSchedule(
  row: PayrollScheduleRow,
  calendar: PayrollCalendar,
  line: InternalPayrollLine
): PayrollScheduleDetail {
  const hasEligibleOccurrences = hasEligibleScheduleOccurrences(row, {
    weekdays: calendar.dayCounts,
    module1Saturdays: calendar.module1Saturdays,
    module2Saturdays: calendar.module2Saturdays,
    hasEligibleDates: Object.values(calendar.dayCounts).some((count) => count > 0) ||
      calendar.module1Saturdays > 0 ||
      calendar.module2Saturdays > 0
  });
  const absences = hasEligibleOccurrences ? row.absences : '0';
  const delays = hasEligibleOccurrences ? row.delays : '0';
  const extraHoursInSchedule = hasEligibleOccurrences ? row.extraHoursInSchedule : '0';
  const weekdayHours = addHours(
    multiplyHours(row.hoursL, calendar.dayCounts.L),
    multiplyHours(row.hoursM, calendar.dayCounts.M),
    multiplyHours(row.hoursX, calendar.dayCounts.X),
    multiplyHours(row.hoursJ, calendar.dayCounts.J),
    multiplyHours(row.hoursV, calendar.dayCounts.V)
  );
  const module1Hours = multiplyHours(row.hoursS1, calendar.module1Saturdays);
  const module2Hours = multiplyHours(row.hoursS2, calendar.module2Saturdays);
  const baseHours = addHours(weekdayHours, module1Hours, module2Hours);
  const grossBaseAmount = multiplyMoney(baseHours, row.tabulatorAmount);
  const delayDiscountHours = multiplyHours(delays, '0.5');
  const absenceDiscountAmount = multiplyMoney(absences, row.tabulatorAmount);
  const delayDiscountAmount = multiplyMoney(delayDiscountHours, row.tabulatorAmount);
  const baseNetAmount = toMoneyDecimal(grossBaseAmount).minus(absenceDiscountAmount).minus(delayDiscountAmount);
  const scheduleExtraAmount = multiplyMoney(extraHoursInSchedule, row.tabulatorAmount);

  line.baseHours = apiHours(addHours(line.baseHours, baseHours));
  line.absences = apiHours(addHours(line.absences, absences));
  line.delays = apiHours(addHours(line.delays, delays));
  line.delayDiscountHours = apiHours(addHours(line.delayDiscountHours, delayDiscountHours));
  line.grossBaseAmount = apiMoney(addMoney(line.grossBaseAmount, grossBaseAmount));
  line.absenceDiscountAmount = apiMoney(addMoney(line.absenceDiscountAmount, absenceDiscountAmount));
  line.delayDiscountAmount = apiMoney(addMoney(line.delayDiscountAmount, delayDiscountAmount));
  line.baseNetAmount = apiMoney(addMoney(line.baseNetAmount, baseNetAmount));
  line.scheduleExtraHours = apiHours(addHours(line.scheduleExtraHours, extraHoursInSchedule));
  line.scheduleExtraAmount = apiMoney(addMoney(line.scheduleExtraAmount, scheduleExtraAmount));
  line.scheduleCount += 1;

  return {
    lineKey: line.key,
    scheduleId: row.id,
    teacherId: row.teacherId,
    coordinationId: row.coordinationId,
    teacherName: row.teacherName,
    coordinationName: row.coordinationName,
    subjectName: row.subjectName,
    groupCode: row.groupCode,
    tabulatorName: row.tabulatorName,
    tabulatorAmount: apiMoney(row.tabulatorAmount),
    weekdayHours: apiHours(weekdayHours),
    module1Hours: apiHours(module1Hours),
    module2Hours: apiHours(module2Hours),
    baseHours: apiHours(baseHours),
    grossBaseAmount: apiMoney(grossBaseAmount),
    absences: apiHours(absences),
    delays: apiHours(delays),
    delayDiscountHours: apiHours(delayDiscountHours),
    absenceDiscountAmount: apiMoney(absenceDiscountAmount),
    delayDiscountAmount: apiMoney(delayDiscountAmount),
    scheduleExtraHours: apiHours(extraHoursInSchedule),
    scheduleExtraAmount: apiMoney(scheduleExtraAmount),
    baseNetAmount: apiMoney(baseNetAmount)
  };
}

function applyExtra(row: PayrollExtraRow, line: InternalPayrollLine): PayrollExtraDetail {
  const totalAmount = multiplyMoney(row.hours, row.tabulatorAmount);
  line.loggedExtraHours = apiHours(addHours(line.loggedExtraHours, row.hours));
  line.loggedExtraAmount = apiMoney(addMoney(line.loggedExtraAmount, totalAmount));
  line.loggedExtraCount += 1;
  addUniqueAlert(line.storageAlerts, `extra:${row.id}`);

  return {
    lineKey: line.key,
    extraId: row.id,
    teacherId: row.teacherId,
    coordinationId: row.coordinationId,
    teacherName: row.teacherName,
    coordinationName: row.coordinationName,
    reason: row.reason,
    activityDate: row.activityDate,
    hours: apiHours(row.hours),
    tabulatorAmount: apiMoney(row.tabulatorAmount),
    totalAmount: apiMoney(totalAmount)
  };
}

function finalizeLine(line: InternalPayrollLine): InternalPayrollLine {
  line.totalExtraHours = apiHours(addHours(line.scheduleExtraHours, line.loggedExtraHours));
  line.totalExtraAmount = apiMoney(addMoney(line.scheduleExtraAmount, line.loggedExtraAmount));
  line.totalAmount = apiMoney(addMoney(line.baseNetAmount, line.totalExtraAmount));

  if (toMoneyDecimal(line.totalAmount).isNegative()) addUniqueAlert(line.storageAlerts, 'Pago neto negativo');
  if (!line.scheduleCount && line.loggedExtraCount) addUniqueAlert(line.storageAlerts, 'Solo extras en la quincena');

  const rounded: InternalPayrollLine = {
    ...line,
    baseHours: apiHours(line.baseHours),
    absences: apiHours(line.absences),
    delays: apiHours(line.delays),
    delayDiscountHours: apiHours(line.delayDiscountHours),
    grossBaseAmount: apiMoney(line.grossBaseAmount),
    absenceDiscountAmount: apiMoney(line.absenceDiscountAmount),
    delayDiscountAmount: apiMoney(line.delayDiscountAmount),
    baseNetAmount: apiMoney(line.baseNetAmount),
    scheduleExtraHours: apiHours(line.scheduleExtraHours),
    scheduleExtraAmount: apiMoney(line.scheduleExtraAmount),
    loggedExtraHours: apiHours(line.loggedExtraHours),
    loggedExtraAmount: apiMoney(line.loggedExtraAmount),
    totalExtraHours: apiHours(line.totalExtraHours),
    totalExtraAmount: apiMoney(line.totalExtraAmount),
    totalAmount: apiMoney(line.totalAmount),
    alerts: publicAlerts(line.storageAlerts),
    storageAlerts: line.storageAlerts
  };

  return rounded;
}

function buildSummary(lines: InternalPayrollLine[]): PayrollSummary {
  const teachers = new Set(lines.map((line) => line.teacherId));
  const coordinations = new Set(lines.map((line) => line.coordinationId));
  return {
    lines: lines.length,
    teachers: teachers.size,
    coordinations: coordinations.size,
    baseHours: apiHours(addHours(...lines.map((line) => line.baseHours))),
    grossBaseAmount: apiMoney(addMoney(...lines.map((line) => line.grossBaseAmount))),
    absenceDiscountAmount: apiMoney(addMoney(...lines.map((line) => line.absenceDiscountAmount))),
    delayDiscountAmount: apiMoney(addMoney(...lines.map((line) => line.delayDiscountAmount))),
    discountAmount: apiMoney(
      addMoney(...lines.flatMap((line) => [line.absenceDiscountAmount, line.delayDiscountAmount]))
    ),
    scheduleExtraHours: apiHours(addHours(...lines.map((line) => line.scheduleExtraHours))),
    scheduleExtraAmount: apiMoney(addMoney(...lines.map((line) => line.scheduleExtraAmount))),
    loggedExtraHours: apiHours(addHours(...lines.map((line) => line.loggedExtraHours))),
    loggedExtraAmount: apiMoney(addMoney(...lines.map((line) => line.loggedExtraAmount))),
    totalExtraHours: apiHours(addHours(...lines.map((line) => line.totalExtraHours))),
    totalExtraAmount: apiMoney(addMoney(...lines.map((line) => line.totalExtraAmount))),
    totalAmount: apiMoney(addMoney(...lines.map((line) => line.totalAmount))),
    alerts: lines.reduce((sum, line) => sum + line.alerts.length, 0)
  };
}

function buildTeacherSummaries(lines: PayrollLine[], readScope: PayrollReadScope): PayrollTeacherSummary[] {
  const summaries = new Map<string, PayrollTeacherSummary>();
  const actorCoordinationIds = new Set(readScope.actorCoordinationIds);

  for (const line of lines) {
    const existing = summaries.get(line.teacherId);
    if (!existing) {
      const access = readScope.teacherAccess.get(line.teacherId);
      summaries.set(line.teacherId, {
        ...line,
        key: `teacher:${line.teacherId}`,
        isTeacherAggregate: true,
        coordinationIds: [line.coordinationId],
        coordinationNames: [line.coordinationName],
        scope: {
          ownedByActor: access?.ownedByActor ?? false,
          inActorCoordination: access?.inActorCoordination ?? false,
          hasOtherCoordinations: !actorCoordinationIds.has(line.coordinationId)
        }
      });
      continue;
    }

    if (!existing.coordinationIds.includes(line.coordinationId)) existing.coordinationIds.push(line.coordinationId);
    if (!existing.coordinationNames.includes(line.coordinationName)) existing.coordinationNames.push(line.coordinationName);
    existing.coordinationName = existing.coordinationNames.join(', ');
    existing.baseHours = apiHours(addHours(existing.baseHours, line.baseHours));
    existing.absences = apiHours(addHours(existing.absences, line.absences));
    existing.delays = apiHours(addHours(existing.delays, line.delays));
    existing.delayDiscountHours = apiHours(addHours(existing.delayDiscountHours, line.delayDiscountHours));
    existing.grossBaseAmount = apiMoney(addMoney(existing.grossBaseAmount, line.grossBaseAmount));
    existing.absenceDiscountAmount = apiMoney(addMoney(existing.absenceDiscountAmount, line.absenceDiscountAmount));
    existing.delayDiscountAmount = apiMoney(addMoney(existing.delayDiscountAmount, line.delayDiscountAmount));
    existing.baseNetAmount = apiMoney(addMoney(existing.baseNetAmount, line.baseNetAmount));
    existing.scheduleExtraHours = apiHours(addHours(existing.scheduleExtraHours, line.scheduleExtraHours));
    existing.scheduleExtraAmount = apiMoney(addMoney(existing.scheduleExtraAmount, line.scheduleExtraAmount));
    existing.loggedExtraHours = apiHours(addHours(existing.loggedExtraHours, line.loggedExtraHours));
    existing.loggedExtraAmount = apiMoney(addMoney(existing.loggedExtraAmount, line.loggedExtraAmount));
    existing.totalExtraHours = apiHours(addHours(existing.totalExtraHours, line.totalExtraHours));
    existing.totalExtraAmount = apiMoney(addMoney(existing.totalExtraAmount, line.totalExtraAmount));
    existing.totalAmount = apiMoney(addMoney(existing.totalAmount, line.totalAmount));
    existing.scheduleCount += line.scheduleCount;
    existing.loggedExtraCount += line.loggedExtraCount;
    existing.alerts = [...new Set([...existing.alerts, ...line.alerts])];
    existing.scope.hasOtherCoordinations ||= !actorCoordinationIds.has(line.coordinationId);
  }

  return [...summaries.values()].sort((left, right) => left.teacherName.localeCompare(right.teacherName));
}

function publicCalculation(calculation: PayrollCalculation, actor: SessionUser) {
  const internalLines = calculation.lines.map(({ storageAlerts: _storageAlerts, ...line }) => line);
  const lines = publicPayrollLines(internalLines, actor);
  return {
    activeCycle: calculation.activeCycle,
    input: calculation.input,
    calendar: calculation.calendar,
    summary: summaryFromLines(lines),
    lines,
    ...(actor.role === 'coordinador'
      ? { teacherSummaries: buildTeacherSummaries(lines, calculation.readScope) }
      : {}),
    details: calculation.details,
    extraDetails: calculation.extraDetails
  };
}

async function calculatePayroll(client: PoolClient, actor: SessionUser, body: PayrollBody): Promise<PayrollCalculation> {
  const cycle = await ensureWorkingCycle(client, actor, body.cycleId);
  if (cycle.status !== 'ACTIVO') throw new Error('La nomina solo puede calcularse cuando el ciclo esta activo.');
  const actorScope = await loadActorScope(client, actor, { module: 'payroll.calculatePayroll' });
  const readScope = await resolvePayrollPreviewTeacherScope(client, actor, actorScope, cycle.id);
  const resolved = await resolvePayrollBody(client, cycle, body);
  const input = normalizePayrollInput(resolved.body, cycle);
  const calendar = buildPayrollCalendar(resolved.body, resolved.blackoutDates);
  const schedules = await listPayrollSchedules(client, cycle.id, resolved.body.calendarConfigId || null, readScope);
  const extras = await listPayrollExtras(
    client,
    cycle.id,
    resolved.body.payrollStart,
    resolved.body.payrollEnd,
    readScope
  );

  const lineMap = new Map<string, InternalPayrollLine>();
  const details = schedules.map((schedule) => calculateSchedule(schedule, calendar, getLine(lineMap, schedule)));
  const extraDetails = extras.map((extra) => applyExtra(extra, getLine(lineMap, extra)));
  const lines = [...lineMap.values()].map(finalizeLine).sort((left, right) => {
    const byCoordination = left.coordinationName.localeCompare(right.coordinationName);
    if (byCoordination !== 0) return byCoordination;
    return left.teacherName.localeCompare(right.teacherName);
  });

  return {
    activeCycle: cycle,
    input,
    calendar,
    summary: buildSummary(lines),
    lines,
    details,
    extraDetails,
    readScope
  };
}

async function latestPayrollDefaults(client: PoolClient, cycle: CycleRow): Promise<PayrollCalendarDefaults> {
  const fallback = currentFortnightDefaults(cycle);
  const latest = (await listCalendarConfigs(client, cycle.id))[0];
  if (!latest) return fallback;

  return {
    calendarConfigId: latest.id,
    periodLabel: latest.periodLabel || `${latest.payrollStart} a ${latest.payrollEnd}`,
    payrollStart: dateOnly(latest.payrollStart),
    payrollEnd: dateOnly(latest.payrollEnd),
    module1Start: dateOnly(cycle.module1Start),
    module1End: dateOnly(cycle.module1End),
    module2Start: dateOnly(cycle.module2Start),
    module2End: dateOnly(cycle.module2End),
    baseHoursStartDate: dateOnly(cycle.baseHoursStartDate),
    baseHoursEndDate: dateOnly(cycle.baseHoursEndDate)
  };
}

async function listRecentRuns(
  client: PoolClient,
  cycleId: string,
  readScope: PayrollReadScope
): Promise<PayrollRunRow[]> {
  const params: unknown[] = [cycleId];
  const isRestricted = readScope.teacherIds !== null || readScope.coordinationIds !== null;
  const summaryExpression = isRestricted ? "'{}'::jsonb" : 'pr.summary';
  let visibility = '';

  if (readScope.teacherIds) {
    if (!readScope.teacherIds.length) return [];
    params.push(readScope.teacherIds);
    visibility = `
        AND EXISTS (
          SELECT 1
          FROM payroll_lines pl
          WHERE pl.payroll_run_id = pr.id
            AND pl.teacher_id = ANY($2::uuid[])
        )
    `;
  } else if (readScope.coordinationIds) {
    if (!readScope.coordinationIds.length) return [];
    params.push(readScope.coordinationIds);
    visibility = `
        AND EXISTS (
          SELECT 1
          FROM payroll_lines pl
          WHERE pl.payroll_run_id = pr.id
            AND pl.coordination_id = ANY($2::uuid[])
        )
    `;
  }

  const result = await client.query<PayrollRunRow>(
    `
      SELECT
        pr.id,
        pr.cycle_id AS "cycleId",
        CONCAT(ac.period_label, ' - ', ac.quarter_code) AS "cycleLabel",
        pr.period_label AS "periodLabel",
        pr.status,
        pr.weights,
        ${summaryExpression} AS summary,
        pr.calculated_at AS "calculatedAt",
        COALESCE(u.email, '') AS "calculatedByEmail",
        pr.created_at AS "createdAt"
      FROM payroll_runs pr
      JOIN academic_cycles ac ON ac.id = pr.cycle_id
      LEFT JOIN app_users u ON u.id = pr.calculated_by
      WHERE pr.cycle_id = $1
        ${visibility}
      ORDER BY pr.created_at DESC
      LIMIT 36
    `,
    params
  );
  return result.rows.map((run) => ({ ...run, summary: normalizePayrollSummary(run.summary) }));
}

async function loadPayrollRun(client: PoolClient, id: string): Promise<PayrollRunRow | null> {
  const result = await client.query<PayrollRunRow>(
    `
      SELECT
        pr.id,
        pr.cycle_id AS "cycleId",
        CONCAT(ac.period_label, ' - ', ac.quarter_code) AS "cycleLabel",
        pr.period_label AS "periodLabel",
        pr.status,
        pr.weights,
        pr.summary,
        pr.calculated_at AS "calculatedAt",
        COALESCE(u.email, '') AS "calculatedByEmail",
        pr.created_at AS "createdAt"
      FROM payroll_runs pr
      JOIN academic_cycles ac ON ac.id = pr.cycle_id
      LEFT JOIN app_users u ON u.id = pr.calculated_by
      WHERE pr.id = $1
      LIMIT 1
    `,
    [id]
  );
  const run = result.rows[0];
  return run ? { ...run, summary: normalizePayrollSummary(run.summary) } : null;
}

async function loadPayrollLines(
  client: PoolClient,
  runId: string,
  readScope: PayrollReadScope
): Promise<PayrollLine[]> {
  const params: unknown[] = [runId];
  let visibility = '';
  if (readScope.teacherIds) {
    if (readScope.teacherIds.length > 0) {
      params.push(readScope.teacherIds);
      visibility = 'AND pl.teacher_id = ANY($2::uuid[])';
    } else {
      visibility = 'AND false';
    }
  } else if (readScope.coordinationIds) {
    if (readScope.coordinationIds.length > 0) {
      params.push(readScope.coordinationIds);
      visibility = 'AND pl.coordination_id = ANY($2::uuid[])';
    } else {
      visibility = 'AND false';
    }
  }

  const result = await client.query<PayrollLineRow>(
    `
      SELECT
        pl.id,
        pl.teacher_id AS "teacherId",
        pl.coordination_id AS "coordinationId",
        pl.teacher_name_snapshot AS "teacherName",
        pl.coordination_name_snapshot AS "coordinationName",
        pl.payment_type_snapshot AS "paymentType",
        pl.category_snapshot AS category,
        pl.base_hours::text AS "baseHours",
        pl.absences::text AS absences,
        pl.delays::text AS delays,
        pl.delay_discount_hours::text AS "delayDiscountHours",
        pl.gross_base_amount::text AS "grossBaseAmount",
        pl.absence_discount_amount::text AS "absenceDiscountAmount",
        pl.delay_discount_amount::text AS "delayDiscountAmount",
        pl.base_net_amount::text AS "baseNetAmount",
        pl.schedule_extra_hours::text AS "scheduleExtraHours",
        pl.schedule_extra_amount::text AS "scheduleExtraAmount",
        pl.logged_extra_hours::text AS "loggedExtraHours",
        pl.logged_extra_amount::text AS "loggedExtraAmount",
        pl.total_extra_hours::text AS "totalExtraHours",
        pl.total_extra_amount::text AS "totalExtraAmount",
        pl.total_amount::text AS "totalAmount",
        pl.alerts
      FROM payroll_lines pl
      WHERE pl.payroll_run_id = $1
        ${visibility}
      ORDER BY pl.coordination_name_snapshot ASC, pl.teacher_name_snapshot ASC
    `,
    params
  );

  return result.rows.map((row) => {
    const alerts = Array.isArray(row.alerts) ? row.alerts.filter((item): item is string => typeof item === 'string') : [];
    return {
      key: lineKey(row.teacherId, row.coordinationId),
      teacherId: row.teacherId,
      coordinationId: row.coordinationId,
      teacherName: row.teacherName,
      coordinationName: row.coordinationName,
      paymentType: row.paymentType,
      category: row.category,
      baseHours: apiHours(row.baseHours),
      absences: apiHours(row.absences),
      delays: apiHours(row.delays),
      delayDiscountHours: apiHours(row.delayDiscountHours),
      grossBaseAmount: apiMoney(row.grossBaseAmount),
      absenceDiscountAmount: apiMoney(row.absenceDiscountAmount),
      delayDiscountAmount: apiMoney(row.delayDiscountAmount),
      baseNetAmount: apiMoney(row.baseNetAmount),
      scheduleExtraHours: apiHours(row.scheduleExtraHours),
      scheduleExtraAmount: apiMoney(row.scheduleExtraAmount),
      loggedExtraHours: apiHours(row.loggedExtraHours),
      loggedExtraAmount: apiMoney(row.loggedExtraAmount),
      totalExtraHours: apiHours(row.totalExtraHours),
      totalExtraAmount: apiMoney(row.totalExtraAmount),
      totalAmount: apiMoney(row.totalAmount),
      alerts: publicAlerts(alerts),
      scheduleCount: 0,
      loggedExtraCount: 0
    };
  });
}

async function loadPayrollScheduleDetails(
  client: PoolClient,
  runId: string,
  readScope: PayrollReadScope
): Promise<PayrollScheduleDetail[]> {
  const params: unknown[] = [runId];
  let visibility = '';
  if (readScope.teacherIds) {
    if (readScope.teacherIds.length > 0) {
      params.push(readScope.teacherIds);
      visibility = 'AND teacher_id = ANY($2::uuid[])';
    } else {
      visibility = 'AND false';
    }
  } else if (readScope.coordinationIds) {
    if (readScope.coordinationIds.length > 0) {
      params.push(readScope.coordinationIds);
      visibility = 'AND coordination_id = ANY($2::uuid[])';
    } else {
      visibility = 'AND false';
    }
  }

  const result = await client.query<PayrollScheduleDetail>(
    `
      SELECT
        CONCAT(teacher_id::text, ':', coordination_id::text) AS "lineKey",
        schedule_id AS "scheduleId",
        teacher_id AS "teacherId",
        coordination_id AS "coordinationId",
        teacher_name_snapshot AS "teacherName",
        coordination_name_snapshot AS "coordinationName",
        subject_name_snapshot AS "subjectName",
        group_code_snapshot AS "groupCode",
        tabulator_name_snapshot AS "tabulatorName",
        tabulator_amount::text AS "tabulatorAmount",
        weekday_hours::text AS "weekdayHours",
        module1_hours::text AS "module1Hours",
        module2_hours::text AS "module2Hours",
        base_hours::text AS "baseHours",
        gross_base_amount::text AS "grossBaseAmount",
        absences::text AS absences,
        delays::text AS delays,
        delay_discount_hours::text AS "delayDiscountHours",
        absence_discount_amount::text AS "absenceDiscountAmount",
        delay_discount_amount::text AS "delayDiscountAmount",
        schedule_extra_hours::text AS "scheduleExtraHours",
        schedule_extra_amount::text AS "scheduleExtraAmount",
        base_net_amount::text AS "baseNetAmount"
      FROM payroll_schedule_details
      WHERE payroll_run_id = $1
        ${visibility}
      ORDER BY coordination_name_snapshot ASC, teacher_name_snapshot ASC, subject_name_snapshot ASC
    `,
    params
  );
  return result.rows;
}

async function loadPayrollExtraDetails(
  client: PoolClient,
  runId: string,
  readScope: PayrollReadScope
): Promise<PayrollExtraDetail[]> {
  const params: unknown[] = [runId];
  let visibility = '';
  if (readScope.teacherIds) {
    if (readScope.teacherIds.length > 0) {
      params.push(readScope.teacherIds);
      visibility = 'AND teacher_id = ANY($2::uuid[])';
    } else {
      visibility = 'AND false';
    }
  } else if (readScope.coordinationIds) {
    if (readScope.coordinationIds.length > 0) {
      params.push(readScope.coordinationIds);
      visibility = 'AND coordination_id = ANY($2::uuid[])';
    } else {
      visibility = 'AND false';
    }
  }

  const result = await client.query<PayrollExtraDetail>(
    `
      SELECT
        CONCAT(teacher_id::text, ':', coordination_id::text) AS "lineKey",
        extra_id AS "extraId",
        teacher_id AS "teacherId",
        coordination_id AS "coordinationId",
        teacher_name_snapshot AS "teacherName",
        coordination_name_snapshot AS "coordinationName",
        reason_snapshot AS reason,
        activity_date AS "activityDate",
        hours::text AS hours,
        tabulator_amount::text AS "tabulatorAmount",
        total_amount::text AS "totalAmount"
      FROM payroll_extra_details
      WHERE payroll_run_id = $1
        ${visibility}
      ORDER BY coordination_name_snapshot ASC, teacher_name_snapshot ASC, activity_date ASC NULLS LAST
    `,
    params
  );
  return result.rows;
}

function payrollLineExportHeaders(): string[] {
  return [
    'Ciclo',
    'Quincena',
    'Estatus',
    'Docente',
    'Coordinación',
    'Categoría',
    'Tipo pago',
    'Horas base',
    'Bruto base',
    'Faltas h',
    'Retardos',
    'Retardos h',
    'Descuento faltas',
    'Descuento retardos',
    'Neto base',
    'Extras incidencias h',
    'Extras incidencias monto',
    'Extras externos h',
    'Extras externos monto',
    'Total extras h',
    'Total extras monto',
    'Total',
    'Alertas'
  ];
}

function payrollLineExportRows(run: PayrollRunRow, lines: PayrollLine[]): unknown[][] {
  return lines.map((line) => [
    run.cycleLabel,
    run.periodLabel,
    run.status,
    line.teacherName,
    line.coordinationName,
    line.category,
    line.paymentType,
    line.baseHours,
    line.grossBaseAmount,
    line.absences,
    line.delays,
    line.delayDiscountHours,
    line.absenceDiscountAmount,
    line.delayDiscountAmount,
    line.baseNetAmount,
    line.scheduleExtraHours,
    line.scheduleExtraAmount,
    line.loggedExtraHours,
    line.loggedExtraAmount,
    line.totalExtraHours,
    line.totalExtraAmount,
    line.totalAmount,
    line.alerts.join(' | ')
  ]);
}

function scheduleDetailExportHeaders(): string[] {
  return [
    'Ciclo',
    'Quincena',
    'Estatus',
    'Docente',
    'Coordinación',
    'Asignatura',
    'Grupo',
    'Tabulador',
    'Monto tabulador',
    'Horas L-V',
    'Horas módulo 1',
    'Horas módulo 2',
    'Horas base',
    'Bruto base',
    'Faltas h',
    'Retardos',
    'Retardos h',
    'Descuento faltas',
    'Descuento retardos',
    'Extras incidencias h',
    'Extras incidencias monto',
    'Neto base'
  ];
}

function scheduleDetailExportRows(run: PayrollRunRow, details: PayrollScheduleDetail[]): unknown[][] {
  return details.map((detail) => [
    run.cycleLabel,
    run.periodLabel,
    run.status,
    detail.teacherName,
    detail.coordinationName,
    detail.subjectName,
    detail.groupCode,
    detail.tabulatorName,
    detail.tabulatorAmount,
    detail.weekdayHours,
    detail.module1Hours,
    detail.module2Hours,
    detail.baseHours,
    detail.grossBaseAmount,
    detail.absences,
    detail.delays,
    detail.delayDiscountHours,
    detail.absenceDiscountAmount,
    detail.delayDiscountAmount,
    detail.scheduleExtraHours,
    detail.scheduleExtraAmount,
    detail.baseNetAmount
  ]);
}

function extraDetailExportHeaders(): string[] {
  return [
    'Ciclo',
    'Quincena',
    'Estatus',
    'Docente',
    'Coordinación',
    'Fecha actividad',
    'Motivo',
    'Horas',
    'Monto tabulador',
    'Total'
  ];
}

function extraDetailExportRows(run: PayrollRunRow, details: PayrollExtraDetail[]): unknown[][] {
  return details.map((detail) => [
    run.cycleLabel,
    run.periodLabel,
    run.status,
    detail.teacherName,
    detail.coordinationName,
    detail.activityDate,
    detail.reason,
    detail.hours,
    detail.tabulatorAmount,
    detail.totalAmount
  ]);
}

function summaryFromLines(lines: PayrollLine[]): PayrollSummary {
  const internalLines = lines.map<InternalPayrollLine>((line) => ({ ...line, storageAlerts: line.alerts }));
  return buildSummary(internalLines);
}

function weightsForRun(calculation: PayrollCalculation) {
  return {
    calendarConfigId: calculation.input.calendarConfigId || '',
    payrollStart: calculation.input.payrollStart,
    payrollEnd: calculation.input.payrollEnd,
    module1Start: calculation.input.module1Start,
    module1End: calculation.input.module1End,
    module2Start: calculation.input.module2Start,
    module2End: calculation.input.module2End,
    baseHoursStartDate: calculation.input.baseHoursStartDate,
    baseHoursEndDate: calculation.input.baseHoursEndDate,
    dayCounts: calculation.calendar.dayCounts,
    module1Saturdays: calculation.calendar.module1Saturdays,
    module2Saturdays: calculation.calendar.module2Saturdays,
    blackoutDates: calculation.calendar.blackoutDates,
    delayDiscountHours: 0.5
  };
}

async function savePayrollRun(client: PoolClient, actor: SessionUser, calculation: PayrollCalculation): Promise<PayrollRunRow> {
  if (!calculation.input.calendarConfigId) {
    throw new Error('Selecciona una quincena de calendario válida antes de guardar nómina.');
  }

  const created = await client.query<{ id: string }>(
    `
      INSERT INTO payroll_runs (
        cycle_id,
        period_label,
        status,
        weights,
        summary,
        calculated_at,
        calculated_by
      )
      VALUES ($1, $2, 'CALCULADA', $3::jsonb, $4::jsonb, now(), $5)
      RETURNING id
    `,
    [
      calculation.activeCycle.id,
      calculation.input.periodLabel,
      JSON.stringify(weightsForRun(calculation)),
      JSON.stringify(calculation.summary),
      actor.id
    ]
  );

  const runId = created.rows[0].id;
  for (const line of calculation.lines) {
    await client.query(
      `
        INSERT INTO payroll_lines (
          payroll_run_id,
          teacher_id,
          coordination_id,
          teacher_name_snapshot,
          coordination_name_snapshot,
          payment_type_snapshot,
          category_snapshot,
          base_hours,
          absences,
          delays,
          delay_discount_hours,
          gross_base_amount,
          absence_discount_amount,
          delay_discount_amount,
          base_net_amount,
          schedule_extra_hours,
          schedule_extra_amount,
          logged_extra_hours,
          logged_extra_amount,
          total_extra_hours,
          total_extra_amount,
          total_amount,
          alerts
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22,
          $23::jsonb
        )
      `,
      [
        runId,
        line.teacherId,
        line.coordinationId,
        line.teacherName,
        line.coordinationName,
        line.paymentType,
        line.category,
        hoursToApi(line.baseHours),
        hoursToApi(line.absences),
        hoursToApi(line.delays),
        hoursToApi(line.delayDiscountHours),
        moneyToDb(line.grossBaseAmount),
        moneyToDb(line.absenceDiscountAmount),
        moneyToDb(line.delayDiscountAmount),
        moneyToDb(line.baseNetAmount),
        hoursToApi(line.scheduleExtraHours),
        moneyToDb(line.scheduleExtraAmount),
        hoursToApi(line.loggedExtraHours),
        moneyToDb(line.loggedExtraAmount),
        hoursToApi(line.totalExtraHours),
        moneyToDb(line.totalExtraAmount),
        moneyToDb(line.totalAmount),
        JSON.stringify(line.storageAlerts)
      ]
    );
  }

  for (const detail of calculation.details) {
    await client.query(
      `
        INSERT INTO payroll_schedule_details (
          payroll_run_id,
          schedule_id,
          teacher_id,
          coordination_id,
          teacher_name_snapshot,
          coordination_name_snapshot,
          subject_name_snapshot,
          group_code_snapshot,
          tabulator_name_snapshot,
          tabulator_amount,
          weekday_hours,
          module1_hours,
          module2_hours,
          base_hours,
          gross_base_amount,
          absences,
          delays,
          delay_discount_hours,
          absence_discount_amount,
          delay_discount_amount,
          schedule_extra_hours,
          schedule_extra_amount,
          base_net_amount,
          source_payload
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22,
          $23, $24::jsonb
        )
      `,
      [
        runId,
        detail.scheduleId,
        detail.teacherId,
        detail.coordinationId,
        detail.teacherName,
        detail.coordinationName,
        detail.subjectName,
        detail.groupCode,
        detail.tabulatorName,
        moneyToDb(detail.tabulatorAmount),
        hoursToApi(detail.weekdayHours),
        hoursToApi(detail.module1Hours),
        hoursToApi(detail.module2Hours),
        hoursToApi(detail.baseHours),
        moneyToDb(detail.grossBaseAmount),
        hoursToApi(detail.absences),
        hoursToApi(detail.delays),
        hoursToApi(detail.delayDiscountHours),
        moneyToDb(detail.absenceDiscountAmount),
        moneyToDb(detail.delayDiscountAmount),
        hoursToApi(detail.scheduleExtraHours),
        moneyToDb(detail.scheduleExtraAmount),
        moneyToDb(detail.baseNetAmount),
        JSON.stringify(detail)
      ]
    );
  }

  for (const detail of calculation.extraDetails) {
    await client.query(
      `
        INSERT INTO payroll_extra_details (
          payroll_run_id,
          extra_id,
          teacher_id,
          coordination_id,
          teacher_name_snapshot,
          coordination_name_snapshot,
          reason_snapshot,
          activity_date,
          hours,
          tabulator_amount,
          total_amount,
          source_payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      `,
      [
        runId,
        detail.extraId,
        detail.teacherId,
        detail.coordinationId,
        detail.teacherName,
        detail.coordinationName,
        detail.reason,
        detail.activityDate,
        hoursToApi(detail.hours),
        moneyToDb(detail.tabulatorAmount),
        moneyToDb(detail.totalAmount),
        JSON.stringify(detail)
      ]
    );
  }

  await client.query(
    `
      DELETE FROM schedule_incidences si
      USING schedules s
      WHERE si.schedule_id = s.id
        AND s.cycle_id = $1
        AND si.calendar_config_id = $2
    `,
    [calculation.activeCycle.id, calculation.input.calendarConfigId]
  );

  await client.query(
    `
      DELETE FROM extra_hours
      WHERE cycle_id = $1
        AND COALESCE(activity_date, captured_at::date) BETWEEN $2::date AND $3::date
    `,
    [calculation.activeCycle.id, calculation.input.payrollStart, calculation.input.payrollEnd]
  );

  await client.query(
    `
      INSERT INTO audit_log (actor_user_id, actor_email, action, entity_type, entity_id, before_data, after_data)
      VALUES ($1, $2, 'PAYROLL_CALCULATED', 'payroll_run', $3, NULL, $4::jsonb)
    `,
    [actor.id, actor.email, runId, JSON.stringify({ input: calculation.input, summary: calculation.summary })]
  );

  const run = await loadPayrollRun(client, runId);
  if (!run) throw new Error('No fue posible leer la corrida guardada.');
  return run;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

export async function registerPayrollRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/payroll/context',
    { preHandler: requireAnyPermission(['payroll.view', 'payroll.preview', 'payroll.calculate']) },
    async (request, reply) => {
    const parsed = contextQuerySchema.safeParse(request.query as PayrollContextQuery);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const context = await withTransaction(async (client) => {
      const cycle = await ensureWorkingCycle(client, actor, parsed.data.cycleId);
      const defaults = await latestPayrollDefaults(client, cycle);
      const actorScope = await loadActorScope(client, actor, { module: 'payroll.context' });
      const readScope = await resolvePayrollPreviewTeacherScope(client, actor, actorScope, cycle.id);
      const runs = await listRecentRuns(client, cycle.id, readScope);
      const calendarPeriods = await listCalendarConfigs(client, cycle.id);
      return { cycle, defaults, runs, calendarPeriods };
    });

    const cycles = await listCycles();
      return {
        activeCycle: context.cycle,
        cycles,
        defaults: context.defaults,
        calendarPeriods: context.calendarPeriods,
        recentRuns: context.runs
      };
    }
  );

  app.post('/payroll/preview', { preHandler: requireAnyPermission(['payroll.preview', 'payroll.calculate']) }, async (request, reply) => {
    const parsed = payrollBodySchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    try {
      const calculation = await withTransaction((client) => calculatePayroll(client, request.user!, parsed.data));
      return publicCalculation(calculation, request.user!);
    } catch (error) {
      if (isPayrollEligibilityError(error)) {
        await sendPayrollEligibilityError(reply, error);
        return;
      }
      throw error;
    }
  });

  app.post('/payroll/runs', { preHandler: requirePermissionOrProtectedSuperAdmin('payroll.finalize') }, async (request, reply) => {
    const parsed = payrollBodySchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    try {
      const result = await withTransaction(async (client) => {
        const calculation = await calculatePayroll(client, request.user!, parsed.data);
        const run = await savePayrollRun(client, request.user!, calculation);
        return { run, calculation };
      });

      await reply.code(201).send({
        run: result.run,
        ...publicCalculation(result.calculation, request.user!),
        message: 'Nómina guardada correctamente.'
      });
    } catch (error) {
      if (isPayrollEligibilityError(error)) {
        await sendPayrollEligibilityError(reply, error);
        return;
      }
      if (isUniqueViolation(error)) {
        await reply.code(409).send({
          error: 'PAYROLL_RUN_EXISTS',
          message: 'Ya existe una corrida de nómina con ese ciclo y etiqueta de periodo.'
        });
        return;
      }
      throw error;
    }
  });

  app.get('/payroll/runs/:id', { preHandler: requireAnyPermission(['payroll.view', 'payroll.preview', 'payroll.calculate']) }, async (request, reply) => {
    const parsed = runParamsSchema.safeParse(request.params as PayrollRunParams);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const result = await withTransaction(async (client) => {
      const run = await loadPayrollRun(client, parsed.data.id);
      if (!run) return null;
      const actorScope = await loadActorScope(client, actor, { module: 'payroll.getRun' });
      const readScope = await resolvePayrollPreviewTeacherScope(client, actor, actorScope, run.cycleId);
      const lines = await loadPayrollLines(client, run.id, readScope);
      const details = await loadPayrollScheduleDetails(client, run.id, readScope);
      const extraDetails = await loadPayrollExtraDetails(client, run.id, readScope);
      return { run, lines, details, extraDetails, readScope };
    });

    if (!result) {
      await reply.code(404).send({ error: 'NOT_FOUND', message: 'No se encontró la corrida de nómina.' });
      return;
    }

    const weights = result.run.weights || {};
    const lines = publicPayrollLines(result.lines, actor);
    return {
      run: result.run,
      input: {
        calendarConfigId: String(weights.calendarConfigId || ''),
        cycleId: result.run.cycleId,
        periodLabel: result.run.periodLabel,
        payrollStart: String(weights.payrollStart || ''),
        payrollEnd: String(weights.payrollEnd || ''),
        module1Start: String(weights.module1Start || ''),
        module1End: String(weights.module1End || ''),
        module2Start: String(weights.module2Start || ''),
        module2End: String(weights.module2End || ''),
        baseHoursStartDate: String(weights.baseHoursStartDate || ''),
        baseHoursEndDate: String(weights.baseHoursEndDate || '')
      },
      calendar: {
        dayCounts: (weights.dayCounts || { L: 0, M: 0, X: 0, J: 0, V: 0 }) as PayrollDayCounts,
        module1Saturdays: Number(weights.module1Saturdays || 0),
        module2Saturdays: Number(weights.module2Saturdays || 0),
        blackoutDates: Array.isArray(weights.blackoutDates) ? weights.blackoutDates : []
      },
      summary: summaryFromLines(lines),
      lines,
      ...(actor.role === 'coordinador' ? { teacherSummaries: buildTeacherSummaries(lines, result.readScope) } : {}),
      details: result.details,
      extraDetails: result.extraDetails
    };
  });

  app.get(
    '/payroll/runs/:id/export/:kind',
    { preHandler: requireAnyPermission(['payroll.finalize', 'finance.export']) },
    async (request, reply) => {
      const parsed = exportParamsSchema.safeParse(request.params as PayrollExportParams);
      if (!parsed.success) {
        sendValidation(reply, parsed.error);
        return;
      }

      const actor = request.user!;
      if (isGlobalPayrollReadOnly(actor)) {
        await reply.code(403).send({
          error: 'FORBIDDEN',
          message: 'Dirección/Subdirección puede consultar la nómina viva global, pero no exportar CSV desde este módulo.'
        });
        return;
      }

      const result = await withTransaction(async (client) => {
        const run = await loadPayrollRun(client, parsed.data.id);
        if (!run) return null;
        const actorScope = await loadActorScope(client, actor, { module: 'payroll.exportRun' });
        const readScope = await resolvePayrollPreviewTeacherScope(client, actor, actorScope, run.cycleId);
        const lines = await loadPayrollLines(client, run.id, readScope);
        const details = await loadPayrollScheduleDetails(client, run.id, readScope);
        const extraDetails = await loadPayrollExtraDetails(client, run.id, readScope);
        return { run, lines, details, extraDetails };
      });

      if (!result) {
        await reply.code(404).send({ error: 'NOT_FOUND', message: 'No se encontró la corrida de nómina.' });
        return;
      }

      if (parsed.data.kind === 'summary') {
        sendCsv(
          reply,
          exportFileName(result.run, 'resumen'),
          buildCsv(payrollLineExportHeaders(), payrollLineExportRows(result.run, result.lines))
        );
        return;
      }

      if (parsed.data.kind === 'schedules') {
        sendCsv(
          reply,
          exportFileName(result.run, 'horarios'),
          buildCsv(scheduleDetailExportHeaders(), scheduleDetailExportRows(result.run, result.details))
        );
        return;
      }

      sendCsv(
        reply,
        exportFileName(result.run, 'extras'),
        buildCsv(extraDetailExportHeaders(), extraDetailExportRows(result.run, result.extraDetails))
      );
    }
  );
}
