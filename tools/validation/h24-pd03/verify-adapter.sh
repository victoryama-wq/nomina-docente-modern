#!/bin/sh
# Test code only: the harmless EICAR fixture exists exclusively in container tmpfs.
set -eu
umask 077
root=$(mktemp -d /tmp/h24-adapter.XXXXXX)
trap 'rm -rf "$root"' EXIT
test "$(id -u)" = 100
test "$(awk '/^CapEff:/ {print $2}' /proc/self/status)" = 0000000000000000
test "$(awk '/^NoNewPrivs:/ {print $2}' /proc/self/status)" = 1
test "$(wc -l < /proc/net/route)" -eq 1
test ! -e /var/run/docker.sock
if touch /opt/h24/not-allowed 2>/dev/null; then exit 1; fi
run_case() {
  label=$1
  expected=$2
  set +e
  /bin/sh /opt/h24/scan-stdin.sh < "$root/input" > "$root/result" 2> "$root/error"
  rc=$?
  set -e
  test "$rc" -eq "$expected"
  test ! -s "$root/error"
  printf 'CASE=%s code=%s verdict=' "$label" "$rc"
  cat "$root/result"
}
printf 'Synthetic clean adapter input.\n' > "$root/input"
run_case clean 0
test "$(cat "$root/result")" = "H24_AV_OK $(sha256sum "$root/input" | awk '{print $1}')"
printf '%s%s%s' 'X5O!P%@AP[4\PZX54(P^)7CC)7}' '$EICAR-STANDARD-ANTIVIRUS-' 'TEST-FILE!$H+H*' > "$root/input"
test "$(wc -c < "$root/input")" -eq 68
run_case eicar 20
test "$(cat "$root/result")" = H24_REJECTED
: > "$root/input"
run_case empty 10
head -c 7864321 /dev/zero > "$root/input"
run_case oversized 10
printf 'ADAPTER_RESULT=PASS isolation=PASS\n'
