#!/bin/bash
# আমার ডিল - Dev Server Auto-Restart Script
# ব্যবহার: bash /home/z/my-project/start-server.sh
# সার্ভার ইতিমধ্যে চললে নতুন করে শুরু করবে না
# সার্ভার বন্ধ থাকলে স্বয়ংক্রিয়ভাবে চালু করবে

cd /home/z/my-project

# Check if already running
if curl -s -o /dev/null -w "" --max-time 3 http://localhost:3000/ 2>/dev/null; then
  echo "✅ Server already running on port 3000"
  exit 0
fi

# Kill any leftover processes
fuser -k 3000/tcp 2>/dev/null
sleep 1

# Start server
echo "🚀 Starting Next.js dev server..." | tee -a /home/z/my-project/server-watchdog.log
nohup setsid node node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
disown

# Wait for ready (max 2 minutes)
for i in $(seq 1 60); do
  sleep 2
  if curl -s -o /dev/null -w "" --max-time 3 http://localhost:3000/ 2>/dev/null; then
    echo "✅ Server ready! (attempt $i, $(date))" | tee -a /home/z/my-project/server-watchdog.log
    exit 0
  fi
done

echo "❌ Server failed to start" | tee -a /home/z/my-project/server-watchdog.log
exit 1