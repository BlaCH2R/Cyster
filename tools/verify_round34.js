// verify_round34.js - the controller's perspective camera is a GLOBAL
// parameter: when perspective is ON, every perspective-camera sub-field
// (size/fov/x/y/z/rot_x/rot_y/rot_z) from ANY controller active at the same
// time takes effect, regardless of which track/lane the sub-item is on.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r34_ud_')));
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r34_'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [{ id: 1, type: 0, x: 0.5, tick: 2000, hold_tick: 0, page_index: 0 }],
    event_order_list: [],
    music_offset: 0
  };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  const level = { schema_version: 2, version: 1, id: 't', title: 't', artist: 't', charter: 't', music: { path: null }, charts: [{ type: 'base', path: 'chart.json' }] };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const info = { level, levelDir: dir, files: [{ name: 'level.json', size: 1 }, { name: 'chart.json', size: 1 }], charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: null, storyboardContent: null }] };
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 1500));

  const out = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    const sb = window.__sb.state.storyboard;
    // Separate controller objects = separate timeline tracks/lanes.
    sb.controllers = [
      { id: 'track_persp', time: 0, perspective: true },
      { id: 'track_size', time: 0, size: 3 },
      { id: 'track_fov', time: 0, fov: 30 },
      { id: 'track_pos', time: 0, x: 'noteX:0.8', y: 'noteY:0.3', z: -8 },
      { id: 'track_rot', time: 0, rot_x: 10, rot_y: 20, rot_z: 30 }
    ];
    window.__sb.refreshAll();
    p.setTime(1, false);
    p.render();
    const ctrl = p.mergedCtrl;
    const info2 = p.ctxInfo();
    const ch = p.chart;
    const S0 = (p.canvas.height / 2) / (Math.tan(15 * Math.PI / 180) * 8 * (3 / 5));
    const res = {
      merged: {
        perspective: ctrl.perspective, fov: ctrl.fov, size: ctrl.size,
        zPx: ctrl.zPx, rot_x: ctrl.rot_x, rot_y: ctrl.rot_y, rot_z: ctrl.rot_z
      },
      info: {
        S: +info2.S.toFixed(2),
        expS: +S0.toFixed(2),
        ortho: info2.ortho,
        sxF: +info2.sxF.toFixed(4),
        expSxF: +Math.cos(20 * Math.PI / 180).toFixed(4),
        syF: +info2.syF.toFixed(4),
        expSyF: +Math.cos(10 * Math.PI / 180).toFixed(4),
        rotZ: +(info2.rotZ * 180 / Math.PI).toFixed(1),
        camXpx: +info2.camXpx.toFixed(1),
        camYpx: +info2.camYpx.toFixed(1)
      }
    };
    // Expected camera x/y for noteX:0.8 / noteY:0.3 with the merged camera.
    const wx = ch.convertChartXToScreenX(0.8) * info2.S;
    const wy = ch.convertChartYToScreenY(0.3) * info2.S;
    res.info.expCamX = +wx.toFixed(1);
    res.info.expCamY = +wy.toFixed(1);

    // Perspective OFF: size must still work (ortho mode S = H/(2*size)).
    sb.controllers = sb.controllers.filter(c => c.id !== 'track_persp');
    window.__sb.refreshAll();
    p.setTime(1, false);
    p.render();
    const ctrlOff = p.mergedCtrl;
    const infoOff = p.ctxInfo();
    res.ortho = {
      perspective: ctrlOff.perspective,
      S: +infoOff.S.toFixed(2),
      expS: +(p.canvas.height / (2 * 3)).toFixed(2)
    };

    res.ok =
      ctrl.perspective === true && ctrl.fov === 30 && ctrl.size === 3 && ctrl.zPx === -8 &&
      ctrl.rot_x === 10 && ctrl.rot_y === 20 && ctrl.rot_z === 30 &&
      Math.abs(info2.S - S0) < 0.5 &&
      Math.abs(info2.sxF - Math.cos(20 * Math.PI / 180)) < 0.001 &&
      Math.abs(info2.syF - Math.cos(10 * Math.PI / 180)) < 0.001 &&
      Math.abs(info2.rotZ * 180 / Math.PI - 30) < 0.1 &&
      Math.abs(info2.camXpx - wx) < 1 && Math.abs(info2.camYpx - wy) < 1 &&
      ctrlOff.perspective !== true &&
      Math.abs(infoOff.S - p.canvas.height / 6) < 0.5;
    return res;
  })()`);
  console.log('R34:', JSON.stringify(out));
  check('all perspective-camera sub-fields apply across separate tracks when perspective is on',
    !out.err && out.ok,
    JSON.stringify({ merged: out.merged, info: out.info, ortho: out.ortho }));
  const fails = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
