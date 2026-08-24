// Full-app probe: seeks the robotic girl project through the camera-Y
// keyframes and reports mergedCtrl.yPx at each time.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：robotic girl/ロボティックガール/ロボティックガール.ctdsber';

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
      const out = [];
      for (const t of [123.4, 123.9, 124.0, 125.0, 127.5, 127.9, 191.9, 192.0, 195.0, 198.6]) {
        pv.setTime(t, false);
        await new Promise(r => setTimeout(r, 80));
        const ctrl = pv.mergedCtrl || {};
        out.push({ t, yPx: ctrl.yPx, camYpx: pv.ctxInfo().camYpx, canvas: pv.canvas.width + 'x' + pv.canvas.height });
      }
      return out;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  fs.writeFileSync(path.join(__dirname, 'probe_cam_y_app_out.json'), JSON.stringify(res, null, 2));
  console.log('CAM_Y_APP:', JSON.stringify(res));
  app.exit(0);
});
