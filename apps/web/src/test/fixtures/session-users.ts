import type { ActorCoordination, SessionUser } from '../../api';

export const WEB_PERMISSIONS = {
  dashboardView: 'dashboard.view',
  teachersManage: 'teachers.manage',
  schedulesManage: 'schedules.manage',
  incidencesManage: 'incidences.manage',
  extrasManage: 'extras.manage',
  payrollPreview: 'payroll.preview',
  payrollView: 'payroll.view',
  payrollCalculate: 'payroll.calculate',
  payrollFinalize: 'payroll.finalize',
  reportsView: 'reports.view',
  financeView: 'finance.view',
  financeGlobalView: 'finance.global_view',
  financeExport: 'finance.export',
  financeWorkflow: 'finance.workflow',
  fiscalView: 'fiscal.view',
  fiscalManage: 'fiscal.manage',
  fiscalDocumentView: 'fiscal.document.view',
  fiscalDocumentManage: 'fiscal.document.manage',
  accessManage: 'access.manage',
  auditView: 'audit.view'
} as const;

export const WEB_COORDINATIONS = {
  idiomas: { id: '10000000-0000-4000-8000-000000000001', name: 'Idiomas', isPrimary: true },
  adetur: { id: '10000000-0000-4000-8000-000000000002', name: 'ADETUR', isPrimary: true },
  arq: { id: '10000000-0000-4000-8000-000000000003', name: 'ARQ', isPrimary: false },
  siscom: { id: '10000000-0000-4000-8000-000000000004', name: 'SISCOM', isPrimary: false },
  digraf: { id: '10000000-0000-4000-8000-000000000005', name: 'DIGRAF', isPrimary: false }
} satisfies Record<string, ActorCoordination>;

const coordinatorPermissions = [
  WEB_PERMISSIONS.dashboardView,
  WEB_PERMISSIONS.teachersManage,
  WEB_PERMISSIONS.schedulesManage,
  WEB_PERMISSIONS.incidencesManage,
  WEB_PERMISSIONS.extrasManage,
  WEB_PERMISSIONS.payrollView,
  WEB_PERMISSIONS.payrollPreview,
  WEB_PERMISSIONS.reportsView
];

export function createSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: '90000000-0000-4000-8000-000000000001',
    firebaseUid: 'qa-firebase-uid',
    email: 'qa.user@tecplayacar.edu.mx',
    displayName: 'Usuario QA',
    role: 'coordinador',
    status: 'ACTIVO',
    isProtectedSuperAdmin: false,
    permissions: [],
    actorCoordinations: [],
    ...overrides
  };
}

export function adminSession(): SessionUser {
  return createSessionUser({
    email: 'qa.admin@tecplayacar.edu.mx',
    displayName: 'Admin QA',
    role: 'admin',
    isProtectedSuperAdmin: true,
    permissions: Object.values(WEB_PERMISSIONS)
  });
}

export function coordinatorSession(): SessionUser {
  return createSessionUser({
    email: 'qa.coordinador.idiomas@tecplayacar.edu.mx',
    displayName: 'Coordinador Idiomas QA',
    role: 'coordinador',
    permissions: coordinatorPermissions,
    actorCoordinations: [WEB_COORDINATIONS.idiomas]
  });
}

export function multiCoordinatorSession(): SessionUser {
  return createSessionUser({
    email: 'qa.coordinador.multi@tecplayacar.edu.mx',
    displayName: 'Coordinador Multi QA',
    role: 'coordinador',
    permissions: coordinatorPermissions,
    actorCoordinations: [WEB_COORDINATIONS.adetur, WEB_COORDINATIONS.arq, WEB_COORDINATIONS.siscom, WEB_COORDINATIONS.digraf]
  });
}

export function coordinatorWithoutCoordinationSession(): SessionUser {
  return createSessionUser({
    email: 'qa.coordinador.sin.coordinacion@tecplayacar.edu.mx',
    displayName: 'Coordinador Sin Coordinacion QA',
    role: 'coordinador',
    permissions: coordinatorPermissions,
    actorCoordinations: []
  });
}

export function rhSession(): SessionUser {
  return createSessionUser({
    email: 'qa.rh@tecplayacar.edu.mx',
    displayName: 'RH QA',
    role: 'rh',
    permissions: [
      WEB_PERMISSIONS.fiscalView,
      WEB_PERMISSIONS.fiscalManage,
      WEB_PERMISSIONS.fiscalDocumentView,
      WEB_PERMISSIONS.fiscalDocumentManage
    ]
  });
}

export function financeSession(): SessionUser {
  return createSessionUser({
    email: 'qa.finanzas@tecplayacar.edu.mx',
    displayName: 'Finanzas QA',
    role: 'finanzas',
    permissions: [
      WEB_PERMISSIONS.financeView,
      WEB_PERMISSIONS.financeExport,
      WEB_PERMISSIONS.financeWorkflow,
      WEB_PERMISSIONS.fiscalView,
      WEB_PERMISSIONS.fiscalManage,
      WEB_PERMISSIONS.fiscalDocumentView,
      WEB_PERMISSIONS.fiscalDocumentManage,
      WEB_PERMISSIONS.payrollView
    ]
  });
}

export function directionSession(): SessionUser {
  return createSessionUser({
    email: 'qa.direccion@tecplayacar.edu.mx',
    displayName: 'Direccion QA',
    role: 'direccion',
    permissions: [
      WEB_PERMISSIONS.reportsView,
      WEB_PERMISSIONS.financeGlobalView,
      WEB_PERMISSIONS.payrollPreview,
      WEB_PERMISSIONS.teachersManage
    ]
  });
}

export function accountantSession(): SessionUser {
  return createSessionUser({
    email: 'qa.contador@tecplayacar.edu.mx',
    displayName: 'Contador QA',
    role: 'contador',
    permissions: [WEB_PERMISSIONS.financeExport]
  });
}

export function accountingSession(): SessionUser {
  return createSessionUser({
    email: 'qa.contabilidad@tecplayacar.edu.mx',
    displayName: 'Contabilidad QA',
    role: 'contabilidad',
    permissions: [WEB_PERMISSIONS.financeExport]
  });
}
