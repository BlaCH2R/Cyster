// probe_text_line_draw.js — do tag-created text/line objects paint at a quiet time?
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_tld_');
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
  const out = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = window.__sb.preview;
      const canvas = document.getElementById('previewCanvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const countAll = () => {
        const img = ctx.getImageData(0, 0, W, H).data;
        let n = 0;
        for (let i = 0; i < img.length; i += 4) {
          if (img[i] > 190 && img[i + 1] > 190 && img[i + 2] > 190) n++;
        }
        return n;
      };
      window.__sb.setTime(20, false);
      p.render();
      const before = countAll();
      // text at center
      window.__sb.state.storyboard.texts = window.__sb.state.storyboard.texts || [];
      window.__sb.state.storyboard.texts.push({ id: 'tl_text', time: 20, text: 'HELLO', opacity: 1, layer: 2, order: 0 });
      window.__sb.state.storyboard.lines = window.__sb.state.storyboard.lines || [];
      window.__sb.state.storyboard.lines.push({ id: 'tl_line', time: 20, opacity: 1, pos: [{ x: -1, y: 0 }, { x: 1, y: 0 }], width: 0.1, layer: 2, order: 0 });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 150));
      p.setTime(20, false);
      p.render();
      const after = countAll();
      const tr = p.evalResult.texts.find(r => r.obj.id === 'tl_text');
      const lr = p.evalResult.lines.find(r => r.obj.id === 'tl_line');
      // Sample the exact center row for the line
      const cy = Math.round(H / 2);
      let lineHits = 0;
      const img = ctx.getImageData(0, cy - 3, W, 6).data;
      for (let x = 0; x < W; x++) {
        const i = ((x) * 6 + 0) * 4;
        if (img[i] > 190 && img[i + 1] > 190 && img[i + 2] > 190) lineHits++;
      }
      return {
        before, after, lineHits, W, H,
        textFrom: tr && tr.from && { text: tr.from.text, opacity: tr.from.opacity, time: tr.from.time },
        lineFrom: lr && lr.from && { opacity: lr.from.opacity, width: JSON.stringify(lr.from.width), pos: lr.from.pos && lr.from.pos.length, time: lr.from.time }
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('TLDRAW:', JSON.stringify(out));
  app.exit(0);
});
