import net from 'node:net';
import http from 'node:http';

const BACKEND = 3001; // standalone server on this port
const FRONTEND = 3000; // proxy on this port (Caddy connects here)

// Simple HTTP request queue - serialize all requests
const queue = [];
let active = false;

function processQueue() {
  if (active || queue.length === 0) return;
  active = true;
  const { req, res, socket } = queue.shift();
  
  const proxy = http.request({
    hostname: '127.0.0.1',
    port: BACKEND,
    path: req.url,
    method: req.method,
    headers: req.headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxy.on('error', () => {
    res.writeHead(502);
    res.end('Bad Gateway');
    active = false;
    processQueue();
  });
  proxy.on('close', () => {
    active = false;
    processQueue();
  });
  req.pipe(proxy);
}

http.createServer((req, res) => {
  queue.push({ req, res });
  processQueue();
}).listen(FRONTEND, '127.0.0.1', () => {
  console.log('Proxy on :' + FRONTEND + ' -> :' + BACKEND);
});
