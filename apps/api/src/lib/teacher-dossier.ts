import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { z } from 'zod';
import { pool, query, withTransaction } from '../db.js';
import type { SessionUser } from '../types.js';
import { canUseDossier, type DossierAction } from './dossier-policy.js';
import { DossierError, decodeDossierPdf, type uploadSchema, type replaceSchema, type metadataSchema, type contactSchema, type deleteSchema } from './dossier-contract.js';
import type { DossierStorage } from './dossier-storage.js';

interface Operation {
  id: string;
  actor_id: string;
  teacher_id: string;
  document_id: string | null;
  action: 'UPLOAD' | 'REPLACE' | 'DELETE' | 'METADATA' | 'CONTACT';
  request_hash: string;
  state: 'PREPARED' | 'CLEANUP' | 'ABORTING' | 'COMPLETE' | 'FAILED';
  storage_namespace: string;
  new_key: string | null;
  new_generation: string | null;
  old_key: string | null;
  old_generation: string | null;
  payload: Record<string, string | number>;
  result: Record<string, unknown>;
  error_code: string | null;
}

interface DocumentRow {
  id: string;
  teacher_id: string;
  document_type: string;
  title: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  state: string;
  revision: number;
  created_at: Date;
  updated_at: Date;
  storage_key: string | null;
  storage_generation: string | null;
  storage_namespace: string;
}

function publicDocument(d: DocumentRow) {
  return { id: d.id, documentType: d.document_type, title: d.title, fileName: d.original_file_name,
    mimeType: d.mime_type, sizeBytes: d.size_bytes, state: d.state, revision: d.revision,
    createdAt: d.created_at, updatedAt: d.updated_at };
}

function publicOperation(op: Operation) {
  return { operationId: op.id, documentId: op.document_id, state: op.state, errorCode: op.error_code, result: op.result };
}

const terminal = (op: Operation) => op.state === 'COMPLETE' || op.state === 'FAILED';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const conflict = () => new DossierError('DOSSIER_CONFLICT', 409, 'El expediente cambio. Recarga antes de continuar.');
const missing = () => new DossierError('NOT_FOUND', 404, 'No se encontro el recurso del expediente.');

async function audit(client: PoolClient, actorId: string, teacherId: string, action: string, metadata: object) {
  await client.query(`INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, metadata)
    VALUES ($1, $2, 'teacher_dossier', $3, $4::jsonb)`, [actorId, action, teacherId, JSON.stringify(metadata)]);
}

// Query real persisted authorization again before publishing a staged object.
async function actorStillAllowed(client: PoolClient, actorId: string, action: DossierAction) {
  const result = await client.query(`SELECT u.id, u.status, u.is_protected_super_admin AS "isProtectedSuperAdmin",
    r.code AS role, COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
    FROM app_users u JOIN roles r ON r.id=u.role_id
    LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id
    WHERE u.id=$1 GROUP BY u.id, r.code`, [actorId]);
  return !!result.rows[0] && canUseDossier(result.rows[0] as SessionUser, action);
}

export class TeacherDossierService {
  constructor(readonly storage: DossierStorage, readonly namespace: string,
    private readonly validatePdf: (bytes: Buffer) => Promise<void>) {}

  private allow(actor: SessionUser, action: DossierAction) {
    if (!canUseDossier(actor, action)) throw new DossierError('FORBIDDEN', 403, 'Accion no permitida.');
  }

  private async teacher(client: PoolClient, id: string) {
    const rows = await client.query(`SELECT id, full_name AS "fullName", phone, updated_at::text AS version
      FROM teachers WHERE id=$1 FOR UPDATE`, [id]);
    if (!rows.rows[0]) throw missing();
    return rows.rows[0] as { id: string; fullName: string; phone: string; version: string };
  }

  async get(actor: SessionUser, teacherId: string) {
    this.allow(actor, 'view');
    const teachers = await query<{ id: string; fullName: string; phone: string; version: string }>(
      `SELECT id, full_name AS "fullName", phone, updated_at::text AS version FROM teachers WHERE id=$1`, [teacherId]);
    if (!teachers[0]) throw missing();
    const read = canUseDossier(actor, 'read');
    const documents = read ? await query<DocumentRow>(
      'SELECT * FROM teacher_dossier_documents WHERE teacher_id=$1 ORDER BY created_at, id', [teacherId]) : [];
    return { teacher: teachers[0], documents: documents.map(publicDocument), capabilities: {
      readDocuments: read, manageDocuments: canUseDossier(actor, 'manage'), editPhone: canUseDossier(actor, 'contact')
    } };
  }

  async operation(actor: SessionUser, teacherId: string, operationId: string) {
    this.allow(actor, 'view');
    const op = (await query<Operation>('SELECT * FROM teacher_dossier_operations WHERE id=$1 AND teacher_id=$2', [operationId, teacherId]))[0];
    if (!op) throw missing();
    this.allow(actor, op.action === 'CONTACT' ? 'contact' : 'read');
    return publicOperation(op);
  }

  private async existing(client: PoolClient, actor: SessionUser, id: string, requestHash: string) {
    // Serializes retries even when a client reuses an operation ID for a different teacher.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 24))', [id]);
    const op = (await client.query<Operation>('SELECT * FROM teacher_dossier_operations WHERE id=$1', [id])).rows[0];
    if (op && (op.actor_id !== actor.id || op.request_hash !== requestHash)) throw conflict();
    return op;
  }

  private async completedRetry(actor: SessionUser, id: string, requestHash: string) {
    const op = (await query<Operation>('SELECT * FROM teacher_dossier_operations WHERE id=$1', [id]))[0];
    if (op && (op.actor_id !== actor.id || op.request_hash !== requestHash)) throw conflict();
    return op && terminal(op) ? publicOperation(op) : null;
  }

  private async document(client: PoolClient, teacherId: string, id: string, revision: number) {
    const doc = (await client.query<DocumentRow>(
      'SELECT * FROM teacher_dossier_documents WHERE id=$1 AND teacher_id=$2 FOR UPDATE', [id, teacherId])).rows[0];
    if (!doc) throw missing();
    if (doc.state !== 'AVAILABLE' || doc.revision !== revision || doc.storage_namespace !== this.namespace) throw conflict();
    const pending = await client.query(`SELECT 1 FROM teacher_dossier_operations WHERE document_id=$1
      AND state IN ('PREPARED','CLEANUP','ABORTING')`, [id]);
    if (pending.rowCount) throw conflict();
    return doc;
  }

  async contact(actor: SessionUser, teacherId: string, input: z.infer<typeof contactSchema>) {
    this.allow(actor, 'contact');
    return withTransaction(async (client) => {
      const requestHash = hash(['CONTACT', teacherId, input.phone, input.expectedVersion]);
      const previous = await this.existing(client, actor, input.operationId, requestHash);
      if (previous) return publicOperation(previous);
      const teacher = await this.teacher(client, teacherId);
      if (teacher.version !== input.expectedVersion) throw conflict();
      const result = await client.query(`UPDATE teachers SET phone=$1, updated_at=clock_timestamp(), updated_by=$2
        WHERE id=$3 RETURNING updated_at::text AS version`, [input.phone, actor.id, teacherId]);
      const op = (await client.query<Operation>(`INSERT INTO teacher_dossier_operations
        (id,actor_id,teacher_id,action,request_hash,state,storage_namespace,result)
        VALUES ($1,$2,$3,'CONTACT',$4,'COMPLETE',$5,$6::jsonb) RETURNING *`,
        [input.operationId, actor.id, teacherId, requestHash, this.namespace, JSON.stringify({ version: result.rows[0].version })])).rows[0];
      await audit(client, actor.id, teacherId, 'TEACHER_DOSSIER_PHONE_UPDATED', { operationId: op.id, fields: ['phone'] });
      return publicOperation(op);
    });
  }

  async metadata(actor: SessionUser, teacherId: string, documentId: string, input: z.infer<typeof metadataSchema>) {
    this.allow(actor, 'manage');
    return withTransaction(async (client) => {
      const requestHash = hash(['METADATA', teacherId, documentId, input.expectedRevision, input.documentType, input.title]);
      const previous = await this.existing(client, actor, input.operationId, requestHash);
      if (previous) return publicOperation(previous);
      await this.teacher(client, teacherId);
      await this.document(client, teacherId, documentId, input.expectedRevision);
      const doc = (await client.query<DocumentRow>(`UPDATE teacher_dossier_documents
        SET document_type=$1,title=$2,revision=revision+1,updated_at=now(),updated_by=$3 WHERE id=$4 RETURNING *`,
        [input.documentType, input.title, actor.id, documentId])).rows[0];
      const op = (await client.query<Operation>(`INSERT INTO teacher_dossier_operations
        (id,actor_id,teacher_id,document_id,action,request_hash,state,storage_namespace,result)
        VALUES ($1,$2,$3,$4,'METADATA',$5,'COMPLETE',$6,$7::jsonb) RETURNING *`,
        [input.operationId, actor.id, teacherId, documentId, requestHash, this.namespace, JSON.stringify({ revision: doc.revision })])).rows[0];
      await audit(client, actor.id, teacherId, 'TEACHER_DOSSIER_METADATA_UPDATED', { operationId: op.id, documentId });
      return publicOperation(op);
    });
  }

  async upload(actor: SessionUser, teacherId: string, input: z.infer<typeof uploadSchema>) {
    return this.stageFile(actor, teacherId, null, input);
  }

  async replace(actor: SessionUser, teacherId: string, documentId: string, input: z.infer<typeof replaceSchema>) {
    return this.stageFile(actor, teacherId, documentId, input);
  }

  private async stageFile(actor: SessionUser, teacherId: string, documentId: string | null,
    input: z.infer<typeof uploadSchema> | z.infer<typeof replaceSchema>) {
    this.allow(actor, 'manage');
    const bytes = decodeDossierPdf(input.base64Data);
    const action = documentId ? 'REPLACE' : 'UPLOAD';
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const requestHash = hash([action, teacherId, documentId, input.fileName, contentHash,
      'expectedRevision' in input ? input.expectedRevision : null,
      'documentType' in input ? input.documentType : null, 'title' in input ? input.title : null]);
    const completed = await this.completedRetry(actor, input.operationId, requestHash);
    if (completed) return completed;
    await this.storage.assertSafe();
    await this.validatePdf(bytes);
    const op = await withTransaction(async (client) => {
      const previous = await this.existing(client, actor, input.operationId, requestHash);
      if (previous) return previous;
      await this.teacher(client, teacherId);
      const id = documentId || randomUUID();
      let before: DocumentRow | undefined;
      if (documentId && 'expectedRevision' in input) {
        before = await this.document(client, teacherId, documentId, input.expectedRevision);
        await client.query("UPDATE teacher_dossier_documents SET state='REPLACING' WHERE id=$1", [id]);
      } else if ('documentType' in input) {
        await client.query(`INSERT INTO teacher_dossier_documents
          (id,teacher_id,document_type,title,original_file_name,size_bytes,storage_namespace,state,created_by,updated_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'UPLOADING',$8,$8)`,
          [id, teacherId, input.documentType, input.title, input.fileName, bytes.length, this.namespace, actor.id]);
      } else throw conflict();
      const payload = { fileName: input.fileName, sizeBytes: bytes.length, contentHash };
      return (await client.query<Operation>(`INSERT INTO teacher_dossier_operations
        (id,actor_id,teacher_id,document_id,action,request_hash,state,storage_namespace,new_key,old_key,old_generation,payload)
        VALUES ($1,$2,$3,$4,$5,$6,'PREPARED',$7,$8,$9,$10,$11::jsonb) RETURNING *`,
        [input.operationId, actor.id, teacherId, id, action, requestHash, this.namespace,
          `${teacherId}/${id}/${input.operationId}`, before?.storage_key || null, before?.storage_generation || null,
          JSON.stringify(payload)])).rows[0];
    });
    return terminal(op) ? publicOperation(op) : this.process(op.id, bytes);
  }

  async remove(actor: SessionUser, teacherId: string, documentId: string, input: z.infer<typeof deleteSchema>) {
    this.allow(actor, 'manage');
    const completed = await this.completedRetry(actor, input.operationId, hash(['DELETE', teacherId, documentId, input.expectedRevision]));
    if (completed) return completed;
    await this.storage.assertSafe();
    const op = await withTransaction(async (client) => {
      const previous = await this.existing(client, actor, input.operationId, hash(['DELETE', teacherId, documentId, input.expectedRevision]));
      if (previous) return previous;
      await this.teacher(client, teacherId);
      const doc = await this.document(client, teacherId, documentId, input.expectedRevision);
      await client.query("UPDATE teacher_dossier_documents SET state='DELETING' WHERE id=$1", [documentId]);
      const pending = (await client.query<Operation>(`INSERT INTO teacher_dossier_operations
        (id,actor_id,teacher_id,document_id,action,request_hash,state,storage_namespace,old_key,old_generation)
        VALUES ($1,$2,$3,$4,'DELETE',$5,'CLEANUP',$6,$7,$8) RETURNING *`,
        [input.operationId, actor.id, teacherId, documentId, hash(['DELETE', teacherId, documentId, input.expectedRevision]),
          this.namespace, doc.storage_key, doc.storage_generation])).rows[0];
      await audit(client, actor.id, teacherId, 'TEACHER_DOSSIER_DELETE_REQUESTED', { operationId: pending.id, documentId });
      return pending;
    });
    return terminal(op) ? publicOperation(op) : this.process(op.id);
  }

  async content(actor: SessionUser, teacherId: string, documentId: string) {
    this.allow(actor, 'read');
    const doc = (await query<DocumentRow>(`SELECT * FROM teacher_dossier_documents WHERE id=$1 AND teacher_id=$2
      AND state IN ('AVAILABLE','REPLACING')`, [documentId, teacherId]))[0];
    if (!doc || !doc.storage_key || !doc.storage_generation) throw missing();
    if (doc.storage_namespace !== this.namespace) throw conflict();
    await this.storage.assertSafe();
    const bytes = await this.storage.read({ key: doc.storage_key, generation: doc.storage_generation });
    // A deletion/replacement committed during the read must not disclose a retired document.
    const current = await query(`SELECT 1 FROM teacher_dossier_documents WHERE id=$1 AND teacher_id=$2
      AND storage_generation=$3 AND storage_key=$4 AND state IN ('AVAILABLE','REPLACING')`,
      [documentId, teacherId, doc.storage_generation, doc.storage_key]);
    if (!current.length) throw conflict();
    return { bytes, fileName: doc.original_file_name };
  }

  // Session advisory lock survives short SQL transactions but releases on worker crash.
  // No SQL transaction remains open while transferring bytes.
  async process(operationId: string, bytes?: Buffer) {
    const client = await pool.connect();
    let locked = false;
    let op: Operation | undefined;
    try {
      locked = (await client.query('SELECT pg_try_advisory_lock(hashtextextended($1, 25)) AS locked', [operationId])).rows[0].locked;
      op = (await client.query<Operation>('SELECT * FROM teacher_dossier_operations WHERE id=$1', [operationId])).rows[0];
      if (!op) throw missing();
      if (!locked || terminal(op)) return publicOperation(op);
      if (op.storage_namespace !== this.namespace) throw conflict();
      await this.storage.assertSafe();
      await client.query('UPDATE teacher_dossier_operations SET attempts=attempts+1, updated_at=now() WHERE id=$1', [op.id]);

      if (op.state === 'PREPARED') {
        let object = op.new_key ? await this.storage.stat(op.new_key) : null;
        if (!object && bytes && op.new_key) {
          if (createHash('sha256').update(bytes).digest('hex') !== op.payload.contentHash) throw conflict();
          object = await this.storage.put(op.new_key, bytes);
        }
        if (object) {
          // Recovered objects are checked against the intent, not trusted by path alone.
          const recovered = await this.storage.read(object);
          if (createHash('sha256').update(recovered).digest('hex') !== op.payload.contentHash) throw conflict();
        }
        const allowed = object && await actorStillAllowed(client, op.actor_id, 'manage');
        if (!allowed) {
          await client.query(`UPDATE teacher_dossier_operations SET state='ABORTING',new_generation=$2,
            error_code=$3 WHERE id=$1`, [op.id, object?.generation || null, object ? 'AUTHORIZATION_REVOKED' : 'UPLOAD_INTERRUPTED']);
        } else {
          await client.query('BEGIN');
          try {
            const result = await client.query(`UPDATE teacher_dossier_documents SET storage_key=$2,storage_generation=$3,
              original_file_name=$4,size_bytes=$5,state='AVAILABLE',revision=revision+1,updated_at=now(),updated_by=$6
              WHERE id=$1 AND state IN ('UPLOADING','REPLACING') RETURNING revision`,
              [op.document_id, object!.key, object!.generation, op.payload.fileName, op.payload.sizeBytes, op.actor_id]);
            if (!result.rowCount) throw conflict();
            await client.query(`UPDATE teacher_dossier_operations SET state='CLEANUP',new_generation=$2,
              result=$3::jsonb,error_code=NULL WHERE id=$1`, [op.id, object!.generation, JSON.stringify({ revision: result.rows[0].revision })]);
            await audit(client, op.actor_id, op.teacher_id, op.action === 'UPLOAD' ? 'TEACHER_DOSSIER_UPLOADED' : 'TEACHER_DOSSIER_REPLACED',
              { operationId: op.id, documentId: op.document_id });
            await client.query('COMMIT');
          } catch (error) { await client.query('ROLLBACK'); throw error; }
        }
        op = (await client.query<Operation>('SELECT * FROM teacher_dossier_operations WHERE id=$1', [op.id])).rows[0];
      }

      if (op.state === 'CLEANUP' || op.state === 'ABORTING') {
        const aborting = op.state === 'ABORTING';
        const key = aborting ? op.new_key : op.old_key;
        const generation = aborting ? op.new_generation : op.old_generation;
        if (key) {
          const target = generation ? { key, generation } : await this.storage.stat(key);
          if (target) await this.storage.remove(target);
          if (await this.storage.stat(key)) throw new Error('Cleanup not confirmed');
        }
        await client.query('BEGIN');
        try {
          if (aborting && op.action === 'REPLACE') {
            await client.query("UPDATE teacher_dossier_documents SET state='AVAILABLE' WHERE id=$1 AND state='REPLACING'", [op.document_id]);
          } else if ((aborting && op.action === 'UPLOAD') || op.action === 'DELETE') {
            await client.query('DELETE FROM teacher_dossier_documents WHERE id=$1', [op.document_id]);
          }
          await client.query(`UPDATE teacher_dossier_operations SET state=$2,new_key=NULL,new_generation=NULL,
            old_key=NULL,old_generation=NULL,payload='{}',updated_at=now(),error_code=CASE WHEN $2='FAILED' THEN error_code ELSE NULL END WHERE id=$1`,
            [op.id, aborting ? 'FAILED' : 'COMPLETE']);
          await audit(client, op.actor_id, op.teacher_id, aborting ? 'TEACHER_DOSSIER_OPERATION_ABORTED' : 'TEACHER_DOSSIER_OPERATION_COMPLETED',
            { operationId: op.id, documentId: op.document_id, action: op.action });
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
      }
    } catch (error) {
      if (!op || !locked) throw error;
      // Persist only a safe code. SDK/parser errors can contain object names or document contents.
      await client.query(`UPDATE teacher_dossier_operations SET error_code='DOSSIER_RETRY_REQUIRED',updated_at=now()
        WHERE id=$1 AND state NOT IN ('COMPLETE','FAILED')`, [operationId]);
    } finally {
      let releaseError: Error | undefined;
      try {
        if (locked) await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 25))', [operationId]);
      } catch {
        releaseError = new Error('Dossier worker connection unavailable');
      } finally {
        // A broken session must be discarded, not leaked or returned with its advisory lock.
        client.release(releaseError);
      }
    }
    const latest = (await query<Operation>('SELECT * FROM teacher_dossier_operations WHERE id=$1', [operationId]))[0];
    return publicOperation(latest);
  }

  async reconcile(limit = 25) {
    await this.storage.assertSafe();
    const operations = await query<{ id: string }>(`SELECT id FROM teacher_dossier_operations
      WHERE state IN ('PREPARED','CLEANUP','ABORTING') AND storage_namespace=$1
      AND updated_at < now() - interval '5 minutes' ORDER BY updated_at LIMIT $2`,
      [this.namespace, Math.min(100, Math.max(1, limit))]);
    const results = [];
    for (const op of operations) results.push(await this.process(op.id));
    return results;
  }
}
