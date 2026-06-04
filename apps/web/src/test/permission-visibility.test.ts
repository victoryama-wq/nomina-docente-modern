import { describe, expect, it } from 'vitest';
import type { ExtraRecord } from '../api';
import {
  accountingSession,
  accountantSession,
  adminSession,
  coordinatorSession,
  coordinatorWithoutCoordinationSession,
  directionSession,
  financeSession,
  multiCoordinatorSession,
  rhSession
} from './fixtures/session-users';
import {
  canCaptureExtrasForCycle,
  canCaptureIncidencesForCycle,
  canCaptureSchedulesForCycle,
  canEditExtraRecord,
  canUsePayrollForCycle,
  cycleStatusLabel,
  financeWorkflowVisibilityForRun,
  financeVisibility,
  fiscalVisibility,
  operationalCoordinationState,
  payrollVisibility,
  teacherModalVisibility
} from './permission-visibility';

describe('frontend permission visibility helpers', () => {
  it('keeps payroll preview read-only for Coordinador and exposes save only to finalize-capable users', () => {
    const coordinator = payrollVisibility(coordinatorSession());
    const finance = payrollVisibility(financeSession());

    expect(coordinator.canOpenModule).toBe(true);
    expect(coordinator.isPreviewOnly).toBe(true);
    expect(coordinator.showSavePayroll).toBe(false);
    expect(coordinator.showWorkflowActions).toBe(false);

    expect(finance.canOpenModule).toBe(true);
    expect(finance.showSavePayroll).toBe(false);
  });

  it('separates finance view, export, workflow and fiscal-sensitive data', () => {
    const direction = financeVisibility(directionSession());
    const accountant = financeVisibility(accountantSession());
    const accounting = financeVisibility(accountingSession());
    const finance = financeVisibility(financeSession());

    expect(direction.canOpenModule).toBe(true);
    expect(direction.showWorkflowActions).toBe(false);
    expect(direction.showFiscalSensitiveData).toBe(false);

    expect(accountant.showExportActions).toBe(true);
    expect(accountant.showWorkflowActions).toBe(false);
    expect(accounting.showExportActions).toBe(true);
    expect(accounting.showWorkflowActions).toBe(false);

    expect(finance.showExportActions).toBe(true);
    expect(finance.showWorkflowActions).toBe(true);
    expect(finance.showFiscalExport).toBe(true);
  });

  it('separates fiscal view, fiscal edit and document actions', () => {
    const coordinator = fiscalVisibility(coordinatorSession());
    const rh = fiscalVisibility(rhSession());

    expect(coordinator.canOpenModule).toBe(false);
    expect(coordinator.showFiscalEditActions).toBe(false);
    expect(coordinator.showDocumentViewActions).toBe(false);
    expect(coordinator.showDocumentManageActions).toBe(false);

    expect(rh.canOpenModule).toBe(true);
    expect(rh.showFiscalEditActions).toBe(true);
    expect(rh.showDocumentViewActions).toBe(true);
    expect(rh.showDocumentManageActions).toBe(true);
  });

  it('hides teacher fiscal fields for users without fiscal.manage and shows them for RH/Finanzas', () => {
    expect(teacherModalVisibility(coordinatorSession(), false)).toMatchObject({
      showFiscalFields: false,
      showFiscalRestrictionHint: true,
      showConstanciaUpload: false
    });

    expect(teacherModalVisibility(rhSession(), true)).toMatchObject({
      showFiscalFields: true,
      showFiscalRestrictionHint: false,
      showConstanciaUpload: true
    });

    expect(teacherModalVisibility(financeSession(), true)).toMatchObject({
      showFiscalFields: true,
      showConstanciaUpload: true
    });
  });

  it('models operational coordination states for one, multiple and missing coordinations', () => {
    const single = operationalCoordinationState(coordinatorSession().actorCoordinations);
    const multiple = operationalCoordinationState(multiCoordinatorSession().actorCoordinations);
    const missing = operationalCoordinationState(coordinatorWithoutCoordinationSession().actorCoordinations);

    expect(single.mode).toBe('single');
    expect(single.selectedCoordinationId).toBe(coordinatorSession().actorCoordinations[0].id);

    expect(multiple.mode).toBe('multiple');
    expect(multiple.options).toHaveLength(4);
    expect(multiple.selectedCoordinationId).toBe(multiCoordinatorSession().actorCoordinations[0].id);

    expect(missing.mode).toBe('blocked');
    expect(missing.options).toHaveLength(0);
  });

  it('keeps Extras edit/delete visibility tied to backend ownership flag and open access window', () => {
    const editableExtra = {
      canEdit: true,
      accessStartAt: '2026-05-15T00:00:00.000Z',
      accessEndAt: '2026-05-28T23:59:59.000Z'
    } satisfies Pick<ExtraRecord, 'canEdit' | 'accessStartAt' | 'accessEndAt'>;

    expect(canEditExtraRecord(editableExtra)).toBe(true);
    expect(canEditExtraRecord({ ...editableExtra, canEdit: false })).toBe(false);
    expect(canEditExtraRecord({ ...editableExtra, accessEndAt: null })).toBe(false);
  });

  it('labels PLANEACION as the technical draft state and keeps CERRADO irreversible visually', () => {
    expect(cycleStatusLabel('PLANEACION')).toBe('Planeacion/Borrador');
    expect(cycleStatusLabel('ACTIVO')).toBe('Activo');
    expect(cycleStatusLabel('CERRADO')).toBe('Cerrado');
  });

  it('allows Horarios in PLANEACION but blocks Incidencias, Extras and Nomina until ACTIVO', () => {
    expect(canCaptureSchedulesForCycle('PLANEACION', true)).toBe(true);
    expect(canCaptureSchedulesForCycle('ACTIVO', true)).toBe(true);
    expect(canCaptureSchedulesForCycle('CERRADO', true)).toBe(false);

    expect(canCaptureIncidencesForCycle('PLANEACION', true)).toBe(false);
    expect(canCaptureIncidencesForCycle('ACTIVO', true)).toBe(true);
    expect(canCaptureIncidencesForCycle('CERRADO', true)).toBe(false);

    expect(canCaptureExtrasForCycle('PLANEACION', true)).toBe(false);
    expect(canCaptureExtrasForCycle('ACTIVO', true)).toBe(true);
    expect(canCaptureExtrasForCycle('CERRADO', true)).toBe(false);

    expect(canUsePayrollForCycle('PLANEACION', true)).toBe(false);
    expect(canUsePayrollForCycle('ACTIVO', true)).toBe(true);
    expect(canUsePayrollForCycle('CERRADO', true)).toBe(false);
  });

  it('keeps finance cancellation unavailable for PAGADA and only exposes workflow to Finanzas/Admin', () => {
    expect(financeWorkflowVisibilityForRun(financeSession(), 'APROBADA')).toMatchObject({
      showMarkPaid: true,
      showCancelForCorrection: true
    });

    expect(financeWorkflowVisibilityForRun(financeSession(), 'PAGADA')).toMatchObject({
      showReview: false,
      showApprove: false,
      showMarkPaid: false,
      showCancelForCorrection: false
    });

    expect(financeWorkflowVisibilityForRun(accountantSession(), 'APROBADA').showCancelForCorrection).toBe(false);
    expect(financeWorkflowVisibilityForRun(adminSession(), 'CALCULADA').showReview).toBe(true);
  });
});
