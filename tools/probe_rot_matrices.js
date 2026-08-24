// Dump the preview's stageMatrix / stageMatrix3 for the RotSolid sprites.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_rotm_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const LEVEL = 'V:\\cytoid storyboarder\\项目\\测试：rot\\RotSolid';
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

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 800));
  const info = buildInfo(LEVEL);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 3000));
  const out = await win.webContents.executeJavaScript(`(() => {
    const pv = window.__sb.preview;
    pv.setTime(0, false);
    pv.render();
    const info2 = pv.ctxInfo();
    const ids = ['s_rz','s_rx','s_ry','s_xy','s_yx','s_xyz'];
    const res = {};
    try {
      for (const id of ids) {
        const it = (pv.evalResult.sprites || []).find((r) => r.obj.id === id);
        if (!it) { res[id] = 'MISSING'; continue; }
        const m3 = pv.stageMatrix3(it.obj, it, info2);
        const m = pv.stageMatrix(it.obj, it, info2);
        const fmt = (x) => {
          if (!x) return x;
          if (Array.isArray(x)) return x.map((v) => (typeof v === 'number' ? +v.toFixed(3) : v));
          const o = {};
          for (const k of Object.keys(x)) o[k] = typeof x[k] === 'number' ? +x[k].toFixed(3) : x[k];
          return o;
        };
        res[id] = { m3keys: m3 ? Object.keys(m3) : null, m3: fmt(m3), m: fmt(m) };
      }
    } catch (e) { res.error = String(e.message || e); }
    return res;
  })()`);
  console.log('ROT_MATRICES:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
