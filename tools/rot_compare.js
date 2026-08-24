// Rotation comparison: self-built preview vs real engine at given times.
// Usage: node rot_compare.js   (runs all hardcoded cases sequentially;
// PowerShell 5.1 mangles complex native argv, so nothing comes via argv)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { spawn, execFileSync } = require('child_process');

process.on('uncaughtException', (e) => {
  console.log('UNCAUGHT:', e && e.stack || e);
  try { app.exit(1); } catch (err) { process.exit(1); }
});
process.on('unhandledRejection', (e) => {
  console.log('UNHANDLED_REJECTION:', e && e.message || e);
});

const LEVELS = {
  obj: {
    level: 'V:\\cytoid storyboarder\\项目\\测试：rot\\RotTest',
    times: [0],
    prefix: 'V:\\cytoid storyboarder\\tools\\rotobj'
  },
  sol: {
    level: 'V:\\cytoid storyboarder\\项目\\测试：rot\\RotSolid',
    times: [0],
    prefix: 'V:\\cytoid storyboarder\\tools\\rotsol'
  },
  cam: {
    level: 'V:\\cytoid storyboarder\\项目\\测试：rot\\CamRotTest',
    times: [0, 5, 10],
    prefix: 'V:\\cytoid storyboarder\\tools\\rotcam'
  }
};
const ENGINE = 'V:\\cytoid storyboarder\\build\\CytoidMain\\CytoidMain.exe';
const PIPE = 'cytoid_sb_rot_' + Date.now().toString(36);

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

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_rot_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 240000);
  await new Promise((r) => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 800));

  for (const key of Object.keys(LEVELS)) {
    const { level: LEVEL, times: TIMES, prefix: PREFIX } = LEVELS[key];
    console.log('CASE ' + key);
    const info = buildInfo(LEVEL);
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
    await new Promise((r) => setTimeout(r, 2500));

    for (const t of TIMES) {
      await win.webContents.executeJavaScript(`window.__sb.setTime(${t}, false)`);
      await new Promise((r) => setTimeout(r, 400));
      const dataUrl = await win.webContents.executeJavaScript(
        `document.querySelector('#previewCanvas').toDataURL('image/png')`);
      fs.writeFileSync(`${PREFIX}_self_t${t}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    console.log('  self frames saved');

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
    if (!loaded) { console.log('  FAIL: engine not loaded for ' + key); engine.kill(); continue; }
    for (const t of TIMES) {
      await pipeOnce(PIPE, { cmd: 'seek', time: t });
      await pipeOnce(PIPE, { cmd: 'pause' });
      await new Promise((r) => setTimeout(r, 500));
      try {
        execFileSync('powershell.exe', [
          '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
          path.join(__dirname, 'capture_engine.ps1'),
          '-TargetPid', String(engine.pid), '-Out', `${PREFIX}_engine_t${t}.png`
        ], { encoding: 'utf8' });
        console.log('  engine t=' + t + ' captured');
      } catch (e) {
        console.log('  engine capture t=' + t + ' failed:', e.message.split('\n')[0]);
      }
    }
    engine.kill();
  }
  console.log('ROT_COMPARE_DONE');
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
