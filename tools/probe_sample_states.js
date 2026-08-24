// probe_sample_states.js — sample-level time[] arrays and initial+states lanes.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_ss_');
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
    const sb = window.__sb.state.storyboard;
    const res = {};
    // Controllers with time-array states
    const arrCtrls = (sb.controllers || []).filter(o => (o.states || []).some(s => Array.isArray(s.time)));
    res.arrCtrlRaw = arrCtrls.slice(0, 3).map(o => ({
      id: o.id, time: o.time,
      stateTimes: (o.states || []).map(s => s.time).slice(0, 5)
    }));
    const one = arrCtrls[0];
    if (one) {
      const entries = tl.objects.filter(o => o.id === one.id || o.id.indexOf(one.id + '::') === 0);
      res.arrCtrlEntries = entries.slice(0, 3).map(e => ({
        id: e.id,
        kfs: e.keyframes.map(k => +k.time.toFixed(2))
      }));
    }
    // A plain object (no note selector) with initial {} + states[]
    const plain = (sb.texts || sb.sprites || []).find(o => !o.note && (o.states || []).length > 0);
    if (plain) {
      const e = tl.objects.find(o => o.id === plain.id);
      res.plain = {
        id: plain.id,
        time: plain.time,
        stateCount: (plain.states || []).length,
        kfs: e ? e.keyframes.map(k => ({ i: k.index, t: +k.time.toFixed(2) })) : null,
        lanes: tl.objects.filter(o => o.id === plain.id).length
      };
    }
    return res;
  })()`);
  console.log('SSTATES:', JSON.stringify(out));
  app.exit(0);
});
