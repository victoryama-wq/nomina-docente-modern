import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ bucketMetadata: vi.fn(), fileMetadata: vi.fn(), save: vi.fn(), remove: vi.fn(), file: vi.fn() }));
vi.mock('../firebase.js', () => ({ firebaseAdmin: { storage: () => ({ bucket: () => ({ getMetadata: mocks.bucketMetadata, file: mocks.file }) }) } }));
import { constanciaStorage } from '../lib/constancia-storage.js';
const safeMetadata = () => ({ name: 'constancias-test', versioning: { enabled: false }, softDeletePolicy: { retentionDurationSeconds: '0' }, iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'enforced' } });
const object = { bucket: 'constancias-test', key: 'constancias/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.bucketMetadata.mockResolvedValue([safeMetadata()]);
  mocks.fileMetadata.mockResolvedValue([{ generation: '123' }]);
  mocks.file.mockReturnValue({ getMetadata: mocks.fileMetadata, save: mocks.save, delete: mocks.remove });
});
describe('constancia physical deletion policy', () => {
  it('uploads create-only with private caching and deletes the exact observed generation', async () => {
    const storage = constanciaStorage('constancias-test');
    await storage.put(object, Buffer.from('%PDF'), 'application/pdf');
    expect(mocks.save).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({ preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' } }));
    await storage.remove(object);
    expect(mocks.remove).toHaveBeenCalledWith({ ifGenerationMatch: '123' });
  });
  it.each([
    { versioning: { enabled: true } }, { versioning: undefined },
    { softDeletePolicy: { retentionDurationSeconds: '604800' } }, { softDeletePolicy: undefined },
    { retentionPolicy: { retentionPeriod: '1' } }, { defaultEventBasedHold: true },
    { objectRetention: {} }, { iamConfiguration: {} }
  ])('rejects a bucket that cannot guarantee private physical deletion (%j)', async override => {
    mocks.bucketMetadata.mockResolvedValue([{ ...safeMetadata(), ...override }]);
    await expect(constanciaStorage('constancias-test').put(object, Buffer.from('x'), 'application/pdf')).rejects.toThrow();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('treats a missing object as an idempotent success', async () => {
    mocks.fileMetadata.mockRejectedValue({ code: 404 });
    await expect(constanciaStorage('constancias-test').remove(object)).resolves.toBeUndefined();
  });
  it.each([412, 403, 500])('does not suppress removal failure %s', async code => {
    mocks.remove.mockRejectedValue({ code, message: 'private storage diagnostic' });
    await expect(constanciaStorage('constancias-test').remove(object)).rejects.not.toThrow('private storage diagnostic');
  });
  it('rejects other buckets and arbitrary object paths before storage access', async () => {
    const storage = constanciaStorage('constancias-test');
    await expect(storage.remove({ ...object, bucket: 'other' })).rejects.toThrow();
    await expect(storage.remove({ ...object, key: '../other' })).rejects.toThrow();
    expect(mocks.file).not.toHaveBeenCalled();
  });
  it('does not delete an object under legal hold', async () => {
    mocks.fileMetadata.mockResolvedValue([{ generation: '123', temporaryHold: true }]);
    await expect(constanciaStorage('constancias-test').remove(object)).rejects.toThrow();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
