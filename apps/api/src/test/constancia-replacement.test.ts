import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { reconcileConstancias, replaceConstancia, type ConstanciaStorage, type ConstanciaTransaction } from '../lib/constancia-replacement.js';

type Row = { id: string; type: string; current: boolean; bucket: string; key: string; old?: boolean };
function fixture() {
  let rows: Row[] = [
    { id: 'old', type: 'CONSTANCIA_FISCAL', current: true, bucket: 'test-only', key: 'old-object' },
    { id: 'history', type: 'CONSTANCIA_FISCAL', current: false, bucket: 'test-only', key: 'history-object' }
  ];
  const objects = new Set(['old-object', 'history-object']);
  const events: string[] = [];
  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    if (sql.includes('INSERT INTO teacher_documents')) rows.push({ id: String(values[0]), type: 'CONSTANCIA_FISCAL_STAGING', current: false, bucket: String(values[2]), key: String(values[3]) });
    else if (sql.includes('SELECT id, storage_bucket')) return { rows: rows.filter(r => !r.current && (r.type === 'CONSTANCIA_FISCAL_DELETE_PENDING' || r.type === 'CONSTANCIA_FISCAL_STAGING' && r.old)).map(r => ({ ...r })) };
    else if (sql.includes('SELECT id FROM teacher_documents')) return { rows: rows.filter(r => r.id === values[0] && !r.current && r.type === 'CONSTANCIA_FISCAL_STAGING') };
    else if (sql.includes("SET is_current = false, document_type = 'CONSTANCIA_FISCAL_DELETE_PENDING'")) {
      for (const r of rows.filter(r => r.current && r.type === 'CONSTANCIA_FISCAL')) { r.current = false; r.type = 'CONSTANCIA_FISCAL_DELETE_PENDING'; }
    } else if (sql.includes("SET document_type = 'CONSTANCIA_FISCAL', is_current = true")) {
      const r = rows.find(r => r.id === values[0])!; r.current = true; r.type = 'CONSTANCIA_FISCAL';
    } else if (sql.includes("SET document_type = 'CONSTANCIA_FISCAL_DELETED'")) rows.find(r => r.id === values[0])!.type = 'CONSTANCIA_FISCAL_DELETED';
    return { rows: [] };
  });
  const transaction: ConstanciaTransaction = async work => {
    const snapshot = structuredClone(rows);
    try { const result = await work({ query } as unknown as PoolClient); events.push('commit'); return result; }
    catch (error) { rows = snapshot; events.push('rollback'); throw error; }
  };
  const storage: ConstanciaStorage = {
    assertSafe: vi.fn(async () => {}),
    put: vi.fn(async object => { expect(rows.some(r => r.key === object.key)).toBe(true); events.push('upload'); objects.add(object.key); }),
    remove: vi.fn(async object => { expect(rows.some(r => r.key === object.key && r.current)).toBe(false); events.push('delete'); objects.delete(object.key); })
  };
  const options = { transaction, storage, bucket: 'test-only', teacherId: 'teacher', actorId: 'actor', fileName: 'synthetic.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF'),
    authorize: vi.fn(async () => {}), afterSwitch: vi.fn(async () => ({ id: 'teacher' })), validateContent: vi.fn(async () => {}) };
  return { options, objects, rows: () => rows, events, query };
}

describe('constancia replacement without losing the current document', () => {
  it.each(['DOCUMENT_REJECTED', 'DOCUMENT_SECURITY_UNAVAILABLE'])('preserves all records and current bytes on %s', async code => {
    const f = fixture(); f.options.validateContent.mockRejectedValue(new Error(code));
    await expect(replaceConstancia(f.options)).rejects.toThrow(code);
    expect(f.rows()).toHaveLength(2);
    expect(f.rows()[0].current).toBe(true);
    expect(f.options.storage.put).not.toHaveBeenCalled();
    expect(f.options.storage.remove).not.toHaveBeenCalled();
    expect(f.query).not.toHaveBeenCalled();
  });
  it('publishes before deleting, leaves one current version and preserves unrelated legacy history', async () => {
    const f = fixture();
    const result = await replaceConstancia(f.options);
    expect(result.cleanupPending).toBe(false);
    expect(f.rows().filter(r => r.current).map(r => r.id)).toEqual([result.documentId]);
    expect(f.objects.has('old-object')).toBe(false);
    expect(f.objects.has('history-object')).toBe(true);
    expect(f.events).toEqual(['commit', 'commit', 'upload', 'commit', 'commit', 'delete', 'commit']);
    expect(f.query.mock.calls.every(([sql]) => !/UPDATE teachers|DELETE FROM|payment_type/i.test(sql))).toBe(true);
  });
  it('denies out-of-scope access before storage or staging', async () => {
    const f = fixture(); f.options.authorize.mockRejectedValue(new Error('403'));
    await expect(replaceConstancia(f.options)).rejects.toThrow('403');
    expect(f.options.storage.assertSafe).not.toHaveBeenCalled();
    expect(f.options.storage.put).not.toHaveBeenCalled();
    expect(f.rows()).toHaveLength(2);
  });
  it('fails closed on unsafe storage configuration without replacing anything', async () => {
    const f = fixture(); vi.mocked(f.options.storage.assertSafe).mockRejectedValue(new Error('unsafe'));
    await expect(replaceConstancia(f.options)).rejects.toThrow('unsafe');
    expect(f.rows()).toHaveLength(2);
    expect(f.objects.has('old-object')).toBe(true);
  });
  it('keeps the old current file on upload failure and defers staging cleanup', async () => {
    const f = fixture(); vi.mocked(f.options.storage.put).mockRejectedValue(new Error('upload'));
    await expect(replaceConstancia(f.options)).rejects.toThrow('upload');
    expect(f.rows().find(r => r.id === 'old')?.current).toBe(true);
    expect(f.options.storage.remove).not.toHaveBeenCalled();
    expect(f.rows().filter(r => r.type === 'CONSTANCIA_FISCAL_STAGING')).toHaveLength(1);
  });
  it('rolls back publication if audit fails and preserves the old current file', async () => {
    const f = fixture(); f.options.afterSwitch.mockRejectedValue(new Error('audit'));
    await expect(replaceConstancia(f.options)).rejects.toThrow('audit');
    expect(f.rows().find(r => r.id === 'old')?.current).toBe(true);
    expect(f.options.storage.remove).not.toHaveBeenCalled();
    const staged = f.rows().find(r => r.type === 'CONSTANCIA_FISCAL_STAGING')!;
    staged.old = true;
    expect(await reconcileConstancias(f.options.transaction, f.options.storage)).toEqual({ deleted: 1, pending: false });
    expect(f.objects.has(staged.key)).toBe(false);
    expect(f.objects.has('old-object')).toBe(true);
  });
  it('reports deletion failure honestly and retries without reuploading or touching the new file', async () => {
    const f = fixture(); vi.mocked(f.options.storage.remove).mockRejectedValueOnce(new Error('GCS unavailable'));
    const result = await replaceConstancia(f.options);
    expect(result.cleanupPending).toBe(true);
    expect(f.rows().find(r => r.id === 'old')?.type).toBe('CONSTANCIA_FISCAL_DELETE_PENDING');
    expect(await reconcileConstancias(f.options.transaction, f.options.storage)).toEqual({ deleted: 1, pending: false });
    expect(await reconcileConstancias(f.options.transaction, f.options.storage)).toEqual({ deleted: 0, pending: false });
    expect(f.rows().find(r => r.id === result.documentId)?.current).toBe(true);
    expect(f.options.storage.put).toHaveBeenCalledTimes(1);
  });
  it('retries a deleted object after SQL acknowledgement failed', async () => {
    const f = fixture(); const original = f.query.getMockImplementation()!;
    let failOnce = true;
    f.query.mockImplementation(async (sql, values) => {
      if (failOnce && sql.includes("SET document_type = 'CONSTANCIA_FISCAL_DELETED'")) { failOnce = false; throw new Error('SQL unavailable'); }
      return original(sql, values);
    });
    expect((await replaceConstancia(f.options)).cleanupPending).toBe(true);
    expect(f.objects.has('old-object')).toBe(false);
    expect((await reconcileConstancias(f.options.transaction, f.options.storage)).pending).toBe(false);
  });
  it('never cleans a current record or a recent staging upload', async () => {
    const f = fixture(); f.options.afterSwitch.mockRejectedValue(new Error('audit'));
    await expect(replaceConstancia(f.options)).rejects.toThrow();
    expect(await reconcileConstancias(f.options.transaction, f.options.storage)).toEqual({ deleted: 0, pending: false });
    expect(f.options.storage.remove).not.toHaveBeenCalled();
  });
});
