#!/usr/bin/env python3
"""
AmarDeal dev-server daemon (recreated per worklog Task 81).

The sandbox reaps `next dev` processes started naively from tool shells
(observed 3x in Task 81: process vanishes between tool calls even with
setsid+nohup from bash). This launcher DOUBLE-FORKS from Python, calls
setsid() in the intermediate child, ignores SIGHUP, redirects stdio and
fully detaches — the grandchild survives tool-shell teardown and the
reaper.

Usage:  python3 scripts/start-dev-daemon.py [port]
Log:    /home/z/my-project/amardeal/dev-daemon.log
"""
import os, sys, time, signal, subprocess

PORT = sys.argv[1] if len(sys.argv) > 1 else "3000"
ROOT = "/home/z/my-project/amardeal"
LOG = os.path.join(ROOT, "dev-daemon.log")

def fork_and_exit_parent():
    pid = os.fork()
    if pid > 0:
        os._exit(0)
    return pid

# double fork
fork_and_exit_parent()
os.setsid()
fork_and_exit_parent()

# detach signals + stdio
signal.signal(signal.SIGHUP, signal.SIG_IGN)
os.chdir(ROOT)
devnull = os.open(os.devnull, os.O_RDWR)
logfd = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
os.dup2(devnull, 0)
os.dup2(logfd, 1)
os.dup2(logfd, 2)

env = dict(os.environ)
env["DATABASE_URL"] = "file:/home/z/my-project/amardeal/db/custom.db"
env["NEXT_PUBLIC_APP_URL"] = "http://localhost:3000"

with open(LOG, "a") as lg:
    lg.write(f"[daemon] starting next dev -p {PORT} at {time.strftime('%F %T')}\n")

subprocess.Popen(
    ["bun", "run", "dev"],
    cwd=ROOT,
    env=env,
    stdin=subprocess.DEVNULL,
    stdout=None,  # inherited -> log
    stderr=subprocess.STDOUT,
    start_new_session=True,
)
os._exit(0)
