# H24 PD-03: isolated local ClamAV laboratory

Original harness: authorized scope A1/A2. A3 local adapters and tests are documented
below separately. Neither recipe connects to a database, Firebase or GCS.
Never deploy this image or add credentials, host mounts, Docker socket or public ports.
The harness creates the harmless EICAR marker only inside disposable container tmpfs.
Do not run `smoke.sh` on the host or open its test files in a browser.

## Reproduce after explicit test authorization

Commands are PowerShell, from the repository root. Use a new unique volume/run name
if these names already exist; do not delete or overwrite unrelated resources.
Docker needs sufficient free memory for the 4 GiB limit. The original scan used
about 963 MiB peak, but that is not a production sizing recommendation.

```powershell
$base = 'clamav/clamav@sha256:bda39705e291105049c3936e2803ac90b955172af8030f94f05dce1252df6c6d'
$volume = 'h24-pd03-signatures-20261028'
docker pull $base
docker volume create --label purpose=h24-pd03-signatures $volume
docker run --rm --no-healthcheck --user 100:101 --read-only --cap-drop ALL --security-opt no-new-privileges --memory 4g --memory-swap 4g --cpus 2 --pids-limit 128 --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777 --mount "type=volume,source=$volume,target=/var/lib/clamav" --entrypoint freshclam $base --stdout --log=/tmp/freshclam.log --datadir=/var/lib/clamav
# Stop if FreshClam failed; retain official signature validation.
if ($LASTEXITCODE -ne 0) { throw 'Signature update failed' }
docker build --network none -t h24-pd03-clamav:local tools/validation/h24-pd03
if ($LASTEXITCODE -ne 0) { throw 'Lab build failed' }
docker run --name h24-pd03-review --network none --read-only --cap-drop ALL --security-opt no-new-privileges --memory 4g --memory-swap 4g --cpus 2 --pids-limit 64 --tmpfs /tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777 --mount "type=volume,source=$volume,target=/var/lib/clamav,readonly" h24-pd03-clamav:local
docker inspect h24-pd03-review --format '{{json .State}}'
docker logs h24-pd03-review
# Require ExitCode=0, OOMKilled=false and LAB_RESULT=PASS / cleanup=PASS.
docker rm -v h24-pd03-review
```

The update phase alone has network access. The scan has no network, no published
ports, a read-only signature volume, no capabilities and a non-root user. The
healthcheck inherited from the official daemon image is disabled in the lab image
because this harness uses one-shot `clamscan`, not `clamd`.

Historical stale-signature check (no updated signature volume mounted):

```powershell
docker run --name h24-pd03-stale-review --no-healthcheck --network none --user 100:101 --read-only --cap-drop ALL --security-opt no-new-privileges --memory 4g --memory-swap 4g --cpus 2 --pids-limit 64 --tmpfs /tmp:rw,noexec,nosuid,nodev,size=32m,mode=1777 --entrypoint clamscan $base --fail-if-cvd-older-than=1 /etc/alpine-release
docker inspect h24-pd03-stale-review --format '{{json .State}}'
docker logs h24-pd03-stale-review
docker rm -v h24-pd03-stale-review
```

On 2026-10-28, bundled daily 28164 from October 25 failed with actual container
exit 2 and no file scanned. This check depends on the clock and pinned image data;
do not simulate by changing system time or modifying official signatures.

Clean scan status is not a PDF safety verdict. The malformed PDF and inert-JS PDF
are intentionally not detected by this engine/signature set. Keep structural
validation and active-content policy separate. Limits/errors/timeouts are never
clean; this version returns 2 for MaxFileSize exceeded. The one-second deadline
test interrupts signature loading; it does not demonstrate every parser timeout.

No fixtures are copied out. SHA-256 OK lines only mean test bytes were unchanged.
Do not disable Windows antivirus or retry around a quarantine. Stop and report
any host protection intervention. No npm install, audit fix, migrations or deploy.

## A3 local API adapters (not a Cloud Run deployment recipe)

`document-security.ts` starts disposable, networkless containers using bounded
stdin. It requires the H24 local/test settings explicitly, immutable image IDs
and a dedicated signature volume. It fails closed if these are missing. Do not
mount a Docker socket in the API image or deploy this local transport to cloud.

Build only from reviewed local sources. The parser base is the existing PD-01
image; verify its ID before using it. Its pure validator is overlaid with the
current API build. The Dockerfile-specific ignore restricts context to that
compiled module and the stdin wrapper, excluding credentials and other host files.

```powershell
docker --context desktop-linux image inspect nomina-api:h24-pdfinfo-local --format '{{.Id}}'
# Reviewed base: sha256:34658533a39f07a1e20e6a6c46c4aa8dded3a4a0e19bf5c9c14aabaf85ffa36a
npm --workspace apps/api run build
if ($LASTEXITCODE -ne 0) { throw 'API compilation failed' }
docker --context desktop-linux build --network none -f tools/validation/h24-pd03/Dockerfile.parser -t h24-pd03-parser:local .
if ($LASTEXITCODE -ne 0) { throw 'Parser build failed' }
docker --context desktop-linux build --network none -f tools/validation/h24-pd03/Dockerfile.av -t h24-pd03-av:local tools/validation/h24-pd03
if ($LASTEXITCODE -ne 0) { throw 'Scanner build failed' }
```

Run the pure transport tests in a **new disposable PowerShell session**. These
settings guard the adapter; the test imports no DB/Firebase/GCS client. Do not
reuse the session for an API/server command: A4 still requires authorization.

```powershell
$env:RUN_H24_DOCUMENT_SECURITY_DOCKER='true'
$env:DOCUMENT_SECURITY_MODE='docker-local'
$env:DB_NAME='nomina_docente_test'
$env:DB_HOST='127.0.0.1'
$env:FIREBASE_PROJECT_ID='nomina-h24-test-20261027'
$env:DOCUMENT_SECURITY_PARSER_IMAGE=(docker --context desktop-linux image inspect h24-pd03-parser:local --format '{{.Id}}').Trim()
$env:DOCUMENT_SECURITY_SCANNER_IMAGE=(docker --context desktop-linux image inspect h24-pd03-av:local --format '{{.Id}}').Trim()
$env:DOCUMENT_SECURITY_SIGNATURE_VOLUME='h24-pd03-signatures-20261028'
npm --workspace apps/api run test -- src/test/document-security.docker.test.ts
```

Five cases: benign PDF, inert JavaScript, encryption, malformed body and 501 pages.
Signatures older than two days must cause failure, not a skipped/pass assertion.
Refresh official signatures separately under the laboratory authorization above;
never grant network to the scanner or change the clock to bypass freshness.

`verify-adapter.sh` tests the actual AV wrapper (clean hash, EICAR rejection,
empty input and oversized input) and isolation. It must run only **inside** the
scanner container, with the same limits as the adapter. Send the script through
Node stdin to avoid the trailing CR added by PowerShell text pipelines:

```powershell
node --input-type=module -e 'import fs from "node:fs"; import {spawnSync} from "node:child_process"; const args=["--context","desktop-linux","run","--pull","never","--rm","-i","--name","h24-a3-adapter-check","--network","none","--read-only","--cap-drop","ALL","--security-opt","no-new-privileges","--memory","4g","--memory-swap","4g","--cpus","2","--pids-limit","64","--tmpfs","/tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777","--mount","type=volume,source=h24-pd03-signatures-20261028,target=/var/lib/clamav,readonly","--user","100:101","--entrypoint","/bin/sh","h24-pd03-av:local"]; const r=spawnSync("docker",args,{input:fs.readFileSync("tools/validation/h24-pd03/verify-adapter.sh","utf8").replaceAll("\r",""),encoding:"utf8",timeout:180000,windowsHide:true}); process.stdout.write(r.stdout||""); process.stderr.write(r.stderr||""); process.exit(r.status ?? 1);'
```

If interrupted, inspect/remove only `h24-a3-adapter-check`; do not prune other
containers or volumes. The application adapter itself has a finally cleanup.
Require exit 0 and ADAPTER_RESULT=PASS. Do not copy fixtures out of tmpfs.

See `docs/auditoria/H24_PD03_A3_Controles_PDF_ClamAV_Local.md` for evidence, image
IDs and limitations. Image decoding, full PDF active-content policy, native viewer
assurance and cloud isolation remain open. A4 was subsequently authorized and
validated against isolated test DB/GCS with exact restoration; see
`docs/auditoria/H24_PD03_A4_Integracion_PDF_ClamAV_GCS.md` for the 16 groups and
limits. That evidence does not authorize production configuration or deployment.
