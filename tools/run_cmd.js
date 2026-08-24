// User-level command watchdog: every command that may hang goes through this
// runner. Rules (project convention):
//   - Any command that produces no result within the timeout (default 180s)
//     is judged FAILED, its whole process tree is killed, and the next
//     fallback solution is tried automatically.
//   - Success = exit code 0 (and, with --watch, a freshly-written valid JSON
//     output file).
//
// Usage:
//   node run_cmd.js [--timeout <sec>] [--watch <outfile.json>]
//                   [--fallback <cmd...>] ... -- <cmd...>
// The command after `--` is tried first; each --fallback is tried in order
// when a previous candidate times out or exits nonzero.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function usage() {
  console.error('usage: node run_cmd.js [--timeout sec] [--watch out.json] [--fallback cmd...] -- cmd...');
  process.exit(2);
}

const args = process.argv.slice(2);
let timeoutSec = 180;
let watchFile = null;
let primary = null;
const fallbacks = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--timeout') { timeoutSec = Number(args[++i]); }
  else if (a === '--watch') { watchFile = args[++i]; }
  else if (a === '--fallback') {
    const cmd = [];
    while (i + 1 < args.length && args[i + 1] !== '--fallback' && args[i + 1] !== '--') cmd.push(args[++i]);
    fallbacks.push(cmd);
  }
  else if (a === '--') {
    primary = args.slice(i + 1);
    break;
  }
  else usage();
}
if (!primary || !primary.length) usage();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freshWatch(startMs) {
  if (!watchFile) return null;
  try {
    const st = fs.statSync(watchFile);
    if (st.mtimeMs >= startMs - 500 && st.size > 0) {
      JSON.parse(fs.readFileSync(watchFile, 'utf8'));
      return true;
    }
  } catch (e) {}
  return false;
}

function killTree(pid) {
  try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
}

function writeLog(tag, log) {
  try {
    const p = path.join(__dirname, 'run_cmd_last_log.txt');
    fs.writeFileSync(p, '=== ' + tag + ' ===\n' + String(log || '').slice(-60000));
  } catch (e) {}
}

async function runCandidate(tag, cmd, startMs) {
  const child = spawn(cmd[0], cmd.slice(1), { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  const deadline = Date.now() + timeoutSec * 1000;
  let code = null;
  let timedOut = false;
  while (Date.now() < deadline) {
    if (watchFile) {
      if (freshWatch(startMs)) {
        const rc = await Promise.race([exited.then((c) => ({ exit: c })), sleep(2000).then(() => ({ wait: true }))]);
        if ('exit' in rc) code = rc.exit;
        writeLog(tag, log);
        return { ok: true, code, tag, elapsedMs: Date.now() - startMs };
      }
    } else {
      const rc = await Promise.race([exited.then((c) => ({ exit: c })), sleep(300).then(() => ({ wait: true }))]);
      if ('exit' in rc) {
        code = rc.exit;
        writeLog(tag, log);
        return { ok: code === 0, code, tag, elapsedMs: Date.now() - startMs };
      }
    }
    await sleep(300);
  }
  timedOut = true;
  killTree(child.pid);
  try { child.stdout.destroy(); } catch (e) {}
  try { child.stderr.destroy(); } catch (e) {}
  try { child.stdin.destroy(); } catch (e) {}
  writeLog(tag, log);
  return { ok: false, code: null, tag, timedOut, elapsedMs: Date.now() - startMs };
}

(async () => {
  // Hard bail so the runner itself never outlives the timeout by much.
  setTimeout(() => { console.log('[run_cmd] FORCE EXIT'); process.exit(1); }, timeoutSec * 1000 + 10000).unref();
  const startMs = Date.now();
  const candidates = [['primary', primary], ...fallbacks.map((c, i) => ['fallback-' + (i + 1), c])];
  let result = null;
  for (const [tag, cmd] of candidates) {
    if (!cmd || !cmd.length) continue;
    result = await runCandidate(tag, cmd, startMs);
    const why = result.ok ? 'OK' : (result.timedOut ? 'TIMEOUT (>' + timeoutSec + 's, killed)' : 'exited ' + result.code);
    console.log(`[run_cmd] ${tag}: ${why} (${result.elapsedMs}ms)`);
    if (result.ok) break;
  }
  console.log('RESULT ' + JSON.stringify({ ok: !!(result && result.ok), tag: result && result.tag, timedOut: !!(result && result.timedOut), elapsedMs: Date.now() - startMs, watchFile }));
  setTimeout(() => process.exit(result && result.ok ? 0 : 1), 600);
})();
