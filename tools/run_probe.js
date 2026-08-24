// Watchdog runner for Electron probe scripts that are prone to hanging.
// Starts the probe, watches for a fresh JSON output file, and on timeout
// kills the whole process tree and automatically tries fallback methods:
//   1) electron with alternate GPU flags (software rasterizer / in-process)
//   2) a pure-Node fallback script (no electron), if given via --fallback
// Stops at the first method that produces a fresh, valid JSON output.
//
// Usage:
//   node run_probe.js <probe.js> <outfile.json> [timeoutSec] [--fallback <script>]
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ELECTRON = path.join(__dirname, '..', 'app', 'node_modules', 'electron', 'dist', 'electron.exe');
const NODE = process.execPath;

function usage() {
  console.log('usage: node run_probe.js <probe.js> <outfile.json> [timeoutSec] [--fallback <script>]');
  process.exit(2);
}

const args = process.argv.slice(2);
const probe = args[0];
const outfile = args[1];
if (!probe || !outfile) usage();
let timeoutSec = 30;
let fallback = null;
let extraFlags = [];
for (let i = 2; i < args.length; i++) {
  if (args[i] === '--fallback') fallback = args[++i];
  else if (args[i] === '--flags') extraFlags = String(args[++i] || '').split(' ').filter(Boolean);
  else if (/^\d+$/.test(args[i])) timeoutSec = Number(args[i]);
  else usage();
}
const timeoutMs = timeoutSec * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freshOutput(startMs) {
  try {
    const st = fs.statSync(outfile);
    if (st.mtimeMs >= startMs - 500 && st.size > 0) {
      const raw = fs.readFileSync(outfile, 'utf8');
      JSON.parse(raw); // must be valid JSON
      return true;
    }
  } catch (e) { /* not fresh/valid yet */ }
  return false;
}

function killTree(pid) {
  try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
}

async function runElectron(flags, startMs, method) {
  const child = spawn(ELECTRON, [...flags, probe], {
    cwd: path.join(__dirname, '..'),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  const deadline = Date.now() + timeoutMs;
  let code = null;
  while (Date.now() < deadline) {
    if (freshOutput(startMs)) {
      // Give the process a moment to exit cleanly, but don't wait forever.
      const rc = await Promise.race([exited, sleep(2000).then(() => null)]);
      if (rc !== null) code = rc;
      return { method, ok: true, code, log };
    }
    await sleep(400);
  }
  killTree(child.pid);
  try { child.stdout.destroy(); } catch (e) {}
  try { child.stderr.destroy(); } catch (e) {}
  try { child.stdin.destroy(); } catch (e) {}
  writeLog(method, log);
  return { method, ok: false, code: null, log, timedOut: true };
}

function writeLog(tag, log) {
  const logPath = path.join(path.dirname(outfile), 'run_probe_last_log.txt');
  const clipped = String(log || '').slice(-60000);
  try { fs.writeFileSync(logPath, '=== ' + tag + ' ===\n' + clipped); } catch (e) {}
}

async function runFallback(startMs) {
  if (!fallback) return { method: 'none', ok: false };
  try {
    execFileSync(NODE, [fallback, outfile], { cwd: path.join(__dirname, '..'), timeout: Math.min(20000, timeoutMs), stdio: 'pipe' });
    if (freshOutput(startMs)) return { method: 'node-fallback', ok: true };
    return { method: 'node-fallback', ok: false, note: 'fallback ran but produced no fresh output' };
  } catch (e) {
    return { method: 'node-fallback', ok: false, error: String(e && e.message || e) };
  }
}

(async () => {
  // Hard bail: never leave this runner alive past the deadline + margin.
  setTimeout(() => { console.log('FORCE EXIT'); process.exit(1); }, timeoutMs + 8000).unref();
  const startMs = Date.now();
  try { fs.unlinkSync(outfile); } catch (e) {}

  const methods = [
    ['electron', ['--no-sandbox', '--disable-gpu', ...extraFlags]],
    ['electron-alt-gpu', ['--no-sandbox', '--disable-gpu', ...extraFlags, '--disable-software-rasterizer', '--disable-gpu-compositing', '--in-process-gpu']],
  ];

  let result = null;
  for (const [name, flags] of methods) {
    result = await runElectron(flags, startMs, name);
    if (result.ok) writeLog(name, result.log);
    console.log(`[run_probe] ${name}: ${result.ok ? 'OK' : (result.timedOut ? 'TIMEOUT (killed)' : 'exited ' + result.code)} (${Date.now() - startMs}ms)`);
    if (result.ok) break;
  }
  if (!result || !result.ok) {
    result = await runFallback(startMs);
    console.log(`[run_probe] fallback: ${result.ok ? 'OK' : 'FAILED'} (${Date.now() - startMs}ms)`);
  }

  const summary = {
    ok: !!(result && result.ok),
    method: result ? result.method : null,
    elapsedMs: Date.now() - startMs,
    outfile,
    detail: result ? { ok: result.ok, method: result.method, code: result.code, timedOut: !!result.timedOut } : null,
  };
  console.log('RESULT ' + JSON.stringify(summary));
  // Never leave the process alive on lingering child pipes (kill may race).
  setTimeout(() => process.exit(summary.ok ? 0 : 1), 800);
  process.exit(summary.ok ? 0 : 1);
})();
