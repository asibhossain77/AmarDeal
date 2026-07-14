import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 3000;
const DIR = '/home/z/my-project/.next/server';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const feeRules = '[{"id":1,"minimum_amount":1,"maximum_amount":499,"fee":10,"is_active":true},{"id":2,"minimum_amount":500,"maximum_amount":1999,"fee":30,"is_active":true},{"id":3,"minimum_amount":2000,"maximum_amount":4999,"fee":50,"is_active":true},{"id":4,"minimum_amount":5000,"maximum_amount":9999,"fee":80,"is_active":true},{"id":5,"minimum_amount":10000,"maximum_amount":24999,"fee":150,"is_active":true},{"id":6,"minimum_amount":25000,"maximum_amount":0,"fee":250,"is_active":true}]';

http.createServer((req, res) => {
  // API routes
  if (req.url === '/api/fee-structure') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(feeRules);
    return;
  }
  if (req.url?.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
    return;
  }

  // Static files from .next/server
  let urlPath = req.url?.split('?')[0] || '/';
  if (urlPath === '/') urlPath = '/index.html';
  
  // Try .next/server/app/index.html first, then .next/server/index.html
  let filePath = path.join(DIR, 'app' + urlPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIR, urlPath);
  }
  if (!fs.existsSync(filePath)) {
    // Try as .html
    if (!filePath.endsWith('.html') && !filePath.endsWith('.js') && !filePath.endsWith('.css')) {
      filePath += '.html';
      if (!fs.existsSync(filePath)) {
        filePath = path.join(DIR, 'app', urlPath + '.html');
        if (!fs.existsSync(filePath)) filePath = path.join(DIR, urlPath + '.html');
      }
    }
  }
  
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log('Static server on :' + PORT);
});
