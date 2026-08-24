// verify_round17.js — connector opacity follows the earlier node's fade-in.
const { app, BrowserWindow } = require('electron');
const path = require('path');
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
      items.find(el => el.textContent.indexOf('extreme') >= 0).click();
      await promise;
      await new Promise(r => setTimeout(r, 1200));

      const pv = window.__sb.preview;
      const ch = pv.chart;
      // Pick a pair with a reasonably long gap so the fade window is visible
      let pair = null, to = null, bestGap = 0;
      for (const n of ch.notes) {
        if (n.next_id <= 0 || !ch.noteMap[n.next_id]) continue;
        const t2 = ch.noteMap[n.next_id];
        const gap = Math.abs(t2.intro_time - n.intro_time);
        if (gap > bestGap) { bestGap = gap; pair = n; to = t2; }
      }
      if (!pair) return { err: 'no drag chain' };
      const earlier = pair.intro_time <= to.intro_time ? pair : to;
      const winLen = Math.max(0.001, earlier.start_time - earlier.intro_time);
      const t0 = earlier.intro_time;
      const alpha = (tt) => pv.dragLineAlpha(pair, to, tt);
      const res = {
        pairId: pair.id,
        toId: to.id,
        gap: +bestGap.toFixed(3),
        atIntro: alpha(t0),
        atQuarter: alpha(t0 + 0.25 * winLen),
        atHalf: alpha(t0 + 0.5 * winLen),
        atFull: alpha(t0 + winLen),
        expectedQuarter: 0.5 * 0.85,
        expectedHalf: 0.85
      };
      res.atIntroOk = Math.abs(res.atIntro) < 0.001;
      res.atQuarterOk = Math.abs(res.atQuarter - res.expectedQuarter) < 0.02;
      res.atHalfOk = Math.abs(res.atHalf - res.expectedHalf) < 0.02;
      res.atFullOk = Math.abs(res.atFull - res.expectedHalf) < 0.02;
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('connector opacity starts at 0 at earlier node intro',
    !out.err && out.atIntroOk, JSON.stringify(out));
  check('connector opacity tracks earlier node fade (0.425 at quarter, 0.85 at half)',
    !out.err && out.atQuarterOk && out.atHalfOk && out.atFullOk,
    JSON.stringify(out));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
