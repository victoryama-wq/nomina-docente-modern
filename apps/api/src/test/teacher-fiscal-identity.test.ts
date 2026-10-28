import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionUser } from './fixtures/index.js';
import { clearTestActors, injectAs } from './auth-test-utils.js';

const mocks = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('../firebase.js', () => ({ firebaseAdmin: {} }));
vi.mock('../db.js', () => ({
  query: async (sql: string, values: unknown[]) => (await mocks.sql(sql, values)).rows,
  withTransaction: async (work: (client: unknown) => unknown) => work({ query: mocks.sql })
}));
import { registerTeacherRoutes } from '../routes/teachers.js';

const id = '00000000-0000-4000-8000-000000000001';
const url = `/teachers/${id}/fiscal`;
const actor = (role: ReturnType<typeof createSessionUser>['role'] = 'admin', permissions = ['fiscal.view', 'fiscal.manage']) =>
  createSessionUser({ role, isProtectedSuperAdmin: false, permissions });
const original = () => ({ id, fullName: 'Docente sintetico', status: 'ACTIVO', category: 'N',
  paymentType: 'E', rfc: '', email: '', bankDetail: '', fiscalPostalCode: '01234', curp: 'TEST010101HQRXXX09' });
let row: ReturnType<typeof original>;
let app: FastifyInstance;
beforeEach(async () => {
  row = original();
  mocks.sql.mockReset().mockImplementation(async (sql: string, values: unknown[] = []) => {
    if (sql.includes('UPDATE teachers')) {
      row = { ...row, fiscalPostalCode: values[6] as string ?? row.fiscalPostalCode, curp: values[7] as string ?? row.curp };
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('FROM teachers t')) return { rows: [{ ...row }] };
    return { rows: [] };
  });
  app = Fastify(); await registerTeacherRoutes(app);
});
afterEach(async () => { await app.close(); clearTestActors(); });

describe('H24 fiscal postal code and CURP', () => {
  it.each(['admin', 'finanzas', 'rh'] as const)('allows %s, normalizes CURP and audits field names without values', async role => {
    const response = await injectAs(app, actor(role), { method: 'PATCH', url,
      payload: { paymentType: 'E', fiscalPostalCode: ' 00123 ', curp: ' test020202hqrxxx09 ' } });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().teacher).toMatchObject({ fiscalPostalCode: '00123', curp: 'TEST020202HQRXXX09' });
    const audit = mocks.sql.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_log'))![1];
    expect(JSON.stringify(audit)).not.toMatch(/TEST010101HQRXXX09|TEST020202HQRXXX09|00123|01234/);
    expect(JSON.parse(audit[5]).identityFieldsChanged).toEqual(['curp', 'fiscalPostalCode']);
  });
  it.each(['coordinador', 'direccion', 'contador', 'contabilidad'] as const)('denies %s even with fiscal permissions and redacts the list', async role => {
    expect((await injectAs(app, actor(role), { method: 'PATCH', url, payload: { paymentType: 'E', curp: row.curp } })).statusCode).toBe(403);
    expect(mocks.sql).not.toHaveBeenCalled();
    const response = await injectAs(app, actor(role), { method: 'GET', url: '/teachers' });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().teachers[0]).toMatchObject({ curp: '', fiscalPostalCode: '' });
    expect(response.body).not.toContain(row.curp);
    expect(response.body).not.toContain(row.fiscalPostalCode);
  });
  it('requires fiscal edit, not document edit, and rejects missing session', async () => {
    expect((await injectAs(app, actor('rh', ['fiscal.view', 'fiscal.document.manage']), { method: 'PATCH', url, payload: { paymentType: 'E' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url, payload: { paymentType: 'E' } })).statusCode).toBe(401);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it.each([{ fiscalPostalCode: '1234' }, { fiscalPostalCode: '123456' }, { fiscalPostalCode: '12a45' },
    { fiscalPostalCode: 12345 }, { fiscalPostalCode: null }, { curp: 'INVALIDA' }, { curp: 'X'.repeat(18) }, { curp: null }])('rejects invalid identity %j before SQL', async fields => {
    const response = await injectAs(app, actor(), { method: 'PATCH', url, payload: { paymentType: 'E', ...fields } });
    expect(response.statusCode).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it('preserves omitted fields for older callers and allows explicit clearing', async () => {
    const legacy = await injectAs(app, actor(), { method: 'PATCH', url, payload: { paymentType: 'E' } });
    expect(legacy.json().teacher).toMatchObject(original());
    const clear = await injectAs(app, actor(), { method: 'PATCH', url, payload: { paymentType: 'E', fiscalPostalCode: '', curp: '' } });
    expect(clear.json().teacher).toMatchObject({ fiscalPostalCode: '', curp: '' });
  });
  it('does not add fiscal identity to existing directory CSV columns', async () => {
    const response = await injectAs(app, actor(), { method: 'GET', url: '/teachers/export/active' });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toMatch(/CURP|fiscalPostalCode|TEST010101HQRXXX09|01234/);
  });
});
