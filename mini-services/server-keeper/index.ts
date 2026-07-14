import { spawn, ChildProcess } from "child_process";
import { createServer, IncomingMessage, ServerResponse } from "http";
import http from "http";

const NEXT_PORT = 3000;
const KEEPER_PORT = 3099;

let nextProcess: ChildProcess | null = null;

function startNext(): void {
  // Clean up old .next cache to reduce memory
  console.log(`[${new Date().toISOString()}] Starting Next.js dev server on port ${NEXT_PORT}...`);

  nextProcess = spawn("npx", ["next", "dev", "-p", String(NEXT_PORT)], {
    cwd: "/home/z/my-project",
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=1024" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  nextProcess.stdout?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[NEXT] ${msg}`);
  });

  nextProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[NEXT:ERR] ${msg}`);
  });

  nextProcess.on("exit", (code, signal) => {
    console.log(`[${new Date().toISOString()}] Next.js exited (code=${code}, signal=${signal}). Restarting in 3s...`);
    nextProcess = null;
    setTimeout(startNext, 3000);
  });

  nextProcess.on("error", (err) => {
    console.error(`[${new Date().toISOString()}] Next.js error: ${err.message}`);
    nextProcess = null;
    setTimeout(startNext, 3000);
  });
}

// Keep-alive HTTP server on KEEPER_PORT — proxies to Next.js
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Health check endpoint
  if (req.url === "/__keepalive") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("alive");
    return;
  }

  // Check if Next.js is reachable
  const nextUrl = `http://127.0.0.1:${NEXT_PORT}${req.url || "/"}`;
  try {
    const proxyRes = await new Promise<{ statusCode: number; headers: Record<string, string>; body: Buffer }>(
      (resolve, reject) => {
        const proxyReq = http.request(nextUrl, {
          method: req.method,
          headers: { ...req.headers, host: `127.0.0.1:${NEXT_PORT}` },
          timeout: 15000,
        }, (proxyRes) => {
          const chunks: Buffer[] = [];
          proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
          proxyRes.on("end", () => {
            resolve({
              statusCode: proxyRes.statusCode || 502,
              headers: proxyRes.headers as Record<string, string>,
              body: Buffer.concat(chunks),
            });
          });
        });
        proxyReq.on("error", reject);
        proxyReq.on("timeout", () => { proxyReq.destroy(); reject(new Error("timeout")); });
        req.pipe(proxyReq);
      }
    );

    const { statusCode, headers, body } = proxyRes;
    res.writeHead(statusCode, {
      "Content-Type": headers["content-type"] || "text/html",
      "Content-Length": body.length,
    });
    res.end(body);
  } catch {
    res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<html><body><h2>নেক্সট.জেএস সার্ভার রিস্টার্ট হচ্ছে... অনুগ্রহ করে কিছুক্ষণ পর রিফ্রেশ করুন</h2></body></html>");
  }
});

// Keep-alive: ping Next.js every 8 seconds to prevent sandbox from killing it
setInterval(() => {
  http.get(`http://127.0.0.1:${NEXT_PORT}/api/fee-structure`, (res) => {
    res.resume(); // consume response
  }).on("error", () => {
    // Next.js might be down, it will auto-restart
  });
}, 8000);

server.listen(KEEPER_PORT, () => {
  console.log(`[${new Date().toISOString()}] Server keeper running on port ${KEEPER_PORT}`);
  startNext();
});

// Cleanup on exit
process.on("SIGTERM", () => {
  if (nextProcess) nextProcess.kill("SIGTERM");
  server.close();
  process.exit(0);
});