import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requireAnyPermission } from '../auth.js';
import { withTransaction } from '../db.js';
import type { SessionUser } from '../types.js';
import { listCycles, loadActorCoordination, type CoordinationRow, type CycleRow } from './academic-context.js';

type PayrollRunStatus = 'BORRADOR' | 'CALCULADA' | 'APROBADA' | 'CERRADA' | 'CANCELADA';
type PaymentStatus = 'LISTO' | 'PENDIENTE';
type FinanceExportKind = 'payments' | 'fiscal' | 'coordinations';

interface FinanceQuery {
  cycleId?: string;
  runId?: string;
}

interface FinanceExportParams {
  kind: FinanceExportKind;
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
  createdAt: string;
}

interface FinanceLineRow {
  id: string;
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

const querySchema = z.object({
  cycleId: z.string().uuid().optional(),
  runId: z.string().uuid().optional()
});

const exportParamsSchema = z.object({
  kind: z.enum(['payments', 'fiscal', 'coordinations'])
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
    message: error.issues[0]?.message || 'Datos invalidos.'
  });
}

function isSystemAdmin(actor: SessionUser): boolean {
  return actor.role === 'admin' || actor.isProtectedSuperAdmin;
}

function canViewAllFinance(actor: SessionUser): boolean {
  return isSystemAdmin(actor) || actor.permissions.includes('finance.view');
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
    params.push(actorCoordination?.id || null);
    visibility = actorCoordination ? 'AND pl.coordination_id = $2' : 'AND false';
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
        COALESCE(u.email, '') AS "calculatedByEmail",
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
      LEFT JOIN app_users u ON u.id = pr.calculated_by
      LEFT JOIN payroll_lines pl ON pl.payroll_run_id = pr.id ${visibility}
      WHERE pr.cycle_id = $1
      GROUP BY pr.id, ac.period_label, ac.quarter_code, u.email
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
    params.push(actorCoordination?.id || null);
    visibility = actorCoordination ? 'AND pl.coordination_id = $2' : 'AND false';
  }

  const result = await client.query<FinanceLineRow>(
    `
      SELECT
        pl.id,
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
      coordinationSummary: []
    };
  }

  return withTransaction(async (client) => {
    const runs = await listFinanceRuns(client, selectedCycle.id, actor, actorCoordination);
    const selectedRun = runs.find((run) => run.id === query.runId) || runs[0] || null;
    const lines = selectedRun ? await listFinanceLines(client, selectedRun.id, actor, actorCoordination) : [];
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
      coordinationSummary: summarizeCoordinations(lines)
    };
  });
}

function paymentHeaders(): string[] {
  return [
    'Docente',
    'Coordinacion',
    'RFC',
    'Correo',
    'Datos bancarios',
    'Tipo pago',
    'Categoria',
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
  return ['Coordinacion', 'Docentes', 'Lineas', 'Horas base', 'Extras h', 'Descuentos', 'Total', 'Pendientes fiscales', 'Alertas'];
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

      const context = await buildFinanceContext(request.user!, parsedQuery.data);
      if (!context.selectedRun) {
        await reply.code(404).send({ error: 'NOT_FOUND', message: 'No hay una nomina guardada para exportar.' });
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
