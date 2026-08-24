// verify_round18.js — coordinate axis fixes per the StoryBoard format doc:
// noteX/noteY position semantics, stageY up, cameraX scene-left, cameraY scene-down.
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
      const W = info.W, H = info.H, S = info.S;
      const u = (v, unit, span) => pv.unitPx({ value: v, unit }, info, span);
      const uw = (v, unit) => pv.unitWorld({ value: v, unit }, info);

      const res = {};
      // 1. noteX position: 0 -> left edge, 0.5 -> center, 1 -> right edge
      const nx0 = uw(0, 'notex'), nx05 = uw(0.5, 'notex'), nx1 = uw(1, 'notex');
      res.noteX = {
        center: +nx05.toFixed(3),
        leftIsNegative: nx0 < 0,
        rightIsPositive: nx1 > 0,
        symmetric: Math.abs(nx0 + nx1) < 0.001
      };
      // 1b. noteX span (width): noteX:1 = full field width (positive)
      const spanX = u(1, 'notex', true);
      res.noteXSpan = { positive: spanX > 0, equalsTwoHalves: Math.abs(spanX - (nx1 - nx0) * S) < 0.01 };
      // 2. noteY position: 0 -> bottom, 1 -> top (world y up)
      const ny0 = uw(0, 'notey'), ny1 = uw(1, 'notey');
      res.noteY = { bottomBelow: ny0 < 0, topAbove: ny1 > 0 };
      // 3. stageMatrix: stagey +300 at top (canvas y=0), -300 at bottom (canvas y=H)
      const fakeObj = { id: 'x', type: 'sprite', states: [] };
      const fakeR = { from: { x: { value: 0, unit: 'stagex' }, y: { value: 300, unit: 'stagey' } }, to: null, easeFn: (v) => v, t: 1 };
      const topM = pv.stageMatrix(fakeObj, fakeR, info);
      fakeR.from.y = { value: -300, unit: 'stagey' };
      const botM = pv.stageMatrix(fakeObj, fakeR, info);
      fakeR.from.y = { value: 0, unit: 'stagey' };
      const centerM = pv.stageMatrix(fakeObj, fakeR, info);
      res.stageY = {
        topY: +topM.f.toFixed(1),
        botY: +botM.f.toFixed(1),
        centerY: +centerM.f.toFixed(1),
        topOk: Math.abs(topM.f) < 1,
        botOk: Math.abs(botM.f - H) < 1,
        centerOk: Math.abs(centerM.f - H / 2) < 1
      };
      // 4. Camera X: +camX moves scene LEFT by half screen (x=0 at wx=0)
      const camLeft = pv.worldToPx(0, 0, { ...info, camXpx: W / 2 });
      const camNone = pv.worldToPx(0, 0, { ...info, camXpx: 0 });
      res.cameraX = {
        leftX: +camLeft.x.toFixed(1),
        noneX: +camNone.x.toFixed(1),
        sceneLeft: camLeft.x < camNone.x && Math.abs(camLeft.x - 0) < 1
      };
      // 5. Camera Y: +camY moves scene DOWN by half screen
      const camDown = pv.worldToPx(0, 0, { ...info, camYpx: H / 2 });
      res.cameraY = {
        downY: +camDown.y.toFixed(1),
        noneY: +camNone.y.toFixed(1),
        sceneDown: camDown.y > camNone.y && Math.abs(camDown.y - H) < 1
      };
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('noteX/noteY position semantics (0=left/bottom, 0.5=center, 1=right/top)',
    !out.err && out.noteX.center === 0 && out.noteX.leftIsNegative && out.noteX.rightIsPositive && out.noteX.symmetric && out.noteY.bottomBelow && out.noteY.topAbove,
    JSON.stringify(out.noteX) + ' ' + JSON.stringify(out.noteY));
  check('noteX span (width) uses convert(value)-convert(0)',
    !out.err && out.noteXSpan.positive && out.noteXSpan.equalsTwoHalves,
    JSON.stringify(out.noteXSpan));
  check('stageY points up for stage objects',
    !out.err && out.stageY.topOk && out.stageY.botOk && out.stageY.centerOk,
    JSON.stringify(out.stageY));
  check('cameraX positive moves scene left (half screen)',
    !out.err && out.cameraX.sceneLeft,
    JSON.stringify(out.cameraX));
  check('cameraY positive moves scene down (half screen)',
    !out.err && out.cameraY.sceneDown,
    JSON.stringify(out.cameraY));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
