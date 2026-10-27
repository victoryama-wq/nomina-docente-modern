import { describe, expect, it } from 'vitest';
import { canUseDossier, type DossierAction } from '../lib/dossier-policy.js';
import { contactSchema, decodeDossierPdf, deleteSchema, uploadSchema } from '../lib/dossier-contract.js';
import { adminActor, createSessionUser, financeActor, rhActor } from './fixtures/index.js';

describe('H24 dossier authorization and contracts', () => {
  const actions: DossierAction[] = ['view', 'read', 'manage', 'contact'];
  it('grants active Admin full access without permission array or protected flag', () => {
    const admin = { ...adminActor(), permissions: [], isProtectedSuperAdmin: false };
    for (const action of actions) expect(canUseDossier(admin, action)).toBe(true);
    for (const action of actions) expect(canUseDossier({ ...admin, status: 'INACTIVO' }, action)).toBe(false);
  });
  it.each(['coordinador', 'direccion', 'contador', 'contabilidad'] as const)('denies %s even with broad fiscal permissions', (role) => {
    const actor = createSessionUser({ role, permissions: adminActor().permissions });
    for (const action of actions) expect(canUseDossier(actor, action)).toBe(false);
  });
  it.each([financeActor(), rhActor()])('checks permissions independently for $role', (actor) => {
    for (const action of actions) expect(canUseDossier(actor, action)).toBe(true);
    const readOnly = { ...actor, permissions: ['fiscal.view', 'fiscal.document.view'] };
    expect(canUseDossier(readOnly, 'read')).toBe(true);
    expect(canUseDossier(readOnly, 'manage')).toBe(false);
    expect(canUseDossier(readOnly, 'contact')).toBe(false);
    expect(canUseDossier({ ...actor, permissions: ['fiscal.document.manage'] }, 'manage')).toBe(false);
    expect(canUseDossier({ ...actor, permissions: ['fiscal.view', 'fiscal.document.manage'] }, 'read')).toBe(true);
  });
  it('retains the active protected administrator exception', () => {
    expect(canUseDossier(createSessionUser({ isProtectedSuperAdmin: true, permissions: [] }), 'manage')).toBe(true);
  });
  it('accepts existing telephone format but rejects unrelated properties', () => {
    const payload = { operationId: '11111111-1111-4111-8111-111111111111', expectedVersion: 'version', phone: '+52 998 123 4567' };
    expect(contactSchema.safeParse(payload).success).toBe(true);
    expect(contactSchema.safeParse({ ...payload, phone: '123' }).success).toBe(false);
    for (const field of ['email', 'rfc', 'paymentType', 'createdBy', 'coordinationId']) {
      expect(contactSchema.safeParse({ ...payload, [field]: 'changed' }).success).toBe(false);
    }
    expect(contactSchema.safeParse({ ...payload, phone: '' }).success).toBe(true);
  });
  it('rejects malformed/noncanonical Base64 before parsing a PDF', () => {
    for (const value of ['', 'abc', '!!!!', 'ZE==', 'dGVzdA==\n']) expect(() => decodeDossierPdf(value)).toThrow();
    expect(decodeDossierPdf('dGVzdA==').toString()).toBe('test');
  });
  it('rejects unsafe file names and extra upload fields', () => {
    const payload = { operationId: '11111111-1111-4111-8111-111111111111', documentType: 'CURP', title: 'Documento',
      fileName: 'documento.pdf', mimeType: 'application/pdf', base64Data: 'dGVzdA==' };
    expect(uploadSchema.safeParse(payload).success).toBe(true);
    for (const fileName of ['../document.pdf', 'a\\b.pdf', 'bad\nname.pdf', 'test.html']) {
      expect(uploadSchema.safeParse({ ...payload, fileName }).success).toBe(false);
    }
    expect(uploadSchema.safeParse({ ...payload, teacherId: 'other' }).success).toBe(false);
    expect(deleteSchema.safeParse({ operationId: payload.operationId, expectedRevision: 0 }).success).toBe(false);
  });
});
