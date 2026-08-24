// verify_round24.js — read CytoidPlayer "compiled" storyboard format.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r24_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const FOLDER = 'V:/cytoid storyboarder/项目/测试：hype/Hype';

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));

  const compiledContent = fs.readFileSync(path.join(FOLDER, 'storyboard_compiled.json'), 'utf8');
  const chartContent = fs.readFileSync(path.join(FOLDER, 'chart.base.txt'), 'utf8');
  const level = JSON.parse(fs.readFileSync(path.join(FOLDER, 'level.json'), 'utf8'));
  const info = {
    level,
    levelDir: FOLDER,
    files: [],
    charts: [{ type: 'extreme', path: 'chart.base.txt', content: chartContent, storyboardPath: 'storyboard_compiled.json', storyboardContent: compiledContent }]
  };

  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 3000));

  const out = await win.webContents.executeJavaScript(`(() => {
    const res = {};
    const sb = window.__sb.state.storyboard;
    res.controllers = (sb.controllers || []).length;
    res.noteControllers = (sb.note_controllers || []).length;
    const c0 = (sb.controllers || [])[0];
    res.firstCtrl = c0 && {
      keys: Object.keys(c0).slice(0, 8),
      hasFov: typeof c0.fov === 'number',
      hasPerspective: typeof c0.perspective === 'boolean',
      stateCount: (c0.states || []).length,
      stateTimes: (c0.states || []).slice(0, 4).map(s => typeof s.time === 'number' ? +s.time.toFixed(2) : s.time)
    };
    const nc0 = (sb.note_controllers || [])[0];
    res.firstNc = nc0 && {
      note: nc0.note,
      time: typeof nc0.time === 'number' ? +nc0.time.toFixed(2) : nc0.time,
      stateTimes: (nc0.states || []).map(s => +s.time.toFixed(2)).slice(0, 3),
      easing: (nc0.states || [])[0] && (nc0.states)[0].easing,
      overrideRotZ: (nc0.states || [])[0] && (nc0.states)[0].override_rot_z
    };
    // color + unit conversion on a controller with colors/scanline
    const colorCtrl = (sb.controllers || []).find(c => Array.isArray(c.note_fill_colors));
    res.colorCtrl = colorCtrl && {
      colors: (colorCtrl.note_fill_colors || []).slice(0, 3),
      ring: colorCtrl.note_ring_color
    };
    const scanCtrl = (sb.controllers || []).find(c => c.states && c.states.some(s => s.scanline_pos));
    res.scanUnit = scanCtrl && scanCtrl.states.find(s => s.scanline_pos).scanline_pos;
    // timeline entries
    const tl = window.__sb.timeline;
    res.tlControllers = tl.objects.filter(o => o.type === 'controller').length;
    res.tlNoteControllers = tl.objects.filter(o => o.type === 'note_controller').length;
    res.tlHasKfs = tl.objects.some(o => o.keyframes.length > 0);
    // preview evaluation
    window.__sb.preview.setTime(174, false);
    window.__sb.preview.render();
    res.evalControllers = (window.__sb.preview.evalResult ? window.__sb.preview.evalResult.controllers : []).length;
    res.evalNoteControllers = (window.__sb.preview.evalResult ? window.__sb.preview.evalResult.noteControllers : []).length;
    return res;
  })()`);

  check('compiled storyboard converted to editable groups',
    !out.err && out.controllers > 0 && out.noteControllers > 0,
    JSON.stringify(out));
  check('fields/easing/times converted (lowercase, numeric times, easing names)',
    !out.err && out.firstCtrl && out.firstCtrl.hasFov && out.firstCtrl.hasPerspective &&
    out.firstCtrl.stateTimes.every(t => typeof t === 'number') &&
    out.firstNc && typeof out.firstNc.note === 'number' && typeof out.firstNc.time === 'number' &&
    typeof out.firstNc.easing === 'string' && out.firstNc.overrideRotZ === true,
    JSON.stringify(out));
  check('colors and units converted (hex, notey:value)',
    !out.err && out.colorCtrl && /^#[0-9a-fA-F]{6}$/.test(out.colorCtrl.colors[0]) && /^#[0-9a-fA-F]{6}$/.test(out.colorCtrl.ring) && typeof out.scanUnit === 'string' && out.scanUnit.indexOf(':') > 0,
    JSON.stringify({ colors: out.colorCtrl && out.colorCtrl.colors, ring: out.colorCtrl && out.colorCtrl.ring, scanUnit: out.scanUnit }));
  check('timeline + preview read the compiled storyboard',
    !out.err && out.tlControllers > 0 && out.tlNoteControllers > 0 && out.tlHasKfs && out.evalControllers > 0 && out.evalNoteControllers > 0,
    JSON.stringify(out));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
