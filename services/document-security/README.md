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
