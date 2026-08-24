const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_crs_')));
require(path.join(__dirname, '..', 'app', 'main.js'));
const LEVEL = 'V:\\cytoid storyboarder\\项目\\测试：rot\\CamRotTest';
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
  const res = await win.webContents.executeJavaScript(`(async () => {
    try {
      await window.__sb.loadLevelInfo(${JSON.stringify(info)});
      await new Promise((r) => setTimeout(r, 1200));
      const out = {};
      for (const t of [0, 5, 10]) {
        window.__sb.preview.setTime(t, false);
        window.__sb.preview.render();
        const info2 = window.__sb.preview.ctxInfo();
        out[t] = { S: +info2.S.toFixed(2), sxF: +info2.sxF.toFixed(3), syF: +info2.syF.toFixed(3),
          rotX: +info2.rotX.toFixed(1), rotY: +info2.rotY.toFixed(1), rotZ: +info2.rotZ.toFixed(1) };
      }
      return { ok: true, out };
    } catch (e) { return { ok: false, error: String(e.message || e) }; }
  })()`);
  console.log('CAMROT_SELF:', JSON.stringify(res));
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
