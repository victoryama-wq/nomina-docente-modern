export const PERMISSIONS = {
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
  statisticsView: 'statistics.view',
  financeView: 'finance.view',
  financeGlobalView: 'finance.global_view',
  financeExport: 'finance.export',
  financeWorkflow: 'finance.workflow',
  fiscalView: 'fiscal.view',
  fiscalManage: 'fiscal.manage',
  fiscalDocumentView: 'fiscal.document.view',
  fiscalDocumentManage: 'fiscal.document.manage',
  calendarManage: 'calendar.manage',
  closuresManage: 'closures.manage',
  accessManage: 'access.manage',
  auditView: 'audit.view'
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ADMIN_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);

export const COORDINATOR_PERMISSIONS: PermissionCode[] = [
  PERMISSIONS.dashboardView,
  PERMISSIONS.teachersManage,
  PERMISSIONS.schedulesManage,
  PERMISSIONS.incidencesManage,
  PERMISSIONS.extrasManage,
  PERMISSIONS.payrollView,
  PERMISSIONS.payrollPreview,
  PERMISSIONS.reportsView
];

export const RH_PERMISSIONS: PermissionCode[] = [
  PERMISSIONS.dashboardView,
  PERMISSIONS.teachersManage,
  PERMISSIONS.payrollView,
  PERMISSIONS.reportsView,
  PERMISSIONS.fiscalView,
  PERMISSIONS.fiscalManage,
  PERMISSIONS.fiscalDocumentView,
  PERMISSIONS.fiscalDocumentManage
];

export const FINANCE_PERMISSIONS: PermissionCode[] = [
  PERMISSIONS.dashboardView,
  PERMISSIONS.payrollView,
  PERMISSIONS.reportsView,
  PERMISSIONS.financeView,
  PERMISSIONS.financeExport,
  PERMISSIONS.financeWorkflow,
  PERMISSIONS.fiscalView,
  PERMISSIONS.fiscalManage,
  PERMISSIONS.fiscalDocumentView,
  PERMISSIONS.fiscalDocumentManage
];

export const DIRECTION_PERMISSIONS: PermissionCode[] = [
  PERMISSIONS.dashboardView,
  PERMISSIONS.teachersManage,
  PERMISSIONS.schedulesManage,
  PERMISSIONS.incidencesManage,
  PERMISSIONS.extrasManage,
  PERMISSIONS.payrollView,
  PERMISSIONS.payrollPreview,
  PERMISSIONS.reportsView,
  PERMISSIONS.financeGlobalView
];

export const ACCOUNTANT_PERMISSIONS: PermissionCode[] = [
  PERMISSIONS.dashboardView,
  PERMISSIONS.payrollView,
  PERMISSIONS.reportsView,
  PERMISSIONS.statisticsView,
  PERMISSIONS.financeView,
  PERMISSIONS.financeExport
];
