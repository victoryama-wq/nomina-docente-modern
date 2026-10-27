import type { FastifyReply, FastifyRequest } from 'fastify';
import { authenticate } from '../auth.js';
import type { SessionUser } from '../types.js';

export type DossierAction = 'view' | 'read' | 'manage' | 'contact';

export function canUseDossier(actor: SessionUser, action: DossierAction): boolean {
  if (actor.status !== 'ACTIVO') return false;
  if (actor.role === 'admin' || actor.isProtectedSuperAdmin) return true;
  if (actor.role !== 'finanzas' && actor.role !== 'rh') return false;
  const has = (permission: string) => actor.permissions.includes(permission);
  if (!has('fiscal.view') && !has('fiscal.manage')) return false;
  if (action === 'view') return true;
  if (action === 'contact') return has('fiscal.manage');
  if (action === 'manage') return has('fiscal.document.manage');
  return has('fiscal.document.view') || has('fiscal.document.manage');
}

export function requireDossier(action: DossierAction) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    if (!request.user || !canUseDossier(request.user, action)) {
      await reply.code(403).send({ error: 'FORBIDDEN', message: 'No tienes acceso a esta accion del expediente.' });
    }
  };
}
