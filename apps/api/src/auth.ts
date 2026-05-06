import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';
import { query } from './db.js';
import { firebaseAdmin } from './firebase.js';
import type { SessionUser } from './types.js';

interface UserRow {
  id: string;
  firebase_uid: string | null;
  email: string;
  display_name: string;
  status: 'ACTIVO' | 'INACTIVO';
  is_protected_super_admin: boolean;
  role_code: SessionUser['role'];
  permissions: string[];
}

function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

function isAllowedDomain(email: string): boolean {
  if (!config.ALLOWED_EMAIL_DOMAIN) return true;
  return email.toLowerCase().endsWith(`@${config.ALLOWED_EMAIL_DOMAIN.toLowerCase()}`);
}

async function loadUserByEmail(email: string, firebaseUid: string): Promise<SessionUser | null> {
  const rows = await query<UserRow>(
    `
      SELECT
        u.id,
        u.firebase_uid,
        u.email,
        u.display_name,
        u.status,
        u.is_protected_super_admin,
        r.code AS role_code,
        COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
      FROM app_users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE u.email = $1
      GROUP BY u.id, r.code
      LIMIT 1
    `,
    [email]
  );

  const row = rows[0];
  if (!row || row.status !== 'ACTIVO') return null;

  if (!row.firebase_uid) {
    await query('UPDATE app_users SET firebase_uid = $1, last_login_at = now(), updated_at = now() WHERE id = $2', [
      firebaseUid,
      row.id
    ]);
  } else if (row.firebase_uid !== firebaseUid) {
    return null;
  } else {
    await query('UPDATE app_users SET last_login_at = now() WHERE id = $1', [row.id]);
  }

  return {
    id: row.id,
    firebaseUid,
    email: row.email,
    displayName: row.display_name,
    role: row.role_code,
    status: row.status,
    isProtectedSuperAdmin: row.is_protected_super_admin,
    permissions: row.permissions || []
  };
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = getBearerToken(request);
  if (!token) {
    await reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Inicia sesion para continuar.' });
    return;
  }

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();

    if (!email || decoded.email_verified !== true) {
      await reply.code(403).send({ error: 'EMAIL_NOT_VERIFIED', message: 'El correo de Google no esta verificado.' });
      return;
    }

    if (!isAllowedDomain(email)) {
      await reply.code(403).send({
        error: 'DOMAIN_NOT_ALLOWED',
        message: `Solo se permite acceso con cuentas @${config.ALLOWED_EMAIL_DOMAIN}.`
      });
      return;
    }

    const user = await loadUserByEmail(email, decoded.uid);
    if (!user) {
      await reply.code(403).send({
        error: 'USER_NOT_ALLOWED',
        message: 'Tu correo no tiene acceso activo a Nomina Docente.'
      });
      return;
    }

    request.user = user;
  } catch (error) {
    console.error('--- AUTH ERROR ---', error);
    request.log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Firebase token rejected');
    await reply.code(401).send({ error: 'INVALID_TOKEN', message: 'La sesion no es valida o expiro.' });
  }
}

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    if (reply.sent) return;

    const permissions = request.user?.permissions || [];
    if (!permissions.includes(permission)) {
      await reply.code(403).send({ error: 'FORBIDDEN', message: 'No tienes permiso para esta accion.' });
    }
  };
}

export function requirePermissionOrProtectedSuperAdmin(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    if (reply.sent) return;

    const user = request.user;
    const permissions = user?.permissions || [];
    if (!user?.isProtectedSuperAdmin && !permissions.includes(permission)) {
      await reply.code(403).send({ error: 'FORBIDDEN', message: 'No tienes permiso para esta accion.' });
    }
  };
}

export function requireAnyPermission(allowedPermissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    if (reply.sent) return;

    const permissions = request.user?.permissions || [];
    if (!allowedPermissions.some((permission) => permissions.includes(permission))) {
      await reply.code(403).send({ error: 'FORBIDDEN', message: 'No tienes permiso para esta accion.' });
    }
  };
}
