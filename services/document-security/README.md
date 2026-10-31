# H24 isolated document security services

Test deployment only: `nomina-h24-test-20261027`, `us-central1`.
Production provisioning and release require separate approval. Do not copy test
database contents, bucket objects or credentials into production.

## Components

- `server.mjs`: bounded HTTP wrapper for the existing parser/policy and ClamAV.
  Cloud Run IAM is the authentication boundary: never grant `allUsers` or
  `allAuthenticatedUsers` Invoker. The wrapper itself does not verify JWTs.
- `Dockerfile.inspector`: pinned Node base, Poppler, qpdf and the existing locked
  sharp decoder. Runs non-root with a separate temporary directory per request.
- `Dockerfile.scanner`: pinned ClamAV base, non-root, official signature updates
  before scans and every six hours of use; the existing signature-age gate remains.
  Uses the pinned base's `/sbin/tini` as PID 1 to reap orphan BusyBox timeout
  watchdogs. Do not override the image entrypoint with Node alone: under repeated
  scans, unreaped zombies exhaust the process limit. No process-limit increase is
  required by this correction. Application process-group deadlines remain in place.
- `rehearsal.mjs` / `Dockerfile.rehearsal`: TEST ONLY. Creates loopback PostgreSQL
  and synthetic `nomina_docente_test` inside a job, exercises the real recovery
  worker and removes its database and tracked synthetic GCS objects. Not the
  production worker image or a substitute for a full H05 migration rehearsal.

The allowlist `.dockerignore` files prevent local credentials, CSVs, dumps and
unrelated workspace files from entering image build contexts.

## Build and local checks

From repository root, with reviewed lockfiles and a Linux Docker engine:

```powershell
npm ci
npm --workspace apps/api run build
node --test services/document-security/server.test.mjs
docker build -f services/document-security/Dockerfile.inspector -t h24-cloud-inspector:20261029 .
docker build -f services/document-security/Dockerfile.scanner -t h24-cloud-scanner:20261029 .
docker build -f services/document-security/Dockerfile.rehearsal -t h24-cloud-recovery:20261029 .
```

API `dist` must be freshly built from the reviewed source. Never interpret an old
image as evidence for a newer lockfile. `smoke-local.mjs` expects disposable named
containers at loopback ports 5261/5262; it uses synthetic files only.

### Scanner process regression (PD07-B02)

Build the scanner locally, then run the opt-in Linux lifecycle regression with
an immutable local image ID. This uses `desktop-linux`, no network, no DB and
no signature volume; it reproduces the old Node-PID-1 leak as a negative control
and checks 100 successful commands plus deadline exits under tini, at 64 PIDs.
A separate isolated container verifies the shipped entrypoint's health endpoint
and clean SIGTERM shutdown without starting a scan.

```powershell
$env:RUN_H24_SCANNER_LIFECYCLE='true'
$env:H24_SCANNER_LIFECYCLE_IMAGE=(docker --context desktop-linux image inspect h24-cloud-scanner:pd07-b02-local-20261030 --format '{{.Id}}')
node --test services/document-security/process-lifecycle.test.mjs
```

`scanner-load-local.mjs` is a separate, explicit scanner-only rehearsal. It
requires the disposable container `h24-pd07-b02-scanner`, label
`purpose=h24-pd07-b02`, port `127.0.0.1:5262`, 64 PIDs and 4 GiB. The actual image
entrypoint and runner must be used. Use a private disposable COPY of signatures,
never mount a shared signature volume writable. Freshclam needs its normal
official update connectivity; do not remove it or weaken the age gate.

```powershell
$env:RUN_H24_SCANNER_LOAD='true'
node services/document-security/scanner-load-local.mjs
```

The bounded workload is two clients, ten synthetic PDFs each, three AV checks
per PDF plus warmup. Explicit harness 429 retries are NOT an API queue or a
promise that the end-to-end application batch will succeed. Evidence is written
under `.cache/pd07-b02-20261030`; remove only the labelled disposable container
and its private volume after verifying results. This does not deploy anything.

### MaxFiles policy experiment (PD07-B03)

`scanner-maxfiles-local.mjs` is an opt-in, synthetic, Docker-only comparison of
MaxFiles 100/1000/2000. It does not edit the runtime wrapper or deploy an image.
Use immutable existing local scanner (with tini) and inspector image IDs:

```powershell
$env:RUN_H24_MAXFILES_LAB='true'
$env:H24_MAXFILES_IMAGE=(docker --context desktop-linux image inspect h24-cloud-scanner:pd07-b02-local-20261030 --format '{{.Id}}')
$env:H24_MAXFILES_INSPECTOR_IMAGE=(docker --context desktop-linux image inspect h24-cloud-inspector:20261029 --format '{{.Id}}')
node services/document-security/scanner-maxfiles-local.mjs
```

Requires the existing local `h24-pd03-signatures-20261028` volume. It creates a
private copy, refreshes only that copy using official freshclam connectivity,
then runs all parser/AV checks without networking. No credentials, DB or
institutional files are used. EICAR is generated only in container tmpfs.
The copy bootstrap alone uses CHOWN/DAC_OVERRIDE; analyses run non-root with all
capabilities dropped. Containers/volume are removed with identity/label guards.

Evidence is written under a unique `.cache/pd07-b03/<uuid>` directory. Successful
safety assertions do NOT mean every 500-page PDF was accepted: the report records
clean and bounded/unavailable outcomes separately. More extracted streams may
hit MaxScanTime even after increasing MaxFiles. Never remove scan/time/size
limits to make a fixture pass. See
`docs/auditoria/H24_PD07_B03_Revision_MaxFiles_ClamAV.md` for the proposal,
failed exploratory runs and remaining implementation/release decisions.

## Transport contract

Private `GET /health`; private `POST /v1/check/pdf|png|jpeg` for inspector and
`POST /v1/check/av` for scanner. Binary octet-stream, request UUID, no compression,
7.5 MiB maximum, one active request per instance. No filenames, tokens or document
contents in normal service logs. Synthetic job object manifests are test-only.

API configuration is explicit: `DOCUMENT_SECURITY_MODE=cloud-run`,
`DOCUMENT_SECURITY_PARSER_URL`, `DOCUMENT_SECURITY_SCANNER_URL`. Only HTTPS run.app
origins are accepted. Cloud Run runtime identity obtains an ID token from metadata
for the exact destination audience; no service-account key or Firebase user token.
The local Docker mode remains unchanged. Failures never fall back to unchecked
documents. Hash, policy verdict, AV verdict and correlation are all verified.

Inspector client timeout 40 s; scanner 230 s (signature refresh up to 100 s, scan
up to 120 s). Response <=1024 bytes. Server body timeout 15 s; child deadlines and
process-group termination bound execution. Cloud service timeout 45/240 s.

## Isolated cloud resources and cost controls

Registry: `us-central1-docker.pkg.dev/nomina-h24-test-20261027/h24-document-security`.
Services `h24-document-inspector` (1 CPU/512 MiB) and `h24-document-scanner`
(2 CPU/4 GiB), min instances 0, max service/revision instances 1, concurrency 1.
Separate service identities have no project-level DB/storage grants. Only
`h24-dossier-runtime` may invoke them. No public Invoker binding.

Job `h24-recovery-rehearsal`: 1 task, parallelism 1, retries 0, timeout 900 s,
1 CPU/1 GiB. Runtime identity has existing isolated GCS access. Job guard requires
the exact name, H24 metadata project and `H24_ALLOW_EPHEMERAL_REHEARSAL=true`.
Never add a connection to real Cloud SQL to this image.

Scheduler `h24-recovery-validation` uses its own identity with Invoker on that job
only, OAuth to the Run jobs API and no retries. Manual Run Now was tested; the
annual placeholder schedule is PAUSED after the trial. It is not the production
recovery cadence. Monitoring has an email channel and an ERROR log-match policy
limited to these H24 services/job; email delivery needs recipient confirmation.

PowerShell must quote comma-separated environment flags, for example:
`--set-env-vars='H24_ALLOW_EPHEMERAL_REHEARSAL=true,H24_TEST_ALERT=true'`.
Describe the job and verify two distinct values before execution. Never print
identity/access tokens or commit temporary Docker login configuration.

## Limits and release gates

PD07-B03 local protocol: an unambiguous completed static-limit verdict
(MaxFiles, MaxScanSize, MaxFileSize or MaxRecursion) returns exit 40 and
`H24_SCAN_LIMIT <sha256>`. The API binds the hash to the PDF and returns
422 `DOCUMENT_SCAN_LIMIT_EXCEEDED`; uploads/replacements remain blocked and
reads do not return document bytes. MaxScanTime, errors, mixed or unknown
diagnostics remain unavailable (30/503). Non-PDF code 40 remains unavailable.
MaxFiles stays 100; no capacity, freshness, encryption or timeout guard changes.

`scanner-limit-protocol.test.mjs` is an opt-in Docker classifier test with
synthetic clamscan output. Set `RUN_H24_LIMIT_PROTOCOL=true` and immutable
`H24_LIMIT_PROTOCOL_IMAGE` to the locally built scanner. Only this synthetic
stub test needs an executable tmpfs; real scans retain noexec and network none.
The API opt-in test `document-scan-limit.docker.test.ts` uses real inspector/AV
containers with mocked persistence/auth. See
`docs/auditoria/H24_PD07_B03_Mensaje_Limites_Analisis_PDF.md` for commands,
evidence boundaries and release limitations. Neither test is cloud acceptance.

Private IAM is not an egress firewall. Cloud containers are not claimed equivalent
to local `--network none` or read-only-root isolation. Review egress, parser attack
surface, signature freshness monitoring, capacity and native PDF viewer residual
risk before production. A healthy endpoint does not prove full recovery or safety.
AV is defense in depth, not a guarantee that every document is harmless.

See `docs/auditoria/H24_PD03_PD04_Arquitectura_Cloud_Aislada.md` for immutable image
digests, execution IDs, results and remaining gates. Stop admission on incidents;
do not delete untracked/historical objects or reset a shared database to clean up.

References: [Run service identity](https://docs.cloud.google.com/run/docs/authenticating/service-to-service),
[scheduled jobs](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule),
[container contract](https://docs.cloud.google.com/run/docs/container-contract),
[ClamAV signatures](https://docs.clamav.net/manual/Usage/SignatureManagement.html).
