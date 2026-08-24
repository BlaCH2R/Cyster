const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));
const PLAYER = 'D:/sd/Cytoid flies/player';
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
  win.webContents.on('console-message', (e) => {
    try { if (e.level >= 2) console.log('RENDERER[' + e.level + ']:', e.message); } catch (err) {}
  });
  const info = buildInfo(PLAYER);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 3000));
  const out = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const res = [];
    for (let t = 0; t <= 183.5; t += 2) {
      try {
        p.setTime(t, false); p.render();
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let nonDark = 0;
        for (let i = 0; i < img.length; i += 64) {
          if (img[i] + img[i+1] + img[i+2] > 120) nonDark++;
        }
        res.push({ t: +t.toFixed(1), nonDark, notes: p.evalResult ? p.evalResult.sprites.length : -1 });
      } catch (e) {
        res.push({ t: +t.toFixed(1), ERROR: e.message });
      }
    }
    return res;
  })()`);
  for (const r of out) console.log(JSON.stringify(r));
  app.exit(0);
});
