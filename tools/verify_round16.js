// verify_round16.js — drag/c-drag connectors appear in sync with the earlier
// of the two connected nodes (not before it).
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
      const pair = ch.notes.find(n => n.next_id > 0 && ch.noteMap[n.next_id]);
      if (!pair) return { err: 'no drag chain' };
      const to = ch.noteMap[pair.next_id];
      const w = pv.dragLineWindow(pair, to);
      const earlierIntro = Math.min(pair.intro_time, to.intro_time);
      const res = {
        pairId: pair.id,
        toId: to.id,
        lineStart: w.lineStart,
        earlierIntro,
        synced: Math.abs(w.lineStart - earlierIntro) < 0.0001,
        lineStop: w.lineStop,
        stopOk: Math.abs(w.lineStop - (to.intro_time - 0.132)) < 0.0001
      };

      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('connector lineStart synced with earlier node intro',
    !out.err && out.synced && out.stopOk,
    JSON.stringify(out));
  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
