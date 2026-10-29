import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateDossierPdf } from '/app/apps/api/dist/lib/dossier-storage.js';
import { validatePdfPolicy, PolicyRejection } from './pdf-policy.mjs';
import { validateImage } from './image-policy.mjs';

function qpdf(args) {
  return new Promise((resolve, reject) => execFile('/usr/bin/qpdf', args, {
    timeout: 10_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8', env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' }
  }, (error, stdout, stderr) => {
    if (error || stderr.trim()) {
      if (error && [2, 3].includes(error.code) && !error.killed) reject(new PolicyRejection('PDF_INVALID'));
      else reject(new Error('QPDF_UNAVAILABLE'));
    } else resolve(stdout);
  }));
}
const deadline = setTimeout(() => process.exit(30), 30_000);
let directory;
let result = 'H24_UNAVAILABLE';
let exit = 30;
try {
  const kind = process.argv[2];
  if (!['pdf', 'png', 'jpeg'].includes(kind)) throw new Error('MODE_REQUIRED');
  let size = 0;
  const chunks = [];
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 7.5 * 1024 * 1024) throw new PolicyRejection('TOO_LARGE');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (!bytes.length) throw new PolicyRejection('EMPTY');
  if (kind === 'pdf') {
    await validateDossierPdf(bytes);
    directory = await mkdtemp(path.join(tmpdir(), 'h24-inspect-'));
    const filename = `${directory}/document.pdf`;
    await writeFile(filename, bytes, { mode: 0o600, flag: 'wx' });
    await qpdf(['--check', filename]);
    validatePdfPolicy(JSON.parse(await qpdf(['--json=2', '--json-key=qpdf', '--json-stream-data=none', filename])));
  } else await validateImage(bytes, kind);
  // A versioned protocol prevents an older A3 parser image from silently bypassing the new policy.
  result = `H24_POLICY_V1_${kind.toUpperCase()}_OK ${createHash('sha256').update(bytes).digest('hex')}`;
  exit = 0;
} catch (error) {
  const invalid = error instanceof PolicyRejection || ['DOSSIER_PDF_INVALID', 'DOSSIER_PDF_TOO_LARGE'].includes(error?.code);
  result = invalid ? 'H24_INVALID' : 'H24_UNAVAILABLE';
  exit = invalid ? 10 : 30;
} finally {
  try { if (directory) await rm(directory, { recursive: true, force: true }); }
  catch { result = 'H24_UNAVAILABLE'; exit = 30; }
  clearTimeout(deadline);
}
process.stdout.write(`${result}\n`);
process.exitCode = exit;
