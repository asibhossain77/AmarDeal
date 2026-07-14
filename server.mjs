import { spawn } from 'node:child_process';
import net from 'node:net';

function start() {
  const child = spawn('node', ['.next/standalone/server.js', '-p', '3000'], {
    cwd: '/home/z/my-project',
    detached: false,
    stdio: 'ignore',
  });
  child.unref();
  child.on('exit', () => {
    setTimeout(start, 200);
  });
}

// Check if port 3000 is already in use, if not start server
const s = net.createServer();
s.once('error', () => { start(); s.close(); });
s.once('listening', () => { s.close(); }); // port free, server will bind
s.listen(3000, '127.0.0.1');
