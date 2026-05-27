import { describe, expect, it } from 'vitest';
import { assertCoordinationAllowed, canUseGlobalScope, isOwnRecord } from './actor-scope.js';
import type { ActorScope } from './types.js';

function actorScope(overrides: Partial<ActorScope> = {}): ActorScope {
  return {
    userId: 'user-1',
    email: 'coordinador@tecplayacar.edu.mx',
    role: 'coordinador',
    permissions: ['payroll.preview'],
    isAdmin: false,
    isProtectedSuperAdmin: false,
    hasGlobalAccess: false,
    coordinationIds: ['coord-1', 'coord-2'],
    coordinations: [
      { id: 'coord-1', name: 'Idiomas', isPrimary: true },
      { id: 'coord-2', name: 'ADETUR', isPrimary: false }
    ],
    usedFallback: false,
    requiresOperationalCoordination: false,
    ...overrides
  };
}

describe('actor scope helpers', () => {
  it('allows admin global operational scope', () => {
    const scope = actorScope({
      role: 'admin',
      permissions: [],
      isAdmin: true,
      hasGlobalAccess: true,
      coordinationIds: []
    });

    expect(canUseGlobalScope(scope, 'operational')).toBe(true);
    expect(() => assertCoordinationAllowed(scope, 'coord-outside')).not.toThrow();
  });

  it('validates any assigned coordination for a coordinator', () => {
    const scope = actorScope();

    expect(() => assertCoordinationAllowed(scope, 'coord-1')).not.toThrow();
    expect(() => assertCoordinationAllowed(scope, 'coord-2')).not.toThrow();
    expect(() => assertCoordinationAllowed(scope, 'coord-3')).toThrow('No tienes permiso');
  });

  it('checks record ownership by actor user id', () => {
    const scope = actorScope({ userId: 'captured-by-user' });

    expect(isOwnRecord(scope, 'captured-by-user')).toBe(true);
    expect(isOwnRecord(scope, 'other-user')).toBe(false);
    expect(isOwnRecord(scope, null)).toBe(false);
  });
});
