// profile_render.js — measures where preview.render() time goes at heavy timestamps.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_prof_');

function buildInfo(dir) {
  const level = JSON.parse(require('fs').readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: require('fs').readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path
      ? require('fs').readFileSync(path.join(dir, c.storyboard.path), 'utf8')
      : null
  }));
  return { level, levelDir: dir, files: [], charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  const info = buildInfo(PLAYER);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 2500));
  const prof = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    const ch = p.chart;
    const compiled = p.compiled;
    const out = {};
    for (const t of [77.25, 120.1875, 150]) {
      // warmup
      p.setTime(t, false); p.render();
      const N = 40;
      let evalMs = 0, renderMs = 0;
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        const tt = t + i * 0.016;
        const td = performance.now();
        p.setTime(tt, false);
        const te = performance.now();
        window.SBEngine.storyboard.evaluateStoryboard(compiled, tt);
        evalMs += performance.now() - te;
        p.render();
        renderMs += performance.now() - td;
      }
      const total = performance.now() - t0;
      out[t] = {
        evalAvg: +(evalMs / N).toFixed(2),
        renderAvg: +(renderMs / N).toFixed(2),
        totalAvg: +(total / N).toFixed(2),
        fps: Math.round(N * 1000 / total),
        notes: ch.notes.length,
        ncs: (compiled.noteControllers || []).length,
        ctrls: (compiled.controllers || []).length,
        sprites: (compiled.sprites || []).length
      };
    }
    return out;
  })()`);
  console.log('PROF:', JSON.stringify(prof));
  app.exit(0);
});
