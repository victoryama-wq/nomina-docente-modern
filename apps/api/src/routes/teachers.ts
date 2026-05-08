import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requireAnyPermission, requirePermission } from '../auth.js';
import { config } from '../config.js';
import { query, withTransaction } from '../db.js';
import { firebaseAdmin } from '../firebase.js';
import type { SessionUser } from '../types.js';

type TeacherStatus = 'ACTIVO' | 'INACTIVO';

interface TeacherRow {
  id: string;
  legacyRowNumber: number | null;
  legacyTeacherId: string;
  fullName: string;
  normalizedName: string;
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  degree: string;
  paymentType: string;
  category: string;
  location: string;
  comment: string;
  observation: string;
  coordinationId: string | null;
  coordinationName: string;
  phone: string;
  email: string;
  rfc: string;
  externalIdentifier: string;
  bankDetail: string;
  status: TeacherStatus;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string;
  updatedByEmail: string;
  documentId: string | null;
  documentName: string;
  documentMimeType: string;
  documentUploadedAt: string | null;
}

interface CurrentDocumentRow {
  id: string;
  teacherId: string;
  storageBucket: string;
  storageObject: string;
  originalFileName: string;
  mimeType: string;
}

interface TeacherDependencyRow {
  schedules: string;
  extras: string;
  payrollLines: string;
}

interface TeacherHistoryExportRow {
  id: string;
  legacyRowNumber: number | null;
  legacyTeacherId: string;
  fullName: string;
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  degree: string;
  paymentType: string;
  category: string;
  location: string;
  comment: string;
  observation: string;
  coordinationName: string;
  phone: string;
  email: string;
  rfc: string;
  externalIdentifier: string;
  bankDetail: string;
  status: TeacherStatus | '';
  documentName: string;
  createdAt: string | null;
  updatedAt: string | null;
  auditAction: string;
  auditActorEmail: string;
  auditCreatedAt: string | null;
  auditBeforeData: string;
  auditAfterData: string;
}

const teacherBodySchema = z.object({
  legacyRowNumber: z.coerce.number().int().positive().optional(),
  legacyTeacherId: z.string().trim().max(120).optional().default(''),
  firstNames: z.string().trim().min(1).max(120),
  paternalLastName: z.string().trim().min(1).max(80),
  maternalLastName: z.string().trim().max(80).optional().default(''),
  degree: z.string().trim().max(60).optional().default(''),
  paymentType: z.enum(['E', '1', '2']),
  category: z.enum(['V', 'M', 'N']),
  location: z.string().trim().max(40).optional().default('Local'),
  comment: z.string().trim().max(120).optional().default(''),
  observation: z.string().trim().max(250).optional().default(''),
  coordinationName: z.string().trim().max(120).optional().default(''),
  phone: z.string().trim().max(20).optional().default(''),
  email: z.string().trim().toLowerCase().max(160).optional().default(''),
  rfc: z.string().trim().toUpperCase().max(20).optional().default(''),
  externalIdentifier: z.string().trim().toUpperCase().max(60).optional().default(''),
  bankDetail: z.string().trim().max(140).optional().default(''),
  status: z.enum(['ACTIVO', 'INACTIVO']).default('ACTIVO')
});

const teacherFiscalBodySchema = z.object({
  paymentType: z.enum(['E', '1', '2']),
  email: z.string().trim().toLowerCase().max(160).optional().default(''),
  rfc: z.string().trim().toUpperCase().max(20).optional().default(''),
  bankDetail: z.string().trim().max(140).optional().default('')
});

const documentBodySchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  base64Data: z.string().trim().min(1)
});

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

function buildFullName(body: z.infer<typeof teacherBodySchema>): string {
  return [body.firstNames, body.paternalLastName, body.maternalLastName]
    .map(normalizeUpper)
    .filter(Boolean)
    .join(' ');
}

function validateTeacherBusinessRules(body: z.infer<typeof teacherBodySchema>): string | null {
  const phone = body.phone.replace(/[^0-9+]/g, '');
  if (phone && !/^\+?[0-9]{10,15}$/.test(phone)) return 'El teléfono debe contener entre 10 y 15 dígitos.';
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return 'El correo electrónico no tiene un formato válido.';
  if (body.rfc && !/^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(body.rfc)) return 'El RFC no tiene un formato válido.';
  return null;
}

function validateTeacherFiscalRules(body: z.infer<typeof teacherFiscalBodySchema>): string | null {
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return 'El correo electrónico no tiene un formato válido.';
  if (body.rfc && !/^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(body.rfc)) return 'El RFC no tiene un formato válido.';
  return null;
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

function buildSummary(teachers: TeacherRow[]) {
  return {
    total: teachers.length,
    active: teachers.filter((teacher) => teacher.status === 'ACTIVO').length,
    inactive: teachers.filter((teacher) => teacher.status === 'INACTIVO').length,
    withRfc: teachers.filter((teacher) => !!teacher.rfc).length,
    withBank: teachers.filter((teacher) => !!teacher.bankDetail).length,
    withConstancia: teachers.filter((teacher) => !!teacher.documentId).length,
    fiscalReady: teachers.filter(
      (teacher) => !!teacher.rfc && !!teacher.bankDetail && !!teacher.email && !!teacher.documentId
    ).length
  };
}

function csvValue(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvValue).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvValue).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function sendCsv(reply: FastifyReply, fileName: string, content: string): void {
  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${fileName}"`)
    .send(content);
}

function teacherExportRow(teacher: TeacherRow): unknown[] {
  return [
    teacher.legacyRowNumber,
    teacher.legacyTeacherId,
    teacher.fullName,
    teacher.firstNames,
    teacher.paternalLastName,
    teacher.maternalLastName,
    teacher.degree,
    teacher.paymentType,
    teacher.category,
    teacher.location,
    teacher.comment,
    teacher.observation,
    teacher.coordinationName,
    teacher.phone,
    teacher.email,
    teacher.rfc,
    teacher.externalIdentifier,
    teacher.bankDetail,
    teacher.status,
    teacher.documentName,
    teacher.createdAt,
    teacher.updatedAt,
    teacher.createdByEmail,
    teacher.updatedByEmail
  ];
}

const teacherExportHeaders = [
  'Fila legacy',
  'ID docente legacy',
  'Docente',
  'Nombres',
  'Apellido paterno',
  'Apellido materno',
  'Grado',
  'Tipo de pago',
  'Categoría',
  'Ubicacion',
  'Comentario',
  'Observacion',
  'Coordinación',
  'Telefono',
  'Correo',
  'RFC',
  'Identificador',
  'Banco detalle',
  'Estatus',
  'Constancia',
  'Fecha creacion',
  'Fecha actualizacion',
  'Creado por',
  'Actualizado por'
];

async function getOrCreateCoordination(client: PoolClient, coordinationName: string): Promise<string | null> {
  const name = normalizeText(coordinationName);
  if (!name) return null;

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

async function auditTeacher(
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
      VALUES ($1, $2, $3, 'teacher', $4, $5::jsonb, $6::jsonb)
    `,
    [actor.id, actor.email, action, entityId, JSON.stringify(beforeData || null), JSON.stringify(afterData || null)]
  );
}

function teacherSelectSql(whereClause = ''): string {
  return `
    SELECT
      t.id,
      t.legacy_row_number AS "legacyRowNumber",
      COALESCE(t.legacy_teacher_id, '') AS "legacyTeacherId",
      t.full_name AS "fullName",
      t.normalized_name AS "normalizedName",
      t.first_names AS "firstNames",
      t.paternal_last_name AS "paternalLastName",
      t.maternal_last_name AS "maternalLastName",
      t.degree,
      t.payment_type AS "paymentType",
      t.category,
      t.location,
      t.comment,
      t.observation,
      t.coordination_id AS "coordinationId",
      COALESCE(c.name, '') AS "coordinationName",
      t.phone,
      t.email,
      t.rfc,
      t.external_identifier AS "externalIdentifier",
      t.bank_detail AS "bankDetail",
      t.status,
      t.created_at AS "createdAt",
      t.updated_at AS "updatedAt",
      COALESCE(created.email, '') AS "createdByEmail",
      COALESCE(updated.email, '') AS "updatedByEmail",
      d.id AS "documentId",
      COALESCE(d.original_file_name, '') AS "documentName",
      COALESCE(d.mime_type, '') AS "documentMimeType",
      d.uploaded_at AS "documentUploadedAt"
    FROM teachers t
    LEFT JOIN coordinations c ON c.id = t.coordination_id
    LEFT JOIN app_users created ON created.id = t.created_by
    LEFT JOIN app_users updated ON updated.id = t.updated_by
    LEFT JOIN teacher_documents d
      ON d.teacher_id = t.id
      AND d.document_type = 'CONSTANCIA_FISCAL'
      AND d.is_current = true
    ${whereClause}
  `;
}

async function loadTeacherById(client: PoolClient, id: string): Promise<TeacherRow | null> {
  const result = await client.query<TeacherRow>(`${teacherSelectSql('WHERE t.id = $1')} LIMIT 1`, [id]);
  return result.rows[0] || null;
}

export async function registerTeacherRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/teachers',
    { preHandler: requireAnyPermission(['teachers.manage', 'finance.view', 'reports.view']) },
    async (request) => {
      const parsed = z
        .object({
          q: z.string().trim().optional(),
          status: z.enum(['ACTIVO', 'INACTIVO', 'TODOS']).optional().default('TODOS')
        })
        .safeParse(request.query);

      const filters = parsed.success ? parsed.data : { status: 'TODOS' as const };
      const params: unknown[] = [];
      const where: string[] = [];

      if (filters.status !== 'TODOS') {
        params.push(filters.status);
        where.push(`t.status = $${params.length}`);
      }

      if (filters.q) {
        params.push(`%${filters.q.toLowerCase()}%`);
        where.push(
          `(lower(t.full_name) LIKE $${params.length} OR lower(t.rfc) LIKE $${params.length} OR lower(t.email) LIKE $${params.length} OR lower(t.external_identifier) LIKE $${params.length} OR lower(COALESCE(c.name, '')) LIKE $${params.length})`
        );
      }

      const teachers = await query<TeacherRow>(
        `${teacherSelectSql(where.length ? `WHERE ${where.join(' AND ')}` : '')} ORDER BY t.full_name ASC`,
        params
      );
      const coordinations = await query<{ id: string; name: string }>(
        "SELECT id, name FROM coordinations WHERE status = 'ACTIVO' ORDER BY name ASC"
      );

      return { teachers, summary: buildSummary(teachers), coordinations };
    }
  );

  app.get(
    '/teachers/export/active',
    { preHandler: requireAnyPermission(['teachers.manage', 'finance.view', 'reports.view']) },
    async (_request, reply) => {
      const teachers = await query<TeacherRow>(
        `${teacherSelectSql("WHERE t.status = 'ACTIVO'")} ORDER BY t.full_name ASC`
      );
      sendCsv(reply, 'docentes-activos.csv', buildCsv(teacherExportHeaders, teachers.map(teacherExportRow)));
    }
  );

  app.get('/teachers/export/history', { preHandler: requirePermission('audit.view') }, async (_request, reply) => {
    const rows = await query<TeacherHistoryExportRow>(
      `
        SELECT
          COALESCE(t.id::text, a.entity_id::text, '') AS id,
          t.legacy_row_number AS "legacyRowNumber",
          COALESCE(t.legacy_teacher_id, a.before_data ->> 'legacyTeacherId', a.after_data ->> 'legacyTeacherId', '') AS "legacyTeacherId",
          COALESCE(t.full_name, a.before_data ->> 'fullName', a.after_data ->> 'fullName', '') AS "fullName",
          COALESCE(t.first_names, a.before_data ->> 'firstNames', a.after_data ->> 'firstNames', '') AS "firstNames",
          COALESCE(t.paternal_last_name, a.before_data ->> 'paternalLastName', a.after_data ->> 'paternalLastName', '') AS "paternalLastName",
          COALESCE(t.maternal_last_name, a.before_data ->> 'maternalLastName', a.after_data ->> 'maternalLastName', '') AS "maternalLastName",
          COALESCE(t.degree, a.before_data ->> 'degree', a.after_data ->> 'degree', '') AS degree,
          COALESCE(t.payment_type, a.before_data ->> 'paymentType', a.after_data ->> 'paymentType', '') AS "paymentType",
          COALESCE(t.category, a.before_data ->> 'category', a.after_data ->> 'category', '') AS category,
          COALESCE(t.location, a.before_data ->> 'location', a.after_data ->> 'location', '') AS location,
          COALESCE(t.comment, a.before_data ->> 'comment', a.after_data ->> 'comment', '') AS comment,
          COALESCE(t.observation, a.before_data ->> 'observation', a.after_data ->> 'observation', '') AS observation,
          COALESCE(c.name, a.before_data ->> 'coordinationName', a.after_data ->> 'coordinationName', '') AS "coordinationName",
          COALESCE(t.phone, a.before_data ->> 'phone', a.after_data ->> 'phone', '') AS phone,
          COALESCE(t.email, a.before_data ->> 'email', a.after_data ->> 'email', '') AS email,
          COALESCE(t.rfc, a.before_data ->> 'rfc', a.after_data ->> 'rfc', '') AS rfc,
          COALESCE(t.external_identifier, a.before_data ->> 'externalIdentifier', a.after_data ->> 'externalIdentifier', '') AS "externalIdentifier",
          COALESCE(t.bank_detail, a.before_data ->> 'bankDetail', a.after_data ->> 'bankDetail', '') AS "bankDetail",
          COALESCE(t.status::text, a.before_data ->> 'status', a.after_data ->> 'status', '') AS status,
          COALESCE(d.original_file_name, a.before_data ->> 'documentName', a.after_data ->> 'documentName', '') AS "documentName",
          t.created_at AS "createdAt",
          t.updated_at AS "updatedAt",
          COALESCE(a.action, '') AS "auditAction",
          COALESCE(a.actor_email, '') AS "auditActorEmail",
          a.created_at AS "auditCreatedAt",
          COALESCE(a.before_data::text, '') AS "auditBeforeData",
          COALESCE(a.after_data::text, '') AS "auditAfterData"
        FROM teachers t
        FULL JOIN audit_log a
          ON a.entity_type = 'teacher'
          AND a.entity_id = t.id
        LEFT JOIN coordinations c ON c.id = t.coordination_id
        LEFT JOIN teacher_documents d
          ON d.teacher_id = t.id
          AND d.document_type = 'CONSTANCIA_FISCAL'
          AND d.is_current = true
        WHERE t.id IS NOT NULL OR a.entity_type = 'teacher'
        ORDER BY COALESCE(t.full_name, a.before_data ->> 'fullName', a.after_data ->> 'fullName', ''), a.created_at NULLS FIRST
      `
    );

    const headers = [
      ...teacherExportHeaders.slice(0, 22),
      'Acción historial',
      'Usuario historial',
      'Fecha historial',
      'Datos antes',
      'Datos despues'
    ];
    const csvRows = rows.map((row) => [
      row.legacyRowNumber,
      row.legacyTeacherId,
      row.fullName,
      row.firstNames,
      row.paternalLastName,
      row.maternalLastName,
      row.degree,
      row.paymentType,
      row.category,
      row.location,
      row.comment,
      row.observation,
      row.coordinationName,
      row.phone,
      row.email,
      row.rfc,
      row.externalIdentifier,
      row.bankDetail,
      row.status,
      row.documentName,
      row.createdAt,
      row.updatedAt,
      row.auditAction,
      row.auditActorEmail,
      row.auditCreatedAt,
      row.auditBeforeData,
      row.auditAfterData
    ]);

    sendCsv(reply, 'docentes-completo-historial.csv', buildCsv(headers, csvRows));
  });

  app.post('/teachers', { preHandler: requirePermission('teachers.manage') }, async (request, reply) => {
    const parsed = teacherBodySchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const businessError = validateTeacherBusinessRules(parsed.data);
    if (businessError) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: businessError });
      return;
    }

    const actor = request.user!;
    const teacher = await withTransaction(async (client) => {
      const coordinationId = await getOrCreateCoordination(client, parsed.data.coordinationName);
      const fullName = buildFullName(parsed.data);
      const normalizedName = normalizeComparable(fullName);

      const created = await client.query<{ id: string }>(
        `
          INSERT INTO teachers (
            legacy_row_number,
            legacy_teacher_id,
            full_name,
            normalized_name,
            first_names,
            paternal_last_name,
            maternal_last_name,
            degree,
            payment_type,
            category,
            location,
            comment,
            observation,
            coordination_id,
            phone,
            email,
            rfc,
            external_identifier,
            bank_detail,
            status,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $21)
          RETURNING id
        `,
        [
          parsed.data.legacyRowNumber || null,
          parsed.data.legacyTeacherId,
          fullName,
          normalizedName,
          normalizeUpper(parsed.data.firstNames),
          normalizeUpper(parsed.data.paternalLastName),
          normalizeUpper(parsed.data.maternalLastName),
          parsed.data.degree,
          parsed.data.paymentType,
          parsed.data.category,
          parsed.data.location || 'Local',
          parsed.data.comment,
          parsed.data.observation,
          coordinationId,
          parsed.data.phone.replace(/[^0-9+]/g, ''),
          parsed.data.email,
          parsed.data.rfc,
          parsed.data.externalIdentifier,
          parsed.data.bankDetail,
          parsed.data.status,
          actor.id
        ]
      );

      const after = await loadTeacherById(client, created.rows[0].id);
      await auditTeacher(client, actor, 'TEACHER_CREATED', created.rows[0].id, null, after);
      return after;
    });

    await reply.code(201).send({ teacher, message: 'Docente registrado correctamente.' });
  });

  app.patch('/teachers/:id', { preHandler: requirePermission('teachers.manage') }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const parsed = teacherBodySchema.safeParse(request.body);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Docente inválido.' });
      return;
    }
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const businessError = validateTeacherBusinessRules(parsed.data);
    if (businessError) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: businessError });
      return;
    }

    const actor = request.user!;
    const teacher = await withTransaction(async (client) => {
      const before = await loadTeacherById(client, params.data.id);
      if (!before) throw new Error('No se encontró el docente.');

      const coordinationId = await getOrCreateCoordination(client, parsed.data.coordinationName);
      const fullName = buildFullName(parsed.data);
      const normalizedName = normalizeComparable(fullName);

      await client.query(
        `
          UPDATE teachers
          SET
            legacy_row_number = $1,
            legacy_teacher_id = $2,
            full_name = $3,
            normalized_name = $4,
            first_names = $5,
            paternal_last_name = $6,
            maternal_last_name = $7,
            degree = $8,
            payment_type = $9,
            category = $10,
            location = $11,
            comment = $12,
            observation = $13,
            coordination_id = $14,
            phone = $15,
            email = $16,
            rfc = $17,
            external_identifier = $18,
            bank_detail = $19,
            status = $20,
            updated_by = $21,
            updated_at = now()
          WHERE id = $22
        `,
        [
          parsed.data.legacyRowNumber || before.legacyRowNumber,
          parsed.data.legacyTeacherId,
          fullName,
          normalizedName,
          normalizeUpper(parsed.data.firstNames),
          normalizeUpper(parsed.data.paternalLastName),
          normalizeUpper(parsed.data.maternalLastName),
          parsed.data.degree,
          parsed.data.paymentType,
          parsed.data.category,
          parsed.data.location || 'Local',
          parsed.data.comment,
          parsed.data.observation,
          coordinationId,
          parsed.data.phone.replace(/[^0-9+]/g, ''),
          parsed.data.email,
          parsed.data.rfc,
          parsed.data.externalIdentifier,
          parsed.data.bankDetail,
          parsed.data.status,
          actor.id,
          before.id
        ]
      );

      const after = await loadTeacherById(client, before.id);
      await auditTeacher(client, actor, 'TEACHER_UPDATED', before.id, before, after);
      return after;
    });

    return { teacher, message: 'Docente actualizado correctamente.' };
  });

  app.patch(
    '/teachers/:id/fiscal',
    { preHandler: requireAnyPermission(['teachers.manage', 'finance.view']) },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      const parsed = teacherFiscalBodySchema.safeParse(request.body);
      if (!params.success) {
        await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Docente inválido.' });
        return;
      }
      if (!parsed.success) {
        sendValidation(reply, parsed.error);
        return;
      }

      const businessError = validateTeacherFiscalRules(parsed.data);
      if (businessError) {
        await reply.code(400).send({ error: 'VALIDATION_ERROR', message: businessError });
        return;
      }

      const actor = request.user!;
      const teacher = await withTransaction(async (client) => {
        const before = await loadTeacherById(client, params.data.id);
        if (!before) throw new Error('No se encontró el docente.');

        await client.query(
          `
            UPDATE teachers
            SET
              payment_type = $1,
              email = $2,
              rfc = $3,
              bank_detail = $4,
              updated_by = $5,
              updated_at = now()
            WHERE id = $6
          `,
          [
            parsed.data.paymentType,
            parsed.data.email,
            parsed.data.rfc,
            parsed.data.bankDetail,
            actor.id,
            before.id
          ]
        );

        const after = await loadTeacherById(client, before.id);
        await auditTeacher(client, actor, 'TEACHER_FISCAL_UPDATED', before.id, before, after);
        return after;
      });

      return { teacher, message: 'Datos fiscales actualizados correctamente.' };
    }
  );

  app.delete('/teachers/:id', { preHandler: requirePermission('teachers.manage') }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Docente inválido.' });
      return;
    }

    const actor = request.user!;
    if (!isSystemAdmin(actor)) {
      await reply.code(403).send({ error: 'FORBIDDEN', message: 'Solo un administrador puede eliminar docentes.' });
      return;
    }

    const deletedDocuments = await withTransaction(async (client) => {
      const before = await loadTeacherById(client, params.data.id);
      if (!before) throw new Error('No se encontró el docente.');

      const dependencies = await client.query<TeacherDependencyRow>(
        `
          SELECT
            (SELECT count(*)::text FROM schedules WHERE teacher_id = $1) AS schedules,
            (SELECT count(*)::text FROM extra_hours WHERE teacher_id = $1) AS extras,
            (SELECT count(*)::text FROM payroll_lines WHERE teacher_id = $1) AS "payrollLines"
        `,
        [before.id]
      );
      const dependencyRow = dependencies.rows[0];
      const totalDependencies =
        Number(dependencyRow?.schedules || 0) +
        Number(dependencyRow?.extras || 0) +
        Number(dependencyRow?.payrollLines || 0);

      if (totalDependencies > 0) {
        throw new Error('Este docente ya tiene registros operativos. Inactivalo para conservar el historial.');
      }

      const documents = await client.query<CurrentDocumentRow>(
        `
          SELECT
            id,
            teacher_id AS "teacherId",
            storage_bucket AS "storageBucket",
            storage_object AS "storageObject",
            original_file_name AS "originalFileName",
            mime_type AS "mimeType"
          FROM teacher_documents
          WHERE teacher_id = $1
        `,
        [before.id]
      );

      await auditTeacher(client, actor, 'TEACHER_DELETED', before.id, before, null);
      await client.query('DELETE FROM teachers WHERE id = $1', [before.id]);
      return documents.rows;
    });

    for (const document of deletedDocuments) {
      try {
        await firebaseAdmin.storage().bucket(document.storageBucket).file(document.storageObject).delete({ ignoreNotFound: true });
      } catch (error) {
        request.log.warn({ error, documentId: document.id }, 'Could not delete teacher document object');
      }
    }

    return { message: 'Docente eliminado correctamente.' };
  });

  app.post(
    '/teachers/:id/documents/constancia',
    { preHandler: requireAnyPermission(['teachers.manage', 'finance.view']) },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      const parsed = documentBodySchema.safeParse(request.body);
      if (!params.success) {
        await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Docente inválido.' });
        return;
      }
      if (!parsed.success) {
        sendValidation(reply, parsed.error);
        return;
      }

      const buffer = Buffer.from(parsed.data.base64Data, 'base64');
      if (buffer.length > 7.5 * 1024 * 1024) {
        await reply.code(400).send({ error: 'FILE_TOO_LARGE', message: 'La constancia excede 7.5 MB.' });
        return;
      }

      const actor = request.user!;
      const uploaded = await withTransaction(async (client) => {
        const teacher = await loadTeacherById(client, params.data.id);
        if (!teacher) throw new Error('No se encontró el docente.');

        const safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]+/g, '-');
        const storageObject = `constancias/${teacher.id}/${Date.now()}-${safeName}`;
        const bucket = firebaseAdmin.storage().bucket(config.CONSTANCIAS_BUCKET);
        const file = bucket.file(storageObject);
        await file.save(buffer, {
          metadata: {
            contentType: parsed.data.mimeType,
            metadata: {
              teacherId: teacher.id,
              uploadedBy: actor.email
            }
          }
        });

        await client.query(
          `
            UPDATE teacher_documents
            SET is_current = false
            WHERE teacher_id = $1
              AND document_type = 'CONSTANCIA_FISCAL'
              AND is_current = true
          `,
          [teacher.id]
        );

        const doc = await client.query<{ id: string }>(
          `
            INSERT INTO teacher_documents (
              teacher_id,
              document_type,
              storage_bucket,
              storage_object,
              original_file_name,
              mime_type,
              uploaded_by,
              is_current
            )
            VALUES ($1, 'CONSTANCIA_FISCAL', $2, $3, $4, $5, $6, true)
            RETURNING id
          `,
          [teacher.id, config.CONSTANCIAS_BUCKET, storageObject, parsed.data.fileName, parsed.data.mimeType, actor.id]
        );

        const after = await loadTeacherById(client, teacher.id);
        await auditTeacher(client, actor, 'TEACHER_CONSTANCIA_UPLOADED', teacher.id, teacher, after);
        return { id: doc.rows[0].id, teacher: after };
      });

      return { documentId: uploaded.id, teacher: uploaded.teacher, message: 'Constancia fiscal cargada correctamente.' };
    }
  );

  app.get(
    '/teachers/:id/documents/current',
    { preHandler: requireAnyPermission(['teachers.manage', 'finance.view', 'reports.view']) },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!params.success) {
        await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Docente inválido.' });
        return;
      }

      const rows = await query<CurrentDocumentRow>(
        `
          SELECT
            id,
            teacher_id AS "teacherId",
            storage_bucket AS "storageBucket",
            storage_object AS "storageObject",
            original_file_name AS "originalFileName",
            mime_type AS "mimeType"
          FROM teacher_documents
          WHERE teacher_id = $1
            AND document_type = 'CONSTANCIA_FISCAL'
            AND is_current = true
          LIMIT 1
        `,
        [params.data.id]
      );

      const doc = rows[0];
      if (!doc) {
        await reply.code(404).send({ error: 'NOT_FOUND', message: 'Este docente no tiene constancia cargada.' });
        return;
      }

      const file = firebaseAdmin.storage().bucket(doc.storageBucket).file(doc.storageObject);
      const [buffer] = await file.download();
      reply
        .header('Content-Type', doc.mimeType || 'application/octet-stream')
        .header('Content-Disposition', `inline; filename="${doc.originalFileName.replace(/"/g, '')}"`)
        .send(buffer);
    }
  );
}
