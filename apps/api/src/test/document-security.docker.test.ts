import PDFDocument from 'pdfkit';
import { describe, it, expect } from 'vitest';
import { validateDocumentContent } from '../lib/document-security.js';

// Explicit opt-in only; no DB/Firebase/GCS modules or real documents are imported.
const enabled = process.env.RUN_H24_DOCUMENT_SECURITY_DOCKER === 'true';
async function pdf(options: PDFKit.PDFDocumentOptions = {}, js = false, pages = 1) {
  const doc = new PDFDocument(options);
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', c => chunks.push(c)); doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
  doc.text('Synthetic H24 A3. No personal data.');
  for (let i = 1; i < pages; i++) doc.addPage().text('Synthetic page.');
  if (js) doc.addNamedJavaScript('inert', 'void 0;');
  doc.end();
  return result;
}
describe.skipIf(!enabled)('H24 real isolated PDF and ClamAV transport', () => {
  it('accepts a benign PDF after both isolated verifications', async () => {
    await expect(validateDocumentContent(await pdf(), 'application/pdf')).resolves.toBeUndefined();
  }, 150_000);
  it('rejects an inert JavaScript PDF before antivirus can approve it', async () => {
    await expect(validateDocumentContent(await pdf({}, true), 'application/pdf')).rejects.toMatchObject({ code: 'DOCUMENT_INVALID' });
  }, 50_000);
  it('rejects encrypted PDFs', async () => {
    await expect(validateDocumentContent(await pdf({ userPassword: 'synthetic' }), 'application/pdf')).rejects.toMatchObject({ code: 'DOCUMENT_INVALID' });
  }, 50_000);
  it('rejects malformed bytes despite a PDF header and EOF', async () => {
    await expect(validateDocumentContent(Buffer.from('%PDF-1.7\njunk\n%%EOF\n'), 'application/pdf')).rejects.toMatchObject({ code: 'DOCUMENT_INVALID' });
  }, 50_000);
  it('rejects PDFs exceeding the existing 500-page ceiling', async () => {
    await expect(validateDocumentContent(await pdf({}, false, 501), 'application/pdf')).rejects.toMatchObject({ code: 'DOCUMENT_INVALID' });
  }, 50_000);
});
