export type RoleCode = 'admin' | 'coordinador' | 'direccion' | 'rh' | 'finanzas' | 'contador' | 'contabilidad';

export interface SessionUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: RoleCode;
  status: 'ACTIVO' | 'INACTIVO';
  isProtectedSuperAdmin: boolean;
  permissions: string[];
  actorCoordinations: ActorCoordination[];
}

export interface ActorCoordination {
  id: string;
  name: string;
  isPrimary: boolean;
}

export interface ActorScope {
  userId: string;
  email: string;
  role: RoleCode;
  permissions: string[];
  isAdmin: boolean;
  isProtectedSuperAdmin: boolean;
  hasGlobalAccess: boolean;
  coordinationIds: string[];
  coordinations: ActorCoordination[];
  usedFallback: boolean;
  fallbackReason?: string;
  requiresOperationalCoordination: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
  }
}
