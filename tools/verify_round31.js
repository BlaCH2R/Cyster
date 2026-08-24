// verify_round31.js - camera x/y in noteX/noteY units must center the camera
// on the corresponding playfield point: camera X=noteX:0.8, Y=noteY:0.3 puts
// the playfield point (noteX:0.8, noteY:0.3) at the screen center. This must
// hold for rot_z = 0 AND with camera rotation (the offset rotates with the
// scene: screen = center + R*(P - C)).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r31_ud_')));
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
      items.find(el => el.textContent.indexOf('hard') >= 0).click();
      await promise;
      await new Promise(r => setTimeout(r, 1800));
      const pv = window.__sb.preview;
      const sb = window.__sb.state.storyboard;
      const res = {};
      sb.controllers = sb.controllers || [];
      sb.controllers.push({ id: 'cam_r31', time: 0, x: 'noteX:0.8', y: 'noteY:0.3', rot_z: 0 });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 200));
      pv.ui.showNoteIds = false;

      const ch = pv.chart;
      const measure = () => {
        const info = pv.ctxInfo();
        const wx = ch.convertChartXToScreenX(0.8);
        const wy = ch.convertChartYToScreenY(0.3);
        const target = pv.worldToPx(wx, wy, info);
        const cx = pv.canvas.width / 2, cy = pv.canvas.height / 2;
        // Stage object placed at the same playfield point: it is a UI-layer
        // canvas object, so it stays at its canvas position regardless of the
        // camera ROTATION. The noteX/noteY coordinate system itself follows
        // the camera scale, so the position maps through the CURRENT S.
        const expStage = {
          x: pv.canvas.width / 2 + ch.convertChartXToScreenX(0.8) * info.S,
          y: pv.canvas.height / 2 - ch.convertChartYToScreenY(0.3) * info.S
        };
        const fakeObj = { id: 'x', type: 'sprite', states: [] };
        const fakeR = {
          from: { x: { unit: 'notex', value: 0.8 }, y: { unit: 'notey', value: 0.3 } },
          to: null, easeFn: (v) => v, t: 1
        };
        const m = pv.stageMatrix(fakeObj, fakeR, info);
        return {
          target: { x: +target.x.toFixed(1), y: +target.y.toFixed(1) },
          stage: { x: +m.e.toFixed(1), y: +m.f.toFixed(1) },
          expStage,
          dx: +(target.x - cx).toFixed(2), dy: +(target.y - cy).toFixed(2),
          stageDx: +(m.e - expStage.x).toFixed(2), stageDy: +(m.f - expStage.y).toFixed(2)
        };
      };

      const setCam = (rotZ) => {
        const c = sb.controllers[sb.controllers.length - 1];
        c.rot_z = rotZ;
        window.__sb.refreshAll();
        pv.setTime(5, false);
        pv.render();
      };

      setCam(0);
      res.r0 = measure();
      setCam(45);
      res.r45 = measure();
      setCam(90);
      res.r90 = measure();

      // Center-of-field: camera noteX:0.5/noteY:0.5 centers the playfield mid.
      sb.controllers[sb.controllers.length - 1] = { id: 'cam_r31b', time: 0, x: 'noteX:0.5', y: 'noteY:0.5', rot_z: 0 };
      window.__sb.refreshAll();
      pv.setTime(5, false);
      pv.render();
      {
        const info = pv.ctxInfo();
        const wxc = ch.convertChartXToScreenX(0.5);
        const wyc = ch.convertChartYToScreenY(0.5);
        const t = pv.worldToPx(wxc, wyc, info);
        res.rMid = { x: +t.x.toFixed(1), y: +t.y.toFixed(1), dx: +(t.x - pv.canvas.width / 2).toFixed(2), dy: +(t.y - pv.canvas.height / 2).toFixed(2) };
      }

      // Structural: the scanline/boundary transform rotates around the screen
      // center and offsets by the camera position (pre-rotation frame).
      const worldSrc = pv.drawWorld.toString();
      res.scanCam = worldSrc.indexOf("translate(info.W / 2, info.H / 2)") >= 0 &&
        worldSrc.indexOf("rotate(info.rotZ)") >= 0 &&
        worldSrc.indexOf('info.camYpx - scanY * info.S * info.syF') >= 0;

      const near = (r) => r && Math.abs(r.dx) < 1.2 && Math.abs(r.dy) < 1.2;
      const stageFixed = (r) => r && Math.abs(r.stageDx) < 1.2 && Math.abs(r.stageDy) < 1.2;
      res.ok = near(res.r0) && near(res.r45) && near(res.r90) &&
        near(res.rMid) && stageFixed(res.r0) && stageFixed(res.r45) && stageFixed(res.r90) &&
        res.scanCam;
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('R31:', JSON.stringify(out));

  check('camera noteX/noteY centers the playfield point (rot_z = 0/45/90)',
    !out.err && out.ok,
    JSON.stringify({ r0: out.r0, r45: out.r45, r90: out.r90, rMid: out.rMid, scanCam: out.scanCam }));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
