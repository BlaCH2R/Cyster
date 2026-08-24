// probe_timeline_cost.js — measure renderTimeline cost with per-note expansion.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_cost_');
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
  setTimeout(() => app.exit(1), 90000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));
  const out = await win.webContents.executeJavaScript(`(() => {
    const tl = window.__sb.timeline;
    const laneCount = document.querySelectorAll('.lane-row').length;
    const t0 = performance.now();
    window.__sb.renderTimeline();
    const once = performance.now() - t0;
    const t1 = performance.now();
    window.__sb.renderTimeline();
    const twice = performance.now() - t1;
    return { laneCount, kfCount: document.querySelectorAll('.kf').length, onceMs: +once.toFixed(1), twiceMs: +twice.toFixed(1) };
  })()`);
  console.log('COST:', JSON.stringify(out));
  app.exit(0);
});
