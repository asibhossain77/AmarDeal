import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Track online users by userId
const onlineUsers = new Map<string, string>() // userId -> socketId

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`)

  // Join a room identified by userId
  socket.on('register', (userId: string) => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid)
        socket.leave(uid)
      }
    }
    onlineUsers.set(userId, socket.id)
    socket.join(userId)
    console.log(`[Socket] User ${userId} registered (socket: ${socket.id})`)
  })

  // Admin joins admin room
  socket.on('register-admin', () => {
    socket.join('admin')
    console.log(`[Socket] Admin registered (socket: ${socket.id})`)
  })

  // ─── Chat: Join a deal's chat room ───
  socket.on('join-deal', (dealId: string) => {
    socket.join(`deal:${dealId}`)
    console.log(`[Chat] Socket ${socket.id} joined deal room: ${dealId}`)
  })

  // ─── Chat: Leave a deal's chat room ───
  socket.on('leave-deal', (dealId: string) => {
    socket.leave(`deal:${dealId}`)
    console.log(`[Chat] Socket ${socket.id} left deal room: ${dealId}`)
  })

  socket.on('disconnect', () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid)
        console.log(`[Socket] User ${uid} disconnected`)
      }
    }
  })

  socket.on('error', (error) => {
    console.error(`[Socket] Error:`, error)
  })
})

// Simple HTTP handler for triggering notifications & chat
const server = httpServer as any

// Override request handler to support REST + WebSocket
const originalListeners = httpServer.listeners('request').slice()
httpServer.removeAllListeners('request')

httpServer.on('request', (req: any, res: any) => {
  // ─── Notify a specific user ───
  if (req.method === 'POST' && req.url === '/notify') {
    let body = ''
    req.on('data', (chunk: string) => { body += chunk })
    req.on('end', () => {
      try {
        const { userId, notification } = JSON.parse(body)
        if (userId && notification) {
          io.to(userId).emit('notification', notification)
          io.to('admin').emit('notification', notification)
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid body' }))
      }
    })
    return
  }

  // ─── Notify all admins ───
  if (req.method === 'POST' && req.url === '/notify-admin') {
    let body = ''
    req.on('data', (chunk: string) => { body += chunk })
    req.on('end', () => {
      try {
        const { notification } = JSON.parse(body)
        if (notification) {
          io.to('admin').emit('notification', notification)
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid body' }))
      }
    })
    return
  }

  // ─── Chat: Broadcast a new message to deal room ───
  if (req.method === 'POST' && req.url === '/chat-broadcast') {
    let body = ''
    req.on('data', (chunk: string) => { body += chunk })
    req.on('end', () => {
      try {
        const { dealId, message } = JSON.parse(body)
        if (dealId && message) {
          io.to(`deal:${dealId}`).emit('chat-message', message)
          console.log(`[Chat] Broadcast to deal:${dealId} from ${message.senderName}`)
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid body' }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

const PORT = 3004
httpServer.listen(PORT, () => {
  console.log(`[Service] Notification + Chat service running on port ${PORT}`)
})

// ─── Next.js Keep-Alive & Auto-Restart ───
import { spawn } from 'child_process'

const NEXT_PORT = 3000
let nextProc: ReturnType<typeof spawn> | null = null
let nextRestarting = false

function logNext(msg: string) {
  console.log(`[Keeper:${NEXT_PORT}] ${msg}`)
}

function startNext(): void {
  if (nextRestarting) return
  nextRestarting = true

  if (nextProc) {
    try { nextProc.kill('SIGTERM') } catch {}
    nextProc = null
  }

  logNext('Starting Next.js...')

  nextProc = spawn('node', ['node_modules/.bin/next', 'dev', '-p', String(NEXT_PORT)], {
    cwd: '/home/z/my-project',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  nextProc.stdout?.on('data', (d: Buffer) => {
    const s = d.toString().trim()
    if (s) logNext(s)
  })

  nextProc.stderr?.on('data', (d: Buffer) => {
    const s = d.toString().trim()
    if (s) logNext(`ERR: ${s}`)
  })

  nextProc.on('exit', () => {
    logNext('Exited. Will restart on next ping.')
    nextProc = null
    nextRestarting = false
  })

  nextProc.on('error', (err) => {
    logNext(`Spawn error: ${err.message}`)
    nextProc = null
    nextRestarting = false
  })

  setTimeout(() => { nextRestarting = false }, 5000)
}

// Track if Next.js has been confirmed ready at least once
let nextConfirmed = false;

function pingAndRestart(): void {
  if (nextRestarting) return
  try {
    const r = Bun.spawnSync(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
      '--connect-timeout', '2', '--max-time', '5',
      `http://127.0.0.1:${NEXT_PORT}/`], { stdout: 'pipe', stderr: 'pipe' })
    const code = new TextDecoder().decode(r.stdout).trim()
    if (code === '200' || code === '302' || code === '304') {
      nextConfirmed = true
      return
    }
    // If never confirmed ready, give it more time (first compilation is slow)
    if (!nextConfirmed) {
      logNext(`Ping=${code}, first boot - waiting...`)
      return
    }
    logNext(`Ping=${code}, restarting...`)
  } catch {
    if (!nextConfirmed) {
      logNext('Ping failed, first boot - waiting...')
      return
    }
    logNext('Ping failed, restarting...')
  }
  startNext()
}

// Start Next.js immediately, wait 15s for first compile, then ping every 10s
startNext()
setTimeout(() => {
  setInterval(pingAndRestart, 10000)
  logNext('Auto-restart keeper active (ping every 10s)')
}, 15000)
logNext('Auto-restart keeper active (first compile grace: 15s)')

process.on('SIGTERM', () => {
  if (nextProc) try { nextProc.kill('SIGTERM') } catch {}
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  if (nextProc) try { nextProc.kill('SIGTERM') } catch {}
  httpServer.close(() => process.exit(0))
})