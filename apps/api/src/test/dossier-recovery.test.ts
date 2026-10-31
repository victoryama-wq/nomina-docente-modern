import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeacherDossierService } from '../lib/teacher-dossier.js';
import type { DossierStorage } from '../lib/dossier-storage.js';
import { createHash } from 'node:crypto';
import { DocumentSecurityError } from '../lib/document-security.js';
import { adminActor } from './fixtures/index.js';

const db = vi.hoisted(() => ({
  connect: vi.fn(), query: vi.fn(), transaction: vi.fn(),
  clientQuery: vi.fn(), release: vi.fn()
}));

vi.mock('../db.js', () => ({
  pool: { connect: db.connect }, query: db.query, withTransaction: db.transaction
}));
vi.mock('../auth.js', () => ({ authenticate: vi.fn(() => { throw new Error('Unexpected authentication'); }) }));

const operationId = '11111111-1111-4111-8111-111111111111';
const namespace = 'synthetic-storage';
const privateDiagnostic = 'synthetic-private-bucket/object.pdf token=synthetic-secret base64=cHJpdmF0ZQ==';

function operation(state = 'PREPARED', errorCode: string | null = null) {
  return { id: operationId, actor_id: '22222222-2222-4222-8222-222222222222',
    teacher_id: '33333333-3333-4333-8333-333333333333',
    document_id: '44444444-4444-4444-8444-444444444444', action: 'UPLOAD',
    request_hash: 'a'.repeat(64), state, storage_namespace: namespace,
    new_key: 'private-object-key', new_generation: null, old_key: null, old_generation: null,
    payload: { contentHash: 'b'.repeat(64) }, result: {}, error_code: errorCode };
}

function fixture() {
  const storage = {
    assertSafe: vi.fn<() => Promise<void>>(), put: vi.fn(), stat: vi.fn(), read: vi.fn(), remove: vi.fn()
  } satisfies DossierStorage;
  const validator = vi.fn<() => Promise<void>>();
  return { storage, validator, service: new TeacherDossierService(storage, namespace, validator) };
}

function expectDiscarded() {
  expect(db.release).toHaveBeenCalledTimes(1);
  const error = db.release.mock.calls[0][0] as Error;
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe('Dossier worker connection unavailable');
  expect(String(error)).not.toContain(privateDiagnostic);
  expect(db.clientQuery).toHaveBeenCalledWith(
    'SELECT pg_advisory_unlock(hashtextextended($1, 25))', [operationId]
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  db.connect.mockResolvedValue({ query: db.clientQuery, release: db.release });
  db.query.mockImplementation(() => { throw new Error('Unexpected pool query'); });
  db.transaction.mockImplementation(() => { throw new Error('Unexpected transaction'); });
  db.clientQuery.mockImplementation(() => { throw new Error('Unexpected client query'); });
});

describe('H24 dossier worker connection recovery without a database', () => {
  it.each(['DOCUMENT_REJECTED', 'DOCUMENT_SCAN_LIMIT_EXCEEDED'] as const)('revalidates recovered bytes and removes only the rejected replacement on %s', async code => {
    const { service, storage, validator } = fixture();
    const bytes = Buffer.from('synthetic candidate');
    const op = { ...operation(), action: 'REPLACE', old_key: 'previous', old_generation: '1',
      new_generation: '2', payload: { contentHash: createHash('sha256').update(bytes).digest('hex') } };
    const aborted = { ...op, state: 'ABORTING', error_code: code };
    storage.stat.mockResolvedValueOnce({ key: op.new_key, generation: '2' }).mockResolvedValue(null);
    storage.read.mockResolvedValue(bytes);
    validator.mockRejectedValue(new DocumentSecurityError(code));
    let reads = 0;
    db.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] };
      if (sql.startsWith('SELECT * FROM teacher_dossier_operations')) return { rows: [reads++ ? aborted : op] };
      return { rows: [], rowCount: 1 };
    });
    db.query.mockResolvedValue([{ ...aborted, state: 'FAILED' }]);
    await expect(service.process(operationId)).resolves.toMatchObject({ state: 'FAILED', errorCode: code });
    expect(validator).toHaveBeenCalledExactlyOnceWith(bytes);
    expect(storage.remove).toHaveBeenCalledExactlyOnceWith({ key: op.new_key, generation: '2' });
    expect(db.clientQuery).toHaveBeenCalledWith(expect.stringContaining("state='AVAILABLE' WHERE id=$1 AND state='REPLACING'"), [op.document_id]);
    expect(JSON.stringify(db.clientQuery.mock.calls)).not.toMatch(/SET storage_key|DELETE FROM teacher_dossier_documents/);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('keeps recovered replacement pending without publishing or deleting when the scanner is unavailable', async () => {
    const { service, storage, validator } = fixture();
    const bytes = Buffer.from('synthetic candidate');
    const op = { ...operation(), payload: { contentHash: createHash('sha256').update(bytes).digest('hex') } };
    storage.stat.mockResolvedValue({ key: op.new_key, generation: '2' });
    storage.read.mockResolvedValue(bytes);
    validator.mockRejectedValue(new DocumentSecurityError('DOCUMENT_SECURITY_UNAVAILABLE'));
    db.clientQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes('pg_try_advisory_lock') ? [{ locked: true }]
      : sql.startsWith('SELECT *') ? [op] : [], rowCount: 1 }));
    db.query.mockResolvedValue([{ ...op, error_code: 'DOSSIER_RETRY_REQUIRED' }]);
    await expect(service.process(operationId)).resolves.toMatchObject({ state: 'PREPARED', errorCode: 'DOSSIER_RETRY_REQUIRED' });
    expect(JSON.stringify(db.clientQuery.mock.calls)).not.toMatch(/SET storage_key|ABORTING|BEGIN/);
    expect(storage.remove).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
  });

  it.each(['DOCUMENT_REJECTED', 'DOCUMENT_SCAN_LIMIT_EXCEEDED', 'DOCUMENT_SECURITY_UNAVAILABLE'] as const)('never serves existing bytes on %s and does not delete the object', async code => {
    const { service, storage, validator } = fixture();
    db.query.mockResolvedValue([{ storage_namespace: namespace, storage_key: 'old', storage_generation: '1' }]);
    storage.read.mockResolvedValue(Buffer.from('legacy synthetic'));
    validator.mockRejectedValue(new DocumentSecurityError(code));
    await expect(service.content(adminActor(), operation().teacher_id, operation().document_id)).rejects.toMatchObject({ code });
    expect(storage.remove).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.clientQuery).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('discards a connection when unlock fails after returning a completed operation', async () => {
    const { service, storage, validator } = fixture();
    db.clientQuery.mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [operation('COMPLETE')] })
      .mockRejectedValueOnce(new Error(privateDiagnostic));

    await expect(service.process(operationId)).resolves.toEqual({
      operationId, documentId: operation().document_id, state: 'COMPLETE', errorCode: null, result: {}
    });

    expectDiscarded();
    expect(db.clientQuery).toHaveBeenCalledTimes(3);
    expect(db.query).not.toHaveBeenCalled();
    expect(storage.assertSafe).not.toHaveBeenCalled();
    expect(validator).not.toHaveBeenCalled();
  });

  it('persists only a safe retry code and discards the connection on unlock failure', async () => {
    const { service, storage } = fixture();
    storage.assertSafe.mockRejectedValueOnce(new Error(privateDiagnostic));
    db.clientQuery.mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [operation()] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockRejectedValueOnce(new Error(privateDiagnostic));
    db.query.mockResolvedValueOnce([operation('PREPARED', 'DOSSIER_RETRY_REQUIRED')]);

    const result = await service.process(operationId);

    expect(result).toEqual({ operationId, documentId: operation().document_id,
      state: 'PREPARED', errorCode: 'DOSSIER_RETRY_REQUIRED', result: {} });
    expect(db.clientQuery.mock.calls[2]).toEqual([
      expect.stringContaining("SET error_code='DOSSIER_RETRY_REQUIRED'"), [operationId]
    ]);
    expect(JSON.stringify([result, db.clientQuery.mock.calls])).not.toContain(privateDiagnostic);
    expectDiscarded();
    expect(db.release.mock.invocationCallOrder[0]).toBeLessThan(db.query.mock.invocationCallOrder[0]);
    expect(storage.put).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('still discards the connection when both retry persistence and unlock fail', async () => {
    const { service, storage } = fixture();
    const persistenceError = new Error('Synthetic connection loss while persisting retry');
    storage.assertSafe.mockRejectedValueOnce(new Error(privateDiagnostic));
    db.clientQuery.mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [operation()] })
      .mockRejectedValueOnce(persistenceError)
      .mockRejectedValueOnce(new Error(privateDiagnostic));

    await expect(service.process(operationId)).rejects.toBe(persistenceError);

    expectDiscarded();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns a healthy connection without unlocking a lock owned by another worker', async () => {
    const { service, storage } = fixture();
    db.clientQuery.mockResolvedValueOnce({ rows: [{ locked: false }] })
      .mockResolvedValueOnce({ rows: [operation()] });

    await expect(service.process(operationId)).resolves.toMatchObject({ state: 'PREPARED' });

    expect(db.clientQuery).toHaveBeenCalledTimes(2);
    expect(db.release).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(storage.assertSafe).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });
});
