// probe_sample_expand.js — check the sample level's note-array expansion.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_se_');
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
  const info = buildInfo(PLAYER);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 2500));
  const out = await win.webContents.executeJavaScript(`(() => {
    const tl = window.__sb.timeline;
    const nc = tl.objects.filter(o => o.type === 'note_controller');
    return {
      rawNc: (window.__sb.state.storyboard.note_controllers || []).map(o => ({
        id: o.id, note: Array.isArray(o.note) ? o.note.slice(0, 5) : o.note, time: o.time
      })),
      expandedIds: nc.map(o => o.id),
      sample: nc.slice(0, 6).map(o => ({
        id: o.id,
        kfs: o.keyframes.slice(0, 3).map(k => ({ i: k.index, t: +k.time.toFixed(2), d: k.draggable })),
        start: +o.clipStart.toFixed(2)
      }))
    };
  })()`);
  console.log('SEXPAND:', JSON.stringify(out));
  app.exit(0);
});
