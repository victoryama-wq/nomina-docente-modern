import { createHash } from 'node:crypto';
import { validateDossierPdf } from '/app/apps/api/dist/lib/dossier-storage.js';

// No Firebase/DB initialization. Only bounded stdin and the existing pure PDF adapter.
const chunks = [];
let size = 0;
const deadline = setTimeout(() => process.exit(30), 30_000);
try {
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 7.5 * 1024 * 1024) throw { code: 'DOSSIER_PDF_INVALID' };
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  await validateDossierPdf(bytes);
  process.stdout.write(`H24_PDF_OK ${createHash('sha256').update(bytes).digest('hex')}\n`);
} catch (error) {
  const invalid = ['DOSSIER_PDF_INVALID', 'DOSSIER_PDF_TOO_LARGE'].includes(error?.code);
  process.stdout.write(invalid ? 'H24_INVALID\n' : 'H24_UNAVAILABLE\n');
  process.exitCode = invalid ? 10 : 30;
} finally {
  clearTimeout(deadline);
}
