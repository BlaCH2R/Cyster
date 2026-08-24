// verify_round21.js — ring default opacity 1 + child drag scale-in from 0.9x.
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
      const info = pv.ctxInfo();
      const res = {};

      // 1. Ring default opacity
      const click = ch.notes.find(n => n.type === 0);
      const hold = ch.notes.find(n => n.type === 1);
      const drag = ch.notes.find(n => n.type === 3);
      const flick = ch.notes.find(n => n.type === 5);
      const ringA = (n) => pv.noteColors(n, null, null).ring.a;
      res.rings = {
        click: ringA(click), hold: ringA(hold), drag: ringA(drag), flick: ringA(flick)
      };
      res.ringsOk = [res.rings.click, res.rings.hold, res.rings.drag, res.rings.flick].every(a => Math.abs(a - 1) < 0.001);

      // 2. Child scale-in from 0.9x
      const child = ch.notes.find(n => n.type === 4);
      const c7 = ch.notes.find(n => n.type === 7);
      res.child = {
        c4Initial: child ? child.initial_scale : null,
        c7Initial: c7 ? c7.initial_scale : null
      };
      if (child) {
        const mid = (child.intro_time + child.start_time) / 2;
        const midP = pv.noteVisualParams(child, info, 1, null, null, mid);
        const startP = pv.noteVisualParams(child, info, 1, null, null, child.start_time);
        res.child.dMid = +(midP.d / midP.diameter).toFixed(3);
        res.child.dStart = +(startP.d / startP.diameter).toFixed(3);
        res.child.scaleInOk = Math.abs(res.child.dMid - 0.85) < 0.01 && Math.abs(res.child.dStart - 1) < 0.001;
      }
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('note ring default opacity is 1 (all note types)',
    !out.err && out.ringsOk,
    JSON.stringify(out.rings));
  check('drag/c-drag children scale in from 0.7x',
    !out.err && out.child.c4Initial === 0.7 && out.child.c7Initial === 0.7 && out.child.scaleInOk,
    JSON.stringify(out.child));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
