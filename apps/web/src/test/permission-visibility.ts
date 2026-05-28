import type { ActorCoordination, ExtraRecord, SessionUser } from '../api';

function hasPermission(session: SessionUser, permission: string) {
  return session.role === 'admin' || session.isProtectedSuperAdmin || session.permissions.includes(permission);
}

export function payrollVisibility(session: SessionUser) {
  const canPreview = hasPermission(session, 'payroll.preview') || hasPermission(session, 'payroll.calculate');
  const canView = canPreview || hasPermission(session, 'payroll.view');
  const canFinalize = hasPermission(session, 'payroll.finalize');

  return {
    canOpenModule: canView,
    isPreviewOnly: canPreview && !canFinalize,
    showSavePayroll: canFinalize,
    showWorkflowActions: false
  };
}

export function financeVisibility(session: SessionUser) {
  const canExport = hasPermission(session, 'finance.export');
  const canWorkflow = hasPermission(session, 'finance.workflow');
  const canViewFiscal = hasPermission(session, 'fiscal.view') || hasPermission(session, 'fiscal.manage');

  return {
    canOpenModule:
      hasPermission(session, 'finance.view') || hasPermission(session, 'finance.global_view') || canExport,
    showExportActions: canExport,
    showWorkflowActions: canWorkflow,
    showFiscalExport: canExport && canViewFiscal,
    showFiscalSensitiveData: canViewFiscal
  };
}

export function fiscalVisibility(session: SessionUser) {
  const canView = hasPermission(session, 'fiscal.view') || hasPermission(session, 'fiscal.manage');

  return {
    canOpenModule: canView,
    showFiscalEditActions: hasPermission(session, 'fiscal.manage'),
    showDocumentViewActions: hasPermission(session, 'fiscal.document.view') || hasPermission(session, 'fiscal.document.manage'),
    showDocumentManageActions: hasPermission(session, 'fiscal.document.manage')
  };
}

export function teacherModalVisibility(session: SessionUser, isEditing: boolean) {
  const canManageFiscal = hasPermission(session, 'fiscal.manage');

  return {
    showFiscalFields: canManageFiscal,
    showFiscalRestrictionHint: !canManageFiscal,
    showConstanciaUpload: isEditing && hasPermission(session, 'fiscal.document.manage')
  };
}

export function operationalCoordinationState(actorCoordinations: ActorCoordination[]) {
  if (actorCoordinations.length === 0) {
    return {
      mode: 'blocked' as const,
      selectedCoordinationId: null,
      options: []
    };
  }

  if (actorCoordinations.length === 1) {
    return {
      mode: 'single' as const,
      selectedCoordinationId: actorCoordinations[0].id,
      options: actorCoordinations
    };
  }

  return {
    mode: 'multiple' as const,
    selectedCoordinationId: actorCoordinations.find((coordination) => coordination.isPrimary)?.id || actorCoordinations[0].id,
    options: actorCoordinations
  };
}

export function canEditExtraRecord(extra: Pick<ExtraRecord, 'canEdit' | 'accessStartAt' | 'accessEndAt'>) {
  return Boolean(extra.canEdit && extra.accessStartAt && extra.accessEndAt);
}
