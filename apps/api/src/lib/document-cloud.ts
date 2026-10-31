import { randomUUID } from 'node:crypto';
import type { DocumentRunner } from './document-security.js';

type CloudSettings = { parser: string; scanner: string };
const fail = () => new Error('DOCUMENT_SECURITY_UNAVAILABLE');
export function cloudDocumentSecuritySettings(env: NodeJS.ProcessEnv = process.env): CloudSettings {
  if (env.DOCUMENT_SECURITY_MODE !== 'cloud-run' || !(env.K_SERVICE || env.CLOUD_RUN_JOB)) throw fail();
  const origin = (value?: string) => {
    if (!value || !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)?\.run\.app$/.test(value)) throw fail();
    return value;
  };
  return { parser: origin(env.DOCUMENT_SECURITY_PARSER_URL), scanner: origin(env.DOCUMENT_SECURITY_SCANNER_URL) };
}

async function boundedText(response: Response, maximum: number): Promise<string> {
  if (!response.body) throw fail();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maximum) throw fail();
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await reader.cancel().catch(() => undefined); }
}

// Runtime identity only: no service-account keys, Firebase user tokens or public fallback.
export async function documentIdentityToken(audience: string): Promise<string> {
  const url = new URL('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity');
  url.searchParams.set('audience', audience);
  const response = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(5_000), redirect: 'error' });
  if (!response.ok || response.headers.get('metadata-flavor') !== 'Google') throw fail();
  const token = (await boundedText(response, 8192)).trim();
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw fail();
  return token;
}

export function createCloudDocumentRunner(settings: CloudSettings,
  tokenProvider = documentIdentityToken, request: typeof fetch = fetch): DocumentRunner {
  return async (kind, bytes) => {
    const origin = kind === 'av' ? settings.scanner : settings.parser;
    const requestId = randomUUID();
    const token = await tokenProvider(origin);
    const response = await request(`${origin}/v1/check/${kind}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(kind === 'av' ? 230_000 : 40_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream',
        'X-H24-Request-Id': requestId }, body: new Uint8Array(bytes)
    });
    if (response.status !== 200 || !response.headers.get('content-type')?.startsWith('application/json')) throw fail();
    const result = JSON.parse(await boundedText(response, 1024));
    if (result.requestId !== requestId || ![0, 10, 20, 30, 40].includes(result.code) ||
        typeof result.stdout !== 'string' || result.stdout.length > 160 || result.stderr !== '') throw fail();
    return { code: result.code, stdout: result.stdout, stderr: '' };
  };
}
