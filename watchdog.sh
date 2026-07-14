#!/bin/bash
cd /home/z/my-project
while true; do
  fuser -k 3000/tcp 2>/dev/null
  sleep 0.5
  npx next dev -p 3000 >> dev.log 2>&1
  sleep 0.5
done
