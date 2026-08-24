// Probe: dump the sample chart's note colors and sample pixels across a rendered
// note to verify ring/fill colors and shape.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));
const PLAYER = extract(SAMPLE_ZIP, 'cytoid_pix_');

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
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const model = p.chart.model;
    const out = {
      ring_color: model.ring_color,
      fill_colors: model.fill_colors,
      size: model.size
    };
    // Find one note of each type that is fully visible at some time; render & sample
    const types = [6];
    const samples = [];
    for (const type of types) {
      const note = p.chart.notes.find(n => n.type === type);
      if (!note) continue;
      const t = note.start_time;
      p.setTime(t, false);
      p.render();
      const info2 = p.ctxInfo();
      const pos = p.noteScreenPos(note, info2);
      const r = Math.round(p.noteRadiusAtTime(note, info2, t) * 1.5);
      const pxAt = (x, y) => {
        const xc = Math.max(0, Math.min(W-1, Math.round(x)));
        const yc = Math.max(0, Math.min(H-1, Math.round(y)));
        const d = ctx.getImageData(xc, yc, 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      const center = pxAt(pos.x, pos.y);
      const ringX = pxAt(pos.x + p.noteRadiusAtTime(note, info2, t), pos.y);
      const outside = pxAt(pos.x + r, pos.y);
      let nonWhite = 0, colored = 0;
      for (let dy = -r; dy <= r; dy += 3) {
        for (let dx = -r; dx <= r; dx += 3) {
          const c = pxAt(pos.x + dx, pos.y + dy);
          if (c[0] < 245 || c[1] < 245 || c[2] < 245) nonWhite++;
          if (Math.abs(c[0]-c[1]) > 30 || Math.abs(c[1]-c[2]) > 30 || Math.abs(c[0]-c[2]) > 30) colored++;
        }
      }
      samples.push({ type, noteId: note.id, start: note.start_time, r, center, ringX, outside, nonWhite, colored });
    }
    out.samples = samples;
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  app.exit(0);
});
