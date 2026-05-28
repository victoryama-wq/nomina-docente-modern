import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  accountingActor,
  accountingScope,
  accountantActor,
  accountantScope,
  adminActor,
  coordinatorActor,
  coordinatorScope,
  coordinatorWithoutCoordinationActor,
  directionActor,
  directionScope,
  financeActor,
  multiCoordinatorActor,
  multiCoordinatorScope,
  rhActor
} from './index.js';

describe('H04 actor fixtures', () => {
  it('models admin with expected global permissions', () => {
    const actor = adminActor();

    expect(actor.role).toBe('admin');
    expect(actor.isProtectedSuperAdmin).toBe(true);
    expect(actor.permissions).toContain(PERMISSIONS.accessManage);
    expect(actor.permissions).toContain(PERMISSIONS.fiscalManage);
    expect(actor.permissions).toContain(PERMISSIONS.financeWorkflow);
    expect(actor.permissions).toContain(PERMISSIONS.payrollFinalize);
    expect(actor.permissions).toContain(PERMISSIONS.payrollPreview);
  });

  it('models coordinator with exactly one assigned coordination and no fiscal/finalize permissions', () => {
    const actor = coordinatorActor();
    const scope = coordinatorScope();

    expect(actor.role).toBe('coordinador');
    expect(actor.actorCoordinations).toHaveLength(1);
    expect(scope.coordinationIds).toEqual([actor.actorCoordinations[0]?.id]);
    expect(actor.permissions).toContain(PERMISSIONS.payrollPreview);
    expect(actor.permissions).not.toContain(PERMISSIONS.fiscalManage);
    expect(actor.permissions).not.toContain(PERMISSIONS.fiscalView);
    expect(actor.permissions).not.toContain(PERMISSIONS.financeWorkflow);
    expect(actor.permissions).not.toContain(PERMISSIONS.financeExport);
    expect(actor.permissions).not.toContain(PERMISSIONS.payrollFinalize);
  });

  it('models coordinator with multiple assigned coordinations', () => {
    const actor = multiCoordinatorActor();
    const scope = multiCoordinatorScope();

    expect(actor.role).toBe('coordinador');
    expect(actor.actorCoordinations.map((coordination) => coordination.name)).toEqual([
      'ADETUR',
      'ARQ',
      'SISCOM',
      'DIGRAF'
    ]);
    expect(scope.coordinationIds).toHaveLength(4);
  });

  it('models coordinator without coordination for operational blocking tests', () => {
    const actor = coordinatorWithoutCoordinationActor();

    expect(actor.role).toBe('coordinador');
    expect(actor.actorCoordinations).toEqual([]);
  });

  it('models RH with fiscal manage and without financial workflow', () => {
    const actor = rhActor();

    expect(actor.role).toBe('rh');
    expect(actor.permissions).toContain(PERMISSIONS.fiscalManage);
    expect(actor.permissions).toContain(PERMISSIONS.fiscalDocumentManage);
    expect(actor.permissions).not.toContain(PERMISSIONS.financeWorkflow);
    expect(actor.permissions).not.toContain(PERMISSIONS.payrollFinalize);
  });

  it('models Finanzas with workflow and fiscal permissions, but without payroll finalize', () => {
    const actor = financeActor();

    expect(actor.role).toBe('finanzas');
    expect(actor.permissions).toContain(PERMISSIONS.financeWorkflow);
    expect(actor.permissions).toContain(PERMISSIONS.financeExport);
    expect(actor.permissions).toContain(PERMISSIONS.fiscalManage);
    expect(actor.permissions).not.toContain(PERMISSIONS.payrollFinalize);
  });

  it('models Direccion without fiscal manage, financial workflow or payroll finalize', () => {
    const actor = directionActor();
    const scope = directionScope();

    expect(actor.role).toBe('direccion');
    expect(scope.hasGlobalAccess).toBe(true);
    expect(actor.permissions).toContain(PERMISSIONS.payrollPreview);
    expect(actor.permissions).toContain(PERMISSIONS.financeGlobalView);
    expect(actor.permissions).not.toContain(PERMISSIONS.fiscalManage);
    expect(actor.permissions).not.toContain(PERMISSIONS.fiscalDocumentManage);
    expect(actor.permissions).not.toContain(PERMISSIONS.financeWorkflow);
    expect(actor.permissions).not.toContain(PERMISSIONS.payrollFinalize);
  });

  it('models Contador and Contabilidad as equivalent export-only finance roles', () => {
    const accountant = accountantActor();
    const accounting = accountingActor();

    expect(accountant.role).toBe('contador');
    expect(accounting.role).toBe('contabilidad');
    expect(accountant.permissions).toEqual(accounting.permissions);
    expect(accountantScope().hasGlobalAccess).toBe(true);
    expect(accountingScope().hasGlobalAccess).toBe(true);
    expect(accountant.permissions).toContain(PERMISSIONS.financeExport);
    expect(accountant.permissions).not.toContain(PERMISSIONS.fiscalManage);
    expect(accountant.permissions).not.toContain(PERMISSIONS.fiscalDocumentManage);
    expect(accountant.permissions).not.toContain(PERMISSIONS.financeWorkflow);
  });
});
