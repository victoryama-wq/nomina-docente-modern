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
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
  }
}
