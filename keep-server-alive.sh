#!/bin/bash
cd /home/z/my-project
while true; do
  fuser -k 3000/tcp 2>/dev/null
  sleep 1
  echo "[$(date)] Starting server..." >> /home/z/my-project/server-watchdog.log
  setsid node node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  echo "[$(date)] Server exited, restarting..." >> /home/z/my-project/server-watchdog.log
  sleep 2
done
