// verify_round35.js - P0 timeline: lifecycle blocks, controller active-range
// segments, note-selector group folding; non-compiled storyboard read warning;
// and compiled-format output (storyboardCompiledJson).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r35_ud_')));
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r35_'));
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
    sprites: [
      { id: 's_plain', path: 'x.png', time: 5, opacity: 1, layer: 0, order: 0, states: [{ time: 10, opacity: 0.5 }] },
      { id: 's_notes', path: 'x.png', time: 0, opacity: 1, layer: 0, order: 0, note: [1, 2], states: [{ time: 'start:$note', opacity: 0.2 }] }
    ],
    texts: [], videos: [], lines: [],
    controllers: [
      { id: 'cam', time: 0, perspective: true, fov: 60, x: 'notex:0.8', easing: 'easeoutexpo', states: [{ time: 10, fov: 30, easing: 'EaseOutQuad' }, { time: 20, rot_z: 45 }] }
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
    // 1. Warning on non-compiled read
    res.warning = (document.getElementById('toastWrap').textContent || '').indexOf('compiled') >= 0;

    // 2. Timeline structure
    const tl = window.__sb.timeline;
    const objs = tl.objects || [];
    res.objs = objs.map(o => ({ id: o.id, type: o.type, group: !!o.__group, clipStart: o.clipStart, clipEnd: o.clipEnd, lifecycle: o.lifecycle, segs: (o.segments || []).length, children: o.children ? o.children.length : 0 }));
    const plain = objs.find(o => o.id === 's_plain');
    const ctrl = objs.find(o => o.id === 'cam');
    const notes = objs.find(o => o.id === 's_notes');
    res.lifecycleOk = plain && plain.lifecycle === true && plain.clipStart === 5 && plain.clipEnd === 10;
    res.segments = ctrl ? ctrl.segments : null;
    res.segmentsOk = !!ctrl && ctrl.segments && ctrl.segments.length === 2 &&
      ctrl.segments[0].start === 0 && ctrl.segments[0].end === 10 && ctrl.segments[0].label.indexOf('fov') >= 0 &&
      ctrl.segments[1].start === 10 && ctrl.segments[1].end === 20 && ctrl.segments[1].label.indexOf('rot_z') >= 0;
    // Note-selector objects stay on ONE compact lane with all note times.
    const ch2 = window.__sb.state.chart;
    const t1 = ch2.noteById(1).start_time, t2 = ch2.noteById(2).start_time;
    res.groupOk = !!notes && !notes.__group &&
      (notes.keyframes || []).some(k => Math.abs(k.time - t1) < 0.01) &&
      (notes.keyframes || []).some(k => Math.abs(k.time - t2) < 0.01);
    res.noGroupHeaders = document.querySelectorAll('.note-group').length === 0;

    // 4. Left object module: categories expand to list their objects.
    res.oa = {
      rows: document.querySelectorAll('.oa-row').length,
      items: document.querySelectorAll('.oa-item').length
    };
    res.oaOk = res.oa.rows >= 3 && res.oa.items >= 3;

    // 3. Compiled output
    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    res.compiledKeys = Object.keys(compiled);
    res.compiledDump = {
      spriteCount: compiled.sprites.length,
      sprites: compiled.sprites.map(s => ({ id: s.Id, n: s.States[0] && s.States[0].Note, t: s.States[0] && s.States[0].Time })),
      c0: compiled.controllers[0] ? compiled.controllers[0].States[0] : null
    };
    const c0 = compiled.controllers[0];
    const st0 = c0 && c0.States[0];
    res.compiledOk = compiled.compiled === true &&
      compiled.sprites.length === 3 && compiled.controllers.length === 1 &&
      st0 && st0.Perspective === true && st0.Fov === 60 && typeof st0.Easing === 'number' &&
      st0.Easing === 17 && c0.States[1].Easing === 2 &&
      st0.X && st0.X.Value === 0.8 && st0.X.Unit === 3 && st0.X.ScaleToCanvas === false && st0.X.Span === false &&
      compiled.sprites.some(s => s.States && s.States[0] && s.States[0].Note === 1) &&
      compiled.sprites.some(s => s.States && s.States[0] && s.States[0].Note === 2);
    return res;
  })()`);
  console.log('R35:', JSON.stringify(out));

  check('P0: lifecycle blocks (base -> last state, separate from keyframes)',
    !out.err && out.lifecycleOk, JSON.stringify(out.objs));
  check('P0: controller active-range segments (with changed-field labels)',
    !out.err && out.segmentsOk, JSON.stringify(out.segments));
  check('note-selector objects stay on one compact lane with all note times',
    !out.err && out.groupOk && out.noGroupHeaders, JSON.stringify({ groupOk: out.groupOk, noGroupHeaders: out.noGroupHeaders }));
  check('left object module expands to list objects per category',
    !out.err && out.oaOk, JSON.stringify(out.oa));
  check('non-compiled storyboard read shows a warning',
    !out.err && out.warning, JSON.stringify({ warning: out.warning }));
  check('exported storyboard aligns with the compiled format',
    !out.err && out.compiledOk, JSON.stringify({ keys: out.compiledKeys }));

  const fails = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
