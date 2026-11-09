# PD07-B04 bounded concurrency probe

> Historical analyzer laboratory, archived 2026-11-09. Not a deployment or
> validation recipe for current BASIC_ENVELOPE_V1. Replay the historical SHA
> only with separate isolated authorization. Current results and policy:
> docs/auditoria/H24_Retirada_Analizadores_20261109.md.
> The updated preview-local.mjs alone validates the current information-only
> view and authorized downloads, without Firebase, DB, cloud or analyzers.

Local diagnostic only: no DB, GCS, Firebase, Cloud Run deploy or credentials.
Run from the repository root with existing dependencies and Docker desktop-linux:

```powershell
$env:H24_PD07_B04_APPROVED='true'
node --import tsx tools/validation/h24-pd07-b04/probe.mjs baseline
node --import tsx tools/validation/h24-pd07-b04/probe.mjs candidate
```

Baseline requires existing `h24-pd07-e2e-efa3a0e9-scanner` and `-inspector` images;
their immutable IDs are recorded. Candidate builds the actual local Dockerfiles.
Requires the existing `h24-pd03-signatures-20261028` volume, mounted read-only only
to bootstrap a private disposable copy. Freshclam updates that copy through its
normal official connectivity. Do not replace signatures or disable freshness.

The workload uses one synthetic PDF, two overlapping parser requests, two AV
requests and two clients each performing two complete parser/AV validations.
The first AV pair includes cold signature update. No retry; maximum 32 internal
requests and a 15-minute admission guard, plus subprocess timeouts. Ports
127.0.0.1:58581/58582 must be free. Scanner: 4 GiB/2 CPU/64 PIDs; inspector:
512 MiB/1 CPU/64 PIDs, read-only roots and bounded tmpfs. Not a load generator.

Evidence goes to ignored `.cache/pd07-b04/<phase>-<uuid>/`: image IDs, responses,
timings, resource/log snapshots and cleanup. Own containers/volume have unique
names and `purpose=h24-pd07-b04` labels; cleanup verifies identity before removal.
Images remain local. No change to shared signatures or existing services.

Candidate asserts both clients complete below 55 s and raw pairs return 200/code0.
That threshold for this one-page probe is NOT a Hosting guarantee or proof of
large-file/batch capacity. No API HTTP admission, database, browser, external auth,
proxy or storage is exercised. Keep full capacity and cloud validation separate.

Evidence: `docs/auditoria/H24_PD07_B04_Correccion_Concurrencia_Analizadores.md`.
