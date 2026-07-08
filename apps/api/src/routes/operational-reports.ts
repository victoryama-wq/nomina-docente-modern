import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
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
  baseHours: string;
  incidenceExtraHours: string;
  externalExtraHours: string;
  totalExtraHours: string;
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
}

const uuidField = z.string().uuid();

const baseExtraQuerySchema = z.object({
  cycleId: uuidField.optional(),
  calendarConfigId: uuidField.optional(),
  teacherId: uuidField.optional(),
  coordinationId: uuidField.optional(),
  category: z.string().trim().min(1).optional(),
  capturedBy: uuidField.optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  type: z.enum(['all', 'withExtras', 'withoutExtras']).default('all'),
  source: z.enum(['auto', 'live', 'snapshot']).default('auto')
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
  teacherStatus: z.string().trim().min(1).optional()
});

const categoryHoursExportQuerySchema = categoryHoursQuerySchema.extend({
  format: z.enum(['csv', 'xlsx']).default('csv')
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

    if (!hasAllowedRole(request.user, ['direccion'])) {
      await reply.code(403).send({ error: 'FORBIDDEN', message: 'No tienes permiso para consultar este reporte operativo.' });
    }
  };
}

function requireOperationalCategoryHoursReport() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    if (reply.sent) return;

    if (!hasAllowedRole(request.user, ['direccion', 'coordinador', 'rh'])) {
      await reply.code(403).send({ error: 'FORBIDDEN', message: 'No tienes permiso para consultar este reporte operativo.' });
    }
  };
}

function categoryLabel(category: string): string {
  if (category === 'V') return 'VIP';
  if (category === 'M') return 'Medio tiempo';
  if (category === 'N') return 'Nuevo ingreso';
  return category || 'Nuevo ingreso';
}

function expectedCategoryHours(category: string): string {
  if (category === 'V') return '35.00';
  if (category === 'M') return '25.00';
  return '15.00';
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
        SELECT id, period_label AS label
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
      SELECT id, period_label AS label
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

function coordinatorScopeIds(user: SessionUser | undefined): string[] {
  if (user?.role !== 'coordinador') return [];
  return user.actorCoordinations.map((coordination) => coordination.id);
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
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 1 AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS monday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 2 AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS tuesday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 3 AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS wednesday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 4 AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS thursday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 5 AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS friday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 6 AND day_value::date BETWEEN ac.module1_start AND ac.module1_end AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS module1_saturday_count,
          COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM day_value)::int = 6 AND day_value::date BETWEEN ac.module2_start AND ac.module2_end AND cbd.blackout_date IS NULL THEN 1 ELSE 0 END), 0)::numeric AS module2_saturday_count
        FROM payroll_calendar_config pcc
        JOIN academic_cycles ac ON ac.id = pcc.cycle_id
        LEFT JOIN LATERAL generate_series(pcc.payroll_start, pcc.payroll_end, interval '1 day') AS generated(day_value) ON true
        LEFT JOIN calendar_blackout_dates cbd ON cbd.config_id = pcc.id AND cbd.blackout_date = generated.day_value::date
        WHERE pcc.id = $2::uuid
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
          )::numeric(12, 2) AS base_hours
        FROM schedules s
        CROSS JOIN calendar_counts cc
        JOIN teachers t ON t.id = s.teacher_id
        WHERE s.cycle_id = $1::uuid
          AND ($3::uuid IS NULL OR s.teacher_id = $3::uuid)
          AND ($4::uuid IS NULL OR s.coordination_id = $4::uuid)
          AND ($5::text IS NULL OR t.category = $5::text)
        GROUP BY s.teacher_id, s.coordination_id
      ),
      incidence_extra AS (
        SELECT
          s.teacher_id,
          s.coordination_id,
          SUM(si.extra_hours_in_schedule)::numeric(12, 2) AS incidence_extra_hours,
          string_agg(DISTINCT updater.email, '; ' ORDER BY updater.email) FILTER (WHERE updater.email IS NOT NULL) AS incidence_updated_by_email,
          string_agg(DISTINCT updater.display_name, '; ' ORDER BY updater.display_name) FILTER (WHERE updater.display_name IS NOT NULL) AS incidence_updated_by_name
        FROM schedule_incidences si
        JOIN schedules s ON s.id = si.schedule_id
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
          AND (
            $2::uuid IS NULL OR eh.activity_date IS NULL OR eh.activity_date BETWEEN pcc.payroll_start AND pcc.payroll_end
          )
          AND ($7::date IS NULL OR COALESCE(eh.activity_date, eh.captured_at::date) >= $7::date)
          AND ($8::date IS NULL OR COALESCE(eh.activity_date, eh.captured_at::date) <= $8::date)
        GROUP BY eh.teacher_id, eh.coordination_id
      ),
      report_keys AS (
        SELECT teacher_id, coordination_id FROM schedule_base WHERE $6::uuid IS NULL
        UNION
        SELECT teacher_id, coordination_id FROM incidence_extra
        UNION
        SELECT teacher_id, coordination_id FROM external_extra
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
        COALESCE(sb.base_hours, 0)::numeric(12, 2)::text AS "baseHours",
        COALESCE(ie.incidence_extra_hours, 0)::numeric(12, 2)::text AS "incidenceExtraHours",
        COALESCE(ee.external_extra_hours, 0)::numeric(12, 2)::text AS "externalExtraHours",
        (COALESCE(ie.incidence_extra_hours, 0) + COALESCE(ee.external_extra_hours, 0))::numeric(12, 2)::text AS "totalExtraHours",
        ee.external_extra_captured_by_email AS "externalExtraCapturedByEmail",
        ee.external_extra_captured_by_name AS "externalExtraCapturedByName",
        ie.incidence_updated_by_email AS "incidenceUpdatedByEmail",
        ie.incidence_updated_by_name AS "incidenceUpdatedByName",
        ee.reason,
        ee.activity_date AS "activityDate"
      FROM report_keys rk
      JOIN teachers t ON t.id = rk.teacher_id
      LEFT JOIN coordinations c ON c.id = rk.coordination_id
      LEFT JOIN schedule_base sb ON sb.teacher_id = rk.teacher_id AND sb.coordination_id = rk.coordination_id
      LEFT JOIN incidence_extra ie ON ie.teacher_id = rk.teacher_id AND ie.coordination_id = rk.coordination_id
      LEFT JOIN external_extra ee ON ee.teacher_id = rk.teacher_id AND ee.coordination_id = rk.coordination_id
      WHERE (
        $9::text = 'all'
        OR ($9::text = 'withExtras' AND (COALESCE(ie.incidence_extra_hours, 0) + COALESCE(ee.external_extra_hours, 0)) > 0)
        OR ($9::text = 'withoutExtras' AND (COALESCE(ie.incidence_extra_hours, 0) + COALESCE(ee.external_extra_hours, 0)) = 0)
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
      calendar?.periodLabel ?? null
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
          ped.line_key,
          string_agg(DISTINCT ped.reason_snapshot, '; ' ORDER BY ped.reason_snapshot) FILTER (WHERE ped.reason_snapshot IS NOT NULL AND ped.reason_snapshot <> '') AS reason,
          string_agg(DISTINCT ped.activity_date::text, '; ' ORDER BY ped.activity_date::text) FILTER (WHERE ped.activity_date IS NOT NULL) AS activity_date
        FROM payroll_extra_details ped
        WHERE ped.run_id = $1::uuid
        GROUP BY ped.line_key
      )
      SELECT
        'snapshot'::text AS source,
        pl.cycle_id::text AS "cycleId",
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
        pl.base_hours::numeric(12, 2)::text AS "baseHours",
        pl.schedule_extra_hours::numeric(12, 2)::text AS "incidenceExtraHours",
        pl.logged_extra_hours::numeric(12, 2)::text AS "externalExtraHours",
        pl.total_extra_hours::numeric(12, 2)::text AS "totalExtraHours",
        NULL::text AS "externalExtraCapturedByEmail",
        NULL::text AS "externalExtraCapturedByName",
        NULL::text AS "incidenceUpdatedByEmail",
        NULL::text AS "incidenceUpdatedByName",
        ed.reason,
        ed.activity_date AS "activityDate"
      FROM payroll_lines pl
      LEFT JOIN extra_detail ed ON ed.line_key = pl.line_key
      WHERE pl.run_id = $1::uuid
        AND ($5::uuid IS NULL OR pl.teacher_id = $5::uuid)
        AND ($6::uuid IS NULL OR pl.coordination_id = $6::uuid)
        AND ($7::text IS NULL OR pl.category_snapshot = $7::text)
        AND (
          $8::text = 'all'
          OR ($8::text = 'withExtras' AND COALESCE(pl.total_extra_hours, 0) > 0)
          OR ($8::text = 'withoutExtras' AND COALESCE(pl.total_extra_hours, 0) = 0)
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
      filters.type
    ]
  );
  return rows;
}

async function loadBaseExtraReport(filters: z.infer<typeof baseExtraQuerySchema>) {
  const cycle = await resolveCycle(filters.cycleId);
  if (!cycle) {
    return { error: { status: 404, body: { error: 'NOT_FOUND', message: 'No se encontró ciclo para el reporte.' } } };
  }

  const calendar = await loadCalendarConfig(filters.calendarConfigId, cycle.id);
  if (filters.calendarConfigId && !calendar) {
    return { error: { status: 404, body: { error: 'NOT_FOUND', message: 'No se encontró la quincena del ciclo indicado.' } } };
  }

  const snapshotRun = calendar ? await findSnapshotRun(cycle.id, calendar.id) : null;
  const resolvedSource: ReportSource =
    filters.source === 'snapshot' || (filters.source === 'auto' && snapshotRun) ? 'snapshot' : 'live';

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
    rows,
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
  user: SessionUser | undefined,
  filters: z.infer<typeof categoryHoursQuerySchema>
): Promise<CategoryHoursRow[]> {
  const scopeIds = coordinatorScopeIds(user);
  if (user?.role === 'coordinador') {
    if (scopeIds.length === 0) return [];
    if (filters.coordinationId && !scopeIds.includes(filters.coordinationId)) {
      const error = new Error('COORDINATION_OUT_OF_SCOPE');
      error.name = 'COORDINATION_OUT_OF_SCOPE';
      throw error;
    }
  }

  const rows = await query<CategoryHoursRow>(
    `
      WITH schedule_totals AS (
        SELECT
          s.teacher_id,
          s.coordination_id,
          SUM(s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v)::numeric(12, 2) AS hours_lv,
          (SUM(s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v) + SUM(s.hours_s1))::numeric(12, 2) AS hours_module_1,
          (SUM(s.hours_l + s.hours_m + s.hours_x + s.hours_j + s.hours_v) + SUM(s.hours_s2))::numeric(12, 2) AS hours_module_2
        FROM schedules s
        WHERE s.cycle_id = $1::uuid
          AND ($2::uuid IS NULL OR s.coordination_id = $2::uuid)
          AND ($3::uuid IS NULL OR s.teacher_id = $3::uuid)
          AND ($7::text[] IS NULL OR s.coordination_id::text = ANY($7::text[]))
        GROUP BY s.teacher_id, s.coordination_id
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
          GREATEST(
            COALESCE(st.hours_lv, 0),
            COALESCE(st.hours_module_1, 0),
            COALESCE(st.hours_module_2, 0)
          )::numeric(12, 2) AS assigned_hours,
          COALESCE(st.hours_lv, 0)::numeric(12, 2) AS hours_lv,
          COALESCE(st.hours_module_1, 0)::numeric(12, 2) AS hours_module_1,
          COALESCE(st.hours_module_2, 0)::numeric(12, 2) AS hours_module_2,
          c.id::text AS "coordinationId",
          c.name AS "coordinationName"
        FROM teachers t
        JOIN academic_cycles ac ON ac.id = $1::uuid
        LEFT JOIN schedule_totals st ON st.teacher_id = t.id
        LEFT JOIN coordinations c ON c.id = st.coordination_id
        WHERE ($3::uuid IS NULL OR t.id = $3::uuid)
          AND ($4::text IS NULL OR t.category = $4::text)
          AND ($5::text IS NULL OR t.status::text = $5::text)
          AND ($7::text[] IS NULL OR st.coordination_id IS NOT NULL)
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
          "coordinationName"
        FROM report_rows
      )
      SELECT *
      FROM status_rows
      WHERE ($6::text = 'all' OR status = $6::text)
      ORDER BY "coordinationName" NULLS LAST, "teacherName"
    `,
    [
      filters.cycleId,
      filters.coordinationId ?? null,
      filters.teacherId ?? null,
      filters.category ?? null,
      filters.teacherStatus ?? null,
      filters.status,
      user?.role === 'coordinador' ? scopeIds : null
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
  'Horas base',
  'Extras incidencia',
  'Extras externos',
  'Total extras',
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
  { header: 'Horas base', key: 'baseHours', width: 14 },
  { header: 'Extras incidencia', key: 'incidenceExtraHours', width: 18 },
  { header: 'Extras externos', key: 'externalExtraHours', width: 16 },
  { header: 'Total extras', key: 'totalExtraHours', width: 14 },
  { header: 'Capturador extra externo', key: 'externalExtraCapturedByName', width: 28 },
  { header: 'Responsable incidencia', key: 'incidenceUpdatedByName', width: 28 },
  { header: 'Motivo', key: 'reason', width: 32 },
  { header: 'Fecha actividad', key: 'activityDate', width: 20 }
];

const categoryHoursCsvHeaders = [
  'Ciclo',
  'Docente',
  'Categoria',
  'Coordinacion',
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
  { header: 'Coordinacion', key: 'coordinationName', width: 24 },
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
    row.baseHours,
    row.incidenceExtraHours,
    row.externalExtraHours,
    row.totalExtraHours,
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
    row.coordinationName ?? '',
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

    try {
      const rows = await listCategoryHoursRows(request.user, parsed.data);
      return {
        meta: {
          cycleId: parsed.data.cycleId,
          coordinatorScope: request.user?.role === 'coordinador' ? coordinatorScopeIds(request.user) : null
        },
        rows
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'COORDINATION_OUT_OF_SCOPE') {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'La coordinación solicitada está fuera de tu alcance operativo.' });
      }
      throw error;
    }
  });

  app.get('/reports/operational/category-hours/export', { preHandler: requireOperationalCategoryHoursReport() }, async (request, reply) => {
    const parsed = categoryHoursExportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Parámetros inválidos.', details: parsed.error.flatten() });
    }

    try {
      const { format, ...filters } = parsed.data;
      const rows = await listCategoryHoursRows(request.user, filters);
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
    } catch (error) {
      if (error instanceof Error && error.name === 'COORDINATION_OUT_OF_SCOPE') {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'La coordinación solicitada está fuera de tu alcance operativo.' });
      }
      throw error;
    }
  });
}
