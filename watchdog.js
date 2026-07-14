const { spawn } = require('child_process');
const fs = require('fs');
const log = fs.openSync('/home/z/my-project/dev.log', 'a');

function startServer() {
  const child = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', log, log],
    detached: false
  });
  child.on('exit', () => {
    // Kill port
    const kill = spawn('fuser', ['-k', '3000/tcp'], { stdio: 'ignore' });
    kill.on('exit', () => {
      setTimeout(startServer, 500);
    });
  });
}
startServer();
