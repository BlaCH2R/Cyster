// verify_round27.js — camera rot_x/rot_y as 3D rotation (consistent
// foreshortening everywhere) + ui_opacity affects the scanline boundary lines.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r27_ud_')));
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

      // 1. rot_x as 3D rotation: NOTES foreshorten with the camera, but stage
      // objects are UI-layer canvas elements — they keep their canvas size
      // regardless of the camera rotation.
      const base = pv.ctxInfo();
      const rot30 = { ...base, rotX: 30 * Math.PI / 180, syF: Math.cos(30 * Math.PI / 180) };
      const fakeObj = { id: 'x', type: 'sprite', states: [] };
      const fakeR = {
        from: { x: { value: 0, unit: 'stagex' }, y: { value: 300, unit: 'stagey' } },
        to: null, easeFn: (v) => v, t: 1
      };
      const m0 = pv.stageMatrix(fakeObj, fakeR, base);
      const mX = pv.stageMatrix(fakeObj, fakeR, rot30);
      res.stage = {
        syF: +rot30.syF.toFixed(3),
        f0: +m0.f.toFixed(1),
        fX: +mX.f.toFixed(1),
        expected: 0
      };
      res.stageOk = Math.abs(res.stage.fX - res.stage.expected) < 3 &&
        Math.abs(res.stage.fX - res.stage.f0) < 1;
      // Notes foreshorten too (worldToPx with syF)
      const notePx = pv.worldToPx(0, 1, rot30);
      res.noteY = +notePx.y.toFixed(1);
      res.noteExpected = +(rot30.camCY - 1 * base.S * rot30.syF).toFixed(1);
      res.noteOk = Math.abs(res.noteY - res.noteExpected) < 2;

      // 2. ui_opacity affects the scanline boundary dashes (pixel check)
      const sb = window.__sb.state.storyboard;
      sb.controllers = sb.controllers || [];
      // Stage objects (e.g. a video) are asynchronous and would pollute the
      // boundary pixel measurement — the boundary dashes come from drawWorld.
      pv.drawStageLayer = () => {};
      const countBoundary = () => {
        pv.render();
        const info = pv.ctxInfo();
        const ch = pv.chart;
        const topY = info.camCY - ch.convertChartYToScreenY(1) * info.S * info.syF;
        const canvas = pv.canvas;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const img = ctx.getImageData(0, Math.max(0, Math.round(topY) - 3), W, 6).data;
        let n = 0;
        for (let i = 0; i < img.length; i += 4) {
          if (img[i] + img[i + 1] + img[i + 2] > 200) n++;
        }
        return n;
      };
      pv.setTime(10, false);
      sb.controllers.push({ id: 'ui_test_on', time: 0, ui_opacity: 1 });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 100));
      const withUi = countBoundary();
      sb.controllers[sb.controllers.length - 1].ui_opacity = 0;
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 100));
      const withoutUi = countBoundary();
      res.uiBoundary = { withUi, withoutUi };
      // The boundary dashes add brightness when ui_opacity=1 and disappear at 0
      res.uiOk = (withUi - withoutUi) > 100;
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('camera rot_x foreshortens notes but stage objects stay canvas-fixed',
    !out.err && out.stageOk && out.noteOk,
    JSON.stringify({ stage: out.stage, noteY: out.noteY, noteExpected: out.noteExpected }));
  check('ui_opacity changes scanline boundary line opacity',
    !out.err && out.uiOk,
    JSON.stringify(out.uiBoundary));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
