import type { PoolClient } from 'pg';
import type { ActorCoordination, ActorScope, SessionUser } from './types.js';

type ScopeLogger = {
  warn: (details: Record<string, unknown>, message?: string) => void;
};

interface LoadActorScopeOptions {
  logger?: ScopeLogger;
  module?: string;
  legacyFallbackEnabled?: boolean;
}

interface AppUserLegacyRow {
  displayName: string;
  legacyUsername: string;
}

interface CoordinationScopeRow {
  id: string;
  name: string;
  isPrimary: boolean;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value: string): string {
  return normalizeText(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLegacyFallbackEnabled(options: LoadActorScopeOptions): boolean {
  if (typeof options.legacyFallbackEnabled === 'boolean') return options.legacyFallbackEnabled;

  const rawValue = process.env.LEGACY_COORDINATION_FALLBACK_ENABLED;
  if (rawValue === undefined || rawValue === '') return true;

  return !['0', 'false', 'no', 'off'].includes(rawValue.toLowerCase());
}

function hasGlobalCapability(actor: SessionUser): boolean {
  if (actor.role === 'admin' || actor.isProtectedSuperAdmin) return true;
  if (actor.permissions.includes('finance.global_view')) return true;
  if (actor.permissions.includes('finance.view')) return true;
  if (actor.permissions.includes('finance.workflow')) return true;
  return actor.role === 'finanzas' || actor.role === 'contador' || actor.role === 'contabilidad';
}

function requiresOperationalCoordination(actor: SessionUser): boolean {
  return actor.role === 'coordinador' && !actor.isProtectedSuperAdmin;
}

function uniqueCandidateNames(values: Array<string | null | undefined>): string[] {
  const candidates = values.map((value) => normalizeText(value || '')).filter(Boolean);
  return [...new Map(candidates.map((candidate) => [normalizeComparable(candidate), candidate])).values()];
}

function logFallback(
  options: LoadActorScopeOptions,
  event: string,
  actor: SessionUser,
  candidates: string[],
  resolvedCoordinations: ActorCoordination[]
): void {
  const details = {
    event,
    actorEmail: actor.email,
    role: actor.role,
    module: options.module || 'actor-scope',
    candidates,
    resolvedCoordinations: resolvedCoordinations.map((coordination) => ({
      id: coordination.id,
      name: coordination.name
    }))
  };

  if (options.logger) {
    options.logger.warn(details, event);
    return;
  }

  console.warn(event, details);
}

async function loadFormalCoordinations(client: PoolClient, userId: string): Promise<ActorCoordination[]> {
  const result = await client.query<CoordinationScopeRow>(
    `
      SELECT
        c.id,
        c.name,
        uc.is_primary AS "isPrimary"
      FROM user_coordinations uc
      JOIN coordinations c ON c.id = uc.coordination_id
      WHERE uc.user_id = $1
        AND c.status = 'ACTIVO'
      ORDER BY uc.is_primary DESC, lower(c.name)
    `,
    [userId]
  );

  return result.rows;
}

async function loadLegacyCandidates(client: PoolClient, actor: SessionUser): Promise<string[]> {
  const user = await client.query<AppUserLegacyRow>(
    `
      SELECT display_name AS "displayName", COALESCE(legacy_username, '') AS "legacyUsername"
      FROM app_users
      WHERE id = $1
      LIMIT 1
    `,
    [actor.id]
  );

  return uniqueCandidateNames([user.rows[0]?.displayName, user.rows[0]?.legacyUsername, actor.displayName]);
}

async function loadLegacyFallbackCoordinations(
  client: PoolClient,
  actor: SessionUser,
  options: LoadActorScopeOptions
): Promise<ActorCoordination[]> {
  const candidates = await loadLegacyCandidates(client, actor);
  if (candidates.length === 0) {
    logFallback(options, 'LEGACY_COORDINATION_FALLBACK_NOT_FOUND', actor, candidates, []);
    return [];
  }

  const candidateKeys = new Set(candidates.map((candidate) => normalizeComparable(candidate)));
  const activeCoordinations = await client.query<CoordinationScopeRow>(
    `
      SELECT
        id,
        name,
        false AS "isPrimary"
      FROM coordinations
      WHERE status = 'ACTIVO'
      ORDER BY lower(name)
    `
  );

  const matches = activeCoordinations.rows.filter((coordination) => candidateKeys.has(normalizeComparable(coordination.name)));

  logFallback(
    options,
    matches.length > 0 ? 'LEGACY_COORDINATION_FALLBACK_USED' : 'LEGACY_COORDINATION_FALLBACK_NOT_FOUND',
    actor,
    candidates,
    matches
  );

  return matches;
}

export async function loadActorScope(
  client: PoolClient,
  actor: SessionUser,
  options: LoadActorScopeOptions = {}
): Promise<ActorScope> {
  let coordinations = await loadFormalCoordinations(client, actor.id);
  let usedFallback = false;
  let fallbackReason: string | undefined;

  if (coordinations.length === 0 && isLegacyFallbackEnabled(options)) {
    coordinations = await loadLegacyFallbackCoordinations(client, actor, options);
    usedFallback = coordinations.length > 0;
    fallbackReason = usedFallback ? 'legacy_text_match' : 'legacy_text_not_found';
  }

  return {
    userId: actor.id,
    email: actor.email,
    role: actor.role,
    permissions: actor.permissions,
    isAdmin: actor.role === 'admin',
    isProtectedSuperAdmin: actor.isProtectedSuperAdmin,
    hasGlobalAccess: hasGlobalCapability(actor),
    coordinationIds: coordinations.map((coordination) => coordination.id),
    coordinations,
    usedFallback,
    fallbackReason,
    requiresOperationalCoordination: requiresOperationalCoordination(actor)
  };
}

export function getActorCoordinationIds(scope: ActorScope): string[] {
  return scope.coordinationIds;
}

export function canUseGlobalScope(scope: ActorScope, action = 'default'): boolean {
  if (scope.isAdmin || scope.isProtectedSuperAdmin) return true;

  switch (action) {
    case 'operational':
      return false;
    case 'finance.view':
      return scope.permissions.includes('finance.view') || scope.permissions.includes('finance.global_view');
    case 'finance.export':
      return scope.permissions.includes('finance.export') || scope.permissions.includes('finance.view');
    case 'finance.workflow':
      return scope.permissions.includes('finance.workflow');
    case 'fiscal.view':
      return (
        scope.permissions.includes('fiscal.view') ||
        scope.permissions.includes('fiscal.manage') ||
        scope.permissions.includes('finance.view')
      );
    case 'fiscal.manage':
      return scope.permissions.includes('fiscal.manage');
    case 'payroll.preview':
      return scope.hasGlobalAccess && scope.permissions.includes('payroll.preview');
    case 'payroll.finalize':
      return scope.permissions.includes('payroll.finalize');
    default:
      return scope.hasGlobalAccess;
  }
}

function forbidden(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 403;
  return error;
}

export function requireOperationalScope(scope: ActorScope): string[] {
  if (canUseGlobalScope(scope, 'operational')) return scope.coordinationIds;
  if (scope.coordinationIds.length > 0) return scope.coordinationIds;

  throw forbidden('El usuario no tiene una coordinacion operativa asignada.');
}

export function assertCoordinationAllowed(scope: ActorScope, coordinationId: string | null | undefined): void {
  if (!coordinationId) {
    throw forbidden('El registro no tiene una coordinacion valida.');
  }

  if (canUseGlobalScope(scope, 'operational')) return;
  if (scope.coordinationIds.includes(coordinationId)) return;

  throw forbidden('No tienes permiso para operar esta coordinacion.');
}

export function isOwnRecord(scope: ActorScope, ownerUserId: string | null | undefined): boolean {
  return Boolean(ownerUserId && ownerUserId === scope.userId);
}

export function selectCompatibleActorCoordination(scope: ActorScope): ActorCoordination | null {
  if (scope.coordinations.length === 0) return null;
  return scope.coordinations.find((coordination) => coordination.isPrimary) || scope.coordinations[0] || null;
}
