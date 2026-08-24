const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));
const PLAYER = extract(SAMPLE_ZIP, 'cytoid_rect_');
function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({ type: c.type, path: c.path, content: fs.readFileSync(path.join(dir, c.path), 'utf8'), storyboardPath: c.storyboard ? c.storyboard.path : null, storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null }));
  const files = [];
  for (const name of fs.readdirSync(dir)) { const st = fs.statSync(path.join(dir, name)); if (st.isFile()) files.push({ name, size: st.size }); }
  return { level, levelDir: dir, files, charts };
}
app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 40000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise(r => setTimeout(r, 1000));
  const rects = await win.webContents.executeJavaScript(`(() => {
    const out = [];
    document.querySelectorAll('.tb-btn').forEach(b => {
      const r = b.getBoundingClientRect();
      out.push({ text: b.textContent.trim(), cx: Math.round((r.left + r.right) / 2), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) });
    });
    const brand = document.querySelector('.brand-title').getBoundingClientRect();
    const logo = document.querySelector('.logo').getBoundingClientRect();
    return { winW: window.innerWidth, toolbarH: Math.round(document.querySelector('#toolbar').getBoundingClientRect().height), rects, brand: { cx: Math.round((brand.left+brand.right)/2), left: Math.round(brand.left), top: Math.round(brand.top), bottom: Math.round(brand.bottom) }, logo: { left: Math.round(logo.left), right: Math.round(logo.right), top: Math.round(logo.top), bottom: Math.round(logo.bottom) } };
  })()`);
  console.log('RECTS:', JSON.stringify(rects, null, 1));
  app.exit(0);
});
