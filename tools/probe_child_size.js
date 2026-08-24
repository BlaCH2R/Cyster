// probe_child_size.js — measure the drawn radius of a drag child at trigger
// time and compare to the 80%-of-previous expectation.
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
      await new Promise(r => setTimeout(r, 1200));
      const pv = window.__sb.preview;
      const ch = pv.chart;
      const S = pv.ctxInfo().S;
      const size = ch.model.size || 1;
      const expectedOld = 1.2816 * 0.56 * size * 1.133333 * S;   // previous
      const expectedNew = 1.2816 * 0.448 * size * 1.133333 * S;  // 80% of old
      // Find an isolated drag child (few neighbours near its trigger time)
      let best = null, bestScore = 1e9;
      for (const n of ch.notes) {
        if (n.type !== 4) continue;
        const near = ch.notes.filter(o => {
          if (o.id === n.id) return false;
          const t = Math.abs(o.start_time - n.start_time);
          return t < 0.8;
        }).length;
        if (near < bestScore) { bestScore = near; best = n; }
      }
      if (!best) return { err: 'no drag child' };
      pv.setTime(best.start_time, false);
      pv.render();
      const info = pv.ctxInfo();
      const pos = pv.noteScreenPos(best, info);
      const ctx = pv.canvas.getContext('2d');
      const W = pv.canvas.width, H = pv.canvas.height;
      const img = ctx.getImageData(0, 0, W, H).data;
      // Scan a vertical line through the note center for the fill extent
      const cx = Math.round(pos.x), cy = Math.round(pos.y);
      let top = null, bottom = null;
      for (let y = Math.max(0, cy - 120); y < Math.min(H, cy + 120); y++) {
        const i = (y * W + cx) * 4;
        const lum = (img[i] + img[i + 1] + img[i + 2]) / 3;
        if (lum > 90) { if (top == null) top = y; bottom = y; }
      }
      const measuredRadius = (bottom != null && top != null) ? (bottom - top) / 2 : null;
      return {
        id: best.id,
        measuredRadius: measuredRadius != null ? +measuredRadius.toFixed(1) : null,
        expectedNew: +expectedNew.toFixed(1),
        expectedOld: +expectedOld.toFixed(1),
        ratioNew: measuredRadius != null ? +(measuredRadius / expectedNew).toFixed(2) : null,
        neighbours: bestScore,
        center: { x: cx, y: cy }
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('CHILDSIZE:', JSON.stringify(out));
  app.exit(0);
});
