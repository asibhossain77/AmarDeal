import { spawn } from 'child_process';
const log = [];
function logmsg(m) { log.push(m); if (log.length > 20) log.shift(); }

while (true) {
  const child = spawn('node', ['.next/standalone/server.js', '-p', '3000'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', d => process.stdout.write(d));
  child.stderr.on('data', d => process.stderr.write(d));
  child.on('exit', () => {
    logmsg('Server exited, restarting immediately...');
  });
  await new Promise(r => child.on('exit', r));
  await new Promise(r => setTimeout(r, 100));
}
