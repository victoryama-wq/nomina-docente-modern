import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { TeacherDossierService } from '../lib/teacher-dossier.js';
import { DocumentSecurityError } from '../lib/document-security.js';
import { adminActor } from './fixtures/index.js';

const db = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), connect: vi.fn(), clientQuery: vi.fn() }));
vi.mock('../db.js', () => ({ query: db.query, withTransaction: db.transaction, pool: { connect: db.connect } }));

const operationId = '11111111-1111-4111-8111-111111111111';
const teacherId = '33333333-3333-4333-8333-333333333333';
const documentId = '44444444-4444-4444-8444-444444444444';
const bytes = Buffer.from('synthetic content checked by injected validator');
const contentHash = createHash('sha256').update(bytes).digest('hex');
const input = { operationId, fileName: 'synthetic.pdf', mimeType: 'application/pdf' as const,
  base64Data: bytes.toString('base64'), documentType: 'OTRO' as const, title: 'Synthetic' };

function fixture(action: 'UPLOAD' | 'REPLACE' = 'UPLOAD') {
  const op = { id: operationId, teacher_id: teacherId, document_id: documentId,
    actor_id: adminActor().id, request_hash: 'synthetic', action, state: 'PREPARED',
    storage_namespace: 'test', new_key: 'candidate', new_generation: null,
    old_key: action === 'REPLACE' ? 'previous' : null, old_generation: '1',
    payload: { contentHash }, result: {}, error_code: null as string | null };
  const storage = { assertSafe: vi.fn(), stat: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue({ key: 'candidate', generation: '2' }),
    read: vi.fn().mockResolvedValue(bytes), remove: vi.fn() };
  const validator = vi.fn<(data: Buffer) => Promise<void>>().mockResolvedValue();
  const service = new TeacherDossierService(storage, 'test', validator);
  db.transaction.mockResolvedValue(op);
  db.query.mockResolvedValueOnce([]).mockImplementation(async () => [op]);
  db.connect.mockResolvedValue({ query: db.clientQuery, release: vi.fn() });
  db.clientQuery.mockImplementation(async (sql: string, params?: any[]) => {
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] };
    if (sql.startsWith('SELECT * FROM teacher_dossier_operations')) return { rows: [op] };
    if (sql.includes('FROM app_users')) return { rows: [adminActor()] };
    if (sql.includes("SET state='CLEANUP',new_generation")) {
      op.state = 'CLEANUP'; op.result = { revision: 2 };
    }
    if (sql.includes("SET state='ABORTING',new_generation")) {
      op.state = 'ABORTING'; op.error_code = params![2]; op.new_generation = params![1];
    }
    if (sql.includes('SET state=$2,new_key=NULL')) op.state = params![1];
    return { rows: sql.includes('RETURNING revision') ? [{ revision: 2 }] : [], rowCount: 1 };
  });
  const submit = () => action === 'UPLOAD' ? service.upload(adminActor(), teacherId, input)
    : service.replace(adminActor(), teacherId, documentId, { operationId, expectedRevision: 1,
      fileName: input.fileName, mimeType: input.mimeType, base64Data: input.base64Data });
  return { service, storage, validator, op, submit };
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('request-local validation receipt', () => {
  it.each(['UPLOAD', 'REPLACE'] as const)('%s binds one completed analysis to identical stored bytes', async action => {
    const { submit, storage, validator } = fixture(action);
    await expect(submit()).resolves.toMatchObject({ state: 'COMPLETE' });
    expect(validator).toHaveBeenCalledExactlyOnceWith(bytes);
    expect(storage.read).toHaveBeenCalledExactlyOnceWith({ key: 'candidate', generation: '2' });
    expect(validator.mock.invocationCallOrder[0]).toBeLessThan(db.transaction.mock.invocationCallOrder[0]);
    expect(storage.read.mock.invocationCallOrder[0]).toBeLessThan(db.clientQuery.mock.invocationCallOrder[
      db.clientQuery.mock.calls.findIndex(([sql]) => sql.includes('SET storage_key='))]);
  });

  it.each([30001, -1])('revalidates after expired or reversed clock (%i ms)', async age => {
    const f = fixture(); let now = 100000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    f.storage.read.mockImplementation(async () => { now += age; return bytes; });
    await expect(f.submit()).resolves.toMatchObject({ state: 'COMPLETE' });
    expect(f.validator).toHaveBeenCalledTimes(2);
  });

  it('never trusts a hash mismatch even with a fresh successful request analysis', async () => {
    const f = fixture(); f.storage.read.mockResolvedValue(Buffer.from('different stored bytes'));
    await expect(f.submit()).resolves.toMatchObject({ state: 'PREPARED' });
    expect(f.validator).toHaveBeenCalledOnce();
    expect(db.clientQuery.mock.calls.some(([sql]) => sql.includes('SET storage_key='))).toBe(false);
    expect(f.storage.remove).not.toHaveBeenCalled();
  });

  it('does not reuse a receipt for another operation ID', async () => {
    const f = fixture(); f.op.id = '55555555-5555-4555-8555-555555555555';
    await expect(f.submit()).resolves.toMatchObject({ state: 'COMPLETE' });
    expect(f.validator).toHaveBeenCalledTimes(2);
  });

  it('public worker processing revalidates even when a caller supplies the original bytes', async () => {
    const f = fixture(); db.query.mockReset(); db.query.mockResolvedValue([f.op]);
    await expect(f.service.process(operationId, bytes)).resolves.toMatchObject({ state: 'COMPLETE' });
    expect(f.validator).toHaveBeenCalledExactlyOnceWith(bytes);
  });

  it('does not issue a receipt or persist on initial rejection', async () => {
    const f = fixture(); f.validator.mockRejectedValue(new DocumentSecurityError('DOCUMENT_REJECTED'));
    await expect(f.submit()).rejects.toMatchObject({ code: 'DOCUMENT_REJECTED' });
    expect(db.transaction).not.toHaveBeenCalled(); expect(db.connect).not.toHaveBeenCalled();
    expect(f.storage.put).not.toHaveBeenCalled();
  });

  it('expired receipt plus rejected revalidation aborts only the replacement candidate', async () => {
    const f = fixture('REPLACE'); let now = 100000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    f.storage.read.mockImplementation(async () => { now += 30001; return bytes; });
    f.validator.mockResolvedValueOnce().mockRejectedValueOnce(new DocumentSecurityError('DOCUMENT_REJECTED'));
    await expect(f.submit()).resolves.toMatchObject({ state: 'FAILED', errorCode: 'DOCUMENT_REJECTED' });
    expect(f.validator).toHaveBeenCalledTimes(2);
    expect(f.storage.remove).toHaveBeenCalledExactlyOnceWith({ key: 'candidate', generation: '2' });
    expect(db.clientQuery.mock.calls.some(([sql]) => sql.includes('SET storage_key='))).toBe(false);
  });

  it('does not publish if persisted authorization changed after initial validation', async () => {
    const f = fixture(); const normal = db.clientQuery.getMockImplementation()!;
    db.clientQuery.mockImplementation(async (sql: string, params?: any[]) => sql.includes('FROM app_users')
      ? { rows: [{ ...adminActor(), status: 'INACTIVO' }] } : normal(sql, params));
    await expect(f.submit()).resolves.toMatchObject({ state: 'FAILED', errorCode: 'AUTHORIZATION_REVOKED' });
    expect(db.clientQuery.mock.calls.some(([sql]) => sql.includes('SET storage_key='))).toBe(false);
  });
});
