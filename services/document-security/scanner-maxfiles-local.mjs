// Opt-in PD07-B03 experiment. Never changes the shipped scanner policy.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

if (process.argv[2] === '--probe') {
  assert.equal(process.env.H24_MAXFILES_LAB, 'true');
  const source = readFileSync('/opt/h24/scan-stdin.sh', 'utf8');
  assert.equal((source.match(/--max-files=100\b/g) || []).length, 1);
  mkdirSync('/tmp/corpus');
  // Harmless AV marker assembled only inside disposable container tmpfs.
  const eicar = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}', '$EICAR-STANDARD-ANTIVIRUS-', 'TEST-FILE!$H+H*'].join('');
  assert.equal(eicar.length, 68);
  writeFileSync('/tmp/corpus/eicar', eicar);
  const results = [];
  function scan(label, file, maxFiles, expected, raw = false) {
    const input = readFileSync(file);
    const script = `/tmp/corpus/scan-${maxFiles}.sh`;
    writeFileSync(script, source.replace('--max-files=100 ', `--max-files=${maxFiles} `));
    const args = raw ? ['-s', 'KILL', '115', 'clamscan', '--database=/var/lib/clamav',
      '--official-db-only=yes', '--fail-if-cvd-older-than=2', '--scan-pdf=yes',
      '--alert-encrypted=yes', '--alert-exceeds-max=yes', '--max-filesize=8M',
      '--max-scansize=32M', '--max-recursion=8', `--max-files=${maxFiles}`,
      '--max-scantime=10000', '--tempdir=/tmp', file] : [script];
    const start = Date.now();
    const r = spawnSync(raw ? '/usr/bin/timeout' : '/bin/sh', args, {
      input: raw ? undefined : input, encoding: 'utf8', timeout: 120_000,
      maxBuffer: 1024 * 1024, env: { PATH: '/usr/bin:/bin', LC_ALL: 'C', TMPDIR: '/tmp' }
    });
    const result = { label, maxFiles, raw, bytes: input.length, sha256: sha(input),
      expected, status: r.status, signal: r.signal, ms: Date.now() - start,
      stdout: r.stdout.trim(), stderr: r.stderr.trim() };
    results.push(result);
    console.log(JSON.stringify(result));
    assert.equal(r.error, undefined);
    if (expected === 'bounded') {
      assert.ok([0, 30].includes(r.status), label);
    } else if (expected === null) {
      assert.ok([0, 1].includes(r.status), label);
      if (r.status === 1) assert.match(r.stdout + r.stderr, /Heuristics\.Limits\.Exceeded\.(MaxFiles|MaxScanTime|MaxScanSize|MaxFileSize)/);
      else {
        assert.match(r.stdout, /: OK\n/);
        assert.match(r.stdout, /Scanned files: 1\n/);
        assert.match(r.stdout, /Infected files: 0\n/);
        assert.doesNotMatch(r.stdout + r.stderr, /warning|error|limit|skip|FOUND/i);
      }
    } else assert.equal(r.status, expected, label);
    if (!raw) {
      assert.equal(r.stderr.trim(), '');
      assert.equal(r.stdout.trim(), r.status === 0 ? `H24_AV_OK ${sha(input)}` : r.status === 20 ? 'H24_REJECTED' : 'H24_UNAVAILABLE');
    }
    return result;
  }
  scan('baseline-500-text', '/fixtures/text-500.pdf', 100, 1, true);
  scan('baseline-wrapper-500-text', '/fixtures/text-500.pdf', 100, 30);
  scan('candidate1000-500-text', '/fixtures/text-500.pdf', 1000, 'bounded');
  // Raw results establish whether 1000 covers the image-bearing corpus.
  scan('candidate1000-500-images', '/fixtures/images-500.pdf', 1000, null, true);
  scan('candidate1000-500-content', '/fixtures/content-500.pdf', 1000, null, true);
  scan('candidate2000-500-text', '/fixtures/text-500.pdf', 2000, 'bounded');
  scan('candidate2000-500-images', '/fixtures/images-500.pdf', 2000, 'bounded');
  scan('candidate2000-500-content', '/fixtures/content-500.pdf', 2000, 'bounded');
  scan('candidate2000-small', '/fixtures/text-1.pdf', 2000, 0);
  const limit = scan('candidate2000-complex-limit', '/fixtures/complex-500.pdf', 2000, 1, true);
  assert.match(limit.stdout + limit.stderr, /Heuristics\.Limits\.Exceeded\.(MaxFiles|MaxScanTime)/);
  scan('candidate2000-complex-wrapper', '/fixtures/complex-500.pdf', 2000, 30);
  scan('candidate2000-eicar', '/tmp/corpus/eicar', 2000, 20);
  // No global policy switches: scan-size and deadline defenses stay enabled.
  const memoryPeak = readFileSync('/sys/fs/cgroup/memory.peak', 'utf8').trim();
  rmSync('/tmp/corpus', { recursive: true });
  await new Promise(resolve => setTimeout(resolve, 1500));
  const zombies = readdirSync('/proc').filter(n => /^\d+$/.test(n)).flatMap(n => {
    try { const status = readFileSync(`/proc/${n}/status`, 'utf8'); return /^State:\s+Z/m.test(status) ? [n] : []; }
    catch { return []; }
  });
  assert.deepEqual(zombies, []);
  assert.equal(readdirSync('/tmp').filter(n => n.startsWith('h24-scan.')).length, 0);
  console.log(JSON.stringify({ complete: true, tests: results.length, memoryPeak, zombies, temporaryScanDirectories: 0 }));
} else {
  assert.equal(process.env.RUN_H24_MAXFILES_LAB, 'true', 'Explicit local lab opt-in required');
  const image = process.env.H24_MAXFILES_IMAGE;
  const inspector = process.env.H24_MAXFILES_INSPECTOR_IMAGE;
  for (const value of [image, inspector]) assert.match(value || '', /^sha256:[a-f0-9]{64}$/);
  const docker = args => execFileSync('docker', ['--context', 'desktop-linux', ...args], {
    encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 4 * 1024 * 1024
  });
  const root = path.resolve('.cache/pd07-b03', randomUUID());
  const fixtures = path.join(root, 'fixtures');
  mkdirSync(fixtures, { recursive: true });
  console.log(`Evidence: ${root}`);
  const { default: PDFDocument } = await import('pdfkit');
  async function pdf(name, pages, images, streams = 0) {
    const doc = new PDFDocument({ autoFirstPage: false, compress: false });
    const chunks = [];
    const done = new Promise((resolve, reject) => { doc.on('data', b => chunks.push(b)); doc.on('end', resolve); doc.on('error', reject); });
    for (let p = 0; p < pages; p++) {
      doc.addPage().text(`H24 SYNTHETIC ${name} PAGE ${p}`);
      for (let n = 0; n < images; n++) {
        const ref = doc.ref({ Type: 'XObject', Subtype: 'Image', Width: 8, Height: 8,
          ColorSpace: 'DeviceRGB', BitsPerComponent: 8 });
        const bytes = Buffer.alloc(8 * 8 * 3);
        for (let b = 0; b < bytes.length; b++) bytes[b] = (p * 11 + n * 17 + b * 7) % 256;
        bytes.writeUInt32BE(p * 10 + n, 0);
        ref.end(bytes);
        doc.page.xobjects[`I${n}`] = ref;
        doc.addContent(`q 8 0 0 8 ${n * 10} 100 cm /I${n} Do Q`);
      }
      if (streams) {
        const contents = [doc.page.content];
        for (let n = 0; n < streams; n++) {
          const ref = doc.ref({});
          ref.end(`q 0 0 10 10 re S Q\n% H24 UNIQUE CONTENT ${p}-${n} ${'synthetic '.repeat(20)}\n`);
          contents.push(ref);
        }
        doc.page.dictionary.data.Contents = contents;
      }
    }
    doc.end(); await done;
    const bytes = Buffer.concat(chunks);
    assert.ok(bytes.length < 7864320);
    writeFileSync(path.join(fixtures, `${name}.pdf`), bytes);
    return { name, pages, imagesPerPage: images, extraContentStreamsPerPage: streams, bytes: bytes.length, sha256: sha(bytes) };
  }
  const manifest = [];
  for (const spec of [['text-1', 1, 0], ['text-500', 500, 0], ['images-500', 500, 1], ['content-500', 500, 0, 1], ['complex-500', 500, 0, 5]]) manifest.push(await pdf(...spec));
  writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const info = JSON.parse(docker(['image', 'inspect', image]))[0];
  assert.deepEqual(info.Config.Entrypoint, ['/sbin/tini', '--', '/usr/bin/node', '/opt/h24/server.mjs']);
  const purpose = 'h24-pd07-b03';
  const id = randomUUID();
  const volume = `h24-pd07-b03-${id}`;
  const name = volume;
  const sourceVolume = 'h24-pd03-signatures-20261028';
  docker(['volume', 'inspect', sourceVolume]);
  docker(['volume', 'create', '--label', `purpose=${purpose}`, volume]);
  const hardened = ['--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--memory', '4g', '--cpus', '2', '--pids-limit', '64', '--tmpfs', '/tmp:rw,nosuid,noexec,size=134217728,mode=1777'];
  try {
    // Preserve the existing signature volume. Only the disposable copy is writable.
    docker(['run', '--rm', '--pull', 'never', '--network', 'none', '--user', '0:0', '--cap-drop', 'ALL', '--cap-add', 'CHOWN', '--cap-add', 'DAC_OVERRIDE',
      '--read-only', '--security-opt', 'no-new-privileges', '--memory', '256m', '--pids-limit', '32',
      '--mount', `type=volume,source=${sourceVolume},target=/source,readonly`,
      '--mount', `type=volume,source=${volume},target=/var/lib/clamav,volume-nocopy`, '--entrypoint', '/bin/sh', image,
      '-c', 'cp -R /source/. /var/lib/clamav/ && chown -R 100:101 /var/lib/clamav']);
    // Only this bounded refresh has network access; no cloud credentials are mounted.
    const refresh = docker(['run', '--rm', '--pull', 'never', ...hardened,
      '--mount', `type=volume,source=${volume},target=/var/lib/clamav`, '--entrypoint', '/sbin/tini', image,
      '--', '/usr/bin/timeout', '-s', 'KILL', '120', 'freshclam', '--stdout', '--config-file=/opt/h24/freshclam.conf']);
    writeFileSync(path.join(root, 'freshclam.log'), refresh);
    console.log('Signature copy refreshed; remaining checks have network=none');
    for (const fixture of manifest) {
      const run = spawnSync('docker', ['--context', 'desktop-linux', 'run', '--rm', '--pull', 'never', '--network', 'none', ...hardened,
        '--mount', `type=bind,source=${fixtures},target=/fixtures,readonly`, '--entrypoint', '/bin/sh', inspector,
        '-c', 'node /opt/h24/inspect-stdin.mjs pdf < "$1"', 'sh', `/fixtures/${fixture.name}.pdf`],
        { encoding: 'utf8', windowsHide: true, timeout: 45_000 });
      assert.equal(run.status, 0, `${fixture.name}: ${run.stdout} ${run.stderr}`);
      assert.equal(run.stdout.trim(), `H24_POLICY_V1_PDF_OK ${fixture.sha256}`);
      console.log(`Parser OK: ${fixture.name}`);
    }
    const run = spawnSync('docker', ['--context', 'desktop-linux', 'run', '--pull', 'never', '--name', name,
      '--label', `purpose=${purpose}`, '--network', 'none', ...hardened,
      '--mount', `type=volume,source=${volume},target=/var/lib/clamav,readonly`,
      '--mount', `type=bind,source=${fixtures},target=/fixtures,readonly`,
      '--mount', `type=bind,source=${self},target=/probe.mjs,readonly`,
      '-e', 'H24_MAXFILES_LAB=true', '--entrypoint', '/sbin/tini', image,
      '--', '/usr/bin/node', '/probe.mjs', '--probe'],
      { encoding: 'utf8', windowsHide: true, timeout: 900_000, maxBuffer: 4 * 1024 * 1024 });
    writeFileSync(path.join(root, 'scan.jsonl'), run.stdout || '');
    writeFileSync(path.join(root, 'stderr.log'), run.stderr || '');
    console.log(run.stdout); if (run.stderr) console.error(run.stderr);
    const state = JSON.parse(docker(['inspect', name]))[0];
    writeFileSync(path.join(root, 'state.json'), JSON.stringify({ image, inspector, state: state.State, limits: state.HostConfig }, null, 2));
    assert.equal(run.error, undefined);
    assert.equal(state.State.OOMKilled, false);
    assert.equal(run.status, 0);
  } finally {
    const found = docker(['ps', '-aq', '--filter', `name=^/${name}$`]).trim();
    if (found) {
      const current = JSON.parse(docker(['inspect', name]))[0];
      assert.equal(current.Config.Labels.purpose, purpose);
      docker(['rm', '-f', name]);
    }
    assert.equal(JSON.parse(docker(['volume', 'inspect', volume]))[0].Labels.purpose, purpose);
    docker(['volume', 'rm', volume]);
    writeFileSync(path.join(root, 'cleanup.json'), JSON.stringify({ removedContainer: name, removedVolume: volume, preservedVolume: sourceVolume }, null, 2));
  }
  console.log('PD07-B03 safety assertions passed (not universal PDF acceptance); runtime policy unchanged.');
}
