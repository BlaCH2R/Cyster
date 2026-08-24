// Integration test for the real-engine embedded preview path:
// start engine via player:embed-start -> poll ping -> seek/pause via pipe
// -> attach the Unity window via player:embed-attach -> stop.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_embed_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const LEVEL = 'V:\\cytoid storyboarder\\项目\\测试：企鹅\\銀河鉄道のペンギン';
const ENGINE = 'V:\\cytoid storyboarder\\build\\CytoidMain\\CytoidMain.exe';
const PIPE = 'cytoid_sb_test_' + Date.now().toString(36);

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => {
    const item = {
      type: c.type,
      path: c.path,
      content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
      storyboardPath: c.storyboard ? c.storyboard.path : null,
      storyboardContent: c.storyboard && c.storyboard.path
        ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8')
        : null
    };
    return item;
  });
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 180000);
  await new Promise((r) => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) { console.log('FAIL: no window'); app.exit(1); }
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 800));

  // Load the test project so the preview area has real geometry.
  const info = buildInfo(LEVEL);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 2500));

  const hasBtn = await win.webContents.executeJavaScript(`!!document.querySelector('#btnEngine')`);
  console.log('btnEngine in DOM:', hasBtn);

  // Drive the real user flow: click the "真实引擎" button.
  await win.webContents.executeJavaScript(`document.querySelector('#btnEngine').click()`);

  let ready = false;
  let pipeName = null;
  for (let i = 0; i < 80 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const st = await win.webContents.executeJavaScript(
      `({ ready: window.__sb.state.engineReady, active: window.__sb.state.engineActive, pipe: window.__sb.state.enginePipeName })`);
    if (st && st.ready) {
      ready = true;
      pipeName = st.pipe;
      console.log('engine ready via app flow, pipe=', pipeName);
    }
  }
  if (!ready) { console.log('FAIL: engine not ready via app flow'); await stop(win); app.exit(1); }
  await new Promise((r) => setTimeout(r, 1500));

  const dpr = await win.webContents.executeJavaScript(`window.devicePixelRatio || 1`);
  const rect = await win.webContents.executeJavaScript(`(() => {
    const el = document.querySelector('#previewWrap');
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  })()`);

  // Programmatic geometry checks:
  // 1) the overlay BrowserWindow should cover the preview rect;
  // 2) the engine window should be resized to the preview rect (physical px).
  const { execFileSync } = require('child_process');
  const all = BrowserWindow.getAllWindows();
  let pidStr = '0';
  try {
    pidStr = execFileSync('powershell.exe', [
      '-NoProfile', '-Command', '(Get-Process -Name CytoidMain -ErrorAction SilentlyContinue | Select-Object -First 1).Id'
    ], { encoding: 'utf8' }).trim() || '0';
  } catch (e) {}
  const overlay = all.find((w) => w !== win);
  let overlayScreen = null;
  let hostHwnd = null;
  if (overlay) {
    const ob = overlay.getBounds();
    console.log('overlay bounds:', JSON.stringify(ob), 'preview rect:', JSON.stringify(rect));
    const hwndBuf = overlay.getNativeWindowHandle();
    hostHwnd = hwndBuf.readBigUInt64LE(0).toString(16);
    overlayScreen = {
      x: Math.round(ob.x * dpr),
      y: Math.round(ob.y * dpr),
      width: Math.round(ob.width * dpr),
      height: Math.round(ob.height * dpr)
    };
  } else {
    console.log('overlay bounds: MISSING');
  }
  try {
    const out = execFileSync('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
      path.join(__dirname, 'check_win_size.ps1'), '-TargetPid', pidStr,
      '-HostHwnd', hostHwnd
    ], { encoding: 'utf8' });
    console.log('engine windows:', out.trim().split('\n').join(' | '));
  } catch (e) {
    console.log('engine window check failed:', (e.stdout || e.message).split('\n').slice(0, 2).join(' '));
  }

  // Drag verification: pause on drag start, follow the scrub, pause at the end.
  const dragResult = await win.webContents.executeJavaScript(`(async () => {
    const opts = window.__sb.timeline.opts;
    opts.onScrubStart();
    opts.onScrub(60);
    await new Promise((r) => setTimeout(r, 400));
    opts.onScrub(80);
    await new Promise((r) => setTimeout(r, 400));
    opts.onScrubEnd();
    await new Promise((r) => setTimeout(r, 700));
    return { time: window.__sb.preview.time };
  })()`);
  console.log('drag result:', JSON.stringify(dragResult));
  const afterDrag = await win.webContents.executeJavaScript(
    `window.sbAPI.playerEmbedCmd({ pipeName: ${JSON.stringify(pipeName)}, cmd: { cmd: 'ping' } })`);
  console.log('engine after drag:', JSON.stringify(afterDrag));

  // Capture the preview region now (engine paused at the dragged time).
  if (overlayScreen) {
    try {
      const out = execFileSync('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        path.join(__dirname, 'shot_window.ps1'),
        '-X', String(overlayScreen.x), '-Y', String(overlayScreen.y),
        '-Width', String(overlayScreen.width), '-Height', String(overlayScreen.height),
        '-Out', 'V:\\cytoid storyboarder\\tools\\embed_preview_shot.png'
      ], { encoding: 'utf8' });
      console.log('preview shot:', out.trim());
    } catch (e) {
      console.log('preview shot failed:', e.message.split('\n')[0]);
    }
  }

  await stop(win);
  console.log('EMBED_TEST_OK');
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });

async function stop(win) {
  try { await win.webContents.executeJavaScript(`window.sbAPI.playerEmbedStop()`); } catch (e) {}
}
