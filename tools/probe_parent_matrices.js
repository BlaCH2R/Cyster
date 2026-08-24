// Dump the preview's stage matrices for every parent-test sprite at t=0.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_pmat_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const LEVEL = 'V:\\cytoid storyboarder\\项目\\测试：parent\\ParentTest';
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
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
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
    const ids = ['parent','child1','child2','child3','t1','c_t','p3d','c3d','c_rot'];
    const res = {};
    for (const id of ids) {
      const it = (pv.evalResult.sprites || []).find((r) => r.obj.id === id);
      if (!it) { res[id] = 'NOT_IN_DRAW'; continue; }
      const m = pv.stageMatrix(it.obj, it, info2);
      res[id] = { e: +m.e.toFixed(1), f: +m.f.toFixed(1), a: +m.a.toFixed(3), d: +m.d.toFixed(3) };
    }
    return { W: pv.canvas.width, H: pv.canvas.height, res };
  })()`);
  console.log('MATRICES:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
