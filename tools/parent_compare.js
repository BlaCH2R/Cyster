// parent_id binding comparison: self-built preview frame vs real engine frame.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { spawn, execFileSync } = require('child_process');

const LEVEL = 'V:\\cytoid storyboarder\\项目\\测试：parent\\ParentTest';
const ENGINE = 'V:\\cytoid storyboarder\\build\\CytoidMain\\CytoidMain.exe';
const PIPE = 'cytoid_sb_par_' + Date.now().toString(36);
const SELF_PNG = 'V:\\cytoid storyboarder\\tools\\parent_self.png';
const ENGINE_PNG = 'V:\\cytoid storyboarder\\tools\\parent_engine.png';

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

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_par_')));
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
  await win.webContents.executeJavaScript(`window.__sb.setTime(0, false)`);
  await new Promise((r) => setTimeout(r, 1200));
  const dataUrl = await win.webContents.executeJavaScript(
    `document.querySelector('#previewCanvas').toDataURL('image/png')`);
  fs.writeFileSync(SELF_PNG, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('self frame saved');

  const engine = spawn(ENGINE, [
    '--level', LEVEL, '--difficulty', 'extreme', '--pipe', PIPE, '--auto', '--windowed'
  ], { stdio: 'ignore' });
  let loaded = false;
  for (let i = 0; i < 80 && !loaded; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const r = await pipeOnce(PIPE, { cmd: 'ping' }, 3000);
      if (r && r.loaded) loaded = true;
    } catch (e) { /* not yet */ }
  }
  if (!loaded) { console.log('FAIL: engine not loaded'); engine.kill(); app.exit(1); }
  await pipeOnce(PIPE, { cmd: 'seek', time: 0 });
  await pipeOnce(PIPE, { cmd: 'pause' });
  await new Promise((r) => setTimeout(r, 1500));
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
  console.log('PARENT_COMPARE_DONE');
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
