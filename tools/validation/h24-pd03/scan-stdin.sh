#!/bin/sh
set -eu
umask 077
export LC_ALL=C
root=$(mktemp -d "${TMPDIR:-/tmp}/h24-scan.XXXXXX")
trap 'rm -rf "$root"' EXIT
# Never persist input outside this size-limited container tmpfs.
head -c 7864321 > "$root/input"
size=$(wc -c < "$root/input")
if [ "$size" -eq 0 ] || [ "$size" -gt 7864320 ]; then
  echo H24_INVALID
  exit 10
fi
set +e
timeout -s KILL 115 clamscan --database=/var/lib/clamav --official-db-only=yes \
  --fail-if-cvd-older-than=2 --scan-pdf=yes --alert-encrypted=yes --alert-exceeds-max=yes \
  --max-filesize=8M --max-scansize=32M --max-recursion=8 --max-files=100 \
  --max-scantime=10000 --tempdir="$root" "$root/input" > "$root/result" 2>&1
rc=$?
set -e
# Exit 0 alone is insufficient: reject diagnostics/skips and require one completed scan.
if [ "$rc" -eq 0 ] && grep -q "^$root/input: OK$" "$root/result" &&
   grep -q '^Scanned files: 1$' "$root/result" && grep -q '^Infected files: 0$' "$root/result" &&
   ! grep -Ei 'warning|error|limit|skip|time.*exceed|timed out|FOUND' "$root/result" > /dev/null; then
  hash=$(sha256sum "$root/input" | awk '{print $1}')
  echo "H24_AV_OK $hash"
elif [ "$rc" -eq 1 ] && grep -q ' FOUND$' "$root/result" &&
     ! grep -Ei 'error|limit|skip|time.*exceed|timed out' "$root/result" > /dev/null; then
  echo H24_REJECTED
  exit 20
else
  echo H24_UNAVAILABLE
  exit 30
fi
