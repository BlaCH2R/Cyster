// Quick check: does the real engine load a given level? Spawns CytoidMain,
// pings the bridge until loaded or timeout, then quits. Prints JSON result.
// Usage: node engine_load_check.js <levelDir>
const net = require('net');
const { spawn } = require('child_process');

const LEVEL = process.argv[2];
const ENGINE = 'V:\\cytoid storyboarder\\build\\CytoidMain\\CytoidMain.exe';
const PIPE = 'cytoid_sb_lc_' + Date.now().toString(36);

function pipeOnce(pipeName, payload, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const client = net.connect({ path: '\\\\.\\pipe\\' + pipeName });
    const timer = setTimeout(() => { try { client.destroy(); } catch (e) {} reject(new Error('pipe timeout')); }, timeoutMs);
    let buf = '';
    client.on('data', (d) => {
      buf += d.toString('utf8');
      const i = buf.indexOf('\n');
      if (i >= 0) {
        clearTimeout(timer);
        const line = buf.slice(0, i).trim();
        try { client.end(); } catch (e) {}
        try { resolve(JSON.parse(line)); } catch (e) { reject(e); }
      }
    });
    client.on('error', (e) => { clearTimeout(timer); reject(e); });
    client.write(JSON.stringify(payload) + '\n');
  });
}

(async () => {
  const engine = spawn(ENGINE, ['--level', LEVEL, '--difficulty', 'extreme', '--pipe', PIPE, '--auto', '--windowed'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  engine.stdout.on('data', (d) => { log += d; });
  engine.stderr.on('data', (d) => { log += d; });
  let loaded = false, pong = null;
  for (let i = 0; i < 60 && !loaded; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try { pong = await pipeOnce(PIPE, { cmd: 'ping' }, 3000); if (pong && pong.loaded) loaded = true; } catch (e) {}
  }
  console.log(JSON.stringify({ level: LEVEL, loaded, pong, alive: !engine.killed }));
  try { await pipeOnce(PIPE, { cmd: 'quit' }, 2000); } catch (e) {}
  setTimeout(() => { engine.kill(); process.exit(loaded ? 0 : 1); }, 800);
})();
