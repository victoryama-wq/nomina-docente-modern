// These are envelope checks, not antivirus, decoding or structural PDF validation.
export const DOCUMENT_ANALYSIS_STATUS = 'NOT_SCANNED' as const;
export const DOCUMENT_MAX_BYTES = 7.5 * 1024 * 1024;
export type DocumentMime = 'application/pdf' | 'image/png' | 'image/jpeg';
// Legacy codes remain readable for historical operations and isolated replay tests.
export class DocumentSecurityError extends Error {
  constructor(readonly code: 'DOCUMENT_INVALID' | 'DOCUMENT_REJECTED' | 'DOCUMENT_SCAN_LIMIT_EXCEEDED' | 'DOCUMENT_SECURITY_UNAVAILABLE' | 'DOCUMENT_SECURITY_BUSY') {
    super(code);
  }
  get statusCode() { return this.code === 'DOCUMENT_SECURITY_BUSY' ? 429 : this.code === 'DOCUMENT_SECURITY_UNAVAILABLE' ? 503 : 422; }
  get publicMessage() {
    if (this.code === 'DOCUMENT_SCAN_LIMIT_EXCEEDED') return 'El PDF excede los limites de analisis de seguridad. Usa un archivo menos complejo o divide el PDF en documentos mas pequenos. No se pudo completar su validacion.';
    return this.statusCode === 422 ? 'El documento no es valido o no esta permitido.' : 'La validacion documental no esta disponible. Intenta mas tarde.';
  }
}
export function validateDocumentName(name: string, mime: string): void {
  const extensions: Record<string, RegExp> = { 'application/pdf': /\.pdf$/i, 'image/png': /\.png$/i, 'image/jpeg': /\.jpe?g$/i };
  if (!name || name.length > 180 || /[\\/\x00-\x1f\x7f]/.test(name) || !extensions[mime]?.test(name)) {
    throw new DocumentSecurityError('DOCUMENT_INVALID');
  }
}
export function validateDocumentEnvelope(bytes: Buffer, mime: string): asserts mime is DocumentMime {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > DOCUMENT_MAX_BYTES) throw new DocumentSecurityError('DOCUMENT_INVALID');
  const valid = mime === 'application/pdf' ? /^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(bytes.subarray(0, 16).toString('ascii'))
    : mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mime === 'image/jpeg' ? bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217
    : false;
  if (!valid) throw new DocumentSecurityError('DOCUMENT_INVALID');
}
export async function validateDocumentContent(bytes: Buffer, mime: string): Promise<void> {
  validateDocumentEnvelope(bytes, mime);
}
