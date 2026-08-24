// verify_round39.js - the noteX/noteY coordinate system for stage objects
// follows the (perspective) camera scale: a sprite at noteX:0.8/noteY:0.3
// tracks the playfield's zoom (fov/z/size) while staying put under camera
// rotation (the object itself is still a UI-layer element).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r39_ud_')));
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r39_'));
  const chart = { time_base: 480, tempo_list: [{ tick: 0, value: 500000 }], page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }], note_list: [{ id: 1, type: 0, x: 0.5, tick: 2000, hold_tick: 0, page_index: 0 }], event_order_list: [], music_offset: 0 };
  const sb = { sprites: [{ id: 's', path: 'x.png', time: 0, opacity: 1, width: 100, height: 100, layer: 1, order: 0, x: { unit: 'notex', value: 0.8 }, y: { unit: 'notey', value: 0.3 } }], texts: [], videos: [], lines: [], controllers: [], note_controllers: [] };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  fs.writeFileSync(path.join(dir, 'sb.json'), JSON.stringify(sb));
  const level = { schema_version: 2, version: 1, id: 't', title: 't', artist: 't', charter: 't', music: { path: null }, charts: [{ type: 'base', path: 'chart.json', storyboard: { path: 'sb.json' } }] };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const info = { level, levelDir: dir, files: [{ name: 'level.json', size: 1 }], charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: 'sb.json', storyboardContent: JSON.stringify(sb) }] };
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 1200));

  const out = await win.webContents.executeJavaScript(`(() => {
    const pv = window.__sb.preview;
    const st = window.__sb.state.storyboard;
    const ch = pv.chart;
    const obj = st.sprites[0];
    const measure = (ctrl) => {
      st.controllers = ctrl;
      window.__sb.refreshAll();
      pv.setTime(1, false);
      pv.render();
      const info2 = pv.ctxInfo();
      const m = pv.stageMatrix({ id: 'x', type: 'sprite', states: [] }, { from: obj, to: null, easeFn: v => v, t: 1 }, info2);
      return { S: info2.S, e: m.e, f: m.f };
    };
    const base = measure([]);
    const zoom = measure([{ id: 'cam', time: 0, perspective: true, fov: 30, z: -8 }]);
    const rot = measure([{ id: 'cam', time: 0, perspective: true, fov: 30, z: -8, rot_z: 45 }]);
    const cx = pv.canvas.width / 2;
    const offBase = base.e - cx;
    const offZoom = zoom.e - cx;
    const ratio = offZoom / offBase;
    const expRatio = zoom.S / base.S;
    const res = { base, zoom, rot, offBase, offZoom, ratio: +ratio.toFixed(4), expRatio: +expRatio.toFixed(4) };
    res.ok = Math.abs(ratio - expRatio) < 0.02 &&
      Math.abs(rot.e - zoom.e) < 0.5 && Math.abs(rot.S - zoom.S) < 0.001;
    return res;
  })()`);
  console.log('R39:', JSON.stringify(out));
  check('noteX/noteY stage positions follow the perspective camera zoom (and stay under rotation)',
    !out.err && out.ok, JSON.stringify(out));
  const fails = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
