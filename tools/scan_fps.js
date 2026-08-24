// scan_fps.js — renders the whole song (0.25s steps) and reports the slowest frames.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_scan_');
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
  setTimeout(() => app.exit(1), 120000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));
  const out = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    const dur = window.__sb.state.audioDuration || p.chart.endTime || 180;
    let worst = [];
    let prev = null;
    for (let t = 0; t <= dur; t += 0.25) {
      const t0 = performance.now();
      p.setTime(t, false);
      p.render();
      const ms = performance.now() - t0;
      worst.push({ t: +t.toFixed(2), ms: +ms.toFixed(2) });
    }
    worst.sort((a, b) => b.ms - a.ms);
    const top = worst.slice(0, 6);
    for (const w of top) {
      p.setTime(w.t, false);
      p.render();
      const info = p.ctxInfo();
      const visible = p.chart.notes.filter((n) => {
        const clear = p.noteClearTime(n);
        return w.t >= n.intro_time && w.t <= clear;
      }).length;
      w.visibleNotes = visible;
      const c = p.mergedCtrl || {};
      w.eff = Object.keys(c)
        .filter((k) => /blur|glitch|noise|arcade|chromat|fisheye|dream|bloom|color|filter|shock|focus/.test(k))
        .reduce((o, k) => { o[k] = c[k]; return o; }, {});
    }
    // Fine-grained scan around 15.5 to find the exact slow moment
    const fine = [];
    for (let t = 15.3; t <= 15.7; t += 0.01) {
      const t0 = performance.now();
      p.setTime(t, false);
      p.render();
      fine.push({ t: +t.toFixed(2), ms: +(performance.now() - t0).toFixed(2) });
    }
    fine.sort((a, b) => b.ms - a.ms);
    return { top, avg: +(worst.reduce((s, w) => s + w.ms, 0) / worst.length).toFixed(2), fine: fine.slice(0, 6) };
  })()`);
  console.log('SCAN:', JSON.stringify(out));
  app.exit(0);
});
