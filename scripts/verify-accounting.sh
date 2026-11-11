#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/accounting/oracle.py --check
node scripts/check-structure.mjs
node --test tests/*.test.cjs
node --test tools/backup/*.test.mjs tools/backup/*.test.cjs
node tools/accounting/mutations.cjs
verification_dir=$(mktemp -d /tmp/tefinanza-verification.XXXXXX)
verification_port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
python3 -m http.server "$verification_port" --bind 127.0.0.1 --directory . > "$verification_dir/server.log" 2>&1 &
verification_server=$!
trap 'kill "$verification_server" 2>/dev/null || true; wait "$verification_server" 2>/dev/null || true' EXIT
verification_ready=0
for attempt in {1..50}; do
  if curl -fsS "http://127.0.0.1:$verification_port/" -o /dev/null 2>/dev/null; then verification_ready=1; break; fi
  sleep 0.1
done
if [ "$verification_ready" != 1 ]; then cat "$verification_dir/server.log"; exit 1; fi
export TEFINANZA_TEST_ORIGIN="http://127.0.0.1:$verification_port"
if [ -z "${CHROMIUM_PATH:-}" ]; then
  CHROMIUM_PATH=$(command -v chromium || command -v google-chrome || command -v google-chrome-stable)
  export CHROMIUM_PATH
fi
node tools/accounting/lifecycle.browser.cjs
