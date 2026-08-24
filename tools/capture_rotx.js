// Full-app probe: loads the penguin test project, injects a camera controller
// (perspective + rot_x), and captures the preview canvas for visual QA of the
// camera tilt direction. Run directly (not via Playwright / Start-Process).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/銀河鉄道のペンギン.ctdsber';
const ROTX = process.argv.indexOf('--rotx') >= 0 ? Number(process.argv[process.argv.indexOf('--rotx') + 1]) : 30;

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 70000);
  await new Promise((r) => setTimeout(r, 2200));
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
      let pv = window.__sb.preview;
      const sb = window.__sb.state.storyboard;
      sb.controllers = sb.controllers || [];
      sb.controllers.push({
        id: 'cam_rotx_test',
        time: 0,
        states: [
          { time: 0, perspective: true, fov: 53.2, rot_x: ${ROTX}, rot_y: 0, rot_z: 0 },
          { time: 30, perspective: true, fov: 53.2, rot_x: ${ROTX}, rot_y: 0, rot_z: 0 }
        ]
      });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 200));
      pv = window.__sb.preview;
      pv.setTime(8, false);
      await new Promise(r => setTimeout(r, 400));
      const info = pv.ctxInfo();
      const canvas = pv.canvas;
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let h = 0;
      for (let i = 0; i < data.length; i += 997) h = (h * 31 + data[i]) >>> 0;
      return {
        rotX: pv.mergedCtrl && pv.mergedCtrl.rot_x,
        perspective: pv.mergedCtrl && pv.mergedCtrl.perspective,
        infoPerspective: info.perspective,
        infoRotX: info.rotX,
        t: pv.time,
        canvas: canvas.width + 'x' + canvas.height,
        hash: h
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('ROTX:', JSON.stringify(out));
  if (out && out.rotX !== undefined) {
    const img = await win.webContents.capturePage();
    fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'shots', `shot_rotx_${ROTX}.png`), img.toPNG());
    console.log('captured rotx', ROTX, 'at t', out.t);
  }
  app.exit(0);
});
