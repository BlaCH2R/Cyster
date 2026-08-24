// Clean per-type note color verification: ripples/IDs/background/effects off.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));
const PLAYER = extract(SAMPLE_ZIP, 'cytoid_vnc_');

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({ type: c.type, path: c.path, content: fs.readFileSync(path.join(dir, c.path), 'utf8'), storyboardPath: c.storyboard ? c.storyboard.path : null, storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null }));
  const files = [];
  for (const name of fs.readdirSync(dir)) { const st = fs.statSync(path.join(dir, name)); if (st.isFile()) files.push({ name, size: st.size }); }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  const info = buildInfo(PLAYER);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 3000));
  const res = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.showNoteIds = false;
    p.ui.show = false;
    p.drawClearEffects = () => {};
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const types = { 0:'click', 1:'hold', 2:'longhold', 3:'drag', 4:'dragchild', 5:'flick', 6:'cdrag', 7:'cdragchild' };
    const out = {};
    for (const [type, name] of Object.entries(types)) {
      const note = p.chart.notes.find(n => n.type === Number(type));
      if (!note) continue;
      p.setTime(note.start_time, false);
      p.render();
      const info2 = p.ctxInfo();
      const nc = p.noteColors(note, p.mergedCtrl.note_ring_color || null, p.mergedCtrl.note_fill_colors || null);
      const A = p.playerAssets || {};
      const pos = p.noteScreenPos(note, info2);
      const r = Math.round(p.noteRadiusAtTime(note, info2, note.start_time));
      const cxp = Math.max(0, Math.min(W-1, Math.round(pos.x)));
      const cyp = Math.max(0, Math.min(H-1, Math.round(pos.y)));
      const cd = ctx.getImageData(cxp, cyp, 1, 1).data;
      out[name] = { noteId: note.id, dir: note.direction, isForward: note.is_forward,
        fill: nc.fill && (nc.fill.r != null ? { r: +nc.fill.r.toFixed(3), g: +nc.fill.g.toFixed(3), b: +nc.fill.b.toFixed(3) } : nc.fill),
        ring: nc.ring && (nc.ring.r != null ? { r: +nc.ring.r.toFixed(3), g: +nc.ring.g.toFixed(3), b: +nc.ring.b.toFixed(3) } : nc.ring),
        noteFillLoaded: !!(A.noteFill && A.noteFill.complete),
        centerPx: [cd[0], cd[1], cd[2]] };
      const hist = {};
      for (let dy = -r; dy <= r; dy += 2) {
        for (let dx = -r; dx <= r; dx += 2) {
          const x = Math.max(0, Math.min(W-1, Math.round(pos.x + dx)));
          const y = Math.max(0, Math.min(H-1, Math.round(pos.y + dy)));
          const d = ctx.getImageData(x, y, 1, 1).data;
          const key = '#' + [d[0],d[1],d[2]].map(v => Math.round(v/16)*16).map(v => v.toString(16).padStart(2,'0')).join('');
          hist[key] = (hist[key] || 0) + 1;
        }
      }
      const top = Object.entries(hist).sort((a,b) => b[1]-a[1]).slice(0, 5);
      out[name].top = top;
    }
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  app.exit(0);
});
