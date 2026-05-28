import type { ActorScope, SessionUser } from '../../types.js';
import {
  accountingActor,
  accountantActor,
  adminActor,
  coordinatorActor,
  coordinatorWithoutCoordinationActor,
  directionActor,
  financeActor,
  multiCoordinatorActor,
  rhActor
} from './actors.js';

function hasGlobalAccess(actor: SessionUser): boolean {
  return (
    actor.role === 'admin' ||
    actor.isProtectedSuperAdmin ||
    actor.role === 'finanzas' ||
    actor.role === 'contador' ||
    actor.role === 'contabilidad' ||
    actor.permissions.includes('finance.global_view') ||
    actor.permissions.includes('finance.workflow')
  );
}

export function scopeFromActor(actor: SessionUser, overrides: Partial<ActorScope> = {}): ActorScope {
  const coordinationIds = actor.actorCoordinations.map((coordination) => coordination.id);
  const permissions = overrides.permissions ?? actor.permissions;
  const resolvedCoordinationIds = overrides.coordinationIds ?? coordinationIds;
  const coordinations = overrides.coordinations ?? actor.actorCoordinations;

  const scope: ActorScope = {
    userId: actor.id,
    email: actor.email,
    role: actor.role,
    permissions: [],
    isAdmin: actor.role === 'admin',
    isProtectedSuperAdmin: actor.isProtectedSuperAdmin,
    hasGlobalAccess: hasGlobalAccess(actor),
    coordinationIds: [],
    coordinations: [],
    usedFallback: false,
    requiresOperationalCoordination: false,
    ...overrides
  };

  return {
    ...scope,
    permissions: [...permissions],
    coordinationIds: [...resolvedCoordinationIds],
    coordinations: coordinations.map((coordination) => ({ ...coordination }))
  };
}

export function createActorScope(overrides: Partial<ActorScope> = {}): ActorScope {
  return scopeFromActor(coordinatorActor(), overrides);
}

export function adminScope(): ActorScope {
  return scopeFromActor(adminActor());
}

export function coordinatorScope(): ActorScope {
  return scopeFromActor(coordinatorActor());
}

export function multiCoordinatorScope(): ActorScope {
  return scopeFromActor(multiCoordinatorActor());
}

export function coordinatorWithoutCoordinationScope(): ActorScope {
  return scopeFromActor(coordinatorWithoutCoordinationActor());
}

export function rhScope(): ActorScope {
  return scopeFromActor(rhActor());
}

export function financeScope(): ActorScope {
  return scopeFromActor(financeActor());
}

export function directionScope(): ActorScope {
  return scopeFromActor(directionActor());
}

export function accountantScope(): ActorScope {
  return scopeFromActor(accountantActor());
}

export function accountingScope(): ActorScope {
  return scopeFromActor(accountingActor());
}
