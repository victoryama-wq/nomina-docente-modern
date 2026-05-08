import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../auth.js';
import { query } from '../db.js';

type AuditGroup = 'ALL' | 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYROLL' | 'ACCESS' | 'FISCAL';

interface AuditQuery {
  search?: string;
  entityType?: string;
  actionGroup?: AuditGroup;
  actorEmail?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

interface AuditRow {
  id: string;
  actorUserId: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  createdAt: string;
  recordLabel: string;
}

interface AuditSummaryRow {
  total: string;
  creates: string;
  updates: string;
  deletions: string;
  payrollEvents: string;
  actors: string;
}

interface AuditOptionRow {
  value: string;
  total: string;
}

const optionalDateFilterSchema = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default('');

const auditQuerySchema = z.object({
  search: z.string().trim().max(160).optional().default(''),
  entityType: z.string().trim().max(80).optional().default(''),
  actionGroup: z.enum(['ALL', 'CREATE', 'UPDATE', 'DELETE', 'PAYROLL', 'ACCESS', 'FISCAL']).optional().default('ALL'),
  actorEmail: z.string().trim().toLowerCase().max(160).optional().default(''),
  dateFrom: optionalDateFilterSchema,
  dateTo: optionalDateFilterSchema,
  limit: z.coerce.number().int().min(25).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).max(5000).optional().default(0)
});

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\r\n');
}

function sendCsv(reply: FastifyReply, fileName: string, csv: string): void {
  void reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`)
    .send(`\uFEFF${csv}`);
}

function actionFilterSql(actionGroup: AuditGroup): string {
  if (actionGroup === 'CREATE') return "a.action LIKE '%\\_CREATED' ESCAPE '\\'";
  if (actionGroup === 'UPDATE') {
    return "(a.action LIKE '%\\_UPDATED' ESCAPE '\\' OR a.action LIKE '%\\_UPLOADED' ESCAPE '\\')";
  }
  if (actionGroup === 'DELETE') return "a.action LIKE '%\\_DELETED' ESCAPE '\\'";
  if (actionGroup === 'PAYROLL') return "(a.entity_type = 'payroll_run' OR a.action LIKE 'PAYROLL\\_%' ESCAPE '\\')";
  if (actionGroup === 'ACCESS') return "a.entity_type = 'app_user'";
  if (actionGroup === 'FISCAL') {
    return "(a.action IN ('TEACHER_FISCAL_UPDATED', 'TEACHER_CONSTANCIA_UPLOADED') OR a.action LIKE '%CONSTANCIA%')";
  }
  return '';
}

function buildWhere(filters: Required<AuditQuery>, params: unknown[]): string {
  const conditions: string[] = [];

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    const index = params.length;
    conditions.push(`
      (
        lower(a.actor_email) LIKE $${index}
        OR lower(a.action) LIKE $${index}
        OR lower(a.entity_type) LIKE $${index}
        OR lower(COALESCE(a.entity_id::text, '')) LIKE $${index}
        OR lower(COALESCE(a.after_data->>'fullName', a.before_data->>'fullName', '')) LIKE $${index}
        OR lower(COALESCE(a.after_data->>'teacherName', a.before_data->>'teacherName', '')) LIKE $${index}
        OR lower(COALESCE(a.after_data->>'displayName', a.before_data->>'displayName', '')) LIKE $${index}
        OR lower(COALESCE(a.after_data->>'periodLabel', a.before_data->>'periodLabel', '')) LIKE $${index}
      )
    `);
  }

  if (filters.entityType) {
    params.push(filters.entityType);
    conditions.push(`a.entity_type = $${params.length}`);
  }

  if (filters.actorEmail) {
    params.push(filters.actorEmail);
    conditions.push(`lower(a.actor_email) = $${params.length}`);
  }

  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    conditions.push(`a.created_at >= $${params.length}::date`);
  }

  if (filters.dateTo) {
    params.push(filters.dateTo);
    conditions.push(`a.created_at < ($${params.length}::date + interval '1 day')`);
  }

  const actionCondition = actionFilterSql(filters.actionGroup);
  if (actionCondition) conditions.push(actionCondition);

  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}

function auditSelectSql(whereSql: string, includePagination: boolean): string {
  return `
    SELECT
      a.id,
      a.actor_user_id AS "actorUserId",
      a.actor_email AS "actorEmail",
      a.action,
      a.entity_type AS "entityType",
      a.entity_id::text AS "entityId",
      a.before_data AS "beforeData",
      a.after_data AS "afterData",
      a.metadata,
      a.created_at AS "createdAt",
      COALESCE(
        a.after_data->>'fullName',
        a.before_data->>'fullName',
        a.after_data->>'teacherName',
        a.before_data->>'teacherName',
        a.after_data->>'displayName',
        a.before_data->>'displayName',
        a.after_data->>'periodLabel',
        a.before_data->>'periodLabel',
        a.after_data->>'subjectName',
        a.before_data->>'subjectName',
        a.entity_id::text,
        ''
      ) AS "recordLabel"
    FROM audit_log a
    ${whereSql}
    ORDER BY a.created_at DESC
    ${includePagination ? 'LIMIT $LIMIT OFFSET $OFFSET' : ''}
  `;
}

async function fetchAuditRows(filters: Required<AuditQuery>): Promise<AuditRow[]> {
  const params: unknown[] = [];
  const whereSql = buildWhere(filters, params);
  params.push(filters.limit, filters.offset);
  const sql = auditSelectSql(whereSql, true)
    .replace('$LIMIT', `$${params.length - 1}`)
    .replace('$OFFSET', `$${params.length}`);
  return query<AuditRow>(sql, params);
}

async function fetchAuditExportRows(filters: Required<AuditQuery>): Promise<AuditRow[]> {
  const params: unknown[] = [];
  const whereSql = buildWhere(filters, params);
  const sql = auditSelectSql(whereSql, false);
  return query<AuditRow>(`${sql} LIMIT 5000`, params);
}

async function fetchAuditSummary(filters: Required<AuditQuery>) {
  const params: unknown[] = [];
  const whereSql = buildWhere(filters, params);
  const rows = await query<AuditSummaryRow>(
    `
      SELECT
        count(*)::text AS total,
        count(*) FILTER (WHERE a.action LIKE '%\\_CREATED' ESCAPE '\\')::text AS creates,
        count(*) FILTER (
          WHERE a.action LIKE '%\\_UPDATED' ESCAPE '\\'
             OR a.action LIKE '%\\_UPLOADED' ESCAPE '\\'
        )::text AS updates,
        count(*) FILTER (WHERE a.action LIKE '%\\_DELETED' ESCAPE '\\')::text AS deletions,
        count(*) FILTER (
          WHERE a.entity_type = 'payroll_run'
             OR a.action LIKE 'PAYROLL\\_%' ESCAPE '\\'
        )::text AS "payrollEvents",
        count(DISTINCT NULLIF(a.actor_email, ''))::text AS actors
      FROM audit_log a
      ${whereSql}
    `,
    params
  );

  const row = rows[0];
  return {
    total: Number(row?.total || 0),
    creates: Number(row?.creates || 0),
    updates: Number(row?.updates || 0),
    deletions: Number(row?.deletions || 0),
    payrollEvents: Number(row?.payrollEvents || 0),
    actors: Number(row?.actors || 0)
  };
}

async function fetchAuditOptions() {
  const [entityTypes, actions, actors] = await Promise.all([
    query<AuditOptionRow>(`
      SELECT entity_type AS value, count(*)::text AS total
      FROM audit_log
      GROUP BY entity_type
      ORDER BY entity_type
    `),
    query<AuditOptionRow>(`
      SELECT action AS value, count(*)::text AS total
      FROM audit_log
      GROUP BY action
      ORDER BY action
    `),
    query<AuditOptionRow>(`
      SELECT actor_email AS value, count(*)::text AS total
      FROM audit_log
      WHERE actor_email <> ''
      GROUP BY actor_email
      ORDER BY actor_email
    `)
  ]);

  return {
    entityTypes: entityTypes.map((row) => ({ value: row.value, total: Number(row.total || 0) })),
    actions: actions.map((row) => ({ value: row.value, total: Number(row.total || 0) })),
    actors: actors.map((row) => ({ value: row.value, total: Number(row.total || 0) }))
  };
}

function normalizeQuery(input: z.infer<typeof auditQuerySchema>): Required<AuditQuery> {
  return {
    search: input.search,
    entityType: input.entityType,
    actionGroup: input.actionGroup,
    actorEmail: input.actorEmail,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    limit: input.limit,
    offset: input.offset
  };
}

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  app.get('/audit/logs', { preHandler: requirePermission('audit.view') }, async (request, reply) => {
    const parsed = auditQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      await reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Filtros de auditoria invalidos.'
      });
      return;
    }

    const filters = normalizeQuery(parsed.data);
    const [logs, summary, options] = await Promise.all([
      fetchAuditRows(filters),
      fetchAuditSummary(filters),
      fetchAuditOptions()
    ]);

    return {
      logs,
      summary,
      options,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        returned: logs.length
      }
    };
  });

  app.get('/audit/export', { preHandler: requirePermission('audit.view') }, async (request, reply) => {
    const parsed = auditQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      await reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Filtros de auditoria invalidos.'
      });
      return;
    }

    const filters = normalizeQuery(parsed.data);
    const logs = await fetchAuditExportRows(filters);
    const csv = buildCsv(
      [
        'Fecha',
        'Usuario',
        'Accion',
        'Modulo',
        'Registro',
        'ID entidad',
        'Antes',
        'Despues',
        'Metadatos'
      ],
      logs.map((log) => [
        log.createdAt,
        log.actorEmail,
        log.action,
        log.entityType,
        log.recordLabel,
        log.entityId || '',
        log.beforeData || '',
        log.afterData || '',
        log.metadata || ''
      ])
    );

    sendCsv(reply, 'auditoria-bitacora.csv', csv);
  });
}
