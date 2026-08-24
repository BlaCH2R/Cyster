// Verify the hold bar renders in the correct direction (above for up-holds).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));
const PLAYER = extract(SAMPLE_ZIP, 'cytoid_hold_');

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({ type: c.type, path: c.path, content: fs.readFileSync(path.join(dir, c.path), 'utf8'), storyboardPath: c.storyboard ? c.storyboard.path : null, storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null }));
  const files = [];
  for (const name of fs.readdirSync(dir)) { const st = fs.statSync(path.join(dir, name)); if (st.isFile()) files.push({ name, size: st.size }); }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  const info = buildInfo(PLAYER);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 3000));
  const res = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.show = false;
    p.ui.showNoteIds = false;
    p.drawClearEffects = () => {};
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const out = [];
    for (const type of [1, 2]) {
      const note = p.chart.notes.find(n => n.type === type);
      if (!note) continue;
      const t = note.start_time + (note.end_time - note.start_time) * 0.5;
      p.setTime(t, false);
      p.render();
      const info2 = p.ctxInfo();
      const pos = p.noteScreenPos(note, info2);
      // sample a vertical column through the note center
      const col = [];
      for (let dy = -160; dy <= 160; dy += 10) {
        const y = Math.max(0, Math.min(H-1, Math.round(pos.y + dy)));
        const x = Math.max(0, Math.min(W-1, Math.round(pos.x)));
        const d = ctx.getImageData(x, y, 1, 1).data;
        col.push({ dy, rgb: [d[0], d[1], d[2]] });
      }
      out.push({ type, dir: note.direction, start: note.start_time, end: note.end_time, y: Math.round(pos.y), col });
    }
    return out;
  })()`);
  for (const r of res) {
    console.log('type', r.type, 'dir', r.dir, 'noteY', r.y);
    for (const c of r.col) {
      const [R, G, B] = c.rgb;
      const bright = (R + G + B) / 3 > 60;
      console.log((c.dy >= 0 ? '+' : '') + c.dy, bright ? `BRIGHT ${c.rgb}` : `dark   ${c.rgb}`);
    }
  }
  app.exit(0);
});
