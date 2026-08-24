// verify_round15.js — holdbar below notes, ripples below hold body, drag head
// inner fill fade-only + outer white growth.
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
      const W = pv.canvas.width, H = pv.canvas.height;
      const ctx = pv.canvas.getContext('2d');

      // 1. Holdbars must be drawn BEFORE any note body
      const order = [];
      const on = pv.drawNote.bind(pv);
      const oh = pv.drawHoldBars.bind(pv);
      const or = pv.drawHoldRipples.bind(pv);
      const ot = pv.tintDraw.bind(pv);
      pv.drawNote = (...a) => { order.push('note'); return on(...a); };
      pv.drawHoldBars = (...a) => { order.push('holdbar'); return oh(...a); };
      pv.drawHoldRipples = (...a) => { order.push('ripple'); return or(...a); };
      pv.tintDraw = (...a) => { order.push('body'); return ot(...a); };
      const hold = ch.notes.find(n => n.type === 2 && n.end_time - n.start_time > 1);
      if (!hold) return { err: 'no hold' };
      pv.setTime((hold.start_time + hold.end_time) / 2, false);
      pv.render();
      pv.drawNote = on;
      pv.drawHoldBars = oh;
      pv.drawHoldRipples = or;
      pv.tintDraw = ot;
      const firstNote = order.indexOf('note');
      const holdbarIndices = order.map((v, i) => v === 'holdbar' ? i : -1).filter(i => i >= 0);
      const rippleIndices = order.map((v, i) => v === 'ripple' ? i : -1).filter(i => i >= 0);
      const bodyIndices = order.map((v, i) => v === 'body' ? i : -1).filter(i => i >= 0);
      const holdbarBelowNotes = holdbarIndices.every(i => i < firstNote);
      // Ripples are drawn inside drawNote BEFORE the body fill: the first
      // ripple must come before the first body draw.
      const rippleAfterHoldbar = rippleIndices.length > 0 && rippleIndices[0] > holdbarIndices[0];
      const rippleBelowBody = rippleIndices.length > 0 && bodyIndices.length > 0 && rippleIndices[0] < bodyIndices[0];

      // 2. Drag head: inner colored fill constant, outer white grows
      let head = null;
      let best = 1e9;
      for (const n of ch.notes) {
        if (n.type !== 3) continue;
        const near = ch.notes.filter(o => o.id !== n.id && Math.abs(o.start_time - n.start_time) < 1.2).length;
        if (near < best) { best = near; head = n; }
      }
      const headRes = {};
      if (!head) {
        headRes.err = 'no drag head';
      } else {
        const info = pv.ctxInfo();
        const mid = (head.intro_time + head.start_time) / 2;
        const midP = pv.noteVisualParams(head, info, 1, null, null, mid);
        const startP = pv.noteVisualParams(head, info, 1, null, null, head.start_time);
        headRes.dMid = +midP.d.toFixed(1);
        headRes.dStart = +startP.d.toFixed(1);
        headRes.innerMid = +(midP.diameter * 0.33).toFixed(1);
        headRes.innerStart = +(startP.diameter * 0.33).toFixed(1);
        // Outer white ring grows from the inner-fill size toward full size
        headRes.outerGrows = midP.d < startP.d * 0.92 && midP.d > startP.d * 0.33 * 0.8;
        // Inner colored fill stays at its final size (fade-only, like sub-drag)
        headRes.innerConstant = Math.abs(headRes.innerMid - headRes.innerStart) < 1;
        headRes.id = head.id;
      }

      return { orderSample: order.slice(0, 10), holdbarBelowNotes, rippleAfterHoldbar, rippleBelowBody, headRes };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('holdbar drawn below all notes',
    !out.err && out.holdbarBelowNotes,
    JSON.stringify(out.orderSample));
  check('ripples below hold body (after holdbar, inside note)',
    !out.err && out.rippleAfterHoldbar && out.rippleBelowBody,
    JSON.stringify({ rippleAfterHoldbar: out.rippleAfterHoldbar, rippleBelowBody: out.rippleBelowBody }));
  check('drag head inner fill constant + outer white grows',
    !out.err && out.headRes && !out.headRes.err && out.headRes.innerConstant && out.headRes.outerGrows,
    JSON.stringify(out.headRes));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
