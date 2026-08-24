// Full-app probe: opens the penguin project, injects a camera controller with
// x = notex:-0.5 / y = notey:-0.5, and reports the merged camera offsets and
// a field-center note's screen position (should shift opposite the camera).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/銀河鉄道のペンギン.ctdsber';

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise((r) => setTimeout(r, 2200));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 860);
  await new Promise((r) => setTimeout(r, 600));
  const res = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      items.find(el => el.textContent.indexOf('extreme') >= 0).click();
      await promise;
      await new Promise(r => setTimeout(r, 1800));
      const pv = window.__sb.preview;
      const sb = window.__sb.state.storyboard;
      sb.controllers = sb.controllers || [];
      sb.controllers.push({
        id: 'cam_neg_test',
        states: [
          { time: 0, x: 'notex:-0.5', y: 'notey:-0.5' },
          { time: 60, x: 'notex:-0.5', y: 'notey:-0.5' }
        ]
      });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 250));
      const pv2 = window.__sb.preview;
      pv2.setTime(5, false);
      await new Promise(r => setTimeout(r, 300));
      const ctrl = pv2.mergedCtrl || {};
      const info = pv2.ctxInfo();
      const note = pv2.chart ? pv2.chart.notes[0] : null;
      const pos = note ? pv2.worldToPx(note.worldX, note.worldY, info) : null;
      return {
        xPx: ctrl.xPx,
        yPx: ctrl.yPx,
        camXpx: info.camXpx,
        camYpx: info.camYpx,
        notePos: pos ? [Number(pos.x.toFixed(1)), Number(pos.y.toFixed(1))] : null,
        w: pv2.canvas.width, h: pv2.canvas.height
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  fs.writeFileSync(path.join(__dirname, 'probe_cam_neg_app_out.json'), JSON.stringify(res, null, 2));
  console.log('CAM_NEG_APP:', JSON.stringify(res));
  app.exit(0);
});
