const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nr_')));
require(path.join(__dirname, '..', 'app', 'main.js'));
const LEVEL = 'V:\\cytoid storyboarder\\项目\\测试：nc-follow\\NcFollow';
function buildInfo(dir, sb) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: 'storyboard.json',
    storyboardContent: sb
  }));
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: dir, files, charts };
}
const SB = JSON.stringify({
  note_controllers: [
    { id: 'nc', note: 2, time: 0, override_rot_x: true, rot_x: 30, override_rot_y: true, rot_y: 20, override_rot_z: true, rot_z: 45 }
  ],
  sprites: [], texts: [], videos: [], lines: [], controllers: [], templates: {}
});
app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 800));
  const info = buildInfo(LEVEL, SB);
  const out = await win.webContents.executeJavaScript(`(async () => {
    try {
      await window.__sb.loadLevelInfo(${JSON.stringify(info)});
      await new Promise((r) => setTimeout(r, 1000));
      const pv = window.__sb.preview;
      pv.setTime(3.0, false);
      pv.render();
      const i2 = pv.ctxInfo();
      const ovr = pv.noteOverrides ? pv.noteOverrides[2] : null;
      const gm = pv.noteGlyph2x2(i2,
        ovr && ovr.rot_x != null ? ovr.rot_x * Math.PI / 180 : 0,
        ovr && ovr.rot_y != null ? -ovr.rot_y * Math.PI / 180 : 0,
        ovr && ovr.rot_z != null ? -ovr.rot_z * Math.PI / 180 : 0);
      const note = pv.chart.noteById(2);
      const np = note ? pv.notePos(note, i2) : null;
      return { ok: true, ovr, gm: [gm.a.toFixed(3), gm.b.toFixed(3), gm.c.toFixed(3), gm.d.toFixed(3)], np };
    } catch (e) { return { ok: false, error: String(e.message || e) }; }
  })()`);
  console.log('NOTE_ROT:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
