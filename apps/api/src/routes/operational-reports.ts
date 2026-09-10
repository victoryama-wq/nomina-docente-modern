import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { authenticate } from '../auth.js';
import { query } from '../db.js';
import { buildCsv, csvAttachmentHeaders } from '../lib/csv.js';
import { buildXlsxBuffer, xlsxAttachmentHeaders, type XlsxColumn, type XlsxRow } from '../lib/xlsx.js';
import type { SessionUser } from '../types.js';

type ReportSource = 'live' | 'snapshot';
type BaseExtraType = 'all' | 'withExtras' | 'withoutExtras';
type CategoryStatus = 'all' | 'completo' | 'faltante' | 'excedido';
type ExportFormat = 'csv' | 'xlsx';

interface CycleLookupRow {
  id: string;
  label: string;
  status: string;
  baseHoursStartDate: string | null;
  baseHoursEndDate: string | null;
}

interface OperationalCycleFilterRow {
  id: string;
  label: string;
  status: string;
  quarterCode: string | null;
  periodLabel: string | null;
}

interface OperationalPayrollPeriodFilterRow {
  calendarConfigId: string;
  payrollRunId: string | null;
  label: string;
  payrollStart: string;
  payrollEnd: string;
  status: string | null;
}

interface CalendarLookupRow {
  id: string;
  cycleId: string;
  periodLabel: string;
}

interface PayrollRunLookupRow {
  id: string;
  periodLabel: string;
}

interface BaseExtraRow {
  source: ReportSource;
  cycleId: string;
  cycleLabel: string;
  calendarConfigId: string | null;
  periodLabel: string | null;
  teacherId: string;
  teacherName: string;
  category: string;
  categoryLabel: string;
  coordinationId: string | null;
  coordinationName: string | null;
  scheduleResponsibleEmail: string | null;
  scheduleResponsibleName: string | null;
  baseHours: string;
  absences: string;
  delays: string;
  delayDiscountHours: string;
  netBaseHours: string;
  incidenceExtraHours: string;
  externalExtraHours: string;
  totalExtraHours: string;
  teacherFortnightHours: string;
  fortnightLimit: string;
  overloadStatus: 'normal' | 'sobrecarga';
  externalExtraCapturedByEmail: string | null;
  externalExtraCapturedByName: string | null;
  incidenceUpdatedByEmail: string | null;
  incidenceUpdatedByName: string | null;
  reason: string | null;
  activityDate: string | null;
}

interface CategoryHoursRow {
  cycleId: string;
  cycleLabel: string;
  teacherId: string;
  teacherName: string;
  category: string;
  categoryLabel: string;
  expectedHours: string;
  assignedHours: string;
  remainingHours: string;
  status: Exclude<CategoryStatus, 'all'>;
  hoursLv: string;
  hoursModule1: string;
  hoursModule2: string;
  coordinationId: string | null;
  coordinationName: string | null;
  coordinationBreakdown: string;
}

const uuidField = z.string().uuid();

const baseExtraQuerySchema = z.object({
  cycleId: uuidField,
  calendarConfigId: uuidField,
  teacherId: uuidField.optional(),
  coordinationId: uuidField.optional(),
  category: z.string().trim().min(1).optional(),
  capturedBy: uuidField.optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  type: z.enum(['all', 'withExtras', 'withoutExtras']).default('all'),
  source: z.enum(['auto', 'live', 'snapshot']).default('auto'),
  q: z.string().trim().min(1).max(120).optional()
});

const baseExtraExportQuerySchema = baseExtraQuerySchema.extend({
  format: z.enum(['csv', 'xlsx']).default('csv')
});

const categoryHoursQuerySchema = z.object({
  cycleId: uuidField,
  coordinationId: uuidField.optional(),
  teacherId: uuidField.optional(),
  category: z.string().trim().min(1).optional(),
  status: z.enum(['all', 'completo', 'faltante', 'excedido']).default('all'),
  teacherStatus: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(120).optional()
});

const categoryHoursExportQuerySchema = categoryHoursQuerySchema.extend({
  format: z.enum(['csv', 'xlsx']).default('csv')
});

const payrollPeriodFilterQuerySchema = z.object({
  cycleId: uuidField
});

function isAdmin(user: SessionUser | undefined): boolean {
  return user?.role === 'admin' || user?.isProtectedSuperAdmin === true;
}

function hasAllowedRole(user: SessionUser | undefined, roles: readonly string[]): boolean {
  if (isAdmin(user)) return true;
  return Boolean(user && roles.includes(user.role));
}

function requireOperationalBaseExtraReport() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    if (reply.sent) return;

    if (!hasAllowedRole(request.user, ['direccion', 'coordinador'])) {
      await reply.code(403).send({ error: 'FORBIDDEN', message: 'No tienes permiso para consultar este reporte operativo.' });
    }
  };
}

function requireOperationalCategoryHoursReport() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    if (reply.sent) return;

    if (!hasAllowedRole(request.user, ['direccion', 'coordinador'])) {
      await reply.code(403).send({ error: 'FORBIDDEN', message: 'No tienes permiso para consultar este reporte operativo.' });
    }
  };
}

function requireOperationalReportsModule() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    if (reply.sent) return;

    if (!hasAllowedRole(request.user, ['direccion', 'coordinador'])) {
      await reply.code(403).send({ error: 'FORBIDDEN', message: 'No tienes permiso para consultar reportes operativos.' });
    }
  };
}

function categoryLabel(category: string): string {
  if (category === 'V') return 'VIP';
  if (category === 'M') return 'Medio tiempo';
  if (category === 'N') return 'Nuevo ingreso';
  return category || 'Nuevo ingreso';
}

async function listOperationalCycleFilters(): Promise<OperationalCycleFilterRow[]> {
  return query<OperationalCycleFilterRow>(
    `
      SELECT
        id::text,
        CONCAT_WS(' - ', period_label, quarter_code) || ' / ' || status AS label,
        status::text,
        quarter_code AS "quarterCode",
        period_label AS "periodLabel"
      FROM academic_cycles
      ORDER BY
        CASE status
          WHEN 'ACTIVO' THEN 0
          WHEN 'PLANEACION' THEN 1
          WHEN 'CERRADO' THEN 2
          ELSE 3
        END,
        created_at DESC
    `
  );
}

async function listOperationalPayrollPeriodFilters(cycleId: string): Promise<OperationalPayrollPeriodFilterRow[]> {
  return query<OperationalPayrollPeriodFilterRow>(
    `
      SELECT
        pcc.id::text AS "calendarConfigId",
        pr.id::text AS "payrollRunId",
        pcc.period_label || ' / ' || pcc.payroll_start::text || ' a ' || pcc.payroll_end::text ||
          CASE WHEN pr.status IS NULL THEN ' - Sin corrida' ELSE ' - ' || pr.status END AS label,
        pcc.payroll_start::text AS "payrollStart",
        pcc.payroll_end::text AS "payrollEnd",
        pr.status::text
      FROM payroll_calendar_config pcc
      JOIN academic_cycles ac ON ac.id = pcc.cycle_id AND ac.status = 'ACTIVO'
      LEFT JOIN LATERAL (
        SELECT candidate.id, candidate.status
        FROM payroll_runs candidate
        WHERE candidate.cycle_id = pcc.cycle_id
          AND candidate.weights->>'calendarConfigId' = pcc.id::text
          AND candidate.status <> 'CANCELADA'
        ORDER BY candidate.calculated_at DESC NULLS LAST, candidate.created_at DESC
        LIMIT 1
      ) pr ON true
      WHERE pcc.cycle_id = $1::uuid
      ORDER BY pcc.payroll_start ASC, pcc.created_at ASC
    `,
    [cycleId]
  );
}

function expectedCategoryHours(category: string): string {
  if (category === 'V') return '35.00';
  if (category === 'M') return '25.00';
  return '15.00';
}

function hoursText(value: Decimal.Value): string {
  return new Decimal(value).toDecimalPlaces(2).toFixed(2);
}

function enrichBaseExtraRows(rows: BaseExtraRow[]): BaseExtraRow[] {
  const totalsByTeacher = new Map<string, {
    baseHours: Decimal;
    absences: Decimal;
    delays: Decimal;
    incidenceExtras: Decimal;
    externalExtras: Decimal;
    category: string;
  }>();

  for (const row of rows) {
    const current = totalsByTeacher.get(row.teacherId) ?? {
      baseHours: new Decimal(0),
      absences: new Decimal(0),
      delays: new Decimal(0),
      incidenceExtras: new Decimal(0),
      externalExtras: new Decimal(0),
      category: row.category
    };
    current.baseHours = current.baseHours.plus(row.baseHours || 0);
    current.absences = current.absences.plus(row.absences || 0);
    current.delays = current.delays.plus(row.delays || 0);
    current.incidenceExtras = current.incidenceExtras.plus(row.incidenceExtraHours || 0);
    current.externalExtras = current.externalExtras.plus(row.externalExtraHours || 0);
    totalsByTeacher.set(row.teacherId, current);
  }

  return rows.map((row) => {
    const totals = totalsByTeacher.get(row.teacherId)!;
    const delayDiscount = totals.delays.times(0.5);
    const netBase = Decimal.max(totals.baseHours.minus(totals.absences).minus(delayDiscount), 0);
    const realHours = netBase.plus(totals.incidenceExtras).plus(totals.externalExtras);
    const fortnightLimit = new Decimal(expectedCategoryHours(totals.category)).times(2);

    return {
      ...row,
      delayDiscountHours: hoursText(new Decimal(row.delays || 0).times(0.5)),
      netBaseHours: hoursText(
        Decimal.max(
          new Decimal(row.baseHours || 0)
            .minus(row.absences || 0)
            .minus(new Decimal(row.delays || 0).times(0.5)),
          0
        )
      ),
      teacherFortnightHours: hoursText(realHours),
      fortnightLimit: hoursText(fortnightLimit),
      overloadStatus: realHours.gt(fortnightLimit) ? 'sobrecarga' : 'normal'
    };
  });
}

function slugify(value: string | null | undefined, fallback: string): string {
  const slug = (value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

async function resolveCycle(cycleId?: string): Promise<CycleLookupRow | null> {
  if (cycleId) {
    const rows = await query<CycleLookupRow>(
      `
        SELECT
          id,
          period_label AS label,
          status::text AS status,
          base_hours_start_date::text AS "baseHoursStartDate",
          base_hours_end_date::text AS "baseHoursEndDate"
        FROM academic_cycles
        WHERE id = $1
        LIMIT 1
      `,
      [cycleId]
    );
    return rows[0] ?? null;
  }

  const rows = await query<CycleLookupRow>(
    `
      SELECT
        id,
        period_label AS label,
        status::text AS status,
        base_hours_start_date::text AS "baseHoursStartDate",
        base_hours_end_date::text AS "baseHoursEndDate"
      FROM academic_cycles
      WHERE status = 'ACTIVO'
      ORDER BY created_at DESC
      LIMIT 1
    `
  );
  return rows[0] ?? null;
}

async function loadCalendarConfig(calendarConfigId: string | undefined, cycleId: string): Promise<CalendarLookupRow | null> {
  if (!calendarConfigId) return null;

  const rows = await query<CalendarLookupRow>(
    `
      SELECT id, cycle_id AS "cycleId", period_label AS "periodLabel"
      FROM payroll_calendar_config
      WHERE id = $1
        AND cycle_id = $2
      LIMIT 1
    `,
    [calendarConfigId, cycleId]
  );
  return rows[0] ?? null;
}

async function findSnapshotRun(cycleId: string, calendarConfigId: string): Promise<PayrollRunLookupRow | null> {
  const rows = await query<PayrollRunLookupRow>(
    `
      SELECT id, period_label AS "periodLabel"
      FROM payroll_runs
      WHERE cycle_id = $1
        AND status <> 'CANCELADA'
        AND weights->>'calendarConfigId' = $2
      ORDER BY calculated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
    [cycleId, calendarConfigId]
  );
  return rows[0] ?? null;
}

async function listBaseExtraLiveRows(
  cycle: CycleLookupRow,
  calendar: CalendarLookupRow | null,
  filters: z.infer<typeof baseExtraQuerySchema>
): Promise<BaseExtraRow[]> {
  const rows = await query<BaseExtraRow>(
    `
      WITH calendar_counts AS (
        SELECT
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 1 AND day_value::date BETWEEN ac.base_hours_start_date AND ac.base_hours_end_date AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS monday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 2 AND day_value::date BETWEEN ac.base_hours_start_date AND ac.base_hours_end_date AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS tuesday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 3 AND day_value::date BETWEEN ac.base_hours_start_date AND ac.base_hours_end_date AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS wednesday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 4 AND day_value::date BETWEEN ac.base_hours_start_date AND ac.base_hours_end_date AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS thursday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 5 AND day_value::date BETWEEN ac.base_hours_start_date AND ac.base_hours_end_date AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS friday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 6 AND day_value::date BETWEEN ac.base_hours_start_date AND ac.base_hours_end_date AND day_value::date BETWEEN ac.module1_start AND ac.module1_end AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS module1_saturday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 6 AND day_value::date BETWEEN ac.base_hours_start_date AND ac.base_hours_end_date AND day_value::date BETWEEN ac.module2_start AND ac.module2_end AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS module2_saturday_count
        FROM payroll_calendar_config pcc
        JOIN academic_cycles ac ON ac.id = pcc.cycle_id
        LEFT JOIN LATERAL generate_series(pcc.payroll_start, pcc.payroll_end, interval '1 day') AS generated(day_value) ON true
        LEFT JOIN calendar_blackout_dates cbd ON cbd.config_id = pcc.id AND cbd.blackout_date = generated.day_value::date
        WHERE pcc.id = $2::uuid
      ),
      schedule_eligibility AS (
        SELECT
          s.id AS schedule_id,
          (
            $2::uuid IS NULL OR
            s.hours_l * cc.monday_count +
            s.hours_m * cc.tuesday_count +
            s.hours_x * cc.wednesday_count +
            s.hours_j * cc.thursday_count +
            s.hours_v * cc.friday_count +
            s.hours_s1 * cc.module1_saturday_count +
            s.hours_s2 * cc.module2_saturday_count > 0
          ) AS has_eligible_occurrences
        FROM schedules s
        CROSS JOIN calendar_counts cc
        WHERE s.cycle_id = $1::uuid
      ),
      schedule_base AS (
        SELECT
          s.teacher_id,
          s.coordination_id,
          SUM(
            CASE
              WHEN $2::uuid IS NOT NULL THEN
                s.hours_l * cc.monday_count +
                s.hours_m * cc.tuesday_count +
                s.hours_x * cc.wednesday_count +
                s.hours_j * cc.thursday_count +
                s.hours_v * cc.friday_count +
                s.hours_s1 * cc.module1_saturday_count +
                s.hours_s2 * cc.module2_saturday_count
              ELSE
                s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v + s.hours_s1 + s.hours_s2
            END
          )::numeric(12, 2) AS base_hours,
          string_agg(DISTINCT responsible.email, '; ' ORDER BY responsible.email)
            FILTER (WHERE responsible.email IS NOT NULL) AS schedule_responsible_email,
          string_agg(DISTINCT responsible.display_name, '; ' ORDER BY responsible.display_name)
            FILTER (WHERE responsible.display_name IS NOT NULL) AS schedule_responsible_name
        FROM schedules s
        CROSS JOIN calendar_counts cc
        JOIN teachers t ON t.id = s.teacher_id
        LEFT JOIN app_users responsible ON responsible.id = s.created_by
        WHERE s.cycle_id = $1::uuid
          AND t.status = 'ACTIVO'
          AND ($3::uuid IS NULL OR s.teacher_id = $3::uuid)
          AND ($4::uuid IS NULL OR s.coordination_id = $4::uuid)
          AND ($5::text IS NULL OR t.category = $5::text)
        GROUP BY s.teacher_id, s.coordination_id
      ),
      incidence_extra AS (
        SELECT
          s.teacher_id,
          s.coordination_id,
          SUM(si.absences)::numeric(12, 2) AS absences,
          SUM(si.delays)::numeric(12, 2) AS delays,
          SUM(si.extra_hours_in_schedule)::numeric(12, 2) AS incidence_extra_hours,
          string_agg(DISTINCT updater.email, '; ' ORDER BY updater.email) FILTER (WHERE updater.email IS NOT NULL) AS incidence_updated_by_email,
          string_agg(DISTINCT updater.display_name, '; ' ORDER BY updater.display_name) FILTER (WHERE updater.display_name IS NOT NULL) AS incidence_updated_by_name
        FROM schedule_incidences si
        JOIN schedules s ON s.id = si.schedule_id
        JOIN schedule_eligibility se ON se.schedule_id = s.id AND se.has_eligible_occurrences
        JOIN teachers t ON t.id = s.teacher_id
        LEFT JOIN app_users updater ON updater.id = si.updated_by
        WHERE s.cycle_id = $1::uuid
          AND ($2::uuid IS NULL OR si.calendar_config_id = $2::uuid)
          AND ($3::uuid IS NULL OR s.teacher_id = $3::uuid)
          AND ($4::uuid IS NULL OR s.coordination_id = $4::uuid)
          AND ($5::text IS NULL OR t.category = $5::text)
          AND ($6::uuid IS NULL OR si.updated_by = $6::uuid)
        GROUP BY s.teacher_id, s.coordination_id
      ),
      external_extra AS (
        SELECT
          eh.teacher_id,
          eh.coordination_id,
          SUM(eh.hours)::numeric(12, 2) AS external_extra_hours,
          string_agg(DISTINCT capturer.email, '; ' ORDER BY capturer.email) FILTER (WHERE capturer.email IS NOT NULL) AS external_extra_captured_by_email,
          string_agg(DISTINCT capturer.display_name, '; ' ORDER BY capturer.display_name) FILTER (WHERE capturer.display_name IS NOT NULL) AS external_extra_captured_by_name,
          string_agg(DISTINCT eh.reason, '; ' ORDER BY eh.reason) FILTER (WHERE eh.reason IS NOT NULL AND eh.reason <> '') AS reason,
          string_agg(DISTINCT eh.activity_date::text, '; ' ORDER BY eh.activity_date::text) FILTER (WHERE eh.activity_date IS NOT NULL) AS activity_date
        FROM extra_hours eh
        JOIN teachers t ON t.id = eh.teacher_id
        LEFT JOIN app_users capturer ON capturer.id = eh.captured_by
        LEFT JOIN payroll_calendar_config pcc ON pcc.id = $2::uuid
        WHERE eh.cycle_id = $1::uuid
          AND ($3::uuid IS NULL OR eh.teacher_id = $3::uuid)
          AND ($4::uuid IS NULL OR eh.coordination_id = $4::uuid)
          AND ($5::text IS NULL OR t.category = $5::text)
          AND ($6::uuid IS NULL OR eh.captured_by = $6::uuid)
          AND ($2::uuid IS NULL OR COALESCE(eh.activity_date, eh.captured_at::date) BETWEEN pcc.payroll_start AND pcc.payroll_end)
          AND ($7::date IS NULL OR COALESCE(eh.activity_date, eh.captured_at::date) >= $7::date)
          AND ($8::date IS NULL OR COALESCE(eh.activity_date, eh.captured_at::date) <= $8::date)
        GROUP BY eh.teacher_id, eh.coordination_id
      ),
      report_keys AS (
        SELECT teacher_id, coordination_id FROM schedule_base
      )
      SELECT
        'live'::text AS source,
        $1::uuid::text AS "cycleId",
        $10::text AS "cycleLabel",
        $2::uuid::text AS "calendarConfigId",
        $11::text AS "periodLabel",
        t.id::text AS "teacherId",
        t.full_name AS "teacherName",
        t.category,
        CASE
          WHEN t.category = 'V' THEN 'VIP'
          WHEN t.category = 'M' THEN 'Medio tiempo'
          WHEN t.category = 'N' THEN 'Nuevo ingreso'
          ELSE COALESCE(NULLIF(t.category, ''), 'Nuevo ingreso')
        END AS "categoryLabel",
        c.id::text AS "coordinationId",
        c.name AS "coordinationName",
        sb.schedule_responsible_email AS "scheduleResponsibleEmail",
        sb.schedule_responsible_name AS "scheduleResponsibleName",
        COALESCE(sb.base_hours, 0)::numeric(12, 2)::text AS "baseHours",
        COALESCE(ie.absences, 0)::numeric(12, 2)::text AS absences,
        COALESCE(ie.delays, 0)::numeric(12, 2)::text AS delays,
        (COALESCE(ie.delays, 0) * 0.5)::numeric(12, 2)::text AS "delayDiscountHours",
        GREATEST(COALESCE(sb.base_hours, 0) - COALESCE(ie.absences, 0) - (COALESCE(ie.delays, 0) * 0.5), 0)::numeric(12, 2)::text AS "netBaseHours",
        COALESCE(ie.incidence_extra_hours, 0)::numeric(12, 2)::text AS "incidenceExtraHours",
        COALESCE(ee.external_extra_hours, 0)::numeric(12, 2)::text AS "externalExtraHours",
        (COALESCE(ie.incidence_extra_hours, 0) + COALESCE(ee.external_extra_hours, 0))::numeric(12, 2)::text AS "totalExtraHours",
        ee.external_extra_captured_by_email AS "externalExtraCapturedByEmail",
        ee.external_extra_captured_by_name AS "externalExtraCapturedByName",
        ie.incidence_updated_by_email AS "incidenceUpdatedByEmail",
        ie.incidence_updated_by_name AS "incidenceUpdatedByName",
        ee.reason,
        ee.activity_date AS "activityDate",
        '0.00'::text AS "teacherFortnightHours",
        '0.00'::text AS "fortnightLimit",
        'normal'::text AS "overloadStatus"
      FROM report_keys rk
      JOIN teachers t ON t.id = rk.teacher_id
      LEFT JOIN coordinations c ON c.id = rk.coordination_id
      LEFT JOIN schedule_base sb ON sb.teacher_id = rk.teacher_id AND sb.coordination_id = rk.coordination_id
      LEFT JOIN incidence_extra ie ON ie.teacher_id = rk.teacher_id AND ie.coordination_id = rk.coordination_id
      LEFT JOIN external_extra ee ON ee.teacher_id = rk.teacher_id AND ee.coordination_id = rk.coordination_id
      WHERE t.status = 'ACTIVO'
        AND (
        $9::text = 'all'
        OR ($9::text = 'withExtras' AND (COALESCE(ie.incidence_extra_hours, 0) + COALESCE(ee.external_extra_hours, 0)) > 0)
        OR ($9::text = 'withoutExtras' AND (COALESCE(ie.incidence_extra_hours, 0) + COALESCE(ee.external_extra_hours, 0)) = 0)
      )
        AND (
          $12::text IS NULL
          OR t.full_name ILIKE '%' || $12::text || '%'
          OR COALESCE(c.name, '') ILIKE '%' || $12::text || '%'
          OR COALESCE(sb.schedule_responsible_email, '') ILIKE '%' || $12::text || '%'
          OR COALESCE(sb.schedule_responsible_name, '') ILIKE '%' || $12::text || '%'
          OR COALESCE(ee.external_extra_captured_by_email, '') ILIKE '%' || $12::text || '%'
          OR COALESCE(ee.external_extra_captured_by_name, '') ILIKE '%' || $12::text || '%'
          OR COALESCE(ie.incidence_updated_by_email, '') ILIKE '%' || $12::text || '%'
          OR COALESCE(ie.incidence_updated_by_name, '') ILIKE '%' || $12::text || '%'
        )
      ORDER BY c.name NULLS LAST, t.full_name
    `,
    [
      cycle.id,
      calendar?.id ?? null,
      filters.teacherId ?? null,
      filters.coordinationId ?? null,
      filters.category ?? null,
      filters.capturedBy ?? null,
      filters.dateFrom ?? null,
      filters.dateTo ?? null,
      filters.type,
      cycle.label,
      calendar?.periodLabel ?? null,
      filters.q ?? null
    ]
  );

  return rows;
}

async function listBaseExtraSnapshotRows(
  cycle: CycleLookupRow,
  calendar: CalendarLookupRow | null,
  run: PayrollRunLookupRow,
  filters: z.infer<typeof baseExtraQuerySchema>
): Promise<BaseExtraRow[]> {
  const rows = await query<BaseExtraRow>(
    `
      WITH extra_detail AS (
        SELECT
          ped.teacher_id,
          ped.coordination_id,
          string_agg(DISTINCT ped.reason_snapshot, '; ' ORDER BY ped.reason_snapshot) FILTER (WHERE ped.reason_snapshot IS NOT NULL AND ped.reason_snapshot <> '') AS reason,
          string_agg(DISTINCT ped.activity_date::text, '; ' ORDER BY ped.activity_date::text) FILTER (WHERE ped.activity_date IS NOT NULL) AS activity_date
        FROM payroll_extra_details ped
        WHERE ped.payroll_run_id = $1::uuid
        GROUP BY ped.teacher_id, ped.coordination_id
      ),
      schedule_owner AS (
        SELECT
          psd.teacher_id,
          psd.coordination_id,
          string_agg(DISTINCT responsible.email, '; ' ORDER BY responsible.email)
            FILTER (WHERE responsible.email IS NOT NULL) AS responsible_email,
          string_agg(DISTINCT responsible.display_name, '; ' ORDER BY responsible.display_name)
            FILTER (WHERE responsible.display_name IS NOT NULL) AS responsible_name
        FROM payroll_schedule_details psd
        LEFT JOIN schedules s ON s.id = psd.schedule_id
        LEFT JOIN app_users responsible ON responsible.id = s.created_by
        WHERE psd.payroll_run_id = $1::uuid
        GROUP BY psd.teacher_id, psd.coordination_id
      )
      SELECT
        'snapshot'::text AS source,
        pr.cycle_id::text AS "cycleId",
        $2::text AS "cycleLabel",
        $3::uuid::text AS "calendarConfigId",
        $4::text AS "periodLabel",
        pl.teacher_id::text AS "teacherId",
        pl.teacher_name_snapshot AS "teacherName",
        pl.category_snapshot AS category,
        CASE
          WHEN pl.category_snapshot = 'V' THEN 'VIP'
          WHEN pl.category_snapshot = 'M' THEN 'Medio tiempo'
          WHEN pl.category_snapshot = 'N' THEN 'Nuevo ingreso'
          ELSE COALESCE(NULLIF(pl.category_snapshot, ''), 'Nuevo ingreso')
        END AS "categoryLabel",
        pl.coordination_id::text AS "coordinationId",
        pl.coordination_name_snapshot AS "coordinationName",
        so.responsible_email AS "scheduleResponsibleEmail",
        so.responsible_name AS "scheduleResponsibleName",
        pl.base_hours::numeric(12, 2)::text AS "baseHours",
        pl.absences::numeric(12, 2)::text AS absences,
        pl.delays::numeric(12, 2)::text AS delays,
        (pl.delays * 0.5)::numeric(12, 2)::text AS "delayDiscountHours",
        GREATEST(pl.base_hours - pl.absences - (pl.delays * 0.5), 0)::numeric(12, 2)::text AS "netBaseHours",
        pl.schedule_extra_hours::numeric(12, 2)::text AS "incidenceExtraHours",
        pl.logged_extra_hours::numeric(12, 2)::text AS "externalExtraHours",
        pl.total_extra_hours::numeric(12, 2)::text AS "totalExtraHours",
        NULL::text AS "externalExtraCapturedByEmail",
        NULL::text AS "externalExtraCapturedByName",
        NULL::text AS "incidenceUpdatedByEmail",
        NULL::text AS "incidenceUpdatedByName",
        ed.reason,
        ed.activity_date AS "activityDate",
        '0.00'::text AS "teacherFortnightHours",
        '0.00'::text AS "fortnightLimit",
        'normal'::text AS "overloadStatus"
      FROM payroll_lines pl
      JOIN payroll_runs pr ON pr.id = pl.payroll_run_id
      JOIN teachers active_teacher ON active_teacher.id = pl.teacher_id AND active_teacher.status = 'ACTIVO'
      LEFT JOIN extra_detail ed
        ON ed.teacher_id IS NOT DISTINCT FROM pl.teacher_id
       AND ed.coordination_id IS NOT DISTINCT FROM pl.coordination_id
      JOIN schedule_owner so
        ON so.teacher_id IS NOT DISTINCT FROM pl.teacher_id
       AND so.coordination_id IS NOT DISTINCT FROM pl.coordination_id
      WHERE pl.payroll_run_id = $1::uuid
        AND ($5::uuid IS NULL OR pl.teacher_id = $5::uuid)
        AND ($6::uuid IS NULL OR pl.coordination_id = $6::uuid)
        AND ($7::text IS NULL OR pl.category_snapshot = $7::text)
        AND (
          $8::text = 'all'
          OR ($8::text = 'withExtras' AND COALESCE(pl.total_extra_hours, 0) > 0)
          OR ($8::text = 'withoutExtras' AND COALESCE(pl.total_extra_hours, 0) = 0)
        )
        AND (
          $9::text IS NULL
          OR pl.teacher_name_snapshot ILIKE '%' || $9::text || '%'
          OR COALESCE(pl.coordination_name_snapshot, '') ILIKE '%' || $9::text || '%'
          OR COALESCE(so.responsible_email, '') ILIKE '%' || $9::text || '%'
          OR COALESCE(so.responsible_name, '') ILIKE '%' || $9::text || '%'
          OR COALESCE(ed.reason, '') ILIKE '%' || $9::text || '%'
        )
      ORDER BY pl.coordination_name_snapshot, pl.teacher_name_snapshot
    `,
    [
      run.id,
      cycle.label,
      calendar?.id ?? null,
      calendar?.periodLabel ?? run.periodLabel,
      filters.teacherId ?? null,
      filters.coordinationId ?? null,
      filters.category ?? null,
      filters.type,
      filters.q ?? null
    ]
  );
  return rows;
}

async function loadBaseExtraReport(filters: z.infer<typeof baseExtraQuerySchema>) {
  const cycle = await resolveCycle(filters.cycleId);
  if (!cycle) {
    return { error: { status: 404, body: { error: 'NOT_FOUND', message: 'No se encontró ciclo para el reporte.' } } };
  }

  if (cycle.status !== 'ACTIVO') {
    return {
      error: {
        status: 400,
        body: { error: 'ACTIVE_CYCLE_REQUIRED', message: 'Horas base y extras solo puede consultarse para el ciclo activo.' }
      }
    };
  }

  const calendar = await loadCalendarConfig(filters.calendarConfigId, cycle.id);
  if (filters.calendarConfigId && !calendar) {
    return { error: { status: 404, body: { error: 'NOT_FOUND', message: 'No se encontró la quincena del ciclo indicado.' } } };
  }

  const snapshotRun = calendar ? await findSnapshotRun(cycle.id, calendar.id) : null;
  const resolvedSource: ReportSource =
    filters.source === 'snapshot' || (filters.source === 'auto' && snapshotRun) ? 'snapshot' : 'live';

  if (
    resolvedSource === 'live' &&
    calendar &&
    cycle.status === 'ACTIVO' &&
    (!cycle.baseHoursStartDate || !cycle.baseHoursEndDate)
  ) {
    return {
      error: {
        status: 400,
        body: {
          error: 'BASE_HOURS_DATES_INCOMPLETE',
          message: 'Configura inicio y fin de horas base en Calendario antes de consultar la vista viva.'
        }
      }
    };
  }

  if (filters.source === 'snapshot' && !snapshotRun) {
    return {
      rows: [],
      meta: {
        source: 'snapshot' as ReportSource,
        cycleId: cycle.id,
        cycleLabel: cycle.label,
        calendarConfigId: calendar?.id ?? null,
        periodLabel: calendar?.periodLabel ?? null,
        snapshotRunId: null
      }
    };
  }

  const rows =
    resolvedSource === 'snapshot' && snapshotRun
      ? await listBaseExtraSnapshotRows(cycle, calendar, snapshotRun, filters)
      : await listBaseExtraLiveRows(cycle, calendar, filters);

  return {
    rows: enrichBaseExtraRows(rows),
    meta: {
      source: resolvedSource,
      cycleId: cycle.id,
      cycleLabel: cycle.label,
      calendarConfigId: calendar?.id ?? null,
      periodLabel: calendar?.periodLabel ?? null,
      snapshotRunId: snapshotRun?.id ?? null
    }
  };
}

async function listCategoryHoursRows(
  filters: z.infer<typeof categoryHoursQuerySchema>
): Promise<CategoryHoursRow[]> {
  const rows = await query<CategoryHoursRow>(
    `
      WITH coordination_totals AS (
        SELECT
          s.teacher_id,
          s.coordination_id,
          c.name AS coordination_name,
          SUM(s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v)::numeric(12, 2) AS hours_lv,
          SUM(s.hours_s1)::numeric(12, 2) AS hours_s1,
          SUM(s.hours_s2)::numeric(12, 2) AS hours_s2
        FROM schedules s
        JOIN teachers active_teacher ON active_teacher.id = s.teacher_id AND active_teacher.status = 'ACTIVO'
        JOIN coordinations c ON c.id = s.coordination_id
        WHERE s.cycle_id = $1::uuid
          AND ($2::uuid IS NULL OR s.coordination_id = $2::uuid)
          AND ($3::uuid IS NULL OR s.teacher_id = $3::uuid)
        GROUP BY s.teacher_id, s.coordination_id, c.name
      ),
      teacher_totals AS (
        SELECT
          teacher_id,
          SUM(hours_lv)::numeric(12, 2) AS hours_lv,
          (SUM(hours_lv) + SUM(hours_s1))::numeric(12, 2) AS hours_module_1,
          (SUM(hours_lv) + SUM(hours_s2))::numeric(12, 2) AS hours_module_2,
          string_agg(coordination_name, '; ' ORDER BY coordination_name) AS coordination_names,
          string_agg(
            coordination_name || ': ' ||
              GREATEST(hours_lv, hours_lv + hours_s1, hours_lv + hours_s2)::numeric(12, 2)::text || ' h',
            '; ' ORDER BY coordination_name
          ) AS coordination_breakdown
        FROM coordination_totals
        GROUP BY teacher_id
      ),
      report_rows AS (
        SELECT
          $1::uuid::text AS "cycleId",
          ac.period_label AS "cycleLabel",
          t.id::text AS "teacherId",
          t.full_name AS "teacherName",
          t.category,
          CASE
            WHEN t.category = 'V' THEN 'VIP'
            WHEN t.category = 'M' THEN 'Medio tiempo'
            WHEN t.category = 'N' THEN 'Nuevo ingreso'
            ELSE COALESCE(NULLIF(t.category, ''), 'Nuevo ingreso')
          END AS "categoryLabel",
          CASE
            WHEN t.category = 'V' THEN 35
            WHEN t.category = 'M' THEN 25
            ELSE 15
          END::numeric(12, 2) AS expected_hours,
          GREATEST(tt.hours_lv, tt.hours_module_1, tt.hours_module_2)::numeric(12, 2) AS assigned_hours,
          tt.hours_lv,
          tt.hours_module_1,
          tt.hours_module_2,
          NULL::text AS "coordinationId",
          tt.coordination_names AS "coordinationName",
          tt.coordination_breakdown AS "coordinationBreakdown"
        FROM teacher_totals tt
        JOIN teachers t ON t.id = tt.teacher_id AND t.status = 'ACTIVO'
        JOIN academic_cycles ac ON ac.id = $1::uuid
        WHERE ($4::text IS NULL OR t.category = $4::text)
          AND ($5::text IS NULL OR t.status::text = $5::text)
          AND (
            $7::text IS NULL
            OR t.full_name ILIKE '%' || $7::text || '%'
            OR tt.coordination_names ILIKE '%' || $7::text || '%'
          )
      ),
      status_rows AS (
        SELECT
          "cycleId",
          "cycleLabel",
          "teacherId",
          "teacherName",
          category,
          "categoryLabel",
          expected_hours::text AS "expectedHours",
          assigned_hours::text AS "assignedHours",
          (expected_hours - assigned_hours)::numeric(12, 2)::text AS "remainingHours",
          CASE
            WHEN assigned_hours = expected_hours THEN 'completo'
            WHEN assigned_hours < expected_hours THEN 'faltante'
            ELSE 'excedido'
          END AS status,
          hours_lv::text AS "hoursLv",
          hours_module_1::text AS "hoursModule1",
          hours_module_2::text AS "hoursModule2",
          "coordinationId",
          "coordinationName",
          "coordinationBreakdown"
        FROM report_rows
      )
      SELECT *
      FROM status_rows
      WHERE ($6::text = 'all' OR status = $6::text)
      ORDER BY "teacherName"
    `,
    [
      filters.cycleId,
      filters.coordinationId ?? null,
      filters.teacherId ?? null,
      filters.category ?? null,
      filters.teacherStatus ?? null,
      filters.status,
      filters.q ?? null
    ]
  );

  return rows;
}

const baseExtraCsvHeaders = [
  'Origen',
  'Ciclo',
  'Quincena',
  'Docente',
  'Categoria',
  'Coordinacion',
  'Responsable del horario',
  'Horas base de la quincena',
  'Faltas',
  'Retardos',
  'Descuento por retardos (horas)',
  'Horas base netas',
  'Extras incidencia',
  'Extras externos',
  'Total extras',
  'Total real quincenal del docente',
  'Limite quincenal',
  'Indicador de carga',
  'Capturador extra externo',
  'Responsable incidencia',
  'Motivo',
  'Fecha actividad'
];

const baseExtraXlsxColumns: XlsxColumn[] = [
  { header: 'Origen', key: 'source', width: 12 },
  { header: 'Ciclo', key: 'cycleLabel', width: 26 },
  { header: 'Quincena', key: 'periodLabel', width: 24 },
  { header: 'Docente', key: 'teacherName', width: 34 },
  { header: 'Categoria', key: 'categoryLabel', width: 18 },
  { header: 'Coordinacion', key: 'coordinationName', width: 24 },
  { header: 'Responsable del horario', key: 'scheduleResponsibleName', width: 28 },
  { header: 'Horas base de la quincena', key: 'baseHours', width: 24 },
  { header: 'Faltas', key: 'absences', width: 12 },
  { header: 'Retardos', key: 'delays', width: 12 },
  { header: 'Descuento por retardos (horas)', key: 'delayDiscountHours', width: 28 },
  { header: 'Horas base netas', key: 'netBaseHours', width: 18 },
  { header: 'Extras incidencia', key: 'incidenceExtraHours', width: 18 },
  { header: 'Extras externos', key: 'externalExtraHours', width: 16 },
  { header: 'Total extras', key: 'totalExtraHours', width: 14 },
  { header: 'Total real quincenal del docente', key: 'teacherFortnightHours', width: 30 },
  { header: 'Limite quincenal', key: 'fortnightLimit', width: 18 },
  { header: 'Indicador de carga', key: 'overloadStatus', width: 20 },
  { header: 'Capturador extra externo', key: 'externalExtraCapturedByName', width: 28 },
  { header: 'Responsable incidencia', key: 'incidenceUpdatedByName', width: 28 },
  { header: 'Motivo', key: 'reason', width: 32 },
  { header: 'Fecha actividad', key: 'activityDate', width: 20 }
];

const categoryHoursCsvHeaders = [
  'Ciclo',
  'Docente',
  'Categoria',
  'Desglose por coordinacion',
  'Horas esperadas',
  'Horas asignadas',
  'Horas restantes',
  'Estado',
  'Horas L-V',
  'Horas modulo 1',
  'Horas modulo 2'
];

const categoryHoursXlsxColumns: XlsxColumn[] = [
  { header: 'Ciclo', key: 'cycleLabel', width: 26 },
  { header: 'Docente', key: 'teacherName', width: 34 },
  { header: 'Categoria', key: 'categoryLabel', width: 18 },
  { header: 'Desglose por coordinacion', key: 'coordinationBreakdown', width: 42 },
  { header: 'Horas esperadas', key: 'expectedHours', width: 18 },
  { header: 'Horas asignadas', key: 'assignedHours', width: 18 },
  { header: 'Horas restantes', key: 'remainingHours', width: 18 },
  { header: 'Estado', key: 'status', width: 14 },
  { header: 'Horas L-V', key: 'hoursLv', width: 14 },
  { header: 'Horas modulo 1', key: 'hoursModule1', width: 16 },
  { header: 'Horas modulo 2', key: 'hoursModule2', width: 16 }
];

function baseExtraCsvRows(rows: BaseExtraRow[]): unknown[][] {
  return rows.map((row) => [
    row.source,
    row.cycleLabel,
    row.periodLabel ?? '',
    row.teacherName,
    row.categoryLabel,
    row.coordinationName ?? '',
    row.scheduleResponsibleName ?? row.scheduleResponsibleEmail ?? '',
    row.baseHours,
    row.absences,
    row.delays,
    row.delayDiscountHours,
    row.netBaseHours,
    row.incidenceExtraHours,
    row.externalExtraHours,
    row.totalExtraHours,
    row.teacherFortnightHours,
    row.fortnightLimit,
    row.overloadStatus,
    row.externalExtraCapturedByName ?? row.externalExtraCapturedByEmail ?? '',
    row.incidenceUpdatedByName ?? row.incidenceUpdatedByEmail ?? '',
    row.reason ?? '',
    row.activityDate ?? ''
  ]);
}

function categoryHoursCsvRows(rows: CategoryHoursRow[]): unknown[][] {
  return rows.map((row) => [
    row.cycleLabel,
    row.teacherName,
    row.categoryLabel,
    row.coordinationBreakdown,
    row.expectedHours,
    row.assignedHours,
    row.remainingHours,
    row.status,
    row.hoursLv,
    row.hoursModule1,
    row.hoursModule2
  ]);
}

function toXlsxRows(rows: Array<BaseExtraRow | CategoryHoursRow>): XlsxRow[] {
  return rows.map((row) => ({ ...row }));
}

async function sendCsv(reply: FastifyReply, filename: string, headers: string[], rows: unknown[][]): Promise<FastifyReply> {
  const csv = buildCsv(headers, rows, { quoteAll: true });
  reply.headers(csvAttachmentHeaders(filename));
  return reply.send(csv);
}

async function sendXlsx(
  reply: FastifyReply,
  filename: string,
  sheetName: string,
  columns: XlsxColumn[],
  rows: XlsxRow[]
): Promise<FastifyReply> {
  const buffer = await buildXlsxBuffer({ sheetName, columns, rows });
  reply.headers(xlsxAttachmentHeaders(filename));
  return reply.send(buffer);
}

export async function registerOperationalReportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reports/operational/filters/cycles', { preHandler: requireOperationalReportsModule() }, async () => {
    const cycles = await listOperationalCycleFilters();
    return { cycles };
  });

  app.get(
    '/reports/operational/filters/payroll-periods',
    { preHandler: requireOperationalBaseExtraReport() },
    async (request, reply) => {
      const parsed = payrollPeriodFilterQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'ParÃ¡metros invÃ¡lidos.', details: parsed.error.flatten() });
      }

      const periods = await listOperationalPayrollPeriodFilters(parsed.data.cycleId);
      return { periods };
    }
  );

  app.get('/reports/operational/base-extra', { preHandler: requireOperationalBaseExtraReport() }, async (request, reply) => {
    const parsed = baseExtraQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Parámetros inválidos.', details: parsed.error.flatten() });
    }

    const result = await loadBaseExtraReport(parsed.data);
    if ('error' in result && result.error) return reply.code(result.error.status).send(result.error.body);

    return {
      meta: result.meta,
      rows: result.rows
    };
  });

  app.get('/reports/operational/base-extra/export', { preHandler: requireOperationalBaseExtraReport() }, async (request, reply) => {
    const parsed = baseExtraExportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Parámetros inválidos.', details: parsed.error.flatten() });
    }

    const { format, ...filters } = parsed.data;
    const result = await loadBaseExtraReport(filters);
    if ('error' in result && result.error) return reply.code(result.error.status).send(result.error.body);

    const periodSlug = slugify(result.meta.periodLabel ?? result.meta.cycleLabel, 'reporte');
    if (format === 'xlsx') {
      return sendXlsx(
        reply,
        `reporte-horas-base-extras-${periodSlug}.xlsx`,
        'Horas base y extras',
        baseExtraXlsxColumns,
        toXlsxRows(result.rows)
      );
    }

    return sendCsv(
      reply,
      `reporte-horas-base-extras-${periodSlug}.csv`,
      baseExtraCsvHeaders,
      baseExtraCsvRows(result.rows)
    );
  });

  app.get('/reports/operational/category-hours', { preHandler: requireOperationalCategoryHoursReport() }, async (request, reply) => {
    const parsed = categoryHoursQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Parámetros inválidos.', details: parsed.error.flatten() });
    }

    const rows = await listCategoryHoursRows(parsed.data);
    return {
      meta: {
        cycleId: parsed.data.cycleId,
        coordinatorScope: null
      },
      rows
    };
  });

  app.get('/reports/operational/category-hours/export', { preHandler: requireOperationalCategoryHoursReport() }, async (request, reply) => {
    const parsed = categoryHoursExportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Parámetros inválidos.', details: parsed.error.flatten() });
    }

    const { format, ...filters } = parsed.data;
    const rows = await listCategoryHoursRows(filters);
    const cycleLabel = rows[0]?.cycleLabel ?? parsed.data.cycleId;
    const cycleSlug = slugify(cycleLabel, 'ciclo');

    if (format === 'xlsx') {
      return sendXlsx(
        reply,
        `reporte-horas-base-categoria-${cycleSlug}.xlsx`,
        'Horas base por categoria',
        categoryHoursXlsxColumns,
        toXlsxRows(rows)
      );
    }

    return sendCsv(
      reply,
      `reporte-horas-base-categoria-${cycleSlug}.csv`,
      categoryHoursCsvHeaders,
      categoryHoursCsvRows(rows)
    );
  });
}
