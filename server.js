const { spawn, execSync } = require('child_process');
const fs = require('fs');
const logFd = fs.openSync('/home/z/my-project/dev.log', 'a');

function cleanup() {
  try {
    const result = execSync('fuser 3000/tcp 2>/dev/null', { encoding: 'utf8' }).trim();
    if (result) {
      execSync(`kill -9 ${result.split('\n').join(' ')} 2>/dev/null`);
    }
  } catch {}
}

function start() {
  cleanup();
  const child = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: '/home/z/my-project',
    stdio: [logFd, logFd, logFd],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  child.on('exit', () => {
    setTimeout(start, 300);
  });
  child.on('error', () => {
    setTimeout(start, 1000);
  });
}

// Handle signals
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT', () => { cleanup(); process.exit(0); });

start();
