import type { ActorCoordination, SessionUser } from '../../types.js';
import {
  ACCOUNTANT_PERMISSIONS,
  ADMIN_PERMISSIONS,
  COORDINATOR_PERMISSIONS,
  DIRECTION_PERMISSIONS,
  FINANCE_PERMISSIONS,
  RH_PERMISSIONS
} from './permissions.js';

export const TEST_COORDINATIONS = {
  idiomas: {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Idiomas',
    isPrimary: true
  },
  adetur: {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'ADETUR',
    isPrimary: true
  },
  arq: {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'ARQ',
    isPrimary: false
  },
  siscom: {
    id: '10000000-0000-4000-8000-000000000004',
    name: 'SISCOM',
    isPrimary: false
  },
  digraf: {
    id: '10000000-0000-4000-8000-000000000005',
    name: 'DIGRAF',
    isPrimary: false
  }
} as const satisfies Record<string, ActorCoordination>;

export const TEST_USER_IDS = {
  admin: '20000000-0000-4000-8000-000000000001',
  coordinator: '20000000-0000-4000-8000-000000000002',
  multiCoordinator: '20000000-0000-4000-8000-000000000003',
  coordinatorWithoutCoordination: '20000000-0000-4000-8000-000000000004',
  rh: '20000000-0000-4000-8000-000000000005',
  finance: '20000000-0000-4000-8000-000000000006',
  direction: '20000000-0000-4000-8000-000000000007',
  accountant: '20000000-0000-4000-8000-000000000008',
  accounting: '20000000-0000-4000-8000-000000000009'
} as const;

function copyCoordinations(coordinations: ActorCoordination[]): ActorCoordination[] {
  return coordinations.map((coordination) => ({ ...coordination }));
}

export function createSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  const base: SessionUser = {
    id: TEST_USER_IDS.coordinator,
    firebaseUid: 'qa-fixture-coordinator',
    email: 'qa.coordinador.idiomas@tecplayacar.edu.mx',
    displayName: 'QA Coordinador Idiomas',
    role: 'coordinador',
    status: 'ACTIVO',
    isProtectedSuperAdmin: false,
    permissions: [...COORDINATOR_PERMISSIONS],
    actorCoordinations: copyCoordinations([TEST_COORDINATIONS.idiomas])
  };

  return {
    ...base,
    ...overrides,
    permissions: [...(overrides.permissions ?? base.permissions)],
    actorCoordinations: copyCoordinations(overrides.actorCoordinations ?? base.actorCoordinations)
  };
}

export function adminActor(): SessionUser {
  return createSessionUser({
    id: TEST_USER_IDS.admin,
    firebaseUid: 'qa-fixture-admin',
    email: 'qa.admin@tecplayacar.edu.mx',
    displayName: 'QA Admin',
    role: 'admin',
    isProtectedSuperAdmin: true,
    permissions: [...ADMIN_PERMISSIONS],
    actorCoordinations: []
  });
}

export function coordinatorActor(): SessionUser {
  return createSessionUser();
}

export function multiCoordinatorActor(): SessionUser {
  return createSessionUser({
    id: TEST_USER_IDS.multiCoordinator,
    firebaseUid: 'qa-fixture-coordinator-multi',
    email: 'qa.coordinador.multi@tecplayacar.edu.mx',
    displayName: 'QA Coordinador Multi',
    permissions: [...COORDINATOR_PERMISSIONS],
    actorCoordinations: copyCoordinations([
      TEST_COORDINATIONS.adetur,
      TEST_COORDINATIONS.arq,
      TEST_COORDINATIONS.siscom,
      TEST_COORDINATIONS.digraf
    ])
  });
}

export function coordinatorWithoutCoordinationActor(): SessionUser {
  return createSessionUser({
    id: TEST_USER_IDS.coordinatorWithoutCoordination,
    firebaseUid: 'qa-fixture-coordinator-empty',
    email: 'qa.coordinador.sin.coordinacion@tecplayacar.edu.mx',
    displayName: 'QA Coordinador Sin Coordinacion',
    actorCoordinations: []
  });
}

export function rhActor(): SessionUser {
  return createSessionUser({
    id: TEST_USER_IDS.rh,
    firebaseUid: 'qa-fixture-rh',
    email: 'qa.rh@tecplayacar.edu.mx',
    displayName: 'QA RH',
    role: 'rh',
    permissions: [...RH_PERMISSIONS],
    actorCoordinations: []
  });
}

export function financeActor(): SessionUser {
  return createSessionUser({
    id: TEST_USER_IDS.finance,
    firebaseUid: 'qa-fixture-finanzas',
    email: 'qa.finanzas@tecplayacar.edu.mx',
    displayName: 'QA Finanzas',
    role: 'finanzas',
    permissions: [...FINANCE_PERMISSIONS],
    actorCoordinations: []
  });
}

export function directionActor(): SessionUser {
  return createSessionUser({
    id: TEST_USER_IDS.direction,
    firebaseUid: 'qa-fixture-direccion',
    email: 'qa.direccion@tecplayacar.edu.mx',
    displayName: 'QA Direccion',
    role: 'direccion',
    permissions: [...DIRECTION_PERMISSIONS],
    actorCoordinations: []
  });
}

export function accountantActor(): SessionUser {
  return createSessionUser({
    id: TEST_USER_IDS.accountant,
    firebaseUid: 'qa-fixture-contador',
    email: 'qa.contador@tecplayacar.edu.mx',
    displayName: 'QA Contador',
    role: 'contador',
    permissions: [...ACCOUNTANT_PERMISSIONS],
    actorCoordinations: []
  });
}

export function accountingActor(): SessionUser {
  return createSessionUser({
    id: TEST_USER_IDS.accounting,
    firebaseUid: 'qa-fixture-contabilidad',
    email: 'qa.contabilidad@tecplayacar.edu.mx',
    displayName: 'QA Contabilidad',
    role: 'contabilidad',
    permissions: [...ACCOUNTANT_PERMISSIONS],
    actorCoordinations: []
  });
}
