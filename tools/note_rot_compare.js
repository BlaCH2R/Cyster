// Note-rotation comparison (perspective): self preview vs real engine.
// The test level has one click note with a note_controller overriding
// rot_x=30 / rot_y=20 / rot_z=45 and a perspective camera with rot_x=15 /
// rot_y=10 — exercises the canonical camera·note glyph composition.
// Run: electron.exe --no-sandbox --disable-gpu tools\note_rot_compare.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { spawn, execFileSync } = require('child_process');

const LEVEL = 'V:\\cytoid storyboarder\\项目\\测试：note-rot\\NoteRotTest';
const ENGINE = 'V:\\cytoid storyboarder\\build\\CytoidMain\\CytoidMain.exe';
const PIPE = 'cytoid_sb_nr2_' + Date.now().toString(36);
const SELF_PNG = 'V:\\cytoid storyboarder\\tools\\note_rot_self.png';
const ENGINE_PNG = 'V:\\cytoid storyboarder\\tools\\note_rot_engine.png';
const SEEK = 0.0;

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path
      ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null
  }));
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: dir, files, charts };
}

function pipeOnce(pipeName, payload, timeoutMs = 8000) {
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

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nr2_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 180000);
  await new Promise((r) => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 800));

  const info = buildInfo(LEVEL);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 4000));
  await win.webContents.executeJavaScript(`window.__sb.setTime(${SEEK}, false)`);
  await new Promise((r) => setTimeout(r, 1200));
  const dataUrl = await win.webContents.executeJavaScript(
    `document.querySelector('#previewCanvas').toDataURL('image/png')`);
  fs.writeFileSync(SELF_PNG, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('self frame saved');

  const engine = spawn(ENGINE, [
    '--level', LEVEL, '--difficulty', 'extreme', '--pipe', PIPE, '--auto', '--windowed'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  const engOut = fs.openSync(path.join(__dirname, 'note_rot_engine_stdout.log'), 'w');
  const engErr = fs.openSync(path.join(__dirname, 'note_rot_engine_stderr.log'), 'w');
  engine.stdout.on('data', (d) => fs.writeSync(engOut, d));
  engine.stderr.on('data', (d) => fs.writeSync(engErr, d));
  engine.on('exit', (code) => console.log('engine exited', code));
  let loaded = false;
  for (let i = 0; i < 90 && !loaded; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const r = await pipeOnce(PIPE, { cmd: 'ping' }, 3000);
      if (r && r.loaded) loaded = true;
    } catch (e) { /* not yet */ }
  }
  if (!loaded) { console.log('FAIL: engine not loaded'); engine.kill(); try { fs.closeSync(engOut); } catch (e) {} try { fs.closeSync(engErr); } catch (e) {} app.exit(1); }
  await pipeOnce(PIPE, { cmd: 'seek', time: SEEK });
  // Seek before the game starts sets BridgeStartPaused; give the game time
  // to actually start (paused) before resuming, or the resume gets overridden.
  await new Promise((r) => setTimeout(r, 3000));
  await pipeOnce(PIPE, { cmd: 'play' });
  // The real engine spawns notes from real playback only (seek does not
  // re-spawn them). --auto taps notes at their start (1.0s), so capture
  // during the approach, just before the auto-tap (~0.9s).
  await new Promise((r) => setTimeout(r, 700));
  await pipeOnce(PIPE, { cmd: 'pause' });
  await new Promise((r) => setTimeout(r, 500));
  try { console.log('engine state:', JSON.stringify(await pipeOnce(PIPE, { cmd: 'ping' }, 3000))); } catch (e) {}
  try {
    const out = execFileSync('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
      path.join(__dirname, 'capture_engine.ps1'),
      '-TargetPid', String(engine.pid), '-Out', ENGINE_PNG
    ], { encoding: 'utf8' });
    console.log('engine frame:', out.trim());
  } catch (e) {
    console.log('engine capture failed:', e.message.split('\n')[0]);
  }
  engine.kill();
  try { fs.closeSync(engOut); } catch (e) {}
  try { fs.closeSync(engErr); } catch (e) {}
  console.log('NOTE_ROT_COMPARE_DONE');
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
