// verify_round36.js - cross-unit interpolation (camerax -> notex etc.) and
// controller note-selector expansion into independent per-note controllers.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r36_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise(r => setTimeout(r, 600));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r36_'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [
      { id: 1, type: 0, x: 0.3, tick: 2000, hold_tick: 0, page_index: 0 },
      { id: 2, type: 0, x: 0.7, tick: 2400, hold_tick: 0, page_index: 0 }
    ],
    event_order_list: [],
    music_offset: 0
  };
  const sb = {
    sprites: [], texts: [], videos: [], lines: [],
    controllers: [
      { id: 'xanim', time: 0, x: 'camerax:1', states: [{ time: 10, x: 'notex:0.5' }] },
      { id: 'nc', time: 0, background_dim: 1, states: [{ note: [1, 2], time: 'start:$note', background_dim: 0.5 }] }
    ],
    note_controllers: []
  };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  const level = { schema_version: 2, version: 1, id: 't', title: 't', artist: 't', charter: 't', music: { path: null }, charts: [{ type: 'base', path: 'chart.json', storyboard: { path: 'sb.json' } }] };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  fs.writeFileSync(path.join(dir, 'sb.json'), JSON.stringify(sb));
  const info = {
    level, levelDir: dir,
    files: [{ name: 'level.json', size: 1 }, { name: 'chart.json', size: 1 }, { name: 'sb.json', size: 1 }],
    charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: 'sb.json', storyboardContent: JSON.stringify(sb) }]
  };
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 1500));

  const out = await win.webContents.executeJavaScript(`(() => {
    const res = {};
    const st = window.__sb.state.storyboard;

    // 1. Controller note-selector expansion at read time.
    res.controllers = (st.controllers || []).map(c => ({ id: c.id, states: (c.states || []).map(s => ({ t: s.time, dim: s.background_dim, note: s.note })) }));
    const nc1 = (st.controllers || []).find(c => c.id === 'nc::n1');
    const nc2 = (st.controllers || []).find(c => c.id === 'nc::n2');
    const ch = window.__sb.state.chart;
    const t1 = ch.noteById(1).start_time, t2 = ch.noteById(2).start_time;
    res.expandOk = !!nc1 && !!nc2 &&
      nc1.states.length === 1 && nc1.states[0].time === t1 && nc1.states[0].background_dim === 0.5 &&
      nc2.states.length === 1 && nc2.states[0].time === t2 && nc2.states[0].background_dim === 0.5 &&
      !nc1.states[0].note && !nc2.states[0].note &&
      (st.controllers || []).length === 3;

    // 2. Cross-unit interpolation: camerax:1 -> notex:0.5 over 0..10s.
    const pv = window.__sb.preview;
    pv.setTime(5, false);
    pv.render();
    const info2 = pv.ctxInfo();
    const ortho = 5, aspect = 16 / 9;
    const wFrom = 1 * ortho * aspect;                       // camerax:1 -> world
    const wTo = ch.convertChartXToScreenX(0.5);             // notex:0.5 -> world (0)
    const wMid = (wFrom + wTo) / 2;
    res.xPx = pv.mergedCtrl.xPx;
    res.expXPx = wMid * info2.S;
    res.interpOk = Math.abs(pv.mergedCtrl.xPx - wMid * info2.S) < 0.5;
    return res;
  })()`);
  console.log('R36:', JSON.stringify(out));

  check('controllers with note selectors split into independent per-note objects at read',
    !out.err && out.expandOk, JSON.stringify(out.controllers));
  check('cross-unit interpolation (camerax -> notex) interpolates in world space',
    !out.err && out.interpOk, JSON.stringify({ xPx: out.xPx, expXPx: out.expXPx }));
  const fails = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
