// capture_rot.js — screenshot a moment with camera rotation for visual QA.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/銀河鉄道のペンギン.ctdsber';

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
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
      // Inject a camera controller that rotates the playfield by 30 degrees
      const sb = window.__sb.state.storyboard;
      sb.controllers = sb.controllers || [];
      sb.controllers.push({ id: 'rot_test', time: 0, rot_z: 0, states: [{ time: 5, rot_z: 30 }] });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 150));
      pv.setTime(10, false);
      await new Promise(r => setTimeout(r, 300));
      return { rotZ: pv.mergedCtrl && pv.mergedCtrl.rot_z, t: 10 };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('ROT:', JSON.stringify(out));
  if (out && out.rotZ) {
    const img = await win.webContents.capturePage();
    fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'shots', 'shot_rot.png'), img.toPNG());
    console.log('captured at', out.t, 'rotZ', out.rotZ);
  }
  app.exit(0);
});
