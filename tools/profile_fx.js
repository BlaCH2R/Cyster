const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));
const PLAYER = extract(SAMPLE_ZIP, 'cytoid_prof_');
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
    const measure = (t, effects) => {
      p.effectsEnabled = effects;
      const t0 = performance.now();
      for (let i = 0; i < 40; i++) { p.setTime(t + i * 0.016, false); p.render(); }
      const dt = performance.now() - t0;
      return Math.round(dt / 40 * 100) / 100;
    };
    const r = {};
    for (const t of [77.25, 120.1875, 150]) {
      r['t'+t] = { withFx: measure(t, true), noFx: measure(t, false) };
    }
    // count active objects at 120
    p.setTime(120.1875, false); p.render();
    const ev = p.evalResult;
    const merged = p.mergedCtrl || {};
    const active = {};
    for (const k of ['texts','sprites','videos','lines','controllers','noteControllers']) active[k] = ev ? ev[k].length : 0;
    const fx = {};
    for (const k of ['chromatical','bloom','radial_blur','color_adjustment','color_filter','gray_scale','noise','sepia','dream','fisheye','shockwave','focus','glitch','arcade','tape']) if (merged[k] === true) fx[k] = true;
    return { r, active, fx };
  })()`);
  console.log(JSON.stringify(res, null, 1));
  app.exit(0);
});
