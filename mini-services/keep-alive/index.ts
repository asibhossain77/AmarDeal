import { spawn } from "child_process";

const NEXT_PORT = 3000;
const PING_INTERVAL = 8000;
const RESTART_DELAY = 2000;

let nextProc: ReturnType<typeof spawn> | null = null;
let restarting = false;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function startNext(): void {
  if (restarting) return;
  restarting = true;

  if (nextProc) {
    try { nextProc.kill("SIGTERM"); } catch {}
    nextProc = null;
  }

  log(`Starting Next.js on port ${NEXT_PORT}...`);

  nextProc = spawn("npx", ["next", "dev", "-p", String(NEXT_PORT)], {
    cwd: "/home/z/my-project",
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=1024" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  nextProc.stdout?.on("data", (d: Buffer) => {
    const s = d.toString().trim();
    if (s) log(`[NX] ${s}`);
  });

  nextProc.stderr?.on("data", (d: Buffer) => {
    const s = d.toString().trim();
    if (s) log(`[NX:E] ${s}`);
  });

  nextProc.on("exit", () => {
    log("Next.js exited.");
    nextProc = null;
    restarting = false;
  });

  nextProc.on("error", (err) => {
    log(`Next.js spawn error: ${err.message}`);
    nextProc = null;
    restarting = false;
  });

  // Give it a moment then mark as not restarting
  setTimeout(() => { restarting = false; }, 5000);
}

function pingNext(): void {
  if (restarting) return;

  try {
    const result = Bun.spawnSync(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
      "--connect-timeout", "2", "--max-time", "5",
      `http://127.0.0.1:${NEXT_PORT}/`], { stdout: "pipe", stderr: "pipe" });

    const code = new TextDecoder().decode(result.stdout).trim();
    if (code === "200" || code === "302" || code === "304") {
      return; // healthy
    }
    log(`Ping returned ${code}, will restart...`);
  } catch {
    log("Ping failed, will restart...");
  }

  startNext();
}

// Initial start
startNext();

// Ping loop
setInterval(pingNext, PING_INTERVAL);

log(`Keep-alive service started. Pinging every ${PING_INTERVAL / 1000}s.`);