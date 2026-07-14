#!/bin/bash
# Fast server restart script
cd /home/z/my-project
pkill -f "next" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
sleep 1
rm -f dev.log
node node_modules/.bin/next dev -p 3000 > dev.log 2>&1 &
sleep 8
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
if [ "$HTTP" = "200" ]; then
  echo "✅ Server is running on port 3000"
else
  echo "❌ Server failed to start"
  tail -5 dev.log
fi