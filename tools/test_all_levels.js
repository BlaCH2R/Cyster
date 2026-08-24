// Load every level under 项目/ and verify the storyboard compiles and the
// preview renders without throwing (validation / note-context / chart fixes).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_all_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const ROOT = 'V:\\cytoid storyboarder\\项目';
const levels = [];
(function walk(d) {
  const entries = fs.readdirSync(d, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && e.name === 'level.json')) {
    levels.push(d);
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) walk(path.join(d, e.name));
  }
})(ROOT);

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => {
    const item = { type: c.type, path: c.path };
    try { item.content = fs.readFileSync(path.join(dir, c.path), 'utf8'); } catch (e) {}
    item.storyboardPath = c.storyboard ? c.storyboard.path : null;
    if (c.storyboard && c.storyboard.path) {
      try { item.storyboardContent = fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8'); } catch (e) {}
    }
    return item;
  });
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 300000);
  await new Promise((r) => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 800));

  const results = [];
  for (const dir of levels) {
    const name = dir.replace(ROOT + '\\', '');
    try {
      const info = buildInfo(dir);
      const res = await win.webContents.executeJavaScript(`(async () => {
        try {
          await window.__sb.loadLevelInfo(${JSON.stringify(info)});
          await new Promise((r) => setTimeout(r, 800));
          window.__sb.preview.setTime(1, false);
          window.__sb.preview.render();
          const sb = window.__sb.state.storyboard;
          const nObjs = sb ? Object.keys(window.__sb.state.storyboard || {}).reduce(
            (n, k) => n + (Array.isArray(sb[k]) ? sb[k].length : 0), 0) : -1;
          const hasChart = !!window.__sb.state.chart;
          const laneCount = window.__sb.timeline ? window.__sb.timeline.render ? 0 : 0 : 0;
          return { ok: true, nObjs, hasChart };
        } catch (e) {
          return { ok: false, error: String(e && e.message || e) };
        }
      })()`);
      results.push({ name, ...res });
    } catch (e) {
      results.push({ name, ok: false, error: 'harness: ' + e.message });
    }
  }

  for (const r of results) {
    console.log((r.ok ? 'PASS' : 'FAIL') + ' ' + r.name +
      (r.ok ? ' objs=' + r.nObjs + ' chart=' + r.hasChart : ' :: ' + r.error));
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log('SUMMARY: ' + (results.length - failed) + '/' + results.length + ' levels loaded');
  app.exit(failed ? 1 : 0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
