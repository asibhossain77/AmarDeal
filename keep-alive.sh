#!/bin/bash
cd /home/z/my-project
# Kill any stale processes on port 3000
fuser -k 3000/tcp 2>/dev/null
sleep 1
while true; do
  echo "[$(date)] Starting server..." >> dev.log 2>&1
  npx next dev -p 3000 >> dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 1s..." >> dev.log 2>&1
  # Kill any remaining processes on port 3000
  fuser -k 3000/tcp 2>/dev/null
  sleep 1
done