// probe_155.js — targeted timing around t=15.5 to find the slow transition.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_p155_');
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
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));
  const out = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    const log = [];
    const one = (t) => {
      const t0 = performance.now();
      p.setTime(t, false);
      p.render();
      return +(performance.now() - t0).toFixed(2);
    };
    const times = {};
    const names = ['drawBackground', 'drawStageLayer', 'drawWorld', 'drawUI', 'evaluate', 'drawClearEffects'];
    const wraps = names.map((n) => {
      const orig = p[n].bind(p);
      p[n] = (...a) => {
        const t0 = performance.now();
        const r = orig(...a);
        times[n] = (times[n] || 0) + (performance.now() - t0);
        return r;
      };
      return orig;
    });
    let noteMs = 0, noteCalls = 0, perNote = {};
    const drawNoteOrig = p.drawNote.bind(p);
    p.drawNote = (...a) => {
      const t0 = performance.now();
      const r = drawNoteOrig(...a);
      noteMs += performance.now() - t0;
      noteCalls++;
      const id = a[2] ? a[2].id : '?';
      perNote[id] = (perNote[id] || 0) + (performance.now() - t0);
      return r;
    };
    // warm up 15.0
    one(15.0);
    for (const k of names) times[k] = 0;
    one(15.25);
    for (const k of names) times[k] = 0;
    noteMs = 0; noteCalls = 0; perNote = {};
    const slowMs = one(15.5);
    const slowTimes = Object.assign({}, times);
    const slowNote = { noteMs: +noteMs.toFixed(2), noteCalls, perNote: Object.assign({}, perNote) };
    for (const k of names) times[k] = 0;
    one(15.45);
    for (const k of names) times[k] = 0;
    noteMs = 0; noteCalls = 0; perNote = {};
    const fastMs = one(15.5);
    const fastTimes = Object.assign({}, times);
    const fastNote = { noteMs: +noteMs.toFixed(2), noteCalls, perNote: Object.assign({}, perNote) };
    // Repeat the slow sequence to see if the pool is warm now
    for (const k of names) times[k] = 0;
    noteMs = 0; noteCalls = 0; perNote = {};
    one(15.25);
    for (const k of names) times[k] = 0;
    noteMs = 0; noteCalls = 0; perNote = {};
    const slow2Ms = one(15.5);
    const slow2Note = { noteMs: +noteMs.toFixed(2), noteCalls, perNote: Object.assign({}, perNote) };
    const poolSize = p._tintPool ? p._tintPool.size : 0;
    const vis = p.chart.notes.filter(n => {
      const clear = p.noteClearTime(n);
      return 15.5 >= n.intro_time && 15.5 <= clear;
    }).map(n => ({ id: n.id, type: n.type, start: n.start_time, end: n.end_time, hold: n.hold_tick, next: n.next_id }));
    return { slowMs, slowTimes, slowNote, fastMs, fastTimes, fastNote, slow2Ms, slow2Note, poolSize, vis };
  })()`);
  console.log('P155:', JSON.stringify(out));
  app.exit(0);
});
