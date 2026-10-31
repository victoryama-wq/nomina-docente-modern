import http from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX = 7864320;
const unavailable = { code: 30, stdout: 'H24_UNAVAILABLE', stderr: '' };
function command(file, args, { input, timeout, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { shell: false, detached: true, timeout,
      killSignal: 'SIGKILL', maxBuffer: 16384, encoding: 'utf8', env }, (error, stdout, stderr) => {
      // Terminate grandchildren too; a parser must not survive its deadline or retain a file.
      try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') return reject(e); }
      if (error && (error.killed || error.signal || typeof error.code !== 'number')) reject(Error('UNAVAILABLE'));
      else resolve({ code: error?.code ?? 0, stdout: stdout.trim(), stderr: stderr.trim() });
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end(input);
  });
}

export function createProcessRunner(mode) {
  let refreshedAt = 0;
  return async (kind, bytes) => {
    let directory;
    try {
      directory = await mkdtemp(path.join(tmpdir(), 'h24-request-'));
      const env = { PATH: '/usr/bin:/bin', LC_ALL: 'C', TMPDIR: directory, DOSSIER_PDFINFO_PATH: '/usr/bin/pdfinfo' };
      if (mode === 'scanner' && Date.now() - refreshedAt > 6 * 60 * 60 * 1000) {
        // Update only between scans. Signed official databases and the scanner's age gate remain mandatory.
        const update = await command('/usr/bin/freshclam', ['--stdout', '--quiet', '--config-file=/opt/h24/freshclam.conf'], { timeout: 100_000, env });
        if (update.code !== 0 || update.stderr) return unavailable;
        refreshedAt = Date.now();
      }
      const result = mode === 'scanner'
        ? await command('/bin/sh', ['/opt/h24/scan-stdin.sh'], { input: bytes, timeout: 120_000, env })
        : await command('/usr/local/bin/node', ['/opt/h24/inspect-stdin.mjs', kind], { input: bytes, timeout: 35_000, env });
      const allowed = /^(?:H24_(?:INVALID|REJECTED|UNAVAILABLE)|H24_(?:AV|POLICY_V1_(?:PDF|PNG|JPEG))_OK [a-f0-9]{64})$/;
      if (result.code === 40) return mode === 'scanner' && !result.stderr && /^H24_SCAN_LIMIT [a-f0-9]{64}$/.test(result.stdout) ? result : unavailable;
      return [0, 10, 20, 30].includes(result.code) && !result.stderr && allowed.test(result.stdout) ? result : unavailable;
    } catch { return unavailable; }
    finally { if (directory) await rm(directory, { recursive: true, force: true }); }
  };
}

export function createCheckServer({ mode, run, log = event => console.log(JSON.stringify(event)) }) {
  if (!['inspector', 'scanner'].includes(mode)) throw Error('MODE_REQUIRED');
  let active = false;
  const server = http.createServer(async (req, res) => {
    const send = (status, body) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', Connection: 'close' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
    const kind = /^\/v1\/check\/(pdf|png|jpeg|av)$/.exec(req.url || '')?.[1];
    if (req.method !== 'POST' || !kind || (mode === 'scanner') !== (kind === 'av')) return send(404, { error: 'NOT_FOUND' });
    const requestId = req.headers['x-h24-request-id'];
    if (typeof requestId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(requestId) ||
        req.headers['content-type'] !== 'application/octet-stream' || req.headers['content-encoding']) return send(400, { error: 'INVALID_REQUEST' });
    if (active) return send(429, { error: 'BUSY' });
    const declared = req.headers['content-length'];
    if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) < 1 || Number(declared) > MAX)) return send(413, { error: 'SIZE' });
    active = true;
    const started = Date.now();
    const bodyTimer = setTimeout(() => req.destroy(), 15_000);
    let code = 30;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX) { send(413, { error: 'SIZE' }); return; }
        chunks.push(chunk);
      }
      clearTimeout(bodyTimer);
      if (!size) return send(413, { error: 'SIZE' });
      const result = await run(kind, Buffer.concat(chunks));
      code = result.code;
      send(200, { requestId, ...result });
    } catch { send(503, { error: 'UNAVAILABLE' }); }
    finally {
      clearTimeout(bodyTimer); active = false;
      // Deliberately excludes document names, hashes, request IDs, tokens and subprocess diagnostics.
      log({ event: 'document_check', severity: code === 30 ? 'ERROR' : 'INFO', kind, code, durationMs: Date.now() - started });
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.maxHeadersCount = 32;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.env.DOCUMENT_CHECK_MODE;
  const server = createCheckServer({ mode, run: createProcessRunner(mode) });
  server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
  process.on('SIGTERM', () => { server.close(); setTimeout(() => process.exit(0), 9000).unref(); });
}
