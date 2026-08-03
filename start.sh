#!/bin/bash
PORT=3000

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "[start] Stopping any existing process on port $PORT..."
PID=$(ss -tlnp | grep ":$PORT " | sed -n 's/.*pid=\([0-9]*\).*/\1/p')
if [ -n "$PID" ]; then
  kill "$PID" 2>/dev/null
  for i in 1 2 3 4 5; do
    if ! kill -0 "$PID" 2>/dev/null; then break; fi
    sleep 1
  done
  if kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID" 2>/dev/null
  fi
  echo "[start] Stopped old process (PID $PID)"
fi

echo "[start] Cleaning build cache..."
rm -rf dist/

echo "[start] Starting dev server..."
nohup pnpm run dev > /tmp/dev-server.log 2>&1 &
disown
DEV_PID=$!

for i in $(seq 1 30); do
  SS_PID=$(ss -tlnp | grep ":$PORT " | sed -n 's/.*pid=\([0-9]*\).*/\1/p')
  if [ -n "$SS_PID" ]; then
    echo "[start] Server is ready on port $PORT (PID $SS_PID)"
    echo "[start] http://localhost:$PORT"
    exit 0
  fi
  sleep 1
done

echo "[start] Timed out waiting for server on port $PORT"
exit 1