// probe_coords_debug.js — dump camera/note positions at several times.
const { app, BrowserWindow } = require('electron');
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
      const res = {};
      for (const t of [5, 30, 60, 120]) {
        pv.setTime(t, false);
        pv.render();
        const c = pv.mergedCtrl || {};
        const info = pv.ctxInfo();
        const notes = pv.chart.notes.filter(n => t >= n.intro_time && t <= pv.noteClearTime(n)).slice(0, 5);
        res[t] = {
          camX: c.xPx != null ? +c.xPx.toFixed(1) : 0,
          camY: c.yPx != null ? +c.yPx.toFixed(1) : 0,
          notes: notes.map(n => {
            const pos = pv.noteScreenPos(n, info);
            return { id: n.id, x: Math.round(pos.x), y: Math.round(pos.y), nx: n.x, worldX: +n.worldX.toFixed(2) };
          })
        };
      }
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('COORDS:', JSON.stringify(out));
  app.exit(0);
});
