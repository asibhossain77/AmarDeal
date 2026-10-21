#!/usr/bin/env node
/**
 * Spawn a long-running process detached from the tool-call process group.
 * bash setsid/nohup children get reaped between tool calls in this sandbox —
 * a detached node child with stdio to files survives.
 *
 * Usage: node scripts/spawn-detached.js <logfile> <command> [args...]
 */
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const logfile = process.argv[2]
const cmd = process.argv[3]
const args = process.argv.slice(4)

if (!logfile || !cmd) {
  console.error('usage: node scripts/spawn-detached.js <logfile> <cmd> [args...]')
  process.exit(1)
}

const out = fs.openSync(path.resolve(logfile), 'a')
const child = spawn(cmd, args, {
  cwd: path.resolve(__dirname, '..'),
  detached: true,
  stdio: ['ignore', out, out],
  env: process.env,
})
child.unref()
console.log('spawned pid', child.pid, '→', logfile)
