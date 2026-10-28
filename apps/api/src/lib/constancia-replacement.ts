import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

export interface ConstanciaObject { bucket: string; key: string }
export interface ConstanciaStorage {
  assertSafe(): Promise<void>;
  put(object: ConstanciaObject, bytes: Buffer, mimeType: string): Promise<void>;
  remove(object: ConstanciaObject): Promise<void>;
}
export type ConstanciaTransaction = <T>(work: (client: PoolClient) => Promise<T>) => Promise<T>;
type Pending = { id: string; bucket: string; key: string };

// The existing text document_type records a durable cleanup obligation, not a new schema.
// Only versions retired by this replacement flow are deleted; older history is untouched.
export async function reconcileConstancias(transaction: ConstanciaTransaction, storage: ConstanciaStorage,
  teacherId?: string): Promise<{ deleted: number; pending: boolean }> {
  try {
    const deleted = await transaction(async client => {
      const rows = await client.query<Pending>(`
        SELECT id, storage_bucket AS bucket, storage_object AS key FROM teacher_documents
        WHERE is_current = false AND ($1::uuid IS NULL OR teacher_id = $1)
          AND (document_type = 'CONSTANCIA_FISCAL_DELETE_PENDING'
            OR (document_type = 'CONSTANCIA_FISCAL_STAGING' AND uploaded_at < now() - interval '24 hours'))
        ORDER BY uploaded_at LIMIT 25 FOR UPDATE
      `, [teacherId || null]);
      for (const row of rows.rows) {
        const current = await client.query(`SELECT id FROM teacher_documents
          WHERE storage_bucket = $1 AND storage_object = $2 AND is_current = true`, [row.bucket, row.key]);
        if (current.rows.length) throw new Error('Retired object is still referenced by a current document.');
        await storage.remove(row);
        await client.query(`UPDATE teacher_documents SET document_type = 'CONSTANCIA_FISCAL_DELETED'
          WHERE id = $1 AND is_current = false`, [row.id]);
      }
      return rows.rows.length;
    });
    return { deleted, pending: deleted === 25 };
  } catch {
    // Keep durable markers. A retry is safe even after GCS delete succeeded but SQL rolled back.
    return { deleted: 0, pending: true };
  }
}

export async function replaceConstancia<T>(options: {
  transaction: ConstanciaTransaction; storage: ConstanciaStorage; bucket: string;
  teacherId: string; actorId: string; fileName: string; mimeType: string; bytes: Buffer;
  authorize: (client: PoolClient) => Promise<void>;
  afterSwitch: (client: PoolClient) => Promise<T>;
}): Promise<{ documentId: string; teacher: T; cleanupPending: boolean }> {
  const { transaction, storage, teacherId } = options;
  const documentId = randomUUID();
  const object = { bucket: options.bucket, key: `constancias/${teacherId}/${documentId}` };
  // Admission is committed before GCS I/O so a crash cannot orphan an untracked upload.
  await transaction(async client => {
    await options.authorize(client);
    await storage.assertSafe();
    await client.query(`INSERT INTO teacher_documents
      (id, teacher_id, document_type, storage_bucket, storage_object, original_file_name, mime_type, uploaded_by, is_current)
      VALUES ($1, $2, 'CONSTANCIA_FISCAL_STAGING', $3, $4, $5, $6, $7, false)`,
    [documentId, teacherId, object.bucket, object.key, options.fileName, options.mimeType, options.actorId]);
  });
  await transaction(async client => {
    // A resumed upload must not recreate an object already reclaimed by the worker.
    const staged = await client.query(`SELECT id FROM teacher_documents
      WHERE id = $1 AND document_type = 'CONSTANCIA_FISCAL_STAGING' AND is_current = false FOR UPDATE`, [documentId]);
    if (staged.rows.length !== 1) throw new Error('Constancia staging is no longer available.');
    await storage.put(object, options.bytes, options.mimeType);
  });
  const teacher = await transaction(async client => {
    // Serialize simultaneous replacements for one teacher; never delete the current file first.
    await client.query('SELECT id FROM teachers WHERE id = $1 FOR UPDATE', [teacherId]);
    await options.authorize(client);
    const staged = await client.query(`SELECT id FROM teacher_documents
      WHERE id = $1 AND document_type = 'CONSTANCIA_FISCAL_STAGING' AND is_current = false FOR UPDATE`, [documentId]);
    if (staged.rows.length !== 1) throw new Error('Constancia staging is no longer available.');
    await client.query(`UPDATE teacher_documents SET is_current = false, document_type = 'CONSTANCIA_FISCAL_DELETE_PENDING'
      WHERE teacher_id = $1 AND document_type = 'CONSTANCIA_FISCAL' AND is_current = true`, [teacherId]);
    await client.query(`UPDATE teacher_documents SET document_type = 'CONSTANCIA_FISCAL', is_current = true
      WHERE id = $1`, [documentId]);
    return options.afterSwitch(client);
  });
  const cleanup = await reconcileConstancias(transaction, storage, teacherId);
  return { documentId, teacher, cleanupPending: cleanup.pending };
}
