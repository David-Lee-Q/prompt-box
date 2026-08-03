#!/bin/bash
PORT=3000

PID=$(ss -tlnp | grep ":$PORT " | sed -n 's/.*pid=\([0-9]*\).*/\1/p')

if [ -z "$PID" ]; then
  echo "[stop] No process found on port $PORT"
  exit 0
fi

echo "[stop] Found process (PID $PID) on port $PORT, stopping..."
kill "$PID"
for i in 1 2 3 4 5; do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "[stop] Process $PID stopped"
    exit 0
  fi
  sleep 1
done

echo "[stop] Process $PID did not stop gracefully, sending SIGKILL..."
kill -9 "$PID"
echo "[stop] Process $PID killed"