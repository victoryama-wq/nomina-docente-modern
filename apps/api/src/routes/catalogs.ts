import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { authenticate } from '../auth.js';
import { query, withTransaction } from '../db.js';
import type { SessionUser } from '../types.js';
import { normalizeText } from './academic-context.js';

type CatalogStatus = 'ACTIVO' | 'INACTIVO';

interface SubjectRow {
  id: string;
  name: string;
  status: CatalogStatus;
  scheduleCount: number;
  activeScheduleCount: number;
}

interface TabulatorRow {
  id: string;
  name: string;
  amount: number;
  status: CatalogStatus;
  sortOrder: number;
  scheduleCount: number;
  activeScheduleCount: number;
}

const catalogStatusSchema = z.enum(['ACTIVO', 'INACTIVO']);

const subjectBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  status: catalogStatusSchema.default('ACTIVO')
});

const tabulatorBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  amount: z.coerce.number().positive().max(1_000_000),
  status: catalogStatusSchema.default('ACTIVO'),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(100)
});

const idParamsSchema = z.object({
  id: z.string().uuid()
});

function isSystemAdmin(actor: SessionUser | undefined): boolean {
  return actor?.role === 'admin' || actor?.isProtectedSuperAdmin === true;
}

async function requireCatalogAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authenticate(request, reply);
  if (reply.sent) return;

  if (!isSystemAdmin(request.user)) {
    await reply.code(403).send({
      error: 'FORBIDDEN',
      message: 'Solo un administrador puede gestionar catálogos.'
    });
  }
}

function sendValidation(reply: FastifyReply, error: z.ZodError): void {
  void reply.code(400).send({
    error: 'VALIDATION_ERROR',
    message: error.issues[0]?.message || 'Datos inválidos.'
  });
}

async function auditCatalog(
  client: PoolClient,
  actor: SessionUser,
  action: string,
  entityType: 'subject' | 'tabulator',
  entityId: string,
  beforeData: unknown,
  afterData: unknown
): Promise<void> {
  await client.query(
    `
      INSERT INTO audit_log (actor_user_id, actor_email, action, entity_type, entity_id, before_data, after_data)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
    `,
    [
      actor.id,
      actor.email,
      action,
      entityType,
      entityId,
      JSON.stringify(beforeData || null),
      JSON.stringify(afterData || null)
    ]
  );
}

async function listSubjects(client?: PoolClient): Promise<SubjectRow[]> {
  const sql = `
    SELECT
      s.id,
      s.name,
      s.status,
      count(sc.id)::int AS "scheduleCount",
      count(sc.id) FILTER (
        WHERE ac.status IN ('ACTIVO', 'PLANEACION')
      )::int AS "activeScheduleCount"
    FROM subjects s
    LEFT JOIN schedules sc ON sc.subject_id = s.id
    LEFT JOIN academic_cycles ac ON ac.id = sc.cycle_id
    GROUP BY s.id
    ORDER BY
      CASE s.status WHEN 'ACTIVO' THEN 1 ELSE 2 END,
      s.name ASC
  `;
  const result = client ? await client.query<SubjectRow>(sql) : await query<SubjectRow>(sql);
  return Array.isArray(result) ? result : result.rows;
}

async function listTabulators(client?: PoolClient): Promise<TabulatorRow[]> {
  const sql = `
    SELECT
      t.id,
      t.name,
      t.amount::float8 AS amount,
      t.status,
      t.sort_order AS "sortOrder",
      count(sc.id)::int AS "scheduleCount",
      count(sc.id) FILTER (
        WHERE ac.status IN ('ACTIVO', 'PLANEACION')
      )::int AS "activeScheduleCount"
    FROM tabulators t
    LEFT JOIN schedules sc ON sc.tabulator_id = t.id
    LEFT JOIN academic_cycles ac ON ac.id = sc.cycle_id
    GROUP BY t.id
    ORDER BY
      CASE t.status WHEN 'ACTIVO' THEN 1 ELSE 2 END,
      t.sort_order ASC,
      t.name ASC
  `;
  const result = client ? await client.query<TabulatorRow>(sql) : await query<TabulatorRow>(sql);
  return Array.isArray(result) ? result : result.rows;
}

async function loadSubjectById(client: PoolClient, id: string): Promise<SubjectRow | null> {
  const result = await client.query<SubjectRow>(
    `
      SELECT
        s.id,
        s.name,
        s.status,
        count(sc.id)::int AS "scheduleCount",
        count(sc.id) FILTER (
          WHERE ac.status IN ('ACTIVO', 'PLANEACION')
        )::int AS "activeScheduleCount"
      FROM subjects s
      LEFT JOIN schedules sc ON sc.subject_id = s.id
      LEFT JOIN academic_cycles ac ON ac.id = sc.cycle_id
      WHERE s.id = $1
      GROUP BY s.id
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function loadTabulatorById(client: PoolClient, id: string): Promise<TabulatorRow | null> {
  const result = await client.query<TabulatorRow>(
    `
      SELECT
        t.id,
        t.name,
        t.amount::float8 AS amount,
        t.status,
        t.sort_order AS "sortOrder",
        count(sc.id)::int AS "scheduleCount",
        count(sc.id) FILTER (
          WHERE ac.status IN ('ACTIVO', 'PLANEACION')
        )::int AS "activeScheduleCount"
      FROM tabulators t
      LEFT JOIN schedules sc ON sc.tabulator_id = t.id
      LEFT JOIN academic_cycles ac ON ac.id = sc.cycle_id
      WHERE t.id = $1
      GROUP BY t.id
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function assertUniqueSubjectName(client: PoolClient, name: string, exceptId?: string): Promise<void> {
  const existing = await client.query<{ id: string }>(
    `
      SELECT id
      FROM subjects
      WHERE lower(name) = lower($1)
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1
    `,
    [name, exceptId || null]
  );
  if (existing.rows[0]) throw new Error('Ya existe una asignatura con ese nombre.');
}

async function assertUniqueTabulatorName(client: PoolClient, name: string, exceptId?: string): Promise<void> {
  const existing = await client.query<{ id: string }>(
    `
      SELECT id
      FROM tabulators
      WHERE lower(name) = lower($1)
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1
    `,
    [name, exceptId || null]
  );
  if (existing.rows[0]) throw new Error('Ya existe un tabulador con ese nombre.');
}

function buildSummary(subjects: SubjectRow[], tabulators: TabulatorRow[]) {
  return {
    subjects: {
      total: subjects.length,
      active: subjects.filter((subject) => subject.status === 'ACTIVO').length,
      inactive: subjects.filter((subject) => subject.status === 'INACTIVO').length,
      usedInWorkingCycles: subjects.filter((subject) => subject.activeScheduleCount > 0).length
    },
    tabulators: {
      total: tabulators.length,
      active: tabulators.filter((tabulator) => tabulator.status === 'ACTIVO').length,
      inactive: tabulators.filter((tabulator) => tabulator.status === 'INACTIVO').length,
      usedInWorkingCycles: tabulators.filter((tabulator) => tabulator.activeScheduleCount > 0).length
    }
  };
}

async function buildCatalogContext() {
  const [subjects, tabulators] = await Promise.all([listSubjects(), listTabulators()]);
  return {
    subjects,
    tabulators,
    summary: buildSummary(subjects, tabulators)
  };
}

export async function registerCatalogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/catalogs/context', { preHandler: requireCatalogAdmin }, async () => buildCatalogContext());

  app.post('/catalogs/subjects', { preHandler: requireCatalogAdmin }, async (request, reply) => {
    const parsed = subjectBodySchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const subject = await withTransaction(async (client) => {
      const name = normalizeText(parsed.data.name);
      await assertUniqueSubjectName(client, name);
      const created = await client.query<{ id: string }>(
        'INSERT INTO subjects (name, status) VALUES ($1, $2) RETURNING id',
        [name, parsed.data.status]
      );
      const after = await loadSubjectById(client, created.rows[0].id);
      await auditCatalog(client, actor, 'SUBJECT_CREATED', 'subject', created.rows[0].id, null, after);
      return after;
    });

    await reply.code(201).send({ subject, message: 'Asignatura registrada correctamente.' });
  });

  app.patch('/catalogs/subjects/:id', { preHandler: requireCatalogAdmin }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    const parsed = subjectBodySchema.safeParse(request.body);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Asignatura inválida.' });
      return;
    }
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const subject = await withTransaction(async (client) => {
      const before = await loadSubjectById(client, params.data.id);
      if (!before) throw new Error('No se encontró la asignatura.');

      const name = normalizeText(parsed.data.name);
      await assertUniqueSubjectName(client, name, before.id);
      await client.query('UPDATE subjects SET name = $1, status = $2 WHERE id = $3', [
        name,
        parsed.data.status,
        before.id
      ]);
      const after = await loadSubjectById(client, before.id);
      await auditCatalog(client, actor, 'SUBJECT_UPDATED', 'subject', before.id, before, after);
      return after;
    });

    return { subject, message: 'Asignatura actualizada correctamente.' };
  });

  app.post('/catalogs/tabulators', { preHandler: requireCatalogAdmin }, async (request, reply) => {
    const parsed = tabulatorBodySchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const tabulator = await withTransaction(async (client) => {
      const name = normalizeText(parsed.data.name).toUpperCase();
      await assertUniqueTabulatorName(client, name);
      const created = await client.query<{ id: string }>(
        'INSERT INTO tabulators (name, amount, status, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, parsed.data.amount, parsed.data.status, parsed.data.sortOrder]
      );
      const after = await loadTabulatorById(client, created.rows[0].id);
      await auditCatalog(client, actor, 'TABULATOR_CREATED', 'tabulator', created.rows[0].id, null, after);
      return after;
    });

    await reply.code(201).send({ tabulator, message: 'Tabulador registrado correctamente.' });
  });

  app.patch('/catalogs/tabulators/:id', { preHandler: requireCatalogAdmin }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    const parsed = tabulatorBodySchema.safeParse(request.body);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Tabulador inválido.' });
      return;
    }
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const tabulator = await withTransaction(async (client) => {
      const before = await loadTabulatorById(client, params.data.id);
      if (!before) throw new Error('No se encontró el tabulador.');

      const name = normalizeText(parsed.data.name).toUpperCase();
      await assertUniqueTabulatorName(client, name, before.id);
      await client.query('UPDATE tabulators SET name = $1, amount = $2, status = $3, sort_order = $4 WHERE id = $5', [
        name,
        parsed.data.amount,
        parsed.data.status,
        parsed.data.sortOrder,
        before.id
      ]);
      const after = await loadTabulatorById(client, before.id);
      await auditCatalog(client, actor, 'TABULATOR_UPDATED', 'tabulator', before.id, before, after);
      return after;
    });

    return { tabulator, message: 'Tabulador actualizado correctamente.' };
  });
}
