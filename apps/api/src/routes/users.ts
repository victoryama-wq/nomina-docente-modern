import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requirePermission } from '../auth.js';
import { config } from '../config.js';
import { query, withTransaction } from '../db.js';
import type { RoleCode, SessionUser } from '../types.js';

interface RoleRow {
  id: string;
  code: RoleCode;
  name: string;
  description: string;
}

interface UserRow {
  id: string;
  firebaseUid: string | null;
  email: string;
  displayName: string;
  role: RoleCode;
  roleName: string;
  status: 'ACTIVO' | 'INACTIVO';
  notes: string;
  legacyUsername: string;
  legacyRowNumber: number | null;
  isProtectedSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const userBodySchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  displayName: z.string().trim().min(2).max(120),
  roleCode: z.string().trim().toLowerCase().default('coordinador'),
  status: z.enum(['ACTIVO', 'INACTIVO']).default('ACTIVO'),
  notes: z.string().trim().max(250).optional().default(''),
  legacyUsername: z.string().trim().max(120).optional().default('')
});

const userPatchSchema = userBodySchema.partial().extend({
  roleCode: z.string().trim().toLowerCase().optional()
});

function normalizeDomain(email: string): boolean {
  return email.endsWith(`@${config.ALLOWED_EMAIL_DOMAIN.toLowerCase()}`);
}

function sendValidation(reply: FastifyReply, error: z.ZodError): void {
  void reply.code(400).send({
    error: 'VALIDATION_ERROR',
    message: error.issues[0]?.message || 'Datos inválidos.'
  });
}

async function getRole(client: PoolClient, roleCode: string): Promise<RoleRow | null> {
  const result = await client.query<RoleRow>(
    'SELECT id, code, name, description FROM roles WHERE code = $1 LIMIT 1',
    [roleCode]
  );
  return result.rows[0] || null;
}

async function ensureActiveAdminRemains(client: PoolClient, userId: string): Promise<void> {
  const result = await client.query<{ total: string }>(
    `
      SELECT count(*)::text AS total
      FROM app_users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.status = 'ACTIVO'
        AND r.code = 'admin'
        AND u.id <> $1
    `,
    [userId]
  );

  if (Number(result.rows[0]?.total || 0) <= 0) {
    throw new Error('Debe permanecer al menos un administrador activo en el sistema.');
  }
}

async function auditUser(
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
      VALUES ($1, $2, $3, 'app_user', $4, $5::jsonb, $6::jsonb)
    `,
    [actor.id, actor.email, action, entityId, JSON.stringify(beforeData || null), JSON.stringify(afterData || null)]
  );
}

async function listRoles(): Promise<RoleRow[]> {
  return query<RoleRow>(
    `
      SELECT id, code, name, description
      FROM roles
      ORDER BY
        CASE code
          WHEN 'admin' THEN 1
          WHEN 'coordinador' THEN 2
          WHEN 'finanzas' THEN 3
          WHEN 'contador' THEN 4
          WHEN 'contabilidad' THEN 5
          ELSE 99
        END,
        name
    `
  );
}

async function listUsers(): Promise<UserRow[]> {
  return query<UserRow>(
    `
      SELECT
        u.id,
        u.firebase_uid AS "firebaseUid",
        u.email,
        u.display_name AS "displayName",
        r.code AS role,
        r.name AS "roleName",
        u.status,
        u.notes,
        COALESCE(u.legacy_username, '') AS "legacyUsername",
        u.legacy_row_number AS "legacyRowNumber",
        u.is_protected_super_admin AS "isProtectedSuperAdmin",
        u.last_login_at AS "lastLoginAt",
        u.created_at AS "createdAt",
        u.updated_at AS "updatedAt"
      FROM app_users u
      JOIN roles r ON r.id = u.role_id
      ORDER BY u.is_protected_super_admin DESC, u.status ASC, u.display_name ASC
    `
  );
}

function buildSummary(users: UserRow[]) {
  return {
    total: users.length,
    active: users.filter((user) => user.status === 'ACTIVO').length,
    inactive: users.filter((user) => user.status === 'INACTIVO').length,
    admins: users.filter((user) => user.role === 'admin' && user.status === 'ACTIVO').length
  };
}

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users', { preHandler: requirePermission('access.manage') }, async () => {
    const [users, roles] = await Promise.all([listUsers(), listRoles()]);
    return { users, roles, summary: buildSummary(users) };
  });

  app.post('/users', { preHandler: requirePermission('access.manage') }, async (request, reply) => {
    const parsed = userBodySchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const body = parsed.data;
    if (!normalizeDomain(body.email)) {
      await reply.code(400).send({
        error: 'DOMAIN_NOT_ALLOWED',
        message: `El correo debe pertenecer al dominio @${config.ALLOWED_EMAIL_DOMAIN}.`
      });
      return;
    }

    const actor = request.user!;
    const created = await withTransaction(async (client) => {
      const role = await getRole(client, body.roleCode);
      if (!role) throw new Error('El rol seleccionado no existe.');

      const result = await client.query<UserRow>(
        `
          INSERT INTO app_users (email, display_name, role_id, status, notes, legacy_username, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
          RETURNING
            id,
            firebase_uid AS "firebaseUid",
            email,
            display_name AS "displayName",
            $8::text AS role,
            $9::text AS "roleName",
            status,
            notes,
            COALESCE(legacy_username, '') AS "legacyUsername",
            legacy_row_number AS "legacyRowNumber",
            is_protected_super_admin AS "isProtectedSuperAdmin",
            last_login_at AS "lastLoginAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          body.email,
          body.displayName,
          role.id,
          body.status,
          body.notes,
          body.legacyUsername,
          actor.id,
          role.code,
          role.name
        ]
      );

      await auditUser(client, actor, 'USER_CREATED', result.rows[0].id, null, result.rows[0]);
      return result.rows[0];
    });

    await reply.code(201).send({ user: created, message: 'Usuario autorizado correctamente.' });
  });

  app.patch('/users/:id', { preHandler: requirePermission('access.manage') }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const parsed = userPatchSchema.safeParse(request.body);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Usuario inválido.' });
      return;
    }
    if (!parsed.success) {
      sendValidation(reply, parsed.error);
      return;
    }

    const actor = request.user!;
    const updated = await withTransaction(async (client) => {
      const existing = await client.query<UserRow & { roleId: string }>(
        `
          SELECT
            u.id,
            u.firebase_uid AS "firebaseUid",
            u.email,
            u.display_name AS "displayName",
            u.role_id AS "roleId",
            r.code AS role,
            r.name AS "roleName",
            u.status,
            u.notes,
            COALESCE(u.legacy_username, '') AS "legacyUsername",
            u.legacy_row_number AS "legacyRowNumber",
            u.is_protected_super_admin AS "isProtectedSuperAdmin",
            u.last_login_at AS "lastLoginAt",
            u.created_at AS "createdAt",
            u.updated_at AS "updatedAt"
          FROM app_users u
          JOIN roles r ON r.id = u.role_id
          WHERE u.id = $1
          LIMIT 1
        `,
        [params.data.id]
      );

      const before = existing.rows[0];
      if (!before) throw new Error('No se encontró el usuario.');

      const nextEmail = parsed.data.email || before.email;
      if (!normalizeDomain(nextEmail)) {
        throw new Error(`El correo debe pertenecer al dominio @${config.ALLOWED_EMAIL_DOMAIN}.`);
      }

      const nextRoleCode = parsed.data.roleCode || before.role;
      const role = await getRole(client, nextRoleCode);
      if (!role) throw new Error('El rol seleccionado no existe.');

      const nextStatus = parsed.data.status || before.status;
      if (before.id === actor.id && (nextStatus !== 'ACTIVO' || role.code !== 'admin')) {
        throw new Error('No puedes quitarte acceso activo de administrador desde tu propia sesión.');
      }

      if (before.isProtectedSuperAdmin && (nextStatus !== 'ACTIVO' || role.code !== 'admin' || nextEmail !== before.email)) {
        throw new Error('El administrador general protegido no puede ser desactivado, degradado ni renombrado.');
      }

      if (before.role === 'admin' && before.status === 'ACTIVO' && (role.code !== 'admin' || nextStatus !== 'ACTIVO')) {
        await ensureActiveAdminRemains(client, before.id);
      }

      const result = await client.query<UserRow>(
        `
          UPDATE app_users
          SET
            email = $1,
            display_name = $2,
            role_id = $3,
            status = $4,
            notes = $5,
            legacy_username = $6,
            updated_by = $7,
            updated_at = now()
          WHERE id = $8
          RETURNING
            id,
            firebase_uid AS "firebaseUid",
            email,
            display_name AS "displayName",
            $9::text AS role,
            $10::text AS "roleName",
            status,
            notes,
            COALESCE(legacy_username, '') AS "legacyUsername",
            legacy_row_number AS "legacyRowNumber",
            is_protected_super_admin AS "isProtectedSuperAdmin",
            last_login_at AS "lastLoginAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          nextEmail,
          parsed.data.displayName || before.displayName,
          role.id,
          nextStatus,
          parsed.data.notes ?? before.notes,
          parsed.data.legacyUsername ?? before.legacyUsername,
          actor.id,
          before.id,
          role.code,
          role.name
        ]
      );

      await auditUser(client, actor, 'USER_UPDATED', before.id, before, result.rows[0]);
      return result.rows[0];
    });

    return { user: updated, message: 'Usuario actualizado correctamente.' };
  });

  app.delete('/users/:id', { preHandler: requirePermission('access.manage') }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      await reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Usuario inválido.' });
      return;
    }

    const actor = request.user!;
    await withTransaction(async (client) => {
      const existing = await client.query<UserRow>(
        `
          SELECT
            u.id,
            u.firebase_uid AS "firebaseUid",
            u.email,
            u.display_name AS "displayName",
            r.code AS role,
            r.name AS "roleName",
            u.status,
            u.notes,
            COALESCE(u.legacy_username, '') AS "legacyUsername",
            u.legacy_row_number AS "legacyRowNumber",
            u.is_protected_super_admin AS "isProtectedSuperAdmin",
            u.last_login_at AS "lastLoginAt",
            u.created_at AS "createdAt",
            u.updated_at AS "updatedAt"
          FROM app_users u
          JOIN roles r ON r.id = u.role_id
          WHERE u.id = $1
          LIMIT 1
        `,
        [params.data.id]
      );

      const before = existing.rows[0];
      if (!before) throw new Error('No se encontró el usuario.');
      if (before.id === actor.id) throw new Error('No puedes eliminar tu propio acceso.');
      if (before.isProtectedSuperAdmin) throw new Error('El administrador general protegido no puede ser eliminado.');
      if (before.role === 'admin' && before.status === 'ACTIVO') {
        await ensureActiveAdminRemains(client, before.id);
      }

      await client.query('DELETE FROM app_users WHERE id = $1', [before.id]);
      await auditUser(client, actor, 'USER_DELETED', before.id, before, null);
    });

    return { message: 'Usuario eliminado correctamente.' };
  });
}
