// Self-preview: sprite parented to a note controller should follow the note
// while it is spawned (intro..clear), and sit at the canvas origin otherwise.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ncs_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const LEVEL = 'V:\\cytoid storyboarder\\项目\\测试：nc-follow\\NcFollow';
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
    const measure = (t) => {
      pv.setTime(t, false);
      pv.render();
      const info2 = pv.ctxInfo();
      const it = (pv.evalResult.sprites || []).find((r) => r.obj.id === 'follow');
      const m = it ? pv.stageMatrix(it.obj, it, info2) : null;
      const note = pv.chart.noteById(2);
      const np = note ? pv.notePos(note, info2) : null;
      return { M: m ? [+m.e.toFixed(1), +m.f.toFixed(1)] : null,
        note: np ? [+np.x.toFixed(1), +np.y.toFixed(1)] : null };
    };
    return { t05: measure(0.5), t30: measure(3.0), t20: measure(2.2), t40: measure(4.0) };
  })()`);
  console.log('NC_SELF:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
