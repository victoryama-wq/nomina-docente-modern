#!/bin/sh
# Authorized A1/A2 laboratory only; generates EICAR exclusively in container tmpfs.
set -eu
umask 077
export LC_ALL=C
root=$(mktemp -d /tmp/h24-pd03.XXXXXX)
trap 'rm -rf "$root"' EXIT
mkdir "$root/corpus" "$root/empty-db" "$root/scanner-temp"
printf 'UTC_START=%s\n' "$(date -u +%FT%TZ)"
id
clamscan --version
grep '^CapEff:\|^NoNewPrivs:' /proc/self/status
cat /proc/net/route
test "$(id -u)" = 100
test "$(awk '/^CapEff:/ {print $2}' /proc/self/status)" = 0000000000000000
test "$(awk '/^NoNewPrivs:/ {print $2}' /proc/self/status)" = 1
test "$(wc -l < /proc/net/route)" -eq 1
test ! -e /var/run/docker.sock
if touch /opt/h24/should-not-write 2>/dev/null; then
  echo 'FAIL root filesystem is writable'
  exit 1
fi
printf 'Synthetic clean H24 file. No personal data.\n' > "$root/corpus/clean.txt"
awk -v mode=plain -f /opt/h24/pdf.awk > "$root/corpus/clean.pdf"
awk -v mode=js -f /opt/h24/pdf.awk > "$root/corpus/inert-js.pdf"
printf '%%PDF-1.7\nsynthetic invalid body\n%%%%EOF\n' > "$root/corpus/malformed.pdf"

# The standard harmless marker is assembled here, not stored in the image/host.
# Never execute it; it exists only as scanner input in this disposable tmpfs.
printf '%s%s%s' 'X5O!P%@AP[4\PZX54(P^)7CC)7}' '$EICAR-STANDARD-ANTIVIRUS-' 'TEST-FILE!$H+H*' > "$root/corpus/eicar.txt"
test "$(wc -c < "$root/corpus/eicar.txt")" -eq 68
test "$(md5sum "$root/corpus/eicar.txt" | awk '{print $1}')" = 44d88612fea8a8f36de82e1278abb02f
cp "$root/corpus/eicar.txt" "$root/corpus/mislabeled.pdf"
awk -v mode=embedded -v markerFile="$root/corpus/eicar.txt" -f /opt/h24/pdf.awk > "$root/corpus/embedded-eicar.pdf"
sha256sum "$root/corpus/"* > "$root/before.sha256"

scan() {
  timeout -s KILL 120 clamscan --database=/var/lib/clamav --official-db-only=yes \
    --fail-if-cvd-older-than=2 --scan-pdf=yes --alert-encrypted=yes \
    --alert-exceeds-max=yes --max-filesize=8M --max-scansize=32M \
    --max-recursion=8 --max-files=100 --max-scantime=10000 \
    --tempdir="$root/scanner-temp" "$@"
}
run_case() {
  label=$1
  expected=$2
  shift 2
  start=$(date +%s)
  set +e
  "$@" > "$root/$label.log" 2>&1
  actual=$?
  set -e
  cat "$root/$label.log"
  printf 'CASE=%s expected=%s actual=%s elapsed_seconds=%s\n' "$label" "$expected" "$actual" "$(($(date +%s) - start))"
  test "$actual" -eq "$expected"
}
run_case clean 0 scan "$root/corpus/clean.txt" "$root/corpus/clean.pdf"
run_case detection 1 scan "$root/corpus/eicar.txt" "$root/corpus/mislabeled.pdf" "$root/corpus/embedded-eicar.pdf"
test "$(grep -c 'Eicar.*FOUND' "$root/detection.log")" -eq 3

# Antivirus OK is NOT a structural validation or active-content policy verdict.
run_case structural-gap 0 scan "$root/corpus/malformed.pdf" "$root/corpus/inert-js.pdf"
run_case missing-db 2 clamscan --database="$root/empty-db" "$root/corpus/clean.pdf"
awk 'BEGIN { for (i=0; i<65536; i++) printf "A" }' > "$root/limit.txt"
# Do not repeat max-filesize through scan(): repeated options are ambiguous.
# ClamAV 1.5.4 reports this limit as ERROR (2), not a malware detection (1).
run_case size-limit 2 timeout -s KILL 120 clamscan --database=/var/lib/clamav \
  --official-db-only=yes --fail-if-cvd-older-than=2 --alert-exceeds-max=yes \
  --max-filesize=1024 --max-scansize=1024 --tempdir="$root/scanner-temp" "$root/limit.txt"
grep -q 'Heuristics.Limits.Exceeded' "$root/size-limit.log"

# Exercise an actual scanner deadline while loading official signatures.
start=$(date +%s)
set +e
timeout -s KILL 1 clamscan --database=/var/lib/clamav "$root/corpus/clean.pdf" > "$root/deadline.log" 2>&1
deadline_rc=$?
set -e
cat "$root/deadline.log"
printf 'CASE=deadline actual=%s elapsed_seconds=%s\n' "$deadline_rc" "$(($(date +%s) - start))"
test "$deadline_rc" -eq 137
printf 'CONTENT_HASH_VERIFICATION_ONLY (not antivirus verdicts)\n'
sha256sum -c "$root/before.sha256"
printf 'SIGNATURE_HASHES\n'
sha256sum /var/lib/clamav/*.cvd /var/lib/clamav/*.cld
printf 'CGROUP_MEMORY_PEAK_BYTES='
cat /sys/fs/cgroup/memory.peak
printf 'TMP_USAGE\n'
du -sk "$root"
rm -rf "$root"
test ! -e "$root"
printf 'LAB_RESULT=PASS cleanup=PASS UTC_END=%s\n' "$(date -u +%FT%TZ)"
