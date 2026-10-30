import { z } from 'zod';

export const DOSSIER_MAX_BYTES = 7.5 * 1024 * 1024;
const type = z.enum(['CURP', 'ACTA_NACIMIENTO', 'CEDULA_PROFESIONAL', 'TITULO', 'OTRO']);
const text = z.string().trim().min(1).max(180).refine((s) => !/[\x00-\x1f\x7f]/.test(s));
const uuid = z.string().guid('Invalid uuid').transform((value) => value.toLowerCase());
export const dossierParams = z.object({ teacherId: uuid, documentId: uuid.optional(), operationId: uuid.optional() });
export const operationFields = { operationId: uuid };
export const metadataFields = { documentType: type, title: text };
export const pdfFields = {
  fileName: text.refine((s) => !/[\\/]/.test(s) && /\.pdf$/i.test(s)),
  mimeType: z.literal('application/pdf'),
  base64Data: z.string().min(4).max(Math.ceil(DOSSIER_MAX_BYTES / 3) * 4)
};
export const uploadSchema = z.object({ ...operationFields, ...metadataFields, ...pdfFields }).strict();
export const replaceSchema = z.object({ ...operationFields, ...pdfFields, expectedRevision: z.number().int().positive() }).strict();
export const metadataSchema = z.object({ ...operationFields, ...metadataFields, expectedRevision: z.number().int().positive() }).strict();
export const deleteSchema = z.object({ ...operationFields, expectedRevision: z.number().int().positive() }).strict();
export const contactSchema = z.object({
  ...operationFields,
  phone: z.string().trim().max(20).refine((s) => !s || /^[+0-9() .-]+$/.test(s))
    .transform((s) => s.replace(/[^0-9+]/g, ''))
    .refine((phone) => !phone || /^\+?[0-9]{10,15}$/.test(phone)),
  expectedVersion: z.string().min(1).max(80)
}).strict();

export class DossierError extends Error {
  constructor(public code: string, public statusCode: number, message: string) { super(message); }
}

export function decodeDossierPdf(base64: string): Buffer {
  if (base64.length > Math.ceil(DOSSIER_MAX_BYTES / 3) * 4) throw new DossierError('FILE_TOO_LARGE', 413, 'El PDF excede 7.5 MiB.');
  if (!base64.length || base64.length % 4 !== 0) {
    throw new DossierError('INVALID_PDF', 422, 'El archivo PDF no es valido.');
  }
  // Scan once without repeated regex groups: V8 can exhaust its stack on multi-MiB inputs.
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  for (let i = 0; i < base64.length - padding; i++) {
    const c = base64.charCodeAt(i);
    if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 43 || c === 47)) {
      throw new DossierError('INVALID_PDF', 422, 'El archivo PDF no es valido.');
    }
  }
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > DOSSIER_MAX_BYTES || bytes.toString('base64') !== base64) {
    throw new DossierError('INVALID_PDF', 422, 'El archivo PDF no es valido.');
  }
  return bytes;
}
