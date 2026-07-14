#!/bin/bash
cd /home/z/my-project
while true; do
  npx next dev -p 3000 >> dev.log 2>&1
  fuser -k 3000/tcp 2>/dev/null
  sleep 1
done
