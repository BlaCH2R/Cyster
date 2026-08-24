const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));
const PLAYER = extract(SAMPLE_ZIP, 'cytoid_dbg_');
function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({ type: c.type, path: c.path, content: fs.readFileSync(path.join(dir, c.path), 'utf8'), storyboardPath: c.storyboard ? c.storyboard.path : null, storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null }));
  const files = [];
  for (const name of fs.readdirSync(dir)) { const st = fs.statSync(path.join(dir, name)); if (st.isFile()) files.push({ name, size: st.size }); }
  return { level, levelDir: dir, files, charts };
}
app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 50000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try { console.log('RENDERER[' + e.level + ']:', e.message); } catch (err) {}
  });
  const info = buildInfo(PLAYER);
  try {
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
    console.log('load ok');
  } catch (e) {
    console.log('load error:', e.message);
  }
  await new Promise(r => setTimeout(r, 3000));
  try {
    const r = await win.webContents.executeJavaScript(`(() => {
      const p = window.__sb.preview;
      const t0 = performance.now();
      p.setTime(77.25, false);
      p.render();
      return 'render ok ' + (performance.now()-t0).toFixed(1) + 'ms';
    })()`);
    console.log(r);
  } catch (e) {
    console.log('render error:', e.message);
  }
  app.exit(0);
});
