import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { requireAnyPermission } from '../auth.js';
import { withTransaction } from '../db.js';
import type { SessionUser } from '../types.js';
import { listCycles, loadActorCoordination, type CoordinationRow, type CycleRow } from './academic-context.js';

type PayrollRunStatus = 'BORRADOR' | 'CALCULADA' | 'EN_REVISION' | 'APROBADA' | 'PAGADA' | 'CERRADA' | 'CANCELADA';
type PaymentStatus = 'LISTO' | 'PENDIENTE';
type FinanceExportKind = 'payments' | 'fiscal' | 'coordinations';

interface FinanceQuery {
  cycleId?: string;
  runId?: string;
}

interface FinanceExportParams {
  kind: FinanceExportKind;
}

interface FinanceRunParams {
  id: string;
}

interface FinanceRunStatusPayload {
  status: Extract<PayrollRunStatus, 'EN_REVISION' | 'APROBADA' | 'PAGADA' | 'CANCELADA'>;
}

interface CorrectionRestoreSummary {
  incidences: number;
  extras: number;
}

interface FinanceSummary {
  lines: number;
  teachers: number;
  coordinations: number;
  baseHours: number;
  grossBaseAmount: number;
  discountAmount: number;
  totalExtraHours: number;
  totalExtraAmount: number;
  totalAmount: number;
  alerts: number;
  fiscalPending: number;
  readyPayments: number;
}

interface FinanceRun {
  id: string;
  cycleId: string;
  cycleLabel: string;
  periodLabel: string;
  status: PayrollRunStatus;
  summary: FinanceSummary;
  calculatedAt: string | null;
  calculatedByEmail: string;
  reviewedAt: string | null;
  reviewedByEmail: string;
  approvedAt: string | null;
  approvedByEmail: string;
  paidAt: string | null;
  paidByEmail: string;
  statusUpdatedAt: string | null;
  statusUpdatedByEmail: string;
  createdAt: string;
}

interface FinanceLineRow {
  id: string;
  lineKey: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  paymentType: string;
  category: string;
  rfc: string;
  email: string;
  bankDetail: string;
  hasConstancia: boolean;
  baseHours: number;
  grossBaseAmount: number;
  absences: number;
  delays: number;
  absenceDiscountAmount: number;
  delayDiscountAmount: number;
  baseNetAmount: number;
  scheduleExtraHours: number;
  scheduleExtraAmount: number;
  loggedExtraHours: number;
  loggedExtraAmount: number;
  totalExtraHours: number;
  totalExtraAmount: number;
  totalAmount: number;
  alerts: unknown;
}

interface FinanceLine extends Omit<FinanceLineRow, 'alerts'> {
  alerts: string[];
  fiscalMissing: string[];
  paymentStatus: PaymentStatus;
}

interface FinanceScheduleDetail {
  lineKey: string;
  scheduleId: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  subjectName: string;
  groupCode: string;
  tabulatorName: string;
  tabulatorAmount: number;
  weekdayHours: number;
  module1Hours: number;
  module2Hours: number;
  baseHours: number;
  grossBaseAmount: number;
  absences: number;
  delays: number;
  delayDiscountHours: number;
  absenceDiscountAmount: number;
  delayDiscountAmount: number;
  scheduleExtraHours: number;
  scheduleExtraAmount: number;
  baseNetAmount: number;
}

interface FinanceExtraDetail {
  lineKey: string;
  extraId: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  reason: string;
  activityDate: string | null;
  hours: number;
  tabulatorAmount: number;
  totalAmount: number;
}

interface CoordinationSummary {
  coordinationId: string;
  coordinationName: string;
  teachers: number;
  lines: number;
  baseHours: number;
  totalExtraHours: number;
  discountAmount: number;
  totalAmount: number;
  fiscalPending: number;
  alerts: number;
}

interface ReportRunHeader {
  id: string;
  cycleId: string;
}

interface LoadedFinanceRun {
  run: FinanceRun;
  lines: FinanceLine[];
  coordinationSummary: CoordinationSummary[];
}

interface PaymentTypeSummary {
  code: string;
  label: string;
  lines: number;
  teachers: number;
  ready: number;
  pending: number;
  totalAmount: number;
}

const querySchema = z.object({
  cycleId: z.string().uuid().optional(),
  runId: z.string().uuid().optional()
});

const exportParamsSchema = z.object({
  kind: z.enum(['payments', 'fiscal', 'coordinations'])
});

const runParamsSchema = z.object({
  id: z.string().uuid()
});

const statusPayloadSchema = z.object({
  status: z.enum(['EN_REVISION', 'APROBADA', 'PAGADA', 'CANCELADA'])
});

const emptySummary = (): FinanceSummary => ({
  lines: 0,
  teachers: 0,
  coordinations: 0,
  baseHours: 0,
  grossBaseAmount: 0,
  discountAmount: 0,
  totalExtraHours: 0,
  totalExtraAmount: 0,
  totalAmount: 0,
  alerts: 0,
  fiscalPending: 0,
  readyPayments: 0
});

function sendValidation(reply: FastifyReply, error: z.ZodError): void {
  void reply.code(400).send({
    error: 'VALIDATION_ERROR',
    message: error.issues[0]?.message || 'Datos inválidos.'
  });
}

function isSystemAdmin(actor: SessionUser): boolean {
  return actor.role === 'admin' || actor.isProtectedSuperAdmin;
}

function canViewAllFinance(actor: SessionUser): boolean {
  return isSystemAdmin(actor) || actor.permissions.includes('finance.view') || actor.permissions.includes('finance.global_view');
}

function canManageFinanceWorkflow(actor: SessionUser): boolean {
  return isSystemAdmin(actor) || actor.permissions.includes('finance.view') || actor.permissions.includes('payroll.finalize');
}

function canCancelPayrollForCorrection(actor: SessionUser): boolean {
  return isSystemAdmin(actor) || actor.permissions.includes('payroll.finalize');
}

function isGlobalFinanceReadOnly(actor: SessionUser): boolean {
  return (
    actor.permissions.includes('finance.global_view') &&
    !isSystemAdmin(actor) &&
    !actor.permissions.includes('finance.view') &&
    !actor.permissions.includes('payroll.finalize')
  );
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseAlerts(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function fiscalMissing(row: FinanceLineRow): string[] {
  const missing: string[] = [];
  if (!row.rfc) missing.push('RFC');
  if (!row.email) missing.push('Correo');
  if (!row.bankDetail) missing.push('Datos bancarios');
  if (!row.hasConstancia) missing.push('Constancia fiscal');
  return missing;
}

function csvValue(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\r\n');
}

function sendCsv(reply: FastifyReply, fileName: string, content: string): void {
  void reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${fileName}"`)
    .send(content);
}

function exportFileName(run: FinanceRun, suffix: string): string {
  const safePeriod = run.periodLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `finanzas-${safePeriod || run.id}-${suffix}.csv`;
}

async function loadReportRunHeader(client: PoolClient, runId: string): Promise<ReportRunHeader | null> {
  const result = await client.query<ReportRunHeader>(
    'SELECT id, cycle_id AS "cycleId" FROM payroll_runs WHERE id = $1 LIMIT 1',
    [runId]
  );
  return result.rows[0] || null;
}

async function listFinanceRuns(
  client: PoolClient,
  cycleId: string,
  actor: SessionUser,
  actorCoordination: CoordinationRow | null
): Promise<FinanceRun[]> {
  const params: unknown[] = [cycleId];
  let visibility = '';
  if (!canViewAllFinance(actor)) {
    if (actorCoordination) {
      params.push(actorCoordination.id);
      visibility = 'AND pl.coordination_id = $2';
    } else {
      visibility = 'AND false';
    }
  }

  const result = await client.query<
    Omit<FinanceRun, 'summary'> & {
      lines: number;
      teachers: number;
      coordinations: number;
      baseHours: number;
      grossBaseAmount: number;
      discountAmount: number;
      totalExtraHours: number;
      totalExtraAmount: number;
      totalAmount: number;
      alerts: number;
    }
  >(
    `
      SELECT
        pr.id,
        pr.cycle_id AS "cycleId",
        CONCAT(ac.period_label, ' - ', ac.quarter_code) AS "cycleLabel",
        pr.period_label AS "periodLabel",
        pr.status,
        pr.calculated_at AS "calculatedAt",
        COALESCE(calculated_user.email, '') AS "calculatedByEmail",
        pr.reviewed_at AS "reviewedAt",
        COALESCE(reviewed_user.email, '') AS "reviewedByEmail",
        pr.approved_at AS "approvedAt",
        COALESCE(approved_user.email, '') AS "approvedByEmail",
        pr.paid_at AS "paidAt",
        COALESCE(paid_user.email, '') AS "paidByEmail",
        pr.status_updated_at AS "statusUpdatedAt",
        COALESCE(status_user.email, '') AS "statusUpdatedByEmail",
        pr.created_at AS "createdAt",
        count(pl.id)::int AS lines,
        count(DISTINCT pl.teacher_id)::int AS teachers,
        count(DISTINCT pl.coordination_id)::int AS coordinations,
        COALESCE(sum(pl.base_hours), 0)::float8 AS "baseHours",
        COALESCE(sum(pl.gross_base_amount), 0)::float8 AS "grossBaseAmount",
        COALESCE(sum(pl.absence_discount_amount + pl.delay_discount_amount), 0)::float8 AS "discountAmount",
        COALESCE(sum(pl.total_extra_hours), 0)::float8 AS "totalExtraHours",
        COALESCE(sum(pl.total_extra_amount), 0)::float8 AS "totalExtraAmount",
        COALESCE(sum(pl.total_amount), 0)::float8 AS "totalAmount",
        COALESCE(
          sum(
            CASE
              WHEN pl.alerts IS NULL THEN 0
              WHEN jsonb_typeof(pl.alerts) = 'array' THEN jsonb_array_length(pl.alerts)
              ELSE 0
            END
          ),
          0
        )::int AS alerts
      FROM payroll_runs pr
      JOIN academic_cycles ac ON ac.id = pr.cycle_id
      LEFT JOIN app_users calculated_user ON calculated_user.id = pr.calculated_by
      LEFT JOIN app_users reviewed_user ON reviewed_user.id = pr.reviewed_by
      LEFT JOIN app_users approved_user ON approved_user.id = pr.approved_by
      LEFT JOIN app_users paid_user ON paid_user.id = pr.paid_by
      LEFT JOIN app_users status_user ON status_user.id = pr.status_updated_by
      LEFT JOIN payroll_lines pl ON pl.payroll_run_id = pr.id ${visibility}
      WHERE pr.cycle_id = $1
      GROUP BY
        pr.id,
        ac.period_label,
        ac.quarter_code,
        calculated_user.email,
        reviewed_user.email,
        approved_user.email,
        paid_user.email,
        status_user.email
      ORDER BY pr.calculated_at DESC NULLS LAST, pr.created_at DESC
      LIMIT 72
    `,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    cycleId: row.cycleId,
    cycleLabel: row.cycleLabel,
    periodLabel: row.periodLabel,
    status: row.status,
    calculatedAt: row.calculatedAt,
    calculatedByEmail: row.calculatedByEmail,
    reviewedAt: row.reviewedAt,
    reviewedByEmail: row.reviewedByEmail,
    approvedAt: row.approvedAt,
    approvedByEmail: row.approvedByEmail,
    paidAt: row.paidAt,
    paidByEmail: row.paidByEmail,
    statusUpdatedAt: row.statusUpdatedAt,
    statusUpdatedByEmail: row.statusUpdatedByEmail,
    createdAt: row.createdAt,
    summary: {
      lines: Number(row.lines || 0),
      teachers: Number(row.teachers || 0),
      coordinations: Number(row.coordinations || 0),
      baseHours: round2(Number(row.baseHours || 0)),
      grossBaseAmount: round2(Number(row.grossBaseAmount || 0)),
      discountAmount: round2(Number(row.discountAmount || 0)),
      totalExtraHours: round2(Number(row.totalExtraHours || 0)),
      totalExtraAmount: round2(Number(row.totalExtraAmount || 0)),
      totalAmount: round2(Number(row.totalAmount || 0)),
      alerts: Number(row.alerts || 0),
      fiscalPending: 0,
      readyPayments: 0
    }
  }));
}

async function listFinanceLines(
  client: PoolClient,
  runId: string,
  actor: SessionUser,
  actorCoordination: CoordinationRow | null
): Promise<FinanceLine[]> {
  const params: unknown[] = [runId];
  let visibility = '';
  if (!canViewAllFinance(actor)) {
    if (actorCoordination) {
      params.push(actorCoordination.id);
      visibility = 'AND pl.coordination_id = $2';
    } else {
      visibility = 'AND false';
    }
  }

  const result = await client.query<FinanceLineRow>(
    `
      SELECT
        pl.id,
        CONCAT(pl.teacher_id::text, ':', pl.coordination_id::text) AS "lineKey",
        pl.teacher_id AS "teacherId",
        pl.coordination_id AS "coordinationId",
        pl.teacher_name_snapshot AS "teacherName",
        pl.coordination_name_snapshot AS "coordinationName",
        pl.payment_type_snapshot AS "paymentType",
        pl.category_snapshot AS category,
        COALESCE(t.rfc, '') AS rfc,
        COALESCE(t.email, '') AS email,
        COALESCE(t.bank_detail, '') AS "bankDetail",
        EXISTS (
          SELECT 1
          FROM teacher_documents d
          WHERE d.teacher_id = t.id
            AND d.document_type = 'CONSTANCIA_FISCAL'
            AND d.is_current = true
        ) AS "hasConstancia",
        pl.base_hours::float8 AS "baseHours",
        pl.gross_base_amount::float8 AS "grossBaseAmount",
        pl.absences::float8 AS absences,
        pl.delays::float8 AS delays,
        pl.absence_discount_amount::float8 AS "absenceDiscountAmount",
        pl.delay_discount_amount::float8 AS "delayDiscountAmount",
        pl.base_net_amount::float8 AS "baseNetAmount",
        pl.schedule_extra_hours::float8 AS "scheduleExtraHours",
        pl.schedule_extra_amount::float8 AS "scheduleExtraAmount",
        pl.logged_extra_hours::float8 AS "loggedExtraHours",
        pl.logged_extra_amount::float8 AS "loggedExtraAmount",
        pl.total_extra_hours::float8 AS "totalExtraHours",
        pl.total_extra_amount::float8 AS "totalExtraAmount",
        pl.total_amount::float8 AS "totalAmount",
        pl.alerts
      FROM payroll_lines pl
      LEFT JOIN teachers t ON t.id = pl.teacher_id
      WHERE pl.payroll_run_id = $1
        ${visibility}
      ORDER BY pl.coordination_name_snapshot ASC, pl.teacher_name_snapshot ASC
    `,
    params
  );

  return result.rows.map((row) => {
    const missing = fiscalMissing(row);
    return {
      ...row,
      alerts: parseAlerts(row.alerts),
      fiscalMissing: missing,
      paymentStatus: missing.length ? 'PENDIENTE' : 'LISTO'
    };
  });
}

async function listFinanceScheduleDetails(
  client: PoolClient,
  runId: string,
  actor: SessionUser,
  actorCoordination: CoordinationRow | null
): Promise<FinanceScheduleDetail[]> {
  const params: unknown[] = [runId];
  let visibility = '';
  if (!canViewAllFinance(actor)) {
    if (actorCoordination) {
      params.push(actorCoordination.id);
      visibility = 'AND coordination_id = $2';
    } else {
      visibility = 'AND false';
    }
  }

  const result = await client.query<FinanceScheduleDetail>(
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
        tabulator_amount::float8 AS "tabulatorAmount",
        weekday_hours::float8 AS "weekdayHours",
        module1_hours::float8 AS "module1Hours",
        module2_hours::float8 AS "module2Hours",
        base_hours::float8 AS "baseHours",
        gross_base_amount::float8 AS "grossBaseAmount",
        absences::float8 AS absences,
        delays::float8 AS delays,
        delay_discount_hours::float8 AS "delayDiscountHours",
        absence_discount_amount::float8 AS "absenceDiscountAmount",
        delay_discount_amount::float8 AS "delayDiscountAmount",
        schedule_extra_hours::float8 AS "scheduleExtraHours",
        schedule_extra_amount::float8 AS "scheduleExtraAmount",
        base_net_amount::float8 AS "baseNetAmount"
      FROM payroll_schedule_details
      WHERE payroll_run_id = $1
        ${visibility}
      ORDER BY coordination_name_snapshot ASC, teacher_name_snapshot ASC, subject_name_snapshot ASC, group_code_snapshot ASC
    `,
    params
  );

  return result.rows;
}

async function listFinanceExtraDetails(
  client: PoolClient,
  runId: string,
  actor: SessionUser,
  actorCoordination: CoordinationRow | null
): Promise<FinanceExtraDetail[]> {
  const params: unknown[] = [runId];
  let visibility = '';
  if (!canViewAllFinance(actor)) {
    if (actorCoordination) {
      params.push(actorCoordination.id);
      visibility = 'AND coordination_id = $2';
    } else {
      visibility = 'AND false';
    }
  }

  const result = await client.query<FinanceExtraDetail>(
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
        hours::float8 AS hours,
        tabulator_amount::float8 AS "tabulatorAmount",
        total_amount::float8 AS "totalAmount"
      FROM payroll_extra_details
      WHERE payroll_run_id = $1
        ${visibility}
      ORDER BY coordination_name_snapshot ASC, teacher_name_snapshot ASC, activity_date ASC NULLS LAST, reason_snapshot ASC
    `,
    params
  );

  return result.rows;
}

function nextStatusMessage(status: FinanceRunStatusPayload['status']): string {
  if (status === 'EN_REVISION') return 'Nómina enviada a revisión financiera.';
  if (status === 'APROBADA') return 'Nómina aprobada para pago.';
  if (status === 'CANCELADA') return 'Nómina cancelada para corrección. La quincena quedó abierta para ajustar incidencias y extras.';
  return 'Nómina marcada como pagada.';
}

function validateStatusTransition(current: PayrollRunStatus, target: FinanceRunStatusPayload['status']): void {
  const allowed: Record<PayrollRunStatus, PayrollRunStatus[]> = {
    BORRADOR: [],
    CALCULADA: ['EN_REVISION', 'CANCELADA'],
    EN_REVISION: ['APROBADA', 'CANCELADA'],
    APROBADA: ['PAGADA', 'CANCELADA'],
    PAGADA: [],
    CERRADA: [],
    CANCELADA: []
  };

  if (!allowed[current]?.includes(target)) {
    throw new Error(`La nómina no puede pasar de ${current} a ${target}.`);
  }
}

async function restoreRunInputsForCorrection(
  client: PoolClient,
  actor: SessionUser,
  runId: string
): Promise<CorrectionRestoreSummary> {
  const runResult = await client.query<{ cycleId: string; periodLabel: string; calendarConfigId: string | null }>(
    `
      SELECT
        cycle_id AS "cycleId",
        period_label AS "periodLabel",
        NULLIF(weights->>'calendarConfigId', '') AS "calendarConfigId"
      FROM payroll_runs
      WHERE id = $1
      LIMIT 1
    `,
    [runId]
  );
  const run = runResult.rows[0];
  if (!run) throw new Error('No se encontró la corrida de nómina.');

  let restoredIncidences = 0;
  if (run.calendarConfigId) {
    const incidenceResult = await client.query(
      `
        INSERT INTO schedule_incidences (
          schedule_id,
          calendar_config_id,
          absences,
          delays,
          extra_hours_in_schedule,
          updated_at,
          updated_by
        )
        SELECT
          schedule_id,
          $2::uuid,
          absences,
          delays,
          schedule_extra_hours,
          now(),
          $3
        FROM payroll_schedule_details
        WHERE payroll_run_id = $1
          AND schedule_id IS NOT NULL
          AND (
            absences > 0
            OR delays > 0
            OR schedule_extra_hours > 0
          )
        ON CONFLICT (schedule_id, calendar_config_id)
        DO UPDATE SET
          absences = EXCLUDED.absences,
          delays = EXCLUDED.delays,
          extra_hours_in_schedule = EXCLUDED.extra_hours_in_schedule,
          updated_at = now(),
          updated_by = EXCLUDED.updated_by
      `,
      [runId, run.calendarConfigId, actor.id]
    );
    restoredIncidences = incidenceResult.rowCount || 0;
  }

  const extraResult = await client.query(
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
        captured_at,
        captured_by,
        updated_at,
        updated_by
      )
      SELECT
        COALESCE(ped.extra_id, gen_random_uuid()),
        pr.cycle_id,
        ped.coordination_id,
        ped.teacher_id,
        ped.hours,
        ped.tabulator_amount,
        COALESCE(NULLIF(ped.reason_snapshot, ''), 'Extra restaurado'),
        ped.activity_date,
        '',
        CONCAT('Restaurado desde nómina cancelada: ', pr.period_label),
        now(),
        $2,
        now(),
        $2
      FROM payroll_extra_details ped
      JOIN payroll_runs pr ON pr.id = ped.payroll_run_id
      WHERE ped.payroll_run_id = $1
        AND ped.teacher_id IS NOT NULL
        AND ped.coordination_id IS NOT NULL
        AND ped.hours > 0
        AND ped.tabulator_amount > 0
      ON CONFLICT (id)
      DO UPDATE SET
        cycle_id = EXCLUDED.cycle_id,
        coordination_id = EXCLUDED.coordination_id,
        teacher_id = EXCLUDED.teacher_id,
        hours = EXCLUDED.hours,
        tabulator_amount = EXCLUDED.tabulator_amount,
        reason = EXCLUDED.reason,
        activity_date = EXCLUDED.activity_date,
        observations = EXCLUDED.observations,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by
    `,
    [runId, actor.id]
  );

  return {
    incidences: restoredIncidences,
    extras: extraResult.rowCount || 0
  };
}

async function updateFinanceRunStatus(
  client: PoolClient,
  actor: SessionUser,
  runId: string,
  targetStatus: FinanceRunStatusPayload['status']
): Promise<void> {
  const current = await client.query<{ status: PayrollRunStatus }>(
    'SELECT status FROM payroll_runs WHERE id = $1 FOR UPDATE',
    [runId]
  );
  const currentStatus = current.rows[0]?.status;
  if (!currentStatus) throw new Error('No se encontró la corrida de nómina.');
  validateStatusTransition(currentStatus, targetStatus);

  const auditBefore = { status: currentStatus };
  const correctionRestore =
    targetStatus === 'CANCELADA' ? await restoreRunInputsForCorrection(client, actor, runId) : null;
  const extraColumns =
    targetStatus === 'EN_REVISION'
      ? ', reviewed_at = COALESCE(reviewed_at, now()), reviewed_by = COALESCE(reviewed_by, $3)'
      : targetStatus === 'APROBADA'
        ? ', approved_at = COALESCE(approved_at, now()), approved_by = COALESCE(approved_by, $3)'
        : targetStatus === 'PAGADA'
          ? ', paid_at = COALESCE(paid_at, now()), paid_by = COALESCE(paid_by, $3)'
          : '';

  await client.query(
    `
      UPDATE payroll_runs
      SET
        status = $2,
        status_updated_at = now(),
        status_updated_by = $3
        ${extraColumns}
      WHERE id = $1
    `,
    [runId, targetStatus, actor.id]
  );

  await client.query(
    `
      INSERT INTO audit_log (
        actor_user_id,
        actor_email,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, $2, $6, 'payroll_run', $3, $4::jsonb, $5::jsonb)
    `,
    [
      actor.id,
      actor.email,
      runId,
      JSON.stringify(auditBefore),
      JSON.stringify({
        status: targetStatus,
        correctionRestore
      }),
      targetStatus === 'CANCELADA' ? 'PAYROLL_CANCELLED_FOR_CORRECTION' : 'PAYROLL_STATUS_UPDATED'
    ]
  );
}

function summarizeLines(lines: FinanceLine[]): FinanceSummary {
  return {
    lines: lines.length,
    teachers: new Set(lines.map((line) => line.teacherId)).size,
    coordinations: new Set(lines.map((line) => line.coordinationId)).size,
    baseHours: round2(lines.reduce((sum, line) => sum + line.baseHours, 0)),
    grossBaseAmount: round2(lines.reduce((sum, line) => sum + line.grossBaseAmount, 0)),
    discountAmount: round2(lines.reduce((sum, line) => sum + line.absenceDiscountAmount + line.delayDiscountAmount, 0)),
    totalExtraHours: round2(lines.reduce((sum, line) => sum + line.totalExtraHours, 0)),
    totalExtraAmount: round2(lines.reduce((sum, line) => sum + line.totalExtraAmount, 0)),
    totalAmount: round2(lines.reduce((sum, line) => sum + line.totalAmount, 0)),
    alerts: lines.reduce((sum, line) => sum + line.alerts.length, 0),
    fiscalPending: lines.filter((line) => line.paymentStatus === 'PENDIENTE').length,
    readyPayments: lines.filter((line) => line.paymentStatus === 'LISTO').length
  };
}

function summarizeCoordinations(lines: FinanceLine[]): CoordinationSummary[] {
  const summaries = new Map<string, CoordinationSummary & { teacherIds: Set<string> }>();
  for (const line of lines) {
    const existing =
      summaries.get(line.coordinationId) ||
      ({
        coordinationId: line.coordinationId,
        coordinationName: line.coordinationName,
        teachers: 0,
        teacherIds: new Set<string>(),
        lines: 0,
        baseHours: 0,
        totalExtraHours: 0,
        discountAmount: 0,
        totalAmount: 0,
        fiscalPending: 0,
        alerts: 0
      } satisfies CoordinationSummary & { teacherIds: Set<string> });

    existing.teacherIds.add(line.teacherId);
    existing.lines += 1;
    existing.baseHours += line.baseHours;
    existing.totalExtraHours += line.totalExtraHours;
    existing.discountAmount += line.absenceDiscountAmount + line.delayDiscountAmount;
    existing.totalAmount += line.totalAmount;
    existing.fiscalPending += line.paymentStatus === 'PENDIENTE' ? 1 : 0;
    existing.alerts += line.alerts.length;
    summaries.set(line.coordinationId, existing);
  }

  return [...summaries.values()]
    .map(({ teacherIds, ...summary }) => ({
      ...summary,
      teachers: teacherIds.size,
      baseHours: round2(summary.baseHours),
      totalExtraHours: round2(summary.totalExtraHours),
      discountAmount: round2(summary.discountAmount),
      totalAmount: round2(summary.totalAmount)
    }))
    .sort((left, right) => right.totalAmount - left.totalAmount);
}

async function buildFinanceContext(actor: SessionUser, query: FinanceQuery) {
  const cycles = await listCycles();
  const actorCoordination = await withTransaction((client) => loadActorCoordination(client, actor, false));
  const requestedRun = query.runId
    ? await withTransaction((client) => loadReportRunHeader(client, query.runId as string))
    : null;

  const selectedCycle =
    cycles.find((cycle) => cycle.id === requestedRun?.cycleId) ||
    cycles.find((cycle) => cycle.id === query.cycleId) ||
    cycles[0] ||
    null;

  if (!selectedCycle) {
    return {
      activeCycle: null,
      cycles,
      actorCoordination,
      runs: [],
      selectedRun: null,
      summary: emptySummary(),
      lines: [],
      coordinationSummary: [],
      scheduleDetails: [],
      extraDetails: []
    };
  }

  return withTransaction(async (client) => {
    const runs = await listFinanceRuns(client, selectedCycle.id, actor, actorCoordination);
    const selectedRun = runs.find((run) => run.id === query.runId) || runs[0] || null;
    const lines = selectedRun ? await listFinanceLines(client, selectedRun.id, actor, actorCoordination) : [];
    const scheduleDetails = selectedRun
      ? await listFinanceScheduleDetails(client, selectedRun.id, actor, actorCoordination)
      : [];
    const extraDetails = selectedRun ? await listFinanceExtraDetails(client, selectedRun.id, actor, actorCoordination) : [];
    const summary = summarizeLines(lines);
    if (selectedRun) selectedRun.summary = summary;

    return {
      activeCycle: selectedCycle,
      cycles,
      actorCoordination,
      runs,
      selectedRun,
      summary,
      lines,
      coordinationSummary: summarizeCoordinations(lines),
      scheduleDetails,
      extraDetails
    };
  });
}

async function loadVisibleFinanceRun(client: PoolClient, actor: SessionUser, runId: string): Promise<LoadedFinanceRun | null> {
  const runHeader = await loadReportRunHeader(client, runId);
  if (!runHeader) return null;

  const actorCoordination = await loadActorCoordination(client, actor, false);
  const runs = await listFinanceRuns(client, runHeader.cycleId, actor, actorCoordination);
  const run = runs.find((item) => item.id === runId) || null;
  if (!run) return null;

  const lines = await listFinanceLines(client, run.id, actor, actorCoordination);
  run.summary = summarizeLines(lines);
  return {
    run,
    lines,
    coordinationSummary: summarizeCoordinations(lines)
  };
}

function paymentHeaders(): string[] {
  return [
    'Docente',
    'Coordinación',
    'RFC',
    'Correo',
    'Datos bancarios',
    'Tipo pago',
    'Categoría',
    'Horas base',
    'Bruto base',
    'Descuentos',
    'Extras h',
    'Extras monto',
    'Total neto',
    'Estatus',
    'Pendientes',
    'Alertas'
  ];
}

function paymentRows(lines: FinanceLine[]): unknown[][] {
  return lines.map((line) => [
    line.teacherName,
    line.coordinationName,
    line.rfc,
    line.email,
    line.bankDetail,
    line.paymentType,
    line.category,
    line.baseHours,
    line.grossBaseAmount,
    round2(line.absenceDiscountAmount + line.delayDiscountAmount),
    line.totalExtraHours,
    line.totalExtraAmount,
    line.totalAmount,
    line.paymentStatus,
    line.fiscalMissing.join(' | '),
    line.alerts.join(' | ')
  ]);
}

function coordinationHeaders(): string[] {
  return ['Coordinación', 'Docentes', 'Líneas', 'Horas base', 'Extras h', 'Descuentos', 'Total', 'Pendientes fiscales', 'Alertas'];
}

function coordinationRows(rows: CoordinationSummary[]): unknown[][] {
  return rows.map((row) => [
    row.coordinationName,
    row.teachers,
    row.lines,
    row.baseHours,
    row.totalExtraHours,
    row.discountAmount,
    row.totalAmount,
    row.fiscalPending,
    row.alerts
  ]);
}

function moneyText(value: number): string {
  return Number(value || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN'
  });
}

function numberText(value: number): string {
  return Number(value || 0).toLocaleString('es-MX');
}

function hourText(value: number): string {
  const numeric = Number(value || 0);
  return Number.isInteger(numeric) ? `${numeric} h` : `${numeric.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} h`;
}

function dateTimeText(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function statusText(status: PayrollRunStatus): string {
  if (status === 'EN_REVISION') return 'EN REVISIÓN';
  return status;
}

function paymentTypeText(paymentType: string): string {
  if (paymentType === 'E') return 'Efectivo';
  if (paymentType === '1') return 'Santander';
  if (paymentType === '2') return 'Banorte';
  return paymentType || '-';
}

function shortText(value: string | null | undefined, maxLength = 48): string {
  const text = (value || '-').trim() || '-';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}.`;
}

function financePdfFileName(run: FinanceRun, suffix: string): string {
  const safePeriod = run.periodLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `finanzas-${safePeriod || run.id}-${suffix}.pdf`;
}

function sendPdf(reply: FastifyReply, fileName: string, content: Buffer): void {
  void reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="${fileName}"`)
    .send(content);
}

function summarizePaymentTypes(lines: FinanceLine[]): PaymentTypeSummary[] {
  const groups = new Map<string, PaymentTypeSummary & { teacherIds: Set<string> }>();
  for (const line of lines) {
    const code = line.paymentType || '-';
    const existing =
      groups.get(code) ||
      ({
        code,
        label: paymentTypeText(code),
        lines: 0,
        teachers: 0,
        teacherIds: new Set<string>(),
        ready: 0,
        pending: 0,
        totalAmount: 0
      } satisfies PaymentTypeSummary & { teacherIds: Set<string> });
    existing.lines += 1;
    existing.teacherIds.add(line.teacherId);
    existing.ready += line.paymentStatus === 'LISTO' ? 1 : 0;
    existing.pending += line.paymentStatus === 'PENDIENTE' ? 1 : 0;
    existing.totalAmount += line.totalAmount;
    groups.set(code, existing);
  }

  const preferred = ['1', '2', 'E'];
  return [...groups.values()]
    .map(({ teacherIds, ...summary }) => ({
      ...summary,
      teachers: teacherIds.size,
      totalAmount: round2(summary.totalAmount)
    }))
    .sort((left, right) => {
      const leftIndex = preferred.indexOf(left.code);
      const rightIndex = preferred.indexOf(right.code);
      if (leftIndex !== -1 || rightIndex !== -1) return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
      return left.label.localeCompare(right.label, 'es');
    });
}

const pdfMargin = 42;
const pdfRight = 570;
const pdfBottom = 750;

function startFinancePdf(title: string, run: FinanceRun): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'LETTER', margin: pdfMargin, autoFirstPage: true });
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(18).text(title, pdfMargin, pdfMargin);
  doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(8).text('NÓMINA DOCENTE', pdfMargin, pdfMargin + 24);
  doc
    .fillColor('#0F766E')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(statusText(run.status), pdfRight - 120, pdfMargin + 4, { width: 120, align: 'right' });
  doc
    .fillColor('#0F172A')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(run.periodLabel, pdfMargin, pdfMargin + 48, { width: 340 });
  doc.fillColor('#64748B').font('Helvetica').fontSize(9).text(run.cycleLabel, pdfMargin, pdfMargin + 65, { width: 340 });
  doc
    .fillColor('#64748B')
    .font('Helvetica')
    .fontSize(8)
    .text(`Emitido ${dateTimeText(new Date().toISOString())}`, pdfRight - 190, pdfMargin + 50, { width: 190, align: 'right' });
  doc.moveTo(pdfMargin, pdfMargin + 88).lineTo(pdfRight, pdfMargin + 88).strokeColor('#CBD5E1').lineWidth(1).stroke();
  return doc;
}

function pdfBufferFrom(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function ensurePdfSpace(doc: PDFKit.PDFDocument, cursor: number, needed: number, title: string, run: FinanceRun): number {
  if (cursor + needed <= pdfBottom) return cursor;
  doc.addPage();
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(11).text(title, pdfMargin, pdfMargin);
  doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(`${run.periodLabel} / ${statusText(run.status)}`, pdfMargin, pdfMargin + 16);
  doc.moveTo(pdfMargin, pdfMargin + 34).lineTo(pdfRight, pdfMargin + 34).strokeColor('#CBD5E1').stroke();
  return pdfMargin + 52;
}

function drawPdfSection(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(12).text(title, pdfMargin, y);
  doc.moveTo(pdfMargin, y + 18).lineTo(pdfRight, y + 18).strokeColor('#E2E8F0').stroke();
  return y + 30;
}

function drawPdfMetric(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  helper: string
): void {
  doc.roundedRect(x, y, width, 62, 8).fillAndStroke('#F8FAFC', '#DBE3EF');
  doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(7.5).text(label.toUpperCase(), x + 10, y + 10, { width: width - 20 });
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(14).text(value, x + 10, y + 25, { width: width - 20 });
  doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(helper, x + 10, y + 45, { width: width - 20 });
}

function drawPdfTableHeader(doc: PDFKit.PDFDocument, columns: Array<{ label: string; x: number; width: number }>, y: number): number {
  doc.rect(pdfMargin, y, pdfRight - pdfMargin, 22).fill('#F1F5F9');
  for (const column of columns) {
    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(7.5).text(column.label.toUpperCase(), column.x, y + 7, {
      width: column.width
    });
  }
  return y + 22;
}

function buildFinanceSummaryPdf(run: FinanceRun, lines: FinanceLine[], coordinations: CoordinationSummary[]): Promise<Buffer> {
  const doc = startFinancePdf('Resumen ejecutivo de nómina', run);
  const summary = summarizeLines(lines);
  const paymentTypes = summarizePaymentTypes(lines);
  let y = 150;

  const metricWidth = 124;
  drawPdfMetric(doc, 42, y, metricWidth, 'Total a pagar', moneyText(summary.totalAmount), `${numberText(summary.teachers)} docentes`);
  drawPdfMetric(doc, 176, y, metricWidth, 'Horas base', hourText(summary.baseHours), moneyText(summary.grossBaseAmount));
  drawPdfMetric(doc, 310, y, metricWidth, 'Descuentos', moneyText(summary.discountAmount), 'Faltas y retardos');
  drawPdfMetric(doc, 444, y, metricWidth, 'Extras', moneyText(summary.totalExtraAmount), hourText(summary.totalExtraHours));
  y += 88;

  y = drawPdfSection(doc, 'Distribucion por tipo de pago', y);
  const paymentColumns = [
    { label: 'Tipo', x: 48, width: 120 },
    { label: 'Líneas', x: 190, width: 58 },
    { label: 'Docentes', x: 260, width: 66 },
    { label: 'Listos', x: 338, width: 56 },
    { label: 'Pendientes', x: 406, width: 70 },
    { label: 'Total', x: 486, width: 76 }
  ];
  y = drawPdfTableHeader(doc, paymentColumns, y);
  for (const row of paymentTypes) {
    y = ensurePdfSpace(doc, y, 24, 'Resumen ejecutivo de nómina', run);
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5).text(row.label, 48, y + 7, { width: 120 });
    doc.fillColor('#334155').font('Helvetica').fontSize(8).text(String(row.lines), 190, y + 7, { width: 58 });
    doc.text(String(row.teachers), 260, y + 7, { width: 66 });
    doc.text(String(row.ready), 338, y + 7, { width: 56 });
    doc.text(String(row.pending), 406, y + 7, { width: 70 });
    doc.font('Helvetica-Bold').text(moneyText(row.totalAmount), 486, y + 7, { width: 76, align: 'right' });
    doc.moveTo(pdfMargin, y + 24).lineTo(pdfRight, y + 24).strokeColor('#E2E8F0').stroke();
    y += 24;
  }

  y += 22;
  y = drawPdfSection(doc, 'Resumen por coordinación', y);
  const coordinationColumns = [
    { label: 'Coordinación', x: 48, width: 178 },
    { label: 'Doc.', x: 236, width: 40 },
    { label: 'Base', x: 288, width: 62 },
    { label: 'Extras', x: 362, width: 62 },
    { label: 'Desc.', x: 434, width: 60 },
    { label: 'Total', x: 504, width: 58 }
  ];
  y = drawPdfTableHeader(doc, coordinationColumns, y);
  for (const row of coordinations) {
    y = ensurePdfSpace(doc, y, 28, 'Resumen ejecutivo de nómina', run);
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8).text(shortText(row.coordinationName, 38), 48, y + 7, { width: 178 });
    doc.fillColor('#334155').font('Helvetica').fontSize(8).text(String(row.teachers), 236, y + 7, { width: 40 });
    doc.text(hourText(row.baseHours), 288, y + 7, { width: 62 });
    doc.text(hourText(row.totalExtraHours), 362, y + 7, { width: 62 });
    doc.text(moneyText(row.discountAmount), 434, y + 7, { width: 60, align: 'right' });
    doc.font('Helvetica-Bold').text(moneyText(row.totalAmount), 504, y + 7, { width: 58, align: 'right' });
    doc.moveTo(pdfMargin, y + 28).lineTo(pdfRight, y + 28).strokeColor('#E2E8F0').stroke();
    y += 28;
  }

  y = ensurePdfSpace(doc, y + 18, 42, 'Resumen ejecutivo de nómina', run);
  doc
    .fillColor('#64748B')
    .font('Helvetica')
    .fontSize(8)
    .text(
      `Corrida calculada por ${run.calculatedByEmail || 'Sistema'} el ${dateTimeText(run.calculatedAt || run.createdAt)}. Estado actual: ${statusText(run.status)}.`,
      pdfMargin,
      y + 18,
      { width: pdfRight - pdfMargin }
    );

  return pdfBufferFrom(doc);
}

function buildCoordinationReportPdf(run: FinanceRun, lines: FinanceLine[], coordinations: CoordinationSummary[]): Promise<Buffer> {
  const doc = startFinancePdf('Reporte por coordinación', run);
  const linesByCoordination = new Map<string, FinanceLine[]>();
  for (const line of lines) {
    const list = linesByCoordination.get(line.coordinationId) || [];
    list.push(line);
    linesByCoordination.set(line.coordinationId, list);
  }

  const columns = [
    { label: 'Docente', x: 48, width: 176 },
    { label: 'Pago', x: 236, width: 58 },
    { label: 'Base', x: 304, width: 58 },
    { label: 'Desc.', x: 372, width: 58 },
    { label: 'Extras', x: 440, width: 58 },
    { label: 'Total', x: 508, width: 54 }
  ];

  let y = 126;
  for (const coordination of coordinations) {
    y = ensurePdfSpace(doc, y, 96, 'Reporte por coordinación', run);
    doc.roundedRect(pdfMargin, y, pdfRight - pdfMargin, 58, 8).fillAndStroke('#F8FAFC', '#DBE3EF');
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(11).text(coordination.coordinationName, 54, y + 10, { width: 300 });
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(moneyText(coordination.totalAmount), 408, y + 10, { width: 150, align: 'right' });
    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(8)
      .text(
        `${coordination.teachers} docentes / ${coordination.lines} líneas / Base ${hourText(coordination.baseHours)} / Extras ${hourText(coordination.totalExtraHours)} / Pendientes ${coordination.fiscalPending}`,
        54,
        y + 32,
        { width: 500 }
      );
    y += 72;
    y = drawPdfTableHeader(doc, columns, y);

    const rows = (linesByCoordination.get(coordination.coordinationId) || []).sort((left, right) =>
      left.teacherName.localeCompare(right.teacherName, 'es')
    );
    for (const line of rows) {
      y = ensurePdfSpace(doc, y, 30, 'Reporte por coordinación', run);
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(7.8).text(shortText(line.teacherName, 38), 48, y + 6, {
        width: 176
      });
      doc.fillColor('#64748B').font('Helvetica').fontSize(7).text(shortText(line.fiscalMissing.join(', ') || 'Listo', 38), 48, y + 17, {
        width: 176
      });
      doc.fillColor('#334155').font('Helvetica').fontSize(7.5).text(paymentTypeText(line.paymentType), 236, y + 8, { width: 58 });
      doc.text(hourText(line.baseHours), 304, y + 8, { width: 58 });
      doc.text(moneyText(line.absenceDiscountAmount + line.delayDiscountAmount), 372, y + 8, { width: 58, align: 'right' });
      doc.text(moneyText(line.totalExtraAmount), 440, y + 8, { width: 58, align: 'right' });
      doc.font('Helvetica-Bold').text(moneyText(line.totalAmount), 508, y + 8, { width: 54, align: 'right' });
      doc.moveTo(pdfMargin, y + 30).lineTo(pdfRight, y + 30).strokeColor('#E2E8F0').stroke();
      y += 30;
    }
    y += 22;
  }

  if (!coordinations.length) {
    doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(10).text('No hay coordinaciones visibles para esta corrida.', pdfMargin, y);
  }

  return pdfBufferFrom(doc);
}

function receiptFileName(run: FinanceRun): string {
  const safePeriod = run.periodLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `comprobantes-efectivo-${safePeriod || run.id}.pdf`;
}

function drawReceipt(doc: PDFKit.PDFDocument, run: FinanceRun, line: FinanceLine, y: number): void {
  const left = 42;
  const width = 528;
  const top = y + 28;
  const height = 326;

  doc.save();
  doc.roundedRect(left, top, width, height, 8).strokeColor('#CBD5E1').lineWidth(1).stroke();
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(14).text('COMPROBANTE DE PAGO DOCENTE', left + 18, top + 18);
  doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(8).text('NÓMINA DOCENTE', left + 18, top + 36);
  doc
    .fillColor('#0F766E')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('Pago en efectivo', left + width - 150, top + 20, { width: 130, align: 'right' });

  doc.moveTo(left + 18, top + 58).lineTo(left + width - 18, top + 58).strokeColor('#E2E8F0').stroke();

  const labelX = left + 18;
  const valueX = left + 150;
  let cursor = top + 78;
  const row = (label: string, value: string) => {
    doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(9).text(label, labelX, cursor, { width: 112 });
    doc.fillColor('#0F172A').font('Helvetica').fontSize(11).text(value || '-', valueX, cursor - 1, { width: 390 });
    cursor += 28;
  };

  row('Quincena', run.periodLabel);
  row('Docente', line.teacherName);
  row('Coordinación', line.coordinationName);
  row('Monto pagado', moneyText(line.totalAmount));
  row('Fecha de emision', new Date().toLocaleDateString('es-MX'));

  cursor += 14;
  doc.fillColor('#475569').font('Helvetica').fontSize(9).text(
    'Declaro haber recibido el importe indicado por concepto de pago docente correspondiente a la quincena señalada.',
    labelX,
    cursor,
    { width: width - 36, align: 'left' }
  );

  const signatureY = top + height - 54;
  doc.moveTo(left + 120, signatureY).lineTo(left + width - 120, signatureY).strokeColor('#0F172A').stroke();
  doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(9).text('Firma de conformidad', left, signatureY + 8, {
    width,
    align: 'center'
  });

  doc.restore();
}

function buildCashReceiptsPdf(run: FinanceRun, lines: FinanceLine[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    lines.forEach((line, index) => {
      if (index > 0 && index % 2 === 0) doc.addPage();
      const slot = index % 2;
      if (slot === 1) {
        doc.save();
        doc.dash(4, { space: 4 });
        doc.moveTo(36, 396).lineTo(576, 396).strokeColor('#CBD5E1').stroke();
        doc.undash();
        doc.restore();
      }
      drawReceipt(doc, run, line, slot === 0 ? 0 : 396);
    });

    doc.end();
  });
}

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/reports/finance/context',
    { preHandler: requireAnyPermission(['reports.view', 'finance.view']) },
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query as FinanceQuery);
      if (!parsed.success) {
        sendValidation(reply, parsed.error);
        return;
      }

      return buildFinanceContext(request.user!, parsed.data);
    }
  );

  app.patch(
    '/reports/finance/runs/:id/status',
    { preHandler: requireAnyPermission(['finance.view', 'payroll.finalize']) },
    async (request, reply) => {
      const parsedParams = runParamsSchema.safeParse(request.params as FinanceRunParams);
      const parsedBody = statusPayloadSchema.safeParse(request.body as FinanceRunStatusPayload);
      if (!parsedParams.success) {
        sendValidation(reply, parsedParams.error);
        return;
      }
      if (!parsedBody.success) {
        sendValidation(reply, parsedBody.error);
        return;
      }

      const actor = request.user!;
      if (!canManageFinanceWorkflow(actor)) {
        await reply.code(403).send({ error: 'FORBIDDEN', message: 'No tienes permiso para modificar el estado de nómina.' });
        return;
      }
      if (parsedBody.data.status === 'CANCELADA' && !canCancelPayrollForCorrection(actor)) {
        await reply.code(403).send({ error: 'FORBIDDEN', message: 'Solo Admin puede cancelar una nómina para corrección.' });
        return;
      }

      try {
        await withTransaction((client) => updateFinanceRunStatus(client, actor, parsedParams.data.id, parsedBody.data.status));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible actualizar el estado de nómina.';
        const statusCode = message.includes('No se encontró') ? 404 : 409;
        await reply.code(statusCode).send({ error: 'PAYROLL_STATUS_ERROR', message });
        return;
      }

      return {
        message: nextStatusMessage(parsedBody.data.status)
      };
    }
  );

  app.get(
    '/reports/finance/runs/:id/summary-pdf',
    { preHandler: requireAnyPermission(['reports.view', 'finance.view']) },
    async (request, reply) => {
      const parsedParams = runParamsSchema.safeParse(request.params as FinanceRunParams);
      if (!parsedParams.success) {
        sendValidation(reply, parsedParams.error);
        return;
      }

      const actor = request.user!;
      if (isGlobalFinanceReadOnly(actor)) {
        await reply.code(403).send({
          error: 'FORBIDDEN',
          message: 'Dirección/Subdirección solo puede descargar el PDF por coordinaciones.'
        });
        return;
      }

      const loaded = await withTransaction((client) => loadVisibleFinanceRun(client, actor, parsedParams.data.id));
      if (!loaded) {
        await reply.code(404).send({ error: 'NOT_FOUND', message: 'No se encontró la corrida de nómina.' });
        return;
      }

      const content = await buildFinanceSummaryPdf(loaded.run, loaded.lines, loaded.coordinationSummary);
      sendPdf(reply, financePdfFileName(loaded.run, 'resumen'), content);
    }
  );

  app.get(
    '/reports/finance/runs/:id/coordinations-pdf',
    { preHandler: requireAnyPermission(['reports.view', 'finance.view']) },
    async (request, reply) => {
      const parsedParams = runParamsSchema.safeParse(request.params as FinanceRunParams);
      if (!parsedParams.success) {
        sendValidation(reply, parsedParams.error);
        return;
      }

      const actor = request.user!;
      const loaded = await withTransaction((client) => loadVisibleFinanceRun(client, actor, parsedParams.data.id));
      if (!loaded) {
        await reply.code(404).send({ error: 'NOT_FOUND', message: 'No se encontró la corrida de nómina.' });
        return;
      }

      const content = await buildCoordinationReportPdf(loaded.run, loaded.lines, loaded.coordinationSummary);
      sendPdf(reply, financePdfFileName(loaded.run, 'coordinaciones'), content);
    }
  );

  app.get(
    '/reports/finance/runs/:id/cash-receipts',
    { preHandler: requireAnyPermission(['reports.view', 'finance.view']) },
    async (request, reply) => {
      const parsedParams = runParamsSchema.safeParse(request.params as FinanceRunParams);
      if (!parsedParams.success) {
        sendValidation(reply, parsedParams.error);
        return;
      }

      const actor = request.user!;
      if (isGlobalFinanceReadOnly(actor)) {
        await reply.code(403).send({
          error: 'FORBIDDEN',
          message: 'Dirección/Subdirección solo puede descargar el PDF por coordinaciones.'
        });
        return;
      }

      const result = await withTransaction(async (client) => {
        const runHeader = await loadReportRunHeader(client, parsedParams.data.id);
        if (!runHeader) return null;
        const actorCoordination = await loadActorCoordination(client, actor, false);
        const runs = await listFinanceRuns(client, runHeader.cycleId, actor, actorCoordination);
        const run = runs.find((item) => item.id === parsedParams.data.id) || null;
        if (!run) return null;
        const lines = await listFinanceLines(client, run.id, actor, actorCoordination);
        return {
          run,
          cashLines: lines.filter((line) => line.paymentType === 'E').sort((left, right) =>
            left.teacherName.localeCompare(right.teacherName, 'es')
          )
        };
      });

      if (!result?.run) {
        await reply.code(404).send({ error: 'NOT_FOUND', message: 'No se encontró la corrida de nómina.' });
        return;
      }

      if (!result.cashLines.length) {
        await reply.code(404).send({ error: 'NOT_FOUND', message: 'No hay docentes con pago en efectivo en esta nómina.' });
        return;
      }

      const pdf = await buildCashReceiptsPdf(result.run, result.cashLines);
      await reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${receiptFileName(result.run)}"`)
        .send(pdf);
    }
  );

  app.get(
    '/reports/finance/export/:kind',
    { preHandler: requireAnyPermission(['reports.view', 'finance.view']) },
    async (request, reply) => {
      const parsedParams = exportParamsSchema.safeParse(request.params as FinanceExportParams);
      const parsedQuery = querySchema.safeParse(request.query as FinanceQuery);
      if (!parsedParams.success) {
        sendValidation(reply, parsedParams.error);
        return;
      }
      if (!parsedQuery.success) {
        sendValidation(reply, parsedQuery.error);
        return;
      }

      const actor = request.user!;
      if (isGlobalFinanceReadOnly(actor)) {
        await reply.code(403).send({
          error: 'FORBIDDEN',
          message: 'Dirección/Subdirección solo puede descargar el PDF por coordinaciones.'
        });
        return;
      }

      const context = await buildFinanceContext(actor, parsedQuery.data);
      if (!context.selectedRun) {
        await reply.code(404).send({ error: 'NOT_FOUND', message: 'No hay una nómina guardada para exportar.' });
        return;
      }

      if (parsedParams.data.kind === 'coordinations') {
        sendCsv(
          reply,
          exportFileName(context.selectedRun, 'coordinaciones'),
          buildCsv(coordinationHeaders(), coordinationRows(context.coordinationSummary))
        );
        return;
      }

      const rows = parsedParams.data.kind === 'fiscal'
        ? context.lines.filter((line) => line.paymentStatus === 'PENDIENTE')
        : context.lines;
      sendCsv(
        reply,
        exportFileName(context.selectedRun, parsedParams.data.kind === 'fiscal' ? 'pendientes-fiscales' : 'pagos'),
        buildCsv(paymentHeaders(), paymentRows(rows))
      );
    }
  );
}
