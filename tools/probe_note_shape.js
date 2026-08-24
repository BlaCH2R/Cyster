const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_shape_');
function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({ type: c.type, path: c.path, content: fs.readFileSync(path.join(dir, c.path), 'utf8'), storyboardPath: c.storyboard ? c.storyboard.path : null, storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null }));
  const files = [];
  for (const name of fs.readdirSync(dir)) { const st = fs.statSync(path.join(dir, name)); if (st.isFile()) files.push({ name, size: st.size }); }
  return { level, levelDir: dir, files, charts };
}
app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try { if (e.level >= 2) console.log('RENDERER:', e.message); } catch (err) {}
  });
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 3500));
  const out = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    // find a click note (type 0) visible mid-approach
    const note = p.chart.notes.find(n => n.type === 0 && n.start_time > 5 && n.start_time < 20);
    const t = (note.intro_time + note.start_time) / 2;
    p.setTime(t, false); p.render();
    const info = p.ctxInfo();
    const pos = p.noteScreenPos(note, info);
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const img = ctx.getImageData(0, 0, W, H).data;
    const d = (p.chart.model.size || 1) * 1.133333 * 1.9717 * info.S;
    const R = Math.ceil(d / 2 * 1.25);
    const rows = [];
    for (let dy = -R; dy <= R; dy += 2) {
      let row = '';
      for (let dx = -R; dx <= R; dx += 2) {
        const x = Math.max(0, Math.min(W-1, Math.round(pos.x + dx)));
        const y = Math.max(0, Math.min(H-1, Math.round(pos.y + dy)));
        const i = (y*W + x) * 4;
        const rr = img[i], g = img[i+1], b = img[i+2];
        const lum = (rr+g+b)/3;
        const sat = Math.max(rr,g,b) - Math.min(rr,g,b);
        row += (sat > 40 && lum > 80) ? '#' : (lum > 120 ? '.' : ' ');
      }
      rows.push(row);
    }
    return { noteId: note.id, type: note.type, t, pos: {x: Math.round(pos.x), y: Math.round(pos.y)}, d: Math.round(d), ascii: rows.join('|') };
  })()`);
  console.log('SHAPE-INFO:', JSON.stringify({ noteId: out.noteId, type: out.type, t: out.t, pos: out.pos, d: out.d }));
  console.log('SHAPE-ASCII:\n' + out.ascii.split('|').join('\n'));
  app.exit(0);
});
