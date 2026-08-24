// verify_round25.js — color transitions interpolate + camera rotation applies
// to the whole playfield around the camera center.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r25_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/銀河鉄道のペンギン.ctdsber';

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

  const out = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      items.find(el => el.textContent.indexOf('extreme') >= 0).click();
      await promise;
      await new Promise(r => setTimeout(r, 1500));
      const pv = window.__sb.preview;
      const res = {};

      // 1. Color interpolation (engine)
      const sb = window.__sb.state.storyboard;
      sb.sprites = sb.sprites || [];
      sb.sprites.push({
        id: 'c_test', time: 0, path: '', opacity: 1, color: '#FFFFFF',
        preserve_aspect: true, layer: 1, order: 0,
        states: [{ time: 10, color: '#FF0000', opacity: 0 }]
      });
      sb.controllers = sb.controllers || [];
      sb.controllers.push({
        id: 'cc_test', time: 0, note_fill_colors: ['#FF0000', '#00FF00'],
        states: [{ time: 10, note_fill_colors: ['#0000FF', '#FFFFFF'] }]
      });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 150));
      const ev5 = window.SBEngine.storyboard.evaluateStoryboard(pv.compiled, 5);
      const sp5 = ev5.sprites.find(r => r.obj.id === 'c_test');
      const cc5 = ev5.controllers.find(r => r.obj.id === 'cc_test');
      res.sprite = { opacity: sp5.from.opacity, color: sp5.from.color };
      res.controllerColors = cc5.from.note_fill_colors;
      res.colorOk = Math.abs(sp5.from.opacity - 0.5) < 0.01 &&
        Math.abs(sp5.from.color.g - 0.5) < 0.02 &&
        Math.abs(cc5.from.note_fill_colors[0].b - 0.5) < 0.02 &&
        Math.abs(cc5.from.note_fill_colors[0].r - 0.5) < 0.02 &&
        Math.abs(cc5.from.note_fill_colors[1].r - 0.5) < 0.02;

      // 2. Camera rotation around the camera center
      const info = pv.ctxInfo();
      res.cam = { cx: info.camCX, cy: info.camCY, w2: info.W / 2, h2: info.H / 2 };
      res.camOk = Math.abs(info.camCX - info.W / 2) < 1 && Math.abs(info.camCY - info.H / 2) < 1;
      // A world point at (1,0) rotated 90° lands below the camera center
      const rotInfo = { ...info, rotZ: Math.PI / 2 };
      const pt = pv.worldToPx(1, 0, rotInfo);
      const exp = { x: info.camCX, y: info.camCY + info.S };
      res.rotPoint = { x: +pt.x.toFixed(1), y: +pt.y.toFixed(1), expX: +exp.x.toFixed(1), expY: +exp.y.toFixed(1) };
      res.rotOk = Math.abs(pt.x - exp.x) < 2 && Math.abs(pt.y - exp.y) < 2;
      // stageMatrix: storyboard objects are UI-layer canvas elements — they
      // stay fixed on the 800x600 canvas and do NOT move/rotate with the
      // game camera.
      const fakeObj = { id: 'x', type: 'sprite', states: [] };
      const fakeR = {
        from: { x: { value: 400, unit: 'stagex' }, y: { value: 0, unit: 'stagey' } },
        to: null, easeFn: (v) => v, t: 1
      };
      const m90 = pv.stageMatrix(fakeObj, fakeR, rotInfo);
      const m0 = pv.stageMatrix(fakeObj, fakeR, info);
      res.stageMat = {
        m90: { e: +m90.e.toFixed(1), f: +m90.f.toFixed(1) },
        m0: { e: +m0.e.toFixed(1), f: +m0.f.toFixed(1) }
      };
      // stagex:400 = half screen right of center; with rotZ=90° it lands half
      // screen BELOW center; with rotZ=0 it stays right of center.
      // stagex:400 = half screen right of center; the canvas position must be
      // identical for rotZ=0 and rotZ=90 (camera-independent).
      res.stageRotOk = Math.abs(m90.e - info.W) < 4 &&
        Math.abs(m90.f - info.H / 2) < 4 &&
        Math.abs(m0.e - info.W) < 4 &&
        Math.abs(m0.f - info.H / 2) < 4 &&
        Math.abs(m90.e - m0.e) < 1 && Math.abs(m90.f - m0.f) < 1;
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('color transitions interpolate (numbers, colors, color arrays)',
    !out.err && out.colorOk,
    JSON.stringify({ sprite: out.sprite, controllerColors: out.controllerColors }));
  check('camera center + rotation math around it',
    !out.err && out.camOk && out.rotOk,
    JSON.stringify({ cam: out.cam, rotPoint: out.rotPoint }));
  check('stage objects stay fixed on the storyboard canvas (camera-independent)',
    !out.err && out.stageRotOk,
    JSON.stringify(out.stageMat));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
