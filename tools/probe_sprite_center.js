// probe_sprite_center.js — verify storyboard sprites render at screen center.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_sc_');
function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null
  }));
  return { level, levelDir: dir, files: [], charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));
  const out = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    const t = 52.125;
    p.setTime(t, false);
    p.render();
    const info = p.ctxInfo();
    const W = p.canvas.width, H = p.canvas.height;
    const ev = p.evalResult;
    const title = ev.sprites.find(r => r.from.path === 'title.png');
    if (!title) return { err: 'no title sprite at t=' + t, sprites: ev.sprites.map(r => r.from.path) };
    const M = p.stageMatrix(title.obj, title, info);
    // The sprite's default box: 200/800*W x 200/600*H, centered on the matrix origin
    const dw = (200 / 800) * W, dh = (200 / 600) * H;
    const cx = M.e, cy = M.f;
    const ctx = p.canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, W, H).data;
    let hits = 0, colored = 0;
    const r0 = Math.round(cx - dw / 2), r1 = Math.round(cx + dw / 2);
    const b0 = Math.round(cy - dh / 2), b1 = Math.round(cy + dh / 2);
    for (let y = Math.max(0, b0); y < Math.min(H, b1); y += 2) {
      for (let x = Math.max(0, r0); x < Math.min(W, r1); x += 2) {
        const i = (y * W + x) * 4;
        const rr = img[i], g = img[i + 1], b = img[i + 2];
        if (rr + g + b > 200) hits++;
        if (Math.abs(rr - g) > 30 || Math.abs(g - b) > 30) colored++;
      }
    }
    return {
      origin: { x: Math.round(cx), y: Math.round(cy) },
      center: { x: Math.round(W / 2), y: Math.round(H / 2) },
      box: { r0, r1, b0, b1 },
      hits, colored,
      opacity: title.from.opacity
    };
  })()`);
  console.log('SPRCENTER:', JSON.stringify(out));
  app.exit(0);
});
