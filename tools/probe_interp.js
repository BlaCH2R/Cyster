// probe_interp.js — does the engine interpolate numbers/colors between states?
const { app, BrowserWindow } = require('electron');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：hype/Hype/Hype.ctdsber';

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
      const sb = window.__sb.state.storyboard;
      // Add a sprite with opacity 1@0 -> 0@10 and color white@0 -> red@10
      sb.sprites = sb.sprites || [];
      sb.sprites.push({
        id: 'interp_test', time: 0, path: '', opacity: 1, color: '#FFFFFF',
        preserve_aspect: true, layer: 1, order: 0,
        states: [{ time: 10, opacity: 0, color: '#FF0000' }]
      });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 150));
      pv.setTime(5, false);
      const ev = window.SBEngine.storyboard.evaluateStoryboard(pv.compiled, 5);
      const sp = ev.sprites.find(r => r.obj.id === 'interp_test');
      return {
        from: sp && sp.from && { opacity: sp.from.opacity, color: sp.from.color },
        to: sp && sp.to && { opacity: sp.to.opacity, color: sp.to.color },
        t: sp && sp.t
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('INTERP:', JSON.stringify(out));
  app.exit(0);
});
