// Full-app probe: opens robotic girl and prints the keyframe tooltip text for
// the camera controller's Y keyframes (the "from/to" values), to check whether
// the unit shown is notey or cameray.
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
      const sb = window.__sb.state.storyboard;
      const ctl = (sb.controllers || []).find((c) => c.id === '713uqdzx.p9d');
      if (!ctl) return { err: 'controller missing', ids: (sb.controllers || []).map((c) => c.id) };
      const out = [];
      for (const st of ctl.states || []) {
        if (st.y !== undefined || st.rot_x !== undefined) {
          out.push({ time: st.time, y: st.y, rot_x: st.rot_x, easing: st.easing });
        }
      }
      return { yStates: out };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  fs.writeFileSync(path.join(__dirname, 'probe_cam_y_tooltip_out.json'), JSON.stringify(res, null, 2));
  console.log('CAM_Y_TOOLTIP:', JSON.stringify(res));
  app.exit(0);
});
