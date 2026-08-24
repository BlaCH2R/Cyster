// Full-app probe: captures the preview canvas at two camera-Y keyframe times
// and measures the scanner (bright horizontal line) position to verify the
// vertical camera offset is actually rendered.
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
      for (const t of [123.4, 124.0, 127.5, 128.0]) {
        pv.setTime(t, false);
        await new Promise(r => setTimeout(r, 150));
        const canvas = pv.canvas;
        const ctx = canvas.getContext('2d');
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // find the brightest row in the central column (scanner line)
        let bestY = -1, best = 0;
        for (let y = 0; y < canvas.height; y++) {
          const i = (y * canvas.width + Math.floor(canvas.width / 2)) * 4;
          const l = (img[i] + img[i + 1] + img[i + 2]) / 3;
          if (l > best) { best = l; bestY = y; }
        }
        out.push({ t, camYpx: pv.ctxInfo().camYpx, scannerY: bestY, brightness: best,
                   canvas: canvas.width + 'x' + canvas.height });
      }
      return out;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  fs.writeFileSync(path.join(__dirname, 'probe_cam_y_render_out.json'), JSON.stringify(res, null, 2));
  console.log('CAM_Y_RENDER:', JSON.stringify(res));
  app.exit(0);
});
