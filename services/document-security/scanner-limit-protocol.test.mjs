import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

if (process.env.H24_LIMIT_PROTOCOL_CONTAINER === 'true') {
  const root = mkdtempSync('/tmp/h24-protocol-');
  mkdirSync(`${root}/bin`);
  // Synthetic diagnostics only. Does not scan, change signatures or write host files.
  writeFileSync(`${root}/bin/clamscan`, `#!/bin/sh
for input; do :; done
case "$H24_PROTOCOL_CASE" in
  clean) echo "$input: OK"; echo 'Scanned files: 1'; echo 'Infected files: 0'; exit 0;;
  malware) echo "$input: Win.Test.EICAR_HDB-1 FOUND"; echo 'Scanned files: 1'; echo 'Infected files: 1'; exit 1;;
  engine) echo 'ERROR: database unavailable'; exit 2;;
  timeout) echo "$input: Heuristics.Limits.Exceeded.MaxScanTime FOUND"; echo 'Scanned files: 1'; echo 'Infected files: 1'; exit 1;;
  unknown) echo "$input: Heuristics.Limits.Exceeded.Unknown FOUND"; echo 'Scanned files: 1'; echo 'Infected files: 1'; exit 1;;
esac
limit=MaxFiles
case "$H24_PROTOCOL_CASE" in MaxScanSize|MaxFileSize|MaxRecursion) limit="$H24_PROTOCOL_CASE";; esac
echo "$input: Heuristics.Limits.Exceeded.$limit FOUND"
case "$H24_PROTOCOL_CASE" in
  warning) echo 'WARNING: synthetic';;
  mixed) echo "$input: Win.Test.EICAR_HDB-1 FOUND";;
  duplicate) echo "$input: Heuristics.Limits.Exceeded.$limit FOUND";;
  contradictory) echo "$input: OK";;
  wrong-path) echo '/different/input: ERROR';;
  summary-missing) exit 1;;
esac
echo 'Scanned files: 1'; echo 'Infected files: 1'
if [ "$H24_PROTOCOL_CASE" = engine-limit ]; then exit 2; fi
exit 1
`.replace(/\r\n/g, '\n'), { mode: 0o700 });
  const syntax = spawnSync('/bin/sh', ['-n', `${root}/bin/clamscan`], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  const input = Buffer.from('%PDF-1.7\nsynthetic\n');
  const hash = createHash('sha256').update(input).digest('hex');
  const cases = [
    ...['MaxFiles', 'MaxScanSize', 'MaxFileSize', 'MaxRecursion'].map(name => [name, 40, `H24_SCAN_LIMIT ${hash}`]),
    ['clean', 0, `H24_AV_OK ${hash}`], ['malware', 20, 'H24_REJECTED'],
    ...['engine', 'timeout', 'unknown', 'warning', 'mixed', 'duplicate', 'contradictory', 'wrong-path', 'summary-missing', 'engine-limit']
      .map(name => [name, 30, 'H24_UNAVAILABLE'])
  ];
  test('actual shell classifier preserves ambiguity and exact static-limit protocol', () => {
    try {
      for (const [name, code, output] of cases) {
        const result = spawnSync('/bin/sh', ['/opt/h24/scan-stdin.sh'], {
          input, encoding: 'utf8', timeout: 5000,
          env: { PATH: `${root}/bin:/usr/bin:/bin`, H24_PROTOCOL_CASE: name, TMPDIR: root }
        });
        assert.equal(result.error, undefined); assert.equal(result.status, code, name);
        assert.equal(result.stdout.trim(), output, name); assert.equal(result.stderr, '', name);
      }
      console.log(`Classifier cases passed: ${cases.length}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
} else {
  test('PD07-B03 shell classifier in isolated Linux Docker', { skip: process.env.RUN_H24_LIMIT_PROTOCOL !== 'true' }, () => {
    const image = process.env.H24_LIMIT_PROTOCOL_IMAGE;
    assert.match(image || '', /^sha256:[a-f0-9]{64}$/);
    const output = execFileSync('docker', ['--context', 'desktop-linux', 'run', '--rm', '--pull', 'never',
      '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--memory', '128m', '--cpus', '1', '--pids-limit', '64',
      '--tmpfs', '/tmp:rw,exec,nosuid,nodev,size=16m,mode=1777',
      '--mount', `type=bind,source=${fileURLToPath(import.meta.url)},target=/probe.mjs,readonly`,
      '-e', 'H24_LIMIT_PROTOCOL_CONTAINER=true', '--entrypoint', '/sbin/tini', image,
      '--', '/usr/bin/node', '--test', '/probe.mjs'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
    assert.match(output, /Classifier cases passed: 16/);
    console.log(output);
  });
}
