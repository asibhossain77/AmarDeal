#!/bin/bash
cd /home/z/my-project
while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ":3000 "; then
    echo "$(date): Server not running, starting..." >> /home/z/my-project/dev.log
    npx next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    sleep 5
    # Trigger initial compilation
    curl -s -o /dev/null --max-time 10 http://127.0.0.1:3000/ 2>/dev/null
  fi
  sleep 10
done
