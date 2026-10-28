import { firebaseAdmin } from '../firebase.js';
import type { ConstanciaObject, ConstanciaStorage } from './constancia-replacement.js';

export class ConstanciaStorageError extends Error {
  constructor() { super('No fue posible verificar o completar el almacenamiento seguro de la constancia.'); }
}

export function constanciaStorage(bucketName: string): ConstanciaStorage {
  async function bucket() {
    const result = firebaseAdmin.storage().bucket(bucketName);
    const [metadata] = await result.getMetadata();
    // Physical deletion cannot be promised with retained versions, holds or soft deletion.
    if (metadata.name !== bucketName || metadata.versioning?.enabled !== false ||
        ![0, '0'].includes(metadata.softDeletePolicy?.retentionDurationSeconds as string | number) ||
        metadata.retentionPolicy != null || metadata.defaultEventBasedHold === true || metadata.objectRetention != null ||
        metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled !== true ||
        metadata.iamConfiguration?.publicAccessPrevention !== 'enforced') throw new ConstanciaStorageError();
    return result;
  }
  function validate(object: ConstanciaObject) {
    if (object.bucket !== bucketName || !/^constancias\/[0-9a-f-]{36}\/[a-zA-Z0-9._-]+$/.test(object.key)) {
      throw new ConstanciaStorageError();
    }
  }
  async function safe<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); } catch { throw new ConstanciaStorageError(); }
  }
  return {
    assertSafe: () => safe(async () => { await bucket(); }),
    put: (object, bytes, mimeType) => safe(async () => {
      validate(object);
      const target = (await bucket()).file(object.key);
      await target.save(bytes, { resumable: false, validation: 'crc32c', timeout: 30_000,
        preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: mimeType, cacheControl: 'private, no-store' } });
    }),
    remove: object => safe(async () => {
      validate(object);
      const target = (await bucket()).file(object.key);
      try {
        const [metadata] = await target.getMetadata();
        const generation = String(metadata.generation);
        if (!/^[1-9][0-9]*$/.test(generation) || !Number.isSafeInteger(Number(generation)) ||
            metadata.temporaryHold || metadata.eventBasedHold) throw new ConstanciaStorageError();
        await target.delete({ ifGenerationMatch: generation });
      } catch (error) {
        if (!['404', 404].includes((error as { code?: number | string }).code!)) throw error;
      }
    })
  };
}
